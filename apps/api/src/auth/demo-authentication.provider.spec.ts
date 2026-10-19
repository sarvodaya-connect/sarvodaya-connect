import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';

import { DemoAuthenticationProvider } from './demo-authentication.provider.js';

const providerFor = (environment?: string) =>
  new DemoAuthenticationProvider({
    get: (key: string) => (key === 'NODE_ENV' ? environment : undefined),
  } as unknown as ConfigService);

describe('DemoAuthenticationProvider', () => {
  it('resolves only known fictional identities in development and test', async () => {
    const request = { headers: { 'x-demo-user': 'demo-dm-north' } } as never;
    await expect(
      providerFor('development').authenticate(request),
    ).resolves.toMatchObject({
      id: 'demo-dm-north',
      roles: ['DISTRICT_MANAGER'],
    });
    await expect(
      providerFor('test').authenticate({
        headers: { 'x-demo-user': 'real-user' },
      } as never),
    ).resolves.toBeNull();
  });

  it('fails closed in production and when the environment is unset', async () => {
    const request = { headers: { 'x-demo-user': 'demo-hq-admin' } } as never;
    await expect(
      providerFor('production').authenticate(request),
    ).resolves.toBeNull();
    await expect(providerFor().authenticate(request)).resolves.toBeNull();
  });
});
