import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHmac, randomUUID } from 'node:crypto';
import { handleCommunication } from '../lib/communication-continuity.mjs';
import vm from 'node:vm';

const core = createRequire(import.meta.url)('../../app/lib/communication-core.js');
const source = readFileSync(new URL('../../app/lib/communication-continuity-ui.js', import.meta.url), 'utf8');
const exposed = source.replace(/  init\(\);\s*\}\)\(\);\s*$/, 'window.__ui = { state, init, apply, loadComposer, selectConversation, updateConversation, saveInput, generate, execute, request, beginNew, refreshList, switchMode, generateSingle, applySingle, convertSingle, uploadSingle, exportSingle, exportData, textExport };\n})();');
assert.notEqual(exposed, source, 'Expose actual UI functions only inside the test VM');

const conversation = (id, extra = {}) => ({ id, title: 'שיחה ' + id, status: 'active', audience: 'הורים', revision: 1,
  createdAt: '2026-10-13T09:00:00Z', updatedAt: '2026-10-13T09:00:00Z', rounds: 0, entries: [], ...extra });
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test('the optional principles drawer renders ten original and eight additional explained principles in both modes', async () => {
  for (const mode of ['single', 'continuity']) {
    const u = await ui({ mode });
    const groups = u.F('cc-principles').children;
    assert.equal(groups.length, 2);
    const lists = groups.flatMap(group => group.children.filter(child => child.tag === 'ol'));
    assert.deepEqual(lists.map(list => list.children.length), [10, 8]);
    assert.equal(lists[0].start, 1); assert.equal(lists[1].start, 11);
    const text = node => [node.textContent || '', ...(node.children || []).map(text)].join(' ');
    assert.match(text(groups[0]), /עשרת עקרונות התקשורת/);
    assert.match(text(groups[1]), /שמונה עקרונות לתקשורת מקדמת חוסן/);
    assert.match(text(groups[1]), /לא מנחשים רגשות או כוונות/);
    assert.equal(u.F('cc-text').value, '');
  }
});

async function ui({ mode = 'continuity', legacy = null } = {}) {
  const nodes = [], elements = new Map(), windowEvents = new Map(), calls = [], storageReads = [], copied = [], modeUrls = [], prints = [];
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.value = ''; this.children = []; this.dataset = {}; this.listeners = new Map(); this.attributes = new Map(); this.classList = { toggle() {} }; nodes.push(this); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(type, fn) { this.listeners.set(type, [...this.listeners.get(type) || [], fn]); }
    dispatch(type) { for (const fn of this.listeners.get(type) || []) fn({ target: this }); }
    setAttribute(k, v) { this.attributes.set(k, v); }
    hasAttribute(k) { return this.attributes.has(k); }
    querySelector() { return null; }
    focus() {}
    scrollIntoView() {}
    remove() {}
    click() { this.dispatch('click'); }
  }
  const F = id => { const dynamic = nodes.findLast(n => n.id === id); if (dynamic) return dynamic; if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  F('cc-filter').value = 'all'; F('cc-input-kind').value = 'received';
  for (const id of ['cc-saved', 'cc-conversation', 'cc-timeline-section']) F(id).dataset.communicationMode = 'continuity';
  F('cc-single-result').dataset.communicationMode = 'single';
  let handler = body => body.action === 'list' ? response({ ok: true, status: 200, conversations: [] }) : response({ error: 'Unexpected request' }, 500);
  const location = { hostname: 'localhost', search: mode === 'continuity' ? '?mode=continuity&demolab=qa' : '?demolab=qa', hash: '#composer' };
  location.href = 'http://localhost/message-writer.html' + location.search + location.hash;
  const window = { SBE_COMMUNICATION: core, sbeUserKey: key => 'synthetic:' + key, addEventListener: (type, fn) => windowEvents.set(type, fn), confirm: () => true,
    history: { replaceState: (_state, _title, value) => { modeUrls.push(value); const url = new URL(value, location.href); location.href = url.href; location.search = url.search; location.hash = url.hash; } } };
  let sessionToken = 'synthetic-token';
  const context = { window, location, document: { body: new Element('body'), getElementById: F, createElement: tag => new Element(tag), querySelectorAll: tag => tag === '[data-communication-mode]' ? nodes.filter(n => n.dataset.communicationMode) : tag.startsWith('.') ? nodes.filter(n => (n.className || '').split(' ').includes(tag.slice(1))) : nodes.filter(n => n.tag === tag), querySelector: () => F('workspace') },
    sessionStorage: { getItem: key => key === 'sbe.session.token' ? sessionToken : null }, crypto: { randomUUID },
    localStorage: { getItem: key => { storageReads.push(key); return legacy == null ? null : JSON.stringify(legacy); }, setItem() { assert.fail('Unified communication must not write browser persistence'); }, removeItem() { assert.fail('Legacy import must not delete original browser data'); } },
    fetch: async (_url, options) => { const body = JSON.parse(options.body); calls.push(body); return handler(body); },
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, URL, URLSearchParams, Blob, navigator: { clipboard: { writeText: async value => { copied.push(value); } } } };
  const docApi = { print: options => prints.push(options), rich: text => { const n = new Element(); n.textContent = text; return n; }, table: rows => { const n = new Element('table'); n.textContent = JSON.stringify(rows); return n; } };
  window.SBE_DOC = docApi; context.SBE_DOC = docApi;
  vm.runInNewContext(exposed, context, { filename: 'communication-continuity-ui.js' });
  const api = window.__ui;
  const settle = async () => { for (let i = 0; i < 30 && api.state.busy; i++) await new Promise(resolve => setImmediate(resolve)); assert.equal(api.state.busy, false); };
  api.init(); await settle(); calls.length = 0;
  return { api, F, calls, storageReads, copied, modeUrls, prints, settle, changeToken: value => { sessionToken = value; }, handle: fn => { handler = fn; }, set(c) { api.apply(c); api.loadComposer(); },
    input(id, value) { F(id).value = value; F(id).dispatch('input'); }, unload() { const event = { prevented: false, preventDefault() { this.prevented = true; } }; windowEvents.get('beforeunload')(event); return event.prevented; } };
}

test('conflict refresh and conversation switching preserve scoped metadata drafts', async () => {
  const u = await ui(), a = conversation('a'), b = conversation('b', { audience: 'צוות', status: 'paused' });
  u.set(a); u.input('cc-rename', 'כותרת בעריכה'); u.input('cc-status', 'archived'); u.input('cc-audience', 'הנהלה');
  const latest = { ...a, revision: 2, title: 'עדכון אחר', status: 'resolved', audience: 'תלמידים' };
  u.handle(body => body.action === 'update' ? response({ ok: false, status: 409, code: 'REVISION_CONFLICT', error: 'conflict' }) : response({ conversation: body.id === 'a' ? latest : b }));
  assert.equal(await u.api.updateConversation({ title: 'כותרת בעריכה', status: 'archived', audience: 'הנהלה' }), false);
  assert.equal(u.F('cc-conflict-refresh').hidden, false);
  u.F('cc-conflict-refresh').dispatch('click'); await u.settle();
  assert.equal(u.api.state.selected.revision, 2);
  assert.equal(u.F('cc-rename').value, 'כותרת בעריכה'); assert.equal(u.F('cc-status').value, 'archived'); assert.equal(u.F('cc-audience').value, 'הנהלה');
  await u.api.selectConversation('b');
  assert.equal(u.F('cc-rename').value, b.title); assert.equal(u.F('cc-status').value, b.status); assert.equal(u.F('cc-audience').value, b.audience);
  await u.api.selectConversation('a');
  assert.equal(u.F('cc-rename').value, 'כותרת בעריכה'); assert.equal(u.F('cc-status').value, 'archived'); assert.equal(u.F('cc-audience').value, 'הנהלה');
});

test('refreshing clean audience then saving a message does not revert remote metadata', async () => {
  const u = await ui(); u.set(conversation('a')); u.input('cc-text', 'הודעה חדשה');
  let stored = conversation('a', { revision: 2, audience: 'תלמידים' });
  u.handle(body => {
    if (body.action === 'append') stored = { ...stored, revision: 3, entries: [{ id: 'received', kind: 'received', text: body.text }] };
    return response({ conversation: stored });
  });
  await u.api.selectConversation('a'); assert.equal(u.F('cc-audience').value, 'תלמידים');
  assert.equal(await u.api.saveInput(), true);
  assert.deepEqual(u.calls.map(c => c.action), ['get', 'append']); assert.equal(u.api.state.selected.audience, 'תלמידים');
});

test('metadata-only edits warn before unload, including hidden conversations, and acknowledged or reverted edits do not', async () => {
  const u = await ui(), a = conversation('a'), b = conversation('b'); u.set(a);
  assert.equal(u.unload(), false);
  u.input('cc-rename', 'עריכה'); assert.equal(u.unload(), true);
  u.input('cc-rename', a.title); assert.equal(u.unload(), false);
  u.input('cc-status', 'archived'); u.handle(() => response({ conversation: b })); await u.api.selectConversation('b'); assert.equal(u.unload(), true);
  u.handle(() => response({ conversation: a })); await u.api.selectConversation('a');
  u.handle(body => response({ conversation: { ...a, revision: 2, title: body.title, status: body.status, audience: body.audience } }));
  assert.equal(await u.api.updateConversation({ title: a.title, status: 'archived', audience: a.audience }), true); assert.equal(u.unload(), false);
});

test('metadata acknowledgements retain newer edits made while the save is pending', async () => {
  const u = await ui(), a = conversation('a'); u.set(a); u.input('cc-rename', 'לשמירה');
  let resolve;
  u.handle(() => new Promise(done => { resolve = done; }));
  const save = u.api.updateConversation({ title: 'לשמירה' });
  u.input('cc-rename', 'עריכה חדשה בזמן השמירה'); resolve(response({ conversation: { ...a, revision: 2, title: 'לשמירה' } }));
  assert.equal(await save, true); assert.equal(u.F('cc-rename').value, 'עריכה חדשה בזמן השמירה'); assert.equal(u.unload(), true);
});

test('creating a conversation preserves newer audience input while the create request is pending', async () => {
  const u = await ui(); u.input('cc-text', 'הודעת פתיחה'); u.input('cc-audience', 'הורים');
  let resolve, stored;
  u.handle(body => {
    if (body.action === 'create') return new Promise(done => { resolve = () => { stored = conversation(body.id, { title: body.title, audience: body.audience }); done(response({ conversation: stored })); }; });
    stored = { ...stored, revision: 2, entries: [{ id: 'received', kind: 'received', text: body.text }] }; return response({ conversation: stored });
  });
  const save = u.api.saveInput(); u.input('cc-audience', 'הנהלה'); resolve();
  assert.equal(await save, true); assert.equal(u.F('cc-audience').value, 'הנהלה'); assert.equal(u.api.state.selected.audience, 'הורים'); assert.equal(u.unload(), true);
});

test('educator instruction is persisted before AI failure and retry deduplicates the saved note', async () => {
  const u = await ui(); let stored = conversation('a'), aiFails = true; u.set(stored); u.input('cc-instruction', 'לברר את הסיבה לפני הצעה לפגישה');
  u.handle(body => {
    if (body.action === 'append') {
      assert.equal(body.kind, 'note'); assert.equal(body.notePurpose, 'instruction');
      stored = { ...stored, revision: stored.revision + 1, entries: [...stored.entries, { id: 'goal', kind: 'note', notePurpose: 'instruction', text: body.text }] };
      return response({ conversation: stored });
    }
    if (aiFails) return response({ ok: false, status: 503, code: 'AI_UNAVAILABLE', error: 'AI unavailable' });
    stored = { ...stored, revision: stored.revision + 1 }; return response({ ok: true, status: 200, conversation: stored });
  });
  assert.equal(await u.api.generate('suggest'), false); assert.ok(u.api.state.retry);
  assert.equal(stored.entries[0].text, 'לברר את הסיבה לפני הצעה לפגישה'); assert.equal(u.unload(), false);
  aiFails = false; assert.equal(await u.api.execute(u.api.state.retry), true);
  assert.equal(await u.api.generate('suggest'), true);
  assert.equal(u.calls.filter(c => c.action === 'append').length, 1);
  const generations = u.calls.filter(c => c.action === 'generate'); assert.equal(generations[0].requestId, generations[1].requestId);
});

test('unload detects only nonempty unsaved instruction and retains saved baselines after a metadata-only list refresh', async () => {
  const u = await ui(), goal = 'מטרה שנשמרה', a = conversation('a', { entries: [{ id: 'goal', kind: 'note', notePurpose: 'instruction', text: goal }] }), b = conversation('b');
  u.set(a); assert.equal(u.F('cc-instruction').value, goal); assert.equal(u.unload(), false);
  u.input('cc-instruction', 'מטרה חדשה'); assert.equal(u.unload(), true);
  u.input('cc-instruction', ''); assert.equal(u.unload(), false);
  u.input('cc-instruction', goal); u.handle(() => response({ conversation: b })); await u.api.selectConversation('b');
  u.handle(() => response({ conversations: [ { ...a, entries: undefined }, { ...b, entries: undefined } ] })); await u.api.refreshList();
  assert.equal(u.unload(), false);
});

test('flat kept-alive result failures expose application status even when HTTP succeeds', async () => {
  const u = await ui(); u.handle(() => response({ ok: false, status: 409, code: 'REVISION_CONFLICT' }));
  await assert.rejects(u.api.request({ token: 'synthetic-token', results: new Map(), bodies: new Map() }, 'generate', 'generate', {}, true), error => error.status === 409 && error.code === 'REVISION_CONFLICT');
});

const singleDocument = (input, extra = {}) => ({ id: 'single-id', mode: 'single', revision: 1,
  createdAt: '2026-10-13T09:00:00Z', updatedAt: '2026-10-13T09:00:00Z', versions: core.VERSIONS, input,
  actions: [{ action: 'singleGenerate', revision: 1, versions: core.VERSIONS }],
  entries: [{ id: 'draft-id', kind: 'draft', text: 'ניפגש ביום חמישי בשעה 18:00.', versions: core.VERSIONS, model: { provider: 'synthetic', id: 'qa' } }],
  latestAI: { entryId: 'draft-id', message: 'ניפגש ביום חמישי בשעה 18:00.' }, ...extra });
const emptyInput = extra => ({ text: 'כתבי הזמנה למפגש ביום חמישי בשעה 18:00', audience: '', instruction: '', format: '', localDetails: '', signature: '', materials: [], ...extra });

test('default single mode makes no private list request and keeps saved history controls hidden', async () => {
  const u = await ui({ mode: 'single' });
  assert.equal(u.api.state.mode, 'single'); assert.equal(u.api.state.listLoaded, false);
  assert.deepEqual(u.calls, []); assert.equal(u.F('cc-saved').hidden, true); assert.equal(u.F('cc-timeline-section').hidden, true);
  assert.equal(u.F('cc-mode-single').attributes.get('aria-pressed'), 'true');
});

test('legacy draft import is explicit and reads only the scoped original fields without persistence', async () => {
  const u = await ui({ mode: 'single', legacy: { 'rw-text': 'טיוטה קודמת', 'rw-aud': 'ועד ההורים', 'rw-kind': 'מכתב תודה', 'rw-local': 'בית הספר', 'rw-sign': 'צוות הכיתה' } });
  assert.deepEqual(u.storageReads, []); assert.equal(u.F('cc-text').value, '');
  u.F('cc-single-import').dispatch('click');
  assert.deepEqual(u.storageReads, ['synthetic:sbe.writer.v1']);
  assert.equal(u.F('cc-text').value, 'טיוטה קודמת'); assert.equal(u.F('cc-audience').value, 'ועד ההורים');
  assert.equal(u.F('cc-format').value, 'מכתב תודה'); assert.equal(u.F('cc-local').value, 'בית הספר'); assert.equal(u.F('cc-signature').value, 'צוות הכיתה');
});

test('short single instruction uses the same API with optional fields and renders an editable draft', async () => {
  const u = await ui({ mode: 'single' });
  const input = emptyInput({ audience: 'הורים', format: 'הזמנה', localDetails: 'בחצר', signature: 'צוות הכיתה' });
  for (const [key, id] of Object.entries({ text: 'cc-text', audience: 'cc-audience', format: 'cc-format', localDetails: 'cc-local', signature: 'cc-signature' })) u.input(id, input[key]);
  u.handle(body => { assert.equal(body.action, 'singleGenerate'); assert.deepEqual(body.input, input); return response({ document: singleDocument(body.input), proof: 'proof-1' }); });
  assert.equal(await u.api.generateSingle(), true); assert.equal(u.api.state.single.proof, 'proof-1');
  assert.equal(u.F('cc-single-draft').value, 'ניפגש ביום חמישי בשעה 18:00.'); assert.equal(u.F('cc-single-result').hidden, false);
  assert.deepEqual(u.calls.map(c => c.action), ['singleGenerate']); assert.equal(u.unload(), true);
});

test('mode switching keeps each composer and single document in tab without converting or saving it', async () => {
  const u = await ui({ mode: 'single' }); u.input('cc-text', 'מסר חד־פעמי');
  const doc = singleDocument(emptyInput({ text: 'מסר חד־פעמי' })); u.api.applySingle({ document: doc, proof: 'proof-1' });
  u.handle(() => response({ conversations: [] })); u.api.switchMode('continuity'); await u.settle();
  assert.equal(u.F('cc-text').value, ''); u.input('cc-text', 'עדכון מתמשך');
  u.api.switchMode('single'); assert.equal(u.F('cc-text').value, 'מסר חד־פעמי'); assert.equal(u.api.state.single.document, doc);
  u.api.switchMode('continuity'); assert.equal(u.F('cc-text').value, 'עדכון מתמשך');
  assert.deepEqual(u.calls.map(c => c.action), ['list']);
  assert.ok(u.modeUrls.every(url => url.includes('demolab=qa') && url.endsWith('#composer')));
  assert.ok(u.modeUrls.at(-1).includes('mode=continuity'));
});

test('single revision signs the manual edit first and sends the exact selected draft and prior proof', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(); u.input('cc-text', input.text);
  const doc = singleDocument(input); u.api.applySingle({ document: doc, proof: 'proof-1' }); u.api.state.single.edits.set('draft-id', 'ניפגש ביום חמישי בשעה 18:00 בחצר.');
  u.handle(body => {
    if (body.action === 'singleEdit') {
      assert.equal(body.proof, 'proof-1'); assert.equal(body.text, 'ניפגש ביום חמישי בשעה 18:00 בחצר.');
      return response({ document: { ...doc, revision: 2, entries: [{ ...doc.entries[0], text: body.text, revisions: [{ text: doc.entries[0].text, versions: core.VERSIONS }] }] }, proof: 'proof-2' });
    }
    assert.equal(body.action, 'singleGenerate'); assert.equal(body.proof, 'proof-2'); assert.equal(body.entryId, 'draft-id'); assert.equal(body.revisionStyle, 'shorter');
    assert.equal(body.document.entries[0].text, 'ניפגש ביום חמישי בשעה 18:00 בחצר.');
    return response({ document: { ...body.document, revision: 3 }, proof: 'proof-3' });
  });
  assert.equal(await u.api.generateSingle('draft-id', 'shorter'), true); assert.equal(u.api.state.single.edits.size, 0);
  assert.deepEqual(u.calls.map(c => c.action), ['singleEdit', 'singleGenerate']);
});

test('failed private conversion leaves shared-session single content and edits usable', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(); u.input('cc-text', input.text);
  const doc = singleDocument(input); u.api.applySingle({ document: doc, proof: 'proof-1' });
  u.handle(() => response({ ok: false, status: 403, code: 'PRIVATE_ACCOUNT_REQUIRED', error: 'נדרש חשבון אישי לשמירה' }, 403));
  assert.equal(await u.api.convertSingle(), false); assert.equal(u.api.state.mode, 'single');
  assert.equal(u.api.state.single.document, doc); assert.equal(u.F('cc-text').value, input.text); assert.equal(u.F('cc-single-result').hidden, false);
  assert.deepEqual(u.calls.map(c => c.action), ['convert']);
  assert.deepEqual(u.modeUrls, []);
  u.F('cc-single-draft').value = 'עריכה לאחר סירוב השמירה'; u.F('cc-single-draft').dispatch('input');
  assert.equal(u.api.state.single.edits.get('draft-id'), 'עריכה לאחר סירוב השמירה');
});

test('conversion includes edited draft, newly changed input and newly attached signed material without another AI call', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(); u.input('cc-text', input.text);
  const doc = singleDocument(input); u.api.applySingle({ document: doc, proof: 'proof-1' });
  u.api.state.single.edits.set('draft-id', 'נוסח ערוך שטרם נשלח'); u.input('cc-instruction', 'נוסיף בקשה לאישור הגעה');
  const pair = { material: { id: 'material-new', text: 'הנחיה נוספת', source: { name: 'מידע.txt' } }, proof: 'material-proof' }; u.api.state.single.materials.push(pair);
  u.handle(body => {
    if (body.action === 'singleEdit') return response({ document: { ...doc, revision: 2, entries: [{ ...doc.entries[0], text: body.text }] }, proof: 'proof-2' });
    assert.equal(body.action, 'convert'); assert.equal(body.expectedRevision, null); assert.equal(body.proof, 'proof-2');
    assert.equal(body.input.instruction, 'נוסיף בקשה לאישור הגעה'); assert.deepEqual(body.input.materials, [pair]);
    assert.equal(body.document.entries[0].text, 'נוסח ערוך שטרם נשלח');
    return response({ conversation: conversation(body.id, { entries: body.document.entries }) });
  });
  assert.equal(await u.api.convertSingle(), true); assert.equal(u.api.state.mode, 'continuity');
  assert.ok(u.modeUrls.at(-1).includes('mode=continuity'));
  assert.equal(u.api.state.selected.entries[0].kind, 'draft'); assert.equal(u.api.state.selected.entries[0].text, 'נוסח ערוך שטרם נשלח');
  assert.deepEqual(u.calls.map(c => c.action), ['singleEdit', 'convert']);
  u.api.switchMode('single'); assert.equal(u.F('cc-instruction').value, 'נוסיף בקשה לאישור הגעה'); assert.equal(u.api.state.single.materials.length, 1);
});

test('conversion retry reuses the exact destination id and request id after dropped response', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(); u.input('cc-text', input.text); u.api.applySingle({ document: singleDocument(input), proof: 'proof-1' });
  let first;
  u.handle(body => { first = body; throw new Error('Synthetic network drop'); });
  assert.equal(await u.api.convertSingle(), false); assert.ok(u.api.state.retry); assert.equal(u.api.state.mode, 'single');
  u.handle(body => { assert.deepEqual(body, first); return response({ conversation: conversation(body.id, { entries: body.document.entries }) }); });
  assert.equal(await u.api.execute(u.api.state.retry), true); assert.equal(u.api.state.mode, 'continuity');
  assert.equal(u.calls[0].id, u.calls[1].id); assert.equal(u.calls[0].requestId, u.calls[1].requestId);
});

test('single JSON archive contains exact drafts, old versions and model/action provenance', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput();
  const doc = singleDocument(input, { entries: [{ id: 'draft-id', kind: 'draft', text: 'נוסח חדש', versions: core.VERSIONS, model: { provider: 'synthetic', id: 'qa' }, revisions: [{ text: 'נוסח קודם', versions: { tool: '1.0.0' } }] }] });
  const output = JSON.stringify(u.api.exportData(doc, u.api.state.single.edits));
  assert.ok(output.includes('נוסח חדש')); assert.ok(output.includes('נוסח קודם'));
  assert.ok(output.includes('1.0.0')); assert.ok(output.includes('singleGenerate')); assert.ok(output.includes('synthetic'));
});

test('a new clarification hides the previous single draft while preserving all earlier versions for export', async () => {
  const u = await ui({ mode: 'single' });
  const doc = singleDocument(emptyInput(), { latestAI: { entryId: 'question-id', message: '', clarification: 'מה תאריך המפגש?' } });
  doc.entries.push({ id: 'question-id', kind: 'analysis', text: '', clarification: 'מה תאריך המפגש?' });
  u.api.applySingle({ document: doc, proof: 'proof-1' });
  const editor = u.F('cc-single-result').children.find(child => child.id === 'cc-single-draft'); assert.equal(editor, undefined);
  assert.ok(JSON.stringify(doc).includes('ניפגש ביום חמישי בשעה 18:00.')); assert.equal(u.api.textExport(doc), 'מה תאריך המפגש?');
});

test('copying an edited single draft works immediately without API access and retains the pending version', async () => {
  const u = await ui({ mode: 'single' }), doc = singleDocument(emptyInput()); u.api.applySingle({ document: doc, proof: 'proof-1' });
  u.F('cc-single-draft').value = 'נוסח ידני להעתקה'; u.F('cc-single-draft').dispatch('input');
  u.handle(() => { throw new Error('API unavailable'); });
  u.F('cc-single-copy').dispatch('click'); await u.settle();
  assert.deepEqual(u.copied, ['נוסח ידני להעתקה']); assert.equal(u.api.state.single.edits.get('draft-id'), 'נוסח ידני להעתקה');
  assert.deepEqual(u.calls, []); assert.equal(u.api.state.single.document.entries[0].text, doc.entries[0].text);
});

test('single export works without API access and labels manual local revisions without altering signed provenance', async () => {
  const u = await ui({ mode: 'single' }), doc = singleDocument(emptyInput()); u.api.applySingle({ document: doc, proof: 'proof-1' });
  u.api.state.single.edits.set('draft-id', 'נוסח מקומי לייצוא'); u.handle(() => { throw new Error('API unavailable'); });
  assert.equal(await u.api.exportSingle('json'), true); assert.deepEqual(u.calls, []);
  const output = u.api.exportData(doc, u.api.state.single.edits);
  assert.equal(output.entries[0].text, doc.entries[0].text); assert.equal(output.exportUnsavedDrafts['draft-id'], 'נוסח מקומי לייצוא');
  assert.equal(output.exportLocalDraftRevisions[0].origin, 'manual-local'); assert.equal(output.exportLocalDraftRevisions[0].model, undefined);
  assert.equal(u.api.textExport(output), 'נוסח מקומי לייצוא');
  assert.equal(u.api.state.single.proof, 'proof-1'); assert.equal(u.api.state.single.edits.get('draft-id'), 'נוסח מקומי לייצוא');
});

test('conversion retry acknowledges its pinned edit while retaining a newer edit in both mode buffers', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(), doc = singleDocument(input); u.input('cc-text', input.text);
  u.api.applySingle({ document: doc, proof: 'proof-1' }); u.api.state.single.edits.set('draft-id', 'נוסח ראשון לשמירה');
  let saved, conversion;
  u.handle(body => {
    if (body.action === 'singleEdit') { saved = { ...doc, revision: 2, entries: [{ ...doc.entries[0], text: body.text }] }; return response({ document: saved, proof: 'proof-2' }); }
    conversion = body; throw new Error('Synthetic dropped conversion response');
  });
  assert.equal(await u.api.convertSingle(), false); assert.equal(u.api.state.single.edits.size, 0);
  u.F('cc-single-draft').value = 'עריכה חדשה אחרי כשל התשובה'; u.F('cc-single-draft').dispatch('input');
  u.handle(body => { assert.deepEqual(body, conversion); return response({ conversation: conversation(body.id, { entries: saved.entries }) }); });
  assert.equal(await u.api.execute(u.api.state.retry), true);
  assert.equal(u.api.state.single.edits.get('draft-id'), 'עריכה חדשה אחרי כשל התשובה');
  assert.equal(u.api.state.edits.get('draft-id'), 'עריכה חדשה אחרי כשל התשובה');
  assert.equal(u.api.state.selected.entries[0].text, 'נוסח ראשון לשמירה');
  assert.equal(u.calls.filter(c => c.action === 'singleEdit').length, 1);
  u.api.switchMode('single'); assert.equal(u.F('cc-single-draft').value, 'עריכה חדשה אחרי כשל התשובה');
});

test('generation retry keeps a newer manual edit available beside the newly generated current draft', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(), doc = singleDocument(input); u.input('cc-text', input.text);
  u.api.applySingle({ document: doc, proof: 'proof-1' }); u.api.state.single.edits.set('draft-id', 'נוסח ראשון לעיבוד');
  let saved, generation;
  u.handle(body => {
    if (body.action === 'singleEdit') { saved = { ...doc, revision: 2, entries: [{ ...doc.entries[0], text: body.text }] }; return response({ document: saved, proof: 'proof-2' }); }
    generation = body; throw new Error('Synthetic dropped generation response');
  });
  assert.equal(await u.api.generateSingle('draft-id', 'shorter'), false);
  u.F('cc-single-draft').value = 'עריכה חדשה בזמן ההמתנה לניסיון חוזר'; u.F('cc-single-draft').dispatch('input');
  u.handle(body => {
    assert.deepEqual(body, generation);
    return response({ document: { ...saved, revision: 3, entries: [...saved.entries, { ...saved.entries[0], id: 'new-draft', text: 'נוסח חדש מהמודל', draftId: 'draft-id' }], latestAI: { entryId: 'new-draft', message: 'נוסח חדש מהמודל' } }, proof: 'proof-3' });
  });
  assert.equal(await u.api.execute(u.api.state.retry), true);
  assert.equal(u.api.state.single.edits.get('draft-id'), 'עריכה חדשה בזמן ההמתנה לניסיון חוזר');
  assert.equal(u.F('cc-single-draft').value, 'נוסח חדש מהמודל'); assert.equal(u.F('cc-single-pending-draft-id').value, 'עריכה חדשה בזמן ההמתנה לניסיון חוזר');
  assert.equal(u.calls.filter(c => c.action === 'singleEdit').length, 1);
});

test('conversion retry does not submit new edits after its destination body was already fixed', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(), doc = singleDocument(input); u.input('cc-text', input.text); u.api.applySingle({ document: doc, proof: 'proof-1' });
  let conversion; u.handle(body => { conversion = body; throw new Error('Synthetic dropped response'); });
  assert.equal(await u.api.convertSingle(), false); u.api.state.single.edits.set('draft-id', 'עריכה שהחלה רק אחרי הכשל');
  u.handle(body => { assert.deepEqual(body, conversion); return response({ conversation: conversation(body.id, { entries: doc.entries }) }); });
  assert.equal(await u.api.execute(u.api.state.retry), true);
  assert.deepEqual(u.calls.map(c => c.action), ['convert', 'convert']); assert.equal(u.api.state.edits.get('draft-id'), 'עריכה שהחלה רק אחרי הכשל');
});

test('conversion and later reload use the current optional instruction instead of an old single prompt or cleared goal', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput({ instruction: 'מטרה שנוקתה' }); u.input('cc-text', input.text); u.api.applySingle({ document: singleDocument(input), proof: 'proof-1' });
  u.input('cc-instruction', '');
  const entries = [{ id: 'source-text', kind: 'note', notePurpose: 'instruction', text: input.text, source: { purpose: 'single-input', field: 'text' } },
    { id: 'old-goal', kind: 'note', notePurpose: 'instruction', text: input.instruction, source: { purpose: 'single-input', field: 'instruction' } }];
  let stored;
  u.handle(body => {
    if (body.action === 'convert') stored = conversation(body.id, { entries, origin: { input: body.input } });
    return response({ conversation: stored });
  });
  assert.equal(await u.api.convertSingle(), true); assert.equal(u.F('cc-instruction').value, '');
  const reload = await ui(); reload.handle(() => response({ conversation: stored })); await reload.api.selectConversation(stored.id); assert.equal(reload.F('cc-instruction').value, '');
  stored = { ...stored, entries: [...entries, { id: 'ongoing-goal', kind: 'note', notePurpose: 'instruction', text: 'מטרה חדשה בניהול תקשורת' }] };
  const later = await ui(); later.handle(() => response({ conversation: stored })); await later.api.selectConversation(stored.id); assert.equal(later.F('cc-instruction').value, 'מטרה חדשה בניהול תקשורת');
});

test('single text and PDF contain only the current locally edited message, while JSON keeps private sources and prior revisions', async () => {
  const u = await ui({ mode: 'single' }), doc = singleDocument(emptyInput({ text: 'PRIVATE SOURCE SENTINEL', localDetails: 'PRIVATE LOCAL DETAILS' }));
  doc.entries.unshift({ id: 'source-id', kind: 'received', text: 'PRIVATE MATERIAL SENTINEL' });
  doc.entries[1].revisions = [{ text: 'PRIVATE PRIOR DRAFT SENTINEL', versions: { tool: '1.0.0' } }];
  u.api.applySingle({ document: doc, proof: 'proof-1' }); u.api.state.single.edits.set('draft-id', 'הודעה נקייה ומוכנה לשליחה');
  u.handle(() => { throw new Error('API unavailable'); });
  const archive = u.api.exportData(doc, u.api.state.single.edits);
  assert.equal(u.api.textExport(archive), 'הודעה נקייה ומוכנה לשליחה');
  assert.equal(await u.api.exportSingle('pdf'), true); assert.equal(u.prints.length, 1);
  const text = node => [node.textContent || '', ...node.children.map(text)].join('');
  assert.equal(text(u.prints[0].node), 'הודעה נקייה ומוכנה לשליחה');
  const full = JSON.stringify(archive);
  for (const sentinel of ['PRIVATE SOURCE SENTINEL', 'PRIVATE LOCAL DETAILS', 'PRIVATE MATERIAL SENTINEL', 'PRIVATE PRIOR DRAFT SENTINEL']) assert.ok(full.includes(sentinel));
  assert.equal(archive.exportLocalDraftRevisions[0].origin, 'manual-local'); assert.deepEqual(u.calls, []);
});

test('lost conversion is retained across local export and new conversion clicks without duplicate destination or mutated input', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(), doc = singleDocument(input); u.input('cc-text', input.text); u.api.applySingle({ document: doc, proof: 'proof-1' });
  let first; u.handle(body => { first = body; throw new Error('Synthetic committed response drop'); });
  assert.equal(await u.api.convertSingle(), false); assert.ok(u.api.state.single.pendingConversion);
  assert.equal(await u.api.exportSingle('json'), true); assert.equal(u.api.state.retry, null); assert.ok(u.api.state.single.pendingConversion);
  u.api.state.single.edits.set('draft-id', 'עריכה מאוחרת אחרי הייצוא');
  u.api.state.single.materials.push({ material: { id: 'later-material', text: 'חומר מאוחר' }, proof: 'later-proof' });
  u.input('cc-instruction', 'הנחיה מאוחרת');
  u.handle(body => { assert.deepEqual(body, first); return response({ conversation: conversation(body.id, { entries: doc.entries }) }); });
  assert.equal(await u.api.convertSingle(), true); assert.equal(u.api.state.single.pendingConversion, null);
  assert.deepEqual(u.calls.map(c => c.action), ['convert', 'convert']); assert.equal(u.calls[0].id, u.calls[1].id); assert.equal(u.calls[0].requestId, u.calls[1].requestId);
  assert.deepEqual(u.calls[1].input.materials, []); assert.equal(u.api.state.single.materials.length, 1);
  assert.equal(u.api.state.single.edits.get('draft-id'), 'עריכה מאוחרת אחרי הייצוא'); assert.equal(u.api.state.edits.get('draft-id'), 'עריכה מאוחרת אחרי הייצוא');
  u.api.switchMode('single'); assert.equal(u.F('cc-instruction').value, 'הנחיה מאוחרת');
});

test('a retained conversion cannot roll back a newer signed single document or acknowledge a fresh revert as saved', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(), doc = singleDocument(input); u.input('cc-text', input.text); u.api.applySingle({ document: doc, proof: 'proof-1' });
  u.api.state.single.edits.set('draft-id', 'הנוסח שהוגש במקור'); let converted, saved;
  u.handle(body => {
    if (body.action === 'singleEdit') { saved = { ...doc, revision: 2, entries: [{ ...doc.entries[0], text: body.text }] }; return response({ document: saved, proof: 'proof-2' }); }
    converted = body; throw new Error('Synthetic committed conversion drop');
  });
  assert.equal(await u.api.convertSingle(), false);
  const newer = { ...saved, revision: 3, entries: [{ ...saved.entries[0], text: 'נוסח חדש שתועד בינתיים' }] };
  u.api.applySingle({ document: newer, proof: 'proof-3' }); u.api.state.single.edits.set('draft-id', 'הנוסח שהוגש במקור');
  assert.equal(await u.api.exportSingle('json'), true);
  u.handle(body => { assert.deepEqual(body, converted); return response({ conversation: conversation(body.id, { entries: saved.entries }) }); });
  assert.equal(await u.api.convertSingle(), true);
  assert.equal(u.api.state.single.document.revision, 3); assert.equal(u.api.state.single.proof, 'proof-3');
  assert.equal(u.api.state.single.document.entries[0].text, 'נוסח חדש שתועד בינתיים'); assert.equal(u.api.state.single.edits.get('draft-id'), 'הנוסח שהוגש במקור');
  assert.equal(u.calls.filter(c => c.action === 'singleEdit').length, 1);
});

test('single result limits its guidance to why and concise next while structured analysis remains in JSON only', async () => {
  const u = await ui({ mode: 'single' }), doc = singleDocument(emptyInput(), { latestAI: { entryId: 'draft-id', message: 'נוסח המסר', why: 'הסבר קצר לבחירת הניסוח', next: 'לבדוק את הפרטים לפני השימוש', analysis: { facts: ['PRIVATE ANALYSIS SENTINEL'], agreements: ['PRIVATE LEDGER SENTINEL'], followUp: ['PRIVATE FOLLOWUP SENTINEL'] } } });
  u.api.applySingle({ document: doc, proof: 'proof-1' });
  const text = node => [node.textContent || '', ...node.children.map(text)].join(''); const rendered = text(u.F('cc-single-result'));
  assert.ok(rendered.includes('הסבר קצר לבחירת הניסוח')); assert.ok(rendered.includes('לבדוק את הפרטים לפני השימוש'));
  for (const sentinel of ['PRIVATE ANALYSIS SENTINEL', 'PRIVATE LEDGER SENTINEL', 'PRIVATE FOLLOWUP SENTINEL']) { assert.equal(rendered.includes(sentinel), false); assert.ok(JSON.stringify(u.api.exportData(doc, u.api.state.single.edits)).includes(sentinel)); }
  assert.equal(rendered.includes('הסכמות, שאלות ומעקב'), false); assert.equal(rendered.includes('ניתוח השיח בהרחבה'), false);
});

test('pending conversion renews only credentials while retaining destination, request id and signed content after a token change', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(), doc = singleDocument(input); u.input('cc-text', input.text); u.api.applySingle({ document: doc, proof: 'proof-1' });
  let first; u.handle(body => { first = body; u.changeToken('renewed-synthetic-token'); return response({ conversation: conversation(body.id, { entries: doc.entries }) }); });
  assert.equal(await u.api.convertSingle(), false); assert.ok(u.api.state.single.pendingConversion); assert.equal(u.api.state.mode, 'single');
  u.handle(body => {
    assert.equal(body.token, 'renewed-synthetic-token'); const { token: oldToken, ...before } = first; const { token: newToken, ...after } = body;
    assert.notEqual(oldToken, newToken); assert.deepEqual(after, before); return response({ conversation: conversation(body.id, { entries: doc.entries }) });
  });
  assert.equal(await u.api.convertSingle(), true); assert.equal(u.calls.length, 2); assert.equal(u.api.state.single.pendingConversion, null);
});

test('different identity rejection keeps the original pinned conversion and transient content available', async () => {
  const u = await ui({ mode: 'single' }), input = emptyInput(), doc = singleDocument(input); u.input('cc-text', input.text); u.api.applySingle({ document: doc, proof: 'proof-1' });
  let first; u.handle(body => { first = body; throw new Error('Synthetic dropped conversion'); }); assert.equal(await u.api.convertSingle(), false);
  u.changeToken('different-identity-token'); u.handle(body => { assert.equal(body.id, first.id); assert.equal(body.requestId, first.requestId); assert.equal(body.proof, first.proof); return response({ ok: false, status: 400, code: 'PROVENANCE_INVALID', error: 'Different identity rejected' }, 400); });
  assert.equal(await u.api.convertSingle(), false); assert.ok(u.api.state.single.pendingConversion); assert.equal(u.api.state.mode, 'single');
  assert.equal(u.api.state.single.document, doc); assert.equal(u.api.state.single.proof, 'proof-1'); assert.equal(u.F('cc-text').value, input.text);
});

function signedFixture() {
 const data=new Map(Object.entries({'token-secret':{secret:'ui-review-synthetic-secret'},institutions:[{name:'Synthetic School',code:'123456',active:true}],'modules:Synthetic School':{writer:true},'code:STAFFONE':{kind:'staff',inst:'Synthetic School',perms:['writer']}}));
 const writes=[];const copy=value=>value==null?value:structuredClone(value);
 return {data,writes,async get(k){return copy(data.get(k)??null);},async list(prefix){return [...data].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,value:copy(value)}));},async compareSet(k,expected,value){const old=data.get(k);if(expected===null?!!old:!old||old.revision!==expected)return false;writes.push(k);data.set(k,copy(value));return true;}};
}
function signedToken(store){const raw=Buffer.from(JSON.stringify({k:'code',c:'STAFFONE',kind:'staff',inst:'Synthetic School',perms:['writer'],exp:Date.now()+3600000})).toString('base64url');return raw+'.'+createHmac('sha256',store.data.get('token-secret').secret).update(raw).digest('base64url');}
const signedDeps={providerFactory:()=>({id:'synthetic',model:'qa-model',async complete(){const analysis=Object.fromEntries(['facts','interpretations','control','influence','outsideControl','responsibility','resources','barriers','agreements','openQuestions','followUp'].map(k=>[k,[]]));return {text:JSON.stringify({message:'ניפגש מחר בשעה שמונה.',why:'הניסוח ברור.',next:'אפשר להעתיק ולשלוח.',clarification:'',analysis}),model:'qa-model'};}})};
async function signedUi(){const u=await ui({mode:'single'}),store=signedFixture(),auth=signedToken(store);u.changeToken(auth);const [status,single]=await handleCommunication(store,{token:auth,action:'singleGenerate',requestId:randomUUID(),input:{text:'כתבי הודעה על פגישה מחר בשמונה.'}},signedDeps);assert.equal(status,200);u.input('cc-text',single.document.input.text);u.api.applySingle(single);u.handle(async body=>{const [status,out]=await handleCommunication(store,body,signedDeps);return response({...out,ok:status<400,status},status);});return {u,store,single};}

test('real signed equal-revision forks retain the causally newer C edit when the lost B edit is replayed',async()=>{
 const {u,store,single}=await signedUi(),draft=single.document.entries.find(e=>e.kind==='draft');let lost=false;
 u.api.state.single.edits.set(draft.id,'נוסח B שהוגש קודם');u.handle(async body=>{const [status,out]=await handleCommunication(store,body,signedDeps);if(body.action==='singleEdit'&&body.text==='נוסח B שהוגש קודם'&&!lost){lost=true;throw new Error('Synthetic lost B acknowledgement');}return response({...out,ok:status<400,status},status);});
 assert.equal(await u.api.convertSingle(),false);assert.equal(u.api.state.single.document.revision,1);
 u.F('cc-single-draft').value='נוסח C שנבחר אחר כך';u.F('cc-single-draft').dispatch('input');u.F('cc-single-edit').dispatch('click');await u.settle();const cProof=u.api.state.single.proof;assert.equal(u.api.state.single.document.revision,2);assert.equal(store.writes.length,0);
 assert.equal(await u.api.convertSingle(),true);assert.equal(u.api.state.single.proof,cProof);assert.equal(u.api.state.single.document.entries.find(e=>e.id===draft.id).text,'נוסח C שנבחר אחר כך');assert.equal(u.api.state.selected.entries.find(e=>e.id===draft.id).text,'נוסח C שנבחר אחר כך');assert.equal(store.writes.length,1);
});

test('definitive signed conversion size rejection permits correction and exactly one later persisted row',async()=>{
 const {u,store}=await signedUi();u.input('cc-instruction','x'.repeat(12001));assert.equal(await u.api.convertSingle(),false);assert.equal(store.writes.length,0);
 u.input('cc-instruction','מטרה מתוקנת');assert.equal(await u.api.convertSingle(),true);assert.equal(store.writes.length,1);assert.equal(u.api.state.selected.origin.input.instruction,'מטרה מתוקנת');assert.notEqual(u.calls[0].requestId,u.calls[1].requestId);
});

test('JSON archive records current pending inputs and signed materials outside unchanged canonical provenance',async()=>{
 const {u,store,single}=await signedUi();const canonical=JSON.stringify(single.document),proof=single.proof;
 const [status,material]=await handleCommunication(store,{token:signedToken(store),action:'singleExtract',requestId:randomUUID(),attachment:{kind:'text',name:'מידע חדש.txt',text:'PENDING MATERIAL SENTINEL'}});assert.equal(status,200);u.api.state.single.materials.push(material);
 u.input('cc-text','PENDING COMPOSER SENTINEL');u.input('cc-instruction','PENDING INSTRUCTION SENTINEL');u.input('cc-audience','קהל חדש');u.input('cc-format','מכתב');u.input('cc-local','פרטים חדשים');u.input('cc-signature','חתימה חדשה');
 const archive=u.api.exportData(single.document,u.api.state.single.edits);assert.equal(archive.exportPendingInput.input.text,'PENDING COMPOSER SENTINEL');assert.equal(archive.exportPendingInput.input.instruction,'PENDING INSTRUCTION SENTINEL');assert.equal(JSON.stringify(archive.exportPendingInput.input.materials),JSON.stringify([material]));assert.equal(archive.exportPendingInput.model,undefined);assert.equal(archive.exportPendingInput.origin,'manual-local');assert.equal(JSON.stringify(u.api.state.single.document),canonical);assert.equal(u.api.state.single.proof,proof);assert.equal(store.writes.length,0);assert.equal(u.api.textExport(archive),'ניפגש מחר בשעה שמונה.');
});

test('a corrected unsigned draft restarts a failed edit-only conversion before any persistent request exists', async () => {
  const { u, store, single } = await signedUi(), draft = single.document.entries.find(e => e.kind === 'draft');
  let lost = false;
  u.api.state.single.edits.set(draft.id, 'נוסח מוקדם שהוחלף');
  u.handle(async body => {
    const [status, out] = await handleCommunication(store, body, signedDeps);
    if (body.action === 'singleEdit' && !lost) { lost = true; throw new Error('Synthetic lost edit response'); }
    return response({ ...out, ok: status < 400, status }, status);
  });
  assert.equal(await u.api.convertSingle(), false); assert.equal(store.writes.length, 0);
  assert.equal(u.api.state.single.pendingConversion.bodies.has('convert'), false);
  u.F('cc-single-draft').value = 'הנוסח המתוקן שנבחר עכשיו'; u.F('cc-single-draft').dispatch('input');
  assert.equal(await u.api.execute(u.api.state.retry), true);
  assert.deepEqual(u.calls.map(body => body.action), ['singleEdit', 'singleEdit', 'convert']);
  assert.equal(u.calls[1].text, 'הנוסח המתוקן שנבחר עכשיו'); assert.notEqual(u.calls[0].requestId, u.calls[1].requestId);
  assert.equal(u.api.state.selected.entries.find(e => e.id === draft.id).text, 'הנוסח המתוקן שנבחר עכשיו'); assert.equal(store.writes.length, 1);
});

test('an already submitted conversion replays exactly while a later signed draft remains available in both modes', async () => {
  const { u, store, single } = await signedUi(), draft = single.document.entries.find(e => e.kind === 'draft');
  let dropped = false, first;
  u.api.state.single.edits.set(draft.id, 'הנוסח הראשון שנשמר בשיחה');
  u.handle(async body => {
    const [status, out] = await handleCommunication(store, body, signedDeps);
    if (body.action === 'convert' && !dropped) { dropped = true; first = body; throw new Error('Synthetic dropped committed conversion'); }
    if (body.action === 'convert') assert.deepEqual(body, first);
    return response({ ...out, ok: status < 400, status }, status);
  });
  assert.equal(await u.api.convertSingle(), false); assert.equal(store.writes.length, 1);
  u.F('cc-single-draft').value = 'נוסח חדש שתועד לאחר השמירה'; u.F('cc-single-draft').dispatch('input');
  u.F('cc-single-edit').dispatch('click'); await u.settle(); const latestProof = u.api.state.single.proof;
  assert.equal(await u.api.convertSingle(), true); assert.equal(store.writes.length, 1); assert.equal(u.api.state.single.proof, latestProof);
  assert.equal(u.api.state.selected.entries.find(e => e.id === draft.id).text, 'הנוסח הראשון שנשמר בשיחה');
  assert.equal(u.api.state.edits.get(draft.id), 'נוסח חדש שתועד לאחר השמירה');
  u.api.switchMode('single'); assert.equal(u.F('cc-single-draft').value, 'נוסח חדש שתועד לאחר השמירה');
});

test('unchanged composer fields do not acquire a false pending-input annotation from property order', async () => {
  const { u, single } = await signedUi();
  const archive = u.api.exportData(single.document, u.api.state.single.edits);
  assert.equal(archive.exportPendingInput, undefined); assert.equal(JSON.stringify(archive), JSON.stringify(single.document));
});

test('definitive invalid material-count rejection permits a corrected signed conversion', async () => {
  const { u, store } = await signedUi();
  const [status, material] = await handleCommunication(store, { token: signedToken(store), action: 'singleExtract', requestId: randomUUID(), attachment: { kind: 'text', name: 'מקור.txt', text: 'חומר שנקרא במלואו' } });
  assert.equal(status, 200); u.api.state.single.materials = Array.from({ length: 1001 }, () => material);
  assert.equal(await u.api.convertSingle(), false); assert.equal(store.writes.length, 0); assert.equal(u.api.state.single.pendingConversion, null);
  u.api.state.single.materials = [material]; assert.equal(await u.api.convertSingle(), true);
  assert.equal(store.writes.length, 1); assert.equal(u.api.state.selected.origin.input.materials.length, 1);
  assert.notEqual(u.calls[0].requestId, u.calls[1].requestId);
});
