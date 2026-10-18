import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { LocalDocumentStorage } from './local-document-storage.js';
import { S3DocumentStorage } from './s3-document-storage.js';
import { createDocumentStorage } from './storage.config.js';

const configOf = (values: Record<string, string>) =>
  ({ get: (name: string) => values[name] }) as unknown as ConfigService;

describe('createDocumentStorage', () => {
  it('uses local storage by default outside production', () => {
    expect(createDocumentStorage(configOf({}))).toBeInstanceOf(
      LocalDocumentStorage,
    );
  });

  it('uses Amazon S3 when configured', () => {
    const storage = createDocumentStorage(
      configOf({
        STORAGE_DRIVER: 's3',
        S3_BUCKET: 'sarvodaya-documents-test',
        S3_REGION: 'ap-south-1',
      }),
    );
    expect(storage).toBeInstanceOf(S3DocumentStorage);
    expect(storage.driver).toBe('s3');
  });

  it('requires the S3 bucket and region', () => {
    expect(() =>
      createDocumentStorage(
        configOf({ STORAGE_DRIVER: 's3', S3_REGION: 'ap-south-1' }),
      ),
    ).toThrow('S3_BUCKET is required');
  });

  it('never uses local storage in production', () => {
    expect(() =>
      createDocumentStorage(
        configOf({ NODE_ENV: 'production', STORAGE_DRIVER: 'local' }),
      ),
    ).toThrow('cannot be used in production');
    expect(() =>
      createDocumentStorage(configOf({ NODE_ENV: 'production' })),
    ).toThrow('S3_BUCKET is required');
  });

  it('rejects unknown drivers and unsafe link lifetimes', () => {
    expect(() =>
      createDocumentStorage(configOf({ STORAGE_DRIVER: 'ftp' })),
    ).toThrow('Unknown STORAGE_DRIVER');
    expect(() =>
      createDocumentStorage(configOf({ STORAGE_URL_TTL_SECONDS: '5' })),
    ).toThrow('STORAGE_URL_TTL_SECONDS');
  });
});
