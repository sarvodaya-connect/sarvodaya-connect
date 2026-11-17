-- Issue #169 (V6 Development Goals): the SPC records one or more Sarvodaya
-- dimensions and one or more of the ten categories, alongside the UN SDGs,
-- when approving an activity.
--
-- Additive only. No existing column, row or constraint changes, and nothing is
-- backfilled: every existing activity keeps classified_at NULL and is reported
-- as NOT_CLASSIFIED. Its Society Officer sector/dimension stay as entered and
-- are never copied into the SPC's classification.

CREATE TYPE "activity_category" AS ENUM (
  'COMMUNITY_EDUCATION',
  'CHILD_WELLBEING',
  'CULTURE',
  'ECONOMY',
  'GOVERNANCE',
  'HEALTH_NUTRITION',
  'HOUSING_INFRASTRUCTURE',
  'SPIRITUAL_DEVELOPMENT',
  'AGRICULTURE',
  'ENVIRONMENT'
);

-- Set in the same transaction as the approval, only when Development Goals
-- were recorded. A classification belongs to an approved activity only.
ALTER TABLE "work_plan_activities" ADD COLUMN "classified_at" TIMESTAMPTZ(3);
ALTER TABLE "work_plan_activities"
  ADD CONSTRAINT "work_plan_activities_classified_when_approved"
  CHECK ("classified_at" IS NULL OR "status" = 'APPROVED');

CREATE TABLE "work_plan_activity_dimensions" (
    "activity_id" UUID NOT NULL,
    "dimension" "activity_dimension" NOT NULL,

    CONSTRAINT "work_plan_activity_dimensions_pkey" PRIMARY KEY ("activity_id", "dimension")
);
CREATE INDEX "work_plan_activity_dimensions_dimension_idx" ON "work_plan_activity_dimensions"("dimension");
ALTER TABLE "work_plan_activity_dimensions" ADD CONSTRAINT "work_plan_activity_dimensions_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "work_plan_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "work_plan_activity_categories" (
    "activity_id" UUID NOT NULL,
    "category" "activity_category" NOT NULL,

    CONSTRAINT "work_plan_activity_categories_pkey" PRIMARY KEY ("activity_id", "category")
);
CREATE INDEX "work_plan_activity_categories_category_idx" ON "work_plan_activity_categories"("category");
ALTER TABLE "work_plan_activity_categories" ADD CONSTRAINT "work_plan_activity_categories_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "work_plan_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
