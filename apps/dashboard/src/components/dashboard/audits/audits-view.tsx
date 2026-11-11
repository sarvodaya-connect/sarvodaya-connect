import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/dashboard/data-states";
import { RegistrarTotalsCards, allFourLabel, percent } from "@/components/dashboard/documents/registrar-totals";
import { YearLinks } from "@/components/dashboard/national/links";
import { Breadcrumb } from "@/components/dashboard/national/parts";
import { Pill } from "@/components/dashboard/ui/pill";
import { localeTag, type Translator } from "@/i18n/translate";

/** The D11 figures, from HQ's national endpoints or the scoped one (issue #119). */
export interface AuditFigures {
  financialYear: { startYear: number; label: string };
  activeSocieties: number;
  byType: { documentType: "AUDIT_REPORT" | "AGM_MINUTES" | "OFFICE_BEARER_LIST" | "MEMBERS_LIST"; submitted: number; missing: number }[];
  allFour: number;
  auditReportDueOn: string;
  followUp: {
    pastDue: boolean;
    data: { id: string; name: string; societyCode: string; district: string }[];
    meta: { page: number; totalItems: number; totalPages: number };
  };
}

/**
 * V5 D11 Audits & AGM. HQ shows every society; a DM, DDM or SPC shows only
 * their own (issue #119). `href` builds this page's links, so a DDM's
 * district view keeps its scope when the year or page changes.
 */
export function AuditsView({
  above,
  breadcrumb,
  demo,
  figures,
  href,
  scopeLine,
  t,
  years,
}: {
  /** Shown above the cards: the DDM's tabs. */
  above?: ReactNode;
  breadcrumb: { href: string; label: string };
  demo: boolean;
  figures: AuditFigures;
  href: (input: { year: number; page?: number }) => string;
  scopeLine?: string;
  t: Translator;
  years: number[];
}) {
  const audit = figures.byType.find((entry) => entry.documentType === "AUDIT_REPORT")!;
  const due = new Intl.DateTimeFormat(localeTag(t.locale), { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Colombo" }).format(
    new Date(`${figures.auditReportDueOn}T00:00:00+05:30`),
  );
  const fy = figures.financialYear;
  const { followUp } = figures;
  const page = followUp.meta.page;
  const status = followUp.pastDue ? t("au.pastDue") : t("au.notYet");

  return (
    <>
      <Breadcrumb current={t("au.title")} home={breadcrumb.label} />
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">{t("au.title")}</h1>
          <p className="text-[12px] text-ink-soft">{t("au.description", { year: fy.label })}</p>
          {scopeLine && <p className="text-[12px] text-ink-soft">{scopeLine}</p>}
        </div>
        <div className="flex items-center gap-2">
          <YearLinks current={fy.startYear} href={(year) => href({ year })} years={years} />
          {demo && <Pill tone="preview">{t("au.sample", { year: fy.label })}</Pill>}
        </div>
      </div>
      {above}

      {figures.activeSocieties === 0 ? (
        <div className="mt-4">
          <EmptyState description={t("au.noSocieties")} icon="society" title={t("au.noSocietiesTitle")} />
        </div>
      ) : (
        <>
          <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3">
              <span className="text-[26px] font-bold text-brand-forest">{percent(audit.submitted, figures.activeSocieties)}%</span>
              <span className="text-[12px] text-ink">
                {t.rich("au.uploadedLine", {
                  count: <strong>{t("au.xOfY", { x: audit.submitted.toLocaleString("en-GB"), y: figures.activeSocieties.toLocaleString("en-GB") })}</strong>,
                })}
              </span>
            </li>
            <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3">
              <Pill tone="verified">{t("au.uploaded")}</Pill>
              <span className="mt-2 text-[26px] font-bold text-ink">{audit.submitted.toLocaleString("en-GB")}</span>
              <span className="mt-auto text-[11px] text-muted">{t("au.onRecord")}</span>
            </li>
            <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3">
              <Pill tone={followUp.pastDue ? "overdue" : "fast-target"}>{status}</Pill>
              <span className="mt-2 text-[26px] font-bold text-ink">{audit.missing.toLocaleString("en-GB")}</span>
              <span className="mt-auto text-[11px] text-muted">{followUp.pastDue ? t("au.due", { date: due }) : t("au.dueNotPassed", { date: due })}</span>
            </li>
            <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3">
              <Pill tone="info">{t("au.allFour")}</Pill>
              <span className="mt-2 text-[26px] font-bold text-ink">{figures.allFour.toLocaleString("en-GB")}</span>
              <span className="mt-auto text-[11px] text-muted">{t("au.allFourNote")}</span>
            </li>
          </ul>

          <section aria-labelledby="completion-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("au.completion")}</p>
                <h2 className="text-[15px] font-bold text-ink" id="completion-heading">{t("au.allFourTitle")}</h2>
              </div>
              <p className="text-[12px] text-ink-soft">{allFourLabel(figures, t)}</p>
            </div>
            <div className="mt-3">
              <RegistrarTotalsCards t={t} totals={figures} />
            </div>
          </section>

          <section aria-labelledby="follow-up-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
            <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("au.followUp")}</p>
            <h2 className="text-[15px] font-bold text-ink" id="follow-up-heading">
              {followUp.pastDue ? t("au.followPast") : t("au.followNotYet")}
            </h2>
            {followUp.data.length === 0 ? (
              <div className="mt-3">
                <EmptyState description={t("au.nothing", { year: fy.label })} icon="success" title={t("au.nothingTitle")} />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-line-soft">
                <table className="w-full min-w-[640px] text-left text-[12px]">
                  <thead className="bg-[#f2f4f0] text-[11px] text-muted">
                    <tr>
                      {[t("home.society"), t("s.sNumber"), t("mb.district"), t("rq.due"), t("m.status")].map((heading) => (
                        <th className="px-3 py-2.5 font-medium" key={heading} scope="col">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {followUp.data.map((society) => (
                      <tr key={society.id}>
                        <td className="px-3 py-3">
                          <Link className="font-semibold text-brand-forest underline underline-offset-2" href={`/societies/${society.id}/documents?year=${fy.startYear}`}>
                            {society.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-ink-soft">{society.societyCode}</td>
                        <td className="px-3 py-3 text-ink-soft">{society.district}</td>
                        <td className="px-3 py-3 text-ink-soft">{due}</td>
                        <td className="px-3 py-3">
                          <Pill tone={followUp.pastDue ? "overdue" : "fast-target"}>{status}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-3 py-2.5 text-[11px] text-muted">
                  <span>{t("au.showing", { shown: followUp.data.length, total: followUp.meta.totalItems.toLocaleString("en-GB") })}</span>
                  <span className="flex gap-3">
                    {page > 1 && <Link className="font-semibold text-brand-forest underline" href={href({ year: fy.startYear, page: page - 1 })}>{t("n.previous")}</Link>}
                    <span>{t("n.pageOf", { page, totalPages: Math.max(1, followUp.meta.totalPages) })}</span>
                    {page < followUp.meta.totalPages && <Link className="font-semibold text-brand-forest underline" href={href({ year: fy.startYear, page: page + 1 })}>{t("n.next")}</Link>}
                  </span>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
