-- TEST only: the connection limit of the restricted runtime database role.
-- Part of the capacity budget in docs/aws-test-environment.md, and checked against
-- infrastructure/aws/template.yaml by test_foundation.py. Change them together.
--
-- Run as the database owner, BEFORE deploying a higher Lambda concurrency:
--   psql "$OWNER_URL" -v ON_ERROR_STOP=1 -f infrastructure/aws/test/runtime-database-role.sql
-- Safe to repeat. Sets the limit only: it creates no role and changes no password or grant.

\set ON_ERROR_STOP on

ALTER ROLE sc_test_app CONNECTION LIMIT 10;

-- The result to record: the limit, and how much of it is in use.
SELECT r.rolname,
       r.rolconnlimit AS role_limit,
       (SELECT count(*) FROM pg_stat_activity a WHERE a.usename = r.rolname) AS role_connections,
       current_setting('max_connections')::int AS server_limit,
       (SELECT count(*) FROM pg_stat_activity) AS server_connections
FROM pg_roles r
WHERE r.rolname = 'sc_test_app';
