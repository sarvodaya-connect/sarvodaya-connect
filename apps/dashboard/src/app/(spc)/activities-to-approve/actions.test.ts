import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ platformApi: vi.fn(), getSpcViewer: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { path });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/current-viewer", () => ({ getSpcViewer: api.getSpcViewer }));
vi.mock("@/lib/activities-api", () => ({ asSpc: () => ({}) }));
vi.mock("@/lib/platform-api", () => {
  class PlatformApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  }
  return { PlatformApiError, platformApi: api.platformApi, isDemoMode: () => false };
});

const { approveActivity } = await import("./actions");
const { PlatformApiError } = await import("@/lib/platform-api");

const choices = { dimensions: ["GOVERNANCE", "SOCIAL"], categories: ["CULTURE"], sdgs: [16, 4] };

describe("approveActivity (#170)", () => {
  beforeEach(() => {
    api.platformApi.mockReset();
    api.getSpcViewer.mockReset().mockResolvedValue({ role: "PROGRAMME_COORDINATOR" });
  });

  it("checks the SPC, sends the Development Goals in catalogue order and opens the list with the confirmation", async () => {
    api.platformApi.mockResolvedValue({});
    await expect(approveActivity("a 1", choices)).rejects.toMatchObject({ path: "/activities-to-approve?approved=a%201" });
    expect(api.getSpcViewer).toHaveBeenCalled();
    const [path, init] = api.platformApi.mock.calls[0]!;
    expect(path).toBe("/activities/a 1/approve");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ dimensions: ["SOCIAL", "GOVERNANCE"], categories: ["CULTURE"], sdgs: [4, 16] });
  });

  it("refuses an incomplete choice before calling the API", async () => {
    await expect(approveActivity("a1", { ...choices, categories: [] })).resolves.toEqual({
      error: expect.stringContaining("Before you approve"),
      kind: "invalid",
    });
    expect(api.platformApi).not.toHaveBeenCalled();
  });

  it.each([409, 403, 404])("treats %s as an activity that is no longer this SPC's to decide", async (status) => {
    api.platformApi.mockRejectedValue(new PlatformApiError("This activity is no longer waiting for approval", status));
    await expect(approveActivity("a1", choices)).resolves.toMatchObject({ kind: "stale" });
  });

  it("passes on the API's message when it refuses the choices", async () => {
    api.platformApi.mockRejectedValue(new PlatformApiError("Request validation failed: categories: unknown code", 400));
    await expect(approveActivity("a1", choices)).resolves.toEqual({ error: "Request validation failed: categories: unknown code", kind: "invalid" });
  });

  it.each([0, 500, 503])("reports a failure (%s) without claiming success", async (status) => {
    api.platformApi.mockRejectedValue(new PlatformApiError("The service is unavailable.", status));
    await expect(approveActivity("a1", choices)).resolves.toEqual({
      error: "Could not approve. Check your connection and try again. Your selections are kept.",
      kind: "failed",
    });
  });
});
