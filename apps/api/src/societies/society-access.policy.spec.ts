import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Principal } from '../auth/principal.js';
import { assertCanEditSociety, assertCanReadSociety } from './society-access.policy.js';

const society = { id: 'society-1', districtId: 'district-1' };
const manager: Principal = { id: 'dm', displayName: 'DM', roles: ['DISTRICT_MANAGER'], districtIds: ['district-1'], societyIds: [] };
const deputy: Principal = { id: 'ddm', displayName: 'DDM', roles: ['DEPUTY_DISTRICT_MANAGER'], districtIds: [], societyIds: ['society-2'] };
const officer: Principal = { id: 'so', displayName: 'SO', roles: ['SOCIETY_OFFICER'], districtIds: [], societyIds: ['society-1'] };

describe('society role scope', () => {
  it('allows DM district reads but prevents edits', () => {
    expect(() => assertCanReadSociety(manager, society)).not.toThrow();
    expect(() => assertCanReadSociety(manager, { ...society, districtId: 'district-2' })).toThrow(ForbiddenException);
    expect(() => assertCanEditSociety(manager, society)).toThrow(ForbiddenException);
  });

  it('allows DDM assigned records and time-bounded delegated district reads only', () => {
    expect(() => assertCanReadSociety(deputy, { id: 'society-2', districtId: 'district-2' })).not.toThrow();
    expect(() => assertCanReadSociety(deputy, society)).toThrow(ForbiddenException);
    expect(() => assertCanReadSociety(deputy, society, ['district-1'])).not.toThrow();
    expect(() => assertCanEditSociety(deputy, { id: 'society-2' })).toThrow(ForbiddenException);
  });

  it('keeps Society Officer access limited to assigned societies', () => {
    expect(() => assertCanReadSociety(officer, society)).not.toThrow();
    expect(() => assertCanEditSociety(officer, society)).not.toThrow();
    expect(() => assertCanReadSociety(officer, { id: 'society-2', districtId: 'district-1' })).toThrow(ForbiddenException);
  });
});
