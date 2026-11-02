import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";

import type {
  AnnualFinancialSummaryResponse,
  GradeChangeRequest,
  GradeQueue,
  GradeQueueFilter,
  GradeRequestDetail,
  StaffOptions,
  SocietyHistoryCategory,
  SocietyHistoryEvent,
  SocietyRecord,
  WorkPlanOverview,
} from "@sarvodaya-connect/api-contracts";

import { platformApi } from "./platform-api";

/** A document in a society record, as returned by GET /documents. */
export interface RecordDocument {
  id: string;
  documentType: string;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedByRole?: string;
  uploadedAt?: string;
  financialYear?: { startYear: number; label: string };
}

/**
 * Loads the society record for the signed-in HQ user. Requests are cached for
 * one render so the layout and the tab pages share one API call. Societies
 * outside the user's scope are reported by the API as not found.
 */
export const getSocietyRecord = cache(async (id: string): Promise<SocietyRecord> => {
  try {
    return await platformApi(`/societies/${id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "Society not found") notFound();
    throw error;
  }
});

export const getWorkPlan = cache(
  (id: string): Promise<WorkPlanOverview> => platformApi(`/societies/${id}/work-plan`),
);

export const getGradeRequests = cache(
  async (id: string): Promise<GradeChangeRequest[]> =>
    (await platformApi(`/societies/${id}/grade-requests`)).data,
);

export const getSocietyDocuments = cache(
  async (id: string): Promise<{ data: RecordDocument[]; total: number }> => {
    const result = await platformApi(`/documents?societyId=${id}&pageSize=100`);
    return { data: result.data, total: result.meta.totalItems };
  },
);

export function getHistory(id: string, category?: SocietyHistoryCategory): Promise<{ data: SocietyHistoryEvent[] }> {
  return platformApi(`/societies/${id}/history${category ? `?category=${category}` : ""}`);
}

export function getAnnualSummary(id: string, year?: number): Promise<AnnualFinancialSummaryResponse> {
  return platformApi(`/societies/${id}/annual-summary${year ? `?year=${year}` : ""}`);
}

/** V5 D22: the national grade-change queue (HQ only; the API refuses others). */
export function getGradeQueue(status: GradeQueueFilter): Promise<GradeQueue> {
  return platformApi(`/grade-requests?status=${status}`);
}

/** V5 D22r. */
export async function getGradeRequestDetail(id: string): Promise<GradeRequestDetail> {
  try {
    return await platformApi(`/grade-requests/${id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "Grade-change request not found") notFound();
    throw error;
  }
}

/** V5 D05a choices (HQ only). */
export function getStaffOptions(id: string): Promise<StaffOptions> {
  return platformApi(`/societies/${id}/staff-options`);
}
