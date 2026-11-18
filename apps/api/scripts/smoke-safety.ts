/**
 * Checks for scripts/smoke-local.ts. It is a developer and CI script, not an
 * exposed endpoint, but it still sends a password and tokens, so it only talks
 * to the API it was pointed at and to document storage, and never prints
 * control characters from a response.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isLocal = (url: URL) => LOCAL_HOSTS.has(url.hostname);

function parse(raw: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`${label} must use http or https`);
  if (url.username || url.password) throw new Error(`${label} must not contain a user name or password`);
  return url;
}

/**
 * The API base URL, without a trailing slash. A computer-local API may use
 * plain HTTP. Any other API must use HTTPS and needs SMOKE_ALLOW_REMOTE=1, so
 * the smoke test (which creates an account) never reaches a shared or live
 * environment by accident.
 */
export function apiBase(raw: string, allowRemote: boolean): string {
  const url = parse(raw, 'SMOKE_API_URL');
  if (url.search || url.hash) throw new Error('SMOKE_API_URL must not have a query or fragment');
  if (!isLocal(url)) {
    if (url.protocol !== 'https:') throw new Error('SMOKE_API_URL must use https unless it is on this computer');
    if (!allowRemote) throw new Error('SMOKE_API_URL is not on this computer: set SMOKE_ALLOW_REMOTE=1 for an agreed test environment');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

/** A pre-signed storage URL from the API: local storage (MinIO) or Amazon S3 over HTTPS. */
export function storageUrl(raw: unknown, label: string): URL {
  if (typeof raw !== 'string') throw new Error(`${label} is missing`);
  const url = parse(raw, label);
  const s3 = url.protocol === 'https:' && url.hostname.endsWith('.amazonaws.com');
  if (!isLocal(url) && !s3) throw new Error(`${label} is not local storage or Amazon S3: ${forLog(url.host)}`);
  return url;
}

/** An id from the environment or a response, safe to put in a request path. */
export function uuid(raw: unknown, label: string): string {
  if (typeof raw !== 'string' || !UUID.test(raw)) throw new Error(`${label} is not a UUID`);
  return raw.toLowerCase();
}

/** Text for the console: control characters (new lines included) shown as "?", at most 200 characters. */
export function forLog(text: unknown): string {
  return String(text).replace(/\p{Cc}/gu, '?').slice(0, 200);
}
