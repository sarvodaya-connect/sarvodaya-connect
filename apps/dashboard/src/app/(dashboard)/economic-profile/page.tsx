import { EconomyOverview } from "@/components/dashboard/economy/economy-overview";
import { getT } from "@/i18n/server";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getEconomyScope, getProductionRecords, getProductionSummary } from "@/lib/economy-api";
import { parseOverviewFilters, periodFor, productionQuery } from "@/lib/economy-format";
import { isDemoMode } from "@/lib/platform-api";

/**
 * Issue #147: Village Economic Profile, the production overview for HQ, DM,
 * DDM and SPC. The filters live in the address. The API works out the
 * viewer's scope on every request, so a changed or ended permission shows
 * fewer societies on the next load, and `districtId`/`societyId` can only
 * narrow it. The cards and the table use the same query, one page at a time.
 */
export default async function EconomicProfilePage({ searchParams }: PageProps<"/economic-profile">) {
  const filters = parseOverviewFilters(await searchParams);
  const query = productionQuery(filters);
  const period = periodFor(filters);
  const [viewer, t, scope, summary, records] = await Promise.all([
    getDesktopViewer(),
    getT(),
    getEconomyScope(filters.districtId),
    query ? getProductionSummary(query) : null,
    query ? getProductionRecords(query, filters.page) : null,
  ]);
  return (
    <EconomyOverview
      demo={isDemoMode()}
      filters={filters}
      periodProblem={"problem" in period ? period.problem : undefined}
      records={records}
      role={viewer.role}
      scope={scope}
      summary={summary}
      t={t}
    />
  );
}
