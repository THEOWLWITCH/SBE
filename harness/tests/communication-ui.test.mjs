import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

const core = createRequire(import.meta.url)('../../app/lib/communication-core.js');
const source = readFileSync(new URL('../../app/lib/communication-continuity-ui.js', import.meta.url), 'utf8');
const exposed = source.replace(/  init\(\);\s*\}\)\(\);\s*$/, 'window.__ui = { state, init, apply, loadComposer, selectConversation, updateConversation, saveInput, generate, execute, request, beginNew, refreshList };\n})();');
assert.notEqual(exposed, source, 'Expose actual UI functions only inside the test VM');

const conversation = (id, extra = {}) => ({ id, title: 'שיחה ' + id, status: 'active', audience: 'הורים', revision: 1,
  createdAt: '2026-10-13T09:00:00Z', updatedAt: '2026-10-13T09:00:00Z', rounds: 0, entries: [], ...extra });
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

async function ui() {
  const nodes = [], elements = new Map(), windowEvents = new Map(), calls = [];
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
  }
  const F = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  F('cc-filter').value = 'all'; F('cc-input-kind').value = 'received';
  let handler = body => body.action === 'list' ? response({ ok: true, status: 200, conversations: [] }) : response({ error: 'Unexpected request' }, 500);
  const window = { SBE_COMMUNICATION: core, addEventListener: (type, fn) => windowEvents.set(type, fn), confirm: () => true };
  const context = { window, location: { hostname: 'localhost' }, document: { getElementById: F, createElement: tag => new Element(tag), querySelectorAll: tag => nodes.filter(n => n.tag === tag), querySelector: () => F('workspace') },
    sessionStorage: { getItem: key => key === 'sbe.session.token' ? 'synthetic-token' : null }, crypto: { randomUUID },
    fetch: async (_url, options) => { const body = JSON.parse(options.body); calls.push(body); return handler(body); },
    setInterval: () => 1, clearInterval() {}, setTimeout, URL, Blob, navigator: { clipboard: { writeText: async () => {} } } };
  vm.runInNewContext(exposed, context, { filename: 'communication-continuity-ui.js' });
  const api = window.__ui;
  const settle = async () => { for (let i = 0; i < 30 && api.state.busy; i++) await new Promise(resolve => setImmediate(resolve)); assert.equal(api.state.busy, false); };
  api.init(); await settle(); calls.length = 0;
  return { api, F, calls, settle, handle: fn => { handler = fn; }, set(c) { api.apply(c); api.loadComposer(); },
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
