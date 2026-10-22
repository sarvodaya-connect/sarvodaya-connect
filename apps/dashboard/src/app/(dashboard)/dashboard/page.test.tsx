import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentViewer, redirect } = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/current-viewer", () => ({ getCurrentViewer }));

import DashboardHome from "./page";
import { CoordinatorOverview } from "@/components/dashboard/coordinator-overview";
import { DistrictOverview, NationalOverview } from "@/components/dashboard/role-overviews";
import { getViewer } from "@/lib/access";

describe("dashboard role home routing", () => {
  beforeEach(() => {
    getCurrentViewer.mockReset();
    redirect.mockClear();
  });

  it("shows the national overview to HQ administrators", async () => {
    getCurrentViewer.mockResolvedValue(getViewer("hq-admin"));

    const page = await DashboardHome();

    expect(page.type).toBe(NationalOverview);
  });

  it("shows the district overview to district managers", async () => {
    getCurrentViewer.mockResolvedValue(getViewer("district-manager"));

    const page = await DashboardHome();

    expect(page.type).toBe(DistrictOverview);
  });

  it("sends platform administrators to administration", async () => {
    getCurrentViewer.mockResolvedValue(getViewer("system-admin"));

    await expect(DashboardHome()).rejects.toThrow("REDIRECT:/admin");
    expect(redirect).toHaveBeenCalledWith("/admin");
  });

  it("shows the coordinator overview to programme coordinators", async () => {
    getCurrentViewer.mockResolvedValue(getViewer("programme-coordinator"));

    const page = await DashboardHome();

    expect(page.type).toBe(CoordinatorOverview);
  });
});
