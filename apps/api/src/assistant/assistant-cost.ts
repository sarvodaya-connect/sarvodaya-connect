import type Anthropic from '@anthropic-ai/sdk';

import type { ModelRequest } from './assistant-model.js';

/** Largest limit accepted, so a typing slip such as 20000 cannot remove the protection. */
export const MAX_MONTHLY_LIMIT_USD = 1000;
export const DEFAULT_MONTHLY_LIMIT_USD = '20';

/**
 * Public Claude Haiku 5.5 list prices in USD per million tokens. Amazon Bedrock bills
 * separately, so check them against the AWS price list and override them if they differ
 * (docs/sarvoai-aws-setup.md). A model not listed here needs both prices set, or SarvoAI
 * refuses every call.
 */
const LIST_PRICES: Record<string, { input: string; output: string }> = {
  'global.anthropic.claude-haiku-5-5': { input: '0.10', output: '0.50' },
};

/** Multiples of the input price, in hundredths: 5-minute cache write 1.25x, cache read 0.1x. */
const CACHE_WRITE_PERCENT = 125n;
const CACHE_READ_PERCENT = 10n;
/** A prompt over this many tokens pays five times every price, for that whole request. */
const LONG_PROMPT_TOKENS = 100_000;
const LONG_PROMPT_MULTIPLE = 5n;
/** Added to the measured request for the tool-use framing the provider adds. */
const REQUEST_OVERHEAD_TOKENS = 1000;
const PER_MILLION = 1_000_000n;

export class SpendingConfigError extends Error {
  override name = 'SpendingConfigError';
}

export interface ModelPrices {
  /** Micro-USD per million tokens: USD 0.10 per million is 100,000. */
  inputMicroUsdPerMTok: bigint;
  outputMicroUsdPerMTok: bigint;
}

/** Whole micro-USD from a plain decimal such as "20" or "0.125"; nothing else is accepted. */
function microUsd(value: string, name: string): bigint {
  if (!/^\d{1,6}(\.\d{1,6})?$/.test(value)) {
    throw new SpendingConfigError(
      `${name} must be a plain number of US dollars`,
    );
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

/** The monthly limit. Zero is valid and refuses every call. */
export function monthlyLimitMicroUsd(configured: string | undefined): bigint {
  const limit = microUsd(
    configured?.trim() || DEFAULT_MONTHLY_LIMIT_USD,
    'SARVOAI_MONTHLY_LIMIT_USD',
  );
  if (limit > BigInt(MAX_MONTHLY_LIMIT_USD) * 1_000_000n) {
    throw new SpendingConfigError(
      `SARVOAI_MONTHLY_LIMIT_USD must be at most ${MAX_MONTHLY_LIMIT_USD}`,
    );
  }
  return limit;
}

export function modelPrices(
  modelId: string,
  input: string | undefined,
  output: string | undefined,
): ModelPrices {
  const listed = LIST_PRICES[modelId];
  const inputPrice = input?.trim() || listed?.input;
  const outputPrice = output?.trim() || listed?.output;
  if (!inputPrice || !outputPrice) {
    throw new SpendingConfigError(
      'SarvoAI has no prices for this model: set SARVOAI_INPUT_USD_PER_MTOK and SARVOAI_OUTPUT_USD_PER_MTOK',
    );
  }
  const prices = {
    inputMicroUsdPerMTok: microUsd(inputPrice, 'SARVOAI_INPUT_USD_PER_MTOK'),
    outputMicroUsdPerMTok: microUsd(outputPrice, 'SARVOAI_OUTPUT_USD_PER_MTOK'),
  };
  if (prices.inputMicroUsdPerMTok <= 0n || prices.outputMicroUsdPerMTok <= 0n) {
    throw new SpendingConfigError('SarvoAI model prices must be above zero');
  }
  return prices;
}

/** Tokens at a price in micro-USD per million, rounded up to a whole micro-USD. */
function cost(tokens: number, pricePerMTok: bigint, percent = 100n) {
  const scaled = BigInt(tokens) * pricePerMTok * percent;
  const divisor = PER_MILLION * 100n;
  return (scaled + divisor - 1n) / divisor;
}

/**
 * A deliberately high estimate of one model call, worked out before it is made. Every
 * UTF-8 byte of the request is counted as a whole token (real tokens span several bytes)
 * and all of it at the cache-write price, plus the full output allowance.
 */
export function reservationMicroUsd(
  request: ModelRequest,
  prices: ModelPrices,
): bigint {
  const { system, tools, messages } = request;
  const tokens =
    Buffer.byteLength(JSON.stringify({ system, tools, messages }), 'utf8') +
    REQUEST_OVERHEAD_TOKENS;
  const multiple = tokens > LONG_PROMPT_TOKENS ? LONG_PROMPT_MULTIPLE : 1n;
  return (
    (cost(tokens, prices.inputMicroUsdPerMTok, CACHE_WRITE_PERCENT) +
      cost(request.max_tokens, prices.outputMicroUsdPerMTok)) *
    multiple
  );
}

export interface UsageCounts {
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
}

const count = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;

/** The token counts in a response, or undefined when they cannot be trusted. */
export function usageCounts(
  usage: Anthropic.Usage | undefined,
): UsageCounts | undefined {
  const inputTokens = count(usage?.input_tokens);
  const outputTokens = count(usage?.output_tokens);
  if (inputTokens === undefined || outputTokens === undefined) return undefined;
  return {
    inputTokens,
    outputTokens,
    cacheWriteTokens: count(usage?.cache_creation_input_tokens) ?? 0,
    cacheReadTokens: count(usage?.cache_read_input_tokens) ?? 0,
  };
}

/** The estimated cost of a finished call, from the tokens the provider reported. */
export function actualMicroUsd(
  usage: UsageCounts,
  prices: ModelPrices,
): bigint {
  const prompt =
    usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
  const multiple = prompt > LONG_PROMPT_TOKENS ? LONG_PROMPT_MULTIPLE : 1n;
  return (
    (cost(usage.inputTokens, prices.inputMicroUsdPerMTok) +
      cost(
        usage.cacheWriteTokens,
        prices.inputMicroUsdPerMTok,
        CACHE_WRITE_PERCENT,
      ) +
      cost(
        usage.cacheReadTokens,
        prices.inputMicroUsdPerMTok,
        CACHE_READ_PERCENT,
      ) +
      cost(usage.outputTokens, prices.outputMicroUsdPerMTok)) *
    multiple
  );
}

/** The spending month: the UTC calendar month, as YYYY-MM. */
export function spendingMonth(now: Date) {
  return now.toISOString().slice(0, 7);
}

/** The first moment of the next UTC calendar month. */
export function nextSpendingMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * True only when the provider definitely turned the call down before running the model,
 * so nothing was billed. Timeouts, dropped connections, server errors and anything
 * unrecognised may have been billed, and keep their reservation.
 */
export function definitelyNotBilled(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status;
  return (
    typeof status === 'number' &&
    [400, 401, 403, 404, 413, 422, 429].includes(status)
  );
}
