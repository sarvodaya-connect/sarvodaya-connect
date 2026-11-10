import Link from "next/link";

import { secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { first } from "@/components/dashboard/national/format";
import { ReportTableView } from "@/components/dashboard/national/report-table";
import { Pill } from "@/components/dashboard/ui/pill";
import { getT } from "@/i18n/server";
import { selectableStartYears } from "@/lib/activity-format";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getDistrictOptions, getReport } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";
import { REPORTS, isReportType } from "@/lib/reports";

const PREVIEW_ROWS = 8;

/** V5 D15 Reports (HQ only): standard reports from approved records, ready to print or download. */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await getCurrentViewer();
  const t = await getT();
  const params = await searchParams;
  const type = first(params.type);
  const year = Number(first(params.year)) || undefined;
  const districtId = first(params.districtId) || undefined;
  const [districts, report] = await Promise.all([
    getDistrictOptions(),
    isReportType(type) ? getReport(type, { year, districtId }) : Promise.resolve(null),
  ]);
  const scope = new URLSearchParams({ ...(year ? { year: String(year) } : {}), ...(districtId ? { districtId } : {}) });
  const withScope = (path: string, extra: Record<string, string> = {}) => {
    const search = new URLSearchParams(scope);
    for (const [key, value] of Object.entries(extra)) search.set(key, value);
    const text = search.toString();
    return text ? `${path}?${text}` : path;
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">{t("nav.reports")}</h1>
          <p className="text-[12px] text-ink-soft">{t("r.description")}</p>
        </div>
        <form className="flex flex-wrap items-center gap-2" method="get">
          {type && <input name="type" type="hidden" value={type} />}
          <label className="sr-only" htmlFor="report-scope">{t("r.scope")}</label>
          <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={districtId ?? ""} id="report-scope" name="districtId">
            <option value="">{t("scope.national")}</option>
            {districts.map((district) => <option key={district.id} value={district.id}>{district.nameEn}</option>)}
          </select>
          <label className="sr-only" htmlFor="report-year">{t("r.financialYear")}</label>
          <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={year ?? ""} id="report-year" name="year">
            {selectableStartYears().map((start, index) => (
              <option key={start} value={index === 0 ? "" : start}>FY {start}/{String((start + 1) % 100).padStart(2, "0")}</option>
            ))}
          </select>
          <button className={secondaryButtonClass} type="submit">{t("r.apply")}</button>
        </form>
      </div>

      <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((item) => (
          <li className={`flex h-full flex-col rounded-card border bg-surface p-4 ${item.type === type ? "border-brand-forest" : "border-line"}`} key={item.type}>
            <span className="flex items-start gap-2">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef3ee] text-brand-forest"><Icon className="size-4" name="document" /></span>
              <span>
                <strong className="block text-[13px] text-ink">{t(`report.${item.type}.title`)}</strong>
                <span className="text-[11px] text-muted">{t(`report.${item.type}.description`)}</span>
              </span>
            </span>
            <Link aria-current={item.type === type ? "true" : undefined} className={`${secondaryButtonClass} mt-auto justify-center`} href={withScope("/reports", { type: item.type })}>
              {t("r.generate")}
            </Link>
          </li>
        ))}
      </ul>

      {report && (
        <section aria-labelledby="report-preview" className="mt-4 rounded-card border border-line bg-surface p-4">
          <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("r.preview")}</p>
          <h2 className="text-[15px] font-bold text-ink" id="report-preview">{report.title} · {report.scope} · {report.financialYear.label}</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-line-soft">
            <ReportTableView limit={PREVIEW_ROWS} report={report} />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
            <span>{t("r.rows", { shown: Math.min(PREVIEW_ROWS, report.rows.length), total: report.rows.length })}</span>
            {isDemoMode() && <Pill tone="preview">{t("n.demoData")}</Pill>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className={secondaryButtonClass} href={withScope(`/reports/${report.type}`)} target="_blank"><Icon className="size-4" name="document" />{t("r.pdf")}</Link>
            <a className={secondaryButtonClass} href={withScope(`/reports/${report.type}/download`)}><Icon className="size-4" name="document" />{t("r.csv")}</a>
          </div>
        </section>
      )}
      <p className="mt-4 text-[11px] text-muted">
        {t("r.situation")} <Link className="font-semibold text-brand-forest underline" href="/emergencies">{t("r.openEmergency")}</Link>
      </p>
    </>
  );
}
