import type { EventEnvelope } from './event-envelope';

export type PaymentFailedPayload = {
  reason: string;
  failedBy: 'fraud-worker' | 'ledger-worker';
};

export type PaymentFailedV1 = EventEnvelope<PaymentFailedPayload>;
