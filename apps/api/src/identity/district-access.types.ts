/** Mirrors packages/api-contracts/src/district-access.ts (V5 PR 7). */

export type DistrictAccessStatus =
  'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'ENDED_EARLY';

export interface DistrictAccessGrantView {
  id: string;
  district: { id: string; name: string; societyCount: number };
  deputy: { id: string; name: string };
  grantedBy: { id: string; name: string | null };
  grantedAt: string;
  startsAt: string;
  expiresAt: string;
  /** Set when the grant was ended before its end time. */
  endedEarly: { at: string; byName: string | null } | null;
  reason: string;
  status: DistrictAccessStatus;
  /** District societies the DDM has opened with this grant. */
  societiesOpened: number;
}

export interface DistrictAccessHistoryEntry {
  kind: 'GIVEN' | 'STARTED' | 'OPENED' | 'ENDED' | 'ENDED_EARLY';
  at: string;
  actorName: string | null;
  societyName?: string;
}

export interface DistrictAccessGrantDetail extends DistrictAccessGrantView {
  history: DistrictAccessHistoryEntry[];
}

export interface DistrictAccessList {
  data: DistrictAccessGrantView[];
  /** The longest grant the API accepts, in days. */
  maxDays: number;
}
