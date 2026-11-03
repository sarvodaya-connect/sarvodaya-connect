import type {
  EmergencyActionState,
  EmergencyHelperStatus,
  EmergencyIncidentSummary,
  EmergencyIncidentType,
  EmergencyNeed,
  EmergencyRoadAccess,
  EmergencySocietyState,
} from "@sarvodaya-connect/api-contracts";

import { SHORT_ROLE, shortDateTime, timeLeft } from "./home-format";

/** Mirrors packages/api-contracts/src/emergency.ts (types only cross into the dashboard bundle). */
export const INCIDENT_TYPES = ["FLOOD", "LANDSLIDE", "CYCLONE", "DROUGHT", "FIRE", "PUBLIC_HEALTH", "OTHER"] as const satisfies readonly EmergencyIncidentType[];
export const NEEDS = ["DRINKING_WATER", "DRY_RATIONS", "TEMPORARY_SHELTER", "MEDICAL_HELP", "CLOTHING", "VOLUNTEERS", "OTHER"] as const satisfies readonly EmergencyNeed[];
export const ROAD_ACCESS = ["OPEN", "PARTLY_BLOCKED", "CUT_OFF", "UNKNOWN"] as const satisfies readonly EmergencyRoadAccess[];

/** V5 PR 8: words for disaster response (D30–D33, IR01–IR05). */
export const INCIDENT_TYPE_LABELS: Record<EmergencyIncidentType, string> = {
  FLOOD: "Flood",
  LANDSLIDE: "Landslide",
  CYCLONE: "Cyclone",
  DROUGHT: "Drought",
  FIRE: "Fire",
  PUBLIC_HEALTH: "Public health",
  OTHER: "Other",
};

export const NEED_LABELS: Record<EmergencyNeed, string> = {
  DRINKING_WATER: "Drinking water",
  DRY_RATIONS: "Dry rations",
  TEMPORARY_SHELTER: "Temporary shelter",
  MEDICAL_HELP: "Medical help",
  CLOTHING: "Clothing",
  VOLUNTEERS: "Volunteers",
  OTHER: "Other",
};

export const ROAD_LABELS: Record<EmergencyRoadAccess, string> = {
  OPEN: "Open",
  PARTLY_BLOCKED: "Partly blocked",
  CUT_OFF: "Cut off",
  UNKNOWN: "Unknown",
};

export const STATE_LABELS: Record<EmergencySocietyState, string> = {
  SAFE: "Safe",
  AFFECTED: "Affected",
  CRITICAL: "Critical",
  NOT_ASSESSED: "Not assessed",
};

export const ACTION_STATE_LABELS: Record<EmergencyActionState, string> = {
  NEEDED: "Needed",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  DELIVERED: "Delivered",
};

export const HELPER_STATUS_LABELS: Record<EmergencyHelperStatus, string> = {
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  DELIVERED: "Delivered",
};

/** "Water, dry rations" for the Top needs column. */
export function needsLine(needs: EmergencyNeed[]) {
  if (!needs.length) return "—";
  const words = needs.slice(0, 2).map((need, index) => (index === 0 ? NEED_LABELS[need] : NEED_LABELS[need].toLowerCase()));
  return words.join(", ");
}

/** "Kurunegala and Puttalam districts" */
export function areaLine(incident: Pick<EmergencyIncidentSummary, "areaDistricts">) {
  const names = incident.areaDistricts.map((d) => d.name);
  if (names.length <= 1) return `${names[0] ?? "One"} district`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)} districts`;
}

/** "N. Wijesinghe (Society Officer, Pahala Kosgama SSS)" */
export function openedByLine(incident: Pick<EmergencyIncidentSummary, "openedBy" | "reportingSociety">) {
  const role = incident.openedBy.role ? (SHORT_ROLE[incident.openedBy.role] ?? incident.openedBy.role) : null;
  const detail = [role, incident.reportingSociety?.name].filter(Boolean).join(", ");
  return `${incident.openedBy.name ?? "Someone"}${detail ? ` (${detail})` : ""}`;
}

/** "assessments due 27 Oct, 6:00 p.m. · 1 day 6 hours left" (time left as words, never a bar). */
export function dueLine(incident: Pick<EmergencyIncidentSummary, "assessmentsDueAt" | "status">, now = new Date()) {
  if (!incident.assessmentsDueAt) return null;
  const at = shortDateTime(incident.assessmentsDueAt);
  if (incident.status === "CLOSED") return `assessments were due ${at}`;
  const left = timeLeft(incident.assessmentsDueAt, now);
  return `assessments due ${at} · ${left === "Ended" ? "deadline passed" : left}`;
}

/** "K. Mendis (HQ) on 19 Oct, 4:00 p.m." */
export function closedLine(incident: Pick<EmergencyIncidentSummary, "closedAt" | "closedBy">) {
  if (!incident.closedAt) return null;
  const role = incident.closedBy?.role ? ` (${SHORT_ROLE[incident.closedBy.role] ?? incident.closedBy.role})` : "";
  return `${incident.closedBy?.name ?? "Someone"}${role} on ${shortDateTime(incident.closedAt)}`;
}

/** "200 L", "40 packs", "15" */
export function quantityLine(quantity: number, unit: string) {
  return `${quantity.toLocaleString("en-GB")}${unit ? ` ${unit}` : ""}`;
}

/** Words for the incident history (IR01). */
export const HISTORY_LABELS: Record<string, string> = {
  INCIDENT_OPENED: "Incident opened",
  INCIDENT_ASSESSMENT_SENT: "Assessment received",
  INCIDENT_NEED_ADDED: "Need added",
  INCIDENT_HELPERS_ASSIGNED: "Helpers assigned",
  INCIDENT_DELIVERY_UPDATED: "Delivery updated",
  INCIDENT_REMINDER_SENT: "Reminder sent",
  INCIDENT_REPORT_CREATED: "Situation report",
  INCIDENT_CLOSED: "Incident closed",
};

export const INCIDENT_TABS = ["overview", "assessments", "actions", "reports"] as const;
export type IncidentTab = (typeof INCIDENT_TABS)[number];

export function incidentTab(value: string | undefined): IncidentTab {
  return (INCIDENT_TABS as readonly string[]).includes(value ?? "") ? (value as IncidentTab) : "overview";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string | undefined): value is string => !!value && UUID.test(value);

/** A notification's link, kept only when it is a path inside the dashboard. */
export function safeLinkPath(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}
