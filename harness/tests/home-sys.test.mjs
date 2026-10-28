// מנהלת המערכת רואה את כל הכלים במרחב שלי (23/10/2026: "כשאני נכנסת כמנהלת הכל צריך להיות פתוח").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('home.html: has() פותח הכול למנהלת המערכת', () => {
  const s = readFileSync(new URL('../../app/home.html', import.meta.url), 'utf8');
  assert.match(s, /const IS_SYS = ss\("sbe\.session\.homeUrl"\) === "admin\.html\?role=sys"/);
  assert.match(s, /const has = \(p\) => IS_SYS \?/);
  for (const p of ['continuity-kit.html', 'routines-hub.html', 'family-bridge.html']) assert.ok(s.includes(`"${p}"`), p);
});
