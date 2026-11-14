import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDesktopViewer, getEconomyScope, getProductionRecords, getProductionSummary } = vi.hoisted(() => ({
  getDesktopViewer: vi.fn(),
  getEconomyScope: vi.fn(),
  getProductionRecords: vi.fn(),
  getProductionSummary: vi.fn(),
}));

vi.mock("@/lib/current-viewer", () => ({ getDesktopViewer }));
vi.mock("@/lib/economy-api", () => ({ getEconomyScope, getProductionRecords, getProductionSummary }));
vi.mock("@/lib/platform-api", () => ({ isDemoMode: () => false }));
vi.mock("@/i18n/server", async () => {
  const { en } = await import("@/i18n/messages/en");
  const { createTranslator } = await import("@/i18n/translate");
  return { getT: async () => createTranslator(en, "en") };
});

import EconomicProfilePage from "./page";
import { EconomyOverview } from "@/components/dashboard/economy/economy-overview";
import { getViewer } from "@/lib/access";

const DISTRICT = "29000000-0000-4000-8000-000000000001";
const props = (search: Record<string, string> = {}) => ({ params: Promise.resolve({}), searchParams: Promise.resolve(search) }) as never;

/** Issue #147: what the overview asks the API for. */
describe("Village Economic Profile page", () => {
  beforeEach(() => {
    for (const mock of [getDesktopViewer, getEconomyScope, getProductionRecords, getProductionSummary]) mock.mockReset();
    getDesktopViewer.mockResolvedValue(getViewer("district-manager"));
    getEconomyScope.mockResolvedValue({ kind: "DISTRICT" });
    getProductionSummary.mockResolvedValue({ products: [] });
    getProductionRecords.mockResolvedValue({ items: [], page: 2, pageSize: 25, total: 0 });
  });

  it("uses one query for the cards and the table, so both always agree", async () => {
    const page = await EconomicProfilePage(props({ month: "2026-10", product: "MILK", districtId: DISTRICT, page: "2" }));
    const query = { basis: "MONTHLY", startsOn: "2026-10-01", endsOn: "2026-10-31", measurement: "ACTUAL", product: "MILK", districtId: DISTRICT };
    expect(getProductionSummary).toHaveBeenCalledWith(query);
    expect(getProductionRecords).toHaveBeenCalledWith(query, 2);
    expect(getEconomyScope).toHaveBeenCalledWith(DISTRICT);
    expect(page.type).toBe(EconomyOverview);
    expect(page.props).toMatchObject({ role: "DISTRICT_MANAGER", periodProblem: undefined });
  });

  it("asks for nothing until a season has both dates", async () => {
    const page = await EconomicProfilePage(props({ basis: "SEASONAL", startsOn: "2025-10-15" }));
    expect(getProductionSummary).not.toHaveBeenCalled();
    expect(getProductionRecords).not.toHaveBeenCalled();
    expect(page.props).toMatchObject({ summary: null, records: null, periodProblem: "CHOOSE_SEASON" });
  });

  it("never sends an unknown filter on to the API", async () => {
    await EconomicProfilePage(props({ month: "2026-10", districtId: "../national", product: "GOLD" }));
    expect(getProductionSummary).toHaveBeenCalledWith({ basis: "MONTHLY", startsOn: "2026-10-01", endsOn: "2026-10-31", measurement: "ACTUAL" });
    expect(getEconomyScope).toHaveBeenCalledWith(undefined);
  });
});
