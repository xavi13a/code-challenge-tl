import type { EventEnvelope } from './event-envelope';

export type PaymentSettledPayload = {
  settledAt: string;
};

export type PaymentSettledV1 = EventEnvelope<PaymentSettledPayload>;
