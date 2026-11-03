import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NotificationsProvider } from "@/components/dashboard/notifications-context";
import { getDesktopViewer } from "@/lib/current-viewer";
import { notificationsFor } from "@/lib/demo-notifications";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // HQ pages also check the role themselves; SPCs, DDMs and DMs reach only their own pages (middleware.ts).
  const viewer = await getDesktopViewer();

  return (
    // Keyed by viewer so switching the demonstration user starts with that user's notifications.
    <NotificationsProvider initial={notificationsFor(viewer)} key={viewer.id}>
      <DashboardShell viewer={viewer}>{children}</DashboardShell>
    </NotificationsProvider>
  );
}
