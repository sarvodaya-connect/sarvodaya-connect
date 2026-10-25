import type { IsoDate, IsoDateTime } from "./common.js";
import type { SocietyDocument } from "./registry.js";

export const SUBMISSION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
  "RESUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const CORRECTION_STATUSES = [
  "NONE",
  "REQUIRED",
  "CORRECTED",
] as const;

export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export const REVIEW_DECISIONS = [
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface SubmissionChange {
  field: string;
  previousValue?: unknown;
  proposedValue: unknown;
}

export interface ReviewRecord {
  id: string;
  reviewerUserId: string;
  reviewerDisplayName: string;
  decision: ReviewDecision;
  comment?: string;
  decidedAt: IsoDateTime;
}

export interface SocietySubmission {
  id: string;
  societyId: string;
  submittedBy: string;
  status: SubmissionStatus;
  correctionStatus: CorrectionStatus;
  changes: SubmissionChange[];
  documents: SocietyDocument[];
  reviews: ReviewRecord[];
  submittedAt?: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const ACTIVITY_REPORT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
  "RESUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

export type ActivityReportStatus =
  (typeof ACTIVITY_REPORT_STATUSES)[number];

export interface ActivityReport {
  id: string;
  societyId: string;
  title: string;
  description: string;
  activityDate: IsoDate;
  participantCount?: number;
  status: ActivityReportStatus;
  submittedBy: string;
  submittedAt?: IsoDateTime;
  approvedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Only approved activity reports may contribute to HQ dashboard totals. */
export type ReportableActivity = ActivityReport & { status: "APPROVED" };

export const SUBMISSION_TYPES = [
  "COUNCIL_UPDATE",
  "PROFILE_UPDATE",
  "MEMBERSHIP_COUNTS",
  "ACTIVITY_REPORT",
  "PAYMENT",
] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

export const SUBMISSION_ACTIONS = [
  "SUBMIT",
  "START_REVIEW",
  "REQUEST_CHANGES",
  "APPROVE",
  "REJECT",
  "RESUBMIT",
] as const;
export type SubmissionAction = (typeof SUBMISSION_ACTIONS)[number];

export interface SubmissionFieldChange extends SubmissionChange {
  label: string;
  correctionStatus: CorrectionStatus;
  reviewerComment?: string;
  correctedValue?: unknown;
}

export interface SubmissionEvent {
  id: string;
  action: SubmissionAction;
  fromStatus: SubmissionStatus;
  toStatus: SubmissionStatus;
  actorId: string;
  actorDisplayName: string;
  comment?: string;
  createdAt: IsoDateTime;
}

/** Full workflow record returned by the submissions API. */
export interface SubmissionDetail extends Omit<SocietySubmission, "changes"> {
  reference: string;
  type: SubmissionType;
  title: string;
  /** Send back on every action; a stale value returns 409 CONFLICT. */
  version: number;
  changes: SubmissionFieldChange[];
  events: SubmissionEvent[];
  reviewerDisplayName?: string;
  reviewStartedAt?: IsoDateTime;
  /** Actions the caller may take now. Clients must not re-derive the rules. */
  allowedActions: SubmissionAction[];
}

export interface CreateSubmissionRequest {
  societyId: string;
  type: SubmissionType;
  title: string;
  changes: {
    field: string;
    label: string;
    previousValue?: unknown;
    proposedValue: unknown;
  }[];
}

export interface SubmissionActionRequest {
  version: number;
  comment?: string;
}

export interface RequestChangesRequest extends SubmissionActionRequest {
  fields: { field: string; comment: string }[];
}

export interface ResubmitRequest extends SubmissionActionRequest {
  corrections: { field: string; correctedValue: unknown }[];
}

/**
 * Approving a submission of one of these types applies its changes to the
 * society registry in the same transaction as the approval.
 */
export const REGISTRY_UPDATE_TYPES = [
  "PROFILE_UPDATE",
  "COUNCIL_UPDATE",
  "MEMBERSHIP_COUNTS",
] as const;

/** Approval records the decision only; no registry data changes. */
export const RECORD_ONLY_SUBMISSION_TYPES = [
  "ACTIVITY_REPORT",
  "PAYMENT",
] as const;

/** `profile.<column>`: columns of the society record that approval may change. */
export const REGISTRY_UPDATE_PROFILE_FIELDS = [
  "nameEn",
  "nameLocal",
  "dsDivision",
  "gnDivision",
  "village",
  "addressLine",
  "latitude",
  "longitude",
  "establishedOn",
] as const;

/** `council.<seat 1-25>.<column>`: existing seats only. Personal data and seat changes are not supported. */
export const REGISTRY_UPDATE_COUNCIL_FIELDS = [
  "fullName",
  "position",
  "appointedOn",
  "endedOn",
] as const;

export const REGISTRY_UPDATE_MEMBERSHIP_CATEGORIES = [
  "CHILDREN",
  "YOUTH",
  "MOTHERS",
  "ORDINARY",
  "ELDERS_COUNCIL",
] as const;

export const REGISTRY_UPDATE_MEMBERSHIP_GENDERS = ["female", "male"] as const;

/**
 * Field paths accepted for registry-type submissions. Values are JSON numbers
 * for coordinates and counts, and YYYY-MM-DD strings for dates.
 */
export const registryUpdateFieldPath = {
  profile: (column: (typeof REGISTRY_UPDATE_PROFILE_FIELDS)[number]) =>
    `profile.${column}`,
  council: (
    seatNumber: number,
    column: (typeof REGISTRY_UPDATE_COUNCIL_FIELDS)[number],
  ) => `council.${seatNumber}.${column}`,
  membership: (
    year: number,
    category: (typeof REGISTRY_UPDATE_MEMBERSHIP_CATEGORIES)[number],
    gender: (typeof REGISTRY_UPDATE_MEMBERSHIP_GENDERS)[number],
  ) => `membership.${year}.${category}.${gender}`,
};
