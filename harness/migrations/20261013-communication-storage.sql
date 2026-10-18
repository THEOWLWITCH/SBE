-- Pending, operator-reviewed hardening of the EXISTING BE GOOD store.
-- No new tables or content migrations. Do not run against production until
-- deployment is authorized. An unexpected policy aborts instead of removing it.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.access_settings') IS NULL THEN
    RAISE EXCEPTION 'Existing BE GOOD access_settings store is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='access_settings' AND roles && ARRAY['public','anon','authenticated']::name[]) THEN
    RAISE EXCEPTION 'Review existing client policies before storing private conversations';
  END IF;
END $$;
ALTER TABLE public.access_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_settings TO service_role;
COMMIT;
