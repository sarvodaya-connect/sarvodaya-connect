/**
 * Society financial years run from 1 April to 31 March (shown in Prototype v4;
 * still to be confirmed with Sarvodaya). A year is identified by the calendar
 * year it starts in: 2025 is "FY 2025/26".
 */

/** How many completed years can be viewed or entered. */
export const SELECTABLE_FINANCIAL_YEARS = 5;

const SRI_LANKA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The most recent financial year that has ended, in Sri Lanka time. */
export function latestCompletedFinancialYear(now = new Date()): number {
  const local = new Date(now.getTime() + SRI_LANKA_OFFSET_MS);
  const year = local.getUTCFullYear();
  return local.getUTCMonth() >= 3 ? year - 1 : year - 2;
}

export function financialYear(startYear: number) {
  return {
    startYear,
    label: `FY ${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`,
    startsOn: `${startYear}-04-01`,
    endsOn: `${startYear + 1}-03-31`,
  };
}

export function selectableFinancialYears(now = new Date()) {
  const latest = latestCompletedFinancialYear(now);
  return Array.from({ length: SELECTABLE_FINANCIAL_YEARS }, (_, index) =>
    financialYear(latest - index),
  );
}

export function isSelectableFinancialYear(startYear: number, now = new Date()) {
  const latest = latestCompletedFinancialYear(now);
  return startYear <= latest && startYear > latest - SELECTABLE_FINANCIAL_YEARS;
}
