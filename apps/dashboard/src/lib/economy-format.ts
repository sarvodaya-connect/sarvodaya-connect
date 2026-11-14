import type {
  BusinessStatus,
  EconomyIndustry,
  EconomyProduct,
  ProductionBasis,
  ProductionMeasurement,
  ProductionQuery,
  ProductionUnit,
} from "@sarvodaya-connect/api-contracts";

import {
  BUSINESS_STATUSES,
  ECONOMY_INDUSTRIES,
  ECONOMY_PRODUCTS,
  PRODUCTION_BASES,
  PRODUCTION_MEASUREMENTS,
  PRODUCTION_UNITS,
} from "./economy-catalogue";

import type { PillTone } from "@/components/dashboard/ui/pill";
import type { MessageKey } from "@/i18n/messages/en";
import { formatDate, type Translator } from "@/i18n/translate";

/**
 * Issue #147: Village Economic Profile on the dashboard. Every figure comes
 * from the API (#145); nothing here adds quantities up. These helpers only
 * read the filters from the address and label catalogue codes.
 */

const PRODUCTION_UNIT_CODES = PRODUCTION_UNITS.map((unit) => unit.code);
const DAY_MS = 86_400_000;
const SRI_LANKA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export const ECONOMY_PAGE_SIZE = 25;

/** The filters exactly as they are in the address, cleaned of anything unknown. */
export interface OverviewFilters {
  basis: ProductionBasis;
  /** `YYYY-MM` for a monthly period. */
  month: string;
  /** Any day of the week, `YYYY-MM-DD`; the week is Monday to Sunday. */
  week: string;
  /** A season's first and last days. */
  startsOn: string;
  endsOn: string;
  measurement: ProductionMeasurement;
  product?: EconomyProduct;
  industry?: EconomyIndustry;
  districtId?: string;
  societyId?: string;
  page: number;
}

type Search = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const pick = <T extends string>(value: string | undefined, allowed: readonly T[]) =>
  allowed.includes(value as T) ? (value as T) : undefined;

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Today in Sri Lanka, as UTC midnight. */
export function sriLankaToday(now = new Date()) {
  return new Date(`${iso(new Date(now.getTime() + SRI_LANKA_OFFSET_MS))}T00:00:00.000Z`);
}

function validDate(value: string | undefined): string | undefined {
  if (!value || !DATE.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && iso(date) === value ? value : undefined;
}

/** The last month that has ended in Sri Lanka, `YYYY-MM`. */
export function lastCompletedMonth(now = new Date()) {
  const today = sriLankaToday(now);
  return iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))).slice(0, 7);
}

/** Monday of the week containing `day`. */
export function mondayOf(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  const back = (date.getUTCDay() + 6) % 7;
  return iso(new Date(date.getTime() - back * DAY_MS));
}

/** Monday of the last week that has ended in Sri Lanka. */
export function lastCompletedWeek(now = new Date()) {
  return iso(new Date(new Date(`${mondayOf(iso(sriLankaToday(now)))}T00:00:00.000Z`).getTime() - 7 * DAY_MS));
}

export function parseOverviewFilters(search: Search, now = new Date()): OverviewFilters {
  const month = one(search.month);
  const page = Number(one(search.page));
  const districtId = one(search.districtId);
  const societyId = one(search.societyId);
  return {
    basis: pick(one(search.basis), PRODUCTION_BASES) ?? "MONTHLY",
    month: month && MONTH.test(month) && validDate(`${month}-01`) ? month : lastCompletedMonth(now),
    week: validDate(one(search.week)) ?? lastCompletedWeek(now),
    startsOn: validDate(one(search.startsOn)) ?? "",
    endsOn: validDate(one(search.endsOn)) ?? "",
    measurement: pick(one(search.measurement), PRODUCTION_MEASUREMENTS) ?? "ACTUAL",
    product: pick(one(search.product), ECONOMY_PRODUCTS.map((p) => p.code)),
    industry: pick(one(search.industry), ECONOMY_INDUSTRIES),
    districtId: districtId && UUID.test(districtId) ? districtId : undefined,
    societyId: societyId && UUID.test(societyId) ? societyId : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

/**
 * The exact period the filters ask for, or why there is none: a season
 * needs both dates, ending on or after the start and within 366 days.
 */
export function periodFor(filters: OverviewFilters): { startsOn: string; endsOn: string } | { problem: "CHOOSE_SEASON" | "INVALID" } {
  if (filters.basis === "MONTHLY") {
    const [year, month] = filters.month.split("-").map(Number) as [number, number];
    return { startsOn: `${filters.month}-01`, endsOn: iso(new Date(Date.UTC(year, month, 0))) };
  }
  if (filters.basis === "WEEKLY") {
    const startsOn = mondayOf(filters.week);
    return { startsOn, endsOn: iso(new Date(new Date(`${startsOn}T00:00:00.000Z`).getTime() + 6 * DAY_MS)) };
  }
  if (!filters.startsOn || !filters.endsOn) return { problem: "CHOOSE_SEASON" };
  const days = (Date.parse(filters.endsOn) - Date.parse(filters.startsOn)) / DAY_MS + 1;
  return days < 1 || days > 366 ? { problem: "INVALID" } : { startsOn: filters.startsOn, endsOn: filters.endsOn };
}

/** The API query for the summary and for exactly the records it counts. */
export function productionQuery(filters: OverviewFilters): ProductionQuery | null {
  const period = periodFor(filters);
  if ("problem" in period) return null;
  return {
    basis: filters.basis,
    ...period,
    measurement: filters.measurement,
    ...(filters.product ? { product: filters.product } : {}),
    ...(filters.industry ? { industry: filters.industry } : {}),
    ...(filters.districtId ? { districtId: filters.districtId } : {}),
    ...(filters.societyId ? { societyId: filters.societyId } : {}),
  };
}

export function queryString(values: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  return params.toString();
}

/** The overview's address with these filters, so links and Back keep them. */
export function overviewHref(filters: OverviewFilters, changes: Partial<OverviewFilters> = {}) {
  const next = { ...filters, ...changes };
  const query = queryString({
    basis: next.basis,
    ...(next.basis === "MONTHLY" ? { month: next.month } : {}),
    ...(next.basis === "WEEKLY" ? { week: next.week } : {}),
    ...(next.basis === "SEASONAL" ? { startsOn: next.startsOn, endsOn: next.endsOn } : {}),
    measurement: next.measurement === "ACTUAL" ? undefined : next.measurement,
    product: next.product,
    industry: next.industry,
    districtId: next.districtId,
    societyId: next.societyId,
    page: next.page > 1 ? next.page : undefined,
  });
  return query ? `/economic-profile?${query}` : "/economic-profile";
}

/** Only a path back to the overview is followed, so a link cannot send people elsewhere. */
export function safeReturnPath(value: string | string[] | undefined): string | undefined {
  const path = one(value);
  return path && /^\/economic-profile(\?[^#\\]*)?$/.test(path) && !path.includes("//") ? path : undefined;
}

// Catalogue labels. A code the dashboard does not know yet (a newer API)
// stays as sent instead of failing.
const KNOWN = {
  product: ECONOMY_PRODUCTS.map((product) => product.code) as readonly string[],
  industry: ECONOMY_INDUSTRIES as readonly string[],
  status: BUSINESS_STATUSES as readonly string[],
  basis: PRODUCTION_BASES as readonly string[],
  measurement: PRODUCTION_MEASUREMENTS as readonly string[],
  unitName: PRODUCTION_UNIT_CODES as readonly string[],
};
const label = (t: Translator, kind: keyof typeof KNOWN, code: string) =>
  KNOWN[kind].includes(code) ? t(`eco.${kind}.${code}` as MessageKey) : code;

export const productLabel = (code: string, t: Translator, otherDescription?: string | null) =>
  code === "OTHER" && otherDescription ? otherDescription : label(t, "product", code);

export const industryLabel = (code: string, t: Translator, otherIndustry?: string | null) =>
  code === "OTHER" && otherIndustry ? otherIndustry : label(t, "industry", code);

export const statusLabel = (status: BusinessStatus | string, t: Translator) => label(t, "status", status);
export const basisLabel = (basis: ProductionBasis | string, t: Translator) => label(t, "basis", basis);
export const measurementLabel = (measurement: ProductionMeasurement | string, t: Translator) => label(t, "measurement", measurement);
export const unitName = (unit: ProductionUnit | string, t: Translator) => label(t, "unitName", unit);

/** "3,200 litres", in the reader's language and number format. */
export function quantityLabel(quantity: number, unit: ProductionUnit | string, t: Translator) {
  return KNOWN.unitName.includes(unit)
    ? t.plural(`eco.qty.${unit}` as Parameters<Translator["plural"]>[0], quantity)
    : `${new Intl.NumberFormat().format(quantity)} ${unit}`;
}

const day = (t: Translator, value: string, withYear = true) =>
  formatDate(t.locale, new Date(`${value}T00:00:00.000Z`), {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });

/** A covered period in words: "October 2026", "2 Nov – 8 Nov 2026" or a season. */
export function periodLabel(
  period: { basis: ProductionBasis | string; startsOn: string; endsOn: string; seasonLabel?: string | null },
  t: Translator,
) {
  if (period.basis === "MONTHLY")
    return formatDate(t.locale, new Date(`${period.startsOn}T00:00:00.000Z`), { month: "long", year: "numeric", timeZone: "UTC" });
  const sameYear = period.startsOn.slice(0, 4) === period.endsOn.slice(0, 4);
  const range = t("eco.period.range", { start: day(t, period.startsOn, !sameYear), end: day(t, period.endsOn) });
  if (period.basis === "WEEKLY") return t("eco.period.week", { range });
  return period.seasonLabel ? t("eco.period.season", { name: period.seasonLabel, range }) : range;
}

/** A saved time in Sri Lanka. */
export function whenLabel(value: string, t: Translator) {
  return formatDate(t.locale, new Date(value), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  });
}

export const BUSINESS_STATUS_TONE: Record<BusinessStatus, PillTone> = {
  OPERATING: "on-time",
  SEASONAL: "info",
  TEMPORARILY_STOPPED: "fast-target",
  CLOSED: "inactive",
};

/** Estimates stand out; neither tone suggests the figure was verified. */
export const MEASUREMENT_TONE: Record<ProductionMeasurement, PillTone> = { ACTUAL: "info", ESTIMATED: "unverified" };
export { BUSINESS_STATUSES, ECONOMY_INDUSTRIES, ECONOMY_PRODUCTS };
