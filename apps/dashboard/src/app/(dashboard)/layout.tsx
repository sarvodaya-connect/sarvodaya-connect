import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleAlerts, type RoleAlert } from "@/components/dashboard/emergencies/role-alerts";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getUnreadAlertCount } from "@/lib/national-api";
import { isDemoMode, platformApi } from "@/lib/platform-api";

import { openNotification } from "./emergencies/actions";

type AlertPage = { data: RoleAlert[]; meta: { unreadCount: number } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // HQ pages also check the role themselves; SPCs, DDMs and DMs reach only their own pages (middleware.ts).
  const viewer = await getDesktopViewer();
  // V5 IR05: SPCs, DDMs and DMs see their own notifications from the API under the bell.
  // HQ's bell links to the Alerts page (D19) with the unread count from the API.
  const isHq = viewer.role === "HQ_ADMIN";
  const [roleAlerts, unreadCount] = await Promise.all([
    !isHq && !isDemoMode() ? (platformApi("/notifications?pageSize=8") as Promise<AlertPage>).catch(() => null) : undefined,
    isHq ? getUnreadAlertCount() : 0,
  ]);

  return (
    <DashboardShell
      alerts={
        roleAlerts === undefined ? undefined : (
          <RoleAlerts alerts={roleAlerts?.data ?? null} open={openNotification} unreadCount={roleAlerts?.meta.unreadCount ?? 0} />
        )
      }
      unreadCount={unreadCount}
      viewer={viewer}
    >
      {children}
    </DashboardShell>
  );
}
