// Activity and conversation artifacts from the planners (U5/U7 continuation, 9 Oct 2026).
// A local planner draft (planner-document/v1) is never disguised as kind:'narrative'.
// Explicit adapters map the planner fields to the shared artifact shape; explicit gates
// decide what may be stored, reviewed and approved for each kind.
import { contractError } from './agent-contract.mjs';

export const PLANNER_DOCUMENT_SCHEMA = 'planner-document/v1';
export const PLANNER_KINDS = Object.freeze(['activity','conversation','sequence']);
export const MAX_SEQUENCE_SESSIONS = 12;
export const STEP_PHASES = Object.freeze(['פתיחה','פעילות מרכזית','סיכום','אחרי המפגש']);
// Same allow lists as app/lib/planner-continuity.js, enforced again on the server.
const TAGS = new Set('article div span p h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr th td ul ol li strong b em i u br blockquote a bdi'.split(' '));
const CLASSES = new Set('kit-table kit-two kit-facts kit-steps kit-close kit-flow flow ph kit-h kit-sub kit-min kit-muted kit-session sbe-rich draftbox rcard rcard-row rcard-meta tree2-root tree2-row tree2-end card act session-card step-card claims-box'.split(' '));
const MAX_NODES = 30000, MAX_DEPTH = 100, MAX_DOCUMENT_BYTES = 400000, MAX_FIELDS_BYTES = 60000, MAX_TEXT = 12000;

// Which planner fields each kind keeps. Anything else is dropped, never stored.
export const PLANNER_FIELDS = Object.freeze({
  activity: ['goal','smart','age','domain','duration','approach','specialNotes','opening','openingMin','mainActivity','mainMin','closing','closingMin',
    'outcome','movement','expression','technology','resources','groupStyle'],
  conversation: ['productType','approach','myself','myTraits','otherParty','otherTraits','myAge','myOccupation','otherPerspective','relationshipHistory',
    'eventHistory','meetingLogistics','goal','nonNegotiables','advantages','challenges','riskBranches','openingLine','desiredAftermath','ifGoalAchieved','backupPlan'],
  // A sequence keeps its shared details here; each session becomes steps (see sequenceFromDraft).
  sequence: ['creator','framework','audience','ageRange','participants','space','domain','approaches','topic','goals','courseLevel','finalProduct','assessment','prefs','limits']
});
// The conversation type selector is closed (data-closed): only the two supported routes.
export const CONVERSATION_ROUTES = Object.freeze({'שיחה בעל פה':'oral',"התכתבות דיגיטלית (הודעה, מייל או צ'אט)":'digital'});
// Each kind maps to its own practice. Narrative keeps the existing simulation rehearsal.
export const PRACTICE_MODES = Object.freeze({narrative:'simulation-rehearsal',activity:'meeting-rehearsal',conversation:'conversation-rehearsal',sequence:'meeting-rehearsal'});
// What approval requires for each kind. A conversation is one personal talk: a social
// mechanism and group skills are welcome but not required (decision recorded in docs).
// What the planner may choose to continue without, explicitly, when approving (Yael, 9 Oct 2026:
// "בפעילות ניתן יהיה לבחור להמשיך בלי מנגנון חברתי ובלי הנחיה למנחה"). The choice is stored with the version.
export const OPTIONAL_BY_CHOICE = Object.freeze({activity: ['socialMechanism','facilitatorGuide'], conversation: [], sequence: ['socialMechanism','facilitatorGuide']});
export const COMPLETE_FIELDS = Object.freeze({
  activity: ['purpose','resilienceComponents','individualSkills','sharedSkills','facilitatorGuide','socialMechanism','steps'],
  conversation: ['purpose','facilitatorGuide','steps'],
  sequence: ['purpose','resilienceComponents','individualSkills','sharedSkills','facilitatorGuide','socialMechanism','steps']
});

const object = x => x && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const bytes = x => Buffer.byteLength(JSON.stringify(x));

export function validatePlannerDocument(doc) {
  if (!object(doc) || doc.schemaVersion !== PLANNER_DOCUMENT_SCHEMA || !Array.isArray(doc.nodes)) throw contractError('invalid_document');
  let count = 0;
  const clean = (node, depth) => {
    if (++count > MAX_NODES || depth > MAX_DEPTH || !object(node)) throw contractError('invalid_document');
    if (Object.hasOwn(node, 'text')) {
      if (typeof node.text !== 'string' || Object.keys(node).length !== 1) throw contractError('invalid_document');
      return {text: node.text};
    }
    if (!TAGS.has(node.tag) || !Array.isArray(node.children) || Object.keys(node).some(k => !['tag','attrs','children'].includes(k))) throw contractError('invalid_document');
    const attrs = {}, source = object(node.attrs) ? node.attrs : {};
    if (node.attrs !== undefined && !object(node.attrs)) throw contractError('invalid_document');
    for (const [name, value] of Object.entries(source)) {
      if (typeof value !== 'string') throw contractError('invalid_document');
      if (name === 'class') {
        const classes = value.split(/\s+/).filter(c => CLASSES.has(c));
        if (classes.length) attrs.class = classes.join(' ');
      } else if ((name === 'colspan' || name === 'rowspan') && (node.tag === 'td' || node.tag === 'th') || name === 'start' && node.tag === 'ol') {
        if (/^\d{1,3}$/.test(value) && +value > 0 && +value <= 100) attrs[name] = value;
      } else if (name === 'href' && node.tag === 'a') {
        try { const url = new URL(value); if (url.protocol === 'http:' || url.protocol === 'https:') attrs.href = url.href; } catch {}
      }
      // Any other attribute (events, style, data-*) is dropped.
    }
    return {tag: node.tag, attrs, children: node.children.map(child => clean(child, depth + 1))};
  };
  const out = {schemaVersion: PLANNER_DOCUMENT_SCHEMA, nodes: doc.nodes.map(node => clean(node, 0))};
  if (bytes(out) > MAX_DOCUMENT_BYTES) throw contractError('artifact_too_large');
  return out;
}

// Readable text of the document for reviewers: table rows keep their column headings.
export function documentText(doc, limit = 12000) {
  const out = [];
  const plain = node => node.text !== undefined ? node.text : (node.children || []).map(plain).join(' ');
  const walk = node => {
    if (node.text !== undefined) { const t = node.text.replace(/\s+/g, ' ').trim(); if (t) out.push(t); return; }
    if (node.tag === 'table') {
      const head = (node.children || []).find(c => c.tag === 'thead');
      const heads = head ? (head.children || []).flatMap(tr => (tr.children || []).map(c => plain(c).replace(/\s+/g, ' ').trim())) : [];
      const rows = (node.children || []).filter(c => c.tag === 'tbody' || c.tag === 'tr').flatMap(c => c.tag === 'tr' ? [c] : (c.children || []));
      for (const tr of rows) {
        const cells = (tr.children || []).map(c => plain(c).replace(/\s+/g, ' ').trim());
        out.push('\n' + cells.map((t, i) => heads.length === cells.length && heads[i] ? '[' + heads[i] + '] ' + t : t).join(' | '));
      }
      return;
    }
    if (/^h[1-6]$/.test(node.tag)) { out.push('\n# ' + plain(node).replace(/\s+/g, ' ').trim()); return; }
    (node.children || []).forEach(walk);
    if (['p','li','div','br','tr'].includes(node.tag)) out.push('\n');
  };
  (doc?.nodes || []).forEach(walk);
  return out.join(' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim().slice(0, limit);
}

function cleanFieldValue(value, depth = 0) {
  if (typeof value === 'string') return value.slice(0, MAX_TEXT);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value) && depth < 2) return value.slice(0, 40).map(v => cleanFieldValue(v, depth + 1)).filter(v => v !== undefined);
  if (object(value) && depth < 2) return Object.fromEntries(Object.entries(value).slice(0, 20)
    .filter(([k]) => /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(k)).map(([k, v]) => [k, cleanFieldValue(v, depth + 1)]).filter(([, v]) => v !== undefined));
  return undefined;
}
export function cleanPlannerFields(kind, fields) {
  if (fields !== undefined && !object(fields)) throw contractError('invalid_fields');
  const out = {};
  for (const name of PLANNER_FIELDS[kind]) {
    if (!Object.hasOwn(fields || {}, name)) continue;
    const value = cleanFieldValue(fields[name]);
    if (value !== undefined && value !== '') out[name] = value;
  }
  if (bytes(out) > MAX_FIELDS_BYTES) throw contractError('artifact_too_large');
  return out;
}

const minutes = x => { const m = String(x ?? '').match(/\d+(?:\.\d+)?/); const n = m ? Number(m[0]) : 0; return n > 0 && n <= 600 ? n : 0; };
const str = x => typeof x === 'string' ? x.trim() : '';
// SMART goal as the planner saves it: a JSON string {S:{text},M:{text},...}. The specific part (S) is the goal.
const smartText = x => {
  let o = x;
  if (typeof x === 'string') { try { o = JSON.parse(x); } catch { return str(x); } }
  if (!object(o)) return str(typeof x === 'string' ? x : '');
  return str(o.S?.text) || ['M','A','R','T'].map(k => str(o[k]?.text)).filter(Boolean).join(' ');
};

// Adapters: planner draft → artifact content. Only what the planner holds is mapped;
// missing professional fields stay missing until the planner adds them (gates block approval).
// Minutes that were not given are an editable estimate, marked in `estimates`.
export function activityFromDraft(draft, planning = {}) {
  const fields = cleanPlannerFields('activity', draft?.fields);
  if (Array.isArray(draft?.fields?.sessions)) throw contractError('unsupported_planner_shape'); // a sequence is kind:'sequence'
  const steps = [], estimates = [];
  for (const [id, phase, title, body, mins, fallback] of [
    ['opening','פתיחה','פתיחה',fields.opening,fields.openingMin,5],
    ['main','פעילות מרכזית','פעילות מרכזית',fields.mainActivity,fields.mainMin,20],
    ['closing','סיכום','סיכום',fields.closing,fields.closingMin,10]]) {
    if (!text(body)) continue;
    const given = minutes(mins); if (!given) estimates.push(id);
    steps.push({id, phase, title, instructions: str(body), minutes: given || fallback});
  }
  return withPlanning({kind:'activity', purpose: str(fields.goal) || smartText(fields.smart),
    fields, document: draft?.document, steps, estimates}, planning);
}
export function conversationFromDraft(draft, planning = {}) {
  const fields = cleanPlannerFields('conversation', draft?.fields);
  const route = CONVERSATION_ROUTES[fields.productType];
  if (!route) throw contractError('unsupported_conversation_route');
  const join = (...xs) => xs.map(str).filter(Boolean).join('\n');
  const steps = [], estimates = [];
  for (const [id, phase, title, body, fallback] of [
    ['opening','פתיחה','איך פותחים',fields.openingLine,3],
    ['core','פעילות מרכזית','מה חשוב לי בשיחה',join(fields.goal && 'המטרה: ' + fields.goal, fields.nonNegotiables && 'מה לא מוותרים עליו: ' + fields.nonNegotiables),10],
    ['branches','פעילות מרכזית','אם השיחה משתבשת',join(fields.riskBranches, fields.backupPlan && 'תכנית חלופית: ' + fields.backupPlan),5],
    ['closing','סיכום','איך מסיימים',fields.desiredAftermath,3]]) {
    if (!text(body)) continue;
    estimates.push(id);
    steps.push({id, phase, title, instructions: str(body), minutes: fallback});
  }
  return withPlanning({kind:'conversation', route, purpose: str(fields.goal), fields, document: draft?.document, steps, estimates}, planning);
}
// A sequence of sessions (9 Oct 2026): each session becomes its own opening, main activity and
// closing steps, with stable IDs (m<n>-opening, m<n>-main, m<n>-closing) and its session number.
// Session titles and products are kept in `sessions`; the shared details in `fields`.
export function sequenceFromDraft(draft, planning = {}) {
  const raw = draft?.fields;
  if (!object(raw) || !Array.isArray(raw.sessions)) throw contractError('unsupported_planner_shape');
  if (raw.sessions.length > MAX_SEQUENCE_SESSIONS) throw contractError('artifact_too_large');
  const fields = cleanPlannerFields('sequence', raw);
  const steps = [], estimates = [], sessions = [];
  raw.sessions.forEach((session, index) => {
    if (!object(session)) return;
    const n = index + 1;
    const subs = Array.isArray(session.subs) ? session.subs.filter(object).map(x => [str(x.t), minutes(x.min) ? minutes(x.min) + ' דקות' : ''].filter(Boolean).join(' · ')).filter(Boolean) : [];
    const main = [str(session.main), ...subs.map((t, i) => (i + 1) + '. ' + t)].filter(Boolean).join('\n');
    const before = steps.length;
    for (const [part, phase, title, body, mins, fallback] of [
      ['opening','פתיחה','פתיחה',str(session.opening),session.openingMin,5],
      ['main','פעילות מרכזית','פעילות מרכזית',main,session.mainMin,20],
      ['closing','סיכום','סיכום',str(session.closing),session.closingMin,10]]) {
      if (!text(body)) continue;
      const id = 'm' + n + '-' + part, given = minutes(mins);
      if (!given) estimates.push(id);
      steps.push({id, session: n, phase, title, instructions: body.slice(0, MAX_TEXT), minutes: given || fallback});
    }
    if (steps.length > before) sessions.push({n, goal: smartText(session.smart).slice(0, 2000),
      product: str(session.product).slice(0, 2000), duration: str(session.duration).slice(0, 100)});
  });
  const goals = Array.isArray(fields.goals) ? fields.goals.filter(text) : [];
  return withPlanning({kind: 'sequence', purpose: goals.length ? goals.join('\n') : str(fields.topic),
    fields, sessions, document: draft?.document, steps, estimates}, planning);
}
// The planner may add the professional fields explicitly; nothing is inferred.
function withPlanning(content, planning) {
  if (planning !== undefined && !object(planning)) throw contractError('invalid_explanation');
  for (const field of ['facilitatorGuide','socialMechanism']) if (planning[field] !== undefined) content[field] = planning[field];
  for (const field of ['resilienceComponents','individualSkills','sharedSkills']) if (planning[field] !== undefined) content[field] = planning[field];
  if (planning.purpose !== undefined) content.purpose = planning.purpose;
  return content;
}
export function plannerContentFromDraft(kind, draft, planning) {
  if (kind === 'activity') return activityFromDraft(draft, planning);
  if (kind === 'conversation') return conversationFromDraft(draft, planning);
  if (kind === 'sequence') return sequenceFromDraft(draft, planning);
  throw contractError('unsupported_artifact_kind');
}

// Gate for stored planner content. `complete` is the approval gate.
export function validatePlannerContent(input, {complete = false, waived = []} = {}) {
  if (!object(input) || !PLANNER_KINDS.includes(input.kind)) throw contractError('unsupported_artifact_kind');
  const allowed = ['kind','purpose','resilienceComponents','individualSkills','sharedSkills','facilitatorGuide','socialMechanism','steps','document','fields','estimates',
    ...(input.kind === 'conversation' ? ['route'] : []), ...(input.kind === 'sequence' ? ['sessions'] : [])];
  // A planner artifact never carries simulation data; that would be a disguised narrative.
  for (const field of ['pipelineOutput','scenario','context']) if (Object.hasOwn(input, field)) throw contractError('kind_mismatch');
  const content = Object.fromEntries(allowed.filter(k => Object.hasOwn(input, k)).map(k => [k, structuredClone(input[k])]));
  content.document = validatePlannerDocument(input.document);
  content.fields = cleanPlannerFields(input.kind, input.fields);
  if (input.kind === 'conversation' && !Object.values(CONVERSATION_ROUTES).includes(content.route)) throw contractError('unsupported_conversation_route');
  if (!text(content.purpose)) throw contractError('missing_explanation');
  content.steps = Array.isArray(input.steps) ? content.steps : [];
  const ids = new Set(), sequence = input.kind === 'sequence';
  if (sequence) {
    // Sessions: numbered 1..MAX in order, with short descriptive text only.
    const list = Array.isArray(input.sessions) ? input.sessions : [];
    if (!Array.isArray(input.sessions) || list.length > MAX_SEQUENCE_SESSIONS) throw contractError('invalid_sessions');
    let last = 0;
    content.sessions = list.map(x => {
      if (!object(x) || !Number.isInteger(x.n) || x.n <= last || x.n > MAX_SEQUENCE_SESSIONS || Object.keys(x).some(k => !['n','goal','product','duration'].includes(k))
        || ['goal','product','duration'].some(k => x[k] !== undefined && typeof x[k] !== 'string')) throw contractError('invalid_sessions');
      last = x.n; return {n: x.n, goal: (x.goal || '').slice(0, 2000), product: (x.product || '').slice(0, 2000), duration: (x.duration || '').slice(0, 100)};
    });
  }
  const sessionNumbers = new Set((content.sessions || []).map(x => x.n));
  for (const step of content.steps) {
    const keys = ['id','title','instructions','minutes','phase', ...(sequence ? ['session'] : [])];
    if (!object(step) || !text(step.id) || !/^[a-zA-Z0-9_-]{1,80}$/.test(step.id) || ids.has(step.id) || !text(step.title) || !text(step.instructions)
      || !Number.isFinite(step.minutes) || step.minutes <= 0 || (step.phase !== undefined && !STEP_PHASES.includes(step.phase))
      || (sequence && !sessionNumbers.has(step.session))
      || Object.keys(step).some(k => !keys.includes(k))) throw contractError('invalid_steps');
    ids.add(step.id);
  }
  content.estimates = Array.isArray(input.estimates) ? input.estimates.filter(id => ids.has(id)) : [];
  for (const field of ['purpose','facilitatorGuide','socialMechanism'])
    if (content[field] !== undefined && typeof content[field] !== 'string') throw contractError('invalid_explanation');
  for (const field of ['resilienceComponents','individualSkills','sharedSkills'])
    if (content[field] !== undefined && (!Array.isArray(content[field]) || content[field].length > 40 || content[field].some(x => !text(x)))) throw contractError('invalid_explanation');
  if (complete) for (const field of COMPLETE_FIELDS[input.kind]) {
    const value = content[field];
    if (waived.includes(field) && OPTIONAL_BY_CHOICE[input.kind].includes(field) && !(typeof value === 'string' && value.trim())) continue;
    if (field === 'steps' ? !value.length : Array.isArray(value) ? !value.length : !text(value))
      throw contractError(field === 'steps' ? 'missing_steps' : 'missing_explanation');
  }
  return content;
}
