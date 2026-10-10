import { notFound } from "next/navigation";

import { PageHeading } from "@/components/dashboard/page-heading";
import { SocietyProfileTabs } from "@/components/dashboard/society-profile-tabs";
import { StatusPill } from "@/components/dashboard/status-pill";
import { getSociety, societyDetails } from "@/lib/demo-registry";

export function generateStaticParams() {
  return societyDetails.map((society) => ({ id: society.id }));
}

export default async function SocietyPage({ params }: PageProps<"/societies/[id]">) {
  const { id } = await params;
  const society = getSociety(id);
  if (!society) notFound();

  return (
    <>
      <PageHeading breadcrumbs={[{ href: "/societies", label: "Societies" }, { href: `/districts/${society.district.nameEn.toLowerCase()}`, label: society.district.nameEn }, { label: society.societyCode }]} title="Society profile" />
      <section className="my-6 rounded-xl border border-[#dfe5dc] bg-white p-5 shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-[-0.025em] text-[#213128]">{society.nameEn}</h2><StatusPill value={society.verificationStatus} /></div><p className="mt-1 text-xs text-[#748078]">{society.societyCode} · {society.district.nameEn} District</p></div>
          <div className="flex items-center gap-4 rounded-lg bg-[#f2f6ef] px-4 py-3"><div className="grid size-11 place-items-center rounded-full border-[5px] border-[#5b956a] bg-white text-xs font-bold text-[#1e5837]">{society.profileCompleteness}%</div><span><span className="block text-xs text-[#7a867e]">Profile completeness</span><strong className="text-sm text-[#34443a]">Registry ready</strong></span></div>
        </div>
        <div className="mt-4 rounded-lg border border-[#cfe3d2] bg-[#edf7ee] px-4 py-3 text-xs font-medium text-[#27613d]">✓ Latest approved change: committee update recorded on 12 Nov 2026.</div>
      </section>
      <SocietyProfileTabs society={society} />
    </>
  );
}
