import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import type { GetParametersCommandOutput } from '@aws-sdk/client-ssm';

type ParameterResult = Pick<GetParametersCommandOutput, 'Parameters' | 'InvalidParameters'>;
type ReadParameters = (names: string[]) => Promise<ParameterResult>;

async function readSecureParameters(names: string[]): Promise<ParameterResult> {
  // Uses the Lambda execution role; no access keys are supplied or persisted.
  const client = new SSMClient({ maxAttempts: 2 });
  try {
    return await client.send(new GetParametersCommand({ Names: names, WithDecryption: true }));
  } finally {
    client.destroy();
  }
}

/** Load both encrypted settings before Nest constructs its database/storage services. */
export async function loadRuntimeParameters(
  env: NodeJS.ProcessEnv = process.env,
  read: ReadParameters = readSecureParameters,
): Promise<void> {
  const prefix = env.CONFIG_PARAMETER_PREFIX;
  if (prefix === undefined) return; // Existing local and Secrets Manager configurations.
  if (!/^\/sarvodaya-connect\/[a-z0-9_-]+$/.test(prefix)) {
    throw new Error('CONFIG_PARAMETER_PREFIX must name one Sarvodaya Connect environment');
  }
  const databaseName = `${prefix}/database-url`;
  const nicName = `${prefix}/nic-encryption-key`;
  let result: ParameterResult;
  try {
    result = await read([databaseName, nicName]);
  } catch {
    // SDK/service errors must not reveal decrypted values in bootstrap logs.
    throw new Error('Unable to load encrypted Lambda configuration');
  }
  const parameters = result.Parameters ?? [];
  if (result.InvalidParameters?.length || parameters.length !== 2 ||
      parameters.some((parameter) => parameter.Type !== 'SecureString' || !parameter.Value) ||
      new Set(parameters.map((parameter) => parameter.Name)).size !== 2 ||
      parameters.some((parameter) => parameter.Name !== databaseName && parameter.Name !== nicName)) {
    throw new Error('Encrypted Lambda configuration is incomplete');
  }
  const databaseUrl = parameters.find((parameter) => parameter.Name === databaseName)!.Value!;
  const nicKey = parameters.find((parameter) => parameter.Name === nicName)!.Value!;
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('Encrypted database configuration is invalid');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password ||
      (env.NODE_ENV === 'production' && !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode') ?? ''))) {
    throw new Error('Encrypted database configuration requires PostgreSQL and production TLS');
  }
  if (!/^[a-f0-9]{64}$/i.test(nicKey)) throw new Error('Encrypted NIC configuration is invalid');
  // Publish neither value until the entire response has passed validation.
  env.DATABASE_URL = databaseUrl;
  env.NIC_ENCRYPTION_KEY = nicKey;
}
