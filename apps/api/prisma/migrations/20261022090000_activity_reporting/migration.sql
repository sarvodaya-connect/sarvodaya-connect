CREATE TYPE "activity_report_status" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'RESUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "activity_dimension" AS ENUM ('SOCIAL', 'ECONOMIC', 'GOVERNANCE');

CREATE TABLE "activity_classifications" (
  "id" UUID NOT NULL,
  "sector" VARCHAR(80) NOT NULL,
  "dimension" "activity_dimension" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "activity_classifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "activity_classifications_sector_dimension_key" ON "activity_classifications"("sector", "dimension");

CREATE TABLE "activity_reports" (
  "id" UUID NOT NULL,
  "society_id" UUID NOT NULL,
  "classification_id" UUID NOT NULL,
  "sdgs" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(4000) NOT NULL,
  "activity_date" DATE NOT NULL,
  "location" VARCHAR(255) NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "female_participants" INTEGER NOT NULL DEFAULT 0,
  "male_participants" INTEGER NOT NULL DEFAULT 0,
  "other_participants" INTEGER NOT NULL DEFAULT 0,
  "outcomes" VARCHAR(4000),
  "status" "activity_report_status" NOT NULL DEFAULT 'DRAFT',
  "submitted_by_id" VARCHAR(64) NOT NULL,
  "submitted_at" TIMESTAMPTZ(3),
  "approved_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "activity_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_reports_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_reports_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "activity_classifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_reports_female_participants_check" CHECK ("female_participants" >= 0),
  CONSTRAINT "activity_reports_male_participants_check" CHECK ("male_participants" >= 0),
  CONSTRAINT "activity_reports_other_participants_check" CHECK ("other_participants" >= 0),
  CONSTRAINT "activity_reports_coordinates_check" CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180))
);
CREATE INDEX "activity_reports_society_id_activity_date_idx" ON "activity_reports"("society_id", "activity_date");
CREATE INDEX "activity_reports_status_activity_date_idx" ON "activity_reports"("status", "activity_date");
CREATE INDEX "activity_reports_classification_id_activity_date_idx" ON "activity_reports"("classification_id", "activity_date");
