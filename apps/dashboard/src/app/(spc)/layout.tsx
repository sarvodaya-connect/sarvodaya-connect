import { openNotification } from "@/app/(dashboard)/emergencies/actions";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RoleAlerts, type RoleAlert } from "@/components/dashboard/emergencies/role-alerts";
import { getSpcViewer } from "@/lib/current-viewer";
import { isDemoMode, platformApi } from "@/lib/platform-api";

type AlertPage = { data: RoleAlert[]; meta: { unreadCount: number } };

/** V5 SP06–SP08: the SPC's desktop pages, with the SPC sidebar (SP01) and their own alerts (IR05). */
export default async function SpcLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getSpcViewer();
  const alerts = isDemoMode() ? undefined : await (platformApi("/notifications?pageSize=8") as Promise<AlertPage>).catch(() => null);
  return (
    <DashboardShell
      alerts={alerts === undefined ? undefined : <RoleAlerts alerts={alerts?.data ?? null} open={openNotification} unreadCount={alerts?.meta.unreadCount ?? 0} />}
      viewer={viewer}
    >
      {children}
    </DashboardShell>
  );
}
