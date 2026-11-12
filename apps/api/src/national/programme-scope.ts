import { ForbiddenException } from '@nestjs/common';

import { readableDistrictIds, type Principal } from '../auth/principal.js';
import type { SocietyScope } from './national.repository.js';

export type ProgrammeScopeKind =
  'DISTRICT' | 'ASSIGNED' | 'ASSIGNED_AND_DISTRICT';

/**
 * Issue #117: which societies count in a DM's, DDM's or SPC's Programmes
 * view. Worked out again on every request from the signed-in principal, whose
 * temporary grants are already limited to those started, not ended early and
 * not expired; `readableDistrictIds` checks the start and expiry once more.
 *
 * - DM: their own district only.
 * - SPC: their assigned societies only. Being placed in a district gives no
 *   district-wide view.
 * - DDM: their assigned societies, plus a district only while a temporary
 *   grant for it is valid.
 *
 * HQ keeps the national view (`GET national/programmes`) and is not served here.
 */
export function programmeScopeFor(
  principal: Principal,
  now = new Date(),
): SocietyScope & { kind: ProgrammeScopeKind } {
  const roles = principal.roles;
  if (roles.includes('DISTRICT_MANAGER'))
    return {
      kind: 'DISTRICT',
      districtIds: readableDistrictIds(principal, now),
      societyIds: [],
    };
  if (roles.includes('DEPUTY_DISTRICT_MANAGER')) {
    const districtIds = readableDistrictIds(principal, now);
    return {
      kind: districtIds.length ? 'ASSIGNED_AND_DISTRICT' : 'ASSIGNED',
      districtIds,
      societyIds: [...new Set(principal.societyIds)],
    };
  }
  if (roles.includes('PROGRAMME_COORDINATOR'))
    return {
      kind: 'ASSIGNED',
      districtIds: [],
      societyIds: [...new Set(principal.societyIds)],
    };
  throw new ForbiddenException(
    'You are not authorised to view this programme summary',
  );
}

/** The earliest end of the DDM's valid grants for the districts in scope. */
export function delegationEndsAt(
  principal: Principal,
  districtIds: string[],
  now = new Date(),
): string | null {
  if (!principal.roles.includes('DEPUTY_DISTRICT_MANAGER')) return null;
  const ends = (principal.delegatedDistrictAccess ?? [])
    .filter(
      (grant) =>
        districtIds.includes(grant.districtId) &&
        Date.parse(grant.expiresAt) > now.getTime(),
    )
    .map((grant) => grant.expiresAt)
    .sort();
  return ends[0] ?? null;
}
