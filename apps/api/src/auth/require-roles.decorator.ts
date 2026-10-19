import { SetMetadata } from '@nestjs/common';

import type { UserRole } from './principal.js';

export const REQUIRED_ROLES = Symbol('REQUIRED_ROLES');

/** Grants access when the principal has at least one of the specified roles. */
export const RequireRoles = (...roles: UserRole[]) =>
  SetMetadata(REQUIRED_ROLES, roles);
