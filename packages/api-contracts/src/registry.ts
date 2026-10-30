import type { IsoDate, IsoDateTime, PaginationQuery } from "./common.js";

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
  seatNumber?: number;
  seatType?: MembershipCategory;
  age?: number;
  isPrimaryContact?: boolean;
  /** The last four NIC characters, e.g. "••••0012". The full NIC needs a recorded reveal. */
  nicMasked?: string;
}

export const MEMBERSHIP_CATEGORIES = [
  "CHILDREN",
  "YOUTH",
  "MOTHERS",
  "ORDINARY",
  "ELDERS_COUNCIL",
] as const;

export type MembershipCategory = (typeof MEMBERSHIP_CATEGORIES)[number];

export interface MembershipCategoryCount {
  category: MembershipCategory;
  female: number;
  male: number;
  total: number;
}

export interface SocietyMembershipSummary {
  societyId: string;
  societyCode: string;
  societyName: string;
  districtName: string;
  year: number;
  categories: MembershipCategoryCount[];
  femaleTotal: number;
  maleTotal: number;
  overallTotal: number;
}

export interface MembershipDashboardSummary {
  year: number;
  societies: SocietyMembershipSummary[];
  categories: MembershipCategoryCount[];
  femaleTotal: number;
  maleTotal: number;
  overallTotal: number;
}

export interface SocietyProfileUpdate {
  nameEn?: string;
  nameLocal?: string;
  dsDivision?: string;
  gnDivision?: string;
  village?: string;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
  establishedOn?: IsoDate;
  primaryContact?: {
    fullName: string;
    phone: string;
    position?: string;
    email?: string;
  };
}

export interface SocietyCouncilUpdate {
  members: Array<{
    seatNumber: number;
    fullName: string;
    position: string;
    seatType: MembershipCategory;
    phone?: string;
    email?: string;
    age?: number;
    appointedOn?: IsoDate;
    endedOn?: IsoDate;
    isActive: boolean;
    isPrimaryContact: boolean;
  }>;
}

export interface SocietyMembershipUpdate {
  year: number;
  categories: Array<
    Pick<MembershipCategoryCount, "category" | "female" | "male">
  >;
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
  membership?: Omit<
    SocietyMembershipSummary,
    "societyId" | "societyCode" | "societyName" | "districtName"
  >;
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
