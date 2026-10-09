// תיק רציפות: המסך (app/continuity-kit.html). ההנחיות למודל ומבנה התיק ב-lib/continuity-model.js (SBE_CONT).
// שלושה צעדים, אחד בכל פעם: 1 מספרים · 2 התיק · 3 עמיתה מנסה ומתקנים.
// בלי חיבור למודל אין תוצר. הטופס והתיק נשמרים במכשיר בלבד, לפי משתמש/ת (sbeUserKey).
(function () {
  'use strict';
  const C = window.SBE_CONT, SRC = window.SBE_ADVISOR_SOURCES;
  const KB = SRC.forAdvisor('continuity');
  const WRITER = window.SBE_WRITER ? window.SBE_WRITER.rule : '';
  const STORE = window.sbeUserKey ? sbeUserKey('sbe.continuity.v1') : 'sbe.continuity.v1:anon';
  const F = (id) => document.getElementById(id);
  const NO_MODEL = 'אין כרגע חיבור למודל, ולכן התיק לא הוכן. המערכת לא בונה תיק מהשדות במקום תוצר אמיתי. מה שמילאת נשמר, ואפשר לנסות שוב בעוד דקה או שתיים.';
  try { const h = sessionStorage.getItem('sbe.session.homeUrl'); if (h) F('nav-home').href = h; } catch (e) {}
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }

  let S = { form: {}, kit: null, version: 0, at: '', history: [] };
  try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && v.form) S = Object.assign(S, v); } catch (e) {}
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }

  // ── הטופס ──
  const form = F('form');
  const grid = el('div', 'grid2');
  C.FIELDS.forEach((f) => {
    const box = el('div', 'f'), id = 'f-' + f.k, label = el('label', null, f.l);
    label.htmlFor = id;
    if (f.main) label.appendChild(el('span', 'main-tag', 'שדה עיקרי'));
    box.appendChild(label);
    let input;
    if (f.type === 'select') {
      input = el('select'); input.appendChild(new Option('בחירה…', ''));
      f.opts.forEach((o) => input.appendChild(new Option(o, o)));
    } else if (f.type === 'area') { input = el('textarea'); input.maxLength = 3000; }
    else { input = el('input'); input.type = 'text'; input.maxLength = 300; }
    input.id = id; if (f.ph) input.placeholder = f.ph;
    const v = S.form[f.k];
    if (v) { if (f.type === 'select' && ![...input.options].some((o) => o.value === v)) input.appendChild(new Option(v, v)); input.value = v; }
    input.addEventListener('input', () => { S.form[f.k] = input.value; save(); });
    input.addEventListener('change', () => { S.form[f.k] = input.value; save(); });
    box.appendChild(input);
    if (f.k === 'support') box.appendChild(el('p', 'privacy', 'בלי שמות מלאים של תלמידים ובלי מידע רפואי או אישי רגיש. תיאור כללי מספיק לממלאת המקום.'));
    (f.type === 'area' || f.k === 'update' ? form : grid).appendChild(box);
    if (f.k === 'group') form.appendChild(grid);
  });
  if (!grid.parentNode) form.prepend(grid);
  function readForm() { const d = {}; C.FIELDS.forEach((f) => { d[f.k] = (F('f-' + f.k).value || '').trim(); }); return d; }

  // ── צעדים ──
  function goStep(n) {
    [1, 2, 3].forEach((i) => { F('s' + i).hidden = i !== n; });
    document.querySelectorAll('#steps li').forEach((li) => {
      const i = +li.dataset.step; li.classList.toggle('on', i === n); li.classList.toggle('done', i < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('#steps li').forEach((li) => li.addEventListener('click', () => {
    const n = +li.dataset.step; if (n > 1 && !S.kit) return; goStep(n);
  }));

  // ── המתנה: כמה זמן זה לוקח בדרך כלל, כמה עבר, ופס התקדמות ──
  function waiting(node, text, exp) {
    node.hidden = false; node.textContent = '';
    const line = el('div'), bar = el('div', 'bar'), fill = el('div'); bar.appendChild(fill); node.append(line, bar);
    const t0 = Date.now();
    const tick = () => { const s = Math.round((Date.now() - t0) / 1000); line.textContent = text + ' בדרך כלל ' + exp + ' שניות. עברו ' + s + ' שניות.'; fill.style.width = Math.min(95, s / exp * 90) + '%'; };
    tick(); const iv = setInterval(tick, 1000);
    return () => { clearInterval(iv); node.hidden = true; };
  }
  async function ask(system, content) {
    return String(await window.sbeCallAI(window.sbeAIOrigin ? window.sbeAIOrigin() : 'https://sbe-server.onrender.com', { system, messages: [{ role: 'user', content }], maxTokens: 7000, customerReview: true }, 300000) || '');
  }

  // ── התיק ──
  const today = () => new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  function txt(x) { return window.SBE_REFS ? SBE_REFS.strip(String(x == null ? '' : x)) : String(x || ''); }
  function list(xs) { const u = el('ul'); (xs || []).filter(Boolean).forEach((x) => u.appendChild(el('li', null, txt(x)))); return u; }
  function section(root, key, node) {
    const sec = C.SECTIONS[key]; root.appendChild(el('h3', null, sec.h));
    if (sec.sub) root.appendChild(el('p', 'sub', sec.sub));
    root.appendChild(node);
  }
  function renderKit(k) {
    const root = el('div', 'kit');
    if (window.SBE_REFS) SBE_REFS.begin(SRC, 'resilience-advisor-sources.html');
    root.appendChild(el('h2', 'no-print', txt(k.title) || 'תיק רציפות')); // בהדפסה הכותרת כבר בראש המסמך
    root.appendChild(el('p', 'kit-meta', 'גרסה ' + S.version + ' · עודכן ' + (S.at || today()) + (S.form.update ? ' · עדכון הבא: ' + S.form.update : '')));
    const T = (key, rows) => window.SBE_TABLE(C.SECTIONS[key].cols, rows, 'kit-t');
    section(root, 'opening', window.SBE_TABLE(null, (k.opening || []).map((r) => [txt(r.h), txt(r.t)]), 'kit-t'));
    section(root, 'routines', T('routines', (k.routines || []).map((r) => [txt(r.name), txt(r.when), txt(r.what), txt(r.helpers)])));
    if ((k.roles || []).length) section(root, 'roles', T('roles', k.roles.map((r) => [txt(r.role), txt(r.who), txt(r.backup), txt(r.update)])));
    const d = k.decisions || {};
    if ((d.self || []).length || (d.consult || []).length || (d.wait || []).length)
      section(root, 'decisions', T('decisions', [[list(d.self), list((d.consult || []).map((c) => [c.what, c.whom && '(' + c.whom + ')'].filter(Boolean).join(' '))), list(d.wait)]]));
    if ((k.moments || []).length) section(root, 'moments', T('moments', k.moments.map((m) => [txt(m.if), window.SBE_DOC.rich(txt(m.then))])));
    if (k.classTalk) section(root, 'classTalk', el('div', 'talk', txt(k.classTalk)));
    section(root, 'trial', T('trial', (k.trial || []).map((t) => [txt(t.task), txt(t.check), el('span', 'fill', '\u00a0')]))); // תא ריק למילוי בדף המודפס
    if (k.upkeep) section(root, 'upkeep', T('upkeep', [[txt(k.upkeep.who), txt(k.upkeep.when) || S.form.update || '', txt(k.upkeep.how)]]));
    if (k.resilience) section(root, 'resilience', el('p', null, txt(k.resilience)));
    if (window.SBE_REFS) { SBE_REFS.add(k.sources || []); const rs = SBE_REFS.end(); if (rs) root.appendChild(rs); }
    return root;
  }
  function showKit() {
    const box = F('kit'); box.textContent = '';
    box.appendChild(window.SBE_DOC.editable(renderKit(S.kit)));
  }

  function fail(errNode, msg) { errNode.textContent = msg; errNode.hidden = false; }
  F('go').addEventListener('click', async () => {
    const d = readForm(); S.form = d; save();
    const missing = C.FIELDS.filter((f) => f.main && !d[f.k]).map((f) => f.l);
    F('err1').hidden = true;
    if (missing.length) return fail(F('err1'), 'כדי להמשיך, נשמח למלא: ' + missing.join(', ') + '.');
    const b = F('go'); b.disabled = true;
    const stop = waiting(F('wait1'), 'מכינה את התיק ובודקת שהוא ברור.', 90);
    let k = null;
    try { k = C.parse(await ask(C.system(KB, WRITER), 'השדות:\n' + C.inputText(d) + '\n\nהכיני את תיק הרציפות.')); }
    catch (e) { console.warn('תיק רציפות:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!C.valid(k)) return fail(F('err1'), NO_MODEL);
    S.kit = k; S.version = (S.version || 0) + 1; S.at = today(); S.history = []; save();
    showKit(); goStep(2);
  });
  F('print').addEventListener('click', () => {
    const node = F('kit').firstElementChild; if (!node) return;
    window.SBE_DOC.print({ title: (txt(S.kit.title) || '').replace(/^תיק רציפות:?\s*/, '') || S.form.group || 'תיק רציפות', subtitle: [S.form.kitFor, S.form.receiver].filter(Boolean).join(' · ') + ' · גרסה ' + S.version, kind: 'תיק הפעלה', node });
  });
  F('toTrial').addEventListener('click', () => goStep(3));
  F('back1').addEventListener('click', () => goStep(1));
  F('back2').addEventListener('click', () => goStep(2));
  F('revise').addEventListener('click', async () => {
    const note = F('trialNote').value.trim(); F('err3').hidden = true;
    if (!note) return fail(F('err3'), 'כדי לתקן, נשמח לשמוע מה עלה בניסיון: מה היה חסר, מה לא היה ברור ומה עבד.');
    const b = F('revise'); b.disabled = true;
    const stop = waiting(F('wait3'), 'מתקנת את התיק לפי הניסיון.', 90);
    let k = null;
    try {
      k = C.parse(await ask(C.reviseSystem(KB, WRITER), 'השדות:\n' + C.inputText(S.form) + '\n\nהתיק הנוכחי (JSON):\n' + JSON.stringify(S.kit) +
        '\n\nמה עלה בניסיון של העמיתה' + (F('trialWho').value.trim() ? ' (' + F('trialWho').value.trim() + ')' : '') + ':\n' + note + '\n\nתקני את התיק.'));
    } catch (e) { console.warn('תיק רציפות, תיקון:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!C.valid(k)) return fail(F('err3'), NO_MODEL);
    const changes = Array.isArray(k.changes) ? k.changes : []; delete k.changes;
    S.history.push({ version: S.version, at: S.at, note }); S.kit = k; S.version += 1; S.at = today(); save();
    const box = F('changes'); box.textContent = '';
    box.appendChild(el('h3', null, 'מה השתנה בגרסה ' + S.version));
    if (changes.length) box.appendChild(window.SBE_TABLE(['איפה בתיק', 'מה השתנה ולמה'], changes.map((c) => [txt(c.where), txt(c.why)]), 'kit-t'));
    box.appendChild(el('p', 'muted', 'התיק המעודכן מחכה בצעד 2. אפשר לחזור לשם, לקרוא ולהדפיס.'));
    F('trialNote').value = ''; showKit();
  });
  F('example').addEventListener('click', () => {
    const ex = { kitFor: 'הכיתה שלי (מחנכת)', receiver: 'ממלאת מקום לכמה שבועות', age: 'ה–ו', group: 'ו׳2, 31 תלמידים, כיתה פעילה שאוהבת עבודה בקבוצות',
      routines: 'פתיחת בוקר 8:00: מעגל "מה שלומך" בסבב מילה אחת, ואז לוח היום. מעבר להפסקה: תורני השבוע מכבים אור וסוגרים חלונות. אחרי הפסקה: שתי דקות שקט עם מוזיקה. סיום יום: כל אחד כותב משפט אחד ביומן הכיתה.',
      roles: 'תורנים שבועיים (שניים, מתחלפים כל ראשון). אחראית לוח היום. ועדת הפסקה פעילה (ארבעה תלמידים).',
      decisions: 'משנה את סדר השיעורים ביום בעצמה. יציאה לחצר בשיעור רק אחרי בדיקה עם רכזת השכבה. שינוי מקומות ישיבה מחכה לי.',
      support: 'שלושה תלמידים נעזרים בהסבר כתוב לצד ההסבר בעל פה. תלמידה אחת יוצאת לתגבור ביום שני.',
      contacts: 'רכזת השכבה, המזכירות, המחנכת של ו׳1 מהכיתה הסמוכה.', where: 'רשימות ותוכנית השבוע בתיק הכחול במגירה העליונה. לוח התורנויות על הדלת.', update: 'פעם בחודש' };
    C.FIELDS.forEach((f) => { const i = F('f-' + f.k); if (f.type === 'select' && ![...i.options].some((o) => o.value === ex[f.k])) i.appendChild(new Option(ex[f.k], ex[f.k])); i.value = ex[f.k] || ''; });
    S.form = ex; save(); F('err1').hidden = true;
  });
  if (S.kit) showKit();
  goStep(1);
})();
