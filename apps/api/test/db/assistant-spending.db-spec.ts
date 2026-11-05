/**
 * Issue #96 database tests: the SarvoAI spending ledger against a real PostgreSQL with the
 * migrations applied, with a fake model so nothing reaches AWS. Spending tests use months
 * far in the future, so they never touch real figures; everything is removed afterwards.
 */
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AppModule } from '../../src/app.module.js';
import {
  pricingApproval,
  reservationBound,
  SpendingBlockedError,
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
const REGION = 'ap-southeast-1';
const call = {
  max_tokens: 8000,
  thinking: { type: 'disabled' },
  messages: [{ role: 'user', content: 'Fictional question' }],
} as ModelRequest;

/** Test figures only, not a reviewed price. Valid from the date given for 30 days. */
const approvalFor = (now: Date, changes: Record<string, unknown> = {}) =>
  JSON.stringify({
    modelId: MODEL,
    region: REGION,
    reviewedOn: now.toISOString().slice(0, 10),
    expiresOn: new Date(now.getTime() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10),
    source: 'https://aws.amazon.com/bedrock/pricing/',
    standard: {
      inputUsdPerMTok: '0.10',
      outputUsdPerMTok: '0.50',
      cacheWriteUsdPerMTok: '0.125',
      cacheReadUsdPerMTok: '0.01',
    },
    longPrompt: {
      aboveTokens: 100_000,
      inputUsdPerMTok: '0.50',
      outputUsdPerMTok: '2.50',
      cacheWriteUsdPerMTok: '0.625',
      cacheReadUsdPerMTok: '0.05',
    },
    ...changes,
  });
const testApproval = pricingApproval(
  approvalFor(new Date('2090-01-01T00:00:00Z')),
  { modelId: MODEL, region: REGION },
  new Date('2090-01-01T00:00:00Z'),
);
const bound = reservationBound(call, testApproval);
const amount = bound.microUsd;
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
    approvedOn = new Date(
      Date.UTC(2090 + Math.floor(monthNumber / 12), monthNumber % 12, 15, 6),
    );
    return approvedOn;
  };
  const monthOf = (now: Date) => now.toISOString().slice(0, 7);
  /** Follows the test's month, so the approval is current unless a test says otherwise. */
  let approvedOn = new Date('2090-01-01T00:00:00Z');
  const ledger = (
    limitUsd: string,
    prisma = db,
    approval?: string,
    settings: Record<string, string> = {},
  ) =>
    new AssistantSpendingService(prisma, {
      get: (key: string) =>
        ({
          SARVOAI_MONTHLY_LIMIT_USD: limitUsd,
          SARVOAI_PRICING_APPROVAL: approval ?? approvalFor(approvedOn),
          ...settings,
        })[key],
    } as unknown as ConfigService);
  const asking = async <T>(now: Date, run: () => Promise<T>, limit = '20') => {
    const original = {
      limit: process.env.SARVOAI_MONTHLY_LIMIT_USD,
      approval: process.env.SARVOAI_PRICING_APPROVAL,
    };
    process.env.SARVOAI_MONTHLY_LIMIT_USD = limit;
    process.env.SARVOAI_PRICING_APPROVAL = approvalFor(now);
    // Production reads the clock at each reservation, not at question start.
    // Give just this ledger a deterministic clock without aging HTTP sessions.
    const spending = app.get(AssistantSpendingService);
    const reserve = spending.reserve.bind(spending);
    const clock = vi.spyOn(spending, 'reserve').mockImplementation((modelId, request) => reserve(modelId, request, now));
    try {
      return await run();
    } finally {
      clock.mockRestore();
      process.env.SARVOAI_MONTHLY_LIMIT_USD = original.limit;
      if (original.approval === undefined)
        delete process.env.SARVOAI_PRICING_APPROVAL;
      else process.env.SARVOAI_PRICING_APPROVAL = original.approval;
    }
  };
  const clearHolds = () =>
    db.assistantSpendHold.deleteMany({
      where: { reservation: { month: { gte: '2090-01' } } },
    });
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
  afterEach(() => clearHolds());

  afterAll(async () => {
    if (db) {
      await clearHolds();
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
    let calls = 0;
    const realCreate = model.createMessage;
    model.createMessage = (async () => {
      calls += 1;
      throw new Error('Request timed out.');
    }) as never;
    const outcomes: unknown[] = [];
    await asking(
      now,
      async () => {
        for (let attempt = 0; attempt < 500; attempt += 1) {
          const outcome = await service
            .ask(hq, 'Fictional question', [], now)
            .catch((error: unknown) => error);
          outcomes.push(outcome);
          if (outcome instanceof SpendingLimitReachedException) break;
        }
      },
      '0.10',
    );
    model.createMessage = realCreate;
    expect(outcomes.at(-1)).toBeInstanceOf(SpendingLimitReachedException);
    expect(calls).toBe(outcomes.length - 1);
    expect((await committed(now))!).toBeLessThanOrEqual(100_000n);
  });

  it('starts each UTC month afresh, and settles a late call against its own month', async () => {
    approvedOn = new Date('2095-01-20T00:00:00Z');
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
    await asking(now, () =>
      service.ask(hq, 'Fictional private question', [], now),
    );

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
      SELECT column_name FROM information_schema.columns WHERE table_name IN ('assistant_spend_reservations', 'assistant_monthly_spend', 'assistant_spend_holds')`;
    expect(columns.map((column) => column.column_name).sort()).toEqual(
      [
        'actual_micro_usd',
        'actual_micro_usd',
        'cache_read_tokens',
        'cache_write_tokens',
        'closed_at',
        'committed_micro_usd',
        'created_at',
        'detected_at',
        'id',
        'input_tokens',
        'model_id',
        'month',
        'month',
        'output_tokens',
        'reasons',
        'reservation_id',
        'reserved_micro_usd',
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
    const refused = await asking(
      new Date(),
      async () => ask(tokens.hq).expect(429),
      '0',
    );
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

  describe('pricing approval', () => {
    const today = new Date();
    const question = (approval: string | undefined) => {
      const original = process.env.SARVOAI_PRICING_APPROVAL;
      const limit = process.env.SARVOAI_MONTHLY_LIMIT_USD;
      if (approval === undefined) delete process.env.SARVOAI_PRICING_APPROVAL;
      else process.env.SARVOAI_PRICING_APPROVAL = approval;
      process.env.SARVOAI_MONTHLY_LIMIT_USD = '20';
      return request(app.getHttpServer())
        .post('/api/v1/assistant/questions')
        .set('Authorization', `Bearer ${tokens.hq}`)
        .send({ question: 'Average profit in a fictional district?' })
        .then((answer) => {
          process.env.SARVOAI_MONTHLY_LIMIT_USD = limit;
          if (original === undefined)
            delete process.env.SARVOAI_PRICING_APPROVAL;
          else process.env.SARVOAI_PRICING_APPROVAL = original;
          return answer;
        });
    };
    const month = () => today.toISOString().slice(0, 7);
    const pastDay = new Date(today.getTime() - 40 * 86_400_000);

    it.each([
      ['missing', undefined],
      ['invalid', '{"modelId":'],
      [
        'expired',
        approvalFor(pastDay, {
          expiresOn: new Date(today.getTime() - 86_400_000)
            .toISOString()
            .slice(0, 10),
        }),
      ],
      ['for another model', approvalFor(today, { modelId: 'other.model' })],
      ['for another Region', approvalFor(today, { region: 'us-east-1' })],
    ])(
      'answers 503 with no reservation or model call when the approval is %s',
      async (_label, approval) => {
        const before = await db.assistantSpendReservation.count({
          where: { month: month() },
        });
        const answer = await question(approval);
        expect(answer.status).toBe(503);
        expect(answer.body.error.message).toContain('paused');
        expect(answer.body.error.message).not.toContain('APPROVAL');
        expect(model.createMessage).not.toHaveBeenCalled();
        expect(
          await db.assistantSpendReservation.count({
            where: { month: month() },
          }),
        ).toBe(before);
      },
    );

    it('needs a fresh review when the configured model or Region changes', async () => {
      const now = newMonth();
      const approved = approvalFor(now);
      await expect(
        ledger('20', db, approved, { SARVOAI_AWS_REGION: 'us-east-1' }).reserve(
          MODEL,
          call,
          now,
        ),
      ).rejects.toThrow('fresh review');
      await expect(
        ledger('20', db, approved).reserve(
          'apac.anthropic.claude-haiku-5-5',
          call,
          now,
        ),
      ).rejects.toThrow(SpendingBlockedError);
      expect(await committed(now)).toBeNull();

      // Reviewing the same model and Region again lets calls through.
      await ledger('20', db, approved).reserve(MODEL, call, now);
      expect(await committed(now)).toBe(amount);
    });

    it('refuses a request it cannot put a limit on, with no reservation', async () => {
      const now = newMonth();
      await expect(
        ledger('20').reserve(
          MODEL,
          { ...call, thinking: { type: 'adaptive' } } as ModelRequest,
          now,
        ),
      ).rejects.toThrow('Thinking');
      expect(await committed(now)).toBeNull();
    });
  });

  describe('maximum-cost requests', () => {
    it('settles the most expensive long, cached call within its reservation, with no hold', async () => {
      const now = newMonth();
      const spending = ledger('20');
      const long = {
        ...call,
        system: [
          {
            type: 'text',
            text: 'x'.repeat(250_000),
            cache_control: { type: 'ephemeral' },
          },
        ],
      } as ModelRequest;
      const limits = reservationBound(long, testApproval);
      const reservation = await spending.reserve(MODEL, long, now);
      expect(reservation.promptTokenBound).toBe(limits.promptTokens);
      expect(await committed(now)).toBe(limits.microUsd);

      await spending.settle(reservation, {
        input_tokens: 0,
        cache_creation_input_tokens: limits.promptTokens,
        cache_read_input_tokens: 0,
        output_tokens: 8000,
      } as Anthropic.Usage);

      expect(await db.assistantSpendHold.count()).toBe(0);
      expect((await committed(now))!).toBeLessThanOrEqual(limits.microUsd);
      expect((await committed(now))!).toBeGreaterThan(
        (BigInt(limits.promptTokens) * 625_000n) / 1_000_000n,
      );
    });

    it('refuses a single call that would cost more than the whole limit', async () => {
      const now = newMonth();
      const long = {
        ...call,
        system: 'x'.repeat(250_000),
      } as ModelRequest;
      await expect(ledger('0.10').reserve(MODEL, long, now)).rejects.toThrow(
        SpendingLimitReachedException,
      );
      expect(await committed(now)).toBeNull();
    });
  });

  describe('usage above a reservation', () => {
    const above = {
      input_tokens: bound.promptTokens + 1,
      output_tokens: 9000,
    } as Anthropic.Usage;
    const heldCost =
      (BigInt(bound.promptTokens + 1) * 100_000n + 999_999n) / 1_000_000n +
      4500n;

    it('records the full cost, warns without prompt content and stops all further calls', async () => {
      const warned = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const now = newMonth();
      const first = ledger('20');
      const reservation = await first.reserve(MODEL, call, now);
      await first.settle(reservation, above);

      expect(heldCost).toBeGreaterThan(amount);
      expect(await committed(now)).toBe(heldCost);
      expect(
        await db.assistantSpendReservation.findUnique({
          where: { id: reservation.id },
        }),
      ).toMatchObject({ status: 'SETTLED', actualMicroUsd: heldCost });
      const hold = await db.assistantSpendHold.findUnique({
        where: { reservationId: reservation.id },
      });
      expect(hold).toMatchObject({
        reasons: 'cost_above_reservation,prompt_above_bound,output_above_bound',
        reservedMicroUsd: amount,
        actualMicroUsd: heldCost,
      });
      const logged = JSON.stringify(warned.mock.calls);
      expect(logged).toContain('sarvoai_calls_held_for_review');
      expect(logged).toContain(hold!.detectedAt.toISOString());
      expect(logged).not.toContain('Fictional question');
      warned.mockRestore();

      // On another API instance, in the next month and under a new approval.
      const next = new Date(now.getTime() + 31 * 86_400_000);
      for (const [spending, at] of [
        [first, now],
        [ledger('20', secondInstanceDb), now],
        [ledger('20', db, approvalFor(next)), next],
      ] as const)
        await expect(spending.reserve(MODEL, call, at)).rejects.toThrow(
          SpendingBlockedError,
        );
      expect(await committed(next)).toBeNull();
      expect(await committed(now)).toBe(heldCost);
    });

    it('can end a month above the limit, which is recorded rather than hidden', async () => {
      const now = newMonth();
      const spending = ledger(usd(amount));
      await spending.settle(await spending.reserve(MODEL, call, now), above);
      expect((await committed(now))!).toBeGreaterThan(amount);
    });

    it('places one hold however often the outcome is repeated', async () => {
      const now = newMonth();
      const spending = ledger('20');
      const reservation = await spending.reserve(MODEL, call, now);
      await spending.settle(reservation, above);
      await spending.settle(reservation, above);
      expect(await committed(now)).toBe(heldCost);
      expect(
        await db.assistantSpendHold.count({
          where: { reservationId: reservation.id },
        }),
      ).toBe(1);
    });

    it('holds on a charge the approval does not price, counting at least the reservation', async () => {
      const now = newMonth();
      const spending = ledger('20');
      const reservation = await spending.reserve(MODEL, call, now);
      await spending.settle(reservation, {
        ...usage,
        service_tier: 'priority',
      } as Anthropic.Usage);
      expect(await committed(now)).toBe(amount);
      expect(
        (
          await db.assistantSpendHold.findUnique({
            where: { reservationId: reservation.id },
          })
        )?.reasons,
      ).toBe('service_tier');
    });

    it('holds when thinking tokens are reported although thinking was off', async () => {
      const now = newMonth();
      const spending = ledger('20');
      const reservation = await spending.reserve(MODEL, call, now);
      await spending.settle(reservation, {
        ...usage,
        output_tokens_details: { thinking_tokens: 20 },
      } as Anthropic.Usage);
      expect(
        (
          await db.assistantSpendHold.findUnique({
            where: { reservationId: reservation.id },
          })
        )?.reasons,
      ).toBe('thinking');
    });

    it('places no hold for a normal settlement, a release or an uncertain call', async () => {
      const now = newMonth();
      const spending = ledger('20');
      await spending.settle(await spending.reserve(MODEL, call, now), usage);
      await spending.failed(
        await spending.reserve(MODEL, call, now),
        Object.assign(new Error('Denied'), { status: 403 }),
      );
      await spending.failed(
        await spending.reserve(MODEL, call, now),
        new Error('Request timed out.'),
      );
      await spending.settle(
        await spending.reserve(MODEL, call, now),
        undefined,
      );
      expect(await db.assistantSpendHold.count()).toBe(0);
    });

    it('resumes only after a review covers the hold, and a later hold stops calls again', async () => {
      const now = newMonth();
      const spending = ledger('20');
      const first = await spending.reserve(MODEL, call, now);
      await spending.settle(first, above);
      const { detectedAt } = (await db.assistantSpendHold.findUnique({
        where: { reservationId: first.id },
      }))!;

      const justBefore = new Date(detectedAt.getTime() - 1).toISOString();
      await expect(
        ledger(
          '20',
          db,
          approvalFor(now, { overageReviewedThrough: justBefore }),
        ).reserve(MODEL, call, now),
      ).rejects.toThrow(SpendingBlockedError);

      const reviewed = ledger(
        '20',
        db,
        approvalFor(now, { overageReviewedThrough: detectedAt.toISOString() }),
      );
      const second = await reviewed.reserve(MODEL, call, now);

      await new Promise((resolve) => setTimeout(resolve, 5));
      await reviewed.settle(second, above);
      await expect(reviewed.reserve(MODEL, call, now)).rejects.toThrow(
        SpendingBlockedError,
      );
    });

    it('tells HQ SarvoAI is paused, with no model call, while a hold waits for review', async () => {
      const now = newMonth();
      const spending = ledger('20');
      await spending.settle(await spending.reserve(MODEL, call, now), above);
      const answer = await asking(new Date(), () =>
        request(app.getHttpServer())
          .post('/api/v1/assistant/questions')
          .set('Authorization', `Bearer ${tokens.hq}`)
          .send({ question: 'Average profit in a fictional district?' })
          .then((response) => response),
      );
      expect(answer.status).toBe(503);
      expect(answer.body.error.message).toContain('paused');
      expect(model.createMessage).not.toHaveBeenCalled();
    });

    it('keeps the question out of the logs when a service call places a hold', async () => {
      const warned = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const errors = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const now = newMonth();
      const service = app.get(AssistantService);
      model.createMessage.mockResolvedValue({
        stop_reason: 'tool_use',
        usage: { input_tokens: 5_000_000, output_tokens: 1 },
        content: [
          { type: 'tool_use', id: 'call-1', name: 'list_districts', input: {} },
        ],
      });
      const outcome = await asking(now, () =>
        service
          .ask(hq, 'Fictional private question', [], now)
          .catch((error: unknown) => error as Error),
      );
      // The model call that broke the assumptions finished; the next round was refused.
      expect(model.createMessage).toHaveBeenCalledTimes(1);
      expect((outcome as Error).message).toContain('paused');
      const logged = JSON.stringify([
        ...warned.mock.calls,
        ...errors.mock.calls,
      ]);
      expect(logged).toContain('sarvoai_calls_held_for_review');
      expect(logged).not.toContain('Fictional private question');
      warned.mockRestore();
      errors.mockRestore();
    });
  });
});
