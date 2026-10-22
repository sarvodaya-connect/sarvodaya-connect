import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentViewer, redirect } = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/current-viewer", () => ({ getCurrentViewer }));

import ReportsPage from "./page";
import { getViewer } from "@/lib/access";

describe("reports role access", () => {
  beforeEach(() => {
    getCurrentViewer.mockReset();
    redirect.mockClear();
  });

  it("redirects System Administrators to platform administration", async () => {
    getCurrentViewer.mockResolvedValue(getViewer("system-admin"));

    await expect(ReportsPage()).rejects.toThrow("REDIRECT:/admin");
    expect(redirect).toHaveBeenCalledWith("/admin");
  });

  it("renders reports for authorized society-data roles", async () => {
    getCurrentViewer.mockResolvedValue(getViewer("hq-admin"));

    const page = await ReportsPage();

    expect(page.type).toBe("div");
  });
});
