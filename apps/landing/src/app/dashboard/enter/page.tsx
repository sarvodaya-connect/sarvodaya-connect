import type { Metadata } from "next";

import { DashboardEntry } from "./dashboard-entry";

export const metadata: Metadata = {
  title: "Opening the Staff Dashboard | Sarvodaya Connect",
  robots: { index: false, follow: false },
};

export default function DashboardEntryPage() {
  return <DashboardEntry />;
}
