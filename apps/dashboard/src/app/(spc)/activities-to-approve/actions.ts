"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { asSpc } from "@/lib/activities-api";
import { getSpcViewer } from "@/lib/current-viewer";
import { platformApi } from "@/lib/platform-api";

function withSpc(init: RequestInit): RequestInit {
  const demo = asSpc();
  return { ...init, headers: { ...(demo.headers as Record<string, string> | undefined), ...(init.headers as Record<string, string> | undefined) } };
}

/**
 * V5 SP07: the SPC approves with the UN SDGs they chose. The API checks that
 * the SPC is assigned to the society, needs at least one goal and refuses a
 * second decision.
 */
export async function approveActivity(id: string, sdgs: number[]): Promise<{ error?: string }> {
  await getSpcViewer();
  if (sdgs.length === 0) return { error: "Choose at least one UN SDG to approve." };
  try {
    await platformApi(`/activities/${id}/approve`, withSpc({ method: "POST", body: JSON.stringify({ sdgs }) }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The approval could not be saved. Try again." };
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
