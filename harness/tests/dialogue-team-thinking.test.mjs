// מעבדת שיח וחקר משותף וחשיבת צוות (11/10/2026): ההנחיות למודל, המקורות, המשוב המכבד, השמות שנשארים במכשיר
// והטקסט הקבוע במסכים (שפה של הזמנה, בלי מקף ארוך).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const D = require('../../app/lib/dialogue-lab-model.js');
const TT = require('../../app/lib/team-thinking-model.js');
const KIT = require('../../app/lib/lab-kit.js');
const R = require('../../app/lib/readiness-groups.js');
const invite = require('../../app/lib/invite-language.js');
const read = (f) => readFileSync(new URL('../../app/' + f, import.meta.url), 'utf8');
const ctx = { window: {} }; vm.runInNewContext(read('lib/resilience-advisor-sources.js'), ctx);
const SRC = ctx.window.SBE_ADVISOR_SOURCES;

test('both tools draw on a dialogue group of sources, and Practi keeps its own bank', () => {
  for (const name of ['dialogue', 'teamthink']) {
    const kb = SRC.forAdvisor(name);
    assert.ok(kb.filter((s) => s.g === 'dialog').length >= 10, name);
    for (const k of ['Jay2017', 'Alexander2020', 'MichaelsOConnor2008', 'HattieTimperley2007', 'Woolley2010', 'Nemeth2001', 'Kapur2008', 'Gable2004', 'CohenLotan2014', 'Johnson2009']) assert.ok(kb.some((s) => s.k === k), name + ' ' + k);
    for (const s of kb) assert.ok(s.apa && s.gist && s.be, s.k);
  }
  const keys = SRC.list.map((s) => s.k); assert.equal(new Set(keys).size, keys.length, 'no duplicate keys');
  assert.ok(!SRC.forAdvisor('practi').some((s) => s.g === 'dialog'));
});

test('dialogue lab: four stages, the shared gain question, prompts with every part', () => {
  assert.deepEqual(D.STAGES.map((s) => s.t), ['מנסחים שאלה', 'בונים טענה', 'בודקים ראיות', 'מתקנים יחד']);
  assert.equal(D.GAIN[4], 'מה אנחנו מבינים או יודעים לעשות עכשיו שלא היה בידינו קודם?');
  const kb = SRC.forAdvisor('dialogue'), start = D.startSystem(kb), rev = D.reviseSystem(kb);
  for (const part of ['questions', 'roles', 'path', 'claimStart', 'plan']) assert.ok(start.includes('- ' + part + ':'), part);
  assert.match(start, /מעטפת/); assert.match(start, /voice/);
  for (const t of [start, rev, D.stageSystem(2)]) { assert.match(t, /בלי שמות של אנשים/); assert.match(t, /גם עמדה שלא נבחרה נשמרת/); assert.match(t, /בגן תיווך מבוגר/); }
  assert.match(rev, /הצעה בלבד/); assert.match(rev, /לא מציגים כישלון כהצלחה/);
  assert.ok(D.validStart({ questions: [{ question: 'א' }, { question: 'ב' }], roles: [{ role: 'א' }, { role: 'ב' }] }));
  assert.ok(!D.validStart({ questions: [{ question: 'א' }], roles: [] }));
});

test('a version freezes only with an explanation, a reason, linked evidence and teacher approval', () => {
  assert.deepEqual(D.canFreeze({}), ['ההסבר החדש', 'הנימוק לשינוי', 'ראיה אחת לפחות שהשינוי נשען עליה', 'אישור המורה']);
  assert.deepEqual(D.canFreeze({ text: 'א', why: 'ב', evidence: [0] }), ['אישור המורה']);
  assert.deepEqual(D.canFreeze({ text: 'א', why: 'ב', evidence: [0], approved: true }), []);
  assert.deepEqual(D.envelopeGaps([{ role: 'מכין/ת', kind: 'מעטפת' }, { role: 'מתעד/ת', kind: 'מעטפת', okReady: true }, { role: 'חוקר/ת', kind: 'חקר' }]), ['מכין/ת']);
});

test('team thinking: values, every voice, rotating roles, and feedback on the process', () => {
  assert.deepEqual(TT.STAGES.map((s) => s.t), ['האתגר שלנו', 'כל הקולות', 'שוקלים יחד', 'מה הרווחנו']);
  for (const v of ['הדדיות', 'סולידריות', 'אכפתיות', 'הוקרת הריבוי', 'הקשבה', 'פרגון', 'שמחה בהצלחת האחר', 'גאוות צוות']) assert.ok(TT.VALUES.includes(v), v);
  const kb = SRC.forAdvisor('teamthink'), plan = TT.planSystem(kb), refl = TT.reflectSystem(kb);
  for (const part of ['opening', 'moves', 'roles', 'agreements', 'ifthen']) assert.ok(plan.includes('- ' + part + ':'), part);
  for (const t of [plan, refl]) { assert.match(t, /ביקורת מתייחסת לרעיון/); assert.match(t, /לא נותנים ציון לאישיות/); }
  assert.match(refl, /בלי ציון, בלי דירוג/);
  assert.deepEqual(TT.voices([{ by: 'משתתף/ת 1' }, { by: 'משתתף/ת 1' }, { by: 'מתעד/ת' }], '6 משתתפים'), { heard: 2, of: 6 });
  assert.deepEqual(TT.rotate([{ role: 'א', who: 'דנה' }, { role: 'ב', who: 'יוסי' }, { role: 'ג', who: 'רון' }]).map((r) => r.who), ['רון', 'דנה', 'יוסי']);
  assert.equal(TT.anonymize('דנה הציעה ויוסי הסביר', ['דנה', 'יוסי']), '[משתתף/ת] הציעה ו[משתתף/ת] הסביר');
});

test('respectful feedback keeps the critique, asks for a reason when there is none, and stops on personal harm', () => {
  const f = KIT.FEEDBACK_SYSTEM;
  assert.match(f, /לא ממציאים חולשה, ראיה או יתרון/); assert.match(f, /לא הופכים התנגדות להסכמה/);
  for (const k of ['ok', 'rephrase', 'clarify', 'stop']) assert.ok(KIT.FB_KINDS[k], k);
  assert.ok(KIT.validFeedback({ kind: 'clarify', rewrite: 'אפשר להסביר?' }));
  assert.ok(KIT.validFeedback({ kind: 'stop', note: 'כדאי לדבר עם המבוגר/ת.' }));
  assert.ok(!KIT.validFeedback({ kind: 'rephrase', rewrite: '' }));
});

test('both screens: in the practice group, sys-only until approval, inviting language without long dashes', () => {
  for (const f of ['shared-dialogue-lab.html', 'team-thinking.html']) {
    assert.equal(R.groupOf(f).id, 'practice', f);
    const html = read(f);
    for (const lib of ['access-guard.js', 'open-select.js', 'ai-call.js', 'lab-kit.js', 'screens-menu.js', 'demo-hook.js', 'example-peek.js']) assert.match(html, new RegExp('lib/' + lib.replace('.', '\\.')), f + ' ' + lib);
    assert.match(html, /id="example"[^>]*>|class="btn ghost sbe-sysonly" id="example"/);
    assert.match(html, /sbe-sysonly" id="example"/);
    assert.match(read('map.html'), new RegExp("pending: true[^}]*page: '" + f.replace('.', '\\.') + "'"));
  }
  const fixed = ['shared-dialogue-lab.html', 'team-thinking.html', 'lib/dialogue-lab-ui.js', 'lib/team-thinking-ui.js', 'lib/lab-kit.js', 'lib/team-thinking-model.js', 'lib/dialogue-lab-model.js'].map(read).join('\n')
    + JSON.stringify([D.FIELDS, D.SECTIONS, D.GAIN, TT.FIELDS, TT.SECTIONS, TT.GAIN, KIT.FB_KINDS]);
  assert.deepEqual(invite.find(fixed.replace(/<svg[\s\S]*?<\/svg>/g, '')), []);
  assert.doesNotMatch(fixed.replace(/\/\/[^\n]*/g, ''), /—/);
  const access = read('../harness/lib/access.mjs');
  for (const f of ['shared-dialogue-lab.html', 'team-thinking.html']) assert.ok(!access.includes("'" + f + "'"), f + ' is not opened by any permission yet');
});
