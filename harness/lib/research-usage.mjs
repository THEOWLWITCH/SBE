// Shared server observations and source verification; no independent writing engine.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const COMMUNICATION = require('../../app/lib/communication-core.js');
const RESEARCH = require('../../app/lib/research-core.js');
const copy = value => value == null ? null : structuredClone(value);
const hasAI = record => record?.entries?.some(entry => ['draft', 'analysis'].includes(entry.kind)) === true;
const audiences = { 'הורים':'parent', 'הורה':'parent', 'תלמידים':'student', 'תלמיד/ה':'student', 'צוות':'staff', 'הנהלה':'leadership', 'מנהל/ת':'leadership' };

export function observeCommunicationUsage(onUsage, body, before, current, startedAt) {
  if (typeof onUsage !== 'function') return;
  let operation, model = null;
  const counts = {sessions:0,drafts:0,revisions:0,rounds:0};
  const mode = current.mode === 'single' ? 'single' : 'continuity';
  const previousAI = before?.hasAI ?? hasAI(before);
  const selected = current.entries?.find(entry => entry.id === body.entryId);
  if (['singleGenerate', 'generate'].includes(body.action)) {
    const output = current.entries.find(entry => entry.id === current.latestAI?.entryId);
    if (!output) return;
    operation = body.entryId ? 'revise' : 'generate';
    counts.sessions = previousAI ? 0 : 1; counts.drafts = output.kind === 'draft' ? 1 : 0;
    counts.revisions = body.entryId ? 1 : 0; model = output.model || null;
  } else if (['singleEdit', 'editDraft'].includes(body.action)) {
    const oldText = body.action === 'singleEdit' ? before?.draftText : before?.entries?.find(entry => entry.id === body.entryId)?.text;
    if (!selected || oldText === selected.text) return;
    operation = 'revise'; counts.revisions = 1;
  } else if (body.action === 'extract' || body.action === 'append' && body.kind === 'received') {
    operation = 'communicationRound'; counts.rounds = 1;
    model = body.action === 'extract' ? current.entries.at(-1)?.model || null : null;
  } else if (body.action === 'convert') operation = 'convert';
  else return;
  const at = Date.now();
  const event = {
    eventId:body.requestId, operation, mode, sourceId:current.origin?.documentId || current.id,
    timestamp:new Date(at).toISOString(), durationMs:Math.max(0, at - startedAt),
    audience:audiences[mode === 'single' ? current.input?.audience : current.audience] || 'other', counts,
    versions:{...COMMUNICATION.VERSIONS,...RESEARCH.VERSIONS,communicationSchema:COMMUNICATION.VERSIONS.schema,model:copy(model)}
  };
  // Completion is independent of research. The gateway RPC has its own bounded timeout.
  Promise.resolve().then(() => onUsage(event)).catch(() => {});
}

export async function resolveResearchGeneratedSample(accessStore, {token, generatedSource}) {
  const failure = status => Object.assign(new Error(status === 404 ? 'not_found' : 'invalid'),{status,code:status === 404 ? 'not_found' : 'invalid'});
  if (!generatedSource || !['single','continuity'].includes(generatedSource.mode)) throw failure(400);
  let record, selected;
  if (generatedSource.mode === 'single') {
    const {verifiedSingleDocument} = await import('./communication-single.mjs');
    record = (await verifiedSingleDocument(accessStore,token,generatedSource.document,generatedSource.proof)).document;
    selected = record.entries.find(entry => entry.id === generatedSource.draftId);
  } else {
    const {handleCommunication} = await import('./communication-continuity.mjs');
    const [status,out] = await handleCommunication(accessStore,{token,action:'get',id:generatedSource.conversationId});
    if (status !== 200) throw Object.assign(new Error(out.code || 'not_found'),{status,code:status === 404 ? 'not_found' : 'unauthorized'});
    record = out.conversation; selected = record.entries.find(entry => entry.id === generatedSource.entryId);
  }
  if (!selected || selected.kind !== 'draft' || !selected.text?.trim()) throw failure(404);
  // First manual revision retains the original AI recipe. Missing legacy fields stay unknown.
  const original = selected.revisions?.length ? selected.revisions[0] : selected;
  const versions = {
    ...(copy(original.versions) || {}), model:copy(original.model || selected.model || null),
    editVersions:selected.editedAt ? copy(selected.versions) : null,
    sourceRevision:{recordRevision:record.revision,draftRevisions:selected.revisions?.length || 0,generatedAt:selected.at,editedAt:selected.editedAt || null}
  };
  return {text:selected.text,versions,sourceId:record.origin?.documentId || record.id,mode:generatedSource.mode};
}
