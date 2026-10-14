import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { executeDatabaseOperation } from './prisma-operation.js';

describe('executeDatabaseOperation', () => {
  it('returns a successful database result', async () => {
    await expect(
      executeDatabaseOperation(async () => ({ count: 3 })),
    ).resolves.toEqual({ count: 3 });
  });

  it('converts database failures to a safe API exception', async () => {
    const databaseError = new Error(
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
});
