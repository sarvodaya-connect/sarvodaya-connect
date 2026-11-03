/**
 * Local API Gateway + Lambda emulator (V5 PR 10). Serves the BUILT Lambda
 * handler (dist/lambda.js) the way an API Gateway HTTP API does: every
 * request becomes a payload-format 2.0 event and the handler's result becomes
 * the response. Use it to check the Lambda entry point without AWS:
 *
 *   npm run build && npm run lambda:local
 *
 * It enforces Lambda's 6 MB synchronous payload limit. It does not emulate IAM,
 * VPC networking or cold-start timing. `sam local start-api` with
 * infrastructure/aws/template.yaml is the alternative when AWS SAM CLI is installed.
 */
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';

const PORT = Number(process.env.LAMBDA_LOCAL_PORT ?? 3011);
const LAMBDA_PAYLOAD_LIMIT = 6 * 1024 * 1024;
const TEXT = /^(application\/(json|x-www-form-urlencoded)|text\/)/i;

type Handler = (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyStructuredResultV2>;

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > LAMBDA_PAYLOAD_LIMIT) throw new RangeError('payload too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function toEvent(request: IncomingMessage, body: Buffer): APIGatewayProxyEventV2 {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined && name !== 'cookie') headers[name] = Array.isArray(value) ? value.join(',') : value;
  }
  const contentType = headers['content-type'] ?? '';
  const binary = body.length > 0 && !TEXT.test(contentType);
  const now = new Date();
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    cookies: request.headers.cookie?.split(';').map((cookie) => cookie.trim()),
    headers,
    queryStringParameters: url.search ? Object.fromEntries(url.searchParams) : undefined,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      domainName: `localhost:${PORT}`,
      domainPrefix: 'localhost',
      http: { method: request.method ?? 'GET', path: url.pathname, protocol: 'HTTP/1.1', sourceIp: request.socket.remoteAddress ?? '127.0.0.1', userAgent: headers['user-agent'] ?? '' },
      requestId: randomUUID(),
      routeKey: '$default',
      stage: '$default',
      time: now.toUTCString(),
      timeEpoch: now.getTime(),
    },
    body: body.length ? body.toString(binary ? 'base64' : 'utf8') : undefined,
    isBase64Encoded: binary,
  };
}

function context(): Context {
  const deadline = Date.now() + 29_000;
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'sarvodaya-api-local',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:local:000000000000:function:sarvodaya-api-local',
    memoryLimitInMB: '1024',
    awsRequestId: randomUUID(),
    logGroupName: '/aws/lambda/sarvodaya-api-local',
    logStreamName: 'local',
    getRemainingTimeInMillis: () => Math.max(0, deadline - Date.now()),
    done: () => undefined,
    fail: () => undefined,
    succeed: () => undefined,
  };
}

// LAMBDA_HANDLER_PATH=.lambda/package/lambda.js checks the deployment package itself (npm run package:lambda).
const handlerPath = resolve(import.meta.dirname, '..', process.env.LAMBDA_HANDLER_PATH ?? 'dist/lambda.js');
const { handler } = (await import(pathToFileURL(handlerPath).href)) as { handler: Handler };
process.env.AWS_LAMBDA_FUNCTION_NAME ??= 'sarvodaya-api-local';

createServer(async (request, response) => {
  let body: Buffer;
  try {
    body = await readBody(request);
  } catch {
    response.writeHead(413, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { message: 'Request is larger than the 6 MB Lambda limit' } }));
    return;
  }
  const result = await handler(toEvent(request, body), context());
  const payload = result.body ? Buffer.from(result.body, result.isBase64Encoded ? 'base64' : 'utf8') : Buffer.alloc(0);
  if (payload.length > LAMBDA_PAYLOAD_LIMIT) {
    response.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { message: 'Response is larger than the 6 MB Lambda limit' } }));
    return;
  }
  const headers: Record<string, string | string[]> = { ...(result.headers as Record<string, string>) };
  if (result.cookies?.length) headers['set-cookie'] = result.cookies;
  response.writeHead(result.statusCode ?? 200, headers).end(payload);
}).listen(PORT, () => console.log(JSON.stringify({ level: 'log', message: `Lambda emulator on http://localhost:${PORT}/api/v1` })));
