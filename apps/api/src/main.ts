import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new ApiExceptionFilter());

  // Browsers upload straight to storage. With S3 the bucket's CORS rules allow
  // that; with the local development driver the API serves the upload link, so
  // the dashboard origin must be listed here. Empty means no cross-origin access.
  const corsOrigins = (configService.get<string>('CORS_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length) {
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'PUT'],
      allowedHeaders: ['Content-Type', 'x-amz-checksum-sha256'],
      credentials: false,
    });
  }

  const port = Number(configService.get<string>('API_PORT') ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be a valid port number');
  }

  await app.listen(port);
}

await bootstrap();
