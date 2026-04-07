import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { LedgerConsumer } from './ledger.consumer';
import { LedgerService } from './ledger.service';
import { LedgerRepository } from './ledger.repository';
import { ProcessedEventsRepository } from './processed-events.repository';
import { DltPublisher } from './dlt.publisher';

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
    LedgerConsumer,
    LedgerService,
    LedgerRepository,
    ProcessedEventsRepository,
    DltPublisher
  ]
})
export class LedgerModule {}
