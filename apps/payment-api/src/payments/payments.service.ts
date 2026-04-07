import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { withTransaction } from '../db/transaction';
import { PaymentsRepository } from './payments.repository';
import { OutboxRepository } from '../outbox/outbox.repository';
import { toPaymentCreatedOutboxEvent } from '../outbox/outbox.mapper';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { PaymentStatusResponse } from './entities/payment-status.entity';

@Injectable()
export class PaymentsService {
  private static readonly eventualConsistencyMessage =
    'Payment accepted. Final status depends on downstream consumers.';

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PaymentsRepository)
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(OutboxRepository) private readonly outboxRepository: OutboxRepository
  ) {}

  async createPayment(dto: CreatePaymentDto): Promise<Pick<PaymentStatusResponse, 'paymentId' | 'status' | 'consistency'>> {
    const payment = await withTransaction(this.prisma, async (tx) => {
      const created = await this.paymentsRepository.createPendingPayment(tx, {
        countryCode: dto.countryCode,
        amount: dto.amount,
        currency: dto.currency
      });

      const outboxEvent = toPaymentCreatedOutboxEvent({
        paymentId: created.id,
        countryCode: created.countryCode,
        amount: Number(created.amount),
        currency: created.currency
      });

      await this.outboxRepository.createPendingEvent(tx, outboxEvent);
      return created;
    });

    return {
      paymentId: payment.id,
      status: payment.status,
      consistency: {
        model: 'eventual',
        message: PaymentsService.eventualConsistencyMessage
      }
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    const payment = await this.prisma.$transaction(async (tx) => this.paymentsRepository.findById(tx, paymentId));

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} was not found`);
    }

    return this.toStatusResponse(payment);
  }

  private toStatusResponse(payment: Payment): PaymentStatusResponse {
    return {
      paymentId: payment.id,
      status: payment.status,
      fraudStatus: payment.fraudStatus,
      ledgerStatus: payment.ledgerStatus,
      consistency: {
        model: 'eventual',
        message: 'This resource may remain pending until downstream consumers complete.'
      }
    };
  }
}
