import type { ActorReference, SocietyGrade, SocietyRecord, UserRole } from "@sarvodaya-connect/api-contracts";

import { daysSince } from "@/lib/society-record-format";

import type { MessageKey } from "./messages/en";
import { formatDate as formatLocaleDate, localeTag, type Translator } from "./translate";

/**
 * Society record wording in the chosen language (issue #108 phase 3). Stored
 * values such as "President" or "ACTIVE" stay as the API sends them; only what
 * people read is translated.
 */

const OFFICES = ["President", "Secretary", "Treasurer", "Member"] as const;

/** "Society Officer", "SPC", "DDM", "District Manager" or "HQ". Acronyms stay as they are. */
export function roleName(t: Translator, role: UserRole) {
  switch (role) {
    case "SOCIETY_OFFICER":
      return t("sr.role.societyOfficer");
    case "DISTRICT_MANAGER":
      return t("sr.role.districtManager");
    case "PROGRAMME_COORDINATOR":
      return "SPC";
    case "DEPUTY_DISTRICT_MANAGER":
      return "DDM";
    default:
      return "HQ";
  }
}

/** "N. Wijesinghe (Society Officer)". */
export const actorName = (t: Translator, actor: ActorReference) =>
  actor.role ? `${actor.displayName} (${roleName(t, actor.role)})` : actor.displayName;

/** An office bearer's title; anything else is a member. */
export function officeName(t: Translator, position: string) {
  const office = (OFFICES as readonly string[]).includes(position) ? position : "Member";
  return t(`sr.office.${office}` as MessageKey);
}

/** "President, Secretary and Treasurer", joined the way the language joins a list. */
export function officeList(t: Translator, offices: readonly string[], type: "conjunction" | "disjunction" = "conjunction") {
  return new Intl.ListFormat(localeTag(t.locale), { type }).format(offices.map((office) => officeName(t, office)));
}

export const gradeName = (t: Translator, grade: SocietyGrade) => t(`sr.grade.${grade}` as MessageKey);

/** "Grade A · Strong". */
export const gradeFull = (t: Translator, grade: SocietyGrade) => t("sr.gradeLabel", { grade, name: gradeName(t, grade) });

/** "A · Strong", for grade choices. */
export const gradeOption = (t: Translator, grade: SocietyGrade) => `${grade} · ${gradeName(t, grade)}`;

export function statusName(t: Translator, status: string) {
  const known = ["ACTIVE", "INACTIVE", "UNDER_REVIEW", "SUSPENDED"];
  return known.includes(status) ? t(`sr.status.${status}` as MessageKey) : status.replaceAll("_", " ").toLowerCase();
}

/** 22 Oct 2026, in the language's month names and Sri Lanka time. */
export const recordDate = (t: Translator, value: string) =>
  formatLocaleDate(t.locale, new Date(value), { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Colombo" });

/** "today", "1 day" or "3 days". */
export function waiting(t: Translator, since: string, now = new Date()) {
  const days = daysSince(since, now);
  return days === 0 ? t("sr.today") : t.plural("sr.days", days);
}

/**
 * The Exco badge: "Exco complete", "Exco not entered yet", "Exco incomplete ·
 * 12 of 25", "Exco incomplete · no Treasurer" or "needs checking".
 */
export function excoBadge(t: Translator, exco: { complete: boolean; filled: number; toFill: number; missingOffices: string[] }) {
  if (exco.complete) return t("sr.exco.complete");
  if (exco.filled === 0) return t("sr.exco.notEntered");
  if (exco.toFill > 0) return t("sr.exco.incompleteSeats", { filled: exco.filled });
  if (exco.missingOffices.length) return t("sr.exco.incompleteOffices", { offices: officeList(t, exco.missingOffices) });
  return t("sr.exco.incompleteCheck");
}

/**
 * What is still missing. The API's own sentences stay as sent until the API
 * messages phase; only the app's fallback, used when an older API sends none,
 * is translated.
 */
export function excoMissing(t: Translator, status: SocietyRecord["excoStatus"] | undefined, toFill: number) {
  if (status?.problems) return status.problems;
  return toFill ? [t.plural("sr.exco.seatsToFill", toFill)] : [];
}
