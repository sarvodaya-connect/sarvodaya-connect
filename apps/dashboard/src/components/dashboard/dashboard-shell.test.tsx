import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getViewer, type DemoViewer } from "@/lib/access";

import { DashboardShell } from "./dashboard-shell";

const pathname = vi.hoisted(() => ({ current: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));
vi.mock("@/app/identity-actions", () => ({ signOut: vi.fn() }));

function renderShell(viewer: DemoViewer, unread = 0) {
  return render(
    <DashboardShell unreadCount={unread} viewer={viewer}>
      <p>Page body</p>
    </DashboardShell>,
  );
}

const desktopNav = () => screen.getAllByRole("navigation", { name: "Main Navigation" })[0]!;

describe("V5 dashboard shell", () => {
  beforeEach(() => {
    pathname.current = "/dashboard";
  });

  it("shows the HQ controls, sidebar and signed-in user, and leaves the heading to the page", () => {
    renderShell(getViewer("hq-admin"), 3);

    // One main heading per page: the page names itself, so the shell has none.
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("Shramadana Societies Across Sri Lanka")).not.toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Search societies by name, S number or district…")).not.toHaveLength(0);
    expect(screen.getByRole("link", { name: "Alerts, 3 New" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("button", { name: "Account: K. Fernando · Sign Out" })).toBeInTheDocument();

    const nav = within(desktopNav());
    expect(nav.getByRole("link", { name: "National Overview" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/accounts");
    expect(nav.getByText("HQ · All districts")).toBeInTheDocument();
    expect(screen.getByText("Page body")).toBeInTheDocument();
  });

  it("marks Administration active on the change log", () => {
    pathname.current = "/audit";
    renderShell(getViewer("hq-admin"));

    expect(within(desktopNav()).getByRole("link", { name: "Administration" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("puts Review Queue after Requests & Tasks and before Reports", () => {
    renderShell(getViewer("hq-admin"));
    const labels = within(desktopNav()).getAllByRole("link").map((link) => link.textContent);
    const at = (label: string) => labels.indexOf(label);
    expect(at("Review Queue")).toBe(at("Requests & Tasks") + 1);
    expect(at("Reports")).toBe(at("Review Queue") + 1);
  });

  it("gives coordinators a scoped search and no HQ pages", () => {
    pathname.current = "/activities-to-approve";
    renderShell(getViewer("programme-coordinator"));

    const nav = within(desktopNav());
    // V5 SP01 sidebar: Home, My societies, Activities to approve.
    expect(nav.getByRole("link", { name: "Activities to Approve" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/dashboard");
    expect(nav.getByRole("link", { name: "My Societies" })).toHaveAttribute("href", "/my-societies");
    expect(nav.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
    expect(nav.getByText("SPC · 3 assigned societies")).toBeInTheDocument();
    // The header search looks only through the SPC's own societies.
    const search = screen.getAllByPlaceholderText("Search your 3 societies…")[0]!;
    expect(search.closest("form")).toHaveAttribute("action", "/my-societies");
    expect(screen.getByRole("link", { name: "Alerts" })).toBeInTheDocument();
  });

  it("gives District Managers no header heading either", () => {
    renderShell(getViewer("district-manager"));

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("Kurunegala District · View Only")).not.toBeInTheDocument();
  });
});

describe("Redesigned shell", () => {
  beforeEach(() => {
    pathname.current = "/dashboard";
  });

  const logo = () => screen.getByRole("img", { name: "Sarvodaya Connect" });

  it("gives HQ the redesigned shell with SarvoAI, search, alerts and account", () => {
    renderShell(getViewer("hq-admin"), 2);

    // The wordmark on the light band at the top of the sidebar, not the white lettering.
    expect(logo().getAttribute("src")).toContain("sarvodaya-connect-wordmark.png");
    expect(logo().closest("a")).toHaveClass("bg-canvas");
    expect(screen.getByRole("link", { name: /SarvoAI/ })).toHaveAttribute("href", "/sarvoai");
    expect(screen.getByRole("link", { name: "Alerts, 2 New" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("button", { name: "Account: K. Fernando · Sign Out" })).toBeInTheDocument();
    // The controls float: no strip, line or blur behind them.
    const header = document.querySelector("header")!;
    expect(header.className).not.toMatch(/\bbg-|border-b|backdrop-blur/);
    // The headquarters outline sits behind the page (a CSS module class on the shell).
    expect(header.closest("[class*='canvas']")).not.toBeNull();
  });

  const deputy: DemoViewer = {
    id: "deputy-district-manager",
    displayName: "Sample Deputy",
    initials: "SD",
    role: "DEPUTY_DISTRICT_MANAGER",
    roleLabel: "Deputy District Manager",
    scopeLabel: "1 society",
    districtIds: [],
    societyIds: ["society-sample"],
  };

  it.each([
    ["SPC", getViewer("programme-coordinator"), "SPC · 3 assigned societies"],
    ["DDM", deputy, "DDM · 1 Society"],
    ["DM", getViewer("district-manager"), "DM · Kurunegala District"],
  ])("gives the %s the redesigned shell, without HQ-only SarvoAI", (_role, viewer, scope) => {
    renderShell(viewer);

    expect(logo().getAttribute("src")).toContain("sarvodaya-connect-wordmark.png");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /SarvoAI/ })).not.toBeInTheDocument();
    expect(within(desktopNav()).getByText(scope)).toBeInTheDocument();
    expect(within(desktopNav()).queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  });

  it("keeps the V5 shell for the System Administrator", () => {
    renderShell(getViewer("system-admin"));

    expect(logo().getAttribute("src")).toContain("sarvodaya-connect-wordmark");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(document.querySelector("header")!.className).not.toMatch(/\bbg-|border-b/);
    expect(document.querySelector("main")?.className).toBe("min-w-0 flex-1 px-4 pb-8 pt-[18px] md:px-7");
  });

  it("shows the demonstration Preview as switch only when the layout passes one", () => {
    const { unmount } = renderShell(getViewer("programme-coordinator"));
    expect(screen.queryByLabelText("Preview as (Demo)")).not.toBeInTheDocument();
    unmount();
    render(
      <DashboardShell preview={{ action: vi.fn(), current: "programme-coordinator", options: [{ id: "hq-admin", label: "HQ" }, { id: "programme-coordinator", label: "SPC" }] }} viewer={getViewer("programme-coordinator")}>
        <p>Page body</p>
      </DashboardShell>,
    );
    expect(screen.getAllByLabelText("Preview as (Demo)")[0]).toHaveValue("programme-coordinator");
  });
});
