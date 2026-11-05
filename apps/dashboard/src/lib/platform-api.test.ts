import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Stands in for React: each simulated render has its own cache, as each request does. */
const { renders, session } = vi.hoisted(() => ({
  renders: { current: new Map<unknown, unknown>() },
  session: { token: "fictional-token-a" as string | undefined },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (session.token ? { value: session.token } : undefined) }),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache:
    <T,>(fn: () => T) =>
    () => {
      if (!renders.current.has(fn)) renders.current.set(fn, fn());
      return renders.current.get(fn) as T;
    },
}));

import { isTransientPlatformError, PlatformApiError, platformApi } from "./platform-api";
import { MAX_READ_ATTEMPTS } from "./platform-read";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const newRender = () => {
  renders.current = new Map();
};

describe("platformApi", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const authOf = (call: number) => new Headers(fetchMock.mock.calls[call]?.[1]?.headers).get("Authorization");

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    newRender();
    session.token = "fictional-token-a";
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const settled = async <T,>(promise: Promise<T>) => {
    promise.catch(() => undefined);
    await vi.runAllTimersAsync();
    return promise;
  };

  describe("reads", () => {
    it("recovers from a throttled read", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      fetchMock.mockResolvedValueOnce(json({ message: "Service Unavailable" }, 503)).mockResolvedValueOnce(json({ name: "Fictional" }));
      await expect(settled(platformApi("/societies/1"))).resolves.toEqual({ name: "Fictional" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("reports the status once retries run out", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      fetchMock.mockImplementation(async () => json({ message: "Service Unavailable" }, 503));
      const error = await settled(platformApi("/societies/1")).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(PlatformApiError);
      expect(error).toMatchObject({ message: "Service Unavailable", status: 503 });
      expect(fetchMock).toHaveBeenCalledTimes(MAX_READ_ATTEMPTS);
    });

    it("reports an unreachable API with status 0", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      await expect(settled(platformApi("/societies/1"))).rejects.toMatchObject({ status: 0 });
    });

    it("keeps the API's own validation message, and does not retry it", async () => {
      fetchMock.mockImplementation(async () =>
        json({ error: { message: "Request validation failed", details: [{ field: "name", messages: ["is required"] }] } }, 400),
      );
      await expect(settled(platformApi("/societies"))).rejects.toMatchObject({
        message: "Request validation failed: name: is required",
        status: 400,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("logs the route on retry, but no query, token or cookie", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      fetchMock.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({}));
      await settled(platformApi("/society-directory?q=Fictional+Person"));
      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).toContain("/society-directory");
      expect(logged).not.toContain("Fictional");
      expect(logged).not.toContain("fictional-token-a");
    });

    it("sends the session token on every attempt", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      fetchMock.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({}));
      await settled(platformApi("/identity/me"));
      expect(authOf(0)).toBe("Bearer fictional-token-a");
      expect(authOf(1)).toBe("Bearer fictional-token-a");
    });
  });

  describe("writes are never retried", () => {
    const overloaded = [503, 429, 502, 504];
    const writes: [string, string][] = [
      ["POST", "/societies"],
      ["POST", "/identity/accounts"],
      ["POST", "/assistant/questions"],
      ["PUT", "/societies/1/staff"],
      ["PATCH", "/societies/1"],
      ["DELETE", "/documents/1"],
      ["post", "/documents/uploads"],
    ];
    it.each(writes)("%s %s gets one attempt even when overloaded", async (method, path) => {
      for (const status of overloaded) {
        fetchMock.mockClear();
        fetchMock.mockImplementation(async () => json({ message: "Service Unavailable" }, status));
        await expect(settled(platformApi(path, { method, body: "{}" }))).rejects.toMatchObject({ status });
        expect(fetchMock).toHaveBeenCalledTimes(1);
      }
    });

    it("gets one attempt when the connection drops", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      await expect(settled(platformApi("/societies", { method: "POST", body: "{}" }))).rejects.toMatchObject({ status: 0 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("are not shared, even when identical in one render", async () => {
      fetchMock.mockImplementation(async () => json({ id: "fictional" }));
      await settled(platformApi("/societies", { method: "POST", body: "{}" }));
      await settled(platformApi("/societies", { method: "POST", body: "{}" }));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("sharing within a render", () => {
    it("makes one request for the same read", async () => {
      fetchMock.mockImplementation(async () => json({ id: "fictional" }));
      const [first, second] = await settled(Promise.all([platformApi("/identity/me"), platformApi("/identity/me")]));
      expect(first).toEqual(second);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("gives each caller its own copy", async () => {
      fetchMock.mockImplementation(async () => json({ data: [2, 1] }));
      const first = await settled(platformApi("/x"));
      first.data.sort();
      expect((await settled(platformApi("/x"))).data).toEqual([2, 1]);
    });

    it("keeps different reads apart", async () => {
      fetchMock.mockImplementation(async () => json({}));
      await settled(Promise.all([platformApi("/a"), platformApi("/a?page=2")]));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("runs at most two reads at once", async () => {
      let running = 0;
      let peak = 0;
      fetchMock.mockImplementation(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 50));
        running -= 1;
        return json({});
      });
      await settled(Promise.all(["/a", "/b", "/c", "/d", "/e", "/f", "/g"].map((path) => platformApi(path))));
      expect(fetchMock).toHaveBeenCalledTimes(7);
      expect(peak).toBe(2);
    });

    it("does not retry a shared failure again for each caller", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      fetchMock.mockImplementation(async () => json({}, 503));
      const results = await settled(Promise.allSettled([platformApi("/x"), platformApi("/x")]));
      expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
      expect(fetchMock).toHaveBeenCalledTimes(MAX_READ_ATTEMPTS);
    });
  });

  describe("isolation between users", () => {
    it("does not share a read across renders", async () => {
      fetchMock.mockImplementation(async () => json({}));
      await settled(platformApi("/identity/me"));
      newRender();
      await settled(platformApi("/identity/me"));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("gives each signed-in user only their own answer", async () => {
      fetchMock.mockImplementation(async (_url, init) => json({ user: new Headers(init?.headers).get("Authorization") }));
      const a = await settled(platformApi("/identity/me"));
      newRender();
      session.token = "fictional-token-b";
      const b = await settled(platformApi("/identity/me"));
      expect(a.user).toBe("Bearer fictional-token-a");
      expect(b.user).toBe("Bearer fictional-token-b");
    });

    it("keeps a different token apart even within one render", async () => {
      fetchMock.mockImplementation(async (_url, init) => json({ user: new Headers(init?.headers).get("Authorization") }));
      const cookie = await settled(platformApi("/identity/me"));
      const checking = await settled(platformApi("/identity/me", { headers: { Authorization: "Bearer fictional-new-token" } }));
      expect(cookie.user).toBe("Bearer fictional-token-a");
      expect(checking.user).toBe("Bearer fictional-new-token");
    });
  });
});

describe("isTransientPlatformError", () => {
  it.each([0, 429, 500, 502, 503, 504])("treats %i as passing", (status) => {
    expect(isTransientPlatformError(new PlatformApiError("x", status))).toBe(true);
  });
  it.each([400, 401, 403, 404, 409, 422])("treats %i as a real refusal", (status) => {
    expect(isTransientPlatformError(new PlatformApiError("x", status))).toBe(false);
  });
  it("ignores other errors", () => {
    expect(isTransientPlatformError(new Error("x"))).toBe(false);
  });
});
