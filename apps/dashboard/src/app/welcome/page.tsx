import type { Metadata } from "next";

import { getDesktopViewer } from "@/lib/current-viewer";

import { SignInWelcome } from "./sign-in-welcome";

export const metadata: Metadata = {
  title: "Welcome | Sarvodaya Connect",
  robots: { index: false, follow: false },
};

/** Successful sign-in enters here; normal dashboard navigation skips the tribute. */
export default async function WelcomePage() {
  // Validate the current account on the server before rendering, for every desktop role.
  await getDesktopViewer();
  return <SignInWelcome />;
}
