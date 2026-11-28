import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type SegmentItem, TabLinks } from "./nav-segments";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const SOCIETY = "/societies/29000000-0000-4000-8000-000000000101";

function at(url: string) {
  window.history.replaceState(null, "", url);
}

function tabs(items: SegmentItem[]) {
  render(<TabLinks items={items} label="Tabs" />);
}

describe("TabLinks", () => {
  beforeEach(() => push.mockClear());

  it("moves from a nested page to its current tab's own page", async () => {
    at(`${SOCIETY}/work-plan/new`);
    tabs([
      { href: SOCIETY, key: "overview", label: "Overview", current: false },
      { href: `${SOCIETY}/work-plan`, key: "work-plan", label: "Work plan", current: true },
    ]);
    const tab = screen.getByRole("link", { name: "Work plan" });
    expect(tab).toHaveAttribute("aria-current", "page");
    await userEvent.click(tab);
    expect(push).toHaveBeenCalledWith(`${SOCIETY}/work-plan`, { scroll: false });
  });

  it("drops a later page of the list when the current view is chosen again", async () => {
    at("/societies?page=2");
    tabs([
      { href: "/societies", key: "all", label: "All", current: true },
      { href: "/societies?view=stale", key: "stale", label: "Stale", current: false },
    ]);
    await userEvent.click(screen.getByRole("link", { name: "All" }));
    expect(push).toHaveBeenCalledWith("/societies", { scroll: false });
  });

  it("stays put when the tab leads to the address already shown", async () => {
    at("/societies");
    tabs([
      { href: "/societies", key: "all", label: "All", current: true },
      { href: "/societies?view=stale", key: "stale", label: "Stale", current: false },
    ]);
    await userEvent.click(screen.getByRole("link", { name: "All" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("moves to another tab", async () => {
    at("/societies");
    tabs([
      { href: "/societies", key: "all", label: "All", current: true },
      { href: "/societies?view=stale", key: "stale", label: "Stale", current: false },
    ]);
    const tab = screen.getByRole("link", { name: "Stale" });
    expect(tab).not.toHaveAttribute("aria-current");
    await userEvent.click(tab);
    expect(push).toHaveBeenCalledWith("/societies?view=stale", { scroll: false });
  });
});
