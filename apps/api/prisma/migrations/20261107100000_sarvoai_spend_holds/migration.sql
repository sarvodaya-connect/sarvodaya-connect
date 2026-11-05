-- Issue #96: a call that broke its reservation's assumptions stops further SarvoAI calls until reviewed.
-- CreateTable
CREATE TABLE "assistant_spend_holds" (
    "reservation_id" UUID NOT NULL,
    "reasons" VARCHAR(200) NOT NULL,
    "reserved_micro_usd" BIGINT NOT NULL,
    "actual_micro_usd" BIGINT NOT NULL,
    "detected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_spend_holds_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateIndex
CREATE INDEX "assistant_spend_holds_detected_at_idx" ON "assistant_spend_holds"("detected_at");

-- AddForeignKey
ALTER TABLE "assistant_spend_holds" ADD CONSTRAINT "assistant_spend_holds_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "assistant_spend_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "assistant_spend_holds"
  ADD CONSTRAINT "assistant_spend_holds_reasons_not_empty" CHECK ("reasons" <> ''),
  ADD CONSTRAINT "assistant_spend_holds_amounts_not_negative" CHECK ("reserved_micro_usd" >= 0 AND "actual_micro_usd" >= 0);
