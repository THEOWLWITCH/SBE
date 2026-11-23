// לב התדריך: המודל שנבחר, שלב אחר שלב (23/11/2026: "קריטי להוסיף לתדריך ניראות למודל - ממש בפירוט - מה קשור לכל שלב
// או רכיב במודל ואיך זה בא לידי ביטוי בשיחה. כמובן - לפי המודל הנבחר. זהו לב התדריך").
// SBE_MODELBRIEF.rule(models)  — ההנחיה למודל: חלק "השיחה שלך לפי המודל", שורה לכל שלב בתבנית קבועה (ארבעה חלקים עם |).
// SBE_MODELBRIEF.render(text)  — התדריך כטבלה (SBE_DOC.sections), והחלק של המודל כטבלה משלו לרוחב (SBE_TABLE).
// models: [{name, steps:[[אות, שם, מה זה]]}] (SBE_TALKSTUDY.MODELS). בתכנון שיחה ובתדריך של מסלול הסטודנטיות.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SBE_MODELBRIEF = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const TITLE = 'השיחה שלך לפי המודל';
  const HEAD = ['שלב במודל', 'מה בשיחה שלך קשור אליו', 'איך זה בא לידי ביטוי בשיחה', 'סימן שאפשר להמשיך'];
  const LABELS = [/^בשיחה שלך\s*[:：]\s*/, /^איך זה בא לידי ביטוי\s*[:：]\s*/, /^סימן שאפשר להמשיך\s*[:：]\s*/];
  const isSpikes = (m) => /SPIKES/.test(m.name || '');

  function stepsLine(m) {
    return m.name + ': ' + (m.steps || []).map((s) => s[0] + ' · ' + s[1] + ' (' + s[2] + ')').join(' ; ');
  }
  // opts.choose: לא נבחר מודל, והמודל בוחר אחד מהרשימה ואומר למה
  function rule(models, opts) {
    const list = (models || []).filter((m) => m && m.name);
    const choose = !!(opts && opts.choose);
    const names = choose ? '[שם המודל שבחרת]' : list.map((m) => m.name).join(' + ');
    return [
      choose ? 'לא נבחר מודל: בחרי מבין המודלים שלמטה את המתאים ביותר לשיחה הזאת, ובמשפט הפתיחה של החלק כתבי איזה מודל ולמה. השורות לפי השלבים של המודל שבחרת בלבד.' : '',
      '**' + TITLE + ': ' + (names || '[שם המודל]') + '** (כותרת בשורה משלה, בדיוק כך). זה לב התדריך והחלק המפורט ביותר בו, מיד אחרי "מה המטרה".',
      (choose ? 'המודלים ושלביהם:\n' : 'שלבי המודל, לפי הסדר:\n') + list.map(stepsLine).join('\n'),
      'בחלק הזה: משפט פתיחה אחד, למה המודל הזה מתאים לשיחה הזאת. אחריו שורה לכל שלב במודל, לפי הסדר, בדיוק בתבנית הזאת, ארבעה חלקים מופרדים בקו |:',
      '- <אות · שם השלב> (<מה השלב הזה במודל, בכמה מילים>) | בשיחה שלך: <מה בשיחה הזאת קשור לשלב הזה, מתוך מה שמולא: מה קרה, מי הצד השני ומה התכונות שלו, המטרה ומה מאתגר> | איך זה בא לידי ביטוי: <מה עושים ומה אומרים בשלב הזה, ומשפט לדוגמה במרכאות שמותאם לצד השני> | סימן שאפשר להמשיך: <מה רואים או שומעים מהצד השני>',
      list.some(isSpikes) ? (choose ? 'אם בחרת SPIKES: ' : '') + 'בשלב E (תגובה לרגש): אחרי השורה של השלב, שורה נפרדת באותה תבנית לכל אחד מחמשת רכיבי NURSE: N · לתת שם לרגש, U · להבין, R · לכבד, S · לתמוך, E · לברר עוד. בכל רכיב משפט לדוגמה משלו, לפי הרגש שצפוי לעלות בשיחה הזאת.' : '',
      !choose && list.length > 1 ? 'נבחר שילוב של מודלים: השורות לפי השלבים של המודל הראשון, ובכל שורה, בחלק "איך זה בא לידי ביטוי", איפה נכנס רכיב מהמודל השני. אחר כך שורה לכל שלב של המודל השני שעוד לא הופיע.' : '',
      'כל שורה ספציפית לשיחה הזאת ולצד השני הזה, לא הגדרה כללית של השלב. אחרי השורות משפט אחד: המודל הוא מסגרת ולא תסריט, ומה עושים כשהשיחה קופצת שלב או חוזרת אחורה.',
      'בשאר החלקים (איך לפתוח, שאלות המשך, אם השיחה מסתבכת, איך לסיים): בסוף כל הצעה, בסוגריים, לאיזה שלב במודל היא שייכת, למשל (שלב P: מה הצד השני יודע).',
    ].filter(Boolean).join('\n');
  }

  // ── התצוגה ──
  const HEADING = /^(?:#{1,6}\s*)?\*\*([^*]+)\*\*[:：]?$/;
  function split(text) { // החלק של המודל: שורות התבנית ושאר השורות
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    let on = false, title = ''; const rows = [], notes = [];
    for (const raw of lines) {
      const line = raw.trim(); const h = line.match(HEADING) || line.match(/^#{1,6}\s*(.+)$/);
      if (h) { const t = h[1].replace(/\*\*/g, '').trim(); if (on) break; if (t.startsWith(TITLE)) { on = true; title = t.replace(/[:：]$/, ''); } continue; }
      if (!on || !line) continue;
      const body = line.replace(/^(?:[-•*●▪–])\s+/, '');
      const parts = body.split(/\s*\|\s*/).map((x) => x.trim());
      if (parts.length >= 3) rows.push([parts[0], ...[1, 2, 3].map((i, j) => (parts[i] || '').replace(LABELS[j], ''))]);
      else notes.push(line);
    }
    return { title, rows, notes };
  }
  function render(text) {
    const D = root.SBE_DOC;
    const node = (D && D.sections(text)) || (D && D.rich(text));
    if (!node || !root.SBE_TABLE || !node.querySelector) return node;
    const { title, rows, notes } = split(text);
    if (rows.length < 2) return node;
    const tr = [...node.querySelectorAll('tr')].find((r) => { const th = r.querySelector('th'); return th && th.textContent.trim().startsWith(TITLE); });
    if (!tr) return node;
    const td = document.createElement('td'); td.colSpan = 2; td.className = 'sbe-model-part';
    const h = document.createElement('h4'); h.textContent = title; td.append(h);
    const cell = (t) => D.rich(t);
    const before = notes.filter((n, i) => i === 0 && !/^[-•*●▪–]\s/.test(n));
    if (before.length) td.append(D.rich(before.join('\n')));
    const stage = (t) => { const m = String(t).match(/^([^(]+?)\s*(\(.*\))?$/); return D.rich(m ? '**' + m[1].trim() + '**' + (m[2] ? ' ' + m[2] : '') : t); };
    td.append(root.SBE_TABLE(HEAD, rows.map((r) => [stage(r[0]), ...r.slice(1).map(cell)]), 'sbe-model-table'));
    const after = notes.filter((n) => !before.includes(n));
    if (after.length) td.append(D.rich(after.join('\n')));
    tr.replaceChildren(td);
    return node;
  }
  return Object.freeze({ TITLE, HEAD, rule, split, render });
});
