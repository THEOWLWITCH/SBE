// מרכז המחקר: "נתוני בדיקת האמינות" (26/11/2026: "תבנה את זה דחוף מאוד!!!").
// לפי מכללה וכיתה, לא לפי פעילות (26/11/2026: "הפסקנו לעבוד לפי פעילות. אנחנו עובדים לפי כיתות ומכללות").
// הנתונים נשמרים בשרת של Begood (harness/lib/credibility.mjs) ומגיעים לכאן דרך crdCall: כל הכיתות שאפשר לראות,
// בלי פעילויות וכיתות בדיקה, עם התקדמות וייצוא מזוהה: טבלת משתתפים, טבלת בדיקות וקובץ מלא, לכולן, למכללה או לכיתה.
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
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const COLS = [['teams', 'צוותים'], ['members', 'משתתפים'], ['research', 'במחקר'], ['pre', 'שאלון ראשוני'], ['checks', 'בדיקות'], ['final', 'בדיקות שהושלמו'], ['post', 'שאלון מסכם'], ['reflect', 'רפלקציה']];
  const isTestAct = (a) => /7777|בדיקה/.test(String(a.title || ''));

  function view(box, ctx) {
    const { D } = ctx, node = D.node, M = root.SBE_CRED;
    D.paragraph(box, 'הנתונים של הכלי בדיקת אמינות של מקורות, לפי מכללה וכיתה. כל צוות מזוהה בקוד הצוות שהמשתתפות הקלידו (למשל 214), וכל משתתפת בקוד ובראשי התיבות. בייצוא רק מי שמשתתפת במחקר, ועבודה צוותית רק כשכל הצוות במחקר. בדיקה שצוות התחיל מחדש נשמרת בנפרד. כיתות בדיקה לא נכללות.', 'r-muted');
    const status = node('p', 'r-muted'); status.setAttribute('role', 'status');
    const area = node('div'); box.append(area, status);
    if (!M) { D.paragraph(area, 'הרכיב עוד נטען. אפשר לרענן את הדף.', 'r-muted'); return; }
    let acts = [];

    // כל הצוותים מכל הפעילויות, בלי כיתות בדיקה; אפשר לסנן למכללה או לכיתה
    async function teams(filter) {
      const out = [];
      for (const a of acts) {
        const x = await call('f.export', { id: a.id });
        if (x.error) throw new Error(x.error);
        for (const t of x.teams || []) {
          if (M.isTestClass(t.className)) continue;
          if (filter && !filter(t)) continue;
          out.push(t);
        }
      }
      return { exportedAt: new Date().toISOString(), teams: out };
    }
    function exportRow(where, label, filter) {
      const m = node('div', 'r-linkmenu'); where.append(m);
      const go = (kind) => async () => {
        status.textContent = 'מכינים את הקובץ…';
        try {
          const x = await teams(filter);
          if (kind === 'json') download('אמינות-' + label + '.json', JSON.stringify(x, null, 2), 'application/json');
          else download('אמינות-' + (kind === 'p' ? 'משתתפים-' : 'בדיקות-') + label + '.csv', M.toCsv(kind === 'p' ? M.participantsRows(x) : M.checksRows(x)), 'text/csv');
          status.textContent = '✓ הקובץ ירד';
        } catch (e) { status.textContent = e.message; }
      };
      m.append(D.button('טבלת משתתפים (CSV)', go('p'), 'r-secondary'));
      m.append(D.button('טבלת בדיקות (CSV)', go('c'), 'r-secondary'));
      m.append(D.button('קובץ מלא (JSON)', go('json'), 'r-secondary'));
    }

    async function list() {
      area.replaceChildren(node('p', 'r-muted', 'טוענים את הכיתות…'));
      const out = await call('f.researchList', {});
      area.replaceChildren();
      if (out.error) { D.paragraph(area, out.error, 'r-notice r-error'); return; }
      acts = (out.activities || []).filter((a) => !isTestAct(a));
      // מכללה ← כיתות, עם ההתקדמות
      const byCollege = new Map();
      for (const a of acts) for (const c of a.classes) {
        if (M.isTestClass(c.name)) continue;
        const col = M.collegeOf(c.name) || 'בלי שם';
        if (!byCollege.has(col)) byCollege.set(col, []);
        byCollege.get(col).push({ ...c, label: M.classOf(c.name) });
      }
      if (!byCollege.size) { D.paragraph(area, 'עוד אין כיתות בכלי בדיקת אמינות של מקורות.', 'r-muted'); return; }
      const all = node('section', 'r-study'); area.append(all);
      all.append(node('h3', '', 'כל המכללות והכיתות'));
      exportRow(all, 'כל-הכיתות', null);
      for (const [col, classes] of [...byCollege.entries()].sort((x, y) => x[0].localeCompare(y[0], 'he'))) {
        classes.sort((x, y) => x.label.localeCompare(y.label, 'he', { numeric: true }));
        const card = node('section', 'r-study'); area.append(card);
        card.append(node('h3', '', col));
        const t = node('table', 'r-table'), hd = node('tr'); hd.append(node('th', '', 'כיתה')); for (const [, l] of COLS) hd.append(node('th', '', l));
        const thead = node('thead'); thead.append(hd); t.append(thead); const tb = node('tbody'); t.append(tb);
        for (const c of classes) { const tr = node('tr'); tr.append(node('td', '', c.label)); for (const [k] of COLS) tr.append(node('td', '', String(c[k] || 0))); tb.append(tr); }
        card.append(t);
        card.append(node('p', 'r-muted', 'כל ' + col + ':'));
        exportRow(card, col, (tm) => M.collegeOf(tm.className) === col);
        for (const c of classes) {
          card.append(node('p', 'r-muted', col + ' · ' + c.label + ':'));
          exportRow(card, col + '-' + c.label, (tm) => tm.className === c.name);
        }
      }
    }
    list();
  }
  return { view };
});
