import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const W = createRequire(import.meta.url)('../../app/lib/journey-workspace-model.js');

test('one browser and server schema offers four inventories and parallel lenses', () => {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(new URL('../../app/lib/journey-workspace-model.js', import.meta.url), 'utf8'), ctx);
  assert.ok(ctx.window.SBE_JOURNEY_WORKSPACE);
  assert.deepEqual(W.SECTIONS.slice(0, 4).map(x => x.key), ['roles', 'mechanisms', 'infrastructures', 'resources']);
  assert.deepEqual(W.LENSES.map(x => x.label), ['קיום', 'מימוש', 'התחדשות']);
  assert.equal(W.PRINCIPLES.length, 7); assert.equal(W.QUALITIES.length, 7);
  assert.match(W.aiSystem(), /evidenceIds/);
  assert.match(W.aiSystem(), /טיוטה/);
  assert.match(W.aiSystem(), /הוראות/);
});

test('normalization creates independent empty workspaces and preserves meaningful text without truncation', () => {
  const a = W.empty(), b = W.empty();
  a.roles.push({ id: 'role_1', title: '  צוות חוסן  ' });
  const clean = W.clean(a);
  assert.equal(clean.roles[0].title, 'צוות חוסן'); assert.deepEqual(clean.roles[0].evidenceIds, []);
  assert.deepEqual(b.roles, []); assert.deepEqual(W.clean({}), b);
  assert.throws(() => W.clean({ roles: [{ id: 'r', title: 'א'.repeat(4001) }] }), /4000/);
});

test('references enforce target kind, stable unique IDs and deletion safety', () => {
  const w = W.empty();
  w.evidence.push({ id: 'e1', title: 'תצפית', observedAt: '2026-10-26' });
  w.roles.push({ id: 'r1', title: 'רכזות', evidenceIds: ['e1'] });
  w.mechanisms.push({ id: 'm1', title: 'מפגש למידה', roleIds: ['r1'], evidenceIds: ['e1'] });
  w.links.push({ id: 'l1', title: 'קשר', from: ['m1'], to: ['m1'], type: 'info', status: 'observed' });
  assert.equal(W.clean(w).mechanisms[0].roleIds[0], 'r1');
  w.evidence = []; assert.throws(() => W.clean(w), /e1/);
  w.evidence = [{ id: 'e1' }]; w.mechanisms[0].roleIds = ['e1']; assert.throws(() => W.clean(w), /e1/);
  w.mechanisms[0].roleIds = ['r1']; w.roles.push({ id: 'r1' }); assert.throws(() => W.clean(w), /r1/);
  w.roles.pop(); w.links[0].from = ['m1', 'm1']; assert.throws(() => W.clean(w), /1/);
});

test('schema rejects invalid enums, structures, dates, caps and prototype keys', () => {
  for (const bad of [null, [], 'text']) assert.throws(() => W.clean(bad));
  assert.throws(() => W.clean({ roles: Array.from({ length: 81 }, (_, i) => ({ id: 'r' + i })) }), /80/);
  assert.throws(() => W.clean({ mechanisms: [{ id: 'm', principles: ['score'] }] }), /score/);
  assert.throws(() => W.clean({ evidence: [{ id: 'e', observedAt: '2026-02-30' }] }), /תאריך/);
  assert.throws(() => W.clean({ findings: [{ id: 'f', state: 'confirmed' }] }), /אישור/);
  assert.throws(() => W.clean({ context: { goal: { text: 'nested' } } }));
  assert.throws(() => W.clean(JSON.parse('{"__proto__":{"polluted":true}}')));
  assert.throws(() => W.clean({ roles: [{ id: 'r', constructor: 'bad' }] }));
  assert.throws(() => W.clean({ hiddenPrivateData: 'not allowed' }));
  assert.equal({}.polluted, undefined);
  const w = W.clean({ findings: [{ id: 'f', origin: 'ai', state: 'draft', evidenceIds: [] }] });
  assert.equal(w.findings[0].approvedBy, ''); assert.equal(w.findings[0].state, 'draft');
});
