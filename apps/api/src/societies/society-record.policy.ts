import { ForbiddenException } from '@nestjs/common';

import {
  hasRole,
  readableDistrictIds,
  type Principal,
  type UserRole,
} from '../auth/principal.js';
import { canViewSociety } from './society-access.policy.js';

/**
 * SC-65 rules for the V4 society record (Prototype v4, page 4 "Who can see
 * and do what"). They are applied on the server for every request; the
 * permission flags returned to the clients only decide which actions to show.
 *
 * - Society Officer, SPC and DDM edit only their assigned societies.
 * - DMs, and DDMs using temporary district access, only view.
 * - HQ edits any society and is the only role that changes a grade or S number.
 * - Yearly profit/expenses and the audit report are entered by the Society
 *   Officer or the assigned SPC. DDM and HQ entry is still "to confirm" with
 *   Sarvodaya, so they view only, as the prototype shows.
 * - Society Officers, SPCs and DDMs may request a grade change; only HQ decides.
 */

interface SocietyScope {
  id: string;
  districtId: string;
}

const FIELD_EDITOR_ROLES: readonly UserRole[] = [
  'SOCIETY_OFFICER',
  'PROGRAMME_COORDINATOR',
  'DEPUTY_DISTRICT_MANAGER',
];

const ANNUAL_SUMMARY_ROLES: readonly UserRole[] = [
  'SOCIETY_OFFICER',
  'PROGRAMME_COORDINATOR',
];

function isHq(principal: Principal) {
  return hasRole(principal, 'HQ_ADMIN');
}

function isAssignedWithRole(
  principal: Principal,
  society: SocietyScope,
  roles: readonly UserRole[],
) {
  return (
    principal.societyIds.includes(society.id) &&
    principal.roles.some((role) => roles.includes(role))
  );
}

export function canEditSocietyRecord(
  principal: Principal,
  society: SocietyScope,
) {
  return (
    isHq(principal) ||
    isAssignedWithRole(principal, society, FIELD_EDITOR_ROLES)
  );
}

export function canEditAnnualSummary(
  principal: Principal,
  society: SocietyScope,
) {
  return isAssignedWithRole(principal, society, ANNUAL_SUMMARY_ROLES);
}

export function canRequestGradeChange(
  principal: Principal,
  society: SocietyScope,
) {
  return (
    !isHq(principal) &&
    isAssignedWithRole(principal, society, FIELD_EDITOR_ROLES)
  );
}

export function canDecideGrade(principal: Principal) {
  return isHq(principal);
}

export function assertCanEditAnnualSummary(
  principal: Principal,
  society: SocietyScope,
) {
  if (!canEditAnnualSummary(principal, society)) {
    throw new ForbiddenException(
      "Only the society's Society Officer or assigned SPC can enter the yearly figures and audit report",
    );
  }
}

export function assertCanRequestGradeChange(
  principal: Principal,
  society: SocietyScope,
) {
  if (!canRequestGradeChange(principal, society)) {
    throw new ForbiddenException(
      'Only the assigned Society Officer, SPC or DDM can request a grade change',
    );
  }
}

export function assertCanDecideGrade(principal: Principal) {
  if (!canDecideGrade(principal)) {
    throw new ForbiddenException('Only HQ can change a society grade');
  }
}

/** Flags for the clients. `canViewSociety` must already have been checked. */
export function recordPermissions(
  principal: Principal,
  society: SocietyScope,
  now = new Date(),
) {
  const canEdit = canEditSocietyRecord(principal, society);
  const permissions: {
    canEdit: boolean;
    canEditSocietyCode: boolean;
    canChangeGrade: boolean;
    canRequestGradeChange: boolean;
    canEditAnnualSummary: boolean;
    canUploadAuditReport: boolean;
    canUploadDocuments: boolean;
    viewOnlyReason?: 'DISTRICT_MANAGER' | 'TEMPORARY_DISTRICT_ACCESS';
    viewOnlyUntil?: string;
  } = {
    canEdit,
    canEditSocietyCode: isHq(principal),
    canChangeGrade: canDecideGrade(principal),
    canRequestGradeChange: canRequestGradeChange(principal, society),
    canEditAnnualSummary: canEditAnnualSummary(principal, society),
    canUploadAuditReport: canEditAnnualSummary(principal, society),
    canUploadDocuments: canEdit,
  };
  if (canEdit || !canViewSociety(principal, society)) return permissions;
  if (hasRole(principal, 'DISTRICT_MANAGER')) {
    permissions.viewOnlyReason = 'DISTRICT_MANAGER';
  } else if (readableDistrictIds(principal, now).includes(society.districtId)) {
    permissions.viewOnlyReason = 'TEMPORARY_DISTRICT_ACCESS';
    const ends = (principal.delegatedDistrictAccess ?? [])
      .filter(
        (grant) =>
          grant.districtId === society.districtId &&
          Date.parse(grant.expiresAt) > now.getTime(),
      )
      .map((grant) => grant.expiresAt)
      .sort();
    if (ends.length) permissions.viewOnlyUntil = ends[ends.length - 1];
  }
  return permissions;
}
