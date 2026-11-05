import { beforeEach, describe, expect, it, vi } from "vitest";

const { isDemoMode, notFound } = vi.hoisted(() => ({
  isDemoMode: vi.fn(() => false),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/platform-api", () => ({ isDemoMode }));
vi.mock("./record-overview-page", () => ({ RecordOverviewPage: () => null }));

import SocietyPage, * as route from "./page";
import { RecordOverviewPage } from "./record-overview-page";

const id = "31c58e0c-8816-4d48-b4f8-4563b51710a4";
const props = (search: Record<string, string | string[] | undefined> = {}, recordId = id) => ({
  params: Promise.resolve({ id: recordId }),
  searchParams: Promise.resolve(search),
});

describe("society overview runtime rendering", () => {
  beforeEach(() => {
    isDemoMode.mockReturnValue(false);
    notFound.mockClear();
  });

  it("renders authenticated records per request instead of a static fallback", () => {
    expect(route.dynamic).toBe("force-dynamic");
    expect(route).not.toHaveProperty("generateStaticParams");
  });

  it("opens a newly created UUID record without requiring demonstration mode", async () => {
    const page = await SocietyPage(props());
    expect(page.type).toBe(RecordOverviewPage);
    expect(page.props).toEqual({ id, panel: undefined, saved: false });
    expect(notFound).not.toHaveBeenCalled();
  });

  it.each(["assign", "edit"])("reads the %s panel from request search parameters", async (panel) => {
    const page = await SocietyPage(props({ panel, saved: "1" }));
    expect(page.props).toEqual({ id, panel, saved: true });
  });

  it("does not interpret repeated query parameters as panel or success flags", async () => {
    const page = await SocietyPage(props({ panel: ["assign", "edit"], saved: ["1", "1"] }));
    expect(page.props).toEqual({ id, panel: undefined, saved: false });
  });

  it("keeps demonstration profile identifiers unavailable outside demonstration mode", async () => {
    await expect(SocietyPage(props({}, "fictional-society"))).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
