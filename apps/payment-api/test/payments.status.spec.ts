import { PaymentsService } from '../src/payments/payments.service';

describe('GET /payments/:id eventual consistency view', () => {
  it('returns pending while one downstream consumer is still pending', async () => {
    const prisma = {
      $transaction: jest.fn(async (cb: (innerTx: unknown) => Promise<unknown>) => cb({}))
    };

    const paymentsRepository = {
      findById: jest.fn(async () => ({
        id: '11111111-1111-1111-1111-111111111111',
        countryCode: 'PE',
        amount: 120.5,
        currency: 'PEN',
        status: 'pending',
        fraudStatus: 'completed',
        ledgerStatus: 'pending'
      }))
    };

    const outboxRepository = {
      createPendingEvent: jest.fn()
    };

    const service = new PaymentsService(
      prisma as never,
      paymentsRepository as never,
      outboxRepository as never
    );

    const response = await service.getPaymentStatus('11111111-1111-1111-1111-111111111111');

    expect(response.status).toBe('pending');
    expect(response.fraudStatus).toBe('completed');
    expect(response.ledgerStatus).toBe('pending');
    expect(response.consistency.model).toBe('eventual');
  });
});
