"use server";

import { revalidatePath } from "next/cache";
import { getCurrentViewer } from "@/lib/current-viewer";
import { emergencyApiDemoUser, emergencyApiUrl } from "@/lib/emergency-api";

function value(form: FormData, key: string, maxLength: number) {
  const raw = form.get(key);
  if (typeof raw !== "string") throw new Error(`Missing ${key}`);
  const clean = raw.trim();
  if (!clean || clean.length > maxLength) throw new Error(`Invalid ${key}`);
  return clean;
}

async function post(path: string, payload: Record<string, unknown>) {
  const viewer = await getCurrentViewer();
  const user = emergencyApiDemoUser(viewer);
  if (!user || viewer.role === "SYSTEM_ADMIN") throw new Error("This role cannot use emergency response.");
  const response = await fetch(emergencyApiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Demo-User": user },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Emergency API request failed (${response.status})`);
  }
  revalidatePath("/emergencies");
}

async function patch(path: string, payload: Record<string, unknown>) {
  const viewer = await getCurrentViewer();
  const user = emergencyApiDemoUser(viewer);
  if (!user || viewer.role === "SYSTEM_ADMIN") throw new Error("This role cannot use emergency response.");
  const response = await fetch(emergencyApiUrl(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Demo-User": user },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Emergency API request failed (${response.status})`);
  }
  revalidatePath("/emergencies");
}

export async function updateIncidentStatus(form: FormData) {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN" && viewer.role !== "DISTRICT_MANAGER") throw new Error("Only District Managers and HQ can update incidents.");
  await patch(`/emergencies/incidents/${value(form, "incidentId", 36)}/status`, { status: value(form, "status", 20) });
}

export async function updateActionStatus(form: FormData) {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN" && viewer.role !== "DISTRICT_MANAGER") throw new Error("Only District Managers and HQ can update response actions.");
  await patch(`/emergencies/actions/${value(form, "actionId", 36)}/status`, { status: value(form, "status", 20) });
}

export async function activateIncident(form: FormData) {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN" && viewer.role !== "DISTRICT_MANAGER") throw new Error("Only District Managers and HQ can activate incidents.");
  await post("/emergencies/incidents", {
    districtId: value(form, "districtId", 36),
    title: value(form, "title", 160),
    type: value(form, "type", 40),
    severity: value(form, "severity", 20),
    location: value(form, "location", 200),
    description: value(form, "description", 4000),
  });
}

export async function createResponseAction(form: FormData) {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN" && viewer.role !== "DISTRICT_MANAGER") throw new Error("Only District Managers and HQ can coordinate response actions.");
  const optionalSociety = form.get("societyId");
  await post("/emergencies/actions", {
    clientMutationId: crypto.randomUUID(),
    incidentId: value(form, "incidentId", 36),
    ...(typeof optionalSociety === "string" && optionalSociety.trim() ? { societyId: optionalSociety.trim() } : {}),
    title: value(form, "title", 160),
    description: String(form.get("description") ?? "").trim().slice(0, 2000),
    status: "PLANNED",
  });
}

export async function submitSituationReport(form: FormData) {
  const viewer = await getCurrentViewer();
  if (viewer.role === "SYSTEM_ADMIN") throw new Error("This role cannot submit situation reports.");
  const optionalSociety = form.get("societyId");
  await post("/emergencies/situation-reports/sync", {
    clientMutationId: crypto.randomUUID(),
    incidentId: value(form, "incidentId", 36),
    ...(typeof optionalSociety === "string" && optionalSociety.trim() ? { societyId: optionalSociety.trim() } : {}),
    status: "SUBMITTED",
    summary: value(form, "summary", 4000),
    needs: String(form.get("needs") ?? "").trim().slice(0, 2000),
  });
}
