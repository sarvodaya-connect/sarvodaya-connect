-- AlterTable
ALTER TABLE "society_council_members" ADD COLUMN     "nic_ciphertext" TEXT,
ADD COLUMN     "nic_last_four" VARCHAR(4);

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(254),
    "role" VARCHAR(40) NOT NULL,
    "district_id" UUID,
    "society_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "password_hash" TEXT,
    "provider_subject" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_invitations" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "method" VARCHAR(25) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_sessions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "district_access_grants" (
    "id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "deputy_id" UUID NOT NULL,
    "granted_by_id" VARCHAR(64) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "district_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_events" (
    "id" UUID NOT NULL,
    "actor_id" VARCHAR(64) NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "target_id" VARCHAR(64) NOT NULL,
    "society_id" UUID,
    "district_id" UUID,
    "detail" VARCHAR(2000) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_username_key" ON "platform_accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "platform_accounts_provider_subject_key" ON "platform_accounts"("provider_subject");

-- CreateIndex
CREATE INDEX "platform_accounts_district_id_role_idx" ON "platform_accounts"("district_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "account_invitations_token_hash_key" ON "account_invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "account_sessions_token_hash_key" ON "account_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "account_sessions_account_id_idx" ON "account_sessions"("account_id");

-- CreateIndex
CREATE INDEX "district_access_grants_deputy_id_expires_at_idx" ON "district_access_grants"("deputy_id", "expires_at");

-- CreateIndex
CREATE INDEX "platform_audit_events_created_at_idx" ON "platform_audit_events"("created_at");

-- CreateIndex
CREATE INDEX "platform_audit_events_society_id_created_at_idx" ON "platform_audit_events"("society_id", "created_at");

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_sessions" ADD CONSTRAINT "account_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
