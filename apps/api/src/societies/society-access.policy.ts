import { ForbiddenException } from '@nestjs/common';
import { readableDistrictIds, type Principal } from '../auth/principal.js';

export function assertCanEditSociety(
  principal: Principal,
  society: { id: string },
) {
  if (principal.roles.includes('HQ_ADMIN')) return;
  if (
    (principal.roles.includes('SOCIETY_OFFICER') || principal.roles.includes('PROGRAMME_COORDINATOR')) &&
    principal.societyIds.includes(society.id)
  )
    return;
  throw new ForbiddenException('You are not authorised to update this society');
}

export function canViewSociety(principal: Principal, society: { id: string; districtId: string }) {
  if (principal.roles.includes('HQ_ADMIN')) return true;
  return readableDistrictIds(principal).includes(society.districtId) ||
    principal.societyIds.includes(society.id);
}

export function societyWhereForPrincipal(principal: Principal) {
  if (principal.roles.includes('HQ_ADMIN')) return {};
  const districtIds = readableDistrictIds(principal);
  if (districtIds.length) {
    return principal.societyIds.length
      ? { OR: [
          { districtId: { in: districtIds } },
          { id: { in: principal.societyIds } },
        ] }
      : { districtId: { in: districtIds } };
  }
  if (principal.roles.includes('SOCIETY_OFFICER') || principal.roles.includes('PROGRAMME_COORDINATOR') || principal.roles.includes('DEPUTY_DISTRICT_MANAGER')) {
    return { id: { in: principal.societyIds } };
  }
  return { id: { in: [] } };
}
