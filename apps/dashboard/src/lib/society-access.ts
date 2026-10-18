import type { SocietyDetails, UserRole } from "@sarvodaya-connect/api-contracts";

export type SocietyAccess = {
  role: UserRole;
  districtIds: string[];
  societyIds: string[];
};

/** Demo identity mirrors the HQ Administrator currently shown in the dashboard shell. */
export const demoSocietyAccess: SocietyAccess = {
  role: "HQ_ADMIN",
  districtIds: [],
  societyIds: [],
};

export function societiesVisibleTo(societies: SocietyDetails[], access: SocietyAccess) {
  switch (access.role) {
    case "HQ_ADMIN":
      return societies;
    case "DISTRICT_MANAGER":
      return societies.filter((society) => access.districtIds.includes(society.district.id));
    case "SOCIETY_OFFICER":
      return societies.filter((society) => access.societyIds.includes(society.id));
  }
}
