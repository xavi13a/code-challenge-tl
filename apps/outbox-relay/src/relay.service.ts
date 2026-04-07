import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { MAX_RETRIES, RETRY_DELAY_MS, sleep } from '@shared/retry-policy';
import { createLogger } from '@shared/logger';
import { OutboxReader } from './outbox.reader';
import { OutboxPublisher } from './outbox.publisher';

@Injectable()
export class RelayService implements OnModuleDestroy {
  private readonly logger = createLogger(RelayService.name);
  private stopped = false;

  constructor(
    @Inject(OutboxReader) private readonly outboxReader: OutboxReader,
    @Inject(OutboxPublisher) private readonly outboxPublisher: OutboxPublisher
  ) {}

  async run(): Promise<void> {
    this.logger.log('Outbox relay started');

    while (!this.stopped) {
      const events = await this.outboxReader.readPending(20);

      for (const event of events) {
        try {
          await this.outboxPublisher.publish(event.topic, event.payload);
          await this.outboxReader.markPublished(event.id);
          this.logger.log(`Published outbox event ${event.id} to ${event.topic}`);
        } catch (error) {
          const attempts = event.attempts + 1;
          const exhausted = attempts >= MAX_RETRIES;
          await this.outboxReader.markRetry(event.id, attempts, exhausted);
          this.logger.error(
            `Failed to publish outbox event ${event.id}. attempts=${attempts}. exhausted=${exhausted}`,
            error instanceof Error ? error.stack : undefined
          );
        }
      }

      await sleep(RETRY_DELAY_MS);
    }
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }
}
