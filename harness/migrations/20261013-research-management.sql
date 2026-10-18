-- Additive, unapplied research migration. Run as an authorized PostgreSQL migration owner.
-- Existing custom HMAC sessions are verified here; these are not Supabase Auth JWTs.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $roles$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='research_table_owner') THEN CREATE ROLE research_table_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='research_worker') THEN CREATE ROLE research_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
END $roles$;
ALTER ROLE research_table_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
ALTER ROLE research_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE SCHEMA research_private AUTHORIZATION research_table_owner;
REVOKE ALL ON SCHEMA research_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA research_private TO research_worker, service_role;
GRANT SELECT, UPDATE(value) ON public.access_settings TO research_worker;
DO $crypto$ DECLARE ns text; BEGIN
 SELECT n.nspname INTO ns FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto';
 EXECUTE pg_catalog.format('GRANT USAGE ON SCHEMA %I TO research_worker',ns);
 EXECUTE pg_catalog.format('GRANT EXECUTE ON FUNCTION %I.hmac(bytea,bytea,text) TO research_worker',ns);
 EXECUTE pg_catalog.format('CREATE FUNCTION research_private.hmac(data bytea, secret bytea) RETURNS bytea LANGUAGE sql IMMUTABLE STRICT SET search_path = '''' AS %L',pg_catalog.format('SELECT %I.hmac(data,secret,''sha256'')',ns));
END $crypto$;

CREATE TABLE research_private.studies(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), revision integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_approval','active','paused','completed','archived')), config jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE research_private.study_versions(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL REFERENCES research_private.studies(id),revision integer NOT NULL,status text NOT NULL,config jsonb NOT NULL,versions jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(study_id,revision));
CREATE TABLE research_private.memberships(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL REFERENCES research_private.studies(id),actor_ref text NOT NULL,role text NOT NULL CHECK(role IN ('pi','researcher','assistant')),permissions text[] NOT NULL DEFAULT '{}',delegable_permissions text[] NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(study_id,actor_ref));
CREATE TABLE research_private.form_versions(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL REFERENCES research_private.studies(id),kind text NOT NULL CHECK(kind IN ('consent','instrument')),definition jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(study_id,id));
CREATE TABLE research_private.form_publications(study_id uuid NOT NULL,version_id uuid NOT NULL,published_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(study_id,version_id),FOREIGN KEY(study_id,version_id) REFERENCES research_private.form_versions(study_id,id));
CREATE TABLE research_private.participants(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL REFERENCES research_private.studies(id),actor_ref text,label text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','enrolled','withdrawn','erased')),consent_version_id uuid NOT NULL,consents jsonb NOT NULL,preferences jsonb NOT NULL DEFAULT '{}',verified boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,withdrawn_at timestamptz,UNIQUE(study_id,id),UNIQUE(study_id,actor_ref),FOREIGN KEY(study_id,consent_version_id) REFERENCES research_private.form_versions(study_id,id));
CREATE TABLE research_private.consent_history(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL,participant_id uuid NOT NULL,consent_version_id uuid NOT NULL,consents jsonb NOT NULL,action text NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(study_id,participant_id) REFERENCES research_private.participants(study_id,id),FOREIGN KEY(study_id,consent_version_id) REFERENCES research_private.form_versions(study_id,id));
CREATE TABLE research_private.contacts(study_id uuid NOT NULL,participant_id uuid NOT NULL,contact_ciphertext jsonb NOT NULL,destination_hash text NOT NULL,pending boolean NOT NULL DEFAULT true,welcome_ciphertext jsonb NOT NULL,followup_ciphertext jsonb,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(study_id,participant_id),FOREIGN KEY(study_id,participant_id) REFERENCES research_private.participants(study_id,id));
CREATE TABLE research_private.verification_tokens(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL,participant_id uuid NOT NULL,digest text NOT NULL UNIQUE,destination_hash text NOT NULL,consent_version_id uuid NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(study_id,participant_id) REFERENCES research_private.participants(study_id,id),FOREIGN KEY(study_id,consent_version_id) REFERENCES research_private.form_versions(study_id,id));
CREATE TABLE research_private.verification_attempts(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL REFERENCES research_private.studies(id),participant_id uuid NOT NULL,actor_digest text,destination_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(study_id,participant_id) REFERENCES research_private.participants(study_id,id));
CREATE INDEX research_verification_limits ON research_private.verification_attempts(study_id,created_at);
CREATE TABLE research_private.responses(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL,participant_id uuid NOT NULL,instrument_version_id uuid NOT NULL,consent_version_id uuid NOT NULL,wave_id text NOT NULL,answers jsonb NOT NULL,versions jsonb NOT NULL,config_revision integer NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(study_id,participant_id,instrument_version_id,wave_id),FOREIGN KEY(study_id,participant_id) REFERENCES research_private.participants(study_id,id),FOREIGN KEY(study_id,instrument_version_id) REFERENCES research_private.form_versions(study_id,id),FOREIGN KEY(study_id,consent_version_id) REFERENCES research_private.form_versions(study_id,id));
CREATE TABLE research_private.historical_samples(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL,participant_id uuid NOT NULL,consent_version_id uuid NOT NULL,metadata jsonb NOT NULL,text_content text NOT NULL,versions jsonb NOT NULL,config_revision integer NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(study_id,id),FOREIGN KEY(study_id,participant_id) REFERENCES research_private.participants(study_id,id),FOREIGN KEY(study_id,consent_version_id) REFERENCES research_private.form_versions(study_id,id));
CREATE TABLE research_private.generated_samples(LIKE research_private.historical_samples INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE research_private.generated_samples ADD FOREIGN KEY(study_id,participant_id) REFERENCES research_private.participants(study_id,id),ADD FOREIGN KEY(study_id,consent_version_id) REFERENCES research_private.form_versions(study_id,id);
CREATE TABLE research_private.usage_events(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL,participant_id uuid NOT NULL,source_id uuid NOT NULL,event_digest text NOT NULL,operation text NOT NULL,mode text NOT NULL,metadata jsonb NOT NULL,versions jsonb NOT NULL,consent_version_id uuid NOT NULL,config_revision integer NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(study_id,event_digest),FOREIGN KEY(study_id,participant_id) REFERENCES research_private.participants(study_id,id),FOREIGN KEY(study_id,consent_version_id) REFERENCES research_private.form_versions(study_id,id));
CREATE TABLE research_private.source_mappings(study_id uuid NOT NULL,participant_id uuid NOT NULL,source_digest text NOT NULL,source_id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),PRIMARY KEY(study_id,participant_id,source_digest),FOREIGN KEY(study_id,participant_id) REFERENCES research_private.participants(study_id,id));
CREATE TABLE research_private.invites(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL REFERENCES research_private.studies(id),digest text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE research_private.outbox(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL,participant_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('verification','welcome','followup','feedback','update')),intent_key text NOT NULL, payload_ciphertext jsonb NOT NULL,contact_ciphertext jsonb,consent_version_id uuid NOT NULL,status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','claimed','accepted','blocked','unknown','cancelled')),due_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,first_attempt_at timestamptz,lease_id uuid,lease_until timestamptz,attempts integer NOT NULL DEFAULT 0,provider_id text,code text,UNIQUE(study_id,participant_id,intent_key),FOREIGN KEY(study_id,participant_id) REFERENCES research_private.participants(study_id,id),FOREIGN KEY(study_id,consent_version_id) REFERENCES research_private.form_versions(study_id,id));
CREATE TABLE research_private.audit_events(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL REFERENCES research_private.studies(id),actor_kind text NOT NULL,actor_id uuid,action text NOT NULL,subject_id uuid,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE research_private.mail_attempts(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL REFERENCES research_private.studies(id),message_id uuid NOT NULL,lease_id uuid NOT NULL,outcome text NOT NULL,provider_id text,code text,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX research_mail_completion ON research_private.mail_attempts(message_id,lease_id) WHERE outcome<>'claimed';
CREATE TABLE research_private.request_receipts(study_id uuid NOT NULL REFERENCES research_private.studies(id),actor_ref text NOT NULL,action text NOT NULL,request_id uuid NOT NULL,payload_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(study_id,actor_ref,action,request_id));

CREATE FUNCTION research_private.scope_allowed(sid uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $f$ SELECT pg_catalog.current_setting('research.owner',true)='true' OR pg_catalog.current_setting('research.internal',true)='true' OR sid::text=pg_catalog.current_setting('research.study',true) $f$;
CREATE FUNCTION research_private.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$ BEGIN RAISE EXCEPTION 'immutable' USING ERRCODE='55000'; END $f$;
CREATE FUNCTION research_private.frozen_observation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$ BEGIN IF TG_OP='DELETE' AND pg_catalog.current_setting('research.erasing',true)='true' AND CURRENT_USER='research_worker' THEN RETURN NULL; END IF; RAISE EXCEPTION 'immutable' USING ERRCODE='55000'; END $f$;
DO $tables$ DECLARE r record; BEGIN
 FOR r IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='research_private' LOOP
  EXECUTE pg_catalog.format('ALTER TABLE research_private.%I OWNER TO research_table_owner',r.tablename);
  EXECUTE pg_catalog.format('ALTER TABLE research_private.%I ENABLE ROW LEVEL SECURITY',r.tablename);
  EXECUTE pg_catalog.format('ALTER TABLE research_private.%I FORCE ROW LEVEL SECURITY',r.tablename);
  EXECUTE pg_catalog.format('GRANT SELECT,INSERT,UPDATE,DELETE ON research_private.%I TO research_worker',r.tablename);
  EXECUTE pg_catalog.format('REVOKE ALL ON research_private.%I FROM PUBLIC,anon,authenticated,service_role',r.tablename);
  IF r.tablename='studies' THEN
   EXECUTE 'CREATE POLICY research_scope ON research_private.studies TO research_worker USING(research_private.scope_allowed(id) OR EXISTS(SELECT 1 FROM research_private.memberships m WHERE m.study_id=research_private.studies.id AND m.actor_ref=pg_catalog.current_setting(''research.actor'',true) AND ''view_study''=ANY(m.permissions))) WITH CHECK(research_private.scope_allowed(id))';
  ELSIF r.tablename IN ('memberships','participants') THEN
   EXECUTE pg_catalog.format('CREATE POLICY research_scope ON research_private.%I TO research_worker USING(research_private.scope_allowed(study_id) OR actor_ref=pg_catalog.current_setting(''research.actor'',true)) WITH CHECK(research_private.scope_allowed(study_id))',r.tablename);
  ELSIF r.tablename='invites' THEN
   EXECUTE 'CREATE POLICY research_scope ON research_private.invites TO research_worker USING(research_private.scope_allowed(study_id) OR digest=pg_catalog.current_setting(''research.invite'',true)) WITH CHECK(research_private.scope_allowed(study_id))';
  ELSE EXECUTE pg_catalog.format('CREATE POLICY research_scope ON research_private.%I TO research_worker USING(research_private.scope_allowed(study_id)) WITH CHECK(research_private.scope_allowed(study_id))',r.tablename); END IF;
  IF r.tablename IN ('study_versions','form_versions','form_publications','consent_history','audit_events','mail_attempts') THEN EXECUTE pg_catalog.format('CREATE TRIGGER research_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON research_private.%I FOR EACH STATEMENT EXECUTE FUNCTION research_private.immutable()',r.tablename); END IF;
  IF r.tablename IN ('responses','historical_samples','generated_samples','usage_events') THEN EXECUTE pg_catalog.format('CREATE TRIGGER research_frozen BEFORE UPDATE OR DELETE OR TRUNCATE ON research_private.%I FOR EACH STATEMENT EXECUTE FUNCTION research_private.frozen_observation()',r.tablename); END IF;
 END LOOP;
END $tables$;

CREATE FUNCTION research_private.versions() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $f$ SELECT '{"application":"1.2.0","research":"1.0.0","schema":1,"metrics":"1.0.0","tool":"1.2.0","engine":"1.1.1","prompt":"1.1.1","principles":"18-1.0.0","model":null}'::jsonb $f$;
CREATE FUNCTION research_private.snapshot(data jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $f$ SELECT research_private.versions()||COALESCE((SELECT pg_catalog.jsonb_object_agg(x.key,x.value) FROM pg_catalog.jsonb_each(COALESCE(data,'{}')) x WHERE x.key IN ('application','research','schema','metrics','tool','engine','prompt','principles','model','communicationSchema','editVersions','sourceRevision')),'{}'::jsonb) $f$;
CREATE FUNCTION research_private.fail(code text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$ BEGIN RAISE EXCEPTION USING MESSAGE=code,ERRCODE='P0001'; END $f$;
CREATE FUNCTION research_private.permissions() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $f$ SELECT ARRAY['view_study','edit_study','manage_questionnaires','view_aggregate_results','view_pseudonymized_data','view_identifiable_data','view_document_content','export_data','manage_participants','contact_participants','manage_researchers','manage_consent','view_audit_log']::text[] $f$;
CREATE FUNCTION research_private.require(grant_name text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$ BEGIN
 IF pg_catalog.current_setting('research.owner',true)='true' THEN RETURN; END IF;
 IF NOT (pg_catalog.current_setting('research.permissions',true)::jsonb ? 'view_study' AND pg_catalog.current_setting('research.permissions',true)::jsonb ? grant_name) THEN PERFORM research_private.fail('not_found'); END IF;
END $f$;

CREATE FUNCTION research_private.verification(s research_private.studies,p research_private.participants,data jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE old research_private.contacts; token_id uuid; previous_internal text; total integer; actor_hash text; BEGIN
 actor_hash:=pg_catalog.encode(research_private.hmac(pg_catalog.convert_to(p.actor_ref,'UTF8'),pg_catalog.convert_to((SELECT a.value->>'secret' FROM public.access_settings a WHERE a.key='token-secret')||':'||s.id,'UTF8')),'hex');
 DELETE FROM research_private.verification_attempts WHERE study_id=s.id AND created_at<CURRENT_TIMESTAMP-INTERVAL '1 hour';
 IF pg_catalog.jsonb_typeof(data->'contactCiphertext')<>'object' OR pg_catalog.jsonb_typeof(data->'verificationCiphertext')<>'object' OR pg_catalog.jsonb_typeof(data->'welcomeCiphertext')<>'object' OR data->>'destinationHash'!~'^[0-9a-f]{64}$' OR data->>'verificationDigest'!~'^[0-9a-f]{64}$' THEN PERFORM research_private.fail('not_configured'); END IF;
 SELECT * INTO old FROM research_private.contacts WHERE study_id=s.id AND participant_id=p.id FOR UPDATE;
 IF old.destination_hash=data->>'destinationHash' AND EXISTS(SELECT 1 FROM research_private.verification_tokens t WHERE t.study_id=s.id AND t.participant_id=p.id AND t.destination_hash=old.destination_hash AND t.used_at IS NULL AND t.expires_at>CURRENT_TIMESTAMP AND t.consent_version_id=p.consent_version_id) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM research_private.verification_attempts a WHERE a.study_id=s.id AND a.actor_digest=actor_hash AND a.created_at>CURRENT_TIMESTAMP-INTERVAL '60 seconds') OR (SELECT pg_catalog.count(*) FROM research_private.verification_attempts a WHERE a.study_id=s.id AND a.actor_digest=actor_hash AND a.created_at>CURRENT_TIMESTAMP-INTERVAL '1 hour')>=5 OR (SELECT pg_catalog.count(*) FROM research_private.verification_attempts a WHERE a.study_id=s.id AND a.created_at>CURRENT_TIMESTAMP-INTERVAL '1 hour')>=100 THEN PERFORM research_private.fail('rate_limited'); END IF;
 -- Serialize the destination limit across studies without returning cross-study rows.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(data->>'destinationHash',0));
 previous_internal:=COALESCE(pg_catalog.current_setting('research.internal',true),'false'); PERFORM pg_catalog.set_config('research.internal','true',true);
 SELECT pg_catalog.count(*) INTO total FROM research_private.verification_attempts a WHERE a.destination_hash=data->>'destinationHash' AND a.created_at>CURRENT_TIMESTAMP-INTERVAL '1 hour';
 PERFORM pg_catalog.set_config('research.internal',previous_internal,true); IF total>=20 THEN PERFORM research_private.fail('rate_limited'); END IF;
 INSERT INTO research_private.verification_attempts(study_id,participant_id,actor_digest,destination_hash) VALUES(s.id,p.id,actor_hash,data->>'destinationHash');
 DELETE FROM research_private.verification_tokens WHERE study_id=s.id AND participant_id=p.id AND used_at IS NULL;
 UPDATE research_private.outbox SET status='cancelled',lease_id=NULL,lease_until=NULL WHERE study_id=s.id AND participant_id=p.id AND kind='verification' AND status IN ('queued','claimed','blocked');
 INSERT INTO research_private.contacts(study_id,participant_id,contact_ciphertext,destination_hash,pending,welcome_ciphertext,followup_ciphertext) VALUES(s.id,p.id,data->'contactCiphertext',data->>'destinationHash',true,data->'welcomeCiphertext',data->'followupCiphertext') ON CONFLICT(study_id,participant_id) DO UPDATE SET contact_ciphertext=EXCLUDED.contact_ciphertext,destination_hash=EXCLUDED.destination_hash,pending=true,welcome_ciphertext=EXCLUDED.welcome_ciphertext,followup_ciphertext=EXCLUDED.followup_ciphertext,updated_at=CURRENT_TIMESTAMP;
 INSERT INTO research_private.verification_tokens(study_id,participant_id,digest,destination_hash,consent_version_id,expires_at) VALUES(s.id,p.id,data->>'verificationDigest',data->>'destinationHash',p.consent_version_id,CURRENT_TIMESTAMP+INTERVAL '30 minutes') RETURNING id INTO token_id;
 INSERT INTO research_private.outbox(study_id,participant_id,kind,intent_key,payload_ciphertext,contact_ciphertext,consent_version_id) VALUES(s.id,p.id,'verification','verification:'||token_id,data->'verificationCiphertext',data->'contactCiphertext',p.consent_version_id);
 UPDATE research_private.participants SET verified=false,updated_at=CURRENT_TIMESTAMP WHERE study_id=s.id AND id=p.id;
 PERFORM research_private.audit(s.id,'verification_requested',p.id);
END $f$;

CREATE FUNCTION research_private.mail_eligible(m research_private.outbox) RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE s research_private.studies; p research_private.participants; c research_private.contacts; BEGIN
 SELECT * INTO s FROM research_private.studies WHERE id=m.study_id FOR UPDATE;
 SELECT * INTO p FROM research_private.participants WHERE study_id=m.study_id AND id=m.participant_id FOR UPDATE;
 SELECT * INTO c FROM research_private.contacts WHERE study_id=m.study_id AND participant_id=m.participant_id FOR UPDATE;
 IF s.status<>'active' OR (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::date NOT BETWEEN (s.config->>'startDate')::date AND (s.config->>'endDate')::date OR p.status IN ('withdrawn','erased') OR p.consents->>'participate' IS DISTINCT FROM 'true' OR p.consent_version_id::text<>s.config->>'consentVersionId' OR p.consent_version_id<>m.consent_version_id OR c.participant_id IS NULL THEN RETURN false; END IF;
 IF m.kind='verification' THEN RETURN c.pending AND EXISTS(SELECT 1 FROM research_private.verification_tokens t WHERE t.study_id=m.study_id AND t.participant_id=m.participant_id AND t.id::text=pg_catalog.split_part(m.intent_key,':',2) AND t.used_at IS NULL AND t.expires_at>CURRENT_TIMESTAMP AND t.destination_hash=c.destination_hash); END IF;
 IF NOT p.verified OR c.pending OR p.status<>'enrolled' THEN RETURN false; END IF;
 IF m.kind='welcome' THEN RETURN true; END IF;
 RETURN COALESCE((s.config->'contactKinds' ? m.kind) AND p.preferences->>m.kind='true' AND (m.kind<>'followup' OR (p.consents->>'surveys'='true' AND s.config->'dataCategories' ? 'surveys')),false);
END $f$;

CREATE FUNCTION research_private.mail_projection(m research_private.outbox) RETURNS jsonb LANGUAGE sql SET search_path='' AS $f$ SELECT pg_catalog.jsonb_build_object('messageId',m.id,'studyId',m.study_id,'participantId',m.participant_id,'kind',m.kind,'payloadCiphertext',m.payload_ciphertext,'contactCiphertext',m.contact_ciphertext,'idempotencyKey','begood-research-'||m.id,'leaseId',m.lease_id,'createdAt',m.created_at,'firstAttemptAt',m.first_attempt_at) $f$;

CREATE FUNCTION research_private.dispatch(p_token text,p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
<<dispatch>>
DECLARE auth jsonb; actor text; is_owner boolean; is_internal boolean; sid uuid; s research_private.studies; p research_private.participants; member research_private.memberships; target research_private.memberships; f research_private.form_versions; v research_private.verification_tokens; c research_private.contacts; m research_private.outbox; payload_hash text; receipt research_private.request_receipts; result jsonb; list jsonb; permissions text[]; delegation text[]; code text; rec jsonb; request_id uuid; mutation boolean; version_id uuid; selected_pid uuid; n integer:=0; wave jsonb; reminder integer; r record; category text; source uuid; event_hash text; source_hash text; old_config jsonb;
BEGIN
 PERFORM pg_catalog.set_config('research.actor','',true); PERFORM pg_catalog.set_config('research.owner','false',true); PERFORM pg_catalog.set_config('research.internal','false',true); PERFORM pg_catalog.set_config('research.study','',true); PERFORM pg_catalog.set_config('research.invite','',true); PERFORM pg_catalog.set_config('research.permissions','[]',true);
 IF pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN PERFORM research_private.fail('invalid'); END IF;
 auth:=research_private.auth(p_token); actor:=auth->>'actor'; is_owner:=COALESCE((auth->>'owner')::boolean,false); is_internal:=COALESCE((auth->>'internal')::boolean,false);
 PERFORM pg_catalog.set_config('research.actor',actor,true); PERFORM pg_catalog.set_config('research.owner',is_owner::text,true); PERFORM pg_catalog.set_config('research.internal',is_internal::text,true);
 IF is_internal AND p_action NOT IN ('mailClaim','mailComplete','followupSchedule') THEN PERFORM research_private.fail('unauthorized'); END IF;
 IF NOT is_internal AND p_action IN ('mailClaim','mailComplete','followupSchedule') THEN PERFORM research_private.fail('unauthorized'); END IF;
 IF is_owner THEN PERFORM pg_catalog.set_config('research.permissions',pg_catalog.to_jsonb(research_private.permissions())::text,true); END IF;

 IF p_action='bootstrap' THEN
  list:='[]';
  FOR s IN SELECT st.* FROM research_private.studies st WHERE is_owner OR EXISTS(SELECT 1 FROM research_private.memberships a WHERE a.study_id=st.id AND a.actor_ref=actor AND 'view_study'=ANY(a.permissions)) ORDER BY st.created_at,st.id LOOP
   PERFORM pg_catalog.set_config('research.study',s.id::text,true);
   IF NOT is_owner THEN SELECT * INTO member FROM research_private.memberships a WHERE a.study_id=s.id AND a.actor_ref=actor FOR SHARE; PERFORM pg_catalog.set_config('research.permissions',pg_catalog.to_jsonb(member.permissions)::text,true); END IF;
   list:=list||pg_catalog.jsonb_build_array(research_private.study(s));
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('owner',is_owner,'studies',list);
 END IF;
 IF p_action='myStudies' THEN
  SELECT COALESCE(pg_catalog.jsonb_agg(research_private.participation(x)),'[]'::jsonb) INTO list FROM research_private.participants x WHERE x.actor_ref=actor;
  RETURN pg_catalog.jsonb_build_object('participations',list);
 END IF;
 IF p_action='recordUsage' THEN
  IF is_owner OR is_internal THEN RETURN '{"recorded":0}'::jsonb; END IF;
  IF p_payload->>'operation' NOT IN ('generate','revise','communicationRound','convert') OR p_payload->>'mode' NOT IN ('single','continuity') OR COALESCE(p_payload->>'eventId','')='' OR COALESCE(p_payload->>'sourceId','')='' THEN PERFORM research_private.fail('invalid'); END IF;
  IF pg_catalog.jsonb_typeof(p_payload->'counts') IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_each(p_payload->'counts') x WHERE x.key NOT IN ('sessions','drafts','revisions','rounds') OR pg_catalog.jsonb_typeof(x.value)<>'number' OR x.value::text!~'^\d+$') THEN PERFORM research_private.fail('invalid'); END IF;
  FOR p IN SELECT x.* FROM research_private.participants x WHERE x.actor_ref=actor AND x.status='enrolled' LOOP
   PERFORM pg_catalog.set_config('research.study',p.study_id::text,true);
   SELECT * INTO s FROM research_private.studies WHERE id=p.study_id FOR UPDATE;
   SELECT * INTO p FROM research_private.participants x WHERE x.study_id=s.id AND x.actor_ref=actor FOR UPDATE;
   BEGIN PERFORM research_private.collectable(s,p,'usage'); EXCEPTION WHEN SQLSTATE 'P0001' THEN CONTINUE; END;
   event_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(actor||':'||(p_payload->>'eventId'),'UTF8')),'hex');
   source_hash:=pg_catalog.encode(research_private.hmac(pg_catalog.convert_to(p_payload->>'sourceId','UTF8'),pg_catalog.convert_to(s.id::text,'UTF8')),'hex');
   INSERT INTO research_private.source_mappings(study_id,participant_id,source_digest) VALUES(s.id,p.id,source_hash) ON CONFLICT DO NOTHING;
   SELECT source_id INTO source FROM research_private.source_mappings WHERE study_id=s.id AND participant_id=p.id AND source_digest=source_hash;
   INSERT INTO research_private.usage_events(study_id,participant_id,source_id,event_digest,operation,mode,metadata,versions,consent_version_id,config_revision) VALUES(s.id,p.id,source,event_hash,p_payload->>'operation',p_payload->>'mode',pg_catalog.jsonb_build_object('timestamp',p_payload->'timestamp','durationMs',p_payload->'durationMs','audience',p_payload->'audience','counts',pg_catalog.jsonb_build_object('sessions',COALESCE(p_payload#>'{counts,sessions}','0'),'drafts',COALESCE(p_payload#>'{counts,drafts}','0'),'revisions',COALESCE(p_payload#>'{counts,revisions}','0'),'rounds',COALESCE(p_payload#>'{counts,rounds}','0'))),research_private.snapshot(p_payload->'versions'),p.consent_version_id,s.revision) ON CONFLICT(study_id,event_digest) DO NOTHING;
   GET DIAGNOSTICS n=ROW_COUNT;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('recorded',n);
 END IF;
 IF p_action='studyCreate' THEN
  IF NOT is_owner THEN PERFORM research_private.fail('not_found'); END IF;
  request_id:=(p_payload->>'requestId')::uuid; IF request_id IS NULL THEN PERFORM research_private.fail('invalid'); END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor||':'||p_action||':'||request_id,0));
  payload_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((p_payload-'requestId')::text,'UTF8')),'hex');
  SELECT * INTO receipt FROM research_private.request_receipts rr WHERE rr.actor_ref=actor AND rr.action=p_action AND rr.request_id=dispatch.request_id;
  IF FOUND THEN IF receipt.payload_hash<>payload_hash THEN PERFORM research_private.fail('conflict'); END IF; RETURN receipt.result; END IF;
  INSERT INTO research_private.studies(config) VALUES(COALESCE(p_payload->'config','{}')) RETURNING * INTO s;
  PERFORM pg_catalog.set_config('research.study',s.id::text,true);
  INSERT INTO research_private.study_versions(study_id,revision,status,config,versions) VALUES(s.id,s.revision,s.status,s.config,research_private.versions());
  PERFORM research_private.audit(s.id,p_action); result:=pg_catalog.jsonb_build_object('study',research_private.study(s));
  INSERT INTO research_private.request_receipts VALUES(s.id,actor,p_action,request_id,payload_hash,result,CURRENT_TIMESTAMP); RETURN result;
 END IF;
 IF p_action IN ('mailClaim','mailComplete','followupSchedule') THEN
  IF p_action='mailClaim' THEN
   list:='[]';
   IF p_payload ? 'messageId' THEN
    SELECT * INTO m FROM research_private.outbox WHERE id=(p_payload->>'messageId')::uuid FOR UPDATE;
    IF m.id IS NULL OR m.status<>'claimed' OR m.lease_id IS DISTINCT FROM (p_payload->>'leaseId')::uuid OR m.lease_until<CURRENT_TIMESTAMP THEN RETURN '{"messages":[]}'::jsonb; END IF;
    IF NOT research_private.mail_eligible(m) THEN UPDATE research_private.outbox SET status='cancelled',lease_id=NULL,lease_until=NULL WHERE id=m.id; RETURN '{"messages":[]}'::jsonb; END IF;
    RETURN pg_catalog.jsonb_build_object('messages',pg_catalog.jsonb_build_array(research_private.mail_projection(m)));
   END IF;
   FOR m IN SELECT x.* FROM research_private.outbox x WHERE (x.status='queued' AND x.due_at<=CURRENT_TIMESTAMP) OR (x.status='claimed' AND x.lease_until<CURRENT_TIMESTAMP) ORDER BY x.due_at,x.created_at LIMIT LEAST(GREATEST(COALESCE((p_payload->>'limit')::integer,10),1),100) FOR UPDATE SKIP LOCKED LOOP
    IF NOT research_private.mail_eligible(m) THEN UPDATE research_private.outbox SET status='cancelled',lease_id=NULL,lease_until=NULL WHERE id=m.id; CONTINUE; END IF;
    IF m.first_attempt_at IS NOT NULL AND m.first_attempt_at<CURRENT_TIMESTAMP-INTERVAL '24 hours' THEN UPDATE research_private.outbox SET status='unknown',code='acceptance_unknown',lease_id=NULL,lease_until=NULL WHERE id=m.id; PERFORM research_private.audit(m.study_id,'mail_unknown',m.id); CONTINUE; END IF;
    UPDATE research_private.outbox SET status='claimed',lease_id=pg_catalog.gen_random_uuid(),lease_until=CURRENT_TIMESTAMP+pg_catalog.make_interval(secs=>LEAST(GREATEST(COALESCE((p_payload->>'leaseSeconds')::integer,120),30),600)),attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,CURRENT_TIMESTAMP) WHERE id=m.id RETURNING * INTO m;
    INSERT INTO research_private.mail_attempts(study_id,message_id,lease_id,outcome) VALUES(m.study_id,m.id,m.lease_id,'claimed');
    list:=list||pg_catalog.jsonb_build_array(research_private.mail_projection(m));
   END LOOP; RETURN pg_catalog.jsonb_build_object('messages',list);
  ELSIF p_action='mailComplete' THEN
   SELECT * INTO m FROM research_private.outbox WHERE id=(p_payload->>'messageId')::uuid FOR UPDATE;
   IF p_payload->>'outcome' NOT IN ('accepted','retry','blocked','unknown') THEN PERFORM research_private.fail('invalid'); END IF;
   IF m.id IS NULL THEN
    SELECT a.study_id INTO sid FROM research_private.mail_attempts a WHERE a.message_id=(p_payload->>'messageId')::uuid AND a.lease_id=(p_payload->>'leaseId')::uuid AND a.outcome='claimed';
    IF sid IS NULL OR EXISTS(SELECT 1 FROM research_private.mail_attempts a WHERE a.message_id=(p_payload->>'messageId')::uuid AND a.lease_id=(p_payload->>'leaseId')::uuid AND a.outcome<>'claimed') THEN PERFORM research_private.fail('not_found'); END IF;
    INSERT INTO research_private.mail_attempts(study_id,message_id,lease_id,outcome,provider_id,code) VALUES(sid,(p_payload->>'messageId')::uuid,(p_payload->>'leaseId')::uuid,p_payload->>'outcome',p_payload->>'providerId',pg_catalog.left(p_payload->>'code',80));
    PERFORM research_private.audit(sid,'mail_'||(p_payload->>'outcome'),(p_payload->>'messageId')::uuid); RETURN '{"completed":true}'::jsonb;
   END IF;
   IF m.id IS NULL OR NOT ((m.status='claimed' AND m.lease_id=(p_payload->>'leaseId')::uuid) OR (m.status='cancelled' AND EXISTS(SELECT 1 FROM research_private.mail_attempts a WHERE a.message_id=m.id AND a.lease_id=(p_payload->>'leaseId')::uuid AND a.outcome='claimed') AND NOT EXISTS(SELECT 1 FROM research_private.mail_attempts a WHERE a.message_id=m.id AND a.lease_id=(p_payload->>'leaseId')::uuid AND a.outcome<>'claimed'))) THEN PERFORM research_private.fail('not_found'); END IF;
   IF p_payload->>'outcome' NOT IN ('accepted','retry','blocked','unknown') THEN PERFORM research_private.fail('invalid'); END IF;
   INSERT INTO research_private.mail_attempts(study_id,message_id,lease_id,outcome,provider_id,code) VALUES(m.study_id,m.id,(p_payload->>'leaseId')::uuid,p_payload->>'outcome',p_payload->>'providerId',pg_catalog.left(p_payload->>'code',80));
   UPDATE research_private.outbox SET status=CASE WHEN m.status='cancelled' THEN 'cancelled' WHEN p_payload->>'outcome'='retry' THEN 'queued' ELSE p_payload->>'outcome' END,provider_id=p_payload->>'providerId',code=pg_catalog.left(p_payload->>'code',80),lease_id=NULL,lease_until=NULL,due_at=CURRENT_TIMESTAMP+INTERVAL '60 seconds' WHERE id=m.id;
   PERFORM research_private.audit(m.study_id,'mail_'||(p_payload->>'outcome'),m.id); RETURN '{"completed":true}'::jsonb;
  ELSE
   FOR s IN SELECT x.* FROM research_private.studies x WHERE x.status='active' AND (NOT(p_payload ? 'studyId') OR x.id=(p_payload->>'studyId')::uuid) FOR UPDATE LOOP
    FOR p IN SELECT x.* FROM research_private.participants x WHERE x.study_id=s.id AND x.status='enrolled' FOR UPDATE LOOP
     BEGIN PERFORM research_private.collectable(s,p,'surveys'); EXCEPTION WHEN SQLSTATE 'P0001' THEN CONTINUE; END;
     IF p.preferences->>'followup' IS DISTINCT FROM 'true' OR NOT(s.config->'contactKinds' ? 'followup') THEN CONTINUE; END IF;
     SELECT * INTO c FROM research_private.contacts WHERE study_id=s.id AND participant_id=p.id AND NOT pending;
     IF c.followup_ciphertext IS NULL THEN CONTINUE; END IF;
     FOR wave IN SELECT x FROM pg_catalog.jsonb_array_elements(s.config->'schedule') x LOOP
      IF EXISTS(SELECT 1 FROM research_private.responses x WHERE x.study_id=s.id AND x.participant_id=p.id AND x.wave_id=wave->>'waveId' AND x.instrument_version_id=(wave->>'instrumentVersionId')::uuid) THEN CONTINUE; END IF;
      IF p.created_at+pg_catalog.make_interval(days=>(wave->>'offsetDays')::integer)<=CURRENT_TIMESTAMP THEN INSERT INTO research_private.outbox(study_id,participant_id,kind,intent_key,payload_ciphertext,contact_ciphertext,consent_version_id) VALUES(s.id,p.id,'followup','wave:'||(wave->>'waveId')||':'||p.consent_version_id,c.followup_ciphertext,c.contact_ciphertext,p.consent_version_id) ON CONFLICT DO NOTHING; END IF;
      FOR reminder IN SELECT x::integer FROM pg_catalog.jsonb_array_elements_text(wave->'reminderDays') x LOOP
       IF p.created_at+pg_catalog.make_interval(days=>(wave->>'offsetDays')::integer+reminder)<=CURRENT_TIMESTAMP THEN INSERT INTO research_private.outbox(study_id,participant_id,kind,intent_key,payload_ciphertext,contact_ciphertext,consent_version_id) VALUES(s.id,p.id,'followup','reminder:'||(wave->>'waveId')||':'||reminder||':'||p.consent_version_id,c.followup_ciphertext,c.contact_ciphertext,p.consent_version_id) ON CONFLICT DO NOTHING; END IF;
      END LOOP;
     END LOOP;
    END LOOP;
   END LOOP; RETURN '{"scheduled":true}'::jsonb;
  END IF;
 END IF;
 IF p_action IN ('inviteInfo','enroll') THEN
  PERFORM pg_catalog.set_config('research.invite',COALESCE(p_payload->>'inviteDigest',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload->>'invite','UTF8')),'hex')),true);
  SELECT study_id INTO sid FROM research_private.invites WHERE digest=pg_catalog.current_setting('research.invite',true) AND expires_at>CURRENT_TIMESTAMP;
 ELSE sid:=(p_payload->>'studyId')::uuid; END IF;
 IF sid IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
 PERFORM pg_catalog.set_config('research.study',sid::text,true);
 SELECT * INTO s FROM research_private.studies WHERE id=sid FOR UPDATE;
 IF s.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
 SELECT * INTO member FROM research_private.memberships x WHERE x.study_id=sid AND x.actor_ref=actor FOR SHARE;
 IF NOT is_owner THEN PERFORM pg_catalog.set_config('research.permissions',COALESCE(pg_catalog.to_jsonb(member.permissions),'[]')::text,true); END IF;
 SELECT * INTO p FROM research_private.participants x WHERE x.study_id=sid AND x.actor_ref=actor FOR UPDATE;

 IF p_action IN ('inviteInfo','enroll') THEN
  IF is_owner OR is_internal OR s.status<>'active' OR (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::date NOT BETWEEN (s.config->>'startDate')::date AND (s.config->>'endDate')::date OR (pg_catalog.jsonb_array_length(COALESCE(s.config->'eligibleInstitutions','[]'))>0 AND NOT(s.config->'eligibleInstitutions' ? (auth->>'inst'))) THEN PERFORM research_private.fail('not_found'); END IF;
 ELSIF p_action IN ('participationGet','reconsent','preferencesSet','emailChange','withdraw','eraseMyData','surveySubmit','sampleSubmit','verifyEmail') THEN
  IF p.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
 ELSIF p_action='sampleGet' AND p.id IS NOT NULL THEN NULL;
 ELSE PERFORM research_private.require('view_study'); END IF;
 -- A receipt does not confer a capability that has since been revoked.
 IF p_action='studySave' THEN PERFORM research_private.require('edit_study');
 ELSIF p_action IN ('memberSet','memberRemove') THEN PERFORM research_private.require('manage_researchers');
 ELSIF p_action IN ('versionSave','versionPublish') THEN
  IF p_action='versionPublish' THEN SELECT kind INTO category FROM research_private.form_versions WHERE study_id=sid AND id=(p_payload->>'versionId')::uuid; IF category IS NULL THEN PERFORM research_private.fail('not_found'); END IF; ELSE category:=p_payload->>'kind'; END IF;
  PERFORM research_private.require(CASE WHEN category='consent' THEN 'manage_consent' ELSE 'manage_questionnaires' END);
 ELSIF p_action IN ('studyStatus','mailResolve','retentionRun') THEN IF NOT is_owner THEN PERFORM research_private.fail('not_found'); END IF;
 ELSIF p_action='inviteCreate' THEN PERFORM research_private.require('manage_participants');
 ELSIF p_action='contactQueue' THEN PERFORM research_private.require('view_identifiable_data'); PERFORM research_private.require('contact_participants');
 END IF;
 mutation:=p_action IN ('studySave','studyStatus','memberSet','memberRemove','versionSave','versionPublish','mailResolve','contactQueue','retentionRun','inviteCreate','enroll','verifyEmail','reconsent','preferencesSet','emailChange','withdraw','eraseMyData','surveySubmit','sampleSubmit');
 IF mutation THEN
  request_id:=(p_payload->>'requestId')::uuid; IF request_id IS NULL THEN PERFORM research_private.fail('invalid'); END IF;
  payload_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((p_payload-ARRAY['requestId','contactCiphertext','verificationCiphertext','welcomeCiphertext','followupCiphertext','encryptedBody','expiresAt'])::text,'UTF8')),'hex');
  SELECT * INTO receipt FROM research_private.request_receipts rr WHERE rr.study_id=sid AND rr.actor_ref=actor AND rr.action=p_action AND rr.request_id=dispatch.request_id;
  IF FOUND THEN IF receipt.payload_hash<>payload_hash THEN PERFORM research_private.fail('conflict'); END IF; RETURN receipt.result; END IF;
 END IF;
 IF p_action IN ('studySave','studyStatus','memberSet','memberRemove','versionSave','versionPublish') AND ((p_payload->>'expectedRevision')::integer IS NULL OR (p_payload->>'expectedRevision')::integer<>s.revision) THEN PERFORM research_private.fail('conflict'); END IF;

 CASE p_action
 WHEN 'studyGet' THEN result:=pg_catalog.jsonb_build_object('study',research_private.study(s));
 WHEN 'studySave' THEN
  PERFORM research_private.require('edit_study');
  IF pg_catalog.jsonb_typeof(p_payload->'config')<>'object' OR s.status IN ('completed','archived') THEN PERFORM research_private.fail('invalid'); END IF;
  old_config:=s.config; s.config:=p_payload->'config';
  IF s.status='active' THEN
   PERFORM research_private.validate_activation(s);
   IF (old_config->'dataCategories' IS DISTINCT FROM s.config->'dataCategories' OR old_config->'contactKinds' IS DISTINCT FROM s.config->'contactKinds' OR old_config->'retentionDays' IS DISTINCT FROM s.config->'retentionDays' OR old_config->'withdrawalPolicy' IS DISTINCT FROM s.config->'withdrawalPolicy') AND old_config->>'consentVersionId'=s.config->>'consentVersionId' THEN PERFORM research_private.fail('consent_changed'); END IF;
  END IF;
  UPDATE research_private.studies SET config=s.config WHERE id=sid; s:=research_private.bump(sid); result:=pg_catalog.jsonb_build_object('study',research_private.study(s));
 WHEN 'studyStatus' THEN
  IF NOT is_owner THEN PERFORM research_private.fail('not_found'); END IF;
  IF NOT ((s.status='draft' AND p_payload->>'status'='pending_approval') OR (s.status='pending_approval' AND p_payload->>'status' IN ('draft','active')) OR (s.status='active' AND p_payload->>'status' IN ('paused','completed')) OR (s.status='paused' AND p_payload->>'status' IN ('active','completed')) OR (s.status='completed' AND p_payload->>'status'='archived')) THEN PERFORM research_private.fail('invalid'); END IF;
  IF p_payload->>'status'='active' THEN IF p_payload->>'confirmApprovals'<>'true' THEN PERFORM research_private.fail('invalid'); END IF; PERFORM research_private.validate_activation(s); END IF;
  UPDATE research_private.studies SET status=p_payload->>'status' WHERE id=sid; s:=research_private.bump(sid); result:=pg_catalog.jsonb_build_object('study',research_private.study(s));
 WHEN 'memberList','memberSet','memberRemove' THEN
  PERFORM research_private.require('manage_researchers');
  IF p_action='memberSet' THEN
   code:=pg_catalog.regexp_replace(pg_catalog.upper(p_payload->>'code'),'[^A-Z0-9]','','g');
   rec:=research_private.live_individual(code);
   IF rec IS NULL OR rec->>'kind' NOT IN ('staff','instadmin') OR COALESCE((rec->>'revoked')::boolean,false) OR (rec->>'expiresAt' IS NOT NULL AND (rec->>'expiresAt')::date<(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::date) THEN PERFORM research_private.fail('invalid'); END IF;
   IF p_payload->>'role' NOT IN ('pi','researcher','assistant') OR pg_catalog.jsonb_typeof(p_payload->'permissions')<>'array' THEN PERFORM research_private.fail('invalid'); END IF;
   SELECT COALESCE(pg_catalog.array_agg(x),'{}') INTO permissions FROM pg_catalog.jsonb_array_elements_text(p_payload->'permissions') x;
   SELECT COALESCE(pg_catalog.array_agg(x),'{}') INTO delegation FROM pg_catalog.jsonb_array_elements_text(COALESCE(p_payload->'delegablePermissions','[]')) x;
   IF NOT(permissions <@ research_private.permissions()) OR NOT(delegation <@ research_private.permissions()) THEN PERFORM research_private.fail('invalid'); END IF;
   IF NOT is_owner AND ('code:'||code=actor OR NOT(permissions <@ member.delegable_permissions) OR p_payload ? 'delegablePermissions') THEN PERFORM research_private.fail('not_found'); END IF;
   SELECT * INTO target FROM research_private.memberships WHERE study_id=sid AND actor_ref='code:'||code FOR UPDATE;
   IF NOT is_owner AND target.id IS NOT NULL AND (NOT(target.permissions <@ member.delegable_permissions) OR pg_catalog.cardinality(target.delegable_permissions)>0) THEN PERFORM research_private.fail('not_found'); END IF;
   INSERT INTO research_private.memberships(study_id,actor_ref,role,permissions,delegable_permissions) VALUES(sid,'code:'||code,p_payload->>'role',permissions,CASE WHEN is_owner THEN delegation ELSE '{}'::text[] END) ON CONFLICT(study_id,actor_ref) DO UPDATE SET role=EXCLUDED.role,permissions=EXCLUDED.permissions,delegable_permissions=EXCLUDED.delegable_permissions RETURNING * INTO target;
   s:=research_private.bump(sid);
  ELSIF p_action='memberRemove' THEN
   SELECT * INTO target FROM research_private.memberships WHERE study_id=sid AND id=(p_payload->>'memberId')::uuid FOR UPDATE;
   IF target.id IS NULL OR (NOT is_owner AND (target.actor_ref=actor OR NOT(target.permissions <@ member.delegable_permissions) OR pg_catalog.cardinality(target.delegable_permissions)>0)) THEN PERFORM research_private.fail('not_found'); END IF;
   DELETE FROM research_private.memberships WHERE study_id=sid AND id=target.id; s:=research_private.bump(sid);
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',x.id,'label',COALESCE((SELECT a.value->>'label' FROM public.access_settings a WHERE a.key=x.actor_ref),'צוות המחקר'),'self',x.actor_ref=actor,'role',x.role,'permissions',x.permissions,'delegablePermissions',x.delegable_permissions,'createdAt',x.created_at)),'[]'::jsonb) INTO list FROM research_private.memberships x WHERE x.study_id=sid;
  result:=pg_catalog.jsonb_build_object('members',list,'revision',s.revision);
 WHEN 'versionList','versionSave','versionPublish' THEN
  IF p_action='versionPublish' THEN SELECT * INTO f FROM research_private.form_versions WHERE study_id=sid AND id=(p_payload->>'versionId')::uuid; IF f.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF; category:=f.kind; ELSE category:=p_payload->>'kind'; END IF;
  IF category NOT IN ('consent','instrument') THEN PERFORM research_private.fail('invalid'); END IF;
  PERFORM research_private.require(CASE WHEN category='consent' THEN 'manage_consent' ELSE 'manage_questionnaires' END);
  IF p_action='versionSave' THEN
   PERFORM research_private.validate_form(category,p_payload->'definition'); INSERT INTO research_private.form_versions(study_id,kind,definition) VALUES(sid,category,p_payload->'definition') RETURNING * INTO f; s:=research_private.bump(sid); result:=pg_catalog.jsonb_build_object('version',research_private.form(f),'revision',s.revision);
  ELSIF p_action='versionPublish' THEN
   INSERT INTO research_private.form_publications(study_id,version_id) VALUES(sid,f.id) ON CONFLICT DO NOTHING; s:=research_private.bump(sid); result:=pg_catalog.jsonb_build_object('version',research_private.form(f),'revision',s.revision);
  ELSE SELECT COALESCE(pg_catalog.jsonb_agg(research_private.form(x) ORDER BY x.created_at),'[]'::jsonb) INTO list FROM research_private.form_versions x WHERE x.study_id=sid AND x.kind=category; result:=pg_catalog.jsonb_build_object('versions',list); END IF;
 WHEN 'participantList' THEN
  PERFORM research_private.require('manage_participants'); SELECT COALESCE(pg_catalog.jsonb_agg(research_private.participation(x)||pg_catalog.jsonb_build_object('responses',(SELECT pg_catalog.count(*) FROM research_private.responses z WHERE z.study_id=sid AND z.participant_id=x.id))),'[]'::jsonb) INTO list FROM research_private.participants x WHERE x.study_id=sid AND x.status<>'erased'; result:=pg_catalog.jsonb_build_object('participants',list);
 WHEN 'contactGet' THEN
  PERFORM research_private.require('view_identifiable_data'); PERFORM research_private.require('contact_participants');
  SELECT * INTO c FROM research_private.contacts WHERE study_id=sid AND participant_id=(p_payload->>'participantId')::uuid AND NOT pending;
  IF c.participant_id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
  result:=pg_catalog.jsonb_build_object('contact',pg_catalog.jsonb_build_object('participantId',c.participant_id,'contactCiphertext',c.contact_ciphertext,'label',(SELECT x.label FROM research_private.participants x WHERE x.study_id=sid AND x.id=c.participant_id))); PERFORM research_private.audit(sid,'contact_access',c.participant_id);
 WHEN 'resultsGet','exportData' THEN
  category:=p_payload->>'category';
  IF p_action='exportData' THEN PERFORM research_private.require('export_data'); IF NOT(s.config->'exportCategories' ? category) THEN PERFORM research_private.fail('not_found'); END IF; END IF;
  result:=research_private.dataset(sid,category,COALESCE((p_payload->>'includeContent')::boolean,false));
  IF p_action='exportData' THEN PERFORM research_private.audit(sid,'export',NULL,pg_catalog.jsonb_build_object('category',category,'content',COALESCE((p_payload->>'includeContent')::boolean,false))); END IF;
 WHEN 'auditList' THEN
  PERFORM research_private.require('view_audit_log'); SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',x.id,'actorKind',x.actor_kind,'actorId',x.actor_id,'action',x.action,'subjectId',x.subject_id,'detail',x.detail,'createdAt',x.created_at) ORDER BY x.created_at DESC),'[]'::jsonb) INTO list FROM research_private.audit_events x WHERE x.study_id=sid; result:=pg_catalog.jsonb_build_object('events',list);
 WHEN 'mailList' THEN
  PERFORM research_private.require('contact_participants'); SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',x.id,'participantId',x.participant_id,'kind',x.kind,'status',x.status,'dueAt',x.due_at,'attempts',x.attempts,'code',x.code) ORDER BY x.created_at DESC),'[]'::jsonb) INTO list FROM research_private.outbox x WHERE x.study_id=sid; result:=pg_catalog.jsonb_build_object('messages',list);
 WHEN 'mailResolve' THEN
  IF NOT is_owner THEN PERFORM research_private.fail('not_found'); END IF;
  SELECT * INTO m FROM research_private.outbox WHERE study_id=sid AND id=(p_payload->>'messageId')::uuid FOR UPDATE;
  IF m.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
  IF m.status<>'unknown' OR p_payload->>'outcome' NOT IN ('accepted','not_sent') OR COALESCE(p_payload->>'evidence','')='' THEN PERFORM research_private.fail('invalid'); END IF;
  UPDATE research_private.outbox SET status=CASE WHEN p_payload->>'outcome'='accepted' THEN 'accepted' ELSE 'blocked' END,code='owner_resolved',lease_id=NULL,lease_until=NULL WHERE study_id=sid AND id=m.id;
  PERFORM research_private.audit(sid,'mail_resolved',m.id,pg_catalog.jsonb_build_object('outcome',p_payload->>'outcome','evidenceHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload->>'evidence','UTF8')),'hex'))); result:=pg_catalog.jsonb_build_object('message',pg_catalog.jsonb_build_object('id',m.id,'status',CASE WHEN p_payload->>'outcome'='accepted' THEN 'accepted' ELSE 'blocked' END));
 WHEN 'contactQueue' THEN
  PERFORM research_private.require('view_identifiable_data'); PERFORM research_private.require('contact_participants');
  IF p_payload->>'kind' NOT IN ('feedback','update') OR pg_catalog.jsonb_typeof(p_payload->'encryptedBody')<>'object' OR NOT(s.config->'contactKinds' ? (p_payload->>'kind')) THEN PERFORM research_private.fail('invalid'); END IF;
  FOR selected_pid IN SELECT x::uuid FROM pg_catalog.jsonb_array_elements_text(p_payload->'participantIds') x LOOP
   SELECT * INTO p FROM research_private.participants x WHERE x.study_id=sid AND x.id=selected_pid FOR UPDATE; IF p.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
   IF s.status<>'active' OR NOT p.verified OR p.status<>'enrolled' OR p.consent_version_id::text<>s.config->>'consentVersionId' OR p.preferences->>(p_payload->>'kind') IS DISTINCT FROM 'true' THEN CONTINUE; END IF;
   SELECT * INTO c FROM research_private.contacts WHERE study_id=sid AND participant_id=p.id AND NOT pending;
   IF c.participant_id IS NULL THEN CONTINUE; END IF;
   INSERT INTO research_private.outbox(study_id,participant_id,kind,intent_key,payload_ciphertext,contact_ciphertext,consent_version_id) VALUES(sid,p.id,p_payload->>'kind','contact:'||request_id,p_payload->'encryptedBody',c.contact_ciphertext,p.consent_version_id) ON CONFLICT DO NOTHING; n:=n+1;
  END LOOP; result:=pg_catalog.jsonb_build_object('queued',n);
 WHEN 'retentionRun' THEN
  IF NOT is_owner THEN PERFORM research_private.fail('not_found'); END IF;
  IF (s.config->>'retentionDays')::integer IS NULL THEN PERFORM research_private.fail('invalid'); END IF;
  FOR p IN SELECT x.* FROM research_private.participants x WHERE x.study_id=sid AND x.status<>'erased' AND x.created_at<CURRENT_TIMESTAMP-pg_catalog.make_interval(days=>(s.config->>'retentionDays')::integer) FOR UPDATE LOOP PERFORM research_private.erase(sid,p.id); n:=n+1; END LOOP;
  DELETE FROM research_private.verification_attempts WHERE study_id=sid AND created_at<CURRENT_TIMESTAMP-INTERVAL '1 hour';
  result:=pg_catalog.jsonb_build_object('removed',n);
 WHEN 'inviteCreate' THEN
  PERFORM research_private.require('manage_participants'); IF s.status<>'active' OR p_payload->>'inviteDigest'!~'^[0-9a-f]{64}$' THEN PERFORM research_private.fail('invalid'); END IF;
  INSERT INTO research_private.invites(study_id,digest,expires_at) VALUES(sid,p_payload->>'inviteDigest',CURRENT_TIMESTAMP+INTERVAL '30 days'); result:=pg_catalog.jsonb_build_object('invite',pg_catalog.jsonb_build_object('studyId',sid,'expiresAt',CURRENT_TIMESTAMP+INTERVAL '30 days'));
 WHEN 'inviteInfo' THEN
  SELECT * INTO f FROM research_private.form_versions WHERE study_id=sid AND id=(s.config->>'consentVersionId')::uuid;
  SELECT COALESCE(pg_catalog.jsonb_agg(research_private.form(x)),'[]'::jsonb) INTO list FROM research_private.form_versions x WHERE x.study_id=sid AND x.kind='instrument' AND s.config->'instrumentVersionIds' ? x.id::text;
  result:=pg_catalog.jsonb_build_object('study',pg_catalog.jsonb_build_object('id',sid,'title',s.config->>'title','description',s.config->>'description','population',s.config->>'population','expectations',s.config->>'expectations'),'consent',research_private.form(f),'instruments',list);
 WHEN 'enroll' THEN
  IF p.id IS NOT NULL AND p.status IN ('withdrawn','erased') THEN PERFORM research_private.fail('conflict'); END IF;
  IF p_payload->>'consentVersionId'<>s.config->>'consentVersionId' THEN PERFORM research_private.fail('consent_changed'); END IF;
  IF p_payload#>>'{consents,participate}' IS DISTINCT FROM 'true' OR pg_catalog.jsonb_typeof(p_payload->'consents')<>'object' OR pg_catalog.jsonb_typeof(p_payload->'preferences')<>'object' THEN PERFORM research_private.fail('invalid'); END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_each(p_payload->'consents') x WHERE x.key NOT IN ('participate','surveys','usage','historical','generated') OR pg_catalog.jsonb_typeof(x.value)<>'boolean' OR (x.key<>'participate' AND x.value='true'::jsonb AND NOT(s.config->'dataCategories' ? x.key))) THEN PERFORM research_private.fail('invalid'); END IF;
  IF p.id IS NULL THEN INSERT INTO research_private.participants(study_id,actor_ref,label,consent_version_id,consents,preferences) VALUES(sid,actor,COALESCE(auth->>'label',''),(p_payload->>'consentVersionId')::uuid,p_payload->'consents',p_payload->'preferences') RETURNING * INTO p; INSERT INTO research_private.consent_history(study_id,participant_id,consent_version_id,consents,action) VALUES(sid,p.id,p.consent_version_id,p.consents,'enroll');
  ELSIF p.consent_version_id::text<>p_payload->>'consentVersionId' OR p.consents IS DISTINCT FROM p_payload->'consents' THEN PERFORM research_private.fail('consent_changed'); END IF;
  PERFORM research_private.verification(s,p,p_payload); SELECT * INTO p FROM research_private.participants WHERE study_id=sid AND id=p.id; result:=pg_catalog.jsonb_build_object('participation',research_private.participation(p),'verificationPending',true);
 WHEN 'verifyEmail' THEN
  IF s.status<>'active' OR p.status IN ('withdrawn','erased') OR p.consent_version_id::text<>s.config->>'consentVersionId' THEN PERFORM research_private.fail('consent_changed'); END IF;
  SELECT * INTO v FROM research_private.verification_tokens WHERE study_id=sid AND participant_id=p.id AND digest=COALESCE(p_payload->>'verificationDigest',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload->>'verificationToken','UTF8')),'hex')) FOR UPDATE;
  SELECT * INTO c FROM research_private.contacts WHERE study_id=sid AND participant_id=p.id FOR UPDATE;
  IF v.id IS NULL OR v.used_at IS NOT NULL OR v.expires_at<=CURRENT_TIMESTAMP OR v.destination_hash IS DISTINCT FROM c.destination_hash OR v.consent_version_id<>p.consent_version_id OR NOT c.pending THEN PERFORM research_private.fail('invalid'); END IF;
  UPDATE research_private.verification_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=v.id; UPDATE research_private.contacts SET pending=false WHERE study_id=sid AND participant_id=p.id;
  UPDATE research_private.participants SET verified=true,status='enrolled',updated_at=CURRENT_TIMESTAMP WHERE study_id=sid AND id=p.id RETURNING * INTO p;
  UPDATE research_private.outbox SET status='cancelled',lease_id=NULL,lease_until=NULL WHERE study_id=sid AND participant_id=p.id AND kind='verification' AND status IN ('queued','claimed','blocked');
  INSERT INTO research_private.outbox(study_id,participant_id,kind,intent_key,payload_ciphertext,contact_ciphertext,consent_version_id) VALUES(sid,p.id,'welcome','welcome',c.welcome_ciphertext,c.contact_ciphertext,p.consent_version_id) ON CONFLICT DO NOTHING; result:=pg_catalog.jsonb_build_object('participation',research_private.participation(p));
 WHEN 'participationGet' THEN
  SELECT * INTO f FROM research_private.form_versions WHERE study_id=sid AND id=(s.config->>'consentVersionId')::uuid;
  SELECT COALESCE(pg_catalog.jsonb_agg(research_private.form(x)),'[]'::jsonb) INTO list FROM research_private.form_versions x WHERE x.study_id=sid AND s.config->'instrumentVersionIds' ? x.id::text;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',x.id,'instrumentVersionId',x.instrument_version_id,'waveId',x.wave_id,'answers',x.answers,'versions',x.versions,'consentVersionId',x.consent_version_id,'createdAt',x.created_at)),'[]'::jsonb) INTO result FROM research_private.responses x WHERE x.study_id=sid AND x.participant_id=p.id;
  result:=pg_catalog.jsonb_build_object('participation',research_private.participation(p),'study',pg_catalog.jsonb_build_object('id',sid,'status',s.status,'title',s.config->>'title','description',s.config->>'description','population',s.config->>'population','expectations',s.config->>'expectations','schedule',s.config->'schedule','config',pg_catalog.jsonb_build_object('consentVersionId',s.config->'consentVersionId','dataCategories',s.config->'dataCategories','contactKinds',s.config->'contactKinds','startDate',s.config->'startDate','endDate',s.config->'endDate','schedule',s.config->'schedule')),'consent',research_private.form(f),'instruments',list,'responses',result);
 WHEN 'reconsent' THEN
  IF s.status<>'active' OR p.status IN ('withdrawn','erased') OR p_payload->>'consentVersionId'<>s.config->>'consentVersionId' OR p_payload#>>'{consents,participate}' IS DISTINCT FROM 'true' THEN PERFORM research_private.fail('consent_changed'); END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_each(p_payload->'consents') x WHERE x.key NOT IN ('participate','surveys','usage','historical','generated') OR pg_catalog.jsonb_typeof(x.value)<>'boolean' OR (x.key<>'participate' AND x.value='true'::jsonb AND NOT(s.config->'dataCategories' ? x.key))) THEN PERFORM research_private.fail('invalid'); END IF;
  UPDATE research_private.participants SET consent_version_id=(p_payload->>'consentVersionId')::uuid,consents=p_payload->'consents',preferences=p_payload->'preferences',updated_at=CURRENT_TIMESTAMP WHERE study_id=sid AND id=p.id RETURNING * INTO p;
  INSERT INTO research_private.consent_history(study_id,participant_id,consent_version_id,consents,action) VALUES(sid,p.id,p.consent_version_id,p.consents,'reconsent'); result:=pg_catalog.jsonb_build_object('participation',research_private.participation(p));
 WHEN 'preferencesSet' THEN
  IF pg_catalog.jsonb_typeof(p_payload->'preferences')<>'object' OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_each(p_payload->'preferences') x WHERE x.key NOT IN ('followup','feedback','update') OR pg_catalog.jsonb_typeof(x.value)<>'boolean') THEN PERFORM research_private.fail('invalid'); END IF;
  UPDATE research_private.participants SET preferences=p_payload->'preferences',updated_at=CURRENT_TIMESTAMP WHERE study_id=sid AND id=p.id RETURNING * INTO p; UPDATE research_private.outbox SET status='cancelled',lease_id=NULL,lease_until=NULL WHERE study_id=sid AND participant_id=p.id AND kind IN ('followup','feedback','update') AND p.preferences->>kind IS DISTINCT FROM 'true' AND status IN ('queued','claimed','blocked'); result:=pg_catalog.jsonb_build_object('participation',research_private.participation(p));
 WHEN 'emailChange' THEN
  IF s.status<>'active' OR p.status IN ('withdrawn','erased') OR p.consent_version_id::text<>s.config->>'consentVersionId' THEN PERFORM research_private.fail('conflict'); END IF;
  PERFORM research_private.verification(s,p,p_payload); SELECT * INTO p FROM research_private.participants WHERE study_id=sid AND id=p.id; result:=pg_catalog.jsonb_build_object('participation',research_private.participation(p),'verificationPending',true);
 WHEN 'withdraw' THEN
  UPDATE research_private.participants SET status='withdrawn',withdrawn_at=COALESCE(withdrawn_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE study_id=sid AND id=p.id RETURNING * INTO p;
  INSERT INTO research_private.consent_history(study_id,participant_id,consent_version_id,consents,action) VALUES(sid,p.id,p.consent_version_id,p.consents,'withdraw');
  UPDATE research_private.outbox SET status='cancelled',lease_id=NULL,lease_until=NULL WHERE study_id=sid AND participant_id=p.id AND status IN ('queued','claimed','blocked','unknown');
  result:=pg_catalog.jsonb_build_object('participation',research_private.participation(p)); IF s.config->>'withdrawalPolicy'='erase' THEN PERFORM research_private.erase(sid,p.id); result:=pg_catalog.jsonb_build_object('participation',research_private.participation(p)||'{"status":"erased","verified":false}'::jsonb); END IF;
 WHEN 'eraseMyData' THEN PERFORM research_private.erase(sid,p.id); result:='{ "erased": true }'::jsonb;
 WHEN 'surveySubmit' THEN
  PERFORM research_private.collectable(s,p,'surveys');
  SELECT * INTO f FROM research_private.form_versions WHERE study_id=sid AND id=(p_payload->>'instrumentVersionId')::uuid AND kind='instrument';
  IF f.id IS NULL OR NOT(s.config->'instrumentVersionIds' ? f.id::text) OR NOT EXISTS(SELECT 1 FROM research_private.form_publications z WHERE z.study_id=sid AND z.version_id=f.id) OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(s.config->'schedule') x WHERE x->>'waveId'=p_payload->>'waveId' AND x->>'instrumentVersionId'=f.id::text AND p.created_at+pg_catalog.make_interval(days=>(x->>'offsetDays')::integer)<=CURRENT_TIMESTAMP) THEN PERFORM research_private.fail('not_found'); END IF;
  PERFORM research_private.validate_answers(f.definition,p_payload->'answers');
  INSERT INTO research_private.responses(study_id,participant_id,instrument_version_id,consent_version_id,wave_id,answers,versions,config_revision) VALUES(sid,p.id,f.id,p.consent_version_id,p_payload->>'waveId',p_payload->'answers',research_private.versions(),s.revision) RETURNING id INTO version_id;
  result:=pg_catalog.jsonb_build_object('response',pg_catalog.jsonb_build_object('id',version_id,'instrumentVersionId',f.id,'waveId',p_payload->>'waveId','answers',p_payload->'answers','consentVersionId',p.consent_version_id,'versions',research_private.versions(),'configRevision',s.revision));
 WHEN 'sampleSubmit' THEN
  category:=p_payload->>'source'; IF category NOT IN ('historical','generated') THEN PERFORM research_private.fail('invalid'); END IF;
  PERFORM research_private.collectable(s,p,category); IF p_payload->>'consentVersionId'<>p.consent_version_id::text THEN PERFORM research_private.fail('consent_changed'); END IF;
  IF COALESCE(p_payload->>'text','')='' OR p_payload->>'ownAuthorship'<>'true' OR p_payload->>'minimized'<>'true' OR (category='generated' AND (pg_catalog.jsonb_typeof(p_payload->'versions')<>'object' OR p_payload->>'provenance'<>'verified-BE-GOOD')) THEN PERFORM research_private.fail('invalid'); END IF;
  list:=pg_catalog.jsonb_build_object('category',p_payload->'category','approximateDate',p_payload->'approximateDate','audience',p_payload->'audience','sourceType',p_payload->'sourceType','ownAuthorship',true,'minimized',true,'usedBeGood',category='generated','sourceConfidence',CASE WHEN category='generated' THEN 'verified-source' ELSE 'participant-declared' END,'sourceId',pg_catalog.gen_random_uuid());
  IF category='generated' THEN
   IF COALESCE(p_payload->>'sourceId','')='' OR p_payload->>'mode' NOT IN ('single','continuity') THEN PERFORM research_private.fail('invalid'); END IF;
   source_hash:=pg_catalog.encode(research_private.hmac(pg_catalog.convert_to(p_payload->>'sourceId','UTF8'),pg_catalog.convert_to(sid::text,'UTF8')),'hex');
   INSERT INTO research_private.source_mappings(study_id,participant_id,source_digest) VALUES(sid,p.id,source_hash) ON CONFLICT DO NOTHING;
   SELECT source_id INTO source FROM research_private.source_mappings WHERE study_id=sid AND participant_id=p.id AND source_digest=source_hash;
   list:=list||pg_catalog.jsonb_build_object('sourceId',source,'mode',p_payload->>'mode');
  END IF;
  IF category='historical' THEN INSERT INTO research_private.historical_samples(study_id,participant_id,consent_version_id,metadata,text_content,versions,config_revision) VALUES(sid,p.id,p.consent_version_id,list,p_payload->>'text',research_private.versions()||'{"tool":null,"engine":null,"prompt":null,"principles":null,"model":null}'::jsonb,s.revision) RETURNING id INTO version_id;
  ELSE INSERT INTO research_private.generated_samples(study_id,participant_id,consent_version_id,metadata,text_content,versions,config_revision) VALUES(sid,p.id,p.consent_version_id,list,p_payload->>'text',research_private.snapshot(p_payload->'versions'),s.revision) RETURNING id INTO version_id; END IF;
  result:=pg_catalog.jsonb_build_object('sample',pg_catalog.jsonb_build_object('id',version_id,'participantId',p.id,'metadata',list,'consentVersionId',p.consent_version_id));
 WHEN 'sampleGet' THEN
  SELECT x.* INTO r FROM (SELECT id,participant_id,text_content,metadata,versions,consent_version_id FROM research_private.historical_samples WHERE study_id=sid AND id=(p_payload->>'sampleId')::uuid UNION ALL SELECT id,participant_id,text_content,metadata,versions,consent_version_id FROM research_private.generated_samples WHERE study_id=sid AND id=(p_payload->>'sampleId')::uuid) x;
  IF NOT FOUND THEN PERFORM research_private.fail('not_found'); END IF;
  IF p.id IS NULL OR p.id<>r.participant_id THEN PERFORM research_private.require('view_document_content'); PERFORM research_private.audit(sid,'document_access',r.id); ELSIF p.status IN ('withdrawn','erased') THEN PERFORM research_private.fail('not_found'); END IF;
  result:=pg_catalog.jsonb_build_object('sample',pg_catalog.jsonb_build_object('id',r.id,'participantId',r.participant_id,'text',r.text_content,'metadata',r.metadata,'versions',r.versions,'consentVersionId',r.consent_version_id));
 ELSE PERFORM research_private.fail('invalid');
 END CASE;
 IF mutation THEN
  PERFORM research_private.audit(sid,p_action,CASE WHEN p_action IN ('memberSet','memberRemove') THEN target.id WHEN p_action IN ('versionSave','versionPublish') THEN f.id WHEN p_action='sampleSubmit' THEN version_id WHEN p.id IS NOT NULL THEN p.id ELSE NULL END,pg_catalog.jsonb_build_object('revision',s.revision,'status',s.status)||CASE WHEN p_action='memberSet' THEN pg_catalog.jsonb_build_object('role',target.role,'permissions',target.permissions,'delegablePermissions',target.delegable_permissions) WHEN p_action='memberRemove' THEN '{"permissions":[],"delegablePermissions":[]}'::jsonb ELSE '{}'::jsonb END);
  IF p_action NOT IN ('eraseMyData') AND NOT(p_action='withdraw' AND s.config->>'withdrawalPolicy'='erase') THEN INSERT INTO research_private.request_receipts(study_id,actor_ref,action,request_id,payload_hash,result) VALUES(sid,actor,p_action,request_id,payload_hash,result); END IF;
 END IF;
 RETURN result;
EXCEPTION WHEN SQLSTATE 'P0001' THEN
 RETURN pg_catalog.jsonb_build_object('error',SQLERRM,'status',CASE SQLERRM WHEN 'not_found' THEN 404 WHEN 'unauthorized' THEN 403 WHEN 'conflict' THEN 409 WHEN 'consent_changed' THEN 409 WHEN 'rate_limited' THEN 429 WHEN 'not_configured' THEN 503 ELSE 400 END);
 WHEN invalid_text_representation OR invalid_parameter_value OR check_violation OR not_null_violation OR foreign_key_violation OR datetime_field_overflow THEN RETURN '{"error":"invalid","status":400}'::jsonb;
 WHEN unique_violation THEN RETURN '{"error":"conflict","status":409}'::jsonb;
END $f$;


CREATE FUNCTION research_private.audit(sid uuid,act text,subject uuid DEFAULT NULL,detail jsonb DEFAULT '{}') RETURNS void LANGUAGE sql SET search_path='' AS $f$ INSERT INTO research_private.audit_events(study_id,actor_kind,actor_id,action,subject_id,detail) VALUES(sid,CASE WHEN pg_catalog.current_setting('research.owner',true)='true' THEN 'owner' WHEN pg_catalog.current_setting('research.internal',true)='true' THEN 'worker' ELSE 'personal' END,COALESCE((SELECT m.id FROM research_private.memberships m WHERE m.study_id=sid AND m.actor_ref=pg_catalog.current_setting('research.actor',true)),(SELECT p.id FROM research_private.participants p WHERE p.study_id=sid AND p.actor_ref=pg_catalog.current_setting('research.actor',true))),act,subject,detail) $f$;
CREATE FUNCTION research_private.form(v research_private.form_versions) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $f$ SELECT pg_catalog.jsonb_build_object('id',v.id,'kind',v.kind,'definition',v.definition,'published',EXISTS(SELECT 1 FROM research_private.form_publications p WHERE p.study_id=v.study_id AND p.version_id=v.id),'publishedAt',(SELECT p.published_at FROM research_private.form_publications p WHERE p.study_id=v.study_id AND p.version_id=v.id),'createdAt',v.created_at) $f$;
CREATE FUNCTION research_private.participation(v research_private.participants) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $f$ SELECT pg_catalog.jsonb_build_object('id',v.id,'studyId',v.study_id,'status',v.status,'verified',v.verified,'consentVersionId',v.consent_version_id,'consentedAt',(SELECT h.created_at FROM research_private.consent_history h WHERE h.study_id=v.study_id AND h.participant_id=v.id AND h.consent_version_id=v.consent_version_id AND h.action IN ('enroll','reconsent') ORDER BY h.created_at DESC LIMIT 1),'consents',v.consents,'preferences',v.preferences,'createdAt',v.created_at,'updatedAt',v.updated_at,'withdrawnAt',v.withdrawn_at) $f$;
CREATE FUNCTION research_private.stats(v research_private.studies) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $f$
 WITH due AS (SELECT p.id,w->>'waveId' AS wave_id,(w->>'instrumentVersionId')::uuid AS instrument_id FROM research_private.participants p CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(COALESCE(v.config->'schedule','[]')) w WHERE p.study_id=v.id AND p.status='enrolled' AND p.verified AND p.consent_version_id::text=v.config->>'consentVersionId' AND p.consents->>'surveys'='true' AND p.created_at+pg_catalog.make_interval(days=>(w->>'offsetDays')::integer)<=CURRENT_TIMESTAMP), counts AS (SELECT pg_catalog.count(*) AS expected,pg_catalog.count(*) FILTER(WHERE EXISTS(SELECT 1 FROM research_private.responses r WHERE r.study_id=v.id AND r.participant_id=d.id AND r.wave_id=d.wave_id AND r.instrument_version_id=d.instrument_id)) AS completed FROM due d)
 SELECT pg_catalog.jsonb_build_object('participants',(SELECT pg_catalog.count(*) FROM research_private.participants p WHERE p.study_id=v.id AND p.status<>'erased'),'responses',(SELECT pg_catalog.count(*) FROM research_private.responses r WHERE r.study_id=v.id),'expectedQuestionnaires',expected,'completedQuestionnaires',completed,'completionRate',CASE WHEN expected=0 THEN NULL ELSE pg_catalog.round(completed*100.0/expected,1) END,'pendingFollowups',(SELECT pg_catalog.count(*) FROM research_private.outbox m WHERE m.study_id=v.id AND m.kind='followup' AND m.status='queued' AND m.due_at<=CURRENT_TIMESTAMP)) FROM counts
 $f$;
CREATE FUNCTION research_private.study(v research_private.studies) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $f$ SELECT pg_catalog.jsonb_build_object('id',v.id,'revision',v.revision,'status',v.status,'config',v.config,'permissions',pg_catalog.current_setting('research.permissions',true)::jsonb,'delegablePermissions',COALESCE((SELECT pg_catalog.to_jsonb(m.delegable_permissions) FROM research_private.memberships m WHERE m.study_id=v.id AND m.actor_ref=pg_catalog.current_setting('research.actor',true)),'[]'::jsonb),'versions',research_private.versions(),'createdAt',v.created_at,'updatedAt',v.updated_at,'stats',CASE WHEN pg_catalog.current_setting('research.owner',true)='true' OR pg_catalog.current_setting('research.permissions',true)::jsonb ? 'view_aggregate_results' THEN research_private.stats(v) ELSE '{}'::jsonb END) $f$;
CREATE FUNCTION research_private.bump(sid uuid) RETURNS research_private.studies LANGUAGE plpgsql SET search_path='' AS $f$ DECLARE s research_private.studies; BEGIN UPDATE research_private.studies SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=sid RETURNING * INTO s; INSERT INTO research_private.study_versions(study_id,revision,status,config,versions) VALUES(s.id,s.revision,s.status,s.config,research_private.versions()); RETURN s; END $f$;

CREATE FUNCTION research_private.auth(raw_token text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE parts text[]; secret text; want text; body jsonb; rec jsonb; institutions jsonb; settings jsonb; institution jsonb; grace integer; actor text;
BEGIN
 IF raw_token IS NULL OR pg_catalog.length(raw_token)>12000 THEN PERFORM research_private.fail('unauthorized'); END IF;
 parts:=pg_catalog.string_to_array(raw_token,'.'); IF pg_catalog.array_length(parts,1)<>2 THEN PERFORM research_private.fail('unauthorized'); END IF;
 SELECT value->>'secret' INTO secret FROM public.access_settings WHERE key='token-secret' FOR SHARE;
 IF secret IS NULL THEN PERFORM research_private.fail('unauthorized'); END IF;
 want:=pg_catalog.translate(pg_catalog.rtrim(pg_catalog.encode(research_private.hmac(pg_catalog.convert_to(parts[1],'UTF8'),pg_catalog.convert_to(secret,'UTF8')),'base64'),'='),'+/','-_');
 IF parts[2]<>want THEN PERFORM research_private.fail('unauthorized'); END IF;
 body:=pg_catalog.convert_from(pg_catalog.decode(pg_catalog.translate(parts[1],'-_','+/')||pg_catalog.repeat('=',(4-pg_catalog.length(parts[1])%4)%4),'base64'),'UTF8')::jsonb;
 IF pg_catalog.jsonb_typeof(body->'exp') IS DISTINCT FROM 'number' OR (body->>'exp')::numeric<=pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())*1000 THEN PERFORM research_private.fail('unauthorized'); END IF;
 IF body->>'k'='sys' THEN
  -- Match access.mjs: rotating the stored password invalidates older sessions.
  -- Hold the password row until this research transaction finishes.
  SELECT value INTO rec FROM public.access_settings WHERE key='pw-sys' FOR SHARE;
  IF rec IS NULL OR pg_catalog.jsonb_typeof(body->'authVersion') IS DISTINCT FROM 'string' OR body->>'authVersion'<>pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(COALESCE(rec->>'salt','undefined')||':'||COALESCE(rec->>'hash','undefined'),'UTF8')),'hex') THEN PERFORM research_private.fail('unauthorized'); END IF;
  RETURN body||'{"actor":"sys","owner":true}'::jsonb;
 END IF;
 IF body->>'k'='research_worker' AND body->>'purpose'='research' AND (body->>'exp')::numeric<=pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())*1000+600000 THEN RETURN body||'{"actor":"research-worker","internal":true}'::jsonb; END IF;

 IF NOT(body ?& ARRAY['k','kind','c','inst']) OR body->>'k'<>'code' OR body->>'kind' NOT IN ('staff','instadmin') OR body->>'c'='LEGACY' OR body->>'c'!~'^[A-Z0-9]+$' THEN PERFORM research_private.fail('unauthorized'); END IF;
 actor:='code:'||(body->>'c');
 SELECT value INTO rec FROM public.access_settings WHERE key=actor FOR SHARE;
 SELECT value INTO institutions FROM public.access_settings WHERE key='institutions' FOR SHARE;
 SELECT value INTO settings FROM public.access_settings WHERE key='settings' FOR SHARE;
 institutions:=COALESCE(institutions,'[{"name":"מכללה לחינוך","active":true},{"name":"מכללה אקדמית ב׳","active":true},{"name":"מרכז סימולציה אזורי","active":true},{"name":"מוסד YS","active":true}]'::jsonb);
 SELECT x INTO institution FROM pg_catalog.jsonb_array_elements(institutions) x WHERE x->>'name'=body->>'inst';
 grace:=COALESCE((settings->>'graceDays')::integer,14);
 IF rec IS NULL OR rec->>'kind'<>body->>'kind' OR rec->>'inst'<>body->>'inst' OR COALESCE((rec->>'revoked')::boolean,false) OR institution IS NULL OR institution->>'active'='false' OR (rec->>'expiresAt' IS NOT NULL AND (rec->>'expiresAt')::date<(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::date) OR (institution->>'subEnd' IS NOT NULL AND (institution->>'subEnd')::date+grace<(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::date) THEN PERFORM research_private.fail('unauthorized'); END IF;
 RETURN body||pg_catalog.jsonb_build_object('actor',actor,'label',COALESCE(rec->>'label',''));
EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value OR datetime_field_overflow THEN PERFORM research_private.fail('unauthorized'); RETURN NULL;
END $f$;

CREATE FUNCTION research_private.validate_form(kind text,d jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE item jsonb; ids text[]:='{}'; k text;
BEGIN
 IF pg_catalog.jsonb_typeof(d) IS DISTINCT FROM 'object' OR COALESCE(d->>'title','')='' THEN PERFORM research_private.fail('invalid'); END IF;
 IF kind='consent' THEN
  IF NOT(d ?& ARRAY['title','text','categories','contactKinds','retentionDays','withdrawalPolicy']) THEN PERFORM research_private.fail('invalid'); END IF;
  IF COALESCE(d->>'text','')='' OR pg_catalog.jsonb_typeof(d->'categories')<>'array' OR pg_catalog.jsonb_typeof(d->'contactKinds')<>'array' OR (d->>'retentionDays')::integer<1 OR d->>'withdrawalPolicy' NOT IN ('erase','retain-consented') THEN PERFORM research_private.fail('invalid'); END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements_text(d->'categories') x WHERE x NOT IN ('surveys','usage','historical','generated','identities','contacts')) OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements_text(d->'contactKinds') x WHERE x NOT IN ('followup','feedback','update')) THEN PERFORM research_private.fail('invalid'); END IF;
 ELSIF kind='instrument' THEN
  IF NOT(d ?& ARRAY['title','construct','validationStatus','items']) THEN PERFORM research_private.fail('invalid'); END IF;
  IF d->>'validationStatus' NOT IN ('under-development','study-approved') OR pg_catalog.jsonb_typeof(d->'items')<>'array' OR pg_catalog.jsonb_array_length(d->'items')>200 THEN PERFORM research_private.fail('invalid'); END IF;
  FOR item IN SELECT x FROM pg_catalog.jsonb_array_elements(d->'items') x LOOP
   IF NOT(item ?& ARRAY['id','type','label','required']) THEN PERFORM research_private.fail('invalid'); END IF;
   IF pg_catalog.jsonb_typeof(item)<>'object' OR COALESCE(item->>'id','')='' OR item->>'id'=ANY(ids) OR COALESCE(item->>'label','')='' OR item->>'type' NOT IN ('likert','number','text','choice','multiple','date') OR pg_catalog.jsonb_typeof(item->'required')<>'boolean' THEN PERFORM research_private.fail('invalid'); END IF;
   FOR k IN SELECT pg_catalog.jsonb_object_keys(item) LOOP IF k NOT IN ('id','type','label','required','options','min','max') THEN PERFORM research_private.fail('invalid'); END IF; END LOOP;
   ids:=ids||ARRAY[item->>'id'];
   IF item->>'type' IN ('choice','multiple') AND (pg_catalog.jsonb_typeof(item->'options')<>'array' OR pg_catalog.jsonb_array_length(item->'options')<1 OR pg_catalog.jsonb_array_length(item->'options')>100 OR (SELECT pg_catalog.count(DISTINCT x) FROM pg_catalog.jsonb_array_elements_text(item->'options') x)<>pg_catalog.jsonb_array_length(item->'options')) THEN PERFORM research_private.fail('invalid'); END IF;
   IF item ? 'min' AND item ? 'max' AND (item->>'min')::numeric>(item->>'max')::numeric THEN PERFORM research_private.fail('invalid'); END IF;
  END LOOP;
 ELSE PERFORM research_private.fail('invalid'); END IF;
END $f$;

CREATE FUNCTION research_private.validate_activation(s research_private.studies) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE c jsonb; wave jsonb; ids text[]:='{}';
BEGIN
 IF NOT(s.config ?& ARRAY['title','population','researchQuestions','approvals','startDate','endDate','retentionDays','withdrawalPolicy','consentVersionId','instrumentVersionIds','dataCategories','exportCategories','contactKinds','schedule']) THEN PERFORM research_private.fail('invalid'); END IF;
 IF COALESCE(s.config->>'title','')='' OR COALESCE(s.config->>'population','')='' OR pg_catalog.jsonb_typeof(s.config->'researchQuestions')<>'array' OR pg_catalog.jsonb_array_length(s.config->'researchQuestions')<1 OR s.config#>>'{approvals,status}'<>'approved' OR COALESCE(s.config#>>'{approvals,reference}','')='' OR COALESCE(s.config#>>'{approvals,documentation}','')='' OR (s.config->>'startDate')::date>(s.config->>'endDate')::date OR (s.config->>'retentionDays')::integer<1 OR s.config->>'withdrawalPolicy' NOT IN ('erase','retain-consented') THEN PERFORM research_private.fail('invalid'); END IF;
 IF s.config->>'startDate' IS NULL OR s.config->>'endDate' IS NULL OR pg_catalog.jsonb_typeof(s.config->'dataCategories')<>'array' OR pg_catalog.jsonb_typeof(s.config->'exportCategories')<>'array' OR NOT ((s.config->'dataCategories') @> (s.config->'exportCategories')) OR pg_catalog.jsonb_typeof(s.config->'contactKinds')<>'array' OR pg_catalog.jsonb_typeof(s.config->'instrumentVersionIds')<>'array' OR pg_catalog.jsonb_typeof(s.config->'schedule')<>'array' THEN PERFORM research_private.fail('invalid'); END IF;
 SELECT f.definition INTO c FROM research_private.form_versions f JOIN research_private.form_publications p ON p.study_id=f.study_id AND p.version_id=f.id WHERE f.study_id=s.id AND f.id=(s.config->>'consentVersionId')::uuid AND f.kind='consent';
 IF c IS NULL OR NOT((c->'categories') @> (s.config->'dataCategories') AND (s.config->'dataCategories') @> (c->'categories')) OR NOT((c->'contactKinds') @> (s.config->'contactKinds') AND (s.config->'contactKinds') @> (c->'contactKinds')) OR c->>'retentionDays'<>s.config->>'retentionDays' OR c->>'withdrawalPolicy'<>s.config->>'withdrawalPolicy' THEN PERFORM research_private.fail('invalid'); END IF;
 FOR wave IN SELECT x FROM pg_catalog.jsonb_array_elements(s.config->'schedule') x LOOP
  IF COALESCE(wave->>'waveId','')='' OR wave->>'waveId'=ANY(ids) OR (wave->>'offsetDays')::integer<0 OR pg_catalog.jsonb_typeof(wave->'reminderDays')<>'array' OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements_text(wave->'reminderDays') x WHERE x::integer<=0) OR NOT(s.config->'instrumentVersionIds' ? (wave->>'instrumentVersionId')) OR NOT EXISTS(SELECT 1 FROM research_private.form_versions f JOIN research_private.form_publications p ON p.study_id=f.study_id AND p.version_id=f.id WHERE f.study_id=s.id AND f.id=(wave->>'instrumentVersionId')::uuid AND f.kind='instrument' AND pg_catalog.jsonb_array_length(f.definition->'items')>0) THEN PERFORM research_private.fail('invalid'); END IF;
  ids:=ids||ARRAY[wave->>'waveId'];
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements_text(s.config->'instrumentVersionIds') id WHERE NOT EXISTS(SELECT 1 FROM research_private.form_versions f JOIN research_private.form_publications p ON p.study_id=f.study_id AND p.version_id=f.id WHERE f.study_id=s.id AND f.id=id::uuid AND f.kind='instrument')) THEN PERFORM research_private.fail('invalid'); END IF;
END $f$;

CREATE FUNCTION research_private.collectable(s research_private.studies,p research_private.participants,category text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$ BEGIN
 IF s.status<>'active' OR (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::date NOT BETWEEN (s.config->>'startDate')::date AND (s.config->>'endDate')::date OR p.status<>'enrolled' OR NOT p.verified OR p.consents->>'participate' IS DISTINCT FROM 'true' THEN PERFORM research_private.fail('conflict'); END IF;
 IF p.consent_version_id::text<>s.config->>'consentVersionId' THEN PERFORM research_private.fail('consent_changed'); END IF;
 IF NOT(s.config->'dataCategories' ? category) OR p.consents->>category IS DISTINCT FROM 'true' THEN PERFORM research_private.fail('unauthorized'); END IF;
END $f$;

CREATE FUNCTION research_private.validate_answers(def jsonb,answers jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE item jsonb; value jsonb; k text;
BEGIN
 IF pg_catalog.jsonb_typeof(answers)<>'object' THEN PERFORM research_private.fail('invalid'); END IF;
 FOR k IN SELECT pg_catalog.jsonb_object_keys(answers) LOOP IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(def->'items') x WHERE x->>'id'=k) THEN PERFORM research_private.fail('invalid'); END IF; END LOOP;
 FOR item IN SELECT x FROM pg_catalog.jsonb_array_elements(def->'items') x LOOP
  value:=answers->(item->>'id');
  IF value IS NULL OR value='null'::jsonb THEN IF item->>'required'='true' THEN PERFORM research_private.fail('invalid'); END IF; CONTINUE; END IF;
  IF item->>'type' IN ('likert','number') THEN
   IF pg_catalog.jsonb_typeof(value)<>'number' OR (item ? 'min' AND value::numeric<(item->>'min')::numeric) OR (item ? 'max' AND value::numeric>(item->>'max')::numeric) THEN PERFORM research_private.fail('invalid'); END IF;
  ELSIF item->>'type'='multiple' THEN
   IF pg_catalog.jsonb_typeof(value)<>'array' OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(value) x WHERE NOT(item->'options' @> pg_catalog.jsonb_build_array(x))) OR (SELECT pg_catalog.count(DISTINCT x) FROM pg_catalog.jsonb_array_elements(value) x)<>pg_catalog.jsonb_array_length(value) THEN PERFORM research_private.fail('invalid'); END IF;
  ELSE
   IF pg_catalog.jsonb_typeof(value)<>'string' OR (item->>'type'='choice' AND NOT(item->'options' @> pg_catalog.jsonb_build_array(value))) OR (item->>'type'='date' AND (value#>>'{}')!~'^\d{4}-\d{2}-\d{2}$') THEN PERFORM research_private.fail('invalid'); END IF;
   IF item->>'type'='date' THEN PERFORM (value#>>'{}')::date; END IF;
  END IF;
 END LOOP;
END $f$;

CREATE FUNCTION research_private.erase(sid uuid,pid uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE actor text; BEGIN
 PERFORM pg_catalog.set_config('research.erasing','true',true);
 SELECT actor_ref INTO actor FROM research_private.participants WHERE study_id=sid AND id=pid FOR UPDATE;
 DELETE FROM research_private.responses WHERE study_id=sid AND participant_id=pid;
 DELETE FROM research_private.historical_samples WHERE study_id=sid AND participant_id=pid;
 DELETE FROM research_private.generated_samples WHERE study_id=sid AND participant_id=pid;
 DELETE FROM research_private.usage_events WHERE study_id=sid AND participant_id=pid;
 DELETE FROM research_private.source_mappings WHERE study_id=sid AND participant_id=pid;
 DELETE FROM research_private.outbox WHERE study_id=sid AND participant_id=pid;
 DELETE FROM research_private.verification_tokens WHERE study_id=sid AND participant_id=pid;
 -- Keep the one-hour content-free delivery quota, including erase/re-enroll attempts.
 DELETE FROM research_private.verification_attempts WHERE study_id=sid AND participant_id=pid AND created_at<CURRENT_TIMESTAMP-INTERVAL '1 hour';
 DELETE FROM research_private.contacts WHERE study_id=sid AND participant_id=pid;
 DELETE FROM research_private.request_receipts WHERE study_id=sid AND actor_ref=actor;
 UPDATE research_private.participants SET actor_ref=NULL,label='',status='erased',verified=false,preferences='{}',updated_at=CURRENT_TIMESTAMP WHERE study_id=sid AND id=pid;
 PERFORM research_private.audit(sid,'erasure',pid);
 PERFORM pg_catalog.set_config('research.erasing','false',true);
END $f$;

CREATE FUNCTION research_private.dataset(sid uuid,category text,include_content boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE rows jsonb; manifest jsonb; BEGIN
 IF category='aggregate' THEN
  PERFORM research_private.require('view_aggregate_results');
  SELECT COALESCE(pg_catalog.jsonb_agg(q),'[]'::jsonb) INTO rows FROM (SELECT r.instrument_version_id AS "instrumentVersionId",a.key AS "itemId",pg_catalog.count(*) AS count,pg_catalog.count(*) FILTER(WHERE pg_catalog.jsonb_typeof(a.value)='number') AS "numericCount",pg_catalog.avg(CASE WHEN pg_catalog.jsonb_typeof(a.value)='number' THEN a.value::numeric END) AS mean FROM research_private.responses r CROSS JOIN LATERAL pg_catalog.jsonb_each(r.answers) a WHERE r.study_id=sid GROUP BY r.instrument_version_id,a.key) q;
 ELSIF category IN ('surveys','usage','historical','generated') THEN
  PERFORM research_private.require('view_pseudonymized_data');
  IF include_content THEN PERFORM research_private.require('view_document_content'); END IF;
  IF category='surveys' THEN SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.id,'participantId',r.participant_id,'instrumentVersionId',r.instrument_version_id,'consentVersionId',r.consent_version_id,'waveId',r.wave_id,'answers',r.answers,'versions',r.versions,'configRevision',r.config_revision,'createdAt',r.created_at)),'[]'::jsonb) INTO rows FROM research_private.responses r WHERE r.study_id=sid;
  ELSIF category='usage' THEN SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',e.id,'participantId',e.participant_id,'sourceId',e.source_id,'operation',e.operation,'mode',e.mode,'metadata',e.metadata,'versions',e.versions,'consentVersionId',e.consent_version_id,'configRevision',e.config_revision,'createdAt',e.created_at)),'[]'::jsonb) INTO rows FROM research_private.usage_events e WHERE e.study_id=sid;
  ELSIF category='historical' THEN SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',e.id,'participantId',e.participant_id,'metadata',e.metadata,'versions',e.versions,'consentVersionId',e.consent_version_id,'configRevision',e.config_revision,'createdAt',e.created_at)||CASE WHEN include_content THEN pg_catalog.jsonb_build_object('text',e.text_content) ELSE '{}'::jsonb END),'[]'::jsonb) INTO rows FROM research_private.historical_samples e WHERE e.study_id=sid;
  ELSE SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',e.id,'participantId',e.participant_id,'metadata',e.metadata,'versions',e.versions,'consentVersionId',e.consent_version_id,'configRevision',e.config_revision,'createdAt',e.created_at)||CASE WHEN include_content THEN pg_catalog.jsonb_build_object('text',e.text_content) ELSE '{}'::jsonb END),'[]'::jsonb) INTO rows FROM research_private.generated_samples e WHERE e.study_id=sid; END IF;
 ELSIF category IN ('identities','contacts') THEN
  PERFORM research_private.require('view_identifiable_data');
  IF category='contacts' THEN PERFORM research_private.require('contact_participants'); END IF;
  IF category='identities' THEN SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('participantId',p.id,'label',p.label)),'[]'::jsonb) INTO rows FROM research_private.participants p WHERE p.study_id=sid AND p.status<>'erased';
  ELSE SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('participantId',c.participant_id,'contactCiphertext',c.contact_ciphertext)),'[]'::jsonb) INTO rows FROM research_private.contacts c WHERE c.study_id=sid AND NOT c.pending; END IF;
  PERFORM research_private.audit(sid,'identity_access',NULL,pg_catalog.jsonb_build_object('category',category));
 ELSE PERFORM research_private.fail('invalid'); END IF;
 SELECT pg_catalog.jsonb_build_object('system',research_private.versions(),'studyConfigurations',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('revision',v.revision,'config',v.config,'status',v.status,'versions',v.versions,'createdAt',v.created_at)) FROM research_private.study_versions v WHERE v.study_id=sid),'[]'::jsonb),'forms',COALESCE((SELECT pg_catalog.jsonb_agg(research_private.form(f)) FROM research_private.form_versions f WHERE f.study_id=sid),'[]'::jsonb)) INTO manifest;
 RETURN pg_catalog.jsonb_build_object('category',category,'rows',rows,'dictionary',pg_catalog.jsonb_build_object('participantId','Random identifier local to this study; does not imply anonymous free text','sourceId','Random source identifier local to this study','versions','Recorded application, tool, engine, prompt, principles, model, schema and metrics versions; unavailable model is null','mean','Descriptive numeric item mean, not a validated psychological score','metadata','counts.sessions: first successful AI writing operation in a process; counts.drafts: AI draft outputs; counts.revisions: changed manual draft or AI revision with a selected target; counts.rounds: distinct documented received inputs/extractions, sent snapshots do not add rounds; conversion retains evidence with zero counts; durationMs is observed elapsed server timing, never a psychological measure; no raw professional instructions/history','configRevision','Immutable configuration revision at collection','createdAt','Server timestamp'),'versions',manifest);
END $f$;

ALTER FUNCTION research_private.dispatch(text,text,jsonb) OWNER TO research_worker;
CREATE FUNCTION research_private.live_individual(code text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE rec jsonb; institutions jsonb; settings jsonb; institution jsonb; BEGIN
 SELECT value INTO rec FROM public.access_settings WHERE key='code:'||code FOR SHARE;
 SELECT value INTO institutions FROM public.access_settings WHERE key='institutions' FOR SHARE;
 SELECT value INTO settings FROM public.access_settings WHERE key='settings' FOR SHARE;
 institutions:=COALESCE(institutions,'[{"name":"מכללה לחינוך","active":true},{"name":"מכללה אקדמית ב׳","active":true},{"name":"מרכז סימולציה אזורי","active":true},{"name":"מוסד YS","active":true}]'::jsonb);
 SELECT x INTO institution FROM pg_catalog.jsonb_array_elements(institutions) x WHERE x->>'name'=rec->>'inst';
 IF rec IS NULL OR rec->>'kind' NOT IN ('staff','instadmin') OR COALESCE((rec->>'revoked')::boolean,false) OR institution IS NULL OR institution->>'active'='false' OR (rec->>'expiresAt' IS NOT NULL AND (rec->>'expiresAt')::date<(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::date) OR (institution->>'subEnd' IS NOT NULL AND (institution->>'subEnd')::date+COALESCE((settings->>'graceDays')::integer,14)<(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jerusalem')::date) THEN PERFORM research_private.fail('invalid'); END IF;
 RETURN rec;
END $f$;
CREATE FUNCTION public.research_rpc(p_token text,p_action text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$ DECLARE result jsonb; BEGIN
 result:=research_private.dispatch(p_token,p_action,p_payload);
 PERFORM pg_catalog.set_config('research.actor','',true); PERFORM pg_catalog.set_config('research.owner','false',true); PERFORM pg_catalog.set_config('research.internal','false',true); PERFORM pg_catalog.set_config('research.study','',true); PERFORM pg_catalog.set_config('research.invite','',true); PERFORM pg_catalog.set_config('research.permissions','[]',true); PERFORM pg_catalog.set_config('research.erasing','false',true);
 RETURN result;
END $f$;
REVOKE ALL ON FUNCTION public.research_rpc(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.research_rpc(text,text,jsonb) TO service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_private FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA research_private TO research_worker;
GRANT EXECUTE ON FUNCTION research_private.dispatch(text,text,jsonb) TO service_role;
COMMIT;
