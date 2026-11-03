import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleAlerts, type RoleAlert } from "@/components/dashboard/emergencies/role-alerts";
import { NotificationsProvider } from "@/components/dashboard/notifications-context";
import { getDesktopViewer } from "@/lib/current-viewer";
import { notificationsFor } from "@/lib/demo-notifications";
import { isDemoMode, platformApi } from "@/lib/platform-api";

import { openNotification } from "./emergencies/actions";

type AlertPage = { data: RoleAlert[]; meta: { unreadCount: number } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // HQ pages also check the role themselves; SPCs, DDMs and DMs reach only their own pages (middleware.ts).
  const viewer = await getDesktopViewer();
  // V5 IR05: SPCs, DDMs and DMs see their own notifications from the API under the bell.
  // HQ keeps the alerts page (D19, PR 9).
  const roleAlerts =
    viewer.role !== "HQ_ADMIN" && !isDemoMode() ? await (platformApi("/notifications?pageSize=8") as Promise<AlertPage>).catch(() => null) : undefined;

  return (
    // Keyed by viewer so switching the demonstration user starts with that user's notifications.
    <NotificationsProvider initial={notificationsFor(viewer)} key={viewer.id}>
      <DashboardShell
        alerts={
          roleAlerts === undefined ? undefined : (
            <RoleAlerts alerts={roleAlerts?.data ?? null} open={openNotification} unreadCount={roleAlerts?.meta.unreadCount ?? 0} />
          )
        }
        viewer={viewer}
      >
        {children}
      </DashboardShell>
    </NotificationsProvider>
  );
}
