import { LedgerConsumer } from './ledger.consumer';
import type { PaymentCreatedV1 } from '@contracts/payment-created.v1';

describe('LedgerConsumer idempotency', () => {
  it('does not duplicate ledger entries for the same eventId', async () => {
    const envelope: PaymentCreatedV1 = {
      eventId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      eventType: 'payment.created.v1',
      occurredAt: new Date().toISOString(),
      aggregateId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      traceId: 'trace-2',
      payload: {
        countryCode: 'PE',
        amount: 150,
        currency: 'PEN'
      }
    };

    const prisma = {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({}))
    };

    const ledgerRepository = {
      createEntriesAndAdvancePayment: jest.fn(async () => ({ settled: false })),
      markPaymentFailed: jest.fn(async () => undefined)
    };

    const ledgerService = {
      shouldFail: jest.fn(() => false)
    };

    const processedEventsRepository = {
      register: jest
        .fn<Promise<boolean>, [unknown, string, string]>()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
    };

    const dltPublisher = {
      publishFailed: jest.fn(async () => undefined),
      publishSettled: jest.fn(async () => undefined)
    };

    const consumer = new LedgerConsumer(
      prisma as never,
      ledgerRepository as never,
      ledgerService as never,
      processedEventsRepository as never,
      dltPublisher as never
    );

    await consumer.processEnvelope(envelope);
    await consumer.processEnvelope(envelope);

    expect(processedEventsRepository.register).toHaveBeenCalledTimes(2);
    expect(ledgerRepository.createEntriesAndAdvancePayment).toHaveBeenCalledTimes(1);
    expect(dltPublisher.publishFailed).not.toHaveBeenCalled();
  });
});
