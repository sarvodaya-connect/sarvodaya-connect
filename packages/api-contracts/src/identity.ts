import type { IsoDateTime } from "./common.js";

export const USER_ROLES = [
  "SOCIETY_OFFICER",
  "DISTRICT_MANAGER",
  "HQ_ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Authentication adapters supported by the backend boundary. Cognito is the
 * production target; DEMO is limited to fictional local/test identities. */
export const AUTH_PROVIDERS = ["DEMO", "COGNITO"] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/** PERSON accounts are interactive users linked to PERSON records. SERVICE is
 * reserved for future machine-to-machine identities. */
export const ACCOUNT_TYPES = ["PERSON", "SERVICE"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const PERMISSIONS = [
  "SOCIETY_READ",
  "SOCIETY_UPDATE",
  "MEMBERSHIP_READ",
  "DOCUMENT_READ",
  "DOCUMENT_UPLOAD",
  "NOTIFICATION_READ",
  "SUBMISSION_REVIEW",
  "PLATFORM_ADMIN",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Coarse authorization capabilities. Record-level access still requires
 * applying the user's district/society scope in the service/repository. */
export const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, readonly Permission[]>
> = {
  SOCIETY_OFFICER: [
    "SOCIETY_READ",
    "SOCIETY_UPDATE",
    "MEMBERSHIP_READ",
    "DOCUMENT_READ",
    "DOCUMENT_UPLOAD",
    "NOTIFICATION_READ",
  ],
  DISTRICT_MANAGER: [
    "SOCIETY_READ",
    "MEMBERSHIP_READ",
    "DOCUMENT_READ",
    "DOCUMENT_UPLOAD",
    "NOTIFICATION_READ",
    "SUBMISSION_REVIEW",
  ],
  HQ_ADMIN: PERMISSIONS,
};

export function hasPermission(
  roles: readonly UserRole[],
  permission: Permission,
) {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface AuthenticatedUser {
  id: string;
  personId: string;
  displayName: string;
  email?: string;
  wso2Subject: string;
  accountStatus: AccountStatus;
  /** Optional during the demo-to-production identity migration. */
  authProvider?: AuthProvider;
  accountType?: AccountType;
  roles: UserRole[];
  districtIds: string[];
  societyIds: string[];
  lastLoginAt?: IsoDateTime;
}
