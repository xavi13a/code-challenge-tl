import { PaymentsService } from '../src/payments/payments.service';
import { TOPIC_NAMES } from '@shared/topic-names';

describe('PaymentsService', () => {
  it('creates payment and outbox event in one local transaction', async () => {
    const tx = { tx: true };

    const prisma = {
      $transaction: jest.fn(async (cb: (innerTx: unknown) => Promise<unknown>) => cb(tx))
    };

    const paymentsRepository = {
      createPendingPayment: jest.fn(async () => ({
        id: '11111111-1111-1111-1111-111111111111',
        countryCode: 'PE',
        amount: 120.5,
        currency: 'PEN',
        status: 'pending',
        fraudStatus: 'pending',
        ledgerStatus: 'pending'
      }))
    };

    const outboxRepository = {
      createPendingEvent: jest.fn(async () => ({ id: 'event-id' }))
    };

    const service = new PaymentsService(
      prisma as never,
      paymentsRepository as never,
      outboxRepository as never
    );

    const result = await service.createPayment({
      countryCode: 'PE',
      amount: 120.5,
      currency: 'PEN'
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(paymentsRepository.createPendingPayment).toHaveBeenCalledWith(tx, {
      countryCode: 'PE',
      amount: 120.5,
      currency: 'PEN'
    });
    expect(outboxRepository.createPendingEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        aggregateType: 'payment',
        aggregateId: '11111111-1111-1111-1111-111111111111',
        eventType: TOPIC_NAMES.paymentCreatedV1,
        topic: TOPIC_NAMES.paymentCreatedV1
      })
    );

    expect(result).toEqual({
      paymentId: '11111111-1111-1111-1111-111111111111',
      status: 'pending',
      consistency: {
        model: 'eventual',
        message: 'Payment accepted. Final status depends on downstream consumers.'
      }
    });
  });

  it('does not invoke any broker in PaymentService flow', async () => {
    const prisma = {
      $transaction: jest.fn(async (cb: (innerTx: unknown) => Promise<unknown>) => cb({}))
    };

    const paymentsRepository = {
      createPendingPayment: jest.fn(async () => ({
        id: '11111111-1111-1111-1111-111111111111',
        countryCode: 'PE',
        amount: 10,
        currency: 'PEN',
        status: 'pending',
        fraudStatus: 'pending',
        ledgerStatus: 'pending'
      }))
    };

    const outboxRepository = {
      createPendingEvent: jest.fn(async () => ({ id: 'event-id' }))
    };

    const service = new PaymentsService(
      prisma as never,
      paymentsRepository as never,
      outboxRepository as never
    );

    await service.createPayment({ countryCode: 'PE', amount: 10, currency: 'PEN' });

    // Architectural guard: the service has no broker dependency and writes only to DB + outbox.
    expect((service as { kafkaClient?: unknown }).kafkaClient).toBeUndefined();
  });
});
