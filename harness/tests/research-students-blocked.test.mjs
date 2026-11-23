// סטודנטיות אמיתיות לא נכנסות לאזור המחקר (23/11/2026: "ודא שסטודנטיות אמיתיות לא יכולות להכנס לאזור המחקר. קוד 7777 יכול").
// נבדק מול כל סוגי הכניסה שסטודנטים מקבלים: קישור קבוצה במסלול הסטודנטיות (בלי קוד Begood), קוד סטודנט/ית וקוד קורס
// במשוב לעבודות, כניסת סדנה וקישור פתוח. מרכז המחקר, השאלונים והנתונים: רק מנהלת המערכת וקודי צוות או מנהל/ת מוסד.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { accessFixture, rpcFixture } from '../fixtures/research-scenarios.mjs';
import { handleAccess } from '../lib/access.mjs';

const STUDENT_TOKENS = [
  { k: 'workshop', w: 'w1' },
  { k: 'open', o: 'o1' },
  { k: 'code', c: 'STUDENT1', kind: 'student' },
  { k: 'code', c: 'COURSE1', kind: 'course' },
  { k: 'code', c: 'ACADEMIC', kind: 'academic-legacy' },
  { k: 'code', c: 'LEGACY', kind: 'legacy' },
];

test('research API: student-type sessions get 403 and never reach the database', async () => {
  const { handleResearch } = await import('../lib/research.mjs');
  const a = accessFixture(); const r = rpcFixture();
  for (const p of STUDENT_TOKENS) {
    for (const action of ['bootstrap', 'myStudies']) {
      const [status] = await handleResearch(a.store, r, { token: a.token(p), action });
      assert.ok(status === 403 || status === 400, JSON.stringify(p) + ' ' + action + ' → ' + status);
    }
  }
  assert.equal(r.calls.length, 0);
});

test('research shell and the team card: hidden for student-type sessions', () => {
  const guard = readFileSync(new URL('../../app/lib/access-guard.js', import.meta.url), 'utf8');
  const links = readFileSync(new URL('../../app/lib/study-links.js', import.meta.url), 'utf8');
  const tok = (p) => p ? Buffer.from(JSON.stringify({ exp: Date.now() + 3600000, ...p })).toString('base64url') + '.sig' : '';
  function shell(page, p) {
    const v = new Map([['sbe.session.homeUrl', 'home.html'], ['sbe.session.perms', '[]'], ['sbe.session.token', tok(p)]]);
    const st = { getItem: (k) => v.get(k) || null, setItem: (k, x) => v.set(k, x), removeItem: (k) => v.delete(k) };
    const html = { style: {}, classList: { add() {} } };
    vm.runInNewContext(guard, { window: {}, sessionStorage: st, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      document: { documentElement: html, head: { appendChild() {} }, createElement: () => ({}) },
      location: { pathname: '/' + page, search: '', replace() {} }, URLSearchParams, Uint8Array, TextDecoder, atob });
    return html.style.display !== 'none';
  }
  function card(p) {
    let added = false;
    const el = { dataset: { studyPlace: 'before', studyTool: 'x' }, before() { added = true; }, replaceChildren() {}, set hidden(_) {} };
    const mk = () => ({ append() {}, set textContent(_) {}, set className(_) {}, set href(_) {}, set id(_) {}, style: {} });
    const ctx = { self: { SBE_BGSTUDY: { WAVES: [], PLACES: {} } }, sessionStorage: { getItem: (k) => k === 'sbe.session.token' ? tok(p) : null, setItem() {} },
      location: { hostname: 'be-good.co.il', pathname: '/x.html' }, fetch: async () => ({ ok: true, json: async () => ({ participations: [] }) }),
      document: { readyState: 'complete', querySelectorAll: () => [el], getElementById: () => null, createElement: mk, head: { append() {} } },
      URLSearchParams, Uint8Array, TextDecoder, atob, JSON, Date };
    vm.runInNewContext(links, ctx);
    return added;
  }
  for (const p of [null, ...STUDENT_TOKENS]) {
    for (const page of ['research-management.html', 'research-participation.html']) assert.equal(shell(page, p), false, JSON.stringify(p) + ' ' + page);
    assert.equal(card(p), false, 'team card for ' + JSON.stringify(p));
  }
  // צוות המחקר כן רואה: מנהלת המערכת (גם בכניסת 7777) וקוד צוות
  assert.equal(card({ k: 'sys' }), true);
  assert.equal(card({ k: 'code', c: 'EINAT1', kind: 'staff' }), true);
});

test('talk-study: a joined student cannot use research-center operations, 7777 or other groups', async () => {
  const data = new Map();
  const store = { async get(k) { return data.get(k) || null; }, async set(k, v) { data.set(k, structuredClone(v)); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value }); } };
  data.set('tsc:ABCDEFGH', { code: 'ABCDEFGH', studyId: 's1', studyTitle: 'מחקר', group: 'קבוצה', status: 'open', createdAt: 'x' });
  const consent = { version: 'v1', required: ['agree'], items: { agree: true } };
  const [js, joined] = await handleAccess(store, { action: 'tsCall', op: 'p.join', input: { code: 'ABCDEFGH', consent } });
  assert.equal(js, 200);
  const cred = { code: 'ABCDEFGH', pid: joined.pid, key: joined.key };
  for (const op of ['f.list', 'f.export', 'f.emails', 'f.create', 'f.status', 'f.delete', 'f.test']) {
    const [s] = await handleAccess(store, { action: 'tsCall', op, input: { ...cred, studyId: 's1' } });
    assert.equal(s, 403, op);
    const [s2] = await handleAccess(store, { action: 'tsCall', op, input: { studyId: 's1' }, token: joined.key });
    assert.notEqual(s2, 200, op + ' with the participant key as token');
  }
});
