import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { FraudConsumer } from './fraud.consumer';
import { FraudService } from './fraud.service';
import { FraudRepository } from './fraud.repository';
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
    FraudConsumer,
    FraudService,
    FraudRepository,
    ProcessedEventsRepository,
    DltPublisher
  ]
})
export class FraudModule {}
