// מעבר לטופס גוגל (11/10/2026: "הוסף הנחיה להעביר את השאלון לגוגלפורם, ואם יש לך דרך לעשות זאת, הוסף כפתור").
// Begood לא נכנסת לחשבון הגוגל של המורה ולא שולחת דבר למשפחות. לכן הכפתור מכין קוד קצר של Google Apps Script:
// מעתיקים, מדביקים בדף הסקריפטים של גוגל, מריצים, והטופס נוצר בחשבון של המורה עם כל השאלות. התשובות נשמרות שם.
// SBE_GFORM.script(spec) — הקוד. spec: { title, description, questions:[{q, opts}], closing, childName }
// SBE_GFORM.button(spec | () => spec, label) — כפתור שפותח חלון עם ההנחיה, הקוד, העתקה וקישור לדף הסקריפטים.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_GFORM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const BLANK = /^[\s_.:\-–]*$/;
  // אפשרות "אחר: ____" הופכת ל"אחר" של גוגל; שאלה שכל האפשרויות בה קווים ריקים הופכת לתשובה פתוחה
  function normQ(q) {
    const opts = (q.opts || []).map((o) => String(o || '').trim()).filter(Boolean);
    const isOther = (o) => /^(אחר|אחרת)(?![\u0590-\u05FF])/.test(o) && /_|:/.test(o);
    const other = opts.some(isOther);
    const blanks = opts.filter((o) => BLANK.test(o)).length;
    const real = opts.filter((o) => !BLANK.test(o) && !isOther(o)).map((o) => o.replace(/_{2,}/g, '').replace(/:\s*$/, '').trim()).filter(Boolean);
    // שאלה שרובה קווים למילוי (למשל "מי בקשר איתי?") היא תשובה פתוחה
    return real.length && blanks < real.length ? { q: String(q.q || '').trim(), opts: real, other } : { q: String(q.q || '').trim(), text: true };
  }
  function script(spec) {
    const s = spec || {};
    const data = {
      title: String(s.title || 'שאלון').trim(),
      description: String(s.description || '').trim(),
      childName: s.childName !== false,
      questions: (s.questions || []).filter((q) => q && String(q.q || '').trim()).map(normQ),
      closing: String(s.closing || '').trim()
    };
    return [
      '// טופס גוגל מתוך Begood. מריצים פעם אחת: בתפריט למעלה בוחרים createForm ולוחצים "הפעלה" (Run).',
      '// בהרצה הראשונה גוגל מבקש אישור ליצור טופס בחשבון. הקישור לטופס יופיע ביומן הביצוע (Execution log).',
      'var DATA = ' + JSON.stringify(data, null, 1) + ';',
      '',
      'function createForm() {',
      '  var form = FormApp.create(DATA.title);',
      '  form.setDescription(DATA.description);',
      '  form.setCollectEmail(false);',
      "  if (DATA.childName) form.addTextItem().setTitle('השם הפרטי של הילד או הילדה').setRequired(false);",
      '  DATA.questions.forEach(function (q) {',
      '    if (q.text) { form.addParagraphTextItem().setTitle(q.q).setRequired(false); return; }',
      '    var item = form.addCheckboxItem().setTitle(q.q).setChoiceValues(q.opts).setRequired(false);',
      '    if (q.other) item.showOtherOption(true);',
      '  });',
      '  if (DATA.closing) form.setConfirmationMessage(DATA.closing);',
      "  Logger.log('הקישור לשליחה למשפחות: ' + form.getPublishedUrl());",
      "  Logger.log('הקישור לעריכת הטופס ולתשובות: ' + form.getEditUrl());",
      '}'
    ].join('\n');
  }
  const STEPS = [
    'לוחצים "העתקת הקוד".',
    'לוחצים "פתיחת דף הסקריפטים של גוגל", ונכנסים בחשבון הגוגל של בית הספר.',
    'מוחקים את מה שכתוב שם, ומדביקים את הקוד (Ctrl+V).',
    'לוחצים על סמל השמירה, ואז "הפעלה" (Run). בפעם הראשונה גוגל מבקש אישור: "Review permissions", בוחרים את החשבון ומאשרים.',
    'למטה, ביומן הביצוע (Execution log), מופיעים שני קישורים: לשליחה למשפחות, ולעריכת הטופס ולתשובות.'
  ];
  const MANUAL = 'אפשר גם בלי קוד: פותחים forms.google.com, יוצרים טופס ריק, ומעתיקים אליו את השאלות מהכרטיס. לכל שאלה בוחרים "תיבות סימון", ואת "אחר" מוסיפים בלחיצה על "הוספת אפשרות אחר".';
  const PRIVACY = 'הטופס והתשובות נשמרים בחשבון הגוגל שבו הטופס נוצר, ולא ב-Begood. מומלץ חשבון של בית הספר, בלי שאלות על מידע רגיש, ובקשת שם פרטי בלבד.';

  function button(spec, label) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost sm';
    b.textContent = label || '📝 העברה לטופס גוגל';
    b.addEventListener('click', () => open(typeof spec === 'function' ? spec() : spec));
    return b;
  }
  function open(spec) {
    const code = script(spec);
    const d = document.createElement('dialog');
    d.setAttribute('dir', 'rtl');
    d.style.cssText = 'margin:auto;inset:0;max-height:90vh;max-width:720px;width:94vw;border:1px solid #ccd;border-radius:14px;padding:0;font:inherit';
    const mk = (t, cls, txt, css) => { const n = document.createElement(t); if (cls) n.className = cls; if (txt != null) n.textContent = txt; if (css) n.style.cssText = css; return n; };
    const head = mk('div', null, null, 'padding:12px 16px;border-bottom:1px solid #dde;font-weight:700;display:flex;justify-content:space-between;align-items:center');
    head.append(mk('span', null, '📝 העברת השאלון לטופס גוגל'));
    const x = mk('button', 'btn btn-ghost sm', 'סגירה'); x.type = 'button'; x.onclick = () => { d.close(); d.remove(); }; head.append(x);
    const body = mk('div', null, null, 'padding:12px 16px;max-height:72vh;overflow:auto;line-height:1.6');
    body.append(mk('p', null, 'כך נוצר טופס גוגל עם כל השאלות, בחשבון הגוגל של בית הספר:'));
    const ol = mk('ol', null, null, 'padding-inline-start:1.3rem;margin:.3rem 0 .7rem'); STEPS.forEach((t) => ol.append(mk('li', null, t))); body.append(ol);
    const row = mk('div', null, null, 'display:flex;flex-wrap:wrap;gap:.5rem;margin:.4rem 0 .7rem');
    const cp = mk('button', 'btn sm', '📋 העתקת הקוד'); cp.type = 'button';
    cp.onclick = async () => { try { await navigator.clipboard.writeText(code); cp.textContent = '✓ הקוד הועתק'; } catch (e) { ta.select(); document.execCommand('copy'); cp.textContent = '✓ הקוד הועתק'; } };
    const go = mk('a', 'btn btn-ghost sm', '↗ פתיחת דף הסקריפטים של גוגל'); go.href = 'https://script.google.com/home/projects/create'; go.target = '_blank'; go.rel = 'noopener';
    row.append(cp, go); body.append(row);
    body.append(mk('p', null, PRIVACY, 'font-size:.9rem;background:#FCF0D6;border-radius:10px;padding:.5rem .7rem'));
    const det = mk('details'); det.append(mk('summary', null, 'הקוד', 'cursor:pointer;font-weight:600'));
    const ta = mk('textarea', null, null, 'width:100%;height:220px;direction:ltr;font:12px/1.4 monospace;margin-top:.4rem'); ta.readOnly = true; ta.value = code; det.append(ta); body.append(det);
    body.append(mk('p', 'muted', MANUAL, 'font-size:.88rem;margin-top:.7rem'));
    d.append(head, body); document.body.append(d); d.showModal();
    d.addEventListener('close', () => d.remove());
    return d;
  }
  return { script, button, open, normQ, STEPS, PRIVACY };
});
