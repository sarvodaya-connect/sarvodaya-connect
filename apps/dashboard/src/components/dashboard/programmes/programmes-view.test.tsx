import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NationalProgrammes, ScopedProgrammes } from "@sarvodaya-connect/api-contracts";

import { I18nProvider } from "@/i18n/provider";
import { en } from "@/i18n/messages/en";
import { si } from "@/i18n/messages/si";
import { ta } from "@/i18n/messages/ta";
import { createTranslator, type Messages } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { getViewer } from "@/lib/access";
import { headingFor, navigationFor } from "@/lib/navigation";
import { canOpen } from "@/lib/role-routes";

import { ProgrammesView, scopeLine } from "./programmes-view";

/** Issue #117: D07 for HQ, DM, DDM and SPC. Every society and person is fictional. */

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const CATALOGS: Record<Locale, Messages> = { en, si, ta };

const national: NationalProgrammes = {
  financialYear: { startYear: 2025, label: "FY 2025/26", startsOn: "2025-04-01", endsOn: "2026-03-31" },
  planned: 3,
  completed: 2,
  sectors: [
    { sector: "Community education", planned: 2, completed: 2, societies: 1 },
    { sector: "Health and nutrition", planned: 1, completed: 0, societies: 1 },
  ],
  byDimension: [
    { dimension: "SOCIAL", planned: 3, completed: 2 },
    { dimension: "ECONOMIC", planned: 0, completed: 0 },
    { dimension: "GOVERNANCE", planned: 0, completed: 0 },
  ],
  sdgs: [
    { sdg: 4, completed: 2 },
    { sdg: 6, completed: 1 },
    ...[1, 2, 3, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((sdg) => ({ sdg, completed: 0 })),
  ],
  recent: [
    {
      id: "a1",
      name: "Fictional youth camp",
      sector: "Community education",
      dimension: "SOCIAL",
      society: { id: "29000000-0000-4000-8000-000000000101", name: "Fictional Sunrise Society" },
      approvedAt: "2025-09-20T04:00:00.000Z",
      approvedBy: "Fictional SPC",
      datesLabel: "12–14 Sep",
      year: 2025,
      femaleParticipants: 24,
      maleParticipants: 14,
      householdsBenefited: 146,
      createdBy: "Fictional Officer",
      sdgs: [4, 6],
    },
  ],
};

const scoped = (scope: Partial<ScopedProgrammes["scope"]> = {}, figures: Partial<NationalProgrammes> = {}): ScopedProgrammes => ({
  ...national,
  ...figures,
  scope: { kind: "ASSIGNED", societies: 2, districts: [], temporaryAccessEndsAt: null, ...scope },
});

function show(programmes: NationalProgrammes | ScopedProgrammes, role: Parameters<typeof ProgrammesView>[0]["role"], locale: Locale = "en") {
  const t = createTranslator(CATALOGS[locale], locale);
  return render(
    <I18nProvider available={["en", "si", "ta"]} locale={locale} messages={CATALOGS[locale]}>
      <ProgrammesView demo={false} programmes={programmes} role={role} t={t} />
    </I18nProvider>,
  );
}

describe("D07 Programmes & Activities", () => {
  beforeEach(() => vi.useRealTimers());

  it("keeps HQ's national page: no scope line, 10 sectors, all 17 SDGs ranked", () => {
    show(national, "HQ_ADMIN");
    expect(screen.getByRole("heading", { level: 1, name: "Programmes & Activities" })).toBeInTheDocument();
    expect(screen.queryByTestId("programme-scope")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "National Overview" })).toHaveAttribute("href", "/dashboard");
    const sectors = within(screen.getByRole("list", { name: "Sarvodaya 10-Sector Approach" })).getAllByRole("listitem");
    expect(sectors).toHaveLength(10);
    expect(sectors[0]).toHaveTextContent("Community education2 / 2 planned1 society");
    const ranked = within(screen.getByRole("region", { name: "SDGs Ranked by Completed Activities" })).getAllByRole("listitem");
    expect(ranked).toHaveLength(17);
    expect(ranked[0]).toHaveTextContent("#1SDG 4 · Quality Education2completed");
    // A goal with no completed activity is a real zero, not missing data.
    expect(ranked[2]).toHaveTextContent("—SDG 1 · No Poverty0None completed");
    expect(screen.getByRole("link", { name: "Open society work plan" })).toHaveAttribute("href", "/societies/29000000-0000-4000-8000-000000000101/work-plan");
  });

  it("says whose societies a DM, DDM and SPC see", () => {
    const t = createTranslator(en, "en");
    expect(scopeLine(scoped({ kind: "DISTRICT", societies: 12, districts: [{ id: "d1", name: "Kurunegala" }] }).scope, t)).toBe("Kurunegala · 12 societies");
    expect(scopeLine(scoped({ societies: 1 }).scope, t)).toBe("Your 1 assigned society");
    expect(
      scopeLine(
        scoped({ kind: "ASSIGNED_AND_DISTRICT", societies: 14, districts: [{ id: "d1", name: "Kurunegala" }], temporaryAccessEndsAt: "2026-11-08T12:30:00.000Z" }).scope,
        t,
      ),
    ).toBe("Your assigned societies and Kurunegala · 14 in all · temporary access until 8 Nov, 18:00");
  });

  it("gives a DM a breadcrumb home to the District Overview, and an SPC Home", () => {
    show(scoped({ kind: "DISTRICT", societies: 2, districts: [{ id: "d1", name: "Kurunegala" }] }), "DISTRICT_MANAGER");
    expect(screen.getByRole("link", { name: "District Overview" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByTestId("programme-scope")).toHaveTextContent("Counted overKurunegala · 2 societies");
  });

  it("tells a genuine zero year apart from missing figures", () => {
    const zero = scoped({}, { planned: 0, completed: 0, sectors: [], recent: [], sdgs: national.sdgs.map((row) => ({ ...row, completed: 0 })) });
    show(zero, "PROGRAMME_COORDINATOR");
    expect(screen.getByRole("status")).toHaveTextContent("No SPC-approved activities in FY 2025/26 for these societies yet. The zeros below are real counts, not missing data.");
    expect(screen.getByText("No activity has been approved yet.")).toBeInTheDocument();
  });

  it("shows an SPC with no assigned societies an empty state, not a national total", () => {
    show(scoped({ societies: 0 }, { planned: 0, completed: 0, sectors: [], recent: [] }), "PROGRAMME_COORDINATOR");
    expect(screen.getByText("No Societies Assigned Yet")).toBeInTheDocument();
    expect(screen.getByTestId("programme-scope")).toHaveTextContent("Your 0 assigned societies");
  });

  it.each(["si", "ta"] as const)("is translated in %s, keeping names as stored", (locale) => {
    const t = createTranslator(CATALOGS[locale], locale);
    show(scoped({ kind: "DISTRICT", societies: 2, districts: [{ id: "d1", name: "Kurunegala" }] }), "DISTRICT_MANAGER", locale);
    expect(screen.getByRole("heading", { level: 1, name: t("page.programmesActivities") })).toBeInTheDocument();
    expect(screen.getAllByText(t("sector.1")).length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain(t("sdg.4"));
    expect(screen.getByText("Fictional youth camp", { selector: "a" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("prog.openWorkPlan") })).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    for (const english of ["planned activities done", "Recent Activities", "By Dimension", "Activity Detail", "Open society work plan", "Quality Education", "Community education", "societies", "None completed", "Counted over"]) {
      expect(text, `"${english}" is still in English`).not.toContain(english);
    }
  });
});

describe("Programmes navigation for each role (issue #117)", () => {
  it("lists Programmes for DM, DDM and SPC, and lets them open /activities only", () => {
    const coordinator = getViewer("programme-coordinator");
    for (const viewer of [getViewer("district-manager"), coordinator, { ...coordinator, role: "DEPUTY_DISTRICT_MANAGER" as const }]) {
      expect(navigationFor(viewer).main.map((item) => item.href)).toContain("/activities");
      expect(canOpen(viewer.role, "/activities")).toBe(true);
      expect(headingFor("/activities", viewer).title).toBe("Programmes & Activities");
    }
    // Still HQ's alone: the reports and national drill-downs.
    expect(canOpen("DISTRICT_MANAGER", "/reports")).toBe(false);
    expect(canOpen("PROGRAMME_COORDINATOR", "/activities/other")).toBe(false);
    expect(navigationFor(getViewer("system-admin")).main.map((item) => item.href)).not.toContain("/activities");
  });
});

describe("approved activities whose month has not ended (issue #131)", () => {
  const inProgress: NationalProgrammes = {
    ...national,
    financialYear: { startYear: 2026, label: "FY 2026/27", startsOn: "2026-04-01", endsOn: "2027-03-31", inProgress: true },
    planned: 1,
    completed: 0,
    sdgs: [1, 17, ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]].map((sdg) => ({ sdg, completed: 0 })),
    recent: [{ ...national.recent[0]!, id: "a2", name: "Shramadana Service", year: 2026, month: 11, completed: false, sdgs: [1, 17] }],
  };

  it("offers the year in progress and explains its completed counts", () => {
    show(inProgress, "HQ_ADMIN");
    expect(screen.getByRole("note")).toHaveTextContent("FY 2026/27 is still in progress.");
    const years = within(screen.getByRole("navigation", { name: "Financial Year" })).getAllByRole("link");
    expect(years[0]).toHaveTextContent(/FY 20\d\d\/\d\d/);
    expect(years).toHaveLength(6);
  });

  it("labels the recent row and its detail instead of implying the totals left it out", () => {
    show(inProgress, "HQ_ADMIN");
    expect(screen.getAllByText("Not completed yet · Nov 2026")).toHaveLength(2);
  });

  it("shows no label for a completed row or on a year that has ended", () => {
    show({ ...national, recent: [{ ...national.recent[0]!, month: 9, completed: true }] }, "HQ_ADMIN");
    expect(screen.queryByText(/Not completed yet/)).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it.each(["si", "ta"] as const)("is translated in %s", (locale) => {
    show(inProgress, "HQ_ADMIN", locale);
    expect(document.body).not.toHaveTextContent("Not completed yet");
    expect(document.body).not.toHaveTextContent("is still in progress");
  });
});
