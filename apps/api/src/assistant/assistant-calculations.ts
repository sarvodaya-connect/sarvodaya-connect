/**
 * SarvoAI calculations over yearly totals. Pure functions, so the rules that decide
 * what counts can be tested without a database. A missing figure is never zero:
 * the society is left out and counted as excluded.
 */

export interface SocietyRef {
  id: string;
  code: string;
  name: string;
  district: string;
}

export type Metric = 'profit' | 'expenses';

/** One society's recorded totals for one financial year; null means not added. */
export interface YearTotals {
  profit: number | null;
  expenses: number | null;
}

/** societyId -> financial year start -> totals */
export type FiguresBySociety = Map<string, Map<number, YearTotals>>;

const valueOf = (figures: FiguresBySociety, societyId: string, year: number, metric: Metric) =>
  figures.get(societyId)?.get(year)?.[metric] ?? null;

const roundLkr = (value: number) => Math.round(value);

export interface MetricSummary {
  included: { society: SocietyRef; value: number }[];
  excluded: SocietyRef[];
  total: number | null;
  average: number | null;
}

/** Average and total of one yearly figure across the given societies. */
export function summarizeMetric(
  societies: SocietyRef[],
  figures: FiguresBySociety,
  year: number,
  metric: Metric,
): MetricSummary {
  const included: MetricSummary['included'] = [];
  const excluded: SocietyRef[] = [];
  for (const society of societies) {
    const value = valueOf(figures, society.id, year, metric);
    if (value === null) excluded.push(society);
    else included.push({ society, value });
  }
  included.sort((a, b) => b.value - a.value || a.society.name.localeCompare(b.society.name));
  const total = included.length ? included.reduce((sum, row) => sum + row.value, 0) : null;
  return {
    included,
    excluded,
    total: total === null ? null : roundLkr(total),
    average: total === null ? null : roundLkr(total / included.length),
  };
}

export const THRESHOLD_MODES = ['each', 'any', 'combined'] as const;
export type ThresholdMode = (typeof THRESHOLD_MODES)[number];

export interface ThresholdResult {
  matches: { society: SocietyRef; values: (number | null)[]; combined: number | null }[];
  /** Societies with enough figures to decide either way. */
  checked: number;
  /** Societies whose missing years mean the answer is unknown. */
  excluded: SocietyRef[];
}

/**
 * Societies whose total profit is above an amount:
 * - each: in every one of the years (all years must be recorded)
 * - any: in at least one year (unknown only if none is above and a year is missing)
 * - combined: the years added together (all years must be recorded)
 */
export function profitAboveThreshold(
  societies: SocietyRef[],
  figures: FiguresBySociety,
  years: number[],
  amount: number,
  mode: ThresholdMode,
): ThresholdResult {
  const matches: ThresholdResult['matches'] = [];
  const excluded: SocietyRef[] = [];
  let checked = 0;
  for (const society of societies) {
    const values = years.map((year) => valueOf(figures, society.id, year, 'profit'));
    const recorded = values.filter((value): value is number => value !== null);
    const complete = recorded.length === years.length;
    const combined = complete ? roundLkr(recorded.reduce((sum, value) => sum + value, 0)) : null;
    let matched: boolean;
    if (mode === 'any') {
      matched = recorded.some((value) => value > amount);
      if (!matched && !complete) {
        excluded.push(society);
        continue;
      }
    } else {
      if (!complete) {
        excluded.push(society);
        continue;
      }
      matched = mode === 'each' ? recorded.every((value) => value > amount) : (combined ?? 0) > amount;
    }
    checked += 1;
    if (matched) matches.push({ society, values, combined });
  }
  matches.sort((a, b) => (b.combined ?? 0) - (a.combined ?? 0) || a.society.name.localeCompare(b.society.name));
  return { matches, checked, excluded };
}

export type MissingFigure = 'profit' | 'expenses' | 'both';

/** Societies that have not added total profit, total expenses, or either, for a year. */
export function missingAnnualFigures(
  societies: SocietyRef[],
  figures: FiguresBySociety,
  year: number,
): { society: SocietyRef; missing: MissingFigure }[] {
  const rows: { society: SocietyRef; missing: MissingFigure }[] = [];
  for (const society of societies) {
    const profit = valueOf(figures, society.id, year, 'profit');
    const expenses = valueOf(figures, society.id, year, 'expenses');
    if (profit === null && expenses === null) rows.push({ society, missing: 'both' });
    else if (profit === null) rows.push({ society, missing: 'profit' });
    else if (expenses === null) rows.push({ society, missing: 'expenses' });
  }
  return rows.sort((a, b) => a.society.district.localeCompare(b.society.district) || a.society.name.localeCompare(b.society.name));
}
