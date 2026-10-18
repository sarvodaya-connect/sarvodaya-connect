import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  assertSafeStorageKey,
  type DocumentStorage,
  type PresignedRequest,
  type StoredObjectInfo,
} from './document-storage.js';

export interface LocalStorageOptions {
  /** Folder that holds uploaded files. */
  rootDir: string;
  /** Base URL clients use to reach this API, for example http://localhost:3001. */
  publicBaseUrl: string;
  /** Secret used to sign upload and download links. */
  signingSecret: string;
  urlTtlSeconds: number;
  now?: () => Date;
}

export interface LocalUrlPayload {
  /** Storage key. */
  k: string;
  /** HTTP method the link allows. */
  m: 'PUT' | 'GET';
  /** Content type the file must have. */
  ct: string;
  /** Exact upload size in bytes. */
  sz?: number;
  /** Download filename. */
  fn?: string;
  /** Expiry, in seconds since the epoch. */
  exp: number;
}

export class UploadSizeMismatchError extends Error {}

/**
 * Development storage on the local disk. It imitates S3 pre-signed URLs with
 * HMAC-signed links served by LocalStorageController, so clients use the same
 * upload and download flow in every environment.
 */
export class LocalDocumentStorage implements DocumentStorage {
  readonly driver = 'local' as const;
  private readonly rootDir: string;
  private readonly now: () => Date;

  constructor(private readonly options: LocalStorageOptions) {
    this.rootDir = resolve(options.rootDir);
    this.now = options.now ?? (() => new Date());
  }

  async createUploadRequest(input: {
    key: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<PresignedRequest> {
    assertSafeStorageKey(input.key);
    const exp = this.expiry();
    const token = this.sign({
      k: input.key,
      m: 'PUT',
      ct: input.contentType,
      sz: input.sizeBytes,
      exp,
    });
    return {
      method: 'PUT',
      url: this.urlFor(token),
      headers: { 'Content-Type': input.contentType },
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  async createDownloadRequest(input: {
    key: string;
    fileName: string;
    contentType: string;
  }): Promise<PresignedRequest> {
    assertSafeStorageKey(input.key);
    const exp = this.expiry();
    const token = this.sign({
      k: input.key,
      m: 'GET',
      ct: input.contentType,
      fn: input.fileName,
      exp,
    });
    return {
      method: 'GET',
      url: this.urlFor(token),
      headers: {},
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  async getObjectInfo(key: string): Promise<StoredObjectInfo | null> {
    try {
      const info = await stat(this.pathFor(key));
      return info.isFile() ? { sizeBytes: info.size } : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  /** Returns the link payload when the signature is valid, unexpired and for this method. */
  verifyToken(token: string, method: 'PUT' | 'GET'): LocalUrlPayload | null {
    const [body, signature] = token.split('.');
    if (!body || !signature) return null;
    const expected = this.signature(body);
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected))
      return null;
    let payload: LocalUrlPayload;
    try {
      payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as LocalUrlPayload;
    } catch {
      return null;
    }
    if (payload.m !== method || payload.exp * 1000 <= this.now().getTime())
      return null;
    try {
      assertSafeStorageKey(payload.k);
    } catch {
      return null;
    }
    return payload;
  }

  /**
   * Writes an upload of exactly `expectedSize` bytes. The file only appears
   * under its key once it is complete.
   */
  async writeObject(
    key: string,
    source: Readable,
    expectedSize: number,
  ): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.upload-${randomUUID()}`;
    let received = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > expectedSize) {
          callback(
            new UploadSizeMismatchError('Upload is larger than declared'),
          );
          return;
        }
        callback(null, chunk);
      },
    });
    try {
      await pipeline(
        source,
        limit,
        createWriteStream(temporary, { flags: 'wx' }),
      );
      if (received !== expectedSize)
        throw new UploadSizeMismatchError('Upload is smaller than declared');
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  /** Opens a stored file for download, or returns null when it does not exist. */
  async openObject(
    key: string,
  ): Promise<{ stream: Readable; sizeBytes: number } | null> {
    const info = await this.getObjectInfo(key);
    if (!info) return null;
    return {
      stream: createReadStream(this.pathFor(key)),
      sizeBytes: info.sizeBytes,
    };
  }

  private pathFor(key: string): string {
    assertSafeStorageKey(key);
    const target = resolve(this.rootDir, key);
    if (!target.startsWith(this.rootDir + sep))
      throw new Error('Invalid storage key');
    return target;
  }

  private expiry(): number {
    return Math.floor(this.now().getTime() / 1000) + this.options.urlTtlSeconds;
  }

  private urlFor(token: string): string {
    return `${this.options.publicBaseUrl.replace(/\/+$/, '')}/api/v1/storage/local/${token}`;
  }

  private sign(payload: LocalUrlPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.signature(body).toString()}`;
  }

  private signature(body: string): Buffer {
    return Buffer.from(
      createHmac('sha256', this.options.signingSecret)
        .update(body)
        .digest('base64url'),
    );
  }
}
