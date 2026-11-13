"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getT } from "@/i18n/server";
import { getDesktopViewer } from "@/lib/current-viewer";
import { parseCount } from "@/lib/count";
import { platformApi } from "@/lib/platform-api";

export type RecordFormResult = { error?: string };

/** Issue #141: the most members for each of female and male, and in all. */
const MAX_MEMBERS = 1_000_000;

const TEXT_FIELDS = ["nameEn", "societyCode", "landline", "addressLine", "dsDivision", "gnDivision", "businessDescription"] as const;

/**
 * D05e: HQ edits the society record. Only changed fields are sent; the API
 * checks HQ access, the S number and the grade-change reason itself.
 */
export async function updateSocietyRecord(
  id: string,
  _previous: RecordFormResult,
  form: FormData,
): Promise<RecordFormResult> {
  const [, t] = await Promise.all([getDesktopViewer(), getT()]);
  const body: Record<string, string | number> = {};
  for (const field of TEXT_FIELDS) {
    const value = form.get(field);
    const before = form.get(`${field}__before`);
    if (typeof value === "string" && value.trim() !== (before ?? "")) body[field] = value.trim();
  }
  // Issue #141: female and male go together; the API works out the total.
  const female = String(form.get("femaleMembers") ?? "").trim();
  const male = String(form.get("maleMembers") ?? "").trim();
  if (female !== (form.get("femaleMembers__before") ?? "") || male !== (form.get("maleMembers__before") ?? "")) {
    const femaleCount = parseCount(female, MAX_MEMBERS);
    const maleCount = parseCount(male, MAX_MEMBERS);
    if (femaleCount === null || maleCount === null) return { error: t("sr.err.members") };
    if (femaleCount + maleCount > MAX_MEMBERS) return { error: t("sr.ed.splitTooMany") };
    body.femaleMembers = femaleCount;
    body.maleMembers = maleCount;
  }
  const latitude = String(form.get("latitude") ?? "").trim();
  const longitude = String(form.get("longitude") ?? "").trim();
  if (latitude !== (form.get("latitude__before") ?? "") || longitude !== (form.get("longitude__before") ?? "")) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!latitude || !longitude || !(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180))
      return { error: t("sr.err.location") };
    body.latitude = lat;
    body.longitude = lng;
  }
  const grade = form.get("grade");
  if (typeof grade === "string" && grade && grade !== form.get("grade__before")) {
    const reason = form.get("gradeReason");
    if (typeof reason !== "string" || !reason.trim()) return { error: t("sr.err.gradeReason") };
    body.grade = grade;
    body.gradeReason = reason.trim();
  }
  if (Object.keys(body).length === 0) return { error: t("sr.err.nothing") };
  try {
    await platformApi(`/societies/${id}/profile`, { method: "PATCH", body: JSON.stringify(body) });
  } catch (error) {
    // The API's own message stays as sent until the API messages phase.
    return { error: error instanceof Error ? error.message : t("sr.err.saveSociety") };
  }
  revalidatePath(`/societies/${id}`, "layout");
  redirect(`/societies/${id}?saved=1`);
}

/**
 * D05: HQ approves or rejects a waiting grade-change request. The API checks
 * that the user is HQ, needs a reason to reject and refuses a second decision.
 */
export async function decideGradeRequest(
  societyId: string,
  requestId: string,
  decision: "APPROVE" | "REJECT",
  comment: string,
  /** D22r returns to its own page; the record's Grade tab is the default. */
  returnTo?: "queue",
): Promise<{ error?: string }> {
  const [, t] = await Promise.all([getDesktopViewer(), getT()]);
  const text = comment.trim();
  if (decision === "REJECT" && !text) return { error: t("sr.gr.reasonRequired") };
  try {
    await platformApi(`/societies/${societyId}/grade-requests/${requestId}/decision`, {
      method: "POST",
      body: JSON.stringify(text ? { decision, comment: text } : { decision }),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : t("sr.err.decision") };
  }
  revalidatePath(`/societies/${societyId}`, "layout");
  revalidatePath("/reviews", "layout");
  const decided = decision === "APPROVE" ? "approved" : "rejected";
  redirect(returnTo === "queue" ? `/reviews/${requestId}?decided=${decided}` : `/societies/${societyId}/grade?decided=${decided}`);
}

/** V5 D22r: the same decision, returning to the request page. */
export async function decideFromQueue(
  societyId: string,
  requestId: string,
  decision: "APPROVE" | "REJECT",
  comment: string,
): Promise<{ error?: string }> {
  return decideGradeRequest(societyId, requestId, decision, comment, "queue");
}

/** V5 D05a: HQ chooses the DDM, SPC and Society Officer. The API checks HQ, roles and district. */
export async function assignStaff(
  societyId: string,
  _previous: RecordFormResult,
  form: FormData,
): Promise<RecordFormResult> {
  const [, t] = await Promise.all([getDesktopViewer(), getT()]);
  const id = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  };
  const body = { deputyId: id("deputyId"), coordinatorId: id("coordinatorId"), officerId: id("officerId") };
  if (!body.deputyId || !body.coordinatorId || !body.officerId)
    return { error: t("sr.err.chooseStaff") };
  try {
    await platformApi(`/societies/${societyId}/assignments`, { method: "PUT", body: JSON.stringify(body) });
  } catch (error) {
    return { error: error instanceof Error ? error.message : t("sr.err.assignments") };
  }
  revalidatePath(`/societies/${societyId}`, "layout");
  redirect(`/societies/${societyId}?saved=1`);
}

/** D05x: shows one member's full NIC. The API checks scope and records the reveal. */
export async function revealMemberNic(societyId: string, memberId: string): Promise<{ nic?: string; error?: string }> {
  const [, t] = await Promise.all([getDesktopViewer(), getT()]);
  try {
    const result = await platformApi(`/societies/${societyId}/council/${memberId}/nic/reveal`, { method: "POST" });
    return { nic: result.nic };
  } catch (error) {
    return { error: error instanceof Error ? error.message : t("sr.ex.nicFailed") };
  }
}

type CouncilSeat = { seatNumber: number; nic?: string } & Record<string, unknown>;

/** The filled Exco seats, 0–25: a partly entered Exco can be saved. */
function readSeats(form: FormData, field = "council"): CouncilSeat[] | null {
  try {
    const seats = JSON.parse(String(form.get(field) ?? ""));
    return Array.isArray(seats) && seats.length <= 25 ? seats : null;
  } catch {
    return null;
  }
}

/**
 * NICs go to the NIC vault one member at a time, after the seats are saved,
 * so they are never part of the council update or the change log.
 */
async function storeNics(societyId: string, seats: CouncilSeat[], committee: { id: string; seatNumber?: number }[]) {
  const failed: number[] = [];
  for (const seat of seats.filter((item) => item.nic)) {
    const member = committee.find((item) => item.seatNumber === seat.seatNumber);
    try {
      if (!member) throw new Error("missing");
      await platformApi(`/societies/${societyId}/council/${member.id}/nic`, {
        method: "PUT",
        body: JSON.stringify({ nic: seat.nic }),
      });
    } catch {
      failed.push(seat.seatNumber);
    }
  }
  return failed;
}

/** V5 Edit Exco: the filled seats, saved together. The API checks scope, seat groups, offices and ages. */
export async function updateExco(societyId: string, _previous: RecordFormResult, form: FormData): Promise<RecordFormResult> {
  const [, t] = await Promise.all([getDesktopViewer(), getT()]);
  const seats = readSeats(form);
  if (!seats) return { error: t("sr.err.excoRead") };
  let committee: { id: string; seatNumber?: number }[];
  try {
    const record = await platformApi(`/societies/${societyId}/council`, {
      method: "PUT",
      // NICs are stored separately through the NIC vault below.
      body: JSON.stringify({ members: seats.map((seat) => Object.fromEntries(Object.entries(seat).filter(([key]) => key !== "nic"))) }),
    });
    committee = record.committee;
  } catch (error) {
    return { error: error instanceof Error ? error.message : t("sr.err.excoSave") };
  }
  const failed = await storeNics(societyId, seats, committee);
  revalidatePath(`/societies/${societyId}`, "layout");
  if (failed.length)
    return { error: t.plural("sr.err.nicStore", failed.length, { seats: failed.join(", ") }) };
  redirect(`/societies/${societyId}/exco?saved=1`);
}

export type CreateSocietyResult = RecordFormResult & { field?: "societyCode" };

/**
 * V5 D05n: HQ creates the society with its basic details, then assigns staff
 * (D05a). The Society Officer enters the Exco afterwards.
 */
export async function createSociety(_previous: CreateSocietyResult, form: FormData): Promise<CreateSocietyResult> {
  const [viewer, t] = await Promise.all([getDesktopViewer(), getT()]);
  if (viewer.role !== "HQ_ADMIN") return { error: t("sr.err.onlyHqCreate") };
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const number = (name: string) => (text(name) === "" ? undefined : Number(text(name)));
  const body = {
    societyCode: text("societyCode").toUpperCase(),
    nameEn: text("nameEn"),
    nameLocal: text("nameLocal") || undefined,
    districtId: text("districtId"),
    dsDivision: text("dsDivision"),
    gnDivision: text("gnDivision") || undefined,
    addressLine: text("addressLine"),
    memberCount: number("memberCount"),
    landline: text("landline") || undefined,
    grade: text("grade"),
    businessDescription: text("businessDescription") || undefined,
    latitude: number("latitude"),
    longitude: number("longitude"),
  };
  let created: { id: string };
  try {
    created = await platformApi("/societies", { method: "POST", body: JSON.stringify(body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : t("sr.err.createSave");
    return message.includes("is already used by") ? { error: message, field: "societyCode" } : { error: message };
  }
  revalidatePath("/societies", "layout");
  // Step 3 · Assign staff opens on the new record.
  redirect(`/societies/${created.id}?panel=assign`);
}

export type StartUploadResult = {
  error?: string;
  documentId?: string;
  upload?: { url: string; method: "PUT"; headers: Record<string, string> };
};

/**
 * V5 PR 4 documents: the API checks permission, records the metadata and
 * returns a short-lived pre-signed upload URL. The browser then sends the file
 * straight to storage, so it never passes through the dashboard or the API.
 */
export async function startDocumentUpload(
  societyId: string,
  input: {
    documentType: string;
    financialYear?: number;
    title: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    checksumSha256: string;
  },
): Promise<StartUploadResult> {
  await getDesktopViewer();
  try {
    const result = await platformApi("/documents", {
      method: "POST",
      body: JSON.stringify({ societyId, ...input }),
    });
    return { documentId: result.document.id, upload: result.upload };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The upload could not be started. Try again." };
  }
}

/** Confirms the file reached storage; the API checks its size before recording it. */
export async function completeDocumentUpload(societyId: string, documentId: string): Promise<{ error?: string }> {
  await getDesktopViewer();
  try {
    await platformApi(`/documents/${documentId}/complete`, { method: "POST" });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The upload could not be confirmed. Try again." };
  }
  revalidatePath(`/societies/${societyId}`, "layout");
  return {};
}

const ACTIVITY_COUNTS = [
  "femaleParticipants",
  "maleParticipants",
  "youthParticipants",
  "householdsBenefited",
  "womenHeadedHouseholds",
  "volunteerHours",
] as const;

/**
 * V5 D05w "Add activity": the activity is saved as waiting for the society's
 * SPC, who chooses the UN SDGs. The API checks who may add it and the numbers.
 */
export async function createActivity(
  societyId: string,
  _previous: RecordFormResult,
  form: FormData,
): Promise<RecordFormResult> {
  await getDesktopViewer();
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const body: Record<string, string | number> = {
    year: Number(form.get("year")),
    month: Number(form.get("month")),
    name: text("name"),
    description: text("description"),
    sector: text("sector"),
    dimension: text("dimension"),
  };
  const cost = text("allocatedCost").replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(cost)) return { error: "Enter the allocated cost in LKR using numbers only, for example 55000." };
  body.allocatedCost = Number(cost);
  for (const field of ACTIVITY_COUNTS) {
    const value = text(field);
    if (!value) continue;
    if (!/^\d+$/.test(value)) return { error: "Enter the participant counts and volunteer hours as whole numbers." };
    body[field] = Number(value);
  }
  for (const field of ["datesLabel", "partners", "resourcesNeeded"] as const) {
    if (text(field)) body[field] = text(field);
  }
  try {
    await platformApi(`/societies/${societyId}/activities`, { method: "POST", body: JSON.stringify(body) });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The activity could not be saved. Try again." };
  }
  revalidatePath(`/societies/${societyId}`, "layout");
  redirect(`/societies/${societyId}/work-plan?year=${body.year}&added=1`);
}
