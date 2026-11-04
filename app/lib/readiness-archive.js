// ארכיון הפרוטוקולים של מערך המוכנות, בתוך תיק הרציפות (04/11/2026: "חשוב שיהיה ארכיון של הפרוטוקולים בתיק הרציפות...
// וגם ניתן יהיה להכנס לטבלת המשימות/החלטות מתיק הרציפות"). הנתונים נשארים במערך המוכנות (שרת, תחת המוסד);
// כאן רק קוראים ומציגים, למי שיש לו/ה גם את מערך המוכנות. בלי התמליל: רק מה שהועבר בכפתור "העברת הפרוטוקול לתיק הרציפות".
(function () {
  'use strict';
  const box = document.getElementById('rdyArchive');
  if (!box) return;
  const ss = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const TOKEN = ss('sbe.session.token');
  let perms = []; try { perms = JSON.parse(ss('sbe.session.perms') || '[]'); } catch (e) {}
  const SYS = ss('sbe.session.homeUrl') === 'admin.html?role=sys';
  if (!TOKEN || !(SYS || perms.includes('readiness'))) return;
  const SERVER = (typeof window.sbeAIOrigin === 'function' && window.sbeAIOrigin()) || 'https://sbe-server.onrender.com';
  const W = (t) => (window.SBE_ORGW && window.SBE_ORGW.isOrg && window.SBE_ORGW.isOrg() && window.SBE_ORGW.swap ? window.SBE_ORGW.swap(t) : t);
  const dateIL = (iso) => (window.sbeDateIL ? window.sbeDateIL(String(iso || '').slice(0, 10)) : String(iso || '').slice(0, 10));
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v); }
    for (const c of kids.flat()) if (c != null && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return el;
  }
  const tbl = (cols, rows) => h('table', { class: 'rtable' }, h('thead', {}, h('tr', {}, cols.map((c) => h('th', { text: c })))), h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', { text: c == null ? '' : String(c) }))))));
  const KIND = { said: '', decision: 'החלטה', task: 'משימה', end: 'קצה פתוח' };
  function body(a) {
    return h('div', {},
      a.attendees && a.attendees.length ? h('p', {}, h('b', { text: 'משתתפים: ' }), a.attendees.map((x) => x.name + (x.role ? ' (' + x.role + ')' : '')).join(' · ')) : null,
      a.proto && a.proto.length ? tbl(['דובר/ת', 'מה זה', 'עיקרי הדברים'], a.proto.map((x) => [x.who, KIND[x.kind] || '', x.what])) : null,
      a.decisions && a.decisions.length ? tbl(['החלטות'], a.decisions.map((x) => [x])) : null,
      a.tasks && a.tasks.length ? tbl(['משימות', 'אחראי/ת', 'עד מתי'], a.tasks.map((x) => [x[0], x[1], dateIL(x[2])])) : null,
      a.ends && a.ends.length ? tbl(['קצוות פתוחים', 'אחראי/ת'], a.ends) : null,
      a.next ? h('p', {}, h('b', { text: 'המפגש הבא: ' }), dateIL(a.next)) : null);
  }
  async function api(action, extra) {
    const res = await fetch(SERVER + '/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action, token: TOKEN }, extra || {})) });
    return [res.status, await res.json().catch(() => ({}))];
  }
  (async () => {
    try {
      const [s1, mine] = await api('rdyMine');
      if (s1 !== 200 || !mine.items || !mine.items.length) return;
      const [s2, got] = await api('rdyGet', { id: mine.items[0].id });
      if (s2 !== 200 || !got.doc) return;
      const p = got.doc.parts || {}, list = [];
      const ses = p.sessions && typeof p.sessions === 'object' ? p.sessions : {};
      for (const n of Object.keys(ses)) if (ses[n] && ses[n].archive) list.push(ses[n].archive);
      for (const m of Array.isArray(p.meetings) ? p.meetings : []) if (m && m.archive) list.push(m.archive);
      list.sort((a, b) => String(b.date || b.at).localeCompare(String(a.date || a.at)));
      const go = (q) => 'readiness.html?id=' + encodeURIComponent(got.doc.id) + '&' + q;
      const card = h('section', { class: 'card no-print', id: 'archive' },
        h('h2', { text: '🗂 ' + W('ארכיון הפרוטוקולים ממערך המוכנות') }),
        h('p', { class: 'links' }, h('a', { href: go('view=track&sheet=tasks'), text: 'משימות' }), ' · ', h('a', { href: go('view=track&sheet=decisions'), text: 'החלטות' }), ' · ',
          h('a', { href: go('view=track&sheet=ends'), text: 'קצוות פתוחים' }), ' · ', h('a', { href: go('print=binder'), text: '🖨 ' + W('תיקיית הרציפות להדפסה') })),
        list.length ? list.map((a) => h('details', { class: 'arch' }, h('summary', { text: a.title + (a.date ? ' · ' + dateIL(a.date) : '') }), body(a),
          h('p', {}, h('a', { href: '#', text: '🖨 הדפסת הפרוטוקול', onclick: (e) => { e.preventDefault(); if (window.SBE_DOC) window.SBE_DOC.print({ title: a.title, kind: 'פרוטוקול', node: body(a) }); else window.print(); } })))) :
          h('p', { class: 'muted', text: W('עוד אין פרוטוקולים בארכיון. בסוף כל מפגש במערך המוכנות: "העברת הפרוטוקול לתיק הרציפות".') }));
      box.replaceChildren(card);
      if (location.hash === '#archive') card.scrollIntoView();
    } catch (e) { /* בלי חיבור: התיק עובד כרגיל, בלי הארכיון */ }
  })();
})();
