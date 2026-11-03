"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { EmergencyAssessmentInput, EmergencyEvidenceUpload } from "@sarvodaya-connect/api-contracts";

import { getDesktopViewer } from "@/lib/current-viewer";
import { failureMessage } from "@/lib/emergency-api";
import { isUuid, safeLinkPath } from "@/lib/emergency-format";
import { platformApi } from "@/lib/platform-api";

/**
 * V5 PR 8 server actions. The dashboard checks only what it needs to build a
 * request; the API decides every permission again (scope, HQ-only actions).
 */
export type IncidentFormState = { error?: string };

/** datetime-local has no offset: read it as Sri Lanka time (UTC+05:30). */
function sriLankaTime(value: string): Date {
  return new Date(`${value}:00+05:30`);
}

function text(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

function post(path: string, body: object) {
  return platformApi(path, { method: "POST", body: JSON.stringify(body) });
}

function refresh(incidentId?: string) {
  revalidatePath("/emergencies");
  if (incidentId) revalidatePath(`/emergencies/${incidentId}`);
  revalidatePath("/dashboard");
}

/** V5 D30 / IR02: open an incident for a society the user looks after. */
export async function openIncident(_state: IncidentFormState, form: FormData): Promise<IncidentFormState> {
  await getDesktopViewer();
  const reportingSocietyId = text(form, "reportingSocietyId", 36);
  const districtIds = form.getAll("districtIds").map(String).filter(isUuid);
  const startedAt = sriLankaTime(text(form, "startedAt", 16));
  const dueValue = text(form, "assessmentsDueAt", 16);
  const dueAt = dueValue ? sriLankaTime(dueValue) : null;
  if (!isUuid(reportingSocietyId)) return { error: "Choose the society reporting it." };
  if (!districtIds.length) return { error: "Choose the districts affected." };
  if (!Number.isFinite(startedAt.getTime())) return { error: "Enter when it started." };
  if (dueAt && !Number.isFinite(dueAt.getTime())) return { error: "Enter when assessments are due." };
  const title = text(form, "title", 160);
  const description = text(form, "description", 1000);
  const message = text(form, "message", 1000);
  let id: string;
  try {
    const opened: { id: string } = await post("/emergencies/incidents", {
      type: text(form, "type", 20),
      reportingSocietyId,
      districtIds,
      startedAt: startedAt.toISOString(),
      ...(dueAt ? { assessmentsDueAt: dueAt.toISOString() } : {}),
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(message ? { message } : {}),
    });
    id = opened.id;
  } catch (error) {
    return { error: failureMessage(error) };
  }
  refresh(id);
  redirect(`/emergencies/${id}?opened=1`);
}

/** V5 IR03 / M42: send a rapid assessment. Sent online only; a retry with the same id is safe. */
export async function sendAssessment(incidentId: string, input: EmergencyAssessmentInput): Promise<{ id?: string; error?: string }> {
  await getDesktopViewer();
  if (!isUuid(incidentId)) return { error: "This incident could not be found." };
  try {
    const sent: { id: string } = await post(`/emergencies/incidents/${incidentId}/assessments`, input);
    refresh(incidentId);
    return { id: sent.id };
  } catch (error) {
    return { error: failureMessage(error) };
  }
}

/** A short-lived upload link for a photo or PDF with an assessment. */
export async function startEvidenceUpload(
  assessmentId: string,
  file: { contentType: string; sizeBytes: number; checksumSha256: string },
): Promise<{ error?: string; evidenceId?: string; upload?: EmergencyEvidenceUpload["upload"] }> {
  await getDesktopViewer();
  if (!isUuid(assessmentId)) return { error: "This assessment could not be found." };
  try {
    const started: EmergencyEvidenceUpload = await post(`/emergencies/assessments/${assessmentId}/evidence`, file);
    return { evidenceId: started.evidence.id, upload: started.upload };
  } catch (error) {
    return { error: failureMessage(error) };
  }
}

export async function completeEvidenceUpload(evidenceId: string): Promise<{ error?: string }> {
  await getDesktopViewer();
  if (!isUuid(evidenceId)) return { error: "This photo could not be found." };
  try {
    await post(`/emergencies/evidence/${evidenceId}/complete`, {});
    return {};
  } catch (error) {
    return { error: failureMessage(error) };
  }
}

/** A short-lived link to look at a photo, after the API checks the user's scope. */
export async function openEvidence(form: FormData): Promise<void> {
  await getDesktopViewer();
  const id = text(form, "evidenceId", 36);
  if (!isUuid(id)) redirect("/emergencies");
  const link: { url: string } = await post(`/emergencies/evidence/${id}/download`, {});
  redirect(link.url);
}

/** V5 IR04: close an incident. The API records who closed it and when. */
export async function closeIncident(form: FormData): Promise<void> {
  await getDesktopViewer();
  const id = text(form, "incidentId", 36);
  if (!isUuid(id)) redirect("/emergencies");
  let outcome = "closed";
  try {
    await post(`/emergencies/incidents/${id}/close`, {});
  } catch {
    outcome = "closeFailed";
  }
  refresh(id);
  redirect(`/emergencies/${id}?${outcome}=1`);
}

/** V5 D31: HQ reminds the societies that have not sent an assessment. */
export async function sendReminders(form: FormData): Promise<void> {
  await getDesktopViewer();
  const id = text(form, "incidentId", 36);
  if (!isUuid(id)) redirect("/emergencies");
  let outcome = "reminded";
  try {
    await post(`/emergencies/incidents/${id}/reminders`, {});
  } catch {
    outcome = "remindFailed";
  }
  refresh(id);
  redirect(`/emergencies/${id}?tab=assessments&${outcome}=1`);
}

/** V5 D32: HQ adds a need for a society in the area. */
export async function addNeed(_state: IncidentFormState, form: FormData): Promise<IncidentFormState> {
  await getDesktopViewer();
  const incidentId = text(form, "incidentId", 36);
  const quantity = Number(text(form, "quantity", 10));
  if (!isUuid(incidentId)) return { error: "This incident could not be found." };
  if (!Number.isInteger(quantity) || quantity < 1) return { error: "Enter how many are needed." };
  const due = text(form, "dueAt", 16);
  try {
    await post(`/emergencies/incidents/${incidentId}/actions`, {
      clientMutationId: crypto.randomUUID(),
      societyId: text(form, "societyId", 36),
      need: text(form, "need", 30),
      title: text(form, "title", 160),
      quantity,
      unit: text(form, "unit", 30),
      ...(due ? { dueAt: sriLankaTime(due).toISOString() } : {}),
    });
  } catch (error) {
    return { error: failureMessage(error) };
  }
  refresh(incidentId);
  redirect(`/emergencies/${incidentId}?tab=actions&added=1`);
}

/** V5 D32: HQ assigns the societies that will help with a need, and what each provides. */
export async function assignHelpers(_state: IncidentFormState, form: FormData): Promise<IncidentFormState> {
  await getDesktopViewer();
  const incidentId = text(form, "incidentId", 36);
  const actionId = text(form, "actionId", 36);
  if (!isUuid(incidentId) || !isUuid(actionId)) return { error: "This need could not be found." };
  const helpers = form
    .getAll("helper")
    .map(String)
    .filter(isUuid)
    .map((societyId) => ({ societyId, quantity: Number(form.get(`quantity-${societyId}`)) }));
  if (!helpers.length) return { error: "Choose at least one society to help." };
  if (helpers.some((h) => !Number.isInteger(h.quantity) || h.quantity < 1)) return { error: "Enter what each society provides." };
  const due = sriLankaTime(text(form, "dueAt", 16));
  if (!Number.isFinite(due.getTime())) return { error: "Enter when it must be delivered." };
  const note = text(form, "note", 1000);
  try {
    await post(`/emergencies/actions/${actionId}/helpers`, { helpers, dueAt: due.toISOString(), ...(note ? { note } : {}) });
  } catch (error) {
    return { error: failureMessage(error) };
  }
  refresh(incidentId);
  redirect(`/emergencies/${incidentId}?tab=actions&assigned=${helpers.length}`);
}

/** V5 D33 "Refresh from latest data": HQ makes the next numbered situation report. */
export async function createSituationReport(form: FormData): Promise<void> {
  await getDesktopViewer();
  const incidentId = text(form, "incidentId", 36);
  if (!isUuid(incidentId)) redirect("/emergencies");
  let target = `/emergencies/${incidentId}?tab=reports&reportFailed=1`;
  try {
    const report: { id: string } = await post(`/emergencies/incidents/${incidentId}/situation-reports`, {
      clientMutationId: crypto.randomUUID(),
      summary: text(form, "summary", 4000),
    });
    target = `/emergencies/${incidentId}?tab=reports&report=${report.id}`;
  } catch {
    // The page says the report could not be made.
  }
  refresh(incidentId);
  redirect(target);
}

/** V5 IR05: open a notification, marking it read first. */
export async function openNotification(form: FormData): Promise<void> {
  await getDesktopViewer();
  const id = text(form, "notificationId", 36);
  if (isUuid(id)) await platformApi(`/notifications/${id}/read`, { method: "POST", body: "{}" }).catch(() => undefined);
  revalidatePath("/", "layout");
  redirect(safeLinkPath(text(form, "linkPath", 255)) ?? "/dashboard");
}
