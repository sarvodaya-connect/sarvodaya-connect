import { describe, expect, it } from 'vitest';
import type { Principal } from '../auth/principal.js';
import {
  assertCanEditSociety,
  societyWhereForPrincipal,
} from './society-access.policy.js';

const society = { id: 'society-a' };
const base = {
  id: 'user',
  displayName: 'User',
  districtIds: [],
  societyIds: [],
};

describe('V4 society access', () => {
  it('allows an SPC to edit only assigned societies', () => {
    const spc: Principal = {
      ...base,
      roles: ['PROGRAMME_COORDINATOR'],
      societyIds: ['society-a'],
    };
    expect(() => assertCanEditSociety(spc, society)).not.toThrow();
    expect(() => assertCanEditSociety(spc, { id: 'society-b' })).toThrow();
    expect(societyWhereForPrincipal(spc)).toEqual({
      id: { in: ['society-a'] },
    });
  });

  it('gives DDM temporary district view while limiting edits to assignments', () => {
    const ddm: Principal = {
      ...base,
      roles: ['DEPUTY_DISTRICT_MANAGER'],
      societyIds: ['society-a'],
      delegatedDistrictAccess: [
        { districtId: 'district-a', expiresAt: '2099-01-01T00:00:00.000Z' },
      ],
    };
    expect(societyWhereForPrincipal(ddm)).toEqual({
      OR: [
        { districtId: { in: ['district-a'] } },
        { id: { in: ['society-a'] } },
      ],
    });
    expect(() => assertCanEditSociety(ddm, society)).not.toThrow();
    expect(() => assertCanEditSociety(ddm, { id: 'society-b' })).toThrow();
  });

  it('drops expired DDM delegation', () => {
    const ddm: Principal = {
      ...base,
      roles: ['DEPUTY_DISTRICT_MANAGER'],
      societyIds: ['society-a'],
      delegatedDistrictAccess: [
        { districtId: 'district-a', expiresAt: '2000-01-01T00:00:00.000Z' },
      ],
    };
    expect(societyWhereForPrincipal(ddm)).toEqual({
      id: { in: ['society-a'] },
    });
  });
});
