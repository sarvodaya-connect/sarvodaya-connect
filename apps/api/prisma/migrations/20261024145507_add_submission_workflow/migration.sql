-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'RESUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "submission_type" AS ENUM ('COUNCIL_UPDATE', 'PROFILE_UPDATE', 'MEMBERSHIP_COUNTS', 'ACTIVITY_REPORT', 'PAYMENT');

-- CreateEnum
CREATE TYPE "submission_action" AS ENUM ('SUBMIT', 'START_REVIEW', 'REQUEST_CHANGES', 'APPROVE', 'REJECT', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "correction_status" AS ENUM ('NONE', 'REQUIRED', 'CORRECTED');

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "society_id" UUID NOT NULL,
    "type" "submission_type" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" "submission_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_by_id" VARCHAR(64) NOT NULL,
    "submitted_by_name" VARCHAR(150) NOT NULL,
    "reviewer_id" VARCHAR(64),
    "reviewer_name" VARCHAR(150),
    "submitted_at" TIMESTAMPTZ(3),
    "review_started_at" TIMESTAMPTZ(3),
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_fields" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "field" VARCHAR(100) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "previous_value" JSONB,
    "proposed_value" JSONB NOT NULL,
    "corrected_value" JSONB,
    "correction_status" "correction_status" NOT NULL DEFAULT 'NONE',
    "reviewer_comment" VARCHAR(1000),

    CONSTRAINT "submission_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_events" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "action" "submission_action" NOT NULL,
    "from_status" "submission_status" NOT NULL,
    "to_status" "submission_status" NOT NULL,
    "actor_id" VARCHAR(64) NOT NULL,
    "actor_name" VARCHAR(150) NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(64) NOT NULL,
    "actor_id" VARCHAR(64) NOT NULL,
    "actor_name" VARCHAR(150) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submissions_seq_key" ON "submissions"("seq");

-- CreateIndex
CREATE INDEX "submissions_society_id_status_idx" ON "submissions"("society_id", "status");

-- CreateIndex
CREATE INDEX "submissions_status_submitted_at_idx" ON "submissions"("status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "submission_fields_submission_id_field_key" ON "submission_fields"("submission_id", "field");

-- CreateIndex
CREATE INDEX "submission_events_submission_id_created_at_idx" ON "submission_events"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_fields" ADD CONSTRAINT "submission_fields_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One open submission per society and type.
CREATE UNIQUE INDEX submissions_one_open_per_society_type
  ON submissions (society_id, type)
  WHERE status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED','RESUBMITTED');

-- Append-only history, enforced by PostgreSQL itself.
CREATE FUNCTION forbid_history_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER submission_events_append_only
  BEFORE UPDATE OR DELETE ON submission_events
  FOR EACH ROW EXECUTE FUNCTION forbid_history_change();

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_history_change();
