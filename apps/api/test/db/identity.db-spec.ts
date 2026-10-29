import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

describe('V4 identity, scoped access and NIC vault (PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService, hqToken: string;
  const districtId = randomUUID(),
    otherDistrictId = randomUUID(),
    societyId = randomUUID(),
    neighbourId = randomUUID(),
    outsiderId = randomUUID(),
    memberId = randomUUID();
  const suffix = randomUUID().slice(0, 8),
    hqId = randomUUID();
  const accounts: string[] = [hqId];
  const post = (path: string, body: object, token?: string) =>
    request(app.getHttpServer())
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token ?? hqToken}`)
      .send(body);
  async function create(role: string, assigned: string[]) {
    const username = `test.${role.toLowerCase()}.${suffix}`;
    const invitation = await post('/identity/accounts', {
      username,
      displayName: `Test ${role}`,
      phone: '+94000000001',
      role,
      districtId,
      societyIds: assigned,
      method: 'LINK',
    }).expect(201);
    accounts.push(invitation.body.account.id);
    await post('/identity/activation/complete', {
      credential: invitation.body.credential,
      password: 'test-password-123',
    }).expect(201);
    const login = await post('/identity/login', {
      username,
      password: 'test-password-123',
    }).expect(201);
    return {
      id: invitation.body.account.id,
      token: login.body.token as string,
      credential: invitation.body.credential,
    };
  }
  beforeAll(async () => {
    process.env.NIC_ENCRYPTION_KEY = '11'.repeat(32);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    db = app.get(PrismaService);
    await db.district.createMany({
      data: [
        { id: districtId, code: `T${suffix}`, nameEn: `Test ${suffix}` },
        { id: otherDistrictId, code: `O${suffix}`, nameEn: `Other ${suffix}` },
      ],
    });
    await db.society.createMany({
      data: [
        {
          id: societyId,
          societyCode: `S1-${suffix}`,
          nameEn: 'Assigned society',
          districtId,
        },
        {
          id: neighbourId,
          societyCode: `S2-${suffix}`,
          nameEn: 'District neighbour',
          districtId,
        },
        {
          id: outsiderId,
          societyCode: `S3-${suffix}`,
          nameEn: 'Outside society',
          districtId: otherDistrictId,
        },
      ],
    });
    await db.societyCouncilMember.create({
      data: {
        id: memberId,
        societyId: neighbourId,
        seatNumber: 1,
        fullName: 'Fictional Member',
        position: 'Member',
        seatType: 'ORDINARY',
      },
    });
    await db.platformAccount.create({
      data: {
        id: hqId,
        username: `hq.${suffix}`,
        displayName: 'Test HQ',
        role: 'HQ_ADMIN',
        phone: '+94000000000',
        status: 'ACTIVE',
        passwordHash: passwordHash('test-password-123'),
      },
    });
    const login = await post(
      '/identity/login',
      { username: `hq.${suffix}`, password: 'test-password-123' },
      '',
    ).expect(201);
    hqToken = login.body.token;
  });
  afterAll(async () => {
    if (db) {
      await db.districtAccessGrant.deleteMany({ where: { districtId } });
      await db.platformAuditEvent.deleteMany({
        where: {
          OR: [
            { actorId: { in: accounts } },
            { districtId: { in: [districtId, otherDistrictId] } },
          ],
        },
      });
      await db.platformAccount.deleteMany({ where: { id: { in: accounts } } });
      await db.society.deleteMany({
        where: { id: { in: [societyId, neighbourId, outsiderId] } },
      });
      await db.district.deleteMany({
        where: { id: { in: [districtId, otherDistrictId] } },
      });
    }
    await app?.close();
  });
  it('enforces activation, scopes, temporary district read, NIC audit and session revocation', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/identity/scope-options')
      .set('Authorization', `Bearer ${hqToken}`)
      .expect(200);
    const so = await create('SOCIETY_OFFICER', [societyId]);
    const spc = await create('PROGRAMME_COORDINATOR', [societyId]);
    const ddm = await create('DEPUTY_DISTRICT_MANAGER', [societyId]);
    const dm = await create('DISTRICT_MANAGER', []);
    await request(app.getHttpServer()).get('/api/v1/societies').expect(401);
    await post('/identity/activation/complete', {
      credential: so.credential,
      password: 'another-password-123',
    }).expect(410);
    const list = await request(app.getHttpServer())
      .get('/api/v1/societies')
      .set('Authorization', `Bearer ${so.token}`)
      .expect(200);
    expect(list.body.data.map((s: { id: string }) => s.id)).toEqual([
      societyId,
    ]);
    await request(app.getHttpServer())
      .get(`/api/v1/societies/${outsiderId}`)
      .set('Authorization', `Bearer ${so.token}`)
      .expect(404);
    for (const actor of [spc, ddm])
      await request(app.getHttpServer())
        .patch(`/api/v1/societies/${societyId}/profile`)
        .set('Authorization', `Bearer ${actor.token}`)
        .send({ addressLine: 'Test update' })
        .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/societies/${societyId}/profile`)
      .set('Authorization', `Bearer ${dm.token}`)
      .send({ addressLine: 'Forbidden' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/identity/accounts')
      .set('Authorization', `Bearer ${so.token}`)
      .expect(403);
    const granted = await post(
      '/identity/district-access',
      {
        deputyId: ddm.id,
        districtId,
        startsAt: new Date(Date.now() - 1000).toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        reason: 'Manager absence',
      },
      dm.token,
    ).expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/societies/${neighbourId}`)
      .set('Authorization', `Bearer ${ddm.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/societies/${neighbourId}/profile`)
      .set('Authorization', `Bearer ${ddm.token}`)
      .send({ addressLine: 'Forbidden' })
      .expect(403);
    await db.districtAccessGrant.update({
      where: { id: granted.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/societies/${neighbourId}`)
      .set('Authorization', `Bearer ${ddm.token}`)
      .expect(404);
    await db.districtAccessGrant.update({
      where: { id: granted.body.id },
      data: { expiresAt: new Date(Date.now() + 3600000) },
    });
    await request(app.getHttpServer())
      .put(`/api/v1/societies/${neighbourId}/council/${memberId}/nic`)
      .set('Authorization', `Bearer ${hqToken}`)
      .send({ nic: '199012345678' })
      .expect(200);
    const encrypted = await db.societyCouncilMember.findUniqueOrThrow({
      where: { id: memberId },
    });
    expect(encrypted.nicCiphertext).not.toContain('199012345678');
    const revealed = await post(
      `/societies/${neighbourId}/council/${memberId}/nic/reveal`,
      {},
      ddm.token,
    ).expect(201);
    expect(revealed.body.nic).toBe('199012345678');
    expect(revealed.headers['cache-control']).toBe('no-store');
    await post(
      `/societies/${neighbourId}/council/${memberId}/nic/reveal`,
      {},
      so.token,
    ).expect(404);
    await post(
      `/identity/district-access/${granted.body.id}/revoke`,
      {},
      dm.token,
    ).expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/societies/${neighbourId}`)
      .set('Authorization', `Bearer ${ddm.token}`)
      .expect(404);
    const audit = await db.platformAuditEvent.findMany({
      where: { action: 'MEMBER_NIC_REVEALED', targetId: memberId },
    });
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain('199012345678');
    await post(`/identity/accounts/${spc.id}/invitation`, {
      method: 'LINK',
    }).expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/identity/me')
      .set('Authorization', `Bearer ${spc.token}`)
      .expect(401);
    await post(`/identity/accounts/${so.id}/disable`, {}).expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/identity/me')
      .set('Authorization', `Bearer ${so.token}`)
      .expect(401);
  });
});
