-- Issue #96: persistent SarvoAI spending ledger (estimates, per UTC calendar month).
-- CreateEnum
CREATE TYPE "assistant_spend_status" AS ENUM ('RESERVED', 'SETTLED', 'RELEASED', 'UNCERTAIN');

-- CreateTable
CREATE TABLE "assistant_monthly_spend" (
    "month" VARCHAR(7) NOT NULL,
    "committed_micro_usd" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_monthly_spend_pkey" PRIMARY KEY ("month")
);

-- CreateTable
CREATE TABLE "assistant_spend_reservations" (
    "id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "model_id" VARCHAR(120) NOT NULL,
    "status" "assistant_spend_status" NOT NULL DEFAULT 'RESERVED',
    "reserved_micro_usd" BIGINT NOT NULL,
    "actual_micro_usd" BIGINT,
    "input_tokens" INTEGER,
    "cache_write_tokens" INTEGER,
    "cache_read_tokens" INTEGER,
    "output_tokens" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "assistant_spend_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_spend_reservations_month_status_idx" ON "assistant_spend_reservations"("month", "status");

-- AddForeignKey
ALTER TABLE "assistant_spend_reservations" ADD CONSTRAINT "assistant_spend_reservations_month_fkey" FOREIGN KEY ("month") REFERENCES "assistant_monthly_spend"("month") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "assistant_monthly_spend"
  ADD CONSTRAINT "assistant_monthly_spend_month_format" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "assistant_monthly_spend_committed_not_negative" CHECK ("committed_micro_usd" >= 0);
ALTER TABLE "assistant_spend_reservations"
  ADD CONSTRAINT "assistant_spend_reservations_reserved_positive" CHECK ("reserved_micro_usd" > 0),
  ADD CONSTRAINT "assistant_spend_reservations_actual_not_negative" CHECK ("actual_micro_usd" IS NULL OR "actual_micro_usd" >= 0);
