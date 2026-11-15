"use server";

import type { SocietyMap } from "@sarvodaya-connect/api-contracts";

import { getCurrentViewer } from "@/lib/current-viewer";
import { getSocietyMap } from "@/lib/national-api";

/** V5 D02 society map: every located society for HQ. The API refuses everyone else. */
export async function loadNationalMapPins(): Promise<SocietyMap | { error: string }> {
  await getCurrentViewer();
  try {
    return await getSocietyMap({ status: "ALL" });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The map could not load" };
  }
}
