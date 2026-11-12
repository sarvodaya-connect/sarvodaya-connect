import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HomeSocietyList, HomeSummary } from "@sarvodaya-connect/api-contracts";

import { en } from "@/i18n/messages/en";
import { si } from "@/i18n/messages/si";
import { ta } from "@/i18n/messages/ta";
import { createTranslator } from "@/i18n/translate";
import { getViewer } from "@/lib/access";
import { parseSocietyFilters } from "@/lib/home-format";
import { canOpen, noAccessPathFor } from "@/lib/role-routes";

import { MySocieties } from "./my-societies";
import { RoleHome } from "./role-home";

vi.mock("@/app/(dashboard)/district-access/actions", () => ({ endDistrictAccess: vi.fn(), giveDistrictAccess: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const now = new Date("2026-10-26T03:30:00Z"); // 9:00 a.m. in Sri Lanka

function home(overrides: Partial<HomeSummary> = {}): HomeSummary {
  return {
    role: "PROGRAMME_COORDINATOR",
    generatedAt: now.toISOString(),
    financialYear: { startYear: 2025, label: "FY 2025/26" },
    planYear: 2027,
    district: { id: "d1", name: "Kurunegala" },
    societies: { total: 12, active: 12, notActive: 0, grades: { A: 2, B: 4, C: 6 }, members: null },
    viewOnly: false,
    gradeRequests: { pending: 1, latest: { societyName: "Pahala Kosgama SSS", requestedAt: "2026-10-24T03:30:00Z" } },
    notUpdated: { days: 90, count: 2, societyNames: ["Hettipola SSS", "Wariyapola SSS"] },
    yearlySummaryMissing: 3,
    societiesWithPlan: 8,
    activitiesWaiting: 1,
    needsAttention: [
      { societyId: "s1", societyName: "Pahala Kosgama SSS", grade: "B", reason: "Activity to approve: Youth leadership camp", editable: true },
      { societyId: "s1", societyName: "Pahala Kosgama SSS", grade: "B", reason: "Grade request B → A waiting for HQ", pendingGrade: { from: "B", to: "A" }, editable: true },
      { societyId: "s2", societyName: "Hettipola SSS", grade: "C", reason: "Not updated for 146 days", editable: true },
    ],
    recent: [
      {
        societyId: "s1",
        societyName: "Pahala Kosgama SSS",
        action: "SOCIETY_MEMBERSHIP_UPDATED",
        detail: "Members 412 → 418",
        actorName: "N. Wijesinghe",
        actorRole: "SOCIETY_OFFICER",
        at: "2026-10-26T02:00:00Z",
      },
    ],
    staff: [],
    temporaryAccess: [],
    districtViewCount: null,
    recentlyEnded: null,
    incidents: [],
    ...overrides,
  };
}

const noBars = (container: HTMLElement) => {
  expect(container.querySelector('[role="progressbar"]')).toBeNull();
  expect(container.querySelector('[style*="width"]')).toBeNull();
};

describe("SP01 SPC home", () => {
  it("shows the five figures, what needs attention and the latest changes", () => {
    const { container } = render(<RoleHome home={home()} now={now} viewer={getViewer("programme-coordinator")} />);

    expect(screen.getByRole("heading", { level: 1, name: "Good morning, P. Wickramasinghe" })).toBeInTheDocument();
    expect(screen.getByText("Society Program Coordinator (SPC) · Monday 26 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Your access: 12 assigned societies · view and edit. Grade changes are decided by HQ.");
    expect(screen.getByText("A 2 · B 4 · C 6")).toBeInTheDocument();
    expect(screen.getByText("Pahala Kosgama SSS · 2 days")).toBeInTheDocument();
    expect(screen.getByText("Hettipola SSS, Wariyapola SSS")).toBeInTheDocument();
    expect(screen.getByText("Societies With a 2027 Plan")).toBeInTheDocument();

    const attention = within(screen.getByRole("region", { name: "Needs Attention" }));
    expect(attention.getAllByRole("link", { name: "Pahala Kosgama SSS" })[0]).toHaveAttribute("href", "/societies/s1");
    expect(attention.getByText("Activity to approve: Youth leadership camp")).toBeInTheDocument();
    expect(attention.getAllByText("Editable")).toHaveLength(3);
    expect(attention.getByRole("link", { name: "All 12 societies" })).toHaveAttribute("href", "/my-societies");

    expect(screen.getByText("Membership · Members 412 → 418 · Pahala Kosgama SSS")).toBeInTheDocument();
    expect(screen.getByText("N. Wijesinghe (Society Officer) · Today")).toBeInTheDocument();
    noBars(container);
  });

  it("says when nothing needs attention", () => {
    render(<RoleHome home={home({ needsAttention: [], recent: [] })} now={now} viewer={getViewer("programme-coordinator")} />);
    expect(screen.getByText("Nothing needs attention right now.")).toBeInTheDocument();
    expect(screen.getByText("No changes in your societies yet.")).toBeInTheDocument();
  });

  it("shows active incidents as an alert that opens the incident (PR 8)", () => {
    render(
      <RoleHome
        home={home({
          incidents: [
            {
              id: "i1",
              title: "Floods — North Western",
              type: "FLOOD",
              districtName: "Kurunegala",
              openedAt: "2026-10-25T00:40:00Z",
              openedByName: "N. Wijesinghe",
              openedByRole: "SOCIETY_OFFICER",
              reference: "INC-2026-09",
              assessmentsDueAt: "2026-10-27T12:30:00Z",
            },
          ],
        })}
        now={now}
        viewer={getViewer("programme-coordinator")}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Active incident INC-2026-09 · Floods — North Western. Opened by N. Wijesinghe (Society Officer) yesterday · assessments due Tue 27 Oct, 6:00 p.m.",
    );
    expect(within(alert).getByRole("link", { name: "Open incident" })).toHaveAttribute("href", "/emergencies/i1");
    // SP01 card 3: both buttons work.
    const card = screen.getByRole("region", { name: "Incidents" });
    expect(within(card).getByRole("link", { name: /Open incident/ })).toHaveAttribute("href", "/emergencies/i1");
    expect(within(card).getByRole("link", { name: /Report an incident/ })).toHaveAttribute("href", "/dashboard?report=incident");
  });

  it("lets SPCs, DDMs and DMs open the disaster response pages", () => {
    for (const role of ["PROGRAMME_COORDINATOR", "DEPUTY_DISTRICT_MANAGER", "DISTRICT_MANAGER"]) {
      expect(canOpen(role, "/emergencies")).toBe(true);
      expect(canOpen(role, "/emergencies/3f2a9c1e-1b2c-4d5e-8f90-123456789abc")).toBe(true);
      expect(canOpen(role, "/emergencies/not-an-id")).toBe(false);
    }
  });
});

describe("DD01 DDM home", () => {
  const ddm = { ...getViewer("programme-coordinator"), role: "DEPUTY_DISTRICT_MANAGER" as const, displayName: "P. Dissanayake" };

  it("shows the district only with temporary access", () => {
    const { rerender } = render(<RoleHome home={home({ role: "DEPUTY_DISTRICT_MANAGER" })} now={now} viewer={ddm} />);
    expect(screen.getByText("Deputy District Manager (DDM) · Kurunegala · Monday 26 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Only with temporary access from your DM")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "District-Wide View" })).toBeInTheDocument();
    expect(screen.getByText(/None active\. When your DM is away/)).toBeInTheDocument();

    rerender(
      <RoleHome
        home={home({
          role: "DEPUTY_DISTRICT_MANAGER",
          districtViewCount: 106,
          temporaryAccess: [{ id: "g1", deputyName: "P. Dissanayake", districtName: "Kurunegala", startsAt: "2026-10-25T00:00:00Z", expiresAt: "2026-10-31T12:30:00Z", grantedByName: "R. Fernando", grantedAt: "2026-10-25T03:40:00Z", societiesOpened: 9, districtSocietyCount: 106 }],
        })}
        now={now}
        viewer={ddm}
      />,
    );
    expect(screen.getByText("106")).toBeInTheDocument();
    expect(screen.getByText("View only · until Sat 31 Oct, 6:00 p.m.")).toBeInTheDocument();
  });
});

describe("DM01 DM district overview", () => {
  it("is view only, with grades, staff and the SPC for each society", () => {
    const { container } = render(
      <RoleHome
        home={home({
          role: "DISTRICT_MANAGER",
          viewOnly: true,
          societies: { total: 106, active: 98, notActive: 8, grades: { A: 14, B: 18, C: 66 }, members: 9412 },
          needsAttention: [
            { societyId: "s3", societyName: "Thalawa SSS", grade: "C", reason: "Not updated for 226 days", spcName: "M. Herath", editable: false },
          ],
          staff: [
            { id: "u1", displayName: "P. Dissanayake", role: "DEPUTY_DISTRICT_MANAGER", societyCount: 18, notUpdatedCount: 3 },
            { id: "u2", displayName: "S. Karunaratne", role: "PROGRAMME_COORDINATOR", societyCount: 12, notUpdatedCount: 2 },
          ],
          temporaryAccess: [{ id: "g1", deputyName: "P. Dissanayake", districtName: "Kurunegala", startsAt: "2026-10-25T00:00:00Z", expiresAt: "2026-10-31T12:30:00Z", grantedByName: "R. Fernando", grantedAt: "2026-10-25T03:40:00Z", societiesOpened: 9, districtSocietyCount: 106 }],
        })}
        now={now}
        viewer={getViewer("district-manager")}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "District Overview" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Your access: all 106 Kurunegala societies · view only.");
    expect(screen.getByText("98 active · 8 not active")).toBeInTheDocument();
    expect(screen.getByText("9,412")).toBeInTheDocument();

    const grades = within(screen.getByRole("region", { name: "Grades in Kurunegala" }));
    expect(grades.getByText("66")).toBeInTheDocument();
    expect(grades.getByText("8 not active. Grades change only with HQ approval.")).toBeInTheDocument();

    const staff = within(screen.getByRole("region", { name: "DDMs and SPCs (2)" }));
    expect(staff.getByText("P. Dissanayake (DDM)")).toBeInTheDocument();
    expect(staff.getByText("S. Karunaratne (SPC)")).toBeInTheDocument();

    const attention = within(screen.getByRole("region", { name: "Societies to Follow Up With Your Staff" }));
    expect(attention.getByText("M. Herath")).toBeInTheDocument();
    expect(attention.getByText("View only")).toBeInTheDocument();
    expect(attention.queryByText("Editable")).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Active grant" })).toBeInTheDocument();
    // V5 PR 7: the DM can see the grant's history or end it early from DM01.
    expect(screen.getByRole("link", { name: "See details" })).toHaveAttribute("href", "/district-access?grant=g1");
    expect(screen.getByRole("button", { name: "End now" })).toBeInTheDocument();
    expect(screen.getByText(/View only · all 106 societies · ends Sat 31 Oct, 6:00 p.m. · 5 days left/)).toBeInTheDocument();
    noBars(container);
  });
});

function list(overrides: Partial<HomeSocietyList> = {}): HomeSocietyList {
  return {
    data: [
      {
        id: "s1",
        societyCode: "S-104233",
        nameEn: "Pahala Kosgama SSS",
        nameLocal: "පහළ කොස්ගම සර්වෝදය සමිතිය",
        grade: "B",
        pendingGrade: { from: "B", to: "A" },
        members: 418,
        officerName: "N. Wijesinghe",
        spcName: "S. Karunaratne",
        ddmName: "P. Dissanayake",
        dsDivision: "Kuliyapitiya East",
        updatedAt: "2026-10-26T02:00:00Z",
        stale: false,
        editable: true,
        yours: false,
      },
      {
        id: "s2",
        societyCode: "S-104536",
        nameEn: "Hettipola SSS",
        nameLocal: null,
        grade: "C",
        pendingGrade: null,
        members: null,
        officerName: null,
        spcName: null,
        ddmName: null,
        dsDivision: null,
        updatedAt: "2026-06-02T02:00:00Z",
        stale: true,
        editable: true,
        yours: false,
      },
    ],
    meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
    scopeTotal: 12,
    viewOnly: false,
    scope: "MINE",
    tabs: { mine: 12, district: null },
    access: null,
    recentlyEnded: null,
    district: { id: "d1", name: "Kurunegala" },
    options: { dsDivisions: ["Kuliyapitiya East"], spcs: [{ id: "u2", name: "S. Karunaratne" }], ddms: [{ id: "u1", name: "P. Dissanayake" }] },
    ...overrides,
  };
}

describe("SP02 / DM02 society lists", () => {
  it("SP02: the SPC sees officers, their access and stale dates", () => {
    render(<MySocieties filters={{}} list={list()} now={now} />);
    expect(screen.getByRole("heading", { level: 1, name: "My Societies" })).toBeInTheDocument();
    expect(screen.getByText("12 societies assigned to you by HQ")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("columnheader", { name: "Society Officer" })).toBeInTheDocument();
    expect(table.queryByRole("columnheader", { name: "SPC" })).not.toBeInTheDocument();
    expect(table.getByText("B → A with HQ")).toBeInTheDocument();
    expect(table.getByText("Not assigned")).toBeInTheDocument();
    expect(table.getByText("Not recorded")).toBeInTheDocument();
    expect(table.getByText("02 Jun")).toHaveClass("text-danger-text");
    expect(table.getAllByText("Editable")).toHaveLength(2);
    expect(screen.getByText("Showing 1–2 of 2 assigned societies")).toBeInTheDocument();
    expect(screen.getByText("Why can't I see other societies?")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("DM02: the DM's list is view only, with SPC and DDM columns and their filters", () => {
    render(<MySocieties filters={{ grade: "B" }} list={list({ viewOnly: true, scopeTotal: 106 })} now={now} />);
    expect(screen.getByRole("heading", { level: 1, name: "Societies" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("all 106 Kurunegala societies · view only");
    expect(screen.getByRole("combobox", { name: "SPC" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Grade" })).toHaveValue("B");
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("columnheader", { name: "DDM" })).toBeInTheDocument();
    expect(table.queryByRole("columnheader", { name: "Your Access" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/my-societies");
  });

  it("says when filters match nothing, and pages through long lists", () => {
    const { rerender } = render(<MySocieties filters={{ q: "zzz" }} list={list({ data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } })} now={now} />);
    expect(screen.getByText("No Societies Match These Filters")).toBeInTheDocument();

    rerender(<MySocieties filters={{ grade: "C", page: "2" }} list={list({ meta: { page: 2, pageSize: 20, totalItems: 45, totalPages: 3 } })} now={now} />);
    expect(screen.getByRole("link", { name: "‹ Previous" })).toHaveAttribute("href", "/my-societies?grade=C");
    expect(screen.getByRole("link", { name: "Next ›" })).toHaveAttribute("href", "/my-societies?grade=C&page=3");
  });
});

describe("role pages and filters", () => {
  it("keeps SPCs, DDMs and DMs to their own pages", () => {
    const record = "/societies/3f2b8c1e-7a4d-4b8e-9c2a-1d5e6f7a8b9c";
    for (const role of ["PROGRAMME_COORDINATOR", "DEPUTY_DISTRICT_MANAGER", "DISTRICT_MANAGER"]) {
      for (const path of ["/dashboard", "/my-societies", "/membership", "/compliance", record, `${record}/exco`, "/activities-to-approve"]) expect(canOpen(role, path)).toBe(true);
      for (const path of ["/accounts", "/audit", "/reviews", "/societies", "/societies/new", "/search", "/districts/kurunegala", "/sarvoai", "/sarvoai?q=x"])
        expect(canOpen(role, path)).toBe(false);
    }
    expect(canOpen("HQ_ADMIN", "/accounts")).toBe(true);
    expect(canOpen("HQ_ADMIN", "/sarvoai")).toBe(true);
    expect(noAccessPathFor("/sarvoai")).toBe("/no-access?page=sarvoai");
    expect(noAccessPathFor("/accounts")).toBe("/no-access?page=hq");
    expect(canOpen(undefined, "/accounts")).toBe(true);
  });

  it("drops filter values the list does not understand", () => {
    expect(
      parseSocietyFilters({ q: ["  Kosgama ", "x"], grade: "Z", needsUpdate: "maybe", gradeRequest: "PENDING", spcId: "../admin", page: "0", other: "x" }),
    ).toEqual({ q: "Kosgama", gradeRequest: "PENDING" });
  });
});

describe.each([
  ["si", si, "සුභ උදෑසනක්", "පවරා ඇති සමිති"],
  ["ta", ta, "காலை வணக்கம்", "ஒதுக்கப்பட்ட"],
] as const)("the role home in %s", (locale, messages, greet, assigned) => {
  const t = createTranslator(messages, locale);

  it("shows its own text in that language and leaves stored names alone", () => {
    render(<RoleHome home={home()} now={now} t={t} viewer={getViewer("PROGRAMME_COORDINATOR")} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(greet);
    expect(document.body).toHaveTextContent(assigned);
    expect(document.body).toHaveTextContent("Pahala Kosgama SSS");
    for (const english of [en["home.morning"], en["home.needsAttention"], en["home.incidents"], en["home.requestsHq"]]) {
      expect(document.body).not.toHaveTextContent(english);
    }
  });
});
