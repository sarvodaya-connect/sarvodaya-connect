import { DistrictCatalogueOverview } from "@/components/dashboard/district-overview";
import { PlatformAdminScreen } from "@/components/dashboard/platform-admin";
export { NationalOverview } from "./national-overview";

export function DistrictOverview() {
  return <DistrictCatalogueOverview />;
}

export function PlatformAdminOverview() {
  return <PlatformAdminScreen />;
}
