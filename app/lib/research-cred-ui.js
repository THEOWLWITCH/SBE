// מרכז המחקר: "נתוני בדיקת האמינות" (26/11/2026: "תבנה את זה דחוף מאוד!!!").
// הנתונים נשמרים בשרת של Begood (harness/lib/credibility.mjs) ומגיעים לכאן דרך crdCall:
// כל פעילות עם התקדמות לפי כיתה, שיוך למחקר, וייצוא מזוהה: JSON מלא, טבלת משתתפים וטבלת בדיקות (M.participantsRows, M.checksRows).
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SBE_RCRED_UI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const endpoint = () => (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) ? '/api/access' : 'https://sbe-server.onrender.com/api/access';
  const token = () => { try { return sessionStorage.getItem('sbe.session.token') || ''; } catch (_) { return ''; } };
  async function call(op, input) {
    try {
      const r = await fetch(endpoint(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'crdCall', op, input, token: token() }) });
      const d = await r.json().catch(() => ({}));
      return r.ok ? d : { error: d.error || 'הפעולה לא הושלמה' };
    } catch (_) { return { error: 'אין כרגע חיבור לשרת. אפשר לנסות שוב בעוד רגע.' }; }
  }
  const dateIL = (iso) => { try { return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' }).replace(/\//g, '.'); } catch (_) { return ''; } };
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const COLS = [['teams', 'צוותים'], ['members', 'משתתפים'], ['research', 'במחקר'], ['pre', 'שאלון ראשוני'], ['checks', 'בדיקות'], ['final', 'בדיקות שהושלמו'], ['post', 'שאלון מסכם'], ['reflect', 'רפלקציה']];

  function view(box, ctx) {
    const { D, study } = ctx, node = D.node, M = root.SBE_CRED;
    D.paragraph(box, 'הנתונים של הכלי בדיקת אמינות של מקורות: כל פעילות, כל כיתה וכל צוות. הנתונים נשמרים בשרת של Begood, ומגיעים לכאן מזוהים: כיתה, קוד הצוות שהמשתתפים הקלידו (למשל 214), וקוד וראשי תיבות לכל משתתף/ת. בייצוא רק מי שמשתתף/ת במחקר, ועבודה צוותית רק כשכל הצוות במחקר. בדיקה שצוות התחיל מחדש נשמרת בנפרד.', 'r-muted');
    const status = node('p', 'r-muted'); status.setAttribute('role', 'status');
    const top = node('div', 'r-linkmenu'); box.append(top);
    const area = node('div'); box.append(area, status);
    let acts = [];
    if (!M) { D.paragraph(area, 'הרכיב עוד נטען. אפשר לרענן את הדף.', 'r-muted'); return; }

    async function exportOf(a) { const o = await call('f.export', { id: a.id }); if (o.error) throw new Error(o.error); return o; }
    async function merged(list) {
      const all = { activities: [], teams: [] };
      for (const a of list) { const x = await exportOf(a); all.activities.push(x.activity); x.teams.forEach((t) => all.teams.push({ ...t, activity: x.activity.title })); }
      return all;
    }
    const rowsMerged = (all, fn) => { const out = []; all.teams.forEach((t, i) => { const r = fn({ activity: { title: t.activity }, teams: [t] }); if (!out.length) out.push(r[0]); out.push(...r.slice(1)); }); return out.length ? out : fn({ teams: [] }); };
    const linked = () => acts.filter((a) => a.studyId === study.id);

    top.append(D.button('ייצוא כל הפעילויות של המחקר: טבלת משתתפים (CSV)', async () => {
      const l = linked(); if (!l.length) { status.textContent = 'עוד אין פעילות ששויכה למחקר הזה. אפשר לשייך פעילות בכפתור "שיוך למחקר הזה".'; return; }
      status.textContent = 'מכינים את הקובץ…';
      try { download('אמינות-משתתפים-' + (study.config?.title || 'מחקר') + '.csv', M.toCsv(rowsMerged(await merged(l), M.participantsRows)), 'text/csv'); status.textContent = '✓ הקובץ ירד'; } catch (e) { status.textContent = e.message; }
    }, 'r-secondary'));
    top.append(D.button('ייצוא כל הפעילויות של המחקר: טבלת בדיקות (CSV)', async () => {
      const l = linked(); if (!l.length) { status.textContent = 'עוד אין פעילות ששויכה למחקר הזה. אפשר לשייך פעילות בכפתור "שיוך למחקר הזה".'; return; }
      status.textContent = 'מכינים את הקובץ…';
      try { download('אמינות-בדיקות-' + (study.config?.title || 'מחקר') + '.csv', M.toCsv(rowsMerged(await merged(l), M.checksRows)), 'text/csv'); status.textContent = '✓ הקובץ ירד'; } catch (e) { status.textContent = e.message; }
    }, 'r-secondary'));
    top.append(D.button('ייצוא כל הפעילויות של המחקר (JSON מלא)', async () => {
      const l = linked(); if (!l.length) { status.textContent = 'עוד אין פעילות ששויכה למחקר הזה. אפשר לשייך פעילות בכפתור "שיוך למחקר הזה".'; return; }
      status.textContent = 'מכינים את הקובץ…';
      try { download('אמינות-' + (study.config?.title || 'מחקר') + '.json', JSON.stringify(await merged(l), null, 2), 'application/json'); status.textContent = '✓ הקובץ ירד'; } catch (e) { status.textContent = e.message; }
    }, 'r-secondary'));
    const open = node('a', 'r-secondary', 'מסך המרצות'); open.href = 'credibility-check.html'; open.target = '_blank'; open.rel = 'noopener'; top.append(open);

    async function list() {
      area.replaceChildren(node('p', 'r-muted', 'טוענים את הפעילויות…'));
      const out = await call('f.researchList', {});
      area.replaceChildren();
      if (out.error) { D.paragraph(area, out.error, 'r-notice r-error'); return; }
      acts = (out.activities || []).sort((x, y) => (y.studyId === study.id) - (x.studyId === study.id));
      if (!acts.length) { D.paragraph(area, 'עוד אין פעילויות בכלי בדיקת אמינות של מקורות.', 'r-muted'); return; }
      for (const a of acts) item(a);
    }
    function item(a) {
      const card = node('section', 'r-study'); area.append(card);
      card.append(node('h3', '', a.title));
      const here = a.studyId === study.id;
      card.append(node('p', 'r-muted', (a.status === 'open' ? 'פתוחה' : 'סגורה') + ' · עודכנה ב־' + dateIL(a.updatedAt) + (here ? ' · ✓ משויכת למחקר הזה' : a.studyId ? ' · משויכת למחקר אחר' : '') + (a.research ? '' : ' · איסוף למחקר כבוי')));
      const t = node('table', 'r-table'), hd = node('tr'); hd.append(node('th', '', 'כיתה')); for (const [, l] of COLS) hd.append(node('th', '', l));
      const thead = node('thead'); thead.append(hd); t.append(thead); const tb = node('tbody'); t.append(tb);
      for (const c of a.classes) { const tr = node('tr'); tr.append(node('td', '', c.name)); for (const [k] of COLS) tr.append(node('td', '', String(c[k] || 0))); tb.append(tr); }
      card.append(t);
      const m = node('div', 'r-linkmenu'); card.append(m);
      m.append(D.button(here ? 'ביטול השיוך למחקר' : 'שיוך למחקר הזה', async () => { const o = await call('f.linkStudy', { id: a.id, studyId: here ? '' : study.id }); status.textContent = o.error || '✓ עודכן'; list(); }, 'r-secondary'));
      m.append(D.button('טבלת משתתפים (CSV)', async () => { try { download('אמינות-משתתפים-' + a.title + '.csv', M.toCsv(M.participantsRows(await exportOf(a))), 'text/csv'); } catch (e) { status.textContent = e.message; } }, 'r-secondary'));
      m.append(D.button('טבלת בדיקות (CSV)', async () => { try { download('אמינות-בדיקות-' + a.title + '.csv', M.toCsv(M.checksRows(await exportOf(a))), 'text/csv'); } catch (e) { status.textContent = e.message; } }, 'r-secondary'));
      m.append(D.button('JSON מלא', async () => { try { download('אמינות-' + a.title + '.json', JSON.stringify(await exportOf(a), null, 2), 'application/json'); } catch (e) { status.textContent = e.message; } }, 'r-secondary'));
    }
    list();
  }
  return { view };
});
