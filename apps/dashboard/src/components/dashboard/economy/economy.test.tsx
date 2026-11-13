import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  EconomyFilterScope,
  Paged,
  ProductionRecordListItem,
  ProductionSummary,
  SocietyEconomicProfile,
} from "@sarvodaya-connect/api-contracts";

import type { Locale } from "@/i18n/config";
import { en } from "@/i18n/messages/en";
import { si } from "@/i18n/messages/si";
import { ta } from "@/i18n/messages/ta";
import { I18nProvider } from "@/i18n/provider";
import { createTranslator, type Messages } from "@/i18n/translate";
import { getViewer } from "@/lib/access";
import { parseOverviewFilters } from "@/lib/economy-format";
import { headingFor, navigationFor } from "@/lib/navigation";
import { canOpen } from "@/lib/role-routes";

import { EconomyOverview } from "./economy-overview";
import { RecordHistory, SocietyEconomy } from "./society-economy";

/** Issue #147: the dashboard's Village Economic Profile. Every name and figure is fictional. */

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const CATALOGS: Record<Locale, Messages> = { en, si, ta };
const NOW = new Date("2026-11-13T04:30:00.000Z");
const N1 = "29000000-0000-4000-8000-000000000101";
const N2 = "29000000-0000-4000-8000-000000000102";
const NORTH = "29000000-0000-4000-8000-000000000001";

const scope = (over: Partial<EconomyFilterScope> = {}): EconomyFilterScope => ({
  kind: "DISTRICT",
  societyCount: 24,
  temporaryAccessEndsAt: null,
  districts: [{ id: NORTH, name: "Fictional North" }],
  canChooseDistrict: false,
  societies: [
    { id: N1, name: "Fictional Lotus Society", districtId: NORTH },
    { id: N2, name: "Fictional River Society", districtId: NORTH },
  ],
  societiesTruncated: false,
  ...over,
});

const summary = (over: Partial<ProductionSummary> = {}): ProductionSummary => ({
  period: { basis: "MONTHLY", startsOn: "2026-10-01", endsOn: "2026-10-31", seasonLabel: null },
  measurement: "ACTUAL",
  label: "REPORTED_PRODUCTION",
  products: [
    {
      product: "MILK",
      unit: "LITRE",
      reportedQuantity: 78000,
      contributingBusinesses: 26,
      coverage: { eligibleSocieties: 27, reportedSocieties: 24, zeroSocieties: 1, missingSocieties: 3 },
    },
    {
      product: "COCONUTS",
      unit: "NUT",
      reportedQuantity: null,
      contributingBusinesses: 0,
      coverage: { eligibleSocieties: 2, reportedSocieties: 0, zeroSocieties: 0, missingSocieties: 2 },
    },
  ],
  otherOutputs: [
    {
      outputId: "o-1",
      description: "Fictional jaggery",
      unit: "KILOGRAM",
      quantity: 40,
      society: { id: N1, name: "Fictional Lotus Society" },
      businessName: "Fictional Sweets",
    },
  ],
  lastUpdatedAt: "2026-11-02T05:00:00.000Z",
  ...over,
});

const record = (over: Partial<ProductionRecordListItem> = {}): ProductionRecordListItem => ({
  id: "r-1",
  outputId: "out-1",
  basis: "MONTHLY",
  startsOn: "2026-10-01",
  endsOn: "2026-10-31",
  seasonLabel: null,
  measurement: "ACTUAL",
  quantity: 3400,
  unit: "LITRE",
  note: "Fictional recount",
  source: "Fictional collection book",
  version: 2,
  createdBy: { displayName: "Fictional Officer", role: "SOCIETY_OFFICER" },
  updatedBy: { displayName: "Fictional Officer", role: "SOCIETY_OFFICER" },
  createdAt: "2026-11-01T04:00:00.000Z",
  updatedAt: "2026-11-02T05:00:00.000Z",
  product: "MILK",
  otherDescription: null,
  business: { id: "b-1", name: "Fictional Dairy", industry: "LIVESTOCK_DAIRY", otherIndustry: null },
  society: { id: N1, name: "Fictional Lotus Society" },
  ...over,
});

const page = (items: ProductionRecordListItem[], total = items.length): Paged<ProductionRecordListItem> => ({ items, page: 1, pageSize: 25, total });

function wrap(node: React.ReactNode, locale: Locale = "en") {
  return render(
    <I18nProvider available={["en", "si", "ta"]} locale={locale} messages={CATALOGS[locale]}>
      {node}
    </I18nProvider>,
  );
}

function overview(props: Partial<Parameters<typeof EconomyOverview>[0]> = {}, locale: Locale = "en") {
  const t = createTranslator(CATALOGS[locale], locale);
  return wrap(
    <EconomyOverview
      demo={false}
      filters={parseOverviewFilters({ month: "2026-10" }, NOW)}
      records={page([record()])}
      role="DISTRICT_MANAGER"
      scope={scope()}
      summary={summary()}
      t={t}
      {...props}
    />,
    locale,
  );
}

describe("Production Overview", () => {
  it("shows each product's reported production with societies, businesses and coverage", () => {
    overview();
    expect(screen.getByRole("heading", { level: 1, name: "Village Economic Profile" })).toBeInTheDocument();
    expect(screen.getByText("October 2026 · Actual figures")).toBeInTheDocument();
    const milk = within(screen.getByTestId("summary-MILK"));
    expect(milk.getByText("Reported actual production")).toBeInTheDocument();
    expect(milk.getByText("78,000 litres")).toBeInTheDocument();
    expect(milk.getByText(/from 24 societies · 26 businesses · in litres/)).toBeInTheDocument();
    expect(milk.getByText("24 of 27 eligible societies reported")).toBeInTheDocument();
    expect(milk.getByText("1 reported zero")).toBeInTheDocument();
    expect(milk.getByText("3 have not reported")).toBeInTheDocument();
    expect(screen.getByTestId("economy-scope")).toHaveTextContent("Fictional North · 24 societies");
    expect(screen.getByText("Self-reported")).toBeInTheDocument();
    expect(document.body.textContent).toContain("not everything a village or district produces");
  });

  it("never shows a missing report as zero", () => {
    overview();
    const coconuts = within(screen.getByTestId("summary-COCONUTS"));
    expect(coconuts.getByText("No reports yet")).toBeInTheDocument();
    expect(coconuts.queryByText(/^0 nuts$/)).not.toBeInTheDocument();
    expect(coconuts.getByText("2 have not reported")).toBeInTheDocument();
  });

  it("explains why several products have no grand total, and keeps Other apart", () => {
    overview();
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Only figures for exactly October 2026 are counted");
    expect(note).toHaveTextContent("there is no single grand total");
    const other = within(screen.getByRole("region", { name: "Other products and services" }));
    expect(other.getByText("Fictional jaggery")).toBeInTheDocument();
    expect(other.getByText("40 kg")).toBeInTheDocument();
    expect(other.getByText("Listed one by one and never added together.")).toBeInTheDocument();
    // One product: no grand-total note.
    overview({ summary: summary({ products: [summary().products[0]!], otherOutputs: [] }) });
    expect(screen.getAllByRole("note").at(-1)).not.toHaveTextContent("grand total");
  });

  it("says estimates are never added to actual figures", () => {
    overview({ filters: parseOverviewFilters({ month: "2026-10", measurement: "ESTIMATED" }, NOW), summary: summary({ measurement: "ESTIMATED" }) });
    expect(screen.getByRole("note")).toHaveTextContent("Estimates are shown on their own and never added to actual figures.");
    expect(within(screen.getByTestId("summary-MILK")).getByText("Reported estimated production")).toBeInTheDocument();
  });

  it("lists the counted records and drills down to the society, keeping the filters", () => {
    overview({ filters: parseOverviewFilters({ month: "2026-10", product: "MILK" }, NOW) });
    const table = within(screen.getByRole("region", { name: "Production records" }));
    const link = table.getByRole("link", { name: "Fictional Lotus Society" });
    expect(link).toHaveAttribute(
      "href",
      `/societies/${N1}/economy?from=${encodeURIComponent("/economic-profile?basis=MONTHLY&month=2026-10&product=MILK")}`,
    );
    expect(table.getByText("3,400 litres")).toBeInTheDocument();
    expect(table.getByText("Livestock and dairy · Milk")).toBeInTheDocument();
    expect(table.getByText("Actual")).toBeInTheDocument();
    expect(table.getByText(/Corrected/)).toBeInTheDocument();
  });

  it("pages the table through the API instead of loading everything", () => {
    overview({ records: { items: [record()], page: 1, pageSize: 25, total: 60 } });
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/economic-profile?basis=MONTHLY&month=2026-10&page=2");
  });

  it("asks for a season's dates instead of guessing a total", () => {
    overview({ filters: parseOverviewFilters({ basis: "SEASONAL" }, NOW), periodProblem: "CHOOSE_SEASON", summary: null, records: null });
    expect(screen.getByRole("status")).toHaveTextContent("Choose the first and last day of the season");
    expect(screen.queryByTestId("summary-MILK")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Season starts")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is registered", () => {
    overview({ summary: summary({ products: [], otherOutputs: [], lastUpdatedAt: null }), records: page([]) });
    expect(screen.getByText("Nothing registered yet")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Production records" })).not.toBeInTheDocument();
  });

  it("offers a district only where the viewer may choose one", () => {
    overview();
    expect(screen.queryByLabelText("District")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Society")).getAllByRole("option")).toHaveLength(3);
    overview({
      role: "HQ_ADMIN",
      scope: scope({ kind: "NATIONAL", canChooseDistrict: true, districts: [{ id: NORTH, name: "Fictional North" }, { id: "d2", name: "Fictional Central" }] }),
    });
    expect(screen.getByLabelText("District")).toBeInTheDocument();
    expect(screen.getAllByTestId("economy-scope").at(-1)).toHaveTextContent("All districts · 24 societies");
  });

  it("says when a DDM's temporary district access ends", () => {
    overview({ role: "DEPUTY_DISTRICT_MANAGER", scope: scope({ kind: "ASSIGNED_AND_DISTRICT", temporaryAccessEndsAt: "2026-11-14T12:30:00.000Z" }) });
    expect(screen.getByTestId("economy-scope")).toHaveTextContent("temporary access until");
  });

  it.each(["si", "ta"] as const)("is translated in %s, keeping names as stored", (locale) => {
    overview({}, locale);
    const t = createTranslator(CATALOGS[locale], locale);
    expect(screen.getByRole("heading", { level: 1, name: t("eco.title") })).toBeInTheDocument();
    expect(screen.getByText("Fictional jaggery")).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    for (const english of ["Reported actual production", "litres", "eligible societies", "No reports yet", "Production records", "Self-reported", "Milk", "Show figures", "Counted over"])
      expect(text, `"${english}" is still in English`).not.toContain(english);
  });
});

const profile: SocietyEconomicProfile = {
  society: { id: N1, name: "Fictional Lotus Society", societyCode: "FL-001", districtId: NORTH },
  businessDescription: "Fictional dairy collection",
  permissions: { canManage: false },
  businesses: [
    {
      id: "b-1",
      societyId: N1,
      name: "Fictional Dairy",
      industry: "LIVESTOCK_DAIRY",
      otherIndustry: null,
      description: "Fictional milk collection",
      status: "OPERATING",
      closedAt: null,
      version: 1,
      outputs: [
        { id: "out-1", businessId: "b-1", product: "MILK", otherDescription: null, unit: "LITRE", kind: "GOOD", archivedAt: null, version: 1, createdAt: "2026-09-01T04:00:00.000Z", updatedAt: "2026-09-01T04:00:00.000Z" },
        { id: "out-2", businessId: "b-1", product: "CURD", otherDescription: null, unit: "KILOGRAM", kind: "GOOD", archivedAt: "2026-11-01T04:00:00.000Z", version: 2, createdAt: "2026-09-01T04:00:00.000Z", updatedAt: "2026-11-01T04:00:00.000Z" },
      ],
      createdBy: { displayName: "Fictional Officer", role: "SOCIETY_OFFICER" },
      updatedBy: null,
      createdAt: "2026-09-01T04:00:00.000Z",
      updatedAt: "2026-09-01T04:00:00.000Z",
    },
    {
      id: "b-2",
      societyId: N1,
      name: "Fictional Grove",
      industry: "AGRICULTURE",
      otherIndustry: null,
      description: null,
      status: "CLOSED",
      closedAt: "2026-11-05T04:00:00.000Z",
      version: 3,
      outputs: [],
      createdBy: { displayName: "Fictional Officer", role: "SOCIETY_OFFICER" },
      updatedBy: { displayName: "Fictional Officer", role: "SOCIETY_OFFICER" },
      createdAt: "2026-09-01T04:00:00.000Z",
      updatedAt: "2026-11-05T04:00:00.000Z",
    },
  ],
};

describe("Society record: Village Economic Profile", () => {
  const t = createTranslator(en, "en");

  it("shows businesses, status, outputs and the untouched profile description, read-only", () => {
    wrap(<SocietyEconomy profile={profile} records={page([record()])} t={t} />);
    expect(screen.getByText(/Read-only here/)).toBeInTheDocument();
    expect(screen.getByText("Fictional dairy collection")).toBeInTheDocument();
    expect(screen.getByText("Kept as typed. It is not used for any figures.")).toBeInTheDocument();
    const dairy = within(screen.getByTestId("business-b-1"));
    expect(dairy.getByText("Livestock and dairy")).toBeInTheDocument();
    expect(dairy.getByText("Operating")).toBeInTheDocument();
    expect(dairy.getByText("Archived", { exact: false })).toBeInTheDocument();
    const grove = within(screen.getByTestId("business-b-2"));
    expect(grove.getByText("Closed")).toBeInTheDocument();
    expect(grove.getByText(/Closed since 5 Nov 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists records with source, note and a history link that keeps the way back", () => {
    const from = "/economic-profile?basis=MONTHLY&month=2026-10";
    wrap(<SocietyEconomy profile={profile} records={page([record()])} returnTo={from} t={t} />);
    expect(screen.getByRole("link", { name: /Back to Village Economic Profile/ })).toHaveAttribute("href", from);
    expect(screen.getByText("Fictional collection book · Fictional recount")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute("href", `/societies/${N1}/economy/records/r-1?from=${encodeURIComponent(from)}`);
  });

  it("has an empty state before any business is added", () => {
    wrap(<SocietyEconomy profile={{ ...profile, businesses: [], businessDescription: null }} records={page([])} t={t} />);
    expect(screen.getByText("No businesses recorded yet")).toBeInTheDocument();
    expect(screen.getByText("No description on the society profile.")).toBeInTheDocument();
  });

  it("shows every saved version of a record, newest first", () => {
    wrap(
      <RecordHistory
        backHref={`/societies/${N1}/economy`}
        outputLabel="Fictional Dairy · Milk"
        record={record({ quantity: 3000, version: 3 })}
        revisions={[
          { version: 3, change: "CORRECTED", quantity: 3000, note: null, source: null, seasonLabel: null, changedBy: { displayName: "Fictional Officer" }, changedAt: "2026-11-03T05:00:00.000Z" },
          { version: 2, change: "CORRECTED", quantity: 3400, note: "Fictional recount", source: null, seasonLabel: null, changedBy: { displayName: "Fictional Officer" }, changedAt: "2026-11-02T05:00:00.000Z" },
          { version: 1, change: "CREATED", quantity: 3200, note: null, source: "Fictional collection book", seasonLabel: null, changedBy: { displayName: "Fictional Officer" }, changedAt: "2026-11-01T04:00:00.000Z" },
        ]}
        t={t}
      />,
    );
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items[0]).toContain("Version 3 · Corrected · 3,000 litres");
    expect(items[2]).toContain("Version 1 · Recorded · 3,200 litres");
    expect(screen.getByText("Every saved version, newest first. Totals use the current figure only.")).toBeInTheDocument();
  });
});

describe("Village Economic Profile navigation (issue #147)", () => {
  const viewers = {
    HQ_ADMIN: getViewer("hq-admin"),
    DISTRICT_MANAGER: getViewer("district-manager"),
    PROGRAMME_COORDINATOR: getViewer("programme-coordinator"),
    DEPUTY_DISTRICT_MANAGER: { ...getViewer("programme-coordinator"), role: "DEPUTY_DISTRICT_MANAGER" as const },
  };
  it.each(Object.keys(viewers) as (keyof typeof viewers)[])("lists it for %s and opens it", (role) => {
    const viewer = viewers[role];
    expect(viewer.role).toBe(role);
    expect(navigationFor(viewer).main.map((item) => item.href)).toContain("/economic-profile");
    expect(canOpen(viewer.role, "/economic-profile")).toBe(true);
    expect(headingFor("/economic-profile", viewer).title).toBeTruthy();
  });

  it("is not offered to the system administrator", () => {
    expect(navigationFor(getViewer("system-admin")).main.map((item) => item.href)).not.toContain("/economic-profile");
  });
});
