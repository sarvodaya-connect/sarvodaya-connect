"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isDemoMode } from "@/lib/platform-api";
import { DEMO_VIEWER_COOKIE, demoViewers } from "@/lib/access";
import { PREVIEW_CHOICES } from "@/lib/demo-preview";
import { ROLE_COOKIE } from "@/lib/role-routes";

async function setViewerCookie(id: string) {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_VIEWER_COOKIE, id, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
}

/**
 * Demonstration mode only: "Preview as" another desktop role. Sets the same
 * role cookie as a real sign-in, so each role reaches only its own pages, and
 * goes to that role's home. Unknown values are ignored.
 */
export async function switchDemoViewer(formData: FormData) {
  if (!isDemoMode()) return;
  const id = formData.get("viewer");
  const choice = PREVIEW_CHOICES.find((candidate) => candidate.id === id);
  if (!choice) return;
  await setViewerCookie(choice.id);
  const cookieStore = await cookies();
  if (choice.viewer.role === "HQ_ADMIN") cookieStore.delete(ROLE_COOKIE);
  else cookieStore.set(ROLE_COOKIE, choice.viewer.role, { httpOnly: true, path: "/", sameSite: "lax" });
  redirect("/dashboard");
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
