import { ENGLISH } from "@/i18n/english";
import { localeTag, type Translator } from "@/i18n/translate";
import type { RegistrarDocumentType } from "@sarvodaya-connect/api-contracts";

/** V5 order and wording of the four annual Registrar documents. */
export const REGISTRAR_LABELS: Record<RegistrarDocumentType, { title: string; note: string }> = {
  AUDIT_REPORT: { title: "Audit Report", note: "Certified by a Registered Auditor" },
  AGM_MINUTES: { title: "AGM Minutes", note: "Annual General Meeting Record" },
  OFFICE_BEARER_LIST: { title: "Office-Bearer List", note: "President, Secretary, Treasurer" },
  MEMBERS_LIST: { title: "Members List", note: "Signed File · Only DM and HQ Can Open" },
};

const OTHER_DOCUMENT_KEYS = {
  REGISTRATION: "rd.registration",
  ACTIVITY_EVIDENCE: "rd.evidence",
  FINANCE: "rd.finance",
  OTHER: "rd.other",
} as const;

export function documentTypeLabel(type: string, t: Translator = ENGLISH) {
  if (Object.hasOwn(REGISTRAR_LABELS, type)) return t(`doc.${type as RegistrarDocumentType}`);
  const key = Object.hasOwn(OTHER_DOCUMENT_KEYS, type) ? OTHER_DOCUMENT_KEYS[type as keyof typeof OTHER_DOCUMENT_KEYS] : undefined;
  return key ? t(key) : type;
}

export function formatSize(bytes: number, t: Translator = ENGLISH) {
  const locale = localeTag(t.locale);
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1000)).toLocaleString(locale, { useGrouping: false })} KB`;
}
