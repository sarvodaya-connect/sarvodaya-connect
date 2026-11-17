"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getT } from "@/i18n/server";
import { asSpc } from "@/lib/activities-api";
import { getSpcViewer } from "@/lib/current-viewer";
import { cleanGoals, isComplete } from "@/lib/development-goals";
import { PlatformApiError, platformApi } from "@/lib/platform-api";

function withSpc(init: RequestInit): RequestInit {
  const demo = asSpc();
  return { ...init, headers: { ...(demo.headers as Record<string, string> | undefined), ...(init.headers as Record<string, string> | undefined) } };
}

/**
 * Why an approval was not saved:
 * - `invalid`: the API refused the choices (400). Its message is shown and the choices stay.
 * - `stale`: the activity is no longer this SPC's to decide (already decided, 409; or out of scope, 403/404).
 *   A second decision is never offered.
 * - `failed`: the API could not be reached or failed. Nothing changed; the SPC can try again.
 */
export type ApprovalResult = { error?: string; kind?: "invalid" | "stale" | "failed" };

/**
 * V6 SP07r/SP07s (#170): the SPC approves with the Development Goals they chose:
 * one or more dimensions, one or more of the ten categories and the UN SDGs. The
 * API checks the SPC is assigned to the society, refuses unknown or missing
 * choices and writes everything with the approval, in one transaction (#169).
 */
export async function approveActivity(id: string, input: { dimensions: unknown; categories: unknown; sdgs: unknown }): Promise<ApprovalResult> {
  await getSpcViewer();
  const t = await getT();
  const goals = cleanGoals(input);
  if (!isComplete(goals)) return { error: t("dg.error.incomplete"), kind: "invalid" };
  try {
    await platformApi(`/activities/${id}/approve`, withSpc({ method: "POST", body: JSON.stringify(goals) }));
  } catch (error) {
    const status = error instanceof PlatformApiError ? error.status : 0;
    if (status === 409 || status === 403 || status === 404) return { error: t("dg.error.stale"), kind: "stale" };
    if (status === 400 && error instanceof Error) return { error: error.message, kind: "invalid" };
    return { error: t("dg.error.failed"), kind: "failed" };
  }
  revalidatePath("/activities-to-approve", "layout");
  redirect(`/activities-to-approve?approved=${encodeURIComponent(id)}`);
}

/** V5 M51b on the desktop: the activity goes back to the Society Officer to change. */
export async function sendBackActivity(id: string, comment: string): Promise<{ error?: string }> {
  await getSpcViewer();
  const text = comment.trim().slice(0, 500);
  try {
    await platformApi(
      `/activities/${id}/send-back`,
      withSpc({ method: "POST", body: JSON.stringify(text ? { comment: text } : {}) }),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The activity could not be sent back. Try again." };
  }
  revalidatePath("/activities-to-approve", "layout");
  redirect(`/activities-to-approve?sentBack=${id}`);
}
