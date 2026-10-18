import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { findDemoPrincipal } from './demo-principals.js';
import type { Principal } from './principal.js';

export const DEMO_USER_HEADER = 'x-demo-user';

export type AuthenticatedRequest = Request & { principal?: Principal };

/**
 * Provisional authentication for development and tests. It resolves one of
 * the fictional users in demo-principals.ts from the X-Demo-User header.
 *
 * It never runs in production: Amazon Cognito token verification replaces this
 * guard, and the document and notification code only depends on Principal.
 */
@Injectable()
export class DemoAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new UnauthorizedException(
        'Sign-in is not configured for this environment',
      );
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers[DEMO_USER_HEADER];
    const principal =
      typeof header === 'string' ? findDemoPrincipal(header.trim()) : undefined;

    if (!principal) {
      throw new UnauthorizedException('Sign in to continue');
    }

    request.principal = principal;
    return true;
  }
}
