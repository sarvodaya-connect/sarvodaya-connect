import type { AuditLogEntry, AuditType, UserRole } from "@sarvodaya-connect/api-contracts";

import { ROLE_LABELS } from "./society-record-format";

/** V5 D24 "What" column. Unknown actions fall back to a readable form of the code. */
const ACTION_LABELS: Record<string, string> = {
  SOCIETY_CREATED: "Society created",
  SOCIETY_PROFILE_UPDATED: "Society edit",
  SOCIETY_MEMBERSHIP_UPDATED: "Membership",
  SOCIETY_STAFF_ASSIGNED: "Assignment",
  SOCIETY_COUNCIL_UPDATED: "Exco change",
  MEMBER_NIC_UPDATED: "NIC updated",
  MEMBER_NIC_REVEALED: "NIC shown",
  GRADE_CHANGE_REQUESTED: "Grade requested",
  GRADE_CHANGE_APPROVED: "Grade approved",
  GRADE_CHANGE_REJECTED: "Grade rejected",
  SOCIETY_GRADE_CHANGED: "Grade changed by HQ",
  ACCOUNT_CREATED: "Account created",
  ACCOUNT_SCOPE_UPDATED: "Role changed",
  ACCOUNT_PASSWORD_CHANGED: "Password set",
  ACCOUNT_DISABLED: "Account disabled",
  LOCAL_HQ_BOOTSTRAPPED: "First HQ account",
  COGNITO_HQ_LINKED: "First HQ account (Cognito)",
  DISTRICT_ACCESS_GRANTED: "Temporary access given",
  DISTRICT_ACCESS_REVOKED: "Temporary access ended",
  DISTRICT_SOCIETY_OPENED: "Opened with temporary access",
  ANNUAL_SUMMARY_UPDATED: "Annual summary",
  AUDIT_REPORT_UPLOADED: "Audit report uploaded",
  DOCUMENT_UPLOADED: "Document uploaded",
  WORK_PLAN_UPDATED: "Work plan",
  SARVOAI_QUESTION: "SarvoAI question",
  INCIDENT_OPENED: "Incident opened",
  INCIDENT_ASSESSMENT_SENT: "Assessment sent",
  INCIDENT_NEED_ADDED: "Incident need added",
  INCIDENT_HELPERS_ASSIGNED: "Helpers assigned",
  INCIDENT_DELIVERY_UPDATED: "Delivery updated",
  INCIDENT_REMINDER_SENT: "Assessment reminder",
  INCIDENT_REPORT_CREATED: "Situation report",
  INCIDENT_CLOSED: "Incident closed",
};

export function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.toLowerCase().replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

/** Actions shown as coloured chips in V5 D24. */
export const HIGHLIGHT: Record<string, "temporary" | "approved" | "requested" | "rejected"> = {
  DISTRICT_ACCESS_GRANTED: "temporary",
  DISTRICT_ACCESS_REVOKED: "temporary",
  GRADE_CHANGE_APPROVED: "approved",
  SOCIETY_GRADE_CHANGED: "approved",
  GRADE_CHANGE_REQUESTED: "requested",
  GRADE_CHANGE_REJECTED: "rejected",
};

export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  SOCIETY: "Society records",
  EXCO: "Exco",
  GRADE: "Grades",
  ACCOUNTS: "Accounts",
  ACCESS: "Access",
  RECORDS: "Plans and documents",
  ASSISTANT: "SarvoAI",
};

export const AUDIT_PERIODS = [
  { days: 1, label: "Today" },
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last year" },
] as const;

export type AuditFilters = { q: string; districtId: string; type: string; role: string; days: string };

export function parseAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  const one = (key: string) => {
    const value = params[key];
    return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
  };
  return {
    q: one("q").slice(0, 100),
    districtId: /^[0-9a-f-]{36}$/i.test(one("districtId")) ? one("districtId") : "",
    type: one("type") in AUDIT_TYPE_LABELS ? one("type") : "",
    role: one("role") in ROLE_LABELS ? one("role") : "",
    days: AUDIT_PERIODS.some((period) => String(period.days) === one("days")) ? one("days") : "30",
  };
}

/** The API query for these filters. */
export function auditQuery(filters: AuditFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return params.toString();
}

export function roleLabel(role: UserRole | null) {
  return role ? ROLE_LABELS[role] : "";
}

/** One CSV row per entry, quoted so commas and quotes in details are safe. */
export function auditCsv(entries: AuditLogEntry[]) {
  const cell = (value: string) => `"${value.replaceAll('"', '""').replace(/^[=+\-@]/, "'$&")}"`;
  const header = ["When", "Who", "Role", "What", "Society or scope", "Details", "Approved by"];
  const rows = entries.map((entry) =>
    [
      entry.createdAt,
      entry.actor.displayName,
      roleLabel(entry.actor.role),
      actionLabel(entry.action),
      entry.scope,
      entry.detail,
      entry.approvedBy ?? "",
    ].map(cell),
  );
  return [header.map(cell), ...rows].map((row) => row.join(",")).join("\r\n");
}
