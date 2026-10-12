import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const guard = readFileSync(new URL('../../app/lib/access-guard.js', import.meta.url), 'utf8');
function screen(home, perms = [], modules = {}, token = '') {
  const data = new Map([
    ['sbe.session.homeUrl', home], ['sbe.session.perms', JSON.stringify(perms)],
    ['sbe.session.modules', JSON.stringify(modules)], ['sbe.session.token', token]
  ]);
  const storage = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const html = { style: {}, classList: { add() {} } };
  let redirect = '';
  const ctx = {
    window: {}, sessionStorage: storage,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { documentElement: html, head: { appendChild() {} }, createElement: () => ({}) },
    location: { pathname: '/social-resilience-studies.html', search: '', replace: (url) => { redirect = url; } },
    URLSearchParams, TextDecoder, Uint8Array, atob
  };
  vm.runInNewContext(guard, ctx);
  return { allowed: html.style.display !== 'none', redirect, data };
}

test('the materials library opens only with its separate studies permission or system access', () => {
  assert.equal(screen('home.html', ['studies']).allowed, true);
  assert.equal(screen('admin.html?role=sys').allowed, true);
  for (const p of ['resilience', 'practi', 'leadership', 'academic', 'lecturer', 'studio', 'conv', 'activity', 'writer', 'nana', 'journey', 'dialogue', 'teamthink', 'fac_trainee', 'fac_parent', 'fac_youth']) {
    const state = screen('home.html', [p]);
    assert.equal(state.allowed, false, p);
    assert.equal(state.redirect, 'home.html', p);
  }
  assert.equal(screen('home.html').allowed, false, 'permission defaults closed');
  assert.equal(screen('admin.html?role=inst').allowed, false, 'institution management is not reader authorization');
  assert.equal(screen('').redirect, 'entry.html', 'the library is not public');
});

test('legacy institution entry keeps the studies module closed unless explicitly enabled', () => {
  for (const track of ['trainee', 'parent', 'youth']) {
    const home = 'system-select.html?track=' + track;
    assert.equal(screen(home, [], { studies: true }).allowed, true, track);
    assert.equal(screen(home, [], { studies: false }).allowed, false, track);
    assert.equal(screen(home, [], { academic: true, studio: true }).allowed, false, track);
  }
});

test('an expired code session loses reader access even when studies was granted', () => {
  const token = Buffer.from(JSON.stringify({ k: 'code', c: 'EXAMPLE', exp: Date.now() - 1000 })).toString('base64url') + '.signature';
  const state = screen('home.html', ['studies'], {}, token);
  assert.equal(state.allowed, false);
  assert.equal(state.redirect, 'entry.html?expired=1');
  assert.equal(state.data.has('sbe.session.token'), false);
});
