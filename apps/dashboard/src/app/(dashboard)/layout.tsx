import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NotificationsProvider } from "@/components/dashboard/notifications-context";
import { getCurrentViewer } from "@/lib/current-viewer";
import { notificationsFor } from "@/lib/demo-notifications";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getCurrentViewer();

  return (
    // Keyed by viewer so switching the demonstration user starts with that user's notifications.
    <NotificationsProvider initial={notificationsFor(viewer)} key={viewer.id}>
      <DashboardShell viewer={viewer}>{children}</DashboardShell>
    </NotificationsProvider>
  );
}
