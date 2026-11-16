import {
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

const DATABASE_UNAVAILABLE_MESSAGE = 'Database temporarily unavailable';

/** Prisma codes for an unreachable, closed or overloaded database. */
const CONNECTION_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);
/** Node network error codes the driver can report directly. */
const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

function isConnectionProblem(error: unknown, depth = 0): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'PrismaClientInitializationError') return true;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && (CONNECTION_CODES.has(code) || NETWORK_CODES.has(code))) {
    return true;
  }
  return depth < 2 && isConnectionProblem(error.cause, depth + 1);
}

/**
 * Keeps database implementation details out of API responses while retaining
 * the original error as the exception cause. Only connection and timeout
 * problems are reported as 503; everything else (constraint violations,
 * programming errors) is a 500. A deliberate HTTP error raised inside a
 * transaction (such as a 409 when a request was already decided) is passed on
 * unchanged.
 */
export async function executeDatabaseOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    if (isConnectionProblem(error)) {
      throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, {
        cause: error,
      });
    }
    throw new InternalServerErrorException('Internal server error', {
      cause: error,
    });
  }
}
