import {
  assertSafeStorageKey,
  type DocumentStorage,
  type PresignedRequest,
  safeDownloadName,
  type StoredObjectInfo,
  StorageUnavailableError,
} from './document-storage.js';
import { type AwsCredentials, presignS3Url } from './s3-presigner.js';

export interface S3StorageOptions {
  bucket: string;
  region: string;
  credentials: () => AwsCredentials;
  urlTtlSeconds: number;
  /** Override for S3-compatible endpoints or tests. Defaults to virtual-hosted S3. */
  host?: string;
  now?: () => Date;
  fetchFn?: typeof fetch;
}

/**
 * Amazon S3 storage using pre-signed URLs: clients upload and download
 * directly from the bucket. The bucket should block public access, and its
 * CORS rules must allow PUT and GET from the app and dashboard origins.
 */
export class S3DocumentStorage implements DocumentStorage {
  readonly driver = 's3' as const;
  private readonly host: string;
  private readonly now: () => Date;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: S3StorageOptions) {
    this.host =
      options.host ?? `${options.bucket}.s3.${options.region}.amazonaws.com`;
    this.now = options.now ?? (() => new Date());
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async createUploadRequest(input: {
    key: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<PresignedRequest> {
    assertSafeStorageKey(input.key);
    const now = this.now();
    const url = this.presign(
      'PUT',
      input.key,
      now,
      {},
      { 'content-type': input.contentType },
    );
    return {
      method: 'PUT',
      url,
      headers: { 'Content-Type': input.contentType },
      expiresAt: this.expiresAt(now),
    };
  }

  async createDownloadRequest(input: {
    key: string;
    fileName: string;
    contentType: string;
  }): Promise<PresignedRequest> {
    assertSafeStorageKey(input.key);
    const now = this.now();
    const url = this.presign('GET', input.key, now, {
      'response-content-disposition': `attachment; filename="${safeDownloadName(input.fileName)}"`,
      'response-content-type': input.contentType,
    });
    return { method: 'GET', url, headers: {}, expiresAt: this.expiresAt(now) };
  }

  async getObjectInfo(key: string): Promise<StoredObjectInfo | null> {
    assertSafeStorageKey(key);
    const url = this.presign('HEAD', key, this.now());
    let response: Response;
    try {
      response = await this.fetchFn(url, { method: 'HEAD' });
    } catch (error) {
      throw new StorageUnavailableError(
        'Document storage could not be reached',
        { cause: error },
      );
    }
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new StorageUnavailableError(
        `Document storage returned ${response.status}`,
      );
    }
    return { sizeBytes: Number(response.headers.get('content-length') ?? 0) };
  }

  private presign(
    method: 'GET' | 'PUT' | 'HEAD',
    key: string,
    now: Date,
    query: Record<string, string> = {},
    signedHeaders: Record<string, string> = {},
  ): string {
    return presignS3Url({
      method,
      host: this.host,
      key,
      region: this.options.region,
      credentials: this.options.credentials(),
      expiresInSeconds: this.options.urlTtlSeconds,
      now,
      query,
      signedHeaders,
    });
  }

  private expiresAt(now: Date): string {
    return new Date(
      now.getTime() + this.options.urlTtlSeconds * 1000,
    ).toISOString();
  }
}
