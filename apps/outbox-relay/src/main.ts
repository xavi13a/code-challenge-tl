import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RelayModule } from './relay.module';
import { RelayService } from './relay.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(RelayModule);
  const relay = app.get(RelayService);

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await relay.run();
}

void bootstrap();
