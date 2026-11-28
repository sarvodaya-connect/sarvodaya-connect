import Link from "next/link";

import type { AnnualFinancialSummary, SocietyStaffMember } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";
import { ENGLISH } from "@/i18n/english";
import { actorName, recordDate } from "@/i18n/society-record";
import { localeTag, type Translator } from "@/i18n/translate";

/**
 * D05 / D05m: the year's two totals and the audit report lead the society
 * record. Two yearly totals only — no transactions, loans, savings or accounts.
 */
export function AnnualSummaryCards({
  societyId,
  societyName,
  staff,
  summary,
  t = ENGLISH,
}: {
  societyId: string;
  societyName: string;
  staff: SocietyStaffMember[];
  summary: AnnualFinancialSummary;
  t?: Translator;
}) {
  const { financialYear, auditReport } = summary;
  const missingFigures = summary.totalProfit == null || summary.totalExpenses == null;
  const lastChange = [summary.profitChange, summary.expensesChange]
    .filter((change) => change != null)
    .sort((a, b) => b!.updatedAt.localeCompare(a!.updatedAt))[0];
  const spc = staff.find((member) => member.role === "PROGRAMME_COORDINATOR");
  const hasOfficer = staff.some((member) => member.role === "SOCIETY_OFFICER");
  const yearRange = `${recordDate(t, `${financialYear.startsOn}T00:00:00+05:30`)} – ${recordDate(t, `${financialYear.endsOn}T00:00:00+05:30`)}`;

  return (
    <section aria-labelledby="annual-summary-heading" className="mt-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-bold tracking-[0.12em] text-ink-soft" id="annual-summary-heading">
          {t("rd.annualTitle", { year: financialYear.label, range: yearRange })}
        </h3>
        {lastChange && (
          <p className="text-[10px] text-muted">
            {t("rd.updated", { date: recordDate(t, lastChange.updatedAt), actor: actorName(t, lastChange.updatedBy) })} ·{" "}
            <Link className="underline underline-offset-2" href={`/societies/${societyId}/history?category=ANNUAL_SUMMARY`}>
              {t("rd.history")}
            </Link>
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <AmountCard
          change={summary.profitChange}
          label={t("rd.profit")}
          t={t}
          tone="profit"
          value={summary.totalProfit}
        />
        <AmountCard
          change={summary.expensesChange}
          label={t("rd.expenses")}
          t={t}
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
            <p className="text-[11px] text-muted">{t("rd.auditYear", { year: financialYear.label })}</p>
            {auditReport ? (
              <>
                <p className="mt-0.5 break-all text-[13px] font-bold text-ink">{auditReport.fileName}</p>
                <p className="text-[10px] text-muted">
                  {t("rd.uploadedBy", { date: recordDate(t, auditReport.uploadedAt), actor: actorName(t, auditReport.uploadedBy) })}
                </p>
                <div className="mt-2 flex gap-2">
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
                    href={`/societies/${societyId}/documents/${auditReport.documentId}/download`}
                    rel="noopener"
                    target="_blank"
                  >
                    {t("rd.open")}
                  </a>
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
                    download={auditReport.fileName}
                    href={`/societies/${societyId}/documents/${auditReport.documentId}/download`}
                  >
                    <span aria-hidden="true">↓</span> {t("rd.download")}
                  </a>
                </div>
              </>
            ) : (
              <>
                <p className="mt-0.5 text-[17px] font-bold text-danger-text">{t("rd.notUploaded")}</p>
                <p className="text-[10px] text-muted">{t("rd.noFile")}</p>
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
              {t(missingFigures && !auditReport ? "rd.missingBoth" : missingFigures ? "rd.missingFigures" : "rd.missingAudit", { year: financialYear.label })}
            </p>
            <p>
              {spc ? t("rd.responsibleNamed", { name: spc.displayName }) : t("rd.responsible")}
              {!hasOfficer && <> {t("rd.noOfficer", { society: societyName })}</>}
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
  t,
  value,
}: {
  change?: AnnualFinancialSummary["profitChange"];
  label: string;
  tone: "profit" | "expenses";
  t: Translator;
  value: number | null;
}) {
  const amount = (value: number) => `LKR ${value.toLocaleString(localeTag(t.locale), { maximumFractionDigits: 2 })}`;
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
          <p className="mt-1 text-[17px] font-bold text-[#9aa39d]">{t("rd.notAdded")}</p>
          <p className="text-[10px] text-muted">{t("rd.waiting")}</p>
        </>
      ) : (
        <>
          <p className={`mt-1 text-[26px] font-bold tracking-[-0.02em] ${tone === "profit" ? "text-brand-pine" : "text-[#6f5300]"}`}>
            {amount(value)}
          </p>
          {change && (
            <p className="text-[10px] text-muted">
              {change.previousValue != null
                ? t("rd.previousAmount", { amount: amount(change.previousValue), date: recordDate(t, change.updatedAt) })
                : t("rd.enteredBy", { date: recordDate(t, change.updatedAt), actor: actorName(t, change.updatedBy) })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
