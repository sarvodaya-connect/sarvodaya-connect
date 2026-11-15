import "server-only";

import { notFound } from "next/navigation";

import type {
  EconomyFilterScope,
  Paged,
  ProductionQuery,
  ProductionRecord,
  ProductionRecordListItem,
  ProductionRecordRevision,
  ProductionSummary,
  SocietyEconomicProfile,
} from "@sarvodaya-connect/api-contracts";

import { ECONOMY_PAGE_SIZE, queryString } from "./economy-format";
import { PlatformApiError, platformApi } from "./platform-api";

/**
 * Issue #147: the Village Economic Profile endpoints (#145). The API works out
 * each viewer's scope on every request; a society or record outside it is a
 * 404, shown here as the usual not-found page.
 */
async function orNotFound<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof PlatformApiError && error.status === 404) notFound();
    throw error;
  }
}

export function getEconomicProfile(societyId: string): Promise<SocietyEconomicProfile> {
  return orNotFound(() => platformApi(`/societies/${societyId}/economic-profile`));
}

/** A society's records, newest period first, one page at a time. */
export function getSocietyProductionRecords(societyId: string, page: number): Promise<Paged<ProductionRecordListItem>> {
  return orNotFound(() =>
    platformApi(`/economic-profile/production-records?${queryString({ societyId, page, pageSize: ECONOMY_PAGE_SIZE })}`),
  );
}

export function getRecordHistory(recordId: string): Promise<{ record: ProductionRecord; revisions: ProductionRecordRevision[] }> {
  return orNotFound(() => platformApi(`/production-records/${recordId}/history`));
}

export function getProductionSummary(query: ProductionQuery): Promise<ProductionSummary> {
  return platformApi(`/economic-profile/production?${queryString(query)}`);
}

/** Exactly the records the summary for `query` counts, one page at a time. */
export function getProductionRecords(query: ProductionQuery, page: number): Promise<Paged<ProductionRecordListItem>> {
  return platformApi(`/economic-profile/production-records?${queryString({ ...query, page, pageSize: ECONOMY_PAGE_SIZE })}`);
}

export function getEconomyScope(districtId?: string): Promise<EconomyFilterScope> {
  return platformApi(`/economic-profile/scope${districtId ? `?${queryString({ districtId })}` : ""}`);
}
