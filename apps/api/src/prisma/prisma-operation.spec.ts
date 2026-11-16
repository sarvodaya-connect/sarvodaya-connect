import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { executeDatabaseOperation } from './prisma-operation.js';

function prismaError(name: string, code: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return Object.assign(error, { code });
}

describe('executeDatabaseOperation', () => {
  it('returns a successful database result', async () => {
    await expect(
      executeDatabaseOperation(async () => ({ count: 3 })),
    ).resolves.toEqual({ count: 3 });
  });

  it('answers a connection failure with a safe 503', async () => {
    const databaseError = prismaError(
      'PrismaClientKnownRequestError',
      'P1001',
      'connect failed for postgresql://user:secret@localhost/database',
    );
    const call = executeDatabaseOperation(async () => {
      throw databaseError;
    });
    await expect(call).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(call).rejects.toMatchObject({
      message: 'Database temporarily unavailable',
      cause: databaseError,
    });
    await expect(call).rejects.not.toThrow('secret');
  });

  it('treats raw network errors and initialization errors as 503', async () => {
    for (const error of [
      prismaError('Error', 'ECONNREFUSED', 'refused'),
      prismaError('PrismaClientInitializationError', 'P1000', 'init'),
    ]) {
      await expect(
        executeDatabaseOperation(async () => {
          throw error;
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('answers a unique-constraint failure with a 500, not an outage', async () => {
    const databaseError = prismaError(
      'PrismaClientKnownRequestError',
      'P2002',
      'Unique constraint failed on email',
    );
    const call = executeDatabaseOperation(async () => {
      throw databaseError;
    });
    await expect(call).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(call).rejects.toMatchObject({ cause: databaseError });
  });

  it('answers an ordinary programming error with a 500', async () => {
    await expect(
      executeDatabaseOperation(async () => {
        throw new TypeError('x is undefined');
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
