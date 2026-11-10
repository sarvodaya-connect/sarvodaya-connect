import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GradeChangeRequest, GradeRequestDetail, SocietyRecord, StaffOptions } from "@sarvodaya-connect/api-contracts";

import { si } from "@/i18n/messages/si";
import { ta } from "@/i18n/messages/ta";
import { I18nProvider } from "@/i18n/provider";
import { createTranslator, type Messages } from "@/i18n/translate";

import { PageStatesGallery } from "../page-states-gallery";
import { SocietyNoAccess } from "../district-access/no-access-views";
import { TemporaryRecordNotice } from "../district-access/record-access-notice";
import { GradeReviewDecision } from "../grade-queue/grade-review-decision";
import { AssignStaffPanel } from "./assign-staff-panel";
import { CreateSocietyForm } from "./create-society-form";
import { EditSocietyPanel } from "./edit-society-panel";
import { ExcoEditForm } from "./exco-edit-form";
import { excoProblems, excoStillMissing, emptyExco } from "./exco-editor";
import { ExcoTable } from "./exco-table";
import { GradeRequestList, HistoryList } from "./record-lists";
import { RecordHeader } from "./record-header";
import { RecordOverview } from "./record-overview";

/**
 * Issue #108 phase 3 on the dashboard: society records in Sinhala and Tamil.
 * Everyone and every society here is fictional, and the translations are
 * unreviewed drafts.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/societies/x", useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("mapbox-gl", () => import("../maps/fake-mapbox.test-helper"));
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

const SOCIETY_ID = "29000000-0000-4000-8000-000000000101";

const request: GradeChangeRequest = {
  id: "request",
  societyId: SOCIETY_ID,
  fromGrade: "B",
  toGrade: "A",
  reason: "The Exco was re-formed at the AGM.",
  status: "PENDING",
  requestedBy: { displayName: "S. Karunaratne", role: "PROGRAMME_COORDINATOR" },
  requestedAt: "2026-10-24T10:10:00.000Z",
};

const record = {
  id: SOCIETY_ID,
  societyCode: "S-104233",
  nameEn: "Pahala Kosgama SSS",
  district: { id: "district", code: "KG", nameEn: "Kurunegala" },
  status: "ACTIVE",
  updatedAt: "2026-10-30T04:00:00.000Z",
  address: { addressLine: "Temple Road, Pahala Kosgama", dsDivision: "Kuliyapitiya East" },
  committee: [
    { id: "m2", seatNumber: 2, fullName: "N. Wijesinghe", position: "Secretary", isActive: true, age: 42, nicMasked: "••••0012" },
    { id: "m1", seatNumber: 1, fullName: "A. Jayasekara", position: "President", isActive: true, age: 58, nicMasked: "••••0047" },
  ],
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
  openGradeRequest: request,
  lastChange: { at: "2026-10-01T04:00:00.000Z", by: { displayName: "N. Wijesinghe", role: "SOCIETY_OFFICER" } },
  staff: [
    { role: "SOCIETY_OFFICER", displayName: "N. Wijesinghe", accountStatus: "ACTIVE" },
    { role: "PROGRAMME_COORDINATOR", displayName: "S. Karunaratne", accountStatus: "PENDING" },
  ],
  annualSummary: {
    societyId: SOCIETY_ID,
    financialYear: { startYear: 2025, label: "FY 2025/26", startsOn: "2025-04-01", endsOn: "2026-03-31" },
    totalProfit: null,
    totalExpenses: null,
    auditReport: null,
  },
  permissions: { canEdit: true, canEditSocietyCode: true, canChangeGrade: true, canRequestGradeChange: false },
} as unknown as SocietyRecord;

const options: StaffOptions = {
  districtManagers: [],
  deputies: [{ id: "ddm", displayName: "P. Dissanayake", username: "p.d", assignedHere: true, otherSocieties: 3 }],
  coordinators: [{ id: "spc1", displayName: "M. Herath", username: "m.herath", assignedHere: true, otherSocieties: 4 }],
  officers: [{ id: "so", displayName: "N. Wijesinghe", username: "n.wijesinghe", assignedHere: false, otherSocieties: 1 }],
};

const detail = {
  ...request,
  society: {
    id: SOCIETY_ID,
    name: "Pahala Kosgama SSS",
    societyCode: "S-104233",
    district: "Kurunegala",
    memberCount: 418,
    excoMembers: 2,
    planYear: 2026,
    planActivities: 3,
    updatedAt: "2026-10-30T04:00:00.000Z",
  },
  history: [],
} as unknown as GradeRequestDetail;

/** Fails if any of [english] is still shown. */
function expectNoEnglish(container: HTMLElement, english: string[]) {
  const text = container.textContent ?? "";
  for (const phrase of english) expect(text, `"${phrase}" is still in English`).not.toContain(phrase);
}

describe.each([
  ["si", si],
  ["ta", ta],
] as const)("society records in %s", (locale, messages) => {
  const t = createTranslator(messages as Messages, locale);
  const wrap = (node: ReactNode) => (
    <I18nProvider available={["en", "si", "ta"]} locale={locale} messages={messages as Messages}>
      {node}
    </I18nProvider>
  );

  it("D05: the header and overview, with names and S numbers as stored", () => {
    const { container } = render(
      wrap(
        <>
          <RecordHeader isHq record={record} t={t} tabs={[{ href: `/societies/${SOCIETY_ID}`, label: t("sr.tab.overview") }]} />
          <RecordOverview canAssign record={record} t={t} workPlan={null} />
        </>,
      ),
    );
    expect(screen.getByText(t("sr.header.edit"))).toBeInTheDocument();
    expect(screen.getByText(t("sr.ov.details"))).toBeInTheDocument();
    expect(screen.getByText(t("sr.ov.excoTitle", { filled: 2 }))).toBeInTheDocument();
    expect(screen.getAllByText("Pahala Kosgama SSS").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/S-104233/).length).toBeGreaterThan(0);
    // The office is translated; the stored value is not touched.
    expect(screen.getByText(t("sr.office.President"))).toBeInTheDocument();
    expectNoEnglish(container, [
      "Edit society",
      "Change assignments",
      "Review grade request",
      "Society Details",
      "Number of members",
      "Responsible Staff",
      "Seats Filled",
      "Grade history",
      "Only HQ changes grades",
      "No activities planned yet",
      "last changed",
    ]);
  });

  it("D05x: the Exco table keeps names and masked NICs, and the API's own sentences as sent", () => {
    const { container } = render(
      wrap(
        <ExcoTable
          accessNote={t("sr.ex.accessHq")}
          editHref="/societies/x/exco/edit"
          members={record.committee}
          revealNic={vi.fn()}
          status={record.excoStatus}
        />,
      ),
    );
    expect(screen.getByText(t("sr.ex.seatsFilled", { filled: 2 }))).toBeInTheDocument();
    expect(screen.getByText("A. Jayasekara")).toBeInTheDocument();
    expect(screen.getByText(/•••• •••• 0047/)).toBeInTheDocument();
    // Written by the API: stays English until the API messages phase.
    expect(screen.getByText("No Treasurer chosen yet.")).toBeInTheDocument();
    expectNoEnglish(container, ["Personal details", "Exco Seats Filled", "Change office bearers", "Continue the Exco", "Date of birth"]);
  });

  it("Edit Exco: the app's own validation follows the language", () => {
    const rows = emptyExco();
    rows[5] = { ...rows[5]!, profession: "Farmer" };
    expect(excoProblems(rows, undefined, t)).toContain(t("sr.ee.seatName", { seat: 6 }));
    expect(excoStillMissing([], t)).toEqual([t("sr.ee.noneYet")]);
    const { container } = render(wrap(<ExcoEditForm action={vi.fn(async () => ({}))} focusOffices={false} members={[]} societyId={SOCIETY_ID} />));
    expect(screen.getByText(t("sr.ee.title"))).toBeInTheDocument();
    expectNoEnglish(container, ["Save Exco", "Office Bearers", "Progress", "Not entered yet", "Full name"]);
  });

  it("D05e: editing a society, with the grade-change reason it needs", async () => {
    const user = userEvent.setup();
    const { container } = render(wrap(<EditSocietyPanel action={vi.fn(async () => ({}))} hqName="D. Gunawardena" record={record} />));
    expect(screen.getByText(t("sr.ed.title"))).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox"), "A");
    expect(screen.getByText(t("sr.ed.reasonMissing"))).toBeInTheDocument();
    // The option still sends the stored value.
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("A");
    expectNoEnglish(container, ["Edit Society Information", "Save changes", "Reason for the grade change", "Map Location"]);
  });

  it("D05n: creating a society shows its validation in the language", async () => {
    const user = userEvent.setup();
    const { container } = render(wrap(<CreateSocietyForm action={vi.fn(async () => ({}))} districts={[{ id: "d1", nameEn: "Kurunegala" }]} />));
    await user.click(screen.getByRole("button", { name: t("sr.cr.submit") }));
    expect(screen.getByText(t("sr.cr.required.name"))).toBeInTheDocument();
    expect(screen.getByText(t("sr.cr.required.district"))).toBeInTheDocument();
    expectNoEnglish(container, ["Create a Society Record", "Enter the society name", "Choose the district", "Starting grade"]);
  });

  it("D05a: assigning staff keeps people's names and usernames", async () => {
    const user = userEvent.setup();
    const { container } = render(wrap(<AssignStaffPanel action={vi.fn(async () => ({}))} options={options} record={record} />));
    expect(screen.getByText(t("sr.as.noDm", { district: "Kurunegala" }))).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(new RegExp(`^${t("sr.role.societyOfficer")}`)), "so");
    expect(screen.getByRole("option", { name: t("sr.as.moves", { name: "N. Wijesinghe · n.wijesinghe" }) })).toBeInTheDocument();
    expectNoEnglish(container, ["Assign Responsible Staff", "Save assignments", "Choose a person", "moves from another society"]);
  });

  it("D05 grade and history tabs, and the decision message", () => {
    const { container } = render(
      wrap(
        <>
          <GradeRequestList decided="approved" requests={[request]} t={t} />
          <HistoryList events={[]} societyId={SOCIETY_ID} t={t} />
        </>,
      ),
    );
    expect(screen.getByText(t("sr.gr.decidedApproved"))).toBeInTheDocument();
    expect(screen.getByText(t("sr.gr.waitingHq"))).toBeInTheDocument();
    // What the requester wrote stays as written.
    expect(screen.getByText("“The Exco was re-formed at the AGM.”")).toBeInTheDocument();
    expectNoEnglish(container, ["Waiting for HQ", "Sent by", "No changes recorded", "Every change shows"]);
  });

  it("D22r: rejecting needs a comment, said in the language", async () => {
    const user = userEvent.setup();
    const { container } = render(wrap(<GradeReviewDecision decide={vi.fn(async () => ({}))} request={detail} />));
    await user.click(screen.getByRole("radio", { name: new RegExp(t("sr.r.optRejectHint")) }));
    expect(screen.getByText(t("sr.gr.reasonRequired"))).toBeInTheDocument();
    expectNoEnglish(container, ["Your Decision", "Approve ·", "Reject ·", "Back to queue"]);
  });

  it("D21, ST02 and ST04: the shared states and a society the user cannot open", () => {
    const { container } = render(
      wrap(
        <>
          <PageStatesGallery />
          <SocietyNoAccess assigned={1} isHq={false} t={t} />
          <TemporaryRecordNotice t={t} until="2026-10-31T12:30:00.000Z" viewerName="P. Dissanayake" />
        </>,
      ),
    );
    expect(screen.getByText(t("st.gallery.title"))).toBeInTheDocument();
    expect(screen.getByText(t("st.noResultsSocieties"))).toBeInTheDocument();
    expect(screen.getByText(t.plural("st.society.notYoursCount", 1))).toBeInTheDocument();
    expectNoEnglish(container, [
      "Page States",
      "No Societies Match",
      "Clear all filters",
      "We Couldn’t Load This Page",
      "You Don’t Have Access",
      "assigned society",
      "temporary district-wide view",
    ]);
  });
});
