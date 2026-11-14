-- Issue #143: members younger than 18, and when the membership figures last
-- changed. Existing societies get neither: nothing is guessed, and the record
-- says the figures have not been entered or the time was not recorded.

-- AlterTable
ALTER TABLE "societies" ADD COLUMN     "under_18_members" INTEGER,
ADD COLUMN     "membership_updated_at" TIMESTAMPTZ(3);

-- Under 18s are a part of the total, so they are entered only with the
-- female/male split and are never more than the total.
ALTER TABLE "societies" ADD CONSTRAINT "societies_under_18_check" CHECK (
  "under_18_members" IS NULL
  OR (
    -- IS NOT NULL is spelled out: a CHECK that evaluates to NULL would pass.
    "under_18_members" IS NOT NULL
    AND "female_members" IS NOT NULL
    AND "male_members" IS NOT NULL
    AND "member_count" IS NOT NULL
    AND "under_18_members" >= 0
    AND "under_18_members" <= "member_count"
  )
);
