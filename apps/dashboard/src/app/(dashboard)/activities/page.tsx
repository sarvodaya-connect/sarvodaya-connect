import { ActivityOverview } from '@/components/dashboard/activity-overview';
import { PageHeading } from '@/components/dashboard/page-heading';
import { redirect } from 'next/navigation';
import { activitiesVisibleTo } from '@/lib/activity-data';
import { getCurrentViewer } from '@/lib/current-viewer';
export default async function ActivitiesPage() {
  const viewer = await getCurrentViewer();
  if (viewer.role === 'SYSTEM_ADMIN') redirect('/admin');
  const records = activitiesVisibleTo(viewer);
  return <div className="space-y-6"><PageHeading title="Programme & activity overview" description="Inspect fictional programme activity, monitor approvals and explore Sarvodaya sectors." /><ActivityOverview key={viewer.id} records={records} /></div>;
}
