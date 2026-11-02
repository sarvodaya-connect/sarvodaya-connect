import type { UserRole } from "./identity.js";
import type { IsoDateTime } from "./common.js";
/** V4 has exactly five business roles. PROGRAMME_COORDINATOR is the existing wire value for SPC. */
export interface SessionPrincipal {
  id: string;
  displayName: string;
  roles: UserRole[];
  districtIds: string[];
  societyIds: string[];
  delegatedDistrictAccess?: {
    districtId: string;
    startsAt?: IsoDateTime;
    expiresAt: IsoDateTime;
  }[];
}
/** PENDING remains only on accounts created before V5; HQ setting a password activates them. */
export type PlatformAccountStatus = "PENDING" | "ACTIVE" | "INACTIVE";
export interface AccountSummary {
  id: string;
  username: string;
  displayName: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  districtId: string | null;
  societyIds: string[];
  status: PlatformAccountStatus;
  /** When HQ last set the password (V5 D16 "Set by HQ"); null if never set. */
  passwordSetAt: IsoDateTime | null;
  /** More than one means HQ has set a replacement ("Set again by HQ"). */
  passwordSetCount: number;
  /** A DDM whose temporary district-wide view is active now. */
  temporaryDistrictView: boolean;
}
export interface ScopeOptions {
  districts: { id: string; nameEn: string; code: string }[];
  societies: { id: string; nameEn: string; societyCode: string; districtId: string }[];
}
export interface CreateAccountInput {
  username: string;
  displayName: string;
  phone: string;
  email?: string;
  role: UserRole;
  districtId?: string;
  societyIds: string[];
  password: string;
}
export type UpdateAccountInput = Omit<CreateAccountInput, "password">;
export interface SetAccountPasswordInput {
  password: string;
}
export interface LoginResult {
  token: string;
  user: SessionPrincipal;
}
export interface DistrictDelegation {
  id: string;
  districtId: string;
  deputyId: string;
  grantedById: string;
  startsAt: IsoDateTime;
  expiresAt: IsoDateTime;
  revokedAt: IsoDateTime | null;
  reason: string;
}
export interface PlatformAuditEvent {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  societyId: string | null;
  districtId: string | null;
  detail: string;
  createdAt: IsoDateTime;
}
export interface NicRevealResult {
  nic: string;
  hideAfterSeconds: 30;
}
