"use server";

import type { SocietyAtAGlance, SocietyMap } from "@sarvodaya-connect/api-contracts";

import { getCurrentViewer } from "@/lib/current-viewer";
import { getSocietyMap } from "@/lib/national-api";
import { platformApi } from "@/lib/platform-api";

/** V5 D03 "Selected society". The API checks the viewer's scope. */
export async function loadSocietySummary(id: string): Promise<SocietyAtAGlance | { error: string }> {
  await getCurrentViewer();
  try {
    return await platformApi(`/societies/${encodeURIComponent(id)}/summary`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The society could not be loaded" };
  }
}

/** V5 D02 society map: every located society for HQ. The API refuses everyone else. */
export async function loadNationalMapPins(): Promise<SocietyMap | { error: string }> {
  await getCurrentViewer();
  try {
    return await getSocietyMap({ status: "ALL" });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The map could not load" };
  }
}
