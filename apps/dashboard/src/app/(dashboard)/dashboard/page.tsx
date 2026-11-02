import { redirect } from "next/navigation";

import { RoleHome } from "@/components/dashboard/role-home/role-home";
import { NationalOverview } from "@/components/dashboard/role-overviews";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getHome } from "@/lib/home-api";

export default async function DashboardHome() {
  const viewer = await getDesktopViewer();

  // The System Administrator has no society data; their home is platform access.
  if (viewer.role === "SYSTEM_ADMIN") redirect("/admin");
  if (viewer.role === "HQ_ADMIN") return <NationalOverview />;

  // V5 SP01 (SPC), DD01 (DDM) and DM01 (DM): figures for the user's own societies.
  return <RoleHome home={await getHome()} viewer={viewer} />;
}
