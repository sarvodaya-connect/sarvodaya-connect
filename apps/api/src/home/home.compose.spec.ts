import { describe, expect, it } from 'vitest';

import type { Principal } from '../auth/principal.js';
import {
  composeHome,
  composeSocietyList,
  type HomeInput,
  type HomeSociety,
} from './home.compose.js';
import { homeRoleOf } from './home.service.js';

const now = new Date('2026-10-26T04:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

const society = (
  id: string,
  grade: HomeSociety['grade'],
  updated = 3,
  extra: Partial<HomeSociety> = {},
): HomeSociety => ({
  id,
  nameEn: `${id} SSS`,
  grade,
  status: 'ACTIVE',
  memberCount: 100,
  updatedAt: daysAgo(updated),
  ...extra,
});

function input(overrides: Partial<HomeInput> = {}): HomeInput {
  const societies = [
    society('Pahala', 'B'),
    society('Hettipola', 'C', 146),
    society('Kobeigane', 'C'),
    society('Thalawa', null, 10, { status: 'INACTIVE', memberCount: 40 }),
  ];
  return {
    role: 'PROGRAMME_COORDINATOR',
    now,
    financialYear: { startYear: 2025, label: 'FY 2025/26' },
    planYear: 2027,
    district: null,
    societies,
    pendingGradeRequests: [
      {
        societyId: 'Pahala',
        fromGrade: 'B',
        toGrade: 'A',
        requestedAt: daysAgo(2),
      },
    ],
    waitingActivities: [{ societyId: 'Pahala', name: 'Youth leadership camp' }],
    summariesDone: new Set(['Pahala', 'Hettipola']),
    auditReportsDone: new Set(['Pahala', 'Hettipola', 'Kobeigane']),
    plannedSocieties: new Set(['Pahala', 'Kobeigane']),
    accounts: [
      {
        id: 'so1',
        displayName: 'N. Wijesinghe',
        role: 'SOCIETY_OFFICER',
        societyIds: ['Pahala', 'Hettipola'],
      },
      {
        id: 'spc1',
        displayName: 'S. Karunaratne',
        role: 'PROGRAMME_COORDINATOR',
        societyIds: ['Pahala', 'Hettipola', 'Kobeigane', 'Elsewhere'],
      },
      {
        id: 'ddm1',
        displayName: 'P. Dissanayake',
        role: 'DEPUTY_DISTRICT_MANAGER',
        societyIds: ['Kobeigane'],
      },
    ],
    recent: [],
    temporaryAccess: [],
    districtViewCount: null,
    incidents: [],
    ...overrides,
  };
}

describe('desktop home figures (V5 SP01, DD01, DM01)', () => {
  it('counts grades among active societies and lists the oldest stale records', () => {
    const home = composeHome(input());
    expect(home.societies).toEqual({
      total: 4,
      active: 3,
      notActive: 1,
      grades: { A: 0, B: 1, C: 2 },
      members: null,
    });
    expect(home.notUpdated).toEqual({
      days: 90,
      count: 1,
      societyNames: ['Hettipola SSS'],
    });
    expect(home.gradeRequests.pending).toBe(1);
    expect(home.gradeRequests.latest?.societyName).toBe('Pahala SSS');
    expect(home.yearlySummaryMissing).toBe(1);
    expect(home.societiesWithPlan).toBe(2);
    expect(home.activitiesWaiting).toBe(1);
  });

  it('puts decisions first, then stale records, then missing officers and yearly figures', () => {
    const reasons = composeHome(input()).needsAttention.map(
      (item) => `${item.societyName}: ${item.reason}`,
    );
    expect(reasons).toEqual([
      'Pahala SSS: Activity to approve: Youth leadership camp',
      'Pahala SSS: Grade request B → A waiting for HQ',
      'Hettipola SSS: Not updated for 146 days',
      'Kobeigane SSS: No Society Officer · yearly summary not added',
    ]);
  });

  it('shows the pending grade for the "B → A with HQ" badge', () => {
    const item = composeHome(input()).needsAttention[1]!;
    expect(item.pendingGrade).toEqual({ from: 'B', to: 'A' });
  });

  it('caps the list at six', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      society(`S${i}`, 'C', 120),
    );
    expect(composeHome(input({ societies: many })).needsAttention).toHaveLength(
      6,
    );
  });

  it('makes the DM view only, with the SPC for each society and district members', () => {
    const home = composeHome(
      input({
        role: 'DISTRICT_MANAGER',
        district: { id: 'd1', name: 'Kurunegala' },
      }),
    );
    expect(home.viewOnly).toBe(true);
    expect(home.societies.members).toBe(340);
    expect(home.needsAttention.every((item) => !item.editable)).toBe(true);
    expect(home.needsAttention[0]).toMatchObject({
      societyName: 'Pahala SSS',
      spcName: 'S. Karunaratne',
    });
    // The DM does not approve activities, so none are listed for them.
    expect(home.activitiesWaiting).toBe(1);
    expect(
      home.needsAttention.some((item) => item.reason.startsWith('Activity')),
    ).toBe(false);
  });

  it('lists DDMs then SPCs, counting only societies in the district', () => {
    const staff = composeHome(input({ role: 'DISTRICT_MANAGER' })).staff;
    expect(staff).toEqual([
      {
        id: 'ddm1',
        displayName: 'P. Dissanayake',
        role: 'DEPUTY_DISTRICT_MANAGER',
        societyCount: 1,
        notUpdatedCount: 0,
      },
      {
        id: 'spc1',
        displayName: 'S. Karunaratne',
        role: 'PROGRAMME_COORDINATOR',
        societyCount: 3,
        notUpdatedCount: 1,
      },
    ]);
  });

  it('gives SPCs and DDMs editable rows and no staff table', () => {
    const home = composeHome(input({ role: 'DEPUTY_DISTRICT_MANAGER' }));
    expect(home.viewOnly).toBe(false);
    expect(home.staff).toEqual([]);
    expect(home.needsAttention.every((item) => item.editable)).toBe(true);
  });
});

describe('who has a desktop home', () => {
  const principal = (roles: Principal['roles']): Principal => ({
    id: 'u',
    displayName: 'U',
    roles,
    districtIds: [],
    societyIds: [],
  });

  it('is the SPC, DDM and DM only', () => {
    expect(homeRoleOf(principal(['PROGRAMME_COORDINATOR']))).toBe(
      'PROGRAMME_COORDINATOR',
    );
    expect(homeRoleOf(principal(['DEPUTY_DISTRICT_MANAGER']))).toBe(
      'DEPUTY_DISTRICT_MANAGER',
    );
    expect(homeRoleOf(principal(['DISTRICT_MANAGER']))).toBe(
      'DISTRICT_MANAGER',
    );
    expect(homeRoleOf(principal(['HQ_ADMIN']))).toBeNull();
    expect(homeRoleOf(principal(['SOCIETY_OFFICER']))).toBeNull();
  });
});

describe('my societies list (V5 SP02, DD03, DM02)', () => {
  const base = input();
  const listInput = (role: HomeInput['role']) => ({
    role,
    now,
    district: { id: 'd1', name: 'Kurunegala' },
    societies: base.societies.map((s, i) => ({
      ...s,
      societyCode: `S-10${i}`,
      nameLocal: null,
      dsDivision: i % 2 ? 'Wariyapola' : 'Kuliyapitiya East',
    })),
    pendingGradeRequests: base.pendingGradeRequests,
    accounts: base.accounts,
  });

  it('shows the officer, SPC, DDM, pending grade and stale records', () => {
    const list = composeSocietyList(listInput('DISTRICT_MANAGER'), {
      page: 1,
      pageSize: 20,
    });
    const hettipola = list.data.find((r) => r.nameEn === 'Hettipola SSS')!;
    expect(hettipola).toMatchObject({
      officerName: 'N. Wijesinghe',
      spcName: 'S. Karunaratne',
      ddmName: null,
      stale: true,
      editable: false,
    });
    expect(list.data[0]!.pendingGrade).toEqual({ from: 'B', to: 'A' });
    expect(list.viewOnly).toBe(true);
    expect(list.options.dsDivisions).toEqual([
      'Kuliyapitiya East',
      'Wariyapola',
    ]);
    expect(list.options.ddms).toEqual([{ id: 'ddm1', name: 'P. Dissanayake' }]);
  });

  it('filters by name, grade, update, grade request and staff, then pages', () => {
    const run = (query: Partial<Parameters<typeof composeSocietyList>[1]>) =>
      composeSocietyList(listInput('PROGRAMME_COORDINATOR'), {
        page: 1,
        pageSize: 20,
        ...query,
      });
    expect(run({ q: 'hetti' }).data.map((r) => r.nameEn)).toEqual([
      'Hettipola SSS',
    ]);
    expect(run({ q: 'S-102' }).data.map((r) => r.nameEn)).toEqual([
      'Kobeigane SSS',
    ]);
    expect(run({ grade: 'C' }).meta.totalItems).toBe(2);
    expect(run({ needsUpdate: true }).meta.totalItems).toBe(1);
    expect(run({ gradeRequest: 'PENDING' }).meta.totalItems).toBe(1);
    expect(run({ gradeRequest: 'NONE' }).meta.totalItems).toBe(3);
    expect(run({ ddmId: 'ddm1' }).data.map((r) => r.nameEn)).toEqual([
      'Kobeigane SSS',
    ]);
    const paged = run({ pageSize: 3, page: 2 });
    expect(paged.data).toHaveLength(1);
    expect(paged.meta).toEqual({
      page: 2,
      pageSize: 3,
      totalItems: 4,
      totalPages: 2,
    });
    expect(paged.scopeTotal).toBe(4);
    expect(paged.data.every((r) => r.editable)).toBe(true);
  });
});
