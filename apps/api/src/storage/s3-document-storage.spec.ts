import { describe, expect, it, vi } from 'vitest';

import { StorageUnavailableError } from './document-storage.js';
import { S3DocumentStorage } from './s3-document-storage.js';

const KEY =
  'societies/29000000-0000-4000-8000-000000000101/documents/00000000-0000-4000-8000-000000000001.pdf';

function createStorage(fetchFn = vi.fn<typeof fetch>()) {
  const storage = new S3DocumentStorage({
    bucket: 'sarvodaya-documents-test',
    region: 'ap-south-1',
    urlTtlSeconds: 900,
    // Fictional credentials: the tests never contact AWS.
    credentials: () => ({
      accessKeyId: 'AKIDEXAMPLETESTONLY',
      secretAccessKey: 'test-only-secret',
    }),
    now: () => new Date('2026-10-18T10:00:00.000Z'),
    fetchFn,
  });
  return { storage, fetchFn };
}

describe('S3DocumentStorage', () => {
  it('creates a pre-signed PUT that requires the declared content type', async () => {
    const { storage } = createStorage();

    const upload = await storage.createUploadRequest({
      key: KEY,
      contentType: 'application/pdf',
      sizeBytes: 10,
    });
    const url = new URL(upload.url);

    expect(url.host).toBe(
      'sarvodaya-documents-test.s3.ap-south-1.amazonaws.com',
    );
    expect(url.pathname).toBe(`/${KEY}`);
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
      'content-type;host',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(upload).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      expiresAt: '2026-10-18T10:15:00.000Z',
    });
  });

  it('creates a pre-signed GET that downloads with a safe filename', async () => {
    const { storage } = createStorage();

    const download = await storage.createDownloadRequest({
      key: KEY,
      fileName: 'Audit "report"\r\n.pdf',
      contentType: 'application/pdf',
    });

    expect(
      new URL(download.url).searchParams.get('response-content-disposition'),
    ).toBe('attachment; filename="Audit _report___.pdf"');
  });

  it('reads the stored size with a signed HEAD request', async () => {
    const { storage, fetchFn } = createStorage();
    fetchFn.mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'content-length': '1400000' },
      }),
    );

    await expect(storage.getObjectInfo(KEY)).resolves.toEqual({
      sizeBytes: 1_400_000,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('X-Amz-Signature='),
      { method: 'HEAD' },
    );
  });

  it('reports a missing object and an unavailable bucket differently', async () => {
    const { storage, fetchFn } = createStorage();

    fetchFn.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(storage.getObjectInfo(KEY)).resolves.toBeNull();

    fetchFn.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(storage.getObjectInfo(KEY)).rejects.toBeInstanceOf(
      StorageUnavailableError,
    );

    fetchFn.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(storage.getObjectInfo(KEY)).rejects.toBeInstanceOf(
      StorageUnavailableError,
    );
  });
});
