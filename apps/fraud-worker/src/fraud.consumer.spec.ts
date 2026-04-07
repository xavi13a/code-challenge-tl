import { FraudConsumer } from './fraud.consumer';
import type { PaymentCreatedV1 } from '@contracts/payment-created.v1';

describe('FraudConsumer idempotency', () => {
  it('does not produce duplicate side effects for the same eventId', async () => {
    const envelope: PaymentCreatedV1 = {
      eventId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      eventType: 'payment.created.v1',
      occurredAt: new Date().toISOString(),
      aggregateId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      traceId: 'trace-1',
      payload: {
        countryCode: 'PE',
        amount: 99,
        currency: 'PEN'
      }
    };

    const prisma = {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({}))
    };

    const fraudRepository = {
      createResultAndAdvancePayment: jest.fn(async () => ({ settled: false })),
      markPaymentFailed: jest.fn(async () => undefined)
    };

    const fraudService = {
      evaluate: jest.fn(() => ({ decision: 'approve', riskLevel: 'low' }))
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

    const consumer = new FraudConsumer(
      prisma as never,
      fraudRepository as never,
      fraudService as never,
      processedEventsRepository as never,
      dltPublisher as never
    );

    await consumer.processEnvelope(envelope);
    await consumer.processEnvelope(envelope);

    expect(processedEventsRepository.register).toHaveBeenCalledTimes(2);
    expect(fraudRepository.createResultAndAdvancePayment).toHaveBeenCalledTimes(1);
    expect(dltPublisher.publishFailed).not.toHaveBeenCalled();
  });

  it('registers reject decision with reason for high-value payment and publishes failed event', async () => {
    const envelope: PaymentCreatedV1 = {
      eventId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      eventType: 'payment.created.v1',
      occurredAt: new Date().toISOString(),
      aggregateId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      traceId: 'trace-2',
      payload: {
        countryCode: 'PE',
        amount: 10000,
        currency: 'PEN'
      }
    };

    const prisma = {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({}))
    };

    const fraudRepository = {
      createResultAndAdvancePayment: jest.fn(async () => ({ settled: false })),
      createRejectedResultAndMarkPaymentFailed: jest.fn(async () => undefined),
      markPaymentFailed: jest.fn(async () => undefined)
    };

    const fraudService = {
      evaluate: jest.fn(() => ({
        decision: 'reject' as const,
        riskLevel: 'high' as const,
        reason: 'Fraud engine failed for high-value payment'
      }))
    };

    const processedEventsRepository = {
      register: jest.fn<Promise<boolean>, [unknown, string, string]>().mockResolvedValue(true)
    };

    const dltPublisher = {
      publishFailed: jest.fn(async () => undefined),
      publishSettled: jest.fn(async () => undefined)
    };

    const consumer = new FraudConsumer(
      prisma as never,
      fraudRepository as never,
      fraudService as never,
      processedEventsRepository as never,
      dltPublisher as never
    );

    await consumer.processEnvelope(envelope);

    expect(fraudRepository.createRejectedResultAndMarkPaymentFailed).toHaveBeenCalledWith(
      expect.anything(),
      {
        paymentId: envelope.aggregateId,
        reason: 'Fraud engine failed for high-value payment'
      }
    );
    expect(fraudRepository.createResultAndAdvancePayment).not.toHaveBeenCalled();
    expect(dltPublisher.publishFailed).toHaveBeenCalledTimes(1);
  });
});
