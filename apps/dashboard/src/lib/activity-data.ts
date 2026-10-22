import { canSeeSociety, type DemoViewer } from './access';
import { societies } from './demo-registry';
import { SECTORS, type ActivityRecord, type ActivityStatus } from './activity-demo';

// Only server pages import this dataset and supply scoped records to the client.
// Society and district IDs match the existing registry and access rules.
export const ACTIVITIES: readonly ActivityRecord[] = Array.from({ length: 40 }, (_, i) => {
  const sector = SECTORS[i % SECTORS.length];
  const society = societies[i % societies.length];
  const status: ActivityStatus = (['APPROVED', 'APPROVED', 'SUBMITTED', 'PLANNED', 'CHANGES_REQUESTED'] as const)[i % 5];
  return {
    id: `ACT-2026-${String(i + 1).padStart(4, '0')}`,
    societyId: society.id,
    districtId: society.district.id,
    title: `${sector.name} community programme ${String(i + 1).padStart(2, '0')}`,
    district: society.district.nameEn,
    society: society.nameEn,
    sectorId: sector.id,
    date: `2026-${String(1 + i % 10).padStart(2, '0')}-${String(1 + (i * 7) % 27).padStart(2, '0')}`,
    status,
    plannedValueLkr: 25000 + (i % 7) * 17500,
    participants: 12 + (i * 13) % 85,
    description: `Fictional demonstration activity organised by ${society.nameEn} in ${society.district.nameEn}.`,
    sdgs: sector.sdgs,
  };
});

export function activitiesVisibleTo(viewer: DemoViewer): ActivityRecord[] {
  return ACTIVITIES.filter(record => canSeeSociety(viewer, record));
}
