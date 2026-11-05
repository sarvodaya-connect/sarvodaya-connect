import type Anthropic from '@anthropic-ai/sdk';

import type { ModelRequest } from './assistant-model.js';

/** Largest limit accepted, so a typing slip such as 20000 cannot remove the protection. */
export const MAX_MONTHLY_LIMIT_USD = 1000;
export const DEFAULT_MONTHLY_LIMIT_USD = '20';

/**
 * Models whose billing has been checked against the reservation below: thinking can be
 * turned off, and only per-token standard-tier charges apply to the requests allowed by
 * assertBillableRequest. A new model or inference profile needs a code review here as well
 * as a fresh pricing approval.
 */
const REVIEWED_MODELS = new Set(['global.anthropic.claude-haiku-5-5']);
/** The longest a pricing approval may last, so prices are looked at again each month. */
export const MAX_APPROVAL_DAYS = 31;
/** Added to the measured request for the tool-use framing the provider adds. */
const REQUEST_OVERHEAD_TOKENS = 1000;
/** Each of the up to four priced amounts in a settlement rounds up by under one micro-USD. */
const ROUNDING_MICRO_USD = 4n;
const PER_MILLION = 1_000_000n;
const DAY_MS = 86_400_000;

/**
 * SarvoAI may not call the model: its pricing approval or request cannot be trusted, or a
 * call broke the reservation's assumptions. Messages name settings, never prompt content.
 */
export class SpendingBlockedError extends Error {
  override name = 'SpendingBlockedError';
}

/** Micro-USD per million tokens: USD 0.10 per million is 100,000. */
export interface PriceTier {
  input: bigint;
  output: bigint;
  /** 5-minute cache only; assertBillableRequest refuses longer lifetimes. */
  cacheWrite: bigint;
  cacheRead: bigint;
}

export interface PricingApproval {
  standard: PriceTier;
  /** Applies to the whole request when its prompt is over aboveTokens. */
  longPrompt: PriceTier;
  aboveTokens: number;
  /** Holds detected at or before this moment have been reviewed. */
  overageReviewedThrough: string | null;
}

/** Whole micro-USD from a plain decimal such as "20" or "0.125"; nothing else is accepted. */
function microUsd(value: string, name: string): bigint {
  if (!/^\d{1,6}(\.\d{1,6})?$/.test(value)) {
    throw new SpendingBlockedError(
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
    throw new SpendingBlockedError(
      `SARVOAI_MONTHLY_LIMIT_USD must be at most ${MAX_MONTHLY_LIMIT_USD}`,
    );
  }
  return limit;
}

const APPROVAL = 'SARVOAI_PRICING_APPROVAL';

function fields(value: unknown, name: string, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new SpendingBlockedError(`${name} must be an object`);
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0)
    throw new SpendingBlockedError(`${name} has unknown fields`);
  return value as Record<string, unknown>;
}

function calendarDate(value: unknown, name: string) {
  const time =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? Date.parse(`${value}T00:00:00.000Z`)
      : NaN;
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw new SpendingBlockedError(`${name} must be a date as YYYY-MM-DD`);
  return time;
}

function officialSource(value: unknown) {
  let url: URL | undefined;
  try {
    url = new URL(String(value));
  } catch {
    url = undefined;
  }
  const host = url?.hostname ?? '';
  if (
    url?.protocol !== 'https:' ||
    !(
      host === 'aws.amazon.com' ||
      host.endsWith('.aws.amazon.com') ||
      host.endsWith('.amazonaws.com')
    )
  )
    throw new SpendingBlockedError(
      `${APPROVAL} source must be an official AWS https address`,
    );
}

const TIER_FIELDS = [
  'inputUsdPerMTok',
  'outputUsdPerMTok',
  'cacheWriteUsdPerMTok',
  'cacheReadUsdPerMTok',
];

function priceTier(value: Record<string, unknown>, name: string): PriceTier {
  const price = (field: string) => {
    const amount = microUsd(String(value[field]), `${name}.${field}`);
    if (typeof value[field] !== 'string' || amount <= 0n)
      throw new SpendingBlockedError(
        `${name}.${field} must be a price above zero, written as text`,
      );
    return amount;
  };
  return {
    input: price('inputUsdPerMTok'),
    output: price('outputUsdPerMTok'),
    cacheWrite: price('cacheWriteUsdPerMTok'),
    cacheRead: price('cacheReadUsdPerMTok'),
  };
}

/**
 * Reads the reviewed Bedrock prices. There is no default: without a current approval for
 * exactly this model and Region, SarvoAI makes no calls. docs/sarvoai-aws-setup.md explains
 * how the review is done.
 */
export function pricingApproval(
  raw: string | undefined,
  expected: { modelId: string; region: string },
  now: Date,
): PricingApproval {
  if (!REVIEWED_MODELS.has(expected.modelId))
    throw new SpendingBlockedError(
      'SarvoAI has no reviewed billing rules for this model or inference profile',
    );
  if (!raw?.trim()) throw new SpendingBlockedError(`${APPROVAL} is not set`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SpendingBlockedError(`${APPROVAL} is not valid JSON`);
  }
  const approval = fields(parsed, APPROVAL, [
    'modelId',
    'region',
    'reviewedOn',
    'expiresOn',
    'source',
    'standard',
    'longPrompt',
    'overageReviewedThrough',
  ]);
  if (
    approval.modelId !== expected.modelId ||
    approval.region !== expected.region
  )
    throw new SpendingBlockedError(
      `${APPROVAL} covers a different model, inference profile or Region: it needs a fresh review`,
    );
  const reviewedOn = calendarDate(approval.reviewedOn, 'reviewedOn');
  const expiresOn = calendarDate(approval.expiresOn, 'expiresOn');
  if (reviewedOn > now.getTime())
    throw new SpendingBlockedError(`${APPROVAL} is dated in the future`);
  if (now.getTime() >= expiresOn)
    throw new SpendingBlockedError(`${APPROVAL} has expired`);
  if (expiresOn - reviewedOn > MAX_APPROVAL_DAYS * DAY_MS)
    throw new SpendingBlockedError(
      `${APPROVAL} may last at most ${MAX_APPROVAL_DAYS} days`,
    );
  officialSource(approval.source);

  const standard = priceTier(
    fields(approval.standard, 'standard', TIER_FIELDS),
    'standard',
  );
  const long = fields(approval.longPrompt, 'longPrompt', [
    'aboveTokens',
    ...TIER_FIELDS,
  ]);
  const longPrompt = priceTier(long, 'longPrompt');
  const aboveTokens = long.aboveTokens;
  if (!Number.isSafeInteger(aboveTokens) || (aboveTokens as number) <= 0)
    throw new SpendingBlockedError(
      'longPrompt.aboveTokens must be a whole number of tokens',
    );
  if (
    longPrompt.input < standard.input ||
    longPrompt.output < standard.output ||
    longPrompt.cacheWrite < standard.cacheWrite ||
    longPrompt.cacheRead < standard.cacheRead
  )
    throw new SpendingBlockedError(
      'longPrompt prices must not be below the standard prices',
    );

  const through = approval.overageReviewedThrough;
  if (through !== undefined) {
    const moment =
      typeof through === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(through)
        ? Date.parse(through)
        : NaN;
    // A later moment would approve overages that have not happened yet.
    if (!Number.isFinite(moment) || moment > now.getTime())
      throw new SpendingBlockedError(
        'overageReviewedThrough must be a past UTC time',
      );
  }
  return {
    standard,
    longPrompt,
    aboveTokens: aboveTokens as number,
    overageReviewedThrough: (through as string | undefined) ?? null,
  };
}

const REQUEST_FIELDS = [
  'max_tokens',
  'system',
  'tools',
  'messages',
  'output_config',
  'thinking',
];

function checkCacheControls(value: unknown) {
  if (Array.isArray(value)) value.forEach(checkCacheControls);
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value)) {
      if (key !== 'cache_control') {
        checkCacheControls(item);
        continue;
      }
      const cache = item as { type?: unknown; ttl?: unknown } | null;
      if (
        cache?.type !== 'ephemeral' ||
        ![undefined, '5m'].includes(cache.ttl as string | undefined)
      )
        throw new SpendingBlockedError(
          'Only the 5-minute prompt cache has a reviewed price',
        );
    }
}

function checkBlocks(content: unknown, allowed: string[]) {
  if (typeof content === 'string') return;
  if (!Array.isArray(content))
    throw new SpendingBlockedError('Request content has an unknown form');
  for (const block of content as { type?: string; content?: unknown }[]) {
    if (!allowed.includes(block?.type ?? ''))
      throw new SpendingBlockedError(
        'Request content of this type has no safe cost limit',
      );
    if (block.type === 'tool_result' && block.content !== undefined)
      checkBlocks(block.content, ['text']);
  }
}

/**
 * Refuses anything the reservation cannot put a limit on. Service tiers, fast mode and
 * data-residency options change the price. Server tools bill per use. Images and documents
 * are not priced by their bytes. Thinking must be off: on Haiku 5.5 it is on by default, and
 * replayed thinking may bill more input tokens than the bytes the application can see.
 */
export function assertBillableRequest(request: ModelRequest) {
  fields(request, 'The request', REQUEST_FIELDS);
  if (!Number.isSafeInteger(request.max_tokens) || request.max_tokens <= 0)
    throw new SpendingBlockedError(
      'max_tokens must be a positive whole number',
    );
  if (request.thinking?.type !== 'disabled')
    throw new SpendingBlockedError('Thinking must be disabled');
  const output = fields(request.output_config ?? {}, 'output_config', [
    'effort',
    'format',
  ]);
  if (
    ![undefined, 'low', 'medium', 'high'].includes(
      output.effort as string | undefined,
    )
  )
    throw new SpendingBlockedError(
      'This effort level cannot run without thinking',
    );
  for (const tool of request.tools ?? []) {
    const type = (tool as { type?: string }).type;
    if (type !== undefined && type !== 'custom')
      throw new SpendingBlockedError('Server tools have no reviewed price');
  }
  checkBlocks(request.system ?? [], ['text']);
  for (const message of request.messages)
    checkBlocks(message.content, ['text', 'tool_use', 'tool_result']);
  checkCacheControls([request.system, request.tools, request.messages]);
}

/** Tokens at a price in micro-USD per million, rounded up to a whole micro-USD. */
function cost(tokens: number, pricePerMTok: bigint) {
  return (BigInt(tokens) * pricePerMTok + PER_MILLION - 1n) / PER_MILLION;
}

const tierFor = (promptTokens: number, approval: PricingApproval) =>
  promptTokens > approval.aboveTokens ? approval.longPrompt : approval.standard;

export interface ReservationBound {
  microUsd: bigint;
  /** The most prompt tokens the reservation allows for. */
  promptTokens: number;
}

/**
 * The most one allowed call can cost, worked out before it is made. Every UTF-8 byte of the
 * whole request counts as a token (real tokens span several bytes), all of it at the
 * dearest input price, with the full output allowance. With thinking off, max_tokens
 * limits all billed output.
 */
export function reservationBound(
  request: ModelRequest,
  approval: PricingApproval,
): ReservationBound {
  const { max_tokens: maxTokens, ...billable } = request;
  const promptTokens =
    Buffer.byteLength(JSON.stringify(billable), 'utf8') +
    REQUEST_OVERHEAD_TOKENS;
  const tier = tierFor(promptTokens, approval);
  const dearestInput = [tier.input, tier.cacheWrite, tier.cacheRead].reduce(
    (dearest, price) => (price > dearest ? price : dearest),
  );
  return {
    microUsd:
      cost(promptTokens, dearestInput) +
      cost(maxTokens, tier.output) +
      ROUNDING_MICRO_USD,
    promptTokens,
  };
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
  const cacheWriteTokens = count(usage?.cache_creation_input_tokens ?? 0);
  const cacheReadTokens = count(usage?.cache_read_input_tokens ?? 0);
  if (
    inputTokens === undefined ||
    outputTokens === undefined ||
    cacheWriteTokens === undefined ||
    cacheReadTokens === undefined
  )
    return undefined;
  return { inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens };
}

/** The estimated cost of a finished call, from the tokens the provider reported. */
export function actualMicroUsd(
  usage: UsageCounts,
  approval: PricingApproval,
): bigint {
  const tier = tierFor(
    usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens,
    approval,
  );
  return (
    cost(usage.inputTokens, tier.input) +
    cost(usage.cacheWriteTokens, tier.cacheWrite) +
    cost(usage.cacheReadTokens, tier.cacheRead) +
    cost(usage.outputTokens, tier.output)
  );
}

/** Charges in a response that the approved per-token prices do not cover. */
export function unpricedBilling(usage: Anthropic.Usage | undefined): string[] {
  const reasons: string[] = [];
  if ((usage?.cache_creation?.ephemeral_1h_input_tokens ?? 0) !== 0)
    reasons.push('long_lived_cache');
  if (![undefined, null, 'standard'].includes(usage?.service_tier))
    reasons.push('service_tier');
  if (![undefined, null, 'standard'].includes(usage?.speed))
    reasons.push('speed');
  if (
    (usage?.server_tool_use?.web_search_requests ?? 0) !== 0 ||
    (usage?.server_tool_use?.web_fetch_requests ?? 0) !== 0
  )
    reasons.push('server_tools');
  if ((usage?.output_tokens_details?.thinking_tokens ?? 0) !== 0)
    reasons.push('thinking');
  return reasons;
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
