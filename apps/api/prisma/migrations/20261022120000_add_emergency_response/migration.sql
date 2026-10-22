CREATE TYPE "emergency_incident_type" AS ENUM ('FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT', 'FIRE', 'PUBLIC_HEALTH', 'OTHER');
CREATE TYPE "emergency_severity" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');
CREATE TYPE "emergency_incident_status" AS ENUM ('ACTIVE', 'CONTAINED', 'CLOSED');
CREATE TYPE "emergency_record_status" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "emergency_action_status" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "emergency_incidents" (
  "id" UUID NOT NULL,
  "district_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "type" "emergency_incident_type" NOT NULL,
  "severity" "emergency_severity" NOT NULL,
  "status" "emergency_incident_status" NOT NULL DEFAULT 'ACTIVE',
  "description" VARCHAR(4000) NOT NULL,
  "location" VARCHAR(200) NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "created_by_id" VARCHAR(64) NOT NULL,
  "activated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "emergency_incidents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "emergency_incidents_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "emergency_assessments" (
  "id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "society_id" UUID NOT NULL,
  "client_mutation_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" "emergency_record_status" NOT NULL DEFAULT 'DRAFT',
  "observed_at" TIMESTAMPTZ(3) NOT NULL,
  "people_affected" INTEGER NOT NULL DEFAULT 0,
  "households_affected" INTEGER NOT NULL DEFAULT 0,
  "displaced_people" INTEGER NOT NULL DEFAULT 0,
  "infrastructure_notes" VARCHAR(2000) NOT NULL DEFAULT '',
  "urgent_needs" VARCHAR(2000) NOT NULL DEFAULT '',
  "notes" VARCHAR(4000) NOT NULL DEFAULT '',
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "created_by_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "emergency_assessments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "emergency_assessments_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "emergency_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "emergency_assessments_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "emergency_assessments_people_check" CHECK ("people_affected" >= 0 AND "households_affected" >= 0 AND "displaced_people" >= 0),
  CONSTRAINT "emergency_assessments_coordinates_check" CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180))
);

CREATE TABLE "emergency_response_actions" (
  "id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "society_id" UUID,
  "client_mutation_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(2000) NOT NULL DEFAULT '',
  "status" "emergency_action_status" NOT NULL DEFAULT 'PLANNED',
  "due_at" TIMESTAMPTZ(3),
  "created_by_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "emergency_response_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "emergency_response_actions_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "emergency_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "emergency_response_actions_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "emergency_situation_reports" (
  "id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "society_id" UUID,
  "client_mutation_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" "emergency_record_status" NOT NULL DEFAULT 'DRAFT',
  "summary" VARCHAR(4000) NOT NULL,
  "needs" VARCHAR(2000) NOT NULL DEFAULT '',
  "created_by_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "emergency_situation_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "emergency_situation_reports_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "emergency_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "emergency_situation_reports_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "emergency_assessments_created_by_id_client_mutation_id_key" ON "emergency_assessments"("created_by_id", "client_mutation_id");
CREATE INDEX "emergency_incidents_district_id_status_activated_at_idx" ON "emergency_incidents"("district_id", "status", "activated_at");
CREATE INDEX "emergency_assessments_incident_id_society_id_status_idx" ON "emergency_assessments"("incident_id", "society_id", "status");
CREATE UNIQUE INDEX "emergency_response_actions_created_by_id_client_mutation_id_key" ON "emergency_response_actions"("created_by_id", "client_mutation_id");
CREATE INDEX "emergency_response_actions_incident_id_status_due_at_idx" ON "emergency_response_actions"("incident_id", "status", "due_at");
CREATE UNIQUE INDEX "emergency_situation_reports_created_by_id_client_mutation_id_key" ON "emergency_situation_reports"("created_by_id", "client_mutation_id");
CREATE INDEX "emergency_situation_reports_incident_id_status_created_at_idx" ON "emergency_situation_reports"("incident_id", "status", "created_at");
