import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getViewer, type DemoViewer } from "@/lib/access";

import { DashboardShell } from "./dashboard-shell";
import { NotificationsProvider } from "./notifications-context";

const pathname = vi.hoisted(() => ({ current: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));
vi.mock("@/app/identity-actions", () => ({ signOut: vi.fn() }));

function renderShell(viewer: DemoViewer, unread = 0) {
  const notifications = Array.from({ length: unread }, (_, index) => ({
    id: `n${index}`,
    read: false,
  })) as never;
  return render(
    <NotificationsProvider initial={notifications}>
      <DashboardShell viewer={viewer}>
        <p>Page body</p>
      </DashboardShell>
    </NotificationsProvider>,
  );
}

const desktopNav = () => screen.getAllByRole("navigation", { name: "Main navigation" })[0]!;

describe("V5 dashboard shell", () => {
  beforeEach(() => {
    pathname.current = "/dashboard";
  });

  it("shows the HQ header, sidebar and signed-in user", () => {
    renderShell(getViewer("hq-admin"), 3);

    expect(screen.getByRole("heading", { level: 1, name: "National overview" })).toBeInTheDocument();
    expect(screen.getByText("Sarvodaya societies across Sri Lanka")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Search societies by name, S number or district…")).not.toHaveLength(0);
    expect(screen.getByRole("link", { name: "Alerts, 3 new" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("button", { name: "Account: K. Fernando · sign out" })).toBeInTheDocument();

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
    expect(screen.getByRole("heading", { level: 1, name: "Change & access log" })).toBeInTheDocument();
  });

  it("gives coordinators a scoped search and no HQ pages", () => {
    pathname.current = "/activities-to-approve";
    renderShell(getViewer("programme-coordinator"));

    const nav = within(desktopNav());
    // V5 PR 4: the SPC desktop opens with SP06; Home and My societies join in PR 6.
    expect(nav.getByRole("link", { name: "Activities to approve" })).toHaveAttribute("aria-current", "page");
    expect(nav.queryByRole("link", { name: "My societies" })).not.toBeInTheDocument();
    expect(nav.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
    expect(nav.getByText("SPC · 3 assigned societies")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Search your societies…")).not.toHaveLength(0);
    expect(screen.getByRole("link", { name: "Alerts" })).toBeInTheDocument();
  });

  it("tells District Managers their district is view only", () => {
    renderShell(getViewer("district-manager"));

    expect(screen.getByRole("heading", { level: 1, name: "District overview" })).toBeInTheDocument();
    expect(screen.getByText("Kurunegala District · view only")).toBeInTheDocument();
  });
});
