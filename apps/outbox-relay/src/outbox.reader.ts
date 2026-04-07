import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class OutboxReader {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async readPending(limit: number) {
    return this.prisma.outboxEvent.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit
    });
  }

  async markPublished(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'published',
        publishedAt: new Date()
      }
    });
  }

  async markRetry(eventId: string, attempts: number, exhausted: boolean): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        attempts,
        status: exhausted ? 'failed' : 'pending'
      }
    });
  }
}
