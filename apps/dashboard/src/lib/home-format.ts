import type { HomeSummary } from "@sarvodaya-connect/api-contracts";

import { ENGLISH } from "@/i18n/english";
import { localeTag, type Translator } from "@/i18n/translate";

/** "My societies" filters as they appear in the page URL (V5 SP02, DD03, DM02). */
export type SocietyFilters = {
  q?: string;
  grade?: string;
  dsDivision?: string;
  needsUpdate?: string;
  gradeRequest?: string;
  spcId?: string;
  ddmId?: string;
  page?: string;
  /** DD04: "DISTRICT" lists the whole district through temporary access. */
  scope?: string;
  assignedToMe?: string;
};

/** Dates on the role homes are shown in Sri Lanka time. */
const TIME_ZONE = "Asia/Colombo";

export function greeting(now = new Date(), t: Translator = ENGLISH) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE }).format(now));
  return t(hour < 12 ? "home.morning" : hour < 17 ? "home.afternoon" : "home.evening");
}

/** "Monday 26 Oct 2026" */
export function longDate(now = new Date(), t: Translator = ENGLISH) {
  return new Intl.DateTimeFormat(localeTag(t.locale), { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE })
    .format(now)
    .replace(",", "");
}

/** "Today", "Yesterday" or "02 Oct" for the Updated column (V5 SP02). */
export function updatedLabel(value: string, now = new Date(), t: Translator = ENGLISH) {
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
  const then = new Date(value);
  if (day(then) === day(now)) return t("home.today");
  if (day(then) === day(new Date(now.getTime() - 86_400_000))) return t("home.yesterday");
  return new Intl.DateTimeFormat(localeTag(t.locale), { day: "2-digit", month: "short", timeZone: TIME_ZONE }).format(then);
}

const clockTime = (date: Date, t: Translator) =>
  new Intl.DateTimeFormat(localeTag(t.locale), { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TIME_ZONE })
    .format(date)
    .replace("am", "a.m.")
    .replace("pm", "p.m.");

/** "Fri 31 Oct, 6:00 p.m." for a temporary access end time. */
export function endsLabel(value: string, t: Translator = ENGLISH) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat(localeTag(t.locale), { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE }).format(date);
  return `${day.replace(",", "")}, ${clockTime(date, t)}`;
}

/** "2 days" since a grade request was sent. */
export function waitedLabel(value: string, now = new Date(), t: Translator = ENGLISH) {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000));
  return days === 0 ? t("home.whenToday") : t.plural("home.days", days);
}

/** The access banner sentence for each role (V5 SP01, DD01, DM01). */
export function accessSentence(home: HomeSummary, t: Translator = ENGLISH): { strong: string; rest: string } {
  if (home.role === "DISTRICT_MANAGER") {
    return {
      strong: t("home.accessAll", { count: home.societies.total, district: home.district?.name ?? t("home.districtWord") }),
      rest: t("home.accessDmRest"),
    };
  }
  return {
    strong: t.plural("home.assigned", home.societies.total),
    rest: t("home.accessEditRest"),
  };
}

/** "A 2 · B 4 · C 6" */
export function gradeLine(grades: HomeSummary["societies"]["grades"]) {
  return `A ${grades.A} · B ${grades.B} · C ${grades.C}`;
}

/** Short role names used on the role homes ("N. Wijesinghe (Society Officer)"). */
export const SHORT_ROLE: Record<string, string> = {
  HQ_ADMIN: "HQ",
  DISTRICT_MANAGER: "DM",
  DEPUTY_DISTRICT_MANAGER: "DDM",
  PROGRAMME_COORDINATOR: "SPC",
  SOCIETY_OFFICER: "Society Officer",
};

/** A short role name in the chosen language; the acronyms stay as they are. */
export const shortRole = (role: string, t: Translator = ENGLISH) => (role === "SOCIETY_OFFICER" ? t("home.societyOfficer") : (SHORT_ROLE[role] ?? role));

const KEYS = ["q", "grade", "dsDivision", "needsUpdate", "gradeRequest", "spcId", "ddmId", "page", "scope", "assignedToMe"] as const;

/** Keeps only the filters the list understands, each a single short string. */
export function parseSocietyFilters(params: Record<string, string | string[] | undefined>): SocietyFilters {
  const filters: SocietyFilters = {};
  for (const key of KEYS) {
    const raw = params[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 150);
    if (value) filters[key] = value;
  }
  if (filters.grade && !["A", "B", "C"].includes(filters.grade)) delete filters.grade;
  if (filters.needsUpdate && !["true", "false"].includes(filters.needsUpdate)) delete filters.needsUpdate;
  if (filters.gradeRequest && !["PENDING", "NONE"].includes(filters.gradeRequest)) delete filters.gradeRequest;
  if (filters.page && !/^[1-9]\d{0,3}$/.test(filters.page)) delete filters.page;
  if (filters.scope && filters.scope !== "DISTRICT") delete filters.scope;
  if (filters.assignedToMe && !["true", "false"].includes(filters.assignedToMe)) delete filters.assignedToMe;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (filters.spcId && !uuid.test(filters.spcId)) delete filters.spcId;
  if (filters.ddmId && !uuid.test(filters.ddmId)) delete filters.ddmId;
  return filters;
}

/** "4 days left", "3 days 8 hours left", "5 hours left" (time left as text, never a bar). */
export function timeLeft(until: string, now = new Date(), t: Translator = ENGLISH) {
  const ms = new Date(until).getTime() - now.getTime();
  if (ms <= 0) return t("home.ended");
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  // V5 DD02 "4 days left"; M32 "3 days 8 hours left".
  if (days >= 4 || (days >= 1 && !rest)) return t.plural("home.daysLeft", days);
  if (days >= 1) return t("home.daysHoursLeft", { days: t.plural("home.days", days), hours: t.plural("home.hours", rest) });
  if (hours >= 1) return t.plural("home.hoursLeft", hours);
  return t("home.underAnHour");
}

/** "27 Oct, 8:00 a.m." */
export function shortDateTime(value: string, t: Translator = ENGLISH) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat(localeTag(t.locale), { day: "numeric", month: "short", timeZone: TIME_ZONE }).format(date);
  return `${day}, ${clockTime(date, t)}`;
}

/** "27 Oct → 31 Oct 2026" */
export function periodLabel(start: string, end: string) {
  const fmt = (value: string, year: boolean) =>
    new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: TIME_ZONE }).format(new Date(value));
  return `${fmt(start, false)} → ${fmt(end, true)}`;
}
