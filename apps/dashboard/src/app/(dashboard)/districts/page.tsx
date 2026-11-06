import Link from "next/link";

import { EmptyState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { Breadcrumb, GradeLine, PageTitle, SampleBadge } from "@/components/dashboard/national/parts";
import { YearLinks } from "@/components/dashboard/national/links";
import { GRADE_STYLE, count, first, share } from "@/components/dashboard/national/format";
import { Pill } from "@/components/dashboard/ui/pill";
import { getT } from "@/i18n/server";
import { selectableStartYears } from "@/lib/activity-format";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getDistrictSummaries } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";

/** Audit tone: 85% or more on track, 70% or more needs attention, below that behind. */
function auditTone(percent: number) {
  return percent >= 85 ? "on-time" : percent >= 70 ? "fast-target" : "overdue";
}

/** V5 D03b District view (HQ only): one card per district, alphabetical, never ranked. */
export default async function DistrictsPage({ searchParams }: PageProps<"/districts">) {
  await getCurrentViewer();
  const t = await getT();
  const params = await searchParams;
  const year = Number(first(params.year)) || undefined;
  const search = (first(params.q) ?? "").trim();
  const province = first(params.province) ?? "";
  const summaries = await getDistrictSummaries(year);
  const provinces = [...new Set(summaries.data.map((row) => row.province).filter((value): value is string => Boolean(value)))].sort();
  const shown = summaries.data.filter(
    (row) => (!search || row.name.toLowerCase().includes(search.toLowerCase())) && (!province || row.province === province),
  );
  const { totals, financialYear } = summaries;

  return (
    <>
      <Breadcrumb current={t("nav.districtView")} />
      <PageTitle
        actions={
          <form className="flex flex-wrap items-center gap-2" method="get" role="search">
            <input name="year" type="hidden" value={financialYear.startYear} />
            <label className="sr-only" htmlFor="district-search">{t("d.find")}</label>
            <input className="w-48 rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={search} id="district-search" name="q" placeholder={t("d.find")} />
            <label className="sr-only" htmlFor="district-province">{t("d.province")}</label>
            <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={province} id="district-province" name="province">
              <option value="">{t("d.allProvinces")}</option>
              {provinces.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <button className={secondaryButtonClass} type="submit">{t("d.findButton")}</button>
            <Link className={secondaryButtonClass} href="/map"><Icon className="size-4" name="map" />{t("d.showOnMap")}</Link>
          </form>
        }
        description={t("d.description", { count: summaries.data.length })}
        title={t("nav.districtView")}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <YearLinks current={financialYear.startYear} href={(value) => `/districts?year=${value}`} years={selectableStartYears()} />
        <SampleBadge demo={isDemoMode()} label={t("n.demoYear", { year: financialYear.label })} />
      </div>

      <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3">
          <span className="text-[11px] text-muted">{t("d.activeSocieties")}</span>
          <strong className="text-[24px] text-ink">{count(totals.active)}</strong>
          <span className="mt-auto text-[11px] text-muted">{t("d.districts", { count: summaries.data.length })}</span>
        </li>
        {(["A", "B", "C"] as const).map((grade) => (
          <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3" key={grade}>
            <span className="text-[11px] text-muted">{t(`grade.${grade}`)}</span>
            <strong className={`text-[24px] ${GRADE_STYLE[grade].text}`}>{count(totals.grades[grade])}</strong>
            <span className="mt-auto text-[11px] text-muted">{share(totals.grades[grade], totals.active)}%</span>
          </li>
        ))}
        <li className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-3">
          <span className="text-[11px] text-muted">{t("d.recordsComplete")}</span>
          <strong className="text-[24px] text-ink">{totals.recordsCompletePercent}%</strong>
          <span className="mt-auto text-[11px] text-muted">{t("d.nationalAverage")}</span>
        </li>
      </ul>

      {shown.length === 0 ? (
        <div className="mt-4">
          <EmptyState description={t("d.noMatch")} icon="search" title={t("d.noMatchTitle")} />
        </div>
      ) : (
        <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shown.map((district) => (
            <li key={district.id}>
              <Link
                aria-label={t("n.districtActive", { name: district.name, count: district.active })}
                className="flex h-full flex-col rounded-card border border-line bg-surface p-4 hover:border-brand-forest focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0]"
                href={`/societies?districtId=${district.id}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span>
                    <strong className="block text-[14px] text-ink">{district.name}</strong>
                    <span className="text-[11px] text-muted">{district.province ?? t("d.noProvince")}</span>
                  </span>
                  <Pill tone={auditTone(district.auditPercent)}>{t("d.audit", { percent: district.auditPercent })}</Pill>
                </span>
                <span className="mt-3 grid grid-cols-3 gap-2">
                  <span><strong className="block text-[18px] text-ink">{count(district.active)}</strong><span className="text-[10px] text-muted">{t("d.active")}</span></span>
                  <span><strong className="block text-[18px] text-ink">{count(district.members)}</strong><span className="text-[10px] text-muted">{t("nav.membersShort")}</span></span>
                  <span><strong className="block text-[18px] text-ink">{district.recordsCompletePercent}%</strong><span className="text-[10px] text-muted">{t("d.recordsComplete")}</span></span>
                </span>
                <span className="mt-auto pt-3"><GradeLine grades={district.grades} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted">{t("d.footer", { year: financialYear.label })}</p>
    </>
  );
}
