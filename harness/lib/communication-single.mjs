// Transient single compositions share the communication engine. Only an explicit
// conversion in communication-continuity writes a conversation row.
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { authorizePermission } from './access.mjs';
import { observeCommunicationUsage } from './research-usage.mjs';
const CORE=createRequire(import.meta.url)('../../app/lib/communication-core.js');
export const SINGLE_ACTIONS=new Set(['singleGenerate','singleExtract','singleEdit']);
const LIMITS={text:120000,instruction:12000,audience:120,format:120,localDetails:12000,signature:1000,entries:1000,actions:2000,bytes:12*1024*1024,attachmentBytes:10*1024*1024};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const has=Object.hasOwn;
const copy=value=>structuredClone(value);
function fail(status,code,message) {throw Object.assign(new Error(message),{status,code,communicationSingle:true});}
const invalid=()=>fail(400,'INVALID_INPUT','הפרטים אינם תקינים. אפשר לבדוק את הבקשה ולנסות שוב.');
const provenance=()=>fail(400,'PROVENANCE_INVALID','הגרסה או הקובץ השתנו מחוץ לכלי. אפשר להתחיל מהתוכן המקורי או מהגרסה התקינה.');
const limited=()=>fail(413,'STORAGE_LIMIT','התוכן גדול ממגבלת הכלי. כל המידע בטאב נשמר ואפשר לייצא אותו.');
function uuid(value) {if(typeof value!=='string'||!UUID.test(value))invalid();return value.toLowerCase();}
function text(value,max=LIMITS.text,optional=false) {
  if(optional&&value===undefined)return '';
  if(typeof value!=='string'||!optional&&!value.trim())invalid();
  if(value.length>max)limited();return value;
}
function stable(value) {
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,stable(value[key])]));
  return value;
}
function checkSize(value) {
  if(value.entries?.length>LIMITS.entries||value.actions?.length>LIMITS.actions||Buffer.byteLength(JSON.stringify(value),'utf8')>LIMITS.bytes)limited();
}
function identity(actor) {
  if(actor.k==='sys')return ['sys'];
  if(actor.k==='code')return ['code',actor.c,actor.inst,actor.kind,actor.s||null];
  if(actor.k==='open')return ['open',actor.o];
  if(actor.k==='inst')return ['inst',actor.inst];
  fail(403,'ACCESS_DENIED','אפשר להיכנס עם הרשאה פעילה לכלי התקשורת.');
}
async function singleActor(store,auth) {
  const actor=await authorizePermission(store,auth,'writer');
  if(!actor)fail(403,'ACCESS_DENIED','אפשר להיכנס עם הרשאה פעילה לכלי התקשורת.');
  return createHash('sha256').update(JSON.stringify(identity(actor))).digest('hex');
}
async function signature(store,actor,kind,value) {
  const secret=(await store.get('token-secret'))?.secret;
  if(typeof secret!=='string'||!secret)throw new Error('Signing unavailable');
  return createHmac('sha256',secret).update('be-good/communication/'+kind+'/'+actor+'/'+JSON.stringify(stable(value))).digest('hex');
}
async function verify(store,actor,kind,value,proof) {
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof proof!=='string'||!/^[0-9a-f]{64}$/.test(proof))provenance();
  checkSize(value);
  const expected=Buffer.from(await signature(store,actor,kind,value),'hex'),provided=Buffer.from(proof,'hex');
  if(!timingSafeEqual(provided,expected))provenance();
}
export async function verifiedSingleDocument(store,auth,document,proof,options={}) {
  const actor=await singleActor(store,auth);
  await verify(store,actor,'document',document,proof);
  if(document.mode!=='single'||!Array.isArray(document.entries)||!Array.isArray(document.actions)||!document.input
    ||!Number.isSafeInteger(document.revision)||document.revision<1)provenance();
  uuid(document.id);
  for(const entry of document.entries) {
    uuid(entry.id);
    if(!['note','received','draft','analysis'].includes(entry.kind)||entry.sentEntryId||entry.kind==='sent')provenance();
    text(entry.text,LIMITS.text,true);
  }
  const verified=copy(document);
  if(has(options,'input')) {
    const input=await normalizedInput(store,actor,options.input,{allowEmptyText:true});
    if(JSON.stringify(stable(input))!==JSON.stringify(stable(verified.input))) {
      const at=new Date().toISOString();
      sourceEntries(verified,input,at);verified.input=input;
      trace(verified,'singleInputUpdate',at);
    }
  }
  return {document:verified,actor};
}
async function normalizedInput(store,actor,value,{allowEmptyText=false}={}) {
  if(!value||typeof value!=='object'||Array.isArray(value))invalid();
  const input={text:text(value.text,LIMITS.text,allowEmptyText)};
  for(const field of ['instruction','audience','format','localDetails','signature'])input[field]=text(value[field],LIMITS[field],true);
  input.materials=[];
  if(has(value,'materials')) {
    if(!Array.isArray(value.materials)||value.materials.length>LIMITS.entries)invalid();
    const ids=new Set();
    for(const item of value.materials) {
      await verify(store,actor,'material',item?.material,item?.proof);
      const material=item.material;
      if(material.kind!=='material'||!material.source)provenance();
      uuid(material.id);text(material.text);
      if(ids.has(material.id))invalid();ids.add(material.id);
      input.materials.push({material:copy(material),proof:item.proof});
    }
  }
  checkSize(input);return input;
}
function attachment(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||!['image','pdf','text'].includes(value.kind))invalid();
  const result={kind:value.kind,name:text(value.name,240)};
  if(has(value,'mediaType'))result.mediaType=text(value.mediaType,120,true);
  if(value.kind==='text')result.text=text(value.text);
  else {
    if(typeof value.data!=='string'||!value.data)invalid();
    if(value.data.length>Math.ceil(LIMITS.attachmentBytes/3)*4)fail(413,'ATTACHMENT_TOO_LARGE','הקובץ גדול מהמגבלה של 10 מגה־בייט. אפשר לצרף קובץ קטן יותר.');
    result.data=value.data;
  }
  return result;
}
function entry(kind,value,at,extra={}) {return {id:randomUUID(),kind,text:value,at,versions:{...CORE.VERSIONS},...extra};}
function selectedDraft(document,id) {
  const found=document.entries.find(value=>value.id===uuid(id)&&value.kind==='draft');
  if(!found)fail(400,'DRAFT_NOT_FOUND','אפשר לבחור טיוטה מתוך התוצר הנוכחי.');return found;
}
function sourceEntries(document,input,at) {
  const sources=[];
  function note(field,value,purpose) {
    if(!value)return;
    let found=document.entries.findLast(e=>e.kind==='note'&&e.source?.purpose==='single-input'&&e.source.field===field);
    if(found?.text!==value) {found=entry('note',value,at,{notePurpose:purpose,source:{purpose:'single-input',field}});document.entries.push(found);}
    sources.push(found);
  }
  note('text',input.text,'instruction');note('instruction',input.instruction,'instruction');
  const composition={format:input.format,localDetails:input.localDetails,signature:input.signature};
  note('composition',JSON.stringify({audience:input.audience,...composition,instruction:input.instruction}),'composition');
  const entriesById=new Map();
  if(input.materials.length) {
    for(const existing of document.entries) {
      if(!entriesById.has(existing.id))entriesById.set(existing.id,existing);
    }
  }
  for(const {material} of input.materials) {
    let found=entriesById.get(material.id);
    if(!found) {found={...copy(material),kind:'received'};document.entries.push(found);entriesById.set(found.id,found);}
    sources.push(found);
  }
  return {sources,composition};
}
function trace(document,action,at,model) {
  document.revision++;document.updatedAt=at;
  document.actions.push({action,at,revision:document.revision,versions:{...CORE.VERSIONS},...(model?{model:copy(model)}:{})});
  checkSize(document);
}
async function recheck(store,auth,actor) {
  if(await singleActor(store,auth)!==actor)fail(403,'ACCESS_DENIED','ההרשאה לכלי השתנתה. אפשר להיכנס שוב.');
}
export async function handleSingleCommunication(store,body,{providerFactory,onReady,onUsage}={}) {
  const startedAt=Date.now();
  const actor=await singleActor(store,body.token);
  uuid(body.requestId);
  const at=new Date().toISOString();
  const ai=await import('./communication-ai.mjs');
  if(body.action==='singleExtract') {
    const source=attachment(body.attachment);
    let provider;
    if(source.kind!=='text') {
      if(typeof providerFactory!=='function')fail(503,'AI_UNAVAILABLE','החיבור לכתיבה אינו זמין כרגע. אפשר לנסות שוב בהמשך.');
      if(typeof onReady==='function')await onReady();provider=await providerFactory();
    }
    const extracted=await ai.extractCommunicationAttachment({attachment:source,provider,purpose:'communication-material'});
    const material=entry('material',text(extracted.text),at,{source:copy(extracted.source),...(extracted.model?{model:copy(extracted.model)}:{})});
    await recheck(store,body.token,actor);
    return [200,{material,proof:await signature(store,actor,'material',material)}];
  }
  let document;
  if(has(body,'document')||has(body,'proof'))document=(await verifiedSingleDocument(store,body.token,body.document,body.proof)).document;
  const usageBefore={hasAI:document?.entries.some(entry=>['draft','analysis'].includes(entry.kind))===true,draftText:document?.entries.find(entry=>entry.id===body.entryId)?.text};
  if(body.action==='singleEdit') {
    if(!document)invalid();
    const found=selectedDraft(document,body.entryId),value=text(body.text);
    if(found.text!==value) {
      found.revisions=[...(found.revisions||[]),{text:found.text,at:found.editedAt||found.at,versions:copy(found.versions),...(found.model?{model:copy(found.model)}:{})}];
      found.text=value;found.editedAt=at;found.versions={...CORE.VERSIONS};
      if(document.latestAI?.entryId===found.id)document.latestAI.message=value;
    }
    trace(document,'singleEdit',at);
  } else if(body.action==='singleGenerate') {
    const input=await normalizedInput(store,actor,body.input);
    if(!document)document={id:randomUUID(),mode:'single',revision:0,createdAt:at,updatedAt:at,input,entries:[],versions:{...CORE.VERSIONS},actions:[]};
    const draft=has(body,'entryId')?selectedDraft(document,body.entryId):undefined;
    if(has(body,'revisionStyle')&&(!has(CORE.REVISIONS,body.revisionStyle)||!draft))invalid();
    const {sources,composition}=sourceEntries(document,input,at);
    document.input=input;checkSize(document);
    if(typeof providerFactory!=='function')fail(503,'AI_UNAVAILABLE','החיבור לכתיבה אינו זמין כרגע. אפשר לנסות שוב בהמשך.');
    if(typeof onReady==='function')await onReady();
    const provider=await providerFactory(),currentDraft=draft?copy(draft):undefined;
    // Summary calls are retained for provenance, not reused as single-mode
    // memory. The editing target remains its exact current source/draft text.
    if(currentDraft)delete currentDraft.contextSummaries;
    const canonical=[...sources,...(currentDraft?[currentDraft]:[])];
    const {output,model,summaries=[]}=await ai.generateCommunication({conversation:{id:document.id,title:input.text.slice(0,160),audience:input.audience,entries:canonical,versions:document.versions,revision:document.revision},
      action:'suggest',instruction:input.instruction,communicationMode:'single',composition,revisionStyle:body.revisionStyle,draft:currentDraft,provider});
    text(output.message,LIMITS.text,true);
    const source={entryIds:canonical.map(e=>e.id),purpose:'generation'};
    const contextSummaries=summaries.map(summary=>{
      if(!summary.source?.entryIds?.length||summary.source.entryIds.some(id=>!source.entryIds.includes(id)))fail(422,'AI_OUTPUT_INVALID','לא התקבלה תשובה תקינה. אפשר לנסות שוב.');
      return {...copy(summary),at:summary.at||at,versions:copy(summary.versions||CORE.VERSIONS)};
    });
    const result=entry(output.message?'draft':'analysis',output.message||'',at,{model:copy(model),source,why:output.why,next:output.next,analysis:copy(output.analysis),clarification:output.clarification,
      mode:'suggest',communicationMode:'single',...(contextSummaries.length?{contextSummaries}:{}),...(draft?{draftId:draft.id,...(body.revisionStyle?{revisionStyle:body.revisionStyle}:{})}:{})});
    document.entries.push(result);document.latestAI={...copy(output),model:copy(model),source,mode:'suggest',communicationMode:'single',at,entryId:result.id};
    trace(document,'singleGenerate',at,model);
  } else invalid();
  await recheck(store,body.token,actor);
  const proof=await signature(store,actor,'document',document);
  observeCommunicationUsage(onUsage,body,usageBefore,document,startedAt);
  return [200,{document,proof}];
}
