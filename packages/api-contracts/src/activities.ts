import type { IsoDateTime } from "./common.js";
import type { ActorReference } from "./society-record.js";

/**
 * The 17 UN Sustainable Development Goals, in official order. The SPC chooses
 * them when approving an activity (V5 SP07, M51); the number is what is saved.
 */
export const UN_SDGS = [
  { number: 1, title: "No poverty" },
  { number: 2, title: "Zero hunger" },
  { number: 3, title: "Good health and well-being" },
  { number: 4, title: "Quality education" },
  { number: 5, title: "Gender equality" },
  { number: 6, title: "Clean water and sanitation" },
  { number: 7, title: "Affordable and clean energy" },
  { number: 8, title: "Decent work and economic growth" },
  { number: 9, title: "Industry, innovation and infrastructure" },
  { number: 10, title: "Reduced inequalities" },
  { number: 11, title: "Sustainable cities and communities" },
  { number: 12, title: "Responsible consumption and production" },
  { number: 13, title: "Climate action" },
  { number: 14, title: "Life below water" },
  { number: 15, title: "Life on land" },
  { number: 16, title: "Peace, justice and strong institutions" },
  { number: 17, title: "Partnerships for the goals" },
] as const;

export type SdgNumber = (typeof UN_SDGS)[number]["number"];

export function sdgTitle(sdg: number): string {
  return UN_SDGS.find((goal) => goal.number === sdg)?.title ?? `SDG ${sdg}`;
}

/** WAITING_FOR_SPC until the SPC approves it or sends it back. Only APPROVED counts in dashboards. */
export const ACTIVITY_STATUSES = ["WAITING_FOR_SPC", "SENT_BACK", "APPROVED"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const ACTIVITY_DIMENSIONS = ["SOCIAL", "ECONOMIC", "GOVERNANCE"] as const;
export type ActivityDimension = (typeof ACTIVITY_DIMENSIONS)[number];

/** English titles of the three Sarvodaya dimensions. Clients translate the codes. */
export const ACTIVITY_DIMENSION_TITLES: Record<ActivityDimension, string> = {
  SOCIAL: "Social",
  ECONOMIC: "Economic",
  GOVERNANCE: "Governance",
};

/**
 * Issue #169 (V6 Development Goals): the ten Sarvodaya categories, in the
 * design's order. The SPC chooses one or more when approving, independently of
 * the dimensions (no category-to-dimension mapping is inferred or enforced).
 * The code is what is stored and sent; it never changes once released.
 */
export const ACTIVITY_CATEGORIES = [
  { code: "COMMUNITY_EDUCATION", title: "Community education" },
  { code: "CHILD_WELLBEING", title: "Child wellbeing" },
  { code: "CULTURE", title: "Culture" },
  { code: "ECONOMY", title: "Economy" },
  { code: "GOVERNANCE", title: "Governance" },
  { code: "HEALTH_NUTRITION", title: "Health and nutrition" },
  { code: "HOUSING_INFRASTRUCTURE", title: "Housing and infrastructure" },
  { code: "SPIRITUAL_DEVELOPMENT", title: "Spiritual development" },
  { code: "AGRICULTURE", title: "Agriculture" },
  { code: "ENVIRONMENT", title: "Environment" },
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["code"];
export const ACTIVITY_CATEGORY_CODES = ACTIVITY_CATEGORIES.map(
  (category) => category.code,
) as readonly ActivityCategory[];

export function activityCategoryTitle(code: string): string {
  return ACTIVITY_CATEGORIES.find((category) => category.code === code)?.title ?? code;
}

/**
 * Issue #169: whether an activity has the SPC's Development Goals.
 * - PENDING: not approved yet (waiting or sent back); nothing is decided.
 * - CLASSIFIED: approved with one or more dimensions, categories and UN SDGs,
 *   all recorded together with the approval.
 * - NOT_CLASSIFIED: approved without dimensions and categories, either before
 *   Development Goals existed or by an older app that sends UN SDGs only. Its
 *   UN SDGs, if any, are kept. The Society Officer's `sector` and `dimension`
 *   are never treated as the SPC's classification.
 */
export const ACTIVITY_CLASSIFICATION_STATES = ["PENDING", "CLASSIFIED", "NOT_CLASSIFIED"] as const;
export type ActivityClassificationState = (typeof ACTIVITY_CLASSIFICATION_STATES)[number];

export interface ActivityClassification {
  state: ActivityClassificationState;
  /** SPC-selected, in catalogue order; empty unless CLASSIFIED. */
  dimensions: ActivityDimension[];
  /** SPC-selected, in catalogue order; empty unless CLASSIFIED. */
  categories: ActivityCategory[];
  /** The UN SDG numbers, as in `sdgs`. */
  sdgs: number[];
  /** When and by whom the classification was recorded (the approval). CLASSIFIED only. */
  classifiedAt?: IsoDateTime;
  classifiedBy?: ActorReference;
}

/**
 * SP07 / M51: the SPC's approval. `sdgs` is required as before. V6 clients
 * also send `dimensions` and `categories`: if either is sent, both must hold at
 * least one valid code, each once. An approval with neither (an older app) is
 * recorded as NOT_CLASSIFIED, never rejected and never given invented values.
 */
export interface ApproveActivityInput {
  sdgs: number[];
  dimensions?: ActivityDimension[];
  categories?: ActivityCategory[];
}

/**
 * The 10 Sarvodaya sectors (V5 M09a "One of the 10 Sarvodaya sectors"): the
 * Society Officer's planning field, kept as typed for history. Issue #169 keeps
 * it separate from the SPC's `ActivityClassification`.
 */
export const SARVODAYA_SECTORS = [
  "Community education",
  "Child wellbeing",
  "Culture",
  "Economy",
  "Governance",
  "Health and nutrition",
  "Housing and infrastructure",
  "Spiritual development",
  "Agriculture",
  "Environment",
] as const;

export interface ActivityParticipants {
  femaleParticipants?: number;
  maleParticipants?: number;
  youthParticipants?: number;
  householdsBenefited?: number;
  womenHeadedHouseholds?: number;
}

/** M09a–M09d: what the Society Officer sends to the SPC. */
export interface ActivityInput extends ActivityParticipants {
  year: number;
  month: number;
  name: string;
  description: string;
  sector: string;
  dimension: ActivityDimension;
  datesLabel?: string;
  allocatedCost: number;
  partners?: string;
  resourcesNeeded?: string;
  volunteerHours?: number;
}

export interface ActivityReview {
  by: ActorReference;
  at: IsoDateTime;
  comment?: string;
}

export interface ActivitySummary {
  id: string;
  societyId: string;
  status: ActivityStatus;
  /** UN SDG numbers chosen by the SPC (empty until approved). */
  sdgs: number[];
  /** Issue #169: the SPC's Development Goals. */
  classification: ActivityClassification;
  submittedAt?: IsoDateTime;
  createdBy?: ActorReference;
  review?: ActivityReview;
}

/** SP06 / M50: one row of the SPC's queue or recently approved list. */
export interface ActivityQueueItem {
  id: string;
  name: string;
  status: ActivityStatus;
  year: number;
  month: number;
  society: { id: string; name: string; societyCode: string };
  sentBy?: ActorReference;
  submittedAt?: IsoDateTime;
  totalParticipants: number;
  householdsBenefited?: number;
  sdgs: number[];
  /** Issue #169: the SPC's Development Goals. */
  classification: ActivityClassification;
  approvedAt?: IsoDateTime;
}

export interface ActivityQueue {
  waiting: ActivityQueueItem[];
  approvedRecently: ActivityQueueItem[];
  /** Assigned societies the queue covers. */
  societyCount: number;
}

/**
 * The four annual documents sent to the Registrar (V5 M13, D11, D12), in the
 * order the prototype shows them. Each is kept per financial year.
 */
export const REGISTRAR_DOCUMENT_TYPES = [
  "AUDIT_REPORT",
  "AGM_MINUTES",
  "OFFICE_BEARER_LIST",
  "MEMBERS_LIST",
] as const;
export type RegistrarDocumentType = (typeof REGISTRAR_DOCUMENT_TYPES)[number];

export interface RegistrarDocumentStatus {
  documentType: RegistrarDocumentType;
  /** The latest uploaded version for the year, or null when it is missing. */
  document: {
    id: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    version: number;
    uploadedAt: IsoDateTime;
    uploadedBy: ActorReference;
    /** The signed members list opens only for District Managers and HQ. */
    canOpen: boolean;
  } | null;
}

/** M13 / D05 Documents tab: "4 of 4 uploaded". */
export interface SocietyRegistrarDocuments {
  societyId: string;
  financialYear: { startYear: number; label: string };
  documents: RegistrarDocumentStatus[];
  submitted: number;
  missing: number;
}

/** D11 / D12: how many active societies have each document for the year (HQ only). */
export interface RegistrarDocumentTotals {
  financialYear: { startYear: number; label: string };
  activeSocieties: number;
  byType: { documentType: RegistrarDocumentType; submitted: number; missing: number }[];
  /** Active societies with all four documents for the year. */
  allFour: number;
}
