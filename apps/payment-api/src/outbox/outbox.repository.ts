import { Injectable } from '@nestjs/common';
import type { OutboxEvent, Prisma } from '@prisma/client';

@Injectable()
export class OutboxRepository {
  async createPendingEvent(
    tx: Prisma.TransactionClient,
    input: {
      id: string;
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      topic: string;
      payload: Prisma.InputJsonValue;
    }
  ): Promise<OutboxEvent> {
    return tx.outboxEvent.create({
      data: {
        id: input.id,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        topic: input.topic,
        payload: input.payload,
        status: 'pending'
      }
    });
  }
}
