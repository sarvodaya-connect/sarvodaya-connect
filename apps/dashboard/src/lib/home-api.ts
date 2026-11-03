import "server-only";

import type { HomeSocietyList, HomeSummary } from "@sarvodaya-connect/api-contracts";

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
