import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequest } from './authentication-provider.js';
import { DEMO_PRINCIPALS } from './demo-principals.js';
import { REQUIRED_ROLES } from './require-roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

function setup(required: string[] | undefined, principalIndex: number) {
  const request = {
    principal: DEMO_PRINCIPALS[principalIndex],
  } as AuthenticatedRequest;
  const handler = () => undefined;
  const controller = class {};
  const reflector = {
    getAllAndOverride: (key: symbol) =>
      key === REQUIRED_ROLES ? required : undefined,
  };
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return new RolesGuard(reflector as never).canActivate(context);
}

describe('RolesGuard', () => {
  it('allows a principal with one of the route roles', () => {
    expect(setup(['DISTRICT_MANAGER', 'HQ_ADMIN'], 2)).toBe(true);
  });

  it('rejects a principal with no permitted role', () => {
    expect(() => setup(['HQ_ADMIN'], 0)).toThrow(ForbiddenException);
  });

  it('allows authenticated routes without a role restriction', () => {
    expect(setup(undefined, 0)).toBe(true);
  });
});
