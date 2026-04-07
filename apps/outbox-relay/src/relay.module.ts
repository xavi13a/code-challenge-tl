import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { OutboxReader } from './outbox.reader';
import { OutboxPublisher } from './outbox.publisher';
import { RelayService } from './relay.service';

@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: async () => {
        const client = new PrismaClient();
        await client.$connect();
        return client;
      }
    },
    OutboxReader,
    OutboxPublisher,
    RelayService
  ]
})
export class RelayModule {}
