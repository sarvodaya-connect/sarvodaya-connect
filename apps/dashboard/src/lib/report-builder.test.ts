import { describe, expect, it } from 'vitest';
import { buildReport, EMPTY_REPORT_FILTERS, REPORT_CATALOGUE, reportToCsv } from './report-builder';
import { reportRecordsFor } from './report-data';
import { getViewer } from './access';

const records = reportRecordsFor(getViewer('hq-admin'));

describe('report builder', () => {
  it('runs each predefined report with only its approved fields', () => {
    for (const preset of REPORT_CATALOGUE) {
      const result = buildReport(records, preset.dataset, preset.fields, EMPTY_REPORT_FILTERS);
      expect(result.columns).toEqual(preset.fields);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every(row => preset.fields.every(field => field in row))).toBe(true);
    }
  });

  it('filters to the selected district, society and status together', () => {
    const activity = records.find(row => row.dataset === 'activities' && row.status === 'APPROVED')!;
    const result = buildReport(records, 'activities', ['activityId', 'society', 'status'], {
      district: activity.district, society: activity.society, status: activity.status,
    });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every(row => row.society === activity.society && row.status === 'APPROVED')).toBe(true);
  });

  it('rejects empty, duplicate, unsupported and incompatible query combinations', () => {
    expect(() => buildReport(records, 'activities', [], EMPTY_REPORT_FILTERS)).toThrow(/supported, unique fields/);
    expect(() => buildReport(records, 'activities', ['activity', 'activity'], EMPTY_REPORT_FILTERS)).toThrow(/supported, unique fields/);
    expect(() => buildReport(records, 'societies', ['plannedValueLkr'], EMPTY_REPORT_FILTERS)).toThrow(/supported, unique fields/);
    expect(() => buildReport(records, 'membership', ['overallTotal'], { ...EMPTY_REPORT_FILTERS, status: 'APPROVED' })).toThrow(/status filter is not supported/);
  });

  it('exports the exact visible columns and rows with formula injection escaped', () => {
    const result = buildReport(records, 'activities', ['activityId', 'society', 'status'], {
      ...EMPTY_REPORT_FILTERS, status: 'APPROVED',
    });
    const csv = reportToCsv(result);
    expect(csv.split('\r\n')).toHaveLength(result.rows.length + 1);
    expect(csv.split('\r\n')[0]).toBe('"activityId","society","status"');
    expect(reportToCsv({ columns: ['society'], rows: [{ society: '=HYPERLINK("bad")' }] })).toContain("'=HYPERLINK");
    expect(reportToCsv({ columns: ['society'], rows: [{ society: 'safe, "quoted"' }] })).toBe("\"society\"\r\n\"safe, \"\"quoted\"\"\"");
  });

  it('applies role scope to all report datasets', () => {
    const districtRows = reportRecordsFor(getViewer('district-manager'));
    expect(districtRows.every(row => row.district === 'Kurunegala')).toBe(true);
    const coordinatorRows = reportRecordsFor(getViewer('programme-coordinator'));
    expect(coordinatorRows.every(row => ['society-pahala-kosgama', 'society-wellawa', 'society-rambukkana'].includes(String(row.societyId)))).toBe(true);
  });
});
