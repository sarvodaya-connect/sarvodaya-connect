import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const messages = typeof body === 'object' && body !== null && 'message' in body ? (body as { message: unknown }).message : null;
    const isValidation = status === 400;
    const code = isValidation ? 'VALIDATION_ERROR' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
    const message = Array.isArray(messages) ? 'Request validation failed' : typeof messages === 'string' ? messages : status === 500 ? 'Internal server error' : 'Request failed';
    const details = Array.isArray(messages) ? messages.map((m: unknown) => ({ field: typeof m === 'string' ? m.split(' ')[0] : 'request', messages: [String(m)] })) : undefined;
    const header = request.headers['x-request-id'];
    const requestId = typeof header === 'string' && header.length <= 128 ? header : randomUUID();
    response.status(status).json({ error: { code, message, requestId, ...(details ? { details } : {}) } });
  }
}
