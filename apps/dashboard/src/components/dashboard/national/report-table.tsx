import type { ReportTable } from "@sarvodaya-connect/api-contracts";

import { formatCell } from "@/lib/reports";

/** A D15 report as a plain table, for the preview and the print view. */
export function ReportTableView({ limit, report }: { limit?: number; report: ReportTable }) {
  const rows = limit ? report.rows.slice(0, limit) : report.rows;
  return (
    <table className="w-full text-left text-[12px]">
      <caption className="sr-only">{`${report.title} · ${report.scope} · ${report.financialYear.label}`}</caption>
      <thead className="bg-[#f2f4f0] text-[11px] text-muted">
        <tr>
          {report.columns.map((column) => (
            <th className={`px-3 py-2 font-medium ${column.numeric ? "text-right" : ""}`} key={column.key} scope="col">{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft">
        {rows.map((row, index) => (
          <tr key={index}>
            {report.columns.map((column) => (
              <td className={`px-3 py-2 text-ink ${column.numeric ? "text-right tabular-nums" : ""}`} key={column.key}>{formatCell(row[column.key], column.numeric)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
