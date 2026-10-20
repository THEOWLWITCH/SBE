import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createSignWellAdapter } from '../lib/research-signwell.mjs';
import { contentHash } from '../lib/research-partnership-exports.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const finalBytes=Buffer.from('%PDF-1.7\nSynthetic completed agreement only');
const certificate=Buffer.from('%PDF-1.7\nIndependent synthetic certificate only');
const fixedNow=Date.parse('2026-10-20T10:00:00Z');
function fixture({testMode=false,verify,fetchImpl}={}){
 const parties={owner:{name:'Synthetic Owner',email:'owner@example.invalid',authority:'Synthetic owner authority'},partner:{name:'Synthetic Partner',email:'partner@example.invalid',authority:'Synthetic institutional authority'}};
 const policy={approved:true,institutionRequirementsReviewed:true,version:'synthetic-policy-v1',signerAuthorities:Object.values(parties)};
 const context={record:{id:randomUUID()},version:{id:randomUUID(),contentHash:'a'.repeat(64)},parties,contentBase64:Buffer.from('PK\x03\x04 synthetic docx source only','binary').toString('base64'),documentHash:'a'.repeat(64),consent:true,requestId:randomUUID()};
 const calls=[],providerId=randomUUID();let created,status='Draft',mutation,artifactResponse,verifiedInput;
 const assurance={operational:true,version:'synthetic-assurance-v1',policyHash:contentHash(policy),capabilities:{identity:true,authority:true,consent:true,certificate:true,delivery:true},verify:async input=>{
  verifiedInput=input;
  if(verify)return verify(input);
  return {provider:'signwell',providerSessionId:input.providerSessionId,recordId:input.recordId,versionId:input.versionId,documentHash:input.documentHash,providerDocumentHash:input.providerDocumentHash,authorityPolicyHash:input.authorityPolicyHash,assuranceVersion:input.assuranceVersion,finalDocumentHash:sha(input.finalDocument),completedAt:'2026-10-20T09:59:59Z',verifiedSigners:input.expectedSigners.map(s=>({...s,identityVerified:true,authorityVerified:true,consent:true,signedAt:'2026-10-20T09:59:58Z'})),auditCertificate:certificate,certificateVerified:true,deliveryVerified:true};
 }};
 const responseDocument=()=>{
  const doc={id:providerId,test_mode:testMode,status,embedded_signing:true,allow_reassign:false,metadata:created?.metadata,recipients:created?.recipients.map(s=>({id:s.id,email:s.email,name:s.name,status:'completed',embedded_signing_url:'https://www.signwell.com/docs/synthetic'+s.id+'/',passcode:'NEVER_PERSIST_PASSCODE'})),embedded_edit_url:'https://www.signwell.com/docs/NEVER_PERSIST_EDIT/',error_message:'NEVER_EXPOSE_PROVIDER_MESSAGE'};
  return mutation?mutation(doc):doc;
 };
 const options={env:{},now:()=>fixedNow,signing:{apiKey:'synthetic-key-never-live',testMode},signingPolicy:policy,signwellAssurance:assurance,signingFetchImpl:async(url,init)=>{
  calls.push({url,method:init.method,headers:init.headers,body:init.body,redirect:init.redirect,signal:init.signal});
  if(fetchImpl)return fetchImpl(url,init);
  if(init.method==='POST'&&url.endsWith('/documents')){created=JSON.parse(init.body);return Response.json(responseDocument(),{status:201});}
  if(init.method==='POST'&&url.endsWith('/send')){status='Sent';return Response.json(responseDocument(),{status:201});}
  if(url.includes('/completed_pdf?'))return artifactResponse?artifactResponse():new Response(finalBytes,{headers:{'Content-Type':'application/pdf'}});
  return Response.json(responseDocument());
 }};
 const adapter=createSignWellAdapter(options);
 return {adapter,options,context,calls,policy,assurance,providerId,get created(){return created;},get verifiedInput(){return verifiedInput;},set status(v){status=v;},set mutation(v){mutation=v;},set artifactResponse(v){artifactResponse=v;}};
}
async function draft(f){return f.adapter.createDraft(f.adapter.buildIntent(f.context),f.context.contentBase64);}

test('SignWell readiness is fail closed with no operational independent assurance and makes zero calls',async()=>{
 const f=fixture();
 const cases=[{}, {...f.options,signing:{testMode:false}}, {...f.options,signingPolicy:{...f.policy,approved:false}}, {...f.options,signingPolicy:{...f.policy,signerAuthorities:[null,null]}}, {...f.options,signwellAssurance:undefined}, {...f.options,signwellAssurance:{...f.assurance,operational:false}}, {...f.options,signwellAssurance:{...f.assurance,verify:undefined}}, {...f.options,signwellAssurance:{...f.assurance,policyHash:'b'.repeat(64)}}, ...Object.keys(f.assurance.capabilities).map(k=>({...f.options,signwellAssurance:{...f.assurance,capabilities:{...f.assurance.capabilities,[k]:false}}}))];
 for(const options of cases){const adapter=createSignWellAdapter({...options,env:{},signingFetchImpl:f.options.signingFetchImpl});assert.equal(adapter.readiness().configured,false);assert.throws(()=>adapter.buildIntent(f.context),e=>e.code==='not_configured');await assert.rejects(adapter.createDraft({},f.context.contentBase64),e=>e.code==='not_configured');assert.throws(()=>adapter.transferDescriptor(),e=>e.code==='not_configured');}
 assert.equal(f.calls.length,0);assert.equal(f.adapter.provider,'signwell');assert.equal(f.adapter.readiness().configured,true);assert.deepEqual(f.adapter.transferDescriptor(),{provider:'signwell',version:f.policy.version});
 assert.throws(()=>f.adapter.verifyEvent(Buffer.from('{}'),{}),e=>e.code==='not_configured');assert.equal(f.calls.length,0);
});
test('pure intent binds exact source bytes, version, explicit consent and approved authorities without credentials',()=>{
 const f=fixture(),intentId=randomUUID(),state=f.adapter.buildIntent({...f.context,intentId});assert.equal(state.intentId,intentId);assert.equal(state.providerDocumentHash,sha(Buffer.from(f.context.contentBase64,'base64')));assert.equal(state.documentHash,f.context.version.contentHash);assert.equal(state.authorityPolicyHash,contentHash(f.policy));assert.deepEqual(state.signers.map(s=>s.party),['owner','partner']);assert.equal(state.expiresAt,'2026-10-27T10:00:00.000Z');assert.equal(f.calls.length,0);assert.doesNotMatch(JSON.stringify(state),/synthetic-key|contentBase64|PASSCODE|https:/);
 for(const change of [{consent:false},{documentHash:'b'.repeat(64)},{contentBase64:'YWJj'},{contentBase64:'%%%='},{parties:{...f.context.parties,partner:{...f.context.parties.partner,authority:'unapproved'}}},{parties:{...f.context.parties,partner:f.context.parties.owner}},{requestId:'bad'}])assert.throws(()=>f.adapter.buildIntent({...f.context,...change}),e=>['invalid','not_configured'].includes(e.code));
});
test('draft creation transmits exact DOCX once, never signs or publishes and persists only allowlisted state',async()=>{
 const f=fixture({testMode:true}),state=await draft(f),body=f.created;assert.equal(state.providerSessionId,f.providerId);assert.equal(state.providerStatus,'Draft');assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,'POST');assert.equal(f.calls[0].url,'https://www.signwell.com/api/v1/documents');assert.equal(f.calls[0].redirect,'error');assert.ok(f.calls[0].signal instanceof AbortSignal);assert.equal(f.calls[0].headers['X-TestMode-Enabled'],'true');assert.equal(f.calls[0].headers['X-Api-Key'],'synthetic-key-never-live');assert.equal(body.test_mode,true);assert.equal(body.draft,true);assert.equal(body.embedded_signing,true);assert.equal(body.self_sign,false);assert.equal(body.with_signature_page,true);assert.equal(body.allow_reassign,false);assert.equal(body.reminders,false);assert.equal(body.embedded_signing_notifications,false);assert.deepEqual(body.files,[{name:'research-agreement.docx',file_base64:f.context.contentBase64}]);assert.ok(body.recipients.every(s=>s.send_email===false));assert.equal(body.recipients.length,2);assert.doesNotMatch(JSON.stringify(body.metadata),/example\.invalid|Synthetic Owner|Synthetic Partner/);assert.doesNotMatch(JSON.stringify(state),/PASSCODE|NEVER_|https:|contentBase64|synthetic-key/);
 await assert.rejects(f.adapter.createDraft(state,f.context.contentBase64),e=>e.code==='conflict');assert.equal(f.calls.length,1);const before=f.calls.length;await assert.rejects(f.adapter.createDraft(f.adapter.buildIntent(f.context),Buffer.from('PK\x03\x04 changed','binary').toString('base64')),e=>e.code==='conflict');assert.equal(f.calls.length,before);
});
test('bounded DOCX validation handles realistic source size without regex stack exhaustion',()=>{
 const f=fixture(),bytes=Buffer.alloc(1024*1024,65);Buffer.from([0x50,0x4b,0x03,0x04]).copy(bytes);
 const state=f.adapter.buildIntent({...f.context,contentBase64:bytes.toString('base64')});assert.equal(state.providerDocumentHash,sha(bytes));assert.equal(f.calls.length,0);
 assert.throws(()=>f.adapter.buildIntent({...f.context,contentBase64:Buffer.alloc(8*1024*1024+1,65).toString('base64')}),e=>e.code==='invalid');
});
test('only exact stored ID, environment, metadata and two approved parties are accepted on every read',async()=>{
 const f=fixture(),state=await draft(f);
 for(const mutation of [d=>({...d,id:randomUUID()}),d=>({...d,test_mode:true}),d=>({...d,embedded_signing:false}),d=>({...d,allow_reassign:true}),d=>({...d,metadata:{...d.metadata,begood_source_hash:'b'.repeat(64)}}),d=>({...d,metadata:{...d.metadata,begood_version_hash:'b'.repeat(64)}}),d=>({...d,recipients:[null,d.recipients[1]]}),d=>({...d,recipients:[d.recipients[0],d.recipients[0]]}),d=>({...d,recipients:[...d.recipients,{id:'3',email:'third@example.invalid',name:'Third'}]}),d=>({...d,recipients:d.recipients.map((r,i)=>i?{...r,email:42}:r)}),d=>({...d,recipients:d.recipients.map((r,i)=>i?{...r,email:'other@example.invalid'}:r)}),d=>({...d,status:'Unknown new status'})]){f.mutation=mutation;await assert.rejects(f.adapter.readDraft(state),e=>e.code==='conflict');}
 f.mutation=undefined;for(const status of ['Draft','Created','Sending','Sent','Pending','Viewed','Completed','Manually completed','Declined','Canceled','Bounced','Blocked','Error','Expired']){f.status=status;assert.equal((await f.adapter.readDraft(state)).providerStatus,status);}
 const before=f.calls.length;await assert.rejects(f.adapter.readDraft({...state,providerSessionId:'https://evil.invalid/'}),e=>e.code==='conflict');assert.equal(f.calls.length,before);
});
test('publishing requires caller durable claim, rechecks stored draft and never retries a mutation',async()=>{
 const f=fixture({testMode:true}),state=await draft(f),before=f.calls.length;const sent=await f.adapter.send(state);assert.equal(sent.providerStatus,'Sent');assert.equal(f.calls.length,before+1,'no provider await between the caller durable claim and POST');const sendCall=f.calls.find(c=>c.url.endsWith('/send'));assert.equal(sendCall.method,'POST');assert.equal(JSON.parse(sendCall.body).test_mode,true);assert.equal(sendCall.headers['X-TestMode-Enabled'],'true');assert.equal(JSON.parse(sendCall.body).embedded_signing,true);assert.equal(JSON.parse(sendCall.body).allow_reassign,false);assert.equal(JSON.parse(sendCall.body).reminders,false);assert.equal(f.calls.filter(c=>c.url.endsWith('/send')).length,1);await assert.rejects(f.adapter.send(sent),e=>e.code==='conflict');assert.equal(f.calls.filter(c=>c.url.endsWith('/send')).length,1,'already sent response never repeats send');
 let mutations=0;const lost=fixture({fetchImpl:async(_url,init)=>{if(init.method==='POST')mutations++;throw new Error('secret raw provider URL token');}});await assert.rejects(draft(lost),e=>e.code==='unavailable'&&e.message==='unavailable');assert.equal(mutations,1);
});
test('signer views use only GET and return only SQL-selected party strict embedded URL',async()=>{
 const f=fixture(),state=await draft(f);await assert.rejects(f.adapter.view(state,'partner'),e=>e.code==='conflict');f.status='Sent';const before=f.calls.length,view=await f.adapter.view(state,'partner');assert.equal(view.embeddedUrl,'https://www.signwell.com/docs/synthetic2/');assert.ok(f.calls.slice(before).every(c=>c.method==='GET'));assert.deepEqual(Object.keys(view).sort(),['embeddedUrl','expiresAt']);
 await assert.rejects(f.adapter.view(state,'unknown'),e=>e.code==='unauthorized');for(const url of ['http://www.signwell.com/docs/x/','https://signwell.com/docs/x/','https://www.signwell.com.evil.invalid/docs/x/','https://user:pass@www.signwell.com/docs/x/','https://www.signwell.com/docs/x/?token=secret','https://www.signwell.com/docs/x/#fragment','https://www.signwell.com/docs/x/extra','https://www.signwell.com/docs/%2f/','https://www.signwell.com:444/docs/x/']){f.mutation=d=>({...d,recipients:d.recipients.map(r=>r.id==='2'?{...r,embedded_signing_url:url}:r)});await assert.rejects(f.adapter.view(state,'partner'),e=>e.code==='unavailable');}
});
test('a lost publish response is reconciled on the same stored provider ID without another POST',async()=>{
 const f=fixture(),state=await draft(f);let lose=true;
 const options={...f.options,signingFetchImpl:async(url,init)=>{const response=await f.options.signingFetchImpl(url,init);if(url.endsWith('/send')&&lose){lose=false;throw new Error('synthetic lost response with secret URL');}return response;}};
 await assert.rejects(createSignWellAdapter(options).send(state),e=>e.code==='unavailable'&&e.message==='unavailable');
 const restarted=createSignWellAdapter(options),recovered=await restarted.readDraft(state);assert.equal(recovered.providerStatus,'Sent');await assert.rejects(restarted.send(recovered),e=>e.code==='conflict');assert.equal(f.calls.filter(c=>c.url.endsWith('/send')).length,1);assert.equal(f.calls.filter(c=>c.method==='POST'&&c.url.endsWith('/documents')).length,1);
});
test('provider completion and forged booleans never substitute for independent complete evidence',async()=>{
 const f=fixture({verify:async()=>({identityVerified:true,certificateVerified:true,deliveryVerified:true,auditCertificate:certificate})}),state=await draft(f);f.status='Completed';assert.deepEqual(await f.adapter.refresh(state),{completed:false,state:'evidence_missing'});assert.ok(f.verifiedInput);assert.equal(f.verifiedInput.providerSessionId,state.providerSessionId);assert.equal(f.verifiedInput.versionId,state.versionId);assert.equal(f.verifiedInput.providerDocumentHash,state.providerDocumentHash);assert.ok(f.verifiedInput.finalDocument.equals(finalBytes));assert.equal(f.verifiedInput.finalDocumentHash,sha(finalBytes));assert.doesNotMatch(JSON.stringify({...f.verifiedInput,finalDocument:undefined}),/PASSCODE|NEVER_|https:|synthetic-key/);
 const test=fixture({testMode:true}),testState=await draft(test);test.status='Completed';assert.deepEqual(await test.adapter.refresh(testState),{completed:false,state:'evidence_missing'});assert.equal(test.calls.filter(c=>c.url.includes('/completed_pdf')).length,0);assert.equal(test.verifiedInput,undefined);
});
test('temporary final PDF problems remain artifact_pending and valid retry executes with independently bound certificate',async()=>{
 const f=fixture(),state=await draft(f);f.status='Completed';
 for(const response of [()=>new Response('not yet',{status:400}),()=>new Response('temporary',{status:429}),()=>new Response('',{headers:{'Content-Type':'application/pdf'}}),()=>new Response(finalBytes,{headers:{'Content-Type':'text/html'}}),()=>new Response('not a pdf',{headers:{'Content-Type':'application/pdf'}}),()=>new Response(finalBytes,{headers:{'Content-Type':'application/pdf','Content-Length':String(9*1024*1024)}})]){f.artifactResponse=response;assert.deepEqual(await f.adapter.refresh(state),{completed:false,state:'artifact_pending'});}
 f.artifactResponse=undefined;const result=await f.adapter.refresh(state);assert.equal(result.completed,true);assert.equal(result.state,'completed');assert.equal(result.completedAt,'2026-10-20T09:59:59Z');assert.ok(result.finalDocument.equals(finalBytes));assert.ok(result.auditCertificate.equals(certificate));assert.ok(result.verifiedSigners.every(s=>s.identityVerified&&s.authorityVerified&&s.consent));assert.equal(result.providerEventId,'signwell/'+state.providerSessionId+'/'+sha(certificate));assert.equal(result.certifiedSignature,undefined);assert.equal(result.secureSignature,undefined);
 assert.ok(f.calls.filter(c=>c.url.includes('/completed_pdf')).every(c=>c.url.endsWith('/completed_pdf?url_only=false&audit_page=true&file_format=pdf')));
});
test('strict completion verifier rejects each altered binding, party, consent, certificate and delivery signal',async()=>{
 const f=fixture(),state=await draft(f);f.status='Completed';
 const initial=await f.adapter.refresh(state);assert.equal(initial.completed,true);const baseline=await f.assurance.verify(f.verifiedInput);
 const changes=[{providerSessionId:randomUUID()},{recordId:randomUUID()},{versionId:randomUUID()},{documentHash:'b'.repeat(64)},{providerDocumentHash:'b'.repeat(64)},{authorityPolicyHash:'b'.repeat(64)},{assuranceVersion:'wrong'},{finalDocumentHash:'b'.repeat(64)},{completedAt:'not-a-date'},{certificateVerified:false},{deliveryVerified:false},{auditCertificate:finalBytes},{auditCertificate:Buffer.from('notpdf')},{verifiedSigners:[baseline.verifiedSigners[0],baseline.verifiedSigners[0]]},...['identityVerified','authorityVerified','consent'].map(key=>({verifiedSigners:baseline.verifiedSigners.map((s,i)=>i?{...s,[key]:false}:s)})),{verifiedSigners:baseline.verifiedSigners.map((s,i)=>i?{...s,authority:'different'}:s)},{verifiedSigners:baseline.verifiedSigners.map((s,i)=>i?{...s,email:'changed@example.invalid'}:s)}];
 for(const change of changes){const changed=createSignWellAdapter({...f.options,signwellAssurance:{...f.assurance,verify:async()=>({...baseline,...change})}});assert.deepEqual(await changed.refresh(state),{completed:false,state:'evidence_missing'},Object.keys(change).join(','));}
 const throwing=createSignWellAdapter({...f.options,signwellAssurance:{...f.assurance,verify:async()=>{throw new Error('raw sensitive evidence');}}});assert.deepEqual(await throwing.refresh(state),{completed:false,state:'evidence_missing'});
});
test('all known incomplete document statuses remain unexecuted and unknown/manual completion fail closed',async()=>{
 const f=fixture(),state=await draft(f),mapping={Draft:'awaiting_signers',Created:'awaiting_signers',Sending:'awaiting_signers',Sent:'awaiting_signers',Pending:'in_progress',Viewed:'in_progress',Declined:'declined',Canceled:'expired',Expired:'expired',Bounced:'verification_failed',Blocked:'verification_failed',Error:'verification_failed','Manually completed':'verification_failed'};
 for(const [status,wanted] of Object.entries(mapping)){f.status=status;assert.deepEqual(await f.adapter.refresh(state),{completed:false,state:wanted});}
 f.status='Future status';await assert.rejects(f.adapter.refresh(state),e=>e.code==='conflict');assert.equal(f.calls.filter(c=>c.url.includes('/completed_pdf')).length,0);
});
test('evidence timestamps reject normalized impossible calendar dates and preserve valid fractional UTC forms',async()=>{
 const f=fixture(),state=await draft(f);f.status='Completed';const initial=await f.adapter.refresh(state);assert.equal(initial.completed,true);const baseline=await f.assurance.verify(f.verifiedInput);
 const checked=evidence=>createSignWellAdapter({...f.options,signwellAssurance:{...f.assurance,verify:async()=>evidence}});
 for(const [completedAt,signedAt] of [['2026-02-30T09:59:59Z','2026-02-28T09:59:58Z'],['2026-04-31T09:59:59.1Z','2026-04-30T09:59:58.12Z'],['2025-02-29T09:59:59.123Z','2025-02-28T09:59:58Z']]){
  const result=await checked({...baseline,completedAt,verifiedSigners:baseline.verifiedSigners.map(s=>({...s,signedAt}))}).refresh(state);assert.deepEqual(result,{completed:false,state:'evidence_missing'},completedAt);
 }
 const invalidSigner={...baseline,verifiedSigners:baseline.verifiedSigners.map((s,i)=>i?{...s,signedAt:'2026-02-30T09:59:58Z'}:s)};assert.deepEqual(await checked(invalidSigner).refresh(state),{completed:false,state:'evidence_missing'});
 for(const completedAt of ['2026-10-20T09:59:59Z','2026-10-20T09:59:59.1Z','2026-10-20T09:59:59.12Z','2026-10-20T09:59:59.123Z']){
  const result=await checked({...baseline,completedAt,verifiedSigners:baseline.verifiedSigners.map(s=>({...s,signedAt:'2026-10-20T09:59:58.1Z'}))}).refresh(state);assert.equal(result.completed,true,completedAt);assert.equal(result.completedAt,completedAt);
 }
 const before=f.calls.length;await assert.rejects(f.adapter.readDraft({...state,expiresAt:'2026-02-30T10:00:00Z'}),e=>e.code==='conflict');assert.equal(f.calls.length,before);
});
test('bounded transport rejects redirects, oversized JSON and raw credential-bearing errors safely',async()=>{
 for(const response of [()=>new Response(null,{status:302,headers:{location:'https://evil.invalid'}}),()=>new Response('x'.repeat(262145),{headers:{'Content-Type':'application/json'}}),()=>new Response('{}',{headers:{'Content-Type':'text/html'}}),()=>new Response('{bad',{headers:{'Content-Type':'application/json'}}),()=>new Response('secret passcode URL',{status:422})]){const f=fixture({fetchImpl:async()=>response()});await assert.rejects(draft(f),e=>e.code==='unavailable'&&e.message==='unavailable');assert.equal(f.calls.length,1);assert.equal(f.calls[0].redirect,'error');}
});
