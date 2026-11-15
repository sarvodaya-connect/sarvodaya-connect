import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEconomicProfile, getRecordHistory, getSocietyProductionRecords, notFound } = vi.hoisted(() => ({
  getEconomicProfile: vi.fn(),
  getRecordHistory: vi.fn(),
  getSocietyProductionRecords: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/economy-api", () => ({ getEconomicProfile, getRecordHistory, getSocietyProductionRecords }));
vi.mock("@/i18n/server", async () => {
  const { en } = await import("@/i18n/messages/en");
  const { createTranslator } = await import("@/i18n/translate");
  return { getT: async () => createTranslator(en, "en") };
});

import SocietyEconomyPage from "./page";
import ProductionRecordHistoryPage from "./records/[recordId]/page";

const SOCIETY = "29000000-0000-4000-8000-000000000101";
const RECORD = "29000000-0000-4000-8000-000000000901";
const profile = {
  society: { id: SOCIETY },
  businesses: [{ name: "Fictional Dairy", outputs: [{ id: "out-1", product: "MILK", otherDescription: null }] }],
};

/** Issue #147: the society tab and record history pages. */
describe("Society economic profile pages", () => {
  beforeEach(() => {
    for (const mock of [getEconomicProfile, getRecordHistory, getSocietyProductionRecords]) mock.mockReset();
    getEconomicProfile.mockResolvedValue(profile);
    getSocietyProductionRecords.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
  });

  it("reads one page of the society's records and keeps only a safe way back", async () => {
    const page = await SocietyEconomyPage({
      params: Promise.resolve({ id: SOCIETY }),
      searchParams: Promise.resolve({ page: "3", from: "https://example.com" }),
    } as never);
    expect(getSocietyProductionRecords).toHaveBeenCalledWith(SOCIETY, 3);
    expect(page.props.returnTo).toBeUndefined();
  });

  it("refuses ids that are not records", async () => {
    await expect(SocietyEconomyPage({ params: Promise.resolve({ id: "demo-1" }), searchParams: Promise.resolve({}) } as never)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getEconomicProfile).not.toHaveBeenCalled();
  });

  it("shows a record's history only under its own society", async () => {
    getRecordHistory.mockResolvedValue({ record: { outputId: "out-1" }, revisions: [] });
    const page = await ProductionRecordHistoryPage({
      params: Promise.resolve({ id: SOCIETY, recordId: RECORD }),
      searchParams: Promise.resolve({}),
    } as never);
    expect(page.props.outputLabel).toBe("Fictional Dairy · Milk");

    getRecordHistory.mockResolvedValue({ record: { outputId: "another-societys-output" }, revisions: [] });
    await expect(
      ProductionRecordHistoryPage({ params: Promise.resolve({ id: SOCIETY, recordId: RECORD }), searchParams: Promise.resolve({}) } as never),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
