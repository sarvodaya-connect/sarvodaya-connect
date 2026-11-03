import type {
  HomeAttentionItem,
  HomeGrade,
  HomeRole,
  HomeSocietyList,
  HomeSocietyRow,
  HomeStaffMember,
  HomeSummary,
} from './home.types.js';

/** A society is "not updated" when its record has not changed for this many days. */
export const NOT_UPDATED_DAYS = 90;
/** The home lists the first few societies that need attention. */
export const ATTENTION_LIMIT = 6;

export interface HomeSociety {
  id: string;
  nameEn: string;
  grade: HomeGrade | null;
  status: string;
  memberCount: number | null;
  updatedAt: Date;
}

export interface HomeAccount {
  id: string;
  displayName: string;
  role: string;
  societyIds: string[];
}

export interface HomeInput {
  role: HomeRole;
  now: Date;
  financialYear: { startYear: number; label: string };
  planYear: number;
  district: { id: string; name: string } | null;
  societies: HomeSociety[];
  pendingGradeRequests: {
    societyId: string;
    fromGrade: HomeGrade | null;
    toGrade: HomeGrade;
    requestedAt: Date;
  }[];
  waitingActivities: { societyId: string; name: string }[];
  /** Societies that have entered both yearly figures for the financial year. */
  summariesDone: Set<string>;
  /** Societies with an audit report for the financial year. */
  auditReportsDone: Set<string>;
  /** Societies with at least one activity planned for the plan year. */
  plannedSocieties: Set<string>;
  /** Active Society Officer, SPC and DDM accounts covering any of these societies. */
  accounts: HomeAccount[];
  recent: HomeSummary['recent'];
  temporaryAccess: HomeSummary['temporaryAccess'];
  districtViewCount: number | null;
  recentlyEnded: HomeSummary['recentlyEnded'];
  incidents: HomeSummary['incidents'];
}

const GRADE_ORDER: Record<string, number> = { C: 0, B: 1, A: 2 };

function daysSince(date: Date, now: Date) {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

/**
 * Works out every figure on the SPC, DDM and DM home from the societies the
 * user covers. Kept free of database access so the rules can be unit tested.
 */
export function composeHome(input: HomeInput): HomeSummary {
  const { now, role, societies } = input;
  const active = societies.filter((s) => s.status === 'ACTIVE');
  const grades: Record<HomeGrade, number> = { A: 0, B: 0, C: 0 };
  for (const s of active) if (s.grade) grades[s.grade] += 1;
  const viewOnly = role === 'DISTRICT_MANAGER';
  const fy = input.financialYear.label;

  const stale = societies
    .filter((s) => daysSince(s.updatedAt, now) >= NOT_UPDATED_DAYS)
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

  const officers = new Set(
    input.accounts
      .filter((a) => a.role === 'SOCIETY_OFFICER')
      .flatMap((a) => a.societyIds),
  );
  const spcFor = new Map<string, string>();
  for (const a of input.accounts)
    if (a.role === 'PROGRAMME_COORDINATOR')
      for (const id of a.societyIds)
        if (!spcFor.has(id)) spcFor.set(id, a.displayName);

  const latestRequest = [...input.pendingGradeRequests].sort(
    (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime(),
  )[0];
  const byId = new Map(societies.map((s) => [s.id, s]));

  // Most urgent first: decisions waiting on someone, then records falling behind.
  const items: (HomeAttentionItem & { rank: number; order: number })[] = [];
  const add = (
    society: HomeSociety,
    rank: number,
    reason: string,
    extra: Partial<HomeAttentionItem> = {},
  ) =>
    items.push({
      societyId: society.id,
      societyName: society.nameEn,
      grade: society.grade,
      reason,
      editable: !viewOnly,
      ...(role === 'DISTRICT_MANAGER'
        ? { spcName: spcFor.get(society.id) ?? null }
        : {}),
      ...extra,
      rank,
      order: GRADE_ORDER[society.grade ?? 'C'] ?? 0,
    });

  if (role === 'PROGRAMME_COORDINATOR')
    for (const activity of input.waitingActivities) {
      const society = byId.get(activity.societyId);
      if (society) add(society, 0, `Activity to approve: ${activity.name}`);
    }
  for (const request of input.pendingGradeRequests) {
    const society = byId.get(request.societyId);
    if (!society) continue;
    add(
      society,
      1,
      `Grade request ${request.fromGrade ?? '–'} → ${request.toGrade} waiting for HQ`,
      { pendingGrade: { from: request.fromGrade, to: request.toGrade } },
    );
  }
  for (const society of stale)
    add(
      society,
      2,
      `Not updated for ${daysSince(society.updatedAt, now)} days`,
    );
  for (const society of active) {
    if (!officers.has(society.id))
      add(
        society,
        3,
        input.summariesDone.has(society.id)
          ? 'No Society Officer'
          : 'No Society Officer · yearly summary not added',
      );
    else if (!input.summariesDone.has(society.id))
      add(society, 4, `Yearly summary ${fy} not added`);
    if (!input.auditReportsDone.has(society.id))
      add(society, 5, `Audit report ${fy} not uploaded`);
  }
  items.sort((a, b) => a.rank - b.rank || a.order - b.order);
  const needsAttention = items
    .slice(0, ATTENTION_LIMIT)
    .map(({ rank: _rank, order: _order, ...item }) => item);

  const staff: HomeStaffMember[] =
    role === 'DISTRICT_MANAGER'
      ? input.accounts
          .filter(
            (a) =>
              a.role === 'DEPUTY_DISTRICT_MANAGER' ||
              a.role === 'PROGRAMME_COORDINATOR',
          )
          .map((a) => {
            const mine = a.societyIds.filter((id) => byId.has(id));
            return {
              id: a.id,
              displayName: a.displayName,
              role: a.role as HomeStaffMember['role'],
              societyCount: mine.length,
              notUpdatedCount: mine.filter((id) =>
                stale.some((s) => s.id === id),
              ).length,
            };
          })
          .filter((member) => member.societyCount > 0)
          // DDMs first, then SPCs, each by name (V5 DM01 staff table).
          .sort(
            (a, b) =>
              (a.role === b.role
                ? 0
                : a.role === 'DEPUTY_DISTRICT_MANAGER'
                  ? -1
                  : 1) || a.displayName.localeCompare(b.displayName),
          )
      : [];

  return {
    role,
    generatedAt: now.toISOString(),
    financialYear: input.financialYear,
    planYear: input.planYear,
    district: input.district,
    societies: {
      total: societies.length,
      active: active.length,
      notActive: societies.length - active.length,
      grades,
      members:
        role === 'DISTRICT_MANAGER'
          ? societies.reduce((sum, s) => sum + (s.memberCount ?? 0), 0)
          : null,
    },
    viewOnly,
    gradeRequests: {
      pending: input.pendingGradeRequests.length,
      latest: latestRequest
        ? {
            societyName: byId.get(latestRequest.societyId)?.nameEn ?? '',
            requestedAt: latestRequest.requestedAt.toISOString(),
          }
        : null,
    },
    notUpdated: {
      days: NOT_UPDATED_DAYS,
      count: stale.length,
      societyNames: stale.slice(0, 2).map((s) => s.nameEn),
    },
    yearlySummaryMissing: active.filter((s) => !input.summariesDone.has(s.id))
      .length,
    societiesWithPlan: societies.filter((s) => input.plannedSocieties.has(s.id))
      .length,
    activitiesWaiting: input.waitingActivities.length,
    needsAttention,
    recent: input.recent,
    staff,
    temporaryAccess: input.temporaryAccess,
    districtViewCount: input.districtViewCount,
    recentlyEnded: input.recentlyEnded,
    incidents: input.incidents,
  };
}

export interface SocietyListInput {
  role: HomeRole;
  now: Date;
  district: { id: string; name: string } | null;
  societies: (HomeSociety & {
    societyCode: string;
    nameLocal: string | null;
    dsDivision: string | null;
  })[];
  pendingGradeRequests: HomeInput['pendingGradeRequests'];
  accounts: HomeAccount[];
  /** DD04: the DDM's whole district through temporary access, or their own societies. */
  scope?: HomeSocietyList['scope'];
  /** The user's own assigned societies: editable, and "Yours" in the district list. */
  assigned?: Set<string>;
  tabs?: HomeSocietyList['tabs'];
  access?: HomeSocietyList['access'];
  recentlyEnded?: HomeSocietyList['recentlyEnded'];
}

export interface SocietyListQuery {
  page: number;
  pageSize: number;
  q?: string;
  grade?: HomeGrade;
  dsDivision?: string;
  needsUpdate?: boolean;
  gradeRequest?: 'PENDING' | 'NONE';
  spcId?: string;
  ddmId?: string;
  scope?: 'MINE' | 'DISTRICT';
  assignedToMe?: boolean;
}

/**
 * SP02 / DD03 / DM02. Filters run on the societies the user covers (one
 * district at most), then the list is paged.
 */
export function composeSocietyList(
  input: SocietyListInput,
  query: SocietyListQuery,
): HomeSocietyList {
  const viewOnly = input.role === 'DISTRICT_MANAGER';
  const scope = input.scope ?? 'MINE';
  const assigned = input.assigned ?? new Set<string>();
  // In the DDM's district list only their own societies stay editable.
  const editable = (id: string) =>
    !viewOnly && (scope === 'MINE' || assigned.has(id));
  const holder = (role: string) => {
    const map = new Map<string, HomeAccount>();
    for (const a of input.accounts)
      if (a.role === role)
        for (const id of a.societyIds) if (!map.has(id)) map.set(id, a);
    return map;
  };
  const officer = holder('SOCIETY_OFFICER');
  const spc = holder('PROGRAMME_COORDINATOR');
  const ddm = holder('DEPUTY_DISTRICT_MANAGER');
  const pending = new Map(
    input.pendingGradeRequests.map((r) => [r.societyId, r]),
  );

  const rows: HomeSocietyRow[] = input.societies.map((s) => {
    const request = pending.get(s.id);
    return {
      id: s.id,
      societyCode: s.societyCode,
      nameEn: s.nameEn,
      nameLocal: s.nameLocal,
      grade: s.grade,
      pendingGrade: request
        ? { from: request.fromGrade, to: request.toGrade }
        : null,
      members: s.memberCount,
      officerName: officer.get(s.id)?.displayName ?? null,
      spcName: spc.get(s.id)?.displayName ?? null,
      ddmName: ddm.get(s.id)?.displayName ?? null,
      dsDivision: s.dsDivision,
      updatedAt: s.updatedAt.toISOString(),
      stale: daysSince(s.updatedAt, input.now) >= NOT_UPDATED_DAYS,
      editable: editable(s.id),
      yours: scope === 'DISTRICT' && assigned.has(s.id),
    };
  });

  const q = query.q?.trim().toLowerCase();
  const filtered = rows.filter(
    (row) =>
      (!q ||
        row.nameEn.toLowerCase().includes(q) ||
        row.societyCode.toLowerCase().includes(q) ||
        (row.nameLocal ?? '').toLowerCase().includes(q)) &&
      (!query.grade || row.grade === query.grade) &&
      (!query.dsDivision || row.dsDivision === query.dsDivision) &&
      (query.needsUpdate === undefined || row.stale === query.needsUpdate) &&
      (!query.gradeRequest ||
        (query.gradeRequest === 'PENDING') === Boolean(row.pendingGrade)) &&
      (!query.spcId || spc.get(row.id)?.id === query.spcId) &&
      (!query.ddmId || ddm.get(row.id)?.id === query.ddmId) &&
      (query.assignedToMe === undefined ||
        assigned.has(row.id) === query.assignedToMe),
  );
  const start = (query.page - 1) * query.pageSize;
  const people = (map: Map<string, HomeAccount>) =>
    [...new Map([...map.values()].map((a) => [a.id, a])).values()]
      .map((a) => ({ id: a.id, name: a.displayName }))
      .sort((a, b) => a.name.localeCompare(b.name));

  return {
    data: filtered.slice(start, start + query.pageSize),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / query.pageSize),
    },
    scopeTotal: rows.length,
    viewOnly,
    scope,
    tabs: input.tabs ?? { mine: rows.length, district: null },
    access: input.access ?? null,
    recentlyEnded: input.recentlyEnded ?? null,
    district: input.district,
    options: {
      dsDivisions: [
        ...new Set(
          rows.map((r) => r.dsDivision).filter((d): d is string => !!d),
        ),
      ].sort(),
      spcs: people(spc),
      ddms: people(ddm),
    },
  };
}
