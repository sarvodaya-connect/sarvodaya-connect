import type { DistrictSummary, SocietySummary } from "@sarvodaya-connect/api-contracts";

import { districts, societies } from "./demo-registry";

/**
 * Demonstration scenarios for the society registry.
 *
 * The dashboard still uses fictional fixtures, so loading and failure never
 * happen on their own. Adding `?demo=loading`, `?demo=empty` or `?demo=error`
 * to the Societies page shows those states for review and demonstrations.
 * This module is replaced when the registry is loaded from the API.
 */
export const DEMO_SCENARIOS = ["loading", "empty", "error"] as const;

export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export const DEMO_LOADING_DELAY_MS = 2500;

export function parseDemoScenario(value: string | string[] | undefined): DemoScenario | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return DEMO_SCENARIOS.find((scenario) => scenario === candidate) ?? null;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function loadSocietyRegistry(
  scenario: DemoScenario | null,
): Promise<{ districts: DistrictSummary[]; societies: SocietySummary[] }> {
  if (scenario === "loading") await wait(DEMO_LOADING_DELAY_MS);
  if (scenario === "error") {
    throw new Error("Demonstration scenario: the society registry could not be loaded.");
  }
  if (scenario === "empty") return { districts, societies: [] };
  return { districts, societies };
}
