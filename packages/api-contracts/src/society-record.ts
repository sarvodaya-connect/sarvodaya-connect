import type { IsoDate, IsoDateTime } from "./common.js";
import type { UserRole } from "./identity.js";
import type { SocietyDetails } from "./registry.js";

/**
 * SC-65: the V4 society record (Prototype v4, M06/M13 and D05).
 * Annual figures are two yearly totals only. No loans, savings, transactions,
 * payments, sales or accounting are modelled.
 */

export const SOCIETY_GRADES = ["A", "B", "C"] as const;

export type SocietyGrade = (typeof SOCIETY_GRADES)[number];

export const SOCIETY_GRADE_LABELS: Record<SocietyGrade, string> = {
  A: "Strong",
  B: "Developing",
  C: "Needs strengthening",
};

export const GRADE_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export type GradeRequestStatus = (typeof GRADE_REQUEST_STATUSES)[number];

export const SOCIETY_HISTORY_CATEGORIES = [
  "SOCIETY",
  "EXCO",
  "WORK_PLAN",
  "ANNUAL_SUMMARY",
  "GRADE",
  "DOCUMENTS",
] as const;

export type SocietyHistoryCategory =
  (typeof SOCIETY_HISTORY_CATEGORIES)[number];

/** Who did something, for "N. Wijesinghe (Society Officer)" lines. */
export interface ActorReference {
  displayName: string;
  role?: UserRole;
}

/**
 * Sri Lankan society financial year, 1 April to 31 March (to be confirmed
 * with Sarvodaya). `startYear` 2025 is "FY 2025/26".
 */
export interface FinancialYear {
  startYear: number;
  label: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
}

export interface AmountChange {
  updatedAt: IsoDateTime;
  updatedBy: ActorReference;
  /** The value before the latest change, when there was one. */
  previousValue?: number;
}

export interface AuditReportSummary {
  documentId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: IsoDateTime;
  uploadedBy: ActorReference;
}

/** Two yearly totals in LKR and the year's audit report. Either total may be missing. */
export interface AnnualFinancialSummary {
  societyId: string;
  financialYear: FinancialYear;
  totalProfit: number | null;
  totalExpenses: number | null;
  profitChange?: AmountChange;
  expensesChange?: AmountChange;
  auditReport: AuditReportSummary | null;
}

export interface AnnualFinancialSummaryUpdate {
  totalProfit: number;
  totalExpenses: number;
}

export interface AnnualFinancialSummaryResponse {
  /** Years that can be viewed or entered, newest first. */
  financialYears: FinancialYear[];
  summary: AnnualFinancialSummary;
}

export interface GradeChangeRequest {
  id: string;
  societyId: string;
  fromGrade: SocietyGrade | null;
  toGrade: SocietyGrade;
  reason: string;
  status: GradeRequestStatus;
  requestedBy: ActorReference;
  requestedAt: IsoDateTime;
  decidedBy?: ActorReference;
  decidedAt?: IsoDateTime;
  decisionComment?: string;
}

export interface GradeChangeRequestInput {
  toGrade: SocietyGrade;
  reason: string;
}

export const GRADE_DECISIONS = ["APPROVE", "REJECT"] as const;

export type GradeDecision = (typeof GRADE_DECISIONS)[number];

export interface GradeDecisionInput {
  decision: GradeDecision;
  /** Required when rejecting. */
  comment?: string;
}

export interface SocietyStaffMember {
  role: UserRole;
  displayName: string;
  accountStatus: "PENDING" | "ACTIVE" | "INACTIVE";
}

/**
 * What the signed-in user may do with this record. The API enforces every
 * rule itself; these flags only decide which actions the screens offer.
 */
export interface SocietyRecordPermissions {
  canEdit: boolean;
  canEditSocietyCode: boolean;
  canChangeGrade: boolean;
  canRequestGradeChange: boolean;
  canEditAnnualSummary: boolean;
  canUploadAuditReport: boolean;
  canUploadDocuments: boolean;
  /** Why the record is read only, for the M06v banner. */
  viewOnlyReason?: "DISTRICT_MANAGER" | "TEMPORARY_DISTRICT_ACCESS";
  /** When temporary district access ends, for the M06v banner. */
  viewOnlyUntil?: IsoDateTime;
}

export interface SocietyRecord extends SocietyDetails {
  memberCount: number | null;
  landline: string | null;
  businessDescription: string | null;
  grade: SocietyGrade | null;
  gradeChangedAt?: IsoDateTime;
  gradeChangedBy?: ActorReference;
  openGradeRequest: GradeChangeRequest | null;
  staff: SocietyStaffMember[];
  annualSummary: AnnualFinancialSummary;
  lastChange?: { at: IsoDateTime; by: ActorReference };
  permissions: SocietyRecordPermissions;
}

/**
 * M06e / D05e. Society Officers, SPCs and DDMs edit their assigned
 * societies. Only HQ may change the S number or the grade, and a direct
 * grade change needs a reason.
 */
export interface SocietyRecordUpdate {
  nameEn?: string;
  nameLocal?: string;
  memberCount?: number;
  /** Empty string removes the landline. */
  landline?: string;
  addressLine?: string;
  dsDivision?: string;
  gnDivision?: string;
  latitude?: number;
  longitude?: number;
  /** Empty string removes the description. */
  businessDescription?: string;
  societyCode?: string;
  grade?: SocietyGrade;
  gradeReason?: string;
}

export interface SocietyHistoryEvent {
  id: string;
  category: SocietyHistoryCategory;
  action: string;
  summary: string;
  actor: ActorReference;
  occurredAt: IsoDateTime;
}

/** Planning allocation for one activity. Not a payment or spending record. */
export interface WorkPlanActivity {
  id: string;
  year: number;
  month: number;
  name: string;
  description: string;
  sector?: string;
  datesLabel?: string;
  allocatedCost: number;
}

export interface WorkPlanOverview {
  societyId: string;
  year: number;
  activities: WorkPlanActivity[];
  totalAllocated: number;
  lastChange?: { at: IsoDateTime; by: ActorReference };
}
