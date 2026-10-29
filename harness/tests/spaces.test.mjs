// ארבעה מרחבים (28/10/2026): כל דף שנפתח בהרשאה שייך למרחב אחד, ומי שבמרחב אחד לא רואה את הכלים של המרחב השני.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const S = createRequire(import.meta.url)('../../app/lib/spaces.js');

test('every page that a permission opens belongs to exactly one space', () => {
  const guard = readFileSync(new URL('../../app/lib/access-guard.js', import.meta.url), 'utf8');
  const block = guard.slice(guard.indexOf('var PAGES_BY_PERM'), guard.indexOf('var SIM_DOCS'));
  const pages = [...new Set([...block.matchAll(/"([a-z0-9-]+\.html)"/g)].map((m) => m[1]))];
  assert.ok(pages.length > 30);
  for (const p of pages) assert.ok(S.spaceOf(p), p + ' has no space');
  const all = Object.values(S.PAGES).flat();
  assert.equal(all.length, new Set(all).size, 'a page is listed in two spaces');
});

test('a work space shows its own tools and the shared ones, never the other space', () => {
  assert.ok(S.visibleIn('org', 'hl-voice.html'));
  assert.ok(S.visibleIn('edu', 'hl-voice.html'));
  assert.ok(S.visibleIn('edu', 'practice.html'));
  assert.equal(S.visibleIn('org', 'practice.html'), false);
  assert.equal(S.visibleIn('edu', 'examples-org.html'), false);
  assert.ok(S.visibleIn('org', 'examples-org.html'));
});

test('the tagline exists in three languages, and the coming-to-org list names real pages', () => {
  assert.deepEqual(Object.keys(S.TAGLINE).sort(), ['ar', 'en', 'he']);
  for (const c of S.COMING_TO_ORG) assert.equal(S.spaceOf(c.page), 'edu', c.page);
});

// נוגי, מרכז השגרות ותיק הרציפות זמינים גם במרחב הארגוני (29/10/2026, "לבצע")
import { SHARED_PERMS, MOVED_PERMS, spaceFromPerms } from '../lib/access.mjs';
const R = createRequire(import.meta.url);
const ORGW = R('../../app/lib/org-words.js');
const MOVED = ['leadership-advisor.html', 'routines-hub.html', 'continuity-kit.html'];

test('Nugi, the routines hub and the continuity kit are shared by both spaces', () => {
  for (const p of MOVED) {
    assert.equal(S.spaceOf(p), 'shared', p);
    assert.ok(S.visibleIn('org', p) && S.visibleIn('edu', p), p);
    assert.ok(!S.COMING_TO_ORG.some((c) => c.page === p), p + ' is still waiting for the org space');
  }
  for (const perm of ['leadership', 'routines', 'continuity']) assert.ok(SHARED_PERMS.includes(perm) && MOVED_PERMS.includes(perm), perm);
  // בלי סימון של המוסד: קודים קיימים של בתי ספר נשארים חינוכיים; עם כלי ארגוני, ארגוני
  assert.equal(spaceFromPerms(['leadership']), 'edu');
  assert.equal(spaceFromPerms(['routines', 'horizon']), 'edu');
  assert.equal(spaceFromPerms(['continuity', 'orgsuite']), 'org');
  assert.equal(spaceFromPerms(['horizon', 'journey']), 'org');
  assert.equal(spaceFromPerms(['leadership', 'resilience']), 'edu');
  // הדפדפן גוזר את המרחב באותה דרך
  const guard = readFileSync(new URL('../../app/lib/access-guard.js', import.meta.url), 'utf8');
  assert.match(guard, /MOVED_PERMS = \["leadership", "routines", "continuity"\]/);
});

test('in the org space the three tools show no school words in fixed text', () => {
  const routines = R('../../app/lib/routines-model.js').forSpace('org');
  const cont = R('../../app/lib/continuity-model.js').forSpace('org');
  const fixed = JSON.stringify([routines.FIELDS, routines.SECTIONS, routines.AGREEMENT_ROWS, routines.ROLE_ROWS, routines.MECH_TYPES,
    cont.ROLES, cont.FIELDS, cont.EMERG_FIELDS, cont.SECTIONS, cont.JOIN_FIELDS, cont.LETTER_FIELDS, cont.DEFAULT_READINESS, cont.TEAM_QUESTIONS]);
  assert.equal(ORGW.SCHOOL.test(fixed), false, (fixed.match(new RegExp('.{0,30}(' + ORGW.SCHOOL.source + ').{0,30}')) || [])[0]);
  // ההנחיות למודל: בלי מילים של בית ספר, מלבד שורת ההקשר שמסבירה את ההחלפה
  const prompts = [routines.optionsSystem([]), routines.planSystem([], ''), routines.reviseSystem([], ''),
    cont.system([], ''), cont.emergSystem([], ''), cont.reviseSystem([], ''), cont.joinSystem([], '')]
    .map((s) => s.split('\n').filter((l) => !/^המרחב הארגוני:/.test(l)).join('\n')).join('\n');
  assert.equal(ORGW.SCHOOL.test(prompts), false, (prompts.match(new RegExp('.{0,40}(' + ORGW.SCHOOL.source + ').{0,40}')) || [])[0]);
  // החינוכי לא השתנה
  const edu = R('../../app/lib/routines-model.js');
  assert.equal(edu.forSpace('edu'), edu);
  assert.ok(edu.MECH_TYPES.includes('מועצת כיתה') && !routines.MECH_TYPES.includes('מועצת כיתה'));
  assert.ok(routines.MECH_TYPES.includes('צוות חירום שכונתי'));
  assert.equal(cont.fillLetter('שלום [שם המחליף/ה]', { sub: 'דנה' }), 'שלום דנה');
  const proc = R('../../app/lib/tools-procedure.js');
  assert.equal(ORGW.SCHOOL.test(proc.system('continuity', 'org') + proc.reviseSystem('routines', 'org')), false);
  assert.ok(/בית הספר/.test(proc.system('continuity', 'edu')));
});

test('the demo lab has org recipes for the three tools', () => {
  const lab = readFileSync(new URL('../../app/demo-lab.html', import.meta.url), 'utf8');
  for (const id of ['nugi-org', 'continuity-org', 'cont-join-org', 'cont-proc-org', 'routines-org', 'routines-proc-org'])
    assert.match(lab, new RegExp("\\['" + id + "','[a-z-]+\\.html\\?[^']*space=org"), id);
});
