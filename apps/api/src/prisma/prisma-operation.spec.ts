import {
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { Prisma } from '../generated/prisma/client.js';
import {
  executeDatabaseOperation,
  isDatabaseUnavailable,
} from './prisma-operation.js';

/** A Prisma error as the pg driver adapter reports it. Fictional values only. */
function prismaError(code: string, kind?: string, message = 'failed') {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: '7.10.1',
    meta: kind
      ? { driverAdapterError: { name: 'DriverAdapterError', cause: { kind } } }
      : undefined,
  });
}

function fails(error: unknown) {
  return executeDatabaseOperation(async () => {
    throw error;
  });
}

describe('executeDatabaseOperation', () => {
  it('returns a successful database result', async () => {
    await expect(
      executeDatabaseOperation(async () => ({ count: 3 })),
    ).resolves.toEqual({ count: 3 });
  });

  it('passes a deliberate HTTP error on unchanged', async () => {
    const conflict = new ConflictException('Already decided');
    await expect(fails(conflict)).rejects.toBe(conflict);
  });

  it('answers a unique-constraint failure with 500, keeping the cause', async () => {
    const duplicate = prismaError(
      'P2002',
      'UniqueConstraintViolation',
      'Unique constraint failed on the fields: (`email`) for fictional.person@example.invalid',
    );
    const call = fails(duplicate);
    await expect(call).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(call).rejects.toMatchObject({
      message: 'Internal server error',
      cause: duplicate,
    });
    await expect(call).rejects.not.toThrow('fictional.person');
  });

  it('answers programming errors and unknown failures with 500', async () => {
    await expect(
      fails(
        new TypeError("Cannot read properties of undefined (reading 'id')"),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    const leaked = fails(
      new Error(
        'password authentication failed for postgresql://user:secret@db',
      ),
    );
    await expect(leaked).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(leaked).rejects.not.toThrow('secret');
  });

  it.each([
    [
      'cannot reach the database (P1001)',
      prismaError('P1001', 'DatabaseNotReachable'),
    ],
    [
      'a raw query that cannot connect (P2010)',
      prismaError('P2010', 'DatabaseNotReachable'),
    ],
    ['the server closed the connection', prismaError('P1017')],
    ['no pool connection became free (P2024)', prismaError('P2024')],
    ['a socket timeout', prismaError('P2010', 'SocketTimeout')],
    [
      'the client could not start',
      new Prisma.PrismaClientInitializationError(
        "Can't reach database server",
        '7.10.1',
      ),
    ],
    [
      'the pool timed out connecting',
      new Error('Connection terminated due to connection timeout'),
    ],
    [
      'every pool connection was busy',
      new Error('timeout exceeded when trying to connect'),
    ],
    [
      'the host refused',
      Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' }),
    ],
    [
      'a reset socket behind another error',
      new Error('query failed', {
        cause: Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
      }),
    ],
  ])('still answers 503 when %s', async (_, error) => {
    const call = fails(error);
    await expect(call).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(call).rejects.toMatchObject({
      message: 'Database temporarily unavailable',
      cause: error,
    });
  });

  it('does not treat other Prisma failures as an outage', () => {
    for (const [code, kind] of [
      ['P2002', 'UniqueConstraintViolation'],
      ['P2003', 'ForeignKeyConstraintViolation'],
      ['P2025', undefined],
      ['P2034', 'TransactionWriteConflict'],
      ['P2010', 'AuthenticationFailed'],
    ] as const) {
      expect(isDatabaseUnavailable(prismaError(code, kind)), code).toBe(false);
    }
    expect(isDatabaseUnavailable(null)).toBe(false);
    expect(isDatabaseUnavailable('ECONNREFUSED')).toBe(false);
  });
});
