import { createHash } from 'node:crypto';
import { exportPartnership, contentHash } from './research-partnership-exports.mjs';

const ORIGIN='https://www.signwell.com';
const fail=(code,details={})=>{throw Object.assign(new Error(code),details);};
const participants=[{id:'1',name:'בעלת מערכת בדויה',email:'owner@example.invalid'},{id:'2',name:'חוקרת בדויה',email:'partner@example.invalid'}];
export function trialDocument(){
 const data={title:'BE GOOD — מסמך בדיקה בלבד; אינו הסכם',ownerName:'בעלת מערכת בדויה',partnerName:'חוקרת בדויה',studyTitle:'ניסוי חתימה סינתטי',purpose:'בדיקת עברית: אמון, אחריות ושיתוף. English 123 — סכום בדוי 125.25 ₪. מסמך בדיקה בלבד; אינו הסכם ואינו יוצר התחייבות.',effectiveDate:'2026-10-18'};
 return exportPartnership({record:{kind:'agreement'},version:{id:'00000000-0000-4000-8000-000000000001',data,contentHash:contentHash(data)}},'docx');
}
function signingLink(value){
 let url;try{url=new URL(value);}catch{fail('unsafe_provider_response');}
 if(url.origin!==ORIGIN||url.username||url.password||!url.pathname.startsWith('/docs/'))fail('unsafe_provider_response',{stage:'embedded_url'});
 return url.href;
}
async function boundedBytes(response,limit){
 if(Number(response.headers?.get('content-length')||0)>limit)fail('provider_response_too_large');
 const chunks=[];let size=0;
 if(!response.body)fail('provider_request_failed');
 for await(const chunk of response.body){size+=chunk.length;if(size>limit)fail('provider_response_too_large');chunks.push(Buffer.from(chunk));}
 return Buffer.concat(chunks);
}
export function createSignwellTrial({apiKey,fetchImpl=globalThis.fetch}={}){
 if(typeof apiKey!=='string'||!apiKey.trim()||apiKey.length>2048||/[\r\n\0]/.test(apiKey)||typeof fetchImpl!=='function')fail('not_configured');
 let creation,documentId;
 async function api(path,{body,pdf=false}={}){
  let response;
  try{response=await fetchImpl(ORIGIN+'/api/v1'+path,{method:body?'POST':'GET',redirect:'error',headers:{'X-Api-Key':apiKey,'X-TestMode-Enabled':'true',Accept:pdf?'application/pdf':'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{fail('provider_request_failed');}
  if(response?.status===401||response?.status===403)fail('provider_auth_failed');
  if(response?.status===400||response?.status===422){
   let validation;try{validation=JSON.parse((await boundedBytes(response,1024*1024)).toString('utf8'));}catch{fail('provider_request_failed');}
   const known=new Set(['files','recipients','test_mode','draft','self_sign','with_signature_page','embedded_signing','language','passcode_delivery','send_email','send_sms','api_application_id']);
   const fields=Object.keys(validation?.errors||{}).filter(field=>known.has(field));
   const diagnosticText=JSON.stringify(validation).replaceAll(apiKey,'[redacted]').replace(/https?:\/\/[^\s"<>]+/g,'[url]').replace(/[^\s"<>]+@[^\s"<>]+/g,'[email]').replace(/[A-Za-z0-9_+/=-]{20,}/g,'[redacted]').toLowerCase();
   const categories=['email','domain','file','format','test','header','signature','recipient','passcode','credit','billing','plan','api','upgrade','mode'].filter(term=>diagnosticText.includes(term));
   const words=[...new Set(diagnosticText.match(/\b[a-z]{2,16}\b/g)||[])].filter(word=>!['redacted','email','url'].includes(word)).slice(0,32);
   fail('provider_rejected_input',{providerStatus:response.status,fields,categories,words});
  }
  if(!response?.ok)fail('provider_request_failed',{providerStatus:Number(response?.status)||0});
  const bytes=await boundedBytes(response,pdf?8*1024*1024:1024*1024);
  if(pdf){if(bytes.subarray(0,5).toString()!=='%PDF-')fail('unsafe_provider_response');return bytes;}
  try{return JSON.parse(bytes.toString('utf8'));}catch{fail('unsafe_provider_response');}
 }
 function checked(document){
  if(document?.test_mode!==true)fail('unsafe_provider_response',{stage:'test_mode'});
  if(typeof document.id!=='string'||!/^[a-zA-Z0-9_-]{1,150}$/.test(document.id)||documentId&&document.id!==documentId)fail('unsafe_provider_response',{stage:'document_id'});
  return document;
 }
 function checkedParties(document){
  const rows=document.recipients;
  if(!Array.isArray(rows)||rows.length!==2||rows.some(r=>typeof r.id!=='string'||!r.id)||new Set(rows.map(r=>r.id)).size!==2||!participants.every(p=>rows.filter(r=>r.email===p.email&&r.name===p.name).length===1))fail('unsafe_provider_response',{stage:'parties'});
  return participants.map(p=>rows.find(r=>r.email===p.email&&r.name===p.name));
 }
 return Object.freeze({
  create(){
   if(!creation)creation=(async()=>{
    const doc=trialDocument();
    const response=checked(await api('/documents',{body:{test_mode:true,name:'BE GOOD — TEST ONLY — בדיקה ללא תוקף הסכם',with_signature_page:true,files:[{name:'be-good-signwell-hebrew-test.docx',file_base64:doc.contentBase64}],recipients:participants.map(p=>({...p,send_email:false})),embedded_signing:true,embedded_signing_notifications:false,reminders:false,allow_reassign:false,language:'en'}}));
    const signers=checkedParties(response).map((got,index)=>({id:participants[index].id,name:participants[index].name,embeddedUrl:signingLink(got.embedded_signing_url)}));
    documentId=response.id;
    return {documentId,testMode:true,legallyVerified:false,signers,sourceDocumentHash:doc.documentHash};
   })();
   return creation;
  },
  async completed(){
   if(!documentId)fail('not_started');
   const document=checked(await api('/documents/'+encodeURIComponent(documentId)));
   if(typeof document.status!=='string'||document.status.toLowerCase()!=='completed')return {completed:false,testMode:true,legallyVerified:false};
   checkedParties(document);
   const bytes=await api('/documents/'+encodeURIComponent(documentId)+'/completed_pdf?url_only=false&audit_page=true&file_format=pdf',{pdf:true});
   return {completed:true,testMode:true,legallyVerified:false,bytes,sha256:createHash('sha256').update(bytes).digest('hex'),auditPageRequested:true};
  }
 });
}
