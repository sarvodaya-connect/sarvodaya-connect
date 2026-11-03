import { NationalOverviewView } from "@/components/dashboard/national/national-overview";
import { first } from "@/components/dashboard/national/parts";
import { selectableStartYears } from "@/lib/activity-format";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getNationalOverview } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";

/** V5 D02 National Dashboard (HQ only; the API refuses everyone else). */
export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  await getCurrentViewer();
  const year = Number(first((await searchParams).year)) || undefined;
  const overview = await getNationalOverview(year);
  return <NationalOverviewView demo={isDemoMode()} overview={overview} years={selectableStartYears()} />;
}
