import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedRequest } from './demo-auth.guard.js';
import type { Principal } from './principal.js';

/** The signed-in user set by the authentication guard. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) {
      throw new UnauthorizedException('Sign in to continue');
    }
    return request.principal;
  },
);
