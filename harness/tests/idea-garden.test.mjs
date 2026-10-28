// גן הרעיונות עם גני (26/10/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const G = require('../../app/lib/idea-garden.js');
const app = (f) => new URL('../../app/' + f, import.meta.url);

test('חמש קבוצות גיל, חמישה שלבים, ותגובות למשוב', () => {
  assert.deepEqual(G.AGES.map((a) => a[0]), ['k', 'a3', 'd5', 'sec', 'pro']);
  assert.deepEqual(G.STAGES.map((s) => s.id), ['seed', 'sprout', 'guard', 'grow', 'fruit']);
  for (const m of ['all', 'some', 'part', 'no', 'think', 'consult', 'try']) assert.ok(G.MOVES.some((x) => x[0] === m), m);
  for (const s of ['strengths', 'risks', 'improve', 'think', 'notice']) assert.ok(G.feedbackSystem('k').includes(s), s);
});

test('גני: הרעיון הוא לא האדם, מסגור, בדיקת פגיעה, והתייעצות בלי אנשי טיפול', () => {
  const s = G.feedbackSystem('pro');
  assert.match(s, /הרעיון הוא לא האדם/);
  assert.match(s, /מתחיל במסגור/);
  assert.match(s, /עלול לפגוע/);
  assert.match(s, /לא אנשי טיפול/);
  assert.match(G.summarySystem('d5'), /לא יותר מדי/);
  assert.match(G.chatSystem('a3'), /עד 50 מילים/);
});

test('ניקוי הציור: בלי סקריפט, טקסט, תמונה או קישור חיצוני', () => {
  const dirty = '<svg viewBox="0 0 10 10" onload="x()"><script>alert(1)</script><rect x="1" y="1" width="5" height="5" fill="red" onclick="y()"/><text>hi</text><image href="http://x"/><circle cx="3" cy="3" r="2" fill="url(http://evil)"/><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><path d="M0 0L5 5" fill="url(#g)"/></svg>';
  const c = G.cleanSvg(dirty);
  assert.ok(c.startsWith('<svg viewBox="0 0 240 200"'));
  for (const bad of ['script', 'onload', 'onclick', '<text', '<image', 'http://evil', 'alert']) assert.ok(!c.includes(bad), bad);
  assert.ok(c.includes('<rect') && c.includes('url(#g)') && c.includes('<linearGradient'));
  assert.equal(G.cleanSvg('לא ציור'), '');
  assert.equal(G.cleanSvg('<svg><text>רק טקסט</text></svg>'), '');
});

test('משוב וסיכום: בדיקה ונרמול', () => {
  assert.equal(G.validFeedback({ strengths: [] }), false);
  const f = G.normFeedback({ frame: 'מסגור', strengths: ['א', '', 'ב'], risks: 'לא מערך', consult: ['מורה', { who: 'נגרית', why: 'עץ' }], picture: { svg: '<svg><circle r="3"/></svg>' } });
  assert.deepEqual(f.strengths, ['א', 'ב']);
  assert.deepEqual(f.risks, []);
  assert.equal(f.consult[0].who, 'מורה');
  assert.ok(f.picture.svg.includes('<circle'));
  assert.equal(G.validSummary({ frame: 'x', product: {}, path: {} }), true);
});

test('חיזוקים לדרך: מתייעצים בלי להגזים, מנסים, גמישים', () => {
  const I = { end: 'go', pics: [{}, {}, {}], log: [{ t: 'chat', stage: 'seed' }, { t: 'consult', stage: 'seed', who: 'אמא' }, { t: 'move', stage: 'seed', move: 'all' }, { t: 'move', stage: 'sprout', move: 'part' }, { t: 'decide', stage: 'seed', d: 'next' }, { t: 'decide', stage: 'sprout', d: 'improve' }] };
  const b = G.badges(I).map((x) => x[1]);
  for (const t of ['מתייעצים בחוכמה', 'שאלו גם אנשים', 'מנסים אפשרויות חדשות', 'גמישים עם משוב', 'יוצאים לדרך']) assert.ok(b.includes(t), t);
  const many = { log: Array.from({ length: 12 }, () => ({ t: 'chat', stage: 'seed' })).concat([{ t: 'decide', stage: 'seed', d: 'next' }]), pics: [] };
  assert.ok(G.badges(many).some((x) => x[1] === 'אוהבים להתייעץ'));
});

test('מה נשלח לגני: הרעיון, המשוב, הדרך והציור הקודם', () => {
  const I = { name: 'פינת הגשם', stages: { seed: { source: 'need', what: 'פינה מתקפלת', lookKind: 'image', look: 'עקשנית כמו פרד' }, sprout: { pros: [{ text: 'כולם משחקים', whom: 'group', w: 3 }], cons: [{ text: 'רעש', w: 2, fix: 'yes' }] }, guard: { items: [{ id: 'people', on: true, how: 'נתקלים', protect: 'פס צהוב' }] }, grow: { first: 'שבוע ניסיון' } }, pics: [{ svg: '<svg/>' }], log: [{ t: 'move', stage: 'seed', move: 'part', note: 'המקום' }] };
  const t = G.feedbackInput(I, 'guard');
  for (const s of ['פינת הגשם', 'דימוי', 'לכיתה או לקבוצה', 'אפשר לתקן', 'פס צהוב', 'שבוע ניסיון', 'מתנגדים לחלק ממנו', 'הציור הקודם']) assert.ok(t.includes(s), s);
});

test('הדף, ההרשאה והחיבור', () => {
  const page = readFileSync(app('idea-garden.html'), 'utf8');
  for (const s of ['lib/access-guard.js', 'lib/ai-call.js', 'lib/idea-garden.js', 'begood-logo', 'sbeCallAIJson', 'sbeUserKey', '@page{size:A4;margin:24mm 24mm']) assert.ok(page.includes(s), s);
  for (const bad of [/צריך|חייב|חובה|אסור/, / — /]) assert.doesNotMatch(page.replace(/<script>[\s\S]*?window\.sbeIdeaDemo[\s\S]*?$/, ''), bad);
  assert.match(readFileSync(app('lib/access-guard.js'), 'utf8'), /"idea-garden\.html"/);
  assert.match(readFileSync(new URL('../lib/access.mjs', import.meta.url), 'utf8'), /'idea-garden\.html': \['games'\]/);
  assert.match(readFileSync(app('games.html'), 'utf8'), /href="idea-garden\.html"/);
});
