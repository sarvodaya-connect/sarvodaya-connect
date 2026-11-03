/**
 * V5 PR 5: the HQ National Dashboard (D02, M05h), its drill-downs (D03 map,
 * D03b districts, D07 programmes, D08 membership), the society directory
 * (D04, M66), search (D18), HQ requests and tasks (D13) and reports (D15).
 *
 * Every figure is a count or a yearly total worked out by the API from
 * approved records. No list here carries a NIC, and financial data is only
 * the yearly total profit and total expenses.
 */
import type { ActivityDimension, RegistrarDocumentType } from "./activities.js";
import type { SocietyStatus } from "./registry.js";

export interface FinancialYearPeriod {
  /** 2025 means FY 2025/26 (1 Apr 2025 to 31 Mar 2026). */
  startYear: number;
  label: string;
  startsOn: string;
  endsOn: string;
}

export interface GradeCounts {
  A: number;
  B: number;
  C: number;
  /** Active societies HQ has not graded yet. */
  ungraded: number;
}

export interface MembershipCategoryTotal {
  category: string;
  female: number;
  male: number;
  total: number;
}

export interface SdgCount {
  sdg: number;
  completed: number;
}

export interface DimensionCount {
  dimension: ActivityDimension;
  planned: number;
  completed: number;
}

export interface NationalIncident {
  id: string;
  title: string;
  severity: string;
  status: string;
  districtName: string;
  activatedAt: string;
  societiesInArea: number;
  assessed: number;
  peopleAffected: number;
  householdsAffected: number;
  actions: number;
  actionsCompleted: number;
}

/** D02 / M05h: the six dashboard sections. */
export interface NationalOverview {
  financialYear: FinancialYearPeriod;
  societies: {
    registered: number;
    active: number;
    registeredNotActive: number;
    grades: GradeCounts;
    notUpdatedIn90Days: number;
    gradeRequestsWaiting: number;
    withoutLocation: number;
  };
  /** Active societies per district, with the average society position for the map. */
  districts: { id: string; name: string; active: number; latitude: number | null; longitude: number | null }[];
  membership: {
    /** The latest year with membership counts, or null when none are entered. */
    year: number | null;
    female: number;
    male: number;
    total: number;
    societiesReported: number;
    categories: MembershipCategoryTotal[];
  };
  activities: {
    planned: number;
    completed: number;
    byDimension: DimensionCount[];
    /** The six UN SDGs with the most completed activities; ties by SDG number. */
    topSdgs: SdgCount[];
  };
  finance: {
    activeSocieties: number;
    /** Decimal strings in LKR, summed over active societies. */
    totalProfit: string;
    totalExpenses: string;
    societiesWithBoth: number;
    notSubmitted: number;
  };
  registrarDocuments: {
    activeSocieties: number;
    allFour: number;
    auditReportDueOn: string;
    pastDue: boolean;
    byType: { documentType: RegistrarDocumentType; submitted: number; missing: number }[];
  };
  incidents: NationalIncident[];
}

/** D03b / M65: one card per district, alphabetical, never ranked. */
export interface DistrictFigures {
  id: string;
  name: string;
  province: string | null;
  active: number;
  grades: GradeCounts;
  members: number;
  /** Share of active societies whose record has every required field. */
  recordsCompletePercent: number;
  /** Share of active societies with the year's audit report uploaded. */
  auditPercent: number;
}

export interface DistrictSummaries {
  financialYear: FinancialYearPeriod;
  totals: { active: number; grades: GradeCounts; recordsCompletePercent: number };
  data: DistrictFigures[];
}

export type MapSocietyClass = "A" | "B" | "C" | "UNGRADED" | "NOT_ACTIVE";

/** D03 / M64: every society with a recorded position. */
export interface SocietyMap {
  counts: { A: number; B: number; C: number; ungraded: number; notActive: number; withoutLocation: number };
  points: { id: string; name: string; societyCode: string; class: MapSocietyClass; latitude: number; longitude: number; district: string }[];
  /** True when more societies have a position than one request returns (10,000). */
  truncated: boolean;
}

/** GET /societies/map: pins within the caller's scope. No contacts or other personal data. */
export interface ScopedSocietyMap {
  points: {
    id: string;
    name: string;
    societyCode: string;
    grade: "A" | "B" | "C" | null;
    status: SocietyStatus;
    latitude: number;
    longitude: number;
    district: string;
  }[];
  /** Active societies in scope with no recorded position; counted, never plotted. */
  withoutLocation: number;
  truncated: boolean;
}

/** D08 / M61: counts only, no personal data. */
export interface NationalMembership {
  year: number | null;
  activeSocieties: number;
  societiesReported: number;
  female: number;
  male: number;
  total: number;
  categories: MembershipCategoryTotal[];
  districts: { id: string; name: string; active: number; female: number; male: number; total: number }[];
}

/** D07 / M63: done vs planned by sector, dimension and UN SDG. */
export interface NationalProgrammes {
  financialYear: FinancialYearPeriod;
  planned: number;
  completed: number;
  sectors: { sector: string; planned: number; completed: number; societies: number }[];
  byDimension: DimensionCount[];
  /** All 17 goals, ranked by completed activities; goals with none come last. */
  sdgs: SdgCount[];
  recent: {
    id: string;
    name: string;
    sector: string;
    dimension: ActivityDimension;
    society: { id: string; name: string };
    approvedAt: string;
    approvedBy: string | null;
    datesLabel: string | null;
    year: number;
    femaleParticipants: number;
    maleParticipants: number;
    householdsBenefited: number;
    createdBy: string | null;
    sdgs: number[];
  }[];
}

/** M62b: the two yearly totals and the societies that have not added them. */
export interface NationalFinance {
  financialYear: FinancialYearPeriod;
  activeSocieties: number;
  totalProfit: string;
  totalExpenses: string;
  societiesWithBoth: number;
  notSubmitted: number;
  notAdded: { id: string; name: string; district: string }[];
  meta: PageMeta;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export const DIRECTORY_VIEWS = ["all", "not-updated", "figures-not-added", "audit-past-due"] as const;
export type DirectoryView = (typeof DIRECTORY_VIEWS)[number];

/** D04 / M66: one row of the society directory. */
export interface DirectorySociety {
  id: string;
  societyCode: string;
  name: string;
  nameLocal: string | null;
  district: { id: string; name: string };
  dsDivision: string | null;
  status: string;
  grade: "A" | "B" | "C" | null;
  /** The grade a waiting request asks for. */
  requestedGrade: "A" | "B" | "C" | null;
  members: number | null;
  spc: { id: string; name: string } | null;
  societyOfficer: { name: string; status: string } | null;
  figuresAdded: boolean;
  updatedAt: string;
  notUpdatedIn90Days: boolean;
}

export interface SocietyDirectory {
  financialYear: FinancialYearPeriod;
  /** How many societies each tab holds, with the other filters applied. */
  views: Record<DirectoryView, number>;
  grades: { A: number; B: number; C: number };
  data: DirectorySociety[];
  meta: PageMeta;
}

/** M67: the society summary on the phone. */
export interface SocietyAtAGlance {
  id: string;
  name: string;
  societyCode: string;
  districtId: string;
  district: string;
  grade: "A" | "B" | "C" | null;
  status: string;
  updatedAt: string;
  members: number | null;
  membershipYear: number | null;
  recordsCompletePercent: number;
  missingFields: number;
  financialYear: FinancialYearPeriod;
  profit: string | null;
  expenses: string | null;
  hasSocietyOfficer: boolean;
  spcName: string | null;
  registrarDocuments: { documentType: RegistrarDocumentType; uploaded: boolean }[];
  auditReportPastDue: boolean;
  gradeRequest: { fromGrade: string | null; toGrade: string; requestedAt: string } | null;
  activities: { planned: number; approved: number; latest: { name: string; sdgs: number[] } | null };
}

export const SEARCH_RESULT_TYPES = ["society", "person", "document", "activity", "request"] as const;
export type SearchResultType = (typeof SEARCH_RESULT_TYPES)[number];

/** D18: results the user may open. NICs and phone numbers are never searched. */
export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  status: string | null;
  href: string;
}

export interface SearchResults {
  query: string;
  counts: Record<SearchResultType, number>;
  data: SearchResult[];
}

export const INFORMATION_REQUEST_AUDIENCES = ["ALL_ACTIVE", "DISTRICT", "FIGURES_NOT_ADDED", "AUDIT_PAST_DUE"] as const;
export type InformationRequestAudience = (typeof INFORMATION_REQUEST_AUDIENCES)[number];

/** D13 request tracker row. */
export interface InformationRequestSummary {
  id: string;
  title: string;
  audience: InformationRequestAudience;
  audienceLabel: string;
  dueOn: string;
  createdAt: string;
  createdBy: string;
  societies: number;
  responded: number;
  status: "OPEN" | "OVERDUE" | "COMPLETE";
}

/** D13 "My tasks": worked out from the live queues, so they close themselves. */
export interface HqTask {
  id: string;
  title: string;
  due: string | null;
  href: string;
}

export const REPORT_TYPES = [
  "national-summary",
  "society-status",
  "membership",
  "registrar-documents",
  "activities",
  "profit-expenses",
  "data-quality",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** D15: a report as rows; the dashboard previews it, prints it or downloads it. */
export interface ReportTable {
  type: ReportType;
  title: string;
  scope: string;
  financialYear: FinancialYearPeriod;
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: Record<string, string | number>[];
  generatedAt: string;
}

export const NOTIFICATION_TOPICS = [
  "GRADE_REQUEST",
  "INCIDENT",
  "ACCESS",
  "RECORDS",
  "ACTIVITY",
  "ACCOUNT",
  "INFORMATION_REQUEST",
] as const;
export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];
