import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ platformApi: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { path });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: api.revalidatePath }));
vi.mock("@/lib/current-viewer", () => ({ getSpcViewer: async () => ({ role: "PROGRAMME_COORDINATOR" }) }));
vi.mock("@/lib/activities-api", () => ({ asSpc: () => ({}) }));
vi.mock("@/lib/platform-api", async () => {
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

const goals = { dimensions: ["SOCIAL" as const], categories: ["COMMUNITY_EDUCATION" as const], sdgs: [4] };
const reviewed = "2026-11-15T03:50:00.000Z";

describe("approving the version the SPC reviewed (#170, #204)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the reviewed submittedAt with the choices", async () => {
    api.platformApi.mockResolvedValue({});
    await expect(approveActivity("a1", reviewed, goals)).rejects.toMatchObject({ path: "/activities-to-approve?approved=a1" });
    const [path, init] = api.platformApi.mock.calls[0]!;
    expect(path).toBe("/activities/a1/approve");
    expect(JSON.parse(init.body)).toEqual({ ...goals, reviewedSubmittedAt: reviewed });
  });

  it("leaves the field out when the activity has no submittedAt", async () => {
    api.platformApi.mockResolvedValue({});
    await expect(approveActivity("a1", undefined, goals)).rejects.toMatchObject({ path: expect.any(String) });
    expect(JSON.parse(api.platformApi.mock.calls[0]![1].body)).toEqual(goals);
  });

  it("reports an activity changed during review as stale, with nothing approved", async () => {
    api.platformApi.mockRejectedValue(
      new PlatformApiError("This activity was changed while you were reviewing it. Check it again before approving", 409),
    );
    await expect(approveActivity("a1", reviewed, goals)).resolves.toEqual({
      kind: "stale",
      error: "This activity was changed while you were reviewing it. Check it again before approving",
    });
    expect(api.revalidatePath).toHaveBeenCalledWith("/activities-to-approve/a1");
  });
});
