-- READ-ONLY CATALOG AUDIT. No application rows, secrets or Storage objects.
-- Execute only after the owner authorizes provider/database inspection.
BEGIN TRANSACTION READ ONLY;
SELECT n.nspname AS schema_name, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
  pg_get_userbyid(c.relowner) AS owner, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'v', 'm', 'p')
ORDER BY n.nspname, c.relname;

SELECT n.nspname AS schema_name, c.relname, a.attname,
  format_type(a.atttypid, a.atttypmod) AS data_type, a.attnotnull
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage') AND c.relname IN ('access_settings', 'scenarios', 'objects', 'buckets')
  AND a.attnum > 0 AND NOT a.attisdropped ORDER BY n.nspname, c.relname, a.attnum;

SELECT n.nspname AS schema_name, c.relname, p.polname, p.polcmd, p.polpermissive,
  ARRAY(SELECT r.rolname FROM pg_roles r WHERE r.oid = ANY(p.polroles)) AS roles,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression, pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage') ORDER BY n.nspname, c.relname, p.polname;

SELECT n.nspname AS schema_name, p.oid::regprocedure AS signature, p.prosecdef AS security_definer,
  pg_get_userbyid(p.proowner) AS owner, p.proacl, p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'storage') ORDER BY n.nspname, p.proname;

SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role') ORDER BY rolname;
COMMIT;
