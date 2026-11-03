-- V5 PR 8: disaster response on every role (D30-D33, IR01-IR05, M40-M49).
-- Incidents cover several districts, record who opened and closed them, and
-- carry the assessment deadline. Assessments hold the V5 counts; response
-- actions get helping societies; photos are kept as S3 evidence keys.
-- CreateEnum
CREATE TYPE "emergency_impact" AS ENUM ('SAFE', 'AFFECTED', 'CRITICAL');

-- CreateEnum
CREATE TYPE "emergency_road_access" AS ENUM ('OPEN', 'PARTLY_BLOCKED', 'CUT_OFF', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "emergency_need" AS ENUM ('DRINKING_WATER', 'DRY_RATIONS', 'TEMPORARY_SHELTER', 'MEDICAL_HELP', 'CLOTHING', 'VOLUNTEERS', 'OTHER');

-- CreateEnum
CREATE TYPE "emergency_helper_status" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'DELIVERED');

-- AlterTable
ALTER TABLE "emergency_assessments" ADD COLUMN     "confirmed_with_president" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "created_by_name" VARCHAR(150),
ADD COLUMN     "houses_fully_damaged" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "houses_partly_damaged" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "impact" "emergency_impact" NOT NULL DEFAULT 'AFFECTED',
ADD COLUMN     "injured" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "needs" "emergency_need"[] DEFAULT ARRAY[]::"emergency_need"[],
ADD COLUMN     "road_access" "emergency_road_access" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "emergency_incidents" ADD COLUMN     "area_district_ids" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "assessments_due_at" TIMESTAMPTZ(3),
ADD COLUMN     "closed_by_id" VARCHAR(64),
ADD COLUMN     "closed_by_name" VARCHAR(150),
ADD COLUMN     "closed_by_role" VARCHAR(40),
ADD COLUMN     "created_by_name" VARCHAR(150),
ADD COLUMN     "created_by_role" VARCHAR(40),
ADD COLUMN     "last_reminder_at" TIMESTAMPTZ(3),
ADD COLUMN     "message" VARCHAR(1000) NOT NULL DEFAULT '',
ADD COLUMN     "reference_number" SERIAL NOT NULL,
ADD COLUMN     "reporting_society_id" UUID,
ADD COLUMN     "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "severity" SET DEFAULT 'MODERATE';

-- Existing incidents cover their own district.
UPDATE "emergency_incidents" SET "area_district_ids" = ARRAY["district_id"];

-- AlterTable
ALTER TABLE "emergency_response_actions" ADD COLUMN     "created_by_name" VARCHAR(150),
ADD COLUMN     "need" "emergency_need" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unit" VARCHAR(30) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "emergency_situation_reports" ADD COLUMN     "as_of" TIMESTAMPTZ(3),
ADD COLUMN     "created_by_name" VARCHAR(150),
ADD COLUMN     "number" INTEGER,
ADD COLUMN     "snapshot" JSONB;

-- CreateTable
CREATE TABLE "emergency_action_helpers" (
    "id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "helper_society_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "delivered_quantity" INTEGER NOT NULL DEFAULT 0,
    "status" "emergency_helper_status" NOT NULL DEFAULT 'ASSIGNED',
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "delivery_note" VARCHAR(1000) NOT NULL DEFAULT '',
    "delivered_on" DATE,
    "assigned_by_id" VARCHAR(64) NOT NULL,
    "assigned_by_name" VARCHAR(150) NOT NULL,
    "updated_by_id" VARCHAR(64),
    "updated_by_name" VARCHAR(150),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "emergency_action_helpers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_evidence" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "assessment_id" UUID,
    "helper_id" UUID,
    "storage_key" VARCHAR(600) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" VARCHAR(44),
    "uploaded_by_id" VARCHAR(64) NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emergency_action_helpers_helper_society_id_idx" ON "emergency_action_helpers"("helper_society_id");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_action_helpers_action_id_helper_society_id_key" ON "emergency_action_helpers"("action_id", "helper_society_id");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_evidence_storage_key_key" ON "emergency_evidence"("storage_key");

-- CreateIndex
CREATE INDEX "emergency_evidence_assessment_id_idx" ON "emergency_evidence"("assessment_id");

-- CreateIndex
CREATE INDEX "emergency_evidence_helper_id_idx" ON "emergency_evidence"("helper_id");

-- CreateIndex
CREATE INDEX "emergency_assessments_incident_id_status_created_at_idx" ON "emergency_assessments"("incident_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_incidents_reference_number_key" ON "emergency_incidents"("reference_number");

-- CreateIndex
CREATE INDEX "emergency_incidents_area_district_ids_idx" ON "emergency_incidents" USING GIN ("area_district_ids");

-- CreateIndex
CREATE INDEX "emergency_incidents_status_activated_at_idx" ON "emergency_incidents"("status", "activated_at");

-- CreateIndex
CREATE INDEX "emergency_response_actions_society_id_idx" ON "emergency_response_actions"("society_id");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_situation_reports_incident_id_number_key" ON "emergency_situation_reports"("incident_id", "number");

-- AddForeignKey
ALTER TABLE "emergency_incidents" ADD CONSTRAINT "emergency_incidents_reporting_society_id_fkey" FOREIGN KEY ("reporting_society_id") REFERENCES "societies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_action_helpers" ADD CONSTRAINT "emergency_action_helpers_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "emergency_response_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_action_helpers" ADD CONSTRAINT "emergency_action_helpers_helper_society_id_fkey" FOREIGN KEY ("helper_society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_evidence" ADD CONSTRAINT "emergency_evidence_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "emergency_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_evidence" ADD CONSTRAINT "emergency_evidence_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_evidence" ADD CONSTRAINT "emergency_evidence_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "emergency_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_evidence" ADD CONSTRAINT "emergency_evidence_helper_id_fkey" FOREIGN KEY ("helper_id") REFERENCES "emergency_action_helpers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

