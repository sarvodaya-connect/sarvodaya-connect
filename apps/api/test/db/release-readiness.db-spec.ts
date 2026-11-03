/**
 * V5 PR 10 release-readiness checks against PostgreSQL: Amazon Cognito sign-in
 * (with a mocked token verifier; nothing contacts AWS), the local sign-in being
 * switched off when Cognito is selected, routes found by the security audit,
 * reviewer notifications reaching real accounts, and session expiry.
 * Every record is fictional and removed afterwards.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { COGNITO_TOKEN_VERIFIER } from '../../src/auth/cognito-authentication.provider.js';
import { USER_DIRECTORY, type UserDirectory } from '../../src/auth/user-directory.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

/** Fictional JWT-shaped strings; the mocked verifier maps each to a Cognito subject. */
const jwt = (name: string) => `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(name).toString('base64url')}.c2ln`;

async function startApp(env: Record<string, string | undefined>, subjects: Record<string, string> = {}) {
  const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  try {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(COGNITO_TOKEN_VERIFIER)
      .useValue({
        verify: async (token: string) => {
          const sub = subjects[token];
          if (!sub) throw Object.assign(new Error('Invalid signature'), { name: 'JwtInvalidSignatureError' });
          return { sub };
        },
      })
      .compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    return app;
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('V5 PR 10 release readiness (PostgreSQL)', () => {
  let local: INestApplication;
  let cognito: INestApplication;
  let db: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const districtId = randomUUID();
  const otherDistrictId = randomUUID();
  const societyId = randomUUID();
  const neighbourId = randomUUID();
  const ids = { hq: randomUUID(), dm: randomUUID(), otherDm: randomUUID(), ddm: randomUUID(), disabledHq: randomUUID(), unlinked: randomUUID() };
  const subjects = {
    [jwt('ddm')]: `cognito-ddm-${suffix}`,
    [jwt('hq')]: `cognito-hq-${suffix}`,
    [jwt('disabled')]: `cognito-disabled-${suffix}`,
    [jwt('nobody')]: `cognito-nobody-${suffix}`,
  };
  const password = 'test-password-123';

  beforeAll(async () => {
    process.env.NIC_ENCRYPTION_KEY ??= '22'.repeat(32);
    local = await startApp({ AUTH_PROVIDER: 'local' });
    cognito = await startApp({ AUTH_PROVIDER: 'cognito', COGNITO_USER_POOL_ID: 'ap-southeast-1_Fictional1', COGNITO_CLIENT_ID: 'fictional-client' }, subjects);
    db = local.get(PrismaService);

    await db.district.createMany({
      data: [
        { id: districtId, code: `R${suffix}`, nameEn: `Readiness ${suffix}` },
        { id: otherDistrictId, code: `Q${suffix}`, nameEn: `Readiness other ${suffix}` },
      ],
    });
    await db.society.createMany({
      data: [
        { id: societyId, societyCode: `S-R${suffix}`, nameEn: `Fictional Readiness ${suffix} SSS`, districtId, status: 'ACTIVE' },
        { id: neighbourId, societyCode: `S-N${suffix}`, nameEn: `Fictional Neighbour ${suffix} SSS`, districtId, status: 'ACTIVE' },
      ],
    });
    const account = (id: string, role: string, extra: object = {}) => ({
      id,
      username: `ready.${role.toLowerCase()}.${id.slice(0, 6)}.${suffix}`,
      displayName: `Fictional ${role}`,
      phone: '+94000000000',
      role,
      status: 'ACTIVE',
      passwordHash: passwordHash(password),
      ...extra,
    });
    await db.platformAccount.createMany({
      data: [
        account(ids.hq, 'HQ_ADMIN', { providerSubject: subjects[jwt('hq')] }),
        account(ids.disabledHq, 'HQ_ADMIN', { status: 'INACTIVE', providerSubject: subjects[jwt('disabled')] }),
        account(ids.dm, 'DISTRICT_MANAGER', { districtId }),
        account(ids.otherDm, 'DISTRICT_MANAGER', { districtId: otherDistrictId }),
        account(ids.ddm, 'DEPUTY_DISTRICT_MANAGER', { districtId, societyIds: [societyId], providerSubject: subjects[jwt('ddm')] }),
        account(ids.unlinked, 'PROGRAMME_COORDINATOR', { districtId, societyIds: [societyId] }),
      ],
    });
    // A temporary, view-only district grant for the DDM, valid now.
    await db.districtAccessGrant.create({
      data: { districtId, deputyId: ids.ddm, grantedById: ids.dm, startsAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 3_600_000), reason: 'Fictional readiness test' },
    });
  });

  afterAll(async () => {
    if (db) {
      const accounts = Object.values(ids);
      await db.platformAuditEvent.deleteMany({ where: { actorId: { in: accounts } } });
      await db.districtAccessGrant.deleteMany({ where: { deputyId: { in: accounts } } });
      await db.accountSession.deleteMany({ where: { accountId: { in: accounts } } });
      await db.platformAccount.deleteMany({ where: { id: { in: accounts } } });
      await db.society.deleteMany({ where: { id: { in: [societyId, neighbourId] } } });
      await db.district.deleteMany({ where: { id: { in: [districtId, otherDistrictId] } } });
    }
    await local?.close();
    await cognito?.close();
  });

  const get = (app: INestApplication, path: string, token?: string) => {
    const call = request(app.getHttpServer()).get(`/api/v1${path}`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  it('Cognito: a verified token gets the role, scope and temporary district from the database', async () => {
    const me = await get(cognito, '/identity/me', jwt('ddm')).expect(200);
    expect(me.body).toMatchObject({ id: ids.ddm, roles: ['DEPUTY_DISTRICT_MANAGER'], societyIds: [societyId] });
    expect(me.body.delegatedDistrictAccess).toEqual([expect.objectContaining({ districtId })]);
    // The grant is view only: reading the neighbour works, editing it does not.
    await get(cognito, `/societies/${neighbourId}`, jwt('ddm')).expect(200);
    await request(cognito.getHttpServer())
      .patch(`/api/v1/societies/${neighbourId}/profile`)
      .set('Authorization', `Bearer ${jwt('ddm')}`)
      .send({ addressLine: 'Not allowed' })
      .expect(403);
  });

  it('Cognito: forged, unlinked and disabled users are refused, and HQ-only routes stay HQ-only', async () => {
    await get(cognito, '/identity/me', jwt('forged')).expect(401);
    await get(cognito, '/identity/me', jwt('nobody')).expect(401);
    await get(cognito, '/identity/me', jwt('disabled')).expect(401);
    await get(cognito, '/identity/me').expect(401);
    await get(cognito, '/national/overview', jwt('ddm')).expect(403);
    await get(cognito, '/national/overview', jwt('hq')).expect(200);
  });

  it('Cognito: local passwords and local session tokens do not work', async () => {
    const username = `ready.programme_coordinator.${ids.unlinked.slice(0, 6)}.${suffix}`;
    await request(cognito.getHttpServer()).post('/api/v1/identity/login').send({ username, password }).expect(403);
    const session = await request(local.getHttpServer()).post('/api/v1/identity/login').send({ username, password }).expect(201);
    await get(cognito, '/identity/me', session.body.token).expect(401);
  });

  it('local: an expired session is refused', async () => {
    const username = `ready.programme_coordinator.${ids.unlinked.slice(0, 6)}.${suffix}`;
    const session = await request(local.getHttpServer()).post('/api/v1/identity/login').send({ username, password }).expect(201);
    await get(local, '/identity/me', session.body.token).expect(200);
    await db.accountSession.update({
      where: { tokenHash: createHash('sha256').update(session.body.token as string).digest('hex') },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await get(local, '/identity/me', session.body.token).expect(401);
  });

  it('security audit: GET /districts now needs sign-in', async () => {
    await get(local, '/districts').expect(401);
    const login = await request(local.getHttpServer())
      .post('/api/v1/identity/login')
      .send({ username: `ready.district_manager.${ids.dm.slice(0, 6)}.${suffix}`, password })
      .expect(201);
    const districts = await get(local, '/districts', login.body.token).expect(200);
    expect(districts.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: districtId, societyCount: 2 })]));
  });

  it('document reviewers are the active HQ accounts and the DMs of that district, from the database', async () => {
    const reviewers = await local.get<UserDirectory>(USER_DIRECTORY, { strict: false }).findReviewerIds(districtId);
    expect(reviewers).toEqual(expect.arrayContaining([ids.hq, ids.dm]));
    expect(reviewers).not.toContain(ids.otherDm);
    expect(reviewers).not.toContain(ids.disabledHq);
    expect(reviewers).not.toContain(ids.ddm);
  });
});
