import { ForbiddenException } from '@nestjs/common';
import type { Principal } from '../auth/principal.js';

export function assertCanEditSociety(
  principal: Principal,
  society: { id: string },
) {
  if (principal.roles.includes('HQ_ADMIN')) return;
  if (
    (principal.roles.includes('SOCIETY_OFFICER') ||
      principal.roles.includes('PROGRAMME_COORDINATOR')) &&
    principal.societyIds.includes(society.id)
  )
    return;
  throw new ForbiddenException('You are not authorised to update this society');
}

export function assertCanReadSociety(
  principal: Principal,
  society: { id: string; districtId: string },
  delegatedDistrictIds: readonly string[] = [],
) {
  if (principal.roles.includes('HQ_ADMIN')) return;
  if (
    (principal.roles.includes('DISTRICT_MANAGER') &&
      principal.districtIds.includes(society.districtId)) ||
    (principal.roles.includes('DEPUTY_DISTRICT_MANAGER') &&
      delegatedDistrictIds.includes(society.districtId)) ||
    ((principal.roles.includes('SOCIETY_OFFICER') ||
      principal.roles.includes('PROGRAMME_COORDINATOR') ||
      principal.roles.includes('DEPUTY_DISTRICT_MANAGER')) &&
      principal.societyIds.includes(society.id))
  ) return;
  throw new ForbiddenException('This society is outside your assigned record scope');
}

export function societyWhereForPrincipal(
  principal: Principal,
  delegatedDistrictIds: readonly string[] = [],
) {
  if (principal.roles.includes('HQ_ADMIN')) return {};
  const clauses: object[] = [];
  if (principal.roles.includes('DISTRICT_MANAGER') && principal.districtIds.length) {
    clauses.push({ districtId: { in: principal.districtIds } });
  }
  if (principal.roles.includes('DEPUTY_DISTRICT_MANAGER')) {
    if (principal.societyIds.length) clauses.push({ id: { in: principal.societyIds } });
    if (delegatedDistrictIds.length) clauses.push({ districtId: { in: delegatedDistrictIds } });
  } else if (
    (principal.roles.includes('SOCIETY_OFFICER') || principal.roles.includes('PROGRAMME_COORDINATOR')) &&
    principal.societyIds.length
  ) {
    clauses.push({ id: { in: principal.societyIds } });
  }
  if (clauses.length === 0) return { id: { in: [] } };
  if (clauses.length === 1) return clauses[0];
  return { OR: clauses };
}
