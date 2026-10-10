// מעבדה לבניית גשר שותפות בין הבית לכיתה: המסך (app/family-bridge.html). ההנחיות למודל ב-lib/family-bridge-model.js (SBE_BRIDGE).
// ארבעה צעדים, אחד בכל פעם: 1 מטרה אחת · 2 כרטיס בחירה · 3 תגובה והחלטה · 4 בדיקה ולמידה.
// בלי חיבור למודל אין תוצר. הכול נשמר במכשיר לפי משתמש/ת (sbeUserKey). כינויי המשפחות נשארים במכשיר
// ומוחלפים לפני שליחה למודל (anonymize). Begood לא שולחת דבר למשפחות: המורה מעתיקה או מדפיסה.
(function () {
  'use strict';
  const M = window.SBE_BRIDGE, SRC = window.SBE_ADVISOR_SOURCES;
  const KB = SRC.forAdvisor('bridge');
  const WRITER = window.SBE_WRITER ? window.SBE_WRITER.rule : '';
  const STORE = window.sbeUserKey ? sbeUserKey('sbe.bridge.v1') : 'sbe.bridge.v1:anon';
  const SERVER = window.sbeAIOrigin ? window.sbeAIOrigin() : 'https://sbe-server.onrender.com';
  const F = (id) => document.getElementById(id);
  const NO_MODEL = 'אין כרגע חיבור למודל, ולכן התוצר לא הוכן. מה שמילאת נשמר, ואפשר לנסות שוב בעוד דקה או שתיים.';
  const PARTIAL = 'התוצר חזר חלקי. מה שמילאת נשמר, ואפשר לנסות שוב.';
  const why = (e) => (e && e.code === 'incomplete') ? PARTIAL : NO_MODEL;
  try { const h = sessionStorage.getItem('sbe.session.homeUrl'); if (h) F('nav-home').href = h; } catch (e) {}
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  function btn(text, cls, fn) { const b = el('button', cls || 'btn btn-ghost', text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  const today = () => new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const txt = (x) => window.SBE_REFS ? SBE_REFS.strip(String(x == null ? '' : x)) : String(x || '');
  const arr = (x) => Array.isArray(x) ? x : [];
  const D = (iso) => window.sbeDateIL ? sbeDateIL(iso) : iso;
  const isoPlus = (n) => window.sbeIsoPlus ? sbeIsoPlus(n) : '';

  const FAMILY = (n) => ({ id: 'f' + Date.now().toString(36) + n, label: 'משפחה ' + 'אבגדהוזחטיכלמנ'[n % 14], status: '', chosen: '', adapt: '', notNow: '', how: '',
    clear: '', doable: '', decision: null, pick: '', checkWhen: '', result: '', story: {} });
  const EMPTY = () => ({ step: 1, form: {}, plan: null, version: 0, at: '', families: [FAMILY(0)], changes: [], learned: '', reflect: '' });
  let S = EMPTY();
  try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && v.form) S = Object.assign(EMPTY(), v); } catch (e) {}
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }
  const labels = () => S.families.map((f) => f.label);
  const otherLang = () => S.form.lang && S.form.lang !== 'עברית';
  const goalMode = () => M.isGoal(S.form);
  if (!S.form.focus) S.form.focus = M.FOCUS.contact;

  // ── הטופס ──
  (function buildForm() {
    const form = F('form'), grid = el('div', 'grid2');
    M.FIELDS.forEach((f) => {
      const box = el('div', 'f'), id = 'f-' + f.k, label = el('label', null, f.l);
      label.htmlFor = id;
      if (f.main) label.appendChild(el('span', 'main-tag', 'שדה עיקרי'));
      box.appendChild(label);
      let input;
      if (f.type === 'select') { input = el('select'); if (f.closed) input.setAttribute('data-closed', ''); else input.appendChild(new Option('בחירה…', '')); f.opts.forEach((o) => input.appendChild(new Option(o, o))); }
      else { input = el('textarea'); input.maxLength = 3000; }
      input.id = id; if (f.ph) input.placeholder = f.ph;
      const v = S.form[f.k];
      if (v) { if (f.type === 'select' && ![...input.options].some((o) => o.value === v)) input.appendChild(new Option(v, v)); input.value = v; }
      const keep = () => { S.form[f.k] = input.value; save(); if (f.k === 'focus') showGoal(); };
      if (f.goalOnly) box.dataset.goalOnly = '1';
      input.addEventListener('input', keep); input.addEventListener('change', keep);
      box.appendChild(input);
      (f.type === 'area' ? form : grid).appendChild(box);
    });
    form.prepend(grid);
    showGoal();
  })();
  function showGoal() { document.querySelectorAll('[data-goal-only]').forEach((b) => { b.hidden = !goalMode(); }); }
  function readForm() { const d = {}; M.FIELDS.forEach((f) => { d[f.k] = (F('f-' + f.k).value || '').trim(); }); return d; }

  // ── צעדים ──
  const STEPS = F('steps');
  M.STAGES.forEach((s) => { const li = el('li'); li.dataset.step = s.n; li.appendChild(el('b', null, s.n + '. ' + s.t)); li.appendChild(document.createTextNode(s.d)); STEPS.appendChild(li); });
  function goStep(n) {
    if (n > 1 && !S.plan) n = 1;
    S.step = n; save();
    for (let i = 1; i <= 4; i++) F('s' + i).hidden = i !== n;
    STEPS.querySelectorAll('li').forEach((li) => { const i = +li.dataset.step; li.classList.toggle('on', i === n); li.classList.toggle('done', i < n && !!S.plan); });
    if (n > 1) draw(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  STEPS.querySelectorAll('li').forEach((li) => li.addEventListener('click', () => goStep(+li.dataset.step)));
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => goStep(+b.dataset.go)));

  function waiting(node, text, exp) {
    node.hidden = false; node.textContent = '';
    const line = el('div'), bar = el('div', 'bar'), fill = el('div'); bar.appendChild(fill); node.append(line, bar);
    const t0 = Date.now();
    const tick = () => { const s = Math.round((Date.now() - t0) / 1000); line.textContent = text + ' בדרך כלל ' + exp + ' שניות. עברו ' + s + ' שניות.'; fill.style.width = Math.min(95, s / exp * 90) + '%'; };
    tick(); const iv = setInterval(tick, 1000);
    return () => { clearInterval(iv); node.hidden = true; };
  }
  const ask = (system, content, check) => window.sbeCallAIJson(SERVER, { system, messages: [{ role: 'user', content }], maxTokens: 6000, customerReview: true }, 300000, check);
  function fail(n, m) { n.textContent = m; n.hidden = false; }

  // ── עזרים ──
  function head(root, key, extra) { const s = M.SECTIONS[key]; root.appendChild(el('h3', null, s.h + (extra || ''))); if (s.sub) root.appendChild(el('p', 'sub', s.sub)); }
  const T = (key, rows) => window.SBE_TABLE(M.SECTIONS[key].cols, rows, 'kit-t');
  const KV = (rows) => window.SBE_TABLE(null, rows.filter((r) => r[1]), 'kit-t');
  function field(obj, k, label, area, ph) {
    const i = area ? el('textarea') : el('input'); if (!area) i.type = 'text'; else i.rows = 2;
    i.value = txt(obj[k] || ''); i.setAttribute('aria-label', label); if (ph) i.placeholder = ph;
    i.addEventListener('input', () => { obj[k] = i.value; save(); }); return i;
  }
  function choice(obj, k, label, opts, onChange, closed) {
    const s = el('select'); if (closed !== false) s.setAttribute('data-closed', ''); s.setAttribute('aria-label', label);
    s.appendChild(new Option('בחירה…', '')); opts.forEach((o) => s.appendChild(new Option(o, o)));
    if (obj[k] && ![...s.options].some((o) => o.value === obj[k])) s.appendChild(new Option(obj[k], obj[k]));
    s.value = obj[k] || '';
    s.addEventListener('change', () => { obj[k] = s.value; save(); if (onChange) onChange(); }); return s;
  }
  function withRefs(build, keys) {
    const root = el('div', 'kit');
    if (window.SBE_REFS) SBE_REFS.begin(SRC, 'resilience-advisor-sources.html');
    build(root);
    if (window.SBE_REFS) { SBE_REFS.add(arr(keys || (S.plan && S.plan.sources))); const rs = SBE_REFS.end(); if (rs) root.appendChild(rs); }
    return root;
  }
  function copyText(t, b) {
    const done = () => { const o = b.textContent; b.textContent = '✓ הועתק'; setTimeout(() => { b.textContent = o; }, 1500); };
    try { navigator.clipboard.writeText(t).then(done, () => { prompt('להעתקה:', t); }); } catch (e) { prompt('להעתקה:', t); }
  }

  // ── תוצרים ──
  function goalBlock(P) {
    const g = goalMode(), box = el('section'); head(box, g ? 'goal' : 'goalContact');
    box.appendChild(KV([[g ? 'המטרה' : 'הגשר', txt(P.goal.text)], ['למה זה חשוב לילד/ה', txt(P.goal.why)], [g ? 'מה נראה כשזה קורה' : 'מה נראה כשהקשר עובד', txt(P.goal.sign)]]));
    head(box, g ? 'ways' : 'waysContact'); box.appendChild(T(g ? 'ways' : 'waysContact', arr(P.ways).map((w) => [txt(w.name), txt(w.what), txt(w.time), txt(w.level)])));
    head(box, g ? 'school' : 'schoolContact'); box.appendChild(KV([['מה עושים', txt(P.school.what)], ['מי', txt(P.school.who)], ['מתי', txt(P.school.when)]]));
    return box;
  }
  function stylesBlock(P) {
    const box = el('section');
    if (arr(P.styles).length) { head(box, 'styles'); box.appendChild(T('styles', P.styles.map((s) => [txt(s.style), txt(s.looks), txt(s.act)]))); }
    if (arr(P.channels).length) { head(box, 'channels'); box.appendChild(T('channels', P.channels.map((c) => [txt(c.channel), txt(c.fits)]))); }
    return box;
  }
  function meaning(P) {
    const box = el('section');
    if (arr(P.resilience).length) { head(box, 'resilience'); box.appendChild(T('resilience', P.resilience.map((r) => [txt(r.component), txt(r.how)]))); }
    if (arr(P.skills).length) { head(box, 'skills'); box.appendChild(T('skills', P.skills.map((s) => [txt(s.skill), txt(s.kind), txt(s.where)]))); }
    return box;
  }
  const CARD_ROWS = [['greeting', 'פנייה'], ['goal', 'המטרה'], ['intro', 'הזמנה לבחור'], ['adapt', 'התאמה'], ['notNow', 'אם לא מתאים כרגע'], ['respond', 'איך עונים'], ['closing', 'חתימה']];
  function cardText(c) {
    c = c || {};
    return [txt(c.greeting), txt(c.goal), txt(c.intro), arr(c.questions).map((q, i) => (i + 1) + '. ' + txt(q.q) + '\n' + arr(q.opts).map((o) => '- ' + txt(o)).join('\n')).join('\n\n'), arr(c.options).map((o, i) => (i + 1) + '. ' + txt(o)).join('\n'), txt(c.adapt), txt(c.notNow), txt(c.respond), txt(c.closing)].filter(Boolean).join('\n\n');
  }
  // הכרטיס כפי שהמשפחה תראה אותו (להדפסה ולתצוגה)
  function cardView(c, dir) {
    const box = el('div', 'card-family'); if (dir) box.dir = dir;
    if (c.greeting) box.appendChild(el('p', 'cf-greet', txt(c.greeting)));
    if (c.goal) box.appendChild(el('p', 'cf-goal', txt(c.goal)));
    if (c.intro) box.appendChild(el('p', null, txt(c.intro)));
    arr(c.questions).forEach((q, i) => { box.appendChild(el('p', 'cf-q', (i + 1) + '. ' + txt(q.q))); const u = el('ul', 'cf-qopts'); arr(q.opts).forEach((o) => u.appendChild(el('li', null, '☐ ' + txt(o)))); box.appendChild(u); });
    if (arr(c.options).length) { if (arr(c.questions).length) box.appendChild(el('p', 'cf-q', 'או בחרו דרך מוכנה:')); const ol = el('ol', 'cf-opts'); arr(c.options).forEach((o) => ol.appendChild(el('li', null, '☐ ' + txt(o)))); box.appendChild(ol); }
    if (c.adapt) { box.appendChild(el('p', null, txt(c.adapt))); box.appendChild(el('p', 'cf-line', '______________________________')); }
    if (c.notNow) box.appendChild(el('p', null, '☐ ' + txt(c.notNow)));
    if (c.respond) box.appendChild(el('p', 'cf-respond', txt(c.respond)));
    if (c.closing) box.appendChild(el('p', null, txt(c.closing)));
    return box;
  }
  function cardEditor(c, title) {
    const box = el('section', 'cardedit');
    box.appendChild(el('h4', null, title));
    box.appendChild(window.SBE_TABLE(null, CARD_ROWS.slice(0, 3).map(([k, l]) => [l, field(c, k, l, true)]).concat(
      arr(c.questions).map((q, i) => ['שאלה ' + (i + 1), (() => { const d = el('div'); const a = el('textarea'); a.rows = 1; a.value = txt(q.q); a.setAttribute('aria-label', 'שאלה ' + (i + 1));
        a.addEventListener('input', () => { q.q = a.value; save(); }); const o = el('textarea'); o.rows = 3; o.value = arr(q.opts).map(txt).join('\n'); o.setAttribute('aria-label', 'האפשרויות לשאלה ' + (i + 1)); o.title = 'אפשרות בכל שורה';
        o.addEventListener('input', () => { q.opts = o.value.split('\n').map((x) => x.trim()).filter(Boolean); save(); }); d.append(a, o); return d; })()]),
      [['האפשרויות', (() => { const d = el('div'); arr(c.options).forEach((o, i) => { const f = el('textarea'); f.rows = 2; f.value = txt(o); f.setAttribute('aria-label', 'אפשרות ' + (i + 1)); f.addEventListener('input', () => { c.options[i] = f.value; save(); }); d.appendChild(f); }); return d; })()]],
      CARD_ROWS.slice(3).map(([k, l]) => [l, field(c, k, l, true)])), 'kit-t etable'));
    return box;
  }
  function yearForm() {
    const Y = M.YEAR_FORM, box = el('div', 'yearform');
    box.appendChild(el('h3', null, Y.title)); box.appendChild(el('p', null, Y.intro));
    Y.qs.forEach((q, i) => { box.appendChild(el('p', 'yq', (i + 1) + '. ' + q.q)); const u = el('ul', 'yo'); q.opts.forEach((o) => u.appendChild(el('li', null, (/^_+$/.test(o) ? '' : '☐ ') + o))); box.appendChild(u); });
    box.appendChild(el('p', null, Y.close)); return box;
  }
  const yearText = () => [M.YEAR_FORM.title, M.YEAR_FORM.intro].concat(M.YEAR_FORM.qs.map((q, i) => (i + 1) + '. ' + q.q + '\n' + q.opts.map((o) => '- ' + o).join('\n')), [M.YEAR_FORM.close]).join('\n\n');

  // ── צעד 3: משפחה ──
  function familyCard(f, i) {
    const c = el('section', 'famcard');
    const top = el('div', 'famtop'), lab = field(f, 'label', 'כינוי המשפחה'); lab.className = 'famlabel'; lab.title = 'כינוי בלבד. נשמר רק במכשיר.';
    top.appendChild(lab);
    if (S.families.length > 1) top.appendChild(btn('✕', 'xbtn', () => { if (confirm('להסיר את "' + f.label + '"?')) { S.families.splice(i, 1); save(); draw(3); } }));
    c.appendChild(top);
    // הסיפור בתחילת השיח: רק על המסך, לא בהדפסה
    const st = f.story || (f.story = {}), sb = el('div', 'story');
    sb.appendChild(el('h4', null, 'הסיפור'));
    const sg = el('div', 'grid2');
    M.STORY.forEach((x) => { const d = el('div', 'f'); d.appendChild(el('label', null, x.l)); d.appendChild(field(st, x.k, x.l, true, x.ph)); sg.appendChild(d); });
    sb.appendChild(sg); c.appendChild(sb);
    const g = el('div', 'grid2');
    const add = (label, node) => { const d = el('div', 'f'); d.appendChild(el('label', null, label)); d.appendChild(node); g.appendChild(d); };
    add('מה המשפחה ענתה', choice(f, 'status', 'מה המשפחה ענתה', M.RESPONSES, () => draw(3)));
    if (f.status === 'בחרה דרך' || f.status === 'הציעה התאמה') add('איזו דרך', choice(f, 'chosen', 'איזו דרך', arr(S.plan.ways).map((w) => txt(w.name))));
    add('איך ענו', choice(f, 'how', 'איך ענו', ['הודעה כתובה', 'הודעה קולית', 'שיחה', 'פתק', 'דרך הילד/ה', 'דרך בן או בת משפחה אחרים'], null, false));
    add('הכרטיס היה מובן?', choice(f, 'clear', 'הכרטיס היה מובן', ['כן', 'בחלקו', 'לא ידוע']));
    add('הדרך הייתה ישימה עבורם?', choice(f, 'doable', 'הדרך הייתה ישימה', ['כן', 'בחלקה', 'לא', 'לא ידוע']));
    c.appendChild(g);
    if (f.status === 'הציעה התאמה') { const d = el('div', 'f'); d.appendChild(el('label', null, 'ההתאמה שהציעו')); d.appendChild(field(f, 'adapt', 'ההתאמה שהציעו', true, 'במילים שלהם, בלי שמות.')); c.appendChild(d); }
    if (f.status === 'לא מעשי כרגע') { const d = el('div', 'f'); d.appendChild(el('label', null, 'מה כתבו (אם כתבו)')); d.appendChild(field(f, 'notNow', 'מה כתבו', true, 'בלי שמות.')); c.appendChild(d); }
    const err = el('p', 'err'); err.hidden = true; err.id = 'err-' + f.id;
    const wait = el('div', 'wait'); wait.hidden = true; wait.id = 'wait-' + f.id;
    if (!f.decision) { const b = btn('קבלת הצעה להמשך עם המשפחה', 'btn sm', () => decide(f, b)); c.append(b, wait, err); }
    else { c.append(wait, err); c.appendChild(decisionView(f)); c.appendChild(nextGuide(f)); }
    return c;
  }
  // ── מה עכשיו? חמישה צעדים לכל משפחה, אחד אחרי השני ──
  function nextGuide(f) {
    const box = el('section', 'next'); box.appendChild(el('h4', null, 'מה עכשיו?'));
    const ol = el('ol', 'nextlist'), d = f.decision;
    const done = [!!(f.pick && f.checkWhen), !!f.sent, !!(f.practice && f.practice.feedback), !!f.planNext, !!f.summary];
    const item = (i, body) => { const li = el('li', done[i] ? 'done' : ''); li.appendChild(el('b', null, (done[i] ? '✓ ' : '') + M.NEXT[i])); if (body) li.appendChild(body); ol.appendChild(li); };
    item(0, el('p', 'sub', done[0] ? 'בחרת: ' + f.pick : 'בחרי למעלה את ההמשך ואת תאריך נקודת הבדיקה.'));
    const s2 = el('div'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!f.sent; cb.id = 'sent-' + f.id;
    const l2 = el('label', 'okline'); l2.htmlFor = cb.id; l2.append(cb, document.createTextNode(' שלחתי את ההודעה, בדרך שהמשפחה בחרה'));
    cb.addEventListener('change', () => { f.sent = cb.checked; save(); draw(3); }); s2.appendChild(l2); item(1, s2);
    item(2, practiceBlock(f));
    const s4 = el('div');
    if (f.planNext) s4.appendChild(planNextView(f));
    const pb = btn(f.planNext ? 'תכנון מחדש' : 'תכנון הקשר בחודשיים הקרובים', f.planNext ? 'btn btn-ghost sm' : 'btn sm', () => planNext(f, pb)); s4.appendChild(pb); item(3, s4);
    const s5 = el('div');
    if (f.summary) s5.appendChild(summaryView(f));
    const sb = btn(f.summary ? 'סיכום מעודכן' : 'הכנת סיכום', f.summary ? 'btn btn-ghost sm' : 'btn sm', () => summarize(f, sb)); s5.appendChild(sb);
    s5.appendChild(el('p', 'remind', '📌 כדאי להוסיף את דרך הקשר המוסכמת עם המשפחה לתיק הרציפות, כדי שמי שתחליף אותך תדע איך להיות בקשר.'));
    if (f.summary) { s5.appendChild(btn('🖨 הדפסה / PDF', 'btn btn-ghost sm', () => printSummary(f))); s5.appendChild(btn('💾 שמירה במחשב', 'btn btn-ghost sm', () => downloadSummary(f))); }
    item(4, s5);
    box.appendChild(ol);
    const w = el('div', 'wait'); w.hidden = true; w.id = 'wait2-' + f.id; const e = el('p', 'err'); e.hidden = true; e.id = 'err2-' + f.id; box.append(w, e);
    return box;
  }
  function caseText(f) {
    const way = arr(S.plan.ways).find((w) => txt(w.name) === f.chosen), o = arr(f.decision && f.decision.options).find((x) => txt(x.name) === f.pick);
    return M.anonymize([M.storyText(f.story), f.status && 'מה המשפחה ענתה לכרטיס: ' + f.status, way && 'הדרך שבחרו: ' + txt(way.name) + ': ' + txt(way.what), f.adapt && 'ההתאמה שהציעו: ' + f.adapt,
      f.notNow && 'מה כתבו: ' + f.notNow, o && 'ההמשך שהמורה בחרה: ' + txt(o.name) + '. בבית: ' + txt(o.atHome) + '. בכיתה: ' + txt(o.inClass), f.checkWhen && 'נקודת הבדיקה: ' + D(f.checkWhen)].filter(Boolean).join('\n'), labels());
  }
  // תרגול השיחה: המודל משחק את ההורה, המורה כותבת, ובסוף משוב קצר
  function practiceBlock(f) {
    const P = f.practice || (f.practice = { turns: [], feedback: null, open: false }), box = el('div');
    if (!P.open && !P.turns.length) { box.appendChild(el('p', 'sub', 'אפשר להתאמן על השיחה לפני שמדברים באמת. המודל משחק את ההורה.')); box.appendChild(btn('▶ תרגול השיחה', 'btn btn-ghost sm', () => { P.open = true; save(); draw(3); })); return box; }
    const chat = el('div', 'chat');
    P.turns.forEach((t) => chat.appendChild(el('div', 'msg ' + (t.me ? 'me' : 'bot'), (t.me ? 'את: ' : 'ההורה: ') + t.text)));
    box.appendChild(chat);
    const mine = P.turns.filter((t) => t.me).length;
    if (!P.feedback && mine < M.PRACTICE_TURNS) {
      const ta = el('textarea'); ta.rows = 2; ta.placeholder = mine ? 'מה תעני?' : 'איך תפתחי את השיחה?'; ta.setAttribute('aria-label', 'מה את אומרת');
      const send = btn('שליחה', 'btn sm', async () => {
        const v = ta.value.trim(); if (!v) return;
        P.turns.push({ me: true, text: v }); save(); send.disabled = true;
        const msgs = P.turns.map((t) => ({ role: t.me ? 'user' : 'assistant', content: M.anonymize(t.text, labels()) }));
        let reply = null;
        try { reply = await window.sbeCallAI(SERVER, { system: M.practiceSystem(caseText(f)), messages: msgs, maxTokens: 300 }, 90000); } catch (e) { console.warn('גשר, תרגול:', e.message); }
        if (!reply) { P.turns.pop(); save(); draw(3); return fail(F('err2-' + f.id), NO_MODEL); }
        P.turns.push({ me: false, text: String(reply).trim() }); save(); draw(3);
      });
      box.append(ta, send);
    }
    if (mine && !P.feedback) box.appendChild(btn('סיום התרגול ומשוב', 'btn btn-ghost sm', (ev) => feedback(f, ev.target)));
    if (P.feedback) {
      box.appendChild(window.SBE_TABLE(null, [['מה עבד', (() => { const u = el('ul'); arr(P.feedback.worked).forEach((x) => u.appendChild(el('li', null, txt(x)))); return u; })()],
        ['מה אפשר לנסות', (() => { const u = el('ul'); arr(P.feedback.try).forEach((x) => u.appendChild(el('li', null, txt(x)))); return u; })()], ['הצעד הבא', txt(P.feedback.next)]], 'kit-t'));
      box.appendChild(btn('תרגול נוסף', 'btn btn-ghost sm', () => { f.practice = { turns: [], feedback: null, open: true }; save(); draw(3); }));
    }
    return box;
  }
  async function feedback(f, b) {
    const P = f.practice, log = P.turns.map((t) => (t.me ? 'המחנכת: ' : 'ההורה: ') + t.text).join('\n');
    b.disabled = true; const stop = waiting(F('wait2-' + f.id), 'מכינה משוב קצר על השיחה.', 25);
    let k = null, bad = null;
    try { k = await window.sbeCallAIJson(SERVER, { system: M.feedbackSystem(KB), messages: [{ role: 'user', content: M.anonymize('מה שידוע:\n' + caseText(f) + '\n\nהשיחה:\n' + log, labels()) }], maxTokens: 1200 }, 120000, M.validFeedback); }
    catch (e) { bad = e; } finally { stop(); b.disabled = false; }
    if (!M.validFeedback(k)) return fail(F('err2-' + f.id), why(bad));
    P.feedback = k; save(); draw(3);
  }
  function planNextView(f) {
    const k = f.planNext, box = el('div');
    box.appendChild(window.SBE_TABLE(['מתי', 'מה עושים', 'באיזו דרך', 'מי'], arr(k.steps).map((x) => [txt(x.when), txt(x.what), txt(x.how), txt(x.who)]), 'kit-t'));
    box.appendChild(KV([['אם אין תגובה', txt(k.noReply)], ['נקודת הבדיקה', txt(k.check && k.check.look) + (k.check && k.check.when ? ' (' + txt(k.check.when) + ')' : '')], ['כדי שזה לא יעמיס', txt(k.light)]]));
    if (f.checkWhen) box.appendChild(btn('📅 נקודת הבדיקה ליומן', 'btn btn-ghost sm', () => ics(f)));
    return box;
  }
  async function planNext(f, b) {
    F('err2-' + f.id).hidden = true;
    if (!f.pick) return fail(F('err2-' + f.id), 'כדי לתכנן, בחרי קודם את ההמשך (צעד 1).');
    b.disabled = true; const stop = waiting(F('wait2-' + f.id), 'מתכננת את הקשר בחודשיים הקרובים.', 30);
    let k = null, bad = null;
    try { k = await ask(M.planNextSystem(KB, WRITER), 'השדות:\n' + M.inputText(S.form) + '\n\n' + caseText(f) + '\n\nתכנני את הקשר בהמשך.', M.validPlanNext); }
    catch (e) { bad = e; } finally { stop(); b.disabled = false; }
    if (!M.validPlanNext(k)) return fail(F('err2-' + f.id), why(bad));
    f.planNext = k; save(); draw(3);
  }
  function ics(f) {
    const dt = f.checkWhen.replace(/-/g, ''), body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Begood//Bridge//HE', 'BEGIN:VEVENT', 'UID:' + Date.now() + '@be-good.co.il',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), 'DTSTART;VALUE=DATE:' + dt, 'SUMMARY:נקודת בדיקה · גשר עם ' + f.label,
      'DESCRIPTION:בודקים אם הקשר שהוסכם עובד\\, ומחליטים על הצעד הבא.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    fileOut(body, 'text/calendar', 'נקודת-בדיקה.ics');
  }
  function summaryView(f) {
    const k = f.summary, box = el('div', 'summary');
    box.appendChild(el('h4', null, txt(k.title) || 'סיכום'));
    box.appendChild(KV(arr(k.rows).map((x) => [txt(x.label), txt(x.text)]).concat([['הצעד הבא', txt(k.next)]])));
    return box;
  }
  async function summarize(f, b) {
    F('err2-' + f.id).hidden = true;
    const P = f.practice || {}, pl = f.planNext;
    const extra = [P.feedback && 'מה עלה בתרגול: עבד: ' + arr(P.feedback.worked).join('; ') + '. לנסות: ' + arr(P.feedback.try).join('; '),
      pl && 'תכנון הקשר: ' + arr(pl.steps).map((x) => x.when + ': ' + x.what).join('; '), f.result && 'בנקודת הבדיקה: ' + f.result, f.sent && 'ההודעה נשלחה.'].filter(Boolean).join('\n');
    b.disabled = true; const stop = waiting(F('wait2-' + f.id), 'מכינה סיכום לשמירה.', 30);
    let k = null, bad = null;
    try { k = await ask(M.summarySystem(KB), M.anonymize('השדות:\n' + M.inputText(S.form) + '\n\n' + caseText(f) + (extra ? '\n' + extra : '') + '\n\nסכמי.', labels()), M.validSummary); }
    catch (e) { bad = e; } finally { stop(); b.disabled = false; }
    if (!M.validSummary(k)) return fail(F('err2-' + f.id), why(bad));
    f.summary = k; save(); draw(3);
  }
  function summaryNode(f) {
    const out = el('div'); out.appendChild(summaryView(f));
    if (f.planNext) { out.appendChild(el('h3', null, 'תכנון הקשר בהמשך')); const v = planNextView(f); v.querySelectorAll('button').forEach((x) => x.remove()); out.appendChild(v); }
    return out;
  }
  function printSummary(f) { window.SBE_DOC.print({ title: (txt(f.summary.title) || 'סיכום').replace(/\[משפחה\]/g, f.label), subtitle: [S.form.age, S.form.lang].filter(Boolean).join(' · '), kind: 'סיכום הגשר עם משפחה', node: summaryNode(f) }); }
  function fileOut(text, type, name) {
    const a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function downloadSummary(f) {
    const node = summaryNode(f), title = (txt(f.summary.title) || 'סיכום').replace(/\[משפחה\]/g, f.label);
    const html = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + title.replace(/</g, '&lt;') + '</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;line-height:1.6;color:#141C24}' +
      'table{width:100%;border-collapse:collapse;margin:8px 0 16px}th,td{border:1px solid #CDD3D8;padding:6px 8px;text-align:right;vertical-align:top}thead th{background:#2E5A7D;color:#fff}tbody th{background:#F3F6F8;width:22%}</style></head><body>' +
      '<p style="color:#2E5A7D">Begood · גשר בין הבית לכיתה · ' + today() + '</p>' + node.innerHTML + '</body></html>';
    fileOut(html, 'text/html', 'גשר-' + f.label.replace(/[^\p{L}\p{N}]+/gu, '-') + '-סיכום.html');
  }
  function decisionView(f) {
    const d = f.decision, box = el('div', 'decision');
    head(box, 'options');
    const again = btn('רוצה הצעה אחרת?', 'linkbtn', () => decide(f, again)); box.appendChild(again);
    box.appendChild(T('options', arr(d.options).map((o) => [txt(o.name), txt(o.inClass), txt(o.atHome), txt(o.why)])));
    const g = el('div', 'grid2'), a = el('div', 'f'), b = el('div', 'f');
    a.appendChild(el('label', null, 'מה בחרת')); a.appendChild(choice(f, 'pick', 'מה בחרת', arr(d.options).map((o) => txt(o.name)), () => { const c = F('checks'); if (c) c.replaceWith(checksBlock()); }));
    b.appendChild(el('label', null, 'נקודת בדיקה')); const ci = el('input'); ci.type = 'date'; ci.value = f.checkWhen || ''; ci.setAttribute('aria-label', 'נקודת בדיקה');
    ci.addEventListener('change', () => { f.checkWhen = ci.value; save(); }); b.appendChild(ci); g.append(a, b); box.appendChild(g);
    if (d.feel) box.appendChild(el('p', 'feel', txt(d.feel)));
    const tk = d.talk || {};
    if (tk.open || tk.ask || tk.close) { box.appendChild(el('h4', null, 'לשיחה עם ההורים')); box.appendChild(KV([['איך לפתוח', txt(tk.open)], ['שאלה להקשבה', txt(tk.ask)], ['איך לסיים', txt(tk.close)]])); }
    box.appendChild(KV([['מה נראה בנקודת הבדיקה', txt(d.check && d.check.look) + (d.check && d.check.when ? ' (' + txt(d.check.when) + ')' : '')], ['איך לפעול בתוך הקשר הזה', txt(d.note)]]));
    const msg = el('div', 'reply'); msg.appendChild(el('h4', null, 'הודעה למשפחה'));
    const t = el('textarea'); t.rows = 5; t.value = txt(d.reply.text); t.setAttribute('aria-label', 'הודעה למשפחה'); if (otherLang()) t.dir = 'auto';
    t.addEventListener('input', () => { d.reply.text = t.value; save(); }); msg.appendChild(t);
    if (d.reply.he) msg.appendChild(el('p', 'sub', 'בעברית: ' + txt(d.reply.he)));
    const cp = btn('📋 העתקת ההודעה', 'btn btn-ghost sm', () => copyText(d.reply.text, cp)); msg.appendChild(cp);
    box.appendChild(msg);
    return box;
  }
  async function decide(f, b) {
    const err = F('err-' + f.id); err.hidden = true;
    if (!f.status && !M.storyText(f.story)) return fail(err, 'כדי להמשיך, ספרי את הסיפור או בחרי מה המשפחה ענתה. גם "עוד לא ענתה" היא תשובה.');
    const P = S.plan, way = arr(P.ways).find((w) => txt(w.name) === f.chosen);
    const story = M.storyText(f.story);
    const content = M.anonymize('השדות:\n' + M.inputText(S.form) + (story ? '\n\nהסיפור של המורה עם המשפחה:\n' + story : '') + '\n\n' + (goalMode() ? 'המטרה: ' : 'הגשר: ') + txt(P.goal.text) + '\n' + (goalMode() ? 'דרכי התמיכה שהוצעו: ' : 'דרכי הקשר שהוצעו: ') + arr(P.ways).map((w) => txt(w.name) + ' (' + txt(w.what) + ')').join('; ') +
      '\nהחלופה בכיתה: ' + txt(P.school.what) + '\n\nהתגובה של המשפחה: ' + f.status + (way ? '\nהדרך שבחרו: ' + txt(way.name) + ': ' + txt(way.what) : '') +
      (f.status ? '' : 'עוד לא נשלח כרטיס, או שאין תגובה מתועדת.') + (f.adapt ? '\nההתאמה שהציעו: ' + f.adapt : '') + (f.notNow ? '\nמה כתבו: ' + f.notNow : '') + (f.how ? '\nאיך ענו: ' + f.how : '') + '\n\nהציעי את ההמשך.', labels());
    b.disabled = true; const stop = waiting(F('wait-' + f.id), 'מכינה אפשרויות להמשך והודעה למשפחה.', 35);
    let k = null, bad = null;
    try { k = await ask(M.decideSystem(KB, WRITER, S.form.lang, S.form.focus), content, M.validDecision); } catch (e) { bad = e; console.warn('גשר, החלטה:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!M.validDecision(k)) return fail(err, why(bad));
    f.decision = k; f.pick = ''; if (!f.checkWhen) f.checkWhen = isoPlus(14); save(); draw(3);
  }

  // ── צעד 4 ──
  function checksBlock() {
    const box = el('section'); box.id = 'checks'; head(box, 'checks');
    const fs = S.families, n = fs.length, cnt = (k, v) => fs.filter((f) => f[k] === v).length;
    const answered = fs.filter((f) => f.status && f.status !== 'עוד לא ענתה').length;
    box.appendChild(T('checks', [
      ['האפשרויות היו מובנות?', fs.some((f) => f.clear) ? 'כן: ' + cnt('clear', 'כן') + ' · בחלקו: ' + cnt('clear', 'בחלקו') + ' · לא ידוע: ' + cnt('clear', 'לא ידוע') : 'עוד לא תועד'],
      ['הדרכים היו ישימות?', fs.some((f) => f.doable) ? 'כן: ' + cnt('doable', 'כן') + ' · בחלקה: ' + cnt('doable', 'בחלקה') + ' · לא: ' + cnt('doable', 'לא') : 'עוד לא תועד'],
      ['תגובה שהובילה להתאמה מעשית שבחרת', fs.filter((f) => f.pick).length + ' מתוך ' + n + ' משפחות'],
      ['תגובות שהגיעו', answered + ' מתוך ' + n + '. כל תגובה, וגם שתיקה, היא מידע ולא מדד לאיכות המשפחה.']
    ]));
    return box;
  }
  function draw(n) {
    if (!S.plan) return;
    const P = S.plan, box = F('out' + n); box.textContent = '';
    box.appendChild(el('p', 'kit-meta', (txt(P.title) || 'גשר שותפות') + ' · גרסה ' + S.version + ' · ' + (S.at || today())));
    if (n === 2) {
      const cs = el('section'); head(cs, 'card');
      cs.appendChild(cardView(P.card, otherLang() ? 'auto' : null));
      const ed = el('details', 'more no-print'); ed.appendChild(el('summary', null, '✎ עריכת הכרטיס'));
      ed.appendChild(cardEditor(P.card, otherLang() ? 'הכרטיס ב' + S.form.lang : 'הכרטיס'));
      if (otherLang() && P.cardHe && arr(P.cardHe.options).length) ed.appendChild(cardEditor(P.cardHe, 'הכרטיס בעברית'));
      ed.addEventListener('toggle', () => { if (!ed.open) draw(2); });
      cs.appendChild(ed);
      const row = el('div', 'actions no-print');
      const cp = btn('📋 העתקת הכרטיס להודעה', 'btn btn-ghost sm', () => copyText(cardText(P.card), cp));
      row.append(cp, btn('🖨 הדפסת הכרטיס', 'btn btn-ghost sm', () => doPrint('card')));
      cs.appendChild(row); box.appendChild(cs);
      if (otherLang() && P.cardHe && arr(P.cardHe.options).length) { const he = el('details', 'more'); he.appendChild(el('summary', null, 'הכרטיס בעברית')); he.appendChild(cardView(P.cardHe)); box.appendChild(he); }
      box.appendChild(withRefs((r) => { r.appendChild(goalBlock(P)); r.appendChild(stylesBlock(P)); r.appendChild(meaning(P)); }));
      const yf = el('details', 'more no-print'); yf.appendChild(el('summary', null, 'שאלון קשר לתחילת השנה (פעם אחת לכל ההורים)')); yf.appendChild(yearForm());
      const yr = el('div', 'actions'), ycp = btn('📋 העתקת השאלון', 'btn btn-ghost sm', () => copyText(yearText(), ycp));
      yr.append(ycp, btn('🖨 הדפסת השאלון', 'btn btn-ghost sm', () => doPrint('year'))); yf.appendChild(yr); box.appendChild(yf);
    }
    if (n === 3) {
      head(box, 'families');
      S.families.forEach((f, i) => box.appendChild(familyCard(f, i)));
      box.appendChild(btn('➕ הוספת משפחה', 'btn btn-ghost sm', () => { S.families.push(FAMILY(S.families.length)); save(); draw(3); }));
      if (window.SBE_OPEN && SBE_OPEN.scan) try { SBE_OPEN.scan(); } catch (e) {}
    }
    if (n === 4) {
      box.appendChild(checksBlock());
      const picked = S.families.filter((f) => f.pick);
      if (picked.length) {
        box.appendChild(el('h3', null, 'בנקודת הבדיקה'));
        box.appendChild(window.SBE_TABLE(['המשפחה', 'הצעד המוסכם', 'מתי', 'מה קרה'], picked.map((f) => {
          const o = arr(f.decision && f.decision.options).find((x) => txt(x.name) === f.pick) || {};
          return [f.label, txt(o.atHome) + (o.inClass ? ' · בכיתה: ' + txt(o.inClass) : ''), f.checkWhen ? D(f.checkWhen) : '', field(f, 'result', 'מה קרה: ' + f.label, true, 'מה ראית בכיתה')];
        }), 'kit-t'));
      }
      const r = el('div', 'f'); r.appendChild(el('label', null, 'מה למדתי על בניית הגשר')); r.appendChild(field(S, 'reflect', 'מה למדתי', true, 'מה עבד, מה הפתיע, ומה אעשה אחרת עם המשפחה הבאה.')); box.appendChild(r);
      if (S.changes.length) { head(box, 'changes', ' ' + S.version); box.appendChild(T('changes', S.changes.map((c) => [txt(c.where), txt(c.what), txt(c.why)]))); }
      if (S.learned) { head(box, 'learned'); box.appendChild(el('p', 'balance', txt(S.learned))); }
    }
  }

  // ── הפקה ──
  F('go').addEventListener('click', async () => {
    const d = readForm(); S.form = d; save();
    const missing = M.FIELDS.filter((f) => (f.main || (f.goalOnly && M.isGoal(d))) && !d[f.k]).map((f) => f.l);
    F('err1').hidden = true;
    if (missing.length) return fail(F('err1'), 'כדי להמשיך, נשמח למלא: ' + missing.join(', ') + '.');
    const b = F('go'); b.disabled = true; const stop = waiting(F('wait1'), goalMode() ? 'מכינה דרכי תמיכה, חלופה בכיתה וכרטיס בחירה למשפחה.' : 'מכינה דרכי קשר וכרטיס למשפחה על הקשר עצמו.', 60);
    let k = null, bad = null;
    try { k = await ask(M.planSystem(KB, WRITER, d.lang, d.focus), 'השדות:\n' + M.inputText(d) + '\n\nהכיני את הסבב.', M.valid); } catch (e) { bad = e; console.warn('גשר:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!M.valid(k)) return fail(F('err1'), why(bad));
    Object.assign(S, { plan: k, version: 1, at: today(), families: [FAMILY(0)], changes: [], learned: '' });
    save(); goStep(2);
  });
  F('revise').addEventListener('click', async () => {
    const used = S.families.filter((f) => f.status || f.clear || f.doable);
    F('err4').hidden = true;
    if (!used.length) return fail(F('err4'), 'כדי לשפר את הכרטיס, נשמח לתגובה של משפחה אחת לפחות בצעד 3.');
    const log = S.families.map((f) => f.label + ': ' + (f.status || 'לא תועד') + (f.chosen ? ' · הדרך: ' + f.chosen : '') + (f.adapt ? ' · התאמה: ' + f.adapt : '') + (f.notNow ? ' · כתבו: ' + f.notNow : '') +
      ' · מובן: ' + (f.clear || 'לא תועד') + ' · ישים: ' + (f.doable || 'לא תועד') + (f.pick ? ' · ההמשך שנבחר: ' + f.pick : '') + (f.result ? ' · בנקודת הבדיקה: ' + f.result : '')).join('\n');
    const plan = Object.assign({}, S.plan); delete plan.sources;
    const b = F('revise'); b.disabled = true; const stop = waiting(F('wait4'), 'משפרת את הכרטיס לפי התגובות.', 70);
    let k = null, bad = null;
    try {
      k = await ask(M.reviseSystem(KB, WRITER, S.form.lang, S.form.focus), M.anonymize('השדות:\n' + M.inputText(S.form) + '\n\nהסבב הנוכחי (JSON):\n' + JSON.stringify(plan) + '\n\nמה קרה עם המשפחות:\n' + log +
        '\n\nמה המורה למדה:\n' + (S.reflect || '[לא נכתב]') + '\n\nשפרי את הכרטיס.', labels()), M.valid);
    } catch (e) { bad = e; console.warn('גשר, שיפור:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!M.valid(k)) return fail(F('err4'), why(bad));
    S.changes = arr(k.changes); S.learned = k.learned || ''; delete k.changes; delete k.learned;
    S.plan = k; S.version += 1; S.at = today(); save(); draw(4);
  });

  // ── הדפסה ──
  function doPrint(what) {
    const P = S.plan, out = el('div');
    let kind = 'סבב גשר';
    if (what === 'card') { kind = 'כרטיס בחירה למשפחה'; out.appendChild(cardView(P.card, otherLang() ? 'auto' : null)); }
    else if (what === 'year') { kind = 'שאלון קשר לתחילת השנה'; out.appendChild(yearForm()); }
    else {
      out.appendChild(withRefs((r) => {
        [goalBlock(P), stylesBlock(P)].forEach((x) => r.appendChild(x));
        const cs = el('section'); head(cs, 'card'); cs.appendChild(cardView(P.card, otherLang() ? 'auto' : null)); r.appendChild(cs);
        const picked = S.families.filter((f) => f.status);
        if (picked.length) { head(r, 'families'); r.appendChild(window.SBE_TABLE(['המשפחה', 'מה ענתה', 'ההמשך שנבחר', 'נקודת בדיקה', 'מה קרה'], picked.map((f) => [f.label, f.status + (f.chosen ? ': ' + f.chosen : ''), f.pick, f.checkWhen ? D(f.checkWhen) : '', f.result]), 'kit-t')); }
        r.appendChild(meaning(P));
        if (S.reflect) { r.appendChild(el('h3', null, 'מה למדתי על בניית הגשר')); r.appendChild(el('p', null, S.reflect)); }
      }));
      const attached = !!document.querySelector('#out2 .sbe-refs.attach');
      out.querySelectorAll('.sbe-refs').forEach((x) => { if (attached) x.classList.add('attach'); });
    }
    window.SBE_DOC.print({ title: what === 'year' ? M.YEAR_FORM.title : (txt(P.title).replace(/^גשר:?\s*/, '') || 'גשר שותפות'), subtitle: [S.form.forWho, S.form.age, S.form.lang].filter(Boolean).join(' · ') + ' · גרסה ' + S.version, kind, node: out });
  }
  document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => { if (S.plan) doPrint(b.dataset.print); }));
  // קובץ עבודה: כל המעבדה, כדי להמשיך במכשיר אחר (כולל הכינויים והסיפורים: נשמר רק אצלך)
  document.querySelectorAll('[data-savework]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('בקובץ יש גם את הכינויים ואת הסיפורים של המשפחות. כדאי לשמור אותו רק במקום פרטי. להמשיך?')) return;
    fileOut(JSON.stringify({ type: 'begood-bridge', v: 1, savedAt: new Date().toISOString(), state: S }), 'application/json', 'גשר-קובץ-עבודה.json');
  }));
  document.querySelectorAll('[data-openwork]').forEach((inp) => inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    try { const o = JSON.parse(await file.text()); if (!o || o.type !== 'begood-bridge' || !o.state || !o.state.form) throw new Error('זה לא קובץ עבודה של מעבדת הגשר');
      if (S.plan && !confirm('לפתוח את הקובץ במקום הסבב הנוכחי?')) return; S = Object.assign(EMPTY(), o.state); save(); location.reload(); }
    catch (e) { alert('לא הצלחנו לפתוח את הקובץ: ' + e.message); } finally { inp.value = ''; }
  }));
  F('newRound').addEventListener('click', () => { if (!confirm('לפתוח סבב חדש? הסבב הנוכחי יימחק מהמכשיר.')) return; const f = S.form; S = EMPTY(); S.form = f; save(); goStep(1); });

  F('example').addEventListener('click', () => {
    const ex = { focus: M.FOCUS.contact, forWho: 'כמה משפחות', age: 'ג–ד', lang: 'עברית', time: '20 דקות בשבוע', goal: '',
      context: 'תחילת שנה, כיתה חדשה. עם כמה משפחות כמעט אין קשר: הודעות בקבוצה נשארות בלי תגובה, ולאסיפה לא הגיעו.',
      known: 'משפחה אחת שולחת הודעות קוליות בלבד. באחרת הסבתא אוספת את הילד. משפחה אחת ביקשה "רק כשיש משהו חשוב".',
      inClass: 'שיחת בוקר קצרה עם כל ילד פעם בשבוע, ופתק "מה היה השבוע" בתיק ביום חמישי.' };
    M.FIELDS.forEach((f) => { const i = F('f-' + f.k); if (f.type === 'select' && ex[f.k] && ![...i.options].some((o) => o.value === ex[f.k])) i.appendChild(new Option(ex[f.k], ex[f.k])); i.value = ex[f.k] || ''; });
    S.form = ex; save(); showGoal(); F('err1').hidden = true;
  });
  goStep(S.plan ? (S.step || 2) : 1);
})();
