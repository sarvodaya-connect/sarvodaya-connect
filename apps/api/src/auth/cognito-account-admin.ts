import {
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import type { ConfigService } from '@nestjs/config';

import { cognitoUserPool } from './cognito-authentication.provider.js';

/**
 * Server-side Amazon Cognito account administration for HQ (V5 D16). Runs only
 * in the API, with the credentials of the Lambda's IAM role; the dashboard and
 * phone app never hold admin credentials or a client secret. Passwords are
 * passed straight to Cognito and never logged or stored.
 */
export interface CognitoAccountAdmin {
  /** The Cognito `sub` of an existing user with this username, or null. */
  findSubject(username: string): Promise<string | null>;
  /** Creates the user without an invitation message and returns its `sub`. */
  createUser(username: string): Promise<string>;
  /** Sets a permanent password: the person signs in with it straight away. */
  setPassword(username: string, password: string): Promise<void>;
  enable(username: string): Promise<void>;
  disable(username: string): Promise<void>;
  /** Revokes the user's refresh tokens, so no new access tokens are issued. */
  signOut(username: string): Promise<void>;
}

export const COGNITO_ACCOUNT_ADMIN = Symbol('COGNITO_ACCOUNT_ADMIN');

/** Why Cognito refused; the API turns each into a message HQ can act on. */
export class CognitoAdminError extends Error {
  constructor(
    readonly reason:
      'INVALID_PASSWORD' | 'USERNAME_EXISTS' | 'NOT_FOUND' | 'UNAVAILABLE',
  ) {
    super(`Cognito account administration failed: ${reason}`);
    this.name = 'CognitoAdminError';
  }
}

function translated(error: unknown): CognitoAdminError {
  const name = error instanceof Error ? error.name : '';
  if (name === 'InvalidPasswordException')
    return new CognitoAdminError('INVALID_PASSWORD');
  if (name === 'UsernameExistsException' || name === 'AliasExistsException')
    return new CognitoAdminError('USERNAME_EXISTS');
  if (name === 'UserNotFoundException')
    return new CognitoAdminError('NOT_FOUND');
  return new CognitoAdminError('UNAVAILABLE');
}

const subjectOf = (attributes: AttributeType[] | undefined) =>
  attributes?.find((attribute) => attribute.Name === 'sub')?.Value ?? null;

export class AwsCognitoAccountAdmin implements CognitoAccountAdmin {
  constructor(
    private readonly client: Pick<CognitoIdentityProviderClient, 'send'>,
    private readonly userPoolId: string,
  ) {}

  private async send<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      throw translated(error);
    }
  }

  async findSubject(username: string) {
    try {
      const user = await this.client.send(
        new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        }),
      );
      return subjectOf(user.UserAttributes);
    } catch (error) {
      const failure = translated(error);
      if (failure.reason === 'NOT_FOUND') return null;
      throw failure;
    }
  }

  async createUser(username: string) {
    const created = await this.send(() =>
      this.client.send(
        // SUPPRESS: Cognito sends no invitation. HQ hands the password over itself.
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          MessageAction: 'SUPPRESS',
        }),
      ),
    );
    const sub = subjectOf(created.User?.Attributes);
    if (!sub) throw new CognitoAdminError('UNAVAILABLE');
    return sub;
  }

  async setPassword(username: string, password: string) {
    await this.send(() =>
      this.client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          Password: password,
          Permanent: true,
        }),
      ),
    );
  }

  async enable(username: string) {
    await this.send(() =>
      this.client.send(
        new AdminEnableUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        }),
      ),
    );
  }

  async disable(username: string) {
    await this.send(() =>
      this.client.send(
        new AdminDisableUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        }),
      ),
    );
  }

  async signOut(username: string) {
    await this.send(() =>
      this.client.send(
        new AdminUserGlobalSignOutCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        }),
      ),
    );
  }
}

/** Credentials come from the environment's default chain (the Lambda's IAM role); none are configured here. */
export function cognitoAccountAdminFromConfig(
  config: ConfigService,
): CognitoAccountAdmin {
  const { userPoolId, region } = cognitoUserPool(config);
  return new AwsCognitoAccountAdmin(
    new CognitoIdentityProviderClient({ region }),
    userPoolId,
  );
}

/** Local sign-in: there is no Cognito pool to administer. */
const notSelected = () => Promise.reject(new Error('Cognito is not selected'));
export const NO_COGNITO_ADMIN: CognitoAccountAdmin = {
  findSubject: notSelected,
  createUser: notSelected,
  setPassword: notSelected,
  enable: notSelected,
  disable: notSelected,
  signOut: notSelected,
};
