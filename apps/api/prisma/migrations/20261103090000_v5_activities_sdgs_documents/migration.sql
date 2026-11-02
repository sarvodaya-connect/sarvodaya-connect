-- V5 PR 4: activities are created by the Society Officer and approved by the
-- SPC, who chooses their UN SDGs. Existing activities were planned before
-- review existed, so they start as approved.
CREATE TYPE "activity_status" AS ENUM ('WAITING_FOR_SPC', 'SENT_BACK', 'APPROVED');
CREATE TYPE "activity_dimension" AS ENUM ('SOCIAL', 'ECONOMIC', 'GOVERNANCE');

ALTER TABLE "work_plan_activities"
  ADD COLUMN "dimension" "activity_dimension",
  ADD COLUMN "status" "activity_status" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "female_participants" INTEGER,
  ADD COLUMN "male_participants" INTEGER,
  ADD COLUMN "youth_participants" INTEGER,
  ADD COLUMN "households_benefited" INTEGER,
  ADD COLUMN "women_headed_households" INTEGER,
  ADD COLUMN "partners" VARCHAR(500),
  ADD COLUMN "resources_needed" VARCHAR(500),
  ADD COLUMN "volunteer_hours" INTEGER,
  ADD COLUMN "created_by_id" VARCHAR(64),
  ADD COLUMN "created_by_name" VARCHAR(150),
  ADD COLUMN "created_by_role" VARCHAR(40),
  ADD COLUMN "submitted_at" TIMESTAMPTZ(3),
  ADD COLUMN "reviewed_by_id" VARCHAR(64),
  ADD COLUMN "reviewed_by_name" VARCHAR(150),
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(3),
  ADD COLUMN "review_comment" VARCHAR(500);

CREATE INDEX "work_plan_activities_status_submitted_at_idx" ON "work_plan_activities"("status", "submitted_at");
CREATE INDEX "work_plan_activities_status_reviewed_at_idx" ON "work_plan_activities"("status", "reviewed_at");

CREATE TABLE "work_plan_activity_sdgs" (
    "activity_id" UUID NOT NULL,
    "sdg" SMALLINT NOT NULL,

    CONSTRAINT "work_plan_activity_sdgs_pkey" PRIMARY KEY ("activity_id", "sdg"),
    CONSTRAINT "work_plan_activity_sdgs_sdg_check" CHECK ("sdg" BETWEEN 1 AND 17)
);
CREATE INDEX "work_plan_activity_sdgs_sdg_idx" ON "work_plan_activity_sdgs"("sdg");
ALTER TABLE "work_plan_activity_sdgs" ADD CONSTRAINT "work_plan_activity_sdgs_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "work_plan_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Registrar documents (audit report, AGM minutes, office-bearer list, members
-- list) are kept per financial year; the checksum is verified by storage.
ALTER TABLE "society_documents" ADD COLUMN "checksum_sha256" VARCHAR(64);
