import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { AnnualFinancialSummary, SocietyRecord, WorkPlanOverview as WorkPlan } from "@sarvodaya-connect/api-contracts";

import { excoProgress, formatLkr, isSocietyRecordId, waitingLabel } from "@/lib/society-record-format";

import { fakeMapbox } from "../maps/fake-mapbox.test-helper";

import { AnnualSummaryCards } from "./annual-summary-cards";
import { EditSocietyPanel } from "./edit-society-panel";
import { ExcoTable } from "./exco-table";
import { GradeRequestList, HistoryList } from "./record-lists";
import { RecordOverview } from "./record-overview";
import { WorkPlanOverview } from "./work-plan-overview";

vi.mock("mapbox-gl", () => import("../maps/fake-mapbox.test-helper"));
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

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
  excoStatus: {
    filledSeats: 2,
    totalSeats: 25,
    complete: false,
    missingOffices: ["Treasurer"],
    problems: ["23 of 25 seats are still to fill.", "No Treasurer chosen yet."],
  },
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

  it("fills the latitude and longitude fields from a click on the street map", async () => {
    fakeMapbox.reset();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "pk.test-only");
    onTestFinished(() => vi.unstubAllEnvs());
    render(<EditSocietyPanel action={vi.fn()} hqName="HQ" record={{ ...record, location: { latitude: 7.5, longitude: 80.4 } }} />);
    await screen.findByRole("img", { name: /Map pin for Pahala Kosgama SSS/ });
    act(() => fakeMapbox.maps[0]!.emit("click", { lngLat: { lat: 7.6123, lng: 80.2354 } }));
    expect(screen.getByRole("textbox", { name: "Latitude" })).toHaveValue("7.6123");
    expect(screen.getByRole("textbox", { name: "Longitude" })).toHaveValue("80.2354");
    // The pin follows, and the change can be saved through the existing profile update.
    await waitFor(() => expect(fakeMapbox.markers[0]!.lngLat).toEqual([80.2354, 7.6123]));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("keeps typed coordinates, with no map, when Mapbox is not set up", () => {
    fakeMapbox.reset();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
    render(<EditSocietyPanel action={vi.fn()} hqName="HQ" record={record} />);
    vi.unstubAllEnvs();
    expect(screen.getByRole("textbox", { name: "Latitude" })).toHaveValue("");
    expect(screen.getByText("Type the coordinates.")).toBeInTheDocument();
    expect(fakeMapbox.maps).toHaveLength(0);
  });
});

/** 25 fictional members; seats 1–3 are the President, Secretary and Treasurer unless [offices] says otherwise. */
function fullCommittee(offices: string[] = ["President", "Secretary", "Treasurer"]) {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `full-${index + 1}`,
    seatNumber: index + 1,
    fullName: `Fictional Member ${index + 1}`,
    position: offices[index] ?? "Member",
    isActive: true,
  }));
}

describe("Exco completion comes from the API (excoStatus)", () => {
  const noTreasurer = {
    filledSeats: 25,
    totalSeats: 25 as const,
    complete: false,
    missingOffices: ["Treasurer" as const],
    problems: ["No Treasurer chosen yet."],
  };

  it("shows 25 seats without a Treasurer as incomplete, and says what is missing", () => {
    render(
      <ExcoTable
        accessNote="HQ has national access"
        editHref="/societies/x/exco/edit"
        members={fullCommittee(["President", "Secretary"])}
        revealNic={vi.fn()}
        status={noTreasurer}
      />,
    );
    expect(screen.getByText("25 of 25 Exco seats filled")).toBeInTheDocument();
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No Treasurer chosen yet.");
    expect(screen.queryByText("✓ Complete")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue the Exco/ })).toBeInTheDocument();
  });

  it("shows a full Exco with all three office bearers as complete", () => {
    render(
      <ExcoTable
        accessNote="HQ has national access"
        members={fullCommittee()}
        revealNic={vi.fn()}
        status={{ filledSeats: 25, totalSeats: 25, complete: true, missingOffices: [], problems: [] }}
      />,
    );
    expect(screen.getByText("✓ Complete")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("labels the record from the API's status, never from the seat count", () => {
    expect(excoProgress(noTreasurer).label).toBe("Exco incomplete · no Treasurer");
    expect(excoProgress(record.excoStatus).label).toBe("Exco incomplete · 2 of 25");
    expect(excoProgress({ ...noTreasurer, filledSeats: 0, problems: [] }).label).toBe("Exco not entered yet");
    // Without a status from the API, 25 members are still not called complete.
    expect(excoProgress(undefined, fullCommittee()).complete).toBe(false);
    expect(excoProgress({ ...noTreasurer, complete: true, missingOffices: [], problems: [] }).label).toBe("Exco complete");
  });
});

describe("D05x Exco", () => {
  it("masks NICs and shows one for 30 seconds after Show", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const reveal = vi.fn().mockResolvedValue({ nic: "198400000012" });
    render(<ExcoTable accessNote="HQ has national access" members={record.committee} revealNic={reveal} status={record.excoStatus} />);
    expect(screen.getByText("2 of 25 Exco seats filled")).toBeInTheDocument();
    expect(screen.getByText("Incomplete · 23 to fill")).toBeInTheDocument();
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
  const plan: WorkPlan = {
    societyId: SOCIETY_ID,
    year: 2027,
    totalAllocated: 80000,
    counts: { planned: 2, approved: 1, waiting: 1, sentBack: 0 },
    permissions: { canAddActivities: true },
    activities: [
      { id: "a", year: 2027, month: 1, name: "Tank cleaning shramadana", description: "Clear the tank.", sector: "Environment", allocatedCost: 25000, status: "APPROVED", sdgs: [6, 15] },
      { id: "b", year: 2027, month: 9, name: "Youth leadership camp", description: "Three-day camp.", datesLabel: "12–14 Sep", allocatedCost: 55000, status: "WAITING_FOR_SPC", sdgs: [] },
    ],
    lastChange: { at: "2026-10-18T04:00:00.000Z", by: { displayName: "S. Karunaratne", role: "PROGRAMME_COORDINATOR" } },
  };

  it("lists activities by month with the planning-only notice and total", () => {
    render(<WorkPlanOverview plan={plan} societyId={SOCIETY_ID} />);
    expect(screen.getByText("Activity planning only")).toBeInTheDocument();
    expect(screen.getByText("Total allocated for planning: LKR 80,000")).toBeInTheDocument();
    expect(screen.getByText("Last changed by S. Karunaratne (SPC) · 18 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("12–14 Sep")).toBeInTheDocument();
  });

  it("shows each activity's SPC status and UN SDGs, and counts only approved ones", () => {
    render(<WorkPlanOverview plan={plan} societyId={SOCIETY_ID} />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Waiting for SPC")).toBeInTheDocument();
    expect(screen.getByText("Clean water and sanitation")).toBeInTheDocument();
    expect(screen.getByText("Life on land")).toBeInTheDocument();
    expect(screen.getByText(/1 approved by the SPC · 1 waiting/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Add activity" })).toHaveAttribute(
      "href",
      `/societies/${SOCIETY_ID}/work-plan/new?year=2027`,
    );
  });

  it("hides Add activity from people who only view", () => {
    render(<WorkPlanOverview plan={{ ...plan, permissions: { canAddActivities: false } }} societyId={SOCIETY_ID} />);
    expect(screen.queryByRole("link", { name: "+ Add activity" })).not.toBeInTheDocument();
  });

  it("shows an empty plan plainly", () => {
    render(
      <WorkPlanOverview
        plan={{ societyId: SOCIETY_ID, year: 2027, totalAllocated: 0, activities: [], counts: { planned: 0, approved: 0, waiting: 0, sentBack: 0 }, permissions: { canAddActivities: false } }}
        societyId={SOCIETY_ID}
      />,
    );
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
