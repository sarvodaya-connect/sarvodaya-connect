"use client";

import { useEffect } from "react";

import { DASHBOARD_URL } from "../../dashboard-url";

/** Compatibility for old bookmarks: the tribute now follows successful sign-in. */
export function DashboardEntry() {
  useEffect(() => {
    window.location.replace(DASHBOARD_URL);
  }, []);
  return <main className="grid min-h-dvh place-items-center bg-white"><a href={DASHBOARD_URL}>Continue to staff sign-in</a></main>;
}
