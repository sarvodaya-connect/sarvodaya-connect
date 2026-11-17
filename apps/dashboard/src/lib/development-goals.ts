import type { ActivityCategory, ActivityDimension } from "@sarvodaya-connect/api-contracts";

import type { MessageKey } from "@/i18n/messages/en";

/**
 * Issue #170: the SPC's Development Goals on the dashboard. The codes and their
 * order are the shared catalogue's (#169, packages/api-contracts/src/activities.ts).
 * The dashboard imports only types from the contracts at run time (like
 * economy-catalogue.ts), so the codes are repeated here, and
 * development-goals-catalogue.test.ts fails if the lists ever differ.
 */
export const DIMENSIONS: readonly ActivityDimension[] = ["SOCIAL", "ECONOMIC", "GOVERNANCE"];
export const CATEGORIES: readonly ActivityCategory[] = [
  "COMMUNITY_EDUCATION",
  "CHILD_WELLBEING",
  "CULTURE",
  "ECONOMY",
  "GOVERNANCE",
  "HEALTH_NUTRITION",
  "HOUSING_INFRASTRUCTURE",
  "SPIRITUAL_DEVELOPMENT",
  "AGRICULTURE",
  "ENVIRONMENT",
];

/** The dashboard's existing translated titles: `dimension.*`, and `sector.1`–`sector.10` in catalogue order. */
export const dimensionKey = (code: ActivityDimension) => `dimension.${code}` as MessageKey;
export const categoryKey = (code: ActivityCategory) => `sector.${CATEGORIES.indexOf(code) + 1}` as MessageKey;

/** The approved V6 artwork, exported unchanged from the prototype (public/dimensions). */
export const dimensionArtwork = (code: ActivityDimension) => `/dimensions/${code.toLowerCase()}.png`;

/** Keeps a selection in catalogue order, whatever order it was chosen in. */
export function inCatalogueOrder<T extends string>(catalogue: readonly T[], selected: Iterable<T>): T[] {
  const chosen = new Set(selected);
  return catalogue.filter((code) => chosen.has(code));
}

export function toggle<T extends string>(catalogue: readonly T[], selected: readonly T[], code: T): T[] {
  return selected.includes(code)
    ? selected.filter((value) => value !== code)
    : inCatalogueOrder(catalogue, [...selected, code]);
}

export interface DevelopmentGoals {
  dimensions: ActivityDimension[];
  categories: ActivityCategory[];
  sdgs: number[];
}

/** What is still missing before the SPC can approve. */
export function missingGoals(goals: DevelopmentGoals) {
  return {
    dimensions: goals.dimensions.length === 0,
    categories: goals.categories.length === 0,
    sdgs: goals.sdgs.length === 0,
  };
}

export const isComplete = (goals: DevelopmentGoals) => !Object.values(missingGoals(goals)).some(Boolean);

/** Only known codes and goals, each once, in catalogue order: never trusts the browser. */
export function cleanGoals(input: { dimensions?: unknown; categories?: unknown; sdgs?: unknown }): DevelopmentGoals {
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  const numbers = Array.isArray(input.sdgs)
    ? input.sdgs.filter((item): item is number => Number.isInteger(item) && item >= 1 && item <= 17)
    : [];
  return {
    dimensions: inCatalogueOrder(DIMENSIONS, strings(input.dimensions) as ActivityDimension[]),
    categories: inCatalogueOrder(CATEGORIES, strings(input.categories) as ActivityCategory[]),
    sdgs: [...new Set(numbers)].sort((a, b) => a - b),
  };
}
