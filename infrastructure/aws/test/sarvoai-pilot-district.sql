-- TEST only: the fictional district the SarvoAI pilot is limited to.
-- With SARVOAI_FICTIONAL_ONLY=true (forced for Stage=test), SarvoAI's tools see only
-- societies whose S number starts TEST- AND whose district code is TEST-ONLY.
-- Plan: docs/sarvoai-test-pilot-plan.md. Never run this against staging or production.
--
-- Run as the database owner from the private-VPC migration session, after review:
--   psql "$OWNER_URL" -v ON_ERROR_STOP=1 -f infrastructure/aws/test/sarvoai-pilot-district.sql
-- Safe to repeat: adds the district once and changes no other row.

\set ON_ERROR_STOP on

INSERT INTO districts (id, code, name_en, province, created_at, updated_at)
VALUES (gen_random_uuid(), 'TEST-ONLY', 'Test Only (fictional)', NULL, now(), now())
ON CONFLICT (code) DO NOTHING;

SELECT id, code, name_en FROM districts WHERE code = 'TEST-ONLY';
