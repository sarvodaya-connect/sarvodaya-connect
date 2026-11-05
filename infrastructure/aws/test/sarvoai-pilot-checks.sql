-- TEST only: read-only checks before a SarvoAI pilot deployment.
-- Plan and the result each check needs: docs/sarvoai-test-pilot-plan.md.
--
-- Run from the private-VPC migration session against the TEST database, as the
-- database owner (not the runtime role), and record the output:
--   psql "$OWNER_URL" -v ON_ERROR_STOP=1 -v runtime_role=sc_test_app \
--     -f infrastructure/aws/test/sarvoai-pilot-checks.sql
-- Changes nothing: the whole script runs in a READ ONLY transaction that is rolled back.

\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
  \set runtime_role sc_test_app
\endif

BEGIN TRANSACTION READ ONLY;

\echo '1. Spending ledger migrations (both must be applied, none rolled back)'
SELECT migration_name,
       finished_at IS NOT NULL AS applied,
       rolled_back_at IS NOT NULL AS rolled_back
FROM _prisma_migrations
WHERE migration_name IN ('20261107090000_sarvoai_monthly_spend', '20261107100000_sarvoai_spend_holds')
ORDER BY migration_name;

\echo '2. Runtime role privileges on the three ledger tables (every column must be true)'
SELECT t.table_name,
       has_table_privilege(:'runtime_role', t.table_name, 'SELECT') AS can_select,
       has_table_privilege(:'runtime_role', t.table_name, 'INSERT') AS can_insert,
       has_table_privilege(:'runtime_role', t.table_name, 'UPDATE') AS can_update
FROM (VALUES ('assistant_monthly_spend'), ('assistant_spend_reservations'), ('assistant_spend_holds')) AS t(table_name)
ORDER BY t.table_name;

SELECT has_type_privilege(:'runtime_role', 'assistant_spend_status', 'USAGE') AS can_use_status_type;

\echo '3. Ledger state (expect no holds; the month total should be 0 before the first pilot call)'
SELECT month, committed_micro_usd / 1000000.0 AS committed_usd
FROM assistant_monthly_spend ORDER BY month DESC LIMIT 3;
SELECT count(*) AS holds FROM assistant_spend_holds;
SELECT status, count(*) FROM assistant_spend_reservations GROUP BY status ORDER BY status;

\echo '4. Pilot district (exactly one row with code TEST-ONLY)'
SELECT id, code, name_en FROM districts WHERE code = 'TEST-ONLY';

\echo '5. Societies SarvoAI can see in TEST (S number starts TEST- and district TEST-ONLY); all must be fictional'
SELECT s.society_code, s.name_en, s.status
FROM societies s JOIN districts d ON d.id = s.district_id
WHERE s.society_code LIKE 'TEST-%' AND d.code = 'TEST-ONLY'
ORDER BY s.society_code;

\echo '6. Societies outside the pilot scope that look like test records (SarvoAI cannot see these, e.g. 99999TEST)'
SELECT s.society_code, d.code AS district_code
FROM societies s JOIN districts d ON d.id = s.district_id
WHERE (s.society_code ILIKE '%TEST%' OR d.code = 'TEST-ONLY')
  AND NOT (s.society_code LIKE 'TEST-%' AND d.code = 'TEST-ONLY')
ORDER BY s.society_code;

ROLLBACK;
