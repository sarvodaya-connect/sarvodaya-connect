import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from './authentication-provider.js';
import type { UserRole } from './principal.js';
import { REQUIRED_ROLES } from './require-roles.decorator.js';

/** Enforces route-level role requirements. Data scope remains service-owned. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(
      REQUIRED_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal?.roles.some((role) => required.includes(role))) {
      throw new ForbiddenException('Your account cannot perform this action');
    }
    return true;
  }
}
