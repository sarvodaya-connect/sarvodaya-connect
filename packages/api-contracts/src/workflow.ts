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
