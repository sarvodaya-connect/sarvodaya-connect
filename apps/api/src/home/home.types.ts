/** Mirrors packages/api-contracts/src/home.ts (V5 PR 6 desktop home). */

export type HomeRole =
  'PROGRAMME_COORDINATOR' | 'DEPUTY_DISTRICT_MANAGER' | 'DISTRICT_MANAGER';

export type HomeGrade = 'A' | 'B' | 'C';

export interface HomeAttentionItem {
  societyId: string;
  societyName: string;
  grade: HomeGrade | null;
  /** Plain words, for example "Not updated for 146 days". */
  reason: string;
  /** Set when a grade request is waiting for HQ, for the "B → A with HQ" badge. */
  pendingGrade?: { from: HomeGrade | null; to: HomeGrade };
  /** DM only: the SPC who looks after the society. */
  spcName?: string | null;
  /** False for the DM, who can only view. */
  editable: boolean;
}

export interface HomeStaffMember {
  id: string;
  displayName: string;
  role: 'DEPUTY_DISTRICT_MANAGER' | 'PROGRAMME_COORDINATOR';
  societyCount: number;
  notUpdatedCount: number;
}

export interface HomeRecentChange {
  societyId: string | null;
  societyName: string | null;
  /** History action code, for example SOCIETY_MEMBERSHIP_UPDATED. */
  action: string;
  detail: string;
  actorName: string | null;
  actorRole: string | null;
  at: string;
}

export interface HomeIncident {
  id: string;
  title: string;
  type: string;
  districtName: string;
  openedAt: string;
  openedByName: string | null;
}

export interface HomeAccessGrant {
  id: string;
  deputyName: string;
  districtName: string;
  startsAt: string;
  expiresAt: string;
  /** V5 PR 7 (DM01, DD02): who gave it, when, and the district societies opened with it. */
  grantedByName: string | null;
  grantedAt: string;
  societiesOpened: number;
  districtSocietyCount: number;
}

/** V5 DD07: the DDM's most recent grant, when it ended in the last 7 days. */
export interface HomeEndedGrant {
  districtName: string;
  grantedByName: string | null;
  startsAt: string;
  expiresAt: string;
  endedAt: string;
  endedEarly: boolean;
}

export interface HomeSummary {
  role: HomeRole;
  generatedAt: string;
  /** The yearly summary and audit report figures are for this financial year. */
  financialYear: { startYear: number; label: string };
  /** Work plans counted for this calendar year ("Societies with a 2027 plan"). */
  planYear: number;
  /** DM and DDM: their district. */
  district: { id: string; name: string } | null;
  /** The societies this home is about: assigned (SPC, DDM) or the whole district (DM). */
  societies: {
    total: number;
    active: number;
    notActive: number;
    grades: Record<HomeGrade, number>;
    members: number | null;
  };
  viewOnly: boolean;
  gradeRequests: {
    pending: number;
    latest: { societyName: string; requestedAt: string } | null;
  };
  notUpdated: { days: number; count: number; societyNames: string[] };
  yearlySummaryMissing: number;
  societiesWithPlan: number;
  activitiesWaiting: number;
  needsAttention: HomeAttentionItem[];
  recent: HomeRecentChange[];
  staff: HomeStaffMember[];
  /** DM: active grants in the district. DDM: their own grant, if any. */
  temporaryAccess: HomeAccessGrant[];
  /** DDM with an active grant: how many district societies they can view. */
  districtViewCount: number | null;
  /** DDM without an active grant whose last one ended in the last 7 days. */
  recentlyEnded: HomeEndedGrant | null;
  incidents: HomeIncident[];
}
/** SP02 / DD03 / DM02: one row of "My societies" (or the DM's district list). */
export interface HomeSocietyRow {
  id: string;
  societyCode: string;
  nameEn: string;
  nameLocal: string | null;
  grade: HomeGrade | null;
  pendingGrade: { from: HomeGrade | null; to: HomeGrade } | null;
  members: number | null;
  officerName: string | null;
  spcName: string | null;
  ddmName: string | null;
  dsDivision: string | null;
  updatedAt: string;
  /** Not updated for 90 days or more. */
  stale: boolean;
  editable: boolean;
  /** DD04: one of the DDM's own assigned societies (shown as "Yours"). */
  yours: boolean;
}

export interface HomeSocietyList {
  data: HomeSocietyRow[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  /** Everything in scope, before filters: for "12 assigned societies". */
  scopeTotal: number;
  viewOnly: boolean;
  /** DD04: "MINE" is the DDM's assigned societies; "DISTRICT" is the whole district through temporary access. */
  scope: 'MINE' | 'DISTRICT';
  /** DDM: how many societies each tab holds ("My societies · edit 18", "District · view only 106"). */
  tabs: { mine: number; district: number | null };
  /** DDM with an active grant (DD02 / DD04 banner). */
  access: HomeAccessGrant | null;
  recentlyEnded: HomeEndedGrant | null;
  district: { id: string; name: string } | null;
  /** Choices for the filter menus, from the societies in scope. */
  options: {
    dsDivisions: string[];
    spcs: { id: string; name: string }[];
    ddms: { id: string; name: string }[];
  };
}
