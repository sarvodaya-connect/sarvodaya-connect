-- V5 PR 5: HQ National Dashboard, directory, Alerts topics and HQ requests.
-- CreateEnum
CREATE TYPE "notification_topic" AS ENUM ('GRADE_REQUEST', 'INCIDENT', 'ACCESS', 'RECORDS', 'ACTIVITY', 'ACCOUNT', 'INFORMATION_REQUEST');

-- CreateEnum
CREATE TYPE "information_request_audience" AS ENUM ('ALL_ACTIVE', 'DISTRICT', 'FIGURES_NOT_ADDED', 'AUDIT_PAST_DUE');

-- AlterTable
ALTER TABLE "districts" ADD COLUMN     "province" VARCHAR(60);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "topic" "notification_topic";

-- CreateTable
CREATE TABLE "information_requests" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "audience" "information_request_audience" NOT NULL,
    "district_id" UUID,
    "financial_year_start" INTEGER,
    "due_on" DATE NOT NULL,
    "created_by_id" VARCHAR(64) NOT NULL,
    "created_by_name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "information_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "information_request_societies" (
    "request_id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "responded_at" TIMESTAMPTZ(3),
    "responded_by_id" VARCHAR(64),
    "responded_by_name" VARCHAR(150),
    "note" VARCHAR(500),

    CONSTRAINT "information_request_societies_pkey" PRIMARY KEY ("request_id","society_id")
);

-- CreateIndex
CREATE INDEX "information_requests_created_at_idx" ON "information_requests"("created_at");

-- CreateIndex
CREATE INDEX "information_request_societies_society_id_responded_at_idx" ON "information_request_societies"("society_id", "responded_at");

-- CreateIndex
CREATE INDEX "information_request_societies_request_id_responded_at_idx" ON "information_request_societies"("request_id", "responded_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_topic_created_at_idx" ON "notifications"("recipient_user_id", "topic", "created_at");

-- CreateIndex
CREATE INDEX "societies_status_updated_at_idx" ON "societies"("status", "updated_at");

-- AddForeignKey
ALTER TABLE "information_requests" ADD CONSTRAINT "information_requests_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_request_societies" ADD CONSTRAINT "information_request_societies_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "information_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "information_request_societies" ADD CONSTRAINT "information_request_societies_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Provinces of the 25 administrative districts (public information).
UPDATE "districts" AS d SET "province" = p.province
FROM (VALUES
  ('Ampara', 'Eastern Province'), ('Anuradhapura', 'North Central Province'),
  ('Badulla', 'Uva Province'), ('Batticaloa', 'Eastern Province'),
  ('Colombo', 'Western Province'), ('Galle', 'Southern Province'),
  ('Gampaha', 'Western Province'), ('Hambantota', 'Southern Province'),
  ('Jaffna', 'Northern Province'), ('Kalutara', 'Western Province'),
  ('Kandy', 'Central Province'), ('Kegalle', 'Sabaragamuwa Province'),
  ('Kilinochchi', 'Northern Province'), ('Kurunegala', 'North Western Province'),
  ('Mannar', 'Northern Province'), ('Matale', 'Central Province'),
  ('Matara', 'Southern Province'), ('Monaragala', 'Uva Province'),
  ('Mullaitivu', 'Northern Province'), ('Nuwara Eliya', 'Central Province'),
  ('Polonnaruwa', 'North Central Province'), ('Puttalam', 'North Western Province'),
  ('Ratnapura', 'Sabaragamuwa Province'), ('Trincomalee', 'Eastern Province'),
  ('Vavuniya', 'Northern Province')
) AS p(name, province)
WHERE d."name_en" = p.name AND d."province" IS NULL;

-- Give existing notifications the topic their sender would now set.
UPDATE "notifications" SET "topic" = 'ACTIVITY'
WHERE "topic" IS NULL AND ("link_path" LIKE '/activities-to-approve/%' OR "link_path" LIKE '/societies/%/work-plan');
UPDATE "notifications" SET "topic" = 'GRADE_REQUEST'
WHERE "topic" IS NULL AND "category" IN ('REQUEST', 'APPROVAL', 'RETURNED') AND "link_path" ~ '^/societies/[0-9a-f-]+$';
UPDATE "notifications" SET "topic" = 'RECORDS'
WHERE "topic" IS NULL AND ("category" IN ('AUDIT', 'STALE_DATA') OR "link_path" LIKE '/documents%');
UPDATE "notifications" SET "topic" = 'INCIDENT' WHERE "topic" IS NULL AND "category" = 'EMERGENCY';
