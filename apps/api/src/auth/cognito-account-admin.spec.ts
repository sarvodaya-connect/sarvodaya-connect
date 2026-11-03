import {
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { AwsCognitoAccountAdmin, CognitoAdminError, cognitoAccountAdminFromConfig } from './cognito-account-admin.js';

const POOL = 'ap-southeast-1_Fictional1';
const failure = (name: string) => Object.assign(new Error('fictional AWS error'), { name });

function admin(reply: (command: unknown) => unknown) {
  const send = vi.fn(async (command: unknown) => reply(command));
  return { admin: new AwsCognitoAccountAdmin({ send } as never, POOL), send };
}

describe('AwsCognitoAccountAdmin (no AWS calls; the client is a stub)', () => {
  it('creates a user without an invitation and returns its sub', async () => {
    const { admin: cognito, send } = admin(() => ({ User: { Attributes: [{ Name: 'sub', Value: 'sub-1' }] } }));
    await expect(cognito.createUser('fictional.spc')).resolves.toBe('sub-1');
    const command = send.mock.calls[0]![0] as AdminCreateUserCommand;
    expect(command).toBeInstanceOf(AdminCreateUserCommand);
    expect(command.input).toEqual({ UserPoolId: POOL, Username: 'fictional.spc', MessageAction: 'SUPPRESS' });
  });

  it('sets HQ passwords as permanent, so no change is forced at first sign-in', async () => {
    const { admin: cognito, send } = admin(() => ({}));
    await cognito.setPassword('fictional.spc', 'fictional-pass-1');
    const command = send.mock.calls[0]![0] as AdminSetUserPasswordCommand;
    expect(command).toBeInstanceOf(AdminSetUserPasswordCommand);
    expect(command.input).toMatchObject({ UserPoolId: POOL, Username: 'fictional.spc', Permanent: true });
  });

  it('finds an existing user, and returns null for an unknown one', async () => {
    const found = admin(() => ({ UserAttributes: [{ Name: 'email', Value: 'x' }, { Name: 'sub', Value: 'sub-2' }] }));
    await expect(found.admin.findSubject('fictional.dm')).resolves.toBe('sub-2');
    expect(found.send.mock.calls[0]![0]).toBeInstanceOf(AdminGetUserCommand);
    const missing = admin(() => {
      throw failure('UserNotFoundException');
    });
    await expect(missing.admin.findSubject('nobody')).resolves.toBeNull();
  });

  it('disables and signs out with the admin commands', async () => {
    const { admin: cognito, send } = admin(() => ({}));
    await cognito.disable('fictional.dm');
    await cognito.signOut('fictional.dm');
    expect(send.mock.calls.map(([command]) => command?.constructor)).toEqual([AdminDisableUserCommand, AdminUserGlobalSignOutCommand]);
  });

  it('turns AWS errors into reasons, without passing on AWS messages', async () => {
    for (const [name, reason] of [
      ['InvalidPasswordException', 'INVALID_PASSWORD'],
      ['UsernameExistsException', 'USERNAME_EXISTS'],
      ['UserNotFoundException', 'NOT_FOUND'],
      ['AccessDeniedException', 'UNAVAILABLE'],
      ['TooManyRequestsException', 'UNAVAILABLE'],
    ] as const) {
      const { admin: cognito } = admin(() => {
        throw failure(name);
      });
      const error = await cognito.setPassword('fictional.dm', 'fictional-pass-1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CognitoAdminError);
      expect(error).toMatchObject({ reason });
      expect(String((error as Error).message)).not.toContain('fictional-pass-1');
    }
  });

  it('needs a valid pool id from the configuration', () => {
    const config = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;
    expect(() => cognitoAccountAdminFromConfig(config({}))).toThrow('COGNITO_USER_POOL_ID');
    expect(cognitoAccountAdminFromConfig(config({ COGNITO_USER_POOL_ID: POOL }))).toBeInstanceOf(AwsCognitoAccountAdmin);
  });
});
