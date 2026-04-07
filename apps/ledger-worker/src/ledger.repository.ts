import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class LedgerRepository {
  async createEntriesAndAdvancePayment(
    tx: Prisma.TransactionClient,
    input: {
      paymentId: string;
      amount: number;
      currency: string;
    }
  ): Promise<{ settled: boolean }> {
    await tx.ledgerEntry.createMany({
      data: [
        {
          paymentId: input.paymentId,
          entryType: 'debit',
          amount: input.amount,
          currency: input.currency
        },
        {
          paymentId: input.paymentId,
          entryType: 'credit',
          amount: input.amount,
          currency: input.currency
        }
      ]
    });

    await tx.payment.update({
      where: { id: input.paymentId },
      data: { ledgerStatus: 'completed' }
    });

    const settleUpdate = await tx.payment.updateMany({
      where: {
        id: input.paymentId,
        status: 'pending',
        fraudStatus: 'completed',
        ledgerStatus: 'completed'
      },
      data: { status: 'settled' }
    });

    return { settled: settleUpdate.count > 0 };
  }

  async markPaymentFailed(tx: Prisma.TransactionClient, paymentId: string): Promise<void> {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'failed',
        ledgerStatus: 'failed'
      }
    });
  }
}
