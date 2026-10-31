import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { GradeChangesService } from '../../src/societies/grade-changes.service.js';
import type { Principal } from '../../src/auth/principal.js';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl || !['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('Grade-change database tests require a local PostgreSQL DATABASE_URL');
}

describe('grade change persistence and decisions (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let gradeChanges: GradeChangesService;
  const districtId = randomUUID();
  const societyId = randomUUID();
  const requester: Principal = { id: 'demo-officer-sunrise', displayName: 'Fictional Test Officer', roles: ['SOCIETY_OFFICER'], districtIds: [districtId], societyIds: [societyId] };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    gradeChanges = app.get(GradeChangesService);
    await prisma.district.create({ data: { id: districtId, code: `T${districtId.slice(0, 8)}`, nameEn: `Fictional grade-test district ${districtId.slice(0, 8)}` } });
    await prisma.society.create({ data: { id: societyId, societyCode: `GRADE-${societyId.slice(0, 8)}`, nameEn: 'Fictional Grade Test Society', districtId, grade: 'C' } });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.notification.deleteMany({ where: { societyId } });
      await prisma.societyAuditEvent.deleteMany({ where: { societyId } });
      await prisma.gradeChangeRequest.deleteMany({ where: { societyId } });
      await prisma.society.deleteMany({ where: { id: societyId } });
      await prisma.district.deleteMany({ where: { id: districtId } });
    }
    await app?.close();
  });

  it('persists requests, approves a grade change, records history, and rejects non-HQ decisions', async () => {
    const requestRow = await gradeChanges.create(societyId, { proposedGrade: 'B', rationale: 'Fictional records meet the published criteria.' }, requester);
    expect(requestRow).toMatchObject({ societyId, currentGrade: 'C', proposedGrade: 'B', status: 'PENDING' });
    expect(await prisma.gradeChangeRequest.count({ where: { societyId, status: 'PENDING' } })).toBe(1);
    expect(await prisma.societyAuditEvent.count({ where: { societyId, eventType: 'GRADE_CHANGE_REQUESTED' } })).toBe(1);

    await request(app.getHttpServer()).post(`/api/v1/grade-changes/${requestRow.id}/decision`).set('X-Demo-User', 'demo-dm-north').send({ decision: 'APPROVED', comment: 'This is not an HQ decision.' }).expect(403);
    const queue = await request(app.getHttpServer()).get('/api/v1/grade-changes?status=PENDING').set('X-Demo-User', 'demo-hq-admin').expect(200);
    expect(queue.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: requestRow.id, societyId, status: 'PENDING' })]));
    await request(app.getHttpServer()).post(`/api/v1/grade-changes/${requestRow.id}/decision`).set('X-Demo-User', 'demo-hq-admin').send({ decision: 'APPROVED', comment: 'Fictional evidence checked and accepted.' }).expect(201);
    expect((await prisma.society.findUniqueOrThrow({ where: { id: societyId } })).grade).toBe('B');
    expect(await prisma.societyAuditEvent.count({ where: { societyId, eventType: 'GRADE_CHANGE_APPROVED' } })).toBe(1);

    const next = await gradeChanges.create(societyId, { proposedGrade: 'A', rationale: 'A second fictional criteria review supports an increase.' }, requester);
    await request(app.getHttpServer()).post(`/api/v1/grade-changes/${next.id}/decision`).set('X-Demo-User', 'demo-hq-admin').send({ decision: 'REJECTED', comment: 'Submitted evidence does not support the requested grade.' }).expect(201);
    expect((await prisma.society.findUniqueOrThrow({ where: { id: societyId } })).grade).toBe('B');
    expect(await prisma.societyAuditEvent.count({ where: { societyId, eventType: 'GRADE_CHANGE_REJECTED' } })).toBe(1);
  });
});
