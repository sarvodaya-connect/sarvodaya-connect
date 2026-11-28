import {
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

const DATABASE_UNAVAILABLE_MESSAGE = 'Database temporarily unavailable';
const INTERNAL_ERROR_MESSAGE = 'Internal server error';

/**
 * Prisma codes for a database that cannot be reached or did not answer in
 * time: P1001 cannot reach the server, P1002 timed out reaching it, P1008
 * the operation timed out, P1017 the server closed the connection and P2024
 * no pool connection became free in time.
 */
const CONNECTION_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

/**
 * The same, as the pg driver adapter reports it. A raw query that cannot
 * connect fails with the generic P2010, so its adapter kind is checked too.
 */
const CONNECTION_KINDS = new Set([
  'DatabaseNotReachable',
  'ConnectionClosed',
  'SocketTimeout',
  'TooManyConnections',
  'TlsConnectionError',
]);

/** Socket errors Node reports when the database host does not answer. */
const SOCKET_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

/**
 * The pg pool's own connection failures, which reach us as plain errors
 * with no code (for example "Connection terminated due to connection
 * timeout", or "timeout exceeded when trying to connect" when every pool
 * connection is busy). Only used to decide the status; never logged.
 */
const POOL_MESSAGES =
  /^(Connection terminated( unexpectedly| due to connection timeout)|timeout exceeded when trying to connect)/;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/** The driver adapter's error kind, such as `UniqueConstraintViolation`. */
export function driverAdapterKind(error: unknown): string | undefined {
  const kind = record(
    record(record(record(error)?.meta)?.driverAdapterError)?.cause,
  )?.kind;
  return typeof kind === 'string' ? kind : undefined;
}

/**
 * Issue #157: true only when the database could not be reached or did not
 * answer in time, which is worth trying again. Constraint violations,
 * invalid queries and programming errors are not outages.
 */
export function isDatabaseUnavailable(error: unknown, depth = 0): boolean {
  const value = record(error);
  if (!value || depth > 3) return false;
  const name =
    error instanceof Error ? error.constructor.name || error.name : undefined;
  if (name === 'PrismaClientInitializationError') {
    // Its code is in errorCode: P1001 or P1002 is an outage, but P1000
    // (authentication failed) or another set-up failure is not. Without a
    // code it is treated as an outage, since the client could not start.
    const errorCode = value.errorCode;
    return typeof errorCode === 'string'
      ? CONNECTION_CODES.has(errorCode)
      : true;
  }
  const code = value.code;
  if (typeof code === 'string') {
    if (CONNECTION_CODES.has(code) || SOCKET_CODES.has(code)) return true;
  }
  const kind = driverAdapterKind(error);
  if (kind && CONNECTION_KINDS.has(kind)) return true;
  if (error instanceof Error && POOL_MESSAGES.test(error.message)) return true;
  return isDatabaseUnavailable(value.cause, depth + 1);
}

/**
 * Keeps database implementation details and connection errors out of API
 * responses while retaining the original error as the exception cause. A
 * deliberate HTTP error raised inside a transaction (such as a 409 when a
 * request was already decided) is passed on unchanged.
 *
 * Issue #157: only a database that cannot be reached or timed out is a 503.
 * Every other failure is a 500, so a constraint violation or a bug no longer
 * looks like an outage (and is not retried as one).
 */
export async function executeDatabaseOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    if (isDatabaseUnavailable(error)) {
      throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, {
        cause: error,
      });
    }
    throw new InternalServerErrorException(INTERNAL_ERROR_MESSAGE, {
      cause: error,
    });
  }
}
