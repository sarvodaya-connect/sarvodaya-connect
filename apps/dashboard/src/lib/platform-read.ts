/**
 * How the dashboard server reads from the API: a safe GET, retried with backoff
 * when the failure may pass, and limited in how many run at once for one page.
 *
 * The limits are part of the TEST capacity budget in
 * docs/aws-test-environment.md. Change them together with it.
 */

/** Reads running at once for one page render, so 2 testers stay within Lambda's reserved concurrency of 4. */
export const READ_SLOTS_PER_RENDER = 2;
/** The first try and up to two retries. */
export const MAX_READ_ATTEMPTS = 3;
/** Queueing, every attempt and every wait for one read, so a page still fits a 30-second request. */
export const READ_BUDGET_MS = 12_000;
const BACKOFF_BASE_MS = 200;
const BACKOFF_CAP_MS = 1_500;

/** Failures that may pass by themselves. Refusals and validation errors never retry. */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export const isRetryableStatus = (status: number) => RETRYABLE_STATUSES.has(status);

/** The API could not be reached, or did not answer within the budget. */
export class ReadUnreachableError extends Error {
  constructor(readonly cause?: unknown) {
    super("The API could not be reached");
    this.name = "ReadUnreachableError";
  }
}

/** Lets a limited number of reads run at once, first come first served. */
export class ReadSlots {
  private free: number;
  private readonly waiting: (() => void)[] = [];

  constructor(size: number) {
    this.free = size;
  }

  /** False if no slot came free within the time allowed. */
  acquire(timeoutMs: number): Promise<boolean> {
    if (this.free > 0) {
      this.free -= 1;
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const granted = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        this.waiting.splice(this.waiting.indexOf(granted), 1);
        resolve(false);
      }, Math.max(0, timeoutMs));
      this.waiting.push(granted);
    });
  }

  release() {
    const next = this.waiting.shift();
    if (next) next();
    else this.free += 1;
  }
}

export interface ReadResult {
  status: number;
  ok: boolean;
  text: string;
}

/** A wait that grows with each attempt, half fixed and half random, so clients do not retry together. */
export function backoffMs(attempt: number, random: () => number = Math.random) {
  const ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1));
  return ceiling / 2 + random() * (ceiling / 2);
}

const retryAfterMs = (value: string | null) => {
  const seconds = Number(value);
  return value !== null && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 0;
};

/**
 * One GET with its retries. Callers must only use this for reads: nothing here
 * knows whether repeating a request is safe. Returns the last response, retried
 * or not, and throws ReadUnreachableError if none arrived.
 */
export async function readWithRetry(
  url: string,
  init: RequestInit,
  {
    slots,
    random = Math.random,
    onRetry,
  }: {
    slots?: ReadSlots;
    random?: () => number;
    onRetry?: (attempt: number, status: number) => void;
  } = {},
): Promise<ReadResult> {
  const deadline = Date.now() + READ_BUDGET_MS;
  let lastFailure: unknown;
  for (let attempt = 1; attempt <= MAX_READ_ATTEMPTS; attempt += 1) {
    if (slots && !(await slots.acquire(deadline - Date.now()))) throw new ReadUnreachableError(lastFailure);
    let status = 0;
    let retryAfter = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ReadUnreachableError(lastFailure);
      const timeout = new AbortController();
      timer = setTimeout(() => timeout.abort(), remaining);
      // A signal also stops React replaying this render's earlier answer, which a retry must not get.
      const signal = init.signal ? AbortSignal.any([init.signal, timeout.signal]) : timeout.signal;
      const response = await fetch(url, { ...init, signal });
      const text = await response.text();
      const result = { status: response.status, ok: response.ok, text };
      if (!isRetryableStatus(response.status) || attempt === MAX_READ_ATTEMPTS) return result;
      status = response.status;
      retryAfter = retryAfterMs(response.headers.get("Retry-After"));
      lastFailure = result;
    } catch (error) {
      if (error instanceof ReadUnreachableError || init.signal?.aborted) throw error;
      lastFailure = error;
      if (attempt === MAX_READ_ATTEMPTS) throw new ReadUnreachableError(error);
    } finally {
      clearTimeout(timer);
      slots?.release();
    }
    const wait = Math.max(backoffMs(attempt, random), retryAfter);
    if (Date.now() + wait >= deadline) {
      if (status) return lastFailure as ReadResult;
      throw new ReadUnreachableError(lastFailure);
    }
    onRetry?.(attempt, status);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  /* c8 ignore next */
  throw new ReadUnreachableError(lastFailure);
}
