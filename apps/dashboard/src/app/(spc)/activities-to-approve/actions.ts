"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActivityApprovalInput } from "@sarvodaya-connect/api-contracts";

import type { ApproveResult } from "@/components/dashboard/activities/activity-review";
import { asSpc } from "@/lib/activities-api";
import { getSpcViewer } from "@/lib/current-viewer";
import { PlatformApiError, platformApi } from "@/lib/platform-api";

function withSpc(init: RequestInit): RequestInit {
  const demo = asSpc();
  return { ...init, headers: { ...(demo.headers as Record<string, string> | undefined), ...(init.headers as Record<string, string> | undefined) } };
}

/**
 * V6 SP07r: the SPC approves with the Sarvodaya dimensions, categories and UN
 * SDGs they chose. The API checks that the SPC is assigned to the society,
 * needs at least one of each and refuses a second decision. `submittedAt` is
 * the submission the SPC reviewed, so a resent activity is not approved unseen.
 */
export async function approveActivity(
  id: string,
  submittedAt: string | undefined,
  input: ActivityApprovalInput,
): Promise<ApproveResult> {
  await getSpcViewer();
  if (input.dimensions.length === 0 || input.categories.length === 0 || input.sdgs.length === 0) {
    return { kind: "invalid", error: "Choose at least one Sarvodaya dimension, one Sarvodaya category and one UN SDG." };
  }
  try {
    await platformApi(
      `/activities/${id}/approve`,
      withSpc({
        method: "POST",
        body: JSON.stringify({ sdgs: input.sdgs, dimensions: input.dimensions, categories: input.categories, submittedAt }),
      }),
    );
  } catch (error) {
    if (error instanceof PlatformApiError) {
      // Decided, changed or no longer ours: nothing was saved, so show the activity as it is now.
      if ([403, 404, 409].includes(error.status)) {
        revalidatePath(`/activities-to-approve/${id}`);
        return { kind: "stale", error: error.message };
      }
      if (error.status === 400) return { kind: "invalid", error: error.message };
    }
    return { kind: "failed" };
  }
  revalidatePath("/activities-to-approve", "layout");
  redirect(`/activities-to-approve?approved=${id}`);
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
