import { redirect } from "next/navigation";
import { demoViewers, type DemoViewer } from "./access";
import { isDemoMode, platformApi } from "./platform-api";
export async function getCurrentViewer(): Promise<DemoViewer> {
  if (isDemoMode()) return demoViewers[0]!;
  let user;
  try {
    user = await platformApi("/identity/me");
  } catch {
    redirect("/");
  }
  if (!user.roles.includes("HQ_ADMIN")) redirect("/?access=mobile");
  return {
    id: user.id,
    displayName: user.displayName,
    initials: user.displayName
      .split(" ")
      .map((s: string) => s[0])
      .slice(0, 2)
      .join(""),
    role: "HQ_ADMIN",
    roleLabel: "HQ",
    scopeLabel: "National",
    districtIds: "ALL",
  };
}
