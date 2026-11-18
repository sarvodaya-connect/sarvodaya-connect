import { describe, expect, it } from 'vitest';
import { apiBase, forLog, storageUrl, uuid } from './smoke-safety.js';

describe('smoke script input checks', () => {
  it('accepts a local API over HTTP and trims the trailing slash', () => {
    expect(apiBase('http://localhost:3011/api/v1/', false)).toBe('http://localhost:3011/api/v1');
    expect(apiBase('http://127.0.0.1:4000/api/v1', false)).toBe('http://127.0.0.1:4000/api/v1');
    expect(apiBase('http://[::1]:3011/api/v1', false)).toBe('http://[::1]:3011/api/v1');
  });

  it('needs HTTPS and an explicit opt-in for any other API', () => {
    expect(() => apiBase('https://api.example.test/api/v1', false)).toThrow(/SMOKE_ALLOW_REMOTE/);
    expect(apiBase('https://api.example.test/api/v1', true)).toBe('https://api.example.test/api/v1');
    expect(() => apiBase('http://api.example.test/api/v1', true)).toThrow(/https/);
    // Looks local, but is another host.
    expect(() => apiBase('http://localhost.example.test/api/v1', true)).toThrow(/https/);
  });

  it('refuses other protocols, credentials, queries and non-URLs', () => {
    expect(() => apiBase('file:///etc/passwd', true)).toThrow(/http or https/);
    expect(() => apiBase('http://user:secret@localhost:3011/api/v1', false)).toThrow(/user name or password/);
    expect(() => apiBase('http://localhost:3011/api/v1?next=x', false)).toThrow(/query/);
    expect(() => apiBase('localhost:3011', false)).toThrow();
    expect(() => apiBase('not a url', false)).toThrow(/not a URL/);
  });

  it('only follows pre-signed links to local storage or Amazon S3 over HTTPS', () => {
    expect(storageUrl('http://localhost:9000/bucket/key?X-Amz-Signature=x', 'upload').host).toBe('localhost:9000');
    expect(storageUrl('https://docs.s3.ap-southeast-1.amazonaws.com/key', 'upload').hostname).toBe('docs.s3.ap-southeast-1.amazonaws.com');
    expect(() => storageUrl('http://docs.s3.ap-southeast-1.amazonaws.com/key', 'upload')).toThrow(/not local storage/);
    expect(() => storageUrl('https://169.254.169.254/latest/meta-data', 'upload')).toThrow(/not local storage/);
    expect(() => storageUrl('https://amazonaws.com.example.test/key', 'upload')).toThrow(/not local storage/);
    expect(() => storageUrl(undefined, 'upload')).toThrow(/missing/);
  });

  it('only puts UUIDs into request paths', () => {
    expect(uuid('29000000-0000-4000-8000-000000000101', 'id')).toBe('29000000-0000-4000-8000-000000000101');
    expect(() => uuid('../identity/accounts', 'id')).toThrow(/UUID/);
    expect(() => uuid('29000000-0000-4000-8000-000000000101/../x', 'id')).toThrow(/UUID/);
    expect(() => uuid(42, 'id')).toThrow(/UUID/);
  });

  it('never prints control characters or very long text', () => {
    expect(forLog('ok\nok 99 - forged\u001b[2J')).toBe('ok?ok 99 - forged?[2J');
    expect(forLog('x'.repeat(500))).toHaveLength(200);
  });
});
