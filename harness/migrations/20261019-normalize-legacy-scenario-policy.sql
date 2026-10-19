-- Run only for the inspected legacy anon_read policy, BEFORE service hardening.
-- Narrow and rename that exact policy atomically; never delete policies or rows.
BEGIN;
LOCK TABLE public.scenarios IN ACCESS EXCLUSIVE MODE;
DO $known_legacy$
DECLARE scenario_table regclass; anon_role oid; legacy record;
BEGIN
  scenario_table := pg_catalog.to_regclass('public.scenarios');
  SELECT oid INTO anon_role FROM pg_catalog.pg_roles WHERE rolname='anon';
  IF anon_role IS NULL OR (
    SELECT pg_catalog.count(*) FROM pg_catalog.pg_policy WHERE polrelid=scenario_table
  ) <> 1 THEN
    RAISE EXCEPTION 'Unexpected scenarios policies; expected only the inspected legacy anon_read policy';
  END IF;
  SELECT * INTO legacy FROM pg_catalog.pg_policy WHERE polrelid=scenario_table;
  IF legacy.polname IS DISTINCT FROM 'anon_read' OR legacy.polcmd IS DISTINCT FROM 'r'
    OR legacy.polpermissive IS DISTINCT FROM true
    OR legacy.polroles IS DISTINCT FROM ARRAY[anon_role]::oid[]
    OR pg_catalog.pg_get_expr(legacy.polqual,scenario_table) IS DISTINCT FROM 'true'
    OR legacy.polwithcheck IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected legacy anon_read definition; no policies or rows were changed';
  END IF;
END;
$known_legacy$;
ALTER POLICY anon_read ON public.scenarios USING (institution_id='shared');
ALTER POLICY anon_read ON public.scenarios RENAME TO be_good_scenarios_shared_read;
COMMIT;
