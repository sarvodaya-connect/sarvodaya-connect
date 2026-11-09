import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { NationalOverview } from "@sarvodaya-connect/api-contracts";

vi.mock("@/app/(dashboard)/map/actions", () => ({ loadSocietySummary: vi.fn(), loadNationalMapPins: vi.fn() }));

import { LOCALES, type Locale } from "@/i18n/config";
import { si } from "@/i18n/messages/si";
import { ta } from "@/i18n/messages/ta";
import { I18nProvider } from "@/i18n/provider";
import type { Messages } from "@/i18n/translate";

import { NationalOverviewView } from "./national-overview";
import { Panel } from "./parts";

const overview: NationalOverview = {
  financialYear: { startYear: 2025, label: "FY 2025/26", startsOn: "2025-04-01", endsOn: "2026-03-31" },
  societies: {
    registered: 5340,
    active: 1076,
    registeredNotActive: 4264,
    grades: { A: 144, B: 172, C: 760, ungraded: 0 },
    notUpdatedIn90Days: 142,
    gradeRequestsWaiting: 6,
    withoutLocation: 12,
  },
  districts: [{ id: "d1", name: "Kurunegala", active: 98, latitude: 7.5, longitude: 80.4 }],
  membership: {
    year: 2026,
    female: 56214,
    male: 42426,
    total: 98640,
    societiesReported: 1018,
    categories: [{ category: "YOUTH", female: 10280, male: 8070, total: 18350 }],
  },
  activities: {
    planned: 3930,
    completed: 3460,
    byDimension: [
      { dimension: "SOCIAL", planned: 2180, completed: 1940 },
      { dimension: "ECONOMIC", planned: 1400, completed: 1210 },
      { dimension: "GOVERNANCE", planned: 350, completed: 310 },
    ],
    topSdgs: [
      { sdg: 4, completed: 980 },
      { sdg: 3, completed: 860 },
    ],
  },
  finance: { activeSocieties: 1076, totalProfit: "312400000", totalExpenses: "1026800000", societiesWithBoth: 968, notSubmitted: 108 },
  registrarDocuments: {
    activeSocieties: 1076,
    allFour: 702,
    auditReportDueOn: "2026-09-30",
    pastDue: true,
    byType: [
      { documentType: "AUDIT_REPORT", submitted: 812, missing: 264 },
      { documentType: "AGM_MINUTES", submitted: 905, missing: 171 },
      { documentType: "OFFICE_BEARER_LIST", submitted: 948, missing: 128 },
      { documentType: "MEMBERS_LIST", submitted: 776, missing: 300 },
    ],
  },
  incidents: [],
};

const inLocale = (locale: Locale, messages: Messages, ui: React.ReactNode) =>
  render(<I18nProvider available={LOCALES} locale={locale} messages={messages}>{ui}</I18nProvider>);

/** Every labelled section names its own heading, and no two share an id. */
function expectOwnHeadings(container: HTMLElement, titles: string[]) {
  const sections = [...container.querySelectorAll<HTMLElement>("section[aria-labelledby]")];
  expect(sections.length).toBeGreaterThanOrEqual(titles.length);
  const ids = sections.map((section) => section.getAttribute("aria-labelledby")!);
  expect(new Set(ids).size).toBe(ids.length);
  for (const section of sections) {
    const heading = container.ownerDocument.getElementById(section.getAttribute("aria-labelledby")!);
    expect(heading).not.toBeNull();
    expect(section.contains(heading)).toBe(true);
  }
  const named = sections.map((section) => container.ownerDocument.getElementById(section.getAttribute("aria-labelledby")!)!.textContent);
  for (const title of titles) expect(named).toContain(title);
}

describe("Panel heading ids", () => {
  it.each([
    ["si", si],
    ["ta", ta],
  ] as const)("are unique for %s eyebrows that have no ASCII letters", (locale, messages) => {
    // Both eyebrows reduce to the same id ("panel--") if built from their text.
    const { container } = inLocale(
      locale,
      messages,
      <>
        <Panel eyebrow={messages["n.latestStatus"]} title={messages["n.byGradeToday"]}>a</Panel>
        <Panel eyebrow={messages["n.societyMap"]} title={messages["n.activeByDistrict"]}>b</Panel>
        <Panel eyebrow={messages["n.totalMembership"]} title={messages["n.femaleMale"]}>c</Panel>
      </>,
    );
    expectOwnHeadings(container, [messages["n.byGradeToday"], messages["n.activeByDistrict"], messages["n.femaleMale"]]);
  });

  it.each([
    ["si", si],
    ["ta", ta],
  ] as const)("label each National Overview card with its own heading in %s", (locale, messages) => {
    const { container } = inLocale(locale, messages, <NationalOverviewView demo={false} overview={overview} years={[2025]} />);
    expectOwnHeadings(container, [messages["n.byGradeToday"], messages["n.femaleMale"], messages["n.totalsYear"]]);
  });
});
