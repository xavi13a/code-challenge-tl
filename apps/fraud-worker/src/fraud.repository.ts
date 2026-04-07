import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class FraudRepository {
  async createResultAndAdvancePayment(
    tx: Prisma.TransactionClient,
    input: {
      paymentId: string;
      decision: string;
      riskLevel: string;
      reason?: string | null;
    }
  ): Promise<{ settled: boolean }> {
    await tx.fraudResult.create({
      data: {
        paymentId: input.paymentId,
        decision: input.decision,
        riskLevel: input.riskLevel,
        reason: input.reason ?? null
      }
    });

    await tx.payment.update({
      where: { id: input.paymentId },
      data: { fraudStatus: 'completed' }
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

  async createRejectedResultAndMarkPaymentFailed(
    tx: Prisma.TransactionClient,
    input: {
      paymentId: string;
      reason: string;
    }
  ): Promise<void> {
    await tx.fraudResult.create({
      data: {
        paymentId: input.paymentId,
        decision: 'reject',
        riskLevel: 'high',
        reason: input.reason
      }
    });

    await tx.payment.update({
      where: { id: input.paymentId },
      data: {
        status: 'failed',
        fraudStatus: 'failed'
      }
    });
  }

  async markPaymentFailed(tx: Prisma.TransactionClient, paymentId: string): Promise<void> {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'failed',
        fraudStatus: 'failed'
      }
    });
  }
}
