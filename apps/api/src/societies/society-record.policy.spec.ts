import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { findDemoPrincipal } from '../auth/demo-principals.js';
import type { Principal } from '../auth/principal.js';
import {
  assertCanDecideGrade,
  assertCanEditAnnualSummary,
  assertCanRequestGradeChange,
  canEditAnnualSummary,
  canEditSocietyRecord,
  canRequestGradeChange,
  recordPermissions,
} from './society-record.policy.js';

const NORTH = '29000000-0000-4000-8000-000000000001';
const SUNRISE = {
  id: '29000000-0000-4000-8000-000000000101',
  districtId: NORTH,
};
const BLUEBIRD = {
  id: '29000000-0000-4000-8000-000000000102',
  districtId: NORTH,
};

const user = (id: string) => findDemoPrincipal(id)!;
const officer = user('demo-officer-sunrise');
const otherOfficer = user('demo-officer-lotus');
const spc = user('demo-programme-coordinator');
const ddm = user('demo-deputy-district-manager');
const dm = user('demo-dm-north');
const hq = user('demo-hq-admin');

const now = new Date('2026-10-30T06:00:00.000Z');
const ddmWithTemporaryAccess: Principal = {
  ...ddm,
  delegatedDistrictAccess: [
    {
      districtId: NORTH,
      startsAt: '2026-10-27T02:30:00.000Z',
      expiresAt: '2026-10-31T12:30:00.000Z',
    },
  ],
};

describe('SC-65 society record permissions (Prototype v4, page 4)', () => {
  it('lets Society Officers, SPCs and DDMs edit only their assigned societies, and HQ any', () => {
    expect(canEditSocietyRecord(officer, SUNRISE)).toBe(true);
    expect(canEditSocietyRecord(otherOfficer, SUNRISE)).toBe(false);
    expect(canEditSocietyRecord(spc, BLUEBIRD)).toBe(true);
    expect(canEditSocietyRecord(ddm, SUNRISE)).toBe(true);
    expect(canEditSocietyRecord(ddm, BLUEBIRD)).toBe(false);
    expect(canEditSocietyRecord(hq, BLUEBIRD)).toBe(true);
  });

  it('keeps District Managers and temporary DDM access view only', () => {
    expect(canEditSocietyRecord(dm, SUNRISE)).toBe(false);
    expect(recordPermissions(dm, SUNRISE, now)).toMatchObject({
      canEdit: false,
      canRequestGradeChange: false,
      canUploadDocuments: false,
      viewOnlyReason: 'DISTRICT_MANAGER',
    });
    // Temporary access covers the district, but edits stay limited to assigned societies.
    expect(
      recordPermissions(ddmWithTemporaryAccess, BLUEBIRD, now),
    ).toMatchObject({
      canEdit: false,
      canRequestGradeChange: false,
      viewOnlyReason: 'TEMPORARY_DISTRICT_ACCESS',
      viewOnlyUntil: '2026-10-31T12:30:00.000Z',
    });
    expect(
      recordPermissions(ddmWithTemporaryAccess, SUNRISE, now).canEdit,
    ).toBe(true);
  });

  it('lets only the Society Officer or assigned SPC enter yearly figures and the audit report', () => {
    expect(canEditAnnualSummary(officer, SUNRISE)).toBe(true);
    expect(canEditAnnualSummary(spc, SUNRISE)).toBe(true);
    // DDM and HQ entry is still to be confirmed with Sarvodaya; the prototype shows view only.
    expect(canEditAnnualSummary(ddm, SUNRISE)).toBe(false);
    expect(canEditAnnualSummary(hq, SUNRISE)).toBe(false);
    expect(canEditAnnualSummary(dm, SUNRISE)).toBe(false);
    expect(canEditAnnualSummary(otherOfficer, SUNRISE)).toBe(false);
    expect(() => assertCanEditAnnualSummary(hq, SUNRISE)).toThrow(
      ForbiddenException,
    );
  });

  it('lets field staff request a grade change but only HQ decide', () => {
    expect(canRequestGradeChange(officer, SUNRISE)).toBe(true);
    expect(canRequestGradeChange(spc, SUNRISE)).toBe(true);
    expect(canRequestGradeChange(ddm, SUNRISE)).toBe(true);
    expect(canRequestGradeChange(dm, SUNRISE)).toBe(false);
    expect(canRequestGradeChange(hq, SUNRISE)).toBe(false);
    expect(canRequestGradeChange(ddmWithTemporaryAccess, BLUEBIRD)).toBe(false);
    expect(() => assertCanRequestGradeChange(dm, SUNRISE)).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanDecideGrade(spc)).toThrow(ForbiddenException);
    expect(() => assertCanDecideGrade(dm)).toThrow(ForbiddenException);
    expect(() => assertCanDecideGrade(hq)).not.toThrow();
  });

  it('gives HQ the S-number and direct grade actions', () => {
    expect(recordPermissions(hq, SUNRISE, now)).toEqual({
      canEdit: true,
      canEditSocietyCode: true,
      canChangeGrade: true,
      canRequestGradeChange: false,
      canEditAnnualSummary: false,
      canUploadAuditReport: false,
      canUploadDocuments: true,
    });
    expect(recordPermissions(officer, SUNRISE, now)).toMatchObject({
      canEditSocietyCode: false,
      canChangeGrade: false,
      canEditAnnualSummary: true,
      canUploadAuditReport: true,
    });
  });
});
