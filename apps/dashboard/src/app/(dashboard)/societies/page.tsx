import type { DistrictSummary, PaginatedResponse, SocietySummary } from "@sarvodaya-connect/api-contracts";
import { PageHeading } from "@/components/dashboard/page-heading";
import { SocietyDirectory } from "@/components/dashboard/society-directory";
import { AccessDeniedState } from "@/components/dashboard/data-states";
import { getCurrentViewer } from "@/lib/current-viewer";
import { loadApiJson } from "@/lib/api-proxy";

export default async function SocietiesPage() {
  const viewer = await getCurrentViewer();
  if (viewer.role === "SYSTEM_ADMIN") return <AccessDeniedState role={viewer.roleLabel} />;
  try {
    const [result, districtResult] = await Promise.all([
      loadApiJson<PaginatedResponse<SocietySummary>>("/societies?page=1&pageSize=100", viewer),
      loadApiJson<{ data: DistrictSummary[] }>("/districts", viewer),
    ]);
    return <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <PageHeading description={`${result.meta.totalItems.toLocaleString("en-GB")} societies across the districts available to your role`} title="Societies" />
      </div>
      <SocietyDirectory districts={districtResult.data} societies={result.data} initialTotal={result.meta.totalItems} />
    </>;
  } catch {
    return <section className="rounded-card border border-line bg-surface p-8 text-center" role="alert"><h2 className="text-base font-semibold">Societies couldn&apos;t be loaded</h2><p className="mt-2 text-sm text-muted">The society registry service is unavailable. Your access and records were not changed.</p><a className="mt-4 inline-block text-sm font-semibold text-[#2d5c88] underline" href="/societies">Try again</a></section>;
  }
}
