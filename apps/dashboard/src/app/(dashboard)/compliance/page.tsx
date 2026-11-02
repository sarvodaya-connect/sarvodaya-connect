import Link from "next/link";

import { RegistrarTotalsCards, allFourLabel, percent } from "@/components/dashboard/documents/registrar-totals";
import { EmptyState } from "@/components/dashboard/data-states";
import { Pill } from "@/components/dashboard/ui/pill";
import { getMissingDocuments, getRegistrarTotals } from "@/lib/activities-api";
import { selectableStartYears } from "@/lib/activity-format";
import { getCurrentViewer } from "@/lib/current-viewer";
import { isDemoMode } from "@/lib/platform-api";
import { formatDate } from "@/lib/society-record-format";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** V5 D11 Audits & AGM (HQ only): the audit report and the other annual Registrar documents. */
export default async function AuditsPage({ searchParams }: PageProps<"/compliance">) {
  await getCurrentViewer();
  const params = await searchParams;
  const year = Number(first(params.year)) || undefined;
  const page = Math.max(1, Number(first(params.page)) || 1);
  const [totals, missing] = await Promise.all([
    getRegistrarTotals(year),
    getMissingDocuments({ year, documentType: "AUDIT_REPORT", page }),
  ]);
  const audit = totals.byType.find((entry) => entry.documentType === "AUDIT_REPORT")!;
  const due = formatDate(`${totals.auditReportDueOn}T00:00:00+05:30`);
  const fy = totals.financialYear;
  const startYears = selectableStartYears();

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-[11px] text-ink-soft">
        <Link className="text-[#2d5c88] underline underline-offset-2" href="/dashboard">National overview</Link>
        <span aria-hidden> › </span>
        <span aria-current="page">Audits &amp; AGM</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">Audits &amp; AGM</h1>
          <p className="text-[12px] text-ink-soft">{fy.label} · audit report and the other annual documents to the Registrar</p>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Financial year" className="flex flex-wrap gap-1.5">
            {startYears.map((startYear) => (
              <Link
                aria-current={startYear === fy.startYear ? "true" : undefined}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  startYear === fy.startYear ? "border-brand-forest bg-brand-forest text-white" : "border-line bg-surface text-ink-soft"
                }`}
                href={`/compliance?year=${startYear}`}
                key={startYear}
              >
                FY {startYear}/{String((startYear + 1) % 100).padStart(2, "0")}
              </Link>
            ))}
          </nav>
          {isDemoMode() && <Pill tone="preview">Sample data · {fy.label}</Pill>}
        </div>
      </div>

      <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3">
          <span className="text-[26px] font-bold text-brand-forest">{percent(audit.submitted, totals.activeSocieties)}%</span>
          <span className="text-[12px] text-ink">
            <strong>{audit.submitted.toLocaleString("en-GB")} of {totals.activeSocieties.toLocaleString("en-GB")}</strong> active
            societies have uploaded an audit report, certified by an auditor registered under the Companies Act.
          </span>
        </li>
        <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3">
          <Pill tone="verified">Uploaded</Pill>
          <span className="mt-2 text-[26px] font-bold text-ink">{audit.submitted.toLocaleString("en-GB")}</span>
          <span className="mt-auto text-[11px] text-muted">Audit report on the society record</span>
        </li>
        <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3">
          <Pill tone={missing.pastDue ? "overdue" : "fast-target"}>{missing.pastDue ? "Past due date" : "Not uploaded yet"}</Pill>
          <span className="mt-2 text-[26px] font-bold text-ink">{audit.missing.toLocaleString("en-GB")}</span>
          <span className="mt-auto text-[11px] text-muted">{missing.pastDue ? `Due ${due}` : `Due date ${due} not passed`}</span>
        </li>
        <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3">
          <Pill tone="info">All four documents</Pill>
          <span className="mt-2 text-[26px] font-bold text-ink">{totals.allFour.toLocaleString("en-GB")}</span>
          <span className="mt-auto text-[11px] text-muted">Audit report, AGM minutes, office-bearer and members lists</span>
        </li>
      </ul>

      <section aria-labelledby="completion-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest">Audit &amp; AGM completion</p>
            <h2 className="text-[15px] font-bold text-ink" id="completion-heading">All 4 Registrar documents</h2>
          </div>
          <p className="text-[12px] text-ink-soft">{allFourLabel(totals)}</p>
        </div>
        <div className="mt-3">
          <RegistrarTotalsCards totals={totals} />
        </div>
      </section>

      <section aria-labelledby="follow-up-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest">Needs follow-up</p>
        <h2 className="text-[15px] font-bold text-ink" id="follow-up-heading">
          {missing.pastDue ? "Audit report past the due date" : "Audit report not uploaded yet"}
        </h2>
        {missing.data.length === 0 ? (
          <div className="mt-3">
            <EmptyState description={`Every active society has uploaded its ${fy.label} audit report.`} icon="success" title="Nothing to follow up" />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-line-soft">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead className="bg-[#f2f4f0] text-[11px] text-muted">
                <tr>
                  {["Society", "S number", "District", "Due", "Status"].map((heading) => (
                    <th className="px-3 py-2.5 font-medium" key={heading} scope="col">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {missing.data.map((society) => (
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
                      <Pill tone={missing.pastDue ? "overdue" : "fast-target"}>{missing.pastDue ? "Past due date" : "Not uploaded yet"}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-3 py-2.5 text-[11px] text-muted">
              <span>
                Showing {missing.data.length} of {missing.meta.totalItems.toLocaleString("en-GB")} · the Society Officer or SPC uploads the audit report
              </span>
              <span className="flex gap-3">
                {page > 1 && <Link className="font-semibold text-brand-forest underline" href={`/compliance?year=${fy.startYear}&page=${page - 1}`}>Previous</Link>}
                <span>Page {page} of {Math.max(1, missing.meta.totalPages)}</span>
                {page < missing.meta.totalPages && <Link className="font-semibold text-brand-forest underline" href={`/compliance?year=${fy.startYear}&page=${page + 1}`}>Next</Link>}
              </span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
