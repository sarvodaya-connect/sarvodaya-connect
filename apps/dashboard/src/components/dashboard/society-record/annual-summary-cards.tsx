import Link from "next/link";

import type { AnnualFinancialSummary, SocietyStaffMember } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";
import { actorLabel, formatDate, formatLkr } from "@/lib/society-record-format";

/**
 * D05 / D05m: the year's two totals and the audit report lead the society
 * record. Two yearly totals only — no transactions, loans, savings or accounts.
 */
export function AnnualSummaryCards({
  societyId,
  societyName,
  staff,
  summary,
}: {
  societyId: string;
  societyName: string;
  staff: SocietyStaffMember[];
  summary: AnnualFinancialSummary;
}) {
  const { financialYear, auditReport } = summary;
  const missingFigures = summary.totalProfit == null || summary.totalExpenses == null;
  const lastChange = [summary.profitChange, summary.expensesChange]
    .filter((change) => change != null)
    .sort((a, b) => b!.updatedAt.localeCompare(a!.updatedAt))[0];
  const spc = staff.find((member) => member.role === "PROGRAMME_COORDINATOR");
  const hasOfficer = staff.some((member) => member.role === "SOCIETY_OFFICER");
  const yearRange = `${formatDate(`${financialYear.startsOn}T00:00:00+05:30`)} – ${formatDate(`${financialYear.endsOn}T00:00:00+05:30`)}`;

  return (
    <section aria-labelledby="annual-summary-heading" className="mt-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft" id="annual-summary-heading">
          Annual financial summary · {financialYear.label} ({yearRange.toUpperCase()})
        </h3>
        {lastChange && (
          <p className="text-[10px] text-muted">
            Last updated {formatDate(lastChange.updatedAt)} by {actorLabel(lastChange.updatedBy)} ·{" "}
            <Link className="underline underline-offset-2" href={`/societies/${societyId}/history?category=ANNUAL_SUMMARY`}>
              History
            </Link>
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <AmountCard
          change={summary.profitChange}
          label="Total profit for the year"
          tone="profit"
          value={summary.totalProfit}
        />
        <AmountCard
          change={summary.expensesChange}
          label="Total expenses for the year"
          tone="expenses"
          value={summary.totalExpenses}
        />
        <div
          className={`flex gap-3 rounded-card border px-4 py-3.5 ${
            auditReport ? "border-line bg-surface" : "border-dashed border-[#efc4bd] bg-[#fdf6f5]"
          }`}
        >
          {auditReport && (
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-mint text-brand-forest">
              <Icon className="size-4" name="document" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] text-muted">Audit report · {financialYear.label}</p>
            {auditReport ? (
              <>
                <p className="mt-0.5 break-all text-[13px] font-bold text-ink">{auditReport.fileName}</p>
                <p className="text-[10px] text-muted">
                  Uploaded {formatDate(auditReport.uploadedAt)} by {actorLabel(auditReport.uploadedBy)}
                </p>
                <div className="mt-2 flex gap-2">
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
                    href={`/societies/${societyId}/documents/${auditReport.documentId}/download`}
                    rel="noopener"
                    target="_blank"
                  >
                    Open
                  </a>
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
                    download={auditReport.fileName}
                    href={`/societies/${societyId}/documents/${auditReport.documentId}/download`}
                  >
                    <span aria-hidden="true">↓</span> Download
                  </a>
                </div>
              </>
            ) : (
              <>
                <p className="mt-0.5 text-[17px] font-bold text-danger-text">Not uploaded</p>
                <p className="text-[10px] text-muted">No file to open yet</p>
              </>
            )}
          </div>
        </div>
      </div>

      {(missingFigures || !auditReport) && (
        <div
          className="mt-3 flex gap-2.5 rounded-card border border-[#ead9a7] bg-warn-bg px-4 py-3 text-[11px] text-warn-text"
          role="status"
        >
          <Icon className="mt-0.5 size-4 shrink-0" name="alert" />
          <div>
            <p className="font-bold">
              The {financialYear.label}{" "}
              {missingFigures && !auditReport
                ? "figures and audit report have"
                : missingFigures
                  ? "figures have"
                  : "audit report has"}{" "}
              not been added.
            </p>
            <p>
              They are entered by the society&apos;s Society Officer or its SPC
              {spc ? ` (${spc.displayName})` : ""}.
              {!hasOfficer && ` ${societyName} has no Society Officer, so the SPC is responsible.`}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function AmountCard({
  change,
  label,
  tone,
  value,
}: {
  change?: AnnualFinancialSummary["profitChange"];
  label: string;
  tone: "profit" | "expenses";
  value: number | null;
}) {
  const missing = value == null;
  const style = missing
    ? "border-dashed border-[#ead9a7] bg-[#fffdf6]"
    : tone === "profit"
      ? "border-[#bcdcc4] bg-[#f1f8f2]"
      : "border-[#ecd9a4] bg-[#fdf8ea]";
  return (
    <div className={`rounded-card border px-4 py-3.5 ${style}`}>
      <p className="text-[11px] text-muted">{label}</p>
      {missing ? (
        <>
          <p className="mt-1 text-[17px] font-bold text-[#9aa39d]">Not added yet</p>
          <p className="text-[10px] text-muted">Waiting for the Society Officer or SPC</p>
        </>
      ) : (
        <>
          <p className={`mt-1 text-[26px] font-bold tracking-[-0.02em] ${tone === "profit" ? "text-brand-pine" : "text-[#6f5300]"}`}>
            {formatLkr(value)}
          </p>
          {change && (
            <p className="text-[10px] text-muted">
              {change.previousValue != null
                ? `Was ${formatLkr(change.previousValue)} before ${formatDate(change.updatedAt)}`
                : `Entered ${formatDate(change.updatedAt)} by ${actorLabel(change.updatedBy)}`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
