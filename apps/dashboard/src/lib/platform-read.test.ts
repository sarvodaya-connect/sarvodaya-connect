import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { backoffMs, MAX_READ_ATTEMPTS, READ_BUDGET_MS, readWithRetry, ReadSlots, ReadUnreachableError } from "./platform-read";

const answer = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe("readWithRetry", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const run = async (options: Parameters<typeof readWithRetry>[2] = {}) => {
    const read = readWithRetry("http://fictional.invalid/x", {}, options);
    read.catch(() => undefined);
    await vi.runAllTimersAsync();
    return read;
  };

  it.each([429, 502, 503, 504])("recovers from a passing %i", async (status) => {
    fetchMock.mockResolvedValueOnce(answer(status)).mockResolvedValueOnce(answer(200, { fine: true }));
    const result = await run();
    expect(result).toMatchObject({ ok: true, status: 200, text: '{"fine":true}' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers from a dropped connection", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(answer(200));
    expect((await run()).status).toBe(200);
  });

  it("gives up after the maximum attempts and returns the last answer", async () => {
    fetchMock.mockImplementation(async () => answer(503, { message: "Service Unavailable" }));
    const result = await run();
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_READ_ATTEMPTS);
  });

  it("reports the API as unreachable when no attempt got an answer", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(run()).rejects.toBeInstanceOf(ReadUnreachableError);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_READ_ATTEMPTS);
  });

  it.each([400, 401, 403, 404, 409, 422, 500])("never retries a %i", async (status) => {
    fetchMock.mockImplementation(async () => answer(status));
    expect((await run()).status).toBe(status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops within the time budget when the API never answers", async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "TimeoutError")));
        }),
    );
    const started = Date.now();
    await expect(run()).rejects.toBeInstanceOf(ReadUnreachableError);
    expect(Date.now() - started).toBeLessThanOrEqual(READ_BUDGET_MS);
  });

  it("does not wait for a Retry-After that passes the budget", async () => {
    fetchMock.mockImplementation(async () => answer(429, {}, { "Retry-After": "60" }));
    const started = Date.now();
    expect((await run()).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(READ_BUDGET_MS);
  });

  it("waits at least as long as a short Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(answer(429, {}, { "Retry-After": "2" })).mockResolvedValueOnce(answer(200));
    const started = Date.now();
    await run();
    expect(Date.now() - started).toBeGreaterThanOrEqual(2000);
  });

  it("gives every attempt a signal, so React cannot replay the failed answer", async () => {
    fetchMock.mockResolvedValueOnce(answer(503)).mockResolvedValueOnce(answer(200));
    await run();
    for (const [, init] of fetchMock.mock.calls) expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("stops when the caller gives up", async () => {
    const caller = new AbortController();
    fetchMock.mockImplementation(async () => {
      caller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    const read = readWithRetry("http://fictional.invalid/x", { signal: caller.signal });
    read.catch(() => undefined);
    await vi.runAllTimersAsync();
    await expect(read).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("frees its slot during the wait, so a retry cannot hold up other reads", async () => {
    const slots = new ReadSlots(1);
    fetchMock.mockImplementation(async () => answer(503));
    const read = readWithRetry("http://fictional.invalid/x", {}, { slots, random: () => 1 });
    read.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1);
    expect(await slots.acquire(0)).toBe(true);
    slots.release();
    await vi.runAllTimersAsync();
    await read;
  });

  it("never runs more reads at once than the slots allow", async () => {
    const slots = new ReadSlots(2);
    let running = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 50));
      running -= 1;
      return answer(200);
    });
    const reads = Array.from({ length: 7 }, () => readWithRetry("http://fictional.invalid/x", {}, { slots }));
    await vi.runAllTimersAsync();
    await Promise.all(reads);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(peak).toBe(2);
  });

  it("counts time spent queueing against the budget", async () => {
    const slots = new ReadSlots(1);
    await slots.acquire(0);
    const read = readWithRetry("http://fictional.invalid/x", {}, { slots });
    read.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(READ_BUDGET_MS);
    await expect(read).rejects.toBeInstanceOf(ReadUnreachableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("backoffMs", () => {
  it("grows with each attempt, stays capped, and varies", () => {
    expect(backoffMs(1, () => 0)).toBe(100);
    expect(backoffMs(1, () => 1)).toBe(200);
    expect(backoffMs(2, () => 1)).toBe(400);
    expect(backoffMs(10, () => 1)).toBe(1500);
    expect(backoffMs(10, () => 0)).toBe(750);
  });
});

describe("ReadSlots", () => {
  it("hands a freed slot to the longest-waiting read", async () => {
    const slots = new ReadSlots(1);
    await slots.acquire(0);
    const order: string[] = [];
    const first = slots.acquire(1000).then(() => order.push("first"));
    const second = slots.acquire(1000).then(() => order.push("second"));
    slots.release();
    await first;
    slots.release();
    await second;
    expect(order).toEqual(["first", "second"]);
  });
});
