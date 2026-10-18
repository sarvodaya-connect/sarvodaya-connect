import type { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

import type { DocumentStorage } from './document-storage.js';
import { LocalDocumentStorage } from './local-document-storage.js';
import { S3DocumentStorage } from './s3-document-storage.js';

const DEFAULT_URL_TTL_SECONDS = 900;

function required(config: ConfigService, name: string): string {
  const value = config.get<string>(name)?.trim();
  if (!value)
    throw new Error(`${name} is required for the selected document storage`);
  return value;
}

/**
 * Chooses the document storage driver from configuration:
 * - STORAGE_DRIVER=local (default outside production): files in LOCAL_STORAGE_DIR,
 *   links signed with STORAGE_SIGNING_SECRET.
 * - STORAGE_DRIVER=s3: Amazon S3 pre-signed URLs for S3_BUCKET in S3_REGION.
 */
export function createDocumentStorage(config: ConfigService): DocumentStorage {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const driver = (
    config.get<string>('STORAGE_DRIVER') ?? (isProduction ? 's3' : 'local')
  )
    .trim()
    .toLowerCase();
  const urlTtlSeconds = Number(
    config.get<string>('STORAGE_URL_TTL_SECONDS') ?? DEFAULT_URL_TTL_SECONDS,
  );
  if (
    !Number.isInteger(urlTtlSeconds) ||
    urlTtlSeconds < 60 ||
    urlTtlSeconds > 604800
  ) {
    throw new Error(
      'STORAGE_URL_TTL_SECONDS must be a whole number between 60 and 604800',
    );
  }

  if (driver === 's3') {
    const bucket = required(config, 'S3_BUCKET');
    const region = required(config, 'S3_REGION');
    return new S3DocumentStorage({
      bucket,
      region,
      urlTtlSeconds,
      host: config.get<string>('S3_ENDPOINT_HOST')?.trim() || undefined,
      // Read on every request so rotated credentials are picked up.
      credentials: () => ({
        accessKeyId: required(config, 'AWS_ACCESS_KEY_ID'),
        secretAccessKey: required(config, 'AWS_SECRET_ACCESS_KEY'),
        sessionToken:
          config.get<string>('AWS_SESSION_TOKEN')?.trim() || undefined,
      }),
    });
  }

  if (driver === 'local') {
    if (isProduction) {
      throw new Error(
        'Local document storage cannot be used in production. Set STORAGE_DRIVER=s3.',
      );
    }
    const port = config.get<string>('API_PORT') ?? '3001';
    return new LocalDocumentStorage({
      rootDir: resolve(
        config.get<string>('LOCAL_STORAGE_DIR')?.trim() || '.local-storage',
      ),
      publicBaseUrl:
        config.get<string>('API_PUBLIC_URL')?.trim() ||
        `http://localhost:${port}`,
      // Without a configured secret, links stop working when the API restarts. Development only.
      signingSecret:
        config.get<string>('STORAGE_SIGNING_SECRET')?.trim() ||
        randomBytes(32).toString('hex'),
      urlTtlSeconds,
    });
  }

  throw new Error(`Unknown STORAGE_DRIVER "${driver}". Use "local" or "s3".`);
}
