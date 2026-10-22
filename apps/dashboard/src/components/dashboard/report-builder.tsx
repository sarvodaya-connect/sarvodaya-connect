'use client';

import { useMemo, useState } from 'react';
import {
  buildReport,
  EMPTY_REPORT_FILTERS,
  REPORT_CATALOGUE,
  REPORT_FIELDS,
  reportToCsv,
  type ReportDataset,
  type ReportField,
  type ReportFilters,
  type ReportRecord,
  type ReportResult,
} from '@/lib/report-builder';

const labels: Record<ReportField, string> = {
  societyCode: 'Society code', society: 'Society', district: 'District',
  status: 'Status', verificationStatus: 'Verification status',
  femaleTotal: 'Female members', maleTotal: 'Male members', overallTotal: 'Total members', year: 'Year',
  activityId: 'Activity ID', activity: 'Activity', sector: 'Sector', date: 'Date',
  participants: 'Participants', plannedValueLkr: 'Planned value (LKR)',
};

export function ReportBuilder({ records }: { records: readonly ReportRecord[] }) {
  const [dataset, setDataset] = useState<ReportDataset>('societies');
  const [fields, setFields] = useState<ReportField[]>([...REPORT_CATALOGUE[0].fields]);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [phase, setPhase] = useState<'ready' | 'loading' | 'error'>('ready');
  const [message, setMessage] = useState('');
  const datasetRecords = useMemo(() => records.filter(row => row.dataset === dataset), [records, dataset]);
  const fieldOptions = REPORT_FIELDS[dataset] as readonly ReportField[];
  const districts = [...new Set(datasetRecords.map(row => row.district))].sort();
  const societies = [...new Set(datasetRecords.filter(row => filters.district === 'all' || row.district === filters.district).map(row => row.society))].sort();
  const statuses = [...new Set(datasetRecords.map(row => row.status))].sort();

  function chooseDataset(value: ReportDataset) {
    setDataset(value);
    const preset = REPORT_CATALOGUE.find(report => report.dataset === value)!;
    setFields([...preset.fields]);
    setFilters(EMPTY_REPORT_FILTERS);
    setResult(null);
    setPhase('ready');
    setMessage('');
  }

  function runReport(nextDataset = dataset, nextFields = fields, nextFilters = filters) {
    setPhase('loading');
    setMessage('');
    window.setTimeout(() => {
      try {
        setResult(buildReport(records, nextDataset, nextFields, nextFilters));
        setPhase('ready');
      } catch (error) {
        setResult(null);
        setMessage(error instanceof Error ? error.message : 'Unable to run this report.');
        setPhase('error');
      }
    }, 120);
  }

  function runPredefined(id: string) {
    const preset = REPORT_CATALOGUE.find(report => report.id === id)!;
    chooseDataset(preset.dataset);
    runReport(preset.dataset, [...preset.fields], EMPTY_REPORT_FILTERS);
  }

  function toggleField(field: ReportField) {
    setFields(current => current.includes(field)
      ? current.filter(item => item !== field)
      : current.length < 9 ? [...current, field] : current);
  }

  function exportCsv() {
    if (!result) return;
    const blob = new Blob([reportToCsv(result)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sarvodaya-${dataset}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <div className="space-y-6">
    <section aria-labelledby="report-catalogue-heading" className="rounded-2xl border border-[#dfe5dc] bg-white p-5">
      <h2 id="report-catalogue-heading" className="text-lg font-semibold text-[#123d29]">Standard reports</h2>
      <p className="mt-1 text-sm text-[#68756c]">Choose a ready-to-run report using approved fields.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {REPORT_CATALOGUE.map(report => <article key={report.id} className="rounded-xl border border-[#dfe5dc] bg-[#fbfcfa] p-4">
          <h3 className="font-semibold">{report.title}</h3><p className="mt-1 min-h-10 text-sm text-[#68756c]">{report.description}</p>
          <button type="button" onClick={() => runPredefined(report.id)} className="mt-3 rounded-lg bg-[#1f6b43] px-3 py-2 text-sm font-medium text-white">Run report</button>
        </article>)}
      </div>
    </section>

    <section aria-labelledby="custom-report-heading" className="rounded-2xl border border-[#dfe5dc] bg-white p-5">
      <h2 id="custom-report-heading" className="text-lg font-semibold text-[#123d29]">Custom report builder</h2>
      <p className="mt-1 text-sm text-[#68756c]">Select one report type and up to nine supported fields.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium">Report type<select aria-label="Report type" className="mt-1 block w-full rounded-lg border border-[#cfdbce] p-2.5" value={dataset} onChange={event => chooseDataset(event.target.value as ReportDataset)}>{reportDatasetsOptions()}</select></label>
        <label className="text-sm font-medium">District<select aria-label="Report district" className="mt-1 block w-full rounded-lg border border-[#cfdbce] p-2.5" value={filters.district} onChange={event => setFilters(current => ({ ...current, district: event.target.value, society: 'all' }))}><option value="all">All allowed districts</option>{districts.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm font-medium">Society<select aria-label="Report society" className="mt-1 block w-full rounded-lg border border-[#cfdbce] p-2.5" value={filters.society} onChange={event => setFilters(current => ({ ...current, society: event.target.value }))}><option value="all">All allowed societies</option>{societies.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm font-medium">Status<select aria-label="Report status" className="mt-1 block w-full rounded-lg border border-[#cfdbce] p-2.5" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}><option value="all">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <fieldset className="mt-5"><legend className="text-sm font-semibold">Fields <span className="font-normal text-[#68756c]">({fields.length}/9 selected)</span></legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{fieldOptions.map(field => <label key={field} className="flex items-center gap-2 rounded-lg bg-[#f5f8f3] px-3 py-2 text-sm"><input type="checkbox" checked={fields.includes(field)} disabled={!fields.includes(field) && fields.length >= 9} onChange={() => toggleField(field)} />{labels[field]}</label>)}</div>
      </fieldset>
      <button type="button" disabled={phase === 'loading'} onClick={() => runReport()} className="mt-5 rounded-lg bg-[#1f6b43] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{phase === 'loading' ? 'Running report…' : 'Run custom report'}</button>
    </section>

    {phase === 'loading' && <section role="status" className="rounded-xl border bg-white p-5">Preparing report…</section>}
    {phase === 'error' && <section role="alert" className="rounded-xl border border-red-200 bg-white p-5"><h2 className="font-semibold">Unable to run report</h2><p className="mt-1 text-sm">{message}</p></section>}
    {phase === 'ready' && result && <section aria-labelledby="report-results-heading" className="overflow-hidden rounded-2xl border border-[#dfe5dc] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 id="report-results-heading" className="font-semibold">Report results</h2><p className="mt-1 text-sm text-[#68756c]">{result.rows.length} rows · {result.columns.length} fields</p></div><button type="button" onClick={exportCsv} className="rounded-lg border border-[#cfdbce] px-3 py-2 text-sm font-semibold">Export CSV</button></div>
      {result.rows.length === 0 ? <div role="status" className="p-8 text-center"><h3 className="font-semibold">No results for these filters</h3><p className="mt-1 text-sm text-[#68756c]">Adjust the district, society or status filters and run the report again.</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f5f8f3]"><tr>{result.columns.map(field => <th scope="col" key={field} className="whitespace-nowrap px-4 py-3">{labels[field]}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index} className="border-t">{result.columns.map(field => <td key={field} className="whitespace-nowrap px-4 py-3">{row[field]}</td>)}</tr>)}</tbody></table></div>}
    </section>}
    {!result && phase === 'ready' && <p className="text-sm text-[#68756c]">Run a standard or custom report to see results.</p>}
    <p className="text-xs text-[#68756c]">Reports use fictional demonstration data and only records within your assigned access scope.</p>
  </div>;
}

function reportDatasetsOptions() {
  return REPORT_CATALOGUE.map(report => <option key={report.dataset} value={report.dataset}>{report.title}</option>);
}
