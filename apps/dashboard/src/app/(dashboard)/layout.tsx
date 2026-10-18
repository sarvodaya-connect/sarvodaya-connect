import { Suspense } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f4f5ef] p-8">Loading dashboard…</main>}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
