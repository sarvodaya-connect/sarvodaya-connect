import Link from "next/link";

import { SocietyMapView } from "@/components/dashboard/national/society-map";
import { Breadcrumb, PageTitle, first } from "@/components/dashboard/national/parts";
import { secondaryButtonClass } from "@/components/dashboard/data-states";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getSocietyMap } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";

const STATUS = [
  { value: "", label: "Status: Active" },
  { value: "ALL", label: "Status: All" },
];
const GRADES = [
  { value: "", label: "Class: All" },
  { value: "A", label: "Class: A" },
  { value: "B", label: "Class: B" },
  { value: "C", label: "Class: C" },
];

/** V5 D03 Map view (HQ only): every society with a recorded position, coloured by class. */
export default async function MapPage({ searchParams }: PageProps<"/map">) {
  await getCurrentViewer();
  const params = await searchParams;
  const status = first(params.status) === "ALL" ? "ALL" : "";
  const grade = ["A", "B", "C"].includes(first(params.grade) ?? "") ? first(params.grade)! : "";
  const map = await getSocietyMap({ status: status || undefined, grade: grade || undefined });

  return (
    <>
      <Breadcrumb current="Map view" />
      <PageTitle
        actions={
          <form className="flex flex-wrap items-center gap-2" method="get">
            <label className="sr-only" htmlFor="map-status">Status</label>
            <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={status} id="map-status" name="status">
              {STATUS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="map-grade">Class</label>
            <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={grade} id="map-grade" name="grade">
              {GRADES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button className={secondaryButtonClass} type="submit">Show</button>
            <Link className={secondaryButtonClass} href="/districts">District view</Link>
          </form>
        }
        description="Every active society, coloured by class A, B or C · click a dot to see its summary"
        title="Map view"
      />
      <div className="mt-4">
        <SocietyMapView counts={map.counts} demo={isDemoMode()} points={map.points} />
      </div>
    </>
  );
}
