import { describe, expect, it, vi } from 'vitest';
import { SSMClient } from '@aws-sdk/client-ssm';
import { loadRuntimeParameters } from './runtime-parameters.js';

const prefix = '/sarvodaya-connect/test';
const databaseUrl = 'postgresql://fictional:fictional@db.test.invalid/test?sslmode=require';
const key = 'a'.repeat(64);
const parameters = () => [
  { Name: `${prefix}/database-url`, Type: 'SecureString' as const, Value: databaseUrl },
  { Name: `${prefix}/nic-encryption-key`, Type: 'SecureString' as const, Value: key },
];
const environment = (): NodeJS.ProcessEnv => ({ NODE_ENV: 'production', CONFIG_PARAMETER_PREFIX: prefix });

describe('encrypted Lambda runtime parameters', () => {
  it('keeps existing configuration without contacting AWS when no prefix is selected', async () => {
    const env = { DATABASE_URL: 'existing' };
    const read = vi.fn();
    await loadRuntimeParameters(env, read);
    expect(read).not.toHaveBeenCalled();
    expect(env.DATABASE_URL).toBe('existing');
  });

  it('requests decryption through the role-based SDK client and closes it', async () => {
    const send = vi.spyOn(SSMClient.prototype, 'send').mockResolvedValue({ Parameters: parameters() } as never);
    const destroy = vi.spyOn(SSMClient.prototype, 'destroy').mockImplementation(() => undefined);
    try {
      await loadRuntimeParameters(environment());
      expect(send.mock.calls[0][0].input).toEqual({
        Names: [`${prefix}/database-url`, `${prefix}/nic-encryption-key`],
        WithDecryption: true,
      });
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      send.mockRestore();
      destroy.mockRestore();
    }
  });

  it('loads only the two environment-specific SecureStrings regardless of response order', async () => {
    const env = environment();
    const read = vi.fn().mockResolvedValue({ Parameters: parameters().reverse() });
    await loadRuntimeParameters(env, read);
    expect(read).toHaveBeenCalledWith([`${prefix}/database-url`, `${prefix}/nic-encryption-key`]);
    expect(env.DATABASE_URL).toBe(databaseUrl);
    expect(env.NIC_ENCRYPTION_KEY).toBe(key);
  });

  it.each(['', '/other/test', '/sarvodaya-connect/test/../production', '/sarvodaya-connect/test '])(
    'refuses invalid namespace %j before contacting AWS', async (value) => {
      const read = vi.fn();
      await expect(loadRuntimeParameters({ CONFIG_PARAMETER_PREFIX: value }, read)).rejects.toThrow('CONFIG_PARAMETER_PREFIX');
      expect(read).not.toHaveBeenCalled();
    },
  );

  it.each([
    { Parameters: parameters().slice(0, 1) },
    { Parameters: parameters(), InvalidParameters: ['missing'] },
    { Parameters: parameters().map((parameter) => ({ ...parameter, Type: 'String' as const })) },
    { Parameters: [parameters()[0], parameters()[0]] },
    { Parameters: parameters().map((parameter) => ({ ...parameter, Name: parameter.Name?.replace('/test/', '/production/') })) },
  ])('fails closed on missing, plaintext, duplicate or wrong-environment settings', async (response) => {
    const env = environment();
    await expect(loadRuntimeParameters(env, async () => response)).rejects.toThrow('incomplete');
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.NIC_ENCRYPTION_KEY).toBeUndefined();
  });

  it.each(['not-a-url', 'https://example.com', databaseUrl.replace('?sslmode=require', ''), databaseUrl.replace('sslmode=require', 'sslmode=disable')])(
    'refuses invalid or non-TLS production database settings', async (value) => {
      const env = environment();
      const response = parameters();
      response[0].Value = value;
      await expect(loadRuntimeParameters(env, async () => ({ Parameters: response }))).rejects.toThrow('database configuration');
      expect(env.DATABASE_URL).toBeUndefined();
    },
  );

  it('does not partially overwrite configuration when the NIC key is invalid', async () => {
    const env = { ...environment(), DATABASE_URL: 'existing' };
    const response = parameters();
    response[1].Value = 'invalid';
    await expect(loadRuntimeParameters(env, async () => ({ Parameters: response }))).rejects.toThrow('NIC configuration');
    expect(env.DATABASE_URL).toBe('existing');
    expect(env.NIC_ENCRYPTION_KEY).toBeUndefined();
  });

  it('redacts service errors and allows a later bootstrap to retry', async () => {
    const env = environment();
    const read = vi.fn().mockRejectedValueOnce(new Error(`sensitive ${databaseUrl}`)).mockResolvedValueOnce({ Parameters: parameters() });
    await expect(loadRuntimeParameters(env, read)).rejects.toThrow(/^Unable to load encrypted Lambda configuration$/);
    expect(env.DATABASE_URL).toBeUndefined();
    await loadRuntimeParameters(env, read);
    expect(env.DATABASE_URL).toBe(databaseUrl);
  });
});
