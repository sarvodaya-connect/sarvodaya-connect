import { redirect } from "next/navigation";
import { demoViewers, type DemoViewer } from "./access";
import { isDemoMode, platformApi } from "./platform-api";

/** Where an SPC lands on the desktop. Their other desktop pages open in PR 6 of the V5 plan. */
export const SPC_DESKTOP_HOME = "/activities-to-approve";

type SignedInUser = { id: string; displayName: string; roles: string[]; societyIds?: string[] };

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
  } catch {
    redirect("/");
  }
}

/** HQ pages. An SPC is sent to their activities; everyone else to the phone app. */
export async function getCurrentViewer(): Promise<DemoViewer> {
  if (isDemoMode()) return demoViewers[0]!;
  const user = await signedInUser();
  if (!user.roles.includes("HQ_ADMIN")) {
    redirect(user.roles.includes("PROGRAMME_COORDINATOR") ? SPC_DESKTOP_HOME : "/?access=mobile");
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
