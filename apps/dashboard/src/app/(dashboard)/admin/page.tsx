import { NoAccessState } from "@/components/dashboard/data-states";
import { PlatformAdminOverview } from "@/components/dashboard/role-overviews";
import { getCurrentViewer } from "@/lib/current-viewer";

export default async function PlatformAdminPage() {
  const viewer = await getCurrentViewer();

  if (viewer.role !== "SYSTEM_ADMIN") {
    return <NoAccessState heading="h1" />;
  }

  return <PlatformAdminOverview />;
}
