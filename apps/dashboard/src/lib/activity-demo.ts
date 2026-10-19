/** SC-55 deterministic demonstration data. Sector labels are PROVISIONAL pending the approved ten-sector taxonomy. */
export const SECTORS = [
  { id: 'education', name: 'Education', dimension: 'Social', sdgs: [4] },
  { id: 'health', name: 'Community Health', dimension: 'Social', sdgs: [3] },
  { id: 'water', name: 'Water & Sanitation', dimension: 'Social', sdgs: [6] },
  { id: 'children', name: 'Child & Youth Development', dimension: 'Social', sdgs: [4, 5] },
  { id: 'agriculture', name: 'Sustainable Agriculture', dimension: 'Economic', sdgs: [2, 12] },
  { id: 'livelihoods', name: 'Livelihoods & Enterprise', dimension: 'Economic', sdgs: [1, 8] },
  { id: 'environment', name: 'Environment', dimension: 'Social', sdgs: [13, 15] },
  { id: 'housing', name: 'Housing & Infrastructure', dimension: 'Economic', sdgs: [9, 11] },
  { id: 'governance', name: 'Community Governance', dimension: 'Governance', sdgs: [16] },
  { id: 'disaster', name: 'Disaster Preparedness', dimension: 'Governance', sdgs: [11, 13] },
] as const;
export type SectorId = (typeof SECTORS)[number]['id'];
export type Dimension = 'Social' | 'Economic' | 'Governance';
export type ActivityStatus = 'PLANNED' | 'SUBMITTED' | 'APPROVED' | 'CHANGES_REQUESTED';
export interface ActivityRecord {
  id: string; title: string; district: string; society: string; sectorId: SectorId;
  date: string; status: ActivityStatus; plannedValueLkr: number; participants: number;
  description: string; sdgs: readonly number[];
}
export const DISTRICTS = ['Kurunegala', 'Kandy', 'Gampaha', 'Colombo', 'Matara'] as const;
export const SOCIETIES: Record<string, readonly string[]> = {
  Kurunegala: ['Pahala Kosgama', 'Galewela'],
  Kandy: ['Peradeniya', 'Gampola'],
  Gampaha: ['Minuwangoda', 'Negombo'],
  Colombo: ['Homagama', 'Maharagama'],
  Matara: ['Weligama', 'Akuressa'],
};
// Entirely fictional, stable across builds and refreshes. Only APPROVED records contribute to official activity totals.
export const ACTIVITIES: readonly ActivityRecord[] = Array.from({ length: 40 }, (_, i) => {
  const sector = SECTORS[i % SECTORS.length];
  const district = DISTRICTS[i % DISTRICTS.length];
  const society = SOCIETIES[district][Math.floor(i / 5) % 2];
  const status: ActivityStatus = (['APPROVED', 'APPROVED', 'SUBMITTED', 'PLANNED', 'CHANGES_REQUESTED'] as const)[i % 5];
  const month = String(1 + (i % 10)).padStart(2, '0');
  const day = String(1 + ((i * 7) % 27)).padStart(2, '0');
  return {
    id: `ACT-2026-${String(i + 1).padStart(4, '0')}`,
    title: `${sector.name} community programme ${String(i + 1).padStart(2, '0')}`,
    district, society, sectorId: sector.id, date: `2026-${month}-${day}`, status,
    plannedValueLkr: 25000 + (i % 7) * 17500,
    participants: 12 + (i * 13) % 85,
    description: `Fictional demonstration activity organised by the ${society} society in ${district}.`,
    sdgs: sector.sdgs,
  };
});
export type ActivityFilters = { district: string; society: string; sector: string; status: string; from: string; to: string; search: string };
export const EMPTY_FILTERS: ActivityFilters = { district: 'all', society: 'all', sector: 'all', status: 'all', from: '', to: '', search: '' };
export function filterActivities(items: readonly ActivityRecord[], filters: ActivityFilters): ActivityRecord[] {
  const q = filters.search.trim().toLowerCase();
  return items.filter(a =>
    (filters.district === 'all' || a.district === filters.district) &&
    (filters.society === 'all' || a.society === filters.society) &&
    (filters.sector === 'all' || a.sectorId === filters.sector) &&
    (filters.status === 'all' || a.status === filters.status) &&
    (!filters.from || a.date >= filters.from) && (!filters.to || a.date <= filters.to) &&
    (!q || `${a.id} ${a.title} ${a.district} ${a.society}`.toLowerCase().includes(q))
  ).sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export function summarizeActivities(items: readonly ActivityRecord[]) {
  const approved = items.filter(a => a.status === 'APPROVED');
  return {
    activities: items.length, approved: approved.length,
    pending: items.filter(a => a.status === 'SUBMITTED' || a.status === 'CHANGES_REQUESTED').length,
    annualPlannedValueLkr: items.reduce((sum,a) => sum + a.plannedValueLkr, 0),
    participantsApproved: approved.reduce((sum,a) => sum + a.participants, 0),
    byDimension: (['Social','Economic','Governance'] as const).map(d => ({
      dimension: d, count: items.filter(a => SECTORS.find(s => s.id === a.sectorId)?.dimension === d).length,
    })),
  };
}
export function societyOptions(district: string): string[] {
  return district === 'all' ? [...new Set(Object.values(SOCIETIES).flat())].sort() : [...(SOCIETIES[district] ?? [])].sort();
}
export const formatLkr = (n: number) => `LKR ${n.toLocaleString('en-LK')}`;
