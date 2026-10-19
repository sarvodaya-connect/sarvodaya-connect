import {
  CanActivate,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import {
  AUTHENTICATION_PROVIDER,
  type AuthenticationProvider,
  type AuthenticatedRequest,
} from './authentication-provider.js';

/** Verifies credentials through the configured identity-provider adapter. */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(AUTHENTICATION_PROVIDER)
    private readonly authentication: AuthenticationProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = await this.authentication.authenticate(request);
    if (!principal) throw new UnauthorizedException('Sign in to continue');

    request.principal = principal;
    return true;
  }
}
