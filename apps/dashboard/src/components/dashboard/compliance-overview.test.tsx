import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { canSeeSociety, getViewer } from "@/lib/access";
import { type ComplianceFilters, complianceRecords, EMPTY_COMPLIANCE_FILTERS } from "@/lib/demo-compliance";
import { districts } from "@/lib/demo-registry";

import { ComplianceOverview } from "./compliance-overview";
import { NoPermissionState } from "./data-states";

function renderOverview(records = complianceRecords, initialFilters?: ComplianceFilters) {
  const user = userEvent.setup();
  render(<ComplianceOverview districts={districts} initialFilters={initialFilters} records={records} />);
  return { user };
}

const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const rowFor = (society: string) => screen.getByRole("rowheader", { name: new RegExp(society) }).closest("tr")!;

describe("ComplianceOverview", () => {
  it("identifies completed, pending and missing Registrar documents", () => {
    renderOverview();

    expect(screen.getByRole("button", { name: /Missing\s*6/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pending\s*6/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Completed\s*16/ })).toBeInTheDocument();
    expect(screen.getByText("57% completed")).toBeInTheDocument();
    expect(screen.getByText("2 of 7")).toBeInTheDocument();

    const pahala = rowFor("Pahala Kosgama");
    expect(within(pahala).getByText(/^Missing/)).toBeInTheDocument();
    expect(within(pahala).getByText("· Overdue")).toBeInTheDocument();
    expect(within(pahala).getByText("Under review")).toBeInTheDocument();
    expect(within(pahala).getAllByText("Approved")).toHaveLength(2);
    expect(within(rowFor("Wellawa")).getByText("Returned")).toBeInTheDocument();
    expect(screen.getByText("Showing 7 of 7 societies")).toBeInTheDocument();
  });

  it("filters by clicking a status card", async () => {
    const { user } = renderOverview();

    await user.click(screen.getByRole("button", { name: /Missing\s*6/ }));

    expect(screen.getByRole("button", { name: /Missing\s*6/ })).toHaveAttribute("aria-pressed", "true");
    expect(rows()).toHaveLength(4);
    expect(screen.queryByRole("rowheader", { name: /Kuliyapitiya/ })).not.toBeInTheDocument();
  });

  it("filters by document type and status together", async () => {
    const { user } = renderOverview();

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by document type" }), "AUDIT_REPORT");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "MISSING");

    expect(rows().map((row) => within(row).getByRole("rowheader").textContent)).toEqual([
      expect.stringContaining("Pahala Kosgama"),
      expect.stringContaining("Galewela"),
    ]);
    expect(screen.getByText("2 societies are overdue")).toBeInTheDocument();
  });

  it("filters by district and by society search", async () => {
    const { user } = renderOverview();

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by district" }), "district-kandy");
    expect(rows()).toHaveLength(1);
    expect(rowFor("Kundasale")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by district" }), "all");
    await user.type(screen.getByRole("searchbox", { name: "Search societies" }), "SSS-KG-014");
    expect(rows()).toHaveLength(1);
    expect(rowFor("Kuliyapitiya")).toBeInTheDocument();
  });

  it("shows the active filters when nothing matches and clears them", async () => {
    const { user } = renderOverview();

    await user.type(screen.getByRole("searchbox", { name: "Search societies" }), "Kundasale");
    await user.click(screen.getByRole("button", { name: /Missing\s*0/ }));

    expect(screen.getByRole("heading", { name: "No societies match your filters" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Active filters" })).getByText("Missing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(rows()).toHaveLength(7);
    expect(screen.getByRole("searchbox", { name: "Search societies" })).toHaveFocus();
  });

  it("records a reminder for a society with missing documents", async () => {
    const { user } = renderOverview();

    await user.click(screen.getByRole("button", { name: "Send reminder to Maho Sarvodaya Shramadana Society" }));

    expect(screen.getByRole("button", { name: "Reminder sent to Maho Sarvodaya Shramadana Society" })).toBeDisabled();
    expect(screen.getByText(/Reminder recorded for Maho Sarvodaya Shramadana Society/)).toBeInTheDocument();
    expect(within(rowFor("Kuliyapitiya")).getByRole("link", { name: /View documents/ })).toHaveAttribute(
      "href",
      "/documents?society=society-kuliyapitiya",
    );
  });

  it("opens already filtered from a notification link, inside the District Manager's scope", () => {
    const viewer = getViewer("district-manager");
    renderOverview(
      complianceRecords.filter((record) => canSeeSociety(viewer, record)),
      { ...EMPTY_COMPLIANCE_FILTERS, type: "AUDIT_REPORT", state: "MISSING" },
    );

    expect(rows()).toHaveLength(1);
    expect(rowFor("Pahala Kosgama")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 4 societies")).toBeInTheDocument();
  });

  it("shows an empty state when there are no societies to monitor", () => {
    renderOverview([]);

    expect(screen.getByRole("heading", { name: "No societies to monitor yet" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("explains when a role has no permission", () => {
    render(<NoPermissionState description="Only District Managers and HQ can see this." title="Not available for your role" />);

    expect(screen.getByRole("heading", { name: "Not available for your role" })).toBeInTheDocument();
  });
});
