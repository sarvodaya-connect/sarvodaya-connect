import type { IsoDateTime, PaginatedResponse } from "./common.js";
import type { DistrictSummary, SocietyGrade } from "./registry.js";

export type GradeChangeStatus = "PENDING" | "APPROVED" | "REJECTED";
export type GradeChangeDecision = Extract<GradeChangeStatus, "APPROVED" | "REJECTED">;

export interface SocietyAuditEvent {
  id: string;
  eventType: "GRADE_CHANGE_REQUESTED" | "GRADE_CHANGE_APPROVED" | "GRADE_CHANGE_REJECTED" | "GRADE_CHANGED_DIRECTLY";
  fromGrade?: SocietyGrade;
  toGrade?: SocietyGrade;
  summary: string;
  comment?: string;
  actorName: string;
  occurredAt: IsoDateTime;
}

export interface GradeChangeRequest {
  id: string;
  societyId: string;
  societyName: string;
  societyCode: string;
  district: Pick<DistrictSummary, "id" | "code" | "nameEn">;
  currentGrade: SocietyGrade;
  proposedGrade: SocietyGrade;
  rationale: string;
  status: GradeChangeStatus;
  requestedBy: { id: string; name: string };
  requestedAt: IsoDateTime;
  decidedBy?: { id: string; name: string };
  decisionComment?: string;
  decidedAt?: IsoDateTime;
  societySummary: { memberCount: number | null; memberYear: number | null; excoCount: number };
  history: SocietyAuditEvent[];
}

export interface GradeChangeListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: GradeChangeStatus;
  districtId?: string;
}

export type GradeChangeListResponse = PaginatedResponse<GradeChangeRequest>;
export interface CreateGradeChangeRequest { proposedGrade: SocietyGrade; rationale: string }
export interface GradeChangeDecisionRequest { decision: GradeChangeDecision; comment: string }
export interface DirectSocietyGradeUpdate { grade: SocietyGrade; reason: string }
