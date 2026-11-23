// תכנון שיחה מהיר יותר (23/11/2026): תוצר שנבנה מול המסך (fast) נבדק ומתוקן ב-effort בינוני, ושני הסבבים נשארים.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { customerPass } from '../lib/customer-pass.mjs';

function fake() {
  const seen = []; let n = 0;
  return { seen, async complete({ variation }) {
    seen.push(variation); n++;
    if (n % 2 === 1) return { text: JSON.stringify({ ready: false, summary: 's', issues: [{ issue: 'x', fix: 'y' }] }) };
    return { text: JSON.stringify({ edits: [{ find: 'שלום רב', replace: 'שלום לכם' }] }) };
  } };
}
test('fast: review and fix use the fast variation; default stays low; two rounds kept', async () => {
  const a = fake();
  await customerPass(a, { messages: [{ role: 'user', content: 'בקשה' }], text: 'שלום רב לכולם, זה התדריך', fast: true });
  assert.ok(a.seen.length >= 3 && a.seen.every((v) => v === 'fast'));
  const b = fake();
  await customerPass(b, { messages: [{ role: 'user', content: 'בקשה' }], text: 'שלום רב לכולם, זה התדריך' });
  assert.ok(b.seen.every((v) => v === 'low'));
});
test('conversation planner sends fast:true with every model call', () => {
  const s = readFileSync(new URL('../../app/conversation-planner.html', import.meta.url), 'utf8');
  assert.match(s, /customerReview: !!review, fast: true/);
});
