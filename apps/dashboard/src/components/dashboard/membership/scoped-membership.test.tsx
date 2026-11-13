import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScopedMembership } from "@sarvodaya-connect/api-contracts";

import { ENGLISH } from "@/i18n/english";
import { si } from "@/i18n/messages/si";
import { ta } from "@/i18n/messages/ta";
import { createTranslator } from "@/i18n/translate";
import { type DemoViewer, getViewer } from "@/lib/access";
import { navigationFor } from "@/lib/navigation";
import { canOpen } from "@/lib/role-routes";

import { ScopedMembershipView } from "./scoped-membership";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const viewer = (role: "PROGRAMME_COORDINATOR" | "DEPUTY_DISTRICT_MANAGER" | "DISTRICT_MANAGER"): DemoViewer => ({
  ...getViewer(role === "DISTRICT_MANAGER" ? "district-manager" : "programme-coordinator"),
  role,
});

const CATEGORIES = ["CHILDREN", "YOUTH", "MOTHERS", "ORDINARY", "ELDERS_COUNCIL"].map((category) => ({ category, female: 0, male: 0, total: 0 }));

function membership(overrides: Partial<ScopedMembership> = {}): ScopedMembership {
  return {
    scope: "DISTRICT_MANAGER",
    year: 2026,
    activeSocieties: 4,
    societiesReported: 3,
    female: 560,
    male: 440,
    total: 1000,
    categories: CATEGORIES.map((row) => (row.category === "YOUTH" ? { ...row, female: 560, male: 440, total: 1000 } : row)),
    districts: [{ id: "d1", name: "Fictional North", active: 4, female: 560, male: 440, total: 1000 }],
    profile: { societies: 4, members: 2040, withoutBreakdown: 1, withSplit: 3, female: 1000, male: 640 },
    districtView: null,
    ...overrides,
  };
}

describe("scoped Membership (issue #118)", () => {
  it("shows the HQ cards and tables for the DM's district only", () => {
    render(<ScopedMembershipView demo={false} membership={membership()} t={ENGLISH} viewer={viewer("DISTRICT_MANAGER")} />);
    expect(screen.getByText("Counts only — no personal data · all societies in Fictional North · latest counts, 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[3]).toHaveTextContent("1,000In 4 active societies");
    expect(screen.getByText("Societies reported · of 4 · 2026")).toBeInTheDocument();
    const districts = within(screen.getByRole("region", { name: "Members in Each District" }));
    expect(districts.getAllByRole("row")).toHaveLength(2);
    expect(districts.getByRole("link", { name: "Fictional North" })).toHaveAttribute("href", "/my-societies");
    expect(screen.getByRole("link", { name: "District Overview" })).toHaveAttribute("href", "/dashboard");
  });

  it("leads with the profile female, male and total, apart from the category counts (issue #141)", () => {
    render(<ScopedMembershipView demo={false} membership={membership()} t={ENGLISH} viewer={viewer("DISTRICT_MANAGER")} />);
    const profile = within(screen.getByRole("region", { name: "Members on Society Profiles" }));
    const cards = profile.getAllByRole("listitem").map((item) => item.textContent);
    expect(cards).toEqual(["2,040Total members · 4 society profiles", "1,000Female · 61% where female and male are entered", "640Male · 39% where female and male are entered"]);
    expect(profile.getByText("3 of 4 societies have entered their female and male members.")).toBeInTheDocument();
    expect(profile.getByText(/1 society has a total but no female\/male split yet/)).toBeInTheDocument();
    // The category figures keep their own heading, year and numbers.
    expect(screen.getByText("Category counts · 2026")).toBeInTheDocument();
    expect(screen.getByText(/Never added to the profile members above/)).toBeInTheDocument();
    expect(screen.getByText("1 of these societies has no category counts for 2026.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[3]).toHaveTextContent("1,000In 4 active societies");
  });

  it("says when no profile has members instead of showing zeros", () => {
    render(<ScopedMembershipView demo={false} membership={membership({ profile: { societies: 0, members: 0, withoutBreakdown: 0, withSplit: 0, female: 0, male: 0 } })} t={ENGLISH} viewer={viewer("DISTRICT_MANAGER")} />);
    const profile = within(screen.getByRole("region", { name: "Members on Society Profiles" }));
    expect(profile.getByText("No active society has entered its members on its profile yet.")).toBeInTheDocument();
    expect(profile.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("says when nothing is reported instead of showing zero as a count", () => {
    render(
      <ScopedMembershipView
        demo={false}
        membership={membership({ year: null, societiesReported: 0, female: 0, male: 0, total: 0, categories: CATEGORIES, profile: { societies: 2, members: 2040, withoutBreakdown: 2, withSplit: 0, female: 0, male: 0 } })}
        t={ENGLISH}
        viewer={viewer("DISTRICT_MANAGER")}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("No Membership Counts Yet");
    expect(screen.getByText("2 of these societies have not entered category counts yet.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no active societies in scope", () => {
    render(<ScopedMembershipView demo={false} membership={membership({ scope: "MINE", activeSocieties: 0, districts: [], profile: { societies: 0, members: 0, withoutBreakdown: 0, withSplit: 0, female: 0, male: 0 } })} t={ENGLISH} viewer={viewer("PROGRAMME_COORDINATOR")} />);
    expect(screen.getByRole("heading", { name: "No Active Societies" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Members in Each District" })).not.toBeInTheDocument();
  });

  it("offers a DDM the district tab only while temporary access is valid", () => {
    const { unmount } = render(<ScopedMembershipView demo={false} membership={membership({ scope: "MINE", districtView: { available: false, expiresAt: null } })} t={ENGLISH} viewer={viewer("DEPUTY_DISTRICT_MANAGER")} />);
    expect(screen.queryByRole("link", { name: "District · view only" })).not.toBeInTheDocument();
    unmount();
    render(
      <ScopedMembershipView
        demo={false}
        membership={membership({ scope: "DISTRICT", districtView: { available: true, expiresAt: "2026-11-12T12:30:00Z" } })}
        t={ENGLISH}
        viewer={viewer("DEPUTY_DISTRICT_MANAGER")}
      />,
    );
    expect(screen.getByRole("link", { name: "District · view only" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Fictional North" })).toHaveAttribute("href", "/my-societies?scope=DISTRICT");
  });

  it.each([
    ["si", si],
    ["ta", ta],
  ] as const)("is translated in %s", (locale, messages) => {
    render(<ScopedMembershipView demo={false} membership={membership()} t={createTranslator(messages, locale)} viewer={viewer("DISTRICT_MANAGER")} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(messages["nav.membership"]);
    expect(document.body).not.toHaveTextContent("Members on Society Profiles");
    expect(document.body).toHaveTextContent(messages["mb.profileHeading"]);
    expect(document.body).not.toHaveTextContent("female/male split");
    expect(document.body).toHaveTextContent("Fictional North");
  });

  it.each(["PROGRAMME_COORDINATOR", "DEPUTY_DISTRICT_MANAGER", "DISTRICT_MANAGER"] as const)("lets %s open Membership from the sidebar", (role) => {
    expect(canOpen(role, "/membership")).toBe(true);
    expect(canOpen(role, "/districts")).toBe(false);
    expect(navigationFor(viewer(role)).main.map((item) => item.href)).toContain("/membership");
  });
});
