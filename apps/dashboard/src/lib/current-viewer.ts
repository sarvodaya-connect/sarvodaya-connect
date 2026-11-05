import { redirect } from "next/navigation";
import { demoViewers, type DemoViewer } from "./access";
import { isDemoMode, isTransientPlatformError, platformApi } from "./platform-api";

/** Roles with a desktop dashboard. Society Officers use the phone app. */
export const DESKTOP_ROLES = ["HQ_ADMIN", "DISTRICT_MANAGER", "DEPUTY_DISTRICT_MANAGER", "PROGRAMME_COORDINATOR"] as const;
export type DesktopRole = (typeof DESKTOP_ROLES)[number];

/** Cookie naming the signed-in role, used only to keep each role on its own pages (see middleware.ts). */
export { ROLE_COOKIE } from "./role-routes";

type SignedInUser = { id: string; displayName: string; roles: string[]; districtIds?: string[]; societyIds?: string[] };

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("");
}

async function signedInUser(): Promise<SignedInUser> {
  try {
    return await platformApi("/identity/me");
  } catch (error) {
    // A busy API has not signed anyone out: show the page's retryable error instead.
    if (isTransientPlatformError(error)) throw error;
    redirect("/");
  }
}

/** HQ pages. SPCs, DDMs and DMs are sent to their own home; everyone else to the phone app. */
export async function getCurrentViewer(): Promise<DemoViewer> {
  if (isDemoMode()) return demoViewers[0]!;
  const user = await signedInUser();
  if (!user.roles.includes("HQ_ADMIN")) {
    redirect(DESKTOP_ROLES.some((role) => user.roles.includes(role)) ? "/dashboard" : "/?access=mobile");
  }
  return {
    id: user.id,
    displayName: user.displayName,
    initials: initialsOf(user.displayName),
    role: "HQ_ADMIN",
    roleLabel: "HQ",
    scopeLabel: "National",
    districtIds: "ALL",
  };
}

/**
 * V5 SP06–SP08: the SPC's desktop pages. The API checks every request against
 * the SPC's assigned societies; HQ is sent back to the national overview.
 */
export async function getSpcViewer(): Promise<DemoViewer> {
  if (isDemoMode()) return demoViewers.find((viewer) => viewer.role === "PROGRAMME_COORDINATOR")!;
  const user = await signedInUser();
  if (!user.roles.includes("PROGRAMME_COORDINATOR")) {
    redirect(user.roles.includes("HQ_ADMIN") ? "/dashboard" : "/?access=mobile");
  }
  const count = user.societyIds?.length ?? 0;
  return {
    id: user.id,
    displayName: user.displayName,
    initials: initialsOf(user.displayName),
    role: "PROGRAMME_COORDINATOR",
    roleLabel: "SPC",
    scopeLabel: `${count} ${count === 1 ? "society" : "societies"}`,
    districtIds: [],
    societyIds: user.societyIds ?? [],
  };
}

const ROLE_LABEL: Record<Exclude<DesktopRole, "HQ_ADMIN">, string> = {
  DISTRICT_MANAGER: "District Manager",
  DEPUTY_DISTRICT_MANAGER: "Deputy District Manager",
  PROGRAMME_COORDINATOR: "Society Program Coordinator",
};

/**
 * V5 PR 6: pages open to every desktop role — the role homes (SP01, DD01,
 * DM01), their society lists and the society record. The API limits what each
 * request returns to the user's own societies or district.
 */
export async function getDesktopViewer(): Promise<DemoViewer> {
  if (isDemoMode()) return demoViewers[0]!;
  const user = await signedInUser();
  const role = DESKTOP_ROLES.find((candidate) => user.roles.includes(candidate));
  if (!role) redirect("/?access=mobile");
  if (role === "HQ_ADMIN") return getCurrentViewer();
  const base = { id: user.id, displayName: user.displayName, initials: initialsOf(user.displayName), role, roleLabel: ROLE_LABEL[role] };
  if (role === "PROGRAMME_COORDINATOR") {
    const count = user.societyIds?.length ?? 0;
    return { ...base, scopeLabel: `${count} ${count === 1 ? "society" : "societies"}`, districtIds: [], societyIds: user.societyIds ?? [] };
  }
  // DM and DDM: the sidebar shows their district by name ("DM · Kurunegala").
  const districts: { data: { id: string; nameEn: string }[] } = await platformApi("/districts").catch(() => ({ data: [] }));
  const district = districts.data.find((d) => d.id === user.districtIds?.[0]);
  return { ...base, scopeLabel: district?.nameEn ?? "District", districtIds: user.districtIds ?? [], societyIds: user.societyIds ?? [] };
}
