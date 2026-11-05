/**
 * Issue #96 database tests: the SarvoAI spending ledger against a real PostgreSQL with the
 * migrations applied, with a fake model so nothing reaches AWS. Spending tests use months
 * far in the future, so they never touch real figures; everything is removed afterwards.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AppModule } from '../../src/app.module.js';
import {
  modelPrices,
  reservationMicroUsd,
} from '../../src/assistant/assistant-cost.js';
import {
  ASSISTANT_MODEL,
  type ModelRequest,
} from '../../src/assistant/assistant-model.js';
import {
  AssistantSpendingService,
  SpendingLimitReachedException,
} from '../../src/assistant/assistant-spending.service.js';
import { AssistantService } from '../../src/assistant/assistant.service.js';
import type { Principal } from '../../src/auth/principal.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

const MODEL = 'global.anthropic.claude-haiku-5-5';
const call = {
  max_tokens: 8000,
  messages: [{ role: 'user', content: 'Fictional question' }],
} as ModelRequest;
const amount = reservationMicroUsd(
  call,
  modelPrices(MODEL, undefined, undefined),
);
const usd = (microUsd: bigint) => (Number(microUsd) / 1_000_000).toFixed(6);
const usage = { input_tokens: 1000, output_tokens: 500 } as Anthropic.Usage;
const usageCost = 100n + 250n;

describe('SarvoAI spending limit (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let secondInstanceDb: PrismaService;
  const model = { modelId: MODEL, createMessage: vi.fn() };
  const suffix = randomUUID().slice(0, 8);
  const hqId = randomUUID();
  const managerId = randomUUID();
  const districtId = randomUUID();
  const tokens: Record<string, string> = {};
  const hq: Principal = {
    id: hqId,
    displayName: 'Fictional HQ',
    roles: ['HQ_ADMIN'],
    districtIds: [],
    societyIds: [],
  };
  let monthNumber = 0;

  /** A new month for each test, so they cannot see each other's spending. */
  const newMonth = () => {
    monthNumber += 1;
    return new Date(
      Date.UTC(2090 + Math.floor(monthNumber / 12), monthNumber % 12, 15, 6),
    );
  };
  const monthOf = (now: Date) => now.toISOString().slice(0, 7);
  const ledger = (limitUsd: string, prisma = db) =>
    new AssistantSpendingService(prisma, {
      get: (key: string) =>
        key === 'SARVOAI_MONTHLY_LIMIT_USD' ? limitUsd : undefined,
    } as unknown as ConfigService);
  const committed = async (now: Date) =>
    (
      await db.assistantMonthlySpend.findUnique({
        where: { month: monthOf(now) },
      })
    )?.committedMicroUsd ?? null;

  beforeAll(async () => {
    process.env.SARVOAI_ENABLED = 'false';
    process.env.DATABASE_CONNECTION_LIMIT = '8';
    process.env.SARVOAI_MONTHLY_LIMIT_USD = '0';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ASSISTANT_MODEL)
      .useValue(model)
      .compile();
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
    // A second database pool stands in for a second API instance.
    secondInstanceDb = new PrismaService(app.get(ConfigService));
    await secondInstanceDb.$connect();

    await db.district.create({
      data: {
        id: districtId,
        code: `L${suffix}`,
        nameEn: `Fictional limit ${suffix}`,
      },
    });
    await db.platformAccount.createMany({
      data: [
        {
          id: hqId,
          username: `spend.hq.${suffix}`,
          displayName: 'Fictional HQ',
          role: 'HQ_ADMIN',
          phone: '+94000000000',
          status: 'ACTIVE',
          passwordHash: passwordHash('test-password-123'),
        },
        {
          id: managerId,
          username: `spend.dm.${suffix}`,
          displayName: 'Fictional DM',
          role: 'DISTRICT_MANAGER',
          districtId,
          phone: '+94000000001',
          status: 'ACTIVE',
          passwordHash: passwordHash('test-password-123'),
        },
      ],
    });
    for (const [key, username] of [
      ['hq', `spend.hq.${suffix}`],
      ['dm', `spend.dm.${suffix}`],
    ]) {
      const login = await request(app.getHttpServer())
        .post('/api/v1/identity/login')
        .send({ username, password: 'test-password-123' })
        .expect(201);
      tokens[key] = login.body.token;
    }
  });

  beforeEach(() => model.createMessage.mockReset());

  afterAll(async () => {
    if (db) {
      await db.assistantSpendReservation.deleteMany({
        where: { month: { gte: '2090-01' } },
      });
      await db.assistantMonthlySpend.deleteMany({
        where: { month: { gte: '2090-01' } },
      });
      await db.platformAuditEvent.deleteMany({
        where: { actorId: { in: [hqId, managerId] } },
      });
      await db.platformAccount.deleteMany({
        where: { id: { in: [hqId, managerId] } },
      });
      await db.district.deleteMany({ where: { id: districtId } });
    }
    await secondInstanceDb?.$disconnect();
    await app?.close();
    delete process.env.DATABASE_CONNECTION_LIMIT;
    delete process.env.SARVOAI_MONTHLY_LIMIT_USD;
  });

  it('reserves below the limit, then settles to the actual cost', async () => {
    const now = newMonth();
    const spending = ledger('20');
    const reservation = await spending.reserve(MODEL, call, now);
    expect(await committed(now)).toBe(amount);
    expect(
      await db.assistantSpendReservation.findUnique({
        where: { id: reservation.id },
      }),
    ).toMatchObject({
      status: 'RESERVED',
      reservedMicroUsd: amount,
      modelId: MODEL,
    });

    await spending.settle(reservation, {
      ...usage,
      cache_read_input_tokens: 1000,
      cache_creation_input_tokens: 1000,
    } as Anthropic.Usage);

    const cost = usageCost + 10n + 125n;
    expect(await committed(now)).toBe(cost);
    expect(
      await db.assistantSpendReservation.findUnique({
        where: { id: reservation.id },
      }),
    ).toMatchObject({
      status: 'SETTLED',
      actualMicroUsd: cost,
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 1000,
      cacheWriteTokens: 1000,
    });
  });

  it('allows a call that lands exactly on the limit and refuses the next', async () => {
    const now = newMonth();
    const spending = ledger(usd(amount * 2n));
    await spending.reserve(MODEL, call, now);
    await spending.reserve(MODEL, call, now);
    await expect(spending.reserve(MODEL, call, now)).rejects.toThrow(
      SpendingLimitReachedException,
    );
    expect(await committed(now)).toBe(amount * 2n);
    expect(
      await db.assistantSpendReservation.count({
        where: { month: monthOf(now) },
      }),
    ).toBe(2);
  });

  it('refuses when even one call is over the limit, leaving no records', async () => {
    const now = newMonth();
    await expect(ledger('0').reserve(MODEL, call, now)).rejects.toThrow(
      SpendingLimitReachedException,
    );
    expect(await committed(now)).toBeNull();
    await expect(
      ledger(usd(amount - 1n)).reserve(MODEL, call, now),
    ).rejects.toThrow(SpendingLimitReachedException);
    expect(await committed(now)).toBeNull();
  });

  it('never passes the limit under simultaneous requests from two API instances', async () => {
    const now = newMonth();
    const first = ledger(usd(amount * 5n));
    const second = ledger(usd(amount * 5n), secondInstanceDb);
    const results = await Promise.allSettled(
      Array.from({ length: 40 }, (_, index) =>
        (index % 2 ? first : second).reserve(MODEL, call, now),
      ),
    );
    const refused = results.filter((result) => result.status === 'rejected');
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(5);
    expect(refused).toHaveLength(35);
    for (const result of refused)
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(
        SpendingLimitReachedException,
      );
    expect(await committed(now)).toBe(amount * 5n);
    expect(
      await db.assistantSpendReservation.count({
        where: { month: monthOf(now) },
      }),
    ).toBe(5);
  });

  it('keeps the money for a timeout, a dropped connection or a server error', async () => {
    const now = newMonth();
    const spending = ledger('20');
    const failures = [
      new Error('Request timed out.'),
      Object.assign(new Error('Connection error.'), { status: undefined }),
      Object.assign(new Error('Server error'), { status: 503 }),
    ];
    for (const failure of failures)
      await spending.failed(await spending.reserve(MODEL, call, now), failure);
    expect(await committed(now)).toBe(amount * 3n);
    expect(
      await db.assistantSpendReservation.count({
        where: { month: monthOf(now), status: 'UNCERTAIN' },
      }),
    ).toBe(3);
  });

  it('frees the money only when the provider definitely refused the call', async () => {
    const now = newMonth();
    const spending = ledger('20');
    const kept = await spending.reserve(MODEL, call, now);
    await spending.failed(
      await spending.reserve(MODEL, call, now),
      Object.assign(new Error('Throttled'), { status: 429 }),
    );
    await spending.failed(
      await spending.reserve(MODEL, call, now),
      Object.assign(new Error('Denied'), { status: 403 }),
    );
    expect(await committed(now)).toBe(amount);
    expect(
      await db.assistantSpendReservation.count({
        where: { month: monthOf(now), status: 'RELEASED', actualMicroUsd: 0n },
      }),
    ).toBe(2);
    expect(
      (
        await db.assistantSpendReservation.findUnique({
          where: { id: kept.id },
        })
      )?.status,
    ).toBe('RESERVED');
  });

  it('counts a call whose response had no usable token counts at the full reservation', async () => {
    const now = newMonth();
    const spending = ledger('20');
    await spending.settle(await spending.reserve(MODEL, call, now), undefined);
    expect(await committed(now)).toBe(amount);
    expect(
      await db.assistantSpendReservation.count({
        where: { month: monthOf(now), status: 'UNCERTAIN' },
      }),
    ).toBe(1);
  });

  it('keeps counting a reservation left open by a crashed instance', async () => {
    const now = newMonth();
    const spending = ledger(usd(amount));
    await spending.reserve(MODEL, call, now); // Never settled: the instance stopped here.
    await expect(spending.reserve(MODEL, call, now)).rejects.toThrow(
      SpendingLimitReachedException,
    );
  });

  it('applies each outcome once, whatever is repeated', async () => {
    const now = newMonth();
    const spending = ledger('20');
    const reservation = await spending.reserve(MODEL, call, now);
    await spending.settle(reservation, usage);
    await spending.settle(reservation, usage);
    await spending.failed(
      reservation,
      Object.assign(new Error('Late refusal'), { status: 400 }),
    );
    await spending.failed(reservation, new Error('Late timeout'));
    expect(await committed(now)).toBe(usageCost);
    expect(
      (
        await db.assistantSpendReservation.findUnique({
          where: { id: reservation.id },
        })
      )?.status,
    ).toBe('SETTLED');
  });

  it('charges a repeated question again, so retries cannot pass the limit', async () => {
    const now = newMonth();
    const service = app.get(AssistantService);
    const original = process.env.SARVOAI_MONTHLY_LIMIT_USD;
    process.env.SARVOAI_MONTHLY_LIMIT_USD = '0.10';
    let calls = 0;
    const realCreate = model.createMessage;
    model.createMessage = (async () => {
      calls += 1;
      throw new Error('Request timed out.');
    }) as never;
    const outcomes = [];
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const outcome = await service
        .ask(hq, 'Fictional question', [], now)
        .catch((error: unknown) => error);
      outcomes.push(outcome);
      if (outcome instanceof SpendingLimitReachedException) break;
    }
    process.env.SARVOAI_MONTHLY_LIMIT_USD = original;
    expect(outcomes.at(-1)).toBeInstanceOf(SpendingLimitReachedException);
    model.createMessage = realCreate;
    expect(calls).toBe(outcomes.length - 1);
    expect((await committed(now))!).toBeLessThanOrEqual(100_000n);
  });

  it('starts each UTC month afresh, and settles a late call against its own month', async () => {
    const spending = ledger(usd(amount));
    const lastMoment = new Date('2095-01-31T23:59:59.999Z');
    const firstMoment = new Date('2095-02-01T00:00:00.000Z');
    const january = await spending.reserve(MODEL, call, lastMoment);
    await expect(spending.reserve(MODEL, call, lastMoment)).rejects.toThrow(
      SpendingLimitReachedException,
    );

    const february = await spending.reserve(MODEL, call, firstMoment);
    expect(await committed(firstMoment)).toBe(amount);

    await spending.settle(january, usage);
    expect(await committed(lastMoment)).toBe(usageCost);
    expect(await committed(firstMoment)).toBe(amount);
    await spending.settle(february, usage);
    expect(await committed(firstMoment)).toBe(usageCost);
  });

  it('stores no prompts, answers or people in the spending records', async () => {
    const now = newMonth();
    const service = app.get(AssistantService);
    const original = process.env.SARVOAI_MONTHLY_LIMIT_USD;
    process.env.SARVOAI_MONTHLY_LIMIT_USD = '20';
    model.createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      usage,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            kind: 'ANSWER',
            summary: 'Fictional private answer',
            options: [],
          }),
        },
      ],
    });
    await service.ask(hq, 'Fictional private question', [], now);
    process.env.SARVOAI_MONTHLY_LIMIT_USD = original;

    const rows = await db.assistantSpendReservation.findMany({
      where: { month: monthOf(now) },
    });
    expect(rows).toHaveLength(1);
    const stored = JSON.stringify(rows, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    for (const text of ['Fictional private', hqId, 'Fictional HQ'])
      expect(stored).not.toContain(text);
    const columns = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name IN ('assistant_spend_reservations', 'assistant_monthly_spend')`;
    expect(columns.map((column) => column.column_name).sort()).toEqual(
      [
        'actual_micro_usd',
        'cache_read_tokens',
        'cache_write_tokens',
        'closed_at',
        'committed_micro_usd',
        'created_at',
        'id',
        'input_tokens',
        'model_id',
        'month',
        'month',
        'output_tokens',
        'reserved_micro_usd',
        'status',
        'updated_at',
      ].sort(),
    );
  });

  it('answers HQ with a clear 429 at the limit and no model call, and still refuses other roles', async () => {
    const ask = (token: string) =>
      request(app.getHttpServer())
        .post('/api/v1/assistant/questions')
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'Average profit in a fictional district?' });

    // SARVOAI_MONTHLY_LIMIT_USD is 0 here, so no real month gains a record.
    const refused = await ask(tokens.hq).expect(429);
    expect(refused.body.error).toMatchObject({ code: 'LIMIT_REACHED' });
    expect(refused.body.error.message).toContain(
      'spending limit for this month',
    );
    expect(refused.body.error.message).toContain('Reports');
    expect(model.createMessage).not.toHaveBeenCalled();

    await ask(tokens.dm).expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/assistant/questions')
      .send({ question: 'Average profit?' })
      .expect(401);
    expect(model.createMessage).not.toHaveBeenCalled();
  });

  it('refuses every call rather than guess when the limit setting is invalid', async () => {
    const original = process.env.SARVOAI_MONTHLY_LIMIT_USD;
    process.env.SARVOAI_MONTHLY_LIMIT_USD = 'plenty';
    const answer = await request(app.getHttpServer())
      .post('/api/v1/assistant/questions')
      .set('Authorization', `Bearer ${tokens.hq}`)
      .send({ question: 'Average profit in a fictional district?' });
    process.env.SARVOAI_MONTHLY_LIMIT_USD = original;
    expect(answer.status).toBe(503);
    expect(answer.body.error.message).not.toContain(
      'SARVOAI_MONTHLY_LIMIT_USD',
    );
    expect(model.createMessage).not.toHaveBeenCalled();
  });
});
