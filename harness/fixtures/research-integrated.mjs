// Isolated development QA: unchanged PostgreSQL migration, real handlers and
// synthetic credentials/model/mail only. No production configuration is read.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createResearchDatabase, SECRET, OWNER_AUTH_VERSION, token, request } from './research-database.mjs';
import { ResearchStoreError } from '../lib/research-store.mjs';
import { handleResearch } from '../lib/research.mjs';
import { handleCommunication } from '../lib/communication-continuity.mjs';
import { runResearchMail } from '../lib/research-mail.mjs';

export { token, request };
export const CONTACT_KEY = Buffer.alloc(32, 37).toString('base64');
export const SITE_ORIGIN = 'https://research.example.test';
export async function createResearchIntegration(options = {}) {
  const database = await createResearchDatabase();
  let queue = Promise.resolve();
  const serialize = fn => { const pending = queue.then(fn); queue = pending.catch(() => {}); return pending; };
  const query = (sql, values) => serialize(() => database.db.query(sql, values));
  const exec = sql => serialize(() => database.db.exec(sql));
  const data = new Map((await query('SELECT key,value FROM public.access_settings')).rows.map(r => [r.key, r.value]));
  const clone = value => value == null ? null : structuredClone(value);
  const codes = { a:'STAFFA', b:'STAFFB', participant:'PERSON1', ordinary:'ORDINARY1', multi:'MULTI1' };
  for (const code of Object.values(codes)) {
    const value = { code, kind:'staff', inst:'Synthetic School', perms:['writer'], revoked:false };
    data.set('code:' + code, value);
    await query('INSERT INTO public.access_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', ['code:' + code, value]);
  }
  const modules = { writer:true }; data.set('modules:Synthetic School', modules);
  await query('INSERT INTO public.access_settings VALUES($1,$2)', ['modules:Synthetic School', modules]);
  const tokens = { owner:token({k:'sys',authVersion:OWNER_AUTH_VERSION}), worker:token({k:'research_worker',purpose:'research',exp:Date.now()+300000}) };
  for (const [name, code] of Object.entries(codes)) tokens[name] = token({k:'code',c:code,kind:'staff',inst:'Synthetic School'});
  const writes = [];
  const accessStore = {
    async get(key) { return clone(data.get(key)); },
    async set(key,value) { data.set(key,clone(value));writes.push(key);if (!key.startsWith('cc:')) await query('INSERT INTO public.access_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[key,value]); },
    async list(prefix) { return [...data].filter(([key]) => key.startsWith(prefix)).map(([key,value]) => ({key,value:clone(value)})); },
    async compareSet(key,expected,value) { const current=data.get(key);if(expected===null?current!=null:current?.revision!==expected)return false;data.set(key,clone(value));writes.push(key);return true; }
  };
  const researchStore = { async rpc(credential,action,payload={}) {
    const result = await serialize(() => database.rpc(credential,action,payload));
    if (result?.error) throw new ResearchStoreError(result.error,result.status);
    return result;
  } };
  const providerInputs=[], mailRequests=[], usageObservations=[], usagePending=new Set();
  const fields=['facts','interpretations','control','influence','outsideControl','responsibility','resources','barriers','agreements','openQuestions','followUp'];
  const provider={id:'anthropic',model:'synthetic-research-qa',async complete({system,messages}) {
    const raw=messages[0].content;
    const input=JSON.parse(Array.isArray(raw)?raw.find(block=>block.type==='text').text:raw);
    providerInputs.push(clone(input));
    if(input.operation==='attachment-extraction')return {text:JSON.stringify({text:'טקסט סינתטי לבדיקת חילוץ.',unreadable:false}),raw:{model:'synthetic-research-qa'}};
    const analysis=Object.fromEntries(fields.map(k=>[k,[]]));analysis.facts=['הוגדר מפגש כיתתי.'];
    return {text:JSON.stringify({message:(input.selectedDraft?.text||'הורים יקרים, ניפגש ביום חמישי לשיחה משותפת על פעילות הכיתה.')+(input.revisionStyle?' גרסה נוספת לבדיקה.':''),why:'נוסח סינתטי לבדיקת הממשק.',next:'בדיקת הנוסח לפני השימוש.',clarification:'',analysis}),raw:{model:'synthetic-research-qa'}};
  }};
  let resolveGeneratedSample=options.resolveGeneratedSample;
  const researchOptions={contactKey:CONTACT_KEY,siteOrigin:SITE_ORIGIN,
    resolveGeneratedSample:args=>{if(typeof resolveGeneratedSample!=='function')throw Object.assign(new Error('not_configured'),{status:503,code:'not_configured'});return resolveGeneratedSample(args);}};
  const callResearch=(body,extra={})=>handleResearch(accessStore,researchStore,body,{...researchOptions,...extra});
  const callCommunication=(body,extra={})=>handleCommunication(accessStore,body,{providerFactory:()=>provider,onUsage:event=>{usageObservations.push(clone(event));const pending=researchStore.rpc(body.token,'recordUsage',event);usagePending.add(pending);pending.finally(()=>usagePending.delete(pending)).catch(()=>{});return pending;},...extra});
  async function settleUsage(){while(usagePending.size)await Promise.allSettled([...usagePending]);await queue;}
  async function checked(credential,action,payload={}) { const [status,out]=await callResearch({token:credential,action,...payload});assert.equal(status,200,action+': '+JSON.stringify(out));return out; }
  async function seedStudy(title='Synthetic Research',{active=true,categories=['surveys','usage','historical','generated','identities','contacts'],withdrawalPolicy='retain-consented'}={}) {
    let study=(await checked(tokens.owner,'studyCreate',request({config:{title}}))).study;
    const consentDefinition={title:'הסכמה סינתטית לבדיקה',text:'מחקר סינתטי מקומי בלבד. הבחירה בכל קטגוריית נתונים נפרדת.',categories,contactKinds:['followup','feedback','update'],retentionDays:30,withdrawalPolicy,expectations:'שאלון ודוגמאות לבחירה, ללא מחקר אמיתי.'};
    const instrumentDefinition={title:'שאלון סינתטי בפיתוח',construct:'PLSE',validationStatus:'under-development',description:'פריטים לצורכי בדיקת תוכנה בלבד.',items:[{id:'q1',type:'number',label:'מספר לבדיקת תוכנה',required:true,min:1,max:5},{id:'q2',type:'text',label:'הערה לבדיקת תוכנה',required:false}]};
    const savedConsent=await checked(tokens.owner,'versionSave',request({studyId:study.id,expectedRevision:study.revision,kind:'consent',definition:consentDefinition}));study.revision=savedConsent.revision;
    study.revision=(await checked(tokens.owner,'versionPublish',request({studyId:study.id,expectedRevision:study.revision,versionId:savedConsent.version.id}))).revision;
    const savedInstrument=await checked(tokens.owner,'versionSave',request({studyId:study.id,expectedRevision:study.revision,kind:'instrument',definition:instrumentDefinition}));study.revision=savedInstrument.revision;
    study.revision=(await checked(tokens.owner,'versionPublish',request({studyId:study.id,expectedRevision:study.revision,versionId:savedInstrument.version.id}))).revision;
    const config={title,description:'מחקר סינתטי מקומי',researchQuestions:['שאלת בדיקת תוכנה'],principalInvestigator:'צוות בדיקה סינתטי',population:'מחנכים סינתטיים',eligibleInstitutions:[],startDate:'2026-01-01',endDate:'2030-12-31',approvals:{status:'approved',reference:'SYNTHETIC-ONLY',documentation:'אישור סינתטי לבדיקת תוכנה בלבד'},consentVersionId:savedConsent.version.id,instrumentVersionIds:[savedInstrument.version.id],schedule:[{waveId:'baseline',instrumentVersionId:savedInstrument.version.id,offsetDays:0,reminderDays:[]}],dataCategories:categories,exportCategories:categories,contactKinds:consentDefinition.contactKinds,retentionDays:30,withdrawalPolicy,expectations:consentDefinition.expectations};
    study=(await checked(tokens.owner,'studySave',request({studyId:study.id,expectedRevision:study.revision,config}))).study;
    if(active){study=(await checked(tokens.owner,'studyStatus',request({studyId:study.id,expectedRevision:study.revision,status:'pending_approval'}))).study;study=(await checked(tokens.owner,'studyStatus',request({studyId:study.id,expectedRevision:study.revision,status:'active',confirmApprovals:true}))).study;}
    const invite=active?(await checked(tokens.owner,'inviteCreate',request({studyId:study.id}))).invite:null;
    return {study,consent:savedConsent.version,instrument:savedInstrument.version,invite};
  }
  async function runMail(extra={}) { return runResearchMail(accessStore,researchStore,{contactKey:CONTACT_KEY,siteOrigin:SITE_ORIGIN,apiKey:'synthetic-not-a-provider-key',from:'Synthetic QA <qa@example.invalid>',fetchImpl:async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');mailRequests.push({body:JSON.parse(init.body),idempotencyKey:init.headers['Idempotency-Key']});return {ok:true,status:200,json:async()=>({id:'synthetic-mail-'+mailRequests.length})};},...extra}); }
  return {db:database.db,accessStore,researchStore,tokens,token,request,codes,query,exec,callResearch,callCommunication,checked,seedStudy,runMail,settleUsage,provider,providerInputs,mailRequests,usageObservations,writes,contactKey:CONTACT_KEY,siteOrigin:SITE_ORIGIN,secret:SECRET,setResolveGeneratedSample(fn){resolveGeneratedSample=fn;},close:async()=>{await settleUsage();await database.close();}};
}
