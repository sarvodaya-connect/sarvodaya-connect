import { notFound } from "next/navigation";

import { PageHeading } from "@/components/dashboard/page-heading";
import { SocietyProfileTabs } from "@/components/dashboard/society-profile-tabs";
import { StatusPill } from "@/components/dashboard/status-pill";
import { getMissingProfileInformation, societyDetails } from "@/lib/demo-registry";
import { demoSocietyAccess, societiesVisibleTo } from "@/lib/society-access";

export function generateStaticParams() {
  return societyDetails.map((society) => ({ id: society.id }));
}

export default async function SocietyPage({ params }: PageProps<"/societies/[id]">) {
  const { id } = await params;
  const society = societiesVisibleTo(societyDetails, demoSocietyAccess).find((item) => item.id === id);
  if (!society) notFound();
  const missingInformation = getMissingProfileInformation(society);

  return (
    <>
      <PageHeading breadcrumbs={[{ href: "/societies", label: "Societies" }, { href: `/districts/${society.district.nameEn.toLowerCase()}`, label: society.district.nameEn }, { label: society.societyCode }]} title="Society profile" />
      <section className="my-6 rounded-xl border border-[#dfe5dc] bg-white p-5 shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-[-0.025em] text-[#213128]">{society.nameEn}</h2><StatusPill value={society.verificationStatus} /></div><p className="mt-1 text-xs text-[#748078]">{society.societyCode} · {society.district.nameEn} District</p></div>
          <div className="flex items-center gap-4 rounded-lg bg-[#f2f6ef] px-4 py-3"><div aria-label={`${society.profileCompleteness}% complete`} className="grid size-11 place-items-center rounded-full border-[5px] border-[#5b956a] bg-white text-xs font-bold text-[#1e5837]">{society.profileCompleteness}%</div><span><span className="block text-xs text-[#7a867e]">Profile completeness</span><strong className="text-sm text-[#34443a]">{missingInformation.length === 0 ? "Registry ready" : `${missingInformation.length} items to complete`}</strong></span></div>
        </div>
        <div className="mt-4 rounded-lg border border-[#cfe3d2] bg-[#edf7ee] px-4 py-3 text-xs font-medium text-[#27613d]">✓ Latest approved change: committee update recorded on 12 Nov 2026.</div>
      </section>
      {missingInformation.length > 0 && (
        <section aria-label="Missing profile information" className="mb-6 rounded-xl border border-[#ead9a7] bg-[#fff9e9] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#624d12]">Important information missing</h2>
          <p className="mt-1 text-xs text-[#755f22]">Complete these profile fields to improve the registry record.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {missingInformation.map((item) => <li className="rounded-full border border-[#e7d69f] bg-white/70 px-3 py-1 text-xs text-[#66541e]" key={item}>{item}</li>)}
          </ul>
        </section>
      )}
      <SocietyProfileTabs society={society} />
    </>
  );
}
