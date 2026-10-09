import test from 'node:test';
import assert from 'node:assert/strict';
import { customerPass, reviewEnabled } from '../lib/customer-pass.mjs';

const fake = (answers) => { const calls = []; return { calls, complete: async (o) => { calls.push(o); const a = answers.shift(); if (a instanceof Error) throw a; return { text: a }; } }; };
const issue = { where: 'סיכום', quote: 'שאלות לעיבוד', problem: 'לא ברור מי שואל ומתי', fix: 'שאלות לסיכום: המנחה שואלת את הקבוצה' };

test('only product calls are reviewed, and CUSTOMER_REVIEW=off turns it off', () => {
  assert.equal(reviewEnabled({ customerReview: true }), true);
  assert.equal(reviewEnabled({}), false);
  process.env.CUSTOMER_REVIEW = 'off'; assert.equal(reviewEnabled({ customerReview: true }), false); delete process.env.CUSTOMER_REVIEW;
});

test('a clear product passes through unchanged after one review call', async () => {
  const p = fake([JSON.stringify({ ready: true, summary: 'ברור', issues: [] })]);
  const out = await customerPass(p, { system: 'S', messages: [{ role: 'user', content: 'בקשה' }], maxTokens: 8000, text: '{"title":"א"}' });
  assert.equal(out.text, '{"title":"א"}'); assert.equal(out.review.revised, false); assert.equal(p.calls.length, 1);
  assert.match(p.calls[0].system, /את הלקוחה של Begood/); assert.match(p.calls[0].messages[0].content, /בקשה/);
  assert.match(p.calls[0].messages[0].content, /שמות השדות הם הכותרות/);
});

test('an unclear product is fixed once, in the same JSON shape', async () => {
  const p = fake([JSON.stringify({ ready: false, summary: 'לא ברור', issues: [issue] }), 'הנה: {"title":"ב","flow":[]}']);
  const out = await customerPass(p, { system: 'S', messages: [{ role: 'user', content: 'בקשה' }], maxTokens: 8000, text: '{"title":"א","flow":[]}' });
  assert.equal(out.review.revised, true); assert.match(out.text, /"title":"ב"/); assert.equal(p.calls.length, 2);
  assert.equal(p.calls[1].system, 'S'); assert.equal(p.calls[1].maxTokens, 8000);
  const last = p.calls[1].messages.at(-1).content; assert.match(last, /הלקוחה קראה את הגרסה הקודמת/); assert.match(last, /JSON תקין/);
  assert.equal(p.calls[1].messages.at(-2).role, 'assistant');
});

test('a broken fix (missing fields, empty, error) keeps the original; a failing review never blocks the product', async () => {
  const orig = '{"title":"א","flow":[]}';
  for (const second of ['{"title":"ב"}', '', new Error('x')]) {
    const out = await customerPass(fake([JSON.stringify({ ready: false, summary: '', issues: [issue] }), second]), { system: 'S', messages: [], maxTokens: 100, text: orig });
    assert.equal(out.text, orig); assert.equal(out.review.revised, false);
  }
  for (const first of [new Error('down'), 'לא JSON']) {
    const out = await customerPass(fake([first]), { system: 'S', messages: [], text: 'טקסט רגיל' });
    assert.equal(out.text, 'טקסט רגיל'); assert.equal(out.review, null);
  }
});

test('plain-text products are revised as text', async () => {
  const p = fake([JSON.stringify({ ready: false, summary: '', issues: [issue] }), 'הודעה מתוקנת']);
  const out = await customerPass(p, { system: 'S', messages: [{ role: 'user', content: [{ type: 'text', text: 'כתבי הודעה' }, { type: 'image' }] }], text: 'הודעה' });
  assert.equal(out.text, 'הודעה מתוקנת'); assert.match(p.calls[0].messages[0].content, /כתבי הודעה/); assert.match(p.calls[1].messages.at(-1).content, /בלי הקדמה/);
});
