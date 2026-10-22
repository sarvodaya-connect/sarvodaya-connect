import { redirect } from "next/navigation";

import { CoordinatorOverview } from "@/components/dashboard/coordinator-overview";
import { DistrictOverview, NationalOverview } from "@/components/dashboard/role-overviews";
import { getCurrentViewer } from "@/lib/current-viewer";

export default async function DashboardHome() {
  const viewer = await getCurrentViewer();

  // The System Administrator has no society data; their home is platform access.
  if (viewer.role === "SYSTEM_ADMIN") redirect("/admin");

  switch (viewer.role) {
    case "HQ_ADMIN":
      return <NationalOverview />;
    case "DISTRICT_MANAGER":
      return <DistrictOverview />;
    case "PROGRAMME_COORDINATOR":
      return <CoordinatorOverview />;
  }
}
