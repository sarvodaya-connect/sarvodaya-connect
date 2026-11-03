import "server-only";

import { notFound } from "next/navigation";

import type {
  DistrictSummaries,
  HqTask,
  InformationRequestSummary,
  NationalFinance,
  NationalMembership,
  NationalOverview,
  NationalProgrammes,
  PageMeta,
  ReportTable,
  ReportType,
  SearchResults,
  SearchResultType,
  SocietyDirectory,
  SocietyMap,
  SocietyAtAGlance,
} from "@sarvodaya-connect/api-contracts";

import { platformApi } from "./platform-api";

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
};

/** V5 D02: the six dashboard sections (HQ only; the API refuses everyone else). */
export function getNationalOverview(year?: number): Promise<NationalOverview> {
  return platformApi(`/national/overview${query({ year })}`);
}

/** V5 D03b. */
export function getDistrictSummaries(year?: number): Promise<DistrictSummaries> {
  return platformApi(`/national/districts${query({ year })}`);
}

/** V5 D03. */
export function getSocietyMap(input: { status?: string; grade?: string }): Promise<SocietyMap> {
  return platformApi(`/national/map${query(input)}`);
}

/** V5 D08. */
export function getNationalMembership(): Promise<NationalMembership> {
  return platformApi("/national/membership");
}

/** V5 D07. */
export function getNationalProgrammes(year?: number): Promise<NationalProgrammes> {
  return platformApi(`/national/programmes${query({ year })}`);
}

export function getNationalFinance(input: { year?: number; page?: number }): Promise<NationalFinance> {
  return platformApi(`/national/finance${query(input)}`);
}

export type DirectoryFilters = {
  view?: string;
  q?: string;
  districtId?: string;
  dsDivision?: string;
  grade?: string;
  spcId?: string;
  records?: string;
  gradeRequest?: string;
  page?: number;
};

/** V5 D04: the society directory within the user's scope. */
export function getSocietyDirectory(filters: DirectoryFilters): Promise<SocietyDirectory> {
  return platformApi(`/society-directory${query({ ...filters, pageSize: 20 })}`);
}

/** V5 D03 selected society. Societies outside the user's scope are not found. */
export async function getSocietySummary(id: string): Promise<SocietyAtAGlance> {
  try {
    return await platformApi(`/societies/${id}/summary`);
  } catch (error) {
    if (error instanceof Error && error.message === "Society not found") notFound();
    throw error;
  }
}

/** V5 D18. */
export function searchRecords(q: string, type?: SearchResultType): Promise<SearchResults> {
  return platformApi(`/search${query({ q, type })}`);
}

/** V5 D13. */
export function getInformationRequests(page = 1): Promise<{ data: InformationRequestSummary[]; meta: PageMeta }> {
  return platformApi(`/information-requests${query({ page })}`);
}

export function getHqTasks(): Promise<{ data: HqTask[] }> {
  return platformApi("/hq-tasks");
}

/** V5 D15. */
export function getReport(type: ReportType, input: { year?: number; districtId?: string }): Promise<ReportTable> {
  return platformApi(`/reports/${type}${query(input)}`);
}

export type Alert = {
  id: string;
  category: string;
  topic?: string;
  title: string;
  body?: string;
  linkPath?: string;
  read: boolean;
  createdAt: string;
};

/** V5 D19: the signed-in user's own notifications. */
export function getAlerts(input: { filter?: string; page?: number }): Promise<{ data: Alert[]; meta: PageMeta & { unreadCount: number } }> {
  return platformApi(`/notifications${query({ ...input, pageSize: 20 })}`);
}

/** The header bell count. A failure shows no count rather than breaking every page. */
export async function getUnreadAlertCount(): Promise<number> {
  try {
    const result = await platformApi("/notifications?pageSize=1");
    return Number(result?.meta?.unreadCount ?? 0);
  } catch {
    return 0;
  }
}

export type DistrictOption = { id: string; nameEn: string };

export async function getDistrictOptions(): Promise<DistrictOption[]> {
  const result = await platformApi("/districts");
  return result.data;
}
