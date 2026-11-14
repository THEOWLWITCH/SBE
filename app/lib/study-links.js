// כפתורי השאלונים של מחקר השיחות המאתגרות, בתוך הכלים.
// מופיעים רק למי שהצטרף/ה למחקר פעיל שיש בו נקודות המדידה האלה (begood-study.js).
// לפי הפרוטוקול: שאלון הפתיחה לפני העבודה בכלי, שאלוני מפגש 2 ו-3 אחרי התרגול והמשוב.
// לא שולח שום מידע מהכלי. רק בודק בשרת המחקר אם יש שאלון פתוח, ומקשר אליו.
(function (root) {
  'use strict';
  const BG = root.SBE_BGSTUDY;
  const endpoint = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? '/api/research' : 'https://sbe-server.onrender.com/api/research';
  const token = () => { try { return sessionStorage.getItem('sbe.session.token') || ''; } catch (_) { return ''; } };
  let cache = null;

  async function call(action, payload) {
    const res = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, payload, { action, token: token() })), cache: 'no-store', credentials: 'omit' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error('research');
    return data;
  }

  // כל המחקרים שהמשתמש/ת רשום/ה אליהם ומאומת/ת בהם, עם נקודות המדידה של המחקר הזה.
  async function load() {
    if (cache) return cache;
    cache = (async () => {
      if (!BG || !token()) return [];
      const ids = new Set(BG.WAVES.map(w => w.waveId));
      // מי שלא משתתף/ת במחקר: בדיקה אחת לרבע שעה, כדי לא להעמיס על השרת.
      const NONE = 'sbe.study.none', t = token().slice(-12);
      try { const n = JSON.parse(sessionStorage.getItem(NONE) || 'null'); if (n && n.t === t && Date.now() - n.at < 15 * 60 * 1000) return []; } catch (_) {}
      const mine = await call('myStudies', {});
      if (!(mine.participations || []).length) { try { sessionStorage.setItem(NONE, JSON.stringify({ t, at: Date.now() })); } catch (_) {} return []; }
      const out = [];
      for (const p of mine.participations || []) {
        try {
          const d = await call('participationGet', { studyId: p.studyId });
          const part = d.participation || {};
          if (part.status !== 'enrolled' || part.verified !== true || part.consents?.surveys !== true) continue;
          if (part.consentVersionId && d.consent?.id && part.consentVersionId !== d.consent.id) continue;
          if (d.study?.status && d.study.status !== 'active') continue;
          const done = new Set((d.responses || []).map(r => r.waveId));
          for (const w of d.study?.schedule || []) if (ids.has(w.waveId)) out.push({ studyId: d.study.id, waveId: w.waveId, done: done.has(w.waveId) });
        } catch (_) { /* מחקר אחד שלא נטען לא עוצר את השאר */ }
      }
      return out;
    })().catch(() => []);
    return cache;
  }

  const CSS = '.sbe-study{margin:14px 0;padding:12px 14px;border:1px solid var(--hair,#d9dde0);border-top:2px solid #2a9d8f;border-radius:12px;background:#fff}' +
    '.sbe-study b{display:block;margin-bottom:4px}.sbe-study p{margin:0 0 8px;font-size:.92rem}' +
    '.sbe-study .row{display:flex;flex-wrap:wrap;gap:8px}.sbe-study a{display:inline-block;padding:7px 14px;border-radius:999px;border:1px solid #1d3f63;color:#1d3f63;text-decoration:none;font-weight:600}' +
    '.sbe-study a.go{background:#1d3f63;color:#fff}.sbe-study a.done{border-color:#9aa5ae;color:#55606a}@media print{.sbe-study{display:none}}';

  function style() {
    if (document.getElementById('sbeStudyCss')) return;
    const s = document.createElement('style'); s.id = 'sbeStudyCss'; s.textContent = CSS; document.head.append(s);
  }

  function back() { const m = location.pathname.match(/([a-z0-9-]+\.html)$/); return m ? m[1] : ''; }

  // el: המקום בדף. place: before | after. tool: מפתח ב-SBE_BGSTUDY.PLACES.
  async function mount(el, opts) {
    if (!el || !BG) return;
    const want = (BG.PLACES[opts.tool] || {})[opts.place] || [];
    if (!want.length) return;
    const rows = (await load()).filter(r => want.includes(r.waveId));
    el.replaceChildren();
    if (!rows.length) { el.hidden = true; return; }
    style();
    const box = document.createElement('div'); box.className = 'sbe-study';
    const b = document.createElement('b'); b.textContent = opts.place === 'before' ? '📋 שאלון המחקר, לפני שמתחילים' : '📋 שאלון המחקר, אחרי התרגול';
    const p = document.createElement('p'); p.textContent = opts.place === 'before'
      ? 'במחקר שהצטרפת אליו, השאלון הזה ממולא לפני התכנון והתרגול. המענה לוקח כמה דקות, ואחריו חוזרים לכאן.'
      : 'במחקר שהצטרפת אליו, השאלון ממולא בסוף המפגש. אפשר לבחור את השאלון של המפגש הנוכחי.';
    const row = document.createElement('div'); row.className = 'row';
    for (const r of rows) {
      const a = document.createElement('a');
      const q = new URLSearchParams({ study: r.studyId, wave: r.waveId }); const bk = back(); if (bk) q.set('back', bk);
      a.href = 'research-participation.html?' + q.toString();
      a.textContent = (r.done ? '✓ ' : '') + BG.waveLabel(r.waveId) + (r.done ? ' · נשמר' : '');
      a.className = r.done ? 'done' : (rows.filter(x => !x.done)[0] === r ? 'go' : '');
      row.append(a);
    }
    box.append(b, p, row); el.append(box); el.hidden = false;
  }

  function auto() {
    for (const el of document.querySelectorAll('[data-study-place]')) mount(el, { tool: el.dataset.studyTool, place: el.dataset.studyPlace });
  }

  root.SBE_STUDYLINK = Object.freeze({ mount, load, refresh: () => { cache = null; auto(); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})(typeof self !== 'undefined' ? self : this);
