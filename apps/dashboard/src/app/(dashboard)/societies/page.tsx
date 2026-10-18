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
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <PageHeading description="The national registry of village societies. Search, filter and open a society record." title="Societies" />
        {societies.length > 0 && (
          <div className="rounded-xl border border-[#dce5db] bg-white px-5 py-3 shadow-sm"><span className="text-xs text-[#77837b]">Societies in scope</span><strong className="ml-3 text-xl text-[#174a32]">{societies.length.toLocaleString("en-GB")}</strong></div>
        )}
      </div>
      <SocietyDirectory districts={visibleDistricts} societies={societies} />
    </>
  );
}
