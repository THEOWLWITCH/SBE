// מרכז המחקר: "מסלול הסטודנטיות" במחקר שיחות מאתגרות (18/11/2026).
// קישור ו־QR לכל קבוצה (talk-study.html?c=), פתיחה וסגירה, התקדמות לפי מפגש, וייצוא CSV ו־JSON.
// הנתונים בשרת של Begood (harness/lib/talk-study.mjs, tsc:/tsp:), בקוד משתתף/ת בלבד. המיילים לדו״ח בנפרד.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SBE_TALK_UI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const GROUPS = ['ייעוץ חינוכי', 'חינוך', 'אחר'];
  // התיקייה המשותפת של צוות המחקר ב־Google Drive (ד״ר עינת שושן־רפאלי וד״ר יעל שדה, 19/11/2026)
  const TEAM_FOLDER = 'https://drive.google.com/drive/folders/1jifxe6Id8J2moFq7a0zN-spcKpdrtCNp';
  const PARTS = [['pre', 'שאלון עמדות'], ['model', 'בחירת מודל'], ['practice', 'תרגול ומשוב'], ['post', 'שאלון עמדות (סוף מפגש 2 ו־3)'], ['reflection', 'רפלקציה']];
  const endpoint = () => (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) ? '/api/access' : 'https://sbe-server.onrender.com/api/access';
  const token = () => { try { return sessionStorage.getItem('sbe.session.token') || ''; } catch (_) { return ''; } };
  async function call(op, input) {
    try {
      const r = await fetch(endpoint(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'tsCall', op, input, token: token() }) });
      const d = await r.json().catch(() => ({}));
      return r.ok ? d : { error: d.error || 'הפעולה לא הושלמה' };
    } catch (_) { return { error: 'אין כרגע חיבור לשרת. אפשר לנסות שוב בעוד רגע.' }; }
  }
  const linkFor = (code) => new URL('talk-study.html?c=' + code, typeof location !== 'undefined' ? location.href : 'https://be-good.co.il/').href;
  const dateIL = (iso) => { try { return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }).replace(/\//g, '.'); } catch (_) { return ''; } };

  // שורה לכל משתתף/ת ולכל מפגש
  // מאיזה מפגש השיחה (24/11/2026): שיחה שנבחרה מחדש (reusedFrom), או אותו תיאור בדיוק כמו במפגש קודם, נספרת כאותה שיחה
  function caseFrom(p, n) {
    const cs = p.sessions?.[n]?.case; if (!cs || !cs.fields) return '';
    if (cs.reusedFrom) return cs.reusedFrom;
    const sig = JSON.stringify(cs.fields);
    for (let k = 1; k < n; k++) { const o = p.sessions?.[k]?.case; if (o && o.fields && JSON.stringify(o.fields) === sig) return o.reusedFrom || k; }
    return n;
  }
  function csvRows(participants) {
    const BG = root.SBE_BGSTUDY, itemIds = BG ? Object.keys(BG.ITEMS) : [];
    const T = root.SBE_TALKSTUDY, refl = T ? [...T.REFLECTION.main, ...T.REFLECTION.short].map((x) => x[0]) : ['contribution', 'feeling', 'tool', 'turn', 'assumption', 'next'];
    const bgIds = BG ? BG.byId('bg-s1-open').definition.items.filter((x) => x.type !== 'likert').map((x) => x.id) : [];
    const head = ['pid', 'group', 'joined', 'report', 'session', ...bgIds, ...itemIds.map((x) => 'pre_' + x),
      'case_type', 'difficulty', 'prep_aim', 'prep_fear', 'prep_hope', 'case_from_session', 'models', 'model_kept', 'model_switched_in_session', 'model_reason', 'practice_rounds', 'practice_tries', 'practice_turns', 'ending', ...itemIds.map((x) => 'post_' + x), 'post_open', ...refl.map((x) => 'refl_' + x), 'done_at'];
    const rows = [head];
    for (const p of participants) for (const n of [1, 2, 3]) {
      const s = p.sessions?.[n]; if (!s) continue;
      const pre = s.pre?.answers || {}, post = s.post?.answers || {}, cs = s.case || {}, md = s.model || {}, pr = s.practice || {}, rf = s.reflection || {};
      const openKey = Object.keys(post).find((k) => !itemIds.includes(k));
      rows.push([p.pid, p.group, (p.createdAt || '').slice(0, 10), p.report ? 'כן' : '', n, ...bgIds.map((x) => pre[x] ?? ''), ...itemIds.map((x) => pre[x] ?? ''),
        cs.type || '', cs.difficulty ?? '', cs.prep?.aim || '', cs.prep?.fear || '', cs.prep?.hope || '', caseFrom(p, n), (md.ids || []).join('+'), md.kept === true ? 'כן' : md.kept === false ? 'לא' : '', md.switchedInSession ? 'כן' : '', md.reason || '',
        Array.isArray(pr.rounds) ? pr.rounds.length : (s.practice ? 1 : ''), pr.tries ?? '', pr.turns ?? '', pr.endingType || '', ...itemIds.map((x) => post[x] ?? ''), openKey ? post[openKey] : '', ...refl.map((x) => rf[x] || ''), (s.doneAt || '').slice(0, 10)]);
    }
    return rows;
  }
  const toCsv = (rows) => '﻿' + rows.map((r) => r.map((v) => { const t = v === null ? 'לא ענה/תה' : String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(',')).join('\n');
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function loadQr(cb) {
    if (root.QRCode) return cb();
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = cb; s.onerror = () => {}; document.head.append(s);
  }

  function view(box, ctx) {
    const { D, study, ask } = ctx, node = D.node;
    D.paragraph(box, 'מסלול לסטודנטיות ולסטודנטים, בלי קוד Begood, בשלושה מפגשים: הסכמה ושאלון עמדות בפתיחה; בכל מפגש בחירת מודל, תרגול ומשוב (במפגש 2 פעמיים); בסוף מפגש 2 שאלון עמדות; בסוף מפגש 3 שאלון עמדות מסכם ורפלקציה. לכל קבוצה קישור ו־QR משלה. הכניסה היא רק למסלול הזה, בלי מעבר לכלים אחרים.');
    const links = node('p', 'r-muted');
    const a2 = node('a', '', 'פנקס הכיס'); a2.href = 'pocket-talk.html'; a2.target = '_blank'; a2.rel = 'noopener';
    links.append(a2); box.append(links);
    const team = node('div', 'r-card-inner');
    team.append(node('h3', '', '📁 התיקייה המשותפת של צוות המחקר'));
    team.append(node('p', 'r-muted', 'חומרי המחקר המשותפים לד״ר עינת שושן־רפאלי ולד״ר יעל שדה.'));
    const fa = node('a', 'r-secondary', 'פתיחת התיקייה ב־Google Drive'); fa.href = TEAM_FOLDER; fa.target = '_blank'; fa.rel = 'noopener';
    team.append(fa); box.append(team);
    const form = node('div', 'r-card-inner');
    const gl = node('label', '', 'הקבוצה'), gs = node('select'); for (const g of GROUPS) gs.append(new Option(g, g)); gl.append(gs);
    const ll = node('label', '', 'שם לקישור (רשות)'), li = node('input'); li.placeholder = 'למשל: קורס שיחות מאתגרות, סמסטר א׳'; ll.append(li);
    form.append(gl, ll);
    const menu = node('div', 'r-linkmenu'); form.append(menu); box.append(form);
    const area = node('div'); box.append(area);
    const status = node('p', 'r-muted'); status.setAttribute('role', 'status'); box.append(status);
    menu.append(D.button('יצירת קישור לקבוצה', async () => {
      status.textContent = 'יוצרים קישור…';
      const out = await call('f.create', { studyId: study.id, studyTitle: study.config?.title || '', group: gs.value, label: li.value.trim() });
      status.textContent = out.error ? out.error : '✓ הקישור נוצר'; li.value = ''; list();
    }, 'r-secondary'));

    async function list() {
      area.replaceChildren(node('p', 'r-muted', 'טעינת הקבוצות…'));
      const out = await call('f.list', { studyId: study.id });
      area.replaceChildren();
      if (out.error) { D.paragraph(area, out.error, 'r-notice r-error'); return; }
      if (!out.classes.length) { D.paragraph(area, 'עדיין אין קישור לקבוצה. אפשר ליצור קישור לכל קבוצה (למשל ייעוץ חינוכי וחינוך), ולשלוח אותו או להקרין את ה־QR.', 'r-muted'); return; }
      for (const c of out.classes) item(c);
    }
    function item(c) {
      const card = node('section', 'r-study'); area.append(card);
      const h = node('h3', '', c.group + (c.label ? ' · ' + c.label : '')); card.append(h);
      card.append(node('p', 'r-muted', (c.status === 'open' ? 'פתוח' : 'סגור') + ' · נוצר ב־' + dateIL(c.createdAt) + ' · ' + c.participants + ' משתתפים'));
      const url = linkFor(c.code);
      const row = node('div', 'r-toolbar'); const u = node('input'); u.readOnly = true; u.value = url; u.style.minWidth = '260px'; u.style.flex = '1'; row.append(u); card.append(row);
      const qr = node('div'); qr.style.margin = '8px 0'; card.append(qr);
      const m = node('div', 'r-linkmenu'); card.append(m);
      m.append(D.button('העתקה', async () => { try { await navigator.clipboard.writeText(url); status.textContent = '✓ הקישור הועתק'; } catch (_) { u.select(); } }, 'r-secondary'));
      m.append(D.button('וואטסאפ', () => window.open('https://wa.me/?text=' + encodeURIComponent('שלום, זה הקישור למסלול התרגול במחקר "הכנה לשיחות מאתגרות". נכנסים מהטלפון או מהמחשב, ונשארים באותו מכשיר בשלושת המפגשים:\n' + url), '_blank', 'noopener'), 'r-secondary'));
      m.append(D.button('QR', () => { qr.replaceChildren(); loadQr(() => { if (root.QRCode) new root.QRCode(qr, { text: url, width: 200, height: 200 }); }); }, 'r-secondary'));
      m.append(D.button('פתיחת הקישור', () => window.open(url, '_blank', 'noopener'), 'r-secondary'));
      m.append(D.button(c.status === 'open' ? 'סגירה' : 'פתיחה מחדש', async () => { const o = await call('f.status', { code: c.code, status: c.status === 'open' ? 'closed' : 'open' }); status.textContent = o.error || '✓ עודכן'; list(); }, 'r-secondary'));
      m.append(D.button('ייצוא CSV', async () => { const o = await call('f.export', { code: c.code }); if (o.error) { status.textContent = o.error; return; } download('שיחות-מאתגרות-' + c.group + '-' + c.code + '.csv', toCsv(csvRows(o.participants)), 'text/csv;charset=utf-8'); }, 'r-secondary'));
      m.append(D.button('ייצוא JSON (עם התמלילים)', async () => { const o = await call('f.export', { code: c.code }); if (o.error) { status.textContent = o.error; return; } download('שיחות-מאתגרות-' + c.code + '.json', JSON.stringify(o, null, 2), 'application/json'); }, 'r-secondary'));
      m.append(D.button('מיילים לדו״ח אישי', async () => { const o = await call('f.emails', { code: c.code }); if (o.error) { status.textContent = o.error; return; } status.textContent = o.emails.length ? o.emails.map((e) => e.pid + ': ' + e.email).join(' · ') : 'אף אחד עוד לא ביקש דו״ח אישי.'; }, 'r-secondary'));
      m.append(D.button('מחיקה', async () => { if (!(await ask('למחוק את הקישור ואת כל מה שנשמר בו? אי אפשר לבטל את המחיקה.'))) return; const o = await call('f.delete', { code: c.code }); status.textContent = o.error || '✓ נמחק'; list(); }, 'r-danger'));
      // התקדמות
      const t = node('table', 'r-table'), hd = node('tr'); hd.append(node('th', '', 'מפגש')); for (const [, l] of PARTS) hd.append(node('th', '', l));
      const thead = node('thead'); thead.append(hd); t.append(thead); const tb = node('tbody'); t.append(tb);
      for (const p of c.progress || []) { const tr = node('tr'); tr.append(node('td', '', String(p.session))); for (const [k] of PARTS) tr.append(node('td', '', p[k] == null ? '' : String(p[k]))); tb.append(tr); }
      card.append(t);
    }
    list();
  }
  return { view, csvRows, toCsv, GROUPS };
});
