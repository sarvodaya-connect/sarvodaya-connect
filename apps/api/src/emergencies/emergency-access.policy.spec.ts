import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Principal } from '../auth/principal.js';
import { assertCanAccessSociety, assertCanCreateEmergencyAction, assertCanManageEmergency, assertCanUseEmergency } from './emergency-access.policy.js';

const officer: Principal = {
  id: 'officer-1', displayName: 'Demo officer', roles: ['SOCIETY_OFFICER'],
  districtIds: ['district-1'], societyIds: ['society-1'],
};

describe('emergency access policy', () => {
  it('allows assigned officers to assess their society', () => {
    expect(() => assertCanUseEmergency(officer)).not.toThrow();
    expect(() => assertCanAccessSociety(officer, 'society-1', 'district-1')).not.toThrow();
  });

  it('rejects out-of-scope societies and incident activation by an officer', () => {
    expect(() => assertCanAccessSociety(officer, 'society-2', 'district-1')).toThrow(ForbiddenException);
    expect(() => assertCanManageEmergency(officer)).toThrow(ForbiddenException);
  });

  it('allows district-scoped managers and national administrators to coordinate', () => {
    const manager: Principal = { ...officer, roles: ['DISTRICT_MANAGER'] };
    const hq: Principal = { ...officer, roles: ['HQ_ADMIN'], districtIds: [], societyIds: [] };
    expect(() => assertCanManageEmergency(manager)).not.toThrow();
    expect(() => assertCanAccessSociety(manager, 'society-9', 'district-1')).not.toThrow();
    expect(() => assertCanAccessSociety(manager, 'society-9', 'district-2')).toThrow(ForbiddenException);
    expect(() => assertCanAccessSociety(hq, 'society-9', 'district-2')).not.toThrow();
  });

  it('allows coordinators to create scoped actions without granting incident activation', () => {
    const coordinator: Principal = { ...officer, roles: ['PROGRAMME_COORDINATOR'] };
    expect(() => assertCanCreateEmergencyAction(coordinator)).not.toThrow();
    expect(() => assertCanAccessSociety(coordinator, 'society-1', 'district-1')).not.toThrow();
    expect(() => assertCanManageEmergency(coordinator)).toThrow(ForbiddenException);
  });
});
