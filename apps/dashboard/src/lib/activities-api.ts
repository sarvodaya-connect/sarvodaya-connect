import "server-only";

import { notFound } from "next/navigation";

import type {
  ActivityQueue,
  RegistrarDocumentTotals,
  SocietyRegistrarDocuments,
  WorkPlanActivity,
} from "@sarvodaya-connect/api-contracts";

import { isDemoMode, platformApi } from "./platform-api";

/** Demonstration mode only: SPC pages read as the fictional SPC. */
const asSpc = (): RequestInit => (isDemoMode() ? { headers: { "X-Demo-User": "demo-programme-coordinator" } } : {});

export type ActivityDetail = WorkPlanActivity & {
  society: { id: string; name: string; societyCode: string };
  permissions: { canEdit: boolean; canReview: boolean };
};

/** SP06: the SPC's waiting activities and recent approvals (the API refuses other roles). */
export { asSpc };

export function getActivityQueue(): Promise<ActivityQueue> {
  return platformApi("/activity-reviews", asSpc());
}

/** SP07. Activities outside the user's scope are reported by the API as not found. */
export async function getActivity(id: string): Promise<ActivityDetail> {
  try {
    return await platformApi(`/activities/${id}`, asSpc());
  } catch (error) {
    if (error instanceof Error && error.message === "Activity not found") notFound();
    throw error;
  }
}

/** D05 Documents tab: the four Registrar documents for the year. */
export function getRegistrarDocuments(societyId: string, year?: number): Promise<SocietyRegistrarDocuments> {
  return platformApi(`/societies/${societyId}/registrar-documents${year ? `?year=${year}` : ""}`);
}

export type RegistrarTotals = RegistrarDocumentTotals & {
  auditReportDueOn: string;
  documentCounts: { documentType: string; count: number }[];
};

/** D11 / D12 (HQ only). */
export function getRegistrarTotals(year?: number): Promise<RegistrarTotals> {
  return platformApi(`/registrar-documents/totals${year ? `?year=${year}` : ""}`);
}

export interface MissingDocuments {
  financialYear: { startYear: number; label: string };
  documentType: string;
  dueOn?: string;
  pastDue?: boolean;
  data: { id: string; name: string; societyCode: string; district: string }[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

/** D11 "Needs follow-up" (HQ only). */
export function getMissingDocuments(input: { year?: number; documentType?: string; page?: number }): Promise<MissingDocuments> {
  const query = new URLSearchParams({ pageSize: "20", page: String(input.page ?? 1) });
  if (input.year) query.set("year", String(input.year));
  if (input.documentType) query.set("documentType", input.documentType);
  return platformApi(`/registrar-documents/missing?${query}`);
}
