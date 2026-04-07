import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Kafka } from 'kafkajs';
import type { PaymentCreatedV1 } from '@contracts/payment-created.v1';
import { TOPIC_NAMES } from '@shared/topic-names';
import { createLogger } from '@shared/logger';
import { FraudModule } from './fraud.module';
import { FraudConsumer } from './fraud.consumer';

async function bootstrap(): Promise<void> {
  const logger = createLogger('FraudMain');
  const app = await NestFactory.createApplicationContext(FraudModule);
  const fraudConsumer = app.get(FraudConsumer);

  const kafka = new Kafka({
    clientId: 'fraud-worker',
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',')
  });

  const consumer = kafka.consumer({ groupId: process.env.FRAUD_GROUP_ID ?? 'fraud-worker-group' });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC_NAMES.paymentCreatedV1, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      const envelope = JSON.parse(message.value.toString()) as PaymentCreatedV1;
      await fraudConsumer.processEnvelope(envelope);
    }
  });

  const shutdown = async (): Promise<void> => {
    logger.log('Shutting down fraud-worker');
    await consumer.disconnect();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void bootstrap();
