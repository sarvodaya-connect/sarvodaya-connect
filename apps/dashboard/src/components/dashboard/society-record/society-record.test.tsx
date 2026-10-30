import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AnnualFinancialSummary, SocietyRecord, WorkPlanOverview as WorkPlan } from "@sarvodaya-connect/api-contracts";

import { formatLkr, isSocietyRecordId, waitingLabel } from "@/lib/society-record-format";

import { AnnualSummaryCards } from "./annual-summary-cards";
import { EditSocietyPanel } from "./edit-society-panel";
import { ExcoTable } from "./exco-table";
import { GradeRequestList, HistoryList } from "./record-lists";
import { RecordOverview } from "./record-overview";
import { WorkPlanOverview } from "./work-plan-overview";

const SOCIETY_ID = "29000000-0000-4000-8000-000000000101";
const year = { startYear: 2025, label: "FY 2025/26", startsOn: "2025-04-01", endsOn: "2026-03-31" };

const fullSummary: AnnualFinancialSummary = {
  societyId: SOCIETY_ID,
  financialYear: year,
  totalProfit: 412500,
  totalExpenses: 1286000,
  profitChange: {
    updatedAt: "2026-10-22T10:40:00.000Z",
    updatedBy: { displayName: "N. Wijesinghe", role: "SOCIETY_OFFICER" },
    previousValue: 398000,
  },
  expensesChange: {
    updatedAt: "2026-10-21T09:00:00.000Z",
    updatedBy: { displayName: "S. Karunaratne", role: "PROGRAMME_COORDINATOR" },
  },
  auditReport: {
    documentId: "29000000-0000-4000-8000-000000000701",
    fileName: "Audit_Report_Pahala_Kosgama_FY2025-26.pdf",
    contentType: "application/pdf",
    sizeBytes: 1_800_000,
    uploadedAt: "2026-10-22T10:45:00.000Z",
    uploadedBy: { displayName: "N. Wijesinghe", role: "SOCIETY_OFFICER" },
  },
};

const record: SocietyRecord = {
  id: SOCIETY_ID,
  societyCode: "S-104233",
  nameEn: "Pahala Kosgama SSS",
  district: { id: "district", code: "KG", nameEn: "Kurunegala" },
  status: "ACTIVE",
  verificationStatus: "UNVERIFIED",
  profileCompleteness: 90,
  updatedAt: "2026-10-30T04:00:00.000Z",
  address: { addressLine: "Temple Road, Pahala Kosgama", dsDivision: "Kuliyapitiya East" },
  contacts: [],
  committee: [
    { id: "m2", seatNumber: 2, fullName: "N. Wijesinghe", position: "Secretary", isActive: true, age: 42, nicMasked: "••••0012" },
    { id: "m1", seatNumber: 1, fullName: "A. Jayasekara", position: "President", isActive: true, age: 58, nicMasked: "••••0047" },
  ],
  documents: [],
  history: [],
  createdAt: "2021-02-02T00:00:00.000Z",
  memberCount: 418,
  landline: "037 000 0123",
  businessDescription: "A small rice mill for members' paddy.",
  grade: "B",
  gradeChangedAt: "2025-03-12T05:50:00.000Z",
  gradeChangedBy: { displayName: "D. Gunawardena", role: "HQ_ADMIN" },
  openGradeRequest: {
    id: "request",
    societyId: SOCIETY_ID,
    fromGrade: "B",
    toGrade: "A",
    reason: "The Exco was re-formed at the AGM.",
    status: "PENDING",
    requestedBy: { displayName: "S. Karunaratne", role: "PROGRAMME_COORDINATOR" },
    requestedAt: "2026-10-24T10:10:00.000Z",
  },
  staff: [
    { role: "SOCIETY_OFFICER", displayName: "N. Wijesinghe", accountStatus: "ACTIVE" },
    { role: "DISTRICT_MANAGER", displayName: "R. Fernando", accountStatus: "ACTIVE" },
    { role: "PROGRAMME_COORDINATOR", displayName: "S. Karunaratne", accountStatus: "PENDING" },
  ],
  annualSummary: fullSummary,
  permissions: {
    canEdit: true,
    canEditSocietyCode: true,
    canChangeGrade: true,
    canRequestGradeChange: false,
    canEditAnnualSummary: false,
    canUploadAuditReport: false,
    canUploadDocuments: true,
  },
};

describe("D05 annual financial summary", () => {
  it("leads with the two yearly totals and the audit report HQ can open or download", () => {
    render(<AnnualSummaryCards societyId={SOCIETY_ID} societyName={record.nameEn} staff={record.staff} summary={fullSummary} />);
    expect(screen.getByRole("heading", { name: /Annual financial summary · FY 2025\/26/ })).toBeInTheDocument();
    expect(screen.getByText("LKR 412,500")).toBeInTheDocument();
    expect(screen.getByText("LKR 1,286,000")).toBeInTheDocument();
    expect(screen.getByText(/Was LKR 398,000 before 22 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Entered 21 Oct 2026 by S. Karunaratne \(SPC\)/)).toBeInTheDocument();
    const download = `/societies/${SOCIETY_ID}/documents/${fullSummary.auditReport!.documentId}/download`;
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", download);
    expect(screen.getByRole("link", { name: /Download/ })).toHaveAttribute("href", download);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("D05m: says the figures are not added yet and that the SPC is responsible without a Society Officer", () => {
    render(
      <AnnualSummaryCards
        societyId={SOCIETY_ID}
        societyName="Kobeigane SSS"
        staff={[{ role: "PROGRAMME_COORDINATOR", displayName: "S. Karunaratne", accountStatus: "ACTIVE" }]}
        summary={{ societyId: SOCIETY_ID, financialYear: year, totalProfit: null, totalExpenses: null, auditReport: null }}
      />,
    );
    expect(screen.getAllByText("Not added yet")).toHaveLength(2);
    expect(screen.getByText("Not uploaded")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "The FY 2025/26 figures and audit report have not been added.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "its SPC (S. Karunaratne). Kobeigane SSS has no Society Officer, so the SPC is responsible.",
    );
  });
});

describe("D05 society record overview", () => {
  it("shows details, staff, the HQ-only grade with the open request and office bearers first", () => {
    render(<RecordOverview record={record} workPlan={null} />);
    expect(screen.getByText("S-104233")).toBeInTheDocument();
    expect(screen.getByText("418")).toBeInTheDocument();
    expect(screen.getByText("Grade B · Developing")).toBeInTheDocument();
    expect(screen.getByText(/Request B → A · waiting/)).toBeInTheDocument();
    expect(screen.getByText(/Information only — no sales, stock or accounts/)).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    const offices = screen.getAllByRole("row").map((row) => row.textContent);
    expect(offices.findIndex((text) => text?.includes("President"))).toBeLessThan(
      offices.findIndex((text) => text?.includes("Secretary")),
    );
    expect(screen.getByText("No activities planned yet.")).toBeInTheDocument();
  });
});

describe("D05e HQ edit society information", () => {
  it("keeps Save disabled until a direct grade change has a reason", async () => {
    const user = userEvent.setup();
    render(<EditSocietyPanel action={vi.fn().mockResolvedValue({})} hqName="D. Gunawardena" record={record} />);
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();

    await user.selectOptions(screen.getByRole("combobox", { name: /Grade/ }), "A");
    expect(screen.getByText("● Unsaved changes")).toBeInTheDocument();
    expect(screen.getByText("Enter a reason. It is shown in the grade history.")).toBeInTheDocument();
    expect(screen.getByText(/Changing the grade here will close it as approved/)).toBeInTheDocument();
    expect(screen.getByText("B → A changed directly by D. Gunawardena (HQ)")).toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: /Reason for the grade change/ }), "Audit complete and Exco reformed");
    expect(save).toBeEnabled();
  });

  it("flags a member count that is not a number", async () => {
    const user = userEvent.setup();
    render(<EditSocietyPanel action={vi.fn()} hqName="HQ" record={record} />);
    const members = screen.getByRole("textbox", { name: /Number of members/ });
    await user.clear(members);
    await user.type(members, "41a");
    expect(screen.getByRole("alert")).toHaveTextContent("Use numbers only");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
});

describe("D05x Exco", () => {
  it("masks NICs and shows one for 30 seconds after Show", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const reveal = vi.fn().mockResolvedValue({ nic: "198400000012" });
    render(<ExcoTable members={record.committee} revealNic={reveal} />);
    expect(screen.getByText("2 of 25 Exco members")).toBeInTheDocument();
    expect(screen.getByText("23 missing")).toBeInTheDocument();
    expect(screen.getByText("•••• •••• 0047")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Show" })[0]!);
    expect(reveal).toHaveBeenCalledWith("m1");
    expect(await screen.findByText("198400000012")).toBeInTheDocument();
    expect(screen.getByText("hides in 0:30")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    expect(screen.queryByText("198400000012")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("D05w work plan", () => {
  it("lists activities by month with the planning-only notice and total", () => {
    const plan: WorkPlan = {
      societyId: SOCIETY_ID,
      year: 2027,
      totalAllocated: 80000,
      activities: [
        { id: "a", year: 2027, month: 1, name: "Tank cleaning shramadana", description: "Clear the tank.", sector: "10 · Environment", allocatedCost: 25000 },
        { id: "b", year: 2027, month: 9, name: "Youth leadership camp", description: "Three-day camp.", datesLabel: "12–14 Sep", allocatedCost: 55000 },
      ],
      lastChange: { at: "2026-10-18T04:00:00.000Z", by: { displayName: "S. Karunaratne", role: "PROGRAMME_COORDINATOR" } },
    };
    render(<WorkPlanOverview plan={plan} />);
    expect(screen.getByText("Activity planning only")).toBeInTheDocument();
    expect(screen.getByText("Total allocated for planning: LKR 80,000")).toBeInTheDocument();
    expect(screen.getByText("Last changed by S. Karunaratne (SPC) · 18 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("12–14 Sep")).toBeInTheDocument();
  });

  it("shows an empty plan plainly", () => {
    render(<WorkPlanOverview plan={{ societyId: SOCIETY_ID, year: 2027, totalAllocated: 0, activities: [] }} />);
    expect(screen.getByText(/No activities are planned for 2027 yet/)).toBeInTheDocument();
  });
});

describe("society history", () => {
  it("shows who made each change and filters by tab", () => {
    render(
      <HistoryList
        category="ANNUAL_SUMMARY"
        events={[
          {
            id: "e1",
            category: "ANNUAL_SUMMARY",
            action: "ANNUAL_SUMMARY_UPDATED",
            summary: "FY 2025/26 profit LKR 398,000 → 412,500",
            actor: { displayName: "N. Wijesinghe", role: "SOCIETY_OFFICER" },
            occurredAt: "2026-10-22T10:40:00.000Z",
          },
        ]}
        societyId={SOCIETY_ID}
      />,
    );
    expect(screen.getByText("N. Wijesinghe (Society Officer) · 22 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Annual summary" })).toHaveAttribute("aria-current", "page");
  });
});

describe("D05 HQ grade-change decisions", () => {
  const pending = record.openGradeRequest!;
  const decided = {
    ...pending,
    id: "older",
    toGrade: "C" as const,
    status: "REJECTED" as const,
    decidedBy: { displayName: "D. Gunawardena", role: "HQ_ADMIN" as const },
    decidedAt: "2026-09-02T04:00:00.000Z",
    decisionComment: "Audit report is still missing.",
  };

  it("does not offer decisions to anyone but HQ, or on decided requests", () => {
    render(<GradeRequestList requests={[pending, decided]} />);
    expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.tagName === "P" && /^Rejected by D\. Gunawardena \(HQ\) · .*2026 · “Audit report is still missing\.”$/.test(element.textContent ?? "")),
    ).toBeInTheDocument();
  });

  it("lets HQ approve the waiting request, with an optional comment", async () => {
    const decide = vi.fn().mockResolvedValue({});
    render(<GradeRequestList decide={decide} requests={[pending, decided]} />);
    expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Approve B → A" }));
    expect(decide).toHaveBeenCalledWith("request", "APPROVE", "");
  });

  it("needs a reason before HQ can reject", async () => {
    const decide = vi.fn().mockResolvedValue({});
    render(<GradeRequestList decide={decide} requests={[pending]} />);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(decide).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: /HQ comment/ })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a reason for rejecting. The requester will see it.")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: /HQ comment/ }), "Grade A needs a full year of reports.");
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(decide).toHaveBeenCalledWith("request", "REJECT", "Grade A needs a full year of reports.");
  });

  it("disables both actions while saving and shows API errors such as an already-decided request", async () => {
    let finish: (value: { error?: string }) => void = () => {};
    const decide = vi.fn(() => new Promise<{ error?: string }>((resolve) => (finish = resolve)));
    render(<GradeRequestList decide={decide} requests={[pending]} />);
    await userEvent.click(screen.getByRole("button", { name: "Approve B → A" }));
    expect(screen.getByRole("button", { name: "Approving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    await act(async () => finish({ error: "This grade-change request has already been decided" }));
    expect(screen.getByRole("alert")).toHaveTextContent("This grade-change request has already been decided");
    expect(screen.getByRole("button", { name: "Approve B → A" })).toBeEnabled();
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("confirms the decision after it is saved", () => {
    render(<GradeRequestList decided="rejected" requests={[decided]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Request rejected. The grade is unchanged");
  });
});

describe("society record formatting", () => {
  it("formats amounts, waiting time and record ids", () => {
    expect(formatLkr(1286000.5)).toBe("LKR 1,286,000.5");
    expect(waitingLabel("2026-10-24T10:00:00Z", new Date("2026-10-26T11:00:00Z"))).toBe("2 days");
    expect(isSocietyRecordId(SOCIETY_ID)).toBe(true);
    expect(isSocietyRecordId("society-pahala-kosgama")).toBe(false);
  });
});
