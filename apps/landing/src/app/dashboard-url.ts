// The one fixed place public dashboard links send people.
// It is set at build time; nothing in the page URL can change it.
export const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim() ||
  "https://dashboard.sarvodayaconnect.com";
