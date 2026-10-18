-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('AUDIT_REPORT', 'AGM_MINUTES', 'OFFICE_BEARER_LIST', 'MEMBERS_LIST', 'REGISTRATION', 'FINANCE', 'ACTIVITY_EVIDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "document_access_level" AS ENUM ('STANDARD', 'REVIEWERS_ONLY');

-- CreateEnum
CREATE TYPE "notification_category" AS ENUM ('APPROVAL', 'RETURNED', 'AUDIT', 'REQUEST', 'EMERGENCY', 'STALE_DATA', 'SYSTEM');

-- CreateTable
CREATE TABLE "society_documents" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "document_type" "document_type" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'DRAFT',
    "access_level" "document_access_level" NOT NULL DEFAULT 'STANDARD',
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by_id" VARCHAR(64) NOT NULL,
    "uploaded_by_name" VARCHAR(150) NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "society_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_id" VARCHAR(64) NOT NULL,
    "category" "notification_category" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000),
    "link_path" VARCHAR(255),
    "society_id" UUID,
    "document_id" UUID,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "society_documents_storage_key_key" ON "society_documents"("storage_key");

-- CreateIndex
CREATE INDEX "society_documents_society_id_document_type_idx" ON "society_documents"("society_id", "document_type");

-- CreateIndex
CREATE INDEX "society_documents_status_idx" ON "society_documents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "society_documents_society_id_document_type_title_version_key" ON "society_documents"("society_id", "document_type", "title", "version");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_created_at_idx" ON "notifications"("recipient_user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_read_at_idx" ON "notifications"("recipient_user_id", "read_at");

-- AddForeignKey
ALTER TABLE "society_documents" ADD CONSTRAINT "society_documents_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "society_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extra constraints that Prisma cannot express in schema.prisma.
-- Files are between 1 byte and 10 MB, the upload limit shared with the mobile app.
ALTER TABLE "society_documents"
  ADD CONSTRAINT "society_documents_size_bytes_check"
  CHECK ("size_bytes" BETWEEN 1 AND 10000000);

-- Versions start at 1.
ALTER TABLE "society_documents"
  ADD CONSTRAINT "society_documents_version_check"
  CHECK ("version" >= 1);

-- Only PDF, JPEG and PNG files are accepted.
ALTER TABLE "society_documents"
  ADD CONSTRAINT "society_documents_content_type_check"
  CHECK ("content_type" IN ('application/pdf', 'image/jpeg', 'image/png'));

-- A document leaves DRAFT only after its file has been uploaded.
ALTER TABLE "society_documents"
  ADD CONSTRAINT "society_documents_uploaded_before_review_check"
  CHECK ("status" = 'DRAFT' OR "uploaded_at" IS NOT NULL);

-- The signed members list is always restricted to District Managers and HQ.
ALTER TABLE "society_documents"
  ADD CONSTRAINT "society_documents_members_list_restricted_check"
  CHECK ("document_type" <> 'MEMBERS_LIST' OR "access_level" = 'REVIEWERS_ONLY');
