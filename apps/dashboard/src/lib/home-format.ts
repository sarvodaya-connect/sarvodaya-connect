import type { HomeSummary } from "@sarvodaya-connect/api-contracts";

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

export function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** "Monday 26 Oct 2026" */
export function longDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE })
    .format(now)
    .replace(",", "");
}

/** "Today", "Yesterday" or "02 Oct" for the Updated column (V5 SP02). */
export function updatedLabel(value: string, now = new Date()) {
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
  const then = new Date(value);
  if (day(then) === day(now)) return "Today";
  if (day(then) === day(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: TIME_ZONE }).format(then);
}

/** "Fri 31 Oct, 6:00 p.m." for a temporary access end time. */
export function endsLabel(value: string) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TIME_ZONE })
    .format(date)
    .replace("am", "a.m.")
    .replace("pm", "p.m.");
  return `${day.replace(",", "")}, ${time}`;
}

/** "2 days" since a grade request was sent. */
export function waitedLabel(value: string, now = new Date()) {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000));
  return days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The access banner sentence for each role (V5 SP01, DD01, DM01). */
export function accessSentence(home: HomeSummary): { strong: string; rest: string } {
  if (home.role === "DISTRICT_MANAGER") {
    return {
      strong: `all ${home.societies.total} ${home.district?.name ?? "district"} societies`,
      rest: " · view only. You cannot edit society information or request, approve or change grades.",
    };
  }
  return {
    strong: `${plural(home.societies.total, "assigned society", "assigned societies")}`,
    rest: " · view and edit. Grade changes are decided by HQ.",
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
export function timeLeft(until: string, now = new Date()) {
  const ms = new Date(until).getTime() - now.getTime();
  if (ms <= 0) return "Ended";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  // V5 DD02 "4 days left"; M32 "3 days 8 hours left".
  if (days >= 4) return `${days} days left`;
  if (days >= 1) return `${days} ${days === 1 ? "day" : "days"}${rest ? ` ${rest} ${rest === 1 ? "hour" : "hours"}` : ""} left`;
  if (hours >= 1) return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
  return "Less than an hour left";
}

/** "27 Oct, 8:00 a.m." */
export function shortDateTime(value: string) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TIME_ZONE }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TIME_ZONE })
    .format(date)
    .replace("am", "a.m.")
    .replace("pm", "p.m.");
  return `${day}, ${time}`;
}

/** "27 Oct → 31 Oct 2026" */
export function periodLabel(start: string, end: string) {
  const fmt = (value: string, year: boolean) =>
    new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: TIME_ZONE }).format(new Date(value));
  return `${fmt(start, false)} → ${fmt(end, true)}`;
}
