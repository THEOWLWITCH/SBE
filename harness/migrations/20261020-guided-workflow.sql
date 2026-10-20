BEGIN;
-- Current policy heads are purpose-specific; the existing pair-wide revision
-- sequence remains intact. A same-purpose unapproved head blocks that route.
ALTER FUNCTION research_private.partnership_contract() RENAME TO partnership_contract_before_workflow;
CREATE FUNCTION research_private.partnership_contract() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $f$
 SELECT pg_catalog.jsonb_set(pg_catalog.jsonb_set(research_private.partnership_contract_before_workflow(),'{operations,processingPolicyGet,request,purpose}','"string?"'),'{processingPolicy,0,choices,signed_copy_delivery}','"מסירת עותק חתום"') $f$;
CREATE OR REPLACE FUNCTION research_private.processing_authorized(raw_token text,sid uuid,pid uuid,purpose text,provider text,provider_version text,categories jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE a jsonb;p research_private.processing_policies;allowed boolean;BEGIN
 a:=research_private.guided_auth(raw_token,sid,pid);PERFORM pg_catalog.set_config('research.owner','true',true);
 SELECT * INTO p FROM research_private.processing_policies x WHERE x.study_id=sid AND x.partner_id=pid AND x.policy->>'purpose'=purpose ORDER BY revision DESC LIMIT 1;
 allowed:=p.id IS NOT NULL AND p.restriction_hash=research_private.guided_restrictions(sid) AND EXISTS(SELECT 1 FROM research_private.processing_policy_approvals x WHERE x.policy_id=p.id) AND p.policy->>'purpose'=purpose AND p.policy->>'provider'=provider AND p.policy->>'providerVersion'=provider_version AND pg_catalog.jsonb_typeof(categories)='array' AND pg_catalog.jsonb_array_length(categories)>0 AND categories<@(p.policy->'dataCategories') AND (p.policy->'authorizedActors') ? (a->>'actor');
 PERFORM research_private.intake_reset();RETURN COALESCE(allowed,false);
END $f$;
CREATE OR REPLACE FUNCTION research_private.guided_request(action text,body jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE k text;typ text;v jsonb;x jsonb;BEGIN
 FOR k,typ IN SELECT key,value#>>'{}' FROM pg_catalog.jsonb_each(research_private.partnership_contract()#>ARRAY['operations',action,'request']) LOOP
  v:=body->k;IF v IS NULL THEN IF pg_catalog.strpos(typ,'?')=0 THEN PERFORM research_private.fail('invalid');END IF;CONTINUE;END IF;
  IF typ LIKE 'uuid[]%' OR typ LIKE 'string[]%' THEN
   IF pg_catalog.jsonb_typeof(v)<>'array' OR pg_catalog.jsonb_array_length(v)>200 OR (SELECT pg_catalog.count(*)<>pg_catalog.count(DISTINCT item) FROM pg_catalog.jsonb_array_elements(v) item) THEN PERFORM research_private.fail('invalid');END IF;
   FOR x IN SELECT pg_catalog.jsonb_array_elements(v) LOOP IF pg_catalog.jsonb_typeof(x)<>'string' OR pg_catalog.length(x#>>'{}')>500 OR typ LIKE 'uuid[]%' AND x#>>'{}'!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN PERFORM research_private.fail('invalid');END IF;END LOOP;
  ELSIF typ LIKE 'uuid%' THEN IF pg_catalog.jsonb_typeof(v)<>'string' OR v#>>'{}'!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN PERFORM research_private.fail('invalid');END IF;
  ELSIF typ='integer' THEN IF pg_catalog.jsonb_typeof(v)<>'number' OR v#>>'{}'!~'^[0-9]+$' OR (v#>>'{}')::numeric>9007199254740991 THEN PERFORM research_private.fail('invalid');END IF;
  ELSIF typ='sha256' THEN IF pg_catalog.jsonb_typeof(v)<>'string' OR v#>>'{}'!~'^[a-f0-9]{64}$' THEN PERFORM research_private.fail('invalid');END IF;
  ELSIF k='purpose' THEN IF pg_catalog.jsonb_typeof(v)<>'string' OR v#>>'{}' NOT IN ('external_impact','pre_signing_document','signed_copy_delivery') THEN PERFORM research_private.fail('invalid');END IF;
  ELSIF k='policy' THEN IF pg_catalog.jsonb_typeof(v)<>'object' THEN PERFORM research_private.fail('invalid');END IF;
  ELSE PERFORM research_private.fail('invalid');END IF;
 END LOOP;
 IF body ? 'requestId' AND (pg_catalog.jsonb_typeof(body->'requestId')<>'string' OR body->>'requestId'!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') THEN PERFORM research_private.fail('invalid');END IF;
END $f$;
CREATE OR REPLACE FUNCTION research_private.signing_intent_authorize(raw_token text,i research_private.signing_intents,owner_required boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE p research_private.processing_policies;BEGIN
 PERFORM research_private.guided_auth(raw_token,i.study_id,i.partner_id,owner_required);
 IF NOT research_private.processing_authorized(raw_token,i.study_id,i.partner_id,'pre_signing_document',i.provider,i.provider_version,'["agreement_document","personal","confidential"]') THEN PERFORM research_private.fail('not_configured');END IF;
 PERFORM research_private.guided_auth(raw_token,i.study_id,i.partner_id,owner_required);PERFORM pg_catalog.set_config('research.owner','true',true);
 SELECT * INTO p FROM research_private.processing_policies x WHERE x.study_id=i.study_id AND x.partner_id=i.partner_id AND x.policy->>'purpose'='pre_signing_document' ORDER BY revision DESC LIMIT 1;
 IF p.id IS DISTINCT FROM i.processing_policy_id OR i.parties_hash IS DISTINCT FROM research_private.signing_parties_hash(i.study_id,i.partner_id,i.version_id) THEN PERFORM research_private.fail('conflict');END IF;
 PERFORM pg_catalog.set_config('research.signing','true',true);
END $f$;
-- Preserve U5 reserve semantics, selecting the exact pre-signing route head.
CREATE OR REPLACE FUNCTION research_private.partnership_dispatch(p_token text,p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
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
  SELECT * INTO p FROM research_private.processing_policies x WHERE x.study_id=sid AND x.partner_id=pid AND x.policy->>'purpose'='pre_signing_document' ORDER BY revision DESC LIMIT 1;
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

ALTER TABLE research_private.partnership_signings ADD COLUMN work_lease_id uuid,ADD COLUMN work_lease_until timestamptz,ADD COLUMN work_due_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,ADD COLUMN work_owner_action text CHECK(work_owner_action IN ('completion_after_expiry'));
CREATE OR REPLACE FUNCTION research_private.partnership_signing(v research_private.partnership_signings) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $f$
 SELECT CASE WHEN v.id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object('id',v.id,'recordId',v.record_id,'versionId',v.version_id,'documentHash',v.document_hash,'state',CASE WHEN v.expires_at<=CURRENT_TIMESTAMP AND v.state<>'completed' THEN 'expired' ELSE v.state END,'provider',v.provider,'configured',true,'embeddedUrl',NULL,'expiresAt',v.expires_at,'completedAt',v.completed_at,'ownerActionCode',v.work_owner_action) END $f$;
CREATE TABLE research_private.partnership_copy_outbox(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),execution_id uuid NOT NULL REFERENCES research_private.partnership_executions(id),study_id uuid NOT NULL,partner_id uuid NOT NULL,record_id uuid NOT NULL,version_id uuid NOT NULL,document_id uuid NOT NULL REFERENCES research_private.partnership_documents(id),document_hash text NOT NULL,
 party text NOT NULL CHECK(party IN ('owner','partner')),recipient_hash text NOT NULL,idempotency_key text NOT NULL UNIQUE,
 submission text NOT NULL DEFAULT 'queued' CHECK(submission IN ('queued','retry','accepted','blocked','unknown')),delivery text NOT NULL DEFAULT 'unavailable' CHECK(delivery IN ('unavailable','sent','delivered','bounced','delivery_delayed','failed','suppressed')),
 provider text,provider_version text,from_address text,payload_hash text,provider_id text,first_attempt_at timestamptz,lease_id uuid,lease_until timestamptz,due_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,safe_code text,observed_at timestamptz,UNIQUE(execution_id,party));
CREATE TABLE research_private.partnership_work_events(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),signing_id uuid,copy_id uuid,outcome text NOT NULL,safe_code text,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE research_private.partnership_processing_events(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),study_id uuid NOT NULL,partner_id uuid NOT NULL,record_id uuid NOT NULL,from_version_id uuid NOT NULL,to_version_id uuid NOT NULL,from_hash text NOT NULL,to_hash text NOT NULL,actor_ref text NOT NULL,provider text NOT NULL,model text NOT NULL,engine_version text NOT NULL,prompt_version text NOT NULL,policy_id uuid NOT NULL REFERENCES research_private.processing_policies(id),policy_hash text NOT NULL,restriction_hash text NOT NULL,payload_hash text NOT NULL,outcome text NOT NULL,authorization_event_id uuid UNIQUE REFERENCES research_private.partnership_processing_events(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
DO $tables$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['partnership_copy_outbox','partnership_work_events','partnership_processing_events'] LOOP
 EXECUTE pg_catalog.format('ALTER TABLE research_private.%I OWNER TO research_table_owner',t);
 EXECUTE pg_catalog.format('ALTER TABLE research_private.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE pg_catalog.format('ALTER TABLE research_private.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE pg_catalog.format('REVOKE ALL ON research_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
 EXECUTE pg_catalog.format('GRANT SELECT,INSERT%s ON research_private.%I TO research_worker',CASE WHEN t='partnership_copy_outbox' THEN ',UPDATE' ELSE '' END,t);
 EXECUTE pg_catalog.format('CREATE POLICY workflow_private ON research_private.%I TO research_worker USING(pg_catalog.current_setting(''research.signing'',true)=''true'') WITH CHECK(pg_catalog.current_setting(''research.signing'',true)=''true'')',t);
 IF t<>'partnership_copy_outbox' THEN EXECUTE pg_catalog.format('CREATE TRIGGER workflow_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON research_private.%I FOR EACH STATEMENT EXECUTE FUNCTION research_private.immutable()',t);END IF;
END LOOP;END $tables$;

-- Worker policy checks bind a stored execution's actual live parties, not a
-- synthetic owner session or client-supplied actor/category assertion.
CREATE FUNCTION research_private.partnership_copy_allowed(o research_private.partnership_copy_outbox,provider_name text,provider_version_name text) RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE pol research_private.processing_policies;p research_private.partnership_partners;address text;BEGIN
 PERFORM pg_catalog.set_config('research.owner','true',true);
 SELECT * INTO p FROM research_private.partnership_partners WHERE id=o.partner_id;
 IF NOT research_private.partnership_live_member(o.study_id,p.actor_ref) THEN RETURN false;END IF;
 SELECT * INTO pol FROM research_private.processing_policies x WHERE x.study_id=o.study_id AND x.partner_id=o.partner_id AND x.policy->>'purpose'='signed_copy_delivery' ORDER BY revision DESC LIMIT 1;
 SELECT pg_catalog.lower(pg_catalog.btrim(si->>'email')) INTO address FROM research_private.partnership_executions e CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(e.verified_signers) si WHERE e.id=o.execution_id AND si->>'party'=o.party;
 RETURN pol.id IS NOT NULL AND pol.restriction_hash=research_private.guided_restrictions(o.study_id) AND EXISTS(SELECT 1 FROM research_private.processing_policy_approvals a WHERE a.policy_id=pol.id) AND pol.policy->>'provider'=provider_name AND pol.policy->>'providerVersion'=provider_version_name AND ' ["agreement_document","personal","confidential"]'::jsonb <@ (pol.policy->'dataCategories') AND pol.policy->'authorizedActors' ? CASE WHEN o.party='owner' THEN 'sys' ELSE p.actor_ref END AND o.recipient_hash=research_private.partnership_hash(pg_catalog.to_jsonb(address)) AND (o.party='owner' OR pg_catalog.lower(pg_catalog.btrim(p.profile->>'email'))=address);
END $f$;
CREATE FUNCTION research_private.partnership_work_lease(signing_id uuid,lease_id uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN PERFORM 1 FROM research_private.partnership_signings s WHERE s.id=signing_id AND s.work_lease_id=lease_id AND s.work_lease_until>CURRENT_TIMESTAMP FOR UPDATE;IF NOT FOUND THEN PERFORM research_private.fail('conflict');END IF;END $f$;

-- Completed copies are intents for the two verified parties. No proposal,
-- generic checkbox, mail retry or provider status creates an execution.
CREATE FUNCTION research_private.partnership_copy_intents(ex research_private.partnership_executions) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 INSERT INTO research_private.partnership_copy_outbox(execution_id,study_id,partner_id,record_id,version_id,document_id,document_hash,party,recipient_hash,idempotency_key)
 SELECT ex.id,ex.study_id,ex.partner_id,ex.record_id,ex.version_id,ex.final_document_id,ex.final_document_hash,si->>'party',research_private.partnership_hash(pg_catalog.to_jsonb(pg_catalog.lower(pg_catalog.btrim(si->>'email')))),'partnership-copy/'||ex.id||'/'||(si->>'party') FROM pg_catalog.jsonb_array_elements(ex.verified_signers) si ON CONFLICT(execution_id,party) DO NOTHING;
END $f$;
ALTER FUNCTION research_private.partnership_workspace(research_private.studies,research_private.partnership_partners,text,text,text) RENAME TO partnership_workspace_before_workflow;
CREATE FUNCTION research_private.partnership_workspace(s research_private.studies,p research_private.partnership_partners,kind_filter text DEFAULT NULL,status_filter text DEFAULT NULL,query_filter text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path='' AS $f$
DECLARE result jsonb;copies jsonb;BEGIN
 result:=research_private.partnership_workspace_before_workflow(s,p,kind_filter,status_filter,query_filter);
 PERFORM pg_catalog.set_config('research.signing','true',true);
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',o.id,'recordId',o.record_id,'versionId',o.version_id,'documentId',o.document_id,'party',o.party,'privateCopy','available','submission',o.submission,'deliveryEvidence',o.delivery,'safeCode',o.safe_code,'observedAt',o.observed_at) ORDER BY o.party),'[]') INTO copies FROM research_private.partnership_copy_outbox o WHERE o.study_id=s.id AND o.partner_id=p.id AND (pg_catalog.current_setting('research.owner',true)='true' OR o.party='partner');
 PERFORM pg_catalog.set_config('research.signing','false',true);RETURN result||pg_catalog.jsonb_build_object('signedCopies',copies);
END $f$;

-- Late retrieval may retain issued evidence; verified completion must still
-- precede that session's expiry. All original scope/evidence checks remain.
CREATE OR REPLACE FUNCTION research_private.partnership_dispatch_before_guided(p_token text,p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
#variable_conflict use_variable
DECLARE auth jsonb; actor text; owner_actor boolean; internal_actor boolean:=p_action IN ('signingPrepare','signingEvidencePut','signingEventContext','signingStateUpdate','signatureComplete'); sid uuid; pid uuid; self_id uuid; s research_private.studies; p research_private.partnership_partners; member research_private.memberships; r research_private.partnership_records; v research_private.partnership_versions; from_v research_private.partnership_versions; review research_private.partnership_reviews; approval research_private.partnership_approvals; invitation research_private.partnership_invitations; document research_private.partnership_documents; signing research_private.partnership_signings; snap research_private.partnership_snapshots; receipt research_private.partnership_receipts; result jsonb; items jsonb; partners jsonb; studies jsonb; workspaces jsonb; data jsonb; template jsonb; permitted text[]; viewers uuid[]; downloaders uuid[]; ids uuid[]; label text; key_name text; kind_name text; next_status text; hash text; scope_key text; request_id uuid; mutation boolean; author_actor boolean; can_view boolean; can_download boolean; party text; binding_source research_private.partnership_records; rr record; vars text[]; summary jsonb; provenance jsonb; created_version uuid; created_record uuid; consent_id uuid; expected integer; source_rows jsonb;
BEGIN
 PERFORM pg_catalog.set_config('research.actor','',true);PERFORM pg_catalog.set_config('research.owner','false',true);PERFORM pg_catalog.set_config('research.internal','false',true);PERFORM pg_catalog.set_config('research.signing','false',true);PERFORM pg_catalog.set_config('research.study','',true);PERFORM pg_catalog.set_config('research.partner','',true);PERFORM pg_catalog.set_config('research.partner_invite','',true);PERFORM pg_catalog.set_config('research.permissions','[]',true);
 IF pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN PERFORM research_private.fail('invalid'); END IF;
 IF internal_actor THEN auth:=research_private.partnership_signing_auth(p_token); ELSE auth:=research_private.auth(p_token); IF COALESCE((auth->>'internal')::boolean,false) THEN PERFORM research_private.fail('unauthorized'); END IF; END IF;
 actor:=auth->>'actor';owner_actor:=COALESCE((auth->>'owner')::boolean,false);
 PERFORM pg_catalog.set_config('research.actor',actor,true);PERFORM pg_catalog.set_config('research.owner',owner_actor::text,true);PERFORM pg_catalog.set_config('research.signing',internal_actor::text,true);
 IF owner_actor THEN PERFORM pg_catalog.set_config('research.permissions',pg_catalog.to_jsonb(research_private.permissions())::text,true); END IF;
 IF NOT internal_actor AND research_private.partnership_contract()#>ARRAY['operations',p_action] IS NULL THEN PERFORM research_private.fail('invalid'); END IF;
 IF NOT internal_actor THEN PERFORM research_private.partnership_request(p_action,p_payload); END IF;
 FOR key_name IN SELECT pg_catalog.jsonb_object_keys(p_payload) LOOP
  IF key_name IN ('owner','actor','role','authority','executionStatus','providerEvidence','token','action') THEN PERFORM research_private.fail('invalid'); END IF;
  IF NOT internal_actor AND key_name<>'requestId' AND NOT(COALESCE(research_private.partnership_contract()#>ARRAY['operations',p_action,'request'],'{}') ? key_name) AND NOT(p_action IN ('partnerInviteCreate','partnerInviteGet','partnerInviteAccept') AND key_name='inviteDigest') AND NOT(p_action='workspaceDocumentPut' AND key_name IN ('contentCiphertext','size','sha256')) THEN PERFORM research_private.fail('invalid'); END IF;
 END LOOP;
 SELECT id INTO self_id FROM research_private.partnership_partners WHERE actor_ref=actor;
 mutation:=p_action<>'signingEventContext' AND NOT(research_private.partnership_contract()->'reads' ? p_action);
 IF mutation THEN request_id:=COALESCE((p_payload->>'requestId')::uuid,CASE WHEN p_action IN ('signingEvidencePut','signingStateUpdate','signatureComplete') THEN (p_payload->>'signingId')::uuid END); IF request_id IS NULL THEN PERFORM research_private.fail('invalid'); END IF; END IF;
 scope_key:=CASE WHEN p_action='partnerSave' AND NOT owner_actor THEN 'profile:'||actor ELSE COALESCE(p_payload->>'studyId','profile')||':'||COALESCE(p_payload->>'partnerId',p_payload->>'individualCode',self_id::text,actor) END||CASE WHEN p_action='signingEvidencePut' THEN ':'||COALESCE(p_payload->>'purpose','') WHEN p_action='signingStateUpdate' THEN ':'||COALESCE(p_payload->>'state','') ELSE '' END;
 IF mutation THEN
  hash:=research_private.partnership_hash(p_payload-'requestId'-'contentCiphertext'-'providerStateCiphertext'); PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor||scope_key||p_action||request_id,0));
  SELECT * INTO receipt FROM research_private.partnership_receipts x WHERE x.actor_ref=actor AND x.scope=scope_key AND x.action=p_action AND x.request_id=request_id AND p_action NOT IN ('signingRefresh','signingStateUpdate');
 END IF;
 IF p_action='signingEventContext' THEN
  SELECT * INTO signing FROM research_private.partnership_signings sg WHERE sg.provider_session_id=p_payload->>'providerSessionId' FOR UPDATE;
  IF signing.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;sid:=signing.study_id;pid:=signing.partner_id;
  PERFORM pg_catalog.set_config('research.study',sid::text,true);PERFORM pg_catalog.set_config('research.partner',pid::text,true);
  -- A verified provider event records an already issued session; app access revocation cannot erase its evidence.
  SELECT * INTO p FROM research_private.partnership_partners pp WHERE pp.id=pid;
  SELECT * INTO r FROM research_private.partnership_records rec WHERE rec.id=signing.record_id AND rec.head_version_id=signing.version_id AND rec.status IN ('signing','executed') FOR UPDATE;IF r.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
  result:=pg_catalog.jsonb_build_object('studyId',sid,'partnerId',pid,'recordId',r.id,'record',research_private.partnership_record(r),'signing',research_private.partnership_signing(signing),'providerSessionId',signing.provider_session_id,'providerStateCiphertext',signing.provider_state_ciphertext);
 ELSIF p_action='partnerSave' THEN
  IF NOT owner_actor AND p_payload ? 'individualCode' THEN PERFORM research_private.fail('invalid'); END IF;
  IF owner_actor THEN
   IF p_payload ? 'individualCode' THEN IF p_payload->>'individualCode'!~'^[A-Z0-9]+$' THEN PERFORM research_private.fail('invalid'); END IF; PERFORM research_private.live_individual(p_payload->>'individualCode'); label:='code:'||(p_payload->>'individualCode');
   ELSIF p_payload ? 'partnerId' THEN SELECT actor_ref INTO label FROM research_private.partnership_partners WHERE id=(p_payload->>'partnerId')::uuid; ELSE PERFORM research_private.fail('invalid'); END IF;
  ELSE label:=actor; END IF;
  SELECT * INTO p FROM research_private.partnership_partners WHERE actor_ref=label FOR UPDATE;
  IF p_payload ? 'partnerId' AND p.id IS DISTINCT FROM (p_payload->>'partnerId')::uuid THEN PERFORM research_private.fail('not_found'); END IF;
  IF receipt.request_id IS NOT NULL THEN IF receipt.payload_hash<>hash THEN PERFORM research_private.fail('conflict'); END IF;RETURN receipt.result;END IF;
  PERFORM research_private.partnership_fields(research_private.partnership_contract()->'partner',p_payload->'profile',NULL,NULL,false);
  IF p.id IS NULL THEN IF p_payload->'expectedRevision' IS DISTINCT FROM 'null'::jsonb THEN PERFORM research_private.fail('conflict'); END IF; INSERT INTO research_private.partnership_partners(actor_ref,profile) VALUES(label,p_payload->'profile') RETURNING * INTO p;
  ELSE IF p_payload->>'expectedRevision' IS NULL OR (p_payload->>'expectedRevision')::integer<>p.revision THEN PERFORM research_private.fail('conflict'); END IF; UPDATE research_private.partnership_partners SET profile=p_payload->'profile',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=p.id RETURNING * INTO p; END IF;
  result:=pg_catalog.jsonb_build_object('partner',research_private.partnership_partner(p));
 ELSIF p_action IN ('workspaceBootstrap','workspaceList','partnerGet') THEN

  IF p_action='partnerGet' THEN SELECT * INTO p FROM research_private.partnership_partners WHERE id=(p_payload->>'partnerId')::uuid AND (owner_actor OR actor_ref=actor); IF p.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF; END IF;
  IF p_payload ? 'cursor' AND p_payload->>'cursor' IS NOT NULL THEN PERFORM research_private.fail('invalid'); END IF;
  IF p_payload ? 'partnerId' AND NOT owner_actor AND (p_payload->>'partnerId')::uuid IS DISTINCT FROM self_id THEN PERFORM research_private.fail('not_found'); END IF;
  partners:='[]';studies:='[]';workspaces:='[]';
  FOR rr IN SELECT pp.id FROM research_private.partnership_partners pp WHERE (owner_actor OR pp.actor_ref=actor) AND (NOT(p_payload ? 'partnerId') OR pp.id=(p_payload->>'partnerId')::uuid) ORDER BY pp.created_at,pp.id LOOP
   SELECT * INTO p FROM research_private.partnership_partners WHERE id=rr.id;
   partners:=partners||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id',p.id,'revision',p.revision,'fullName',p.profile->>'fullName','institution',p.profile->>'institution'));
   FOR s IN SELECT st.* FROM research_private.studies st WHERE (NOT(p_payload ? 'studyId') OR st.id=(p_payload->>'studyId')::uuid) AND (
    EXISTS(SELECT 1 FROM research_private.memberships m WHERE m.study_id=st.id AND m.actor_ref=p.actor_ref AND 'view_study'=ANY(m.permissions))
    OR owner_actor AND (
     EXISTS(SELECT 1 FROM research_private.partnership_records x WHERE x.study_id=st.id AND x.partner_id=p.id)
     OR EXISTS(SELECT 1 FROM research_private.partnership_documents x WHERE x.study_id=st.id AND x.partner_id=p.id)
     OR EXISTS(SELECT 1 FROM research_private.partnership_invitations x WHERE x.study_id=st.id AND x.partner_id=p.id)
     OR EXISTS(SELECT 1 FROM research_private.partnership_snapshots x WHERE x.study_id=st.id AND x.partner_id=p.id)
    )) ORDER BY st.created_at,st.id LOOP
    SELECT * INTO member FROM research_private.memberships m WHERE m.study_id=s.id AND m.actor_ref=p.actor_ref FOR SHARE;
    PERFORM pg_catalog.set_config('research.study',s.id::text,true);PERFORM pg_catalog.set_config('research.partner',p.id::text,true);
    IF NOT owner_actor THEN PERFORM pg_catalog.set_config('research.permissions',pg_catalog.to_jsonb(member.permissions)::text,true); END IF;
    IF p_action<>'workspaceBootstrap' THEN workspaces:=workspaces||pg_catalog.jsonb_build_array(research_private.partnership_workspace(s,p,p_payload->>'kind',p_payload->>'status',p_payload->>'query')); END IF;
    studies:=studies||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id',s.id,'title',s.config->>'title','status',s.status,'permissions',CASE WHEN owner_actor THEN pg_catalog.to_jsonb(research_private.permissions()) ELSE pg_catalog.to_jsonb(member.permissions) END));
   END LOOP;
  END LOOP;
  IF p_action='partnerGet' THEN SELECT * INTO p FROM research_private.partnership_partners WHERE id=(p_payload->>'partnerId')::uuid;result:=pg_catalog.jsonb_build_object('partner',research_private.partnership_partner(p),'workspaces',workspaces);
  ELSIF p_action='workspaceList' THEN result:=pg_catalog.jsonb_build_object('workspaces',workspaces,'nextCursor',NULL);
  ELSE result:=pg_catalog.jsonb_build_object('owner',owner_actor,'partners',partners,'studies',studies,'capabilities',CASE WHEN owner_actor THEN pg_catalog.to_jsonb(research_private.permissions()) ELSE COALESCE((SELECT pg_catalog.jsonb_agg(DISTINCT x) FROM research_private.memberships m CROSS JOIN LATERAL pg_catalog.unnest(m.permissions) x WHERE m.actor_ref=actor),'[]') END,'readiness',pg_catalog.jsonb_build_object('approvedTemplate',pg_catalog.jsonb_build_object('configured',EXISTS(SELECT 1 FROM research_private.partnership_records t WHERE t.kind='agreement_template' AND t.status='approved'),'state',CASE WHEN EXISTS(SELECT 1 FROM research_private.partnership_records t WHERE t.kind='agreement_template' AND t.status='approved') THEN 'ready' ELSE 'not_configured' END,'message','נדרשת תבנית מאושרת שסופקה'),'ipExplanation',pg_catalog.jsonb_build_object('configured',EXISTS(SELECT 1 FROM research_private.partnership_records t WHERE t.kind='agreement_template' AND t.status='approved'),'state',CASE WHEN EXISTS(SELECT 1 FROM research_private.partnership_records t WHERE t.kind='agreement_template' AND t.status='approved') THEN 'ready' ELSE 'not_configured' END,'message','נדרש הסבר קניין רוחני מאושר'))); END IF;
 ELSIF p_action IN ('partnerInviteGet','partnerInviteAccept') THEN
  IF p_payload ? 'invite' OR p_payload->>'inviteDigest'!~'^[a-f0-9]{64}$' THEN PERFORM research_private.fail('invalid'); END IF;
  PERFORM pg_catalog.set_config('research.partner_invite',p_payload->>'inviteDigest',true);
  SELECT * INTO invitation FROM research_private.partnership_invitations i WHERE i.digest=p_payload->>'inviteDigest' FOR UPDATE;
  IF invitation.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
  PERFORM pg_catalog.set_config('research.partner',invitation.partner_id::text,true);PERFORM pg_catalog.set_config('research.study',invitation.study_id::text,true);
  SELECT * INTO p FROM research_private.partnership_partners WHERE id=invitation.partner_id;
  IF p.actor_ref IS DISTINCT FROM actor OR invitation.revoked_at IS NOT NULL OR invitation.expires_at<=CURRENT_TIMESTAMP THEN PERFORM research_private.fail('not_found'); END IF;
  sid:=invitation.study_id;pid:=invitation.partner_id;SELECT * INTO s FROM research_private.studies WHERE id=invitation.study_id FOR SHARE;
  IF p_action='partnerInviteGet' THEN IF invitation.accepted_at IS NOT NULL THEN PERFORM research_private.fail('not_found'); END IF; result:=pg_catalog.jsonb_build_object('invitation',pg_catalog.jsonb_build_object('id',invitation.id,'studyId',s.id,'partnerId',p.id,'studyTitle',s.config->>'title','expiresAt',invitation.expires_at,'preset',invitation.preset,'permissions',invitation.permissions));
  ELSE
   IF receipt.request_id IS NOT NULL THEN IF receipt.payload_hash<>hash THEN PERFORM research_private.fail('conflict'); END IF; RETURN receipt.result; END IF;
   IF invitation.accepted_at IS NOT NULL THEN PERFORM research_private.fail('conflict'); END IF;
   INSERT INTO research_private.memberships(study_id,actor_ref,role,permissions) VALUES(s.id,actor,'researcher',invitation.permissions) ON CONFLICT(study_id,actor_ref) DO UPDATE SET permissions=(SELECT ARRAY(SELECT DISTINCT pg_catalog.unnest(research_private.memberships.permissions||EXCLUDED.permissions)));
   UPDATE research_private.partnership_invitations SET accepted_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=invitation.id;
   result:=pg_catalog.jsonb_build_object('partner',research_private.partnership_partner(p),'workspace',research_private.partnership_workspace(s,p));
  END IF;
 ELSE
  sid:=(p_payload->>'studyId')::uuid;pid:=(p_payload->>'partnerId')::uuid;
  IF sid IS NULL OR pid IS NULL THEN PERFORM research_private.fail('invalid'); END IF;
  PERFORM pg_catalog.set_config('research.study',sid::text,true);
  SELECT * INTO s FROM research_private.studies WHERE id=sid FOR SHARE;
  IF s.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
  IF NOT owner_actor AND NOT internal_actor THEN SELECT * INTO member FROM research_private.memberships m WHERE m.study_id=sid AND m.actor_ref=actor FOR SHARE; IF member.id IS NULL OR NOT('view_study'=ANY(member.permissions)) THEN PERFORM research_private.fail('not_found'); END IF;PERFORM pg_catalog.set_config('research.permissions',pg_catalog.to_jsonb(member.permissions)::text,true); END IF;
  PERFORM pg_catalog.set_config('research.partner',pid::text,true);
  SELECT * INTO p FROM research_private.partnership_partners WHERE id=pid FOR SHARE;
  IF p.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
  author_actor:=p.actor_ref=actor;
  -- Owner history/fulfillment actions preserve retained records. New grants, analyses, approvals and signing still require live access.
  -- Purpose-authenticated workers may reconcile only existing sessions; signingPrepare creates a session and is excluded.
  IF NOT (owner_actor AND p_action IN ('recordGet','recordVersions','workspaceExport','workspaceImpact','recordSave','recordSubmit','recordReview','findingPublish','findingWithdraw','findingComment','agreementAmend','workspaceDocumentGet','workspaceDocumentPut','partnerInviteRevoke') OR internal_actor AND p_action IN ('signingEvidencePut','signingStateUpdate','signatureComplete')) THEN
   PERFORM research_private.live_individual(pg_catalog.substr(p.actor_ref,6));
   IF NOT EXISTS(SELECT 1 FROM research_private.memberships m WHERE m.study_id=sid AND m.actor_ref=p.actor_ref AND 'view_study'=ANY(m.permissions)) AND p_action NOT IN ('partnerInviteCreate','partnerInviteRevoke') THEN PERFORM research_private.fail('not_found'); END IF;
  END IF;
  IF p_payload ? 'recordId' THEN SELECT * INTO r FROM research_private.partnership_records x WHERE x.id=(p_payload->>'recordId')::uuid AND x.study_id=sid AND x.partner_id=pid FOR UPDATE; IF r.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF; END IF;
  can_view:=owner_actor OR internal_actor OR author_actor AND (r.id IS NULL OR r.kind<>'analysis_result');
  can_download:=can_view;
  IF r.id IS NOT NULL AND NOT can_view THEN
   can_view:=research_private.partnership_released(r,self_id);can_download:=research_private.partnership_released(r,self_id,true);
  END IF;
  IF p_action<>'workspaceDocumentGet' AND NOT(owner_actor OR internal_actor OR author_actor AND r.kind IS DISTINCT FROM 'analysis_result') AND (NOT can_view OR p_action NOT IN ('recordGet','recordVersions','findingComment','workspaceDocumentGet','workspaceExport')) THEN PERFORM research_private.fail('not_found'); END IF;
  PERFORM 1 FROM research_private.memberships m WHERE m.study_id=sid AND m.actor_ref=p.actor_ref FOR SHARE;
  IF mutation AND receipt.request_id IS NOT NULL THEN IF receipt.payload_hash<>hash THEN PERFORM research_private.fail('conflict'); END IF; IF p_action='workspaceAnalysis' AND NOT research_private.partnership_snapshot_current(sid,pid,(receipt.result->>'sourceSnapshotId')::uuid) THEN PERFORM research_private.fail('not_found'); END IF; IF p_action='signingStart' THEN SELECT * INTO signing FROM research_private.partnership_signings sg WHERE sg.record_id=r.id AND sg.version_id=r.head_version_id ORDER BY sg.created_at DESC LIMIT 1;IF signing.id IS NOT NULL THEN RETURN receipt.result||pg_catalog.jsonb_build_object('signing',research_private.partnership_signing(signing)); END IF; END IF; RETURN receipt.result; END IF;
  IF r.id IS NOT NULL AND mutation AND p_action NOT IN ('findingComment','workspaceDocumentPut','workspaceAnalysis','signingEvidencePut','signingStateUpdate','signatureComplete') THEN IF p_payload->>'expectedRevision' IS NULL OR (p_payload->>'expectedRevision')::integer<>r.revision THEN PERFORM research_private.fail('conflict'); END IF; END IF;
  IF r.id IS NOT NULL THEN SELECT * INTO v FROM research_private.partnership_versions WHERE id=COALESCE((p_payload->>'versionId')::uuid,CASE WHEN NOT(owner_actor OR internal_actor OR author_actor AND r.kind<>'analysis_result') THEN r.published_version_id ELSE r.head_version_id END) AND record_id=r.id; IF v.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;IF NOT(owner_actor OR internal_actor OR author_actor AND r.kind<>'analysis_result') AND v.id IS DISTINCT FROM r.published_version_id THEN PERFORM research_private.fail('not_found'); END IF; END IF;
  CASE p_action
  WHEN 'recordSave' THEN
   kind_name:=p_payload->>'kind';data:=p_payload->'data';
   IF kind_name IN ('agreement_template','analysis_result','budget','obligation','decision') AND NOT owner_actor THEN PERFORM research_private.fail('not_found'); END IF;
   IF kind_name='analysis_request' AND NOT owner_actor THEN PERFORM research_private.require('propose_analysis'); END IF;
   IF r.id IS NULL THEN IF p_payload->'expectedRevision' IS DISTINCT FROM 'null'::jsonb THEN PERFORM research_private.fail('conflict'); END IF;
   ELSE IF r.kind<>kind_name OR r.status IN ('executed','published','retired') OR (r.kind='agreement_template' AND r.status='approved') THEN PERFORM research_private.fail('conflict'); END IF; END IF;
   PERFORM research_private.partnership_validate(kind_name,data,sid,pid,false);
   IF kind_name='obligation' THEN
    PERFORM research_private.partnership_ref(sid,pid,'agreement_version',(data->>'sourceAgreementVersionId')::uuid,true);
    IF NOT EXISTS(SELECT 1 FROM research_private.partnership_versions z JOIN research_private.partnership_records ar ON ar.id=z.record_id JOIN research_private.partnership_executions e ON e.version_id=z.id WHERE z.id=(data->>'sourceAgreementVersionId')::uuid AND ar.id=(data->>'sourceAgreementId')::uuid AND ar.status='executed') THEN PERFORM research_private.fail('not_found'); END IF;
    IF r.id IS NOT NULL AND (v.data-'completionEvidence'-'evidenceDocumentIds') IS DISTINCT FROM (data-'completionEvidence'-'evidenceDocumentIds') THEN PERFORM research_private.fail('conflict'); END IF;
   END IF;
   IF r.id IS NULL THEN INSERT INTO research_private.partnership_records(study_id,partner_id,kind) VALUES(sid,pid,kind_name) RETURNING * INTO r; END IF;
   label:=CASE WHEN owner_actor THEN 'owner' ELSE pid::text END;
   INSERT INTO research_private.partnership_versions(study_id,partner_id,record_id,number,data,content_hash,proposed_by) VALUES(sid,pid,r.id,r.revision+1,data,research_private.partnership_hash(data),label) RETURNING * INTO v;
   UPDATE research_private.partnership_records SET head_version_id=v.id,approved_version_id=NULL,published_version_id=NULL,status=CASE WHEN kind='obligation' AND r.status NOT IN ('draft','under_review') THEN r.status ELSE 'draft' END,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=r.id RETURNING * INTO r;
   result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'version',research_private.partnership_version(v));
  WHEN 'recordGet','recordVersions','workspaceExport','workspaceImpact' THEN
   IF r.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
   IF NOT research_private.partnership_version_current(v) THEN PERFORM research_private.fail('not_found'); END IF;
   IF p_action='workspaceExport' THEN
    IF NOT can_download THEN PERFORM research_private.fail('not_found'); END IF;
    IF NOT owner_actor AND r.kind='analysis_result' THEN PERFORM research_private.require('export_approved_dataset'); END IF;
    IF p_payload->>'format' NOT IN ('text','json','html','docx') THEN PERFORM research_private.fail('invalid'); END IF;
   END IF;
   IF p_action='recordVersions' THEN SELECT COALESCE(pg_catalog.jsonb_agg(research_private.partnership_version(z)-'data'-'recordId'-'studyId'-'partnerId' ORDER BY z.number),'[]') INTO items FROM research_private.partnership_versions z WHERE z.record_id=r.id AND research_private.partnership_version_current(z) AND (owner_actor OR author_actor AND r.kind<>'analysis_result' OR z.id=r.published_version_id);result:=pg_catalog.jsonb_build_object('versions',items);
   ELSIF p_action='workspaceImpact' THEN
    IF NOT(owner_actor OR author_actor AND r.kind<>'analysis_result') THEN PERFORM research_private.fail('not_found'); END IF;
    SELECT * INTO from_v FROM research_private.partnership_versions WHERE id=(p_payload->>'fromVersionId')::uuid AND record_id=r.id;SELECT * INTO v FROM research_private.partnership_versions WHERE id=(p_payload->>'toVersionId')::uuid AND record_id=r.id;
    IF from_v.id IS NULL OR v.id IS NULL OR NOT research_private.partnership_version_current(from_v) OR NOT research_private.partnership_version_current(v) THEN PERFORM research_private.fail('not_found'); END IF;result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'fromVersion',research_private.partnership_version(from_v),'toVersion',research_private.partnership_version(v));
   ELSE
    IF r.kind='agreement' AND v.data ? 'templateVersionId' THEN SELECT z.data INTO template FROM research_private.partnership_versions z JOIN research_private.partnership_records tr ON tr.id=z.record_id WHERE z.id=(v.data->>'templateVersionId')::uuid AND z.study_id=sid AND z.partner_id=pid AND tr.kind='agreement_template' AND tr.approved_version_id=z.id; END IF;
    result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'version',research_private.partnership_version(v),'template',template,'access',pg_catalog.jsonb_build_object('canView',can_view,'canDownload',can_download,'canComment',can_view AND r.kind='finding' AND r.status='published' AND pg_catalog.current_setting('research.permissions',true)::jsonb ? 'comment_on_findings'));
    IF v.id=r.published_version_id AND r.status IN ('published','approved','completed') AND pg_catalog.current_setting('research.permissions',true)::jsonb ? 'comment_on_findings' THEN result:=result||pg_catalog.jsonb_build_object('comments',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',c.id,'recordId',c.record_id,'versionId',c.version_id,'text',c.text,'authorLabel',c.author_label,'createdAt',c.created_at) ORDER BY c.created_at,c.id) FROM research_private.partnership_comments c WHERE c.version_id=v.id),'[]')); END IF;
    IF owner_actor OR author_actor AND r.kind<>'analysis_result' THEN result:=result||pg_catalog.jsonb_build_object('signing',(SELECT research_private.partnership_signing(sg) FROM research_private.partnership_signings sg WHERE sg.record_id=r.id AND sg.version_id=v.id ORDER BY sg.created_at DESC LIMIT 1));result:=result||pg_catalog.jsonb_build_object('reviews',COALESCE((SELECT pg_catalog.jsonb_agg(research_private.partnership_review(rv) ORDER BY rv.created_at,rv.id) FROM research_private.partnership_reviews rv WHERE rv.record_id=r.id),'[]'),'approvals',COALESCE((SELECT pg_catalog.jsonb_agg(research_private.partnership_approval(ap)) FROM research_private.partnership_approvals ap WHERE ap.record_id=r.id AND ap.version_id=v.id),'[]')); END IF;
    IF NOT(owner_actor OR author_actor AND r.kind<>'analysis_result') THEN result:=pg_catalog.jsonb_set(result,'{record}',(result->'record')||pg_catalog.jsonb_build_object('headVersionId',v.id,'approvedVersionId',v.id,'publishedVersionId',v.id,'revision',v.number,'status',CASE WHEN r.kind='contribution' AND r.status='completed' THEN 'completed' WHEN r.kind='contribution' THEN 'approved' ELSE 'published' END,'updatedAt',v.created_at)); END IF;
   END IF;
   PERFORM research_private.audit(sid,p_action,r.id);
  WHEN 'recordSubmit','recordReview','findingPublish','findingWithdraw' THEN
   IF r.id IS NULL OR v.id IS DISTINCT FROM r.head_version_id THEN PERFORM research_private.fail('conflict'); END IF;
   IF p_action<>'recordSubmit' AND NOT owner_actor THEN PERFORM research_private.fail('not_found'); END IF;
   IF p_action='recordSubmit' THEN IF r.kind='obligation' AND NOT owner_actor THEN PERFORM research_private.fail('not_found'); END IF;next_status:=CASE WHEN r.kind IN ('finding','analysis_result') THEN 'owner_review' WHEN r.kind='obligation' THEN 'under_review' ELSE 'submitted' END;
   ELSIF p_action='findingPublish' THEN next_status:='published';IF r.kind<>'finding' OR r.approved_version_id IS DISTINCT FROM v.id THEN PERFORM research_private.fail('invalid'); END IF;
   ELSIF p_action='findingWithdraw' THEN next_status:='withdrawn';IF r.kind<>'finding' OR pg_catalog.btrim(COALESCE(p_payload->>'reason',''))='' OR pg_catalog.length(p_payload->>'reason')>20000 THEN PERFORM research_private.fail('invalid'); END IF;
   ELSE next_status:=p_payload->>'decision'; END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(research_private.partnership_contract()#>ARRAY['transitions',r.kind]) t WHERE t->>'from'=r.status AND t->>'to'=next_status AND t->>'action'=p_action AND (t->>'authority'=CASE WHEN owner_actor THEN 'owner' ELSE 'author' END OR owner_actor AND t->>'authority'='author')) THEN PERFORM research_private.fail('invalid'); END IF;
   IF p_payload ? 'viewerPartnerIds' OR p_payload ? 'downloadPartnerIds' THEN IF NOT(p_action='findingPublish' OR p_action='recordReview' AND (r.kind='analysis_result' AND next_status='published' OR r.kind='contribution' AND next_status='approved')) THEN PERFORM research_private.fail('invalid'); END IF; END IF;
   IF next_status IN ('submitted','owner_review','under_review','approved','published') THEN PERFORM research_private.partnership_validate(r.kind,v.data,sid,pid,true); END IF;
   IF p_payload ? 'approvedTerms' THEN IF r.kind<>'contribution' OR p_action<>'recordReview' THEN PERFORM research_private.fail('invalid'); END IF;PERFORM research_private.partnership_fields(research_private.partnership_contract()->'terms',p_payload->'approvedTerms',sid,pid,false); END IF;
   IF next_status='cancelled' AND r.kind='obligation' THEN
    PERFORM research_private.partnership_ref(sid,pid,'agreement_version',(p_payload->>'cancellationAgreementVersionId')::uuid,true);
    IF NOT EXISTS(SELECT 1 FROM research_private.partnership_versions av JOIN research_private.partnership_executions e ON e.version_id=av.id WHERE av.id=(p_payload->>'cancellationAgreementVersionId')::uuid AND av.data->>'amendsAgreementVersionId'=v.data->>'sourceAgreementVersionId' AND EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(av.data->'customClauses','[]')) clause WHERE clause->>'sectionId'='durationTermination' AND clause->>'title'='cancel-obligation:'||r.id::text)) THEN PERFORM research_private.fail('not_found'); END IF;
   END IF;
   IF p_action='findingPublish' OR p_action='recordReview' AND (r.kind='analysis_result' AND next_status='published' OR r.kind='contribution' AND next_status='approved') THEN
    p_payload:=p_payload||pg_catalog.jsonb_build_object('viewerPartnerIds',COALESCE(p_payload->'viewerPartnerIds','[]'::jsonb),'downloadPartnerIds',COALESCE(p_payload->'downloadPartnerIds','[]'::jsonb));
    IF pg_catalog.jsonb_typeof(p_payload->'viewerPartnerIds')<>'array' OR pg_catalog.jsonb_typeof(p_payload->'downloadPartnerIds')<>'array' THEN PERFORM research_private.fail('invalid'); END IF;
    viewers:=ARRAY(SELECT pg_catalog.jsonb_array_elements_text(p_payload->'viewerPartnerIds')::uuid);downloaders:=ARRAY(SELECT pg_catalog.jsonb_array_elements_text(p_payload->'downloadPartnerIds')::uuid);
    IF NOT downloaders<@viewers OR pg_catalog.cardinality(viewers)>200 OR pg_catalog.cardinality(viewers)<>(SELECT pg_catalog.count(DISTINCT x) FROM pg_catalog.unnest(viewers) x) THEN PERFORM research_private.fail('invalid'); END IF;
    FOR rr IN SELECT * FROM pg_catalog.unnest(viewers) id LOOP
     IF NOT EXISTS(SELECT 1 FROM research_private.partnership_partners pp JOIN research_private.memberships mm ON mm.actor_ref=pp.actor_ref WHERE pp.id=rr.id AND mm.study_id=sid AND 'view_study'=ANY(mm.permissions) AND (CASE r.kind WHEN 'analysis_result' THEN 'view_analysis_results' WHEN 'contribution' THEN 'view_approved_contributions' ELSE 'view_approved_findings' END)=ANY(mm.permissions) AND (NOT(rr.id=ANY(downloaders)) OR 'download_approved_findings'=ANY(mm.permissions))) THEN PERFORM research_private.fail('not_found'); END IF;
     PERFORM 1 FROM research_private.memberships mm JOIN research_private.partnership_partners pp ON pp.actor_ref=mm.actor_ref WHERE pp.id=rr.id AND mm.study_id=sid FOR SHARE OF mm;
    END LOOP;
    INSERT INTO research_private.partnership_publications(study_id,partner_id,record_id,version_id,viewer_partner_ids,download_partner_ids) VALUES(sid,pid,r.id,v.id,viewers,downloaders) RETURNING pg_catalog.jsonb_build_object('id',id,'recordId',record_id,'versionId',version_id,'viewerPartnerIds',viewer_partner_ids,'downloadPartnerIds',download_partner_ids,'publishedAt',created_at,'withdrawnAt',withdrawn_at) INTO items;
   END IF;
   IF next_status='withdrawn' THEN UPDATE research_private.partnership_publications SET withdrawn_at=CURRENT_TIMESTAMP WHERE record_id=r.id AND withdrawn_at IS NULL; END IF;
   UPDATE research_private.partnership_records SET status=next_status,revision=revision+1,updated_at=CURRENT_TIMESTAMP,approved_version_id=CASE WHEN next_status='approved' THEN v.id ELSE approved_version_id END,published_version_id=CASE WHEN next_status='published' OR r.kind='contribution' AND next_status='approved' THEN v.id WHEN next_status='withdrawn' THEN NULL ELSE published_version_id END WHERE id=r.id RETURNING * INTO r;
   INSERT INTO research_private.partnership_reviews(study_id,partner_id,record_id,version_id,decision,note,approved_terms,cancellation_agreement_version_id,reviewed_by) VALUES(sid,pid,r.id,v.id,CASE WHEN p_action='recordSubmit' THEN 'submitted' ELSE next_status END,COALESCE(p_payload->>'note',p_payload->>'reason',''),p_payload->'approvedTerms',(p_payload->>'cancellationAgreementVersionId')::uuid,CASE WHEN owner_actor THEN 'owner' ELSE pid::text END) RETURNING * INTO review;
   result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r));
   IF p_action='recordSubmit' THEN result:=result||pg_catalog.jsonb_build_object('version',research_private.partnership_version(v));ELSIF p_action='recordReview' THEN result:=result||pg_catalog.jsonb_build_object('review',research_private.partnership_review(review));ELSIF p_action='findingPublish' THEN result:=result||pg_catalog.jsonb_build_object('publication',items); END IF;
  WHEN 'findingComment' THEN
   PERFORM research_private.require('comment_on_findings');
   IF r.kind<>'finding' OR r.status<>'published' OR v.id IS DISTINCT FROM r.published_version_id OR pg_catalog.btrim(COALESCE(p_payload->>'text',''))='' OR pg_catalog.length(p_payload->>'text')>20000 OR NOT owner_actor AND self_id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
   INSERT INTO research_private.partnership_comments(study_id,partner_id,record_id,version_id,text,author_id,author_label) VALUES(sid,pid,r.id,v.id,p_payload->>'text',self_id,CASE WHEN owner_actor THEN 'owner' ELSE self_id::text END) RETURNING pg_catalog.jsonb_build_object('id',id,'recordId',record_id,'versionId',version_id,'text',text,'authorLabel',author_label,'createdAt',created_at) INTO items;result:=pg_catalog.jsonb_build_object('comment',items);
  WHEN 'partnerInviteCreate','partnerInviteRevoke' THEN
   IF NOT owner_actor THEN PERFORM research_private.fail('not_found'); END IF;
   IF p_action='partnerInviteCreate' THEN
    IF p_payload ? 'invite' OR p_payload->>'inviteDigest'!~'^[a-f0-9]{64}$' OR NOT(research_private.partnership_contract()->'presets' ? (p_payload->>'preset')) THEN PERFORM research_private.fail('invalid'); END IF;
    permitted:=ARRAY(SELECT pg_catalog.jsonb_array_elements_text(COALESCE(p_payload->'permissions',research_private.partnership_contract()#>ARRAY['presets',p_payload->>'preset'])));
    IF NOT permitted<@research_private.permissions() OR NOT('view_study'=ANY(permitted)) THEN PERFORM research_private.fail('invalid'); END IF;
    IF p_payload ? 'expiresAt' AND ((p_payload->>'expiresAt')::timestamptz<=CURRENT_TIMESTAMP OR (p_payload->>'expiresAt')::timestamptz>CURRENT_TIMESTAMP+INTERVAL '30 days') THEN PERFORM research_private.fail('invalid'); END IF;
    INSERT INTO research_private.partnership_invitations(study_id,partner_id,digest,preset,permissions,expires_at) VALUES(sid,pid,p_payload->>'inviteDigest',p_payload->>'preset',permitted,COALESCE((p_payload->>'expiresAt')::timestamptz,CURRENT_TIMESTAMP+INTERVAL '30 days')) RETURNING * INTO invitation;
   ELSE SELECT * INTO invitation FROM research_private.partnership_invitations i WHERE i.id=(p_payload->>'invitationId')::uuid AND i.study_id=sid AND i.partner_id=pid FOR UPDATE;IF invitation.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;IF invitation.revision IS DISTINCT FROM (p_payload->>'expectedRevision')::integer OR invitation.accepted_at IS NOT NULL THEN PERFORM research_private.fail('conflict'); END IF;UPDATE research_private.partnership_invitations SET revoked_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=invitation.id RETURNING * INTO invitation; END IF;
   result:=pg_catalog.jsonb_build_object('invitation',research_private.partnership_invitation(invitation),'delivery','{"configured":false,"status":"not_configured"}'::jsonb);
  WHEN 'workspaceDocumentPut','workspaceDocumentGet' THEN
   IF p_action='workspaceDocumentPut' THEN
    IF NOT(owner_actor OR author_actor) OR p_payload ? 'contentBase64' OR NOT COALESCE(research_private.partnership_cipher(p_payload->'contentCiphertext'),false) OR pg_catalog.length(COALESCE(p_payload->>'filename','')) NOT BETWEEN 1 AND 240 OR p_payload->>'filename'~'[\x00-\x1f/\\]' OR p_payload->>'mediaType' NOT IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg','image/webp') THEN PERFORM research_private.fail('invalid'); END IF;
    INSERT INTO research_private.partnership_documents(study_id,partner_id,record_id,filename,media_type,size,sha256,content_ciphertext) VALUES(sid,pid,r.id,p_payload->>'filename',p_payload->>'mediaType',(p_payload->>'size')::integer,p_payload->>'sha256',p_payload->'contentCiphertext') RETURNING * INTO document;
    result:=pg_catalog.jsonb_build_object('document',research_private.partnership_document(document));
   ELSE
    SELECT * INTO document FROM research_private.partnership_documents d WHERE d.id=(p_payload->>'documentId')::uuid AND d.study_id=sid AND d.partner_id=pid;
    IF document.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
    IF NOT research_private.partnership_document_current(document) THEN PERFORM research_private.fail('not_found'); END IF;
    IF NOT owner_actor AND (NOT author_actor OR EXISTS(SELECT 1 FROM research_private.partnership_records rec JOIN research_private.partnership_versions ver ON ver.id=rec.head_version_id WHERE rec.study_id=sid AND rec.partner_id=pid AND rec.kind='analysis_result' AND (rec.id=document.record_id OR COALESCE(ver.data->'resultDocumentIds','[]') ? document.id::text))) THEN
     SELECT rec.* INTO r FROM research_private.partnership_records rec JOIN research_private.partnership_versions ver ON ver.id=rec.published_version_id WHERE rec.study_id=sid AND rec.partner_id=pid AND research_private.partnership_released(rec,self_id,true) AND research_private.partnership_version_current(ver) AND COALESCE(ver.data->CASE WHEN rec.kind='analysis_result' THEN 'resultDocumentIds' ELSE 'supportingDocumentIds' END,'[]') ? document.id::text;
     IF r.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
    END IF;
    result:=pg_catalog.jsonb_build_object('document',research_private.partnership_document(document),'contentCiphertext',document.content_ciphertext);PERFORM research_private.audit(sid,p_action,document.id);
   END IF;
  WHEN 'agreementApprove' THEN
   IF r.kind<>'agreement' OR r.status<>'approved' OR v.id IS DISTINCT FROM r.head_version_id OR v.id IS DISTINCT FROM r.approved_version_id OR p_payload->>'documentHash' IS DISTINCT FROM v.content_hash OR p_payload->'ipReadAcknowledged' IS DISTINCT FROM 'true'::jsonb OR p_payload->>'ipExplanationVersionId' IS DISTINCT FROM v.data->>'ipExplanationVersionId' THEN PERFORM research_private.fail('invalid'); END IF;
   PERFORM research_private.partnership_validate('agreement',v.data,sid,pid,true);party:=CASE WHEN owner_actor THEN 'owner' ELSE 'partner' END;
   INSERT INTO research_private.partnership_approvals(study_id,partner_id,record_id,version_id,document_hash,party,ip_explanation_version_id) VALUES(sid,pid,r.id,v.id,v.content_hash,party,(p_payload->>'ipExplanationVersionId')::uuid) ON CONFLICT ON CONSTRAINT partnership_approvals_record_id_version_id_party_key DO NOTHING RETURNING * INTO approval;
   IF approval.id IS NULL THEN SELECT * INTO approval FROM research_private.partnership_approvals a WHERE a.record_id=r.id AND a.version_id=v.id AND a.party=party; END IF;
   UPDATE research_private.partnership_records SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=r.id RETURNING * INTO r;
   SELECT pg_catalog.jsonb_agg(research_private.partnership_approval(a) ORDER BY a.party) INTO items FROM research_private.partnership_approvals a WHERE a.record_id=r.id AND a.version_id=v.id;
   result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'approval',research_private.partnership_approval(approval),'approvals',items);
  WHEN 'agreementAmend' THEN
   IF r.kind<>'agreement' OR r.status<>'executed' OR NOT EXISTS(SELECT 1 FROM research_private.partnership_executions e WHERE e.version_id=v.id) OR pg_catalog.btrim(COALESCE(p_payload->>'reason',''))='' OR p_payload#>>'{data,amendsAgreementVersionId}' IS DISTINCT FROM v.id::text THEN PERFORM research_private.fail('invalid'); END IF;
   PERFORM research_private.partnership_validate('agreement',p_payload->'data',sid,pid,false);
   INSERT INTO research_private.partnership_records(study_id,partner_id,kind) VALUES(sid,pid,'agreement') RETURNING * INTO r;
   INSERT INTO research_private.partnership_versions(study_id,partner_id,record_id,number,data,content_hash,proposed_by) VALUES(sid,pid,r.id,1,p_payload->'data',research_private.partnership_hash(p_payload->'data'),CASE WHEN owner_actor THEN 'owner' ELSE pid::text END) RETURNING * INTO v;
   UPDATE research_private.partnership_records SET head_version_id=v.id,revision=1 WHERE id=r.id RETURNING * INTO r;result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'version',research_private.partnership_version(v));
  WHEN 'signingStateUpdate' THEN
   SELECT * INTO signing FROM research_private.partnership_signings sg WHERE sg.id=(p_payload->>'signingId')::uuid AND sg.record_id=r.id AND sg.study_id=sid AND sg.partner_id=pid FOR UPDATE;
   IF signing.id IS NULL OR signing.version_id IS DISTINCT FROM r.head_version_id OR r.status<>'signing' THEN PERFORM research_private.fail('not_found'); END IF;
   IF p_payload->>'state' NOT IN ('awaiting_signers','in_progress','declined','expired','failed') OR signing.state IN ('completed','declined','expired','failed') AND signing.state IS DISTINCT FROM p_payload->>'state' OR signing.state='in_progress' AND p_payload->>'state'='awaiting_signers' THEN PERFORM research_private.fail('conflict'); END IF;
   -- Only the purpose-bound worker reaches this after provider verification; preflight never consumes the polling window.
   UPDATE research_private.partnership_signings SET state=p_payload->>'state',provider_checked_at=CURRENT_TIMESTAMP WHERE id=signing.id RETURNING * INTO signing;result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'signing',research_private.partnership_signing(signing));
  WHEN 'signingEvidencePut' THEN
   SELECT * INTO signing FROM research_private.partnership_signings sg WHERE sg.id=(p_payload->>'signingId')::uuid AND sg.record_id=r.id AND sg.study_id=sid AND sg.partner_id=pid FOR UPDATE;
   IF signing.id IS NULL OR signing.version_id IS DISTINCT FROM r.head_version_id OR r.status<>'signing' OR signing.state='completed' THEN PERFORM research_private.fail('not_found'); END IF;
   IF p_payload->>'purpose' NOT IN ('final','certificate') OR p_payload->>'mediaType'<>'application/pdf' OR NOT COALESCE(research_private.partnership_cipher(p_payload->'contentCiphertext'),false) OR pg_catalog.length(COALESCE(p_payload->>'filename','')) NOT BETWEEN 1 AND 240 OR p_payload->>'filename'~'[\x00-\x1f/\\]' THEN PERFORM research_private.fail('invalid'); END IF;
   INSERT INTO research_private.partnership_documents(study_id,partner_id,record_id,filename,media_type,size,sha256,content_ciphertext,signing_id,evidence_purpose) VALUES(sid,pid,r.id,p_payload->>'filename',p_payload->>'mediaType',(p_payload->>'size')::integer,p_payload->>'sha256',p_payload->'contentCiphertext',signing.id,p_payload->>'purpose') RETURNING * INTO document;
   result:=pg_catalog.jsonb_build_object('document',research_private.partnership_document(document));
  WHEN 'signingStart','signingPrepare','signingView','signingRefresh','signatureComplete' THEN
   IF r.kind<>'agreement' THEN PERFORM research_private.fail('not_found'); END IF;
   IF p_action IN ('signingStart','signingPrepare') THEN
    IF p_action='signingStart' AND (NOT owner_actor OR p_payload->'consent' IS DISTINCT FROM 'true'::jsonb) THEN PERFORM research_private.fail('not_found'); END IF;
    IF r.status<>'approved' OR v.id IS DISTINCT FROM r.approved_version_id OR v.id IS DISTINCT FROM r.head_version_id OR p_payload->>'documentHash' IS DISTINCT FROM v.content_hash OR (SELECT pg_catalog.count(*) FROM research_private.partnership_approvals a WHERE a.record_id=r.id AND a.version_id=v.id AND a.document_hash=v.content_hash)<>2 THEN PERFORM research_private.fail('conflict'); END IF;
    PERFORM research_private.partnership_validate('agreement',v.data,sid,pid,true);
    IF p_action='signingStart' THEN
     SELECT z.data INTO template FROM research_private.partnership_versions z WHERE z.id=(v.data->>'templateVersionId')::uuid;
     result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'version',research_private.partnership_version(v),'template',template,'signing',NULL,'parties',pg_catalog.jsonb_build_object('owner',pg_catalog.jsonb_build_object('name',v.data->>'ownerSignatory','email',v.data->>'ownerEmail','authority',v.data->>'ownerAuthority'),'partner',pg_catalog.jsonb_build_object('id',p.id,'name',v.data->>'partnerSignatory','email',p.profile->>'email','authority',v.data->>'partnerAuthority')));
    ELSE
     IF p_payload->>'providerDocumentHash'!~'^[a-f0-9]{64}$' OR p_payload->>'providerDocumentHash' IS NULL OR NOT COALESCE(research_private.partnership_cipher(p_payload->'providerStateCiphertext'),false) OR pg_catalog.length(COALESCE(p_payload->>'providerSessionId','')) NOT BETWEEN 1 AND 240 OR p_payload->>'authorityPolicyHash'!~'^[a-f0-9]{64}$' OR (p_payload->>'expiresAt')::timestamptz<=CURRENT_TIMESTAMP THEN PERFORM research_private.fail('invalid'); END IF;
     INSERT INTO research_private.partnership_signings(study_id,partner_id,record_id,version_id,document_hash,provider_session_id,provider_document_hash,provider_state_ciphertext,authority_policy_hash,expires_at) VALUES(sid,pid,r.id,v.id,v.content_hash,p_payload->>'providerSessionId',p_payload->>'providerDocumentHash',p_payload->'providerStateCiphertext',p_payload->>'authorityPolicyHash',(p_payload->>'expiresAt')::timestamptz) RETURNING * INTO signing;
     UPDATE research_private.partnership_records SET status='signing',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=r.id RETURNING * INTO r;result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'signing',research_private.partnership_signing(signing));
    END IF;
   ELSE
    SELECT * INTO signing FROM research_private.partnership_signings sg WHERE sg.id=(p_payload->>'signingId')::uuid AND sg.record_id=r.id AND sg.study_id=sid AND sg.partner_id=pid FOR UPDATE;
    IF signing.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
    IF p_action='signatureComplete' THEN
     IF signing.state='completed' THEN IF EXISTS(SELECT 1 FROM research_private.partnership_executions e WHERE e.signing_id=signing.id AND e.provider_event_id=p_payload->>'providerEventId') THEN result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'signing',research_private.partnership_signing(signing));ELSE PERFORM research_private.fail('conflict'); END IF;
     ELSE
      IF r.status<>'signing' OR signing.version_id IS DISTINCT FROM r.head_version_id OR signing.version_id IS DISTINCT FROM v.id OR signing.document_hash IS DISTINCT FROM p_payload->>'documentHash' OR (p_payload->>'completedAt')::timestamptz>signing.expires_at OR p_payload->>'finalDocumentHash'!~'^[a-f0-9]{64}$' OR pg_catalog.length(COALESCE(p_payload->>'providerEventId','')) NOT BETWEEN 1 AND 240 OR pg_catalog.jsonb_typeof(p_payload->'verifiedSigners')<>'array' OR pg_catalog.jsonb_array_length(p_payload->'verifiedSigners')<>2 OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_payload->'verifiedSigners') si WHERE si->>'party'='owner') OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_payload->'verifiedSigners') si WHERE si->>'party'='partner') THEN PERFORM research_private.fail('invalid'); END IF;
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_payload->'verifiedSigners') si WHERE si->'identityVerified' IS DISTINCT FROM 'true'::jsonb OR si->'consent' IS DISTINCT FROM 'true'::jsonb OR pg_catalog.btrim(COALESCE(si->>'recipientId',''))='' OR pg_catalog.btrim(COALESCE(si->>'name',''))='' OR pg_catalog.btrim(COALESCE(si->>'authority',''))='' OR pg_catalog.lower(pg_catalog.btrim(si->>'email')) IS DISTINCT FROM pg_catalog.lower(pg_catalog.btrim(CASE WHEN si->>'party'='owner' THEN v.data->>'ownerEmail' ELSE p.profile->>'email' END)) OR si->>'name' IS DISTINCT FROM CASE WHEN si->>'party'='owner' THEN v.data->>'ownerSignatory' ELSE v.data->>'partnerSignatory' END OR si->>'authority' IS DISTINCT FROM CASE WHEN si->>'party'='owner' THEN v.data->>'ownerAuthority' ELSE v.data->>'partnerAuthority' END OR (si->>'signedAt')::timestamptz>(p_payload->>'completedAt')::timestamptz) OR (p_payload->>'completedAt')::timestamptz>CURRENT_TIMESTAMP+INTERVAL '5 minutes' THEN PERFORM research_private.fail('invalid'); END IF;
      IF NOT EXISTS(SELECT 1 FROM research_private.partnership_documents d WHERE d.id=(p_payload->>'finalDocumentId')::uuid AND d.study_id=sid AND d.partner_id=pid AND d.record_id=r.id AND d.signing_id=signing.id AND d.evidence_purpose='final' AND d.sha256=p_payload->>'finalDocumentHash') OR NOT EXISTS(SELECT 1 FROM research_private.partnership_documents d WHERE d.id=(p_payload->>'auditCertificateDocumentId')::uuid AND d.study_id=sid AND d.partner_id=pid AND d.record_id=r.id AND d.signing_id=signing.id AND d.evidence_purpose='certificate') THEN PERFORM research_private.fail('not_found'); END IF;
      INSERT INTO research_private.partnership_executions(study_id,partner_id,record_id,version_id,signing_id,document_hash,provider_event_id,final_document_id,final_document_hash,audit_document_id,verified_signers,completed_at) VALUES(sid,pid,r.id,v.id,signing.id,signing.document_hash,p_payload->>'providerEventId',(p_payload->>'finalDocumentId')::uuid,p_payload->>'finalDocumentHash',(p_payload->>'auditCertificateDocumentId')::uuid,p_payload->'verifiedSigners',(p_payload->>'completedAt')::timestamptz);
      PERFORM research_private.partnership_extract(r,v);
      UPDATE research_private.partnership_records SET status='executed',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=r.id RETURNING * INTO r;UPDATE research_private.partnership_signings SET state='completed',completed_at=(p_payload->>'completedAt')::timestamptz,provider_checked_at=CURRENT_TIMESTAMP WHERE id=signing.id RETURNING * INTO signing;
      result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'signing',research_private.partnership_signing(signing));
     END IF;
    ELSE
     can_view:=p_action='signingRefresh' AND signing.state<>'completed' AND signing.expires_at>CURRENT_TIMESTAMP AND (signing.provider_checked_at IS NULL OR signing.provider_checked_at<=CURRENT_TIMESTAMP-INTERVAL '15 minutes');
     result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'signing',research_private.partnership_signing(signing),'providerStateCiphertext',signing.provider_state_ciphertext,'providerSessionId',signing.provider_session_id,'providerCheckDue',can_view,'party',CASE WHEN owner_actor THEN 'owner' ELSE 'partner' END);
    END IF;
   END IF;
  WHEN 'workspaceAnalysis' THEN
   IF NOT owner_actor OR p_payload->>'operation' NOT IN ('descriptive','frequency','comparison','trend') THEN PERFORM research_private.fail('not_found'); END IF;
   SELECT ar.* INTO r FROM research_private.partnership_records ar WHERE ar.id=(p_payload->>'requestRecordId')::uuid AND ar.study_id=sid AND ar.partner_id=pid AND ar.kind='analysis_request' AND ar.status='approved' FOR SHARE;
   IF r.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;SELECT * INTO v FROM research_private.partnership_versions WHERE id=r.approved_version_id;
   PERFORM research_private.partnership_validate('analysis_request',v.data,sid,pid,true);
   IF v.data->>'operation' IS DISTINCT FROM p_payload->>'operation' THEN PERFORM research_private.fail('invalid'); END IF;
   vars:=ARRAY(SELECT pg_catalog.jsonb_array_elements_text(v.data->'variables'));consent_id:=(s.config->>'consentVersionId')::uuid;
   IF p_payload->>'operation'='comparison' AND NOT(v.data->>'groupingVariable'=ANY(vars)) THEN vars:=vars||ARRAY[v.data->>'groupingVariable']; END IF;
   IF consent_id IS NULL THEN PERFORM research_private.fail('not_configured'); END IF;
   FOR key_name IN SELECT pg_catalog.unnest(vars) LOOP IF NOT EXISTS(SELECT 1 FROM research_private.form_versions f CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(f.definition->'items') q WHERE f.study_id=sid AND f.kind='instrument' AND s.config->'instrumentVersionIds' ? f.id::text AND q->>'id'=key_name) THEN PERFORM research_private.fail('invalid'); END IF; END LOOP;
   IF p_payload ? 'sourceSnapshotId' THEN SELECT * INTO snap FROM research_private.partnership_snapshots x WHERE x.id=(p_payload->>'sourceSnapshotId')::uuid AND x.study_id=sid AND x.partner_id=pid; IF snap.id IS NULL OR snap.variables<>vars OR NOT research_private.partnership_snapshot_current(sid,pid,snap.id) THEN PERFORM research_private.fail('not_found'); END IF;
   ELSE
    INSERT INTO research_private.partnership_snapshots(study_id,partner_id,consent_version_id,participant_ids,response_ids,variables,source_rows,questionnaire_version_ids)
    SELECT sid,pid,consent_id,COALESCE(pg_catalog.array_agg(DISTINCT pp.id),'{}'),COALESCE(pg_catalog.array_agg(resp.id),'{}'),vars,'[]'::jsonb,COALESCE(pg_catalog.array_agg(DISTINCT resp.instrument_version_id),'{}') FROM research_private.responses resp JOIN research_private.participants pp ON pp.id=resp.participant_id AND pp.study_id=resp.study_id WHERE resp.study_id=sid AND pp.status='enrolled' AND pp.verified AND pp.consents->>'participate'='true' AND pp.consents->>'surveys'='true' AND pp.consent_version_id=consent_id AND resp.consent_version_id=consent_id AND s.config->'instrumentVersionIds' ? resp.instrument_version_id::text RETURNING * INTO snap;
   END IF;
   SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('waveId',resp.wave_id,'answers',(SELECT pg_catalog.jsonb_object_agg(a.key,a.value) FROM pg_catalog.jsonb_each(resp.answers) a WHERE a.key=ANY(vars) AND pg_catalog.jsonb_typeof(a.value) IN ('number','boolean') OR a.key=ANY(vars) AND EXISTS(SELECT 1 FROM research_private.form_versions fv CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(fv.definition->'items') q WHERE fv.id=resp.instrument_version_id AND q->>'id'=a.key AND q->>'type'='choice')))),'[]') INTO source_rows FROM research_private.responses resp WHERE resp.id=ANY(snap.response_ids) AND (COALESCE(v.data->'timePoints','[]')='[]'::jsonb OR v.data->'timePoints' ? resp.wave_id);
   IF p_payload->>'operation'='frequency' THEN SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)),'[]') INTO items FROM (SELECT a.key variable,a.value value,pg_catalog.count(*) count FROM pg_catalog.jsonb_array_elements(source_rows) sr CROSS JOIN LATERAL pg_catalog.jsonb_each(sr->'answers') a GROUP BY a.key,a.value ORDER BY a.key,a.value) x;
   ELSE SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)),'[]') INTO items FROM (SELECT a.key variable,CASE p_payload->>'operation' WHEN 'comparison' THEN sr#>>ARRAY['answers',v.data->>'groupingVariable'] WHEN 'trend' THEN sr->>'waveId' ELSE NULL END AS "group",pg_catalog.count(*) count,pg_catalog.count(*) FILTER(WHERE pg_catalog.jsonb_typeof(a.value)='number') AS "numericCount",pg_catalog.avg(CASE WHEN pg_catalog.jsonb_typeof(a.value)='number' THEN (a.value#>>'{}')::numeric END) mean FROM pg_catalog.jsonb_array_elements(source_rows) sr CROSS JOIN LATERAL pg_catalog.jsonb_each(sr->'answers') a WHERE v.data->'variables' ? a.key GROUP BY a.key,CASE p_payload->>'operation' WHEN 'comparison' THEN sr#>>ARRAY['answers',v.data->>'groupingVariable'] WHEN 'trend' THEN sr->>'waveId' ELSE NULL END ORDER BY a.key,"group") x;END IF;
   summary:=pg_catalog.jsonb_build_object('count',pg_catalog.jsonb_array_length(source_rows),'variables',v.data->'variables','results',items)||CASE WHEN p_payload->>'operation'='comparison' THEN pg_catalog.jsonb_build_object('groupingVariable',v.data->>'groupingVariable') ELSE '{}'::jsonb END;
   provenance:=pg_catalog.jsonb_build_object('sourceSnapshotId',snap.id,'requestRecordId',r.id,'requestVersionId',v.id,'operation',p_payload->>'operation','analysisVersion','1.1.0','consentProtocolVersionId',snap.consent_version_id,'questionnaireVersionIds',snap.questionnaire_version_ids,'toolVersion','1.2.0','createdAt',CURRENT_TIMESTAMP);
   data:=pg_catalog.jsonb_build_object('title','תוצאת ניתוח לעיון','analysisRequestId',r.id,'sourceSnapshotId',snap.id,'operation',p_payload->>'operation','analysisVersion','1.1.0','summary',summary::text,'method','Fixed consent-bound '||(p_payload->>'operation')||' 1.1.0','consentProtocolVersionId',snap.consent_version_id);
   INSERT INTO research_private.partnership_records(study_id,partner_id,kind) VALUES(sid,pid,'analysis_result') RETURNING * INTO r;
   INSERT INTO research_private.partnership_versions(study_id,partner_id,record_id,number,data,content_hash,proposed_by) VALUES(sid,pid,r.id,1,data,research_private.partnership_hash(data),'owner') RETURNING * INTO v;UPDATE research_private.partnership_records SET head_version_id=v.id,revision=1 WHERE id=r.id RETURNING * INTO r;
   result:=pg_catalog.jsonb_build_object('operation',p_payload->>'operation','sourceSnapshotId',snap.id,'summary',summary,'provenance',provenance,'record',research_private.partnership_record(r),'version',research_private.partnership_version(v));
  ELSE PERFORM research_private.fail('invalid'); END CASE;
 END IF;
 IF mutation THEN IF p_action NOT IN ('signingRefresh','signingStateUpdate') THEN INSERT INTO research_private.partnership_receipts(actor_ref,scope,action,request_id,payload_hash,result) VALUES(actor,scope_key,p_action,request_id,hash,result);END IF;IF sid IS NOT NULL THEN PERFORM research_private.audit(sid,p_action,r.id,pg_catalog.jsonb_build_object('partnerId',pid)); END IF; END IF;
 RETURN result;
EXCEPTION WHEN SQLSTATE 'P0001' THEN RETURN pg_catalog.jsonb_build_object('error',SQLERRM,'status',CASE SQLERRM WHEN 'not_found' THEN 404 WHEN 'unauthorized' THEN 403 WHEN 'conflict' THEN 409 WHEN 'not_configured' THEN 503 ELSE 400 END);
 WHEN invalid_text_representation OR invalid_parameter_value OR check_violation OR not_null_violation OR foreign_key_violation OR datetime_field_overflow OR invalid_datetime_format OR numeric_value_out_of_range THEN RETURN '{"error":"invalid","status":400}'::jsonb;
 WHEN unique_violation THEN RETURN '{"error":"conflict","status":409}'::jsonb;
END $f$;
CREATE FUNCTION research_private.partnership_impact_auth(raw_token text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $f$ DECLARE parts text[]; secret text; body jsonb; expected text; BEGIN
 parts:=pg_catalog.string_to_array(raw_token,'.'); IF pg_catalog.array_length(parts,1)<>2 OR pg_catalog.length(raw_token)>12000 THEN PERFORM research_private.fail('unauthorized'); END IF;
 SELECT value->>'secret' INTO secret FROM public.access_settings WHERE key='token-secret' FOR SHARE;
 expected:=pg_catalog.translate(pg_catalog.rtrim(pg_catalog.encode(research_private.hmac(pg_catalog.convert_to(parts[1],'UTF8'),pg_catalog.convert_to(secret,'UTF8')),'base64'),'='),'+/','-_');
 IF secret IS NULL OR parts[2] IS DISTINCT FROM expected THEN PERFORM research_private.fail('unauthorized'); END IF;
 body:=pg_catalog.convert_from(pg_catalog.decode(pg_catalog.translate(parts[1],'-_','+/')||pg_catalog.repeat('=',(4-pg_catalog.length(parts[1])%4)%4),'base64'),'UTF8')::jsonb;
 IF body->>'k' IS DISTINCT FROM 'research_impact_worker' OR body->>'purpose' IS DISTINCT FROM 'research-impact' OR pg_catalog.jsonb_typeof(body->'exp') IS DISTINCT FROM 'number' OR (body->>'exp')::numeric<=pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())*1000 OR (body->>'exp')::numeric>pg_catalog.date_part('epoch',pg_catalog.clock_timestamp())*1000+600000 THEN PERFORM research_private.fail('unauthorized'); END IF;
 RETURN '{"actor":"research-impact-worker","internal":true}'::jsonb;
 EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN PERFORM research_private.fail('unauthorized'); RETURN NULL;
END $f$;
ALTER FUNCTION research_private.partnership_dispatch(text,text,jsonb) RENAME TO partnership_dispatch_before_workflow;
CREATE FUNCTION research_private.partnership_dispatch(p_token text,p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
#variable_conflict use_variable
DECLARE sid uuid;pid uuid;a jsonb;pol research_private.processing_policies;selected research_private.processing_policies;replay research_private.partnership_receipts;hash text;scope_key text;purpose_name text;result jsonb;sg research_private.partnership_signings;o research_private.partnership_copy_outbox;ex research_private.partnership_executions;doc research_private.partnership_documents;recipient text;lease uuid;phase text;outcome text;event research_private.partnership_processing_events;rec research_private.partnership_records;fv research_private.partnership_versions;tv research_private.partnership_versions;BEGIN
 IF p_action NOT IN ('processingPolicyGet','processingPolicySave','processingPolicyApprove','signingWorkClaim','signingWorkComplete','partnershipCopyClaim','partnershipCopyComplete','impactAuthorize','impactOutcome','signatureComplete','signingEvidencePut','signingStateUpdate') THEN RETURN research_private.partnership_dispatch_before_workflow(p_token,p_action,p_payload);END IF;
 PERFORM research_private.intake_reset();IF pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN PERFORM research_private.fail('invalid');END IF;
 IF p_action IN ('processingPolicyGet','processingPolicySave','processingPolicyApprove') THEN
  PERFORM research_private.guided_request(p_action,p_payload);
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_object_keys(p_payload) k WHERE k<>'requestId' AND NOT(research_private.partnership_contract()#>ARRAY['operations',p_action,'request'] ? k)) THEN PERFORM research_private.fail('invalid');END IF;
  sid:=(p_payload->>'studyId')::uuid;pid:=(p_payload->>'partnerId')::uuid;a:=research_private.guided_auth(p_token,sid,pid,true,p_action='processingPolicyGet');PERFORM pg_catalog.set_config('research.owner','true',true);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('processing-policy:'||sid||':'||pid,0));
  IF p_action='processingPolicyApprove' THEN SELECT * INTO selected FROM research_private.processing_policies x WHERE x.id=(p_payload->>'policyVersionId')::uuid AND x.study_id=sid AND x.partner_id=pid;purpose_name:=selected.policy->>'purpose';
  ELSIF p_action='processingPolicySave' THEN purpose_name:=p_payload#>>'{policy,purpose}';ELSE purpose_name:=p_payload->>'purpose';END IF;
  SELECT * INTO pol FROM research_private.processing_policies x WHERE x.study_id=sid AND x.partner_id=pid AND (purpose_name IS NULL OR x.policy->>'purpose'=purpose_name) ORDER BY revision DESC LIMIT 1;
  IF p_action<>'processingPolicyGet' THEN
   IF p_payload->>'requestId' IS NULL THEN PERFORM research_private.fail('invalid');END IF;scope_key:=sid||':'||pid;hash:=research_private.partnership_hash(p_payload-'requestId');
   SELECT * INTO replay FROM research_private.partnership_receipts x WHERE x.actor_ref=a->>'actor' AND x.scope=scope_key AND x.action=p_action AND x.request_id=(p_payload->>'requestId')::uuid;
   IF replay.request_id IS NOT NULL THEN IF replay.payload_hash<>hash OR p_action='processingPolicyApprove' AND pol.id IS DISTINCT FROM (p_payload->>'policyVersionId')::uuid THEN PERFORM research_private.fail('conflict');END IF;RETURN replay.result;END IF;
   IF COALESCE(pol.revision,0) IS DISTINCT FROM (p_payload->>'expectedRevision')::integer THEN PERFORM research_private.fail('conflict');END IF;
  END IF;
  IF p_action='processingPolicySave' THEN
   PERFORM research_private.partnership_fields(research_private.partnership_contract()->'processingPolicy',p_payload->'policy',sid,pid,true);
   IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements_text(p_payload#>'{policy,authorizedActors}') x WHERE x NOT IN ('sys',(SELECT p.actor_ref FROM research_private.partnership_partners p WHERE p.id=pid))) THEN PERFORM research_private.fail('invalid');END IF;
   INSERT INTO research_private.processing_policies(study_id,partner_id,revision,policy,policy_hash,restriction_hash,created_by) VALUES(sid,pid,(SELECT COALESCE(MAX(revision),0)+1 FROM research_private.processing_policies x WHERE x.study_id=sid AND x.partner_id=pid),p_payload->'policy',research_private.partnership_hash(p_payload->'policy'),research_private.guided_restrictions(sid),a->>'actor') RETURNING * INTO pol;
  ELSIF p_action='processingPolicyApprove' THEN
   IF selected.id IS NULL OR pol.id IS DISTINCT FROM selected.id OR pol.policy_hash IS DISTINCT FROM p_payload->>'policyHash' OR pol.restriction_hash IS DISTINCT FROM research_private.guided_restrictions(sid) THEN PERFORM research_private.fail('conflict');END IF;
   IF pol.policy->'dataCategories' ? 'personal' AND NOT EXISTS(SELECT 1 FROM research_private.studies s JOIN research_private.form_versions v ON v.study_id=s.id AND v.id=(s.config->>'consentVersionId')::uuid JOIN research_private.form_publications fp ON fp.study_id=s.id AND fp.version_id=v.id WHERE s.id=sid AND s.config#>>'{approvals,status}'='approved') THEN PERFORM research_private.fail('conflict');END IF;
   INSERT INTO research_private.processing_policy_approvals(policy_id,approved_by) VALUES(pol.id,a->>'actor') ON CONFLICT DO NOTHING;
  END IF;
  result:=pg_catalog.jsonb_build_object('policy',research_private.processing_policy_json(pol));
  IF p_action='processingPolicyGet' THEN result:=result||pg_catalog.jsonb_build_object('actorChoices',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id','sys','label','בעלת המערכת'),pg_catalog.jsonb_build_object('id',(SELECT p.actor_ref FROM research_private.partnership_partners p WHERE p.id=pid),'label','החוקרת בתיק')));
  ELSE INSERT INTO research_private.partnership_receipts(actor_ref,scope,action,request_id,payload_hash,result) VALUES(a->>'actor',scope_key,p_action,(p_payload->>'requestId')::uuid,hash,result);END IF;
 ELSIF p_action IN ('impactAuthorize','impactOutcome') THEN
  sid:=(p_payload->>'studyId')::uuid;pid:=(p_payload->>'partnerId')::uuid;
  IF p_action='impactOutcome' THEN
   PERFORM research_private.partnership_impact_auth(p_token);PERFORM pg_catalog.set_config('research.signing','true',true);
   IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_object_keys(p_payload) k WHERE k NOT IN ('eventId','payloadHash','outcome')) THEN PERFORM research_private.fail('invalid');END IF;
   SELECT * INTO event FROM research_private.partnership_processing_events e WHERE e.id=(p_payload->>'eventId')::uuid AND e.payload_hash=p_payload->>'payloadHash' AND e.outcome='authorized';
   IF event.id IS NULL OR p_payload->>'outcome' NOT IN ('succeeded','failed') THEN PERFORM research_private.fail('not_found');END IF;
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('impact-outcome:'||event.id,0));
   IF EXISTS(SELECT 1 FROM research_private.partnership_processing_events e WHERE e.authorization_event_id=event.id AND e.outcome IS DISTINCT FROM p_payload->>'outcome') THEN PERFORM research_private.fail('conflict');END IF;
   INSERT INTO research_private.partnership_processing_events(study_id,partner_id,record_id,from_version_id,to_version_id,from_hash,to_hash,actor_ref,provider,model,engine_version,prompt_version,policy_id,policy_hash,restriction_hash,payload_hash,outcome,authorization_event_id) VALUES(event.study_id,event.partner_id,event.record_id,event.from_version_id,event.to_version_id,event.from_hash,event.to_hash,event.actor_ref,event.provider,event.model,event.engine_version,event.prompt_version,event.policy_id,event.policy_hash,event.restriction_hash,event.payload_hash,p_payload->>'outcome',event.id) ON CONFLICT(authorization_event_id) DO NOTHING;result:='{}';
  ELSE
   a:=research_private.guided_auth(p_token,sid,pid);PERFORM pg_catalog.set_config('research.owner','true',true);PERFORM pg_catalog.set_config('research.signing','true',true);
   SELECT * INTO rec FROM research_private.partnership_records r WHERE r.id=(p_payload->>'recordId')::uuid AND r.study_id=sid AND r.partner_id=pid;
   IF rec.id IS NULL OR NOT COALESCE((a->>'owner')::boolean,false) AND (SELECT actor_ref FROM research_private.partnership_partners WHERE id=pid) IS DISTINCT FROM a->>'actor' THEN PERFORM research_private.fail('not_found');END IF;
   SELECT * INTO fv FROM research_private.partnership_versions v WHERE v.id=(p_payload->>'fromVersionId')::uuid AND v.record_id=rec.id;SELECT * INTO tv FROM research_private.partnership_versions v WHERE v.id=(p_payload->>'toVersionId')::uuid AND v.record_id=rec.id;
   IF fv.id IS NULL OR tv.id IS NULL OR fv.content_hash IS DISTINCT FROM p_payload->>'fromHash' OR tv.content_hash IS DISTINCT FROM p_payload->>'toHash' OR p_payload->>'payloadHash'!~'^[a-f0-9]{64}$' OR p_payload->'categories' IS DISTINCT FROM '["agreement_changes","personal","confidential"]'::jsonb OR EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['provider','model','providerVersion','engineVersion','promptVersion']) k WHERE pg_catalog.length(COALESCE(p_payload->>k,'')) NOT BETWEEN 1 AND 240) THEN PERFORM research_private.fail('invalid');END IF;
   IF NOT research_private.processing_authorized(p_token,sid,pid,'external_impact',p_payload->>'provider',p_payload->>'providerVersion',p_payload->'categories') THEN PERFORM research_private.fail('not_configured');END IF;
   PERFORM research_private.guided_auth(p_token,sid,pid);PERFORM pg_catalog.set_config('research.owner','true',true);PERFORM pg_catalog.set_config('research.signing','true',true);
   SELECT * INTO pol FROM research_private.processing_policies x WHERE x.study_id=sid AND x.partner_id=pid AND x.policy->>'purpose'='external_impact' ORDER BY revision DESC LIMIT 1;
   IF p_payload->'checkOnly'='true'::jsonb THEN result:=pg_catalog.jsonb_build_object('allowed',true);ELSE INSERT INTO research_private.partnership_processing_events(study_id,partner_id,record_id,from_version_id,to_version_id,from_hash,to_hash,actor_ref,provider,model,engine_version,prompt_version,policy_id,policy_hash,restriction_hash,payload_hash,outcome) VALUES(sid,pid,rec.id,fv.id,tv.id,fv.content_hash,tv.content_hash,a->>'actor',p_payload->>'provider',p_payload->>'model',p_payload->>'engineVersion',p_payload->>'promptVersion',pol.id,pol.policy_hash,pol.restriction_hash,p_payload->>'payloadHash','authorized') RETURNING * INTO event;result:=pg_catalog.jsonb_build_object('eventId',event.id,'policyId',pol.id);END IF;
  END IF;
 ELSE
  PERFORM research_private.partnership_signing_auth(p_token);PERFORM pg_catalog.set_config('research.signing','true',true);
  IF p_action IN ('signatureComplete','signingEvidencePut','signingStateUpdate') THEN
   IF p_payload ? 'workLeaseId' THEN PERFORM research_private.partnership_work_lease((p_payload->>'signingId')::uuid,(p_payload->>'workLeaseId')::uuid);END IF;
   result:=research_private.partnership_dispatch_before_workflow(p_token,p_action,p_payload-'workLeaseId');IF result ? 'error' THEN PERFORM research_private.fail(result->>'error');END IF;
   IF p_action='signatureComplete' THEN
    PERFORM pg_catalog.set_config('research.signing','true',true);SELECT * INTO ex FROM research_private.partnership_executions WHERE signing_id=(p_payload->>'signingId')::uuid;IF ex.id IS NOT NULL THEN PERFORM research_private.partnership_copy_intents(ex);END IF;
   END IF;
  ELSIF p_action='signingWorkClaim' THEN
   IF p_payload ? 'signingId' THEN
    SELECT * INTO sg FROM research_private.partnership_signings s WHERE s.id=(p_payload->>'signingId')::uuid FOR UPDATE;
    PERFORM research_private.partnership_work_lease(sg.id,(p_payload->>'leaseId')::uuid);
   ELSE
    IF COALESCE((p_payload->>'limit')::integer,1)<>1 THEN PERFORM research_private.fail('invalid');END IF;
    SELECT s.* INTO sg FROM research_private.partnership_signings s JOIN research_private.partnership_records r ON r.id=s.record_id AND r.head_version_id=s.version_id AND r.status='signing' WHERE s.state IN ('awaiting_signers','in_progress','artifact_pending','evidence_missing','verification_failed','send_uncertain') AND s.work_owner_action IS NULL AND s.work_due_at<=CURRENT_TIMESTAMP AND (s.work_lease_until IS NULL OR s.work_lease_until<=CURRENT_TIMESTAMP) ORDER BY s.work_due_at,s.id LIMIT 1 FOR UPDATE OF s SKIP LOCKED;
    IF sg.id IS NOT NULL THEN UPDATE research_private.partnership_signings SET work_lease_id=pg_catalog.gen_random_uuid(),work_lease_until=CURRENT_TIMESTAMP+INTERVAL '5 minutes',work_due_at=CURRENT_TIMESTAMP+INTERVAL '15 minutes' WHERE id=sg.id RETURNING * INTO sg;END IF;
   END IF;
   result:=pg_catalog.jsonb_build_object('jobs',CASE WHEN sg.id IS NULL OR sg.state='completed' THEN '[]'::jsonb ELSE pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('signingId',sg.id,'leaseId',sg.work_lease_id,'studyId',sg.study_id,'partnerId',sg.partner_id,'recordId',sg.record_id,'provider',sg.provider,'providerSessionId',sg.provider_session_id,'signing',research_private.partnership_signing(sg),'providerStateCiphertext',sg.provider_state_ciphertext)) END);
  ELSIF p_action='signingWorkComplete' THEN
   PERFORM research_private.partnership_work_lease((p_payload->>'signingId')::uuid,(p_payload->>'leaseId')::uuid);
   IF p_payload->>'outcome' NOT IN ('completed','pending','blocked','failed') OR COALESCE(p_payload->>'safeCode','')!~'^[a-z_]{0,80}$' THEN PERFORM research_private.fail('invalid');END IF;
   UPDATE research_private.partnership_signings SET work_lease_id=NULL,work_lease_until=NULL,work_due_at=CURRENT_TIMESTAMP+INTERVAL '15 minutes',work_owner_action=CASE WHEN p_payload->>'safeCode'='completion_after_expiry' THEN 'completion_after_expiry' ELSE work_owner_action END WHERE id=(p_payload->>'signingId')::uuid;
   INSERT INTO research_private.partnership_work_events(signing_id,outcome,safe_code) VALUES((p_payload->>'signingId')::uuid,p_payload->>'outcome',p_payload->>'safeCode');result:='{}';
  ELSIF p_action='partnershipCopyClaim' THEN
   IF p_payload ? 'messageId' THEN
    SELECT * INTO o FROM research_private.partnership_copy_outbox x WHERE x.id=(p_payload->>'messageId')::uuid AND x.lease_id=(p_payload->>'leaseId')::uuid AND x.lease_until>CURRENT_TIMESTAMP FOR UPDATE;
    IF o.id IS NULL THEN PERFORM research_private.fail('conflict');END IF;
    IF NOT research_private.partnership_copy_allowed(o,p_payload->>'provider',p_payload->>'providerVersion') THEN UPDATE research_private.partnership_copy_outbox SET submission=CASE WHEN submission='accepted' THEN submission ELSE 'blocked' END,safe_code='policy_or_access',lease_id=NULL,lease_until=NULL,due_at=CURRENT_TIMESTAMP+INTERVAL '15 minutes' WHERE id=o.id;result:='{"messages":[]}';
    ELSE
     IF o.provider IS NOT NULL AND (o.provider IS DISTINCT FROM p_payload->>'provider' OR o.provider_version IS DISTINCT FROM p_payload->>'providerVersion' OR o.from_address IS DISTINCT FROM p_payload->>'from' OR o.payload_hash IS DISTINCT FROM p_payload->>'payloadHash') THEN PERFORM research_private.fail('conflict');END IF;
     SELECT * INTO doc FROM research_private.partnership_documents d WHERE d.id=o.document_id AND d.sha256=o.document_hash AND d.evidence_purpose='final';SELECT * INTO ex FROM research_private.partnership_executions e WHERE e.id=o.execution_id AND e.final_document_id=doc.id AND e.version_id=o.version_id;
     IF doc.id IS NULL OR ex.id IS NULL THEN PERFORM research_private.fail('not_found');END IF;
     SELECT pg_catalog.lower(pg_catalog.btrim(si->>'email')) INTO recipient FROM pg_catalog.jsonb_array_elements(ex.verified_signers) si WHERE si->>'party'=o.party;
     phase:=CASE WHEN o.submission='accepted' THEN 'receipt' ELSE 'send' END;
     IF phase='send' AND o.first_attempt_at IS NOT NULL AND o.first_attempt_at<=CURRENT_TIMESTAMP-INTERVAL '24 hours' THEN UPDATE research_private.partnership_copy_outbox SET submission='unknown',safe_code='dedup_window_expired',lease_id=NULL,lease_until=NULL WHERE id=o.id;result:='{"messages":[]}';
     ELSE
      IF p_payload->>'payloadHash'!~'^[a-f0-9]{64}$' OR pg_catalog.length(COALESCE(p_payload->>'from','')) NOT BETWEEN 3 AND 254 OR p_payload->>'from'~'[\r\n]' THEN PERFORM research_private.fail('invalid');END IF;
      UPDATE research_private.partnership_copy_outbox SET provider=p_payload->>'provider',provider_version=p_payload->>'providerVersion',from_address=p_payload->>'from',payload_hash=p_payload->>'payloadHash',first_attempt_at=CASE WHEN phase='send' THEN COALESCE(first_attempt_at,CURRENT_TIMESTAMP) ELSE first_attempt_at END WHERE id=o.id RETURNING * INTO o;
      result:=pg_catalog.jsonb_build_object('messages',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('messageId',o.id,'leaseId',o.lease_id,'party',o.party,'phase',phase,'recipient',recipient,'from',o.from_address,'idempotencyKey',o.idempotency_key,'providerId',o.provider_id,'firstAttemptAt',o.first_attempt_at,'documentHash',o.document_hash,'documentCiphertext',doc.content_ciphertext)));
     END IF;
    END IF;
   ELSE
    IF COALESCE((p_payload->>'limit')::integer,1)<>1 THEN PERFORM research_private.fail('invalid');END IF;
    SELECT * INTO o FROM research_private.partnership_copy_outbox x WHERE x.submission IN ('queued','retry','blocked','accepted') AND x.delivery NOT IN ('delivered','bounced','failed','suppressed') AND x.due_at<=CURRENT_TIMESTAMP AND (x.lease_until IS NULL OR x.lease_until<=CURRENT_TIMESTAMP) ORDER BY x.due_at,x.id LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF o.id IS NOT NULL THEN UPDATE research_private.partnership_copy_outbox SET lease_id=pg_catalog.gen_random_uuid(),lease_until=CURRENT_TIMESTAMP+INTERVAL '60 seconds' WHERE id=o.id RETURNING * INTO o;END IF;
    result:=pg_catalog.jsonb_build_object('messages',CASE WHEN o.id IS NULL THEN '[]'::jsonb ELSE pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('messageId',o.id,'leaseId',o.lease_id,'documentHash',o.document_hash,'versionId',o.version_id,'recipientHash',o.recipient_hash)) END);
   END IF;
  ELSIF p_action='partnershipCopyComplete' THEN
   SELECT * INTO o FROM research_private.partnership_copy_outbox x WHERE x.id=(p_payload->>'messageId')::uuid AND x.lease_id=(p_payload->>'leaseId')::uuid AND x.lease_until>CURRENT_TIMESTAMP FOR UPDATE;
   IF o.id IS NULL OR COALESCE(p_payload->>'safeCode','')!~'^[a-z_]{0,80}$' THEN PERFORM research_private.fail('conflict');END IF;outcome:=p_payload->>'outcome';
   IF p_payload->>'phase'='send' THEN
    IF o.submission='accepted' OR outcome NOT IN ('accepted','retry','blocked','unknown') OR outcome='accepted' AND COALESCE(p_payload->>'providerId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN PERFORM research_private.fail('conflict');END IF;
    UPDATE research_private.partnership_copy_outbox SET submission=outcome,provider_id=CASE WHEN outcome='accepted' THEN p_payload->>'providerId' ELSE provider_id END WHERE id=o.id;
   ELSIF p_payload->>'phase'='receipt' THEN
    IF o.submission<>'accepted' OR o.provider_id IS DISTINCT FROM p_payload->>'providerId' OR outcome NOT IN ('delivered','bounced','delivery_delayed','failed','sent','suppressed','unavailable') THEN PERFORM research_private.fail('conflict');END IF;
    UPDATE research_private.partnership_copy_outbox SET delivery=outcome,observed_at=CURRENT_TIMESTAMP WHERE id=o.id;
   ELSE PERFORM research_private.fail('invalid');END IF;
   UPDATE research_private.partnership_copy_outbox SET lease_id=NULL,lease_until=NULL,due_at=CURRENT_TIMESTAMP+INTERVAL '15 minutes',safe_code=p_payload->>'safeCode' WHERE id=o.id;
   INSERT INTO research_private.partnership_work_events(copy_id,outcome,safe_code) VALUES(o.id,outcome,p_payload->>'safeCode');result:='{}';
  ELSE PERFORM research_private.fail('invalid');END IF;
 END IF;
 PERFORM research_private.intake_reset();RETURN result;
EXCEPTION WHEN SQLSTATE 'P0001' THEN PERFORM research_private.intake_reset();RETURN pg_catalog.jsonb_build_object('error',SQLERRM);WHEN invalid_text_representation OR numeric_value_out_of_range OR unique_violation OR foreign_key_violation OR check_violation THEN PERFORM research_private.intake_reset();RETURN '{"error":"invalid"}';END $f$;

-- Extraction creates review drafts only. An unstructured name, requested
-- payment, estimate or cap cannot establish the debtor or a payable amount.
CREATE OR REPLACE FUNCTION research_private.partnership_extract(r research_private.partnership_records,v research_private.partnership_versions) RETURNS void LANGUAGE plpgsql SET search_path='' AS $f$
DECLARE item jsonb;group_name text;position integer;obligation_data jsonb;obligation_id uuid;version_id uuid;responsibility text;BEGIN
 IF NOT EXISTS(SELECT 1 FROM research_private.partnership_executions e WHERE e.version_id=v.id) THEN PERFORM research_private.fail('not_found');END IF;
 FOR group_name IN SELECT pg_catalog.unnest(ARRAY['sharedExpenses','professionalFees','milestones','ownerResponsibilities','partnerResponsibilities','developmentTasks','annexA','annexB','annexC','annexD','annexE','annexF']) LOOP
  IF group_name LIKE 'annex%' AND v.data->>(group_name||'Status') IS DISTINCT FROM 'applicable' THEN CONTINUE;END IF;
  position:=0;
  FOR item IN SELECT x FROM pg_catalog.jsonb_array_elements(CASE WHEN group_name IN ('ownerResponsibilities','partnerResponsibilities') THEN CASE WHEN pg_catalog.btrim(COALESCE(v.data->>group_name,''))='' THEN '[]'::jsonb ELSE pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('description',v.data->>group_name,'party',CASE group_name WHEN 'ownerResponsibilities' THEN 'owner' ELSE 'partner' END)) END ELSE COALESCE(v.data->group_name,'[]') END) x LOOP
   position:=position+1;responsibility:=CASE WHEN item->>'party' IN ('owner','partner','shared') THEN item->>'party' ELSE NULL END;
   obligation_data:=pg_catalog.jsonb_build_object('title',CASE WHEN responsibility IS NULL THEN 'סעיף חתום לבירור אחריות ותנאים' ELSE 'התחייבות חתומה לבדיקת בעלת המערכת' END,'sourceAgreementId',r.id,'sourceAgreementVersionId',v.id,'clauseReference',group_name||'['||position||']','description',COALESCE(NULLIF(item->>'description',''),NULLIF(item->>'service',''),NULLIF(item->>'deliverable',''),NULLIF(item->>'title',''),'בדיקת הסעיף וההתחייבויות בנוסח החתום')||CASE WHEN responsibility IS NULL THEN ' — נדרשת בדיקת המקור החתום; לא נקבע צד אחראי או חוב כספי אוטומטי.' ELSE '' END);
   IF responsibility IS NOT NULL THEN obligation_data:=obligation_data||pg_catalog.jsonb_build_object('party',responsibility);END IF;
   IF responsibility IS NOT NULL AND group_name IN ('sharedExpenses','milestones') AND item ? 'amount' THEN obligation_data:=obligation_data||pg_catalog.jsonb_build_object('amount',item->>'amount');END IF;
   IF responsibility IS NOT NULL AND COALESCE(item->>'currency',v.data->>'currency') IS NOT NULL THEN obligation_data:=obligation_data||pg_catalog.jsonb_build_object('currency',COALESCE(item->>'currency',v.data->>'currency'));END IF;
   IF item ? 'dueDate' THEN obligation_data:=obligation_data||pg_catalog.jsonb_build_object('dueDate',item->>'dueDate');END IF;
   INSERT INTO research_private.partnership_records(study_id,partner_id,kind) VALUES(r.study_id,r.partner_id,'obligation') RETURNING id INTO obligation_id;
   INSERT INTO research_private.partnership_versions(study_id,partner_id,record_id,number,data,content_hash,proposed_by) VALUES(r.study_id,r.partner_id,obligation_id,1,obligation_data,research_private.partnership_hash(obligation_data),'verified-execution') RETURNING id INTO version_id;
   UPDATE research_private.partnership_records SET head_version_id=version_id,revision=1 WHERE id=obligation_id;
  END LOOP;
 END LOOP;
END $f$;
GRANT CREATE ON SCHEMA research_private TO research_worker;
ALTER FUNCTION research_private.partnership_contract() OWNER TO research_worker;
ALTER FUNCTION research_private.partnership_impact_auth(text) OWNER TO research_worker;
ALTER FUNCTION research_private.partnership_copy_allowed(research_private.partnership_copy_outbox,text,text) OWNER TO research_worker;
ALTER FUNCTION research_private.partnership_work_lease(uuid,uuid) OWNER TO research_worker;
ALTER FUNCTION research_private.partnership_copy_intents(research_private.partnership_executions) OWNER TO research_worker;
ALTER FUNCTION research_private.partnership_workspace(research_private.studies,research_private.partnership_partners,text,text,text) OWNER TO research_worker;
ALTER FUNCTION research_private.partnership_dispatch(text,text,jsonb) OWNER TO research_worker;
REVOKE CREATE ON SCHEMA research_private FROM research_worker;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_private FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA research_private TO research_worker;
GRANT EXECUTE ON FUNCTION research_private.dispatch(text,text,jsonb),research_private.partnership_dispatch(text,text,jsonb),research_private.intake_dispatch(text,text,jsonb),research_private.intake_reset() TO service_role;
COMMIT;
