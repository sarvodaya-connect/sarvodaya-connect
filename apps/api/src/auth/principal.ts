/** Mirrors USER_ROLES in packages/api-contracts. */
export const USER_ROLES = [
  'SOCIETY_OFFICER',
  'DISTRICT_MANAGER',
  'DEPUTY_DISTRICT_MANAGER',
  'PROGRAMME_COORDINATOR',
  'HQ_ADMIN',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** The signed-in user making a request, with the societies and districts they cover. */
export interface Principal {
  id: string;
  displayName: string;
  roles: UserRole[];
  districtIds: string[];
  societyIds: string[];
  delegatedDistrictAccess?: { districtId: string; expiresAt: string }[];
}

export function hasRole(principal: Principal, role: UserRole): boolean {
  return principal.roles.includes(role);
}

/** Delegation is read-only and valid only until its server-provided expiry. */
export function readableDistrictIds(principal: Principal, now = new Date()): string[] {
  const districts = principal.roles.includes('DISTRICT_MANAGER')
    ? principal.districtIds
    : principal.roles.includes('DEPUTY_DISTRICT_MANAGER')
      ? [
          ...principal.districtIds,
          ...(principal.delegatedDistrictAccess ?? [])
            .filter((grant) => Date.parse(grant.expiresAt) > now.getTime())
            .map((grant) => grant.districtId),
        ]
      : [];
  return [...new Set(districts)];
}
