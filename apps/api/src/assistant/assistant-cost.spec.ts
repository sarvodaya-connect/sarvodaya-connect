import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import {
  actualMicroUsd,
  assertBillableRequest,
  definitelyNotBilled,
  monthlyLimitMicroUsd,
  nextSpendingMonth,
  pricingApproval,
  reservationBound,
  SpendingBlockedError,
  spendingMonth,
  unpricedBilling,
  usageCounts,
} from './assistant-cost.js';
import type { ModelRequest } from './assistant-model.js';

const MODEL = 'global.anthropic.claude-haiku-5-5';
const REGION = 'ap-southeast-1';
const now = new Date('2026-11-15T06:00:00Z');
const expected = { modelId: MODEL, region: REGION };

/** Test figures only, not a reviewed price. Cache write is the dearest input price. */
const approvalFields = (changes: Record<string, unknown> = {}) => ({
  modelId: MODEL,
  region: REGION,
  reviewedOn: '2026-11-10',
  expiresOn: '2026-12-10',
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
const approve = (changes: Record<string, unknown> = {}) =>
  pricingApproval(JSON.stringify(approvalFields(changes)), expected, now);
const approval = approve();

const request = (text: string, max_tokens = 8000) =>
  ({
    max_tokens,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: text }],
  }) as ModelRequest;

describe('SarvoAI spending limit setting', () => {
  it('defaults to USD 20 and reads plain dollar amounts', () => {
    expect(monthlyLimitMicroUsd(undefined)).toBe(20_000_000n);
    expect(monthlyLimitMicroUsd('  ')).toBe(20_000_000n);
    expect(monthlyLimitMicroUsd('12.50')).toBe(12_500_000n);
  });

  it('accepts zero, which refuses every call', () => {
    expect(monthlyLimitMicroUsd('0')).toBe(0n);
  });

  it.each([
    '-1',
    'abc',
    '20 USD',
    '1e3',
    'NaN',
    'Infinity',
    '20,5',
    '1000.01',
    '999999',
  ])('refuses %s rather than running without a limit', (value) => {
    expect(() => monthlyLimitMicroUsd(value)).toThrow(SpendingBlockedError);
  });
});

describe('SarvoAI pricing approval', () => {
  it('reads every reviewed price', () => {
    expect(approval.standard).toEqual({
      input: 100_000n,
      output: 500_000n,
      cacheWrite: 125_000n,
      cacheRead: 10_000n,
    });
    expect(approval.longPrompt.output).toBe(2_500_000n);
    expect(approval.aboveTokens).toBe(100_000);
    expect(approval.overageReviewedThrough).toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['empty', '  '],
    ['not JSON', 'approved'],
    ['not an object', '[]'],
  ])('refuses an approval that is %s', (_label, raw) => {
    expect(() => pricingApproval(raw, expected, now)).toThrow(
      SpendingBlockedError,
    );
  });

  it.each([
    ['an unknown field', { reviewdOn: '2026-11-10' }],
    ['no review date', { reviewedOn: undefined }],
    ['an impossible date', { reviewedOn: '2026-02-30' }],
    ['a review date in the future', { reviewedOn: '2026-11-16' }],
    ['no expiry', { expiresOn: undefined }],
    ['a loosely written expiry', { expiresOn: 'December 2026' }],
    ['more than 31 days', { expiresOn: '2026-12-12' }],
    ['no source', { source: undefined }],
    ['an unofficial source', { source: 'https://example.com/prices' }],
    ['a look-alike source', { source: 'https://aws.amazon.com.example.com/' }],
    [
      'an insecure source',
      { source: 'http://aws.amazon.com/bedrock/pricing/' },
    ],
    [
      'a missing output price',
      {
        standard: { ...approvalFields().standard, outputUsdPerMTok: undefined },
      },
    ],
    [
      'a price of zero',
      { standard: { ...approvalFields().standard, inputUsdPerMTok: '0' } },
    ],
    [
      'a price written as a number',
      { standard: { ...approvalFields().standard, inputUsdPerMTok: 0.1 } },
    ],
    [
      'a negative price',
      { standard: { ...approvalFields().standard, cacheReadUsdPerMTok: '-1' } },
    ],
    ['no long-prompt prices', { longPrompt: undefined }],
    [
      'no long-prompt threshold',
      {
        longPrompt: { ...approvalFields().longPrompt, aboveTokens: undefined },
      },
    ],
    [
      'long-prompt prices below the standard ones',
      {
        longPrompt: {
          ...approvalFields().longPrompt,
          outputUsdPerMTok: '0.40',
        },
      },
    ],
    ['an unreadable overage review', { overageReviewedThrough: 'last week' }],
    [
      'an overage review in the future',
      { overageReviewedThrough: '2026-11-15T06:00:00.001Z' },
    ],
  ])('refuses an approval with %s', (_label, changes) => {
    expect(() => approve(changes)).toThrow(SpendingBlockedError);
  });

  it('stops at 00:00 UTC on the expiry date', () => {
    const raw = JSON.stringify(approvalFields());
    expect(() =>
      pricingApproval(raw, expected, new Date('2026-12-09T23:59:59.999Z')),
    ).not.toThrow();
    expect(() =>
      pricingApproval(raw, expected, new Date('2026-12-10T00:00:00.000Z')),
    ).toThrow('expired');
  });

  it.each([
    ['a different model', { modelId: 'global.anthropic.claude-haiku-5-6' }],
    [
      'a different inference profile',
      { modelId: 'apac.anthropic.claude-haiku-5-5' },
    ],
    ['a different Region', { region: 'us-east-1' }],
  ])('needs a fresh review for %s', (_label, changes) => {
    expect(() => approve(changes)).toThrow('fresh review');
  });

  it('refuses an unsupported model even with a matching approval', () => {
    const other = 'apac.anthropic.claude-haiku-5-5';
    expect(() =>
      pricingApproval(
        JSON.stringify(approvalFields({ modelId: other })),
        { modelId: other, region: REGION },
        now,
      ),
    ).toThrow('no reviewed billing rules');
  });
});

describe('what the reservation can put a limit on', () => {
  const withBlocks = (content: unknown) =>
    ({
      max_tokens: 100,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content }],
    }) as ModelRequest;

  it('accepts text, tool calls, a 5-minute cache and custom tools', () => {
    expect(() =>
      assertBillableRequest({
        max_tokens: 8000,
        thinking: { type: 'disabled' },
        system: [
          { type: 'text', text: 'Rules', cache_control: { type: 'ephemeral' } },
        ],
        tools: [{ name: 'a', input_schema: { type: 'object' } }],
        output_config: { effort: 'medium' },
        messages: [
          { role: 'user', content: 'Question' },
          {
            role: 'assistant',
            content: [{ type: 'tool_use', id: '1', name: 'a', input: {} }],
          },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: '1', content: '{}' }],
          },
        ],
      } as ModelRequest),
    ).not.toThrow();
  });

  it.each([
    ['thinking left at its default', { thinking: undefined }],
    ['adaptive thinking', { thinking: { type: 'adaptive' } }],
    [
      'budgeted thinking',
      { thinking: { type: 'enabled', budget_tokens: 1024 } },
    ],
    ['the priority or flexible tier', { service_tier: 'auto' }],
    ['fast mode', { speed: 'fast' }],
    ['a data-residency option', { inference_geo: 'us' }],
    ['a request-wide cache', { cache_control: { type: 'ephemeral' } }],
    ['an effort that needs thinking', { output_config: { effort: 'max' } }],
    ['no output allowance', { max_tokens: 0 }],
    ['a fractional output allowance', { max_tokens: 1.5 }],
    [
      'a server tool',
      { tools: [{ type: 'web_search_20260209', name: 'web_search' }] },
    ],
    [
      'a long-lived cache',
      {
        system: [
          {
            type: 'text',
            text: 'Rules',
            cache_control: { type: 'ephemeral', ttl: '1h' },
          },
        ],
      },
    ],
  ])('refuses %s', (_label, changes) => {
    expect(() =>
      assertBillableRequest({ ...request('Q'), ...changes } as ModelRequest),
    ).toThrow(SpendingBlockedError);
  });

  it.each([
    ['an image', { type: 'image', source: {} }],
    ['a document', { type: 'document', source: {} }],
    ['replayed thinking', { type: 'thinking', thinking: '', signature: 's' }],
    ['redacted thinking', { type: 'redacted_thinking', data: 'd' }],
    [
      'an image in a tool result',
      {
        type: 'tool_result',
        tool_use_id: '1',
        content: [{ type: 'image', source: {} }],
      },
    ],
  ])('refuses %s in the messages', (_label, block) => {
    expect(() => assertBillableRequest(withBlocks([block]))).toThrow(
      SpendingBlockedError,
    );
  });
});

describe('the most a call can cost', () => {
  const tokensOf = (req: ModelRequest) =>
    reservationBound(req, approval).promptTokens;

  it('covers a call that uses every estimated token at the dearest price', () => {
    const req = request('x'.repeat(4000));
    const bound = reservationBound(req, approval);
    const heaviest = actualMicroUsd(
      {
        inputTokens: 0,
        cacheWriteTokens: bound.promptTokens,
        cacheReadTokens: 0,
        outputTokens: 8000,
      },
      approval,
    );
    expect(bound.microUsd).toBeGreaterThanOrEqual(heaviest);
  });

  it('covers any mix of input, cache and output, rounding included', () => {
    const req = request('x'.repeat(100));
    const bound = reservationBound(req, approval);
    const third = Math.floor(bound.promptTokens / 3);
    expect(bound.microUsd).toBeGreaterThanOrEqual(
      actualMicroUsd(
        {
          inputTokens: third,
          cacheWriteTokens: bound.promptTokens - 2 * third,
          cacheReadTokens: third,
          outputTokens: 8000,
        },
        approval,
      ),
    );
  });

  it('uses whichever input price is dearest, even if the cache write is not', () => {
    const dearInput = approve({
      standard: {
        inputUsdPerMTok: '3',
        outputUsdPerMTok: '1',
        cacheWriteUsdPerMTok: '1',
        cacheReadUsdPerMTok: '0.1',
      },
      longPrompt: {
        aboveTokens: 100_000,
        inputUsdPerMTok: '3',
        outputUsdPerMTok: '1',
        cacheWriteUsdPerMTok: '1',
        cacheReadUsdPerMTok: '0.1',
      },
    });
    const req = request('x'.repeat(4000), 1);
    const tokens = BigInt(reservationBound(req, dearInput).promptTokens);
    expect(reservationBound(req, dearInput).microUsd).toBeGreaterThanOrEqual(
      tokens * 3n,
    );
  });

  it('counts the whole request, including the answer format, tools and system prompt', () => {
    const plain = request('Q');
    const schema = { type: 'object', description: 'y'.repeat(5000) };
    const withFormat = {
      ...plain,
      output_config: { format: { type: 'json_schema', schema } },
    } as ModelRequest;
    const withTools = {
      ...plain,
      tools: [{ name: 'a', input_schema: schema }],
    } as ModelRequest;
    const withSystem = { ...plain, system: 'y'.repeat(5000) } as ModelRequest;
    for (const req of [withFormat, withTools, withSystem])
      expect(tokensOf(req) - tokensOf(plain)).toBeGreaterThanOrEqual(5000);
  });

  it('counts non-Latin text by its bytes', () => {
    expect(tokensOf(request('කුරුණෑගල'.repeat(100)))).toBeGreaterThan(
      tokensOf(request('a'.repeat(800))),
    );
  });

  it('uses the long-prompt prices for a request estimated above the threshold', () => {
    const justUnder = reservationBound(
      request('x'.repeat(98_000), 1),
      approval,
    );
    const justOver = reservationBound(
      request('x'.repeat(100_000), 1),
      approval,
    );
    expect(justUnder.promptTokens).toBeLessThanOrEqual(100_000);
    expect(justOver.promptTokens).toBeGreaterThan(100_000);
    expect(justOver.microUsd).toBeGreaterThan(4n * justUnder.microUsd);
  });

  it('covers the largest long prompt at the long-prompt output price', () => {
    const req = request('x'.repeat(200_000));
    const bound = reservationBound(req, approval);
    expect(bound.microUsd).toBeGreaterThanOrEqual(
      actualMicroUsd(
        {
          inputTokens: 0,
          cacheWriteTokens: bound.promptTokens,
          cacheReadTokens: 0,
          outputTokens: 8000,
        },
        approval,
      ),
    );
    // About 201,000 tokens at USD 0.625 and 8,000 at USD 2.50 per million.
    expect(bound.microUsd).toBeGreaterThan(145_000n);
  });
});

describe('SarvoAI cost estimates', () => {
  const usage = {
    inputTokens: 100_001,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 1000,
  };

  it('moves the whole call to the long-prompt prices above the threshold', () => {
    expect(actualMicroUsd(usage, approval)).toBe(50_001n + 2500n);
    expect(actualMicroUsd({ ...usage, inputTokens: 100_000 }, approval)).toBe(
      10_000n + 500n,
    );
  });

  it('counts cached tokens towards the threshold', () => {
    expect(
      actualMicroUsd(
        { ...usage, inputTokens: 1, cacheReadTokens: 100_000 },
        approval,
      ),
    ).toBe(1n + 5000n + 2500n);
  });

  it('prices cached input and rounds up', () => {
    expect(
      actualMicroUsd(
        {
          inputTokens: 1000,
          cacheWriteTokens: 1000,
          cacheReadTokens: 1000,
          outputTokens: 1000,
        },
        approval,
      ),
    ).toBe(100n + 125n + 10n + 500n);
    expect(
      actualMicroUsd(
        {
          inputTokens: 1,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
          outputTokens: 0,
        },
        approval,
      ),
    ).toBe(1n);
  });

  it('does not trust missing or impossible token counts', () => {
    expect(usageCounts(undefined)).toBeUndefined();
    expect(
      usageCounts({ input_tokens: -1, output_tokens: 5 } as never),
    ).toBeUndefined();
    expect(usageCounts({ input_tokens: 5 } as never)).toBeUndefined();
    expect(
      usageCounts({
        input_tokens: 5,
        output_tokens: 6,
        cache_read_input_tokens: 'many',
      } as never),
    ).toBeUndefined();
    expect(
      usageCounts({
        input_tokens: 5,
        output_tokens: 6,
        cache_read_input_tokens: null,
      } as never),
    ).toEqual({
      inputTokens: 5,
      outputTokens: 6,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
  });

  it('notices charges the approved prices do not cover', () => {
    const reported = (fields: object) =>
      unpricedBilling({
        input_tokens: 1,
        output_tokens: 1,
        ...fields,
      } as Anthropic.Usage);
    expect(unpricedBilling(undefined)).toEqual([]);
    expect(
      reported({
        service_tier: 'standard',
        speed: 'standard',
        cache_creation: { ephemeral_1h_input_tokens: 0 },
        server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
        output_tokens_details: { thinking_tokens: 0 },
      }),
    ).toEqual([]);
    expect(reported({ service_tier: 'priority' })).toEqual(['service_tier']);
    expect(reported({ speed: 'fast' })).toEqual(['speed']);
    expect(
      reported({ cache_creation: { ephemeral_1h_input_tokens: 5 } }),
    ).toEqual(['long_lived_cache']);
    expect(reported({ server_tool_use: { web_search_requests: 1 } })).toEqual([
      'server_tools',
    ]);
    expect(
      reported({ output_tokens_details: { thinking_tokens: 12 } }),
    ).toEqual(['thinking']);
  });
});

describe('the spending month', () => {
  it('is the UTC calendar month, including across a Sri Lanka midnight', () => {
    expect(spendingMonth(new Date('2026-11-30T23:59:59.999Z'))).toBe('2026-11');
    expect(spendingMonth(new Date('2026-12-01T00:00:00.000Z'))).toBe('2026-12');
    expect(spendingMonth(new Date('2026-11-30T19:00:00.000Z'))).toBe('2026-11');
  });

  it('rolls over at the end of a year', () => {
    expect(
      nextSpendingMonth(new Date('2026-12-15T00:00:00Z')).toISOString(),
    ).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('deciding whether a failed call was billed', () => {
  it.each([400, 401, 403, 404, 413, 422, 429])(
    'frees the money only after a definite refusal such as %i',
    (status) => {
      expect(definitelyNotBilled({ status })).toBe(true);
    },
  );

  it.each([
    ['a timeout', new Error('Request timed out.')],
    ['a dropped connection', { name: 'APIConnectionError' }],
    ['a server error', { status: 500 }],
    ['a bad gateway', { status: 502 }],
    ['a request timeout status', { status: 408 }],
    ['a conflict', { status: 409 }],
    ['an unreadable status', { status: '400' }],
    ['nothing at all', null],
  ])('keeps it after %s', (_label, error) => {
    expect(definitelyNotBilled(error)).toBe(false);
  });
});
