import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  authProviderName,
  CognitoAuthenticationProvider,
  type CognitoTokenVerifier,
  cognitoVerifierFromConfig,
  type SubjectPrincipalLoader,
} from './cognito-authentication.provider.js';
import type { Principal } from './principal.js';

const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;
const request = (authorization?: string) => ({ headers: authorization ? { authorization } : {} }) as unknown as Request;
// Fictional: three base64url parts, never a real token.
const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJmaWN0aW9uYWwifQ.c2lnbmF0dXJl';

const dm: Principal = { id: 'acc-dm', displayName: 'Fictional DM', roles: ['DISTRICT_MANAGER'], districtIds: ['d-1'], societyIds: [] };

function setup(verify: CognitoTokenVerifier['verify'], principal: Principal | null = dm) {
  const verifyToken = vi.fn(verify);
  const principalForSubject = vi.fn<SubjectPrincipalLoader['principalForSubject']>().mockResolvedValue(principal);
  const provider = new CognitoAuthenticationProvider({ verify: verifyToken }, { principalForSubject });
  return { provider, verifyToken, principalForSubject };
}

describe('CognitoAuthenticationProvider', () => {
  it('verifies the token, then loads role and scope from the database by Cognito subject', async () => {
    const { provider, verifyToken, principalForSubject } = setup(async () => ({ sub: 'cognito-sub-1' }));
    await expect(provider.authenticate(request(`Bearer ${JWT}`))).resolves.toEqual(dm);
    expect(verifyToken).toHaveBeenCalledWith(JWT);
    expect(principalForSubject).toHaveBeenCalledWith('cognito-sub-1');
  });

  it('refuses expired or forged tokens without loading an account', async () => {
    const { provider, principalForSubject } = setup(async () => {
      throw Object.assign(new Error('Token expired'), { name: 'JwtExpiredError' });
    });
    await expect(provider.authenticate(request(`Bearer ${JWT}`))).resolves.toBeNull();
    expect(principalForSubject).not.toHaveBeenCalled();
  });

  it('refuses a valid token whose user has no active linked account', async () => {
    const { provider } = setup(async () => ({ sub: 'unlinked' }), null);
    await expect(provider.authenticate(request(`Bearer ${JWT}`))).resolves.toBeNull();
  });

  it('ignores missing headers, local session tokens and demo headers', async () => {
    const { provider, verifyToken } = setup(async () => ({ sub: 'x' }));
    await expect(provider.authenticate(request())).resolves.toBeNull();
    await expect(provider.authenticate(request('Bearer localSessionTokenWithoutDots'))).resolves.toBeNull();
    await expect(provider.authenticate({ headers: { 'x-demo-user': 'demo-hq-admin' } } as unknown as Request)).resolves.toBeNull();
    expect(verifyToken).not.toHaveBeenCalled();
  });
});

describe('authProviderName', () => {
  it('uses local sessions in development and Cognito in production', () => {
    expect(authProviderName(config({ NODE_ENV: 'development' }))).toBe('local');
    expect(authProviderName(config({ NODE_ENV: 'test', AUTH_PROVIDER: 'cognito' }))).toBe('cognito');
    expect(authProviderName(config({ NODE_ENV: 'production' }))).toBe('cognito');
  });

  it('never allows local passwords in production, or an unknown provider', () => {
    expect(() => authProviderName(config({ NODE_ENV: 'production', AUTH_PROVIDER: 'local' }))).toThrow('cannot be used in production');
    expect(() => authProviderName(config({ NODE_ENV: 'development', AUTH_PROVIDER: 'saml' }))).toThrow('AUTH_PROVIDER');
  });
});

describe('cognitoVerifierFromConfig', () => {
  it('needs the user pool and app client, and accepts only access or ID tokens', () => {
    expect(() => cognitoVerifierFromConfig(config({ COGNITO_CLIENT_ID: 'client' }))).toThrow('COGNITO_USER_POOL_ID');
    expect(() => cognitoVerifierFromConfig(config({ COGNITO_USER_POOL_ID: 'ap-southeast-1_Fictional1' }))).toThrow('COGNITO_CLIENT_ID');
    expect(() =>
      cognitoVerifierFromConfig(config({ COGNITO_USER_POOL_ID: 'ap-southeast-1_Fictional1', COGNITO_CLIENT_ID: 'client', COGNITO_TOKEN_USE: 'refresh' })),
    ).toThrow('COGNITO_TOKEN_USE');
    expect(cognitoVerifierFromConfig(config({ COGNITO_USER_POOL_ID: 'ap-southeast-1_Fictional1', COGNITO_CLIENT_ID: 'client' }))).toHaveProperty('verify');
  });

  it('rejects a token that is not from the configured pool', async () => {
    const verifier = cognitoVerifierFromConfig(config({ COGNITO_USER_POOL_ID: 'ap-southeast-1_Fictional1', COGNITO_CLIENT_ID: 'client' }));
    await expect(verifier.verify(JWT)).rejects.toThrow();
  });
});
