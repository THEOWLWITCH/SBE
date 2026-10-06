import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const studio = require('../../app/lib/resilience-studio.js');

test('AE13–14: editable focus respects an explicit positive choice', () => {
  const brief = studio.newBrief({ startingPoint:'יוזמה קהילתית', goal:'תקווה ותמונה משותפת', focus:'hope' });
  assert.equal(studio.recommendFocus(brief).focus, 'hope');
  assert.equal(studio.recommendFocus(studio.newBrief({ goal:'עזרה הדדית' })).focus, 'support');
});
test('AE4,24: a short example fits time and links every skill to a real step', () => {
  const brief = studio.newBrief({ count:28, duration:15, focus:'support' });
  const activity = studio.exampleActivity(brief);
  assert.deepEqual(studio.validateActivity(activity, brief), []);
  assert.equal(activity.sessions[0].steps.reduce((n,s)=>n+s.minutes,0), 15);
  const claims = studio.claims(activity);
  assert.ok(claims.individual.every(c=>c.stepIds.length));
  assert.ok(claims.shared.every(c=>c.stepIds.length));
});
test('AE25: removing the joint step removes its shared skill claims', () => {
  const a = studio.exampleActivity(studio.newBrief({ focus:'support' }));
  a.sessions[0].steps = a.sessions[0].steps.filter(s=>!s.sharedSkills.length);
  assert.deepEqual(studio.claims(a).shared, []);
  assert.ok(studio.validateActivity(a, studio.newBrief()).length);
});
test('AE19–20: portable export retains provenance and excludes planning context', () => {
  const brief = studio.newBrief({ startingPoint:'מידע אישי', sources:[{id:'u1',name:'סיפור',content:'פרטים פרטיים',role:'context',status:'unreviewed'}] });
  const activity = studio.exampleActivity(brief);
  const work = studio.workFile({ brief, activity, versions:[activity] });
  assert.equal(JSON.parse(JSON.stringify(work)).brief.sources[0].content,'פרטים פרטיים');
  const exported = studio.publicActivity(activity);
  assert.ok(!JSON.stringify(exported).includes('פרטים פרטיים'));
  assert.equal(exported.evidenceStatus,'example-draft');
});
test('AE18,23: sources have no count cap and unreviewed sources remain context', () => {
  const sources = Array.from({length:70},(_,i)=>({id:'s'+i,name:'מקור '+i,role:'professional',status:'unreviewed',content:'רעיון'}));
  const b = studio.newBrief({sources});
  assert.equal(b.sources.length,70);
  assert.ok(b.sources.every(s=>s.status==='unreviewed'&&s.role==='context'));
});
