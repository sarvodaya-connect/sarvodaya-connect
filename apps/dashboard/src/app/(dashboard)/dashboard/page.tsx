import { redirect } from "next/navigation";

import { DistrictOverview, NationalOverview } from "@/components/dashboard/role-overviews";
import { getCurrentViewer } from "@/lib/current-viewer";

export default async function DashboardHome() {
  const viewer = await getCurrentViewer();

  // The System Administrator has no society data; their home is platform access.
  if (viewer.role === "SYSTEM_ADMIN") redirect("/admin");

  return viewer.role === "HQ_ADMIN" ? <NationalOverview /> : <DistrictOverview />;
}
