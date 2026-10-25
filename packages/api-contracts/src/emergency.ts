import type { IsoDateTime } from "./common.js";

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

export const EMERGENCY_ACTION_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type EmergencyActionStatus = (typeof EMERGENCY_ACTION_STATUSES)[number];

export interface EmergencyIncident {
  id: string;
  districtId: string;
  district: { id: string; nameEn: string };
  title: string;
  type: EmergencyIncidentType;
  severity: EmergencySeverity;
  status: EmergencyIncidentStatus;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  createdById: string;
  activatedAt: IsoDateTime;
  closedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  _count: { assessments: number; actions: number; reports: number };
}

export interface EmergencyIncidentDetail extends EmergencyIncident {
  assessments: Array<EmergencyAssessment & { society?: { id: string; societyCode: string; nameEn: string } }>;
  actions: EmergencyResponseAction[];
  reports: EmergencySituationReport[];
}

/** Stable client mutation IDs make offline retries idempotent. */
export interface EmergencyAssessmentInput {
  clientMutationId: string;
  incidentId: string;
  societyId: string;
  expectedRevision?: number;
  status: EmergencyRecordStatus;
  observedAt: IsoDateTime;
  peopleAffected: number;
  householdsAffected: number;
  displacedPeople: number;
  infrastructureNotes: string;
  urgentNeeds: string;
  notes: string;
  latitude?: number;
  longitude?: number;
}

export interface EmergencyAssessment extends EmergencyAssessmentInput {
  id: string;
  revision: number;
  createdById: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface EmergencyResponseActionInput {
  clientMutationId: string;
  incidentId: string;
  societyId?: string;
  title: string;
  description: string;
  status: EmergencyActionStatus;
  dueAt?: IsoDateTime;
}

export interface EmergencyResponseAction extends EmergencyResponseActionInput {
  id: string;
  createdById: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface EmergencySituationReportInput {
  clientMutationId: string;
  incidentId: string;
  societyId?: string;
  expectedRevision?: number;
  status: EmergencyRecordStatus;
  summary: string;
  needs: string;
}

export interface EmergencySituationReport extends EmergencySituationReportInput {
  id: string;
  revision: number;
  createdById: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface EmergencySyncResult<T> {
  record: T;
  replayed: boolean;
}
