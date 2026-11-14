import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDesktopViewer, getNationalProgrammes, getScopedProgrammes } = vi.hoisted(() => ({
  getDesktopViewer: vi.fn(),
  getNationalProgrammes: vi.fn(),
  getScopedProgrammes: vi.fn(),
}));

vi.mock("@/lib/current-viewer", () => ({ getDesktopViewer }));
vi.mock("@/lib/national-api", () => ({ getNationalProgrammes, getScopedProgrammes }));
vi.mock("@/lib/platform-api", () => ({ isDemoMode: () => false }));
vi.mock("@/i18n/server", async () => {
  const { en } = await import("@/i18n/messages/en");
  const { createTranslator } = await import("@/i18n/translate");
  return { getT: async () => createTranslator(en, "en") };
});

import ProgrammesPage from "./page";
import { ProgrammesView } from "@/components/dashboard/programmes/programmes-view";
import { getViewer } from "@/lib/access";

const props = (search: Record<string, string> = {}) => ({ params: Promise.resolve({}), searchParams: Promise.resolve(search) }) as never;

/** Issue #117: which endpoint D07 reads for each role. */
describe("D07 Programmes & Activities page", () => {
  beforeEach(() => {
    for (const mock of [getDesktopViewer, getNationalProgrammes, getScopedProgrammes]) mock.mockReset();
  });

  it("keeps HQ on the national figures", async () => {
    getDesktopViewer.mockResolvedValue(getViewer("hq-admin"));
    getNationalProgrammes.mockResolvedValue({ financialYear: { startYear: 2024 } });
    const page = await ProgrammesPage(props({ year: "2024", activity: "a1" }));
    expect(page.type).toBe(ProgrammesView);
    expect(page.props).toMatchObject({ role: "HQ_ADMIN", activityId: "a1", programmes: { financialYear: { startYear: 2024 } } });
    expect(getNationalProgrammes).toHaveBeenCalledWith(2024);
    expect(getScopedProgrammes).not.toHaveBeenCalled();
  });

  it("asks the API for the DM's, DDM's and SPC's own scope, never the national one", async () => {
    const coordinator = getViewer("programme-coordinator");
    for (const viewer of [getViewer("district-manager"), coordinator, { ...coordinator, role: "DEPUTY_DISTRICT_MANAGER" as const }]) {
      getDesktopViewer.mockResolvedValue(viewer);
      getScopedProgrammes.mockResolvedValue({ scope: { kind: "ASSIGNED" } });
      const page = await ProgrammesPage(props());
      expect(page.props.role).toBe(viewer.role);
    }
    expect(getScopedProgrammes).toHaveBeenCalledTimes(3);
    expect(getScopedProgrammes).toHaveBeenCalledWith(undefined);
    expect(getNationalProgrammes).not.toHaveBeenCalled();
  });

  it("lets a failed read reach the page's error state rather than showing zeros", async () => {
    getDesktopViewer.mockResolvedValue(getViewer("district-manager"));
    getScopedProgrammes.mockRejectedValue(new Error("The service is unavailable."));
    await expect(ProgrammesPage(props())).rejects.toThrow("The service is unavailable.");
  });
});
