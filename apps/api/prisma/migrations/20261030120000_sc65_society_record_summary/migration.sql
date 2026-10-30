-- CreateEnum
CREATE TYPE "society_grade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "grade_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "platform_audit_events" ADD COLUMN     "actor_name" VARCHAR(150),
ADD COLUMN     "actor_role" VARCHAR(40);

-- AlterTable
ALTER TABLE "societies" ADD COLUMN     "business_description" VARCHAR(1000),
ADD COLUMN     "grade" "society_grade",
ADD COLUMN     "grade_changed_at" TIMESTAMPTZ(3),
ADD COLUMN     "grade_changed_by_name" VARCHAR(150),
ADD COLUMN     "grade_changed_by_role" VARCHAR(40),
ADD COLUMN     "landline" VARCHAR(30),
ADD COLUMN     "member_count" INTEGER;

-- AlterTable
ALTER TABLE "society_documents" ADD COLUMN     "financial_year_start" INTEGER,
ADD COLUMN     "uploaded_by_role" VARCHAR(40);

-- CreateTable
CREATE TABLE "annual_financial_summaries" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "financial_year_start" INTEGER NOT NULL,
    "total_profit" DECIMAL(14,2),
    "total_expenses" DECIMAL(14,2),
    "previous_profit" DECIMAL(14,2),
    "previous_expenses" DECIMAL(14,2),
    "profit_updated_at" TIMESTAMPTZ(3),
    "profit_updated_by_name" VARCHAR(150),
    "profit_updated_by_role" VARCHAR(40),
    "expenses_updated_at" TIMESTAMPTZ(3),
    "expenses_updated_by_name" VARCHAR(150),
    "expenses_updated_by_role" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "annual_financial_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_change_requests" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "from_grade" "society_grade",
    "to_grade" "society_grade" NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "grade_request_status" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" VARCHAR(64) NOT NULL,
    "requested_by_name" VARCHAR(150) NOT NULL,
    "requested_by_role" VARCHAR(40) NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" VARCHAR(64),
    "decided_by_name" VARCHAR(150),
    "decided_at" TIMESTAMPTZ(3),
    "decision_comment" VARCHAR(500),

    CONSTRAINT "grade_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_plan_activities" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "sector" VARCHAR(100),
    "dates_label" VARCHAR(60),
    "allocated_cost" DECIMAL(14,2) NOT NULL,
    "updated_by_name" VARCHAR(150),
    "updated_by_role" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_plan_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "annual_financial_summaries_society_id_financial_year_start_key" ON "annual_financial_summaries"("society_id", "financial_year_start");

-- CreateIndex
CREATE INDEX "grade_change_requests_society_id_requested_at_idx" ON "grade_change_requests"("society_id", "requested_at");

-- CreateIndex
CREATE INDEX "grade_change_requests_status_requested_at_idx" ON "grade_change_requests"("status", "requested_at");

-- CreateIndex
CREATE INDEX "work_plan_activities_society_id_year_month_idx" ON "work_plan_activities"("society_id", "year", "month");

-- CreateIndex
CREATE INDEX "society_documents_society_id_document_type_financial_year_s_idx" ON "society_documents"("society_id", "document_type", "financial_year_start");

-- AddForeignKey
ALTER TABLE "annual_financial_summaries" ADD CONSTRAINT "annual_financial_summaries_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_change_requests" ADD CONSTRAINT "grade_change_requests_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_plan_activities" ADD CONSTRAINT "work_plan_activities_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SC-65 data guards. The API validates the same rules; these protect the data
-- if a client or script bypasses the API.
ALTER TABLE "societies" ADD CONSTRAINT "societies_member_count_non_negative" CHECK ("member_count" IS NULL OR "member_count" >= 0);
ALTER TABLE "annual_financial_summaries" ADD CONSTRAINT "annual_financial_summaries_expenses_non_negative" CHECK ("total_expenses" IS NULL OR "total_expenses" >= 0);
ALTER TABLE "work_plan_activities" ADD CONSTRAINT "work_plan_activities_month_range" CHECK ("month" BETWEEN 1 AND 12);
ALTER TABLE "work_plan_activities" ADD CONSTRAINT "work_plan_activities_cost_non_negative" CHECK ("allocated_cost" >= 0);

-- At most one grade-change request per society can wait for HQ.
CREATE UNIQUE INDEX "grade_change_requests_one_pending_per_society" ON "grade_change_requests"("society_id") WHERE "status" = 'PENDING';
