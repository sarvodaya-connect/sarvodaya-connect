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
    profile: { societies: 4, members: 2040, withoutBreakdown: 1 },
    districtView: null,
    ...overrides,
  };
}

describe("scoped Membership (issue #118)", () => {
  it("shows the HQ cards and tables for the DM's district only", () => {
    render(<ScopedMembershipView demo={false} membership={membership()} t={ENGLISH} viewer={viewer("DISTRICT_MANAGER")} />);
    expect(screen.getByText("Counts only — no personal data · all societies in Fictional North · latest counts, 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("1,000In 4 active societies");
    expect(screen.getByText("Societies reported · of 4 · 2026")).toBeInTheDocument();
    const districts = within(screen.getByRole("region", { name: "Members in Each District" }));
    expect(districts.getAllByRole("row")).toHaveLength(2);
    expect(districts.getByRole("link", { name: "Fictional North" })).toHaveAttribute("href", "/my-societies");
    expect(screen.getByRole("link", { name: "District Overview" })).toHaveAttribute("href", "/dashboard");
  });

  it("keeps the profile member count apart from the breakdown", () => {
    render(<ScopedMembershipView demo={false} membership={membership()} t={ENGLISH} viewer={viewer("DISTRICT_MANAGER")} />);
    const profile = within(screen.getByRole("region", { name: "Society Profile Member Counts" }));
    expect(profile.getByText(/record 2,040 members across 4 active societies/)).toBeInTheDocument();
    expect(profile.getByText("1 of these societies has no category counts for 2026.")).toBeInTheDocument();
  });

  it("says when nothing is reported instead of showing zero as a count", () => {
    render(
      <ScopedMembershipView
        demo={false}
        membership={membership({ year: null, societiesReported: 0, female: 0, male: 0, total: 0, categories: CATEGORIES, profile: { societies: 2, members: 2040, withoutBreakdown: 2 } })}
        t={ENGLISH}
        viewer={viewer("DISTRICT_MANAGER")}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("No Membership Counts Yet");
    expect(screen.getByText("2 of these societies have not entered category counts yet.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no active societies in scope", () => {
    render(<ScopedMembershipView demo={false} membership={membership({ scope: "MINE", activeSocieties: 0, districts: [], profile: { societies: 0, members: 0, withoutBreakdown: 0 } })} t={ENGLISH} viewer={viewer("PROGRAMME_COORDINATOR")} />);
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
    expect(document.body).not.toHaveTextContent("Society Profile Member Counts");
    expect(document.body).toHaveTextContent("Fictional North");
  });

  it.each(["PROGRAMME_COORDINATOR", "DEPUTY_DISTRICT_MANAGER", "DISTRICT_MANAGER"] as const)("lets %s open Membership from the sidebar", (role) => {
    expect(canOpen(role, "/membership")).toBe(true);
    expect(canOpen(role, "/districts")).toBe(false);
    expect(navigationFor(viewer(role)).main.map((item) => item.href)).toContain("/membership");
  });
});
