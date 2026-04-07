import type { EventEnvelope } from './event-envelope';

export type PaymentCreatedPayload = {
  countryCode: string;
  amount: number;
  currency: string;
};

export type PaymentCreatedV1 = EventEnvelope<PaymentCreatedPayload>;
