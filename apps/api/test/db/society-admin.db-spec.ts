/**
 * V5 PR 3 database tests: the national grade queue (D22/D22r), responsible
 * staff and assignments (D05/D05a), creating a society with its 25 Exco
 * members (D05n/D05c) and Exco dates of birth. Every record is fictional and
 * removed afterwards.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

const CATEGORIES = [
  ...Array(3).fill('CHILDREN'),
  ...Array(3).fill('YOUTH'),
  ...Array(3).fill('MOTHERS'),
  ...Array(9).fill('ORDINARY'),
  ...Array(7).fill('ELDERS_COUNCIL'),
] as const;

/** 25 valid seats; the first three are the office bearers. */
function council() {
  return CATEGORIES.map((seatType, index) => ({
    seatNumber: index + 1,
    fullName: `Fictional Member ${index + 1}`,
    position: ['President', 'Secretary', 'Treasurer'][index] ?? 'Member',
    seatType,
    dateOfBirth:
      seatType === 'CHILDREN'
        ? '2016-05-01'
        : seatType === 'YOUTH'
          ? '2006-05-01'
          : '1970-05-01',
    profession: 'Farmer',
    addressLine: 'Fictional Lane',
    isActive: true,
    isPrimaryContact: index === 0,
  }));
}

describe('V5 society admin and grade queue (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const districtId = randomUUID();
  const otherDistrictId = randomUUID();
  const societyId = randomUUID();
  const outsideId = randomUUID();
  const createdSocieties: string[] = [];
  const ids = {
    hq: randomUUID(),
    dm: randomUUID(),
    ddm: randomUUID(),
    spc: randomUUID(),
    spc2: randomUUID(),
    so: randomUUID(),
    so2: randomUUID(),
    farSpc: randomUUID(),
  };
  const tokens: Record<keyof typeof ids, string> = {} as never;

  const call = (
    method: 'get' | 'post' | 'put',
    path: string,
    token: string,
    body?: object,
  ) => {
    const req = request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);
    return body ? req.send(body) : req;
  };

  beforeAll(async () => {
    process.env.NIC_ENCRYPTION_KEY = '22'.repeat(32);
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
        { id: districtId, code: `A${suffix}`, nameEn: `Admin ${suffix}` },
        { id: otherDistrictId, code: `B${suffix}`, nameEn: `Far ${suffix}` },
      ],
    });
    await db.society.createMany({
      data: [
        {
          id: societyId,
          societyCode: `SA-${suffix}`,
          nameEn: 'Fictional Admin Society',
          districtId,
          grade: 'B',
          memberCount: 100,
        },
        {
          id: outsideId,
          societyCode: `SB-${suffix}`,
          nameEn: 'Fictional Far Society',
          districtId: otherDistrictId,
        },
      ],
    });
    const account = (
      id: string,
      role: string,
      opts: { districtId?: string; societyIds?: string[] } = {},
    ) => ({
      id,
      username: `admin.${role.toLowerCase()}.${id.slice(0, 6)}`,
      displayName: `Test ${role}`,
      phone: '+94000000000',
      role,
      status: 'ACTIVE',
      passwordHash: passwordHash('test-password-123'),
      districtId: opts.districtId ?? null,
      societyIds: opts.societyIds ?? [],
    });
    await db.platformAccount.createMany({
      data: [
        account(ids.hq, 'HQ_ADMIN'),
        account(ids.dm, 'DISTRICT_MANAGER', { districtId }),
        account(ids.ddm, 'DEPUTY_DISTRICT_MANAGER', {
          districtId,
          societyIds: [societyId],
        }),
        account(ids.spc, 'PROGRAMME_COORDINATOR', {
          districtId,
          societyIds: [societyId],
        }),
        account(ids.spc2, 'PROGRAMME_COORDINATOR', { districtId }),
        account(ids.so, 'SOCIETY_OFFICER', {
          districtId,
          societyIds: [societyId],
        }),
        account(ids.so2, 'SOCIETY_OFFICER', {
          districtId,
          societyIds: [outsideId],
        }),
        account(ids.farSpc, 'PROGRAMME_COORDINATOR', {
          districtId: otherDistrictId,
          societyIds: [outsideId],
        }),
      ],
    });
    for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
      const username = (
        await db.platformAccount.findUniqueOrThrow({ where: { id: ids[key] } })
      ).username;
      const login = await request(app.getHttpServer())
        .post('/api/v1/identity/login')
        .send({ username, password: 'test-password-123' })
        .expect(201);
      tokens[key] = login.body.token;
    }
  });

  afterAll(async () => {
    if (db) {
      const societies = [societyId, outsideId, ...createdSocieties];
      await db.platformAuditEvent.deleteMany({
        where: {
          OR: [
            { societyId: { in: societies } },
            { actorId: { in: Object.values(ids) } },
          ],
        },
      });
      await db.gradeChangeRequest.deleteMany({
        where: { societyId: { in: societies } },
      });
      await db.platformAccount.deleteMany({
        where: { id: { in: Object.values(ids) } },
      });
      await db.society.deleteMany({ where: { id: { in: societies } } });
      await db.district.deleteMany({
        where: { id: { in: [districtId, otherDistrictId] } },
      });
    }
    await app?.close();
  });

  it('D22/D22r: only HQ sees the national queue, with counts and grade history', async () => {
    const sent = await call(
      'post',
      `/societies/${societyId}/grade-requests`,
      tokens.spc,
      {
        toGrade: 'A',
        reason: 'Fictional: Exco re-formed and plan complete',
      },
    ).expect(201);
    await call('get', '/grade-requests', tokens.spc).expect(403);
    await call('get', '/grade-requests', tokens.dm).expect(403);
    await call('get', `/grade-requests/${sent.body.id}`, tokens.so).expect(403);

    const queue = await call('get', '/grade-requests', tokens.hq).expect(200);
    expect(queue.headers['cache-control']).toBe('no-store');
    expect(queue.body.summary.waiting).toBeGreaterThanOrEqual(1);
    const row = queue.body.data.find(
      (item: { id: string }) => item.id === sent.body.id,
    );
    expect(row).toMatchObject({
      fromGrade: 'B',
      toGrade: 'A',
      status: 'PENDING',
      society: { name: 'Fictional Admin Society' },
    });

    await call(
      'post',
      `/societies/${societyId}/grade-requests/${sent.body.id}/decision`,
      tokens.hq,
      {
        decision: 'APPROVE',
        comment: 'Strong record',
      },
    ).expect(200);
    const approved = await call(
      'get',
      '/grade-requests?status=APPROVED',
      tokens.hq,
    ).expect(200);
    expect(
      approved.body.data.some(
        (item: { id: string }) => item.id === sent.body.id,
      ),
    ).toBe(true);
    expect(approved.body.summary.approvedThisMonth).toBeGreaterThanOrEqual(1);
    await call('get', '/grade-requests?status=NOPE', tokens.hq).expect(400);

    const detail = await call(
      'get',
      `/grade-requests/${sent.body.id}`,
      tokens.hq,
    ).expect(200);
    expect(detail.body.society).toMatchObject({ grade: 'A', memberCount: 100 });
    expect(
      detail.body.history.map((event: { kind: string }) => event.kind),
    ).toEqual(['APPROVED', 'REQUESTED']);
  });

  it('D05: the record lists DM, DDM, SPC and Society Officer in that order', async () => {
    const record = await call(
      'get',
      `/societies/${societyId}`,
      tokens.so,
    ).expect(200);
    expect(record.body.staff.map((row: { role: string }) => row.role)).toEqual([
      'DISTRICT_MANAGER',
      'DEPUTY_DISTRICT_MANAGER',
      'PROGRAMME_COORDINATOR',
      'SOCIETY_OFFICER',
    ]);
    expect(JSON.stringify(record.body.staff)).not.toMatch(
      /phone|password|username/,
    );
  });

  it('D05a: only HQ assigns staff from the same district; changes sign people out', async () => {
    const body = {
      deputyId: ids.ddm,
      coordinatorId: ids.spc2,
      officerId: ids.so2,
    };
    await call(
      'put',
      `/societies/${societyId}/assignments`,
      tokens.dm,
      body,
    ).expect(403);
    await call(
      'get',
      `/societies/${societyId}/staff-options`,
      tokens.spc,
    ).expect(403);
    await call('put', `/societies/${societyId}/assignments`, tokens.hq, {
      ...body,
      coordinatorId: ids.farSpc,
    }).expect(400);
    await call('put', `/societies/${societyId}/assignments`, tokens.hq, {
      ...body,
      coordinatorId: ids.so,
    }).expect(400);

    const options = await call(
      'get',
      `/societies/${societyId}/staff-options`,
      tokens.hq,
    ).expect(200);
    expect(
      options.body.coordinators.map((row: { id: string }) => row.id).sort(),
    ).toEqual([ids.spc, ids.spc2].sort());

    await call(
      'put',
      `/societies/${societyId}/assignments`,
      tokens.hq,
      body,
    ).expect(200);
    const after = await db.platformAccount.findMany({
      where: { id: { in: [ids.spc, ids.spc2, ids.so, ids.so2] } },
    });
    const by = (id: string) => after.find((row) => row.id === id)!.societyIds;
    expect(by(ids.spc)).not.toContain(societyId);
    expect(by(ids.spc2)).toEqual([societyId]);
    // A Society Officer looks after one society, so the new one moves here.
    expect(by(ids.so2)).toEqual([societyId]);
    expect(by(ids.so)).toEqual([]);
    await call('get', '/identity/me', tokens.spc).expect(401);
    await call('get', '/identity/me', tokens.so2).expect(401);
    await call('get', '/identity/me', tokens.ddm).expect(200);
  });

  it('D05n/D05c: HQ creates a society with 25 Exco members and office bearers', async () => {
    const base = {
      societyCode: `SN-${suffix}`,
      nameEn: 'Fictional New Society',
      districtId,
      dsDivision: 'Fictional DS',
      addressLine: 'Fictional Road',
      memberCount: 164,
      grade: 'C',
      council: council(),
    };
    // The DM still has a session; the SPC was signed out by the assignment test.
    await call('post', '/societies', tokens.dm, base).expect(403);
    const short = await call('post', '/societies', tokens.hq, {
      ...base,
      council: council().slice(0, 24),
    }).expect(400);
    expect(JSON.stringify(short.body)).toContain('exactly 25 Exco members');
    const noPresident = council().map((member) =>
      member.position === 'President'
        ? { ...member, position: 'Member' }
        : member,
    );
    await call('post', '/societies', tokens.hq, {
      ...base,
      council: noPresident,
    }).expect(400);
    const duplicate = await call('post', '/societies', tokens.hq, {
      ...base,
      societyCode: `SA-${suffix}`,
    }).expect(409);
    expect(duplicate.body.error.message).toContain(
      'is already used by Fictional Admin Society',
    );

    const withNic = council().map((member, index) =>
      index === 0 ? { ...member, nic: '199012345678' } : member,
    );
    const created = await call('post', '/societies', tokens.hq, {
      ...base,
      council: withNic,
    }).expect(201);
    createdSocieties.push(created.body.id);
    const society = await db.society.findUniqueOrThrow({
      where: { id: created.body.id },
      include: { councilMembers: true },
    });
    expect(society).toMatchObject({
      grade: 'C',
      status: 'ACTIVE',
      memberCount: 164,
    });
    expect(society.councilMembers).toHaveLength(25);
    const president = society.councilMembers.find(
      (member) => member.seatNumber === 1,
    )!;
    expect(president.nicLastFour).toBe('5678');
    expect(president.nicCiphertext).not.toContain('199012345678');
    const audit = await db.platformAuditEvent.findMany({
      where: { societyId: created.body.id },
    });
    expect(JSON.stringify(audit)).not.toContain('199012345678');

    const record = await call(
      'get',
      `/societies/${created.body.id}`,
      tokens.hq,
    ).expect(200);
    const seat = record.body.committee.find(
      (member: { seatNumber: number }) => member.seatNumber === 4,
    );
    expect(seat).toMatchObject({
      dateOfBirth: '2006-05-01',
      profession: 'Farmer',
      addressLine: 'Fictional Lane',
    });
    expect(seat.age).toBeGreaterThanOrEqual(19);
  });

  it('Exco dates of birth must not be in the future', async () => {
    const future = council().map((member, index) =>
      index === 10 ? { ...member, dateOfBirth: '2999-01-01' } : member,
    );
    await call('put', `/societies/${societyId}/council`, tokens.hq, {
      members: future,
    }).expect(400);
  });

  it('D24: the log is scoped, filterable, names people and never shows NICs', async () => {
    const all = await call('get', '/identity/audit?days=30', tokens.hq).expect(
      200,
    );
    const created = all.body.data.find(
      (row: { action: string; detail: string }) =>
        row.action === 'SOCIETY_CREATED' && row.detail.includes(`SN-${suffix}`),
    );
    expect(created).toMatchObject({
      type: 'SOCIETY',
      actor: { displayName: 'Test HQ_ADMIN', role: 'HQ_ADMIN' },
      scope: 'Fictional New Society',
    });
    expect(JSON.stringify(all.body)).not.toContain('199012345678');

    const grades = await call(
      'get',
      '/identity/audit?type=GRADE',
      tokens.hq,
    ).expect(200);
    expect(grades.body.data.length).toBeGreaterThan(0);
    expect(
      grades.body.data.every((row: { type: string }) => row.type === 'GRADE'),
    ).toBe(true);

    const search = await call(
      'get',
      `/identity/audit?q=SN-${suffix}`,
      tokens.hq,
    ).expect(200);
    expect(search.body.data.length).toBeGreaterThan(0);
    expect(
      search.body.data.every(
        (row: { scope: string }) => row.scope === 'Fictional New Society',
      ),
    ).toBe(true);

    // A DM sees only their district: never the far district's society.
    const dm = await call('get', '/identity/audit', tokens.dm).expect(200);
    expect(
      dm.body.data.some(
        (row: { scope: string }) => row.scope === 'Fictional Far Society',
      ),
    ).toBe(false);
    await call('get', '/identity/audit?type=NOPE', tokens.hq).expect(400);
  });
});
