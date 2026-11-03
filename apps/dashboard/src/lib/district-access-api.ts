import "server-only";

import type { DistrictAccessGrantDetail, DistrictAccessList } from "@sarvodaya-connect/api-contracts";

import { platformApi } from "./platform-api";

/** V5 DM04 / M32. HQ sees every grant, the DM their district's, a DDM their own. */
export function getDistrictAccess(): Promise<DistrictAccessList> {
  return platformApi("/identity/district-access");
}

/** DM04 "See details": the grant and its access history. */
export function getDistrictAccessGrant(id: string): Promise<DistrictAccessGrantDetail> {
  return platformApi(`/identity/district-access/${encodeURIComponent(id)}`);
}

/** DM05: the DDMs in the DM's district who can be given access. */
export async function getDistrictDeputies(): Promise<{ id: string; displayName: string; districtId: string }[]> {
  const result: { data?: { id: string; displayName: string; districtId: string }[] } = await platformApi("/identity/district-deputies");
  return result.data ?? [];
}
