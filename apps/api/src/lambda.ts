import { configure as serverlessExpress } from '@codegenie/serverless-express';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';

import { AppModule } from './app.module.js';
import { loadRuntimeParameters } from './config/runtime-parameters.js';
import { configureApp, createLogger } from './app.setup.js';

/** Promise-style only: the Node.js 24 Lambda runtime no longer supports callback handlers. */
type ApiGatewayHandler = (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyStructuredResultV2>;

/**
 * AWS Lambda entry point behind an API Gateway HTTP API (payload format 2.0).
 * The Nest app is built once per Lambda instance and reused by later
 * invocations of the same instance; it holds no request or user state, so any
 * instance can serve any request. Database connections stay within
 * DATABASE_CONNECTION_LIMIT. The test environment connects directly to private RDS.
 */
let ready: Promise<ApiGatewayHandler> | undefined;

async function bootstrap(): Promise<ApiGatewayHandler> {
  await loadRuntimeParameters();
  const app = await NestFactory.create(AppModule, { logger: createLogger() });
  configureApp(app, app.get(ConfigService));
  await app.init();
  return serverlessExpress({ app: app.getHttpAdapter().getInstance() }) as unknown as ApiGatewayHandler;
}

export const handler: ApiGatewayHandler = async (event, context) => {
  // Return as soon as the response is ready, even with a database pool open.
  context.callbackWaitsForEmptyEventLoop = false;
  // A failed start is not cached, so the next invocation tries again.
  ready ??= bootstrap().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return (await ready)(event, context);
};
