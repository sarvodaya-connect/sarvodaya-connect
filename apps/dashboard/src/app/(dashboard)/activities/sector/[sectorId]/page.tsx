import { notFound } from 'next/navigation';
import { ActivityOverview } from '@/components/dashboard/activity-overview';
import { PageHeading } from '@/components/dashboard/page-heading';
import { SECTORS } from '@/lib/activity-demo';
export default async function SectorActivityPage({ params }: PageProps<'/activities/sector/[sectorId]'>) {
  const { sectorId } = await params;
  const sector = SECTORS.find(s => s.id === sectorId);
  if (!sector) notFound();
  return <div className="space-y-6"><PageHeading breadcrumbs={[{ href: '/activities', label: 'Activities' }, { label: sector.name }]} title={sector.name} description={`${sector.dimension} dimension · Suggested UN SDGs: ${sector.sdgs.map(s => `SDG ${s}`).join(', ')}. Fictional demonstration data.`} /><ActivityOverview initialSector={sector.id} /></div>;
}
