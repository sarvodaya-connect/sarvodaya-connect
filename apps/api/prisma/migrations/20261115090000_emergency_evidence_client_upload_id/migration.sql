-- Issue #125: the phone's id for one photo, the same on every retry.
-- Nullable, so existing rows and released clients that do not send it are
-- unchanged. PostgreSQL treats NULLs as distinct, so the unique index only
-- applies to rows that carry an id.
ALTER TABLE "emergency_evidence" ADD COLUMN "client_upload_id" UUID;

CREATE UNIQUE INDEX "emergency_evidence_uploaded_by_id_client_upload_id_key"
  ON "emergency_evidence"("uploaded_by_id", "client_upload_id");
