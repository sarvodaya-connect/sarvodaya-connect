import type { DocumentStatus } from "@sarvodaya-connect/api-contracts";

import type { DocumentCategory } from "./access";
import {
  complianceRecords,
  REGISTRAR_DOCUMENTS,
  type RegistrarDocumentType,
  type RequirementStatus,
} from "./demo-compliance";

/**
 * Fictional society documents for the D12 library. The four Registrar
 * documents are generated from the compliance records, so the library and the
 * compliance overview always agree. Replaced by the API later.
 */

export type LibraryDocumentType =
  | RegistrarDocumentType
  | "REGISTRATION"
  | "FINANCE"
  | "ACTIVITY_EVIDENCE";

export const DOCUMENT_TYPES: { value: LibraryDocumentType; label: string }[] = [
  ...REGISTRAR_DOCUMENTS.map((document, index) => ({
    value: document.type as LibraryDocumentType,
    label: `${index + 1} · ${document.label}`,
  })),
  { value: "REGISTRATION", label: "Registration" },
  { value: "FINANCE", label: "Finance" },
  { value: "ACTIVITY_EVIDENCE", label: "Activity evidence" },
];

/** Labels for document statuses. REJECTED means returned to the society for a corrected file. */
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Under review",
  APPROVED: "Approved",
  REJECTED: "Returned",
};

export type LibraryDocument = {
  id: string;
  title: string;
  fileName: string;
  type: LibraryDocumentType;
  category: DocumentCategory;
  societyId: string;
  societyName: string;
  societyCode: string;
  districtId: string;
  districtName: string;
  version: number;
  status: DocumentStatus;
  uploadedBy: string;
  uploadedAt: string;
  sizeBytes: number;
  /** Signed members list: District Managers and HQ only. */
  reviewersOnly?: boolean;
  /** Fictional text read from the scanned file, so search can look inside it. */
  extractedText: string;
};

const statusFor: Record<Exclude<RequirementStatus, "NOT_SUBMITTED">, DocumentStatus> = {
  APPROVED: "APPROVED",
  UNDER_REVIEW: "SUBMITTED",
  RETURNED: "REJECTED",
};

const registrarText: Record<RegistrarDocumentType, (society: string) => string> = {
  AUDIT_REPORT: (society) => `Statement of accounts for ${society}, financial year ending 31 March 2026, certified by a registered auditor. Cash book, receipts and bank reconciliation checked.`,
  AGM_MINUTES: (society) => `Minutes of the Annual General Meeting of ${society}. Office bearers elected, treasurer's report accepted, annual plan approved.`,
  OFFICE_BEARER_LIST: (society) => `Office bearers of ${society}: President, Secretary, Treasurer and Executive Council members with village addresses.`,
  MEMBERS_LIST: (society) => `Signed list of members of ${society} with membership categories: Child, Youth, Ordinary, Life and Invited.`,
};

const registrarDocuments: LibraryDocument[] = complianceRecords.flatMap((record) =>
  REGISTRAR_DOCUMENTS.flatMap((document) => {
    const requirement = record.requirements[document.type];
    if (requirement.status === "NOT_SUBMITTED" || !requirement.submittedAt) return [];
    const isMembersList = document.type === "MEMBERS_LIST";
    const shortName = record.societyName.replace(" Sarvodaya Shramadana Society", "");
    return [
      {
        id: `${record.societyId}-${document.type.toLowerCase()}`,
        title: `${document.label} ${document.type === "AUDIT_REPORT" ? "FY 2025/26" : "2026"}${isMembersList ? " (signed)" : ""}`,
        fileName: `${shortName}-${document.type.toLowerCase().replaceAll("_", "-")}-2026.pdf`,
        type: document.type,
        category: "REGISTRAR",
        societyId: record.societyId,
        societyName: record.societyName,
        societyCode: record.societyCode,
        districtId: record.districtId,
        districtName: record.districtName,
        version: 1,
        status: statusFor[requirement.status],
        uploadedBy: "Society Secretary",
        uploadedAt: requirement.submittedAt,
        sizeBytes: isMembersList ? 960_000 : 1_400_000,
        reviewersOnly: isMembersList,
        extractedText: registrarText[document.type](record.societyName),
      } satisfies LibraryDocument,
    ];
  }),
);

function otherDocument(
  societyId: string,
  fields: Omit<LibraryDocument, "societyId" | "societyName" | "societyCode" | "districtId" | "districtName">,
): LibraryDocument {
  const record = complianceRecords.find((item) => item.societyId === societyId)!;
  return {
    ...fields,
    societyId,
    societyName: record.societyName,
    societyCode: record.societyCode,
    districtId: record.districtId,
    districtName: record.districtName,
  };
}

const otherDocuments: LibraryDocument[] = [
  otherDocument("society-pahala-kosgama", {
    id: "pahala-kosgama-registration",
    title: "Registration certificate",
    fileName: "Pahala-Kosgama-registration-certificate.pdf",
    type: "REGISTRATION",
    category: "GENERAL",
    version: 2,
    status: "APPROVED",
    uploadedBy: "District Office",
    uploadedAt: "2024-01-12T08:30:00.000Z",
    sizeBytes: 860_000,
    extractedText: "Certificate of registration under the Voluntary Social Service Organisations Act. Registration number DEMO/KG/1984/042.",
  }),
  otherDocument("society-pahala-kosgama", {
    id: "pahala-kosgama-tank-photos",
    title: "Tank cleaning photos",
    fileName: "Pahala-Kosgama-tank-cleaning-photos.pdf",
    type: "ACTIVITY_EVIDENCE",
    category: "GENERAL",
    version: 1,
    status: "SUBMITTED",
    uploadedBy: "Society Secretary",
    uploadedAt: "2026-10-05T10:20:00.000Z",
    sizeBytes: 3_200_000,
    extractedText: "Shramadana tank cleaning campaign with 42 volunteers. Before and after photographs of the village tank.",
  }),
  otherDocument("society-wellawa", {
    id: "wellawa-bank-statement",
    title: "Bank statement Q3 2026",
    fileName: "Wellawa-bank-statement-Q3-2026.pdf",
    type: "FINANCE",
    category: "FINANCE",
    version: 1,
    status: "SUBMITTED",
    uploadedBy: "Society Treasurer",
    uploadedAt: "2026-10-05T04:10:00.000Z",
    sizeBytes: 540_000,
    extractedText: "Savings account statement for July to September 2026. Opening balance, deposits from member contributions and closing balance.",
  }),
  otherDocument("society-rambukkana", {
    id: "rambukkana-library-photos",
    title: "Children's library opening photos",
    fileName: "Rambukkana-library-opening-photos.pdf",
    type: "ACTIVITY_EVIDENCE",
    category: "GENERAL",
    version: 1,
    status: "APPROVED",
    uploadedBy: "Society Secretary",
    uploadedAt: "2026-09-12T09:00:00.000Z",
    sizeBytes: 2_700_000,
    extractedText: "Opening of the village children's library with donated books. Preschool teachers and parents attended.",
  }),
  otherDocument("society-galewela", {
    id: "galewela-registration",
    title: "Registration certificate",
    fileName: "Galewela-registration-certificate.pdf",
    type: "REGISTRATION",
    category: "GENERAL",
    version: 1,
    status: "APPROVED",
    uploadedBy: "District Office",
    uploadedAt: "2023-05-30T06:00:00.000Z",
    sizeBytes: 790_000,
    extractedText: "Certificate of registration under the Voluntary Social Service Organisations Act. Registration number DEMO/MT/1996/008.",
  }),
];

export const libraryDocuments: LibraryDocument[] = [...registrarDocuments, ...otherDocuments].sort(
  (a, b) => b.uploadedAt.localeCompare(a.uploadedAt),
);

export type DocumentFilters = {
  query: string;
  districtId: string;
  societyId: string;
  type: string;
  status: string;
};

export const EMPTY_DOCUMENT_FILTERS: DocumentFilters = {
  query: "",
  districtId: "all",
  societyId: "all",
  type: "all",
  status: "all",
};

export type DocumentMatch = { document: LibraryDocument; matchedInText: boolean };

/**
 * Searches the name, society and type first, then the text read from the
 * scanned file. Results that only match the scanned text are flagged so the
 * library can say where the match was found.
 */
export function searchDocuments(documents: LibraryDocument[], filters: DocumentFilters): DocumentMatch[] {
  const query = filters.query.trim().toLowerCase();
  return documents.flatMap<DocumentMatch>((document) => {
    if (filters.districtId !== "all" && document.districtId !== filters.districtId) return [];
    if (filters.societyId !== "all" && document.societyId !== filters.societyId) return [];
    if (filters.type !== "all" && document.type !== filters.type) return [];
    if (filters.status !== "all" && document.status !== filters.status) return [];
    if (!query) return [{ document, matchedInText: false }];
    const typeLabel = DOCUMENT_TYPES.find((type) => type.value === document.type)?.label ?? "";
    const inDetails = [document.title, document.fileName, document.societyName, document.societyCode, typeLabel]
      .some((value) => value.toLowerCase().includes(query));
    if (inDetails) return [{ document, matchedInText: false }];
    if (document.extractedText.toLowerCase().includes(query)) return [{ document, matchedInText: true }];
    return [];
  });
}
