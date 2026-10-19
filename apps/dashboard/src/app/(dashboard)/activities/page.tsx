import { ActivityOverview } from '@/components/dashboard/activity-overview';
import { PageHeading } from '@/components/dashboard/page-heading';
export default function ActivitiesPage() { return <div className="space-y-6"><PageHeading title="Programme & activity overview" description="Inspect fictional programme activity, monitor approvals and explore Sarvodaya sectors." /><ActivityOverview /></div>; }
