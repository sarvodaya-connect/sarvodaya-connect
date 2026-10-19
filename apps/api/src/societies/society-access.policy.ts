import { ForbiddenException } from '@nestjs/common';
import type { Principal } from '../auth/principal.js';

export function assertCanEditSociety(
  principal: Principal,
  society: { id: string },
) {
  if (principal.roles.includes('HQ_ADMIN')) return;
  if (
    principal.roles.includes('SOCIETY_OFFICER') &&
    principal.societyIds.includes(society.id)
  )
    return;
  throw new ForbiddenException('You are not authorised to update this society');
}

export function societyWhereForPrincipal(principal: Principal) {
  if (principal.roles.includes('HQ_ADMIN')) return {};
  if (principal.roles.includes('DISTRICT_MANAGER')) {
    return { districtId: { in: principal.districtIds } };
  }
  if (principal.roles.includes('SOCIETY_OFFICER')) {
    return { id: { in: principal.societyIds } };
  }
  return { id: { in: [] } };
}
