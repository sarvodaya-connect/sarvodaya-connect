-- V5 D05x / D05c / M07: Exco members have a date of birth (age is worked
-- out from it), a profession and an address.
ALTER TABLE "society_council_members"
  ADD COLUMN "date_of_birth" DATE,
  ADD COLUMN "profession" VARCHAR(100),
  ADD COLUMN "address_line" VARCHAR(255);
