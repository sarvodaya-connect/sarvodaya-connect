import type { IsoDateTime } from "./common.js";

export const USER_ROLES = [
  "SOCIETY_OFFICER",
  "DISTRICT_MANAGER",
  "HQ_ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface AuthenticatedUser {
  id: string;
  personId: string;
  displayName: string;
  email?: string;
  wso2Subject: string;
  accountStatus: AccountStatus;
  roles: UserRole[];
  districtIds: string[];
  societyIds: string[];
  lastLoginAt?: IsoDateTime;
}
