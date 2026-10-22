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

export const ACTIVITY_DIMENSIONS = ["SOCIAL", "ECONOMIC", "GOVERNANCE"] as const;
export type ActivityDimension = (typeof ACTIVITY_DIMENSIONS)[number];
export interface ActivityInput {
  societyId: string; title: string; description: string; activityDate: IsoDate; location: string;
  latitude?: number; longitude?: number; sector: string; dimension: ActivityDimension; sdgs?: number[];
  femaleParticipants: number; maleParticipants: number; otherParticipants?: number; outcomes?: string;
}
export interface ActivityQuery {
  page?: number; pageSize?: number; societyId?: string; districtId?: string; sector?: string;
  dimension?: ActivityDimension; status?: ActivityReportStatus; from?: IsoDate; to?: IsoDate;
}
export interface ActivityResult extends ActivityReport {
  districtId: string; societyName: string; districtName: string; location: string;
  locationCoordinates?: { latitude: number; longitude: number };
  classification: { sector: string; dimension: ActivityDimension; sdgs: number[] };
  participants: { female: number; male: number; other: number; total: number }; outcomes?: string;
}
export interface ActivityReportPage { data: ActivityResult[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }
export interface ActivitySummary { activityCount: number; participantCount: number; bySector: { sector: string; activities: number; participants: number }[] }
