// ארכיון הפרוטוקולים של מערך המוכנות, בתוך תיק הרציפות (04/11/2026: "חשוב שיהיה ארכיון של הפרוטוקולים בתיק הרציפות...
// וגם ניתן יהיה להכנס לטבלת המשימות/החלטות מתיק הרציפות"). הנתונים נשארים במערך המוכנות (שרת, תחת המוסד);
// כאן רק קוראים ומציגים, למי שיש לו/ה גם את מערך המוכנות. בלי התמליל: רק מה שהועבר בכפתור "העברת הפרוטוקול לתיק הרציפות".
// תיקיית הרציפות (04/11/2026: "הוסף אפשרות להוסיף לרשימה. הוסף אפשרות להעלות את הקובץ למערכת לתיק הרציפות. לוודא שייתנו שם ברור
// ותאריך עדכון. כל קובץ חדש שמועלה גורס גירסה קודמת"): לכל פריט קובץ אחד עם שם ותאריך עדכון; קובץ חדש מחליף את הקודם.
// פריט עם פרטים של תלמידים, הורים או אנשי צוות (BINDER_SENS, או "רגיש" בפריט שנוסף) לא עולה: כותבים איפה הוא נשמר ומתי עודכן.
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
  const ORG = !!(window.SBE_ORGW && window.SBE_ORGW.isOrg && window.SBE_ORGW.isOrg());
  const W = (t) => (ORG && window.SBE_ORGW.swap ? window.SBE_ORGW.swap(t) : t);
  const dateIL = (iso) => (window.sbeDateIL ? window.sbeDateIL(String(iso || '').slice(0, 10)) : String(iso || '').slice(0, 10));
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const by = () => { try { return JSON.parse(localStorage.getItem('sbe.prep.by') || '""') || ''; } catch (e) { return ''; } };
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v); }
    for (const c of kids.flat()) if (c != null && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return el;
  }
  const lnk = (text, on, cls) => h('a', { href: '#', class: cls || null, text, onclick: (e) => { e.preventDefault(); on(e); } });
  const tbl = (cols, rows) => h('table', { class: 'rtable' }, h('thead', {}, h('tr', {}, cols.map((c) => h('th', { text: c })))), h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', { text: c == null ? '' : String(c) }))))));
  const KIND = { said: '', decision: 'החלטה', task: 'משימה', end: 'קצה פתוח' };
  function body(a) {
    return h('div', {},
      a.attendees && a.attendees.length ? h('p', {}, h('b', { text: 'משתתפים: ' }), a.attendees.map((x) => x.name + (x.role ? ' (' + x.role + ')' : '')).join(' · ')) : null,
      a.reports && a.reports.length ? tbl(['הצוות', 'מצב', 'מה עשינו', 'מה עובד', 'פער', 'מה חסר לנו, וממי', 'הצעד הבא'], a.reports) : null,
      a.proto && a.proto.length ? tbl(['דובר/ת', 'מה זה', 'עיקרי הדברים'], a.proto.map((x) => [x.who, KIND[x.kind] || '', x.what])) : null,
      a.decisions && a.decisions.length ? tbl(['החלטות'], a.decisions.map((x) => [x])) : null,
      a.tasks && a.tasks.length ? tbl(['משימות', 'אחראי/ת', 'עד מתי'], a.tasks.map((x) => [x[0], x[1], dateIL(x[2])])) : null,
      a.ends && a.ends.length ? tbl(['קצוות פתוחים', 'אחראי/ת'], a.ends) : null,
      a.next ? h('p', {}, h('b', { text: 'המפגש הבא: ' }), dateIL(a.next)) : null);
  }
  async function api(action, extra) {
    const res = await fetch(SERVER + (/^rdyFile/.test(action) ? '/api/readiness-file' : '/api/access'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action, token: TOKEN }, extra || {})) });
    return [res.status, await res.json().catch(() => ({}))];
  }
  // רשימת הפריטים הקבועה נמצאת במודל של מערך המוכנות; נטען רק למי שיש לו/ה את הכלי
  function loadModel() {
    if (window.SBE_PREP) return Promise.resolve(window.SBE_PREP);
    return new Promise((ok) => { const s = document.createElement('script'); s.src = 'lib/readiness-model.js'; s.onload = () => ok(window.SBE_PREP || null); s.onerror = () => ok(null); document.head.appendChild(s); });
  }
  // שם ברור: לא שם קובץ אוטומטי ולא רק סיומת (אותו כלל כמו vagueTitle בשרת)
  const vague = (t) => { const s = String(t || '').trim(); return s.length < 4 || /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|webp|txt|csv)$/i.test(s) || /^(img|dsc|scan|scanned|document|doc|file|image|photo|whatsapp|screenshot|צילום|מסמך|קובץ|תמונה|סריקה)[\s_\-\d.()]*$/i.test(s); };
  const MAX_BYTES = 4 * 1024 * 1024;
  const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv';
  const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', txt: 'text/plain', csv: 'text/csv', doc: 'application/msword', xls: 'application/vnd.ms-excel',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
  const EXT = Object.fromEntries(Object.entries(MIME).map(([e, m]) => [m, e]));
  const b64 = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = no; r.readAsDataURL(file); });

  let doc = null, P = null, openKey = '', msg = '';
  const binder = () => (doc.parts.binder && typeof doc.parts.binder === 'object' ? doc.parts.binder : {});
  function items() {
    const L = P ? (ORG && P.forSpace ? P.forSpace('org') : P).content('he') : null;
    const fixed = L && Array.isArray(L.BINDER_MANUAL) ? L.BINDER_MANUAL : [];
    const sens = (L && L.BINDER_SENS) || [0, 1, 4, 7];
    return fixed.map((text, i) => ({ key: 'm' + i, text, sens: sens.includes(i) }))
      .concat((Array.isArray(binder().items) ? binder().items : []).filter((x) => x && x.key && x.text).map((x) => ({ key: x.key, text: x.text, sens: !!x.sens, custom: true })));
  }
  async function saveBinder(next, what) {
    const [st, out] = await api('rdySave', { id: doc.id, part: 'binder', rev: (doc.revs && doc.revs.binder) || 0, value: next, what, by: by() });
    if (st === 409 && out.doc) { doc = out.doc; msg = 'מישהו אחר עדכן את התיקייה. הרשימה נטענה מחדש, ואפשר לנסות שוב.'; draw(); return false; }
    if (st !== 200) { msg = out.error || 'השמירה לא הצליחה. אפשר לנסות שוב.'; draw(); return false; }
    doc.parts.binder = next; doc.revs = Object.assign({}, doc.revs, { binder: out.rev }); msg = ''; return true;
  }

  function fileForm(it, f) {
    const file = h('input', { type: 'file', accept: ACCEPT, 'aria-label': 'הקובץ' });
    const title = h('input', { type: 'text', maxlength: '120', placeholder: 'למשל: ' + W(it.text.replace(/\s*\(.*\)\s*$/, '')).slice(0, 60), value: f ? f.title : '', 'aria-label': 'שם ברור לקובץ' });
    const date = h('input', { type: 'date', value: today(), 'aria-label': 'תאריך העדכון של הקובץ' });
    const note = h('p', { class: 'bnote', role: 'status' });
    const send = async (e) => {
      e.preventDefault();
      const fl = file.files && file.files[0];
      if (!fl) { note.textContent = 'כדי להעלות, אפשר לבחור קובץ.'; return; }
      if (vague(title.value)) { note.textContent = 'כדי שכולם ימצאו את הקובץ, אפשר לתת לו שם ברור שאומר מה יש בו.'; title.focus(); return; }
      if (!date.value) { note.textContent = 'תאריך העדכון של הקובץ הוא שדה עיקרי.'; return; }
      const ext = (fl.name.split('.').pop() || '').toLowerCase(), mime = MIME[ext];
      if (!mime) { note.textContent = 'אפשר להעלות PDF, תמונה, Word, Excel, PowerPoint או טקסט.'; return; }
      if (fl.size > MAX_BYTES) { note.textContent = 'הקובץ גדול מ־4 מגה. אפשר לשמור אותו מוקטן (למשל PDF דחוס) ולהעלות שוב.'; return; }
      if (f && !confirm('הקובץ החדש יחליף את "' + f.title + '", והגרסה הקודמת תימחק. להמשיך?')) return;
      note.textContent = 'מעלים את הקובץ...';
      const [st, out] = await api('rdyFilePut', { id: doc.id, key: it.key, title: title.value.trim(), date: date.value, name: fl.name, mime, data: await b64(fl), by: by() });
      if (st !== 200) { note.textContent = out.error || 'ההעלאה לא הצליחה. אפשר לנסות שוב.'; return; }
      doc.files = out.files; openKey = ''; msg = out.replaced ? 'הגרסה החדשה נשמרה, והקודמת נמחקה.' : 'הקובץ נשמר בתיקייה.'; draw();
    };
    return h('form', { class: 'bform', onsubmit: send },
      h('label', {}, h('span', { text: 'הקובץ' }), file),
      h('label', {}, h('span', { text: 'שם ברור לקובץ' }), title),
      h('label', {}, h('span', { text: 'תאריך העדכון של הקובץ' }), date),
      h('div', {}, h('button', { type: 'submit', text: f ? 'העלאת הגרסה החדשה' : 'העלאה' }), ' ', lnk('ביטול', () => { openKey = ''; draw(); })), note);
  }
  function whereForm(it, w) {
    const place = h('input', { type: 'text', maxlength: '160', placeholder: W('למשל: בתיקייה המשותפת של ההנהלה, במזכירות'), value: (w && w.place) || '', 'aria-label': 'איפה זה נשמר' });
    const date = h('input', { type: 'date', value: (w && w.date) || today(), 'aria-label': 'תאריך העדכון' });
    const note = h('p', { class: 'bnote', role: 'status' });
    const send = async (e) => {
      e.preventDefault();
      if (place.value.trim().length < 3) { note.textContent = 'אפשר לכתוב איפה זה נשמר, כדי שממלא/ת מקום ימצא/תמצא את זה.'; return; }
      if (!date.value) { note.textContent = 'תאריך העדכון הוא שדה עיקרי.'; return; }
      const bd = binder(), next = Object.assign({}, bd, { where: Object.assign({}, bd.where || {}, { [it.key]: { place: place.value.trim(), date: date.value, by: by() } }) });
      if (await saveBinder(next, 'עדכון בתיקיית הרציפות: ' + it.text.slice(0, 80))) { openKey = ''; msg = 'נשמר.'; draw(); }
    };
    return h('form', { class: 'bform', onsubmit: send },
      h('label', {}, h('span', { text: 'איפה זה נשמר' }), place),
      h('label', {}, h('span', { text: 'תאריך העדכון' }), date),
      h('div', {}, h('button', { type: 'submit', text: 'שמירה' }), ' ', lnk('ביטול', () => { openKey = ''; draw(); })), note);
  }
  async function openFile(it, f) {
    const [st, out] = await api('rdyFileGet', { id: doc.id, key: it.key });
    if (st !== 200 || !out.file) { msg = out.error || 'הקובץ לא נפתח. אפשר לנסות שוב.'; draw(); return; }
    const bin = atob(out.file.data), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u8], { type: out.file.mime }));
    const a = h('a', { href: url, download: f.title.replace(/[\\/:*?"<>|]/g, ' ') + ' · ' + dateIL(f.date) + '.' + (EXT[out.file.mime] || 'bin') });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function delFile(it, f) {
    if (!confirm('למחוק את "' + f.title + '" מהתיקייה?')) return;
    const [st, out] = await api('rdyFileDel', { id: doc.id, key: it.key, by: by() });
    if (st !== 200) { msg = out.error || 'המחיקה לא הצליחה.'; draw(); return; }
    doc.files = out.files; msg = 'הקובץ נמחק.'; draw();
  }
  async function removeItem(it) {
    const f = (doc.files || {})[it.key];
    if (!confirm('להסיר את "' + it.text + '" מהרשימה?' + (f ? ' גם הקובץ שלו יימחק.' : ''))) return;
    if (f) { const [st, out] = await api('rdyFileDel', { id: doc.id, key: it.key, by: by() }); if (st === 200) doc.files = out.files; }
    const bd = binder(), where = Object.assign({}, bd.where || {}); delete where[it.key];
    if (await saveBinder(Object.assign({}, bd, { items: (bd.items || []).filter((x) => x && x.key !== it.key), where }), 'הסרה מתיקיית הרציפות: ' + it.text.slice(0, 80))) { msg = 'הוסר מהרשימה.'; draw(); }
  }
  function addForm() {
    const text = h('input', { type: 'text', maxlength: '160', placeholder: W('למשל: רשימת ציוד החירום במחסן'), 'aria-label': 'מה עוד מוסיפים לתיקייה' });
    const sens = h('input', { type: 'checkbox' });
    const note = h('p', { class: 'bnote', role: 'status' });
    const send = async (e) => {
      e.preventDefault();
      const t = text.value.trim();
      if (t.length < 3) { note.textContent = 'אפשר לכתוב מה מוסיפים.'; return; }
      if (items().some((x) => x.text.trim() === t)) { note.textContent = 'הפריט כבר ברשימה.'; return; }
      const bd = binder(), key = 'c' + Math.random().toString(36).slice(2, 10);
      if (await saveBinder(Object.assign({}, bd, { items: (bd.items || []).concat({ key, text: t, sens: sens.checked }) }), 'הוספה לתיקיית הרציפות: ' + t.slice(0, 80))) { msg = 'נוסף לרשימה.'; draw(); }
    };
    return h('form', { class: 'bform badd', onsubmit: send },
      h('label', {}, h('span', { text: 'מה עוד מוסיפים לתיקייה' }), text),
      h('label', { class: 'bchk' }, sens, h('span', { text: W('יש בזה פרטים של תלמידים, הורים או אנשי צוות (נשמר בבית הספר, לא עולה למערכת)') })),
      h('div', {}, h('button', { type: 'submit', text: '➕ הוספה לרשימה' })), note);
  }
  function binderCard() {
    const files = doc.files || {}, where = binder().where || {};
    const rows = items().map((it) => {
      const f = files[it.key], w = where[it.key], ok = !!(f || (w && w.place));
      const status = f ? h('div', { class: 'bst' }, '📎 ', h('b', { text: f.title }), ' · עודכן ' + dateIL(f.date), ' · ', lnk('פתיחה', () => openFile(it, f)), ' · ', lnk('גרסה חדשה', () => { openKey = it.key; draw(); }), ' · ', lnk('מחיקה', () => delFile(it, f)))
        : w && w.place ? h('div', { class: 'bst' }, 'נשמר ב: ', h('b', { text: w.place }), w.date ? ' · עודכן ' + dateIL(w.date) : '', ' · ', lnk('עדכון', () => { openKey = it.key; draw(); }))
        : h('div', { class: 'bst' }, lnk(it.sens ? 'איפה זה נשמר?' : '📎 העלאת קובץ', () => { openKey = it.key; draw(); }));
      return h('li', { class: 'bitem' + (ok ? ' ok' : '') },
        h('div', {}, h('span', { class: 'bbox', 'aria-hidden': 'true', text: ok ? '☑' : '☐' }), ' ', W(it.text), it.sens ? h('span', { class: 'btag', text: 'רגיש' }) : null,
          it.custom ? h('span', {}, ' · ', lnk('הסרה מהרשימה', () => removeItem(it), 'bmuted')) : null),
        status, openKey === it.key ? (it.sens ? whereForm(it, w) : fileForm(it, f)) : null);
    });
    const done = rows.filter((r) => r.classList.contains('ok')).length;
    return h('section', { class: 'card no-print', id: 'binder' },
      h('h2', { text: '📎 ' + W('תיקיית הרציפות: מה מוסיפים ידנית') }),
      h('p', { class: 'muted small', text: W('לכל פריט קובץ אחד, עם שם ברור ותאריך עדכון. קובץ חדש מחליף את הקודם, והגרסה הקודמת נמחקת. פריט רגיש (פרטים של תלמידים, הורים או אנשי צוות) נשמר בבית הספר, וכאן כותבים רק איפה הוא ומתי עודכן.') }),
      h('p', { class: 'small' }, h('b', { text: done + ' מתוך ' + rows.length }), ' מוכנים · ', h('a', { href: 'readiness.html?id=' + encodeURIComponent(doc.id) + '&print=binder', text: '🖨 ' + W('תיקיית הרציפות להדפסה') })),
      msg ? h('p', { class: 'bmsg', role: 'status', text: msg }) : null,
      h('ul', { class: 'blist' }, rows), addForm());
  }
  function archiveCard() {
    const p = doc.parts || {}, list = [];
    const ses = p.sessions && typeof p.sessions === 'object' ? p.sessions : {};
    for (const n of Object.keys(ses)) if (ses[n] && ses[n].archive) list.push(ses[n].archive);
    for (const m of Array.isArray(p.meetings) ? p.meetings : []) if (m && m.archive) list.push(m.archive);
    list.sort((a, b) => String(b.date || b.at).localeCompare(String(a.date || a.at)));
    const go = (q) => 'readiness.html?id=' + encodeURIComponent(doc.id) + '&' + q;
    return h('section', { class: 'card no-print', id: 'archive' },
      h('h2', { text: '🗂 ' + W('ארכיון הפרוטוקולים ממערך המוכנות') }),
      h('p', { class: 'links' }, h('a', { href: go('view=track&sheet=tasks'), text: 'משימות' }), ' · ', h('a', { href: go('view=track&sheet=decisions'), text: 'החלטות' }), ' · ',
        h('a', { href: go('view=track&sheet=ends'), text: 'קצוות פתוחים' })),
      list.length ? list.map((a) => h('details', { class: 'arch' }, h('summary', { text: a.title + (a.date ? ' · ' + dateIL(a.date) : '') }), body(a),
        h('p', {}, h('a', { href: '#', text: '🖨 הדפסת הפרוטוקול', onclick: (e) => { e.preventDefault(); if (window.SBE_DOC) window.SBE_DOC.print({ title: a.title, kind: 'פרוטוקול', node: body(a) }); else window.print(); } })))) :
        h('p', { class: 'muted', text: W('עוד אין פרוטוקולים בארכיון. בסוף כל מפגש במערך המוכנות: "העברת הפרוטוקול לתיק הרציפות".') }));
  }
  function draw() {
    const y = window.scrollY;
    box.replaceChildren(archiveCard(), binderCard());
    window.scrollTo(0, y);
  }
  (async () => {
    try {
      const [s1, mine] = await api('rdyMine');
      if (s1 !== 200 || !mine.items || !mine.items.length) return;
      const [s2, got] = await api('rdyGet', { id: mine.items[0].id });
      if (s2 !== 200 || !got.doc) return;
      doc = got.doc; P = await loadModel();
      draw();
      const target = location.hash === '#archive' || location.hash === '#binder' ? document.querySelector(location.hash) : null;
      if (target) target.scrollIntoView();
    } catch (e) { /* בלי חיבור: התיק עובד כרגיל, בלי הארכיון */ }
  })();
})();
