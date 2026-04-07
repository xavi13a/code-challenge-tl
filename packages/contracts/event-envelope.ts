export type EventEnvelope<T> = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  aggregateId: string;
  traceId: string;
  payload: T;
};
