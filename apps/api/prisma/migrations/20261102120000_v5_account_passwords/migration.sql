-- V5 accounts (D16): record when HQ set each password and keep the sign-in
-- lockout in the database instead of in API memory.
ALTER TABLE "platform_accounts"
  ADD COLUMN "password_set_at" TIMESTAMPTZ(3),
  ADD COLUMN "password_set_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMPTZ(3);

-- Existing passwords were set at most recently when the account last changed.
UPDATE "platform_accounts"
SET "password_set_at" = "updated_at", "password_set_count" = 1
WHERE "password_hash" IS NOT NULL;
