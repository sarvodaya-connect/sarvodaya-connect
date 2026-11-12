import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '../auth/principal.js';
import { SocietiesService } from './societies.service.js';
import { SocietiesRepository } from './societies.repository.js';

const societyId = '29000000-0000-4000-8000-000000000101';
const districtId = '29000000-0000-4000-8000-000000000001';
const baseRecord = {
  id: societyId,
  societyCode: 'DEMO-SOC-001',
  nameEn: 'Example Sunrise Society',
  districtId,
  district: {
    id: districtId,
    code: 'DEMO-N',
    nameEn: 'Fictional North District',
  },
  contacts: [],
  councilMembers: [],
  memberships: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const officer: Principal = {
  id: 'demo-officer-sunrise',
  displayName: 'Demo Officer',
  roles: ['SOCIETY_OFFICER'],
  districtIds: [districtId],
  societyIds: [societyId],
};
const otherOfficer: Principal = {
  ...officer,
  id: 'demo-officer-other',
  societyIds: ['29000000-0000-4000-8000-000000000103'],
};

type Seat = Parameters<SocietiesService['updateCouncil']>[1]['members'][number];
const member = (
  seatNumber: number,
  seatType: Seat['seatType'],
  position = 'Member',
): Seat => ({
  seatNumber,
  fullName: `Fictional Member ${seatNumber}`,
  position,
  seatType,
  isActive: true,
  isPrimaryContact: position === 'President',
});
/** 25 seats: 9 ordinary (with the three offices), 7 elders, 3 mothers, 3 youth, 3 children. */
const fullCouncil = () =>
  [
    ...Array<Seat['seatType']>(9).fill('ORDINARY'),
    ...Array<Seat['seatType']>(7).fill('ELDERS_COUNCIL'),
    ...Array<Seat['seatType']>(3).fill('MOTHERS'),
    ...Array<Seat['seatType']>(3).fill('YOUTH'),
    ...Array<Seat['seatType']>(3).fill('CHILDREN'),
  ].map((seatType, index) =>
    member(
      index + 1,
      seatType,
      ['President', 'Secretary', 'Treasurer'][index] ?? 'Member',
    ),
  );

/** A stored council row, as the repository returns it. */
const baseRecordMember = {
  societyId,
  nicCiphertext: null,
  nicLastFour: null,
  phone: null,
  email: null,
  age: null,
  dateOfBirth: null,
  profession: null,
  addressLine: null,
  appointedOn: null,
  endedOn: null,
  isActive: true,
  isPrimaryContact: false,
};

describe('SocietiesService profile, council and membership', () => {
  const repository = {
    findById: vi.fn(),
    findRecordContext: vi.fn().mockResolvedValue({
      summary: null,
      auditReport: null,
      staff: [],
      lastChange: null,
    }),
    updateProfile: vi.fn(),
    replaceCouncil: vi.fn(),
    replaceMembership: vi.fn(),
    membershipForPrincipal: vi.fn(),
  };
  let service: SocietiesService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findById.mockResolvedValue(baseRecord);
    service = new SocietiesService(
      repository as unknown as SocietiesRepository,
    );
  });

  it('allows an assigned society officer to update a complete coordinate pair', async () => {
    repository.updateProfile.mockResolvedValue({ id: societyId });
    await service.updateProfile(
      societyId,
      { latitude: 7.3, longitude: 80.6 },
      officer,
    );
    expect(repository.updateProfile).toHaveBeenCalledWith(
      societyId,
      { latitude: 7.3, longitude: 80.6 },
      officer,
      // SC-65: a readable entry for the change history.
      { summary: 'Map location changed', membershipChanged: false },
    );
  });

  it('rejects a partial GPS location without changing stored values', async () => {
    await expect(
      service.updateProfile(societyId, { latitude: 7.3 }, officer),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects updates outside the assigned society scope', async () => {
    await expect(
      service.updateProfile(
        societyId,
        { village: 'Fictional village' },
        otherOfficer,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('saves a partly entered Exco, including none at all', async () => {
    await service.updateCouncil(societyId, { members: [] }, officer);
    expect(repository.replaceCouncil).toHaveBeenCalledWith(
      societyId,
      { members: [] },
      officer,
    );
    const three = [1, 2, 3].map((seat) =>
      member(seat, 'ORDINARY', seat === 1 ? 'President' : 'Member'),
    );
    await service.updateCouncil(societyId, { members: three }, officer);
    expect(repository.replaceCouncil).toHaveBeenLastCalledWith(
      societyId,
      { members: three },
      officer,
    );
  });

  it('rejects council updates with the wrong seat distribution', async () => {
    // A fourth children's seat goes over the three the Exco has.
    const children = [1, 2, 3, 4].map((seat) => member(seat, 'CHILDREN'));
    await expect(
      service.updateCouncil(societyId, { members: children }, officer),
    ).rejects.toThrow('Council can have only 3 children seats');
    expect(repository.replaceCouncil).not.toHaveBeenCalled();
  });

  it('allows each office to only one member', async () => {
    const twoPresidents = [1, 2].map((seat) =>
      member(seat, 'ORDINARY', 'President'),
    );
    await expect(
      service.updateCouncil(societyId, { members: twoPresidents }, officer),
    ).rejects.toThrow('Choose only one President');
    expect(repository.replaceCouncil).not.toHaveBeenCalled();
  });

  it('needs every seat group full once the 25 seats are filled', async () => {
    // 25 seats, but one elders' seat recorded as ordinary: 10 ordinary, 6 elders.
    const wrong = fullCouncil().map((seat) =>
      seat.seatNumber === 10 ? member(10, 'ORDINARY') : seat,
    );
    await expect(
      service.updateCouncil(societyId, { members: wrong }, officer),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.updateCouncil(societyId, { members: fullCouncil() }, officer);
    expect(repository.replaceCouncil).toHaveBeenCalledTimes(1);
  });

  it('refuses an Exco update from an officer of another society', async () => {
    await expect(
      service.updateCouncil(societyId, { members: [] }, otherOfficer),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.replaceCouncil).not.toHaveBeenCalled();
  });

  it('saves 25 seats without an office bearer, so an older record can be corrected later', async () => {
    const noTreasurer = fullCouncil().map((seat) =>
      seat.position === 'Treasurer'
        ? member(seat.seatNumber, 'ORDINARY')
        : seat,
    );
    await service.updateCouncil(societyId, { members: noTreasurer }, officer);
    expect(repository.replaceCouncil).toHaveBeenCalledTimes(1);
  });

  it('reports the record incomplete until the 25 seats and three offices are in', async () => {
    const saved = (seats: Seat[]) =>
      seats.map((seat, index) => ({
        ...baseRecordMember,
        id: `m${index}`,
        seatNumber: seat.seatNumber,
        fullName: seat.fullName,
        position: seat.position,
        seatType: seat.seatType,
      }));
    const noTreasurer = fullCouncil().map((seat) =>
      seat.position === 'Treasurer'
        ? member(seat.seatNumber, 'ORDINARY')
        : seat,
    );
    repository.findById.mockResolvedValue({
      ...baseRecord,
      councilMembers: saved(noTreasurer),
    });
    const incomplete = await service.getById(societyId, officer);
    expect(incomplete.excoStatus).toEqual({
      filledSeats: 25,
      totalSeats: 25,
      complete: false,
      missingOffices: ['Treasurer'],
      problems: ['No Treasurer chosen yet.'],
    });

    repository.findById.mockResolvedValue({
      ...baseRecord,
      councilMembers: saved(fullCouncil()),
    });
    const complete = await service.getById(societyId, officer);
    expect(complete.excoStatus).toEqual({
      filledSeats: 25,
      totalSeats: 25,
      complete: true,
      missingOffices: [],
      problems: [],
    });
  });

  it('adds category and gender counts to an overall membership total', async () => {
    repository.membershipForPrincipal.mockResolvedValue([
      {
        ...baseRecord,
        memberships: [
          { year: 2026, category: 'CHILDREN', female: 178, male: 164 },
          { year: 2026, category: 'YOUTH', female: 246, male: 219 },
          { year: 2026, category: 'MOTHERS', female: 526, male: 0 },
          { year: 2026, category: 'ORDINARY', female: 1485, male: 1328 },
          { year: 2026, category: 'ELDERS_COUNCIL', female: 82, male: 65 },
        ],
      },
    ]);
    const result = await service.membership(2026, officer);
    expect(result).toMatchObject({
      femaleTotal: 2517,
      maleTotal: 1776,
      overallTotal: 4293,
    });
    expect(
      result.categories.reduce((sum, category) => sum + category.total, 0),
    ).toBe(result.overallTotal);
  });
});
