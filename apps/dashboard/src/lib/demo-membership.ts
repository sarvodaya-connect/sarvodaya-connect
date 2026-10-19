import type {
  MembershipCategory,
  MembershipDashboardSummary,
} from "@sarvodaya-connect/api-contracts";
import { societyDetails } from "./demo-registry";
import { canSeeSociety, type DemoViewer } from "./access";

const categories = [
  "CHILDREN",
  "YOUTH",
  "MOTHERS",
  "ORDINARY",
  "ELDERS_COUNCIL",
] as const satisfies readonly MembershipCategory[];
const featuredCounts: Record<
  MembershipCategory,
  { female: number; male: number }
> = {
  CHILDREN: { female: 178, male: 164 },
  YOUTH: { female: 246, male: 219 },
  MOTHERS: { female: 526, male: 0 },
  ORDINARY: { female: 1485, male: 1328 },
  ELDERS_COUNCIL: { female: 82, male: 65 },
};
const fictionalScales = [1, 0.78, 0.63, 0.54, 0.42, 0.35, 0.31];

export const demoMembershipSocieties = societyDetails.map((society, index) => {
  const scale = fictionalScales[index] ?? 0.25;
  const counts = categories.map((category) => {
    const female = Math.round(featuredCounts[category].female * scale);
    const male = Math.round(featuredCounts[category].male * scale);
    return { category, female, male, total: female + male };
  });
  const femaleTotal = counts.reduce((sum, row) => sum + row.female, 0);
  const maleTotal = counts.reduce((sum, row) => sum + row.male, 0);
  return {
    societyId: society.id,
    societyCode: society.societyCode,
    societyName: society.nameEn,
    districtId: society.district.id,
    districtName: society.district.nameEn,
    year: 2026,
    categories: counts,
    femaleTotal,
    maleTotal,
    overallTotal: femaleTotal + maleTotal,
  };
});

export function membershipVisibleTo<
  T extends { societyId: string; districtId: string },
>(societies: T[], viewer: DemoViewer) {
  return societies.filter((society) => canSeeSociety(viewer, society));
}

export function calculateMembershipTotals(
  societies: MembershipDashboardSummary["societies"],
  year = 2026,
): MembershipDashboardSummary {
  const selected = societies.filter((society) => society.year === year);
  const categoryTotals = categories.map((category) => {
    const female = selected.reduce(
      (sum, society) =>
        sum +
        (society.categories.find((row) => row.category === category)?.female ??
          0),
      0,
    );
    const male = selected.reduce(
      (sum, society) =>
        sum +
        (society.categories.find((row) => row.category === category)?.male ??
          0),
      0,
    );
    return { category, female, male, total: female + male };
  });
  const femaleTotal = categoryTotals.reduce(
    (sum, category) => sum + category.female,
    0,
  );
  const maleTotal = categoryTotals.reduce(
    (sum, category) => sum + category.male,
    0,
  );
  return {
    year,
    societies: selected,
    categories: categoryTotals,
    femaleTotal,
    maleTotal,
    overallTotal: femaleTotal + maleTotal,
  };
}
