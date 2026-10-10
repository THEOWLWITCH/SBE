// מרכז שגרות ויוזמות חברתיות: המסך (app/routines-hub.html). ההנחיות למודל ומבנה התוצר ב-lib/routines-model.js (SBE_ROUTINES).
// סביבת עבודה: כמה מנגנונים קבועים, ולכל אחד ארבעה צעדים: 1 בוחרים פעולה · 2 מאשרים אחריות · 3 מנסים פעמיים · 4 פותחים לשינוי.
// בלי חיבור למודל אין תוצר. הכול נשמר במכשיר לפי משתמש/ת (sbeUserKey). שמות המשתתפים (בכרטיסי התפקיד) נשארים במכשיר:
// לא נשלחים למודל (anonymize) ולא לשרת, ומופיעים רק בהדפסה המקומית.
(function () {
  'use strict';
  const M = window.SBE_ROUTINES, SRC = window.SBE_ADVISOR_SOURCES;
  const KB = SRC.forAdvisor('routines');
  const WRITER = window.SBE_WRITER ? window.SBE_WRITER.rule : '';
  const KEY = (b) => window.sbeUserKey ? sbeUserKey(b) : b + ':anon';
  const STORE = KEY('sbe.routines.v1');
  const SERVER = window.sbeAIOrigin ? window.sbeAIOrigin() : 'https://sbe-server.onrender.com';
  const F = (id) => document.getElementById(id);
  const NO_MODEL = 'אין כרגע חיבור למודל, ולכן התוצר לא הוכן. מה שמילאת נשמר, ואפשר לנסות שוב בעוד דקה או שתיים.';
  const PARTIAL = 'התוצר חזר חלקי. מה שמילאת נשמר, ואפשר לנסות שוב.';
  const why = (e) => (e && e.code === 'incomplete') ? PARTIAL : NO_MODEL;
  try { const h = sessionStorage.getItem('sbe.session.homeUrl'); if (h) F('nav-home').href = h; } catch (e) {}
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  function btn(text, cls, fn) { const b = el('button', cls || 'btn btn-ghost', text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  const today = () => new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const fmtDate = (v) => v ? v.split('-').reverse().join('.') : '';
  const txt = (x) => window.SBE_REFS ? SBE_REFS.strip(String(x == null ? '' : x)) : String(x || '');
  const arr = (x) => Array.isArray(x) ? x : [];
  const copy = (x) => JSON.parse(JSON.stringify(x));

  // ── המצב: כמה מנגנונים, אחד פתוח ──
  const RUN = () => ({ date: '', status: {}, worked: '', hard: '', next: '', reqs: [] });
  const ITEM = () => ({ id: 'm' + Date.now().toString(36), step: 1, form: {}, options: null, choose: null, pick: '', how: '', plan: null, version: 0, at: '',
    people: {}, runs: [RUN(), RUN()], decided: {}, proposal: null, changes: [], ansAI: [], balance: '', versions: [], log: [], rounds: [], reviewDate: '' });
  let S = { items: [], cur: '' };
  try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && Array.isArray(v.items)) S = v; } catch (e) {}
  if (!S.items.length) { S.items.push(ITEM()); S.cur = S.items[0].id; }
  let I = S.items.find((x) => x.id === S.cur) || S.items[0];
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }
  const nameOf = (it) => txt(it.plan && it.plan.title) || it.form.mechType || 'מנגנון חדש';
  const names = () => Object.values(I.people || {}).flatMap((p) => [p.who, p.backup]).flatMap((n) => String(n || '').split(/[,،]/));

  // ── סרגל המנגנונים ──
  function renderHub() {
    const box = F('hub'); box.textContent = '';
    S.items.forEach((it) => {
      const c = el('button', 'mech' + (it.id === I.id ? ' on' : '')); c.type = 'button';
      c.appendChild(el('b', null, nameOf(it)));
      const st = M.STAGES[(it.step || 1) - 1];
      c.appendChild(el('span', null, (it.form.mechType && it.plan ? it.form.mechType + ' · ' : '') + 'צעד ' + (it.step || 1) + ': ' + st.t + (it.version ? ' · גרסה ' + it.version : '')));
      c.addEventListener('click', () => { S.cur = it.id; I = it; save(); openItem(); });
      box.appendChild(c);
    });
    box.appendChild(btn('➕ מנגנון חדש', 'mech add', () => { const it = ITEM(); S.items.push(it); S.cur = it.id; I = it; save(); openItem(); }));
  }
  F('delItem').addEventListener('click', () => {
    if (!confirm('למחוק את "' + nameOf(I) + '" מהמכשיר? אי אפשר לשחזר.')) return;
    S.items = S.items.filter((x) => x.id !== I.id);
    if (!S.items.length) S.items.push(ITEM());
    I = S.items[0]; S.cur = I.id; save(); openItem();
  });

  // ── הטופס ──
  function buildForm() {
    const form = F('form'); form.textContent = '';
    const grid = el('div', 'grid2');
    M.FIELDS.forEach((f) => {
      const box = el('div', 'f'), id = 'f-' + f.k, label = el('label', null, f.l);
      label.htmlFor = id;
      if (f.main) label.appendChild(el('span', 'main-tag', 'שדה עיקרי'));
      box.appendChild(label);
      let input;
      if (f.type === 'select') { input = el('select'); input.appendChild(new Option('בחירה…', '')); f.opts.forEach((o) => input.appendChild(new Option(o, o))); }
      else if (f.type === 'area') { input = el('textarea'); input.maxLength = 3000; }
      else { input = el('input'); input.type = 'text'; input.maxLength = 300; }
      input.id = id; if (f.ph) input.placeholder = f.ph;
      const v = I.form[f.k];
      if (v) { if (f.type === 'select' && ![...input.options].some((o) => o.value === v)) input.appendChild(new Option(v, v)); input.value = v; }
      const keep = () => { I.form[f.k] = input.value; save(); goLabel(); };
      input.addEventListener('input', keep); input.addEventListener('change', keep);
      box.appendChild(input);
      (f.type === 'area' ? form : grid).appendChild(box);
      if (f.k === 'trial') form.appendChild(grid);
    });
    if (window.SBE_OPEN && SBE_OPEN.scan) try { SBE_OPEN.scan(form); } catch (e) {}
    goLabel();
  }
  function readForm() { const d = {}; M.FIELDS.forEach((f) => { d[f.k] = (F('f-' + f.k).value || '').trim(); }); return d; }
  function goLabel() { F('go').textContent = (I.form.chosen || '').trim() ? 'בניית לוח הביצוע וההסכם' : 'הצעת אפשרויות לבחירה'; }

  // ── ייבוא מנגנון שתוכנן בסטודיו חוסן ──
  function studioMech() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY('sbe.studio.v1')) || 'null'), st = v && v.state, a = st && st.activity;
      const m = a && a.socialMechanism; if (!m || !m.type || m.type === 'none') return null;
      return { a, m, b: st.activityBrief || st.brief || {} };
    } catch (e) { return null; }
  }
  const STUDIO_TYPES = { routine: 'מפגש חוסן קבוע', board: 'לוח עזרה', 'monthly-day': 'מפגש חוסן קבוע', agreement: 'מועצת כיתה', 'action-team': 'צוות פעולה', committee: 'ועדה' };
  (function studioButton() {
    const s = studioMech(); if (!s) return;
    const b = F('fromStudio'); b.hidden = false;
    b.addEventListener('click', () => {
      const { a, m, b: br } = s, j = (...x) => x.map((y) => String(y || '').trim()).filter(Boolean).join('\n');
      Object.assign(I.form, {
        mechType: STUDIO_TYPES[m.type] || I.form.mechType || '', when: m.cadence || I.form.when || '',
        purpose: I.form.purpose || txt(a.purpose || ''), chosen: j(m.name, m.firstAction),
        context: j(I.form.context, m.roles && 'תפקידים: ' + m.roles, m.participation && 'השתתפות: ' + m.participation, m.review && 'בדיקה ושיפור: ' + m.review, a.title && 'מתוך הפעילות בסטודיו: ' + a.title),
        size: I.form.size || [br.participants, br.count].filter(Boolean).join(', ')
      });
      save(); buildForm();
    });
  })();

  // ── צעדים ──
  const STEPS = F('steps');
  M.STAGES.forEach((s) => { const li = el('li'); li.dataset.step = s.n; li.appendChild(el('b', null, s.n + '. ' + s.t)); li.appendChild(document.createTextNode(s.d)); STEPS.appendChild(li); });
  function goStep(n) {
    if (n > 1 && !I.plan) n = 1;
    I.step = n; save();
    for (let i = 1; i <= 4; i++) F('s' + i).hidden = i !== n;
    STEPS.querySelectorAll('li').forEach((li) => { const i = +li.dataset.step; li.classList.toggle('on', i === n); li.classList.toggle('done', i < n && !!I.plan); });
    if (n === 1) drawOptions(); else draw(n);
    renderHub();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  STEPS.querySelectorAll('li').forEach((li) => li.addEventListener('click', () => goStep(+li.dataset.step)));
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => goStep(+b.dataset.go)));

  // ── המתנה ──
  function waiting(node, text, exp) {
    node.hidden = false; node.textContent = '';
    const line = el('div'), bar = el('div', 'bar'), fill = el('div'); bar.appendChild(fill); node.append(line, bar);
    const t0 = Date.now();
    const tick = () => { const s = Math.round((Date.now() - t0) / 1000); line.textContent = text + ' בדרך כלל ' + exp + ' שניות. עברו ' + s + ' שניות.'; fill.style.width = Math.min(95, s / exp * 90) + '%'; };
    tick(); const iv = setInterval(tick, 1000);
    return () => { clearInterval(iv); node.hidden = true; };
  }
  const ask = (system, content, check) => window.sbeCallAIJson(SERVER, { system, messages: [{ role: 'user', content }], maxTokens: 7000, customerReview: true }, 300000, check);
  function fail(n, m) { n.textContent = m; n.hidden = false; }

  // ── עזרים לתצוגה ──
  function head(root, key, extra) { const s = M.SECTIONS[key]; root.appendChild(el('h3', null, s.h + (extra || ''))); if (s.sub) root.appendChild(el('p', 'sub', s.sub)); }
  const T = (key, rows) => window.SBE_TABLE(M.SECTIONS[key].cols, rows, 'kit-t');
  const KV = (rows) => window.SBE_TABLE(null, rows.filter((r) => r[1]), 'kit-t');
  function field(obj, k, label, area, onChange) {
    const i = area ? el('textarea') : el('input'); if (!area) i.type = 'text'; else i.rows = 2;
    i.value = txt(obj[k] || ''); i.setAttribute('aria-label', label);
    i.addEventListener('input', () => { obj[k] = i.value; save(); if (onChange) onChange(); }); return i;
  }
  function choice(obj, k, label, opts, onChange) {
    const s = el('select'); s.setAttribute('data-closed', ''); s.setAttribute('aria-label', label);
    s.appendChild(new Option('בחירה…', '')); opts.forEach((o) => s.appendChild(new Option(o, o))); s.value = obj[k] || '';
    s.addEventListener('change', () => { obj[k] = s.value; save(); if (onChange) onChange(); }); return s;
  }
  // טבלה לעריכה: שורה לכל פריט, תא עם שדה לכל עמודה, ובתא האחרון כפתור הסרה
  function etable(cols, list, keys, opts) {
    opts = opts || {};
    const wrap = el('div');
    const redraw = () => {
      wrap.textContent = '';
      const t = window.SBE_TABLE(cols, list.map((r, ri) => keys.map((k, ci) => {
        const cell = el('div'); cell.appendChild(field(r, k, cols[ci], opts.area));
        if (ci === keys.length - 1 && opts.remove !== false) { const x = btn('✕', 'xbtn no-print', () => { list.splice(ri, 1); save(); redraw(); }); x.setAttribute('aria-label', 'הסרת השורה'); cell.appendChild(x); }
        return cell;
      })), 'kit-t etable');
      wrap.appendChild(t);
      if (opts.add) wrap.appendChild(btn('➕ ' + opts.add, 'btn btn-ghost sm no-print', () => { list.push({}); save(); redraw(); }));
    };
    redraw(); return wrap;
  }
  function withRefs(build) {
    const root = el('div', 'kit');
    if (window.SBE_REFS) SBE_REFS.begin(SRC, 'resilience-advisor-sources.html');
    build(root);
    if (window.SBE_REFS) { SBE_REFS.add(arr(I.plan && I.plan.sources).concat(arr(I.optSources))); const rs = SBE_REFS.end(); if (rs) root.appendChild(rs); }
    return root;
  }

  // ── צעד 1: האפשרויות ──
  function drawOptions() {
    const box = F('opts'); box.textContent = '';
    if (!I.options) { box.hidden = true; return; }
    box.hidden = false;
    head(box, 'options');
    box.appendChild(T('options', I.options.map((o) => [txt(o.name), txt(o.what), txt(o.now), txt(o.future), txt(o.first)])));
    if (I.choose) { head(box, 'choose'); box.appendChild(T('choose', [[txt(I.choose.how), txt(I.choose.who), txt(I.choose.when)]])); }
    const row = el('div', 'grid2');
    const f1 = el('div', 'f'), l1 = el('label', null, 'מה הקבוצה בחרה'), s1 = el('select');
    s1.id = 'pick'; l1.htmlFor = 'pick'; s1.setAttribute('data-closed', '');
    s1.appendChild(new Option('בחירה…', '')); I.options.forEach((o, i) => s1.appendChild(new Option(txt(o.name), String(i))));
    s1.appendChild(new Option('פעולה אחרת (כתבו בשדה "הפעולה שהקבוצה כבר בחרה")', 'other'));
    s1.value = I.pick || ''; s1.addEventListener('change', () => { I.pick = s1.value; save(); });
    f1.append(l1, s1);
    const f2 = el('div', 'f'), l2 = el('label', null, 'איך הקבוצה החליטה'), s2 = el('select');
    s2.id = 'how'; l2.htmlFor = 'how'; s2.appendChild(new Option('בחירה…', ''));
    ['הסכמה בשיחה', 'הצבעה', 'בחירה של נציגים', 'שילוב של שתי אפשרויות'].forEach((o) => s2.appendChild(new Option(o, o)));
    if (I.how && ![...s2.options].some((o) => o.value === I.how)) s2.appendChild(new Option(I.how, I.how));
    s2.value = I.how || ''; s2.addEventListener('change', () => { I.how = s2.value; save(); });
    f2.append(l2, s2); row.append(f1, f2); box.appendChild(row);
    if (window.SBE_OPEN && SBE_OPEN.scan) try { SBE_OPEN.scan(box); } catch (e) {}
    box.appendChild(btn('בניית לוח הביצוע וההסכם', 'btn', build));
    box.appendChild(withRefs(() => {}));
  }
  function chosenText() {
    if (I.pick && I.pick !== 'other' && I.options && I.options[+I.pick]) { const o = I.options[+I.pick]; return txt(o.name) + ': ' + txt(o.what) + (o.first ? ' הצעד הראשון: ' + txt(o.first) : ''); }
    return (I.form.chosen || '').trim();
  }
  F('go').addEventListener('click', async () => {
    const d = readForm(); I.form = d; save();
    const missing = M.FIELDS.filter((f) => f.main && !d[f.k]).map((f) => f.l.replace(/:.*$/, ''));
    F('err1').hidden = true;
    if (missing.length) return fail(F('err1'), 'כדי להמשיך, נשמח למלא: ' + missing.join(', ') + '.');
    if (d.chosen) { I.pick = 'other'; return build(); }
    const b = F('go'); b.disabled = true; const stop = waiting(F('wait1'), 'מכינה כמה אפשרויות לבחירה.', 40);
    let o = null, bad = null;
    try { o = await ask(M.optionsSystem(KB), 'השדות:\n' + M.inputText(d) + '\n\nהציעי אפשרויות.', M.validOptions); } catch (e) { bad = e; console.warn('מרכז שגרות, אפשרויות:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!M.validOptions(o)) return fail(F('err1'), why(bad));
    I.options = o.options.filter((x) => x && x.name); I.choose = o.choose || null; I.optSources = arr(o.sources); I.pick = ''; save(); drawOptions();
    F('opts').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  async function build() {
    const act = chosenText();
    F('err1').hidden = true;
    if (!act) return fail(F('err1'), 'כדי להמשיך, בחרו את הפעולה שהקבוצה בחרה, או כתבו אותה בשדה "הפעולה שהקבוצה כבר בחרה".');
    const b = F('go'); b.disabled = true; const stop = waiting(F('wait1'), 'מכינה לוח ביצוע, כרטיסי תפקיד והסכם לתקופת ניסיון.', 70);
    let k = null, bad = null;
    try { k = await ask(M.planSystem(KB, WRITER), 'השדות:\n' + M.inputText(I.form) + '\n\nהפעולה שהקבוצה בחרה: ' + act + (I.how ? '\nאיך הוחלט: ' + I.how : '') + '\n\nהכיני את התוצר.', M.valid); }
    catch (e) { bad = e; console.warn('מרכז שגרות, לוח:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!M.valid(k)) return fail(F('err1'), why(bad));
    Object.assign(I, { plan: k, version: 1, at: today(), people: {}, runs: [RUN(), RUN()], decided: {}, proposal: null, changes: [], ansAI: [], balance: '', versions: [], rounds: [] });
    I.log = [{ d: today(), what: 'בחרנו בפעולה: ' + (txt(k.action && k.action.name) || act.slice(0, 80)), how: I.how || '', who: '' }];
    save(); goStep(2);
  }

  // ── צעד 2: מאשרים אחריות ──
  function roleCards(editable) {
    const box = el('section'); head(box, 'roles');
    const grid = el('div', 'roles');
    arr(I.plan.roles).forEach((r) => {
      const key = txt(r.role), p = I.people[key] || (I.people[key] = { who: '', backup: '', ok: false });
      const c = el('div', 'rcard role' + (p.ok ? ' ok' : ''));
      c.appendChild(el('h4', null, key + (p.ok ? ' ✓' : '')));
      if (editable) {
        const ppl = el('div', 'ppl');
        const w = el('label', null, 'מי בתפקיד'); w.appendChild(field(p, 'who', 'מי בתפקיד: ' + key)); const bk = el('label', null, 'מי מגבה'); bk.appendChild(field(p, 'backup', 'מי מגבה: ' + key));
        ppl.append(w, bk); c.appendChild(ppl);
        M.ROLE_ROWS.forEach(([k2, l]) => { const row = el('div', 'rcard-row'); row.appendChild(el('b', null, l)); row.appendChild(field(r, k2, l, true)); c.appendChild(row); });
        const ok = el('label', 'okline'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!p.ok;
        cb.addEventListener('change', () => { p.ok = cb.checked; save(); c.classList.toggle('ok', p.ok); c.querySelector('h4').textContent = key + (p.ok ? ' ✓' : ''); });
        ok.append(cb, document.createTextNode(' אישר/ה את התפקיד ואת הגיבוי')); c.appendChild(ok);
      } else {
        if (p.who || p.backup) c.appendChild(el('p', 'rcard-meta', [p.who && 'בתפקיד: ' + p.who, p.backup && 'מגבה: ' + p.backup].filter(Boolean).join(' · ')));
        M.ROLE_ROWS.forEach(([k2, l]) => { if (!r[k2]) return; const row = el('div', 'rcard-row'); row.appendChild(el('b', null, l)); row.appendChild(el('span', null, txt(r[k2]))); c.appendChild(row); });
      }
      grid.appendChild(c);
    });
    box.appendChild(grid); return box;
  }
  const BOARD_KEYS = ['task', 'role', 'backup', 'when', 'done'];
  function boardBlock(plan, editable) {
    const box = el('section'); head(box, 'board');
    if (editable) box.appendChild(etable(M.SECTIONS.board.cols, plan.board, BOARD_KEYS, { add: 'הוספת משימה', area: true }));
    else box.appendChild(T('board', arr(plan.board).map((t) => BOARD_KEYS.map((k) => txt(t[k])))));
    return box;
  }
  function agreementBlock(plan, editable, label) {
    const box = el('section'); head(box, 'agreement', label || (' · גרסה ' + I.version));
    const a = plan.agreement || (plan.agreement = {});
    if (editable) box.appendChild(window.SBE_TABLE(null, M.AGREEMENT_ROWS.map(([k, l]) => [l, field(a, k, l, true)]), 'kit-t etable'));
    else box.appendChild(KV(M.AGREEMENT_ROWS.map(([k, l]) => [l, txt(a[k])])));
    return box;
  }
  function runPlan(plan) {
    const box = el('section'); head(box, 'run');
    box.appendChild(T('run', arr(plan.run).map((r) => [txt(r.part), txt(r.what), txt(r.lead), r.minutes ? r.minutes + ' דקות' : ''])));
    if (arr(plan.after).length) { head(box, 'after'); box.appendChild(T('after', plan.after.map((q) => [txt(q.who), txt(q.question), txt(q.why)]))); }
    return box;
  }
  function meaning(plan) {
    const box = el('section'), f = plan.future || {};
    head(box, 'future'); box.appendChild(KV([['לאן זה מוביל', txt(f.picture)], ['מה טוב לנו כבר עכשיו', txt(f.now)], ['איך שומרים על שניהם', txt(f.both)]]));
    if (arr(plan.resilience).length) { head(box, 'resilience'); box.appendChild(T('resilience', plan.resilience.map((r) => [txt(r.component), txt(r.how)]))); }
    if (arr(plan.skills).length) { head(box, 'skills'); box.appendChild(T('skills', plan.skills.map((s) => [txt(s.skill), txt(s.kind), txt(s.where)]))); }
    return box;
  }
  function metaLine(box) { box.appendChild(el('p', 'kit-meta', nameOf(I) + ' · ' + (I.form.mechType || '') + ' · גרסה ' + I.version + ' · ' + (I.at || today()))); }

  // ── צעד 3: שתי הפעלות ──
  function runCard(run, n) {
    const c = el('section', 'runcard'); c.appendChild(el('h3', null, 'הפעלה ' + n));
    const d = el('div', 'f'), dl = el('label', null, 'תאריך'), di = el('input'); di.type = 'date'; di.value = run.date || ''; di.id = 'rd' + n; dl.htmlFor = di.id;
    di.addEventListener('change', () => { run.date = di.value; save(); }); d.append(dl, di); c.appendChild(d);
    c.appendChild(window.SBE_TABLE(['המשימה', 'תפקיד', 'מה קרה'], arr(I.plan.board).map((t, i) => {
      const s = el('select'); s.setAttribute('data-closed', ''); s.setAttribute('aria-label', 'מה קרה: ' + txt(t.task)); s.appendChild(new Option('בחירה…', ''));
      M.STATUS.forEach((o) => s.appendChild(new Option(o, o))); s.value = run.status[i] || '';
      s.addEventListener('change', () => { run.status[i] = s.value; save(); });
      return [txt(t.task), txt(t.role), s];
    }), 'kit-t'));
    [['worked', 'מה עבד'], ['hard', 'מה היה קשה']].forEach(([k, l]) => { const f = el('div', 'f'); f.appendChild(el('label', null, l)); f.lastChild.htmlFor = 'r' + n + k; const t = field(run, k, l, true); t.id = 'r' + n + k; t.placeholder = 'בלי שמות. מה קרה בפעולה.'; f.appendChild(t); c.appendChild(f); });
    const nx = el('div', 'f'); nx.appendChild(el('label', null, 'בסוף ההפעלה, כולם ידעו מה הצעד הבא ומי אחראי/ת עליו?')); nx.appendChild(choice(run, 'next', 'כולם ידעו מה הצעד הבא', ['כן, כולם', 'חלק', 'עוד לא'])); c.appendChild(nx);
    c.appendChild(el('h4', null, M.SECTIONS.requests.h));
    c.appendChild(etable(M.SECTIONS.requests.cols, run.reqs, ['role', 'what', 'why'], { add: 'הוספת בקשה לשינוי', area: true }));
    return c;
  }
  function allRequests() { const out = []; I.runs.forEach((r, ri) => arr(r.reqs).forEach((q, qi) => { if ((q.what || '').trim()) out.push({ id: ri + '-' + qi, q, n: ri + 1 }); })); return out; }

  // ── צעד 4: פותחים לשינוי ──
  function checksBlock() {
    const box = el('section'); box.id = 'checks'; head(box, 'checks');
    const N = arr(I.plan.board).length;
    const done = I.runs.map((r, i) => { const c = Object.values(r.status).filter((s) => s === 'בוצע').length; return Object.keys(r.status).length ? 'הפעלה ' + (i + 1) + ': ' + c + ' מתוך ' + N : ''; }).filter(Boolean).join(' · ');
    const next = I.runs.map((r, i) => r.next ? 'הפעלה ' + (i + 1) + ': ' + r.next : '').filter(Boolean).join(' · ');
    const reqs = allRequests(), ans = reqs.filter((x) => (I.decided[x.id] || {}).status).length;
    box.appendChild(T('checks', [
      ['המשימות בלוח שבוצעו', done || 'עוד לא תועד'],
      ['כולם ידעו מה הצעד הבא?', next || 'עוד לא תועד'],
      ['בקשות השינוי קיבלו מענה?', reqs.length ? ans + ' מתוך ' + reqs.length : 'לא עלו בקשות']
    ]));
    return box;
  }
  function answersBlock() {
    const reqs = allRequests(); if (!reqs.length) return null;
    const box = el('section'); head(box, 'answers');
    box.appendChild(T('answers', reqs.map((x, i) => {
      const ai = I.ansAI[i] || {}, dec = I.decided[x.id] || (I.decided[x.id] = { status: '', note: '' });
      const cell = el('div'); cell.appendChild(choice(dec, 'status', 'מה הוחלט', M.ANSWER, () => { const c = F('checks'); if (c) c.replaceWith(checksBlock()); })); const note = field(dec, 'note', 'הערה להחלטה'); note.placeholder = 'במה ולמה'; cell.appendChild(note);
      return [(x.q.role ? x.q.role + ': ' : '') + x.q.what + (x.q.why ? ' (' + x.q.why + ')' : ''), txt(ai.answer), txt(ai.why), cell];
    })));
    return box;
  }
  function logBlock(editable) {
    const box = el('section'); head(box, 'log');
    if (editable) box.appendChild(etable(M.SECTIONS.log.cols, I.log, ['d', 'what', 'how', 'who'], { add: 'הוספת החלטה', area: true }));
    else box.appendChild(T('log', I.log.map((r) => [r.d, r.what, r.how, r.who])));
    return box;
  }
  function versionsBlock() {
    if (!I.versions.length) return null;
    const box = el('section'); head(box, 'versions');
    box.appendChild(T('versions', I.versions.map((v) => ['גרסה ' + v.v, v.at, v.by, v.note]))); return box;
  }
  function proposalBlock() {
    const box = el('section', 'proposal'), P = I.proposal;
    if (I.balance) { box.appendChild(el('h3', null, 'תמונת העתיד ואיכות החיים, יחד')); box.appendChild(el('p', 'balance', txt(I.balance))); }
    if (I.changes.length) { head(box, 'changes', ' ' + (I.version + 1)); box.appendChild(T('changes', I.changes.map((c) => [txt(c.where), txt(c.what), txt(c.why)]))); }
    box.appendChild(agreementBlock(P, true, ' · הצעה לגרסה ' + (I.version + 1)));
    box.appendChild(boardBlock(P, true));
    const row = el('div', 'actions no-print'), lab = el('label', null, 'מי אישר/ה'), by = el('input');
    by.type = 'text'; by.id = 'approver'; lab.htmlFor = 'approver'; by.value = I.approver || 'הקבוצה, והמחנכת אישרה את הגבולות';
    by.addEventListener('input', () => { I.approver = by.value; save(); });
    row.append(lab, by, btn('✓ אישור גרסה ' + (I.version + 1), 'btn sm', approveNext)); box.appendChild(row);
    return box;
  }
  function approveNext() {
    const P = I.proposal; if (!P) return;
    const reqs = allRequests();
    reqs.forEach((x) => { const d = I.decided[x.id] || {}; if (d.status) I.log.push({ d: today(), what: 'בקשה לשינוי: ' + x.q.what + '. ' + d.status + (d.note ? ': ' + d.note : ''), how: I.how || '', who: '' }); });
    I.rounds.push({ version: I.version, runs: I.runs, decided: I.decided });
    I.version += 1; I.plan = P; I.at = today();
    I.versions.push({ v: I.version, at: today(), by: I.approver || 'הקבוצה, והמחנכת אישרה את הגבולות', note: I.changes.map((c) => txt(c.what)).filter(Boolean).slice(0, 3).join('; ') || 'גרסה חדשה' });
    I.log.push({ d: today(), what: 'אישרנו את גרסה ' + I.version + ' של ההסכם, לתקופת ניסיון נוספת', how: I.how || '', who: '' });
    Object.assign(I, { proposal: null, changes: [], ansAI: [], balance: '', runs: [RUN(), RUN()], decided: {} });
    save(); goStep(2);
  }

  function draw(n) {
    if (!I.plan) return;
    const box = F('out' + n); box.textContent = ''; metaLine(box);
    if (n === 2) {
      box.appendChild(KV([['הפעולה', txt(I.plan.action && I.plan.action.name)], ['מה רוצים שיקרה', txt(I.plan.action && I.plan.action.purpose)], ['מתי ואיפה', txt(I.plan.action && I.plan.action.when)]]));
      box.appendChild(withRefs((r) => {
        r.appendChild(boardBlock(I.plan, true)); r.appendChild(roleCards(true)); r.appendChild(agreementBlock(I.plan, true));
        r.appendChild(runPlan(I.plan)); r.appendChild(meaning(I.plan));
      }));
      const v = versionsBlock(); if (v) box.appendChild(v);
      const row = el('div', 'actions no-print'), lab = el('label', null, 'מי אישר/ה'), by = el('input');
      by.type = 'text'; by.id = 'approver1'; lab.htmlFor = 'approver1'; by.value = I.approver || 'הקבוצה, והמחנכת אישרה את הגבולות';
      by.addEventListener('input', () => { I.approver = by.value; save(); });
      const signed = I.versions.some((x) => x.v === I.version);
      row.append(lab, by, btn(signed ? '✓ גרסה ' + I.version + ' אושרה · מנסים פעמיים ←' : '✓ אישור ההסכם לתקופת ניסיון', 'btn sm', () => {
        if (!signed) { I.versions.push({ v: I.version, at: today(), by: I.approver || by.value, note: I.version === 1 ? 'גרסה ראשונה' : 'גרסה ' + I.version }); I.log.push({ d: today(), what: 'אישרנו את ההסכם לתקופת ניסיון (גרסה ' + I.version + ')', how: I.how || '', who: '' }); save(); }
        goStep(3);
      }));
      box.appendChild(row);
    }
    if (n === 3) {
      const det = el('details', 'more'); det.appendChild(el('summary', null, 'מהלך כל הפעלה ושאלות לסיום')); det.appendChild(runPlan(I.plan)); box.appendChild(det);
      const g = el('div', 'runs'); I.runs.forEach((r, i) => g.appendChild(runCard(r, i + 1))); box.appendChild(g);
      if (window.SBE_OPEN && SBE_OPEN.scan) try { SBE_OPEN.scan(box); } catch (e) {}
    }
    if (n === 4) {
      box.appendChild(checksBlock());
      const a = answersBlock(); if (a) box.appendChild(a);
      if (I.proposal) box.appendChild(proposalBlock());
      box.appendChild(logBlock(true));
      const v = versionsBlock(); if (v) box.appendChild(v);
    }
  }

  F('revise').addEventListener('click', async () => {
    const used = I.runs.filter((r) => r.date || r.worked || r.hard || r.next || Object.keys(r.status).length || r.reqs.length);
    F('err4').hidden = true;
    if (!used.length) return fail(F('err4'), 'כדי לפתוח לשינוי, נשמח לתיעוד של הפעלה אחת לפחות (עדיף שתיים) בצעד 3.');
    const N = names();
    const log = I.runs.map((r, i) => 'הפעלה ' + (i + 1) + (r.date ? ' (' + fmtDate(r.date) + ')' : '') + ':\n' +
      arr(I.plan.board).map((t, j) => '- ' + txt(t.task) + ': ' + (r.status[j] || 'לא תועד')).join('\n') +
      '\nמה עבד: ' + (r.worked || '[לא נכתב]') + '\nמה היה קשה: ' + (r.hard || '[לא נכתב]') + '\nכולם ידעו מה הצעד הבא: ' + (r.next || 'לא תועד')).join('\n\n');
    const reqs = allRequests().map((x, i) => (i + 1) + '. ' + (x.q.role ? x.q.role + ' מבקש/ת: ' : '') + x.q.what + (x.q.why ? ' (כי ' + x.q.why + ')' : '')).join('\n');
    const plan = copy(I.plan); delete plan.sources;
    const b = F('revise'); b.disabled = true; const stop = waiting(F('wait4'), 'מכינה הצעה לגרסה הבאה של ההסכם.', 80);
    let k = null, bad = null;
    try {
      k = await ask(M.reviseSystem(KB, WRITER), M.anonymize('השדות:\n' + M.inputText(I.form) + '\n\nההסכם והלוח הנוכחיים (גרסה ' + I.version + ', JSON):\n' + JSON.stringify(plan) +
        '\n\nהתיעוד מההפעלות:\n' + log + '\n\nבקשות לשינוי:\n' + (reqs || '[לא עלו בקשות]') + '\n\nהכיני את ההצעה לגרסה הבאה.', N), M.valid);
    } catch (e) { bad = e; console.warn('מרכז שגרות, שינוי:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!M.valid(k)) return fail(F('err4'), why(bad));
    I.changes = arr(k.changes); I.ansAI = arr(k.answers); I.balance = k.balance || ''; delete k.changes; delete k.answers; delete k.balance;
    I.proposal = k; save(); draw(4);
  });

  // ── הדפסה: הכול נבנה מהנתונים, כולל השמות שבמכשיר ──
  function printable(what) {
    const out = el('div'), P = I.plan;
    if (what === 'board') {
      out.appendChild(KV([['הפעולה', txt(P.action && P.action.name)], ['מתי ואיפה', txt(P.action && P.action.when)]]));
      [boardBlock(P, false), roleCards(false), agreementBlock(P, false)].forEach((x) => out.appendChild(x));
      return out;
    }
    if (what === 'sheet') {
      out.appendChild(el('p', null, 'תאריך: ____________'));
      head(out, 'board');
      out.appendChild(window.SBE_TABLE(['המשימה', 'תפקיד', 'מי מגבה', 'בוצע', 'חלקית', 'לא בוצע'], arr(P.board).map((t) => [txt(t.task), txt(t.role), txt(t.backup), '☐', '☐', '☐']), 'kit-t'));
      out.appendChild(runPlan(P));
      head(out, 'requests'); out.appendChild(window.SBE_TABLE(M.SECTIONS.requests.cols, [1, 2, 3].map(() => [0, 1, 2].map(() => { const d = el('div'); d.style.height = '2.4em'; return d; })), 'kit-t blank'));
      return out;
    }
    if (what === 'log') {
      const v = versionsBlock(); if (v) out.appendChild(v);
      out.appendChild(agreementBlock(P, false)); out.appendChild(logBlock(false));
      const reqs = allRequests(); if (reqs.length) { head(out, 'requests'); out.appendChild(window.SBE_TABLE(['הבקשה', 'מה הוחלט'], reqs.map((x) => [x.q.what, [(I.decided[x.id] || {}).status, (I.decided[x.id] || {}).note].filter(Boolean).join(': ')]), 'kit-t')); }
      return out;
    }
    out.appendChild(withRefs((r) => {
      r.appendChild(KV([['הפעולה', txt(P.action && P.action.name)], ['מה רוצים שיקרה', txt(P.action && P.action.purpose)], ['מתי ואיפה', txt(P.action && P.action.when)]]));
      [agreementBlock(P, false), boardBlock(P, false), roleCards(false), runPlan(P), meaning(P), logBlock(false)].forEach((x) => r.appendChild(x));
      const v = versionsBlock(); if (v) r.appendChild(v);
    }));
    const attached = !!document.querySelector('#out2 .sbe-refs.attach');
    out.querySelectorAll('.sbe-refs').forEach((x) => { if (attached) x.classList.add('attach'); });
    return out;
  }
  const KIND = { board: 'לוח ביצוע וכרטיסי תפקיד', sheet: 'לוח להפעלה', log: 'יומן החלטות', all: 'תיק המנגנון' };
  document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => {
    if (!I.plan) return;
    const w = b.dataset.print;
    window.SBE_DOC.print({ title: nameOf(I), subtitle: [I.form.mechType, I.form.age, I.form.when].filter(Boolean).join(' · ') + ' · גרסה ' + I.version, kind: KIND[w], node: printable(w) });
  }));
  F('remind').addEventListener('click', () => {
    const v = F('reviewDate').value; if (!v) { F('reviewDate').focus(); return; }
    I.reviewDate = v; save();
    const d = v.replace(/-/g, ''), ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Begood//Routines//HE', 'BEGIN:VEVENT', 'UID:' + Date.now() + '@be-good.co.il',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), 'DTSTART;VALUE=DATE:' + d, 'SUMMARY:פותחים לשינוי · ' + nameOf(I),
      'DESCRIPTION:בודקים את הלוח ואת בקשות השינוי\\, ופותחים את ההסכם לשינוי לאור תמונת העתיד ואיכות החיים עכשיו.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = el('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'פותחים-לשינוי.ics';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  });

  // ── קובץ המרכז: מעבר בין מכשירים ──
  F('saveFile').addEventListener('click', () => {
    if (!confirm('בקובץ יש גם את השמות שבכרטיסי התפקיד. כדאי לשמור אותו רק במקום פרטי. להמשיך?')) return;
    const blob = new Blob([JSON.stringify({ type: 'begood-routines', v: 1, savedAt: new Date().toISOString(), items: S.items })], { type: 'application/json' });
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'מרכז-שגרות.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  });
  F('openFile').addEventListener('change', async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!o || o.type !== 'begood-routines' || !Array.isArray(o.items)) throw new Error('זה לא קובץ של מרכז השגרות');
      const have = new Set(S.items.map((x) => x.id));
      o.items.filter((x) => x && x.id && x.form && !have.has(x.id)).forEach((x) => S.items.push(Object.assign(ITEM(), x)));
      S.items = S.items.filter((x) => x.plan || x.options || Object.values(x.form).some(Boolean) || x.id === I.id);
      save(); renderHub();
    } catch (e) { alert('לא הצלחנו לפתוח את הקובץ: ' + e.message); } finally { ev.target.value = ''; }
  });

  F('example').addEventListener('click', () => {
    const ex = { mechType: 'לוח עזרה', age: 'ה–ו', size: 'כל הכיתה, 30 תלמידים', when: 'כל יום ראשון, 15 דקות בשיעור חינוך, ובמשך השבוע לפי הלוח', trial: 'שתי הפעלות',
      purpose: 'שמי שרוצה עזרה בשיעורי הבית או בהפסקה ימצא אותה בכיתה, בלי להתבייש לבקש.',
      future: 'בעוד חצי שנה בקשת עזרה היא דבר רגיל בכיתה, ויותר תלמידים גם נותנים עזרה ולא רק מקבלים.',
      now: 'כבר בשבוע הראשון שניים או שלושה תלמידים יקבלו עזרה שביקשו, ויהיה רגע נעים של תודה בסוף ההפעלה.',
      bounds: 'הקבוצה בוחרת את המשימות והתפקידים. יציאה מהכיתה ושימוש בשעת שיעור באישור המחנכת.',
      context: 'בכיתה כבר יש לוח מודעות שלא משתמשים בו. יש תלמידים שעוזרים לחברים באופן טבעי, ויש כאלה שלא מבקשים.',
      chosen: 'לוח עזרה שבועי: כל אחד ואחת יכולים לכתוב "אשמח לעזרה ב..." או "אני יכול/ה לעזור ב...", וצוות הלוח מחבר בין הבקשות להצעות.' };
    M.FIELDS.forEach((f) => { const i = F('f-' + f.k); if (f.type === 'select' && ex[f.k] && ![...i.options].some((o) => o.value === ex[f.k])) i.appendChild(new Option(ex[f.k], ex[f.k])); i.value = ex[f.k] || ''; });
    I.form = ex; save(); goLabel(); F('err1').hidden = true;
  });

  function openItem() {
    buildForm(); F('err1').hidden = true; F('err4').hidden = true;
    F('reviewDate').value = I.reviewDate || '';
    goStep(I.plan ? (I.step || 2) : 1);
  }
  openItem();
})();
