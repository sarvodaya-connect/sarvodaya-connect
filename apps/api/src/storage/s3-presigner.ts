import { createHash, createHmac } from 'node:crypto';

/**
 * Amazon S3 pre-signed URLs (AWS Signature Version 4, query-string
 * authentication), implemented with Node's crypto so the API does not need the
 * AWS SDK until S3 is switched on. See "Authenticating Requests: Using Query
 * Parameters (AWS Signature Version 4)" in the Amazon S3 API reference.
 */

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface PresignS3Options {
  method: 'GET' | 'PUT' | 'HEAD';
  /** For example examplebucket.s3.us-east-1.amazonaws.com */
  host: string;
  key: string;
  region: string;
  credentials: AwsCredentials;
  expiresInSeconds: number;
  now: Date;
  /** Extra query parameters, for example response-content-disposition. */
  query?: Record<string, string>;
  /** Extra headers the client must send unchanged, for example content-type. */
  signedHeaders?: Record<string, string>;
}

/** RFC 3986 encoding as required by Signature Version 4. */
export function awsUriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function amzDate(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function presignS3Url(options: PresignS3Options): string {
  if (options.expiresInSeconds < 1 || options.expiresInSeconds > 604800) {
    throw new Error('Pre-signed URLs must expire within 1 second and 7 days');
  }

  const timestamp = amzDate(options.now);
  const date = timestamp.slice(0, 8);
  const scope = `${date}/${options.region}/s3/aws4_request`;
  const path = `/${options.key.split('/').map(awsUriEncode).join('/')}`;

  const headers: Record<string, string> = { host: options.host };
  for (const [name, value] of Object.entries(options.signedHeaders ?? {})) {
    headers[name.toLowerCase()] = value.trim();
  }
  const headerNames = Object.keys(headers).sort();
  const signedHeaderList = headerNames.join(';');

  const query: Record<string, string> = {
    ...options.query,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${options.credentials.accessKeyId}/${scope}`,
    'X-Amz-Date': timestamp,
    'X-Amz-Expires': String(options.expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaderList,
    ...(options.credentials.sessionToken
      ? { 'X-Amz-Security-Token': options.credentials.sessionToken }
      : {}),
  };
  const canonicalQuery = Object.entries(query)
    .map(([name, value]) => [awsUriEncode(name), awsUriEncode(value)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');

  const canonicalHeaders = headerNames
    .map((name) => `${name}:${headers[name]}\n`)
    .join('');
  const canonicalRequest = [
    options.method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderList,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = hmac(
    hmac(
      hmac(
        hmac(`AWS4${options.credentials.secretAccessKey}`, date),
        options.region,
      ),
      's3',
    ),
    'aws4_request',
  );
  const signature = hmac(signingKey, stringToSign).toString('hex');

  return `https://${options.host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
