import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { NationalOverview, ReportTable, SocietyAtAGlance } from "@sarvodaya-connect/api-contracts";

import { reportCsv } from "@/lib/reports";

const { loadSocietySummary } = vi.hoisted(() => ({ loadSocietySummary: vi.fn() }));
vi.mock("@/app/(dashboard)/map/actions", () => ({ loadSocietySummary }));

import { NationalOverviewView } from "./national-overview";
import { ReportTableView } from "./report-table";
import { SocietyMapView } from "./society-map";
import { lkrShort } from "./parts";

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
    expect(screen.getAllByText("98,640").length).toBe(2);
    expect(screen.getByText("LKR 312.4 m")).toBeInTheDocument();
    expect(screen.getByText("LKR 1,026.8 m")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kurunegala: 98 active societies" })).toHaveAttribute("href", "/societies?districtId=d1");
    expect(screen.getByRole("link", { name: "6 grade requests waiting" })).toHaveAttribute("href", "/reviews");
    expect(screen.getByText(/No open incidents/)).toBeInTheDocument();
    // Sample data is labelled only in demonstration mode.
    expect(screen.queryByText(/Demonstration data/)).not.toBeInTheDocument();
    // No horizontal progress bars as data displays.
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("labels sample figures in demonstration mode", () => {
    render(<NationalOverviewView demo overview={overview} years={[2025]} />);
    expect(screen.getByText("Demonstration data · sample figures, not real")).toBeInTheDocument();
    expect(screen.getByText("Sample figures")).toBeInTheDocument();
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
        points={[{ id: "s1", name: "Pahala Kosgama SSS", societyCode: "S-104233", class: "B", latitude: 7.5, longitude: 80.4 }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Pahala Kosgama SSS, S-104233" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Pahala Kosgama SSS" })).toBeInTheDocument());
    expect(loadSocietySummary).toHaveBeenCalledWith("s1");
    expect(screen.getByText("96%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open society record" })).toHaveAttribute("href", "/societies/s1");
    expect(screen.getByRole("link", { name: "Societies in Kurunegala" })).toHaveAttribute("href", "/societies?districtId=d1");
  });

  it("says when the society cannot be opened", async () => {
    loadSocietySummary.mockResolvedValue({ error: "Society not found" });
    const user = userEvent.setup();
    render(
      <SocietyMapView
        counts={{ A: 0, B: 0, C: 0, ungraded: 1, notActive: 0, withoutLocation: 0 }}
        demo
        points={[{ id: "s2", name: "Example", societyCode: "S-1", class: "UNGRADED", latitude: 7, longitude: 80 }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Example, S-1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Society not found");
    expect(screen.getByText("Demonstration data")).toBeInTheDocument();
  });
});

describe("V5 D15 Reports", () => {
  const report: ReportTable = {
    type: "society-status",
    title: "Society status summary",
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
    const table = screen.getByRole("table", { name: "Society status summary · National · FY 2025/26" });
    expect(within(table).getByText("412,500")).toBeInTheDocument();
  });

  it("downloads CSV that Excel opens", () => {
    expect(reportCsv(report)).toBe("﻿District,Active,Total profit (LKR)\r\nKurunegala,98,412500.00\r\n");
  });
});
