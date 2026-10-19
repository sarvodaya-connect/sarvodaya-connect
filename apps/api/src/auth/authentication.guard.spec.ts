import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { AuthenticationProvider } from './authentication-provider.js';
import { AuthenticationGuard } from './authentication.guard.js';
import type { AuthenticatedRequest } from './authentication-provider.js';
import { findDemoPrincipal } from './demo-principals.js';

function contextFor(headers: Record<string, string>) {
  const request = { headers } as unknown as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
}

describe('AuthenticationGuard', () => {
  it('attaches the verified principal supplied by the provider', async () => {
    const { request, context } = contextFor({ authorization: 'Bearer token' });
    const provider: AuthenticationProvider = {
      authenticate: async () => findDemoPrincipal('demo-dm-north') ?? null,
    };

    await expect(
      new AuthenticationGuard(provider).canActivate(context),
    ).resolves.toBe(true);
    expect(request.principal).toMatchObject({ roles: ['DISTRICT_MANAGER'] });
  });

  it('rejects missing or invalid credentials', async () => {
    const provider: AuthenticationProvider = { authenticate: async () => null };
    const guard = new AuthenticationGuard(provider);

    await expect(guard.canActivate(contextFor({}).context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
