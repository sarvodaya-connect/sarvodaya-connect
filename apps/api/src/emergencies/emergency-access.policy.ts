import type { Principal } from '../auth/principal.js';
import { hasRole, readableDistrictIds } from '../auth/principal.js';

/**
 * V5 PR 8: who may do what in disaster response. Every role can open and
 * close incidents and send rapid assessments, within their own scope:
 *
 * - Society Officer and SPC: their assigned societies.
 * - DDM: their assigned societies, plus a view-only district during
 *   temporary access (they can see it, not act for it).
 * - DM: their district.
 * - HQ: national.
 *
 * Only HQ assigns response actions and helping societies.
 */
export type EmergencyScope =
  | { national: true }
  | { national: false; districtIds: string[]; societyIds: string[] };

export const EMERGENCY_ROLES = [
  'SOCIETY_OFFICER',
  'PROGRAMME_COORDINATOR',
  'DEPUTY_DISTRICT_MANAGER',
  'DISTRICT_MANAGER',
  'HQ_ADMIN',
] as const;

const NONE: EmergencyScope = {
  national: false,
  districtIds: [],
  societyIds: [],
};

/** Societies the user may act for: open, close and send assessments. */
export function actingScope(principal: Principal): EmergencyScope {
  if (hasRole(principal, 'HQ_ADMIN')) return { national: true };
  if (hasRole(principal, 'DISTRICT_MANAGER')) {
    return {
      national: false,
      districtIds: principal.districtIds,
      societyIds: [],
    };
  }
  if (
    hasRole(principal, 'DEPUTY_DISTRICT_MANAGER') ||
    hasRole(principal, 'PROGRAMME_COORDINATOR') ||
    hasRole(principal, 'SOCIETY_OFFICER')
  ) {
    return {
      national: false,
      districtIds: [],
      societyIds: principal.societyIds,
    };
  }
  return NONE;
}

/** Societies the user may see: their acting scope plus a DDM's temporary district view. */
export function viewingScope(
  principal: Principal,
  now = new Date(),
): EmergencyScope {
  const acting = actingScope(principal);
  if (acting.national) return acting;
  const delegated = hasRole(principal, 'DEPUTY_DISTRICT_MANAGER')
    ? readableDistrictIds(principal, now)
    : [];
  return {
    national: false,
    districtIds: [...new Set([...acting.districtIds, ...delegated])],
    societyIds: acting.societyIds,
  };
}

export function isEmptyScope(scope: EmergencyScope) {
  return (
    !scope.national && !scope.districtIds.length && !scope.societyIds.length
  );
}

export function coversSociety(
  scope: EmergencyScope,
  society: { id: string; districtId: string },
) {
  return (
    scope.national ||
    scope.districtIds.includes(society.districtId) ||
    scope.societyIds.includes(society.id)
  );
}

/** A Prisma `where` for the societies in a scope. */
export function societyScopeFilter(scope: EmergencyScope) {
  if (scope.national) return {};
  return {
    OR: [
      { districtId: { in: scope.districtIds } },
      { id: { in: scope.societyIds } },
    ],
  };
}

/** Response actions, helping societies, situation reports and reminders. */
export function canCoordinate(principal: Principal) {
  return hasRole(principal, 'HQ_ADMIN');
}
