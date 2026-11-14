-- Issue #141: female and male members on the society profile.
-- Existing societies keep their member_count and get no split (both NULL),
-- so nothing is guessed. Once a split is entered, member_count is its sum.

-- AlterTable
ALTER TABLE "societies" ADD COLUMN     "female_members" INTEGER,
ADD COLUMN     "male_members" INTEGER;

-- Both counts are entered together, are never negative, and add up to the total.
ALTER TABLE "societies" ADD CONSTRAINT "societies_member_split_check" CHECK (
  ("female_members" IS NULL AND "male_members" IS NULL)
  OR (
    -- IS NOT NULL is spelled out: a CHECK that evaluates to NULL would pass.
    "female_members" IS NOT NULL
    AND "male_members" IS NOT NULL
    AND "member_count" IS NOT NULL
    AND "female_members" >= 0
    AND "male_members" >= 0
    AND "member_count" = "female_members" + "male_members"
  )
);
