/**
 * V5 PR 10 local smoke test, run against the Lambda emulator (or any API URL):
 * HQ signs in, creates a fictional SPC account for a seeded fictional society,
 * the SPC signs in, reads GET /home, uploads a private document through a
 * pre-signed URL (MinIO locally), confirms it, downloads it again and checks
 * the bytes. A second request without a token must be refused.
 *
 *   SMOKE_API_URL=http://localhost:3011/api/v1 SMOKE_HQ_USERNAME=… SMOKE_HQ_PASSWORD=… npm run smoke:local
 *
 * Fictional data only. Passwords are read from the environment and never printed.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const api = (process.env.SMOKE_API_URL ?? 'http://localhost:3011/api/v1').replace(/\/$/, '');
// The seeded fictional "Example Sunrise Society" and its district (prisma/seed.ts).
const societyId = process.env.SMOKE_SOCIETY_ID ?? '29000000-0000-4000-8000-000000000101';
const districtId = process.env.SMOKE_DISTRICT_ID ?? '29000000-0000-4000-8000-000000000001';
const hqUsername = process.env.SMOKE_HQ_USERNAME;
const hqPassword = process.env.SMOKE_HQ_PASSWORD;
if (!hqUsername || !hqPassword) throw new Error('Set SMOKE_HQ_USERNAME and SMOKE_HQ_PASSWORD (a local HQ account from npm run identity:bootstrap)');

let step = 0;
function pass(message: string) {
  step += 1;
  console.log(`ok ${step} - ${message}`);
}

async function call<T>(path: string, init: RequestInit & { token?: string; expect?: number } = {}): Promise<T> {
  const { token, expect = 200, ...rest } = init;
  const response = await fetch(`${api}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (response.status !== expect) throw new Error(`${init.method ?? 'GET'} ${path}: expected ${expect}, got ${response.status} ${body.error?.message ?? ''}`);
  return body;
}

const login = async (username: string, password: string) =>
  (await call<{ token: string }>('/identity/login', { method: 'POST', body: JSON.stringify({ username, password }), expect: 201 })).token;

const hq = await login(hqUsername, hqPassword);
pass('HQ signs in (POST /identity/login)');

const suffix = randomUUID().slice(0, 8);
const spcUsername = `smoke.spc.${suffix}`;
const spcPassword = `${randomBytes(12).toString('base64url')}7`;
await call('/identity/accounts', {
  method: 'POST',
  token: hq,
  expect: 201,
  body: JSON.stringify({ displayName: 'Fictional Smoke SPC', username: spcUsername, phone: '+94000000099', role: 'PROGRAMME_COORDINATOR', districtId, societyIds: [societyId], password: spcPassword }),
});
pass('HQ creates a fictional SPC account for a seeded society');

const spc = await login(spcUsername, spcPassword);
pass('SPC signs in');

const home = await call<{ role: string }>('/home', { token: spc });
if (home.role !== 'PROGRAMME_COORDINATOR') throw new Error(`GET /home returned role ${home.role}`);
pass('GET /home returns the SPC home');

await call('/home', { expect: 401 });
pass('GET /home without a token is refused (401)');

const file = Buffer.from(`%PDF-1.4\n% Fictional smoke test document ${suffix}\n%%EOF\n`);
const checksumSha256 = createHash('sha256').update(file).digest('base64');
const created = await call<{ document: { id: string }; upload: { url: string; headers: Record<string, string> } }>('/documents', {
  method: 'POST',
  token: spc,
  expect: 201,
  body: JSON.stringify({ societyId, documentType: 'OTHER', title: 'Fictional smoke test', fileName: 'smoke-test.pdf', contentType: 'application/pdf', sizeBytes: file.length, checksumSha256 }),
});
const uploadUrl = new URL(created.upload.url);
if (uploadUrl.pathname.includes('smoke-test') || uploadUrl.pathname.includes(spcUsername)) throw new Error('The storage key contains a name');
pass(`API returns a pre-signed upload URL (${uploadUrl.protocol}//${uploadUrl.host}, expires in ${uploadUrl.searchParams.get('X-Amz-Expires')} s, key has ids only)`);

const put = await fetch(created.upload.url, { method: 'PUT', headers: created.upload.headers, body: file });
if (!put.ok) throw new Error(`Upload to storage failed with ${put.status}`);
pass('The file goes straight to storage with the pre-signed PUT');

const tampered = await fetch(created.upload.url, { method: 'PUT', headers: { ...created.upload.headers, 'Content-Type': 'image/png' }, body: file });
if (tampered.ok) throw new Error('Storage accepted a different content type');
pass(`Storage refuses the same URL with a different content type (${tampered.status})`);

await call(`/documents/${created.document.id}/complete`, { method: 'POST', token: spc });
pass('POST /documents/:id/complete confirms the stored size');

const download = await call<{ url: string }>(`/documents/${created.document.id}/download`, { token: spc });
const fetched = Buffer.from(await (await fetch(download.url)).arrayBuffer());
if (!fetched.equals(file)) throw new Error('Downloaded bytes differ from the upload');
pass('Pre-signed download returns the same bytes');

const unsigned = new URL(download.url);
unsigned.search = '';
if ((await fetch(unsigned)).ok) throw new Error('The bucket served the object without a signature');
pass('The object is private: an unsigned GET is refused');

console.log(`\n${step} checks passed against ${api}`);
