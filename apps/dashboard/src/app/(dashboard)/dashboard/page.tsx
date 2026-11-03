import { redirect } from "next/navigation";

import { OpenIncidentPanel } from "@/components/dashboard/emergencies/open-incident-panel";
import { RoleHome } from "@/components/dashboard/role-home/role-home";
import { NationalOverview } from "@/components/dashboard/role-overviews";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getHome } from "@/lib/home-api";

export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const viewer = await getDesktopViewer();

  // The System Administrator has no society data; their home is platform access.
  if (viewer.role === "SYSTEM_ADMIN") redirect("/admin");
  if (viewer.role === "HQ_ADMIN") return <NationalOverview />;

  // V5 SP01 (SPC), DD01 (DDM) and DM01 (DM): figures for the user's own societies.
  // IR02 "Report an incident" opens over the home as `?report=incident`.
  const { report } = await searchParams;
  return (
    <>
      <RoleHome home={await getHome()} viewer={viewer} />
      {report === "incident" && <OpenIncidentPanel closeHref="/dashboard" viewer={viewer} />}
    </>
  );
}
