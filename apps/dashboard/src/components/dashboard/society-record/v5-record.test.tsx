import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommitteeMember, GradeRequestDetail, SocietyRecord, StaffOptions } from "@sarvodaya-connect/api-contracts";

import { auditCsv, parseAuditFilters } from "@/lib/audit-log";

import { GradeReviewDecision } from "../grade-queue/grade-review-decision";
import { AssignStaffPanel } from "./assign-staff-panel";
import { CreateSocietyForm } from "./create-society-form";
import { emptyExco, excoFromCommittee, excoPayload, excoProblems, rowComplete, rowFilled } from "./exco-editor";

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
  it("saves a partly entered Exco, leaving empty seats for later", () => {
    const rows = excoFromCommittee([]);
    expect(excoProblems(rows)).toEqual([]);
    expect(excoPayload(rows)).toEqual([]);

    rows[0] = { ...rows[0]!, fullName: "Fictional Member 1", position: "President" };
    rows[1] = { ...rows[1]!, fullName: "Fictional Member 2" };
    expect(excoProblems(rows)).toEqual([]);
    expect(excoPayload(rows).map((seat) => seat.seatNumber)).toEqual([1, 2]);
  });

  it("names what stops saving: details without a name, or an office on an empty seat", () => {
    const rows = excoFromCommittee([]);
    rows[5] = { ...rows[5]!, profession: "Farmer" };
    expect(excoProblems(rows)).toEqual(["Seat 6: enter the full name, or clear the seat."]);
    expect(excoProblems(emptyExco())).toEqual(
      expect.arrayContaining(["Seat 1 is the President: enter their name, or choose another member."]),
    );
  });

  it("asks for the office bearers once all 25 seats are filled", () => {
    const noOffices = filledExco(false).map((row) => ({ ...row, position: "Member" }));
    expect(excoProblems(noOffices)).toEqual([
      "Choose the President from the 25 members.",
      "Choose the Secretary from the 25 members.",
      "Choose the Treasurer from the 25 members.",
    ]);
    expect(excoProblems(filledExco(false))).toEqual([]);
  });

  it("marks seats with a name but missing details, without blocking the save", () => {
    const basic = filledExco(false);
    expect(basic.every(rowFilled)).toBe(true);
    expect(basic.some(rowComplete)).toBe(false);
    expect(filledExco(true).every(rowComplete)).toBe(true);
    expect(excoProblems(basic)).toEqual([]);
  });

  it("gives each empty seat a group with room, so no group goes over its number", () => {
    // Children entered in seats 1–3, where a new Exco puts ordinary members.
    const members: CommitteeMember[] = [1, 2, 3].map((seatNumber) => ({
      id: `m${seatNumber}`,
      fullName: `Fictional Child ${seatNumber}`,
      position: "Member",
      isActive: true,
      seatNumber,
      seatType: "CHILDREN",
    }));
    const groups = excoFromCommittee(members).reduce<Record<string, number>>(
      (all, row) => ({ ...all, [row.seatType]: (all[row.seatType] ?? 0) + 1 }),
      {},
    );
    expect(groups).toEqual({ CHILDREN: 3, YOUTH: 3, MOTHERS: 3, ORDINARY: 9, ELDERS_COUNCIL: 7 });
  });

  it("rejects a future date of birth and a malformed NIC", () => {
    const rows = filledExco(true);
    rows[3]!.dateOfBirth = "2999-01-01";
    rows[4]!.nic = "1234";
    expect(excoProblems(rows, "2026-11-02")).toEqual([
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

  it("saves the society details only; the Exco is entered later", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({}));
    render(<CreateSocietyForm action={action} districts={[{ id: "d1", nameEn: "Kurunegala" }]} />);

    expect(screen.queryAllByRole("textbox", { name: /full name/ })).toHaveLength(0);
    expect(screen.getByText(/The Exco is entered later\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save and assign staff" }));
    expect(screen.getByText("Enter the S number, for example S-104233.")).toBeInTheDocument();
    expect(screen.getByText("Choose the district.")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Society name/), "Fictional Wellawa Society");
    await user.type(screen.getByLabelText(/^S number/), "S-777001");
    await user.selectOptions(screen.getByLabelText(/^District/), "d1");
    await user.type(screen.getByLabelText(/^DS division/), "Fictional DS");
    await user.type(screen.getByLabelText(/^Address/), "Fictional Road");
    await user.type(screen.getByLabelText(/^Number of members/), "164");
    await user.click(screen.getByRole("button", { name: "Save and assign staff" }));

    expect(action).toHaveBeenCalledTimes(1);
    const form = (action.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(form.get("nameEn")).toBe("Fictional Wellawa Society");
    expect(form.get("districtId")).toBe("d1");
    expect(form.has("council")).toBe(false);
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
