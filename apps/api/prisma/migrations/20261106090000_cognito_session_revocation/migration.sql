-- Cognito sign-in: tokens issued for a sign-in before this time are refused.
ALTER TABLE "platform_accounts" ADD COLUMN "sessions_revoked_at" TIMESTAMPTZ(3);
