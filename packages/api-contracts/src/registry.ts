import type {
  IsoDate,
  IsoDateTime,
  PaginationQuery,
} from "./common.js";

export const SOCIETY_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "UNDER_REVIEW",
  "SUSPENDED",
] as const;

export type SocietyStatus = (typeof SOCIETY_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface DistrictSummary {
  id: string;
  code: string;
  nameEn: string;
  societyCount: number;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface SocietyAddress {
  addressLine?: string;
  village?: string;
  gnDivision?: string;
  dsDivision?: string;
}

export interface SocietyContact {
  id: string;
  label?: string;
  fullName?: string;
  position?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
}

export interface CommitteeMember {
  id: string;
  fullName: string;
  position: string;
  phone?: string;
  email?: string;
  appointedOn?: IsoDate;
  endedOn?: IsoDate;
  isActive: boolean;
}

export const DOCUMENT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface SocietyDocument {
  id: string;
  societyId: string;
  documentType: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentStatus;
  uploadedBy: string;
  uploadedAt: IsoDateTime;
}

export interface SocietyHistoryEntry {
  id: string;
  eventType: string;
  summary: string;
  actorDisplayName?: string;
  occurredAt: IsoDateTime;
}

export interface SocietySummary {
  id: string;
  societyCode: string;
  nameEn: string;
  nameLocal?: string;
  district: Pick<DistrictSummary, "id" | "code" | "nameEn">;
  status: SocietyStatus;
  verificationStatus: VerificationStatus;
  profileCompleteness: number;
  updatedAt: IsoDateTime;
}

export interface SocietyDetails extends SocietySummary {
  establishedOn?: IsoDate;
  address: SocietyAddress;
  location?: GeoLocation;
  contacts: SocietyContact[];
  committee: CommitteeMember[];
  documents: SocietyDocument[];
  history: SocietyHistoryEntry[];
  createdAt: IsoDateTime;
}

export interface SocietyListQuery extends PaginationQuery {
  search?: string;
  districtId?: string;
  status?: SocietyStatus;
  verificationStatus?: VerificationStatus;
}
