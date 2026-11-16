import { ArgumentsHost, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

function prismaError(code: string, message: string): Error {
  const error = new Error(message);
  error.name = 'PrismaClientKnownRequestError';
  return Object.assign(error, { code });
}

async function run(databaseError: Error) {
  const logged: string[] = [];
  vi.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(args.map((a) => String(a)).join(' '));
  });
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const request = {
    method: 'POST',
    route: { path: '/api/v1/things' },
    headers: { authorization: 'Bearer HEADER-SECRET' },
    body: { note: 'BODY-SECRET' },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;
  const exception = await executeDatabaseOperation(async () => {
    throw databaseError;
  }).catch((error: unknown) => error);
  new ApiExceptionFilter().catch(exception, host);
  return { logged, response };
}

describe('ApiExceptionFilter server errors', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs a unique-constraint failure with its Prisma code and answers 500', async () => {
    const { logged, response } = await run(
      prismaError('P2002', 'Unique constraint failed: person@example.com'),
    );
    expect(response.status).toHaveBeenCalledWith(500);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('PrismaClientKnownRequestError');
    expect(logged[0]).toContain('P2002');
    expect(response.json.mock.calls[0][0].error.code).toBe('INTERNAL_ERROR');
  });

  it('still answers a connection failure with 503 and its own code', async () => {
    const { logged, response } = await run(prismaError('P1001', 'cannot reach db'));
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json.mock.calls[0][0].error.code).toBe('SERVICE_UNAVAILABLE');
    expect(logged[0]).toContain('P1001');
  });

  it('never logs a message, value, request body or header', async () => {
    const { logged } = await run(
      prismaError('P2002', 'Unique constraint failed: person@example.com'),
    );
    const text = logged.join('\n');
    for (const secret of ['person@example.com', 'Unique constraint', 'BODY-SECRET', 'HEADER-SECRET']) {
      expect(text).not.toContain(secret);
    }
  });
});
