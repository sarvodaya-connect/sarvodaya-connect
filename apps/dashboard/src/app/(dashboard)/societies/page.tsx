import Link from "next/link";

import { primaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { PageHeading } from "@/components/dashboard/page-heading";
import { SocietyDirectory } from "@/components/dashboard/society-directory";
import { LiveSocietyRecords } from "@/components/dashboard/society-record/live-society-records";
import { getCurrentViewer } from "@/lib/current-viewer";
import { loadSocietyRegistry, parseDemoScenario } from "@/lib/demo-scenarios";
import { demoSocietyAccess, societiesVisibleTo } from "@/lib/society-access";

export default async function SocietiesPage({ searchParams }: PageProps<"/societies">) {
  const [{ demo }, viewer] = await Promise.all([searchParams, getCurrentViewer()]);
  const { districts, societies: registrySocieties } = await loadSocietyRegistry(parseDemoScenario(demo));
  const societies = societiesVisibleTo(registrySocieties, demoSocietyAccess);
  const visibleDistricts = districts.filter((district) => societies.some((society) => society.district.id === district.id));

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <PageHeading
          description={`${societies.length.toLocaleString("en-GB")} societies in ${visibleDistricts.length} ${visibleDistricts.length === 1 ? "district" : "districts"}`}
          title="Societies"
        />
        <div className="flex flex-wrap gap-2">
          {societies.length > 0 && (
            <button className="inline-flex items-center gap-2 rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft" type="button">
              <span aria-hidden="true">↓</span>
              Export CSV / Excel
            </button>
          )}
          {/* V5 D05n: HQ only; the API refuses everyone else. */}
          {viewer.role === "HQ_ADMIN" && (
            <Link className={primaryButtonClass} href="/societies/new">
              <Icon className="size-4" name="personAdd" strokeWidth={2} />
              Create a society record
            </Link>
          )}
        </div>
      </div>
      <LiveSocietyRecords />
      <SocietyDirectory districts={visibleDistricts} societies={societies} />
    </>
  );
}
