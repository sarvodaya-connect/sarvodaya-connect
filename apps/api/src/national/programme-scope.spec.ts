import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { Principal } from '../auth/principal.js';
import { REQUIRED_ROLES } from '../auth/require-roles.decorator.js';
import { ScopedProgrammesController } from './national.controller.js';
import type { NationalRepository } from './national.repository.js';
import { NationalService } from './national.service.js';
import { delegationEndsAt, programmeScopeFor } from './programme-scope.js';

/**
 * Issue #117: scoped Programmes & Activities. Two fictional districts, people
 * with different assignments, and a DDM's temporary grant before it starts,
 * while valid, after it expires and after it is ended early.
 */
const NORTH = '29000000-0000-4000-8000-000000000001';
const CENTRAL = '29000000-0000-4000-8000-000000000002';
const SUNRISE = '29000000-0000-4000-8000-000000000101';
const LOTUS = '29000000-0000-4000-8000-000000000103';
const now = new Date('2026-11-08T06:00:00.000Z');
const hours = (n: number) =>
  new Date(now.getTime() + n * 3_600_000).toISOString();

const person = (
  role: Principal['roles'][number],
  extra: Partial<Principal> = {},
): Principal => ({
  id: `fictional-${role.toLowerCase()}`,
  displayName: `Fictional ${role}`,
  roles: [role],
  districtIds: [],
  societyIds: [],
  ...extra,
});

const dmNorth = person('DISTRICT_MANAGER', { districtIds: [NORTH] });
const dmCentral = person('DISTRICT_MANAGER', { districtIds: [CENTRAL] });
// Placed in North, but assigned two societies, one of them in Central.
const spc = person('PROGRAMME_COORDINATOR', {
  districtIds: [NORTH],
  societyIds: [SUNRISE, LOTUS],
});
const ddm = (grant?: { startsAt: string; expiresAt: string }) =>
  person('DEPUTY_DISTRICT_MANAGER', {
    districtIds: [NORTH],
    societyIds: [SUNRISE],
    delegatedDistrictAccess: grant ? [{ districtId: NORTH, ...grant }] : [],
  });

describe('Issue #117 programme scope', () => {
  it('limits a DM to their own district', () => {
    expect(programmeScopeFor(dmNorth, now)).toEqual({
      kind: 'DISTRICT',
      districtIds: [NORTH],
      societyIds: [],
    });
    expect(programmeScopeFor(dmCentral, now).districtIds).toEqual([CENTRAL]);
  });

  it('limits an SPC to assigned societies; the district they are placed in gives nothing', () => {
    expect(programmeScopeFor(spc, now)).toEqual({
      kind: 'ASSIGNED',
      districtIds: [],
      societyIds: [SUNRISE, LOTUS],
    });
    expect(
      programmeScopeFor(
        person('PROGRAMME_COORDINATOR', { districtIds: [NORTH] }),
        now,
      ),
    ).toEqual({ kind: 'ASSIGNED', districtIds: [], societyIds: [] });
  });

  it('gives a DDM the district only while a temporary grant is valid', () => {
    const assignedOnly = {
      kind: 'ASSIGNED',
      districtIds: [],
      societyIds: [SUNRISE],
    };
    // No grant: the district affiliation alone is not district access.
    expect(programmeScopeFor(ddm(), now)).toEqual(assignedOnly);
    // Before it starts.
    expect(
      programmeScopeFor(ddm({ startsAt: hours(1), expiresAt: hours(5) }), now),
    ).toEqual(assignedOnly);
    // While it is valid.
    expect(
      programmeScopeFor(ddm({ startsAt: hours(-1), expiresAt: hours(5) }), now),
    ).toEqual({
      kind: 'ASSIGNED_AND_DISTRICT',
      districtIds: [NORTH],
      societyIds: [SUNRISE],
    });
    // After it expires, even by a second.
    expect(
      programmeScopeFor(
        ddm({
          startsAt: hours(-5),
          expiresAt: new Date(now.getTime() - 1000).toISOString(),
        }),
        now,
      ),
    ).toEqual(assignedOnly);
    // Ended early: the principal is loaded on every request without grants
    // that have a revokedAt (identity.service principalFor), so it carries none.
    expect(programmeScopeFor(ddm(), now)).toEqual(assignedOnly);
  });

  it("reports when the DDM's temporary access ends, and nothing for other roles", () => {
    const active = ddm({ startsAt: hours(-1), expiresAt: hours(5) });
    expect(delegationEndsAt(active, [NORTH], now)).toBe(hours(5));
    expect(delegationEndsAt(active, [], now)).toBeNull();
    expect(delegationEndsAt(dmNorth, [NORTH], now)).toBeNull();
  });

  it('serves no one else: HQ keeps national/programmes, Society Officers have no view', () => {
    expect(() => programmeScopeFor(person('HQ_ADMIN'), now)).toThrow(
      ForbiddenException,
    );
    expect(() =>
      programmeScopeFor(
        person('SOCIETY_OFFICER', { societyIds: [SUNRISE] }),
        now,
      ),
    ).toThrow(ForbiddenException);
    expect(
      new Reflector().get(REQUIRED_ROLES, ScopedProgrammesController),
    ).toEqual([
      'DISTRICT_MANAGER',
      'DEPUTY_DISTRICT_MANAGER',
      'PROGRAMME_COORDINATOR',
    ]);
  });
});

describe('Issue #117 scoped programme figures', () => {
  const repository = () => {
    const activities = vi.fn().mockResolvedValue({
      dimensions: [{ dimension: 'SOCIAL', planned: 3, completed: 2 }],
      sectors: [
        {
          sector: 'Community education',
          planned: 2,
          completed: 2,
          societies: 1,
        },
        {
          sector: 'Health and nutrition',
          planned: 1,
          completed: 0,
          societies: 1,
        },
        { sector: null, planned: 1, completed: 0, societies: 1 },
      ],
      sdgs: [
        { sdg: 6, completed: 1 },
        { sdg: 4, completed: 2 },
        { sdg: 3, completed: 1 },
      ],
    });
    const recentApprovedActivities = vi.fn().mockResolvedValue([]);
    const scopeSummary = vi.fn().mockResolvedValue({
      societies: 2,
      districts: [{ id: NORTH, nameEn: 'Fictional North' }],
    });
    return { activities, recentApprovedActivities, scopeSummary };
  };
  const service = (repo: ReturnType<typeof repository>) =>
    new NationalService(repo as unknown as NationalRepository, {} as never);

  it('passes the scope into every query and keeps the HQ rules', async () => {
    const repo = repository();
    const active = ddm({ startsAt: hours(-1), expiresAt: hours(5) });
    const result = await service(repo).scopedProgrammes(active, 2025, now);
    const within = { districtIds: [NORTH], societyIds: [SUNRISE] };
    expect(repo.activities).toHaveBeenCalledWith(2025, now, within);
    expect(repo.recentApprovedActivities).toHaveBeenCalledWith(2025, 6, within);
    expect(repo.scopeSummary).toHaveBeenCalledWith(within);
    expect(result).toMatchObject({
      financialYear: { startYear: 2025 },
      planned: 4,
      completed: 2,
      scope: {
        kind: 'ASSIGNED_AND_DISTRICT',
        societies: 2,
        districts: [{ id: NORTH, name: 'Fictional North' }],
        temporaryAccessEndsAt: hours(5),
      },
    });
    // Equal counts by SDG number; every goal is listed.
    expect(result.sdgs.slice(0, 3)).toEqual([
      { sdg: 4, completed: 2 },
      { sdg: 3, completed: 1 },
      { sdg: 6, completed: 1 },
    ]);
    expect(result.sdgs).toHaveLength(17);
    expect(result.sectors.map((row) => row.sector)).not.toContain(null);
  });

  it('asks for an empty scope as such when nothing is assigned, rather than everything', async () => {
    const repo = repository();
    await service(repo).scopedProgrammes(
      person('PROGRAMME_COORDINATOR', { districtIds: [NORTH] }),
      undefined,
      now,
    );
    expect(repo.activities).toHaveBeenCalledWith(2025, now, {
      districtIds: [],
      societyIds: [],
    });
  });

  it('refuses a year outside the selectable range, as HQ does', async () => {
    await expect(
      service(repository()).scopedProgrammes(dmNorth, 2015, now),
    ).rejects.toThrow('Choose one of the last five financial years');
  });

  it('leaves HQ national: no scope is passed', async () => {
    const repo = repository();
    await service(repo).programmes(2025, now);
    expect(repo.activities).toHaveBeenCalledWith(2025, now, undefined);
    expect(repo.recentApprovedActivities).toHaveBeenCalledWith(
      2025,
      6,
      undefined,
    );
  });

  it('offers the year in progress and says which recent rows count as completed (issue #131)', async () => {
    const repo = repository();
    const row = (id: string, year: number, month: number) => ({
      id,
      name: `Fictional ${id}`,
      sector: 'Community education',
      dimension: 'SOCIAL',
      society: { id: SUNRISE, nameEn: 'Fictional Sunrise' },
      reviewedAt: now,
      reviewedByName: 'Fictional SPC',
      datesLabel: null,
      year,
      month,
      femaleParticipants: null,
      maleParticipants: null,
      householdsBenefited: null,
      createdByName: null,
      sdgs: [{ sdg: 1 }, { sdg: 17 }],
    });
    repo.recentApprovedActivities.mockResolvedValue([
      row('october', 2026, 10),
      row('november', 2026, 11),
    ]);
    const result = await service(repo).programmes(2026, now);
    expect(repo.activities).toHaveBeenCalledWith(2026, now, undefined);
    expect(result.financialYear).toMatchObject({
      startYear: 2026,
      inProgress: true,
    });
    expect(result.recent.map((r) => [r.id, r.completed, r.month])).toEqual([
      ['october', true, 10],
      ['november', false, 11],
    ]);
    expect(result.recent[0].sdgs).toEqual([1, 17]);

    const ended = await service(repository()).scopedProgrammes(
      dmNorth,
      undefined,
      now,
    );
    expect(ended.financialYear).toMatchObject({
      startYear: 2025,
      inProgress: false,
    });
    await expect(
      service(repository()).scopedProgrammes(dmNorth, 2027, now),
    ).rejects.toThrow('Choose one of the last five financial years');
  });
});
