import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { NationalOverview, ReportTable, SocietyAtAGlance } from "@sarvodaya-connect/api-contracts";

import { reportCsv } from "@/lib/reports";

const { loadSocietySummary } = vi.hoisted(() => ({ loadSocietySummary: vi.fn() }));
// The HQ period switch moves between years with the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/dashboard" }));
vi.mock("@/app/(dashboard)/map/actions", () => ({ loadSocietySummary, loadNationalMapPins: vi.fn() }));

import { NationalOverviewView } from "./national-overview";
import { ReportTableView } from "./report-table";
import { SocietyMapView } from "./society-map";
import { lkrShort } from "./format";

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

describe("V5 D02 National Dashboard", () => {
  it("shows the six sections from the API figures", () => {
    render(<NationalOverviewView demo={false} overview={overview} years={[2025, 2024]} />);
    expect(screen.getAllByText("1,076").length).toBeGreaterThan(0);
    expect(screen.getByText("currently active")).toBeInTheDocument();
    // The key figure, the membership card and the table total.
    expect(screen.getAllByText("98,640").length).toBe(3);
    expect(screen.getByText("LKR 312.4 m")).toBeInTheDocument();
    expect(screen.getByText("LKR 1,026.8 m")).toBeInTheDocument();
    // The audit share, on the key figure and in the documents card.
    expect(screen.getAllByText("75%")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Kurunegala: 98 active societies" })).toHaveAttribute("href", "/societies?districtId=d1");
    expect(screen.getByRole("link", { name: "6 grade requests waiting" })).toHaveAttribute("href", "/reviews");
    expect(screen.getByText(/No open incidents/)).toBeInTheDocument();
    // Sample data is labelled only in demonstration mode.
    expect(screen.queryByText(/Demonstration Data/)).not.toBeInTheDocument();
    // No horizontal progress bars as data displays.
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("keeps the drawn district map, with a note and no error, when Mapbox is not set up", () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
    render(<NationalOverviewView demo={false} overview={overview} years={[2025]} />);
    vi.unstubAllEnvs();
    expect(screen.getByRole("img", { name: "Active Societies in Each District" })).toBeInTheDocument();
    expect(screen.getByText("The street map is not set up yet, so a drawn map is shown.")).toBeInTheDocument();
    expect(screen.queryByText("The Map Could Not Load")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "List View ›" })).toHaveAttribute("href", "/societies");
    expect(screen.getByRole("link", { name: /12 active societies have no map position yet/ })).toHaveAttribute("href", "/reports?type=data-quality");
  });

  it("labels sample figures in demonstration mode", () => {
    render(<NationalOverviewView demo overview={overview} years={[2025]} />);
    expect(screen.getByText("Demonstration data · sample figures, not real")).toBeInTheDocument();
    expect(screen.getByText("Sample Figures")).toBeInTheDocument();
  });

  it("lists what needs HQ's attention, each opening the list where it is dealt with", () => {
    render(<NationalOverviewView demo={false} overview={overview} years={[2025]} />);
    const attention = screen.getByRole("region", { name: "Needs Attention" });
    const row = (name: RegExp) => within(attention).getByRole("link", { name });
    expect(row(/Grade Requests to Review/)).toHaveAttribute("href", "/reviews");
    expect(row(/Audit Reports Missing for FY 2025\/26/)).toHaveAttribute("href", "/compliance?year=2025");
    expect(row(/Audit Reports Missing/)).toHaveTextContent("264");
    expect(row(/Yearly Figures Not Added/)).toHaveAttribute("href", "/societies?view=figures-not-added");
    expect(row(/Records Not Updated in 90\+ Days/)).toHaveAttribute("href", "/societies?view=not-updated");
    expect(row(/without a map position/i)).toHaveAttribute("href", "/reports?type=data-quality");
    // Nothing to act on is left out rather than shown as 0.
    expect(within(attention).queryByText("Active Societies Not Graded Yet")).not.toBeInTheDocument();
    // The lines overlap and count different things, so the badge counts lines, not a sum (532).
    expect(within(attention).getByText("5 Lists")).toBeInTheDocument();
    expect(within(attention).queryByText("532")).not.toBeInTheDocument();
  });

  it("keeps live incidents first and says assessments are added up across incidents", () => {
    const incident = {
      severity: "HIGH",
      status: "ACTIVE",
      districtName: "Fictional North",
      activatedAt: "2026-11-01T04:00:00Z",
      peopleAffected: 40,
      householdsAffected: 12,
      actions: 3,
      actionsCompleted: 1,
    };
    render(
      <NationalOverviewView
        demo={false}
        overview={{
          ...overview,
          incidents: [
            { ...incident, id: "i1", title: "Sample flood", societiesInArea: 5, assessed: 2 },
            { ...incident, id: "i2", title: "Sample landslide", societiesInArea: 4, assessed: 3 },
          ],
        }}
        years={[2025]}
      />,
    );
    const figures = screen.getByRole("list", { name: "Key Figures" });
    const live = within(figures).getByRole("link", { name: /Live Incidents/ });
    expect(live).toHaveAttribute("href", "/emergencies");
    // 3 + 1: one society can sit in both areas, so this is not called a count of societies.
    expect(live).toHaveTextContent("4 assessments still to do, across live incidents");
    const attention = within(screen.getByRole("region", { name: "Needs Attention" })).getAllByRole("link");
    expect(attention[0]).toHaveAttribute("href", "/emergencies");
    expect(attention[0]).toHaveTextContent(/Added Up Across Live Incidents/);
  });

  it("links every key figure to its page, for the chosen year", () => {
    render(<NationalOverviewView demo={false} overview={overview} years={[2025, 2024]} />);
    const figures = screen.getByRole("list", { name: "Key Figures" });
    expect(within(figures).getByRole("link", { name: /Active Societies/ })).toHaveAttribute("href", "/societies");
    expect(within(figures).getByRole("link", { name: /Completed Activities/ })).toHaveAttribute("href", "/activities?year=2025");
    expect(within(figures).getByRole("link", { name: /Audit Reports Submitted/ })).toHaveAttribute("href", "/compliance?year=2025");
    const years = screen.getByRole("navigation", { name: "Financial Year" });
    expect(within(years).getByRole("link", { name: "FY 2025/26" })).toHaveAttribute("aria-current", "true");
    expect(within(years).getByRole("link", { name: "FY 2024/25" })).toHaveAttribute("href", "/dashboard?year=2024");
  });

  it("never shows a missing figure as zero", () => {
    render(
      <NationalOverviewView
        demo={false}
        overview={{
          ...overview,
          membership: { ...overview.membership, year: null, female: 0, male: 0, total: 0, societiesReported: 0, categories: [] },
          finance: { ...overview.finance, totalProfit: "0", totalExpenses: "0", societiesWithBoth: 0, notSubmitted: 1076 },
        }}
        years={[2025]}
      />,
    );
    expect(screen.getByText("No Membership Counts Entered Yet")).toBeInTheDocument();
    expect(screen.getByText("No society has entered membership counts yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Not Added Yet")).toHaveLength(2);
    expect(screen.queryByText("LKR 0")).not.toBeInTheDocument();
  });

  it("keeps a total that was entered when no society has entered both figures", () => {
    render(
      <NationalOverviewView
        demo={false}
        overview={{ ...overview, finance: { ...overview.finance, totalProfit: "412500", totalExpenses: "0", societiesWithBoth: 0, notSubmitted: 1076 } }}
        years={[2025]}
      />,
    );
    expect(screen.getByText("LKR 412,500")).toBeInTheDocument();
    expect(screen.getAllByText("Not Added Yet")).toHaveLength(1);
  });

  it("says membership is the latest year counted, whichever year is chosen", () => {
    render(<NationalOverviewView demo={false} overview={overview} years={[2025, 2024]} />);
    const figures = screen.getByRole("list", { name: "Key Figures" });
    expect(within(figures).getByRole("link", { name: /Total Membership/ })).toHaveTextContent("Latest counts (2026), whichever year is chosen");
    expect(screen.getByText(/Membership is the latest year counted \(2026\)\. Yearly figures, audits and activities are for FY 2025\/26\./)).toBeInTheDocument();
  });

  it("switches the membership chart and opens the table", async () => {
    const user = userEvent.setup();
    render(<NationalOverviewView demo={false} overview={overview} years={[2025]} />);
    const split = screen.getByRole("button", { name: "Female and Male Members" });
    await user.click(split);
    expect(split).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "Members: 56,214 female and 42,426 male" })).toBeInTheDocument();
    const table = screen.getByRole("button", { name: "Show the Table" });
    await user.click(table);
    expect(table).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("table", { name: "Membership Categories" })).toBeInTheDocument();
  });

  it("lists every district alphabetically in the side panel", async () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
    const user = userEvent.setup();
    render(
      <NationalOverviewView
        demo={false}
        overview={{
          ...overview,
          districts: [
            { id: "d2", name: "Matale", active: 0, latitude: null, longitude: null },
            { id: "d1", name: "Kurunegala", active: 98, latitude: 7.5, longitude: 80.4 },
            // Half a position is no position: the map leaves it out too.
            { id: "d3", name: "Ampara", active: 4, latitude: 7.3, longitude: null },
          ],
        }}
        years={[2025]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "3 districts" }));
    const panel = screen.getByRole("dialog", { name: "Active Societies in Each District" });
    const links = within(panel).getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/societies"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/societies?districtId=d3", "/societies?districtId=d1", "/societies?districtId=d2"]);
    expect(within(panel).getAllByText("No Map Position Yet")).toHaveLength(2);
    expect(within(panel).getByRole("link", { name: /Ampara/ })).toHaveTextContent("No Map Position Yet");
  });

  it("formats yearly totals", () => {
    expect(lkrShort("412500")).toBe("LKR 412,500");
    expect(lkrShort(null)).toBe("Not added");
  });
});

describe("V5 D03 Map view", () => {
  const summary: SocietyAtAGlance = {
    id: "s1",
    name: "Pahala Kosgama SSS",
    societyCode: "S-104233",
    districtId: "d1",
    district: "Kurunegala",
    grade: "B",
    status: "ACTIVE",
    updatedAt: "2026-11-03T03:00:00.000Z",
    members: 418,
    membershipYear: 2026,
    recordsCompletePercent: 96,
    missingFields: 1,
    financialYear: overview.financialYear,
    profit: null,
    expenses: null,
    hasSocietyOfficer: true,
    excoSeatsFilled: 0,
    excoComplete: false,
    excoMissingOffices: ["President", "Secretary", "Treasurer"],
    spcName: null,
    registrarDocuments: [],
    auditReportPastDue: false,
    gradeRequest: null,
    activities: { planned: 0, approved: 0, latest: null },
  };

  it("shows the chosen society's summary", async () => {
    loadSocietySummary.mockResolvedValue(summary);
    const user = userEvent.setup();
    render(
      <SocietyMapView
        counts={{ A: 1, B: 1, C: 0, ungraded: 0, notActive: 0, withoutLocation: 3 }}
        demo={false}
        points={[{ id: "s1", name: "Pahala Kosgama SSS", societyCode: "S-104233", class: "B", latitude: 7.5, longitude: 80.4, district: "Kurunegala" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Pahala Kosgama SSS, S-104233" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Pahala Kosgama SSS" })).toBeInTheDocument());
    expect(loadSocietySummary).toHaveBeenCalledWith("s1");
    expect(screen.getByText("96%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Society Record" })).toHaveAttribute("href", "/societies/s1");
    expect(screen.getByRole("link", { name: "Societies in Kurunegala" })).toHaveAttribute("href", "/societies?districtId=d1");
  });

  it("says when the society cannot be opened", async () => {
    loadSocietySummary.mockResolvedValue({ error: "Society Not Found" });
    const user = userEvent.setup();
    render(
      <SocietyMapView
        counts={{ A: 0, B: 0, C: 0, ungraded: 1, notActive: 0, withoutLocation: 0 }}
        demo
        points={[{ id: "s2", name: "Example", societyCode: "S-1", class: "UNGRADED", latitude: 7, longitude: 80, district: "Kurunegala" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Example, S-1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Society Not Found");
    expect(screen.getByText("Demonstration Data")).toBeInTheDocument();
  });
});

describe("V5 D15 Reports", () => {
  const report: ReportTable = {
    type: "society-status",
    title: "Society Status Summary",
    scope: "National",
    financialYear: overview.financialYear,
    columns: [
      { key: "district", label: "District" },
      { key: "active", label: "Active", numeric: true },
      { key: "profit", label: "Total profit (LKR)", numeric: true },
    ],
    rows: [{ district: "Kurunegala", active: 98, profit: "412500.00" }],
    generatedAt: "2026-11-03T03:00:00.000Z",
  };

  it("previews the report as a table", () => {
    render(<ReportTableView report={report} />);
    const table = screen.getByRole("table", { name: "Society Status Summary · National · FY 2025/26" });
    expect(within(table).getByText("412,500")).toBeInTheDocument();
  });

  it("downloads CSV that Excel opens", () => {
    expect(reportCsv(report)).toBe("﻿District,Active,Total profit (LKR)\r\nKurunegala,98,412500.00\r\n");
  });
});
