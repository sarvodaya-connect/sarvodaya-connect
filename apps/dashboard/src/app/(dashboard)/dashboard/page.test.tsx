import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDesktopViewer, getHome, redirect } = vi.hoisted(() => ({
  getDesktopViewer: vi.fn(),
  getHome: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/current-viewer", () => ({ getDesktopViewer }));
vi.mock("@/lib/home-api", () => ({ getHome }));
vi.mock("@/app/(dashboard)/district-access/actions", () => ({ endDistrictAccess: vi.fn(), giveDistrictAccess: vi.fn() }));
vi.mock("@/components/dashboard/emergencies/open-incident-panel", () => ({ OpenIncidentPanel: () => null }));

import DashboardHome from "./page";
import { RoleHome } from "@/components/dashboard/role-home/role-home";
import { NationalOverview } from "@/components/dashboard/role-overviews";
import { OpenIncidentPanel } from "@/components/dashboard/emergencies/open-incident-panel";
import { getViewer } from "@/lib/access";

const props = (search: Record<string, string> = {}) => ({ params: Promise.resolve({}), searchParams: Promise.resolve(search) }) as never;

describe("dashboard role home routing", () => {
  beforeEach(() => {
    getDesktopViewer.mockReset();
    getHome.mockReset();
    redirect.mockClear();
  });

  it("shows the national overview to HQ administrators", async () => {
    getDesktopViewer.mockResolvedValue(getViewer("hq-admin"));

    const page = await DashboardHome(props());

    expect(page.type).toBe(NationalOverview);
    expect(getHome).not.toHaveBeenCalled();
  });

  it("gives district managers and coordinators their own home from the API (DM01, SP01)", async () => {
    for (const id of ["district-manager", "programme-coordinator"]) {
      const viewer = getViewer(id);
      getDesktopViewer.mockResolvedValue(viewer);
      getHome.mockResolvedValue({ role: viewer.role });

      const page = await DashboardHome(props());

      const [home, panel] = page.props.children;
      expect(home.type).toBe(RoleHome);
      expect(home.props).toMatchObject({ home: { role: viewer.role }, viewer });
      expect(panel).toBe(false);
    }
    expect(getHome).toHaveBeenCalledTimes(2);
  });

  it("opens IR02 Report an incident over the role home", async () => {
    const viewer = getViewer("programme-coordinator");
    getDesktopViewer.mockResolvedValue(viewer);
    getHome.mockResolvedValue({ role: viewer.role });

    const page = await DashboardHome(props({ report: "incident" }));

    const [, panel] = page.props.children;
    expect(panel.type).toBe(OpenIncidentPanel);
    expect(panel.props).toMatchObject({ closeHref: "/dashboard", viewer });
  });

  it("sends platform administrators to administration", async () => {
    getDesktopViewer.mockResolvedValue(getViewer("system-admin"));

    await expect(DashboardHome(props())).rejects.toThrow("REDIRECT:/admin");
    expect(redirect).toHaveBeenCalledWith("/admin");
  });
});
