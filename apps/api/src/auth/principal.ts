/** Mirrors USER_ROLES in packages/api-contracts. */
export const USER_ROLES = [
  'SOCIETY_OFFICER',
  'DISTRICT_MANAGER',
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
}

export function hasRole(principal: Principal, role: UserRole): boolean {
  return principal.roles.includes(role);
}
