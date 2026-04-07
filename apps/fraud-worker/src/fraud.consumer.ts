import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { PaymentCreatedV1 } from '@contracts/payment-created.v1';
import type { PaymentFailedV1 } from '@contracts/payment-failed.v1';
import type { PaymentSettledV1 } from '@contracts/payment-settled.v1';
import { TOPIC_NAMES } from '@shared/topic-names';
import { newTraceId } from '@shared/correlation';
import { MAX_RETRIES, RETRY_DELAY_MS, sleep } from '@shared/retry-policy';
import { createLogger } from '@shared/logger';
import { FraudRepository } from './fraud.repository';
import { FraudService } from './fraud.service';
import { ProcessedEventsRepository } from './processed-events.repository';
import { DltPublisher } from './dlt.publisher';

@Injectable()
export class FraudConsumer {
  private readonly logger = createLogger(FraudConsumer.name);
  private static readonly consumerName = 'fraud-worker';

  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    @Inject(FraudRepository)
    private readonly fraudRepository: FraudRepository,
    @Inject(FraudService) private readonly fraudService: FraudService,
    @Inject(ProcessedEventsRepository)
    private readonly processedEventsRepository: ProcessedEventsRepository,
    @Inject(DltPublisher) private readonly dltPublisher: DltPublisher
  ) {}

  async processEnvelope(envelope: PaymentCreatedV1): Promise<void> {
    type ProcessingResult =
      | { duplicate: true; settled: false; rejected: false; rejectReason: null }
      | { duplicate: false; settled: boolean; rejected: false; rejectReason: null }
      | { duplicate: false; settled: false; rejected: true; rejectReason: string };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const result: ProcessingResult = await this.prisma.$transaction(async (tx) => {
          const isNew = await this.processedEventsRepository.register(
            tx,
            FraudConsumer.consumerName,
            envelope.eventId
          );

          if (!isNew) {
            return { duplicate: true, settled: false, rejected: false, rejectReason: null };
          }

          const evaluated = this.fraudService.evaluate(envelope.payload.amount);

          if (evaluated.decision === 'reject') {
            await this.fraudRepository.createRejectedResultAndMarkPaymentFailed(tx, {
              paymentId: envelope.aggregateId,
              reason: evaluated.reason
            });

            return {
              duplicate: false,
              settled: false,
              rejected: true,
              rejectReason: evaluated.reason
            };
          }

          const advance = await this.fraudRepository.createResultAndAdvancePayment(tx, {
            paymentId: envelope.aggregateId,
            decision: evaluated.decision,
            riskLevel: evaluated.riskLevel
          });

          return {
            duplicate: false,
            settled: advance.settled,
            rejected: false,
            rejectReason: null
          };
        });

        if (result.duplicate) {
          this.logger.log(`Skipping duplicated event ${envelope.eventId}`);
          return;
        }

        if (result.rejected) {
          await this.publishFailed(envelope.aggregateId, envelope.traceId, result.rejectReason);
          this.logger.log(
            `Rejected payment ${envelope.aggregateId} from event ${envelope.eventId}: ${result.rejectReason}`
          );
          return;
        }

        this.logger.log(
          `Processed new event ${envelope.eventId} for payment ${envelope.aggregateId} successfully`
        );

        if (result.settled) {
          await this.publishSettled(envelope.aggregateId, envelope.traceId);
        }

        return;
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        await this.prisma.$transaction((tx) =>
          this.fraudRepository.markPaymentFailed(tx, envelope.aggregateId)
        );

        const reason =
          error instanceof Error ? error.message : 'Unexpected fraud processing error';
        await this.publishFailed(envelope.aggregateId, envelope.traceId, reason);
        this.logger.error(`Event ${envelope.eventId} sent to DLT after retry exhaustion`);
      }
    }
  }

  private async publishFailed(paymentId: string, traceId: string, reason: string): Promise<void> {
    const failedEvent: PaymentFailedV1 = {
      eventId: randomUUID(),
      eventType: TOPIC_NAMES.paymentFailedV1,
      occurredAt: new Date().toISOString(),
      aggregateId: paymentId,
      traceId,
      payload: {
        reason,
        failedBy: 'fraud-worker'
      }
    };

    await this.dltPublisher.publishFailed(failedEvent);
  }

  private async publishSettled(paymentId: string, traceId: string): Promise<void> {
    const settledEvent: PaymentSettledV1 = {
      eventId: randomUUID(),
      eventType: TOPIC_NAMES.paymentSettledV1,
      occurredAt: new Date().toISOString(),
      aggregateId: paymentId,
      traceId,
      payload: {
        settledAt: new Date().toISOString()
      }
    };

    await this.dltPublisher.publishSettled(settledEvent);
  }
}
