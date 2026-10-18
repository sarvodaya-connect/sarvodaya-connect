import { describe, expect, it } from 'vitest';

import { findDemoPrincipal } from '../auth/demo-principals.js';
import type { Principal } from '../auth/principal.js';
import {
  accessLevelFor,
  canAccessSociety,
  canViewDocument,
  documentScopeFilter,
} from './document-access.policy.js';

const NORTH = '29000000-0000-4000-8000-000000000001';
const CENTRAL = '29000000-0000-4000-8000-000000000002';
const SUNRISE = {
  societyId: '29000000-0000-4000-8000-000000000101',
  districtId: NORTH,
};
const BLUEBIRD = {
  societyId: '29000000-0000-4000-8000-000000000102',
  districtId: NORTH,
};
const LOTUS = {
  societyId: '29000000-0000-4000-8000-000000000103',
  districtId: CENTRAL,
};

const user = (id: string): Principal => findDemoPrincipal(id)!;
const officer = user('demo-officer-sunrise');
const northManager = user('demo-dm-north');
const hq = user('demo-hq-admin');

describe('document access policy', () => {
  it('limits society officers to their own society', () => {
    expect(canAccessSociety(officer, SUNRISE)).toBe(true);
    expect(canAccessSociety(officer, BLUEBIRD)).toBe(false);
    expect(canAccessSociety(officer, LOTUS)).toBe(false);
  });

  it('limits District Managers to their district and gives HQ every society', () => {
    expect(canAccessSociety(northManager, SUNRISE)).toBe(true);
    expect(canAccessSociety(northManager, BLUEBIRD)).toBe(true);
    expect(canAccessSociety(northManager, LOTUS)).toBe(false);
    expect(
      [SUNRISE, BLUEBIRD, LOTUS].every((society) =>
        canAccessSociety(hq, society),
      ),
    ).toBe(true);
  });

  it('keeps reviewers-only documents from society officers, even their own', () => {
    const membersList = { ...SUNRISE, accessLevel: 'REVIEWERS_ONLY' as const };
    expect(canViewDocument(officer, membersList)).toBe(false);
    expect(canViewDocument(northManager, membersList)).toBe(true);
    expect(canViewDocument(hq, membersList)).toBe(true);
    expect(
      canViewDocument(officer, { ...SUNRISE, accessLevel: 'STANDARD' }),
    ).toBe(true);
  });

  it('never lets a District Manager open restricted files from another district', () => {
    expect(
      canViewDocument(northManager, {
        ...LOTUS,
        accessLevel: 'REVIEWERS_ONLY',
      }),
    ).toBe(false);
  });

  it('builds the list scope for each role', () => {
    expect(documentScopeFilter(hq)).toEqual({
      kind: 'all',
      includeRestricted: true,
    });
    expect(documentScopeFilter(northManager)).toEqual({
      kind: 'districts',
      districtIds: [NORTH],
      includeRestricted: true,
    });
    expect(documentScopeFilter(officer)).toEqual({
      kind: 'societies',
      societyIds: [SUNRISE.societyId],
      includeRestricted: false,
    });
  });

  it('restricts only the signed members list', () => {
    expect(accessLevelFor('MEMBERS_LIST')).toBe('REVIEWERS_ONLY');
    expect(accessLevelFor('AUDIT_REPORT')).toBe('STANDARD');
    expect(accessLevelFor('AGM_MINUTES')).toBe('STANDARD');
  });
});
