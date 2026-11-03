import { ConsoleLogger, type INestApplication, ValidationPipe } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { ApiExceptionFilter } from './common/api-exception.filter.js';

/**
 * Structured JSON logs (one object a line) in production and on Lambda, so
 * CloudWatch can filter them; readable text locally. LOG_FORMAT overrides.
 * Log lines carry names, ids and reasons only: never NICs, passwords, tokens
 * or document contents.
 */
export function createLogger(env: NodeJS.ProcessEnv = process.env): ConsoleLogger {
  const format = env.LOG_FORMAT?.trim().toLowerCase() || (env.NODE_ENV === 'production' || env.AWS_LAMBDA_FUNCTION_NAME ? 'json' : 'text');
  return new ConsoleLogger({ json: format === 'json', colors: format !== 'json' });
}

/** Everything both the local server (main.ts) and the Lambda handler (lambda.ts) set up. */
export function configureApp(app: INestApplication, config: ConfigService) {
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
  const corsOrigins = (config.get<string>('CORS_ALLOWED_ORIGINS') ?? '')
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
}
