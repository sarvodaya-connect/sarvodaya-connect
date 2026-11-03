import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApp, createLogger } from './app.setup.js';

/** Local and container entry point. On AWS Lambda the entry point is lambda.ts. */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: createLogger() });
  const configService = app.get(ConfigService);
  configureApp(app, configService);

  const port = Number(configService.get<string>('API_PORT') ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be a valid port number');
  }

  await app.listen(port);
}

await bootstrap();
