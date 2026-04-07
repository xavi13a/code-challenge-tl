import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import type { PaymentCreatedV1 } from '@contracts/payment-created.v1';
import { TOPIC_NAMES } from '@shared/topic-names';
import { newTraceId } from '@shared/correlation';

export const toPaymentCreatedOutboxEvent = (input: {
  paymentId: string;
  countryCode: string;
  amount: number;
  currency: string;
}): {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  topic: string;
  payload: Prisma.InputJsonValue;
} => {
  const envelope: PaymentCreatedV1 = {
    eventId: randomUUID(),
    eventType: TOPIC_NAMES.paymentCreatedV1,
    occurredAt: new Date().toISOString(),
    aggregateId: input.paymentId,
    traceId: newTraceId(),
    payload: {
      countryCode: input.countryCode,
      amount: input.amount,
      currency: input.currency
    }
  };

  return {
    id: envelope.eventId,
    aggregateType: 'payment',
    aggregateId: input.paymentId,
    eventType: envelope.eventType,
    topic: TOPIC_NAMES.paymentCreatedV1,
    payload: envelope
  };
};
