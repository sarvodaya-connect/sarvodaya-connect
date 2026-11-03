import type {
  DistrictAccessHistoryEntry,
  DistrictAccessStatus,
} from './district-access.types.js';

/** Longest grant when DISTRICT_ACCESS_MAX_DAYS is not set. */
export const DEFAULT_MAX_DAYS = 14;
/** A DDM opening the same society again within this time is recorded once. */
export const OPEN_RECORD_WINDOW_MS = 30 * 60_000;
/** A start time this far in the past still counts as "now" (form round trips). */
export const START_GRACE_MS = 10 * 60_000;

export function maxDaysFrom(value: string | undefined): number {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 90
    ? days
    : DEFAULT_MAX_DAYS;
}

export function grantStatus(
  grant: { startsAt: Date; expiresAt: Date; revokedAt: Date | null },
  now: Date,
): DistrictAccessStatus {
  if (grant.revokedAt) return 'ENDED_EARLY';
  if (grant.expiresAt <= now) return 'ENDED';
  if (grant.startsAt > now) return 'SCHEDULED';
  return 'ACTIVE';
}

/** Why a new grant is refused, or null when it may be given. */
export function grantProblem(
  input: { startsAt: Date; expiresAt: Date },
  overlapping: number,
  maxDays: number,
  now: Date,
): string | null {
  if (
    Number.isNaN(input.startsAt.getTime()) ||
    Number.isNaN(input.expiresAt.getTime())
  )
    return 'Choose a start and an end time.';
  if (input.startsAt.getTime() < now.getTime() - START_GRACE_MS)
    return 'The start time cannot be in the past.';
  if (input.expiresAt <= input.startsAt)
    return 'The end time must be after the start time.';
  if (
    input.expiresAt.getTime() - input.startsAt.getTime() >
    maxDays * 86_400_000
  )
    return `Temporary access can last at most ${maxDays} days.`;
  if (overlapping)
    return 'This DDM already has temporary access for some of that time. End it first or choose other dates.';
  return null;
}

/**
 * M32 / DM04 "Access history": given, started, the societies opened, and how it
 * ended — newest first.
 */
export function grantHistory(
  grant: {
    startsAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
  },
  names: {
    grantedBy: string | null;
    deputy: string;
    endedBy: string | null;
  },
  opened: { at: Date; societyName: string }[],
  now: Date,
): DistrictAccessHistoryEntry[] {
  const entries: DistrictAccessHistoryEntry[] = [
    {
      kind: 'GIVEN',
      at: grant.createdAt.toISOString(),
      actorName: names.grantedBy,
    },
  ];
  const endedAt =
    grant.revokedAt ?? (grant.expiresAt <= now ? grant.expiresAt : null);
  if (
    grant.startsAt <= now &&
    (!grant.revokedAt || grant.revokedAt > grant.startsAt)
  )
    // A grant that starts "now" cannot start before it was given.
    entries.push({
      kind: 'STARTED',
      at: (grant.startsAt > grant.createdAt
        ? grant.startsAt
        : grant.createdAt
      ).toISOString(),
      actorName: null,
    });
  for (const open of opened)
    entries.push({
      kind: 'OPENED',
      at: open.at.toISOString(),
      actorName: names.deputy,
      societyName: open.societyName,
    });
  if (endedAt)
    entries.push(
      grant.revokedAt
        ? {
            kind: 'ENDED_EARLY',
            at: endedAt.toISOString(),
            actorName: names.endedBy,
          }
        : { kind: 'ENDED', at: endedAt.toISOString(), actorName: null },
    );
  // Newest first; at the same moment, the later step in a grant's life first.
  const step = { GIVEN: 0, STARTED: 1, OPENED: 2, ENDED: 3, ENDED_EARLY: 3 };
  return entries.sort(
    (a, b) => b.at.localeCompare(a.at) || step[b.kind] - step[a.kind],
  );
}
