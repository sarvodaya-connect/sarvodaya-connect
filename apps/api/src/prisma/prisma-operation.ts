import { HttpException, ServiceUnavailableException } from '@nestjs/common';

const DATABASE_UNAVAILABLE_MESSAGE = 'Database temporarily unavailable';

/**
 * Keeps database implementation details and connection errors out of API
 * responses while retaining the original error as the exception cause. A
 * deliberate HTTP error raised inside a transaction (such as a 409 when a
 * request was already decided) is passed on unchanged.
 */
export async function executeDatabaseOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, {
      cause: error,
    });
  }
}
