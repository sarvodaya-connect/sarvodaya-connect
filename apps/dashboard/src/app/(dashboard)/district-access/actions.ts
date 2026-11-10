"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getT } from "@/i18n/server";
import { getDesktopViewer } from "@/lib/current-viewer";
import { platformApi } from "@/lib/platform-api";

export type AccessFormState = { error?: string };

/** datetime-local has no offset: read it as Sri Lanka time (UTC+05:30). */
function sriLankaTime(value: string): Date {
  return new Date(`${value}:00+05:30`);
}

/** V5 DM05: give a DDM in the district view-only access for a set time. The API checks every rule again. */
export async function giveDistrictAccess(_state: AccessFormState, form: FormData): Promise<AccessFormState> {
  const viewer = await getDesktopViewer();
  const t = await getT();
  if (viewer.role !== "DISTRICT_MANAGER") return { error: t("da.errOnlyDm") };
  const districtId = Array.isArray(viewer.districtIds) ? viewer.districtIds[0] : undefined;
  const deputyId = String(form.get("deputyId") ?? "");
  const startsAt = String(form.get("startsAt") ?? "");
  const expiresAt = String(form.get("expiresAt") ?? "");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 1000);
  if (!districtId) return { error: t("da.errNoDistrict") };
  if (!deputyId) return { error: t("da.errChooseDdm") };
  if (!startsAt || !expiresAt) return { error: t("da.errChooseTime") };
  const start = sriLankaTime(startsAt);
  const end = sriLankaTime(expiresAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return { error: t("da.errChooseTime") };
  if (end <= start) return { error: t("da.errEndAfter") };
  let id: string;
  try {
    const grant: { id: string } = await platformApi("/identity/district-access", {
      method: "POST",
      body: JSON.stringify({ deputyId, districtId, startsAt: start.toISOString(), expiresAt: end.toISOString(), ...(reason ? { reason } : {}) }),
    });
    id = grant.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : t("da.errCouldNot") };
  }
  revalidatePath("/district-access");
  revalidatePath("/dashboard");
  redirect(`/district-access?given=${encodeURIComponent(id)}`);
}

/** "End access now" (DM01, DM04). The DDM loses the district on their next request. */
export async function endDistrictAccess(form: FormData): Promise<void> {
  const viewer = await getDesktopViewer();
  if (viewer.role !== "DISTRICT_MANAGER") redirect("/dashboard");
  const id = String(form.get("grantId") ?? "");
  const back = form.get("returnTo") === "/dashboard" ? "/dashboard" : "/district-access";
  let ended = true;
  try {
    await platformApi(`/identity/district-access/${encodeURIComponent(id)}/revoke`, { method: "POST", body: "{}" });
  } catch {
    ended = false;
  }
  revalidatePath("/district-access");
  revalidatePath("/dashboard");
  redirect(`${back}?${ended ? "ended" : "endFailed"}=1`);
}
