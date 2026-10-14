(function () {
  'use strict';
  const STATE = { not_configured:'מערך הגיבוי טרם חובר', invalid_report:'דוח הניטור אינו תקין', stale:'דוח הניטור אינו עדכני', attention:'נדרשת השלמת הגנה', healthy:'דווח על גיבוי ייצור מאומת' };
  const LABELS = { source:'קוד והיסטוריית פיתוח', database:'מסד, הרשאות ונתונים', storage:'קבצים ומסמכים', configuration:'תצורה והפניות לסודות' };
  const COVERAGE = { verified:'אומת', missing:'חסר', not_configured:'טרם הוגדר', failed:'נכשל' };
  const ALERTS = { backup_failed:'פעולת גיבוי נכשלה', restore_failed:'בדיקת שחזור נכשלה', missing_components:'חסרים רכיבים בכיסוי', stale_report:'הדוח ישן מ־48 שעות', independent_copy_missing:'טרם אומת עותק עצמאי', recovery_key_missing:'מפתח שחזור ממחשב אחר טרם אומת' };
  function node(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
  async function mount(container, { token, call }) {
    container.dir = 'rtl';
    container.append(node('h2', 'גיבוי, שחזור ורציפות פעילות'));
    container.append(node('p', 'מצב הכיסוי ובדיקות השחזור. דוח בדיקה מקומי אינו מעיד שהאתר הפעיל מוגן.', 'backup-explanation'));
    const status = node('p', 'טוען מצב גיבוי…'); status.setAttribute('role', 'status'); container.append(status);
    const details = node('div', ''); container.append(details);
    const refresh = node('button', 'רענון מצב', 'act'); refresh.type = 'button'; container.append(refresh);
    async function load() {
      refresh.disabled = true; details.replaceChildren(); status.textContent = 'טוען מצב גיבוי…';
      try {
        const out = await call(token);
        status.textContent = STATE[out.state] || 'מצב לא ידוע';
        if (!out.productionProtected) details.append(node('p', 'הגנת ייצור מלאה טרם אומתה.', 'backup-explanation'));
        const ENV = { synthetic:'בדיקה עם נתונים סינתטיים', 'local-source':'גיבוי קוד והיסטוריית פיתוח', production:'דוח סביבת ייצור' };
        if (ENV[out.environment]) details.append(node('p', ENV[out.environment]));
        if (out.generatedAt) details.append(node('p', 'הדוח עודכן: ' + new Date(out.generatedAt).toLocaleString('he-IL')));
        const list = node('ul', '');
        Object.entries(LABELS).forEach(([key, label]) => list.append(node('li', label + ': ' + (COVERAGE[out.components?.[key]] || 'טרם הוגדר'))));
        list.append(node('li', 'הצפנה: ' + (out.encrypted ? 'דווח על ארכיון מוצפן' : 'טרם אומתה')));
        list.append(node('li', 'בדיקת שלמות: ' + (out.integrity === 'verified' ? 'אומתה' : 'טרם אומתה')));
        list.append(node('li', 'עותק עצמאי: ' + (out.independentCopy === 'verified' ? 'דווח על עותק מאומת' : 'טרם אומת')));
        list.append(node('li', 'מפתח שחזור ממחשב אחר: ' + (out.portableRecoveryKeyVerified ? 'דווח על מפתח מאומת' : 'טרם אומת')));
        details.append(list);
        if (out.restore) details.append(node('p', 'בדיקת שחזור: ' + (out.restore.status === 'passed' ? 'עברה' : 'נכשלה') + ' · ' + (out.restore.scope === 'synthetic' ? 'נתונים סינתטיים' : 'סביבה מבודדת עם נתוני אמת')));
        const warnings = node('ul', ''); (out.alerts || []).forEach(code => { if (ALERTS[code]) warnings.append(node('li', ALERTS[code])); }); details.append(warnings);
      } catch (error) { status.textContent = error.status === 403 ? 'המסך זמין לבעלת המערכת בלבד.' : 'לא ניתן לקבל מצב גיבוי כרגע. ההגנה לא אומתה.'; }
      finally { refresh.disabled = false; }
    }
    refresh.addEventListener('click', load); await load();
  }
  window.SBE_BACKUP_MONITOR = { mount };
}());
