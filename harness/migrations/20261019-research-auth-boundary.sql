-- Apply after storage hardening and both research migrations, in one transaction.
-- Research RPCs run as research_worker, which must read and lock current auth
-- records without bypassing RLS or acquiring permission to change credentials.
BEGIN;
DO $prerequisites$
DECLARE auth_table regclass; worker oid;
BEGIN
  auth_table := pg_catalog.to_regclass('public.access_settings');
  IF auth_table IS NULL OR NOT EXISTS (
    SELECT FROM pg_catalog.pg_class WHERE oid=auth_table AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Harden access_settings before enabling research authentication';
  END IF;
  SELECT oid INTO worker FROM pg_catalog.pg_roles
    WHERE rolname='research_worker' AND NOT rolcanlogin AND NOT rolsuper
      AND NOT rolbypassrls AND NOT rolinherit;
  IF worker IS NULL THEN
    RAISE EXCEPTION 'Expected existing isolated research_worker role is missing or unsafe';
  END IF;
  IF EXISTS (
    SELECT FROM pg_catalog.pg_policy p
    WHERE p.polrelid=auth_table AND (0::oid=ANY(p.polroles) OR worker=ANY(p.polroles))
  ) THEN
    RAISE EXCEPTION 'Review existing research or public access_settings policies; none are replaced';
  END IF;
END;
$prerequisites$;

CREATE POLICY be_good_research_auth_read ON public.access_settings
  FOR SELECT TO research_worker
  USING (key IN ('token-secret','pw-sys','institutions','settings') OR key LIKE 'code:%');

-- SELECT FOR SHARE also needs an UPDATE policy. A false WITH CHECK permits the
-- row lock while rejecting any actual new credential value. Existing grants
-- stay unchanged; anon/authenticated receive no table or RPC access.
CREATE POLICY be_good_research_auth_lock ON public.access_settings
  FOR UPDATE TO research_worker
  USING (key IN ('token-secret','pw-sys','institutions','settings') OR key LIKE 'code:%')
  WITH CHECK (false);
COMMIT;
