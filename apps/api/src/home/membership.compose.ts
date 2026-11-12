import { MEMBERSHIP_CATEGORY_VALUES } from '../societies/societies.service.js';
import type { ScopedMembership } from './home.types.js';

export interface MembershipSociety {
  id: string;
  status: string;
  memberCount: number | null;
  district: { id: string; nameEn: string };
}

export interface MembershipCount {
  societyId: string;
  category: string;
  female: number;
  male: number;
}

/**
 * Issue #118: the D08 figures for the societies already limited to the
 * user's scope. Uses HQ's definitions: only active societies count, and a
 * society has reported when its category counts for the year are above zero.
 * Profile member counts are kept apart because they have no female/male split.
 */
export function composeMembership(input: {
  scope: ScopedMembership['scope'];
  societies: MembershipSociety[];
  year: number | null;
  /** Category counts for `year`, from the active societies in scope only. */
  counts: MembershipCount[];
  districtView: ScopedMembership['districtView'];
}): ScopedMembership {
  const active = input.societies.filter((s) => s.status === 'ACTIVE');
  const activeIds = new Set(active.map((s) => s.id));
  const counts = input.counts.filter((row) => activeIds.has(row.societyId));
  const reported = new Set(
    counts
      .filter((row) => row.female > 0 || row.male > 0)
      .map((row) => row.societyId),
  );

  const categories = MEMBERSHIP_CATEGORY_VALUES.map((category) => {
    const rows = counts.filter((row) => row.category === category);
    const female = rows.reduce((sum, row) => sum + row.female, 0);
    const male = rows.reduce((sum, row) => sum + row.male, 0);
    return { category, female, male, total: female + male };
  });
  const female = categories.reduce((sum, row) => sum + row.female, 0);
  const male = categories.reduce((sum, row) => sum + row.male, 0);

  const districtOf = new Map(active.map((s) => [s.id, s.district.id]));
  const districts = [
    ...new Map(
      input.societies.map((s) => [s.district.id, s.district]),
    ).values(),
  ]
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn))
    .map((district) => {
      const rows = counts.filter(
        (row) => districtOf.get(row.societyId) === district.id,
      );
      const districtFemale = rows.reduce((sum, row) => sum + row.female, 0);
      const districtMale = rows.reduce((sum, row) => sum + row.male, 0);
      return {
        id: district.id,
        name: district.nameEn,
        active: active.filter((s) => s.district.id === district.id).length,
        female: districtFemale,
        male: districtMale,
        total: districtFemale + districtMale,
      };
    });

  const withProfile = active.filter((s) => s.memberCount !== null);
  return {
    scope: input.scope,
    year: input.year,
    activeSocieties: active.length,
    societiesReported: reported.size,
    female,
    male,
    total: female + male,
    categories,
    districts,
    profile: {
      societies: withProfile.length,
      members: withProfile.reduce((sum, s) => sum + (s.memberCount ?? 0), 0),
      withoutBreakdown: withProfile.filter((s) => !reported.has(s.id)).length,
    },
    districtView: input.districtView,
  };
}
