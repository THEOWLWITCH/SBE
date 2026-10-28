// Official REST v2.1 integration: embedding + recipient views, envelope/recipient
// server reads, combined document/certificate retrieval. Provider status alone
// makes no claim about Israeli secure/certified signature status.
// https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/embedding/
// https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/enveloperecipients/list/
// https://developers.docusign.com/platform/webhooks/connect/
// Drafts are sent only from an authorized, persisted signing session. Transaction
// IDs recover uncertain create responses within Docusign's seven-day window.
// https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopes/update/
// https://www.docusign.com/blog/developers/common-api-tasks-use-transactionid-to-find-the-envelope-you-created
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { contentHash } from './research-partnership-exports.mjs';
import { createSignWellAdapter } from './research-signwell.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const email=v=>typeof v==='string'&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
export async function researchSigningWorkerToken(accessStore,{now=Date.now()}={}){
 const secret=(await accessStore?.get?.('token-secret'))?.secret;if(typeof secret!=='string'||!secret)fail('not_configured');
 const body=Buffer.from(JSON.stringify({k:'research_signing_worker',purpose:'research-signing',exp:Number(typeof now==='function'?now():now)+300000})).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
function configuration(options){
 const env=options.env||process.env,config=options.signing||{};
 const token=config.accessToken??env.RESEARCH_SIGNING_ACCESS_TOKEN,accountId=config.accountId??env.RESEARCH_SIGNING_ACCOUNT_ID;
 const connectKey=config.connectKey??env.RESEARCH_SIGNING_CONNECT_KEY;
 let base,returnUrl,connectUrl,policy;
 try{base=new URL(config.baseUrl??env.RESEARCH_SIGNING_BASE_URL);returnUrl=new URL(config.returnUrl??env.RESEARCH_SIGNING_RETURN_URL);connectUrl=new URL(config.connectUrl??env.RESEARCH_SIGNING_CONNECT_URL);policy=options.signingPolicy??JSON.parse(env.RESEARCH_SIGNING_POLICY||'null');}catch{return null;}
 if(base.protocol!=='https:'||!/^(demo|[a-z0-9-]+)\.docusign\.net$/i.test(base.hostname)||base.pathname!=='/restapi'||base.search||base.hash||base.username||base.password||returnUrl.protocol!=='https:'||returnUrl.username||returnUrl.password||!UUID.test(accountId||'')||typeof token!=='string'||!token||/[\r\n]/.test(token)||!policy||policy.approved!==true||policy.institutionRequirementsReviewed!==true||typeof policy.version!=='string'||!policy.version||!UUID.test(policy.identityWorkflowId||'')||!Array.isArray(policy.signerAuthorities)||policy.signerAuthorities.length<2||!policy.signerAuthorities.every(p=>email(p.email)&&typeof p.name==='string'&&p.name.trim()&&typeof p.authority==='string'&&p.authority.trim()))return null;
 if(typeof connectKey!=='string'||connectKey.length<24||connectKey.length>512||/[\r\n\0]/.test(connectKey)||connectUrl.protocol!=='https:'||connectUrl.username||connectUrl.password||connectUrl.search||connectUrl.hash||connectUrl.pathname!=='/api/research-signing/webhook')return null;
 return {token,accountId,base:base.href.replace(/\/$/,''),returnUrl:returnUrl.href,connectKey,connectUrl:connectUrl.href,policy};
}
export function createSigningAdapter(options={}){
 // Deployment enablement is trusted constructor input, independent of credentials.
 // Check it before provider selection so retained sessions and provider overrides
 // cannot reopen signing in a deployment that has disabled it.
 if(options.signingEnabled!==true)return Object.freeze({provider:'disabled',readiness:()=>({configured:false,state:'disabled',message:'החתימה האלקטרונית אינה פעילה בפריסה זו.'}),verifyEvent:()=>fail('not_configured'),start:async()=>fail('not_configured'),view:async()=>fail('not_configured'),refresh:async()=>fail('not_configured')});
 const provider=options.signingProvider??options.signing?.provider??(options.env||process.env).RESEARCH_SIGNING_PROVIDER??'docusign';
 // Retain provider-specific policy/credentials for already issued sessions.
 // This constructor input is server-owned and never taken from a client body.
 const selected=options.signingProviders?.[provider];
 if(selected&&typeof selected==='object'&&!Array.isArray(selected))options={...options,...selected,signingProvider:provider};
 if(provider==='signwell')return createSignWellAdapter(options);
 if(provider!=='docusign')return Object.freeze({provider,readiness:()=>({configured:false,state:'unsupported_provider',message:'ספק החתימה שנבחר אינו נתמך.'}),verifyEvent:()=>fail('not_configured'),start:async()=>fail('not_configured'),view:async()=>fail('not_configured'),refresh:async()=>fail('not_configured')});
 const settings=configuration(options),fetchImpl=options.signingFetchImpl||globalThis.fetch;
 const ready=()=>{if(!settings||typeof fetchImpl!=='function')fail('not_configured');return settings;};
 async function api(path,{method='GET',body,binary=false}={}){
  const s=ready();let response;
  try{response=await fetchImpl(s.base+'/v2.1/accounts/'+s.accountId+path,{method,headers:{Authorization:'Bearer '+s.token,Accept:binary?'application/pdf':'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{fail('unavailable');}
  if(!response?.ok)fail('unavailable');
  try{if(binary){const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<5||bytes.length>8*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-')fail('unavailable');return bytes;}const result=await response.json();if(!result||typeof result!=='object'||Array.isArray(result))fail('unavailable');return result;}catch{fail('unavailable');}
 }
 function current(state){const s=ready();if(!state||state.provider!=='docusign'||!UUID.test(state.providerSessionId||'')||state.authorityPolicyHash!==contentHash(s.policy)||!Array.isArray(state.signers)||state.signers.length!==2||!/^[a-f0-9]{64}$/.test(state.documentHash||'')||!/^[a-f0-9]{64}$/.test(state.providerDocumentHash||''))fail('conflict');return s;}
 async function transactionEnvelope(requestId){
  const result=await api('/envelopes?transaction_ids='+encodeURIComponent(requestId)),rows=result.envelopeTransactionStatuses??result.envelopes??[];
  if(!Array.isArray(rows)||rows.some(row=>row.errorDetails||row.transactionId&&row.transactionId!==requestId)||result.nextUri||Number(result.totalSetSize||rows.length)>1)fail('unavailable');
  if(!rows.length)return null;
  if(rows.length!==1||!UUID.test(rows[0].envelopeId||'')||rows[0].status!=='created')fail('conflict');
  return rows[0];
 }
 async function verifyIntent(state){
  const s=current(state),path='/envelopes/'+state.providerSessionId;
  const custom=await api(path+'/custom_fields');if(!custom.textCustomFields?.some(f=>f.name==='BEGOOD_VERSION_HASH'&&f.value===state.documentHash)||!custom.textCustomFields.some(f=>f.name==='BEGOOD_SOURCE_DOCUMENT_HASH'&&f.value===state.providerDocumentHash))fail('conflict');
  const recipients=await api(path+'/recipients?include_tabs=true&include_extended=true');
  if(recipients.signers?.length!==2||!state.signers.every(expected=>recipients.signers.some(actual=>actual.recipientId===expected.recipientId&&actual.email?.toLowerCase()===expected.email&&actual.name===expected.name&&actual.clientUserId===expected.clientUserId&&actual.identityVerification?.workflowId===s.policy.identityWorkflowId)))fail('conflict');
 }
 return Object.freeze({
  provider:'docusign',
  transferDescriptor(){const s=ready();return {provider:'docusign',version:s.policy.version};},
  readiness(){return {configured:!!settings,state:settings?'ready':'not_configured',message:settings?'שירות החתימה הוגדר; השלמה מחייבת אימות עדכני של שני הצדדים.':'נדרשים ספק חתימה, זהויות מאומתות ומדיניות סמכות חתימה מאושרת.'};},
  verifyEvent(raw,headers){
   const s=ready();if(!Buffer.isBuffer(raw)||raw.length>262144)fail('invalid');
   const wanted=createHmac('sha256',s.connectKey).update(raw).digest();
   const signatures=Object.entries(headers||{}).filter(([key])=>/^x-docusign-signature-\d+$/i.test(key)).slice(0,10).flatMap(([,value])=>Array.isArray(value)?value:[value]);
   const verified=signatures.some(value=>{if(typeof value!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(value))return false;const got=Buffer.from(value,'base64');return got.length===wanted.length&&timingSafeEqual(got,wanted);});
   if(!verified)fail('unauthorized');let event;try{event=JSON.parse(raw.toString('utf8'));}catch{fail('invalid');}
   if(event?.data?.accountId!==s.accountId||!UUID.test(event?.data?.envelopeId||''))fail('unauthorized');
   return {providerSessionId:event.data.envelopeId,completed:event.event==='envelope-completed'};
  },
  async start(context){
   const s=ready();if(context.consent!==true||context.documentHash!==context.version?.contentHash||!UUID.test(context.requestId||''))fail('invalid');
   const signers=['owner','partner'].map((party,index)=>{
    const p=context.parties?.[party],name=p?.name??p?.fullName,mail=p?.email;
    const authority=s.policy.signerAuthorities.find(a=>a.email.toLowerCase()===String(mail).toLowerCase()&&a.name===name);
    if(!authority||!p||!email(mail)||typeof p.authority!=='string'||p.authority!==authority.authority)fail('not_configured');
    return {party,name,email:mail.toLowerCase(),authority:authority.authority,recipientId:String(index+1),clientUserId:contentHash({party,recordId:context.record.id,versionId:context.version.id,email:mail.toLowerCase()})};
   });
   if(signers[0].email===signers[1].email)fail('invalid');
   const providerDocumentHash=createHash('sha256').update(Buffer.from(context.contentBase64,'base64')).digest('hex');
   const recipients={signers:signers.map((p,i)=>({name:p.name,email:p.email,recipientId:p.recipientId,clientUserId:p.clientUserId,embeddedRecipientStartURL:'SIGN_AT_DOCUSIGN',routingOrder:'1',requireIdLookup:'true',identityVerification:{workflowId:s.policy.identityWorkflowId},tabs:{signHereTabs:[{documentId:'1',anchorString:i===0?'חתימת בעלת המערכת':'חתימת החוקרת',anchorUnits:'pixels',anchorYOffset:'24',anchorIgnoreIfNotPresent:'false'}],checkboxTabs:[{documentId:'1',anchorString:i===0?'חתימת בעלת המערכת':'חתימת החוקרת',anchorUnits:'pixels',anchorYOffset:'60',anchorIgnoreIfNotPresent:'false',tabLabel:'BEGOOD_SIGNING_CONSENT',tabGroupLabels:['BEGOOD_CONSENT_GROUP'],selected:'false'}],tabGroups:[{groupLabel:'BEGOOD_CONSENT_GROUP',groupRule:'SelectAtLeast',minimumRequired:'1',maximumAllowed:'1',tabScope:'Document',documentId:'1',validationMessage:'נדרשת הסכמה מפורשת לחתימה אלקטרונית.'}]}})),carbonCopies:signers.map((p,i)=>({name:p.name,email:p.email,recipientId:String(i+3),routingOrder:'2'}))};
   const expiresAt=new Date(Date.now()+7*86400000).toISOString(),authorityPolicyHash=contentHash(s.policy);
   const state={provider:'docusign',documentHash:context.documentHash,providerDocumentHash,versionId:context.version.id,authorityPolicyHash,signers,consentRequested:true};
   let envelope=await transactionEnvelope(context.requestId),recovered=!!envelope;
   if(!envelope){try{
    await context.authorizeTransfer?.();
    envelope=await api('/envelopes',{method:'POST',body:{transactionId:context.requestId,emailSubject:'BE GOOD: חתימת הסכם מחקר',status:'created',enforceSignerVisibility:'true',eventNotification:{url:s.connectUrl,requireAcknowledgment:'true',includeHMAC:'true',includeDocuments:'false',loggingEnabled:'false',envelopeEvents:[{envelopeEventStatusCode:'completed'}],eventData:{version:'restv2.1',format:'json',includeData:[]}},customFields:{textCustomFields:[{name:'BEGOOD_VERSION_HASH',value:context.documentHash,show:'false',required:'true'},{name:'BEGOOD_SOURCE_DOCUMENT_HASH',value:providerDocumentHash,show:'false',required:'true'}]},documents:[{documentId:'1',name:'research-agreement.docx',fileExtension:'docx',documentBase64:context.contentBase64}],recipients}});
    if(!UUID.test(envelope.envelopeId||'')||envelope.status!=='created')fail('unavailable');
   }catch(error){if(['unauthorized','not_found','not_configured','conflict'].includes(error?.code))throw error;envelope=await transactionEnvelope(context.requestId);if(!envelope)throw error;recovered=true;}}
   state.providerSessionId=envelope.envelopeId;if(recovered)await verifyIntent(state);
   return {providerSessionId:envelope.envelopeId,providerDocumentHash,expiresAt,authorityPolicyHash,state};
  },
  async view(state,party,{authorizeTransfer}={}){const s=current(state),p=state.signers.find(p=>p.party===party);if(!p)fail('unauthorized');const path='/envelopes/'+state.providerSessionId,envelope=await api(path);if(envelope.envelopeId!==state.providerSessionId)fail('conflict');if(envelope.status==='created'){await verifyIntent(state);await authorizeTransfer?.();await api(path,{method:'PUT',body:{status:'sent'}});}else if(!['sent','delivered'].includes(envelope.status))fail('conflict');await authorizeTransfer?.();const result=await api(path+'/views/recipient',{method:'POST',body:{returnUrl:s.returnUrl,authenticationMethod:'none',email:p.email,userName:p.name,clientUserId:p.clientUserId}});let url;try{url=new URL(result.url);}catch{fail('unavailable');}if(url.protocol!=='https:'||!/(^|\.)docusign\.(net|com)$/i.test(url.hostname)||url.username||url.password)fail('unavailable');return {embeddedUrl:url.href,expiresAt:new Date(Date.now()+300000).toISOString()};},
  async refresh(state){
   const s=current(state),path='/envelopes/'+state.providerSessionId;
   const envelope=await api(path);if(envelope.envelopeId!==state.providerSessionId)fail('conflict');
   if(envelope.status!=='completed')return {completed:false,state:({sent:'awaiting_signers',delivered:'in_progress',created:'awaiting_signers',declined:'declined',voided:'expired'})[envelope.status]||'failed'};
   const custom=await api(path+'/custom_fields');if(!custom.textCustomFields?.some(f=>f.name==='BEGOOD_VERSION_HASH'&&f.value===state.documentHash)||!custom.textCustomFields.some(f=>f.name==='BEGOOD_SOURCE_DOCUMENT_HASH'&&f.value===state.providerDocumentHash))fail('conflict');
   const recipients=await api(path+'/recipients?include_tabs=true&include_extended=true');if(!Array.isArray(recipients.signers)||recipients.signers.length!==2)fail('conflict');
   if(!state.signers.every(p=>recipients.carbonCopies?.some(c=>c.email?.toLowerCase()===p.email&&c.name===p.name&&c.routingOrder==='2'&&['completed','delivered'].includes(c.status))))fail('conflict');
   const verifiedSigners=state.signers.map(expected=>{
    const actual=recipients.signers.find(p=>p.recipientId===expected.recipientId);
    const auth=actual?.recipientAuthenticationStatus?.identityVerificationResult;
    const consent=actual?.tabs?.checkboxTabs?.find(t=>t.tabLabel==='BEGOOD_SIGNING_CONSENT');
    if(!actual||actual.status!=='completed'||actual.email?.toLowerCase()!==expected.email||actual.name!==expected.name||actual.clientUserId!==expected.clientUserId||actual.identityVerification?.workflowId!==s.policy.identityWorkflowId||!['Pass','Passed'].includes(auth?.status)||!Number.isFinite(Date.parse(auth?.eventTimestamp||auth?.dateTime))||!Number.isFinite(Date.parse(actual.signedDateTime))||!['true',true].includes(consent?.selected)||state.consentRequested!==true)fail('conflict');
    return {party:expected.party,email:expected.email,name:expected.name,authority:expected.authority,recipientId:expected.recipientId,identityVerified:true,consent:true,signedAt:actual.signedDateTime};
   });
   if(!Number.isFinite(Date.parse(envelope.completedDateTime)))fail('conflict');
   const finalDocument=await api(path+'/documents/combined?certificate=false',{binary:true}),auditCertificate=await api(path+'/documents/certificate',{binary:true});
   return {completed:true,state:'completed',completedAt:envelope.completedDateTime,providerEventId:'docusign/'+state.providerSessionId+'/'+createHash('sha256').update(auditCertificate).digest('hex'),verifiedSigners,finalDocument,auditCertificate};
  }
 });
}
