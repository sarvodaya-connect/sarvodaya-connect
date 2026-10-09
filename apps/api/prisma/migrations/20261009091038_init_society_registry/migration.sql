-- CreateEnum
CREATE TYPE "society_status" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_REVIEW', 'SUSPENDED');

-- CreateTable
CREATE TABLE "districts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "societies" (
    "id" UUID NOT NULL,
    "society_code" VARCHAR(20) NOT NULL,
    "name_en" VARCHAR(150) NOT NULL,
    "name_local" VARCHAR(150),
    "district_id" UUID NOT NULL,
    "ds_division" VARCHAR(100),
    "gn_division" VARCHAR(100),
    "village" VARCHAR(100),
    "address_line" VARCHAR(255),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "established_on" DATE,
    "status" "society_status" NOT NULL DEFAULT 'UNDER_REVIEW',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "societies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "society_contacts" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "label" VARCHAR(100),
    "phone" VARCHAR(30),
    "email" VARCHAR(254),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "society_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "districts_code_key" ON "districts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_en_key" ON "districts"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "societies_society_code_key" ON "societies"("society_code");

-- CreateIndex
CREATE INDEX "societies_district_id_idx" ON "societies"("district_id");

-- CreateIndex
CREATE INDEX "societies_status_idx" ON "societies"("status");

-- CreateIndex
CREATE INDEX "societies_name_en_idx" ON "societies"("name_en");

-- CreateIndex
CREATE INDEX "society_contacts_society_id_idx" ON "society_contacts"("society_id");

-- AddForeignKey
ALTER TABLE "societies" ADD CONSTRAINT "societies_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "society_contacts" ADD CONSTRAINT "society_contacts_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extra constraints that Prisma cannot express in schema.prisma.
-- Latitude and longitude are either both empty or both valid.
ALTER TABLE "societies"
  ADD CONSTRAINT "societies_location_check"
  CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
  );

-- A contact needs at least a phone number or an email address.
ALTER TABLE "society_contacts"
  ADD CONSTRAINT "society_contacts_phone_or_email_check"
  CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);
