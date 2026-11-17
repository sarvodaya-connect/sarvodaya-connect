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
import type { Principal } from '../../src/auth/principal.js';
import { IdentityService } from '../../src/identity/identity.service.js';
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
  async deleteUser(username: string) {
    this.fail('deleteUser');
    this.users.delete(username);
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
      // Deleted accounts were renamed deleted-<id>; they are found by id.
      ids.push(...(await db.platformAccount.findMany({ where: { displayName: { endsWith: ` ${suffix}` } }, select: { id: true } })).map((row) => row.id));
      await db.platformAuditEvent.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] } });
      await db.districtAccessGrant.deleteMany({ where: { districtId } });
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

  describe('Delete Account', () => {
    const hqPrincipal = (id: string): Principal => ({ id, displayName: `Fictional HQ ${suffix}`, roles: ['HQ_ADMIN'], districtIds: [], societyIds: [] });
    /** A fresh Cognito-linked account for one test. */
    const account = async (name: string, role = 'PROGRAMME_COORDINATOR') => {
      const id = randomUUID();
      const sub = `fake-sub-${name}-${suffix}`;
      const hq = role === 'HQ_ADMIN';
      await db.platformAccount.create({
        data: {
          id,
          username: username(name),
          displayName: `Fictional ${name} ${suffix}`,
          phone: '+94000000002',
          email: `${name}.${suffix}@example.invalid`,
          role,
          districtId: hq ? null : districtId,
          societyIds: hq ? [] : [societyId],
          status: 'ACTIVE',
          providerSubject: sub,
          passwordSetAt: new Date(),
          passwordSetCount: 1,
        },
      });
      cognito.users.set(username(name), { sub, password: 'fictional-pass-999', enabled: true, signOuts: 0 });
      created.push(id);
      return { id, sub };
    };
    /** Runs `body` with this file's HQ accounts as the only active HQ administrators; restores the others after. */
    const onlyTheseHq = async (body: () => Promise<void>) => {
      const others = await db.platformAccount.findMany({ where: { role: 'HQ_ADMIN', status: 'ACTIVE', NOT: { displayName: { endsWith: ` ${suffix}` } } }, select: { id: true } });
      const ids = others.map((row) => row.id);
      await db.platformAccount.updateMany({ where: { id: { in: ids } }, data: { status: 'PARKED_FOR_TEST' } });
      try {
        await body();
      } finally {
        await db.platformAccount.updateMany({ where: { id: { in: ids } }, data: { status: 'ACTIVE' } });
      }
    };

    it('deletes the sign-in and personal details, ends sessions, keeps the name for history and leaves the society alone', async () => {
      const { id, sub } = await account('leaver');
      const session = tokenFor(sub, now() - 30);
      await call('get', '/identity/me', session).expect(200);
      await db.districtAccessGrant.create({ data: { deputyId: id, districtId, grantedById: hqId, startsAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 3_600_000), reason: 'Fictional cover' } });
      const societyBefore = await db.society.findUniqueOrThrow({ where: { id: societyId } });

      const response = await call('post', `/identity/accounts/${id}/delete`, tokenFor(hqSub)).send({ confirmation: 'delete' }).expect(201);
      expect(response.body).toEqual({ status: 'DELETED', signIn: 'DELETED' });

      expect(cognito.users.has(username('leaver'))).toBe(false);
      await call('get', '/identity/me', session).expect(401);
      const row = await db.platformAccount.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({
        status: 'DELETED',
        username: `deleted-${id}`,
        displayName: `Fictional leaver ${suffix}`,
        role: 'PROGRAMME_COORDINATOR',
        districtId,
        phone: '',
        email: null,
        passwordHash: null,
        providerSubject: null,
        societyIds: [],
      });
      expect(await db.districtAccessGrant.count({ where: { deputyId: id, revokedAt: null } })).toBe(0);
      expect(await db.society.findUniqueOrThrow({ where: { id: societyId } })).toEqual(societyBefore);
      const audit = await db.platformAuditEvent.findMany({ where: { targetId: id, action: 'ACCOUNT_DELETED' } });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ actorId: hqId, detail: expect.stringContaining('sign-in deleted') });

      // Gone from Administration, still named in the change log.
      const list = await call('get', '/identity/accounts', tokenFor(hqSub)).expect(200);
      expect(list.body.data.map((a: { id: string }) => a.id)).not.toContain(id);
      const log = await call('get', `/identity/audit?q=${encodeURIComponent(`Fictional leaver ${suffix}`)}`, tokenFor(hqSub)).expect(200);
      expect(JSON.stringify(log.body)).toContain(`Fictional leaver ${suffix}`);

      // The username can be given to someone new; it is a different account.
      cognito.calls = [];
      const again = await call('post', '/identity/accounts', tokenFor(hqSub)).send(spc('leaver')).expect(201);
      expect(again.body.account.id).not.toBe(id);
      created.push(again.body.account.id);

      // Deleting it again finds nothing.
      await call('post', `/identity/accounts/${id}/delete`, tokenFor(hqSub)).send({ confirmation: 'delete' }).expect(404);
    });

    it('needs the typed confirmation, HQ access, and never deletes HQ itself', async () => {
      const { id } = await account('kept');
      const spcActor = await account('spc-actor');
      await call('post', `/identity/accounts/${id}/delete`, tokenFor(hqSub)).send({}).expect(400);
      await call('post', `/identity/accounts/${id}/delete`, tokenFor(hqSub)).send({ confirmation: 'Delete' }).expect(400);
      await call('post', `/identity/accounts/${id}/delete`, tokenFor(spcActor.sub)).send({ confirmation: 'delete' }).expect(403);
      await call('post', `/identity/accounts/${id}/delete`).send({ confirmation: 'delete' }).expect(401);
      const self = await call('post', `/identity/accounts/${hqId}/delete`, tokenFor(hqSub)).send({ confirmation: 'delete' }).expect(400);
      expect(self.body.error.message).toContain('your own account');
      expect((await db.platformAccount.findUniqueOrThrow({ where: { id } })).status).toBe('ACTIVE');
      expect((await db.platformAccount.findUniqueOrThrow({ where: { id: hqId } })).status).toBe('ACTIVE');
      expect(cognito.calls).not.toContain('deleteUser');
    });

    it('never deletes the last active HQ administrator, and two administrators deleting each other cannot both succeed', async () => {
      const identity = app.get(IdentityService);
      const first = await account('hq-a', 'HQ_ADMIN');
      const second = await account('hq-b', 'HQ_ADMIN');
      await onlyTheseHq(async () => {
        await db.platformAccount.update({ where: { id: hqId }, data: { status: 'PARKED_FOR_TEST' } });
        try {
          // hq-a and hq-b are the only active HQ administrators, and each deletes the other at once.
          const results = await Promise.allSettled([identity.deleteAccount(second.id, hqPrincipal(first.id)), identity.deleteAccount(first.id, hqPrincipal(second.id))]);
          expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
          const refused = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
          expect(String(refused.reason.message)).toMatch(/last active HQ administrator|Account not found/);
          const statuses = (await db.platformAccount.findMany({ where: { id: { in: [first.id, second.id] } }, select: { status: true } })).map((row) => row.status).sort();
          expect(statuses).toEqual(['ACTIVE', 'DELETED']);
          // The one left is the last: a stand-in HQ (not an account) cannot delete it.
          const survivor = (await db.platformAccount.findFirstOrThrow({ where: { id: { in: [first.id, second.id] }, status: 'ACTIVE' } })).id;
          await expect(identity.deleteAccount(survivor, hqPrincipal('demo-hq-admin'))).rejects.toThrow('last active HQ administrator');
          expect((await db.platformAccount.findUniqueOrThrow({ where: { id: survivor } })).status).toBe('ACTIVE');
        } finally {
          await db.platformAccount.update({ where: { id: hqId }, data: { status: 'ACTIVE' } });
        }
      });
    });

    it('if Cognito cannot be reached, nothing is deleted', async () => {
      const { id, sub } = await account('offline');
      cognito.failNext.deleteUser = 'UNAVAILABLE';
      const response = await call('post', `/identity/accounts/${id}/delete`, tokenFor(hqSub)).send({ confirmation: 'delete' }).expect(503);
      expect(response.body.error.message).toContain('could not be reached');
      expect(await db.platformAccount.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'ACTIVE', username: username('offline'), providerSubject: sub });
      expect(cognito.users.has(username('offline'))).toBe(true);
      expect(await db.platformAuditEvent.count({ where: { targetId: id, action: 'ACCOUNT_DELETED' } })).toBe(0);
    });

    it('before the IAM role may delete users, the sign-in is disabled and signed out instead, and the log says so', async () => {
      const { id } = await account('noperm');
      cognito.failNext.deleteUser = 'NOT_PERMITTED';
      const response = await call('post', `/identity/accounts/${id}/delete`, tokenFor(hqSub)).send({ confirmation: 'delete' }).expect(201);
      expect(response.body).toEqual({ status: 'DELETED', signIn: 'DISABLED' });
      expect(cognito.users.get(username('noperm'))).toMatchObject({ enabled: false, signOuts: 1 });
      expect((await db.platformAccount.findUniqueOrThrow({ where: { id } })).status).toBe('DELETED');
      const audit = await db.platformAuditEvent.findFirstOrThrow({ where: { targetId: id, action: 'ACCOUNT_DELETED' } });
      expect(audit.detail).toContain('AdminDeleteUser');
    });

    it("never deletes a Cognito user that belongs to someone else's account", async () => {
      const { id } = await account('mixup');
      // The pool's user with this username is linked to the officer, not to this account.
      cognito.users.set(username('mixup'), { sub: officerSub, password: 'officer-own-pass-1', enabled: true, signOuts: 0 });
      const response = await call('post', `/identity/accounts/${id}/delete`, tokenFor(hqSub)).send({ confirmation: 'delete' }).expect(201);
      expect(response.body.signIn).toBe('NONE');
      expect(cognito.users.get(username('mixup'))).toMatchObject({ sub: officerSub, enabled: true });
      expect(cognito.calls).not.toContain('deleteUser');
    });
  });

  it('local passwords stay off: the local sign-in is refused', async () => {
    await call('post', '/identity/login').send({ username: username('one'), password: PASSWORD }).expect(403);
  });
});
