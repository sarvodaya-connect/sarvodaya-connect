import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { driverAdapterKind } from '../prisma/prisma-operation.js';

const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const PRISMA_CODE = /^P\d{4}$/;
const SOCKET_CODE = /^E[A-Z_]{2,20}$/;
const ADAPTER_KIND = /^[A-Za-z]{1,40}$/;

/**
 * Issue #157: what failed, for the log. Only the error's class name, a
 * Prisma code (such as P2002) or socket code (such as ECONNREFUSED) and the
 * database adapter's error kind (such as UniqueConstraintViolation). Each is
 * checked against a fixed pattern, so no message, value, query, request body
 * or header can reach the log through it.
 */
export function describeError(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'unknown error';
  const className = error instanceof Error ? error.constructor?.name || error.name : undefined;
  const parts = [className === undefined ? 'non-Error object' : SAFE_NAME.test(className) ? className : 'Error'];
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && (PRISMA_CODE.test(code) || SOCKET_CODE.test(code))) parts.push(code);
  const kind = driverAdapterKind(error);
  if (kind && ADAPTER_KIND.test(kind)) parts.push(kind);
  return parts.join(' ');
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const messages = typeof body === 'object' && body !== null && 'message' in body ? (body as { message: unknown }).message : null;
    const isValidation = status === 400;
    // Error codes from API_ERROR_CODES in packages/api-contracts.
    const code = isValidation
      ? 'VALIDATION_ERROR'
      : status === 401
        ? 'UNAUTHENTICATED'
        : status === 403
          ? 'FORBIDDEN'
          : status === 404
            ? 'NOT_FOUND'
            : status === 409
              ? 'CONFLICT'
              : status === 429
                ? 'LIMIT_REACHED'
                : status === 503
                  ? 'SERVICE_UNAVAILABLE'
                  : 'INTERNAL_ERROR';
    const message = Array.isArray(messages) ? 'Request validation failed' : typeof messages === 'string' ? messages : status === 500 ? 'Internal server error' : 'Request failed';
    const details = Array.isArray(messages) ? messages.map((m: unknown) => ({ field: typeof m === 'string' ? m.split(' ')[0] : 'request', messages: [String(m)] })) : undefined;
    const header = request.headers['x-request-id'];
    const requestId = typeof header === 'string' && header.length <= 128 ? header : randomUUID();
    // Unexpected failures are logged with the error and its cause (class name and Prisma code only), the route and the request id: never a message, value, request body or header.
    if (status >= 500) {
      const cause = exception instanceof HttpException ? exception.cause : undefined;
      const what = cause === undefined ? describeError(exception) : `${describeError(exception)}; cause ${describeError(cause)}`;
      this.logger.error(`${request.method} ${request.route?.path ?? 'unmatched route'} failed with ${status} (${what}); requestId ${requestId}`);
    }
    response.status(status).json({ error: { code, message, requestId, ...(details ? { details } : {}) } });
  }
}
