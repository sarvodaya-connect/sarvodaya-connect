import Link from "next/link";
import { redirect } from "next/navigation";

import { AuditsView } from "@/components/dashboard/audits/audits-view";
import { first } from "@/components/dashboard/national/format";
import { getT } from "@/i18n/server";
import { getMissingDocuments, getRegistrarTotals } from "@/lib/activities-api";
import { selectableStartYears } from "@/lib/activity-format";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getHomeAudits } from "@/lib/home-api";
import { endsLabel } from "@/lib/home-format";
import { isDemoMode } from "@/lib/platform-api";

const tabClass = (active: boolean) =>
  `-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-semibold ${active ? "border-brand-forest text-ink" : "border-transparent text-ink-soft hover:text-ink"}`;

/**
 * V5 D11 Audits & AGM: the audit report and the other annual Registrar
 * documents. HQ sees every society; a DM, DDM or SPC sees only their own
 * (issue #119). Opening a society's documents still follows each document's
 * own access rules, so the restricted members list stays closed to SPCs and DDMs.
 */
export default async function AuditsPage({ searchParams }: PageProps<"/compliance">) {
  const viewer = await getDesktopViewer();
  const t = await getT();
  const params = await searchParams;
  const year = Number(first(params.year)) || undefined;
  const page = Math.max(1, Number(first(params.page)) || 1);
  const years = selectableStartYears();

  if (viewer.role !== "HQ_ADMIN") {
    const scope = first(params.scope) === "DISTRICT" ? "DISTRICT" : undefined;
    let audits;
    try {
      audits = await getHomeAudits({ year, page, scope });
    } catch (error) {
      // A DDM whose temporary access has ended goes back to their own societies.
      if (scope !== "DISTRICT" || !(error instanceof Error) || !/ended/i.test(error.message)) throw error;
      redirect(year ? `/compliance?year=${year}` : "/compliance");
    }
    const href = ({ year: target, page: targetPage }: { year: number; page?: number }) =>
      `/compliance?year=${target}${scope ? "&scope=DISTRICT" : ""}${targetPage ? `&page=${targetPage}` : ""}`;
    const scopeLine =
      audits.scope === "DISTRICT_MANAGER"
        ? t("au.scopeDm", { district: viewer.scopeLabel })
        : audits.scope === "DISTRICT"
          ? t("au.scopeDistrict", { district: viewer.scopeLabel, date: audits.districtView?.expiresAt ? endsLabel(audits.districtView.expiresAt, t) : "" })
          : t.plural("au.scopeMine", audits.activeSocieties);
    const fy = audits.financialYear.startYear;
    return (
      <AuditsView
        above={
          audits.districtView?.available ? (
            <nav aria-label={t("ms.which")} className="mt-3 flex gap-1 border-b border-line">
              <Link aria-current={audits.scope === "MINE" ? "page" : undefined} className={tabClass(audits.scope === "MINE")} href={`/compliance?year=${fy}`}>
                {t("mb.tabMine")}
              </Link>
              <Link aria-current={audits.scope === "DISTRICT" ? "page" : undefined} className={tabClass(audits.scope === "DISTRICT")} href={`/compliance?year=${fy}&scope=DISTRICT`}>
                {t("mb.tabDistrict")}
              </Link>
            </nav>
          ) : undefined
        }
        breadcrumb={{ href: "/dashboard", label: viewer.role === "DISTRICT_MANAGER" ? t("nav.districtOverview") : t("nav.home") }}
        demo={isDemoMode()}
        figures={audits}
        href={href}
        scopeLine={scopeLine}
        t={t}
        years={years}
      />
    );
  }

  const [totals, missing] = await Promise.all([
    getRegistrarTotals(year),
    getMissingDocuments({ year, documentType: "AUDIT_REPORT", page }),
  ]);
  return (
    <AuditsView
      breadcrumb={{ href: "/dashboard", label: t("nav.nationalOverview") }}
      demo={isDemoMode()}
      figures={{ ...totals, followUp: { pastDue: Boolean(missing.pastDue), data: missing.data, meta: { ...missing.meta, page } } }}
      href={({ year: target, page: targetPage }) => `/compliance?year=${target}${targetPage ? `&page=${targetPage}` : ""}`}
      t={t}
      years={years}
    />
  );
}
