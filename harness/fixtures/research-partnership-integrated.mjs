import assert from 'node:assert/strict';
import { createPartnershipDatabase, token, request } from './research-partnership-database.mjs';
import { OWNER_AUTH_VERSION } from './research-database.mjs';
import { ResearchStoreError } from '../lib/research-store.mjs';
import { isPartnershipAction } from '../lib/research-partnerships.mjs';
import { handleResearch } from '../lib/research.mjs';
import { handleIntake, isIntakeAction, isPublicIntakeAction } from '../lib/research-intake.mjs';
export { token, request };
export const DOCUMENT_KEY=Buffer.alloc(32,41).toString('base64');
export async function approveSigningProcessing(f,scope,{provider='docusign',providerVersion='synthetic-policy'}={}){
 const policy={purpose:'pre_signing_document',provider,providerVersion,dataCategories:['agreement_document','personal','confidential'],authorizedActors:['sys','code:'+f.codes.a],...Object.fromEntries(['partyRoles','transferBasis','storageLocation','retention','backups','deletion','withdrawal','securityMeasures','ethicsReference','consentReview'].map(k=>[k,'Synthetic explicit decision '+k]))};
 const saved=(await f.checked(f.tokens.owner,'processingPolicySave',f.request({...scope,expectedRevision:0,policy}))).policy;
 await f.checked(f.tokens.owner,'processingPolicyApprove',f.request({...scope,expectedRevision:saved.revision,policyVersionId:saved.id,policyHash:saved.hash}));
}
export async function createPartnershipIntegration(options={}){
 const database=await createPartnershipDatabase();let queue=Promise.resolve();
 const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 const query=(sql,values)=>serial(()=>database.db.query(sql,values)),exec=sql=>serial(()=>database.db.exec(sql));
 const codes={a:'STAFFA',b:'STAFFB',participant:'PERSON1',ordinary:'ORDINARY1',multi:'MULTI1'};
 for(const code of Object.values(codes))await query('INSERT INTO public.access_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',['code:'+code,{code,kind:'staff',inst:'Synthetic School',perms:['writer'],revoked:false}]);
 const accessStore={async get(key){return structuredClone((await query('SELECT value FROM public.access_settings WHERE key=$1',[key])).rows[0]?.value??null);},async set(key,value){await query('INSERT INTO public.access_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[key,value]);},async list(prefix){return (await query('SELECT key,value FROM public.access_settings WHERE key LIKE $1',[prefix+'%'])).rows;},async compareSet(key,expected,value){const result=expected===null?await query('INSERT INTO public.access_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING RETURNING key',[key,value]):await query("UPDATE public.access_settings SET value=$3 WHERE key=$1 AND value->>'revision'=$2 RETURNING key",[key,String(expected),value]);return result.rows.length===1;}};
 const tokens={owner:token({k:'sys',authVersion:OWNER_AUTH_VERSION}),worker:token({k:'research_worker',purpose:'research',exp:Date.now()+300000})};for(const [name,code]of Object.entries(codes))tokens[name]=token({k:'code',c:code,kind:'staff',inst:'Synthetic School'});
 const researchStore={async rpc(credential,action,payload={}){const route=isIntakeAction(action)||isPublicIntakeAction(action)?database.intakeRpc:isPartnershipAction(action)||['signingPrepare','signingEvidencePut','signatureComplete','signingEventContext','signingStateUpdate','signingIntentReserve','signingIntentGet','signingIntentCreateClaim','signingIntentAttach','signingIntentLink','signingIntentSendClaim','signingIntentSent','signingTransferAuthorize'].includes(action)?database.partnershipRpc:database.rpc;const result=await serial(()=>route(credential,action,payload));if(result?.error)throw new ResearchStoreError(result.error,result.status);return result;}};
 const callResearch=(body,extra={})=>handleResearch(accessStore,researchStore,body,{env:{},documentKey:DOCUMENT_KEY,contactKey:DOCUMENT_KEY,...options,...extra});
 const publicCall=(body,extra={})=>handleIntake(accessStore,researchStore,body,{clientAddress:'synthetic-local-client',...options,...extra});
 const checked=async(credential,action,payload={})=>{const [status,out]=await callResearch({token:credential,action,...payload});assert.equal(status,200,action+': '+JSON.stringify(out));return out;};
 async function seedStudy(title='מחקר שותפויות סינתטי',{active=true,categories=['surveys','usage','historical','generated','identities','contacts']}={}){
  let study=(await checked(tokens.owner,'studyCreate',request({config:{title}}))).study;
  const consentDefinition={title:'הסכמה סינתטית',text:'בדיקת תוכנה מקומית בלבד',categories,contactKinds:['followup','feedback','update'],retentionDays:30,withdrawalPolicy:'retain-consented',expectations:'בדיקה סינתטית בלבד'};
  const instrumentDefinition={title:'שאלון סינתטי בפיתוח',construct:'PLSE',validationStatus:'under-development',description:'בדיקת תוכנה',items:[{id:'q1',type:'number',label:'מספר סינתטי',required:true,min:1,max:5},{id:'q2',type:'text',label:'הערה סינתטית',required:false}]};
  const consent=(await checked(tokens.owner,'versionSave',request({studyId:study.id,expectedRevision:study.revision,kind:'consent',definition:consentDefinition})));study.revision=consent.revision;
  study.revision=(await checked(tokens.owner,'versionPublish',request({studyId:study.id,expectedRevision:study.revision,versionId:consent.version.id}))).revision;
  const instrument=(await checked(tokens.owner,'versionSave',request({studyId:study.id,expectedRevision:study.revision,kind:'instrument',definition:instrumentDefinition})));study.revision=instrument.revision;
  study.revision=(await checked(tokens.owner,'versionPublish',request({studyId:study.id,expectedRevision:study.revision,versionId:instrument.version.id}))).revision;
  study=(await checked(tokens.owner,'studySave',request({studyId:study.id,expectedRevision:study.revision,config:{title,description:'מחקר מקומי סינתטי',researchQuestions:['שאלת בדיקה'],principalInvestigator:'צוות בדיקה',population:'מידע מומצא',eligibleInstitutions:[],startDate:'2026-01-01',endDate:'2030-12-31',approvals:{status:'approved',reference:'SYNTHETIC-ONLY',documentation:'בדיקת תוכנה'},consentVersionId:consent.version.id,instrumentVersionIds:[instrument.version.id],schedule:[{waveId:'baseline',instrumentVersionId:instrument.version.id,offsetDays:0,reminderDays:[]}],dataCategories:categories,exportCategories:categories,retentionDays:30,withdrawalPolicy:'retain-consented',contactKinds:consentDefinition.contactKinds,expectations:consentDefinition.expectations}}))).study;
  if(active){study=(await checked(tokens.owner,'studyStatus',request({studyId:study.id,expectedRevision:study.revision,status:'pending_approval'}))).study;study=(await checked(tokens.owner,'studyStatus',request({studyId:study.id,expectedRevision:study.revision,status:'active',confirmApprovals:true}))).study;}
  const invite=active?(await checked(tokens.owner,'inviteCreate',request({studyId:study.id}))).invite:null;
  return {study,consent:consent.version,instrument:instrument.version,invite};
 }
 return {db:database.db,query,exec,tokens,codes,token,request,checked,callResearch,publicCall,seedStudy,accessStore,researchStore,documentKey:DOCUMENT_KEY,close:async()=>{await queue;await database.close();}};
}
