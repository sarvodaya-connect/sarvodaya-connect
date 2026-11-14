import type { ActivityDimension, ActivityParticipants, ActivityReview, ActivityStatus } from "./activities.js";
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

/** The offices chosen from the Exco members. */
export type ExcoOffice = "President" | "Secretary" | "Treasurer";

/**
 * A new society starts with no Exco members: HQ creates it, assigns a Society
 * Officer, and the officer enters the 25 seats, saving as they go. The API
 * works this out; the dashboard and the phone show it as it is.
 *
 * `complete` is true only with 25 seats each held by one active member, the
 * agreed groups (3 children, 3 youth, 3 mothers, 9 ordinary, 7 elders'
 * council) and exactly one President, one Secretary and one Treasurer.
 */
export interface ExcoStatus {
  filledSeats: number;
  totalSeats: 25;
  complete: boolean;
  /** Offices nobody holds yet. */
  missingOffices: ExcoOffice[];
  /** What is still missing, in plain words, e.g. "No Treasurer chosen yet." Empty when complete. */
  problems: string[];
}

export interface SocietyRecord extends SocietyDetails {
  /** Total members. When the female and male counts are entered it is always their sum. */
  memberCount: number | null;
  /**
   * Issue #141: female and male members. Both null means the split has not
   * been entered yet (an older record may still have a total); 0 is an
   * entered count.
   */
  femaleMembers: number | null;
  maleMembers: number | null;
  /**
   * Issue #143: members younger than 18, a part of memberCount (never added
   * to it). Null until entered; only entered with the female/male split.
   */
  under18Members: number | null;
  /**
   * Issue #143: when the total, female, male or under 18s last changed, as an
   * ISO time. Other profile and Exco edits do not move it. Null until the
   * first saved change.
   */
  membershipUpdatedAt: string | null;
  landline: string | null;
  businessDescription: string | null;
  grade: SocietyGrade | null;
  gradeChangedAt?: IsoDateTime;
  gradeChangedBy?: ActorReference;
  openGradeRequest: GradeChangeRequest | null;
  /** How much of the 25-seat Exco has been entered. */
  excoStatus: ExcoStatus;
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
  /**
   * Issue #141: send both together, each 0 to 1,000,000 (and 1,000,000 in
   * all). The API works out the total from them.
   */
  femaleMembers?: number;
  maleMembers?: number;
  /**
   * Issue #143: 0 to the female + male total. Needs the split, sent with it or
   * already saved.
   */
  under18Members?: number;
  /**
   * Sent by apps from before issue #141. Accepted alone only while the society
   * has no female/male split; otherwise it must equal female + male.
   */
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
export interface WorkPlanActivity extends ActivityParticipants {
  id: string;
  year: number;
  month: number;
  name: string;
  description: string;
  sector?: string;
  datesLabel?: string;
  allocatedCost: number;
  /** V5 PR 4. Activities planned before review existed are APPROVED. */
  status: ActivityStatus;
  dimension?: ActivityDimension;
  sdgs: number[];
  partners?: string;
  resourcesNeeded?: string;
  volunteerHours?: number;
  createdBy?: ActorReference;
  submittedAt?: IsoDateTime;
  review?: ActivityReview;
}

export interface WorkPlanOverview {
  societyId: string;
  year: number;
  activities: WorkPlanActivity[];
  totalAllocated: number;
  /** V5 M09: "9 planned · 8 approved · 1 waiting". */
  counts: { planned: number; approved: number; waiting: number; sentBack: number };
  permissions: { canAddActivities: boolean };
  lastChange?: { at: IsoDateTime; by: ActorReference };
}

/** V5 D22: the national grade-change queue (HQ only). */
export const GRADE_QUEUE_FILTERS = ["WAITING", "APPROVED", "REJECTED", "ALL"] as const;
export type GradeQueueFilter = (typeof GRADE_QUEUE_FILTERS)[number];

export interface GradeQueueSummary {
  waiting: number;
  oldestWaitingDays: number | null;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  /** Average over decisions in the last 90 days; null when there were none. */
  averageDecisionDays: number | null;
}

export interface GradeQueueItem extends GradeChangeRequest {
  society: { id: string; name: string; societyCode: string; district: string };
}

export interface GradeQueue {
  summary: GradeQueueSummary;
  data: GradeQueueItem[];
}

/** V5 D22r grade history: requests, HQ decisions and direct HQ changes. */
export interface GradeHistoryEvent {
  id: string;
  kind: "REQUESTED" | "APPROVED" | "REJECTED" | "CHANGED_BY_HQ";
  fromGrade?: SocietyGrade | null;
  toGrade?: SocietyGrade;
  actor: ActorReference;
  at: IsoDateTime;
  note?: string;
}

/** V5 D22r. */
export interface GradeRequestDetail extends GradeChangeRequest {
  society: {
    id: string;
    name: string;
    societyCode: string;
    district: string;
    grade: SocietyGrade | null;
    gradeChangedAt: IsoDateTime | null;
    memberCount: number | null;
    excoMembers: number;
    planYear: number | null;
    planActivities: number;
    updatedAt: IsoDateTime;
  };
  history: GradeHistoryEvent[];
}

/** V5 D05a choices for one role in the society's district. */
export interface StaffOption {
  id: string;
  displayName: string;
  username: string;
  assignedHere: boolean;
  /** Other societies this person looks after. A Society Officer choosing here moves. */
  otherSocieties: number;
}

export interface StaffOptions {
  districtManagers: StaffOption[];
  deputies: StaffOption[];
  coordinators: StaffOption[];
  officers: StaffOption[];
}

/** V5 D05a. null leaves the role without anyone. */
export interface AssignStaffInput {
  deputyId: string | null;
  coordinatorId: string | null;
  officerId: string | null;
}
