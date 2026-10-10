import { afterEach, describe, expect, it, vi } from "vitest";

import { societies } from "./demo-registry";
import { DEMO_LOADING_DELAY_MS, loadSocietyRegistry, parseDemoScenario } from "./demo-scenarios";

describe("parseDemoScenario", () => {
  it("accepts only the supported scenarios", () => {
    expect(parseDemoScenario("loading")).toBe("loading");
    expect(parseDemoScenario("empty")).toBe("empty");
    expect(parseDemoScenario("error")).toBe("error");
    expect(parseDemoScenario(["empty", "error"])).toBe("empty");
    expect(parseDemoScenario("delete-everything")).toBeNull();
    expect(parseDemoScenario(undefined)).toBeNull();
  });
});

describe("loadSocietyRegistry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the demonstration registry by default", async () => {
    await expect(loadSocietyRegistry(null)).resolves.toMatchObject({ societies });
  });

  it("returns no societies for the empty scenario", async () => {
    const registry = await loadSocietyRegistry("empty");
    expect(registry.societies).toEqual([]);
    expect(registry.districts.length).toBeGreaterThan(0);
  });

  it("fails for the error scenario", async () => {
    await expect(loadSocietyRegistry("error")).rejects.toThrow("could not be loaded");
  });

  it("delays the loading scenario before returning data", async () => {
    vi.useFakeTimers();
    let settled = false;
    const request = loadSocietyRegistry("loading").then((registry) => {
      settled = true;
      return registry;
    });

    await vi.advanceTimersByTimeAsync(DEMO_LOADING_DELAY_MS - 1);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(request).resolves.toMatchObject({ societies });
  });
});
