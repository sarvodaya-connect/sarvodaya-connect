-- Issue #145: Village Economic Profile. Adds four new tables and three enums
-- only. No existing table or row is changed: societies.business_description
-- stays as it is, and nothing is copied or inferred from it.
--
-- Society -> society_businesses -> business_outputs -> production_records,
-- with production_record_revisions holding every saved version.

-- CreateEnum
CREATE TYPE "business_status" AS ENUM ('OPERATING', 'SEASONAL', 'TEMPORARILY_STOPPED', 'CLOSED');

-- CreateEnum
CREATE TYPE "production_basis" AS ENUM ('WEEKLY', 'MONTHLY', 'SEASONAL');

-- CreateEnum
CREATE TYPE "production_measurement" AS ENUM ('ACTUAL', 'ESTIMATED');

-- CreateTable
CREATE TABLE "society_businesses" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "industry" VARCHAR(40) NOT NULL,
    "other_industry" VARCHAR(150),
    "description" VARCHAR(500),
    "status" "business_status" NOT NULL DEFAULT 'OPERATING',
    "closed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" VARCHAR(64) NOT NULL,
    "created_by_name" VARCHAR(150) NOT NULL,
    "created_by_role" VARCHAR(40),
    "updated_by_name" VARCHAR(150),
    "updated_by_role" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "society_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_outputs" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "product" VARCHAR(40) NOT NULL,
    "other_description" VARCHAR(150),
    "unit" VARCHAR(20) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" VARCHAR(64) NOT NULL,
    "created_by_name" VARCHAR(150) NOT NULL,
    "created_by_role" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_records" (
    "id" UUID NOT NULL,
    "output_id" UUID NOT NULL,
    "basis" "production_basis" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "season_label" VARCHAR(60),
    "measurement" "production_measurement" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "note" VARCHAR(500),
    "source" VARCHAR(150),
    "version" INTEGER NOT NULL DEFAULT 1,
    "client_request_id" UUID,
    "created_by_id" VARCHAR(64) NOT NULL,
    "created_by_name" VARCHAR(150) NOT NULL,
    "created_by_role" VARCHAR(40),
    "updated_by_name" VARCHAR(150),
    "updated_by_role" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "production_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_record_revisions" (
    "id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "change" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "season_label" VARCHAR(60),
    "note" VARCHAR(500),
    "source" VARCHAR(150),
    "changed_by_id" VARCHAR(64) NOT NULL,
    "changed_by_name" VARCHAR(150) NOT NULL,
    "changed_by_role" VARCHAR(40),
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_record_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "society_businesses_society_id_idx" ON "society_businesses"("society_id");

-- CreateIndex
CREATE INDEX "business_outputs_business_id_idx" ON "business_outputs"("business_id");

-- CreateIndex
CREATE INDEX "business_outputs_product_idx" ON "business_outputs"("product");

-- CreateIndex
CREATE UNIQUE INDEX "production_records_client_request_id_key" ON "production_records"("client_request_id");

-- CreateIndex
CREATE INDEX "production_records_period_start_period_end_idx" ON "production_records"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "production_records_output_id_measurement_period_start_perio_key" ON "production_records"("output_id", "measurement", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "production_record_revisions_record_id_version_key" ON "production_record_revisions"("record_id", "version");

-- AddForeignKey
ALTER TABLE "society_businesses" ADD CONSTRAINT "society_businesses_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_outputs" ADD CONSTRAINT "business_outputs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "society_businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_output_id_fkey" FOREIGN KEY ("output_id") REFERENCES "business_outputs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_record_revisions" ADD CONSTRAINT "production_record_revisions_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "production_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- An Other industry or product must say what it is.
ALTER TABLE "society_businesses" ADD CONSTRAINT "society_businesses_other_industry_check"
  CHECK (("industry" = 'OTHER') = ("other_industry" IS NOT NULL AND length(btrim("other_industry")) > 0));
-- closed_at is set exactly while the business is closed.
ALTER TABLE "society_businesses" ADD CONSTRAINT "society_businesses_closed_check"
  CHECK (("status" = 'CLOSED') = ("closed_at" IS NOT NULL));
ALTER TABLE "society_businesses" ADD CONSTRAINT "society_businesses_version_check" CHECK ("version" >= 1);

ALTER TABLE "business_outputs" ADD CONSTRAINT "business_outputs_other_check"
  CHECK (("product" = 'OTHER') = ("other_description" IS NOT NULL AND length(btrim("other_description")) > 0));
ALTER TABLE "business_outputs" ADD CONSTRAINT "business_outputs_version_check" CHECK ("version" >= 1);
-- A business has one current output per standard product. Other outputs and
-- archived outputs are not limited.
CREATE UNIQUE INDEX "business_outputs_one_current_product"
  ON "business_outputs"("business_id", "product")
  WHERE "archived_at" IS NULL AND "product" <> 'OTHER';

-- Quantities are finite and never negative; 0 is a reported zero.
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_quantity_check"
  CHECK ("quantity" >= 0 AND "quantity" <= 100000000);
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_version_check" CHECK ("version" >= 1);
-- Exact covered periods: a week is Monday to Sunday, a month is a calendar
-- month, a season is a labelled range of at most 366 days.
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_period_check" CHECK (
  "period_end" >= "period_start"
  AND "period_end" - "period_start" < 366
  AND (("basis" = 'SEASONAL') = ("season_label" IS NOT NULL AND length(btrim("season_label")) > 0))
  AND ("basis" <> 'WEEKLY' OR (EXTRACT(ISODOW FROM "period_start") = 1 AND "period_end" = "period_start" + 6))
  AND ("basis" <> 'MONTHLY' OR (
    "period_start" = date_trunc('month', "period_start")::date
    AND "period_end" = (date_trunc('month', "period_start") + INTERVAL '1 month' - INTERVAL '1 day')::date
  ))
);

ALTER TABLE "production_record_revisions" ADD CONSTRAINT "production_record_revisions_change_check"
  CHECK ("change" IN ('CREATED', 'CORRECTED'));
ALTER TABLE "production_record_revisions" ADD CONSTRAINT "production_record_revisions_quantity_check"
  CHECK ("quantity" >= 0 AND "quantity" <= 100000000);
