// The one fixed place dashboard links and the entry screen send people.
// It is set at build time; nothing in the page URL can change it.
export const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim() ||
  "https://dashboard.sarvodayaconnect.com";

// Shown for about five seconds on the way from the public site to the dashboard.
export const DASHBOARD_ENTRY_PATH = "/dashboard/enter";
