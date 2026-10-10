// נוהל עבודה בכלים שלכם (10/10/2026: "יש הרבה כלים והרבה נהלים. אתה צריך לתת מענה לזה").
// סביבת עבודה ב-Begood לא שומרת את העבודה המשותפת בשרת. היא מציעה נוהל לעבודה בכלים שכבר יש למוסד, ומלווה אותו.
// המענה לריבוי הכלים: שלד קבוע שמתאים לכל כלי, ולא נוהל נפרד לכל כלי:
//   מה יש לנו (המידע בסביבת העבודה) · רמת הפרטיות של כל פריט · איפה הוא נמצא בכלים שבחרו · מי מעדכן ומתי
//   · מה לא נכנס לשם לעולם · איך מעבירים הלאה כשמתחלפים · מה לברר מול בית הספר · ובדיקה תקופתית של הנוהל.
// סוג הכלי נבחר לפי מה שהוא עושה (תיקייה, גיליון, מערכת בית הספר, קבוצת הודעות, לוח בכיתה...), ולא לפי שם מסחרי,
// ואפשר לכתוב כלי אחר או לבחור "עוד לא יודעת". SBE_PROC.mount(node, { state, save, items, context, kind }).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_PROC = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TOOL_TYPES = [
    { k: 'folder', n: 'תיקייה משותפת בענן', ex: 'למשל Google Drive, OneDrive או SharePoint' },
    { k: 'sheet', n: 'גיליון משותף', ex: 'למשל Google Sheets או Excel' },
    { k: 'doc', n: 'מסמך משותף', ex: 'למשל Google Docs או Word' },
    { k: 'school', n: 'מערכת בית הספר', ex: 'מערכת הציונים, הנוכחות וההודעות של בית הספר' },
    { k: 'class', n: 'כיתה מקוונת', ex: 'למשל Google Classroom, Teams או Moodle' },
    { k: 'chat', n: 'קבוצת הודעות', ex: 'למשל WhatsApp או Telegram' },
    { k: 'mail', n: 'דואר אלקטרוני', ex: 'רשימת תפוצה של הצוות או של ההורים' },
    { k: 'board', n: 'לוח מודפס בכיתה', ex: 'לוח מודעות, דף על הקיר' },
    { k: 'binder', n: 'קלסר או מחברת', ex: 'תיק סגור בחדר המורים או בכיתה' },
    { k: 'unsure', n: 'עוד לא יודעת: עזרו לי לבחור', ex: 'הנוהל יציע אפשרויות ושאלות לבירור' }
  ];
  const LEVELS = ['פתוח לקבוצה', 'לצוות בלבד', 'רגיש: במכשיר או בתיק סגור בלבד'];
  const SHAPE = '{"title":"","map":[{"item":"","level":"","where":"","who":"","when":""}],"structure":[{"name":"","what":""}],' +
    '"roles":[{"role":"","can":"","does":""}],"never":[""],"handover":[""],"ask":[""],"start":[""],"check":{"every":"","questions":[""]}}';
  function system(kind) {
    return [
      'את כותבת "נוהל עבודה בכלים שלכם" ל' + (kind === 'continuity' ? 'תיק רציפות של מחנכת (שגרה, חירום, הצטרפות וחזרה)' : 'מנגנון חברתי קבוע בכיתה (מועצה, לוח עזרה, ועדה, צוות פעולה)') +
        ' ב-Begood. Begood לא שומרת את העבודה המשותפת. הנוהל אומר איך לעבוד בכלים שכבר יש למוסד, כך שהעבודה תימשך, תהיה שקופה, ותעבור הלאה כשמישהו מתחלף.',
      'הנוהל בנוי על שלד קבוע שמתאים לכל כלי: מה יש לנו · רמת הפרטיות · איפה זה נמצא · מי מעדכן ומתי · מה לא נכנס לעולם · איך מעבירים הלאה · מה לברר · בדיקה תקופתית. אל תניחי פרטים על כלי מסחרי מסוים (תפריטים, כפתורים): כתבי ברמה שמתאימה לכל כלי מהסוג שנבחר.',
      'רמות פרטיות: ' + LEVELS.join(' · ') + '. פריט שמסומן "רגיש" (מידע רפואי ונפשי, פרטי הורים, רשימת תלמידים עם פרטים, מענה פרטני, סיבות היעדרות, שמות בתיעוד) נשאר במכשיר של המחנכת או בתיק סגור, ולעולם לא בקבוצת הודעות, בלוח בכיתה או בכלי שתלמידים רואים. כשתלמידים משתתפים: רק פריטים "פתוח לקבוצה", ורק בכלי שמתאים לגיל (לוח מודפס או מסמך פתוח לצפייה, לא קבוצת הודעות של קטינים).',
      'אם נבחר "עוד לא יודעת": הציעי שתי אפשרויות פשוטות (למשל לוח מודפס בכיתה ועוד תיקייה משותפת לצוות), והכניסי ל-ask את מה שכדאי לברר מול בית הספר.',
      'החלקים:',
      '- map: לכל פריט ברשימה שנמסרה {item, level: אחת מרמות הפרטיות, where: באיזה כלי ובאיזה מקום בתוכו (למשל "גיליון: לשונית לוח ביצוע"), who: מי מעדכן (תפקיד, עדיף מתחלף), when: מתי מעדכנים}.',
      '- structure: 3 עד 6 שורות של מבנה שמתאים לכלים שנבחרו {name: שם תיקייה, לשונית, עמודה או אזור בלוח, what: מה נמצא שם}. שמות פשוטים וקבועים, עם תאריך בפורמט 10.10.26.',
      '- roles: 2 עד 4 תפקידים {role, can: מה רואים ומה עורכים, does: מה עושים}. המבוגר האחראי מאשר שינויים ומחזיק את ההרשאות.',
      '- never: 3 עד 5 דברים שלא נכנסים לכלים המשותפים, בניסוח חיובי של מה עושים במקום.',
      '- handover: 3 או 4 צעדים למסירה כשמישהו מתחלף (העברת הרשאה, עדכון אנשי קשר, הסרת גישה למי שעזב).',
      '- ask: 3 עד 5 שאלות לברר מול בית הספר (אילו כלים מאושרים, מי נותן הרשאות, כמה זמן שומרים מידע, מה מותר לשתף עם הורים ותלמידים).',
      '- start: 3 צעדים ראשונים, קטנים, לשבוע הקרוב.',
      '- check: every (כל כמה זמן בודקים את הנוהל, למשל "פעם בחודש"), questions: 3 או 4 שאלות לבדיקה (האם כולם יודעים איפה הדברים, האם משהו רגיש נכנס למקום משותף, האם מישהו עזב ועדיין יש לו גישה).',
      '- title: שם קצר, למשל "נוהל עבודה: לוח עזרה בגיליון ובלוח בכיתה".',
      'כתבי בעברית פשוטה ובמשפטים קצרים. בלי שמות של אנשים. החזירי אך ורק JSON במבנה הזה: ' + SHAPE
    ].join('\n\n');
  }
  function reviseSystem(kind) {
    return system(kind) + '\n\nעכשיו מעדכנים את הנוהל: המחנכת בדקה אותו בפועל וכתבה מה עבד ומה לא. עדכני רק את מה שעלה, ושמרי את השאר. הוסיפי לשורש ה-JSON "changes": [{"where":"","what":""}].';
  }
  const arr = (x) => Array.isArray(x) ? x : [];
  const valid = (o) => !!(o && arr(o.map).length && arr(o.never).length && arr(o.handover).length);
  function text(p) {
    if (!p) return '';
    const L = [txt(p.title), ''];
    L.push('מה נמצא איפה:'); arr(p.map).forEach((m) => L.push('- ' + m.item + ' · ' + m.level + ' · ' + m.where + ' · ' + m.who + ' · ' + m.when));
    if (arr(p.structure).length) { L.push('', 'המבנה:'); p.structure.forEach((s) => L.push('- ' + s.name + ': ' + s.what)); }
    L.push('', 'מה לא נכנס לכלים המשותפים:'); arr(p.never).forEach((x) => L.push('- ' + x));
    L.push('', 'כשמישהו מתחלף:'); arr(p.handover).forEach((x, i) => L.push((i + 1) + '. ' + x));
    if (p.check) { L.push('', 'בודקים את הנוהל ' + (p.check.every || '') + ':'); arr(p.check.questions).forEach((x) => L.push('- ' + x)); }
    return L.join('\n');
  }
  function txt(x) { return (typeof window !== 'undefined' && window.SBE_REFS) ? window.SBE_REFS.strip(String(x == null ? '' : x)) : String(x == null ? '' : x); }

  // ── המסך ──
  function mount(node, opts) {
    const S = opts.state, save = opts.save || function () {};
    if (!S.tools) S.tools = []; if (!S.checks) S.checks = [];
    const SERVER = window.sbeAIOrigin ? window.sbeAIOrigin() : 'https://sbe-server.onrender.com';
    const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = String(x); return n; };
    const btn = (t, c, f) => { const b = el('button', c || 'btn btn-ghost sm', t); b.type = 'button'; if (f) b.addEventListener('click', f); return b; };
    const T = (cols, rows) => window.SBE_TABLE(cols, rows, 'kit-t');
    const why = (e) => (e && e.code === 'incomplete') ? 'הנוהל חזר חלקי. אפשר לנסות שוב.' : 'אין כרגע חיבור למודל, ולכן הנוהל לא הוכן. מה שבחרתם נשמר, ואפשר לנסות שוב בעוד דקה.';
    function waiting(n, t, exp) { n.hidden = false; const t0 = Date.now(); const tick = () => { n.textContent = t + ' בדרך כלל ' + exp + ' שניות. עברו ' + Math.round((Date.now() - t0) / 1000) + ' שניות.'; }; tick(); const iv = setInterval(tick, 1000); return () => { clearInterval(iv); n.hidden = true; }; }
    async function make(b, err, wait, revise) {
      err.hidden = true;
      if (!S.tools.length && !(S.other || '').trim()) { err.textContent = 'כדי להמשיך, בחרו באילו כלים אתם עובדים (אפשר גם "עוד לא יודעת").'; err.hidden = false; return; }
      const tools = TOOL_TYPES.filter((t) => S.tools.includes(t.k)).map((t) => t.n).concat((S.other || '').trim() ? ['כלי אחר: ' + S.other.trim()] : []);
      const last = S.checks[0];
      const content = 'הכלים שבהם המוסד עובד: ' + tools.join('; ') + '\nמי משתמש: ' + (S.who || 'לא צוין') +
        '\n\nהפריטים בסביבת העבודה (רשימה קבועה; פריט עם "רגיש" נשאר רגיש):\n' + opts.items().map((x) => '- ' + x).join('\n') +
        (opts.context ? '\n\nהקשר:\n' + opts.context() : '') +
        (revise && S.proc ? '\n\nהנוהל הנוכחי (JSON):\n' + JSON.stringify(S.proc) + '\n\nמה עלה בבדיקה:\n' + (last ? last.answers.map((a, i) => (S.proc.check.questions[i] || '') + ': ' + a).join('\n') + '\n' + (last.note || '') : '[לא נכתב]') : '') +
        '\n\n' + (revise ? 'עדכני את הנוהל.' : 'כתבי את הנוהל.');
      b.disabled = true; const stop = waiting(wait, revise ? 'מעדכנת את הנוהל.' : 'כותבת נוהל עבודה בכלים שבחרת.', 45);
      let k = null, bad = null;
      try { k = await window.sbeCallAIJson(SERVER, { system: revise ? reviseSystem(opts.kind) : system(opts.kind), messages: [{ role: 'user', content }], maxTokens: 4000, customerReview: true }, 180000, valid); }
      catch (e) { bad = e; } finally { stop(); b.disabled = false; }
      if (!valid(k)) { err.textContent = why(bad); err.hidden = false; return; }
      S.changes = arr(k.changes); delete k.changes; S.proc = k; S.version = (S.version || 0) + 1;
      if (!S.nextCheck && window.sbeIsoPlus) S.nextCheck = window.sbeIsoPlus(30); save(); draw();
    }
    function draw() {
      node.textContent = '';
      node.appendChild(el('p', 'hint', 'נוהל לעבודה בכלים שכבר יש לכם: מה נמצא איפה, מי מעדכן, מה לא נכנס לשם, ואיך מעבירים הלאה כשמישהו מתחלף.'));
      const pick = el('div', 'proc-tools');
      TOOL_TYPES.forEach((t) => { const l = el('label', 'proc-tool'), c = el('input'); c.type = 'checkbox'; c.checked = S.tools.includes(t.k);
        c.addEventListener('change', () => { S.tools = c.checked ? S.tools.concat(t.k) : S.tools.filter((x) => x !== t.k); save(); });
        l.append(c, el('b', null, ' ' + t.n)); l.appendChild(el('span', 'proc-ex', t.ex)); pick.appendChild(l); });
      node.appendChild(el('h4', null, 'באילו כלים אתם עובדים? (אפשר כמה)')); node.appendChild(pick);
      const row = el('div', 'grid2');
      const o = el('div', 'f'); o.appendChild(el('label', null, 'כלי אחר')); const oi = el('input'); oi.type = 'text'; oi.value = S.other || ''; oi.placeholder = 'שם או תיאור של כלי שלא ברשימה'; oi.addEventListener('input', () => { S.other = oi.value; save(); }); o.appendChild(oi);
      const w = el('div', 'f'); w.appendChild(el('label', null, 'מי משתמש')); const ws = el('select'); ws.setAttribute('data-closed', '');
      ['', 'רק אני', 'אני והצוות', 'הצוות והתלמידים', 'הצוות, התלמידים וההורים'].forEach((x) => ws.appendChild(new Option(x || 'בחירה…', x))); ws.value = S.who || ''; ws.addEventListener('change', () => { S.who = ws.value; save(); }); w.appendChild(ws);
      row.append(o, w); node.appendChild(row);
      const err = el('p', 'err'); err.hidden = true; const wait = el('div', 'wait'); wait.hidden = true;
      const go = btn(S.proc ? 'כתיבה מחדש' : 'כתיבת הנוהל', S.proc ? 'btn btn-ghost sm' : 'btn', () => make(go, err, wait, false));
      node.append(go, wait, err);
      const p = S.proc; if (!p) return;
      const doc = el('div', 'proc-doc'); node.appendChild(doc);
      doc.appendChild(el('h4', null, txt(p.title) + ' · גרסה ' + (S.version || 1)));
      if (arr(S.changes).length) doc.appendChild(T(['איפה', 'מה השתנה'], S.changes.map((c) => [txt(c.where), txt(c.what)])));
      doc.appendChild(el('h4', null, 'מה נמצא איפה'));
      doc.appendChild(T(['מה', 'רמת פרטיות', 'איפה', 'מי מעדכן/ת', 'מתי'], arr(p.map).map((m) => { const lv = el('span', 'lvl ' + (/רגיש/.test(m.level) ? 'l3' : /צוות/.test(m.level) ? 'l2' : 'l1'), txt(m.level)); return [txt(m.item), lv, txt(m.where), txt(m.who), txt(m.when)]; })));
      if (arr(p.structure).length) { doc.appendChild(el('h4', null, 'המבנה')); doc.appendChild(T(['השם', 'מה נמצא שם'], p.structure.map((s) => [txt(s.name), txt(s.what)]))); }
      if (arr(p.roles).length) { doc.appendChild(el('h4', null, 'מי עושה מה')); doc.appendChild(T(['התפקיד', 'מה רואים ועורכים', 'מה עושים'], p.roles.map((r) => [txt(r.role), txt(r.can), txt(r.does)]))); }
      const lists = [['מה לא נכנס לכלים המשותפים', p.never], ['כשמישהו מתחלף', p.handover], ['מה לברר מול בית הספר', p.ask], ['שלושה צעדים לשבוע הקרוב', p.start]];
      doc.appendChild(T(['', ''].map((x, i) => i ? 'מה עושים' : 'החלק'), lists.concat(p.check ? [['בודקים את הנוהל ' + txt(p.check.every), p.check.questions]] : []).filter((l) => arr(l[1]).length).map(([h, xs]) => { const u = el('ul'); xs.forEach((x) => u.appendChild(el('li', null, txt(x)))); return [h, u]; })));
      const acts = el('div', 'actions no-print');
      const cp = btn('📋 העתקת הנוהל (להדבקה בראש התיקייה או הגיליון)', 'btn btn-ghost sm', () => { const t = text(p); try { navigator.clipboard.writeText(t).then(() => { cp.textContent = '✓ הועתק'; }, () => prompt('להעתקה:', t)); } catch (e) { prompt('להעתקה:', t); } });
      acts.append(cp, btn('🖨 הדפסת הנוהל', 'btn btn-ghost sm', () => { const out = doc.cloneNode(true); window.SBE_DOC.print({ title: txt(p.title), subtitle: 'גרסה ' + (S.version || 1), kind: 'נוהל עבודה בכלים שלכם', node: out }); }));
      node.appendChild(acts);
      // ליווי: בדיקה תקופתית של הנוהל
      if (p.check) {
        node.appendChild(el('h4', null, 'בדיקה של הנוהל ' + txt(p.check.every)));
        const d = el('div', 'f no-print'); d.appendChild(el('label', null, 'הבדיקה הבאה')); const di = el('input'); di.type = 'date'; di.value = S.nextCheck || ''; di.addEventListener('change', () => { S.nextCheck = di.value; save(); }); d.appendChild(di); node.appendChild(d);
        const cur = { answers: arr(p.check.questions).map(() => ''), note: '' };
        node.appendChild(T(['השאלה', 'מה עולה'], arr(p.check.questions).map((q, i) => { const s = el('select'); s.setAttribute('data-closed', ''); ['', 'כן', 'בחלקו', 'לא'].forEach((x) => s.appendChild(new Option(x || 'בחירה…', x))); s.setAttribute('aria-label', q); s.addEventListener('change', () => { cur.answers[i] = s.value; }); return [txt(q), s]; })));
        const nt = el('textarea'); nt.rows = 2; nt.placeholder = 'מה עבד ומה לא, בלי שמות.'; nt.setAttribute('aria-label', 'הערות לבדיקה'); nt.addEventListener('input', () => { cur.note = nt.value; }); node.appendChild(nt);
        const e2 = el('p', 'err'); e2.hidden = true; const w2 = el('div', 'wait'); w2.hidden = true;
        const sv = btn('💾 שמירת הבדיקה', 'btn btn-ghost sm', () => { S.checks.unshift({ at: new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }), answers: cur.answers, note: cur.note }); if (window.sbeIsoPlus) S.nextCheck = window.sbeIsoPlus(30); save(); draw(); });
        const up = btn('עדכון הנוהל לפי הבדיקה', 'btn sm', () => { if (!S.checks.length) { e2.textContent = 'כדי לעדכן, שמרו קודם בדיקה אחת.'; e2.hidden = false; return; } make(up, e2, w2, true); });
        const r = el('div', 'actions no-print'); r.append(sv, up); node.append(r, w2, e2);
        if (S.checks.length) node.appendChild(T(['תאריך', 'מה עלה'], S.checks.map((c) => [c.at, c.answers.filter(Boolean).join(' · ') + (c.note ? ' · ' + c.note : '')])));
      }
    }
    draw();
  }
  return { TOOL_TYPES, LEVELS, system, reviseSystem, valid, text, mount };
});
