import type { ReportTable, ReportType } from "@sarvodaya-connect/api-contracts";

/** V5 D15 report cards, in the prototype's order. */
export const REPORTS: { type: ReportType; title: string; description: string }[] = [
  { type: "national-summary", title: "National Summary for the Board", description: "One-page national summary of the six dashboard sections" },
  { type: "society-status", title: "Society Status Summary", description: "Active societies and A/B/C class by district" },
  { type: "membership", title: "Membership Report", description: "Totals by category, female and male" },
  { type: "registrar-documents", title: "Audit & Registrar Documents", description: "Which of the 4 annual documents each district’s societies have sent" },
  { type: "activities", title: "Activities Summary", description: "Done vs planned by sector, Social/Economic/Governance and UN SDGs" },
  { type: "profit-expenses", title: "Profit and Expenses for the Year", description: "The two yearly totals by district, and how many societies have not added them" },
  { type: "data-quality", title: "Data Quality", description: "Records not updated in 90+ days, incomplete records and missing map positions" },
];

export function isReportType(value: string | undefined): value is ReportType {
  return REPORTS.some((report) => report.type === value);
}

/** The report as CSV that Excel opens directly (UTF-8 with a byte order mark). */
export function reportCsv(report: Pick<ReportTable, "columns" | "rows">) {
  const cell = (value: string | number | undefined) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [report.columns.map((column) => cell(column.label)).join(",")].concat(
    report.rows.map((row) => report.columns.map((column) => cell(row[column.key])).join(",")),
  );
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function formatCell(value: string | number | undefined, numeric?: boolean) {
  if (value === undefined || value === "") return "";
  if (numeric && typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) return Number(value).toLocaleString("en-GB");
  return typeof value === "number" ? value.toLocaleString("en-GB") : value;
}
