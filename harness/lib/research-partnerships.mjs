import { createHash, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { decryptResearchValue, encryptResearchValue, researchDigest } from './research-mail.mjs';
import { exportPartnership,contentHash } from './research-partnership-exports.mjs';
import {IMPACT_VERSIONS,minimizePartnershipImpact,impactRequest} from './research-partnership-impact.mjs';
import { createSigningAdapter, researchSigningWorkerToken } from './research-signing.mjs';
const require=createRequire(import.meta.url), CORE=require('../../app/lib/research-partnership-core.js'), BASE=require('../../app/lib/research-core.js');
const CLIENT=new Set(CORE.CLIENT_ACTIONS),READ=new Set(CORE.READ_ACTIONS);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const own=Object.hasOwn, fail=code=>{throw Object.assign(new Error(code),{code});},invalid=()=>fail('invalid');
const uuid=v=>{if(typeof v!=='string'||!UUID.test(v))invalid();return v.toLowerCase();};
const text=(v,max=20000)=>{if(typeof v!=='string'||v.length>max||v.includes('\0'))invalid();return v;};
const pick=(v,values)=>{if(!values.includes(v))invalid();return v;};
const integer=v=>{if(!Number.isSafeInteger(v)||v<0)invalid();return v;};
const ids=v=>{if(!Array.isArray(v)||v.length>200||new Set(v).size!==v.length)invalid();return v.map(uuid);};
const bool=v=>{if(typeof v!=='boolean')invalid();return v;};
const digest=v=>{if(typeof v!=='string'||!HASH.test(v))invalid();return v;};
const safeMessages={invalid:'אפשר לבדוק את הפרטים ולהשלים את השדות המסומנים.',unauthorized:'אין הרשאה לפעולה זו.',not_found:'הפריט אינו זמין.',conflict:'הגרסה השתנתה. אפשר לרענן לפני שמירה נוספת.',signed_original_required:'להורדת הסכם חתום יש לפתוח את העותק המקורי ותיעוד החתימה במסמכים הפרטיים שבתיק.',not_configured:'להשלמת הפעולה נדרשת הגדרת השירות בידי בעלת המערכת.',unavailable:'השירות אינו זמין כעת.'};
function signerPartiesHash(partnerId,parties){
 const exact=party=>{const p=parties?.[party];if(!p||typeof p.name!=='string'||!p.name.trim()||typeof p.authority!=='string'||!p.authority.trim()||typeof p.email!=='string'||!p.email.trim())fail('conflict');return {name:p.name,email:p.email.trim().toLowerCase(),authority:p.authority};};
 return contentHash({owner:exact('owner'),partner:{id:partnerId,...exact('partner')}});
}
function signerBinding(signing,scope,state,ciphertext){
 if(state?.provider!==signing.provider||state.versionId!==signing.versionId||state.documentHash!==signing.documentHash)fail('conflict');
 if(!Array.isArray(state?.signers)||state.signers.length!==2||new Set(state.signers.map(p=>p.party)).size!==2||!state.signers.every(p=>['owner','partner'].includes(p.party)))fail('conflict');
 const parties=Object.fromEntries(state.signers.map(p=>[p.party,p]));
 // Use the SAME authenticated envelope/state used for provider verification.
 // A legacy session must never be reconstructed from today's contact profile.
 return {provider:state.provider,providerSessionId:state.provider==='signwell'?'signwell/'+state.providerSessionId:state.providerSessionId,versionId:state.versionId,documentHash:state.documentHash,providerDocumentHash:state.providerDocumentHash,authorityPolicyHash:state.authorityPolicyHash,providerStateHash:contentHash(ciphertext),partiesHash:signerPartiesHash(scope.partnerId,parties)};
}
export const isPartnershipAction=action=>CLIENT.has(action);
export function validatePartnershipPayload(body){
 const action=body.action;if(!CLIENT.has(action))invalid();
 const definitions=CORE.OPERATIONS[action].request,allowed=['token','action','requestId',...Object.keys(definitions)];
 if(Object.keys(body).some(key=>!allowed.includes(key)))invalid();
 const out={};if(!READ.has(action)||own(body,'requestId'))out.requestId=uuid(body.requestId);
 for(const [key,type] of Object.entries(definitions)){
  const optional=type.includes('?');
  if(!own(body,key)){if(!optional)invalid();continue;}
  const value=body[key];
  if(key==='expectedRevision'){out[key]=value===null&&['partnerSave','recordSave'].includes(action)?null:integer(value);continue;}
  if(type.startsWith('uuid[]'))out[key]=ids(value);
  else if(type.startsWith('uuid'))out[key]=uuid(value);
  else if(type==='sha256')out[key]=digest(value);
  else if(key==='replaceFields'){if(!Array.isArray(value)||value.length>200||new Set(value).size!==value.length)invalid();out[key]=value.map(v=>text(v,500));}
  else if(key==='purpose')out[key]=pick(value,['external_impact','pre_signing_document','signed_copy_delivery']);
  else if(key==='policy')out[key]=CORE.validateProcessingPolicy(value);
  else if(type.startsWith('boolean'))out[key]=bool(value);
  else if(type==='true'){if(value!==true)invalid();out[key]=true;}
  else if(key==='profile')out[key]=CORE.validatePartner(value);
  else if(key==='approvedTerms')out[key]=CORE.validateApprovedTerms(value);
  else if(key==='data')out[key]=CORE.validateRecord(action==='agreementAmend'?'agreement':body.kind,value);
  else if(key==='kind')out[key]=pick(value,Object.keys(CORE.RECORD_KINDS));
  else if(key==='status'||key==='decision')out[key]=pick(value,[...new Set(Object.values(CORE.RECORD_STATUSES).flatMap(Object.keys))]);
  else if(key==='preset')out[key]=pick(value,Object.keys(CORE.ACCESS_PRESETS));
  else if(key==='permissions'){if(!Array.isArray(value)||value.length>Object.keys(BASE.PERMISSIONS).length||new Set(value).size!==value.length)invalid();out[key]=value.map(v=>pick(v,Object.keys(BASE.PERMISSIONS)));}
  else if(key==='format')out[key]=pick(value,['text','json','html','docx']);
  else if(key==='operation')out[key]=pick(value,Object.keys(CORE.ANALYSIS_OPERATIONS));
  else if(key==='invite'){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))invalid();out[key]=value;}
  else if(key==='expiresAt'){const time=Date.parse(value);if(typeof value!=='string'||!Number.isFinite(time)||new Date(time).toISOString()!==value)invalid();out[key]=value;}
  else out[key]=text(value,key==='contentBase64'?Math.ceil(MAX_BYTES/3)*4:key==='filename'?240:key==='query'?500:key==='cursor'?2000:key==='individualCode'?100:20000);
 }
 return out;
}
const MAX_BYTES=8*1024*1024;
const TYPES={'application/pdf':['pdf'],'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['docx'],'text/plain':['txt'],'image/png':['png'],'image/jpeg':['jpg','jpeg'],'image/webp':['webp']};
export function privateDocumentBytes(payload){
 const extensions=TYPES[payload.mediaType],extension=payload.filename?.split('.').pop()?.toLowerCase();
 if(!extensions?.includes(extension)||!payload.filename||/[\x00-\x1f/\\]/.test(payload.filename)||typeof payload.contentBase64!=='string'||!payload.contentBase64||payload.contentBase64.length>Math.ceil(MAX_BYTES/3)*4)invalid();
 const bytes=Buffer.from(payload.contentBase64,'base64');
 if(!bytes.length||bytes.length>MAX_BYTES||bytes.toString('base64')!==payload.contentBase64)invalid();
 const type=payload.mediaType;
 if(type==='application/pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||type.includes('wordprocessingml')&&!bytes.subarray(0,4).equals(Buffer.from([80,75,3,4]))||type==='image/png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||type==='image/jpeg'&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||type==='image/webp'&&!(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')||type==='text/plain'&&(bytes.includes(0)||Buffer.from(bytes.toString('utf8')).compare(bytes)!==0))invalid();
 return bytes;
}
function documentKey(options){const key=options.documentKey??(options.env||process.env).RESEARCH_DOCUMENT_KEY??options.contactKey??(options.env||process.env).RESEARCH_CONTACT_KEY;if(typeof key!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(key)||Buffer.from(key,'base64').length!==32||Buffer.from(key,'base64').toString('base64')!==key)fail('not_configured');return key;}
function encryptDocument(bytes,key){return encryptResearchValue({purpose:'research-partnership-document',contentBase64:bytes.toString('base64')},key);}
async function call(store,token,action,payload){if(!store?.rpc)fail('not_configured');const result=await store.rpc(token,action,payload);if(result?.error)fail(result.error);return result||{};}
const publicResult=(action,result)=>Object.fromEntries(Object.keys(CORE.OPERATIONS[action].result).filter(key=>own(result,key)).map(key=>[key,result[key]]));
const readinessEntry=(configured,message)=>({configured,state:configured?'ready':'not_configured',message});
function signingReadiness(adapter,options){if(options.signingEnabled!==true)return createSigningAdapter().readiness();const result=adapter.readiness();if(result.configured){try{documentKey(options);}catch{return readinessEntry(false,'נדרש מפתח להצפנת מסמכי החתימה והראיות.');}}return result;}
function mailSettings(options){const env=options.env||process.env,from=options.from??env.NOTIFY_FROM,apiKey=options.apiKey??env.RESEND_API_KEY;let origin;try{origin=new URL(options.siteOrigin??env.CORS_ORIGIN?.split(',')[0]?.trim());}catch{return null;}if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||typeof from!=='string'||/[\r\n\0]/.test(from)||!/@/.test(from)||typeof apiKey!=='string'||!apiKey)return null;return {from,apiKey,origin:origin.origin};}
async function invitationDelivery(store,token,payload,raw,options){
 const settings=mailSettings(options);if(!settings)return {configured:false,status:'not_configured'};
 // Re-authorize the exact current individual immediately before any send.
 const fresh=await call(store,token,'partnerGet',{partnerId:payload.partnerId});const email=fresh.partner?.profile?.email;
 if(typeof email!=='string'||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))return {configured:true,status:'failed'};
 const link=new URL('/research-management.html',settings.origin);link.hash='partner-invite='+raw;
 try{const response=await (options.mailFetchImpl||globalThis.fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+settings.apiKey,'Content-Type':'application/json','Idempotency-Key':'research-partner-invite/'+payload.requestId},body:JSON.stringify({from:settings.from,to:[email],subject:'BE GOOD: הזמנה למרחב מחקר',text:'הוזמנת למרחב מחקר אישי. לאחר כניסה בקוד האישי אפשר לעיין בהזמנה ולקבל אותה:\n'+link.href}),signal:AbortSignal.timeout(15000)});if(response.ok){const result=await response.json();return {configured:true,status:typeof result.id==='string'&&result.id?'accepted':'unknown'};}return {configured:true,status:response.status>=400&&response.status<500?'failed':'unknown'};}catch{return {configured:true,status:'unknown'};}
}
export async function handlePartnership(accessStore,store,body,options={}){
 try{
  const action=body.action,payload=validatePartnershipPayload(body),actor=await options.verifyIdentity(accessStore,body.token);
  if((action==='agreementPrepare'||action.startsWith('processingPolicy'))&&!actor.owner)fail('unauthorized');
  const adapter=options.signingAdapter||createSigningAdapter(options);
  let returnedInvite;
  if(action==='partnerInviteCreate'){
   if(!actor.owner)fail('unauthorized');
   if(payload.expiresAt){const now=typeof options.now==='function'?options.now():options.now??Date.now(),expiry=Date.parse(payload.expiresAt);if(expiry<=now||expiry>now+30*86400000)invalid();}
   const secret=(await accessStore.get('token-secret'))?.secret;if(typeof secret!=='string'||!secret)fail('not_configured');
   returnedInvite=createHmac('sha256',secret).update(JSON.stringify(['BEGOOD/research-partner-invite/v1',payload.studyId,payload.partnerId,payload.requestId])).digest('base64url');payload.inviteDigest=researchDigest(returnedInvite);
  }
  if(action==='partnerInviteGet'||action==='partnerInviteAccept'){payload.inviteDigest=researchDigest(payload.invite);delete payload.invite;}
  if(action==='workspaceDocumentPut'){const bytes=privateDocumentBytes(payload);payload.size=bytes.length;payload.sha256=createHash('sha256').update(bytes).digest('hex');payload.contentCiphertext=encryptDocument(bytes,documentKey(options));delete payload.contentBase64;}
  if(action==='signingStart'||action==='signingView'||action==='signingRefresh')return await handleSigning({accessStore,store,body,payload,adapter,options});
  const result=await call(store,body.token,action,payload),out=publicResult(action,result);
  if(action==='workspaceBootstrap'){
   out.owner=actor.owner;const db=result.readiness||{};
   out.readiness={signing:signingReadiness(adapter,options),approvedTemplate:db.approvedTemplate||readinessEntry(false,'נדרשת תבנית הסכם מאושרת.'),ipExplanation:db.ipExplanation||readinessEntry(false,'נדרש הסבר קניין רוחני מאושר.'),mail:readinessEntry(!!mailSettings(options),'דיוור מחייב שירות מוגדר.'),googleForms:readinessEntry(false,'נדרש חיבור Google Forms מאומת.'),impactAI:{configured:false,state:impactDescriptor(options)?'scope_policy_required':'not_configured',message:impactDescriptor(options)?'הסבר השלכות מחייב הרשאת עיבוד נפרדת ועדכנית לתיק, לספק ולגרסתו.':'הסבר השלכות דורש שירות מודל מזוהה וגרסת עיבוד מוגדרת.'}};
  }
  if(action==='partnerInviteCreate'){out.invitation={...out.invitation,token:returnedInvite};out.delivery=await invitationDelivery(store,body.token,payload,returnedInvite,options);}
  if(action==='workspaceDocumentGet'){
   const decrypted=decryptResearchValue(result.contentCiphertext,documentKey(options));if(decrypted?.purpose!=='research-partnership-document'||typeof decrypted.contentBase64!=='string')fail('unavailable');
   const bytes=Buffer.from(decrypted.contentBase64,'base64');if(bytes.toString('base64')!==decrypted.contentBase64||createHash('sha256').update(bytes).digest('hex')!==out.document?.sha256)fail('unavailable');out.contentBase64=decrypted.contentBase64;
  }
  if(action==='workspaceExport'){
   if(result.record?.kind==='agreement'&&result.record.status==='executed')fail('signed_original_required');
   return [200,exportPartnership(result,payload.format)];
  }
  if(action==='workspaceImpact'){
   out.changes=CORE.compareRecords(result.record.kind,result.fromVersion.data,result.toVersion.data);out.approvalsInvalidated=result.fromVersion.contentHash!==result.toVersion.contentHash;out.binding=false;
   out.ai=await explainImpact({accessStore,store,token:body.token,payload,result,changes:out.changes,options});
  }
  return [200,out];
 }catch(error){const code=own(safeMessages,error?.code)?error.code:own(safeMessages,error?.message)?error.message:'unavailable';return [{invalid:400,unauthorized:403,not_found:404,conflict:409,signed_original_required:409,not_configured:503,unavailable:503}[code],{code,error:safeMessages[code]}];}
}
export async function researchImpactWorkerToken(accessStore){const secret=(await accessStore?.get?.('token-secret'))?.secret;if(typeof secret!=='string'||!secret)fail('not_configured');const body=Buffer.from(JSON.stringify({k:'research_impact_worker',purpose:'research-impact',exp:Date.now()+300000})).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');}
function impactDescriptor(options){const d=options.impactDescriptor;if(typeof options.impactProviderFactory!=='function'||!d||!['provider','model','version'].every(k=>typeof d[k]==='string'&&d[k].length>0&&d[k].length<=240&&!/[\x00-\x1f]/.test(d[k])))return null;return {provider:d.provider,model:d.model,version:d.version};}
async function explainImpact({accessStore,store,token,payload,result,changes,options}){
 const descriptor=impactDescriptor(options),base={configured:!!descriptor,state:'not_requested',summary:null};if(!payload.includeAI)return base;
 if(!descriptor)return {...base,state:'not_configured',message:'שירות ההסבר וגרסת העיבוד טרם הוגדרו.'};
 let request;try{const minimal=minimizePartnershipImpact(result.record.kind,changes);request=impactRequest(minimal,{...descriptor,kind:result.record.kind});request=Object.freeze({...request,messages:Object.freeze(request.messages.map(Object.freeze)),model:descriptor.model});}catch{return {...base,state:'blocked',message:'השוואת השדות זמינה. היקף השינויים מחייב עיון לפני העברה לשירות חיצוני.'};}
 // Hash the exact serialized provider payload after minimization, never the
 // full before/after comparison or client-supplied disclosure categories.
 const gate={studyId:payload.studyId,partnerId:payload.partnerId,recordId:payload.recordId,fromVersionId:payload.fromVersionId,toVersionId:payload.toVersionId,fromHash:result.fromVersion.contentHash,toHash:result.toVersion.contentHash,provider:descriptor.provider,model:descriptor.model,providerVersion:descriptor.version,engineVersion:IMPACT_VERSIONS.engine,promptVersion:IMPACT_VERSIONS.prompt,payloadHash:createHash('sha256').update(JSON.stringify(request)).digest('hex'),categories:['agreement_changes','personal','confidential']};
 try{await call(store,token,'impactAuthorize',{...gate,checkOnly:true});}catch(error){if(error.code==='not_configured')return {...base,state:'blocked',message:'נדרשת הרשאת עיבוד נפרדת ועדכנית להסבר השינויים בתיק זה. ההשוואה עצמה זמינה.'};throw error;}
 let provider;try{provider=options.impactProviderFactory();if(provider?.id!==descriptor.provider||provider?.model!==descriptor.model||typeof provider?.complete!=='function')throw new Error();}catch{return {...base,state:'not_configured',message:'פרטי שירות ההסבר אינם תואמים לגרסה המאושרת.'};}
 let receipt;try{receipt=await call(store,token,'impactAuthorize',gate);}catch(error){if(error.code==='not_configured')return {...base,state:'blocked',message:'הרשאת העיבוד השתנתה. אפשר לבדוק אותה לפני ניסיון נוסף.'};throw error;}
 let answer,failed=false;try{answer=await provider.complete(request);if(typeof answer?.text!=='string'||!answer.text.trim()||answer.text.length>12000)throw new Error();}catch{failed=true;}
 await call(store,await researchImpactWorkerToken(accessStore),'impactOutcome',{eventId:receipt.eventId,payloadHash:gate.payloadHash,outcome:failed?'failed':'succeeded'});
 await call(store,token,'workspaceImpact',payload);
 if(!failed)try{await call(store,token,'impactAuthorize',{...gate,checkOnly:true});}catch(error){if(error.code==='not_configured')return {...base,state:'blocked',message:'הרשאת העיבוד השתנתה. ההשוואה זמינה, וההסבר לא מוצג.'};throw error;}
 return failed?{...base,state:'failed',message:'ההסבר לא הופק. ההשוואה המלאה נשארה זמינה.'}:{...base,state:'ready',summary:answer.text,engineVersion:IMPACT_VERSIONS.engine,promptVersion:IMPACT_VERSIONS.prompt};
}
async function handleSigning({accessStore,store,body,payload,adapter,options}){
 if(options.signingEnabled!==true)fail('not_configured');
 const action=body.action;
 // Authorization precedes provider readiness so guessed scope never leaks.
 const context=await call(store,body.token,action,payload);
 // Existing sessions retain their selected provider even when the default changes.
 if(context.signing?.provider&&!options.signingAdapter)adapter=createSigningAdapter({...options,signingProvider:context.signing.provider});
 if(!signingReadiness(adapter,options).configured)fail('not_configured');
 const key=documentKey(options),worker=()=>researchSigningWorkerToken(accessStore),scope={studyId:payload.studyId,partnerId:payload.partnerId,recordId:payload.recordId};
 if(action==='signingStart'){
  if(context.signing?.id)return [200,{signing:publicSigning(context.signing)}];
  const rendered=CORE.renderAgreement(context.version.data,context.template?.data||context.template);if(!rendered.ready)fail('not_configured');
  const file=exportPartnership(context,'docx');
  if(adapter.provider==='signwell')return beginSignWell({accessStore,store,body,payload,adapter,context,file,key,scope});
  const descriptor=adapter.transferDescriptor?.();if(!descriptor)fail('not_configured');
  const signerHash=signerPartiesHash(scope.partnerId,context.parties);
  const authorizeTransfer=()=>call(store,body.token,'signingTransferAuthorize',{...scope,versionId:context.version.id,documentHash:context.version.contentHash,signerPartiesHash:signerHash,provider:descriptor.provider,providerVersion:descriptor.version});
  await authorizeTransfer();
  const started=await adapter.start({...context,contentBase64:file.contentBase64,documentHash:payload.documentHash,consent:true,requestId:payload.requestId,authorizeTransfer});
  const prepared=await call(store,await worker(),'signingPrepare',{...scope,requestId:payload.requestId,expectedRevision:payload.expectedRevision,versionId:payload.versionId,documentHash:payload.documentHash,providerDocumentHash:started.providerDocumentHash,providerSessionId:started.providerSessionId,expiresAt:started.expiresAt,providerStateCiphertext:encryptResearchValue(started.state,key),authorityPolicyHash:started.authorityPolicyHash,signerPartiesHash:signerHash});
  return [200,{signing:publicSigning(prepared.signing)}];
 }
 if(context.signing?.state==='completed'&&action==='signingRefresh')return [200,{record:context.record,signing:publicSigning(context.signing)}];
 if(action==='signingRefresh'&&context.providerCheckDue===false)return [200,{record:context.record,signing:publicSigning(context.signing)}];
 const state=decryptResearchValue(context.providerStateCiphertext,key);
 if(state.provider&&state.provider!==context.signing?.provider||state.versionId&&state.versionId!==context.signing?.versionId||state.documentHash&&state.documentHash!==context.signing?.documentHash)fail('conflict');
 if(state.provider==='signwell'){
  const retained=await call(store,await worker(),'signingIntentGet',{intentId:state.intentId});assertSignWellState(retained.intent,state,scope,context.signing.id);
 }
 if(action==='signingView'){
  if(state.provider==='signwell')return viewSignWell({accessStore,store,body,adapter,context,state,scope});
  const descriptor=adapter.transferDescriptor?.();if(!descriptor)fail('not_configured');
  const binding=signerBinding(context.signing,scope,state,context.providerStateCiphertext);
  const authorizeTransfer=()=>call(store,body.token,'signingTransferAuthorize',{...scope,signingId:context.signing.id,versionId:context.signing.versionId,documentHash:context.signing.documentHash,signerPartiesHash:binding.partiesHash,signerBinding:binding,provider:descriptor.provider,providerVersion:descriptor.version});
  await authorizeTransfer();
  const view=await adapter.view(state,context.party,{authorizeTransfer});await authorizeTransfer();return [200,{signing:{...publicSigning(context.signing),embeddedUrl:view.embeddedUrl,expiresAt:view.expiresAt}}];
 }
 const verification=await adapter.refresh(state);
 if(!verification.completed){const updated=await call(store,await worker(),'signingStateUpdate',{...scope,signingId:context.signing.id,state:verification.state});return [200,{record:updated.record,signing:publicSigning(updated.signing)}];}
 return [200,await completeSigning({accessStore,store,scope,signing:context.signing,verification,key,state,providerStateCiphertext:context.providerStateCiphertext})];
}
async function beginSignWell({accessStore,store,body,payload,adapter,context,file,key,scope}){
 const proposed=adapter.buildIntent({...context,contentBase64:file.contentBase64,documentHash:payload.documentHash,consent:true,requestId:payload.requestId});
 const descriptor=adapter.transferDescriptor(),worker=()=>researchSigningWorkerToken(accessStore);
 let {intent}=await call(store,body.token,'signingIntentReserve',{...payload,provider:'signwell',providerVersion:descriptor.version,providerDocumentHash:proposed.providerDocumentHash,authorityPolicyHash:proposed.authorityPolicyHash,expiresAt:proposed.expiresAt,providerStateCiphertext:encryptResearchValue({...proposed,sourceContentBase64:file.contentBase64},key)});
 let state=decryptResearchValue(intent.providerStateCiphertext,key);
 assertSignWellState(intent,state,scope);
 if(!intent.providerSessionId){
  const claim=await call(store,await worker(),'signingIntentCreateClaim',{intentId:intent.id,authorizationToken:body.token});intent=claim.intent;
  if(!claim.claimed)return [200,{signing:publicSigning({recordId:intent.recordId,versionId:intent.versionId,documentHash:intent.documentHash,provider:'signwell',state:'creation_uncertain'})}];
  try{state={...await adapter.createDraft(state,state.sourceContentBase64),sourceContentBase64:state.sourceContentBase64};}
  catch{await call(store,await worker(),'signingIntentCreateClaim',{intentId:intent.id,authorizationToken:body.token}).catch(()=>{});return [200,{signing:publicSigning({recordId:intent.recordId,versionId:intent.versionId,documentHash:intent.documentHash,provider:'signwell',state:'creation_uncertain'})}];}
  // Only this known response may be retried locally; no provider mutation is retried.
  const attach=()=>call(store,workerToken,'signingIntentAttach',{intentId:intent.id,providerSessionId:state.providerSessionId,providerStateCiphertext:encryptResearchValue(state,key)}),workerToken=await worker();
  let attached;try{attached=await attach();}catch{attached=await attach();}intent=attached.intent;
 }
 const linked=await call(store,await worker(),'signingIntentLink',{intentId:intent.id,authorizationToken:body.token});
 return [200,{signing:publicSigning(linked.signing)}];
}
export function assertSignWellState(intent,state,scope,signingId){
 if(!intent||state.provider!=='signwell'||intent.provider!=='signwell'||state.intentId!==intent.id||intent.studyId!==scope.studyId||intent.partnerId!==scope.partnerId||intent.recordId!==scope.recordId||state.recordId!==intent.recordId||state.versionId!==intent.versionId||state.documentHash!==intent.documentHash||state.providerDocumentHash!==intent.providerDocumentHash||state.authorityPolicyHash!==intent.authorityPolicyHash||intent.providerSessionId&&state.providerSessionId!==intent.providerSessionId||signingId&&intent.signingId!==signingId)fail('conflict');
}
async function viewSignWell({accessStore,store,body,adapter,context,state,scope}){
 const worker=()=>researchSigningWorkerToken(accessStore),intentId=state.intentId;
 await call(store,body.token,'signingTransferAuthorize',{...scope,intentId});
 const current=await adapter.readDraft(state);
 if(current.providerStatus==='Draft'){
  const claim=await call(store,await worker(),'signingIntentSendClaim',{intentId,authorizationToken:body.token});
  if(!claim.claimed)return [200,{signing:{...publicSigning(context.signing),state:'send_uncertain'}}];
  try{await adapter.send(current);}catch{await call(store,await worker(),'signingIntentSendClaim',{intentId,authorizationToken:body.token}).catch(()=>{});return [200,{signing:{...publicSigning(context.signing),state:'send_uncertain'}}];}
  await call(store,await worker(),'signingIntentSent',{intentId});
 }else{
  const retained=await call(store,await worker(),'signingIntentGet',{intentId});
  if(['sending','send_uncertain'].includes(retained.intent.state))await call(store,await worker(),'signingIntentSent',{intentId});
  else if(retained.intent.state!=='sent')fail('conflict');
 }
 // Recheck current access after asynchronous provider work before exposing a party URL.
 await call(store,body.token,'signingTransferAuthorize',{...scope,intentId});
 const view=await adapter.view(state,context.party);
 await call(store,body.token,'signingTransferAuthorize',{...scope,intentId});
 return [200,{signing:{...publicSigning(context.signing),embeddedUrl:view.embeddedUrl,expiresAt:view.expiresAt}}];
}
export async function completeSigning({accessStore,store,scope,signing,verification,key,workLeaseId,state,providerStateCiphertext}){
 const binding=signerBinding(signing,scope,state,providerStateCiphertext);
 const worker=()=>researchSigningWorkerToken(accessStore),evidence=[];
 for(const [purpose,bytes] of [['final',verification.finalDocument],['certificate',verification.auditCertificate]]){
  const saved=await call(store,await worker(),'signingEvidencePut',{...scope,...workLeaseId?{workLeaseId}:{},signingId:signing.id,purpose,filename:purpose==='final'?'executed-agreement.pdf':'signature-audit.pdf',mediaType:'application/pdf',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),contentCiphertext:encryptDocument(bytes,key)});evidence.push(saved.document);
 }
 const result=await call(store,await worker(),'signatureComplete',{...scope,...workLeaseId?{workLeaseId}:{},signingId:signing.id,versionId:signing.versionId,documentHash:signing.documentHash,providerEventId:verification.providerEventId,finalDocumentId:evidence[0].id,finalDocumentHash:evidence[0].sha256,auditCertificateDocumentId:evidence[1].id,verifiedSigners:verification.verifiedSigners,completedAt:verification.completedAt,signerBinding:binding});
 return {record:result.record,signing:publicSigning(result.signing)};
}
export async function handleResearchSigningWebhook(accessStore,store,raw,headers,options={}){
 try{
  if(options.signingEnabled!==true)fail('not_configured');
  // This established route verifies DocuSign Connect. SignWell event hashes do
  // not bind a callback document ID and are deliberately unavailable here.
  const adapter=options.signingAdapter||createSigningAdapter({...options,signingProvider:'docusign'}),event=adapter.verifyEvent(raw,headers);if(!event.completed)return [200,{ok:true}];
  const context=await call(store,await researchSigningWorkerToken(accessStore),'signingEventContext',{providerSessionId:event.providerSessionId});
  if(context.signing?.state==='completed')return [200,{ok:true}];
  const key=documentKey(options),state=decryptResearchValue(context.providerStateCiphertext,key);
  if(state.providerSessionId!==event.providerSessionId)fail('conflict');
  const verification=await adapter.refresh(state);if(!verification.completed)fail('conflict');
  const scope={studyId:context.studyId,partnerId:context.partnerId,recordId:context.recordId};
  await completeSigning({accessStore,store,scope,signing:context.signing,verification,key,state,providerStateCiphertext:context.providerStateCiphertext});return [200,{ok:true}];
 }catch(error){const code=own(safeMessages,error?.code)?error.code:'unavailable';return [{invalid:400,unauthorized:403,not_found:404,conflict:409,not_configured:503,unavailable:503}[code],{ok:false,code,error:safeMessages[code]}];}
}
function publicSigning(value){return Object.fromEntries(['id','recordId','versionId','documentHash','provider','state','configured','embeddedUrl','expiresAt','completedAt','ownerActionCode'].map(key=>[key,value?.[key]??(key==='configured'?true:null)]));}
