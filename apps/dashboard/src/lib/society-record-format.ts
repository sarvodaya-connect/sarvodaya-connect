import type {
  ActorReference,
  SocietyGrade,
  SocietyHistoryCategory,
  UserRole,
} from "@sarvodaya-connect/api-contracts";

/**
 * SC-65 display helpers for the society record (Prototype v4, D05–D05w).
 * The dashboard imports only types from the shared contracts, so the few
 * values it needs are repeated here and checked against those types.
 */

export const SOCIETY_GRADE_LABELS = {
  A: "Strong",
  B: "Developing",
  C: "Needs strengthening",
} as const satisfies Record<SocietyGrade, string>;

export const SOCIETY_HISTORY_CATEGORIES = [
  "SOCIETY",
  "EXCO",
  "WORK_PLAN",
  "ANNUAL_SUMMARY",
  "GRADE",
  "DOCUMENTS",
] as const satisfies readonly SocietyHistoryCategory[];

export const ROLE_LABELS: Record<UserRole, string> = {
  SOCIETY_OFFICER: "Society Officer",
  PROGRAMME_COORDINATOR: "SPC",
  DEPUTY_DISTRICT_MANAGER: "DDM",
  DISTRICT_MANAGER: "District Manager",
  HQ_ADMIN: "HQ",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** API-backed society records use UUIDs; older demonstration profiles use readable ids. */
export function isSocietyRecordId(id: string) {
  return UUID_PATTERN.test(id);
}

export function formatLkr(value: number) {
  return `LKR ${value.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Colombo",
});

/** 22 Oct 2026 */
export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

/** "N. Wijesinghe (Society Officer)" */
export function actorLabel(actor: ActorReference) {
  return actor.role ? `${actor.displayName} (${ROLE_LABELS[actor.role]})` : actor.displayName;
}

export function gradeLabel(grade: SocietyGrade) {
  return `Grade ${grade} · ${SOCIETY_GRADE_LABELS[grade]}`;
}

/** Whole days since a date, for "waiting 2 days". */
export function daysSince(value: string, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000));
}

export function waitingLabel(value: string, now = new Date()) {
  const days = daysSince(value, now);
  return days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"}`;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const gradeBadgeClass: Record<SocietyGrade, string> = {
  A: "bg-[#2e7d4f] text-white",
  B: "bg-[#d9a21b] text-white",
  C: "bg-[#e07b2f] text-white",
};
