import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import type { PaymentFailedV1 } from '@contracts/payment-failed.v1';
import type { PaymentSettledV1 } from '@contracts/payment-settled.v1';
import { TOPIC_NAMES } from '@shared/topic-names';

@Injectable()
export class DltPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly producer: Producer;

  constructor() {
    const kafka = new Kafka({
      clientId: 'ledger-worker-publisher',
      brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',')
    });
    this.producer = kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  async publishFailed(event: PaymentFailedV1): Promise<void> {
    await this.producer.send({
      topic: TOPIC_NAMES.paymentFailedV1,
      messages: [{ value: JSON.stringify(event) }]
    });
  }

  async publishSettled(event: PaymentSettledV1): Promise<void> {
    await this.producer.send({
      topic: TOPIC_NAMES.paymentSettledV1,
      messages: [{ value: JSON.stringify(event) }]
    });
  }
}
