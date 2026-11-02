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

/** The 10 Sarvodaya sectors (V5 M09a "One of the 10 Sarvodaya sectors"). To be confirmed with Sarvodaya. */
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
