import { hasRole, type Principal } from '../auth/principal.js';

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
  if (
    hasRole(principal, 'DISTRICT_MANAGER') &&
    principal.districtIds.includes(society.districtId)
  )
    return true;
  if (
    hasRole(principal, 'SOCIETY_OFFICER') &&
    principal.societyIds.includes(society.societyId)
  )
    return true;
  return false;
}

/** Anyone who can see a society can add documents to it. */
export function canCreateDocument(
  principal: Principal,
  society: SocietyScope,
): boolean {
  return canAccessSociety(principal, society);
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
  if (hasRole(principal, 'DISTRICT_MANAGER')) {
    return {
      kind: 'districts',
      districtIds: principal.districtIds,
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
