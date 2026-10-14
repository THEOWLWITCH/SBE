-- PREPARED ONLY. No production execution is authorized.
-- First run scripts/audit-supabase-catalog.sql, review any unexpected policy,
-- view, RPC or grant, and confirm that rows explicitly marked 'shared' are
-- approved public library material. No row is reclassified by this migration.
-- Apply in one transaction after owner approval and a verified database backup.
BEGIN;

DO $prerequisites$
DECLARE relation regclass; column_type oid;
BEGIN
  IF to_regclass('public.access_settings') IS NULL OR to_regclass('public.scenarios') IS NULL THEN
    RAISE EXCEPTION 'Required existing tables are missing; review the catalog before migration';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon')
    OR NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated')
    OR NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION 'Expected Supabase roles or service RLS bypass are missing';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.access_settings'::regclass
    AND attname = 'key' AND atttypid IN ('text'::regtype, 'varchar'::regtype) AND NOT attisdropped)
    OR NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.access_settings'::regclass
    AND attname = 'value' AND atttypid = 'jsonb'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Unexpected access_settings schema';
  END IF;
  FOR relation IN SELECT unnest(ARRAY['public.access_settings'::regclass, 'public.scenarios'::regclass]) LOOP
    IF EXISTS (SELECT FROM pg_policy WHERE polrelid = relation
      AND NOT (relation = 'public.scenarios'::regclass AND polname = 'be_good_scenarios_shared_read')) THEN
      RAISE EXCEPTION 'Unexpected existing policy on %. Review it explicitly; this migration does not remove unrelated policies', relation;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.scenarios'::regclass AND attname = 'id'
    AND atttypid IN ('text'::regtype, 'varchar'::regtype) AND NOT attisdropped)
    OR NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.scenarios'::regclass AND attname = 'institution_id'
    AND atttypid IN ('text'::regtype, 'varchar'::regtype) AND NOT attisdropped)
    OR NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.scenarios'::regclass AND attname = 'runs'
    AND atttypid IN ('int2'::regtype, 'int4'::regtype, 'int8'::regtype) AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Unexpected scenarios ID, institution or counter schema; inspect before applying';
  END IF;
END;
$prerequisites$;

ALTER TABLE public.access_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.access_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.access_settings TO service_role;

ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scenarios FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.scenarios TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.scenarios TO service_role;
DROP POLICY IF EXISTS be_good_scenarios_shared_read ON public.scenarios;
CREATE POLICY be_good_scenarios_shared_read ON public.scenarios
  FOR SELECT TO anon, authenticated USING (institution_id = 'shared');

-- The old public RPC is a mutation bypass even after table RLS changes if it
-- uses SECURITY DEFINER. Keep the function/history, but revoke client execution
-- on every existing overload of this specific legacy RPC.
DO $legacy_rpc$
DECLARE rpc regprocedure;
BEGIN
  FOR rpc IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'increment_scenario_runs' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', rpc);
  END LOOP;
END;
$legacy_rpc$;

CREATE OR REPLACE FUNCTION public.be_good_increment_scenario_runs(p_id text, p_institution text, p_all boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $counter$
DECLARE changed integer;
BEGIN
  IF p_id IS NULL OR p_id !~ '^[A-Za-z0-9_-]{1,64}$' OR length(coalesce(p_institution, '')) > 240 THEN
    RETURN false;
  END IF;
  UPDATE public.scenarios SET runs = coalesce(runs, 0) + 1
    WHERE id::text = p_id AND (p_all IS TRUE OR institution_id = 'shared'
      OR (p_institution IS NOT NULL AND institution_id = p_institution));
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$counter$;
REVOKE ALL ON FUNCTION public.be_good_increment_scenario_runs(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_good_increment_scenario_runs(text, text, boolean) TO service_role;
COMMIT;
