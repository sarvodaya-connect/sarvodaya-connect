import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeading } from "@/components/dashboard/page-heading";
import { StatusPill } from "@/components/dashboard/status-pill";
import { districts, societies } from "@/lib/demo-registry";

export default async function DistrictPage({ params }: PageProps<"/districts/[id]">) {
  const { id } = await params;
  const district = districts.find((item) => item.nameEn.toLowerCase() === id);
  if (!district) notFound();
  const districtSocieties = societies.filter((society) => society.district.id === district.id);

  return (
    <>
      <PageHeading breadcrumbs={[{ href: "/societies", label: "Societies" }, { label: `${district.nameEn} District` }]} description="District registry summary and society records." title={`${district.nameEn} District`} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Societies", value: district.societyCount, note: "District total" }, { label: "Profile completeness", value: "81%", note: "Average across district" }, { label: "Pending updates", value: 2, note: "Awaiting review" }, { label: "Approved updates", value: 13, note: "This month" }].map((metric) => <div className="rounded-xl border border-[#dfe5dc] bg-white p-5 shadow-sm" key={metric.label}><span className="text-xs text-[#78857d]">{metric.label}</span><strong className="mt-2 block text-2xl tracking-[-0.03em] text-[#174a32]">{metric.value}</strong><span className="mt-1 block text-[11px] text-[#929c95]">{metric.note}</span></div>)}
      </div>
      <section className="mt-6 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
        <div className="flex items-center justify-between border-b border-[#e5e9e3] px-5 py-4"><div><h2 className="text-base font-semibold text-[#28382f]">Societies in {district.nameEn}</h2><p className="mt-1 text-xs text-[#7a867e]">Showing demonstration records for this district</p></div><Link className="text-xs font-semibold text-[#26744b] hover:underline" href="/societies">View national registry</Link></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#f7f8f5] text-[10px] uppercase tracking-[0.1em] text-[#738078]"><tr><th className="px-5 py-3">Society</th><th className="px-5 py-3">Completeness</th><th className="px-5 py-3">Verification</th><th className="px-5 py-3">Last updated</th><th className="px-5 py-3"><span className="sr-only">Action</span></th></tr></thead><tbody className="divide-y divide-[#edf0eb]">{districtSocieties.map((society) => <tr key={society.id}><td className="px-5 py-4"><strong className="block text-sm text-[#27372d]">{society.nameEn}</strong><span className="mt-1 block text-xs text-[#77837b]">{society.societyCode}</span></td><td className="px-5 py-4 text-sm text-[#526057]">{society.profileCompleteness}%</td><td className="px-5 py-4"><StatusPill value={society.verificationStatus} /></td><td className="px-5 py-4 text-xs text-[#66736b]">{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(society.updatedAt))}</td><td className="px-5 py-4 text-right"><Link className="inline-flex rounded-md bg-[#1f6b43] px-3 py-2 text-xs font-semibold text-white" href={`/societies/${society.id}`}>Open</Link></td></tr>)}</tbody></table></div>
      </section>
    </>
  );
}
