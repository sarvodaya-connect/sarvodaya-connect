"use server";

import { cookies } from "next/headers";

import { DEMO_VIEWER_COOKIE, demoViewers } from "@/lib/access";

/** Switches the demonstration user. Unknown values are ignored. */
export async function switchDemoViewer(formData: FormData) {
  const id = formData.get("viewer");
  if (typeof id !== "string" || !demoViewers.some((viewer) => viewer.id === id)) return;
  const cookieStore = await cookies();
  cookieStore.set(DEMO_VIEWER_COOKIE, id, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
}
