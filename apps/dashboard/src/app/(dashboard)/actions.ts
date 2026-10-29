"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isDemoMode } from "@/lib/platform-api";
import { DEMO_VIEWER_COOKIE, demoViewers } from "@/lib/access";

async function setViewerCookie(id: string) {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_VIEWER_COOKIE, id, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
}

/** Switches the demonstration user. Unknown values are ignored. */
export async function switchDemoViewer(formData: FormData) {
  if (!isDemoMode()) return;
  const id = formData.get("viewer");
  if (typeof id !== "string" || !demoViewers.some((viewer) => viewer.id === id)) return;
  await setViewerCookie(id);
}

/**
 * Catalogue D01: the "Continue as …" role picker on sign-in. Sets the demo
 * viewer cookie and jumps straight to the dashboard home.
 */
export async function signInAs(formData: FormData) {
  if (!isDemoMode()) return;
  const id = formData.get("viewer");
  if (typeof id !== "string" || !demoViewers.some((viewer) => viewer.id === id)) return;
  await setViewerCookie(id);
  redirect("/dashboard");
}
