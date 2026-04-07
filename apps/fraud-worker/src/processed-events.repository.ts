import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProcessedEventsRepository {
  async register(
    tx: Prisma.TransactionClient,
    consumerName: string,
    eventId: string
  ): Promise<boolean> {
    try {
      await tx.processedEvent.create({
        data: {
          consumerName,
          eventId
        }
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}
