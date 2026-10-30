import {
  hasRole,
  readableDistrictIds,
  type Principal,
} from '../auth/principal.js';
import {
  canEditAnnualSummary,
  canEditSocietyRecord,
} from '../societies/society-record.policy.js';

/**
 * Provisional role-based access rules for society documents:
 * - HQ Administrators: every society.
 * - District Managers: societies in their districts.
 * - Society Officers: their own societies.
 * - REVIEWERS_ONLY documents (the signed members list): District Managers and
 *   HQ only, even for the society that uploaded them.
 * To be confirmed with Sarvodaya.
 */

export type AccessLevel = 'STANDARD' | 'REVIEWERS_ONLY';

export interface SocietyScope {
  societyId: string;
  districtId: string;
}

/** Restriction applied to document lists, in a form the repository can turn into a query. */
export type DocumentScopeFilter =
  | { kind: 'all'; includeRestricted: boolean }
  | { kind: 'districts'; districtIds: string[]; includeRestricted: boolean }
  | {
      kind: 'mixed';
      districtIds: string[];
      societyIds: string[];
      includeRestricted: boolean;
    }
  | { kind: 'societies'; societyIds: string[]; includeRestricted: boolean };

export function isReviewer(principal: Principal): boolean {
  return (
    hasRole(principal, 'HQ_ADMIN') || hasRole(principal, 'DISTRICT_MANAGER')
  );
}

export function canAccessSociety(
  principal: Principal,
  society: SocietyScope,
): boolean {
  if (hasRole(principal, 'HQ_ADMIN')) return true;
  if (readableDistrictIds(principal).includes(society.districtId)) return true;
  if (
    (hasRole(principal, 'SOCIETY_OFFICER') ||
      hasRole(principal, 'PROGRAMME_COORDINATOR') ||
      hasRole(principal, 'DEPUTY_DISTRICT_MANAGER')) &&
    principal.societyIds.includes(society.societyId)
  )
    return true;
  return false;
}

/**
 * V4 (Prototype v4, M13 and M13a): people who can edit the society add its
 * documents; District Managers and DDMs using temporary district access only
 * view. The audit report is uploaded by the Society Officer or assigned SPC.
 */
export function canCreateDocument(
  principal: Principal,
  society: SocietyScope,
  documentType?: string,
): boolean {
  const scope = { id: society.societyId, districtId: society.districtId };
  if (documentType === 'AUDIT_REPORT') {
    return canEditAnnualSummary(principal, scope);
  }
  return canEditSocietyRecord(principal, scope);
}

export function canViewDocument(
  principal: Principal,
  document: SocietyScope & { accessLevel: AccessLevel },
): boolean {
  if (!canAccessSociety(principal, document)) return false;
  return document.accessLevel === 'STANDARD' || isReviewer(principal);
}

export function documentScopeFilter(principal: Principal): DocumentScopeFilter {
  const includeRestricted = isReviewer(principal);
  if (hasRole(principal, 'HQ_ADMIN')) return { kind: 'all', includeRestricted };
  const districtIds = readableDistrictIds(principal);
  if (districtIds.length && principal.societyIds.length) {
    return {
      kind: 'mixed',
      districtIds,
      societyIds: principal.societyIds,
      includeRestricted,
    };
  }
  if (districtIds.length && !principal.societyIds.length) {
    return {
      kind: 'districts',
      districtIds,
      includeRestricted,
    };
  }
  return {
    kind: 'societies',
    societyIds: principal.societyIds,
    includeRestricted,
  };
}

/** The signed members list is restricted; everything else is standard. */
export function accessLevelFor(documentType: string): AccessLevel {
  return documentType === 'MEMBERS_LIST' ? 'REVIEWERS_ONLY' : 'STANDARD';
}
