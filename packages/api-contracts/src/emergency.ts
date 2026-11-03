import type { IsoDate, IsoDateTime, PaginatedResponse } from "./common.js";

export const EMERGENCY_INCIDENT_TYPES = [
  "FLOOD", "LANDSLIDE", "CYCLONE", "DROUGHT", "FIRE", "PUBLIC_HEALTH", "OTHER",
] as const;
export type EmergencyIncidentType = (typeof EMERGENCY_INCIDENT_TYPES)[number];

export const EMERGENCY_SEVERITIES = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export type EmergencySeverity = (typeof EMERGENCY_SEVERITIES)[number];

export const EMERGENCY_INCIDENT_STATUSES = ["ACTIVE", "CONTAINED", "CLOSED"] as const;
export type EmergencyIncidentStatus = (typeof EMERGENCY_INCIDENT_STATUSES)[number];

export const EMERGENCY_RECORD_STATUSES = ["DRAFT", "SUBMITTED"] as const;
export type EmergencyRecordStatus = (typeof EMERGENCY_RECORD_STATUSES)[number];

/** V4 response action statuses, kept on older records. V5 uses EmergencyActionState. */
export const EMERGENCY_ACTION_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type EmergencyActionStatus = (typeof EMERGENCY_ACTION_STATUSES)[number];

/** V5 PR 8: a society's state in its latest rapid assessment (badge on D31 and IR01). */
export const EMERGENCY_IMPACTS = ["SAFE", "AFFECTED", "CRITICAL"] as const;
export type EmergencyImpact = (typeof EMERGENCY_IMPACTS)[number];
export type EmergencySocietyState = EmergencyImpact | "NOT_ASSESSED";

export const EMERGENCY_ROAD_ACCESS = ["OPEN", "PARTLY_BLOCKED", "CUT_OFF", "UNKNOWN"] as const;
export type EmergencyRoadAccess = (typeof EMERGENCY_ROAD_ACCESS)[number];

/** Urgent needs from assessments, and what a response action provides. Items, people or tasks only. */
export const EMERGENCY_NEEDS = [
  "DRINKING_WATER", "DRY_RATIONS", "TEMPORARY_SHELTER", "MEDICAL_HELP", "CLOTHING", "VOLUNTEERS", "OTHER",
] as const;
export type EmergencyNeed = (typeof EMERGENCY_NEEDS)[number];

/** A helping society's delivery, shown as a badge (never a bar). */
export const EMERGENCY_HELPER_STATUSES = ["ASSIGNED", "IN_PROGRESS", "DELIVERED"] as const;
export type EmergencyHelperStatus = (typeof EMERGENCY_HELPER_STATUSES)[number];

/** A response action's state, worked out from its helpers: no helper yet is NEEDED. */
export type EmergencyActionState = "NEEDED" | EmergencyHelperStatus;

export interface EmergencyPersonRef {
  name: string | null;
  role: string | null;
}

export interface EmergencySocietyRef {
  id: string;
  name: string;
  code: string;
  districtName: string;
}

/** What the signed-in user may do with an incident. The API checks each request again. */
export interface EmergencyIncidentPermissions {
  canAssess: boolean;
  canClose: boolean;
  /** HQ only: response actions and helping societies. */
  canAssign: boolean;
  /** HQ only: situation reports and assessment reminders. */
  canReport: boolean;
}

export interface EmergencyIncidentSummary {
  id: string;
  /** "INC-2026-09" */
  reference: string;
  title: string;
  type: EmergencyIncidentType;
  status: EmergencyIncidentStatus;
  description: string;
  message: string;
  areaDistricts: { id: string; name: string }[];
  reportingSociety: EmergencySocietyRef | null;
  openedBy: EmergencyPersonRef;
  startedAt: IsoDateTime;
  openedAt: IsoDateTime;
  assessmentsDueAt: IsoDateTime | null;
  closedAt: IsoDateTime | null;
  closedBy: EmergencyPersonRef | null;
  societiesInArea: number;
  assessed: number;
}

export interface EmergencyIncidentList {
  data: EmergencyIncidentSummary[];
  counts: { active: number; closed: number };
}

export interface EmergencyDistrictTotals {
  districtId: string;
  name: string;
  inArea: number;
  affected: number;
  critical: number;
  families: number;
  people: number;
  housesFully: number;
  housesPartly: number;
  notAssessed: number;
}

/** Incident-wide counts from received assessments. Counts only, no personal details. */
export interface EmergencyTotals {
  societiesInArea: number;
  assessed: number;
  notAssessed: number;
  affected: number;
  critical: number;
  families: number;
  people: number;
  housesFully: number;
  housesPartly: number;
  actions: number;
  actionsDelivered: number;
  byDistrict: EmergencyDistrictTotals[];
  needs: { need: EmergencyNeed; societies: number }[];
}

/** One society in the incident area with its latest assessment (D31 table). */
export interface EmergencySocietyRow {
  society: EmergencySocietyRef;
  state: EmergencySocietyState;
  families: number | null;
  people: number | null;
  housesFully: number | null;
  housesPartly: number | null;
  injured: number | null;
  displaced: number | null;
  roadAccess: EmergencyRoadAccess | null;
  needs: EmergencyNeed[];
  lastReceivedAt: IsoDateTime | null;
  updates: number;
  photos: number;
  /** The viewer may send an assessment for this society. */
  canAssess: boolean;
}

export interface EmergencyHistoryEntry {
  action: string;
  detail: string;
  societyName: string | null;
  actorName: string | null;
  actorRole: string | null;
  at: IsoDateTime;
}

export interface EmergencyHelper {
  id: string;
  society: EmergencySocietyRef;
  quantity: number;
  deliveredQuantity: number;
  status: EmergencyHelperStatus;
  note: string;
  deliveryNote: string;
  deliveredOn: IsoDate | null;
  assignedBy: string;
  assignedAt: IsoDateTime;
  photos: number;
  /** The viewer may update this delivery (the helping society's people, or HQ). */
  canUpdate: boolean;
}

export interface EmergencyResponseAction {
  id: string;
  need: EmergencyNeed;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  dueAt: IsoDateTime | null;
  forSociety: EmergencySocietyRef | null;
  state: EmergencyActionState;
  delivered: number;
  helpers: EmergencyHelper[];
  createdBy: string | null;
  createdAt: IsoDateTime;
}

export interface EmergencySituationReportSummary {
  id: string;
  number: number;
  asOf: IsoDateTime;
  createdBy: string | null;
}

export interface EmergencyIncidentDetail {
  incident: EmergencyIncidentSummary;
  permissions: EmergencyIncidentPermissions;
  totals: EmergencyTotals;
  /** Latest received assessments in the viewer's scope (overview). */
  recentAssessments: EmergencySocietyRow[];
  /** Response actions for the viewer's societies (all of them for HQ), newest first. */
  actions: EmergencyResponseAction[];
  history: EmergencyHistoryEntry[];
  reports: EmergencySituationReportSummary[];
  /** Societies the viewer may send an assessment for: their own scope, inside the area. */
  assessableSocieties: EmergencySocietyRef[];
  lastReminderAt: IsoDateTime | null;
}

export type EmergencySocietyPage = PaginatedResponse<EmergencySocietyRow>;

export interface EmergencyAssessmentUpdate {
  id: string;
  number: number;
  sentAt: IsoDateTime;
  sentBy: string | null;
  impact: EmergencyImpact;
  photos: number;
}

/** V5 M43: one society's assessments for an incident. */
export interface EmergencySocietyDetail {
  incident: EmergencyIncidentSummary;
  row: EmergencySocietyRow;
  updates: EmergencyAssessmentUpdate[];
}

/** V5 M41/M42: the answers sent in one rapid assessment. Counts only. */
export interface EmergencyAssessmentInput {
  clientMutationId: string;
  societyId: string;
  impact: EmergencyImpact;
  families: number;
  people: number;
  housesFully: number;
  housesPartly: number;
  injured: number;
  displaced: number;
  roadAccess: EmergencyRoadAccess;
  needs: EmergencyNeed[];
  note: string;
  confirmedWithPresident: boolean;
}

/** V5 D30, IR02 and M48. */
export interface OpenIncidentInput {
  type: EmergencyIncidentType;
  reportingSocietyId: string;
  districtIds: string[];
  title?: string;
  description?: string;
  message?: string;
  startedAt: IsoDateTime;
  assessmentsDueAt?: IsoDateTime;
}

/** A short-lived pre-signed upload for a photo or PDF (up to 10 MB by default). */
export interface EmergencyEvidenceUpload {
  evidence: { id: string; contentType: string; sizeBytes: number };
  upload: { method: "PUT"; url: string; headers: Record<string, string>; expiresAt: IsoDateTime };
}

export interface EmergencySituationReportItem {
  need: EmergencyNeed;
  title: string;
  unit: string;
  needed: number;
  delivered: number;
  helpingSocieties: number;
}

export interface EmergencySituationReportSnapshot {
  totals: Omit<EmergencyTotals, "byDistrict" | "needs">;
  byDistrict: EmergencyDistrictTotals[];
  needs: { need: EmergencyNeed; societies: number }[];
  items: EmergencySituationReportItem[];
  helpingSocieties: number;
  helpedSocieties: number;
}

/** V5 D33 and M47: a numbered snapshot of the counts when it was made. */
export interface EmergencySituationReport extends EmergencySituationReportSummary {
  incident: EmergencyIncidentSummary;
  summary: string;
  snapshot: EmergencySituationReportSnapshot;
}

/** V5 D32: a society HQ could ask to help. */
export interface EmergencyHelpingCandidate {
  society: EmergencySocietyRef;
  state: EmergencySocietyState;
  /** Straight-line distance from the society in need, when both have a location. */
  distanceKm: number | null;
}
