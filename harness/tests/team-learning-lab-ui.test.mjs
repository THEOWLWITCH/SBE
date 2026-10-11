import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const domainSource = readFileSync(new URL('../../app/lib/team-learning-lab.js', import.meta.url), 'utf8');
const uiSource = readFileSync(new URL('../../app/lib/team-learning-lab-ui.js', import.meta.url), 'utf8');
const plannerSource = readFileSync(new URL('../../app/lib/planner-continuity.js', import.meta.url), 'utf8');
const aiCallSource = readFileSync(new URL('../../app/lib/ai-call.js', import.meta.url), 'utf8');
const refSource = readFileSync(new URL('../../app/lib/ref-collect.js', import.meta.url), 'utf8');
const regularKey = 'sbe.team-lab.v1:synthetic-test-owner';
const checks = ['safety', 'privacy', 'professional'];
const plain = value => JSON.parse(JSON.stringify(value));

// Keep the production functions and startup listeners. This hook only supplies
// fixture state and exposes lexical functions; no handler is replaced or copied.
const hook = `
  window.__labTest = {
    state: () => ({ws, ready, persistedRevision, stage, conflict, saving, activeRun}),
    seed(value) {
      ws = value; ready = true; persistedRevision = value.revision; stage = 0;
      conflict = false; generated = false; proposals.clear();
      Object.keys(formValues).forEach(key => delete formValues[key]);
      clearTimeout(saveTimer); renderAll();
    },
    save, recover, renderAnswer, practiceForm, renderLearning, renderExport, goStage, ask, demoFill, generate,
    setForm, setDraft,
    propose(key, value) { proposals.set(key, value); }
  };
`;
const close = uiSource.lastIndexOf('\n})();');
assert.ok(close >= 0, 'UI entry point must retain its IIFE boundary');
const instrumentedUi = uiSource.slice(0, close) + hook + uiSource.slice(close);

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.childNodes = []; this.listeners = new Map();
    this.attributes = new Map(); this.dataset = {}; this.checked = false;
    this.hidden = false; this.disabled = false; this.value = ''; this.parentNode = null;
    const classes = new Set();
    this.classList = {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains: name => classes.has(name),
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : !!force;
        if (enabled) classes.add(name); else classes.delete(name);
        return enabled;
      }
    };
    Object.defineProperty(this, 'className', { get: () => [...classes].join(' '), set(value) { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); } });
  }
  get firstChild() { return this.childNodes[0] || null; }
  get parentElement() { return this.parentNode; }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentNode) node.remove();
      node.parentNode = this; this.childNodes.push(node);
    }
  }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) {
    for (const node of this.childNodes) node.parentNode = null;
    this.childNodes = []; this.append(...nodes);
  }
  addEventListener(type, listener, options = {}) {
    const listeners = this.listeners.get(type) || [];
    listeners.push({ listener, once: !!options.once }); this.listeners.set(type, listeners);
  }
  dispatch(type) {
    const listeners = [...(this.listeners.get(type) || [])];
    const results = listeners.map(({ listener }) => listener({ target: this, preventDefault() {} }));
    this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => !entry.once));
    return Promise.all(results);
  }
  click() { return this.dispatch('click'); }
  querySelectorAll(selector) {
    if (selector.startsWith(':scope > ')) return this.childNodes.filter(node => matches(node, selector.slice(9)));
    return this.childNodes.flatMap(descendants).filter(node => matches(node, selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (matches(node, selector)) return node; return null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; void this.dispatch('close'); }
  remove() {
    if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(node => node !== this);
    this.parentNode = null;
  }
}

function matches(node, selector) {
  return selector.split(',').some(part => {
    const value = part.trim();
    if (value.startsWith('.')) return value.slice(1).split('.').every(name => node.classList.contains(name));
    if (value.startsWith('#')) return node.id === value.slice(1);
    return node.tagName === value.toUpperCase();
  });
}
function descendants(root) { return [root, ...root.childNodes.flatMap(descendants)]; }
function findButton(root, label) {
  const found = descendants(root).find(node => node.tagName === 'BUTTON' && node.textContent === label);
  assert.ok(found, `button must be rendered: ${label}`); return found;
}
function memory() {
  const map = new Map(); let failWrites = 0, writes = 0;
  return {
    map, get writes() { return writes; }, failNextWrite() { failWrites++; },
    getItem: key => map.get(key) ?? null,
    setItem(key, value) { writes++; if (failWrites) { failWrites--; throw new Error('synthetic quota failure'); } map.set(key, value); },
    removeItem: key => map.delete(key)
  };
}
function controlledLocks() {
  let tail = Promise.resolve(), gate = null, release;
  return {
    requests: 0,
    hold() { gate = new Promise(resolve => { release = resolve; }); },
    release() { release?.(); gate = null; },
    request(_key, fn) {
      this.requests++; const waiting = gate;
      const pending = tail.then(async () => { if (waiting) await waiting; return fn(); });
      tail = pending.catch(() => {}); return pending;
    }
  };
}
async function settle() { for (let i = 0; i < 32; i++) await Promise.resolve(); }
function deferred() {
  let resolve, reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

async function fixture({ storage = memory(), sys = false, embedded = false, search = '', reply } = {}) {
  const ids = new Map(), created = [], timers = new Map(), intervals = new Map(), calls = [], requestOptions = [], aiSignals = [], printed = [], exportBlobs = [];
  let timerId = 0;
  const element = tag => { const node = new Element(tag); created.push(node); return node; };
  const byId = id => { if (!ids.has(id)) { const node = element(); node.id = id; ids.set(id, node); } return ids.get(id); };
  const stages = Array.from({ length: 4 }, (_, index) => { const node = element('button'); node.dataset.stage = String(index); return node; });
  const body = element('body'), head = element('head');
  const document = {
    body, head, createElement: element,
    getElementById: id => id === 'sbe-refs-style' ? head.childNodes.find(node => node.id === id) || null : byId(id),
    querySelectorAll(selector) {
      if (selector === '[data-stage]') return stages;
      if (selector === '[data-answer-key]') return created.filter(node => node.dataset.answerKey);
      return [];
    },
    querySelector(selector) { return stages.find(node => selector === `[data-stage="${node.dataset.stage}"]`) || null; }
  };
  const session = new Map([
    ['sbe.session.token', 'synthetic-test-token'], ['sbe.session.perms', '["nana"]'],
    ['sbe.session.homeUrl', sys ? 'admin.html?role=sys' : 'home.html']
  ]);
  const locks = controlledLocks();
  const window = {
    sbeUserKey: base => `${base}:synthetic-test-owner`,
    SBE_DOC: {
      rich: value => { const node = element('div'); node.textContent = String(value); return node; }, table: () => element('table'), flowTable: () => element('table'),
      print(spec) { window.SBE_REFS.forPrint(spec.node); printed.push(spec); }
    },
    sbeAIOrigin: () => 'synthetic:no-network',
    sbeAIHeaders: () => ({ Authorization: 'Bearer synthetic-test-token', 'content-type': 'application/json' }),
    addEventListener() {}
  };
  window.parent = embedded ? {} : window;
  window.location = { search };
  class FixtureURL extends URL {
    static createObjectURL(blob) { exportBlobs.push(blob); return `blob:synthetic-${exportBlobs.length}`; }
    static revokeObjectURL() {}
  }
  const sandbox = {
    window, document, location: window.location, navigator: { locks }, localStorage: storage,
    sessionStorage: { getItem: key => session.get(key) ?? null },
    crypto: webcrypto, AbortController, DOMException, URL: FixtureURL, URLSearchParams, Blob, console,
    async fetch(url, init) {
      assert.ok(url.endsWith('/api/complete'), 'UI fixture expects direct complete acknowledgments');
      const request = JSON.parse(init.body), fields = requestFields(request);
      // Fetch deliberately ignores abort. The actual transport and planner
      // guards must reject an obsolete call even if its reply still arrives.
      const value = reply ? await reply(request) : fields.action === 'generate' ? activity() : { answer: 'אפשר לנסות שאלה קצרה.', proposedStep: null };
      return { ok: true, status: 200, text: async () => JSON.stringify({ text: typeof value === 'string' ? value : JSON.stringify(value) }) };
    },
    setTimeout(callback, delay) { const id = ++timerId; if (delay === 0) Promise.resolve().then(callback); else timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval(callback) { const id = ++timerId; intervals.set(id, callback); return id; },
    clearInterval(id) { intervals.delete(id); }
  };
  vm.runInNewContext(plannerSource, sandbox, { filename: 'planner-continuity.js' });
  vm.runInNewContext(aiCallSource, sandbox, { filename: 'ai-call.js' });
  vm.runInNewContext(refSource, sandbox, { filename: 'ref-collect.js' });
  const recordCall = (request, options) => { calls.push(plain(request)); aiSignals.push(options.signal); };
  const transport = window.sbeCallAI;
  window.sbeCallAI = (server, request, timeout, options = {}) => { recordCall(request, options); return transport(server, request, timeout, options); };
  if (window.sbeCallAIJson) {
    const helper = window.sbeCallAIJson;
    window.sbeCallAIJson = (server, request, timeout, check, options = {}) => { recordCall(request, options); return helper(server, request, timeout, check, options); };
  }
  vm.runInNewContext(domainSource, sandbox, { filename: 'team-learning-lab.js' });
  const TEAM = window.SBE_TEAM, originalBuildRequest = TEAM.buildRequest;
  TEAM.buildRequest = (...args) => { requestOptions.push(plain(args[2] || {})); return originalBuildRequest(...args); };
  vm.runInNewContext(instrumentedUi, sandbox, { filename: 'team-learning-lab-ui.js' });
  await settle();
  const api = window.__labTest;
  assert.equal(api.state().ready, true, 'actual startup must load the fixture workspace');
  return {
    api, publicApi: window.SBE_TEAM_UI, TEAM, storage, locks, calls, requestOptions, aiSignals, session, timers, body, byId, element, printed, exportBlobs,
    seed(value) { storage.map.set(regularKey, JSON.stringify({ scopeKey: regularKey, workspace: value })); api.seed(value); },
    checkAll(value = true) { checks.forEach(key => { byId(`lab-check-${key}`).checked = value; }); },
    checked() { return checks.map(key => byId(`lab-check-${key}`).checked); },
    async runTimers(limit = 5) {
      let count = 0;
      while (timers.size && count < limit) {
        const [id, callback] = timers.entries().next().value; timers.delete(id); count++;
        await callback(); await settle();
      }
      return count;
    }
  };
}

function context(overrides = {}) {
  return {
    audience: 'students', ageBand: 'd-f', situation: 'routine', mode: 'in-person', emergencyKind: '',
    subject: 'Synthetic subject', curriculumGoal: 'Compare two representations', goal: 'Explain and choose together',
    environment: 'Pairs in a classroom', constraints: 'Paper', accessibility: 'Draw or speak', adultSupport: 'Adult facilitates',
    groupSize: 12, minutes: 30, models: ['udl'], immediateDanger: false, ...overrides
  };
}
function step(id, phase, minutes) {
  return { id, phase, minutes, title: `Synthetic ${id}`, purpose: 'Explain a representation', instructions: 'Draw, compare and explain.',
    facilitation: 'Ask what the representation shows.', resources: 'Paper', environment: 'Accessible table',
    components: ['mutual support'], individualSkills: ['explanation'], sharedSkills: ['listening'] };
}
function activity(overrides = {}) {
  return {
    title: 'Synthetic activity', purpose: 'Explain and choose together', facilitationGuide: 'Adult models choices.',
    environmentPlan: 'Accessible pairs', uncertaintyPlan: 'Compare hypotheses', creativityPlan: 'Try two representations',
    conflictPlan: 'Listen and inspect evidence', participationAlternative: 'Draw or pass', resilienceComponents: ['mutual support'],
    individualSkills: ['explanation'], sharedSkills: ['listening'], sources: ['CAST2024'],
    socialMechanism: { name: 'Pair review', cadence: 'Weekly', roles: 'Rotate', firstAction: 'Choose a representation', review: 'Compare explanations' },
    steps: [step('open', 'פתיחה', 5), step('main', 'פעילות מרכזית', 15), step('close', 'סיכום', 10), step('next', 'אחרי המפגש', 0)],
    ...overrides
  };
}
function workspace(TEAM, overrides = {}) {
  return TEAM.update(TEAM.newWorkspace(), w => { w.context = context(overrides); w.activity = activity(); });
}
function approved(TEAM) { return TEAM.approve(workspace(TEAM), { safety: true, privacy: true, professional: true }); }
function requestFields(request) {
  for (const message of [...request.messages].reverse()) {
    try { const fields = JSON.parse(message.content); if (fields.action) return fields; } catch {}
  }
  assert.fail('real buildRequest must include its structured current request');
}
function stored(storage) { return JSON.parse(storage.getItem(regularKey)).workspace; }
async function selectExport(f, approvalId) {
  const select = descendants(f.byId('lab-export')).find(node => node.getAttribute('aria-label') === 'הגרסה לתיק');
  assert.ok(select, 'actual export approval selection must be rendered');
  select.value = approvalId; await select.dispatch('change'); await settle();
}
async function exportPack(f) {
  await findButton(f.byId('lab-export'), 'ייצוא תיק מאושר כ-JSON').dispatch('click');
  assert.ok(f.exportBlobs.length, 'actual JSON action must create its downloadable Blob');
  return JSON.parse(await f.exportBlobs.at(-1).text());
}

test('adopting the actual rendered proposal clears every human check and requires renewed approval', async () => {
  const f = await fixture(), original = workspace(f.TEAM); f.seed(original); f.checkAll();
  const key = 'step_main', proposal = { ...original.activity.steps[1], instructions: 'Synthetic adopted instructions' };
  f.api.propose(key, { revision: original.revision, stepId: 'main', step: proposal });
  const box = f.element('div'); f.api.renderAnswer(key, box);
  await findButton(box, 'אימוץ ההצעה לשלב הזה').dispatch('click');
  assert.equal(f.api.state().ws.activity.steps[1].instructions, proposal.instructions);
  assert.deepEqual(f.checked(), [false, false, false]);
  const approvalChecks = () => Object.fromEntries(checks.map(key => [key, f.byId(`lab-check-${key}`).checked]));
  assert.throws(() => f.TEAM.approve(f.api.state().ws, approvalChecks()), /אישור/);
  f.checkAll();
  const renewed = f.TEAM.approve(f.api.state().ws, approvalChecks());
  assert.equal(renewed.approvals[0].activity.steps[1].instructions, proposal.instructions);
});

for (const choice of ['merge', 'load']) {
  test(`recovery ${choice} clears human checks before the recovered content can be approved`, async () => {
    const f = await fixture(), base = workspace(f.TEAM); f.seed(base);
    const latest = f.TEAM.update(base, w => { w.activity.title = 'Synthetic other-tab activity'; });
    f.storage.map.set(regularKey, JSON.stringify({ scopeKey: regularKey, workspace: latest }));
    f.api.setDraft('stage_0', 'Synthetic local question'); f.checkAll();
    await f.api.recover();
    const dialog = f.body.childNodes.find(node => node.tagName === 'DIALOG'); assert.ok(dialog);
    await findButton(dialog, choice === 'merge' ? 'שילוב הטיוטה שלי ושמירה' : 'פתיחת הגרסה השמורה במקום הטיוטה').dispatch('click');
    assert.deepEqual(f.checked(), [false, false, false]);
    assert.throws(() => f.TEAM.approve(f.api.state().ws, Object.fromEntries(checks.map(key => [key, f.byId(`lab-check-${key}`).checked]))), /אישור/);
    assert.equal(f.api.state().ws.activity.title, choice === 'merge' ? base.activity.title : latest.activity.title);
  });
}

test('the recovery merge action retains evidence from both the local draft and latest saved workspace', async () => {
  const f = await fixture(), base = approved(f.TEAM), approvalId = base.approvals[0].id;
  const latest = f.TEAM.recordPractice(base, { approvalId, stepId: 'main', kind: 'rehearsal', observation: 'Synthetic saved rehearsal', nextAction: 'Try the meeting', wasRealMeeting: false });
  const mine = f.TEAM.recordPractice(base, { approvalId, stepId: 'main', kind: 'meeting', observation: 'Synthetic local meeting', nextAction: 'Try another question', wasRealMeeting: true });
  f.seed(mine); f.storage.map.set(regularKey, JSON.stringify({ scopeKey: regularKey, workspace: latest }));
  await f.api.recover();
  const dialog = f.body.childNodes.find(node => node.tagName === 'DIALOG'); assert.ok(dialog);
  await findButton(dialog, 'שילוב הטיוטה שלי ושמירה').dispatch('click');
  const merged = f.api.state().ws;
  assert.equal(merged.approvals.length, 1);
  assert.equal(merged.rehearsals[0].id, latest.rehearsals[0].id);
  assert.equal(merged.observations[0].id, mine.observations[0].id);
  assert.equal(stored(f.storage).observations[0].id, mine.observations[0].id);
  assert.equal(stored(f.storage).rehearsals[0].id, latest.rehearsals[0].id);
});

test('failed persistence of a recovery merge retains both evidence sets and remains manually retryable', async () => {
  const f = await fixture(), base = approved(f.TEAM), approvalId = base.approvals[0].id;
  const latest = f.TEAM.recordPractice(base, { approvalId, stepId: 'main', kind: 'rehearsal', observation: 'Synthetic saved rehearsal', nextAction: 'Try the meeting', wasRealMeeting: false });
  const mine = f.TEAM.recordPractice(base, { approvalId, stepId: 'main', kind: 'meeting', observation: 'Synthetic local meeting', nextAction: 'Try another question', wasRealMeeting: true });
  f.seed(mine); f.storage.map.set(regularKey, JSON.stringify({ scopeKey: regularKey, workspace: latest }));
  const savedBefore = f.storage.getItem(regularKey); await f.api.recover(); f.storage.failNextWrite();
  const dialog = f.body.childNodes.find(node => node.tagName === 'DIALOG'); assert.ok(dialog);
  await assert.rejects(findButton(dialog, 'שילוב הטיוטה שלי ושמירה').dispatch('click'), error => error.code === 'storage-unavailable');
  assert.equal(f.storage.getItem(regularKey), savedBefore);
  assert.equal(f.api.state().ws.observations[0].id, mine.observations[0].id);
  assert.equal(f.api.state().ws.rehearsals[0].id, latest.rehearsals[0].id);
  assert.equal(f.api.state().conflict, false); assert.equal(f.timers.size, 0);
  await f.byId('lab-save').dispatch('click');
  assert.equal(stored(f.storage).observations[0].id, mine.observations[0].id);
  assert.equal(stored(f.storage).rehearsals[0].id, latest.rehearsals[0].id);
  assert.equal(f.api.state().persistedRevision, f.api.state().ws.revision);
});

test('a transient write failure stays retryable and schedules no automatic retry loop', async () => {
  const f = await fixture(), base = workspace(f.TEAM); f.seed(base);
  f.api.setDraft('stage_0', 'Synthetic unsaved question'); f.storage.failNextWrite();
  await assert.rejects(f.api.save(), error => error.code === 'storage-unavailable');
  assert.equal(f.api.state().conflict, false);
  assert.equal(f.storage.writes, 1); assert.equal(f.timers.size, 0);
  assert.equal(await f.runTimers(), 0); assert.equal(f.storage.writes, 1);
  await f.byId('lab-save').dispatch('click');
  assert.equal(f.api.state().persistedRevision, f.api.state().ws.revision);
  assert.equal(stored(f.storage).private.threads.draft_stage_0[0].content, 'Synthetic unsaved question');
  assert.equal(f.storage.writes, 2); assert.equal(f.api.state().conflict, false);
});

test('a manual save requested during a held save waits for the newest revision to be persisted', async () => {
  const f = await fixture(), base = workspace(f.TEAM); f.seed(base);
  f.api.setDraft('stage_0', 'Synthetic first edit'); f.locks.hold();
  const first = f.api.save(); await settle();
  f.api.setDraft('stage_0', 'Synthetic newer edit'); const newest = f.api.state().ws.revision;
  const second = f.api.save(); f.locks.release(); await Promise.all([first, second]);
  assert.equal(stored(f.storage).revision, newest);
  assert.equal(stored(f.storage).private.threads.draft_stage_0[0].content, 'Synthetic newer edit');
  assert.equal(f.api.state().persistedRevision, newest);
});

for (const kind of ['rehearsal', 'meeting']) {
  test(`two queued clicks on the actual ${kind} save button create one evidence record while its lock is pending`, async () => {
    const f = await fixture(), w = approved(f.TEAM); f.seed(w);
    const key = kind === 'meeting' ? 'meeting' : 'rehearsal';
    for (const [name, value] of Object.entries({ approvalId: w.approvals[0].id, stepId: 'main', observation: 'Synthetic observed explanation', nextAction: 'Synthetic next action', wasRealMeeting: true })) f.api.setForm(key, name, value);
    const form = f.api.practiceForm(kind), label = kind === 'meeting' ? 'שמירת תצפית ממפגש אמיתי' : 'שמירת תיעוד החזרה';
    const action = findButton(form, label); f.locks.hold();
    // Dispatch twice to cover already queued handlers, even after disabled is set.
    const first = action.dispatch('click'), second = action.dispatch('click'); await settle();
    const list = kind === 'meeting' ? 'observations' : 'rehearsals';
    assert.equal(f.api.state().ws[list].length, 1);
    assert.equal(action.disabled, true);
    f.locks.release(); await Promise.all([first, second]);
    assert.equal(stored(f.storage)[list].length, 1);
    assert.equal(f.api.state().persistedRevision, f.api.state().ws.revision);
    assert.equal(action.disabled, false);
  });
}

test('two queued approval clicks create one frozen approval while persistence is pending', async () => {
  const f = await fixture(); f.seed(workspace(f.TEAM)); f.checkAll(); f.locks.hold();
  const action = f.byId('lab-approve'), first = action.dispatch('click'), second = action.dispatch('click'); await settle();
  assert.equal(f.api.state().ws.approvals.length, 1); assert.equal(action.disabled, true);
  f.locks.release(); await Promise.all([first, second]);
  assert.equal(stored(f.storage).approvals.length, 1);
  assert.equal(f.api.state().persistedRevision, f.api.state().ws.revision);
});

test('two queued archive clicks create one move from the actual selected meeting observation', async () => {
  const f = await fixture();
  let w = approved(f.TEAM);
  w = f.TEAM.recordPractice(w, { approvalId: w.approvals[0].id, stepId: 'main', kind: 'meeting', observation: 'Synthetic meeting observation', nextAction: 'Try another representation', wasRealMeeting: true });
  f.seed(w);
  for (const [name, value] of Object.entries({ observationId: w.observations[0].id, title: 'Synthetic tried move', conditions: 'Accessible pairs', limits: 'One synthetic setting', privacyChecked: true })) f.api.setForm('move', name, value);
  f.api.renderLearning();
  const action = findButton(f.byId('lab-move'), 'שמירת המהלך בארכיון'); f.locks.hold();
  const first = action.dispatch('click'), second = action.dispatch('click'); await settle();
  assert.equal(f.api.state().ws.moves.length, 1); assert.equal(action.disabled, true);
  f.locks.release(); await Promise.all([first, second]);
  assert.equal(stored(f.storage).moves.length, 1);
  assert.equal(stored(f.storage).moves[0].observationId, w.observations[0].id);
  assert.equal(f.api.state().persistedRevision, f.api.state().ws.revision);
});

test('an embedded admin demonstration fills and generates in ephemeral storage without touching the regular draft', async () => {
  const storage = memory();
  const setup = await fixture({ storage });
  const regular = workspace(setup.TEAM, { subject: 'Synthetic regular private draft', emergencyKind: 'Synthetic old emergency' });
  storage.map.set(regularKey, JSON.stringify({ scopeKey: regularKey, workspace: regular }));
  const before = storage.getItem(regularKey), f = await fixture({ storage, sys: true, embedded: true, search: '?demolab=1' });
  const emergency = descendants(f.byId('lab-context')).find(node => node.getAttribute('aria-label') === 'אם זה חירום, מה ההקשר?');
  assert.ok(emergency); emergency.value = 'Synthetic previous demo emergency'; await emergency.dispatch('input');
  f.api.demoFill();
  assert.equal(f.api.state().ws.context.emergencyKind, '');
  await f.api.generate();
  assert.equal(f.api.state().ws.activity.title, 'Synthetic activity');
  assert.equal(storage.getItem(regularKey), before);
  assert.equal(storage.writes, 0, 'ephemeral demo saves never call persistent storage.setItem');
});

test('failed embedded admin demo generation preserves regular storage and leaves no generated activity', async () => {
  const storage = memory(), setup = await fixture({ storage });
  const regular = workspace(setup.TEAM, { subject: 'SYNTHETIC_REGULAR_PRIVATE_DRAFT', emergencyKind: 'SYNTHETIC_REGULAR_PRIVATE_EMERGENCY' });
  storage.map.set(regularKey, JSON.stringify({ scopeKey: regularKey, workspace: regular }));
  const before = storage.getItem(regularKey), response = deferred();
  const f = await fixture({ storage, sys: true, embedded: true, search: '?demolab=1', reply: () => response.promise });
  f.api.demoFill();
  const pending = f.api.generate(), rejection = assert.rejects(pending, /synthetic model failure/); await settle();
  assert.equal(f.byId('lab-wait').hidden, false); response.reject(new Error('synthetic model failure')); await rejection; await settle();
  assert.equal(storage.getItem(regularKey), before); assert.equal(storage.writes, 0);
  assert.equal(f.api.state().ws.activity, null);
  assert.ok(!JSON.stringify(f.calls[0]).includes('SYNTHETIC_REGULAR_PRIVATE'));
  assert.equal(f.byId('lab-wait').hidden, true); assert.equal(f.api.state().activeRun, null);
  assert.throws(() => f.publicApi.printableNode(), /עוד לא הופקה/);
});

test('generation repairs a JSON activity that fails full domain validation before applying it', async () => {
  const attempts = [];
  const f = await fixture({ reply: request => {
    attempts.push(plain(request));
    return attempts.length === 1 ? activity({ steps: [] }) : activity({ title: 'Synthetic repaired complete activity' });
  } });
  f.seed(workspace(f.TEAM)); await f.publicApi.generate();
  assert.equal(attempts.length, 2);
  assert.equal(f.api.state().ws.activity.title, 'Synthetic repaired complete activity');
  assert.equal(stored(f.storage).activity.title, 'Synthetic repaired complete activity');
  assert.ok(attempts[1].system.startsWith(attempts[0].system));
  assert.equal(attempts[1].permission, 'nana'); assert.equal(attempts[1].customerReview, true);
});

test('two domain-invalid generation replies leave the current activity intact and release busy controls', async () => {
  let attempts = 0;
  const f = await fixture({ reply: () => { attempts++; return activity({ steps: [] }); } });
  const current = workspace(f.TEAM); f.seed(current); const savedBefore = f.storage.getItem(regularKey);
  await assert.rejects(f.publicApi.generate(), /חלקי|מלא|הושלם/);
  assert.equal(attempts, 2); assert.deepEqual(plain(f.api.state().ws), plain(current));
  assert.equal(f.storage.getItem(regularKey), savedBefore);
  assert.equal(f.byId('lab-wait').hidden, true); assert.equal(f.api.state().activeRun, null);
  assert.equal(f.byId('lab-generate').disabled, false);
  assert.throws(() => f.publicApi.printableNode(), /עוד לא הופקה/);
});

test('approved sources use the real folded controls and visibility alone never attaches them to exports', async () => {
  const f = await fixture(), w = approved(f.TEAM); f.seed(w);
  const frozen = JSON.stringify(w.approvals); await selectExport(f, w.approvals[0].id);
  const panel = f.byId('lab-export').querySelector('.sbe-refs'); assert.ok(panel);
  const open = panel.querySelector('.refs-open'), attach = panel.querySelector('.refs-attach');
  assert.equal(panel.classList.contains('open'), false); assert.equal(open.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.classList.contains('attach'), false); assert.equal(attach.getAttribute('aria-pressed'), 'false');
  assert.ok(panel.querySelector('.refs-body').querySelector('a').href.startsWith('https://'), 'folded source retains its verified catalog link');
  await open.dispatch('click');
  assert.equal(panel.classList.contains('open'), true); assert.equal(open.getAttribute('aria-expanded'), 'true');
  assert.equal(attach.getAttribute('aria-pressed'), 'false');
  await findButton(f.byId('lab-export'), 'הדפסה / שמירה כ-PDF').dispatch('click');
  assert.equal(f.printed.length, 1); assert.equal(f.printed[0].node.querySelector('.sbe-refs'), null);
  const output = await exportPack(f);
  assert.deepEqual(output.sources, []); assert.deepEqual(output.activity.sources, []);
  assert.equal(panel.classList.contains('open'), true, 'printing its fresh document leaves the visible panel intact');
  assert.equal(JSON.stringify(f.api.state().ws.approvals), frozen, 'export filtering never mutates the frozen approval');
});

test('source attachment persists through reload and controls actual JSON and sanitized print content', async () => {
  const f = await fixture(), w = approved(f.TEAM); f.seed(w);
  const frozen = JSON.stringify(w.approvals); await selectExport(f, w.approvals[0].id);
  await f.byId('lab-export').querySelector('.refs-attach').dispatch('click');
  assert.equal(f.byId('lab-export').querySelector('.refs-attach').getAttribute('aria-pressed'), 'true');
  await f.byId('lab-save').dispatch('click');
  const reloaded = await fixture({ storage: f.storage }), panel = reloaded.byId('lab-export').querySelector('.sbe-refs');
  assert.ok(panel); assert.equal(panel.classList.contains('attach'), true); assert.equal(panel.classList.contains('open'), false);
  assert.equal(panel.querySelector('.refs-attach').getAttribute('aria-pressed'), 'true');
  const expected = plain(f.TEAM.publicPack(w, w.approvals[0].id));
  const output = await exportPack(reloaded);
  assert.deepEqual(output.sources, expected.sources); assert.deepEqual(output.activity.sources, expected.activity.sources);
  await findButton(reloaded.byId('lab-export'), 'הדפסה / שמירה כ-PDF').dispatch('click');
  const printable = reloaded.printed[0].node, sources = printable.querySelector('.sbe-refs'); assert.ok(sources);
  assert.equal(sources.querySelector('.refs-bar'), null); assert.equal(sources.querySelector('.refs-body'), null);
  assert.equal(sources.querySelector('a').href, expected.sources[0].url);
  assert.ok(panel.querySelector('.refs-bar'), 'printing does not consume the live attachment controls');
  await panel.querySelector('.refs-attach').dispatch('click');
  const detached = await exportPack(reloaded); assert.deepEqual(detached.sources, []); assert.deepEqual(detached.activity.sources, []);
  assert.equal(JSON.stringify(reloaded.api.state().ws.approvals), frozen);
});

test('selecting a different frozen approval resets the source attachment choice before export', async () => {
  const f = await fixture(); let w = approved(f.TEAM); const firstId = w.approvals[0].id;
  w = f.TEAM.update(w, draft => { draft.activity.title = 'Synthetic second approved activity'; draft.activity.sources = ['WHO2011']; });
  w = f.TEAM.approve(w, { safety: true, privacy: true, professional: true });
  const secondId = w.approvals[1].id, frozen = JSON.stringify(w.approvals); f.seed(w);
  await selectExport(f, firstId); await f.byId('lab-export').querySelector('.refs-attach').dispatch('click');
  assert.equal(f.byId('lab-export').querySelector('.sbe-refs').classList.contains('attach'), true);
  await selectExport(f, secondId);
  const panel = f.byId('lab-export').querySelector('.sbe-refs'); assert.ok(panel);
  assert.equal(panel.classList.contains('attach'), false); assert.equal(panel.querySelector('.refs-attach').getAttribute('aria-pressed'), 'false');
  assert.equal(panel.querySelector('.refs-open').getAttribute('aria-expanded'), 'false');
  const secondPack = f.TEAM.publicPack(w, secondId);
  assert.equal(panel.querySelector('a').href, secondPack.sources[0].url);
  const output = await exportPack(f); assert.equal(output.activity.title, secondPack.activity.title);
  assert.deepEqual(output.sources, []); assert.deepEqual(output.activity.sources, []);
  assert.equal(JSON.stringify(f.api.state().ws.approvals), frozen);
});

test('an embedded generated demo printable node strips its default unattached sources with the real print sanitizer', async () => {
  const f = await fixture({ sys: true, embedded: true, search: '?demolab=1' });
  f.publicApi.demoFill(); await f.publicApi.generate();
  assert.deepEqual(plain(f.api.state().ws.activity.sources), ['CAST2024']);
  const printable = f.publicApi.printableNode(); assert.equal(printable.tagName, 'ARTICLE');
  assert.equal(printable.querySelector('.sbe-refs'), null); assert.equal(printable.querySelector('.refs-bar'), null);
  assert.deepEqual(plain(f.api.state().ws.activity.sources), ['CAST2024'], 'print sanitization leaves the generated activity sources intact');
});

for (const options of [
  { sys: false, embedded: true, search: '?demolab=1' },
  { sys: true, embedded: false, search: '?demolab=1' },
  { sys: true, embedded: true, search: '' }
]) {
  test(`demo isolation is gated by admin, embed and query (${JSON.stringify(options)})`, async () => {
    const storage = memory(), setup = await fixture({ storage });
    const regular = workspace(setup.TEAM, { subject: 'Synthetic regular selected draft' });
    storage.map.set(regularKey, JSON.stringify({ scopeKey: regularKey, workspace: regular }));
    const f = await fixture({ storage, ...options });
    assert.equal(f.api.state().ws.context.subject, regular.context.subject);
    if (!options.sys) assert.throws(() => f.api.demoFill(), /מנהלת/);
  });
}

for (const stage of [2, 3]) {
  test(`stage ${stage} question uses the explicitly selected frozen approval and step through actual question listeners`, async () => {
    const f = await fixture({ reply: () => ({ answer: 'Synthetic approved answer', proposedStep: { ...step('main', 'פעילות מרכזית', 15), instructions: 'SYNTHETIC_FORBIDDEN_PROPOSAL' } }) });
    let first = workspace(f.TEAM, { subject: 'SYNTHETIC_FROZEN_SUBJECT' });
    first = f.TEAM.update(first, w => { w.activity.steps[1].instructions = 'SYNTHETIC_FROZEN_STEP'; });
    first = f.TEAM.approve(first, { safety: true, privacy: true, professional: true });
    const chosen = first.approvals[0];
    let current = f.TEAM.update(first, w => { w.context.subject = 'SYNTHETIC_NEWER_APPROVAL_SUBJECT'; w.activity.steps[1].instructions = 'SYNTHETIC_NEWER_APPROVAL_STEP'; });
    current = f.TEAM.approve(current, { safety: true, privacy: true, professional: true });
    current = f.TEAM.update(current, w => { w.context.subject = 'SYNTHETIC_DRAFT_SUBJECT'; w.activity.steps[1].instructions = 'SYNTHETIC_DRAFT_STEP'; w.private.concerns = 'SYNTHETIC_PRIVATE_CONCERN'; });
    f.seed(current);
    const form = stage === 2 ? 'rehearsal' : 'meeting';
    f.api.setForm(form, 'approvalId', chosen.id); f.api.setForm(form, 'stepId', 'main'); f.api.goStage(stage);
    f.byId('lab-question-input').value = 'Synthetic question about the selected experience';
    await f.byId('lab-question-input').dispatch('input'); await f.byId('lab-ask').dispatch('click');
    assert.equal(f.calls.length, 1);
    const fields = requestFields(f.calls[0]), serialized = JSON.stringify(f.calls[0]);
    assert.equal(fields.context.subject, chosen.context.subject); assert.equal(fields.step.instructions, 'SYNTHETIC_FROZEN_STEP');
    for (const marker of ['SYNTHETIC_DRAFT', 'SYNTHETIC_NEWER_APPROVAL', 'SYNTHETIC_PRIVATE_CONCERN']) assert.ok(!serialized.includes(marker), `request excludes ${marker}`);
    const key = `stage_${stage}_approval_${chosen.id}`;
    assert.equal(f.requestOptions[0].approvalId, chosen.id); assert.equal(f.requestOptions[0].stepId, 'main'); assert.equal(f.requestOptions[0].threadKey, key);
    assert.equal(f.api.state().ws.private.threads[key].at(-1).role, 'assistant');
    assert.equal(f.api.state().ws.private.threads[`stage_${stage}`], undefined);
    assert.equal(f.api.state().ws.approvals[0].activity.steps[1].instructions, 'SYNTHETIC_FROZEN_STEP');
    assert.equal(f.api.state().ws.activity.steps[1].instructions, 'SYNTHETIC_DRAFT_STEP');
    assert.equal(descendants(f.byId('lab-question-answer')).filter(node => node.tagName === 'BUTTON').length, 0, 'an approved-step answer cannot offer adoption into the current draft');
  });
}

test('ask passes the chosen current thread to real buildRequest and sends bounded follow-up context only', async () => {
  const f = await fixture();
  const w = f.TEAM.update(workspace(f.TEAM), next => {
    next.private.threads.stage_1 = Array.from({ length: 40 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `SYNTHETIC_CURRENT_${index}` }));
    next.private.threads.stage_0 = [{ role: 'user', content: 'SYNTHETIC_UNRELATED_THREAD' }];
    next.private.concerns = 'SYNTHETIC_PRIVATE_CONCERN';
  });
  f.seed(w); f.api.goStage(1); f.byId('lab-question-input').value = 'Synthetic follow-up question';
  await f.byId('lab-question-input').dispatch('input'); await f.byId('lab-ask').dispatch('click');
  assert.equal(f.requestOptions[0].threadKey, 'stage_1');
  const request = f.calls[0], serialized = JSON.stringify(request);
  const conversation = requestFields(request).conversation;
  assert.equal(conversation.length, 12);
  assert.equal(conversation[0].content, 'SYNTHETIC_CURRENT_28');
  assert.equal(conversation.at(-1).content, 'SYNTHETIC_CURRENT_39');
  assert.ok(conversation.every(turn => turn.content.length <= 4000));
  assert.ok(serialized.includes('SYNTHETIC_CURRENT_39'), 'follow-up includes the recent answer');
  assert.ok(!serialized.includes('SYNTHETIC_CURRENT_0'), 'oldest history is outside the request bound');
  assert.ok(!serialized.includes('SYNTHETIC_UNRELATED_THREAD')); assert.ok(!serialized.includes('SYNTHETIC_PRIVATE_CONCERN'));
  assert.equal(requestFields(request).question, 'Synthetic follow-up question');
  assert.equal(f.api.state().ws.private.threads.stage_1.length, 40);
  assert.equal(f.api.state().ws.private.threads.stage_1.at(-2).content, 'Synthetic follow-up question');
});

for (const kind of ['generate', 'question']) {
  for (const invalidation of ['edit', 'recover', 'session']) {
    test(`actual planner rejects a late ${kind} reply after ${invalidation} and releases busy controls`, async () => {
      const response = deferred(), f = await fixture({ reply: () => response.promise }), base = workspace(f.TEAM);
      f.seed(base); f.api.setDraft('stage_0', 'Synthetic existing planning note');
      let action;
      if (kind === 'question') {
        const answer = descendants(f.byId('lab-editor')).find(node => node.dataset.answerKey === 'step_main'); assert.ok(answer);
        const wrapper = answer.parentNode;
        const input = descendants(wrapper).find(node => node.getAttribute('aria-label') === 'שאלה על השלב הזה'); assert.ok(input);
        input.value = 'Synthetic step question awaiting a reply'; await input.dispatch('input');
        action = findButton(wrapper, 'שליחת שאלה על השלב');
      } else action = f.byId('lab-regenerate');
      const pending = action.dispatch('click');
      const rejection = assert.rejects(pending, error => error.name === 'AbortError'); await settle();
      assert.equal(f.calls.length, 1); assert.equal(f.byId('lab-wait').hidden, false);
      assert.equal(f.byId('lab-generate').disabled, true); assert.equal(f.byId('lab-ask').disabled, true);
      assert.equal(f.aiSignals[0].aborted, false);

      if (invalidation === 'edit') {
        const title = descendants(f.byId('lab-editor')).find(node => node.getAttribute('aria-label') === 'שם הפעילות'); assert.ok(title);
        title.value = 'SYNTHETIC_NEWER_EDITED_ACTIVITY'; await title.dispatch('input');
        assert.equal(f.aiSignals[0].aborted, true, 'actual change handler aborts the production planner run');
      } else if (invalidation === 'recover') {
        // The competing tab reaches the same revision/context as this run;
        // explicit recovery invalidation must still reject its late reply.
        let latest = base;
        while (latest.revision < f.api.state().ws.revision) latest = f.TEAM.update(latest, w => { w.activity.title = 'SYNTHETIC_RECOVERED_ACTIVITY'; });
        assert.equal(latest.revision, f.api.state().ws.revision);
        f.storage.map.set(regularKey, JSON.stringify({ scopeKey: regularKey, workspace: latest }));
        await f.api.recover();
        const dialog = f.body.childNodes.find(node => node.tagName === 'DIALOG'); assert.ok(dialog);
        await findButton(dialog, 'פתיחת הגרסה השמורה במקום הטיוטה').dispatch('click');
        assert.equal(f.api.state().ws.activity.title, 'SYNTHETIC_RECOVERED_ACTIVITY');
        assert.equal(f.aiSignals[0].aborted, true, 'actual recovery handler aborts the production planner run');
      } else {
        // No abort event is delivered. createWork must notice its token-bearing
        // source state changed even when the transport continues normally.
        f.session.set('sbe.session.token', 'synthetic-changed-session-token');
        assert.equal(f.aiSignals[0].aborted, false);
      }

      const expected = plain(f.api.state().ws), savedBeforeReply = f.storage.getItem(regularKey);
      response.resolve(kind === 'generate' ? activity({ title: 'SYNTHETIC_LATE_GENERATED_ACTIVITY' }) : {
        answer: 'SYNTHETIC_LATE_ANSWER', proposedStep: { ...step('main', 'פעילות מרכזית', 15), instructions: 'SYNTHETIC_LATE_PROPOSAL' }
      });
      await rejection; await settle();
      assert.deepEqual(plain(f.api.state().ws), expected, 'late reply cannot change the current or recovered workspace');
      assert.equal(f.storage.getItem(regularKey), savedBeforeReply, 'late reply cannot persist output');
      assert.ok(!JSON.stringify(f.api.state().ws).includes('SYNTHETIC_LATE'));
      const answer = f.element('div'); f.api.renderAnswer('step_main', answer);
      assert.equal(descendants(answer).filter(node => node.tagName === 'BUTTON').length, 0, 'late proposal cannot be offered for adoption');
      assert.equal(f.byId('lab-wait').hidden, true); assert.equal(f.api.state().activeRun, null);
      for (const id of ['lab-generate', 'lab-regenerate', 'lab-ask', 'lab-support', 'lab-approve']) assert.equal(f.byId(id).disabled, false, `${id} is released after the stale response`);
      assert.equal(action.disabled, false);
    });
  }
}
