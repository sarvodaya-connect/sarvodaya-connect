import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getSpcViewer } from "@/lib/current-viewer";
import { getUnreadAlertCount } from "@/lib/national-api";

/** V5 SP06–SP08: the SPC's desktop pages, with the SPC sidebar (SP01). */
export default async function SpcLayout({ children }: { children: React.ReactNode }) {
  const [viewer, unreadCount] = await Promise.all([getSpcViewer(), getUnreadAlertCount()]);
  return (
    <DashboardShell unreadCount={unreadCount} viewer={viewer}>{children}</DashboardShell>
  );
}
