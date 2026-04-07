import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { PaymentCreatedV1 } from '@contracts/payment-created.v1';
import type { PaymentFailedV1 } from '@contracts/payment-failed.v1';
import type { PaymentSettledV1 } from '@contracts/payment-settled.v1';
import { TOPIC_NAMES } from '@shared/topic-names';
import { MAX_RETRIES, RETRY_DELAY_MS, sleep } from '@shared/retry-policy';
import { createLogger } from '@shared/logger';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';
import { ProcessedEventsRepository } from './processed-events.repository';
import { DltPublisher } from './dlt.publisher';

@Injectable()
export class LedgerConsumer {
  private readonly logger = createLogger(LedgerConsumer.name);
  private static readonly consumerName = 'ledger-worker';

  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    @Inject(LedgerRepository)
    private readonly ledgerRepository: LedgerRepository,
    @Inject(LedgerService) private readonly ledgerService: LedgerService,
    @Inject(ProcessedEventsRepository)
    private readonly processedEventsRepository: ProcessedEventsRepository,
    @Inject(DltPublisher) private readonly dltPublisher: DltPublisher
  ) {}

  async processEnvelope(envelope: PaymentCreatedV1): Promise<void> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const isNew = await this.processedEventsRepository.register(
            tx,
            LedgerConsumer.consumerName,
            envelope.eventId
          );

          if (!isNew) {
            return { duplicate: true, settled: false };
          }

          if (this.ledgerService.shouldFail(envelope.payload.currency)) {
            throw new Error('Ledger rejected unsupported currency');
          }

          const advance = await this.ledgerRepository.createEntriesAndAdvancePayment(tx, {
            paymentId: envelope.aggregateId,
            amount: envelope.payload.amount,
            currency: envelope.payload.currency
          });

          return { duplicate: false, settled: advance.settled };
        });

        if (result.duplicate) {
          this.logger.log(`Skipping duplicated event ${envelope.eventId}`);
          return;
        }

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
          this.ledgerRepository.markPaymentFailed(tx, envelope.aggregateId)
        );

        const failedEvent: PaymentFailedV1 = {
          eventId: randomUUID(),
          eventType: TOPIC_NAMES.paymentFailedV1,
          occurredAt: new Date().toISOString(),
          aggregateId: envelope.aggregateId,
          traceId: envelope.traceId,
          payload: {
            reason: error instanceof Error ? error.message : 'Unexpected ledger processing error',
            failedBy: 'ledger-worker'
          }
        };

        await this.dltPublisher.publishFailed(failedEvent);
        this.logger.error(`Event ${envelope.eventId} sent to DLT after retry exhaustion`);
      }
    }
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
