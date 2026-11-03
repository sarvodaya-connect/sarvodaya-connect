import { redirect } from "next/navigation";

import { OpenIncidentPanel } from "@/components/dashboard/emergencies/open-incident-panel";
import { NationalOverviewView } from "@/components/dashboard/national/national-overview";
import { first } from "@/components/dashboard/national/parts";
import { RoleHome } from "@/components/dashboard/role-home/role-home";
import { selectableStartYears } from "@/lib/activity-format";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getHome } from "@/lib/home-api";
import { getNationalOverview } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";

export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const viewer = await getDesktopViewer();
  const params = await searchParams;

  // The System Administrator has no society data; their home is platform access.
  if (viewer.role === "SYSTEM_ADMIN") redirect("/admin");

  // V5 D02 National Dashboard (HQ only; the API refuses everyone else).
  if (viewer.role === "HQ_ADMIN") {
    const year = Number(first(params.year)) || undefined;
    const overview = await getNationalOverview(year);
    return <NationalOverviewView demo={isDemoMode()} overview={overview} years={selectableStartYears()} />;
  }

  // V5 SP01 (SPC), DD01 (DDM) and DM01 (DM): figures for the user's own societies.
  // IR02 "Report an incident" opens over the home as `?report=incident`.
  return (
    <>
      <RoleHome home={await getHome()} viewer={viewer} />
      {params.report === "incident" && <OpenIncidentPanel closeHref="/dashboard" viewer={viewer} />}
    </>
  );
}
