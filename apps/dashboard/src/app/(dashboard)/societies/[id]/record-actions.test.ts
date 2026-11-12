import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ platformApi: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { path });
  },
}));
vi.mock("next/cache", () => cache);
vi.mock("@/lib/current-viewer", () => ({ getDesktopViewer: async () => ({ role: "HQ_ADMIN", displayName: "Fictional HQ" }) }));
vi.mock("@/lib/platform-api", () => ({ platformApi: api.platformApi, isDemoMode: () => false }));

const { updateSocietyRecord } = await import("./record-actions");

const ID = "29000000-0000-4000-8000-000000000101";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

/** The members part of the D05e form, as the panel posts it. */
const members = (female: string, male: string, before = { female: "", male: "" }) => ({
  femaleMembers: female,
  femaleMembers__before: before.female,
  maleMembers: male,
  maleMembers__before: before.male,
});

describe("D05e saving female and male members (issue #141)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends female and male, never a total, and reopens the saved record", async () => {
    api.platformApi.mockResolvedValue({});
    await expect(updateSocietyRecord(ID, {}, form(members("25", "17")))).rejects.toMatchObject({ path: `/societies/${ID}?saved=1` });
    expect(api.platformApi).toHaveBeenCalledWith(`/societies/${ID}/profile`, {
      method: "PATCH",
      body: JSON.stringify({ femaleMembers: 25, maleMembers: 17 }),
    });
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/societies/${ID}`, "layout");
  });

  it("accepts typed commas and sends both counts when only one changed", async () => {
    api.platformApi.mockResolvedValue({});
    await expect(updateSocietyRecord(ID, {}, form(members("1,030", "17", { female: "25", male: "17" })))).rejects.toThrow("NEXT_REDIRECT");
    expect(JSON.parse(api.platformApi.mock.calls[0]![1].body)).toEqual({ femaleMembers: 1030, maleMembers: 17 });
  });

  it.each([
    ["a decimal", "2.5", "17"],
    ["a negative", "-1", "17"],
    ["letters", "25a", "17"],
    ["only one count", "25", ""],
    ["too many", "1000001", "0"],
  ])("refuses %s without calling the API", async (_case, female, male) => {
    const result = await updateSocietyRecord(ID, {}, form(members(female, male)));
    expect(result.error).toBeTruthy();
    expect(api.platformApi).not.toHaveBeenCalled();
  });

  it("refuses female and male above 1,000,000 together", async () => {
    await expect(updateSocietyRecord(ID, {}, form(members("600000", "500000")))).resolves.toEqual({
      error: "Female and male members together cannot be more than 1,000,000.",
    });
  });

  it("returns the API error and does not report a save when it fails", async () => {
    api.platformApi.mockRejectedValue(new Error("Female and male members together cannot be more than 1,000,000"));
    await expect(updateSocietyRecord(ID, {}, form(members("25", "17")))).resolves.toEqual({
      error: "Female and male members together cannot be more than 1,000,000",
    });
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("sends nothing about members when they were left as they were", async () => {
    const result = await updateSocietyRecord(ID, {}, form(members("25", "17", { female: "25", male: "17" })));
    expect(result.error).toBeTruthy();
    expect(api.platformApi).not.toHaveBeenCalled();
  });
});
