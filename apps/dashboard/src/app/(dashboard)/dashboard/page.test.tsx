import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDesktopViewer, getHome, redirect } = vi.hoisted(() => ({
  getDesktopViewer: vi.fn(),
  getHome: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/current-viewer", () => ({ getDesktopViewer }));
vi.mock("@/lib/home-api", () => ({ getHome }));

import DashboardHome from "./page";
import { RoleHome } from "@/components/dashboard/role-home/role-home";
import { NationalOverview } from "@/components/dashboard/role-overviews";
import { getViewer } from "@/lib/access";

describe("dashboard role home routing", () => {
  beforeEach(() => {
    getDesktopViewer.mockReset();
    getHome.mockReset();
    redirect.mockClear();
  });

  it("shows the national overview to HQ administrators", async () => {
    getDesktopViewer.mockResolvedValue(getViewer("hq-admin"));

    const page = await DashboardHome();

    expect(page.type).toBe(NationalOverview);
    expect(getHome).not.toHaveBeenCalled();
  });

  it("gives district managers and coordinators their own home from the API (DM01, SP01)", async () => {
    for (const id of ["district-manager", "programme-coordinator"]) {
      const viewer = getViewer(id);
      getDesktopViewer.mockResolvedValue(viewer);
      getHome.mockResolvedValue({ role: viewer.role });

      const page = await DashboardHome();

      expect(page.type).toBe(RoleHome);
      expect(page.props).toMatchObject({ home: { role: viewer.role }, viewer });
    }
    expect(getHome).toHaveBeenCalledTimes(2);
  });

  it("sends platform administrators to administration", async () => {
    getDesktopViewer.mockResolvedValue(getViewer("system-admin"));

    await expect(DashboardHome()).rejects.toThrow("REDIRECT:/admin");
    expect(redirect).toHaveBeenCalledWith("/admin");
  });
});
