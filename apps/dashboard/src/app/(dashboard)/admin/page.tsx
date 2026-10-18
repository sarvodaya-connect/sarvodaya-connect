import { AccessDeniedState } from "@/components/dashboard/data-states";
import { PlatformAdminOverview } from "@/components/dashboard/role-overviews";

export default async function PlatformAdminPage({ searchParams }: PageProps<"/admin">) {
  const { previewRole } = await searchParams;

  if (previewRole !== "platform") {
    return <AccessDeniedState role={previewRole === "district" ? "District Manager" : "National Administrator"} />;
  }

  return <PlatformAdminOverview />;
}
