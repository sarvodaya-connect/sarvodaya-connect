import { ForbiddenException } from '@nestjs/common';
import type { Principal } from '../auth/principal.js';

export function canManageEmergency(principal: Principal) {
  return principal.roles.some((role) => role === 'HQ_ADMIN' || role === 'DISTRICT_MANAGER');
}

export function canAssessEmergency(principal: Principal) {
  return principal.roles.some((role) =>
    role === 'HQ_ADMIN' || role === 'DISTRICT_MANAGER' ||
    role === 'SOCIETY_OFFICER' || role === 'PROGRAMME_COORDINATOR');
}

export function assertCanUseEmergency(principal: Principal) {
  if (!canAssessEmergency(principal)) {
    throw new ForbiddenException('Your account cannot access emergency response');
  }
}

export function assertCanManageEmergency(principal: Principal) {
  if (!canManageEmergency(principal)) {
    throw new ForbiddenException('Only District Managers and HQ can coordinate emergency response');
  }
}

export function assertCanCreateEmergencyAction(principal: Principal) {
  if (!principal.roles.some((role) =>
    role === 'HQ_ADMIN' || role === 'DISTRICT_MANAGER' || role === 'PROGRAMME_COORDINATOR')) {
    throw new ForbiddenException('Your account cannot coordinate emergency actions');
  }
}

export function assertCanAccessDistrict(principal: Principal, districtId: string) {
  if (principal.roles.includes('HQ_ADMIN')) return;
  if (principal.districtIds.includes(districtId)) return;
  throw new ForbiddenException('This incident is outside your assigned district scope');
}

export function assertCanAccessSociety(principal: Principal, societyId: string, districtId: string) {
  if (principal.roles.includes('HQ_ADMIN')) return;
  if (principal.roles.includes('DISTRICT_MANAGER') && principal.districtIds.includes(districtId)) return;
  if ((principal.roles.includes('SOCIETY_OFFICER') || principal.roles.includes('PROGRAMME_COORDINATOR')) && principal.societyIds.includes(societyId)) return;
  throw new ForbiddenException('This society is outside your assigned record scope');
}
