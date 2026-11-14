import {
  MAX_SEASON_DAYS,
  type ProductionBasisValue,
  type ProductionMeasurementValue,
} from './economy.catalogue.js';

/**
 * Issue #145: the exact covered period of a production record. Dates are
 * Sri Lanka calendar days (`YYYY-MM-DD`), both ends included.
 *
 * - WEEKLY: Monday to the following Sunday.
 * - MONTHLY: the first to the last day of one calendar month.
 * - SEASONAL: any range of at most 366 days, with a label such as
 *   "Maha 2026/27".
 *
 * Nothing is prorated: a season is never split into months, and a week that
 * crosses a month end belongs to neither month's summary.
 */

const DAY_MS = 86_400_000;
const SRI_LANKA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Records start no earlier than this. */
export const EARLIEST_PERIOD = '2000-01-01';
/** Estimates may look ahead at most this many days. */
const ESTIMATE_DAYS_AHEAD = 366;

export interface PeriodInput {
  basis: ProductionBasisValue;
  startsOn: string;
  endsOn: string;
  seasonLabel?: string | null;
}

export interface Period {
  basis: ProductionBasisValue;
  start: Date;
  end: Date;
  seasonLabel: string | null;
}

/** A strict `YYYY-MM-DD` that is a real calendar day, as UTC midnight. */
export function parseCalendarDate(value: string): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

export function calendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today in Sri Lanka, as UTC midnight. */
export function sriLankaToday(now = new Date()): Date {
  return new Date(
    `${new Date(now.getTime() + SRI_LANKA_OFFSET_MS).toISOString().slice(0, 10)}T00:00:00.000Z`,
  );
}

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

function lastDayOfMonth(start: Date): Date {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
}

/**
 * Whether the dates make a period of the basis: the shape only, with no rule
 * about today. Summaries use this, since they can ask about any period. A
 * summary of seasons needs no season name (`labelRequired: false`).
 */
export function periodShape(
  input: PeriodInput,
  { labelRequired = true } = {},
): { period: Period } | { error: string } {
  const start = parseCalendarDate(input.startsOn);
  const end = parseCalendarDate(input.endsOn);
  if (!start || !end) return { error: 'Enter dates as YYYY-MM-DD' };
  if (end < start) return { error: 'The period cannot end before it starts' };
  if (calendarDate(start) < EARLIEST_PERIOD)
    return { error: `Periods start on or after ${EARLIEST_PERIOD}` };

  const label = input.seasonLabel?.trim() || null;
  switch (input.basis) {
    case 'WEEKLY':
      // getUTCDay: 1 is Monday.
      if (
        start.getUTCDay() !== 1 ||
        end.getTime() !== addDays(start, 6).getTime()
      )
        return {
          error: 'A weekly period runs from a Monday to the next Sunday',
        };
      break;
    case 'MONTHLY':
      if (
        start.getUTCDate() !== 1 ||
        end.getTime() !== lastDayOfMonth(start).getTime()
      )
        return {
          error:
            'A monthly period runs from the first to the last day of one month',
        };
      break;
    case 'SEASONAL':
      if (!label && labelRequired)
        return { error: 'Name the season, for example Maha 2026/27' };
      if (label && label.length > 60)
        return { error: 'The season name can be at most 60 characters' };
      if ((end.getTime() - start.getTime()) / DAY_MS + 1 > MAX_SEASON_DAYS)
        return { error: `A season can cover at most ${MAX_SEASON_DAYS} days` };
      break;
    default:
      return { error: 'Choose weekly, monthly or seasonal' };
  }
  if (input.basis !== 'SEASONAL' && label)
    return { error: 'Only a seasonal period has a season name' };
  return {
    period: { basis: input.basis, start, end, seasonLabel: label },
  };
}

/** The period of a figure being saved, or the reason it cannot be saved. */
export function checkPeriod(
  input: PeriodInput,
  measurement: ProductionMeasurementValue,
  now = new Date(),
): { period: Period } | { error: string } {
  const shaped = periodShape(input);
  if ('error' in shaped) return shaped;
  const { end } = shaped.period;
  const today = sriLankaToday(now);
  if (measurement === 'ACTUAL' && end > today)
    return {
      error:
        'An actual figure can only cover days that have passed. Record an estimate instead',
    };
  if (end > addDays(today, ESTIMATE_DAYS_AHEAD))
    return { error: 'An estimate can look at most a year ahead' };
  return shaped;
}

/** Two inclusive periods share at least one day. */
export function periodsOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start <= b.end && b.start <= a.end;
}
