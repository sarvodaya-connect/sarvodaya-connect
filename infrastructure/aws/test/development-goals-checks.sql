-- TEST only: read-only checks after deploying the issue #169 migration
-- (Development Goals), before releasing an API that writes them.
-- What each check needs: docs/development-goals.md, "Release".
--
-- Run from the private-VPC migration session against the TEST database, as the
-- database owner (not the runtime role), and record the output:
--   psql "$OWNER_URL" -v ON_ERROR_STOP=1 -v runtime_role=sc_test_app \
--     -f infrastructure/aws/test/development-goals-checks.sql
-- Changes nothing: the whole script runs in a READ ONLY transaction that is rolled back.

\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
  \set runtime_role sc_test_app
\endif

BEGIN TRANSACTION READ ONLY;

\echo '1. The migration is applied and not rolled back'
SELECT migration_name,
       finished_at IS NOT NULL AS applied,
       rolled_back_at IS NOT NULL AS rolled_back
FROM _prisma_migrations
WHERE migration_name = '20261117090000_development_goals';

\echo '2. Runtime role privileges on the two new tables (every column must be true)'
SELECT t.table_name,
       has_table_privilege(:'runtime_role', t.table_name, 'SELECT') AS can_select,
       has_table_privilege(:'runtime_role', t.table_name, 'INSERT') AS can_insert
FROM (VALUES ('work_plan_activity_dimensions'), ('work_plan_activity_categories')) AS t(table_name)
ORDER BY t.table_name;

SELECT has_column_privilege(:'runtime_role', 'work_plan_activities', 'classified_at', 'SELECT') AS can_read_classified_at,
       has_column_privilege(:'runtime_role', 'work_plan_activities', 'classified_at', 'UPDATE') AS can_set_classified_at,
       has_type_privilege(:'runtime_role', 'activity_category', 'USAGE') AS can_use_category_type;

\echo '3. Existing activities were not reclassified (classified must be 0 straight after the migration)'
SELECT status,
       count(*) AS activities,
       count(*) FILTER (WHERE classified_at IS NOT NULL) AS classified
FROM work_plan_activities
GROUP BY status
ORDER BY status;
SELECT (SELECT count(*) FROM work_plan_activity_dimensions) AS dimension_rows,
       (SELECT count(*) FROM work_plan_activity_categories) AS category_rows;

\echo '4. No classification outside an approved activity (must be 0)'
SELECT count(*) AS classified_but_not_approved
FROM work_plan_activities
WHERE classified_at IS NOT NULL AND status <> 'APPROVED';

ROLLBACK;
