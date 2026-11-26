import type { ArgumentsHost } from '@nestjs/common';
import { Logger, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { ApiExceptionFilter, describeError } from './api-exception.filter.js';

/** Issue #157. Every person, value and secret here is fictional. */

/** A Prisma error as the pg driver adapter reports it. */
function prismaError(code: string, kind?: string, message = 'failed') {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: '7.10.1',
    meta: kind
      ? { driverAdapterError: { name: 'DriverAdapterError', cause: { kind } } }
      : undefined,
  });
}
const PRIVATE = [
  'Fictional Person',
  '199012345678',
  'fictional.person@example.invalid',
  'secret-token',
  'Bearer',
  'email',
  'INSERT',
];

async function rejection(error: unknown) {
  try {
    await executeDatabaseOperation(async () => {
      throw error;
    });
  } catch (caught) {
    return caught;
  }
  throw new Error('expected a rejection');
}

function run(exception: unknown) {
  const json = vi.fn();
  const status = vi.fn((_code: number) => ({ json }));
  const request = {
    method: 'POST',
    route: { path: '/api/v1/societies/:id/members' },
    headers: {
      'x-request-id': 'req-157',
      authorization: 'Bearer secret-token',
    },
    body: { name: 'Fictional Person', nic: '199012345678' },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  new ApiExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
}

describe('ApiExceptionFilter', () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    vi.spyOn(Logger.prototype, 'error').mockImplementation(
      (message: unknown) => {
        logged.push(String(message));
      },
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('logs a unique-constraint failure with its Prisma code and answers 500', async () => {
    const duplicate = prismaError(
      'P2002',
      'UniqueConstraintViolation',
      'Unique constraint failed on the fields: (`email`) INSERT fictional.person@example.invalid',
    );
    const { status, body } = run(await rejection(duplicate));

    expect(status).toBe(500);
    expect(body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId: 'req-157',
    });
    expect(logged).toEqual([
      'POST /api/v1/societies/:id/members failed with 500 (InternalServerErrorException; cause PrismaClientKnownRequestError P2002 UniqueConstraintViolation); requestId req-157',
    ]);
  });

  it('answers a connection failure with 503 and its own code', async () => {
    const { status, body } = run(
      await rejection(prismaError('P1001', 'DatabaseNotReachable')),
    );
    expect(status).toBe(503);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.error.message).toBe('Database temporarily unavailable');
    expect(logged[0]).toContain(
      '(ServiceUnavailableException; cause PrismaClientKnownRequestError P1001 DatabaseNotReachable)',
    );
  });

  it('logs an unwrapped error by its own class and code', () => {
    const { status } = run(
      new Prisma.PrismaClientKnownRequestError(
        'Fictional Person 199012345678',
        {
          code: 'P2025',
          clientVersion: '7.10.1',
        },
      ),
    );
    expect(status).toBe(500);
    expect(logged[0]).toContain('(PrismaClientKnownRequestError P2025)');
  });

  it('never logs a message, value, query, request body or header', async () => {
    const errors = [
      prismaError(
        'P2002',
        'UniqueConstraintViolation',
        'INSERT Fictional Person 199012345678',
      ),
      new Error('Fictional Person 199012345678 secret-token'),
      new TypeError("Cannot read 'email' of fictional.person@example.invalid"),
      Object.assign(new Error('x'), { code: 'Fictional Person 199012345678' }),
    ];
    for (const error of errors) {
      run(await rejection(error));
      run(error);
    }
    expect(logged.length).toBe(errors.length * 2);
    for (const line of logged) {
      for (const value of PRIVATE) expect(line).not.toContain(value);
    }
  });

  it('does not log expected refusals', () => {
    const { status, body } = run(new NotFoundException('Society not found'));
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(logged).toEqual([]);
  });
});

describe('describeError', () => {
  it('keeps only names and codes that match fixed patterns', () => {
    expect(
      describeError(Object.assign(new Error('m'), { code: 'ECONNREFUSED' })),
    ).toBe('Error ECONNREFUSED');
    expect(
      describeError(Object.assign(new Error('m'), { code: 'not a code' })),
    ).toBe('Error');
    class StorageOfflineError extends Error {}
    expect(describeError(new StorageOfflineError('m'))).toBe(
      'StorageOfflineError',
    );
    const odd = new Error('m');
    Object.defineProperty(odd, 'constructor', {
      value: { name: 'has spaces in it' },
    });
    expect(describeError(odd)).toBe('Error');
    expect(describeError('a string')).toBe('unknown error');
    expect(describeError({ code: 'P2002' })).toBe('non-Error object P2002');
  });
});
