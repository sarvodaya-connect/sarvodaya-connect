import { DistrictOverview, NationalOverview } from "@/components/dashboard/role-overviews";

export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const { previewRole } = await searchParams;

  return previewRole === "district" ? <DistrictOverview /> : <NationalOverview />;
}
