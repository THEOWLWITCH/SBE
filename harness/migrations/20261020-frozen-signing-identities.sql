BEGIN;
ALTER TABLE research_private.partnership_signings ADD COLUMN signer_parties_hash text CHECK(signer_parties_hash~'^[a-f0-9]{64}$');

-- Only email casing/outer whitespace is normalized. Names and authority remain
-- exact, and the partner identity comes from the signing's scoped foreign key.
CREATE FUNCTION research_private.signing_identity_hash(pid uuid,parties jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $f$
 SELECT research_private.partnership_hash(pg_catalog.jsonb_build_object('owner',pg_catalog.jsonb_build_object('name',parties#>>'{owner,name}','email',pg_catalog.lower(pg_catalog.btrim(parties#>>'{owner,email}')),'authority',parties#>>'{owner,authority}'),'partner',pg_catalog.jsonb_build_object('id',pid,'name',parties#>>'{partner,name}','email',pg_catalog.lower(pg_catalog.btrim(parties#>>'{partner,email}')),'authority',parties#>>'{partner,authority}'))) $f$;
CREATE FUNCTION research_private.signing_current_identity_hash(sid uuid,pid uuid,vid uuid) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $f$
 SELECT research_private.signing_identity_hash(pid,pg_catalog.jsonb_build_object('owner',pg_catalog.jsonb_build_object('name',v.data->>'ownerSignatory','email',v.data->>'ownerEmail','authority',v.data->>'ownerAuthority'),'partner',pg_catalog.jsonb_build_object('name',v.data->>'partnerSignatory','email',p.profile->>'email','authority',v.data->>'partnerAuthority'))) FROM research_private.partnership_versions v JOIN research_private.partnership_partners p ON p.id=pid WHERE v.id=vid AND v.study_id=sid AND v.partner_id=pid $f$;
CREATE FUNCTION research_private.signing_verified_identity_hash(pid uuid,signers jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $f$
BEGIN
 IF pg_catalog.jsonb_typeof(signers) IS DISTINCT FROM 'array' OR pg_catalog.jsonb_array_length(signers)<>2 OR (SELECT pg_catalog.count(DISTINCT s->>'party') FROM pg_catalog.jsonb_array_elements(signers) s WHERE s->>'party' IN ('owner','partner'))<>2 THEN PERFORM research_private.fail('invalid');END IF;
 RETURN research_private.signing_identity_hash(pid,pg_catalog.jsonb_build_object('owner',(SELECT s FROM pg_catalog.jsonb_array_elements(signers) s WHERE s->>'party'='owner'),'partner',(SELECT s FROM pg_catalog.jsonb_array_elements(signers) s WHERE s->>'party'='partner')));
END $f$;
CREATE FUNCTION research_private.signing_prepare_identity_hash(sid uuid,pid uuid,vid uuid,payload jsonb) RETURNS text LANGUAGE plpgsql STABLE SET search_path='' AS $f$
DECLARE frozen text:=research_private.signing_current_identity_hash(sid,pid,vid);i research_private.signing_intents;BEGIN
 IF frozen IS NULL OR payload ? 'signerPartiesHash' AND payload->>'signerPartiesHash' IS DISTINCT FROM frozen THEN PERFORM research_private.fail('conflict');END IF;
 IF payload->>'providerSessionId' LIKE 'signwell/%' THEN
  SELECT * INTO i FROM research_private.signing_intents x WHERE x.study_id=sid AND x.partner_id=pid AND x.version_id=vid AND 'signwell/'||x.provider_session_id=payload->>'providerSessionId';
  IF i.id IS NULL OR i.state<>'created' OR i.signing_id IS NOT NULL OR i.document_hash IS DISTINCT FROM payload->>'documentHash' OR i.provider_document_hash IS DISTINCT FROM payload->>'providerDocumentHash' OR i.authority_policy_hash IS DISTINCT FROM payload->>'authorityPolicyHash' OR i.parties_hash IS DISTINCT FROM research_private.signing_parties_hash(sid,pid,vid) THEN PERFORM research_private.fail('conflict');END IF;
 ELSIF payload->>'signerPartiesHash' IS NULL OR payload->>'signerPartiesHash'!~'^[a-f0-9]{64}$' THEN PERFORM research_private.fail('invalid');
 END IF;
 RETURN frozen;
END $f$;

-- Legacy sessions are bound only to the same authenticated encrypted state
-- already checked by the trusted provider verifier, never today's profile.
CREATE FUNCTION research_private.signing_completion_identity_hash(s research_private.partnership_signings,proof jsonb) RETURNS text LANGUAGE plpgsql STABLE SET search_path='' AS $f$
BEGIN
 IF s.signer_parties_hash IS NULL OR proof IS NOT NULL THEN
  IF pg_catalog.jsonb_typeof(proof) IS DISTINCT FROM 'object' OR proof->>'provider' IS DISTINCT FROM s.provider OR proof->>'providerSessionId' IS DISTINCT FROM s.provider_session_id OR proof->>'versionId' IS DISTINCT FROM s.version_id::text OR proof->>'documentHash' IS DISTINCT FROM s.document_hash OR proof->>'providerDocumentHash' IS DISTINCT FROM s.provider_document_hash OR proof->>'authorityPolicyHash' IS DISTINCT FROM s.authority_policy_hash OR proof->>'providerStateHash' IS DISTINCT FROM research_private.partnership_hash(s.provider_state_ciphertext) OR proof->>'partiesHash' IS NULL OR proof->>'partiesHash'!~'^[a-f0-9]{64}$' OR s.signer_parties_hash IS NOT NULL AND proof->>'partiesHash' IS DISTINCT FROM s.signer_parties_hash THEN PERFORM research_private.fail('invalid');END IF;
  RETURN proof->>'partiesHash';
 END IF;
 RETURN s.signer_parties_hash;
END $f$;
CREATE FUNCTION research_private.signing_identity_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 IF NEW.signer_parties_hash IS DISTINCT FROM OLD.signer_parties_hash THEN
  -- A legacy NULL can be filled only after the exact immutable execution was
  -- inserted in this same completion transaction. No temporary GUC is used.
  IF OLD.signer_parties_hash IS NOT NULL OR NEW.signer_parties_hash IS NULL OR NOT EXISTS(SELECT 1 FROM research_private.partnership_executions e WHERE e.signing_id=OLD.id AND e.study_id=OLD.study_id AND e.partner_id=OLD.partner_id AND e.record_id=OLD.record_id AND e.version_id=OLD.version_id AND e.document_hash=OLD.document_hash AND research_private.signing_verified_identity_hash(OLD.partner_id,e.verified_signers)=NEW.signer_parties_hash) THEN PERFORM research_private.fail('immutable');END IF;
 END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER signing_identity_immutable BEFORE UPDATE ON research_private.partnership_signings FOR EACH ROW EXECUTE FUNCTION research_private.signing_identity_immutable();

CREATE OR REPLACE FUNCTION research_private.partnership_dispatch_before_guided(p_token text,p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
#variable_conflict use_variable
DECLARE auth jsonb; actor text; owner_actor boolean; internal_actor boolean:=p_action IN ('signingPrepare','signingEvidencePut','signingEventContext','signingStateUpdate','signatureComplete'); sid uuid; pid uuid; self_id uuid; s research_private.studies; p research_private.partnership_partners; member research_private.memberships; r research_private.partnership_records; v research_private.partnership_versions; from_v research_private.partnership_versions; review research_private.partnership_reviews; approval research_private.partnership_approvals; invitation research_private.partnership_invitations; document research_private.partnership_documents; signing research_private.partnership_signings; snap research_private.partnership_snapshots; receipt research_private.partnership_receipts; result jsonb; items jsonb; partners jsonb; studies jsonb; workspaces jsonb; data jsonb; template jsonb; permitted text[]; viewers uuid[]; downloaders uuid[]; ids uuid[]; label text; key_name text; kind_name text; next_status text; hash text; scope_key text; request_id uuid; mutation boolean; author_actor boolean; can_view boolean; can_download boolean; party text; binding_source research_private.partnership_records; rr record; vars text[]; summary jsonb; provenance jsonb; created_version uuid; created_record uuid; consent_id uuid; expected integer; source_rows jsonb; signer_hash text;
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
     INSERT INTO research_private.partnership_signings(study_id,partner_id,record_id,version_id,document_hash,provider_session_id,provider_document_hash,provider_state_ciphertext,authority_policy_hash,expires_at,signer_parties_hash) VALUES(sid,pid,r.id,v.id,v.content_hash,p_payload->>'providerSessionId',p_payload->>'providerDocumentHash',p_payload->'providerStateCiphertext',p_payload->>'authorityPolicyHash',(p_payload->>'expiresAt')::timestamptz,research_private.signing_prepare_identity_hash(sid,pid,v.id,p_payload)) RETURNING * INTO signing;
     UPDATE research_private.partnership_records SET status='signing',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=r.id RETURNING * INTO r;result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'signing',research_private.partnership_signing(signing));
    END IF;
   ELSE
    SELECT * INTO signing FROM research_private.partnership_signings sg WHERE sg.id=(p_payload->>'signingId')::uuid AND sg.record_id=r.id AND sg.study_id=sid AND sg.partner_id=pid FOR UPDATE;
    IF signing.id IS NULL THEN PERFORM research_private.fail('not_found'); END IF;
    IF p_action='signatureComplete' THEN
     IF signing.state='completed' THEN IF EXISTS(SELECT 1 FROM research_private.partnership_executions e WHERE e.signing_id=signing.id AND e.provider_event_id=p_payload->>'providerEventId') THEN result:=pg_catalog.jsonb_build_object('record',research_private.partnership_record(r),'signing',research_private.partnership_signing(signing));ELSE PERFORM research_private.fail('conflict'); END IF;
     ELSE
      signer_hash:=research_private.signing_completion_identity_hash(signing,p_payload->'signerBinding');
      IF r.status<>'signing' OR signing.version_id IS DISTINCT FROM r.head_version_id OR signing.version_id IS DISTINCT FROM v.id OR signing.document_hash IS DISTINCT FROM p_payload->>'documentHash' OR (p_payload->>'completedAt')::timestamptz>signing.expires_at OR p_payload->>'finalDocumentHash'!~'^[a-f0-9]{64}$' OR pg_catalog.length(COALESCE(p_payload->>'providerEventId','')) NOT BETWEEN 1 AND 240 OR pg_catalog.jsonb_typeof(p_payload->'verifiedSigners')<>'array' OR pg_catalog.jsonb_array_length(p_payload->'verifiedSigners')<>2 OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_payload->'verifiedSigners') si WHERE si->>'party'='owner') OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_payload->'verifiedSigners') si WHERE si->>'party'='partner') THEN PERFORM research_private.fail('invalid'); END IF;
      IF research_private.signing_verified_identity_hash(signing.partner_id,p_payload->'verifiedSigners') IS DISTINCT FROM signer_hash THEN PERFORM research_private.fail('invalid');END IF;
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_payload->'verifiedSigners') si WHERE si->'identityVerified' IS DISTINCT FROM 'true'::jsonb OR si->'consent' IS DISTINCT FROM 'true'::jsonb OR pg_catalog.btrim(COALESCE(si->>'recipientId',''))='' OR pg_catalog.btrim(COALESCE(si->>'name',''))='' OR pg_catalog.btrim(COALESCE(si->>'authority',''))='' OR si->>'name' IS DISTINCT FROM CASE WHEN si->>'party'='owner' THEN v.data->>'ownerSignatory' ELSE v.data->>'partnerSignatory' END OR si->>'authority' IS DISTINCT FROM CASE WHEN si->>'party'='owner' THEN v.data->>'ownerAuthority' ELSE v.data->>'partnerAuthority' END OR (si->>'signedAt')::timestamptz>(p_payload->>'completedAt')::timestamptz) OR (p_payload->>'completedAt')::timestamptz>CURRENT_TIMESTAMP+INTERVAL '5 minutes' THEN PERFORM research_private.fail('invalid'); END IF;
      IF NOT EXISTS(SELECT 1 FROM research_private.partnership_documents d WHERE d.id=(p_payload->>'finalDocumentId')::uuid AND d.study_id=sid AND d.partner_id=pid AND d.record_id=r.id AND d.signing_id=signing.id AND d.evidence_purpose='final' AND d.sha256=p_payload->>'finalDocumentHash') OR NOT EXISTS(SELECT 1 FROM research_private.partnership_documents d WHERE d.id=(p_payload->>'auditCertificateDocumentId')::uuid AND d.study_id=sid AND d.partner_id=pid AND d.record_id=r.id AND d.signing_id=signing.id AND d.evidence_purpose='certificate') THEN PERFORM research_private.fail('not_found'); END IF;
      INSERT INTO research_private.partnership_executions(study_id,partner_id,record_id,version_id,signing_id,document_hash,provider_event_id,final_document_id,final_document_hash,audit_document_id,verified_signers,completed_at) VALUES(sid,pid,r.id,v.id,signing.id,signing.document_hash,p_payload->>'providerEventId',(p_payload->>'finalDocumentId')::uuid,p_payload->>'finalDocumentHash',(p_payload->>'auditCertificateDocumentId')::uuid,p_payload->'verifiedSigners',(p_payload->>'completedAt')::timestamptz);
      PERFORM research_private.partnership_extract(r,v);
      UPDATE research_private.partnership_records SET status='executed',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=r.id RETURNING * INTO r;UPDATE research_private.partnership_signings SET signer_parties_hash=signer_hash,state='completed',completed_at=(p_payload->>'completedAt')::timestamptz,provider_checked_at=CURRENT_TIMESTAMP WHERE id=signing.id RETURNING * INTO signing;
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

ALTER FUNCTION research_private.partnership_dispatch(text,text,jsonb) RENAME TO partnership_dispatch_before_signer_identity;
CREATE FUNCTION research_private.partnership_dispatch(p_token text,p_action text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE a jsonb;r research_private.partnership_records;v research_private.partnership_versions;s research_private.partnership_signings;expected text;BEGIN
 IF p_action='signingTransferAuthorize' AND NOT(p_payload ? 'intentId') THEN
  a:=research_private.guided_auth(p_token,(p_payload->>'studyId')::uuid,(p_payload->>'partnerId')::uuid);
  PERFORM pg_catalog.set_config('research.owner','true',true);PERFORM pg_catalog.set_config('research.signing','true',true);
  SELECT * INTO r FROM research_private.partnership_records x WHERE x.id=(p_payload->>'recordId')::uuid AND x.study_id=(p_payload->>'studyId')::uuid AND x.partner_id=(p_payload->>'partnerId')::uuid AND x.kind='agreement' FOR SHARE;
  SELECT * INTO v FROM research_private.partnership_versions x WHERE x.id=r.head_version_id;
  IF r.id IS NULL OR v.id IS DISTINCT FROM (p_payload->>'versionId')::uuid OR v.content_hash IS DISTINCT FROM p_payload->>'documentHash' THEN PERFORM research_private.fail('conflict');END IF;
  IF p_payload ? 'signingId' THEN
   SELECT * INTO s FROM research_private.partnership_signings x WHERE x.id=(p_payload->>'signingId')::uuid AND x.record_id=r.id AND x.study_id=r.study_id AND x.partner_id=r.partner_id AND x.version_id=v.id AND x.document_hash=v.content_hash;
   IF s.id IS NULL OR s.provider<>'docusign' OR r.status<>'signing' OR s.state='completed' OR s.expires_at<=CURRENT_TIMESTAMP THEN PERFORM research_private.fail('conflict');END IF;
   expected:=research_private.signing_completion_identity_hash(s,p_payload->'signerBinding');
  ELSE
   IF NOT COALESCE((a->>'owner')::boolean,false) OR r.status<>'approved' OR r.approved_version_id IS DISTINCT FROM v.id OR (SELECT pg_catalog.count(*) FROM research_private.partnership_approvals x WHERE x.record_id=r.id AND x.version_id=v.id AND x.document_hash=v.content_hash)<>2 THEN PERFORM research_private.fail('conflict');END IF;
   expected:=research_private.signing_current_identity_hash(r.study_id,r.partner_id,v.id);
  END IF;
  -- Last-moment authorization uses the original preflight or issued identity;
  -- contact changes can preserve old evidence but cannot disclose a new copy.
  IF expected IS NULL OR expected IS DISTINCT FROM p_payload->>'signerPartiesHash' OR expected IS DISTINCT FROM research_private.signing_current_identity_hash(r.study_id,r.partner_id,v.id) THEN PERFORM research_private.fail('conflict');END IF;
 END IF;
 RETURN research_private.partnership_dispatch_before_signer_identity(p_token,p_action,p_payload);
EXCEPTION WHEN SQLSTATE 'P0001' THEN PERFORM research_private.intake_reset();RETURN pg_catalog.jsonb_build_object('error',SQLERRM,'status',CASE SQLERRM WHEN 'not_found' THEN 404 WHEN 'unauthorized' THEN 403 WHEN 'conflict' THEN 409 WHEN 'not_configured' THEN 503 ELSE 400 END);
 WHEN invalid_text_representation OR invalid_parameter_value THEN PERFORM research_private.intake_reset();RETURN '{"error":"invalid","status":400}'::jsonb;
END $f$;
GRANT CREATE ON SCHEMA research_private TO research_worker;
ALTER FUNCTION research_private.signing_identity_hash(uuid,jsonb) OWNER TO research_worker;
ALTER FUNCTION research_private.signing_current_identity_hash(uuid,uuid,uuid) OWNER TO research_worker;
ALTER FUNCTION research_private.signing_verified_identity_hash(uuid,jsonb) OWNER TO research_worker;
ALTER FUNCTION research_private.signing_prepare_identity_hash(uuid,uuid,uuid,jsonb) OWNER TO research_worker;
ALTER FUNCTION research_private.signing_completion_identity_hash(research_private.partnership_signings,jsonb) OWNER TO research_worker;
ALTER FUNCTION research_private.signing_identity_immutable() OWNER TO research_worker;
ALTER FUNCTION research_private.partnership_dispatch_before_guided(text,text,jsonb) OWNER TO research_worker;
ALTER FUNCTION research_private.partnership_dispatch(text,text,jsonb) OWNER TO research_worker;
REVOKE CREATE ON SCHEMA research_private FROM research_worker;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research_private FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA research_private TO research_worker;
GRANT EXECUTE ON FUNCTION research_private.dispatch(text,text,jsonb),research_private.partnership_dispatch(text,text,jsonb),research_private.intake_dispatch(text,text,jsonb),research_private.intake_reset() TO service_role;
COMMIT;
