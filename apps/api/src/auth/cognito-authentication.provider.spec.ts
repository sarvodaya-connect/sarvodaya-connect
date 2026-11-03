import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  authProviderName,
  cognitoUserPool,
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
    const { provider, verifyToken, principalForSubject } = setup(async () => ({ sub: 'cognito-sub-1', authTime: 1_800_000_000 }));
    await expect(provider.authenticate(request(`Bearer ${JWT}`))).resolves.toEqual(dm);
    expect(verifyToken).toHaveBeenCalledWith(JWT);
    expect(principalForSubject).toHaveBeenCalledWith('cognito-sub-1', 1_800_000_000);
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

  it('checks the pool id format and the configured region, failing closed', () => {
    expect(() => cognitoVerifierFromConfig(config({ COGNITO_USER_POOL_ID: 'not-a-pool', COGNITO_CLIENT_ID: 'client' }))).toThrow('<region>_<id>');
    expect(() =>
      cognitoVerifierFromConfig(config({ COGNITO_USER_POOL_ID: POOL, COGNITO_CLIENT_ID: 'client', COGNITO_REGION: 'us-east-1' })),
    ).toThrow('does not match');
    expect(() => cognitoVerifierFromConfig(config({ COGNITO_USER_POOL_ID: POOL, COGNITO_CLIENT_ID: ' , ' }))).toThrow('COGNITO_CLIENT_ID');
    expect(cognitoUserPool(config({ COGNITO_USER_POOL_ID: POOL, COGNITO_REGION: 'ap-southeast-1' }))).toEqual({ userPoolId: POOL, region: 'ap-southeast-1' });
  });

  it('rejects a token that is not from the configured pool', async () => {
    const verifier = cognitoVerifierFromConfig(config({ COGNITO_USER_POOL_ID: 'ap-southeast-1_Fictional1', COGNITO_CLIENT_ID: 'client' }));
    await expect(verifier.verify(JWT)).rejects.toThrow();
  });
});

/**
 * The real aws-jwt-verify checks, with a key pair made for the test and the
 * pool's public keys cached up front: nothing contacts AWS.
 */
const POOL = 'ap-southeast-1_Fictional1';
const ISSUER = `https://cognito-idp.ap-southeast-1.amazonaws.com/${POOL}`;
const CLIENT = 'fictionalclient1';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'fictional-key-1';
const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] } as never;
const now = () => Math.floor(Date.now() / 1000);

function token(claims: Record<string, unknown> = {}, key = privateKey) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${part({ alg: 'RS256', kid: KID })}.${part({
    sub: 'cognito-sub-1',
    iss: ISSUER,
    client_id: CLIENT,
    token_use: 'access',
    auth_time: now() - 60,
    iat: now() - 60,
    exp: now() + 3600,
    ...claims,
  })}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), key).toString('base64url')}`;
}

describe('Cognito token verification (signature and claims)', () => {
  const verifier = cognitoVerifierFromConfig(config({ COGNITO_USER_POOL_ID: POOL, COGNITO_CLIENT_ID: CLIENT }), { jwks });

  it('accepts an access token from the pool and app client, and returns sub and sign-in time', async () => {
    const authTime = now() - 60;
    await expect(verifier.verify(token({ auth_time: authTime }))).resolves.toEqual({ sub: 'cognito-sub-1', authTime });
  });

  it('refuses expired, wrongly signed, wrong-pool, wrong-client and ID tokens', async () => {
    await expect(verifier.verify(token({ exp: now() - 10 }))).rejects.toThrow(/expired/i);
    await expect(verifier.verify(token({}, otherKey))).rejects.toThrow(/signature/i);
    await expect(verifier.verify(token({ iss: 'https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_Other' }))).rejects.toThrow(/iss/i);
    await expect(verifier.verify(token({ client_id: 'another-client' }))).rejects.toThrow(/client/i);
    await expect(verifier.verify(token({ token_use: 'id', aud: CLIENT }))).rejects.toThrow(/token use|token_use/i);
  });

  it('end to end: a forged token never reaches the database', async () => {
    const principalForSubject = vi.fn<SubjectPrincipalLoader['principalForSubject']>().mockResolvedValue(dm);
    const provider = new CognitoAuthenticationProvider(verifier, { principalForSubject });
    await expect(provider.authenticate(request(`Bearer ${token({}, otherKey)}`))).resolves.toBeNull();
    expect(principalForSubject).not.toHaveBeenCalled();
    await expect(provider.authenticate(request(`Bearer ${token()}`))).resolves.toEqual(dm);
  });
});
