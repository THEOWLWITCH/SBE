// Public SignWell v1 protocol only. An independent server-side assurance
// implementation is mandatory: embedded mode disables email authentication and
// a completed PDF with an audit page is not an independently verified certificate.
// https://developers.signwell.com/reference/createdocument
// https://developers.signwell.com/reference/senddocument
// https://developers.signwell.com/reference/getcompletedpdf
import { createHash } from 'node:crypto';
import { contentHash } from './research-partnership-exports.mjs';

const BASE='https://www.signwell.com/api/v1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const MAX_DOCUMENT=8*1024*1024,MAX_JSON=256*1024;
const STATUSES=new Set(['Draft','Created','Sending','Sent','Pending','Viewed','Completed','Manually completed','Declined','Canceled','Bounced','Blocked','Error','Expired']);
const INCOMPLETE={Draft:'awaiting_signers',Created:'awaiting_signers',Sending:'awaiting_signers',Sent:'awaiting_signers',Pending:'in_progress',Viewed:'in_progress',Declined:'declined',Canceled:'expired',Expired:'expired',Bounced:'verification_failed',Blocked:'verification_failed',Error:'verification_failed','Manually completed':'verification_failed'};
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const text=(v,max=500)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[\r\n\0]/.test(v);
const email=v=>text(v,254)&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))return false;
 const parsed=Date.parse(value);if(!Number.isFinite(parsed))return false;
 const canonical=value.replace(/(?:\.(\d{1,3}))?Z$/,(_match,fraction)=>'.'+(fraction||'').padEnd(3,'0')+'Z');
 return new Date(parsed).toISOString()===canonical;
}
const pdf=bytes=>Buffer.isBuffer(bytes)&&bytes.length>=5&&bytes.length<=MAX_DOCUMENT&&bytes.subarray(0,5).toString()==='%PDF-';
function documentBytes(base64){
 if(typeof base64!=='string'||base64.length>Math.ceil(MAX_DOCUMENT/3)*4||base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))fail('invalid');
 const bytes=Buffer.from(base64,'base64');
 if(bytes.length<4||bytes.length>MAX_DOCUMENT||bytes.toString('base64')!==base64||!bytes.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04])))fail('invalid');
 return bytes;
}
function configuration(options){
 // Credentials are accepted only through trusted constructor input. This pure
 // adapter never searches environment files, the trial tool, or saved sessions.
 const config=options.signing,assurance=options.signwellAssurance;
 if(!config||!text(config.apiKey,512)||typeof config.testMode!=='boolean')return null;
 let policy;try{policy=structuredClone(options.signingPolicy);}catch{return null;}
 if(!policy||policy.approved!==true||policy.institutionRequirementsReviewed!==true||!text(policy.version,200)||!Array.isArray(policy.signerAuthorities)||policy.signerAuthorities.length<2||!policy.signerAuthorities.every(p=>p&&text(p.name)&&email(p.email)&&text(p.authority,2000)))return null;
 const policyHash=contentHash(policy);
 if(assurance?.operational!==true||!text(assurance.version,200)||assurance.policyHash!==policyHash||typeof assurance.verify!=='function'||!['identity','authority','consent','certificate','delivery'].every(k=>assurance.capabilities?.[k]===true))return null;
 return {apiKey:config.apiKey,testMode:config.testMode,policy,policyHash,assuranceVersion:assurance.version,verify:assurance.verify};
}
function metadata(state){
 return {begood_intent_id:state.intentId,begood_record_id:state.recordId,begood_version_id:state.versionId,begood_version_hash:state.documentHash,begood_source_hash:state.providerDocumentHash,begood_policy_hash:state.authorityPolicyHash,begood_assurance_version:state.assuranceVersion,begood_signers_hash:contentHash(state.signers)};
}
async function boundedBytes(response,limit){
 const length=response.headers?.get?.('content-length');
 if(length!==null&&length!==undefined&&(!/^\d+$/.test(length)||Number(length)>limit))fail('unavailable');
 if(!response.body?.getReader)fail('unavailable');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();fail('unavailable');}chunks.push(Buffer.from(part.value));}}finally{reader.releaseLock();}
 return Buffer.concat(chunks,size);
}
export function createSignWellAdapter(options={}){
 const settings=configuration(options),fetchImpl=options.signingFetchImpl||globalThis.fetch;
 const now=()=>Number(typeof options.now==='function'?options.now():options.now??Date.now());
 const ready=()=>{if(!settings||typeof fetchImpl!=='function')fail('not_configured');return settings;};
 async function api(path,{method='GET',body,binary=false}={}){
  const s=ready();let response;
  try{response=await fetchImpl(BASE+path,{method,redirect:'error',headers:{'X-Api-Key':s.apiKey,'X-TestMode-Enabled':String(s.testMode),Accept:binary?'application/pdf':'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{fail('unavailable');}
  if(!response?.ok||response.redirected)fail('unavailable');
  try{
   const type=response.headers?.get?.('content-type')?.split(';')[0].trim().toLowerCase();
   if(type!==(binary?'application/pdf':'application/json'))fail('unavailable');
   const bytes=await boundedBytes(response,binary?MAX_DOCUMENT:MAX_JSON);
   if(binary){if(!pdf(bytes))fail('unavailable');return bytes;}
   const value=JSON.parse(bytes.toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))fail('unavailable');return value;
  }catch{fail('unavailable');}
 }
 function signers(parties){
  const s=ready();const rows=['owner','partner'].map((party,index)=>{
   const p=parties?.[party],name=p?.name??p?.fullName,mail=p?.email;
   if(!text(name)||!email(mail)||!text(p?.authority,2000))fail('invalid');
   const authority=s.policy.signerAuthorities.find(a=>a.name===name&&a.email.toLowerCase()===mail.toLowerCase()&&a.authority===p.authority);
   if(!authority)fail('not_configured');
   return {party,name,email:mail.toLowerCase(),authority:authority.authority,recipientId:String(index+1)};
  });
  if(rows[0].email===rows[1].email)fail('invalid');return rows;
 }
 function current(state,{knownId=true}={}){
  const s=ready();
  if(!state||state.provider!=='signwell'||!UUID.test(state.intentId||'')||!UUID.test(state.recordId||'')||!UUID.test(state.versionId||'')||!HASH.test(state.documentHash||'')||!HASH.test(state.providerDocumentHash||'')||state.authorityPolicyHash!==s.policyHash||state.assuranceVersion!==s.assuranceVersion||state.testMode!==s.testMode||state.consentRequested!==true||!timestamp(state.expiresAt)||!Array.isArray(state.signers)||state.signers.length!==2||(knownId?!UUID.test(state.providerSessionId||''):state.providerSessionId!==undefined))fail('conflict');
  let expected;try{expected=signers(Object.fromEntries(state.signers.map(row=>[row.party,row])));}catch{fail('conflict');}
  if(contentHash(state.signers)!==contentHash(expected))fail('conflict');
  return {provider:'signwell',intentId:state.intentId,recordId:state.recordId,versionId:state.versionId,documentHash:state.documentHash,providerDocumentHash:state.providerDocumentHash,authorityPolicyHash:state.authorityPolicyHash,assuranceVersion:state.assuranceVersion,testMode:state.testMode,signers:expected,consentRequested:true,expiresAt:state.expiresAt,...(knownId?{providerSessionId:state.providerSessionId}:{})};
 }
 function validateDocument(raw,state,{creating=false}={}){
  if(!UUID.test(raw.id||'')||(!creating&&raw.id!==state.providerSessionId)||raw.test_mode!==state.testMode||raw.embedded_signing!==true||raw.allow_reassign!==false||!STATUSES.has(raw.status)||!raw.metadata||!Object.entries(metadata(state)).every(([key,value])=>raw.metadata[key]===value)||!Array.isArray(raw.recipients)||raw.recipients.length!==2||!state.signers.every(expected=>raw.recipients.filter(actual=>actual&&actual.id===expected.recipientId&&actual.name===expected.name&&email(actual.email)&&actual.email.toLowerCase()===expected.email).length===1))fail('conflict');
  return {...state,providerSessionId:raw.id,providerStatus:raw.status};
 }
 async function read(state){const stored=current(state);const raw=await api('/documents/'+stored.providerSessionId);return {state:validateDocument(raw,stored),raw};}
 function completedEvidence(value,state,finalDocument){
  if(!value||value.provider!=='signwell'||value.providerSessionId!==state.providerSessionId||value.recordId!==state.recordId||value.versionId!==state.versionId||value.documentHash!==state.documentHash||value.providerDocumentHash!==state.providerDocumentHash||value.authorityPolicyHash!==state.authorityPolicyHash||value.assuranceVersion!==state.assuranceVersion||value.finalDocumentHash!==sha(finalDocument)||value.certificateVerified!==true||value.deliveryVerified!==true||!pdf(value.auditCertificate)||sha(value.auditCertificate)===sha(finalDocument)||!timestamp(value.completedAt)||Date.parse(value.completedAt)>now()+300000||!Array.isArray(value.verifiedSigners)||value.verifiedSigners.length!==2)return null;
  const verifiedSigners=[];
  for(const expected of state.signers){
   const matches=value.verifiedSigners.filter(actual=>actual&&actual.party===expected.party&&actual.recipientId===expected.recipientId&&actual.name===expected.name&&actual.email===expected.email&&actual.authority===expected.authority&&actual.identityVerified===true&&actual.authorityVerified===true&&actual.consent===true&&timestamp(actual.signedAt)&&Date.parse(actual.signedAt)<=Date.parse(value.completedAt));
   if(matches.length!==1)return null;
   verifiedSigners.push({...expected,identityVerified:true,authorityVerified:true,consent:true,signedAt:matches[0].signedAt});
  }
  return {completed:true,state:'completed',completedAt:value.completedAt,providerEventId:'signwell/'+state.providerSessionId+'/'+sha(value.auditCertificate),verifiedSigners,finalDocument,auditCertificate:Buffer.from(value.auditCertificate)};
 }
 return Object.freeze({
  provider:'signwell',
  readiness(){const configured=!!settings&&typeof fetchImpl==='function';return {configured,state:configured?(settings.testMode?'provider_test':'ready'):'not_configured',message:configured?(settings.testMode?'ספק החתימה הוגדר לניסוי בלבד; חתימות ניסוי אינן מפעילות שותפות.':'השלמת החתימה מחייבת אימות עצמאי של זהויות, סמכות, הסכמה, אישור ביקורת ומסירת עותקים.'):'נדרשים ספק חתימה ומנגנון עצמאי פעיל לאימות זהות, סמכות, הסכמה, אישור ביקורת ומסירת עותקים תחת מדיניות מאושרת.'};},
  transferDescriptor(){const s=ready();return {provider:'signwell',version:s.policy.version};},
  verifyEvent(){fail('not_configured');},
  buildIntent(context){
   const s=ready(),intentId=context?.intentId||context?.requestId;
   if(context?.consent!==true||!UUID.test(intentId||'')||(context.requestId!==undefined&&!UUID.test(context.requestId))||!UUID.test(context.record?.id||'')||!UUID.test(context.version?.id||'')||!HASH.test(context.documentHash||'')||context.documentHash!==context.version.contentHash)fail('invalid');
   const bytes=documentBytes(context.contentBase64);
   return {provider:'signwell',intentId,recordId:context.record.id,versionId:context.version.id,documentHash:context.documentHash,providerDocumentHash:sha(bytes),authorityPolicyHash:s.policyHash,assuranceVersion:s.assuranceVersion,testMode:s.testMode,signers:signers(context.parties),consentRequested:true,expiresAt:new Date(now()+7*86400000).toISOString()};
  },
  async createDraft(state,contentBase64){
   const stored=current(state,{knownId:false});if(sha(documentBytes(contentBase64))!==stored.providerDocumentHash)fail('conflict');
   const raw=await api('/documents',{method:'POST',body:{name:'BE GOOD — הסכם מחקר',files:[{name:'research-agreement.docx',file_base64:contentBase64}],recipients:stored.signers.map(p=>({id:p.recipientId,name:p.name,email:p.email,send_email:false})),test_mode:stored.testMode,draft:true,embedded_signing:true,embedded_signing_notifications:false,self_sign:false,with_signature_page:true,allow_reassign:false,reminders:false,apply_signing_order:false,metadata:metadata(stored)}});
   const saved=validateDocument(raw,stored,{creating:true});if(saved.providerStatus!=='Draft')fail('conflict');return saved;
  },
  async readDraft(state){return (await read(state)).state;},
  async send(state){
   // The gateway first reads this exact draft and then freshly authorizes and
   // durably claims the single mutation. Do not insert another provider await
   // between that live access check and POST. Lost responses reconcile by GET.
   const stored=current(state);if(state.providerStatus!=='Draft')fail('conflict');
   const raw=await api('/documents/'+stored.providerSessionId+'/send',{method:'POST',body:{test_mode:stored.testMode,embedded_signing:true,embedded_signing_notifications:false,allow_reassign:false,reminders:false,metadata:metadata(stored)}});
   const sent=validateDocument(raw,stored);if(sent.providerStatus==='Draft')fail('conflict');return sent;
  },
  async view(state,party){
   const stored=current(state),signer=stored.signers.find(p=>p.party===party);if(!signer)fail('unauthorized');
   const result=await read(stored);if(!['Sent','Pending','Viewed'].includes(result.state.providerStatus))fail('conflict');
   const rawUrl=result.raw.recipients.find(r=>r.id===signer.recipientId).embedded_signing_url;let url;
   try{url=new URL(rawUrl);}catch{fail('unavailable');}
   if(url.protocol!=='https:'||url.hostname!=='www.signwell.com'||url.port||url.username||url.password||url.search||url.hash||!/^\/docs\/[A-Za-z0-9_-]+\/$/.test(url.pathname))fail('unavailable');
   return {embeddedUrl:url.href,expiresAt:new Date(Math.min(now()+300000,Date.parse(stored.expiresAt))).toISOString()};
  },
  async refresh(state){
   const stored=(await read(state)).state;
   if(stored.providerStatus!=='Completed')return {completed:false,state:INCOMPLETE[stored.providerStatus]};
   if(stored.testMode)return {completed:false,state:'evidence_missing'};
   let finalDocument;try{finalDocument=await api('/documents/'+stored.providerSessionId+'/completed_pdf?url_only=false&audit_page=true&file_format=pdf',{binary:true});}catch{return {completed:false,state:'artifact_pending'};}
   let evidence;try{evidence=await settings.verify({provider:'signwell',providerSessionId:stored.providerSessionId,recordId:stored.recordId,versionId:stored.versionId,documentHash:stored.documentHash,providerDocumentHash:stored.providerDocumentHash,authorityPolicyHash:stored.authorityPolicyHash,assuranceVersion:stored.assuranceVersion,policy:structuredClone(settings.policy),expectedSigners:structuredClone(stored.signers),finalDocument:Buffer.from(finalDocument),finalDocumentHash:sha(finalDocument),testMode:false});}catch{return {completed:false,state:'evidence_missing'};}
   return completedEvidence(evidence,stored,finalDocument)||{completed:false,state:'evidence_missing'};
  }
 });
}
