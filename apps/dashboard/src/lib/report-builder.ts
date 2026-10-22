export const REPORT_FIELDS = {
  societies: ['societyCode', 'society', 'district', 'status', 'verificationStatus'],
  membership: ['societyCode', 'society', 'district', 'femaleTotal', 'maleTotal', 'overallTotal', 'year'],
  activities: ['activityId', 'activity', 'society', 'district', 'sector', 'date', 'status', 'participants', 'plannedValueLkr'],
} as const;

export type ReportDataset = keyof typeof REPORT_FIELDS;
export type ReportField = (typeof REPORT_FIELDS)[ReportDataset][number];
export type ReportRecord = Record<string, string | number> & { dataset: ReportDataset; district: string; society: string; status: string };
export type ReportFilters = { district: string; society: string; status: string };
export type ReportResult = { columns: ReportField[]; rows: Array<Partial<Record<ReportField, string | number>>> };

export const REPORT_CATALOGUE = [
  { id: 'societies', title: 'Society directory', description: 'Society codes, districts and verification status.', dataset: 'societies', fields: ['societyCode', 'society', 'district', 'status', 'verificationStatus'] },
  { id: 'membership', title: 'Membership summary', description: 'Member totals by society and membership year.', dataset: 'membership', fields: ['societyCode', 'society', 'district', 'femaleTotal', 'maleTotal', 'overallTotal', 'year'] },
  { id: 'activities', title: 'Activity register', description: 'Activity status, participants and planned value.', dataset: 'activities', fields: ['activityId', 'activity', 'society', 'district', 'sector', 'date', 'status', 'participants', 'plannedValueLkr'] },
] as const satisfies readonly { id: string; title: string; description: string; dataset: ReportDataset; fields: readonly ReportField[] }[];

export const EMPTY_REPORT_FILTERS: ReportFilters = { district: 'all', society: 'all', status: 'all' };

/** Validate a closed set of fields and compatible filters, then project only approved columns. */
export function buildReport(
  records: readonly ReportRecord[],
  dataset: ReportDataset,
  fields: readonly string[],
  filters: ReportFilters,
): ReportResult {
  if (!Object.hasOwn(REPORT_FIELDS, dataset)) throw new Error('Choose a supported report type.');
  const supported = REPORT_FIELDS[dataset] as readonly string[];
  if (fields.length < 1 || fields.length > 9 || new Set(fields).size !== fields.length || fields.some(field => !supported.includes(field))) {
    throw new Error('Choose between 1 and 9 supported, unique fields.');
  }
  const validValues = new Set(records.filter(row => row.dataset === dataset).map(row => row.status));
  if (filters.status !== 'all' && !validValues.has(filters.status)) throw new Error('This status filter is not supported for the selected report.');
  if ([filters.district, filters.society, filters.status].some(value => typeof value !== 'string' || value.length > 120)) {
    throw new Error('One of the report filters is invalid.');
  }
  const columns = fields as ReportField[];
  const rows = records.filter(row => row.dataset === dataset &&
    (filters.district === 'all' || row.district === filters.district) &&
    (filters.society === 'all' || row.society === filters.society) &&
    (filters.status === 'all' || row.status === filters.status))
    .map(row => Object.fromEntries(columns.map(field => [field, row[field] ?? ''])) as Partial<Record<ReportField, string | number>>);
  return { columns, rows };
}

/** RFC 4180 rows with formula-like cells prefixed to prevent spreadsheet execution. */
export function reportToCsv(report: ReportResult): string {
  const cell = (value: string | number) => {
    let text = String(value);
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [report.columns.map(cell).join(','), ...report.rows.map(row => report.columns.map(field => cell(row[field] ?? '')).join(','))].join('\r\n');
}
