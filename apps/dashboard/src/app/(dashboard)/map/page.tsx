import Link from "next/link";

import { SocietyMapView } from "@/components/dashboard/national/society-map";
import { Breadcrumb, PageTitle } from "@/components/dashboard/national/parts";
import { first } from "@/components/dashboard/national/format";
import { secondaryButtonClass } from "@/components/dashboard/data-states";
import { getT } from "@/i18n/server";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getSocietyMap } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";

/** V5 D03 Map view (HQ only): every society with a recorded position, coloured by class. */
export default async function MapPage({ searchParams }: PageProps<"/map">) {
  await getCurrentViewer();
  const t = await getT();
  const STATUS = [
    { value: "", label: t("m.statusActive") },
    { value: "ALL", label: t("m.statusAll") },
  ];
  const GRADES = [
    { value: "", label: t("m.classAll") },
    ...(["A", "B", "C"] as const).map((value) => ({ value, label: t("m.classOf", { grade: value }) })),
  ];
  const params = await searchParams;
  const status = first(params.status) === "ALL" ? "ALL" : "";
  const grade = ["A", "B", "C"].includes(first(params.grade) ?? "") ? first(params.grade)! : "";
  const map = await getSocietyMap({ status: status || undefined, grade: grade || undefined });

  return (
    <>
      <Breadcrumb current={t("nav.mapView")} />
      <PageTitle
        actions={
          <form className="flex flex-wrap items-center gap-2" method="get">
            <label className="sr-only" htmlFor="map-status">{t("m.status")}</label>
            <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={status} id="map-status" name="status">
              {STATUS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="map-grade">{t("m.class")}</label>
            <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={grade} id="map-grade" name="grade">
              {GRADES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button className={secondaryButtonClass} type="submit">{t("m.show")}</button>
            <Link className={secondaryButtonClass} href="/districts">{t("m.districtView")}</Link>
          </form>
        }
        description={t("m.description")}
        title={t("nav.mapView")}
      />
      <div className="mt-4">
        <SocietyMapView counts={map.counts} demo={isDemoMode()} points={map.points} />
      </div>
    </>
  );
}
