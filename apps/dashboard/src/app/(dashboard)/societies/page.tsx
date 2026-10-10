import { PageHeading } from "@/components/dashboard/page-heading";
import { SocietyDirectory } from "@/components/dashboard/society-directory";
import { districts, societies } from "@/lib/demo-registry";

export default function SocietiesPage() {
  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <PageHeading description="The national registry of village societies. Search, filter and open a society record." title="Societies" />
        <div className="rounded-xl border border-[#dce5db] bg-white px-5 py-3 shadow-sm"><span className="text-xs text-[#77837b]">Societies in scope</span><strong className="ml-3 text-xl text-[#174a32]">1,214</strong></div>
      </div>
      <SocietyDirectory districts={districts} societies={societies} />
    </>
  );
}
