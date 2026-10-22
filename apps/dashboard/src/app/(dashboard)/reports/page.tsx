import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/dashboard/page-heading';
import { ReportBuilder } from '@/components/dashboard/report-builder';
import { getCurrentViewer } from '@/lib/current-viewer';
import { reportRecordsFor } from '@/lib/report-data';

export default async function ReportsPage() {
  const viewer = await getCurrentViewer();
  if (viewer.role === 'SYSTEM_ADMIN') redirect('/admin');
  return <div className="space-y-6"><PageHeading title="Reports & report builder" description="Run standard society, membership and activity reports or build a report from approved fields." /><ReportBuilder records={reportRecordsFor(viewer)} /></div>;
}
