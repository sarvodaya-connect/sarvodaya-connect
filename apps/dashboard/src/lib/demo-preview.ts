import "server-only";
import { cookies } from "next/headers";

import { DEMO_VIEWER_COOKIE, demoViewers, type DemoViewer } from "./access";

/**
 * Demonstration mode only (never in production, see `isDemoMode`): preview the
 * dashboard as each desktop role. Each choice pairs the dashboard viewer with
 * the API's fictional `X-Demo-User` identity for the same role and scope, so
 * the API limits every request exactly as it would for a signed-in user.
 * All names and districts are the fictional SC-29 seed.
 */
export type PreviewChoice = { id: string; principal: string; viewer: DemoViewer };

const NORTH = "29000000-0000-4000-8000-000000000001";
const SUNRISE = "29000000-0000-4000-8000-000000000101";
const RIVER = "29000000-0000-4000-8000-000000000102";

export const PREVIEW_CHOICES: readonly PreviewChoice[] = [
  { id: "hq-admin", principal: "demo-hq-admin", viewer: demoViewers[0]! },
  {
    id: "district-manager",
    principal: "demo-dm-north",
    viewer: {
      id: "district-manager",
      displayName: "Demo District Manager",
      initials: "DM",
      role: "DISTRICT_MANAGER",
      roleLabel: "District Manager",
      scopeLabel: "Fictional North District",
      districtIds: [NORTH],
      societyIds: [],
    },
  },
  {
    id: "deputy-district-manager",
    principal: "demo-deputy-district-manager",
    viewer: {
      id: "deputy-district-manager",
      displayName: "Demo Deputy District Manager",
      initials: "DD",
      role: "DEPUTY_DISTRICT_MANAGER",
      roleLabel: "Deputy District Manager",
      scopeLabel: "Fictional North District",
      districtIds: [],
      societyIds: [SUNRISE],
    },
  },
  {
    id: "programme-coordinator",
    principal: "demo-programme-coordinator",
    viewer: {
      id: "programme-coordinator",
      displayName: "Demo Programme Coordinator",
      initials: "PC",
      role: "PROGRAMME_COORDINATOR",
      roleLabel: "Society Program Coordinator",
      scopeLabel: "2 societies",
      districtIds: [],
      societyIds: [SUNRISE, RIVER],
    },
  },
];

export function previewChoice(id: string | undefined | null): PreviewChoice {
  return PREVIEW_CHOICES.find((choice) => choice.id === id) ?? PREVIEW_CHOICES[0]!;
}

/** The role being previewed, from the demonstration cookie. HQ when none is chosen. */
export async function currentPreview(): Promise<PreviewChoice> {
  return previewChoice((await cookies()).get(DEMO_VIEWER_COOKIE)?.value);
}
