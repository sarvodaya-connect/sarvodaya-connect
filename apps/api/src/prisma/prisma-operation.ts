import { ServiceUnavailableException } from '@nestjs/common';

const DATABASE_UNAVAILABLE_MESSAGE = 'Database temporarily unavailable';

/**
 * Keeps database implementation details and connection errors out of API
 * responses while retaining the original error as the exception cause.
 */
export async function executeDatabaseOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, {
      cause: error,
    });
  }
}
