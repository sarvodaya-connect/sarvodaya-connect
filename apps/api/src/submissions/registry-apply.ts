import type { MembershipCategory, Prisma } from '../generated/prisma/client.js';
import type {
  CouncilColumn,
  MembershipGender,
  ProfileColumn,
  RegistryScalar,
  RegistryTarget,
  ResolvedRegistryChange,
} from './registry-fields.js';

/** Thrown inside the approval transaction to roll it back. */
export class RegistryApplyError extends Error {
  readonly status: 400 | 409;

  constructor(status: 400 | 409, message: string) {
    super(message);
    this.name = 'RegistryApplyError';
    this.status = status;
  }
}

export type AppliedRegistryChange = {
  field: string;
  from: RegistryScalar;
  to: RegistryScalar;
};

type Tx = Prisma.TransactionClient;

const dateOnly = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

function isDateTarget(target: RegistryTarget): boolean {
  return (
    (target.kind === 'profile' && target.column === 'establishedOn') ||
    (target.kind === 'council' &&
      (target.column === 'appointedOn' || target.column === 'endedOn'))
  );
}

/** The registry must still hold what the submitter saw. */
function assertCurrent(change: ResolvedRegistryChange, live: RegistryScalar) {
  let expected = change.previousValue;
  if (isDateTarget(change.target) && typeof expected === 'string') {
    expected = expected.slice(0, 10);
  }
  if (live !== expected) {
    throw new RegistryApplyError(
      409,
      `"${change.field}" has changed in the registry since this was submitted. Ask the officer to resubmit, or request changes.`,
    );
  }
}

function profileData(
  column: ProfileColumn,
  value: RegistryScalar,
): Prisma.SocietyUpdateInput {
  switch (column) {
    case 'nameEn':
      return { nameEn: String(value) };
    case 'nameLocal':
      return { nameLocal: String(value) };
    case 'dsDivision':
      return { dsDivision: String(value) };
    case 'gnDivision':
      return { gnDivision: String(value) };
    case 'village':
      return { village: String(value) };
    case 'addressLine':
      return { addressLine: String(value) };
    case 'latitude':
      return { latitude: Number(value) };
    case 'longitude':
      return { longitude: Number(value) };
    case 'establishedOn':
      return { establishedOn: new Date(`${String(value)}T00:00:00.000Z`) };
  }
}

function councilData(
  column: CouncilColumn,
  value: RegistryScalar,
): Prisma.SocietyCouncilMemberUpdateInput {
  switch (column) {
    case 'fullName':
      return { fullName: String(value) };
    case 'position':
      return { position: String(value) };
    case 'appointedOn':
      return { appointedOn: new Date(`${String(value)}T00:00:00.000Z`) };
    case 'endedOn':
      return { endedOn: new Date(`${String(value)}T00:00:00.000Z`) };
  }
}

interface ProfileItem {
  change: ResolvedRegistryChange;
  column: ProfileColumn;
}
interface CouncilItem {
  change: ResolvedRegistryChange;
  column: CouncilColumn;
}
interface MembershipItem {
  change: ResolvedRegistryChange;
  gender: MembershipGender;
}

async function applyProfile(
  tx: Tx,
  societyId: string,
  items: ProfileItem[],
  applied: AppliedRegistryChange[],
) {
  await tx.$queryRaw`SELECT 1 AS locked FROM societies WHERE id = ${societyId}::uuid FOR UPDATE`;
  const live = await tx.society.findUnique({ where: { id: societyId } });
  if (!live) throw new RegistryApplyError(409, 'The society no longer exists');

  let latitude = live.latitude;
  let longitude = live.longitude;
  const data: Prisma.SocietyUpdateInput = {};
  for (const { change, column } of items) {
    const current: RegistryScalar =
      column === 'establishedOn' ? dateOnly(live.establishedOn) : live[column];
    assertCurrent(change, current);
    Object.assign(data, profileData(column, change.value));
    if (column === 'latitude') latitude = Number(change.value);
    if (column === 'longitude') longitude = Number(change.value);
    applied.push({ field: change.field, from: current, to: change.value });
  }
  if ((latitude === null) !== (longitude === null)) {
    throw new RegistryApplyError(
      400,
      'Latitude and longitude must be supplied together',
    );
  }
  await tx.society.update({ where: { id: societyId }, data });
}

async function applyCouncilSeat(
  tx: Tx,
  societyId: string,
  seatNumber: number,
  items: CouncilItem[],
  applied: AppliedRegistryChange[],
) {
  await tx.$queryRaw`SELECT 1 AS locked FROM society_council_members WHERE society_id = ${societyId}::uuid AND seat_number = ${seatNumber} FOR UPDATE`;
  const member = await tx.societyCouncilMember.findUnique({
    where: { societyId_seatNumber: { societyId, seatNumber } },
  });
  if (!member) {
    throw new RegistryApplyError(
      400,
      `Council seat ${seatNumber} does not exist, so approval cannot update it`,
    );
  }

  let appointedOn = dateOnly(member.appointedOn);
  let endedOn = dateOnly(member.endedOn);
  const data: Prisma.SocietyCouncilMemberUpdateInput = {};
  for (const { change, column } of items) {
    const current: RegistryScalar =
      column === 'fullName'
        ? member.fullName
        : column === 'position'
          ? member.position
          : column === 'appointedOn'
            ? dateOnly(member.appointedOn)
            : dateOnly(member.endedOn);
    assertCurrent(change, current);
    Object.assign(data, councilData(column, change.value));
    if (column === 'appointedOn') appointedOn = String(change.value);
    if (column === 'endedOn') endedOn = String(change.value);
    applied.push({ field: change.field, from: current, to: change.value });
  }
  if (appointedOn !== null && endedOn !== null && endedOn < appointedOn) {
    throw new RegistryApplyError(
      400,
      `Council seat ${seatNumber} would have an invalid date range`,
    );
  }
  await tx.societyCouncilMember.update({ where: { id: member.id }, data });
}

async function applyMembershipRow(
  tx: Tx,
  societyId: string,
  year: number,
  category: MembershipCategory,
  items: MembershipItem[],
  applied: AppliedRegistryChange[],
) {
  await tx.$queryRaw`SELECT 1 AS locked FROM society_membership_counts WHERE society_id = ${societyId}::uuid AND year = ${year} AND category = ${category}::membership_category FOR UPDATE`;
  const row = await tx.societyMembershipCount.findUnique({
    where: { societyId_year_category: { societyId, year, category } },
  });
  if (!row) {
    throw new RegistryApplyError(
      400,
      `No membership record exists for ${year} ${category}. Creating new records through approval is not supported`,
    );
  }
  const data: Prisma.SocietyMembershipCountUpdateInput = {};
  for (const { change, gender } of items) {
    const current = row[gender];
    assertCurrent(change, current);
    if (gender === 'female') data.female = Number(change.value);
    else data.male = Number(change.value);
    applied.push({ field: change.field, from: current, to: change.value });
  }
  await tx.societyMembershipCount.update({ where: { id: row.id }, data });
}

/**
 * Applies approved changes to the registry inside the caller's transaction.
 * Any thrown error rolls the whole approval back. Rows are locked first so a
 * concurrent direct edit cannot slip in between the check and the write.
 */
export async function applyRegistryChanges(
  tx: Tx,
  societyId: string,
  changes: readonly ResolvedRegistryChange[],
): Promise<AppliedRegistryChange[]> {
  const applied: AppliedRegistryChange[] = [];
  const profile: ProfileItem[] = [];
  const council = new Map<number, CouncilItem[]>();
  const membership = new Map<
    string,
    {
      year: number;
      category: MembershipCategory;
      items: MembershipItem[];
    }
  >();

  for (const change of changes) {
    const target = change.target;
    if (target.kind === 'profile') {
      profile.push({ change, column: target.column });
    } else if (target.kind === 'council') {
      const list = council.get(target.seatNumber) ?? [];
      list.push({ change, column: target.column });
      council.set(target.seatNumber, list);
    } else {
      const key = `${target.year}:${target.category}`;
      const group = membership.get(key) ?? {
        year: target.year,
        category: target.category,
        items: [],
      };
      group.items.push({ change, gender: target.gender });
      membership.set(key, group);
    }
  }

  if (profile.length > 0) await applyProfile(tx, societyId, profile, applied);
  for (const seat of [...council.keys()].sort((a, b) => a - b)) {
    await applyCouncilSeat(tx, societyId, seat, council.get(seat) ?? [], applied);
  }
  for (const key of [...membership.keys()].sort((a, b) => a.localeCompare(b))) {
    const group = membership.get(key);
    if (group) {
      await applyMembershipRow(
        tx,
        societyId,
        group.year,
        group.category,
        group.items,
        applied,
      );
    }
  }
  return applied;
}
