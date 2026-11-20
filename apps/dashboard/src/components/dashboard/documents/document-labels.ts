import type { RegistrarDocumentType } from "@sarvodaya-connect/api-contracts";

/** V5 order and wording of the four annual Registrar documents. */
export const REGISTRAR_LABELS: Record<RegistrarDocumentType, { title: string; note: string }> = {
  AUDIT_REPORT: { title: "Audit Report", note: "Certified by a Registered Auditor" },
  AGM_MINUTES: { title: "AGM Minutes", note: "Annual General Meeting Record" },
  OFFICE_BEARER_LIST: { title: "Office-Bearer List", note: "President, Secretary, Treasurer" },
  MEMBERS_LIST: { title: "Members List", note: "Signed File · Only DM and HQ Can Open" },
};

export const OTHER_DOCUMENT_LABELS: Record<string, string> = {
  REGISTRATION: "Registration",
  ACTIVITY_EVIDENCE: "Activity Evidence",
  OTHER: "Other Document",
  FINANCE: "Finance Document",
};

export function documentTypeLabel(type: string) {
  return REGISTRAR_LABELS[type as RegistrarDocumentType]?.title ?? OTHER_DOCUMENT_LABELS[type] ?? type;
}

export function formatSize(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
