"use client";

import type { NationalOverview } from "@sarvodaya-connect/api-contracts";

import { HqOverview } from "./hq/hq-overview";

/**
 * V5 D02 National Dashboard (HQ only; the API refuses everyone else). The
 * page and its data stay as they were; the HQ redesign lives in ./hq so no
 * other role's home or shared part changes with it.
 */
export function NationalOverviewView({ demo, overview, years }: { demo: boolean; overview: NationalOverview; years: number[] }) {
  return <HqOverview demo={demo} overview={overview} years={years} />;
}
