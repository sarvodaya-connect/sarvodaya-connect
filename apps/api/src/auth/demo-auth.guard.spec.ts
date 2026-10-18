import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { DemoAuthGuard, type AuthenticatedRequest } from './demo-auth.guard.js';

function contextFor(headers: Record<string, string>) {
  const request = { headers } as unknown as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
}

const guardFor = (nodeEnv?: string) =>
  new DemoAuthGuard({
    get: (name: string) => (name === 'NODE_ENV' ? nodeEnv : undefined),
  } as unknown as ConfigService);

describe('DemoAuthGuard', () => {
  it('signs in a fictional demo user from the X-Demo-User header', () => {
    const { request, context } = contextFor({ 'x-demo-user': 'demo-dm-north' });

    expect(guardFor('development').canActivate(context)).toBe(true);
    expect(request.principal).toMatchObject({
      id: 'demo-dm-north',
      roles: ['DISTRICT_MANAGER'],
    });
  });

  it('rejects requests without a known demo user', () => {
    expect(() => guardFor('test').canActivate(contextFor({}).context)).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      guardFor('test').canActivate(
        contextFor({ 'x-demo-user': 'someone-else' }).context,
      ),
    ).toThrow('Sign in to continue');
  });

  it('never accepts demo users in production', () => {
    expect(() =>
      guardFor('production').canActivate(
        contextFor({ 'x-demo-user': 'demo-hq-admin' }).context,
      ),
    ).toThrow('Sign-in is not configured for this environment');
  });
});
