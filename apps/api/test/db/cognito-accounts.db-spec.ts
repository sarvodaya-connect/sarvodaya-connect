/**
 * HQ account management with Amazon Cognito (AUTH_PROVIDER=cognito), against
 * PostgreSQL. Cognito is an in-memory stand-in and tokens are mapped by a
 * mocked verifier: nothing contacts AWS. Every record is fictional and removed
 * afterwards.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { COGNITO_ACCOUNT_ADMIN, CognitoAdminError, type CognitoAccountAdmin } from '../../src/auth/cognito-account-admin.js';
import { COGNITO_TOKEN_VERIFIER, type VerifiedCognitoUser } from '../../src/auth/cognito-authentication.provider.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

type FakeUser = { sub: string; password?: string; enabled: boolean; signOuts: number };

/** A Cognito user pool in memory, with switchable failures. */
class FakeCognito implements CognitoAccountAdmin {
  users = new Map<string, FakeUser>();
  failNext: Partial<Record<keyof CognitoAccountAdmin, CognitoAdminError['reason']>> = {};
  calls: string[] = [];
  private fail(step: keyof CognitoAccountAdmin) {
    this.calls.push(step);
    const reason = this.failNext[step];
    if (reason) {
      delete this.failNext[step];
      throw new CognitoAdminError(reason);
    }
  }
  private user(username: string) {
    const user = this.users.get(username);
    if (!user) throw new CognitoAdminError('NOT_FOUND');
    return user;
  }
  async findSubject(username: string) {
    this.fail('findSubject');
    return this.users.get(username)?.sub ?? null;
  }
  async createUser(username: string) {
    this.fail('createUser');
    if (this.users.has(username)) throw new CognitoAdminError('USERNAME_EXISTS');
    const sub = `fake-sub-${randomUUID()}`;
    this.users.set(username, { sub, enabled: true, signOuts: 0 });
    return sub;
  }
  async setPassword(username: string, password: string) {
    this.fail('setPassword');
    this.user(username).password = password;
  }
  async enable(username: string) {
    this.fail('enable');
    this.user(username).enabled = true;
  }
  async disable(username: string) {
    this.fail('disable');
    this.user(username).enabled = false;
  }
  async signOut(username: string) {
    this.fail('signOut');
    this.user(username).signOuts += 1;
  }
}

describe('HQ accounts with Amazon Cognito (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  const cognito = new FakeCognito();
  /** token -> verified Cognito user, as the mocked verifier sees it. */
  const tokens = new Map<string, VerifiedCognitoUser>();
  const suffix = randomUUID().slice(0, 8);
  const districtId = randomUUID();
  const societyId = randomUUID();
  const hqId = randomUUID();
  const officerId = randomUUID();
  const hqSub = `fake-sub-hq-${suffix}`;
  const officerSub = `fake-sub-officer-${suffix}`;
  const created: string[] = [];
  const now = () => Math.floor(Date.now() / 1000);
  const tokenFor = (sub: string, authTime = now() - 60) => {
    const token = `eyJ0ZXN0IjoxfQ.${Buffer.from(randomUUID()).toString('base64url')}.c2ln`;
    tokens.set(token, { sub, authTime });
    return token;
  };
  const username = (name: string) => `cog.${name}.${suffix}`;
  const PASSWORD = 'fictional-pass-123';

  beforeAll(async () => {
    process.env.NIC_ENCRYPTION_KEY ??= '22'.repeat(32);
    const env = { AUTH_PROVIDER: 'cognito', COGNITO_USER_POOL_ID: 'ap-southeast-1_Fictional1', COGNITO_CLIENT_ID: 'fictionalclient1' };
    const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
    Object.assign(process.env, env);
    try {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(COGNITO_TOKEN_VERIFIER)
        .useValue({
          verify: async (token: string) => {
            const user = tokens.get(token);
            if (!user) throw Object.assign(new Error('Invalid signature'), { name: 'JwtInvalidSignatureError' });
            return user;
          },
        })
        .overrideProvider(COGNITO_ACCOUNT_ADMIN)
        .useValue(cognito)
        .compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
      app.useGlobalFilters(new ApiExceptionFilter());
      await app.init();
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    db = app.get(PrismaService);
    await db.district.create({ data: { id: districtId, code: `C${suffix}`, nameEn: `Cognito ${suffix}` } });
    await db.society.create({ data: { id: societyId, societyCode: `S-C${suffix}`, nameEn: `Fictional Cognito ${suffix} SSS`, districtId, status: 'ACTIVE' } });
    await db.platformAccount.createMany({
      data: [
        { id: hqId, username: username('hq'), displayName: 'Fictional HQ', phone: '+94000000000', role: 'HQ_ADMIN', status: 'ACTIVE', providerSubject: hqSub },
        {
          id: officerId,
          username: username('officer'),
          displayName: 'Fictional Officer',
          phone: '+94000000000',
          role: 'SOCIETY_OFFICER',
          districtId,
          societyIds: [societyId],
          status: 'ACTIVE',
          providerSubject: officerSub,
        },
      ],
    });
  });

  beforeEach(() => {
    cognito.calls = [];
    cognito.failNext = {};
  });

  afterAll(async () => {
    if (db) {
      const ids = [hqId, officerId, ...created];
      const byName = await db.platformAccount.findMany({ where: { username: { startsWith: 'cog.', endsWith: `.${suffix}` } }, select: { id: true } });
      ids.push(...byName.map((row) => row.id));
      await db.platformAuditEvent.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] } });
      await db.platformAccount.deleteMany({ where: { id: { in: ids } } });
      await db.society.deleteMany({ where: { id: societyId } });
      await db.district.deleteMany({ where: { id: districtId } });
    }
    await app?.close();
  });

  const call = (method: 'get' | 'post' | 'put', path: string, token?: string) => {
    const req = request(app.getHttpServer())[method](`/api/v1${path}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const spc = (name: string, extra: object = {}) => ({
    displayName: `Fictional SPC ${name}`,
    username: username(name),
    phone: '+94000000001',
    role: 'PROGRAMME_COORDINATOR',
    districtId,
    societyIds: [societyId],
    password: PASSWORD,
    ...extra,
  });

  it('HQ creates an account: a Cognito user with a permanent password, linked by sub, no password kept by the API', async () => {
    const response = await call('post', '/identity/accounts', tokenFor(hqSub)).send(spc('one')).expect(201);
    expect(response.body).toEqual({ account: { id: expect.any(String), username: username('one'), status: 'ACTIVE' }, delivery: 'MANUAL_HANDOVER' });
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
    created.push(response.body.account.id);
    const cognitoUser = cognito.users.get(username('one'))!;
    expect(cognitoUser).toMatchObject({ password: PASSWORD, enabled: true });
    const row = await db.platformAccount.findUniqueOrThrow({ where: { id: response.body.account.id } });
    expect(row).toMatchObject({ providerSubject: cognitoUser.sub, passwordHash: null, status: 'ACTIVE', role: 'PROGRAMME_COORDINATOR' });
    const audit = await db.platformAuditEvent.findMany({ where: { targetId: row.id } });
    expect(audit.map((event) => event.action)).toEqual(['ACCOUNT_CREATED']);
    expect(JSON.stringify(audit)).not.toContain(PASSWORD);

    // The new person signs in: role and scope come from the database.
    const me = await call('get', '/identity/me', tokenFor(cognitoUser.sub)).expect(200);
    expect(me.body).toMatchObject({ id: row.id, roles: ['PROGRAMME_COORDINATOR'], societyIds: [societyId], districtIds: [districtId] });
  });

  it('a failed step leaves the account unable to sign in, and submitting again resumes without a duplicate', async () => {
    cognito.failNext.setPassword = 'UNAVAILABLE';
    const first = await call('post', '/identity/accounts', tokenFor(hqSub)).send(spc('retry')).expect(503);
    expect(first.body.error.message).toContain('could not be reached');
    const pending = await db.platformAccount.findUniqueOrThrow({ where: { username: username('retry') } });
    expect(pending).toMatchObject({ status: 'PENDING', providerSubject: null });
    const sub = cognito.users.get(username('retry'))!.sub;
    await call('get', '/identity/me', tokenFor(sub)).expect(401);

    cognito.calls = [];
    const again = await call('post', '/identity/accounts', tokenFor(hqSub)).send(spc('retry', { displayName: 'Fictional SPC Retry Fixed' })).expect(201);
    expect(again.body.account.id).toBe(pending.id);
    // The Cognito user from the first attempt is found and reused, not created again.
    expect(cognito.calls).toEqual(['findSubject', 'setPassword', 'enable']);
    expect([...cognito.users.keys()].filter((name) => name === username('retry'))).toHaveLength(1);
    const row = await db.platformAccount.findUniqueOrThrow({ where: { id: pending.id } });
    expect(row).toMatchObject({ status: 'ACTIVE', providerSubject: sub, displayName: 'Fictional SPC Retry Fixed' });
    expect(await db.platformAccount.count({ where: { username: username('retry') } })).toBe(1);
  });

  it('a password Cognito refuses gets a clear message and changes nothing for sign-in', async () => {
    cognito.failNext.setPassword = 'INVALID_PASSWORD';
    const response = await call('post', '/identity/accounts', tokenFor(hqSub)).send(spc('weak')).expect(400);
    expect(response.body.error.message).toContain('did not accept this password');
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
    expect((await db.platformAccount.findUniqueOrThrow({ where: { username: username('weak') } })).status).toBe('PENDING');
  });

  it('"Set new password" finishes an account whose creation stopped part-way', async () => {
    const pending = await db.platformAccount.findUniqueOrThrow({ where: { username: username('weak') } });
    expect(pending.status).toBe('PENDING');
    await call('post', `/identity/accounts/${pending.id}/password`, tokenFor(hqSub)).send({ password: 'stronger-pass-123' }).expect(201);
    const row = await db.platformAccount.findUniqueOrThrow({ where: { id: pending.id } });
    const cognitoUser = cognito.users.get(username('weak'))!;
    expect(row).toMatchObject({ status: 'ACTIVE', providerSubject: cognitoUser.sub, passwordHash: null });
    expect(cognitoUser.password).toBe('stronger-pass-123');
    await call('get', '/identity/me', tokenFor(cognitoUser.sub, now() + 1)).expect(200);
  });

  it('never links a Cognito user that already belongs to another account, and leaves its password alone', async () => {
    // The pool already has this username, linked to the officer's account.
    cognito.users.set(username('taken'), { sub: officerSub, password: 'officer-own-pass-1', enabled: true, signOuts: 0 });
    const response = await call('post', '/identity/accounts', tokenFor(hqSub)).send(spc('taken')).expect(409);
    expect(response.body.error.message).toContain('different person');
    expect(cognito.users.get(username('taken'))!.password).toBe('officer-own-pass-1');
    expect(cognito.calls).not.toContain('setPassword');
  });

  it('an existing username in the database is refused before Cognito is touched', async () => {
    await call('post', '/identity/accounts', tokenFor(hqSub)).send(spc('officer')).expect(409);
    expect(cognito.calls).toEqual([]);
  });

  it('only HQ can create accounts or set passwords', async () => {
    const officer = tokenFor(officerSub);
    await call('post', '/identity/accounts', officer).send(spc('nope')).expect(403);
    await call('post', `/identity/accounts/${officerId}/password`, officer).send({ password: PASSWORD }).expect(403);
    await call('post', '/identity/accounts').send(spc('nope')).expect(401);
    expect(cognito.calls).toEqual([]);
  });

  it('HQ sets a replacement password: Cognito gets it as permanent, signs the person out, and old sign-ins stop working', async () => {
    const officerName = username('officer');
    cognito.users.set(officerName, { sub: officerSub, password: 'old-pass-123', enabled: true, signOuts: 0 });
    const before = tokenFor(officerSub, now() - 120);
    await call('get', '/identity/me', before).expect(200);

    const response = await call('post', `/identity/accounts/${officerId}/password`, tokenFor(hqSub)).send({ password: 'new-pass-4567' }).expect(201);
    expect(response.body).toEqual({ status: 'ACTIVE' });
    expect(cognito.users.get(officerName)).toMatchObject({ password: 'new-pass-4567', enabled: true, signOuts: 1 });
    // The access token from before the reset is refused, even though it has not expired.
    await call('get', '/identity/me', before).expect(401);
    // A sign-in with the new password works.
    await call('get', '/identity/me', tokenFor(officerSub, now() + 1)).expect(200);
    const row = await db.platformAccount.findUniqueOrThrow({ where: { id: officerId } });
    expect(row.passwordHash).toBeNull();
    expect(row.passwordSetCount).toBe(1);
    const audit = await db.platformAuditEvent.findMany({ where: { targetId: officerId, action: 'ACCOUNT_PASSWORD_CHANGED' } });
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain('new-pass-4567');
  });

  it('if Cognito cannot be reached, the password is not reported as changed', async () => {
    cognito.failNext.setPassword = 'UNAVAILABLE';
    const before = await db.platformAccount.findUniqueOrThrow({ where: { id: officerId } });
    await call('post', `/identity/accounts/${officerId}/password`, tokenFor(hqSub)).send({ password: 'other-pass-890' }).expect(503);
    const after = await db.platformAccount.findUniqueOrThrow({ where: { id: officerId } });
    expect(after.passwordSetCount).toBe(before.passwordSetCount);
  });

  it('HQ disables an account: refused at once by the API, and disabled and signed out in Cognito', async () => {
    const officerName = username('officer');
    const token = tokenFor(officerSub, now() + 2);
    await call('get', '/identity/me', token).expect(200);
    await call('post', `/identity/accounts/${officerId}/disable`, tokenFor(hqSub)).expect(201);
    await call('get', '/identity/me', token).expect(401);
    expect(cognito.users.get(officerName)).toMatchObject({ enabled: false });
    expect(cognito.calls).toEqual(['disable', 'signOut']);
  });

  it('local passwords stay off: the local sign-in is refused', async () => {
    await call('post', '/identity/login').send({ username: username('one'), password: PASSWORD }).expect(403);
  });
});
