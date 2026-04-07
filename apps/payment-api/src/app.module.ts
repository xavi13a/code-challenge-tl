import { Module } from '@nestjs/common';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { PaymentsRepository } from './payments/payments.repository';
import { OutboxRepository } from './outbox/outbox.repository';
import { PrismaService } from './db/prisma.service';

@Module({
  controllers: [PaymentsController],
  providers: [PrismaService, PaymentsService, PaymentsRepository, OutboxRepository]
})
export class AppModule {}
