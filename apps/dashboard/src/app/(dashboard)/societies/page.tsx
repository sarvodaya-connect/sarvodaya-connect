import { PageHeading } from "@/components/dashboard/page-heading";
import { SocietyDirectory } from "@/components/dashboard/society-directory";
import { loadSocietyRegistry, parseDemoScenario } from "@/lib/demo-scenarios";
import { demoSocietyAccess, societiesVisibleTo } from "@/lib/society-access";

export default async function SocietiesPage({ searchParams }: PageProps<"/societies">) {
  const { demo } = await searchParams;
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
        {societies.length > 0 && (
          <button className="inline-flex items-center gap-2 rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft" type="button">
            <span aria-hidden="true">↓</span>
            Export CSV / Excel
          </button>
        )}
      </div>
      <SocietyDirectory districts={visibleDistricts} societies={societies} />
    </>
  );
}
