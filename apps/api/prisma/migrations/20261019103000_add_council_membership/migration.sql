CREATE TYPE "membership_category" AS ENUM ('CHILDREN', 'YOUTH', 'MOTHERS', 'ORDINARY', 'ELDERS_COUNCIL');

ALTER TABLE "society_contacts"
  ADD COLUMN "full_name" VARCHAR(150),
  ADD COLUMN "position" VARCHAR(100);

CREATE TABLE "society_council_members" (
  "id" UUID NOT NULL,
  "society_id" UUID NOT NULL,
  "seat_number" INTEGER NOT NULL,
  "full_name" VARCHAR(150) NOT NULL,
  "position" VARCHAR(100) NOT NULL,
  "seat_type" "membership_category" NOT NULL,
  "phone" VARCHAR(30),
  "email" VARCHAR(254),
  "age" INTEGER,
  "appointed_on" DATE,
  "ended_on" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_primary_contact" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "society_council_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "society_council_members_seat_number_check" CHECK ("seat_number" BETWEEN 1 AND 25),
  CONSTRAINT "society_council_members_age_check" CHECK ("age" IS NULL OR "age" BETWEEN 1 AND 120),
  CONSTRAINT "society_council_members_dates_check" CHECK ("ended_on" IS NULL OR "appointed_on" IS NULL OR "ended_on" >= "appointed_on"),
  CONSTRAINT "society_council_members_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "society_council_members_society_id_seat_number_key" ON "society_council_members"("society_id", "seat_number");
CREATE INDEX "society_council_members_society_id_is_active_idx" ON "society_council_members"("society_id", "is_active");

CREATE TABLE "society_membership_counts" (
  "id" UUID NOT NULL,
  "society_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "category" "membership_category" NOT NULL,
  "female" INTEGER NOT NULL DEFAULT 0,
  "male" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "society_membership_counts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "society_membership_counts_year_check" CHECK ("year" BETWEEN 1900 AND 2200),
  CONSTRAINT "society_membership_counts_female_check" CHECK ("female" >= 0),
  CONSTRAINT "society_membership_counts_male_check" CHECK ("male" >= 0),
  CONSTRAINT "society_membership_counts_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "society_membership_counts_society_id_year_category_key" ON "society_membership_counts"("society_id", "year", "category");
CREATE INDEX "society_membership_counts_year_society_id_idx" ON "society_membership_counts"("year", "society_id");
