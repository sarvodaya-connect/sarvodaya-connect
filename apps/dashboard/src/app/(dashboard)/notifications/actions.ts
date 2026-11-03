"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentViewer } from "@/lib/current-viewer";
import { platformApi } from "@/lib/platform-api";

/** V5 D19 "Mark all read" for the signed-in user only (the API checks). */
export async function markAllAlertsRead() {
  await getCurrentViewer();
  await platformApi("/notifications/read-all", { method: "POST" });
  revalidatePath("/", "layout");
}

/** Opens an alert: marks it read, then goes to the page it links to. */
export async function openAlert(formData: FormData) {
  await getCurrentViewer();
  const id = String(formData.get("id") ?? "");
  const link = String(formData.get("link") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(id)) await platformApi(`/notifications/${id}/read`, { method: "POST" }).catch(() => undefined);
  revalidatePath("/", "layout");
  // Only paths inside the dashboard, never another site.
  redirect(link.startsWith("/") && !link.startsWith("//") ? link : "/notifications");
}
