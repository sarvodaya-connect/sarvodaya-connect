import { societies } from "./demo-registry";

/**
 * Fictional compliance records for the four annual documents every society
 * sends to the Registrar (Screen Catalogue v3, D11 and D12). Built on the
 * demonstration societies in demo-registry.ts and replaced by the API later.
 */

export const COMPLIANCE_YEAR = "FY 2025/26";
export const COMPLIANCE_DUE_DATE = "2026-09-30";
/** Fixed "today" for the demonstration data, matching the registry fixtures. */
export const COMPLIANCE_AS_OF = "2026-11-12";

export const REGISTRAR_DOCUMENTS = [
  { type: "AUDIT_REPORT", label: "Audit report", note: "Certified by a registered auditor" },
  { type: "AGM_MINUTES", label: "AGM minutes", note: "Annual General Meeting record" },
  { type: "OFFICE_BEARER_LIST", label: "Office-bearer list", note: "New board · names and addresses" },
  { type: "MEMBERS_LIST", label: "Members list", note: "Signed file · District Manager and HQ only" },
] as const;

export type RegistrarDocumentType = (typeof REGISTRAR_DOCUMENTS)[number]["type"];

/** Where one required document is in the review process. */
export type RequirementStatus = "APPROVED" | "UNDER_REVIEW" | "RETURNED" | "NOT_SUBMITTED";

/** The three groups the dashboard reports on. */
export type RequirementState = "COMPLETED" | "PENDING" | "MISSING";

export const REQUIREMENT_STATES: { value: RequirementState; label: string; description: string }[] = [
  { value: "MISSING", label: "Missing", description: "Not submitted" },
  { value: "PENDING", label: "Pending", description: "Under review or returned for correction" },
  { value: "COMPLETED", label: "Completed", description: "Approved by the District Centre" },
];

export function requirementState(status: RequirementStatus): RequirementState {
  switch (status) {
    case "APPROVED":
      return "COMPLETED";
    case "UNDER_REVIEW":
    case "RETURNED":
      return "PENDING";
    case "NOT_SUBMITTED":
      return "MISSING";
  }
}

export function isOverdue(status: RequirementStatus, asOf = COMPLIANCE_AS_OF): boolean {
  return status === "NOT_SUBMITTED" && asOf > COMPLIANCE_DUE_DATE;
}

export type Requirement = {
  status: RequirementStatus;
  /** When the society last sent the document. */
  submittedAt?: string;
};

export type SocietyCompliance = {
  societyId: string;
  societyName: string;
  societyCode: string;
  districtId: string;
  districtName: string;
  requirements: Record<RegistrarDocumentType, Requirement>;
};

type Fixture = [
  societyId: string,
  auditReport: Requirement,
  agmMinutes: Requirement,
  officeBearerList: Requirement,
  membersList: Requirement,
];

const missing: Requirement = { status: "NOT_SUBMITTED" };
const approved = (submittedAt: string): Requirement => ({ status: "APPROVED", submittedAt });
const underReview = (submittedAt: string): Requirement => ({ status: "UNDER_REVIEW", submittedAt });
const returned = (submittedAt: string): Requirement => ({ status: "RETURNED", submittedAt });

const fixtures: Fixture[] = [
  ["society-pahala-kosgama", missing, underReview("2026-10-07T09:15:00.000Z"), approved("2026-03-20T05:00:00.000Z"), approved("2026-03-20T05:10:00.000Z")],
  ["society-kuliyapitiya", approved("2026-08-14T06:30:00.000Z"), approved("2026-08-02T04:45:00.000Z"), approved("2026-03-11T07:20:00.000Z"), approved("2026-03-11T07:25:00.000Z")],
  ["society-wellawa", returned("2026-09-25T10:05:00.000Z"), approved("2026-07-19T08:40:00.000Z"), approved("2026-04-02T06:15:00.000Z"), missing],
  ["society-maho", underReview("2026-10-28T03:50:00.000Z"), missing, missing, missing],
  ["society-rambukkana", approved("2026-09-03T05:30:00.000Z"), approved("2026-07-27T09:00:00.000Z"), approved("2026-03-29T04:10:00.000Z"), approved("2026-03-29T04:12:00.000Z")],
  ["society-galewela", missing, approved("2026-08-21T06:00:00.000Z"), underReview("2026-11-04T08:30:00.000Z"), approved("2026-04-15T05:45:00.000Z")],
  ["society-kundasale", approved("2026-09-18T07:10:00.000Z"), returned("2026-10-30T09:40:00.000Z"), approved("2026-02-27T06:00:00.000Z"), underReview("2026-11-09T05:20:00.000Z")],
];

export const complianceRecords: SocietyCompliance[] = fixtures.map(
  ([societyId, auditReport, agmMinutes, officeBearerList, membersList]) => {
    const society = societies.find((item) => item.id === societyId)!;
    return {
      societyId,
      societyName: society.nameEn,
      societyCode: society.societyCode,
      districtId: society.district.id,
      districtName: society.district.nameEn,
      requirements: {
        AUDIT_REPORT: auditReport,
        AGM_MINUTES: agmMinutes,
        OFFICE_BEARER_LIST: officeBearerList,
        MEMBERS_LIST: membersList,
      },
    };
  },
);

export type ComplianceFilters = {
  query: string;
  districtId: string;
  type: "all" | RegistrarDocumentType;
  state: "all" | RequirementState;
};

export const EMPTY_COMPLIANCE_FILTERS: ComplianceFilters = {
  query: "",
  districtId: "all",
  type: "all",
  state: "all",
};

/** "Pahala Kosgama SSS" for tables; the full name is kept for screen readers. */
export function shortSocietyName(name: string): string {
  return name.replace(" Sarvodaya Shramadana Society", " SSS");
}

export type RequirementCounts = Record<RequirementState, number> & { total: number };

/** Counts completed, pending and missing documents of one type (or all four). */
export function countRequirements(
  records: SocietyCompliance[],
  type?: RegistrarDocumentType,
): RequirementCounts {
  const counts: RequirementCounts = { COMPLETED: 0, PENDING: 0, MISSING: 0, total: 0 };
  const types = type ? [type] : REGISTRAR_DOCUMENTS.map((document) => document.type);
  for (const record of records) {
    for (const documentType of types) {
      counts[requirementState(record.requirements[documentType].status)] += 1;
      counts.total += 1;
    }
  }
  return counts;
}

/** Societies that have all four Registrar documents approved. */
export function countFullyCompliant(records: SocietyCompliance[]): number {
  return records.filter((record) =>
    REGISTRAR_DOCUMENTS.every((document) => record.requirements[document.type].status === "APPROVED"),
  ).length;
}
