import { redirect } from "next/navigation";

import { DistrictOverview, NationalOverview } from "@/components/dashboard/role-overviews";
import { getCurrentViewer } from "@/lib/current-viewer";

export default async function DashboardHome() {
  const viewer = await getCurrentViewer();

  // The System Administrator has no society data; their home is platform access.
  if (viewer.role === "SYSTEM_ADMIN") redirect("/admin");

  // The v4 desktop workspace is for HQ; district users open their scoped,
  // read-only society directory instead of the retired desktop review home.
  if (viewer.role === "DISTRICT_MANAGER") redirect("/societies");

  // Programme Coordinators are limited to assigned societies; do not send them
  // to the district overview, which contains district-wide figures and actions.
  if (viewer.role === "PROGRAMME_COORDINATOR") redirect("/societies");

  return viewer.role === "HQ_ADMIN" ? <NationalOverview /> : <DistrictOverview />;
}
