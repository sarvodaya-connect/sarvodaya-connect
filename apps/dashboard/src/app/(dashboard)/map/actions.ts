"use server";

import type { SocietyAtAGlance } from "@sarvodaya-connect/api-contracts";

import { getCurrentViewer } from "@/lib/current-viewer";
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
