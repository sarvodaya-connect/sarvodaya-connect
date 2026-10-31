CREATE TYPE "society_grade" AS ENUM ('A', 'B', 'C');
CREATE TYPE "grade_change_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "society_assignment_role" AS ENUM ('SOCIETY_OFFICER', 'SPC');

ALTER TABLE "societies" ADD COLUMN "grade" "society_grade" NOT NULL DEFAULT 'C';

CREATE TABLE "society_assignments" (
  "id" UUID NOT NULL,
  "society_id" UUID NOT NULL,
  "role" "society_assignment_role" NOT NULL,
  "user_id" VARCHAR(64) NOT NULL,
  "assigned_by_id" VARCHAR(64) NOT NULL,
  "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(3),
  CONSTRAINT "society_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "society_assignments_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "society_assignments_society_id_role_user_id_key" ON "society_assignments"("society_id", "role", "user_id");
CREATE INDEX "society_assignments_user_id_role_revoked_at_idx" ON "society_assignments"("user_id", "role", "revoked_at");

CREATE TABLE "district_delegations" (
  "id" UUID NOT NULL,
  "district_id" UUID NOT NULL,
  "deputy_user_id" VARCHAR(64) NOT NULL,
  "granted_by_id" VARCHAR(64) NOT NULL,
  "granted_by_name" VARCHAR(150) NOT NULL,
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "revoked_by_id" VARCHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "district_delegations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "district_delegations_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "district_delegations_valid_window" CHECK ("ends_at" > "starts_at")
);
CREATE INDEX "district_delegations_deputy_user_id_district_id_starts_at_ends_at_idx" ON "district_delegations"("deputy_user_id", "district_id", "starts_at", "ends_at");
CREATE INDEX "district_delegations_district_id_ends_at_idx" ON "district_delegations"("district_id", "ends_at");

CREATE TABLE "grade_change_requests" (
  "id" UUID NOT NULL,
  "society_id" UUID NOT NULL,
  "current_grade" "society_grade" NOT NULL,
  "proposed_grade" "society_grade" NOT NULL,
  "rationale" VARCHAR(2000) NOT NULL,
  "status" "grade_change_status" NOT NULL DEFAULT 'PENDING',
  "requested_by_id" VARCHAR(64) NOT NULL,
  "requested_by_name" VARCHAR(150) NOT NULL,
  "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_by_id" VARCHAR(64),
  "decided_by_name" VARCHAR(150),
  "decision_comment" VARCHAR(2000),
  "decided_at" TIMESTAMPTZ(3),
  CONSTRAINT "grade_change_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "grade_change_requests_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "grade_change_requests_distinct_grades" CHECK ("current_grade" <> "proposed_grade"),
  CONSTRAINT "grade_change_requests_decision_fields" CHECK (("status" = 'PENDING' AND "decided_by_id" IS NULL AND "decided_at" IS NULL) OR ("status" <> 'PENDING' AND "decided_by_id" IS NOT NULL AND "decided_at" IS NOT NULL))
);
CREATE INDEX "grade_change_requests_status_requested_at_idx" ON "grade_change_requests"("status", "requested_at");
CREATE INDEX "grade_change_requests_society_id_requested_at_idx" ON "grade_change_requests"("society_id", "requested_at");
CREATE UNIQUE INDEX "grade_change_requests_one_pending_per_society_idx" ON "grade_change_requests"("society_id") WHERE "status" = 'PENDING';

CREATE TABLE "society_audit_events" (
  "id" UUID NOT NULL,
  "society_id" UUID NOT NULL,
  "grade_change_request_id" UUID,
  "event_type" VARCHAR(40) NOT NULL,
  "from_grade" "society_grade",
  "to_grade" "society_grade",
  "summary" VARCHAR(500) NOT NULL,
  "comment" VARCHAR(2000),
  "actor_id" VARCHAR(64) NOT NULL,
  "actor_display_name" VARCHAR(150) NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "society_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "society_audit_events_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "society_audit_events_grade_change_request_id_fkey" FOREIGN KEY ("grade_change_request_id") REFERENCES "grade_change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "society_audit_events_society_id_occurred_at_idx" ON "society_audit_events"("society_id", "occurred_at");
