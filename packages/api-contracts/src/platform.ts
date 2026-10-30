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
export type ActivationMethod = "LINK" | "TEMPORARY_PASSWORD";
export type ActivationStatus = "PENDING" | "ACTIVE" | "INACTIVE";
export interface AccountSummary {
  id: string;
  username: string;
  displayName: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  districtId: string | null;
  societyIds: string[];
  status: ActivationStatus;
  invitations: {
    method: ActivationMethod;
    expiresAt: IsoDateTime;
    usedAt: IsoDateTime | null;
  }[];
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
export interface ActivationIssueResult {
  account: { id: string; username: string };
  method: ActivationMethod;
  credential: string;
  expiresAt: IsoDateTime;
  activationUrl: string;
  delivery: "MANUAL_HANDOVER";
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
