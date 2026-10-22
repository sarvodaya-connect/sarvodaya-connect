import { NotificationCentre } from "@/components/dashboard/notification-centre";
import { PageHeading } from "@/components/dashboard/page-heading";
import { loadDemoList, parseDemoScenario } from "@/lib/demo-scenarios";

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const { demo } = await searchParams;
  // `?demo=loading`, `?demo=error` and `?demo=empty` show the page states.
  const scenario = parseDemoScenario(demo);
  const shown = await loadDemoList(scenario, [true]);

  return (
    <>
      <div className="flex items-center gap-3">
        <PageHeading
          description="Approvals, returns, reminders and alerts for your role, newest first."
          title="Notifications"
        />
      </div>
      <NotificationCentre showEmpty={shown.length === 0} />
    </>
  );
}
