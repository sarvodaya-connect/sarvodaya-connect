import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NotificationsProvider } from "@/components/dashboard/notifications-context";
import { getSpcViewer } from "@/lib/current-viewer";
import { notificationsFor } from "@/lib/demo-notifications";

/** V5 SP06–SP08: the SPC's desktop pages, with the SPC sidebar (SP01). */
export default async function SpcLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getSpcViewer();
  return (
    <NotificationsProvider initial={notificationsFor(viewer)} key={viewer.id}>
      <DashboardShell viewer={viewer}>{children}</DashboardShell>
    </NotificationsProvider>
  );
}
