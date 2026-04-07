import { Injectable } from '@nestjs/common';
import { Prisma, Payment } from '@prisma/client';

@Injectable()
export class PaymentsRepository {
  async createPendingPayment(
    tx: Prisma.TransactionClient,
    input: { countryCode: string; amount: number; currency: string }
  ): Promise<Payment> {
    return tx.payment.create({
      data: {
        countryCode: input.countryCode,
        amount: input.amount,
        currency: input.currency,
        status: 'pending',
        fraudStatus: 'pending',
        ledgerStatus: 'pending'
      }
    });
  }

  async findById(tx: Prisma.TransactionClient, paymentId: string): Promise<Payment | null> {
    return tx.payment.findUnique({ where: { id: paymentId } });
  }
}
