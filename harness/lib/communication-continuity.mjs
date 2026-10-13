// One private row per conversation. CAS protects changes across server instances;
// provider calls deliberately run without a storage lock. Compact private retry
// receipts hold no raw content and replay the latest canonical conversation.
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { authorizePermission } from './access.mjs';
const CORE = createRequire(import.meta.url)('../../app/lib/communication-core.js');
export const COMMUNICATION_LIMITS = Object.freeze({ text:120000, title:160, audience:120, instruction:12000,
  entries:1000, requests:2000, conversations:1000, rowBytes:12*1024*1024, attachmentBytes:10*1024*1024 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['list','create','get','update','append','editDraft','markSent','delete','export','generate','extract']);
const MUTATIONS = new Set(['create','update','append','editDraft','markSent','delete','generate','extract']);
const AI_ERRORS = {
  AI_OUTPUT_INVALID:[422,'לא התקבלה תשובה תקינה. אפשר לנסות שוב.'],
  AI_CONTEXT_LIMIT:[413,'השיחה ארוכה מכדי לעבד אותה במודל הזמין. כל התוכן השמור נשמר במלואו.'],
  ATTACHMENT_UNREADABLE:[422,'לא ניתן לקרוא את הקובץ. אפשר לצרף קובץ ברור יותר או להדביק את הטקסט.'],
  ATTACHMENT_INVALID:[400,'הקובץ אינו תקין. אפשר לבחור קובץ אחר.'],
  ATTACHMENT_UNSUPPORTED:[400,'סוג הקובץ אינו נתמך. אפשר לצרף תמונה, PDF או טקסט.'],
  ATTACHMENT_TOO_LARGE:[413,'הקובץ גדול מהמגבלה של 10 מגה־בייט. אפשר לצרף קובץ קטן יותר.']
};
class CommunicationError extends Error {
  constructor(status,code,error) { super(error); this.status=status; this.code=code; }
}
const fail = (status,code,message) => { throw new CommunicationError(status,code,message); };
const invalid = () => fail(400,'INVALID_INPUT','הפרטים אינם תקינים. אפשר לבדוק את הבקשה ולנסות שוב.');
const conflict = () => fail(409,'REVISION_CONFLICT','השיחה עודכנה במקביל. אפשר לפתוח את הגרסה העדכנית ולנסות שוב.');
const missing = () => fail(404,'NOT_FOUND','השיחה אינה זמינה בחשבון הזה.');
const limited = () => fail(413,'STORAGE_LIMIT','הבקשה גדולה ממגבלת השמירה. כל המידע הקיים נשמר במלואו. אפשר לייצא את השיחה.');
const clone = value => structuredClone(value);
const has = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
function text(value,max=COMMUNICATION_LIMITS.text,{optional=false}={}) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || (!optional && !value.trim())) invalid();
  if (value.length > max) limited();
  return value;
}
function uuid(value) { if(typeof value!=='string'||!UUID.test(value)) invalid();return value.toLowerCase(); }
function stable(value) {
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])]));
  return value;
}
const sha = value => createHash('sha256').update(value).digest('hex');
async function owner(store,auth) {
  const actor = await authorizePermission(store,auth,'writer');
  if(!actor || !(actor.k==='sys'||actor.k==='code'&&actor.c!=='LEGACY'&&['staff','instadmin'].includes(actor.kind)))
    fail(403,'ACCESS_DENIED','כדי לשמור שיחות אישיות, אפשר להיכנס עם קוד צוות אישי פעיל.');
  return sha(JSON.stringify(actor.k==='sys'?['sys']:['code',actor.c,actor.inst,actor.kind]));
}
function publicConversation(record) {
  const { _requests, ...conversation } = record;
  return clone(conversation);
}
function receipt(record,requestId,fingerprint) {
  const previous=record?._requests?.[requestId];
  if(!previous) return null;
  if(previous.fingerprint!==fingerprint) fail(409,'REQUEST_REUSED','מזהה הבקשה כבר שימש לבקשה אחרת. אפשר לנסות עם מזהה חדש.');
  return [200,record._deleted?{deleted:true}:{conversation:publicConversation(record)}];
}
function checkSize(record) {
  if(record.entries?.length>COMMUNICATION_LIMITS.entries||Object.keys(record._requests||{}).length>COMMUNICATION_LIMITS.requests
    ||Buffer.byteLength(JSON.stringify(record),'utf8')>COMMUNICATION_LIMITS.rowBytes) limited();
}
function entry(kind,value,at,extra={}) { return { id:randomUUID(),kind,text:value,at,versions:{...CORE.VERSIONS},...extra }; }
function draft(record,id) {
  const found=record.entries.find(e=>e.id===uuid(id));
  if(!found||found.kind!=='draft') fail(400,'DRAFT_NOT_FOUND','אפשר לבחור טיוטה שמורה מתוך השיחה.');
  return found;
}

// Research stays optional and distinct from the professional raw history. This
// configuration is server-owned; ordinary product terms never grant consent.
const RESEARCH_FIELDS = new Set(['versions','model','conversationId','rounds','drafts','revisions','category','timing']);
function approvedStudy(study) {
  return study?.approved===true&&typeof study.id==='string'&&!!study.id&&typeof study.consentVersion==='string'&&!!study.consentVersion
    &&Array.isArray(study.approvedFields)&&study.approvedFields.every(k=>RESEARCH_FIELDS.has(k));
}
function consent(value,study,at) {
  if(value?.accepted===false) return undefined;
  if(!approvedStudy(study)
    ||value?.accepted!==true||value.separateFromTerms!==true||value.studyId!==study.id||value.version!==study.consentVersion
    )
    fail(400,'RESEARCH_CONSENT_INVALID','השתתפות במחקר זמינה רק במחקר מאושר ועם הסכמה נפרדת ותקפה.');
  return {consent:{studyId:study.id,version:study.consentVersion,acceptedAt:at,separateFromTerms:true},metadata:{}};
}
function refreshResearch(record,study) {
  if(!record.research) return;
  if(!approvedStudy(study)||record.research.consent.studyId!==study.id||record.research.consent.version!==study.consentVersion) {
    // Never collect additional data after the configured approval/consent ends.
    delete record.research; return;
  }
  const category={ 'תלמיד/ה':'student','תלמידים':'student','הורה':'parent','הורים':'parent','צוות':'staff','מנהל/ת':'leadership','הנהלה':'leadership' }[record.audience]||'other';
  const available={versions:{...CORE.VERSIONS},model:record.latestAI?.model||null,conversationId:record.id,rounds:record.rounds,category,
    drafts:record.entries.filter(e=>e.kind==='draft').length,
    revisions:record.entries.reduce((n,e)=>n+(e.revisions?.length||0)+(e.kind==='draft'&&e.draftId?1:0),0),
    timing:{createdAt:record.createdAt,updatedAt:record.updatedAt}};
  record.research.metadata=Object.fromEntries(study.approvedFields.filter(k=>RESEARCH_FIELDS.has(k)).map(k=>[k,available[k]]));
}
function normalized(body) {
  const action=body.action;
  const payload={action,id:action==='list'?undefined:uuid(body.id)};
  if(MUTATIONS.has(action)) {
    payload.requestId=uuid(body.requestId);
    if(action==='create'?body.expectedRevision!==null:!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1) invalid();
    payload.expectedRevision=body.expectedRevision;
  }
  if(action==='create'||action==='update') {
    for(const field of ['title','audience']) if(has(body,field)) payload[field]=text(body[field],COMMUNICATION_LIMITS[field],{optional:true}).trim();
    if(has(body,'status')) { if(!has(CORE.STATUSES,body.status)) invalid(); payload.status=body.status; }
    if(has(body,'researchConsent')) payload.researchConsent=body.researchConsent;
    if(action==='update'&&!['title','audience','status','researchConsent'].some(field=>has(payload,field))) invalid();
  }
  if(action==='append') {
    if(!['received','sent','note'].includes(body.kind)) invalid();
    payload.kind=body.kind;payload.text=text(body.text);
  }
  if(action==='editDraft'||action==='markSent') {
    payload.entryId=uuid(body.entryId);
    if(action==='editDraft'||has(body,'text')) payload.text=text(body.text);
  }
  if(action==='generate') {
    if(!has(CORE.ACTIONS,body.mode)) invalid();payload.mode=body.mode;
    payload.instruction=text(body.instruction,COMMUNICATION_LIMITS.instruction,{optional:true});
    if(has(body,'entryId')) payload.entryId=uuid(body.entryId);
    if(has(body,'revisionStyle')) {
      if(!has(CORE.REVISIONS,body.revisionStyle)||!payload.entryId) invalid();payload.revisionStyle=body.revisionStyle;
    }
  }
  if(action==='extract') {
    const value=body.attachment;
    if(!value||typeof value!=='object'||!['image','pdf','text'].includes(value.kind)) invalid();
    payload.attachment={kind:value.kind,name:text(value.name,240)};
    if(has(value,'mediaType')) payload.attachment.mediaType=text(value.mediaType,120,{optional:true});
    if(value.kind==='text') payload.attachment.text=text(value.text);
    else {
      if(typeof value.data!=='string'||!value.data) invalid();
      if(value.data.length>Math.ceil(COMMUNICATION_LIMITS.attachmentBytes/3)*4) fail(413,'ATTACHMENT_TOO_LARGE',AI_ERRORS.ATTACHMENT_TOO_LARGE[1]);
      payload.attachment.data=value.data;
    }
  }
  return payload;
}
async function save(store,key,expected,record,payload,researchStudy) {
  record.updatedAt=new Date().toISOString();record.revision=expected===null?1:expected+1;
  record.rounds=record.entries.filter(e=>e.kind==='received').length;
  refreshResearch(record,researchStudy);
  const outcome={conversation:publicConversation(record)};
  record._requests={...(record._requests||{}),[payload.requestId]:{fingerprint:sha(JSON.stringify(stable(payload))),action:payload.action,revision:record.revision}};
  checkSize(record);
  if(typeof store.compareSet!=='function') throw new Error('Atomic storage unavailable');
  if(!await store.compareSet(key,expected,record)) {
    const current=await store.get(key);
    if(current?._deleted) missing();
    const retry=receipt(current,payload.requestId,sha(JSON.stringify(stable(payload))));
    if(retry) return retry;
    conflict();
  }
  return [200,clone(outcome)];
}

export async function handleCommunication(store,body,{providerFactory,researchStudy,onReady}={}) {
  try {
    if(!body||typeof body!=='object'||Array.isArray(body)) invalid();
    const trustedOwner=await owner(store,body.token);
    if(!ACTIONS.has(body.action)) invalid();
    const payload=normalized(body),prefix='cc:'+trustedOwner+':';
    if(payload.action==='list') {
      const rows=await store.list(prefix);
      if(rows.length>COMMUNICATION_LIMITS.conversations) limited();
      const conversations=rows.filter(r=>r.value&&!r.value._deleted).map(r=>publicConversation(r.value)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
      if(Buffer.byteLength(JSON.stringify(conversations),'utf8')>COMMUNICATION_LIMITS.rowBytes) limited();
      return [200,{conversations}];
    }
    const key=prefix+payload.id,stored=await store.get(key);
    const fingerprint=sha(JSON.stringify(stable(payload)));
    // A tombstone cannot return older cached conversations, including retries.
    if(stored?._deleted) {
      if(payload.action==='delete') {const retry=receipt(stored,payload.requestId,fingerprint);if(retry)return retry;}
      if(payload.action==='create') conflict();
      missing();
    }
    if(MUTATIONS.has(payload.action)) {const retry=receipt(stored,payload.requestId,fingerprint);if(retry)return retry;}
    if(payload.action==='create') {
      if(stored) conflict();
      if((await store.list(prefix,{keysOnly:true})).length>=COMMUNICATION_LIMITS.conversations) limited();
      const at=new Date().toISOString();
      const record={id:payload.id,title:payload.title||'שיחה חדשה',audience:payload.audience||'',status:payload.status||'active',createdAt:at,updatedAt:at,
        revision:1,rounds:0,entries:[],versions:{...CORE.VERSIONS}};
      if(has(payload,'researchConsent')) record.research=consent(payload.researchConsent,researchStudy,at);
      if(record.research===undefined) delete record.research;
      return await save(store,key,null,record,payload,researchStudy);
    }
    if(!stored) missing();
    if(payload.action==='get'||payload.action==='export') return [200,{conversation:publicConversation(stored)}];
    if(stored.revision!==payload.expectedRevision) conflict();
    const record=clone(stored),at=new Date().toISOString();
    if(payload.action==='delete') {
      const tombstone={id:payload.id,revision:stored.revision+1,_deleted:true,deletedAt:at,
        _requests:{[payload.requestId]:{fingerprint,action:'delete',revision:stored.revision+1}}};
      if(!await store.compareSet(key,stored.revision,tombstone)) {
        const current=await store.get(key);const retry=receipt(current,payload.requestId,fingerprint);if(retry)return retry;conflict();
      }
      return [200,{deleted:true}];
    }
    if(payload.action==='update') {
      for(const field of ['title','audience','status']) if(has(payload,field)) record[field]=payload[field];
      if(has(payload,'researchConsent')) {
        record.research=consent(payload.researchConsent,researchStudy,at);
        if(record.research===undefined) delete record.research;
      }
    }
    if(payload.action==='append') record.entries.push(entry(payload.kind,payload.text,at));
    if(payload.action==='editDraft') {
      const found=draft(record,payload.entryId);
      if(found.text!==payload.text) {
        found.revisions=[...(found.revisions||[]),{text:found.text,at:found.editedAt||found.at,versions:clone(found.versions),...(found.model?{model:clone(found.model)}:{})}];
        found.text=payload.text;found.editedAt=at;
      }
    }
    if(payload.action==='markSent') {
      const found=draft(record,payload.entryId),sendText=has(payload,'text')?payload.text:found.text;
      const sent=record.entries.find(e=>e.id===found.sentEntryId);
      if(!sent||sent.text!==sendText) {
        const snapshot=entry('sent',sendText,at,{draftId:found.id,...(found.model?{model:clone(found.model)}:{})});
        record.entries.push(snapshot);found.sentEntryId=snapshot.id;
      }
    }
    if(payload.action==='generate'||payload.action==='extract') {
      // Validate selected draft before opening a provider or starting keep-alive.
      const selected=payload.entryId?draft(record,payload.entryId):undefined;
      if(record.entries.length>=COMMUNICATION_LIMITS.entries) limited();
      if(typeof onReady==='function') await onReady();
      const ai=await import('./communication-ai.mjs');
      const needsProvider=payload.action==='generate'||payload.attachment.kind!=='text';
      let configured;
      if(needsProvider) {
        if(typeof providerFactory!=='function') fail(503,'AI_UNAVAILABLE','החיבור לכתיבה אינו זמין כרגע. אפשר לשמור את השיחה ולנסות שוב בהמשך.');
        configured=await providerFactory();
      }
      if(payload.action==='generate') {
        const {output,summaries=[],model}=await ai.generateCommunication({conversation:publicConversation(stored),action:payload.mode,instruction:payload.instruction,
          revisionStyle:payload.revisionStyle,draft:selected?clone(selected):undefined,provider:configured});
        const sourceIds=new Set(record.entries.map(e=>e.id));
        for(const summary of summaries) {
          if(!summary.source?.entryIds?.length||summary.source.entryIds.some(id=>!sourceIds.has(id))) fail(422,'AI_OUTPUT_INVALID',AI_ERRORS.AI_OUTPUT_INVALID[1]);
          record.entries.push(entry('summary',text(summary.text),at,{model,source:clone(summary.source),...(summary.analysis?{analysis:clone(summary.analysis)}:{}),...(summary.context?{context:clone(summary.context)}:{})}));
        }
        text(output.message,COMMUNICATION_LIMITS.text,{optional:true});
        const source={entryIds:stored.entries.map(e=>e.id),purpose:'generation'};
        const result=entry(output.message?'draft':'analysis',output.message||'',at,{model,source,why:output.why,next:output.next,analysis:clone(output.analysis),
          clarification:output.clarification,mode:payload.mode,...(selected?{draftId:selected.id,revisionStyle:payload.revisionStyle}: {})});
        record.entries.push(result);record.latestAI={...clone(output),model,source,mode:payload.mode,at,entryId:result.id};
      } else {
        const extracted=await ai.extractCommunicationAttachment({attachment:payload.attachment,provider:configured});
        record.entries.push(entry('received',text(extracted.text),at,{source:clone(extracted.source),...(extracted.model?{model:clone(extracted.model)}:{})}));
      }
      // Neither access nor the original revision is assumed to remain valid
      // while AI is in flight. No result overwrites a later edit or deletion.
      if(await owner(store,body.token)!==trustedOwner) fail(403,'ACCESS_DENIED','הגישה לשיחה השתנתה. אפשר להיכנס שוב עם קוד אישי פעיל.');
      const current=await store.get(key);
      if(!current||current._deleted) missing();
      const retry=receipt(current,payload.requestId,fingerprint);if(retry)return retry;
      if(current.revision!==stored.revision) conflict();
    }
    return await save(store,key,stored.revision,record,payload,researchStudy);
  } catch(error) {
    if(error instanceof CommunicationError) return [error.status,{code:error.code,error:error.message}];
    if(AI_ERRORS[error?.code]) {const [status,message]=AI_ERRORS[error.code];return [status,{code:error.code,error:message}];}
    // Provider/store exception messages may contain prompts, URLs or secrets.
    return [503,{code:'SERVICE_UNAVAILABLE',error:'השמירה או הכתיבה אינן זמינות כרגע. אפשר לנסות שוב בהמשך.'}];
  }
}
