/**
 * SarvoAI database tests: the six read-only tools against a real PostgreSQL with the
 * migrations applied, and the HQ-only endpoint. Every record here is fictional, lives in
 * its own fictional district, and is removed afterwards. No model is called.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { AssistantTools } from '../../src/assistant/assistant-tools.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { latestCompletedFinancialYear } from '../../src/societies/financial-year.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

describe('SarvoAI tools and endpoint (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let tools: AssistantTools;
  const suffix = randomUUID().slice(0, 8);
  const districtId = randomUUID();
  const district = `Fictional AI ${suffix}`;
  const year = latestCompletedFinancialYear();
  const ids = { a: randomUUID(), b: randomUUID(), c: randomUUID(), d: randomUUID(), inactive: randomUUID() };
  const code = (key: string) => `S-AI${key.toUpperCase()}${suffix}`.slice(0, 20);
  const hqId = randomUUID();
  const managerId = randomUUID();
  const tokens: Record<string, string> = {};

  const run = async (name: string, input: object) => {
    const outcome = await tools.run(name, input);
    return { ...outcome, data: outcome.isError ? undefined : JSON.parse(outcome.content) };
  };

  beforeAll(async () => {
    process.env.SARVOAI_ENABLED = 'false';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    db = app.get(PrismaService);
    tools = app.get(AssistantTools, { strict: false });

    await db.district.create({ data: { id: districtId, code: `A${suffix}`, nameEn: district } });
    await db.society.createMany({
      data: [
        { id: ids.a, societyCode: code('a'), nameEn: `Fictional Alpha ${suffix} SSS`, districtId, status: 'ACTIVE' },
        { id: ids.b, societyCode: code('b'), nameEn: `Fictional Beta ${suffix} SSS`, districtId, status: 'ACTIVE' },
        { id: ids.c, societyCode: code('c'), nameEn: `Fictional Gamma ${suffix} SSS`, districtId, status: 'ACTIVE' },
        { id: ids.d, societyCode: code('d'), nameEn: `Fictional Delta ${suffix} SSS`, districtId, status: 'ACTIVE' },
        { id: ids.inactive, societyCode: code('x'), nameEn: `Fictional Closed ${suffix} SSS`, districtId, status: 'INACTIVE' },
      ],
    });
    const summary = (societyId: string, offset: number, totalProfit: number | null, totalExpenses: number | null) => ({
      societyId,
      financialYear: year - offset,
      totalProfit,
      totalExpenses,
    });
    await db.annualFinancialSummary.createMany({
      data: [
        summary(ids.a, 2, 150_000, 500_000), summary(ids.a, 1, 120_000, 500_000), summary(ids.a, 0, 110_000, 500_000),
        summary(ids.b, 2, 400_000, 900_000), summary(ids.b, 1, 50_000, 900_000), summary(ids.b, 0, 300_000, 900_000),
        summary(ids.c, 2, 500_000, 700_000), summary(ids.c, 0, null, 700_000),
        // Inactive societies never count, whatever they recorded.
        summary(ids.inactive, 0, 9_000_000, 1),
      ],
    });
    await db.societyCouncilMember.createMany({
      data: [
        { societyId: ids.a, seatNumber: 1, fullName: 'Fictional Current President', position: 'President', seatType: 'ORDINARY',
          nicLastFour: '4321', nicCiphertext: 'not-a-real-ciphertext', phone: '+94000000009', email: 'president@example.invalid', appointedOn: new Date('2026-06-14') },
        { societyId: ids.a, seatNumber: 2, fullName: 'Fictional Former President', position: 'President', seatType: 'ORDINARY', isActive: false, endedOn: new Date('2026-06-13') },
        { societyId: ids.a, seatNumber: 3, fullName: 'Fictional Secretary', position: 'Secretary', seatType: 'ORDINARY' },
      ],
    });
    await db.platformAccount.createMany({
      data: [
        { id: hqId, username: `ai.hq.${suffix}`, displayName: 'Fictional HQ', role: 'HQ_ADMIN', phone: '+94000000000', status: 'ACTIVE', passwordHash: passwordHash('test-password-123') },
        { id: managerId, username: `ai.dm.${suffix}`, displayName: 'Fictional DM', role: 'DISTRICT_MANAGER', districtId, phone: '+94000000001', status: 'ACTIVE', passwordHash: passwordHash('test-password-123') },
      ],
    });
    for (const [key, username] of [['hq', `ai.hq.${suffix}`], ['dm', `ai.dm.${suffix}`]]) {
      const login = await request(app.getHttpServer()).post('/api/v1/identity/login').send({ username, password: 'test-password-123' }).expect(201);
      tokens[key] = login.body.token;
    }
  });

  afterAll(async () => {
    if (db) {
      const societies = Object.values(ids);
      await db.platformAuditEvent.deleteMany({ where: { actorId: { in: [hqId, managerId] } } });
      await db.platformAccount.deleteMany({ where: { id: { in: [hqId, managerId] } } });
      await db.societyCouncilMember.deleteMany({ where: { societyId: { in: societies } } });
      await db.annualFinancialSummary.deleteMany({ where: { societyId: { in: societies } } });
      await db.society.deleteMany({ where: { id: { in: societies } } });
      await db.district.deleteMany({ where: { id: districtId } });
    }
    await app?.close();
  });

  it('lists districts and finds societies by name or S number', async () => {
    expect((await run('list_districts', {})).data.districts).toContain(district);
    const byCode = await run('find_societies', { query: code('a') });
    expect(byCode.data.matches).toEqual([expect.objectContaining({ societyCode: code('a'), district, status: 'ACTIVE' })]);
    const byName = await run('find_societies', { query: `Beta ${suffix}` });
    expect(byName.data.matches.map((match: { name: string }) => match.name)).toEqual([`Fictional Beta ${suffix} SSS`]);
  });

  it('finds the current president without NICs, phone numbers or emails', async () => {
    const outcome = await run('get_exco_member', { societyCode: code('a'), position: 'president' });
    expect(outcome.data.members).toEqual([{ name: 'Fictional Current President', position: 'President', appointedOn: '2026-06-14' }]);
    const everything = JSON.stringify(outcome);
    for (const secret of ['4321', 'not-a-real-ciphertext', '+94000000009', 'president@example.invalid', 'Fictional Former President'])
      expect(everything).not.toContain(secret);
  });

  it('averages yearly profit over recorded figures only, and leaves out inactive and missing ones', async () => {
    const outcome = await run('summarize_yearly_figure', { financialYear: year, metric: 'profit', district });
    expect(outcome.data).toMatchObject({ activeSocieties: 4, included: 2, excludedNotAdded: 2, averagePerSociety: 205_000, total: 410_000 });
    expect(outcome.answer?.scope).toMatchObject({ district, currency: 'LKR', societiesIncluded: 2, societiesExcluded: 2 });
    expect(outcome.answer?.table?.rows).toEqual([
      [`Fictional Beta ${suffix} SSS`, district, 300_000],
      [`Fictional Alpha ${suffix} SSS`, district, 110_000],
    ]);
  });

  it('applies each, any and combined profit thresholds over several years', async () => {
    const above = (mode: string, amountLkr: number) =>
      run('societies_above_profit', { amountLkr, fromYear: year - 2, toYear: year, mode, district });
    const names = (outcome: Awaited<ReturnType<typeof above>>) => outcome.data.matches.map((match: { name: string }) => match.name.split(' ')[1]).sort();

    const each = await above('each', 100_000);
    expect(names(each)).toEqual(['Alpha']);
    expect(each.data).toMatchObject({ checked: 2, excludedMissingYears: 2 });
    expect(names(await above('any', 100_000))).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(names(await above('combined', 500_000))).toEqual(['Beta']);
  });

  it('lists active societies missing yearly figures', async () => {
    const outcome = await run('societies_missing_yearly_figures', { financialYear: year, district });
    expect(outcome.data.missingCount).toBe(2);
    expect(outcome.answer?.table?.rows.map((row) => [row[0], row[3]])).toEqual([
      [`Fictional Delta ${suffix} SSS`, 'Profit and expenses'],
      [`Fictional Gamma ${suffix} SSS`, 'Profit'],
    ]);
  });

  it('turns bad input into a message for the model instead of an error', async () => {
    const unknownDistrict = await run('summarize_yearly_figure', { financialYear: year, metric: 'profit', district: `Nowhere ${suffix}` });
    expect(unknownDistrict.isError).toBe(true);
    expect(unknownDistrict.content).toContain(district);
    expect((await run('summarize_yearly_figure', { financialYear: year + 1, metric: 'profit', district })).isError).toBe(true);
    expect((await run('summarize_yearly_figure', { financialYear: year, metric: 'share capital', district })).isError).toBe(true);
  });

  it('keeps the endpoint HQ-only and answers 503 while SarvoAI is switched off', async () => {
    const ask = (token: string) =>
      request(app.getHttpServer()).post('/api/v1/assistant/questions').set('Authorization', `Bearer ${token}`).send({ question: 'Average profit in Kurunegala?' });
    await ask(tokens.dm).expect(403);
    await ask(tokens.hq).expect(503);
    await request(app.getHttpServer()).post('/api/v1/assistant/questions').send({ question: 'Average profit?' }).expect(401);
  });
});
