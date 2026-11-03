import { Inject, Injectable, Logger } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { Jwks } from 'aws-jwt-verify/jwk';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { AuthenticationProvider } from './authentication-provider.js';
import type { Principal } from './principal.js';

/** A verified Cognito user: `sub` and, when the token has it, when they signed in (seconds since 1970). */
export type VerifiedCognitoUser = { sub: string; authTime?: number };

/** Checks a Cognito token's signature, issuer, expiry, client and use, and returns its `sub`. */
export interface CognitoTokenVerifier {
  verify(token: string): Promise<VerifiedCognitoUser>;
}

export const COGNITO_TOKEN_VERIFIER = Symbol('COGNITO_TOKEN_VERIFIER');

/** Finds the active account linked to a Cognito user and loads its roles and scope from the database. */
export interface SubjectPrincipalLoader {
  principalForSubject(subject: string, authTime?: number): Promise<Principal | null>;
}

export const SUBJECT_PRINCIPAL_LOADER = Symbol('SUBJECT_PRINCIPAL_LOADER');

/** Three base64url parts: a JWT. Local session tokens have no dots. */
const JWT = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

function required(config: ConfigService, name: string): string {
  const value = config.get<string>(name)?.trim();
  if (!value) throw new Error(`${name} is required when AUTH_PROVIDER=cognito`);
  return value;
}

/** e.g. ap-southeast-1_AbC123xyZ: the region, an underscore and the pool's own id. */
const USER_POOL_ID = /^([a-z]{2}(?:-[a-z]+)+-\d)_[A-Za-z0-9]+$/;

/**
 * COGNITO_USER_POOL_ID, checked against COGNITO_REGION when that is set. The
 * token issuer is derived from it: https://cognito-idp.<region>.amazonaws.com/<pool id>.
 */
export function cognitoUserPool(config: ConfigService): { userPoolId: string; region: string } {
  const userPoolId = required(config, 'COGNITO_USER_POOL_ID');
  const region = USER_POOL_ID.exec(userPoolId)?.[1];
  if (!region) throw new Error('COGNITO_USER_POOL_ID must look like <region>_<id>, e.g. ap-southeast-1_AbC123xyZ');
  const configured = config.get<string>('COGNITO_REGION')?.trim();
  if (configured && configured !== region)
    throw new Error(`COGNITO_REGION (${configured}) does not match the region in COGNITO_USER_POOL_ID (${region})`);
  return { userPoolId, region };
}

/**
 * Production verifier: Amazon Cognito user pool tokens, checked with the
 * pool's public keys (JWKS, fetched over HTTPS and cached per Lambda instance).
 * Only access tokens for the listed app clients are accepted by default.
 */
export function cognitoVerifierFromConfig(
  config: ConfigService,
  /** Tests only: the pool's public keys, so nothing is fetched. */
  options: { jwks?: Jwks } = {},
): CognitoTokenVerifier {
  const tokenUse = config.get<string>('COGNITO_TOKEN_USE')?.trim() || 'access';
  if (tokenUse !== 'access' && tokenUse !== 'id') throw new Error('COGNITO_TOKEN_USE must be "access" or "id"');
  const clientId = required(config, 'COGNITO_CLIENT_ID')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!clientId.length) throw new Error('COGNITO_CLIENT_ID is required when AUTH_PROVIDER=cognito');
  const verifier = CognitoJwtVerifier.create({ userPoolId: cognitoUserPool(config).userPoolId, tokenUse, clientId });
  if (options.jwks) verifier.cacheJwks(options.jwks);
  return {
    verify: async (token) => {
      const payload = await verifier.verify(token);
      return { sub: payload.sub, authTime: typeof payload.auth_time === 'number' ? payload.auth_time : undefined };
    },
  };
}

/**
 * Amazon Cognito sign-in (AUTH_PROVIDER=cognito). Cognito proves who the user
 * is; the user's role, district, societies and temporary district access still
 * come from the database on every request, through `provider_subject`.
 */
@Injectable()
export class CognitoAuthenticationProvider implements AuthenticationProvider {
  private readonly logger = new Logger(CognitoAuthenticationProvider.name);

  constructor(
    @Inject(COGNITO_TOKEN_VERIFIER) private readonly verifier: CognitoTokenVerifier,
    @Inject(SUBJECT_PRINCIPAL_LOADER) private readonly accounts: SubjectPrincipalLoader,
  ) {}

  async authenticate(request: Request): Promise<Principal | null> {
    const token = request.headers.authorization?.match(JWT)?.[1];
    if (!token) return null;
    let user: VerifiedCognitoUser;
    try {
      user = await this.verifier.verify(token);
    } catch (error) {
      // The reason only (expired, wrong client, bad signature); never the token.
      this.logger.warn(`Cognito token refused: ${error instanceof Error ? error.name : 'unknown error'}`);
      return null;
    }
    // Role, scope and status come from the database, never from the token.
    return this.accounts.principalForSubject(user.sub, user.authTime);
  }
}

export type AuthProviderName = 'local' | 'cognito';

/** AUTH_PROVIDER: "cognito" by default in production, "local" in development and tests. */
export function authProviderName(config: ConfigService): AuthProviderName {
  const configured = config.get<string>('AUTH_PROVIDER')?.trim().toLowerCase();
  const name = configured || (config.get<string>('NODE_ENV') === 'production' ? 'cognito' : 'local');
  if (name !== 'local' && name !== 'cognito') throw new Error('AUTH_PROVIDER must be "local" or "cognito"');
  if (name === 'local' && config.get<string>('NODE_ENV') === 'production')
    throw new Error('AUTH_PROVIDER=local cannot be used in production. Use cognito.');
  return name;
}
