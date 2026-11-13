import { ForbiddenException } from '@nestjs/common';

import { readableDistrictIds, type Principal } from '../auth/principal.js';

/**
 * Issue #145: who may do what in the Village Economic Profile.
 *
 * - Society Officer: views and manages their assigned society only.
 * - SPC and DDM: read their assigned societies.
 * - DDM with a valid temporary grant: also reads that district, while the
 *   grant is valid (rechecked on every request). Never write access.
 * - DM: reads their own district. HQ: reads every society.
 *
 * Nobody but the assigned Society Officer writes, including HQ. Reads use
 * `canViewSociety`, the same rule as the society record.
 */
export function canManageEconomy(
  principal: Principal,
  society: { id: string },
): boolean {
  return (
    principal.roles.includes('SOCIETY_OFFICER') &&
    principal.societyIds.includes(society.id)
  );
}

export function assertCanManageEconomy(
  principal: Principal,
  society: { id: string },
) {
  if (!canManageEconomy(principal, society))
    throw new ForbiddenException(
      'Only the Society Officer of this society can change its economic profile',
    );
}

/** The societies a caller's reports cover. `national` is HQ only. */
export type EconomyScope =
  | { national: true }
  | { national: false; districtIds: string[]; societyIds: string[] };

export function economyScopeFor(
  principal: Principal,
  now = new Date(),
): EconomyScope {
  if (principal.roles.includes('HQ_ADMIN')) return { national: true };
  return {
    national: false,
    districtIds: readableDistrictIds(principal, now),
    societyIds: [...new Set(principal.societyIds)],
  };
}
