// מסמך שותפות למחקר: הנוסח הפותח והתצוגה (15/11/2026).
// "ודאי שזה יהיה מסמך ידידותי ומזמין לעבודה משותפת ולא משהו בסגנון משפטי מרתיע":
// כותבים כמו מכתב לעמית/ה, בגוף ראשון רבים, בשפה של הזמנה, ובלשון כוללת.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SBE_PDOC = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function draft(study) {
    const cfg = (study && study.config) || {};
    const title = cfg.title || 'המחקר המשותף שלנו';
    const pi = cfg.principalInvestigator || 'ד״ר יעל שדה';
    const il = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? Number(m[3]) + '.' + Number(m[2]) + '.' + m[1].slice(2) : String(v || ''); };
    const when = cfg.startDate || cfg.endDate ? 'מ־' + (il(cfg.startDate) || 'מועד שנקבע יחד') + ' עד ' + (il(cfg.endDate) || 'מועד שנקבע יחד') : 'לפי לוח הזמנים שנקבע יחד';
    return {
      title: 'מסמך שותפות: ' + title,
      studyId: (study && study.id) || '',
      studyTitle: title,
      fromName: pi,
      partnerName: '',
      partnerEmail: '',
      intro: 'שמחים מאוד שאנחנו יוצאים לדרך יחד. כתבנו כאן במילים פשוטות איך אנחנו רואים את העבודה המשותפת, כדי שיהיה לנו מקום אחד לחזור אליו. זו טיוטה פתוחה: כל מה שלא מתאים, לא ברור או חסר, אפשר לכתוב לנו ונעדכן יחד.',
      sections: [
        { id: 'why', title: 'למה אנחנו עושים את זה יחד', text: (cfg.description ? cfg.description + '\n\n' : '') + 'לכל אחד ואחת מאיתנו יש ידע, ניסיון וקשרים שהאחרים לא מביאים. כשמחברים אותם, המחקר נעשה עשיר יותר, ומה שנלמד ממנו יכול להגיע ליותר אנשים.' },
        { id: 'together', title: 'מה נעשה יחד', text: '- נתכנן יחד את שלבי המחקר ואת הכלים.\n- נאסוף את הנתונים ונעבור עליהם יחד.\n- נכתוב יחד את הממצאים ונשתף אותם.' },
        { id: 'bring', title: 'מה כל אחד ואחת מביאים', text: '**' + pi + ' ו־Begood:** הכלים במערכת, מרכז המחקר, התמיכה הטכנית והליווי לאורך הדרך.\n**השותפות והשותפים:** הידע בתחום, הקשר עם המשתתפים והשטח, והמבט המקצועי על הממצאים.' },
        { id: 'work', title: 'איך נעבוד ונחליט', text: '- ניפגש בקביעות, בתדירות שנוחה לכולנו, ונכתוב בקצרה מה הוחלט.\n- החלטות על שינויים במחקר נקבל יחד, בהסכמה.\n- מי שרואה קושי או רעיון חדש, מוזמן.ת להעלות אותו מוקדם, ונחפש יחד דרך.' },
        { id: 'credit', title: 'קרדיט ופרסום', text: '- כל מי שתורם.ת למחקר מקבל.ת קרדיט על התרומה שלו או שלה.\n- את סדר השמות בפרסומים נקבע יחד, לפי התרומה, עוד לפני שמתחילים לכתוב.\n- לפני כל פרסום, כל השותפות והשותפים רואים את הנוסח ויכולים להעיר.' },
        { id: 'care', title: 'שומרים על המשתתפים ועל הנתונים', text: '- המשתתפים בוחרים אם להשתתף, ויכולים להפסיק בכל רגע.\n- הנתונים נשמרים במרכז המחקר של Begood, וכל אחד ואחת מאיתנו רואים רק את מה שנדרש לעבודה שלנו.\n- לא משתפים פרטים מזהים של משתתפים מחוץ לצוות המחקר.' },
        { id: 'time', title: 'לוח זמנים ונקודות עצירה', text: 'המחקר מתוכנן ' + when + '.\nבכל שלב נעצור לרגע ונשאל: מה עובד, מה כדאי לשנות, ומה הצעד הבא.' },
        { id: 'change', title: 'אם משהו משתנה', text: 'החיים משתנים, וגם מחקרים. כל אחד ואחת מאיתנו יכולים לבקש לעדכן את המסמך, להוסיף אנשים לצוות או לשנות את חלוקת העבודה. נדבר על זה בפתיחות ונמצא יחד את מה שמתאים.' }
      ],
      closing: 'המסמך הזה הוא הסכמה בין שותפים לעבודה משותפת, לא חוזה משפטי. מחכים לעבוד יחד!'
    };
  }

  // טקסט פשוט להצגה: **מודגש**, שורות שמתחילות ב־"- " לתבליטים, ושורה ריקה בין פסקאות.
  function render(doc, text) {
    const frag = doc.createDocumentFragment();
    const blocks = String(text || '').split(/\n{2,}/);
    const inline = (el, line) => {
      const parts = String(line).split(/\*\*(.+?)\*\*/g);
      parts.forEach((p, i) => { if (!p) return; if (i % 2) { const b = doc.createElement('strong'); b.textContent = p; el.append(b); } else el.append(doc.createTextNode(p)); });
    };
    for (const block of blocks) {
      const lines = block.split('\n').filter((l) => l.trim());
      if (!lines.length) continue;
      let list = null;
      for (const line of lines) {
        if (/^\s*[-•]\s+/.test(line)) {
          if (!list) { list = doc.createElement('ul'); frag.append(list); }
          const li = doc.createElement('li'); inline(li, line.replace(/^\s*[-•]\s+/, '')); list.append(li);
        } else { list = null; const p = doc.createElement('p'); inline(p, line); frag.append(p); }
      }
    }
    return frag;
  }

  const STATUS = { draft: 'טיוטה, עוד לא נשלח', sent: 'נשלח, מחכים לתגובה', changes: 'יש שאלה או הצעה', approved: 'אושר' };
  return Object.freeze({ draft, render, STATUS });
});
