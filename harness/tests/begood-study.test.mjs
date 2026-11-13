// מחקר השיחות המאתגרות (11/11/2026): שלושת השאלונים עוברים את בדיקת השרת, והכפתורים בכלים לפי הפרוטוקול.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validateInstrument, validateAnswers } from '../lib/research.mjs';
const BG = createRequire(import.meta.url)('../../app/lib/begood-study.js');
const CORE = createRequire(import.meta.url)('../../app/lib/research-core.js');

test('three waves, ids the server accepts, each definition valid', () => {
  assert.equal(BG.WAVES.length, 3);
  for (const w of BG.WAVES) {
    assert.match(w.waveId, /^[A-Za-z0-9_-]+$/);
    const out = validateInstrument(w.definition);
    assert.equal(out.items.length, w.definition.items.length);
    assert.ok(CORE.CONSTRUCTS.some(c => c.id === w.definition.construct));
    assert.ok(w.label && !/T0|T1|T2/.test(w.label + w.definition.title + w.definition.description));
  }
});

test('items follow the protocol: core every time, U and O and open question only at the end', () => {
  const ids = w => BG.byId(w).definition.items.map(i => i.id);
  const core = ['M', 'B', 'N', 'T', 'A', 'P', 'K'];
  for (const w of ['bg-s1-open', 'bg-s2-close', 'bg-s3-close']) for (const p of core) assert.ok(ids(w).some(id => id[0] === p), w + p);
  assert.ok(ids('bg-s1-open').some(id => id.startsWith('bg_')));
  assert.ok(!ids('bg-s2-close').some(id => /^[UO]\d/.test(id)));
  assert.deepEqual(ids('bg-s3-close').filter(id => /^[UO]\d/.test(id)), ['U1', 'U2', 'U3', 'U4', 'O1', 'O2', 'O3']);
  assert.ok(ids('bg-s3-close').includes('open_helped'));
  assert.equal(BG.ITEMS.U2, 'הרגשתי חופשי/ה לבחור בין הגישות שהוצגו לי.');
});

test('"prefer not to answer" is stored as null, apart from a missing answer', () => {
  const def = validateInstrument(BG.byId('bg-s2-close').definition);
  const out = validateAnswers(def, { M1: 4, M2: null });
  assert.equal(out.M1, 4);
  assert.equal(out.M2, null);
  assert.ok(!('M3' in out));
  assert.throws(() => validateAnswers(def, { M1: 6 }));
});

test('buttons sit before and after use, as in the protocol', () => {
  const planner = readFileSync(new URL('../../app/conversation-planner.html', import.meta.url), 'utf8');
  const practice = readFileSync(new URL('../../app/practice.html', import.meta.url), 'utf8');
  assert.match(planner, /data-study-tool="conversation-planner" data-study-place="before"/);
  assert.match(practice, /data-study-tool="practice" data-study-place="before"/);
  assert.match(practice, /data-study-tool="practice" data-study-place="after"/);
  for (const html of [planner, practice]) assert.ok(html.indexOf('src="lib/begood-study.js"') > 0 && html.indexOf('src="lib/begood-study.js"') < html.indexOf('src="lib/study-links.js"'));
  assert.deepEqual(BG.PLACES['conversation-planner'].before, ['bg-s1-open']);
  assert.deepEqual(BG.PLACES.practice.after, ['bg-s2-close', 'bg-s3-close']);
  const links = readFileSync(new URL('../../app/lib/study-links.js', import.meta.url), 'utf8');
  assert.ok(!/—/.test(links.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')));
});

class Node {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.value = ''; this.checked = false; this.hidden = false; this.dataset = {}; this.attributes = {}; this.style = {}; }
  append(...ns) { for (const n of ns) { n.parentNode = this; this.children.push(n); } }
  replaceChildren(...ns) { this.children = []; this._text = ''; this.append(...ns); }
  set textContent(t) { this._text = String(t); this.children = []; }
  get textContent() { return (this._text || '') + this.children.map(n => n.textContent || '').join(' '); }
  addEventListener(k, f) { this.listeners[k] = f; }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  remove() { this.removed = true; if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this); }
  click() { return this.listeners.click?.({ preventDefault() {} }); }
}
const all = r => { const out = []; const v = n => { out.push(n); n.children.forEach(v); }; v(r); return out; };

test('participant sees only the wave from the button, with the 1 to 5 scale, "prefer not" and a way back', async () => {
  globalThis.self = { SBE_BGSTUDY: BG };
  try {
    const UI = createRequire(import.meta.url)('../../app/lib/research-participation-ui.js');
    const root = new Node(), d = { root, body: new Node('body'), createElement: t => new Node(t), getElementById: () => root }, calls = [];
    const inst = BG.WAVES.map((w, i) => ({ id: 'i' + i, definition: validateInstrument(w.definition) }));
    const state = { study: { id: 'a', title: 'מחקר', schedule: BG.WAVES.map((w, i) => ({ waveId: w.waveId, instrumentVersionId: 'i' + i, offsetDays: w.offsetDays })) }, participation: { id: 'p', status: 'enrolled', verified: true, consentVersionId: 'v', consents: { surveys: true }, preferences: {} }, consent: { id: 'v', definition: { text: 'הסכמה', categories: ['surveys'], contactKinds: [] } }, instruments: inst, responses: [] };
    const client = { setScope() {}, call: async (a, p) => { calls.push([a, p]); return state; } };
    const page = UI.mount({ document: d, root, client, search: '?study=a&wave=bg-s2-close&back=practice.html' });
    await page.load();
    const text = root.textContent;
    assert.match(text, /סוף מפגש 2/);
    assert.ok(!/פתיחת מפגש 1/.test(text) && !/סיום מפגש 3/.test(text));
    const links = all(root).filter(n => n.tagName === 'a');
    assert.ok(links.some(a => a.href === 'practice.html'));
    const selects = all(root).filter(n => n.tagName === 'select');
    assert.equal(selects.length, 26); // 23 היגדי ליבה ועוד K1 עד K3
    const opts = selects[0].children.map(o => o.textContent);
    assert.ok(opts.includes('1 · כלל לא') && opts.includes('5 · במידה רבה מאוד') && opts.includes('מעדיף/ה לא לענות'));
    selects[0].value = '4'; selects[1].value = '__decline';
    const save = all(root).find(n => n.tagName === 'button' && n.textContent === 'שמירת מענה לשאלון');
    await save.click();
    const sent = calls.find(([a]) => a === 'surveySubmit')[1];
    assert.equal(sent.waveId, 'bg-s2-close');
    assert.deepEqual(sent.answers, { M1: 4, M2: null });
    const evil = UI.mount({ document: d, root, client, search: '?study=a&wave=bg-s2-close&back=https://x.example/a.html' });
    await evil.load();
    assert.ok(!all(root).some(n => n.tagName === 'a' && /x\.example/.test(n.href || '')));
  } finally { delete globalThis.self; }
});
