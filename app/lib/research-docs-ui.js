// מרכז המחקר: "מסמכי המחקר" (24/11/2026: "העלה גם את הצעת המחקר"; "עינת צריכה לראותם גם").
// רשימת מסמכים לכל מחקר: מי שרואה את המחקר ויש לו/ה גישה לתוכן מסמכים מוריד/ה; בעלת המערכת וצוות עם עריכה מעלים ומוחקים.
// השרת: harness/lib/research-docs.mjs (/api/research-docs).
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SBE_RDOCS_UI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const TYPES = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  const MAX = 8 * 1024 * 1024;
  const ERR = { unauthorized: 'אין הרשאה לפעולה הזו במחקר הזה.', invalid: 'הקובץ לא התקבל. אפשר להעלות PDF, Word, PowerPoint, Excel, טקסט או תמונה, עד כ־8 מגה.', too_many: 'יש כבר הרבה מסמכים במחקר. אפשר למחוק מסמך ישן ולנסות שוב.', not_found: 'המסמך לא נמצא.', too_large: 'הקובץ גדול מדי (עד כ־8 מגה).' };
  const endpoint = () => (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) ? '/api/research-docs' : 'https://sbe-server.onrender.com/api/research-docs';
  const token = () => { try { return sessionStorage.getItem('sbe.session.token') || ''; } catch (_) { return ''; } };
  async function call(op, input) {
    try {
      const r = await fetch(endpoint(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, input, token: token() }) });
      const d = await r.json().catch(() => ({}));
      return r.ok ? d : { error: ERR[d.error] || 'הפעולה לא הושלמה. אפשר לנסות שוב בעוד רגע.' };
    } catch (_) { return { error: 'אין כרגע חיבור לשרת. אפשר לנסות שוב בעוד רגע.' }; }
  }
  const dateIL = (iso) => { try { return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }).replace(/\//g, '.'); } catch (_) { return ''; } };
  const size = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' מגה' : Math.max(1, Math.round(n / 1024)) + ' ק״ב';
  const el = (tag, attrs, text) => { const n = document.createElement(tag); for (const k in attrs || {}) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = text; return n; };
  const toB64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };

  function view(box, ctx) {
    const studyId = ctx.study && ctx.study.id;
    const say = (t) => (ctx.message ? ctx.message(t) : alert(t));
    box.append(el('p', { class: 'r-muted' }, 'מסמכי המחקר נשמרים כאן לכל צוות המחקר: הצעת המחקר, נוסחי השאלונים, אישורים ומסמכים נוספים. בלי פרטים מזהים של משתתפים.'));
    const up = el('div', { class: 'r-card' }); const list = el('div');
    box.append(up, list);
    async function load() {
      list.textContent = 'טוענים...';
      const d = await call('list', { studyId });
      list.textContent = '';
      if (d.error) { list.append(el('p', { class: 'r-muted' }, d.error)); return; }
      up.hidden = !d.canEdit;
      if (!d.docs.length) { list.append(el('p', { class: 'r-muted' }, 'עדיין אין מסמכים במחקר הזה.')); return; }
      const t = el('table', { class: 'r-table' }); const hr = el('tr');
      ['המסמך', 'הערה', 'הועלה', 'גודל', ''].forEach((h) => hr.append(el('th', {}, h)));
      t.append(el('thead')).append(hr); const tb = el('tbody'); t.append(tb);
      for (const doc of d.docs) {
        const tr = el('tr');
        tr.append(el('td', {}, doc.title), el('td', {}, doc.note || ''), el('td', {}, dateIL(doc.addedAt)), el('td', {}, size(doc.size)));
        const act = el('td');
        const dl = el('button', { type: 'button', class: 'linkbtn' }, 'הורדה');
        dl.onclick = async () => {
          dl.disabled = true; const r = await call('get', { studyId, id: doc.id }); dl.disabled = false;
          if (r.error) return say(r.error);
          const bin = atob(r.contentBase64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          const a = el('a', { href: URL.createObjectURL(new Blob([arr], { type: doc.mediaType })), download: doc.name }); document.body.append(a); a.click(); a.remove();
        };
        act.append(dl);
        if (d.canEdit) {
          const del = el('button', { type: 'button', class: 'linkbtn danger' }, 'מחיקה');
          del.onclick = async () => {
            if (!confirm('למחוק את "' + doc.title + '" ממסמכי המחקר? אי אפשר לשחזר.')) return;
            const r = await call('del', { studyId, id: doc.id }); if (r.error) return say(r.error); load();
          };
          act.append(' · ', del);
        }
        tr.append(act); tb.append(tr);
      }
      list.append(t);
    }
    // העלאה
    up.append(el('h3', {}, 'הוספת מסמך'));
    const file = el('input', { type: 'file', accept: '.pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg', 'aria-label': 'קובץ' });
    const title = el('input', { type: 'text', placeholder: 'למשל: הצעת המחקר, נוסח 24.11.26', 'aria-label': 'שם המסמך' });
    const note = el('input', { type: 'text', placeholder: 'הערה (רשות)', 'aria-label': 'הערה' });
    const go = el('button', { type: 'button' }, 'העלאה');
    file.onchange = () => { if (file.files[0] && !title.value) title.value = file.files[0].name.replace(/\.[^.]+$/, ''); };
    go.onclick = async () => {
      const f = file.files[0]; if (!f) return say('כדי להעלות, בחר.י קובץ.');
      const ext = f.name.split('.').pop().toLowerCase();
      if (!TYPES[ext]) return say(ERR.invalid); if (f.size > MAX) return say(ERR.too_large);
      go.disabled = true; go.textContent = 'מעלים...';
      const r = await call('put', { studyId, filename: f.name, mediaType: TYPES[ext], title: title.value, note: note.value, contentBase64: toB64(await f.arrayBuffer()) });
      go.disabled = false; go.textContent = 'העלאה';
      if (r.error) return say(r.error);
      file.value = ''; title.value = ''; note.value = ''; load();
    };
    up.append(el('label', {}, 'הקובץ'), file, el('label', {}, 'שם המסמך'), title, el('label', {}, 'הערה'), note, go);
    load();
  }
  return { view, call, TYPES };
});
