import { describe, expect, it } from 'vitest';

import {
  actualMicroUsd,
  definitelyNotBilled,
  modelPrices,
  monthlyLimitMicroUsd,
  nextSpendingMonth,
  reservationMicroUsd,
  SpendingConfigError,
  spendingMonth,
  usageCounts,
} from './assistant-cost.js';
import type { ModelRequest } from './assistant-model.js';

const prices = modelPrices(
  'global.anthropic.claude-haiku-5-5',
  undefined,
  undefined,
);
const request = (text: string, max_tokens = 8000) =>
  ({ max_tokens, messages: [{ role: 'user', content: text }] }) as ModelRequest;

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
    expect(() => monthlyLimitMicroUsd(value)).toThrow(SpendingConfigError);
  });
});

describe('SarvoAI model prices', () => {
  it('uses the Claude Haiku 5.5 list prices unless overridden', () => {
    expect(prices).toEqual({
      inputMicroUsdPerMTok: 100_000n,
      outputMicroUsdPerMTok: 500_000n,
    });
    expect(
      modelPrices('global.anthropic.claude-haiku-5-5', '0.2', '1'),
    ).toEqual({
      inputMicroUsdPerMTok: 200_000n,
      outputMicroUsdPerMTok: 1_000_000n,
    });
  });

  it('refuses a model with no known price, or a price of zero', () => {
    expect(() => modelPrices('some.other.model', undefined, undefined)).toThrow(
      SpendingConfigError,
    );
    expect(() => modelPrices('some.other.model', '1', undefined)).toThrow(
      SpendingConfigError,
    );
    expect(
      modelPrices('some.other.model', '1', '5').outputMicroUsdPerMTok,
    ).toBe(5_000_000n);
    expect(() =>
      modelPrices('global.anthropic.claude-haiku-5-5', '0', '1'),
    ).toThrow(SpendingConfigError);
  });
});

describe('SarvoAI cost estimates', () => {
  it('reserves more than a call can really cost at its output allowance', () => {
    const reserved = reservationMicroUsd(request('x'.repeat(4000)), prices);
    // The most a 4,000-character prompt could really use: about 2,000 tokens, all output used.
    const heavy = actualMicroUsd(
      {
        inputTokens: 0,
        cacheWriteTokens: 2000,
        cacheReadTokens: 0,
        outputTokens: 8000,
      },
      prices,
    );
    expect(reserved).toBeGreaterThan(heavy);
    expect(reserved).toBeGreaterThanOrEqual(4000n + 625n);
  });

  it('counts non-Latin text by its bytes', () => {
    expect(
      reservationMicroUsd(request('කුරුණෑගල'.repeat(100)), prices),
    ).toBeGreaterThan(reservationMicroUsd(request('a'.repeat(800)), prices));
  });

  it('prices a prompt over 100,000 tokens at five times the rate', () => {
    expect(
      reservationMicroUsd(request('x'.repeat(100_001), 0), prices),
    ).toBeGreaterThan(
      5n * reservationMicroUsd(request('x'.repeat(98_000), 0), prices),
    );
    const usage = {
      inputTokens: 100_001,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 1000,
    };
    expect(actualMicroUsd(usage, prices)).toBe(5n * (10_001n + 500n));
    expect(actualMicroUsd({ ...usage, inputTokens: 100_000 }, prices)).toBe(
      10_000n + 500n,
    );
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
        prices,
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
        prices,
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
        cache_read_input_tokens: null,
      } as never),
    ).toEqual({
      inputTokens: 5,
      outputTokens: 6,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
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
