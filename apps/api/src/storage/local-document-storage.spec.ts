import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  LocalDocumentStorage,
  UploadSizeMismatchError,
} from './local-document-storage.js';

const KEY =
  'societies/29000000-0000-4000-8000-000000000101/documents/00000000-0000-4000-8000-000000000001.pdf';

describe('LocalDocumentStorage', () => {
  let rootDir: string;
  let now: Date;
  let storage: LocalDocumentStorage;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'sc49-storage-'));
    now = new Date('2026-10-18T10:00:00.000Z');
    storage = new LocalDocumentStorage({
      rootDir,
      publicBaseUrl: 'http://localhost:3001/',
      signingSecret: 'test-only-secret',
      urlTtlSeconds: 900,
      now: () => now,
    });
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const tokenOf = (url: string) => url.split('/').at(-1)!;

  it('creates signed, expiring upload links for one file and method', async () => {
    const upload = await storage.createUploadRequest({
      key: KEY,
      contentType: 'application/pdf',
      sizeBytes: 5,
    });

    expect(upload.method).toBe('PUT');
    expect(
      upload.url.startsWith('http://localhost:3001/api/v1/storage/local/'),
    ).toBe(true);
    expect(upload.headers).toEqual({ 'Content-Type': 'application/pdf' });
    expect(upload.expiresAt).toBe('2026-10-18T10:15:00.000Z');
    expect(storage.verifyToken(tokenOf(upload.url), 'PUT')).toMatchObject({
      k: KEY,
      ct: 'application/pdf',
      sz: 5,
    });
    expect(storage.verifyToken(tokenOf(upload.url), 'GET')).toBeNull();
  });

  it('rejects tampered and expired links', async () => {
    const upload = await storage.createUploadRequest({
      key: KEY,
      contentType: 'application/pdf',
      sizeBytes: 5,
    });
    const [body, signature] = tokenOf(upload.url).split('.');
    const tampered = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body!, 'base64url').toString()),
        sz: 9_000_000,
      }),
    ).toString('base64url');

    expect(storage.verifyToken(`${tampered}.${signature}`, 'PUT')).toBeNull();
    expect(storage.verifyToken('not-a-token', 'PUT')).toBeNull();

    now = new Date('2026-10-18T10:15:01.000Z');
    expect(storage.verifyToken(tokenOf(upload.url), 'PUT')).toBeNull();
  });

  it('stores an upload of exactly the declared size and reports it', async () => {
    expect(await storage.getObjectInfo(KEY)).toBeNull();

    await storage.writeObject(KEY, Readable.from([Buffer.from('%PDF-')]), 5);

    expect(await storage.getObjectInfo(KEY)).toEqual({ sizeBytes: 5 });
    expect(await readFile(join(rootDir, KEY), 'utf8')).toBe('%PDF-');
    const opened = await storage.openObject(KEY);
    expect(opened?.sizeBytes).toBe(5);
    opened?.stream.destroy();
  });

  it('refuses uploads larger or smaller than declared and leaves nothing behind', async () => {
    await expect(
      storage.writeObject(KEY, Readable.from([Buffer.alloc(6)]), 5),
    ).rejects.toBeInstanceOf(UploadSizeMismatchError);
    await expect(
      storage.writeObject(KEY, Readable.from([Buffer.alloc(4)]), 5),
    ).rejects.toBeInstanceOf(UploadSizeMismatchError);
    expect(await storage.getObjectInfo(KEY)).toBeNull();
    const folder = join(
      rootDir,
      'societies/29000000-0000-4000-8000-000000000101/documents',
    );
    expect(await readdir(folder)).toEqual([]);
  });

  it('refuses keys that could escape the storage folder', async () => {
    await expect(storage.getObjectInfo('../outside.pdf')).rejects.toThrow(
      'Invalid storage key',
    );
    await expect(
      storage.createUploadRequest({
        key: 'societies/../../etc/passwd',
        contentType: 'application/pdf',
        sizeBytes: 1,
      }),
    ).rejects.toThrow('Invalid storage key');
  });

  it('creates download links that carry the filename', async () => {
    const download = await storage.createDownloadRequest({
      key: KEY,
      fileName: 'Audit report.pdf',
      contentType: 'application/pdf',
    });

    expect(download.method).toBe('GET');
    expect(storage.verifyToken(tokenOf(download.url), 'GET')).toMatchObject({
      k: KEY,
      fn: 'Audit report.pdf',
    });
  });
});
