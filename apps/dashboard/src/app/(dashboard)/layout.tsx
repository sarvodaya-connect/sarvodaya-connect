import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getUnreadAlertCount } from "@/lib/national-api";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [viewer, unreadCount] = await Promise.all([getCurrentViewer(), getUnreadAlertCount()]);

  return (
    <DashboardShell unreadCount={unreadCount} viewer={viewer}>{children}</DashboardShell>
  );
}
