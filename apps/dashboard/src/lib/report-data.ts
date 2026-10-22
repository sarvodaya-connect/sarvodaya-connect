import { canSeeSociety, type DemoViewer } from './access';
import { societyDetails } from './demo-registry';
import { demoMembershipSocieties } from './demo-membership';
import type { ReportRecord } from './report-builder';

export function reportRecordsFor(viewer: DemoViewer): ReportRecord[] {
  const societies = societyDetails.filter(society => canSeeSociety(viewer, { societyId: society.id, districtId: society.district.id }));
  const membership = demoMembershipSocieties.filter(row => canSeeSociety(viewer, row));
  const activities = Array.from({ length: 40 }, (_, i) => {
    const society = societyDetails[i % societyDetails.length];
    return {
      id: `ACT-2026-${String(i + 1).padStart(4, '0')}`,
      societyId: society.id,
      districtId: society.district.id,
      society: society.nameEn,
      district: society.district.nameEn,
      sector: ['education', 'health', 'water', 'children', 'agriculture', 'livelihoods', 'environment', 'housing', 'governance', 'disaster'][i % 10],
      date: `2026-${String(1 + i % 10).padStart(2, '0')}-${String(1 + (i * 7) % 27).padStart(2, '0')}`,
      status: (['APPROVED', 'APPROVED', 'SUBMITTED', 'PLANNED', 'CHANGES_REQUESTED'] as const)[i % 5],
      participants: 12 + (i * 13) % 85,
      plannedValueLkr: 25000 + (i % 7) * 17500,
    };
  }).filter(row => canSeeSociety(viewer, row));
  return [
    ...societies.map(row => ({ dataset: 'societies' as const, societyId: row.id, societyCode: row.societyCode, society: row.nameEn, district: row.district.nameEn, districtId: row.district.id, status: row.status, verificationStatus: row.verificationStatus })),
    ...membership.map(row => ({ dataset: 'membership' as const, societyId: row.societyId, societyCode: row.societyCode, society: row.societyName, district: row.districtName, districtId: row.districtId, status: 'CURRENT', femaleTotal: row.femaleTotal, maleTotal: row.maleTotal, overallTotal: row.overallTotal, year: row.year })),
    ...activities.map(row => ({ dataset: 'activities' as const, activityId: row.id, activity: `${row.sector} community programme ${row.id.slice(-4)}`, society: row.society, societyId: row.societyId, district: row.district, districtId: row.districtId, sector: row.sector, date: row.date, status: row.status, participants: row.participants, plannedValueLkr: row.plannedValueLkr })),
  ] as ReportRecord[];
}
