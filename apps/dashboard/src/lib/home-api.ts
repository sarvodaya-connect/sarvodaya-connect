import "server-only";

import type { HomeSocietyList, HomeSummary, ScopedAudits, ScopedMembership } from "@sarvodaya-connect/api-contracts";

import type { SocietyFilters } from "./home-format";
import { platformApi } from "./platform-api";

/** V5 SP01 / DD01 / DM01. The API works out every figure from the user's own societies. */
export function getHome(): Promise<HomeSummary> {
  return platformApi("/home");
}

export type { SocietyFilters as HomeSocietyFilters } from "./home-format";

/** V5 SP02 / DD03 / DM02. Unknown filter values are dropped before they reach the API. */
export function getHomeSocieties(filters: SocietyFilters): Promise<HomeSocietyList> {
  const query = new URLSearchParams({ pageSize: "20" });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return platformApi(`/home/societies?${query}`);
}

/** Issue #118: D08 Membership for the user's own societies; a DDM may ask for their temporary district view. */
export function getHomeMembership(scope?: "DISTRICT"): Promise<ScopedMembership> {
  return platformApi(scope ? "/home/membership?scope=DISTRICT" : "/home/membership");
}

/** Issue #119: D11 Audits & AGM for the user's own societies and one financial year. */
export function getHomeAudits(input: { year?: number; page?: number; scope?: "DISTRICT" }): Promise<ScopedAudits> {
  const query = new URLSearchParams({ page: String(input.page ?? 1) });
  if (input.year) query.set("year", String(input.year));
  if (input.scope) query.set("scope", input.scope);
  return platformApi(`/home/audits?${query}`);
}
