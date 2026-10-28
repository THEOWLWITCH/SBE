BEGIN;
ALTER TABLE research_private.partnership_signings ADD COLUMN provider text NOT NULL DEFAULT 'docusign' CHECK(provider IN ('docusign','signwell'));
CREATE TABLE research_private.signing_intents(
 id uuid PRIMARY KEY,study_id uuid NOT NULL,partner_id uuid NOT NULL,record_id uuid NOT NULL,version_id uuid NOT NULL,
 provider text NOT NULL CHECK(provider='signwell'),provider_version text NOT NULL,document_hash text NOT NULL,
 provider_document_hash text NOT NULL CHECK(provider_document_hash~'^[a-f0-9]{64}$'),authority_policy_hash text NOT NULL CHECK(authority_policy_hash~'^[a-f0-9]{64}$'),parties_hash text NOT NULL,
 processing_policy_id uuid NOT NULL REFERENCES research_private.processing_policies(id),provider_state_ciphertext jsonb NOT NULL,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','creating','creation_uncertain','created','linked','sending','send_uncertain','sent')),
 provider_session_id text,signing_id uuid REFERENCES research_private.partnership_signings(id),expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(version_id,provider),UNIQUE(provider,provider_session_id),FOREIGN KEY(study_id,partner_id,record_id,version_id) REFERENCES research_private.partnership_versions(study_id,partner_id,record_id,id));
CREATE TABLE research_private.signing_intent_events(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),intent_id uuid NOT NULL REFERENCES research_private.signing_intents(id),state text NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE research_private.signing_intents OWNER TO research_table_owner;
ALTER TABLE research_private.signing_intent_events OWNER TO research_table_owner;
ALTER TABLE research_private.signing_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_private.signing_intents FORCE ROW LEVEL SECURITY;
ALTER TABLE research_private.signing_intent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_private.signing_intent_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON research_private.signing_intents,research_private.signing_intent_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON research_private.signing_intents TO research_worker;
GRANT SELECT,INSERT ON research_private.signing_intent_events TO research_worker;
CREATE POLICY signing_private ON research_private.signing_intents TO research_worker USING(pg_catalog.current_setting('research.signing',true)='true') WITH CHECK(pg_catalog.current_setting('research.signing',true)='true');
CREATE POLICY signing_private ON research_private.signing_intent_events TO research_worker USING(pg_catalog.current_setting('research.signing',true)='true') WITH CHECK(pg_catalog.current_setting('research.signing',true)='true');
CREATE TRIGGER signing_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON research_private.signing_intent_events FOR EACH STATEMENT EXECUTE FUNCTION research_private.immutable();

CREATE OR REPLACE FUNCTION research_private.partnership_signing(v research_private.partnership_signings) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $f$
 SELECT CASE WHEN v.id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object('id',v.id,'recordId',v.record_id,'versionId',v.version_id,'documentHash',v.document_hash,'state',CASE WHEN v.expires_at<=CURRENT_TIMESTAMP AND v.state<>'completed' THEN 'expired' ELSE v.state END,'provider',v.provider,'configured',true,'embeddedUrl',NULL,'expiresAt',v.expires_at,'completedAt',v.completed_at) END $f$;
CREATE FUNCTION research_private.signing_intent_json(i research_private.signing_intents) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_build_object('id',i.id,'studyId',i.study_id,'partnerId',i.partner_id,'recordId',i.record_id,'versionId',i.version_id,'provider',i.provider,'providerVersion',i.provider_version,'documentHash',i.document_hash,'providerDocumentHash',i.provider_document_hash,'authorityPolicyHash',i.authority_policy_hash,'state',i.state,'providerSessionId',i.provider_session_id,'signingId',i.signing_id,'expiresAt',i.expires_at,'providerStateCiphertext',i.provider_state_ciphertext) $f$;
CREATE FUNCTION research_private.signing_parties_hash(sid uuid,pid uuid,vid uuid) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $f$
 SELECT research_private.partnership_hash(pg_catalog.jsonb_build_object('owner',pg_catalog.jsonb_build_object('name',v.data->>'ownerSignatory','email',v.data->>'ownerEmail','authority',v.data->>'ownerAuthority'),'partner',pg_catalog.jsonb_build_object('id',p.id,'name',v.data->>'partnerSignatory','email',p.profile->>'email','authority',v.data->>'partnerAuthority'))) FROM research_private.partnership_versions v JOIN research_private.partnership_partners p ON p.id=pid WHERE v.id=vid AND v.study_id=sid AND v.partner_id=pid $f$;
-- The caller is reauthenticated after processing_authorized resets all GUCs.
CREATE FUNCTION research_private.signing_intent_authorize(raw_token text,i research_private.signing_intents,owner_required boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE p research_private.processing_policies;BEGIN
 PERFORM research_private.guided_auth(raw_token,i.study_id,i.partner_id,owner_required);
 IF NOT research_private.processing_authorized(raw_token,i.study_id,i.partner_id,'pre_signing_document',i.provider,i.provider_version,'["agreement_document","personal","confidential"]') THEN PERFORM research_private.fail('not_configured');END IF;
 PERFORM research_private.guided_auth(raw_token,i.study_id,i.partner_id,owner_required);PERFORM pg_catalog.set_config('research.owner','true',true);
 SELECT * INTO p FROM research_private.processing_policies x WHERE x.study_id=i.study_id AND x.partner_id=i.partner_id ORDER BY revision DESC LIMIT 1;
 IF p.id IS DISTINCT FROM i.processing_policy_id OR i.parties_hash IS DISTINCT FROM research_private.signing_parties_hash(i.study_id,i.partner_id,i.version_id) THEN PERFORM research_private.fail('conflict');END IF;
 PERFORM pg_catalog.set_config('research.signing','true',true);
END $f$;

ALTER FUNCTION research_private.partnership_dispatch(text,text,jsonb) RENAME TO partnership_dispatch_before_signing_intents;
CREATE FUNCTION research_private.partnership_dispatch(p_token text,p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
#variable_conflict use_variable
DECLARE i research_private.signing_intents;p research_private.processing_policies;r research_private.partnership_records;sg research_private.partnership_signings;a jsonb;result jsonb;preflight jsonb;claimed boolean:=false;next_state text;sid uuid;pid uuid;BEGIN
 IF p_action NOT IN ('signingIntentReserve','signingIntentGet','signingIntentCreateClaim','signingIntentAttach','signingIntentLink','signingIntentSendClaim','signingIntentSent','signingTransferAuthorize','signingStateUpdate') THEN RETURN research_private.partnership_dispatch_before_signing_intents(p_token,p_action,p_payload);END IF;
 PERFORM research_private.intake_reset();
 IF pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN PERFORM research_private.fail('invalid');END IF;
 IF p_action='signingIntentReserve' THEN
  sid:=(p_payload->>'studyId')::uuid;pid:=(p_payload->>'partnerId')::uuid;
  a:=research_private.guided_auth(p_token,sid,pid,true);
  preflight:=research_private.partnership_dispatch_before_signing_intents(p_token,'signingStart',p_payload-ARRAY['provider','providerVersion','providerDocumentHash','authorityPolicyHash','expiresAt','providerStateCiphertext']);IF preflight ? 'error' THEN PERFORM research_private.fail(preflight->>'error');END IF;
  -- A legacy preflight receipt is not a current-head authorization. Recheck
  -- the exact frozen candidate even when that earlier request was replayed.
  PERFORM research_private.guided_auth(p_token,sid,pid,true);
  SELECT * INTO r FROM research_private.partnership_records x WHERE x.id=(p_payload->>'recordId')::uuid AND x.study_id=sid AND x.partner_id=pid FOR UPDATE;
  IF r.id IS NULL OR r.kind<>'agreement' OR r.status<>'approved' OR r.head_version_id IS DISTINCT FROM (p_payload->>'versionId')::uuid OR r.approved_version_id IS DISTINCT FROM r.head_version_id OR r.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer OR NOT EXISTS(SELECT 1 FROM research_private.partnership_versions v WHERE v.id=r.head_version_id AND v.content_hash=p_payload->>'documentHash') OR (SELECT pg_catalog.count(*) FROM research_private.partnership_approvals a WHERE a.record_id=r.id AND a.version_id=r.head_version_id AND a.document_hash=p_payload->>'documentHash')<>2 THEN PERFORM research_private.fail('conflict');END IF;
  IF p_payload->>'provider' IS DISTINCT FROM 'signwell' OR pg_catalog.length(COALESCE(p_payload->>'providerVersion','')) NOT BETWEEN 1 AND 200 OR COALESCE(p_payload->>'providerDocumentHash','')!~'^[a-f0-9]{64}$' OR COALESCE(p_payload->>'authorityPolicyHash','')!~'^[a-f0-9]{64}$' OR NOT COALESCE(research_private.partnership_cipher(p_payload->'providerStateCiphertext'),false) OR p_payload->>'expiresAt' IS NULL OR (p_payload->>'expiresAt')::timestamptz<=CURRENT_TIMESTAMP OR p_payload->>'requestId' IS NULL THEN PERFORM research_private.fail('invalid');END IF;
  IF NOT research_private.processing_authorized(p_token,sid,pid,'pre_signing_document','signwell',p_payload->>'providerVersion','["agreement_document","personal","confidential"]') THEN PERFORM research_private.fail('not_configured');END IF;
  PERFORM research_private.guided_auth(p_token,sid,pid,true);PERFORM pg_catalog.set_config('research.owner','true',true);PERFORM pg_catalog.set_config('research.signing','true',true);
  SELECT * INTO p FROM research_private.processing_policies x WHERE x.study_id=sid AND x.partner_id=pid ORDER BY revision DESC LIMIT 1;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signing-intent:'||(p_payload->>'versionId'),0));
  SELECT * INTO i FROM research_private.signing_intents x WHERE x.version_id=(p_payload->>'versionId')::uuid AND x.provider='signwell' FOR UPDATE;
  IF i.id IS NOT NULL THEN
   IF i.study_id IS DISTINCT FROM sid OR i.partner_id IS DISTINCT FROM pid OR i.record_id IS DISTINCT FROM (p_payload->>'recordId')::uuid OR i.document_hash IS DISTINCT FROM p_payload->>'documentHash' OR i.provider_document_hash IS DISTINCT FROM p_payload->>'providerDocumentHash' OR i.authority_policy_hash IS DISTINCT FROM p_payload->>'authorityPolicyHash' OR i.provider_version IS DISTINCT FROM p_payload->>'providerVersion' OR i.processing_policy_id IS DISTINCT FROM p.id OR i.parties_hash IS DISTINCT FROM research_private.signing_parties_hash(sid,pid,(p_payload->>'versionId')::uuid) THEN PERFORM research_private.fail('conflict');END IF;
  ELSE
   IF research_private.partnership_hash(preflight->'parties') IS DISTINCT FROM research_private.signing_parties_hash(sid,pid,(p_payload->>'versionId')::uuid) THEN PERFORM research_private.fail('conflict');END IF;
   INSERT INTO research_private.signing_intents(id,study_id,partner_id,record_id,version_id,provider,provider_version,document_hash,provider_document_hash,authority_policy_hash,parties_hash,processing_policy_id,provider_state_ciphertext,expires_at) VALUES((p_payload->>'requestId')::uuid,sid,pid,(p_payload->>'recordId')::uuid,(p_payload->>'versionId')::uuid,'signwell',p_payload->>'providerVersion',p_payload->>'documentHash',p_payload->>'providerDocumentHash',p_payload->>'authorityPolicyHash',research_private.signing_parties_hash(sid,pid,(p_payload->>'versionId')::uuid),p.id,p_payload->'providerStateCiphertext',(p_payload->>'expiresAt')::timestamptz) RETURNING * INTO i;
   INSERT INTO research_private.signing_intent_events(intent_id,state) VALUES(i.id,i.state);
  END IF;
  result:=pg_catalog.jsonb_build_object('intent',research_private.signing_intent_json(i));
 ELSE
  IF p_action='signingTransferAuthorize' THEN
   -- Authentication precedes private intent lookup and does not accept owner flags.
   a:=research_private.guided_auth(p_token,(p_payload->>'studyId')::uuid,(p_payload->>'partnerId')::uuid);
   IF NOT(p_payload ? 'intentId') THEN
    IF p_payload->>'provider' IS DISTINCT FROM 'docusign' OR pg_catalog.length(COALESCE(p_payload->>'providerVersion','')) NOT BETWEEN 1 AND 200 THEN PERFORM research_private.fail('invalid');END IF;
    IF NOT research_private.processing_authorized(p_token,(p_payload->>'studyId')::uuid,(p_payload->>'partnerId')::uuid,'pre_signing_document','docusign',p_payload->>'providerVersion','["agreement_document","personal","confidential"]') THEN PERFORM research_private.fail('not_configured');END IF;
    PERFORM research_private.intake_reset();RETURN '{"allowed":true}';
   END IF;
  ELSE a:=research_private.partnership_signing_auth(p_token);END IF;
  PERFORM pg_catalog.set_config('research.signing','true',true);
  IF p_action='signingStateUpdate' THEN
   SELECT * INTO sg FROM research_private.partnership_signings x WHERE x.id=(p_payload->>'signingId')::uuid;
   IF sg.provider IS DISTINCT FROM 'signwell' THEN RETURN research_private.partnership_dispatch_before_signing_intents(p_token,p_action,p_payload);END IF;
   PERFORM pg_catalog.set_config('research.study',sg.study_id::text,true);PERFORM pg_catalog.set_config('research.partner',sg.partner_id::text,true);
   SELECT * INTO r FROM research_private.partnership_records x WHERE x.id=sg.record_id AND x.head_version_id=sg.version_id AND x.status='signing' FOR UPDATE;
   IF r.id IS NULL OR sg.study_id IS DISTINCT FROM (p_payload->>'studyId')::uuid OR sg.partner_id IS DISTINCT FROM (p_payload->>'partnerId')::uuid OR sg.record_id IS DISTINCT FROM (p_payload->>'recordId')::uuid THEN PERFORM research_private.fail('not_found');END IF;
   IF p_payload->>'state' NOT IN ('awaiting_signers','in_progress','artifact_pending','evidence_missing','verification_failed','send_uncertain','declined','expired') OR sg.state='completed' THEN PERFORM research_private.fail('conflict');END IF;
   UPDATE research_private.partnership_signings SET state=p_payload->>'state',provider_checked_at=CURRENT_TIMESTAMP WHERE id=sg.id RETURNING * INTO sg;
   result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'signing',research_private.partnership_signing(sg));
  ELSE
   SELECT * INTO i FROM research_private.signing_intents x WHERE x.id=(p_payload->>'intentId')::uuid FOR UPDATE;IF i.id IS NULL THEN PERFORM research_private.fail('not_found');END IF;
   IF p_action='signingTransferAuthorize' THEN
    IF i.study_id IS DISTINCT FROM (p_payload->>'studyId')::uuid OR i.partner_id IS DISTINCT FROM (p_payload->>'partnerId')::uuid OR i.record_id IS DISTINCT FROM (p_payload->>'recordId')::uuid THEN PERFORM research_private.fail('not_found');END IF;
    PERFORM research_private.signing_intent_authorize(p_token,i);result:='{"allowed":true}';
   ELSIF p_action='signingIntentGet' THEN result:=pg_catalog.jsonb_build_object('intent',research_private.signing_intent_json(i));
   ELSIF p_action IN ('signingIntentCreateClaim','signingIntentSendClaim','signingIntentLink') THEN
    PERFORM research_private.signing_intent_authorize(p_payload->>'authorizationToken',i,p_action<>'signingIntentSendClaim');
    IF i.expires_at<=CURRENT_TIMESTAMP THEN PERFORM research_private.fail('conflict');END IF;
    SELECT * INTO r FROM research_private.partnership_records x WHERE x.id=i.record_id AND x.head_version_id=i.version_id FOR UPDATE;IF r.id IS NULL THEN PERFORM research_private.fail('conflict');END IF;
    IF p_action='signingIntentCreateClaim' THEN
     IF r.status<>'approved' THEN PERFORM research_private.fail('conflict');END IF;
     PERFORM research_private.partnership_validate('agreement',(SELECT v.data FROM research_private.partnership_versions v WHERE v.id=i.version_id),i.study_id,i.partner_id,true);
     IF i.state='reserved' THEN next_state:='creating';claimed:=true;ELSIF i.state='creating' THEN next_state:='creation_uncertain';END IF;
    ELSIF p_action='signingIntentLink' THEN
     IF i.signing_id IS NULL THEN
      IF i.state<>'created' OR i.provider_session_id IS NULL THEN PERFORM research_private.fail('conflict');END IF;
      preflight:=research_private.partnership_dispatch_before_signing_intents(p_token,'signingPrepare',pg_catalog.jsonb_build_object('requestId',i.id,'studyId',i.study_id,'partnerId',i.partner_id,'recordId',i.record_id,'expectedRevision',r.revision,'versionId',i.version_id,'documentHash',i.document_hash,'providerDocumentHash',i.provider_document_hash,'providerSessionId','signwell/'||i.provider_session_id,'expiresAt',i.expires_at,'providerStateCiphertext',i.provider_state_ciphertext,'authorityPolicyHash',i.authority_policy_hash));IF preflight ? 'error' THEN PERFORM research_private.fail(preflight->>'error');END IF;
      PERFORM pg_catalog.set_config('research.signing','true',true);PERFORM pg_catalog.set_config('research.study',i.study_id::text,true);PERFORM pg_catalog.set_config('research.partner',i.partner_id::text,true);
      UPDATE research_private.partnership_signings SET provider='signwell' WHERE id=(preflight#>>'{signing,id}')::uuid;
      UPDATE research_private.signing_intents SET signing_id=(preflight#>>'{signing,id}')::uuid WHERE id=i.id RETURNING * INTO i;next_state:='linked';
     END IF;
     SELECT * INTO sg FROM research_private.partnership_signings WHERE id=i.signing_id;result:=pg_catalog.jsonb_build_object('signing',research_private.partnership_signing(sg));
    ELSE
     IF i.signing_id IS NULL OR r.status<>'signing' THEN PERFORM research_private.fail('conflict');END IF;
     IF i.state='linked' THEN next_state:='sending';claimed:=true;ELSIF i.state='sending' THEN next_state:='send_uncertain';END IF;
    END IF;
   ELSIF p_action='signingIntentAttach' THEN
    -- Retain an already attempted response even after revocation. No publishing or access is granted here.
    IF COALESCE(p_payload->>'providerSessionId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR NOT COALESCE(research_private.partnership_cipher(p_payload->'providerStateCiphertext'),false) OR i.state NOT IN ('creating','creation_uncertain','created','linked','sending','send_uncertain','sent') OR i.provider_session_id IS NOT NULL AND i.provider_session_id IS DISTINCT FROM p_payload->>'providerSessionId' THEN PERFORM research_private.fail('conflict');END IF;
    IF i.provider_session_id IS NULL THEN UPDATE research_private.signing_intents SET provider_session_id=p_payload->>'providerSessionId',provider_state_ciphertext=p_payload->'providerStateCiphertext' WHERE id=i.id RETURNING * INTO i;next_state:='created';END IF;
   ELSIF p_action='signingIntentSent' THEN
    IF i.signing_id IS NULL OR i.state NOT IN ('sending','send_uncertain','sent') THEN PERFORM research_private.fail('conflict');END IF;next_state:='sent';
   ELSE PERFORM research_private.fail('invalid');END IF;
   IF next_state IS NOT NULL AND next_state IS DISTINCT FROM i.state THEN
    UPDATE research_private.signing_intents SET state=next_state,updated_at=CURRENT_TIMESTAMP WHERE id=i.id RETURNING * INTO i;
    INSERT INTO research_private.signing_intent_events(intent_id,state) VALUES(i.id,i.state);
   END IF;
   result:=COALESCE(result,'{}')||pg_catalog.jsonb_build_object('intent',research_private.signing_intent_json(i),'claimed',claimed);
  END IF;
 END IF;
 PERFORM research_private.intake_reset();RETURN result;
EXCEPTION WHEN SQLSTATE 'P0001' THEN PERFORM research_private.intake_reset();RETURN pg_catalog.jsonb_build_object('error',SQLERRM);WHEN invalid_text_representation OR numeric_value_out_of_range OR unique_violation OR foreign_key_violation OR check_violation THEN PERFORM research_private.intake_reset();RETURN '{"error":"invalid"}';
END $f$;
GRANT CREATE ON SCHEMA research_private TO research_worker;
ALTER FUNCTION research_private.partnership_dispatch(text,text,jsonb) OWNER TO research_worker;
REVOKE CREATE ON SCHEMA research_private FROM research_worker;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_private FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA research_private TO research_worker;
GRANT EXECUTE ON FUNCTION research_private.dispatch(text,text,jsonb),research_private.partnership_dispatch(text,text,jsonb),research_private.intake_dispatch(text,text,jsonb),research_private.intake_reset() TO service_role;
COMMIT;
