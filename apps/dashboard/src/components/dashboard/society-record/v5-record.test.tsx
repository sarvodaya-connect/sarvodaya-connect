import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GradeRequestDetail, SocietyRecord, StaffOptions } from "@sarvodaya-connect/api-contracts";

import { auditCsv, parseAuditFilters } from "@/lib/audit-log";

import { GradeReviewDecision } from "../grade-queue/grade-review-decision";
import { AssignStaffPanel } from "./assign-staff-panel";
import { CreateSocietyForm } from "./create-society-form";
import { emptyExco, excoPayload, excoProblems } from "./exco-editor";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function filledExco(complete: boolean) {
  return emptyExco().map((row) => ({
    ...row,
    fullName: `Fictional Member ${row.seatNumber}`,
    dateOfBirth: "1975-03-12",
    ...(complete
      ? { nic: `19900000${String(row.seatNumber).padStart(4, "0")}`, profession: "Farmer", phone: "+94000000100", addressLine: "Fictional Lane" }
      : {}),
  }));
}

describe("Exco editor rules (V5 D05c, Edit Exco)", () => {
  it("counts seats and names the missing office bearers", () => {
    const rows = emptyExco();
    rows[0]!.position = "Member";
    expect(excoProblems(rows)).toEqual(
      expect.arrayContaining([
        "Every society must have exactly 25 Exco members. 0 are entered — enter the rest to continue.",
        "Choose the President from the 25 members.",
      ]),
    );
  });

  it("needs every detail for a new society but only name and date of birth when editing", () => {
    const basic = filledExco(false);
    expect(excoProblems(basic, "edit")).toEqual([]);
    expect(excoProblems(basic, "create")[0]).toContain("0 are entered");
    expect(excoProblems(filledExco(true), "create")).toEqual([]);
  });

  it("rejects a future date of birth and a malformed NIC", () => {
    const rows = filledExco(true);
    rows[3]!.dateOfBirth = "2999-01-01";
    rows[4]!.nic = "1234";
    expect(excoProblems(rows, "create", "2026-11-02")).toEqual([
      "Seat 4: the date of birth is in the future.",
      "Seat 5: enter a valid NIC (9 digits and V or X, or 12 digits).",
    ]);
  });

  it("makes the President the primary contact and upper-cases NICs", () => {
    const rows = filledExco(true);
    rows[1]!.nic = "901234567v";
    const payload = excoPayload(rows);
    expect(payload[0]).toMatchObject({ position: "President", isPrimaryContact: true });
    expect(payload[1]).toMatchObject({ position: "Secretary", isPrimaryContact: false, nic: "901234567V" });
  });
});

const record = {
  id: "s1",
  nameEn: "Fictional Society",
  societyCode: "S-1",
  district: { id: "d1", nameEn: "Kurunegala" },
} as unknown as SocietyRecord;

const options: StaffOptions = {
  districtManagers: [{ id: "dm", displayName: "R. Fernando", username: "r.fernando", assignedHere: false, otherSocieties: 0 }],
  deputies: [{ id: "ddm", displayName: "P. Dissanayake", username: "p.d", assignedHere: true, otherSocieties: 3 }],
  coordinators: [
    { id: "spc1", displayName: "M. Herath", username: "m.herath", assignedHere: true, otherSocieties: 4 },
    { id: "spc2", displayName: "S. Karunaratne", username: "s.k", assignedHere: false, otherSocieties: 11 },
  ],
  officers: [{ id: "so", displayName: "N. Wijesinghe", username: "n.wijesinghe", assignedHere: false, otherSocieties: 1 }],
};

describe("D05a assign responsible staff", () => {
  it("shows the DM, says who is being replaced and needs all three roles", async () => {
    const user = userEvent.setup();
    render(<AssignStaffPanel action={vi.fn(async () => ({}))} options={options} record={record} />);

    expect(screen.getByText("R. Fernando · Kurunegala")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save assignments" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/Society Program Coordinator/), "spc2");
    expect(screen.getByText(/Changing from M. Herath\./)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Society Officer/), "so");
    expect(screen.getByRole("option", { name: /N. Wijesinghe · n.wijesinghe \(moves from another society\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save assignments" })).toBeEnabled();
  });
});

describe("D22r decision", () => {
  const request = {
    id: "r1",
    fromGrade: "B",
    toGrade: "A",
    requestedBy: { displayName: "S. Karunaratne", role: "PROGRAMME_COORDINATOR" },
  } as unknown as GradeRequestDetail;

  it("approves by default and needs a comment to reject", async () => {
    const user = userEvent.setup();
    const decide = vi.fn(async () => ({}));
    render(<GradeReviewDecision decide={decide} request={request} />);

    expect(screen.getByRole("button", { name: /Approve grade A/ })).toBeEnabled();
    await user.click(screen.getByRole("radio", { name: /Reject · keep grade B/ }));
    expect(screen.getByRole("button", { name: /Reject and keep B/ })).toBeDisabled();
    expect(screen.getByText("Enter a reason for rejecting. The requester will see it.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "Audit report missing");
    await user.click(screen.getByRole("button", { name: /Reject and keep B/ }));
    expect(decide).toHaveBeenCalledWith("REJECT", "Audit report missing");
  });
});

describe("D05n create a society", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks step 1 before moving to the 25 Exco seats", async () => {
    const user = userEvent.setup();
    render(<CreateSocietyForm action={vi.fn(async () => ({}))} districts={[{ id: "d1", nameEn: "Kurunegala" }]} />);

    await user.click(screen.getByRole("button", { name: "Next: Exco members" }));
    expect(screen.getByText("Enter the S number, for example S-104233.")).toBeInTheDocument();
    expect(screen.getByText("Choose the district.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Society name/), "Fictional Wellawa Society");
    await user.type(screen.getByLabelText(/^S number/), "S-777001");
    await user.selectOptions(screen.getByLabelText(/^District/), "d1");
    await user.type(screen.getByLabelText(/^DS division/), "Fictional DS");
    await user.type(screen.getByLabelText(/^Address/), "Fictional Road");
    await user.type(screen.getByLabelText(/^Number of members/), "164");
    await user.click(screen.getByRole("button", { name: "Next: Exco members" }));

    expect(screen.getAllByRole("textbox", { name: /full name/ })).toHaveLength(25);
    expect(screen.getByRole("button", { name: "Save and assign staff" })).toBeDisabled();
    expect(screen.getByText(/Every seat needs a full name, NIC/)).toBeInTheDocument();
  });
});

describe("D24 log helpers", () => {
  it("keeps filters to known values", () => {
    expect(parseAuditFilters({ type: "GRADE", role: "HACKER", days: "999", districtId: "x" })).toEqual({
      q: "",
      districtId: "",
      type: "GRADE",
      role: "",
      days: "30",
    });
  });

  it("quotes CSV cells and blocks spreadsheet formulas", () => {
    const csv = auditCsv([
      {
        id: "1",
        createdAt: "2026-11-02T08:00:00.000Z",
        action: "SOCIETY_PROFILE_UPDATED",
        type: "SOCIETY",
        actor: { displayName: '=HYPERLINK("x")', role: "HQ_ADMIN" },
        scope: "Pahala, Kosgama",
        societyId: null,
        detail: 'Said "hello"',
        approvedBy: null,
      },
    ]);
    const row = csv.split("\r\n")[1]!;
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain('"Pahala, Kosgama"');
    expect(row).toContain('"Society edit"');
    expect(row).toContain('"Said ""hello"""');
  });
});
