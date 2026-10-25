/**
 * Database tests for approval-time registry updates. Uses its own fictional
 * society (DEMO-REG-001, in the fictional North district) and resets its
 * registry rows before every test. Submissions cannot be deleted (append-only
 * history), so fixtures are titled "reg-test <runId>" and closed afterwards.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import type { MembershipCategory } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { SubmissionTypeValue } from '../../src/submissions/dto/submission.dto.js';
import { resolveRegistryChanges } from '../../src/submissions/registry-fields.js';
import { SubmissionsRepository } from '../../src/submissions/submissions.repository.js';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL is required for database tests');
if (!['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('Database tests only run against a local PostgreSQL');
}

const NORTH = {
  id: '29000000-0000-4000-8000-000000000001',
  code: 'DEMO-N',
  nameEn: 'Fictional North District',
};
const REG = {
  id: '29000000-0000-4000-8000-000000000191',
  societyCode: 'DEMO-REG-001',
  nameEn: 'Example Registry Test Society',
  districtId: NORTH.id,
  status: 'ACTIVE' as const,
};

const OFFICER = { id: 'demo-officer-sunrise', name: 'Demo Officer (Example Sunrise Society)' };
const MANAGER = { id: 'demo-dm-north', name: 'Demo District Manager (Fictional North District)' };
const OTHER_MANAGER = { id: 'demo-dm-central', name: 'Demo District Manager (Fictional Central District)' };
const HQ = { id: 'demo-hq-admin', name: 'Demo HQ Administrator' };

const OPEN_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'RESUBMITTED'] as const;

type Change = { field: string; previousValue?: unknown; proposedValue: unknown };

describe('Approval applies changes to the society registry (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repo: SubmissionsRepository;
  let storageDir: string;
  const created: string[] = [];
  const runId = randomUUID().slice(0, 8);

  const society = () => prisma.society.findUniqueOrThrow({ where: { id: REG.id } });
  const seat = (seatNumber: number) =>
    prisma.societyCouncilMember.findUniqueOrThrow({
      where: { societyId_seatNumber: { societyId: REG.id, seatNumber } },
    });
  const count = (year: number, category: MembershipCategory) =>
    prisma.societyMembershipCount.findUniqueOrThrow({
      where: { societyId_year_category: { societyId: REG.id, year, category } },
    });
  const submission = (id: string) => prisma.submission.findUniqueOrThrow({ where: { id } });
  const events = (id: string) => prisma.submissionEvent.findMany({ where: { submissionId: id } });
  const audit = (id: string) => prisma.auditLogEntry.findMany({ where: { entityId: id } });

  const approve = (id: string, user: string, version = 3) =>
    request(app.getHttpServer())
      .post(`/api/v1/submissions/${id}/approve`)
      .set('X-Demo-User', user)
      .send({ version });

  /** Still UNDER_REVIEW at version 3 with no approval history. */
  async function expectSubmissionUnchanged(id: string) {
    expect(await submission(id)).toMatchObject({ status: 'UNDER_REVIEW', version: 3 });
    expect(await events(id)).toHaveLength(2); // SUBMIT, START_REVIEW
    expect(await audit(id)).toHaveLength(3); // CREATED, SUBMIT, START_REVIEW
  }

  async function underReview(type: SubmissionTypeValue, changes: Change[]) {
    const { id } = await repo.create({
      societyId: REG.id,
      type,
      title: `reg-test ${runId}`,
      actor: OFFICER,
      changes: changes.map((item) => ({ ...item, label: item.field })),
    });
    created.push(id);
    await repo.transition({ id, version: 1, from: 'DRAFT', to: 'SUBMITTED', action: 'SUBMIT', actor: OFFICER });
    await repo.transition({ id, version: 2, from: 'SUBMITTED', to: 'UNDER_REVIEW', action: 'START_REVIEW', actor: MANAGER });
    return id; // version 3
  }

  async function resetRegistry() {
    await prisma.society.update({
      where: { id: REG.id },
      data: {
        nameEn: REG.nameEn,
        nameLocal: null,
        districtId: NORTH.id,
        status: 'ACTIVE',
        village: 'Old Village',
        addressLine: '1 Test Road',
        dsDivision: 'Test DS',
        gnDivision: 'Test GN',
        latitude: 6.9,
        longitude: 79.8,
        establishedOn: new Date('2010-05-20T00:00:00.000Z'),
      },
    });
    await prisma.societyCouncilMember.deleteMany({ where: { societyId: REG.id } });
    await prisma.societyCouncilMember.createMany({
      data: [
        {
          societyId: REG.id, seatNumber: 1, fullName: 'Fictional Chair', position: 'Chairperson',
          seatType: 'ORDINARY', phone: '0110000001', email: 'chair@example.test', age: 40,
          appointedOn: new Date('2024-01-10T00:00:00.000Z'), isActive: true, isPrimaryContact: false,
        },
        {
          societyId: REG.id, seatNumber: 2, fullName: 'Fictional Secretary', position: 'Secretary',
          seatType: 'ORDINARY', phone: '0110000002', email: 'secretary@example.test', age: 35,
          appointedOn: new Date('2023-05-01T00:00:00.000Z'),
          endedOn: new Date('2025-05-01T00:00:00.000Z'), isActive: false, isPrimaryContact: false,
        },
      ],
    });
    await prisma.societyMembershipCount.deleteMany({ where: { societyId: REG.id } });
    await prisma.societyMembershipCount.createMany({
      data: [
        { societyId: REG.id, year: 2026, category: 'CHILDREN', female: 10, male: 12 },
        { societyId: REG.id, year: 2026, category: 'YOUTH', female: 8, male: 9 },
      ],
    });
  }

  const closeFixtures = (ids: string[]) =>
    prisma.submission.updateMany({
      where: { id: { in: ids }, status: { in: [...OPEN_STATUSES] } },
      data: { status: 'REJECTED' },
    });

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'sc46-registry-db-'));
    process.env['LOCAL_STORAGE_DIR'] = storageDir;
    process.env['STORAGE_SIGNING_SECRET'] = 'db-test-only-secret';

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    repo = app.get(SubmissionsRepository);

    await prisma.district.upsert({ where: { id: NORTH.id }, create: NORTH, update: {} });
    await prisma.society.upsert({ where: { id: REG.id }, create: REG, update: {} });
    await prisma.submission.updateMany({
      where: { title: { startsWith: 'reg-test ' }, status: { in: [...OPEN_STATUSES] } },
      data: { status: 'REJECTED' },
    });
  });

  beforeEach(resetRegistry);
  afterEach(async () => {
    await closeFixtures(created);
  });
  afterAll(async () => {
    if (prisma) await closeFixtures(created);
    await app?.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it('applies an approved profile update and records it, without touching system fields', async () => {
    const before = await society();
    const id = await underReview('PROFILE_UPDATE', [
      { field: 'profile.village', previousValue: 'Old Village', proposedValue: 'New Village' },
      { field: 'profile.latitude', previousValue: 6.9, proposedValue: 7.1 },
      { field: 'profile.longitude', previousValue: 79.8, proposedValue: 79.9 },
      { field: 'profile.establishedOn', previousValue: '2010-05-20', proposedValue: '2011-06-01' },
    ]);

    await approve(id, MANAGER.id).expect(200);

    const after = await society();
    expect(after).toMatchObject({ village: 'New Village', latitude: 7.1, longitude: 79.9 });
    expect(after.establishedOn?.toISOString().slice(0, 10)).toBe('2011-06-01');
    expect(after).toMatchObject({
      id: before.id,
      societyCode: before.societyCode,
      districtId: before.districtId,
      status: before.status,
      addressLine: before.addressLine,
    });
    expect(await submission(id)).toMatchObject({ status: 'APPROVED', version: 4 });
    expect((await events(id)).map((e) => e.action).sort((a, b) => a.localeCompare(b))).toEqual([
      'APPROVE',
      'START_REVIEW',
      'SUBMIT',
    ]);
    const entry = (await audit(id)).find((e) => e.action === 'SUBMISSION_APPROVE');
    expect(entry?.metadata).toMatchObject({
      registryChanges: expect.arrayContaining([
        { field: 'profile.village', from: 'Old Village', to: 'New Village' },
      ]),
    });
  });

  it('applies the corrected value when one was provided', async () => {
    const id = await underReview('PROFILE_UPDATE', [
      { field: 'profile.village', previousValue: 'Old Village', proposedValue: 'Proposed Village' },
    ]);
    await repo.transition({
      id, version: 3, from: 'UNDER_REVIEW', to: 'CHANGES_REQUESTED', action: 'REQUEST_CHANGES', actor: MANAGER,
      fieldUpdates: [{ field: 'profile.village', data: { correctionStatus: 'REQUIRED', reviewerComment: 'Check spelling' } }],
    });
    await repo.transition({
      id, version: 4, from: 'CHANGES_REQUESTED', to: 'RESUBMITTED', action: 'RESUBMIT', actor: OFFICER,
      fieldUpdates: [{ field: 'profile.village', data: { correctionStatus: 'CORRECTED', correctedValue: 'Corrected Village' } }],
    });
    await repo.transition({ id, version: 5, from: 'RESUBMITTED', to: 'UNDER_REVIEW', action: 'START_REVIEW', actor: MANAGER });

    await approve(id, MANAGER.id, 6).expect(200);

    expect((await society()).village).toBe('Corrected Village');
  });

  it('applies approved council changes to the right seats and leaves personal data alone', async () => {
    const id = await underReview('COUNCIL_UPDATE', [
      { field: 'council.1.fullName', previousValue: 'Fictional Chair', proposedValue: 'Fictional Chair Two' },
      { field: 'council.1.position', previousValue: 'Chairperson', proposedValue: 'Vice Chairperson' },
      { field: 'council.2.endedOn', previousValue: '2025-05-01', proposedValue: '2026-05-01' },
    ]);

    await approve(id, MANAGER.id).expect(200);

    expect(await seat(1)).toMatchObject({
      fullName: 'Fictional Chair Two',
      position: 'Vice Chairperson',
      phone: '0110000001',
      email: 'chair@example.test',
      age: 40,
      seatType: 'ORDINARY',
      isActive: true,
      isPrimaryContact: false,
    });
    expect((await seat(2)).endedOn?.toISOString().slice(0, 10)).toBe('2026-05-01');
    expect((await seat(2)).fullName).toBe('Fictional Secretary');
  });

  it('applies approved membership counts to existing rows only', async () => {
    const id = await underReview('MEMBERSHIP_COUNTS', [
      { field: 'membership.2026.CHILDREN.female', previousValue: 10, proposedValue: 15 },
      { field: 'membership.2026.CHILDREN.male', previousValue: 12, proposedValue: 13 },
    ]);

    await approve(id, MANAGER.id).expect(200);

    expect(await count(2026, 'CHILDREN')).toMatchObject({ female: 15, male: 13 });
    expect(await count(2026, 'YOUTH')).toMatchObject({ female: 8, male: 9 });
  });

  it('lets an HQ administrator approve across districts', async () => {
    const id = await underReview('PROFILE_UPDATE', [
      { field: 'profile.village', previousValue: 'Old Village', proposedValue: 'HQ Approved Village' },
    ]);
    await approve(id, HQ.id).expect(200);
    expect((await society()).village).toBe('HQ Approved Village');
  });

  it('does not touch the registry for out-of-scope users or officers', async () => {
    const id = await underReview('PROFILE_UPDATE', [
      { field: 'profile.village', previousValue: 'Old Village', proposedValue: 'Should Not Apply' },
    ]);
    const before = await society();

    await approve(id, OTHER_MANAGER.id).expect(404);
    await approve(id, OFFICER.id).expect(403);
    await approve(id, 'demo-officer-lotus').expect(403);
    await approve(id, 'demo-programme-coordinator').expect(403);

    expect(await society()).toEqual(before);
    await expectSubmissionUnchanged(id);
  });

  const unsupported: [SubmissionTypeValue, string, unknown][] = [
    ['PROFILE_UPDATE', 'profile.status', 'SUSPENDED'],
    ['PROFILE_UPDATE', 'profile.districtId', '29000000-0000-4000-8000-000000000002'],
    ['PROFILE_UPDATE', 'profile.societyCode', 'DEMO-HACK'],
    ['PROFILE_UPDATE', 'profile.primaryContact.phone', '0110000099'],
    ['COUNCIL_UPDATE', 'council.1.phone', '0110000099'],
    ['COUNCIL_UPDATE', 'council.1.email', 'changed@example.test'],
    ['COUNCIL_UPDATE', 'council.1.age', 41],
    ['COUNCIL_UPDATE', 'council.1.seatType', 'YOUTH'],
    ['COUNCIL_UPDATE', 'council.1.isPrimaryContact', true],
  ];
  it.each(unsupported)('rejects %s field %s at approval and changes nothing', async (type, field, value) => {
    // Written straight to the repository to simulate a record stored before the allowlist.
    const valid: Change =
      type === 'PROFILE_UPDATE'
        ? { field: 'profile.village', previousValue: 'Old Village', proposedValue: 'Should Not Apply' }
        : { field: 'council.1.fullName', previousValue: 'Fictional Chair', proposedValue: 'Should Not Apply' };
    const id = await underReview(type, [valid, { field, previousValue: null, proposedValue: value }]);
    const beforeSociety = await society();
    const beforeSeat = await seat(1);

    await approve(id, MANAGER.id).expect(400);

    expect(await society()).toEqual(beforeSociety);
    expect(await seat(1)).toEqual(beforeSeat);
    await expectSubmissionUnchanged(id);
  });

  it('returns 409 and writes nothing when a value changed since the submission', async () => {
    const id = await underReview('PROFILE_UPDATE', [
      { field: 'profile.village', previousValue: 'Old Village', proposedValue: 'New Village' },
      { field: 'profile.addressLine', previousValue: 'Some Other Address', proposedValue: '2 New Road' },
    ]);
    const before = await society();

    const res = await approve(id, MANAGER.id).expect(409);

    expect(JSON.stringify(res.body)).toContain('profile.addressLine');
    expect(await society()).toEqual(before);
    await expectSubmissionUnchanged(id);
  });

  it('returns 409 when the registry was edited directly after the submission', async () => {
    const id = await underReview('PROFILE_UPDATE', [
      { field: 'profile.village', previousValue: 'Old Village', proposedValue: 'New Village' },
    ]);
    await prisma.society.update({ where: { id: REG.id }, data: { village: 'Edited Directly' } });

    await approve(id, MANAGER.id).expect(409);

    expect((await society()).village).toBe('Edited Directly');
    await expectSubmissionUnchanged(id);
  });

  it('returns 409 when previousValue is missing but the registry holds a value', async () => {
    const id = await underReview('PROFILE_UPDATE', [
      { field: 'profile.village', proposedValue: 'New Village' },
    ]);
    await approve(id, MANAGER.id).expect(409);
    expect((await society()).village).toBe('Old Village');
    await expectSubmissionUnchanged(id);
  });

  it('rolls back an earlier registry write when a later step of the approval fails', async () => {
    const id = await underReview('COUNCIL_UPDATE', [
      { field: 'council.1.fullName', previousValue: 'Fictional Chair', proposedValue: 'Rolled Back Name' },
      { field: 'council.3.fullName', previousValue: null, proposedValue: 'No Such Seat' },
    ]);

    await approve(id, MANAGER.id).expect(400); // seat 3 does not exist, after seat 1 was updated

    expect((await seat(1)).fullName).toBe('Fictional Chair');
    await expectSubmissionUnchanged(id);
  });

  it('rolls the registry back when the history write fails after the registry was updated', async () => {
    const id = await underReview('PROFILE_UPDATE', [
      { field: 'profile.village', previousValue: 'Old Village', proposedValue: 'Rolled Back Village' },
    ]);
    const changes = resolveRegistryChanges('PROFILE_UPDATE', [
      { field: 'profile.village', previousValue: 'Old Village', proposedValue: 'Rolled Back Village', correctedValue: null },
    ]);

    // The 1,001-character comment overflows VARCHAR(1000) on the event insert,
    // which runs after the registry update and the status change.
    await expect(
      repo.transition({
        id, version: 3, from: 'UNDER_REVIEW', to: 'APPROVED', action: 'APPROVE', actor: MANAGER,
        comment: 'x'.repeat(1001),
        registry: { societyId: REG.id, changes },
      }),
    ).rejects.toThrow();

    expect((await society()).village).toBe('Old Village');
    await expectSubmissionUnchanged(id);
  });

  it('does not create membership records for a new year', async () => {
    const id = await underReview('MEMBERSHIP_COUNTS', [
      { field: 'membership.2027.CHILDREN.female', previousValue: null, proposedValue: 5 },
    ]);
    await approve(id, MANAGER.id).expect(400);
    expect(await prisma.societyMembershipCount.count({ where: { societyId: REG.id, year: 2027 } })).toBe(0);
    await expectSubmissionUnchanged(id);
  });

  it('keeps latitude and longitude together', async () => {
    await prisma.society.update({ where: { id: REG.id }, data: { latitude: null, longitude: null } });
    const id = await underReview('PROFILE_UPDATE', [
      { field: 'profile.latitude', previousValue: null, proposedValue: 7.1 },
    ]);
    await approve(id, MANAGER.id).expect(400);
    expect((await society()).latitude).toBeNull();
    await expectSubmissionUnchanged(id);
  });

  it('rejects a council end date before the start date', async () => {
    const id = await underReview('COUNCIL_UPDATE', [
      { field: 'council.2.endedOn', previousValue: '2025-05-01', proposedValue: '2020-01-01' },
    ]);
    await approve(id, MANAGER.id).expect(400);
    expect((await seat(2)).endedOn?.toISOString().slice(0, 10)).toBe('2025-05-01');
    await expectSubmissionUnchanged(id);
  });

  it('keeps activity reports record-only', async () => {
    const before = await society();
    const id = await underReview('ACTIVITY_REPORT', [
      { field: 'activity.title', previousValue: null, proposedValue: 'Fictional clean-up day' },
    ]);
    await approve(id, MANAGER.id).expect(200);
    expect(await society()).toEqual(before);
    expect(await submission(id)).toMatchObject({ status: 'APPROVED' });
  });
});
