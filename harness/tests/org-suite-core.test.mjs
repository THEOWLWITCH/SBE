// Begood together: כללי הקידוד והשעון מהחבילה BE_GOOD_Organizational_Suite v1.0 (28/10/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { profile, normalizeObservation, activeElapsed, transition } from '../lib/org-suite-core.mjs';

test('training scenarios include concrete role resources and the source cards needed for EXT-2', () => {
  const scenarios = JSON.parse(readFileSync(new URL('../../app/org-suite/data/scenarios.json', import.meta.url), 'utf8'));
  for (const scenario of scenarios) {
    assert.deepEqual(scenario.roles.map(role => role.code), ['T', 'S', 'K']);
    for (const role of scenario.roles) assert.match(role.brief, /\d/, 'each role needs a concrete resource or constraint');
    assert.equal(scenario.sourceCards.length, 2);
    assert.equal(scenario.sourceCards.every(card => card.fictional && card.title && card.text && /^\d{4}-\d{2}-\d{2}$/.test(card.date)), true);
    const sourceIds = new Set(scenario.sourceCards.map(card => card.id));
    const external = scenario.opportunities.find(o => o.id === 'EXT-2');
    assert.equal(external.sourceCardIds.length, 2);
    assert.equal(external.sourceCardIds.every(id => sourceIds.has(id)), true);
    assert.match(scenario.opportunities.find(o => o.id === 'VOI-1').trigger, /\d/, 'contradictory data must have a concrete value');
    assert.equal(scenario.opportunities.some(o => /צוות [אבג][׳']/u.test(o.trigger)), false);
  }
});

test('missing and ethical refusal stay null; only two valid opportunities yield a domain percentage', () => {
  const entries = [
    { coderId: 'C1', opportunityId: 'EXP-1', deliveryStatus: 'DEL', observationStatus: 'OBS', score: 2 },
    { coderId: 'C1', opportunityId: 'EXP-2', deliveryStatus: 'DEL', observationStatus: 'OBS', score: 1 },
    { coderId: 'C1', opportunityId: 'EMP-1', deliveryStatus: 'DEL', observationStatus: 'EO', score: null },
    { coderId: 'C1', opportunityId: 'EMP-2', deliveryStatus: 'DEL', observationStatus: 'OBS', score: 2 }
  ];
  const p = profile(entries, ['EXP', 'EMP', 'NET']);
  assert.equal(p[0].domains[0].score, 75);
  assert.equal(p[0].domains[1].score, null);
  assert.equal(p[0].domains[2].score, null);
  assert.equal(p[0].domains[0].validCount, 2);
  assert.equal('overall' in p[0], false);
});

test('original revisions remain separate and latest revision drives profile', () => {
  const entries = [
    { coderId: 'C1', opportunityId: 'EXP-1', deliveryStatus: 'DEL', observationStatus: 'OBS', score: 0 },
    { coderId: 'C1', opportunityId: 'EXP-2', deliveryStatus: 'DEL', observationStatus: 'OBS', score: 2 },
    { coderId: 'C1', opportunityId: 'EXP-1', deliveryStatus: 'DEL', observationStatus: 'OBS', score: 1 }
  ];
  assert.equal(profile(entries, ['EXP'])[0].domains[0].score, 75);
  assert.equal(entries[0].score, 0);
});

test('late response is capped; missing evidence and reciprocity cannot produce a full score', () => {
  const valid = { opportunityId: 'EXP-1', deliveryStatus: 'DEL', observationStatus: 'OBS', score: 2, evidence: 'נמסר מקרה ונבדקה התאמה', lateResponse: true };
  assert.equal(normalizeObservation(valid).score, 1);
  assert.throws(() => normalizeObservation({ ...valid, evidence: '' }), /ראיה/);
  assert.throws(() => normalizeObservation({ ...valid, opportunityId: 'EMP-1', lateResponse: false }), /הדדית/);
  assert.equal(normalizeObservation({ ...valid, opportunityId: 'EMP-1', lateResponse: false, reciprocalChainObserved: true }).score, 2);
  assert.equal(normalizeObservation({ ...valid, observationStatus: 'EO', score: null }).score, null);
  assert.throws(() => normalizeObservation({ ...valid, observationStatus: 'EO' }), /חסר/);
});

test('pause excludes stopped wall time and closed session cannot reopen', () => {
  const s = { status: 'draft', clock: {activeMs: 0, startedAt: null} };
  transition(s, 'running', 1000);
  assert.equal(activeElapsed(s, 3500), 2500);
  transition(s, 'paused', 4000);
  assert.equal(activeElapsed(s, 9000), 3000);
  transition(s, 'running', 10000);
  transition(s, 'debrief', 12000);
  assert.equal(activeElapsed(s, 20000), 5000);
  transition(s, 'closed', 21000);
  assert.throws(() => transition(s, 'running'), /מעבר/);
});
