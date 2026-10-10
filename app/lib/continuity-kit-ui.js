// תיק רציפות: המסך (app/continuity-kit.html). ההנחיות למודל ומבנה התיק ב-lib/continuity-model.js (SBE_CONT).
// שלושה צעדים: 1 מספרים · 2 התיק (שגרה · חירום ולמידה מרחוק · התלמידים · עדכוני המחליפה) · 3 בודקים יחד.
// מידע רגיש (רשימת התלמידים, פרטי ההורים, מידע חשוב, מענה פרטני, עדכוני המחליפה) נשמר במכשיר בלבד,
// לא נשלח למודל ולא לשרת, ומסומן .sens כדי שאפשר יהיה להדפיס עותק בלעדיו.
// בלי חיבור למודל אין תוצר. הכול נשמר במכשיר לפי משתמש/ת (sbeUserKey), ואפשר להעביר את התיק כקובץ.
(function () {
  'use strict';
  const C = window.SBE_CONT, SRC = window.SBE_ADVISOR_SOURCES;
  const KB = SRC.forAdvisor('continuity');
  const WRITER = window.SBE_WRITER ? window.SBE_WRITER.rule : '';
  const STORE = window.sbeUserKey ? sbeUserKey('sbe.continuity.v2') : 'sbe.continuity.v2:anon';
  const SERVER = window.sbeAIOrigin ? window.sbeAIOrigin() : 'https://sbe-server.onrender.com';
  const F = (id) => document.getElementById(id);
  const NO_MODEL = 'אין כרגע חיבור למודל, ולכן התיק לא הוכן. מה שמילאת נשמר, ואפשר לנסות שוב בעוד דקה או שתיים.';
  try { const h = sessionStorage.getItem('sbe.session.homeUrl'); if (h) F('nav-home').href = h; } catch (e) {}
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  function btn(text, cls, fn) { const b = el('button', cls || 'btn btn-ghost', text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  const today = () => new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const EMPTY = () => ({ form: {}, kit: null, emerg: null, version: 0, at: '', history: [], tab: 'routine', review: '',
    local: { students: [], studentsLink: '', red: [], individual: [], plans: [], updates: [], readiness: {}, teams: [], letter: {} },
    join: { form: {}, kit: null, info: [], choice: '', done: {}, log: [], checkWhen: '' }, proc: {} });
  let S = EMPTY();
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (v && v.form) { S = Object.assign(EMPTY(), v); S.local = Object.assign(EMPTY().local, v.local || {}); S.join = Object.assign(EMPTY().join, v.join || {}); S.proc = v.proc || {}; }
    } catch (e) {}
  }
  load();
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} drawStatus(); }

  // ── הטופס ──
  function fieldBox(f, parent) {
    const box = el('div', 'f'), id = 'f-' + f.k, label = el('label', null, f.l);
    label.htmlFor = id;
    if (f.main) label.appendChild(el('span', 'main-tag', 'שדה עיקרי'));
    box.appendChild(label);
    let input;
    if (f.type === 'select') { input = el('select'); input.appendChild(new Option('בחירה…', '')); f.opts.forEach((o) => input.appendChild(new Option(o, o))); }
    else if (f.type === 'area') { input = el('textarea'); input.maxLength = 3000; }
    else { input = el('input'); input.type = 'text'; input.maxLength = 300; }
    input.id = id; if (f.ph) input.placeholder = f.ph;
    const v = S.form[f.k];
    if (v) { if (f.type === 'select' && ![...input.options].some((o) => o.value === v)) input.appendChild(new Option(v, v)); input.value = v; }
    const keep = () => { S.form[f.k] = input.value; save(); };
    input.addEventListener('input', keep); input.addEventListener('change', keep);
    box.appendChild(input); parent.appendChild(box);
  }
  (function buildForm() {
    const form = F('form');
    const top = el('div', 'grid2');
    C.FIELDS.filter((f) => f.type !== 'area' && f.k !== 'update').forEach((f) => fieldBox(f, top));
    form.appendChild(top);
    C.FIELDS.filter((f) => f.type === 'area').forEach((f) => fieldBox(f, form));
    fieldBox(C.FIELDS.find((f) => f.k === 'update'), form);
    const em = el('details', 'more'); em.open = true;
    em.appendChild(el('summary', null, '🚨 חירום ולמידה מרחוק'));
    C.EMERG_FIELDS.forEach((f) => fieldBox(f, em));
    form.appendChild(em);
    form.appendChild(el('p', 'privacy', 'את רשימת התלמידים, פרטי ההורים, המידע הרפואי והמענה הפרטני ממלאים בתיק עצמו, בצעד הבא. המידע הזה נשמר במכשיר בלבד.'));
  })();
  function readForm() { const d = {}; C.FIELDS.concat(C.EMERG_FIELDS).forEach((f) => { d[f.k] = (F('f-' + f.k).value || '').trim(); }); return d; }

  // ── צעדים ──
  function goStep(n) {
    [1, 2, 3].forEach((i) => { F('s' + i).hidden = i !== n; });
    document.querySelectorAll('#steps li').forEach((li) => { const i = +li.dataset.step; li.classList.toggle('on', i === n); li.classList.toggle('done', i < n); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('#steps li').forEach((li) => li.addEventListener('click', () => { const n = +li.dataset.step; if (n > 1 && !S.kit) return; goStep(n); }));

  // ── המתנה ──
  function waiting(node, text, exp) {
    node.hidden = false; node.textContent = '';
    const line = el('div'), bar = el('div', 'bar'), fill = el('div'); bar.appendChild(fill); node.append(line, bar);
    const t0 = Date.now();
    const tick = () => { const s = Math.round((Date.now() - t0) / 1000); line.textContent = text + ' בדרך כלל ' + exp + ' שניות. עברו ' + s + ' שניות.'; fill.style.width = Math.min(95, s / exp * 90) + '%'; };
    tick(); const iv = setInterval(tick, 1000);
    return { set: (t) => { text = t; tick(); }, stop: () => { clearInterval(iv); node.hidden = true; } };
  }
  // תשובה חלקית או לא תקינה: ניסיון נוסף אחד (sbeCallAIJson ב-lib/ai-call.js), ואחר כך הודעה שונה מ"אין חיבור"
  const PARTIAL = 'התיק חזר חלקי. מה שמילאת נשמר, ואפשר לנסות שוב.';
  async function ask(system, content, check) {
    return window.sbeCallAIJson(SERVER, { system, messages: [{ role: 'user', content }], maxTokens: 7000, customerReview: true }, 300000, check);
  }
  const why = (e) => (e && e.code === 'incomplete') ? PARTIAL : NO_MODEL;
  const plansText = () => (S.local.plans || []).filter((p) => p.c0 || p.c1).map((p) => '- ' + [p.c0, p.c1, p.c2].filter(Boolean).join(' · ')).join('\n');
  async function makeEmerg() {
    const plans = plansText();
    return ask(C.emergSystem(KB, WRITER), 'השדות:\n' + C.inputText(S.form) + (plans ? '\n\nתכניות הלימודים החודש:\n' + plans : '') + '\n\nהכיני את תיקיית החירום והלמידה מרחוק.', C.validEmerg);
  }

  // ── טבלאות עריכה מקומיות (נשמרות במכשיר) ──
  // rows: מערך אובייקטים {c0, c1, ...}. sens: מידע רגיש (לא בעותק לשיתוף).
  function editTable(key, cols, opts) {
    opts = opts || {};
    const wrap = el('div', 'etable' + (opts.sens ? ' sens' : '') + (opts.red ? ' red' : ''));
    const t = el('table', 'kit-table'), th = el('thead'), hr = el('tr');
    cols.forEach((c) => hr.appendChild(el('th', null, c))); hr.appendChild(el('th', 'no-print', ''));
    th.appendChild(hr); t.appendChild(th);
    const tb = el('tbody'); t.appendChild(tb);
    const rows = () => S.local[key];
    function draw() {
      tb.textContent = '';
      rows().forEach((r, ri) => {
        const tr = el('tr');
        cols.forEach((c, ci) => {
          const td = el('td'); td.setAttribute('data-label', c);
          const inp = el(opts.area && opts.area.includes(ci) ? 'textarea' : 'input');
          if (inp.tagName === 'INPUT') inp.type = 'text';
          inp.value = r['c' + ci] || ''; inp.setAttribute('aria-label', c);
          inp.addEventListener('input', () => { r['c' + ci] = inp.value; save(); });
          td.appendChild(inp); tr.appendChild(td);
        });
        const x = el('td', 'no-print'); x.appendChild(btn('✕', 'xbtn', () => { rows().splice(ri, 1); save(); draw(); })); x.lastChild.setAttribute('aria-label', 'הסרת השורה');
        tr.appendChild(x); tb.appendChild(tr);
      });
      if (!rows().length) { const tr = el('tr', 'no-print'), td = el('td', 'muted', opts.empty || 'עוד אין שורות.'); td.colSpan = cols.length + 1; tr.appendChild(td); tb.appendChild(tr); }
    }
    draw();
    wrap.appendChild(t);
    wrap.appendChild(btn('➕ ' + (opts.add || 'הוספת שורה'), 'btn btn-ghost sm no-print', () => { rows().push({}); save(); draw(); const last = tb.lastChild && tb.lastChild.querySelector('input,textarea'); if (last) last.focus(); }));
    wrap.redraw = draw;
    return wrap;
  }

  // ── התיק ──
  function txt(x) { return window.SBE_REFS ? SBE_REFS.strip(String(x == null ? '' : x)) : String(x || ''); }
  function list(xs) { const u = el('ul'); (xs || []).filter(Boolean).forEach((x) => u.appendChild(el('li', null, txt(x)))); return u; }
  function head(root, key, extra) {
    const s = C.SECTIONS[key], h = el('h3', null, s.h); if (extra) h.appendChild(el('span', 'tag', extra)); root.appendChild(h);
    if (s.sub) root.appendChild(el('p', 'sub', s.sub));
  }
  const T = (key, rows) => window.SBE_TABLE(C.SECTIONS[key].cols, rows, 'kit-t');
  function sensBlock(key, node, red) {
    const box = el('section', 'sens' + (red ? ' redbox' : '')); head(box, key, '🔒 במכשיר בלבד'); box.appendChild(node); return box;
  }
  function renderRoutine() {
    const k = S.kit, root = el('div', 'kit');
    if (window.SBE_REFS) SBE_REFS.begin(SRC, 'resilience-advisor-sources.html');
    root.appendChild(el('h2', 'no-print', txt(k.title) || 'תיק רציפות'));
    const red = sensBlock('red', editTable('red', C.SECTIONS.red.cols, { sens: true, red: true, area: [1, 2], add: 'הוספת מידע חשוב', empty: 'מידע רפואי, רגשי או אחר שחשוב שהמחליפה תדע מיד.' }), true);
    const none = el('label', 'none no-print'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!S.local.redNone;
    cb.addEventListener('change', () => { S.local.redNone = cb.checked; save(); }); none.append(cb, document.createTextNode(' אין כרגע מידע חשוב לרשום כאן'));
    red.appendChild(none); root.appendChild(red);
    head(root, 'opening'); root.appendChild(window.SBE_TABLE(null, (k.opening || []).map((r) => [txt(r.h), txt(r.t)]), 'kit-t'));
    const model = el('div', 'model'); root.appendChild(model);
    head(model, 'routines'); model.appendChild(T('routines', (k.routines || []).map((r) => [txt(r.name), txt(r.when), txt(r.what), txt(r.helpers)])));
    if ((k.roles || []).length) { head(model, 'roles'); model.appendChild(T('roles', k.roles.map((r) => [txt(r.role), txt(r.who), txt(r.backup), txt(r.update)]))); }
    const d = k.decisions || {};
    if ((d.self || []).length || (d.consult || []).length || (d.wait || []).length) {
      head(model, 'decisions');
      model.appendChild(T('decisions', [[list(d.self), list((d.consult || []).map((c) => [c.what, c.whom && '(' + c.whom + ')'].filter(Boolean).join(' '))), list(d.wait)]]));
    }
    if ((k.procedures || []).length) {
      head(model, 'procedures');
      model.appendChild(T('procedures', k.procedures.map((p) => { let a = ''; if (/^https?:\/\//.test(p.link || '')) { a = el('a', null, 'פתיחה'); a.href = p.link; a.target = '_blank'; a.rel = 'noopener'; } return [txt(p.name), txt(p.what), a]; })));
    }
    head(root, 'plans'); root.appendChild(editTable('plans', C.SECTIONS.plans.cols, { area: [1], add: 'הוספת מקצוע או תחום', empty: 'מה לומדים החודש בכל מקצוע, ואיפה החומר. זה עוזר גם להכין משימות ללמידה מרחוק.' }));
    root.appendChild(sensBlock('individual', editTable('individual', C.SECTIONS.individual.cols, { sens: true, area: [1], add: 'הוספת מענה פרטני' })));
    const more = el('div', 'model'); root.appendChild(more);
    if ((k.moments || []).length) { head(more, 'moments'); more.appendChild(T('moments', k.moments.map((m) => [txt(m.if), window.SBE_DOC.rich(txt(m.then))]))); }
    if (k.classTalk) { head(more, 'classTalk'); more.appendChild(el('div', 'talk', txt(k.classTalk))); }
    head(more, 'trial'); more.appendChild(T('trial', (k.trial || []).map((t) => [txt(t.task), txt(t.check), el('span', 'fill', ' ')])));
    if (k.upkeep) { head(more, 'upkeep'); more.appendChild(T('upkeep', [[txt(k.upkeep.who), txt(k.upkeep.when) || S.form.update || '', txt(k.upkeep.how)]])); }
    if (k.resilience) { head(more, 'resilience'); more.appendChild(el('p', null, txt(k.resilience))); }
    if (window.SBE_REFS) { SBE_REFS.add(k.sources || []); const rs = SBE_REFS.end(); if (rs) root.appendChild(rs); }
    return root;
  }
  const STATUS = ['עוד לא בדקנו', 'קיים ✓', 'בדרך', 'עוד לא קיים'];
  function readinessItems() { return C.DEFAULT_READINESS.map((t) => ({ item: t, check: '' })).concat((S.emerg && S.emerg.readiness) || []); }
  function renderReadiness() {
    const t = el('table', 'kit-table'), th = el('thead'), hr = el('tr');
    C.SECTIONS.readiness.cols.forEach((c) => hr.appendChild(el('th', null, c))); th.appendChild(hr); t.appendChild(th);
    const tb = el('tbody');
    readinessItems().forEach((it) => {
      const key = it.item, st = S.local.readiness[key] = S.local.readiness[key] || {};
      const tr = el('tr', 'st-' + STATUS.indexOf(st.s || STATUS[0]));
      const a = el('td'); a.setAttribute('data-label', 'מה בודקים'); a.appendChild(el('div', null, txt(it.item))); if (it.check) a.appendChild(el('div', 'sub', 'איך בודקים: ' + txt(it.check)));
      const b = el('td'); b.setAttribute('data-label', 'המצב'); const sel = el('select'); STATUS.forEach((s) => sel.appendChild(new Option(s, s))); sel.value = st.s || STATUS[0];
      sel.setAttribute('data-closed', ''); sel.setAttribute('aria-label', 'המצב');
      sel.addEventListener('change', () => { st.s = sel.value; tr.className = 'st-' + STATUS.indexOf(sel.value); save(); }); b.appendChild(sel);
      const c = el('td'); c.setAttribute('data-label', 'מי אחראי/ת'); const o = el('input'); o.type = 'text'; o.value = st.o || ''; o.setAttribute('aria-label', 'מי אחראי/ת'); o.addEventListener('input', () => { st.o = o.value; save(); }); c.appendChild(o);
      const d = el('td'); d.setAttribute('data-label', 'הערה'); const n = el('input'); n.type = 'text'; n.value = st.n || ''; n.setAttribute('aria-label', 'הערה'); n.addEventListener('input', () => { st.n = n.value; save(); }); d.appendChild(n);
      tr.append(a, b, c, d); tb.appendChild(tr);
    });
    t.appendChild(tb); return t;
  }
  function weekRep(members) { if (!members.length) return ''; const w = Math.floor(Date.now() / (7 * 864e5)); return members[w % members.length]; }
  function renderTeams() {
    const box = el('div', 'sens');
    const tools = el('div', 'btns no-print');
    const names = () => (S.local.students || []).map((s) => s.c0 || s.name).filter(Boolean);
    tools.appendChild(btn('חלוקה לצוותים מתוך רשימת התלמידים', 'btn btn-ghost sm', () => {
      const n = names(); if (!n.length) { alert('כדי לחלק לצוותים, אפשר קודם להוסיף את רשימת התלמידים בלשונית "התלמידים".'); return; }
      if ((S.local.teams || []).length && !confirm('להחליף את הצוותים הקיימים בחלוקה חדשה?')) return;
      S.local.teams = C.splitTeams(n, 4).map((m, i) => ({ c0: 'צוות ' + (i + 1), c1: m.join(', '), c3: '' })); save(); draw();
    }));
    box.appendChild(tools);
    const t = editTable('teams', C.SECTIONS.teams.cols, { sens: true, area: [1], add: 'הוספת צוות', empty: 'אפשר לחלק אוטומטית מתוך רשימת התלמידים, או להוסיף צוותים ידנית.' });
    box.appendChild(t);
    // נציג/ה מתחלף/ת: מחושב לפי השבוע, אם לא נכתב אחרת
    function draw() { (S.local.teams || []).forEach((r) => { if (!r.c2) r.c2Auto = weekRep(String(r.c1 || '').split(/[,،]\s*/).filter(Boolean)); }); t.redraw();
      t.querySelectorAll('tbody tr').forEach((tr, i) => { const r = S.local.teams[i]; const inp = tr.children[2] && tr.children[2].querySelector('input'); if (inp && r && !r.c2 && r.c2Auto) inp.placeholder = r.c2Auto + ' (מתחלף כל שבוע)'; }); }
    draw();
    return box;
  }
  function renderLetter() {
    const box = el('div', 'letter');
    const v = S.local.letter, grid = el('div', 'grid2 no-print');
    const out = el('div', 'talk letter-out');
    const update = () => { out.textContent = C.fillLetter(txt(S.emerg.parentLetter), v); };
    C.LETTER_FIELDS.forEach((f) => {
      const b = el('div', 'f'), l = el('label', null, f.l), i = el('input'); i.type = 'text'; i.id = 'lt-' + f.k; l.htmlFor = i.id; i.value = v[f.k] || ''; if (f.ph) i.placeholder = f.ph;
      i.addEventListener('input', () => { v[f.k] = i.value; save(); update(); }); b.append(l, i); grid.appendChild(b);
    });
    box.appendChild(grid); box.appendChild(out); update();
    const row = el('div', 'btns no-print');
    row.appendChild(btn('העתקת המכתב', 'btn btn-ghost sm', (e) => { navigator.clipboard && navigator.clipboard.writeText(out.textContent).then(() => { e.target.textContent = 'הועתק ✓'; setTimeout(() => { e.target.textContent = 'העתקת המכתב'; }, 1600); }); }));
    row.appendChild(btn('🖨 הדפסת המכתב', 'btn btn-ghost sm', () => window.SBE_DOC.print({ title: 'מכתב להורים', subtitle: S.form.group || '', kind: 'מכתב להורים', node: out })));
    box.appendChild(row);
    return box;
  }
  function renderEmerg() {
    const root = el('div', 'kit');
    if (!S.emerg) {
      root.appendChild(el('p', null, 'תיקיית החירום עוד לא הוכנה.'));
      const w = el('div', 'wait'); w.hidden = true; const er = el('p', 'err'); er.hidden = true;
      root.appendChild(btn('הכנת תיקיית החירום', 'btn', async (e) => {
        e.target.disabled = true; const wt = waiting(w, 'מכינה את תיקיית החירום.', 80); let x = null, bad = null;
        try { x = await makeEmerg(); } catch (err) { bad = err; console.warn(err.message); } finally { wt.stop(); e.target.disabled = false; }
        if (!C.validEmerg(x)) { er.textContent = why(bad); er.hidden = false; return; }
        S.emerg = x; save(); showKit();
      }));
      root.append(w, er); return root;
    }
    const k = S.emerg;
    if (window.SBE_REFS) SBE_REFS.begin(SRC, 'resilience-advisor-sources.html');
    head(root, 'readiness'); root.appendChild(renderReadiness());
    head(root, 'teams', '🔒 במכשיר בלבד'); root.appendChild(renderTeams());
    head(root, 'teamCard'); const card = el('ol', 'teamcard'); C.TEAM_QUESTIONS.forEach((q) => card.appendChild(el('li', null, q))); root.appendChild(card);
    const model = el('div', 'model'); root.appendChild(model);
    head(model, 'remote'); model.appendChild(T('remote', (k.remote || []).map((r) => [txt(r.subject), txt(r.task), txt(r.where)])));
    head(model, 'chain'); model.appendChild(T('chain', (k.chain || []).map((r) => [txt(r.who), txt(r.whom), txt(r.when), txt(r.how)])));
    if (k.emergTalk) { head(model, 'emergTalk'); model.appendChild(el('div', 'talk', txt(k.emergTalk))); }
    if ((k.drill || []).length) { head(model, 'drill'); model.appendChild(T('drill', k.drill.map((r) => [txt(r.step), txt(r.check)]))); }
    head(root, 'letter'); root.appendChild(renderLetter());
    if (k.resilience) { head(root, 'resilience'); root.appendChild(el('p', null, txt(k.resilience))); }
    if (window.SBE_REFS) { SBE_REFS.add(k.sources || []); const rs = SBE_REFS.end(); if (rs) root.appendChild(rs); }
    return root;
  }

  // ── התלמידים: קישור, העלאה או הדבקה. נקרא בדפדפן בלבד ──
  function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('הקובץ לא נטען')); document.head.appendChild(s); }); }
  async function rowsFromFile(file) {
    const name = file.name.toLowerCase();
    if (/\.(xlsx|xls)$/.test(name)) {
      if (!window.XLSX) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
      return C.rosterFromRows(window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false }));
    }
    if (/\.docx$/.test(name)) {
      if (!window.mammoth) await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
      const html = (await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })).value;
      const doc = new DOMParser().parseFromString(html, 'text/html'), table = doc.querySelector('table');
      if (table) return C.rosterFromRows([...table.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => c.textContent)));
      return C.parseRoster(doc.body.textContent);
    }
    return C.parseRoster(await file.text());
  }
  function renderStudents() {
    const root = el('div', 'kit');
    const sec = el('section', 'sens'); head(sec, 'students', '🔒 במכשיר בלבד');
    const lk = el('div', 'f no-print'), ll = el('label', null, 'קישור לרשימת התלמידים במערכת בית הספר (אם יש)'), li = el('input');
    li.type = 'url'; li.id = 'st-link'; ll.htmlFor = 'st-link'; li.placeholder = 'https://…'; li.value = S.local.studentsLink || '';
    li.addEventListener('input', () => { S.local.studentsLink = li.value.trim(); save(); }); lk.append(ll, li); sec.appendChild(lk);
    if (/^https?:\/\//.test(S.local.studentsLink || '')) { const a = el('a', 'linkline', 'פתיחת הרשימה במערכת בית הספר ←'); a.href = S.local.studentsLink; a.target = '_blank'; a.rel = 'noopener'; sec.appendChild(a); }
    const up = el('details', 'more no-print'); up.appendChild(el('summary', null, '📥 העלאת רשימה או הדבקה מגיליון'));
    up.appendChild(el('p', 'muted', 'קובץ Excel, CSV או Word עם טבלה, או הדבקה ישירה מגיליון: שם, הורה, טלפון, דוא״ל. הקובץ נשאר במכשיר.'));
    const file = el('input'); file.type = 'file'; file.accept = '.xlsx,.xls,.csv,.txt,.docx';
    const paste = el('textarea'); paste.placeholder = 'אפשר להדביק כאן שורות מגיליון: שם, הורה, טלפון…'; paste.setAttribute('aria-label', 'הדבקת רשימה');
    const msg = el('p', 'muted');
    const apply = (rows) => {
      if (!rows.length) { msg.textContent = 'לא זוהו שורות. אפשר לבדוק שבעמודה הראשונה יש שמות, ולנסות שוב.'; return; }
      if ((S.local.students || []).length && !confirm('להחליף את הרשימה הקיימת (' + S.local.students.length + ' תלמידים) ברשימה החדשה (' + rows.length + ')?')) return;
      S.local.students = rows.map((r) => ({ c0: r.name, c1: r.parent, c2: r.phone, c3: r.parent2, c4: r.phone2, c5: r.email }));
      save(); showKit(); F('kit').querySelector('[data-tab="students"]').click();
    };
    file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; msg.textContent = 'קוראת את הקובץ…'; try { apply(await rowsFromFile(f)); } catch (e) { msg.textContent = 'לא הצלחנו לקרוא את הקובץ (' + e.message + '). אפשר לפתוח אותו, להעתיק את הטבלה ולהדביק כאן.'; } });
    up.append(file, paste, btn('קריאת הרשימה שהודבקה', 'btn btn-ghost sm', () => apply(C.parseRoster(paste.value))), msg);
    sec.appendChild(up);
    const n = (S.local.students || []).length; if (n) sec.appendChild(el('p', 'muted', n + ' תלמידים ברשימה.'));
    sec.appendChild(editTable('students', C.SECTIONS.students.cols, { sens: true, add: 'הוספת תלמיד/ה' }));
    root.appendChild(sec);
    return root;
  }
  // ── הצטרפות וחזרה לקבוצה (10/10/2026): תלמיד/ה חדש/ה, חזרה אחרי היעדרות מכל סיבה, או כל הכיתה חוזרת ──
  function renderJoin() {
    const J = S.join, root = el('div', 'kit join');
    root.appendChild(el('p', 'sub', 'מסלול קצר למי שמצטרף או חוזר: מידע שימושי, דרך כניסה לבחירה, משימה ראשונה ותפקידי עמיתים מתחלפים. אחרי כמה מפגשים בודקים מה להתאים.'));
    const form = el('div', 'grid2');
    C.JOIN_FIELDS.forEach((f) => {
      const box = el('div', 'f'), l = el('label', null, f.l); if (f.main) l.appendChild(el('span', 'main-tag', 'שדה עיקרי')); box.appendChild(l);
      let i; if (f.type === 'select') { i = el('select'); i.appendChild(new Option('בחירה…', '')); f.opts.forEach((o) => i.appendChild(new Option(o, o))); } else { i = el('textarea'); i.rows = 2; }
      if (f.ph) i.placeholder = f.ph; i.value = J.form[f.k] || ''; i.setAttribute('aria-label', f.l);
      const keep = () => { J.form[f.k] = i.value; save(); }; i.addEventListener('input', keep); i.addEventListener('change', keep);
      box.appendChild(i); (f.type === 'area' ? root : form).appendChild(box); if (f.k === 'away') root.appendChild(form);
    });
    const err = el('p', 'err'); err.hidden = true; const wait = el('div', 'wait'); wait.hidden = true;
    const go = btn(J.kit ? 'הכנה מחדש' : 'הכנת ערכת ההצטרפות', J.kit ? 'btn btn-ghost sm' : 'btn', async () => {
      err.hidden = true; if (!J.form.who) return fail(err, 'כדי להמשיך, בחרי מי מצטרף או חוזר.');
      go.disabled = true; const w = waiting(wait, 'מכינה ערכת הצטרפות וחזרה.', 60);
      let k = null, bad = null;
      try { k = await ask(C.joinSystem(KB, WRITER), 'מהתיק:\n' + C.inputText(S.form) + '\n\nההצטרפות:\n' + C.JOIN_FIELDS.map((f) => J.form[f.k] ? f.l + ': ' + J.form[f.k] : '').filter(Boolean).join('\n') +
        (J.info.length ? '\n\nתיק הכניסה הקבוצתי הקיים (לשמור ולעדכן):\n' + J.info.map((x) => x.c0 + ': ' + x.c1).join('\n') : '') + '\n\nהכיני את הערכה.', C.validJoin); }
      catch (e) { bad = e; console.warn('תיק רציפות, הצטרפות:', e.message); } finally { w.stop(); go.disabled = false; }
      if (!C.validJoin(k)) return fail(err, why(bad));
      J.kit = k; if (!J.info.length) J.info = (k.info || []).map((x) => ({ c0: txt(x.topic), c1: txt(x.what) }));
      J.choice = ''; J.done = {}; if (!J.checkWhen && window.sbeIsoPlus) J.checkWhen = sbeIsoPlus(14); save(); showKit();
    });
    root.append(go, wait, err);
    const k = J.kit; if (!k) return root;
    if (window.SBE_REFS) SBE_REFS.begin(SRC, 'resilience-advisor-sources.html');
    // תיק כניסה קבוצתי: נשמר ומתעדכן לפעם הבאה
    root.appendChild(el('h3', null, 'תיק כניסה קבוצתי')); root.appendChild(el('p', 'sub', 'מידע שימושי שהקבוצה מתחזקת ומעדכנת. נשאר לפעם הבאה שמישהו מצטרף.'));
    root.appendChild(etable(['הנושא', 'מה חשוב לדעת'], J.info, 'הוספת פריט'));
    root.appendChild(el('h3', null, 'דרכי הצטרפות לבחירה')); root.appendChild(el('p', 'sub', 'המצטרף/ת בוחר/ת. כל דרך לגיטימית'));
    root.appendChild(window.SBE_TABLE(['הדרך', 'איך זה נראה'], (k.ways || []).map((x) => [txt(x.name), txt(x.how)]), 'kit-t'));
    const ch = el('div', 'f no-print'); ch.appendChild(el('label', null, 'מה בחר/ה המצטרף/ת')); const cs = el('select'); cs.setAttribute('data-closed', ''); cs.appendChild(new Option('עוד לא בחר/ה', ''));
    (k.ways || []).forEach((x) => cs.appendChild(new Option(txt(x.name), txt(x.name)))); cs.value = J.choice || ''; cs.addEventListener('change', () => { J.choice = cs.value; save(); }); ch.appendChild(cs); root.appendChild(ch);
    root.appendChild(el('h3', null, 'המשימה הראשונה'));
    root.appendChild(window.SBE_TABLE(null, [['מה עושים', txt(k.first.task)], ['עם מי', txt(k.first.with)], ['מתי', txt(k.first.when)]].filter((r) => r[1]), 'kit-t'));
    if ((k.roles || []).length) { root.appendChild(el('h3', null, 'תפקידי עמיתים מתחלפים')); root.appendChild(window.SBE_TABLE(['התפקיד', 'מה עושים', 'מתי מתחלפים'], k.roles.map((x) => [txt(x.role), txt(x.does), txt(x.rotate)]), 'kit-t')); }
    if (k.group) { root.appendChild(el('h3', null, 'מה אומרים לקבוצה')); root.appendChild(window.SBE_TABLE(null, [['מה אומרים (רק מה שהותר לשתף)', txt(k.group.say)], ['איך מקבלים את המצטרף/ת', txt(k.group.welcome)]].filter((r) => r[1]), 'kit-t')); }
    root.appendChild(el('h3', null, 'לוח לשבועיים'));
    root.appendChild(window.SBE_TABLE(['מתי', 'מה קורה', 'מי אחראי/ת', 'קרה'], (k.board || []).map((x, i) => { const c = el('input'); c.type = 'checkbox'; c.checked = !!J.done[i]; c.setAttribute('aria-label', 'קרה: ' + txt(x.what)); c.addEventListener('change', () => { J.done[i] = c.checked; save(); }); return [txt(x.day), txt(x.what), txt(x.who), c]; }), 'kit-t'));
    if (k.check) {
      root.appendChild(el('h3', null, 'בדיקה אחרי כמה מפגשים'));
      const d = el('div', 'f no-print'); d.appendChild(el('label', null, 'מתי בודקים')); const di = el('input'); di.type = 'date'; di.value = J.checkWhen || ''; di.addEventListener('change', () => { J.checkWhen = di.value; save(); }); d.appendChild(di); root.appendChild(d);
      root.appendChild(window.SBE_TABLE(null, [['מתי', txt(k.check.after)], ['מה בודקים', list(k.check.look)]], 'kit-t'));
    }
    const lg = el('section', 'sens'); lg.appendChild(el('h3', null, 'רשומת התאמות')); lg.appendChild(el('p', 'sub', 'מה התאמנו ולמה. המחנכת מאשרת כל התאמה'));
    lg.appendChild(etable(['תאריך', 'מה התאמנו', 'למה', 'אישור המחנכת'], J.log, 'הוספת התאמה', 4)); root.appendChild(lg);
    if (k.adult) root.appendChild(el('p', 'remind', '👩‍🏫 ' + txt(k.adult)));
    if ((k.resilience || []).length) { root.appendChild(el('h3', null, 'מה זה בונה בחוסן')); root.appendChild(window.SBE_TABLE(['רכיב החוסן', 'איך זה קורה'], k.resilience.map((x) => [txt(x.component), txt(x.how)]), 'kit-t')); }
    const row = el('div', 'actions no-print');
    row.append(btn('🖨 כרטיסי בחירה ותפקיד', 'btn btn-ghost sm', () => printJoinCards()),
      btn('מצטרף/ת חדש/ה: מתחילים מחדש (תיק הכניסה נשמר)', 'btn btn-ghost sm', () => { if (!confirm('להתחיל מסלול חדש? הבחירה, הלוח ורשומת ההתאמות יתאפסו, ותיק הכניסה הקבוצתי יישאר.')) return; J.choice = ''; J.done = {}; J.log = []; J.checkWhen = window.sbeIsoPlus ? sbeIsoPlus(14) : ''; save(); showKit(); }));
    root.appendChild(row);
    if (window.SBE_REFS) { SBE_REFS.add(k.sources || []); const rs = SBE_REFS.end(); if (rs) root.appendChild(rs); }
    return root;
  }
  // טבלה לעריכה עם שורות שנשמרות (c0..cN)
  function etable(cols, rows, addLabel, n) {
    const wrap = el('div'); n = n || cols.length;
    const draw = () => {
      wrap.textContent = '';
      wrap.appendChild(window.SBE_TABLE(cols, rows.map((r, ri) => cols.map((c, ci) => {
        const d = el('div'); const t = el('textarea'); t.rows = 2; t.value = r['c' + ci] || ''; t.setAttribute('aria-label', c); t.addEventListener('input', () => { r['c' + ci] = t.value; save(); }); d.appendChild(t);
        if (ci === n - 1) { const x = btn('✕', 'xbtn no-print', () => { rows.splice(ri, 1); save(); draw(); }); x.setAttribute('aria-label', 'הסרת השורה'); d.appendChild(x); }
        return d;
      })), 'kit-t etable'));
      wrap.appendChild(btn('➕ ' + addLabel, 'btn btn-ghost sm no-print', () => { rows.push({}); save(); draw(); }));
    };
    draw(); return wrap;
  }
  function printJoinCards() {
    const k = S.join.kit, out = el('div');
    const card = el('div', 'rcard'); card.appendChild(el('h3', null, 'איך תרצה/י להצטרף?'));
    (k.ways || []).forEach((x) => { const r = el('div', 'rcard-row'); r.appendChild(el('b', null, '☐ ' + txt(x.name))); r.appendChild(el('span', null, txt(x.how))); card.appendChild(r); });
    const f = el('div', 'rcard-row'); f.appendChild(el('b', null, 'המשימה הראשונה')); f.appendChild(el('span', null, txt(k.first.task))); card.appendChild(f); out.appendChild(card);
    (k.roles || []).forEach((x) => { const c = el('div', 'rcard'); c.appendChild(el('h3', null, txt(x.role))); [['מה עושים', x.does], ['מתי מתחלפים', x.rotate]].forEach(([l, v]) => { if (!v) return; const r = el('div', 'rcard-row'); r.appendChild(el('b', null, l)); r.appendChild(el('span', null, txt(v))); c.appendChild(r); }); out.appendChild(c); });
    window.SBE_DOC.print({ title: txt(k.title) || 'הצטרפות וחזרה', subtitle: S.form.group || '', kind: 'כרטיסי בחירה ותפקיד', node: out });
  }
  function renderUpdates() {
    const root = el('div', 'kit');
    root.appendChild(el('p', null, 'כאן המחליפה כותבת בסוף כל יום מה היה ומה ממשיך. כך המורה הקבועה, ומי שתבוא אחריה, יודעות בדיוק איפה הכיתה עומדת.'));
    const sec = el('section', 'sens'); head(sec, 'updates', '🔒 במכשיר בלבד');
    const form = el('div', 'grid2 no-print'), vals = {};
    [['d', 'תאריך', today()], ['a', 'מה היה היום'], ['b', 'מה חשוב לדעת'], ['c', 'מה ממשיך מחר']].forEach(([k, l, v]) => {
      const b = el('div', 'f'), lb = el('label', null, l), i = el(k === 'd' ? 'input' : 'textarea'); if (k === 'd') i.type = 'text'; i.id = 'up-' + k; lb.htmlFor = i.id; i.value = v || ''; vals[k] = i; b.append(lb, i); form.appendChild(b);
    });
    sec.appendChild(form);
    sec.appendChild(btn('➕ הוספת העדכון', 'btn sm no-print', () => {
      if (!vals.a.value.trim() && !vals.b.value.trim()) return;
      S.local.updates.unshift({ c0: vals.d.value.trim(), c1: vals.a.value.trim(), c2: vals.b.value.trim(), c3: vals.c.value.trim() }); save(); showKit(); F('kit').querySelector('[data-tab="updates"]').click();
    }));
    sec.appendChild(editTable('updates', C.SECTIONS.updates.cols, { sens: true, area: [1, 2, 3], add: 'הוספת שורה ריקה', empty: 'עוד אין עדכונים.' }));
    root.appendChild(sec); return root;
  }

  // ── מוכנות התיק ומעבר בין הלשוניות ──
  function status() {
    const L = S.local, filled = (a) => (a || []).some((r) => Object.keys(r).some((k) => /^c\d$/.test(k) && String(r[k] || '').trim()));
    const rd = readinessItems(), ok = rd.filter((it) => (L.readiness[it.item] || {}).s === 'קיים ✓').length;
    return [
      ['תיקיית השגרה', !!S.kit], ['תיקיית החירום', !!S.emerg], ['נהלי בית הספר', !!(S.kit && (S.kit.procedures || []).length)],
      ['רשימת התלמידים', filled(L.students) || /^https?:/.test(L.studentsLink || '')], ['מידע חשוב (מסגרת אדומה)', filled(L.red) || L.redNone],
      ['תכניות החודש', filled(L.plans)], ['צוותי העבודה', filled(L.teams)], ['מוכנות לחירום', rd.length && ok === rd.length, ok + ' מתוך ' + rd.length],
      ['המכתב להורים', !!(L.letter && L.letter.sub)]
    ];
  }
  function drawStatus() {
    const box = F('status'); if (!box || !S.kit) return;
    const st = status(), done = st.filter((x) => x[1]).length;
    box.textContent = '';
    const top = el('div', 'st-top');
    top.appendChild(el('b', null, 'מוכנות התיק: ' + done + ' מתוך ' + st.length));
    const bar = el('div', 'bar'), fill = el('div'); fill.style.width = Math.round(done / st.length * 100) + '%'; bar.appendChild(fill); top.appendChild(bar);
    top.appendChild(el('span', 'muted', 'גרסה ' + S.version + ' · עודכן ' + (S.at || today())));
    box.appendChild(top);
    const ul = el('ul', 'st-list'); st.forEach(([n, ok, note]) => { const li = el('li', ok ? 'ok' : 'miss', (ok ? '✓ ' : '○ ') + n + (note ? ' (' + note + ')' : '')); ul.appendChild(li); }); box.appendChild(ul);
  }
  // נוהל עבודה בכלים שלכם: איפה כל חלק בתיק נמצא בכלים שכבר יש לבית הספר (SBE_PROC)
  const PROC_ITEMS = ['כרטיס פתיחה ושגרות', 'תפקידים וגיבוי', 'נהלי בית הספר', 'תכניות הלימודים והעבודה', 'מידע חשוב רפואי ונפשי (רגיש)',
    'רשימת התלמידים ופרטי ההורים (רגיש)', 'מענה פרטני (רגיש)', 'צוותי עבודה', 'שרשרת הקשר', 'מכתב להורים', 'עדכוני המחליפה (רגיש)',
    'תיק כניסה קבוצתי', 'רשומת התאמות (רגיש)'];
  function renderProc() {
    const box = el('div', 'proc-box');
    box.appendChild(el('h3', null, '🗂 נוהל עבודה בכלים שלכם'));
    const inner = el('div'); box.appendChild(inner);
    if (!window.SBE_PROC) return box;
    if (!S.proc) S.proc = {};
    window.SBE_PROC.mount(inner, { state: S.proc, save, kind: 'continuity', items: () => PROC_ITEMS,
      context: () => ['תפקיד: ' + (S.form.role || ''), 'שכבת גיל: ' + (S.form.age || ''), 'איפה לומדים מרחוק: ' + (S.form.platform || ''), 'איפה הדברים היום: ' + (S.form.where || '')].join('\n') });
    return box;
  }
  const TABS = [['routine', '🏫 שגרה'], ['emerg', '🚨 חירום ולמידה מרחוק'], ['join', '🤝 הצטרפות וחזרה'], ['students', '👥 התלמידים'], ['updates', '📝 עדכוני המחליפה'], ['proc', '🗂 נוהל עבודה']];
  function showKit() {
    const box = F('kit'); box.textContent = '';
    const bar = el('div', 'tabs no-print'); bar.setAttribute('role', 'tablist');
    const panes = {};
    TABS.forEach(([id, label]) => {
      const b = btn(label, 'tab', () => { S.tab = id; save(); Object.keys(panes).forEach((p) => { panes[p].hidden = p !== id; }); bar.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === id))); });
      b.dataset.tab = id; b.setAttribute('role', 'tab'); bar.appendChild(b);
    });
    box.appendChild(bar);
    const make = { routine: () => window.SBE_DOC.editable(renderRoutine()), emerg: renderEmerg, join: renderJoin, students: renderStudents, updates: renderUpdates, proc: renderProc };
    TABS.forEach(([id, label]) => { const p = el('div', 'pane'); p.dataset.pane = id; p.dataset.title = label.replace(/^\S+\s/, ''); p.appendChild(make[id]()); panes[id] = p; box.appendChild(p); });
    const cur = TABS.some((t) => t[0] === S.tab) ? S.tab : 'routine';
    bar.querySelector('[data-tab="' + cur + '"]').click();
    drawStatus();
  }

  // ── הפקה ──
  function fail(n, m) { n.textContent = m; n.hidden = false; }
  F('go').addEventListener('click', async () => {
    const d = readForm(); S.form = d; save();
    const missing = C.FIELDS.filter((f) => f.main && !d[f.k]).map((f) => f.l);
    F('err1').hidden = true;
    if (missing.length) return fail(F('err1'), 'כדי להמשיך, נשמח למלא: ' + missing.join(', ') + '.');
    const b = F('go'); b.disabled = true;
    const w = waiting(F('wait1'), 'מכינה את תיקיית השגרה (1 מתוך 2).', 90);
    let k = null, e2 = null, bad = null;
    try {
      k = await ask(C.system(KB, WRITER), 'השדות:\n' + C.inputText(d) + '\n\nהכיני את תיקיית השגרה.', C.valid);
      S.kit = k; w.set('מכינה את תיקיית החירום והלמידה מרחוק (2 מתוך 2).');
      try { e2 = await makeEmerg(); } catch (e) { console.warn('תיק רציפות, חירום:', e.message); }
    } catch (e) { bad = e; console.warn('תיק רציפות:', e.message); }
    finally { w.stop(); b.disabled = false; }
    if (!C.valid(k)) return fail(F('err1'), why(bad));
    S.emerg = C.validEmerg(e2) ? e2 : null;
    S.version = (S.version || 0) + 1; S.at = today(); S.history = []; save();
    showKit(); goStep(2);
  });

  // ── הדפסה: התיק המלא, או עותק לשיתוף בלי מידע רגיש ──
  function printable(withSens) {
    const out = el('div');
    if (withSens) out.appendChild(el('p', 'sens-note', '🔒 מידע רגיש: לשמור בתיק סגור, ולא להעביר הלאה.'));
    document.querySelectorAll('#kit .pane').forEach((p) => {
      const c = p.cloneNode(true); c.hidden = false;
      c.querySelectorAll('input,textarea').forEach((i) => { const s = el('span', 'val', i.value || ''); i.replaceWith(s); });
      c.querySelectorAll('select').forEach((i) => { const o = i.options[i.selectedIndex]; i.replaceWith(el('span', 'val', o ? o.text : '')); });
      if (!withSens) c.querySelectorAll('.sens').forEach((x) => x.remove());
      c.querySelectorAll('.etable tbody tr').forEach((tr) => { if (![...tr.querySelectorAll('.val')].some((v) => v.textContent.trim())) tr.remove(); });
      c.querySelectorAll('.etable').forEach((t) => { if (!t.querySelector('tbody tr')) { const s = t.closest('section'); (s || t).remove(); } });
      if (!c.textContent.trim()) return;
      const h = el('h2', null, p.dataset.title); out.append(h, c);
    });
    return out;
  }
  function doPrint(withSens) {
    const title = (txt(S.kit.title) || '').replace(/^תיק רציפות:?\s*/, '') || S.form.group || 'תיק רציפות';
    window.SBE_DOC.print({ title, subtitle: [S.form.role, S.form.receiver].filter(Boolean).join(' · ') + ' · גרסה ' + S.version + (withSens ? '' : ' · עותק לשיתוף'), kind: withSens ? 'תיק הפעלה' : 'תיק הפעלה לשיתוף', node: printable(withSens) });
  }
  F('print').addEventListener('click', () => doPrint(true));
  F('printShare').addEventListener('click', () => doPrint(false));

  // ── קובץ התיק (למסירה למחליפה) ותזכורת ביומן ──
  F('saveFile').addEventListener('click', () => {
    if (!confirm('הקובץ כולל את כל התיק, גם מידע רגיש (רשימת התלמידים, פרטי ההורים, מידע חשוב). מעבירים אותו רק בדרך מאובטחת, למי שתחליף אותך. להמשיך?')) return;
    const blob = new Blob([JSON.stringify({ type: 'begood-continuity', v: 2, savedAt: new Date().toISOString(), S })], { type: 'application/json' });
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'תיק-רציפות-' + (S.form.group || 'כיתה').replace(/[^\w֐-׿-]+/g, '-') + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  });
  F('openFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!o || o.type !== 'begood-continuity' || !o.S || typeof o.S !== 'object' || !o.S.form) throw new Error('זה לא קובץ של תיק רציפות');
      if (S.kit && !confirm('לפתוח את התיק מהקובץ במקום התיק שעל המסך?')) return;
      S = Object.assign(EMPTY(), o.S); S.local = Object.assign(EMPTY().local, o.S.local || {}); save();
      location.reload();
    } catch (err) { alert('לא הצלחנו לפתוח את הקובץ: ' + err.message); }
    finally { e.target.value = ''; }
  });
  F('remind').addEventListener('click', () => {
    const v = F('reviewDate').value; if (!v) { F('reviewDate').focus(); return; }
    S.review = v; save();
    const d = v.replace(/-/g, ''), ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Begood//Continuity//HE', 'BEGIN:VEVENT', 'UID:' + Date.now() + '@be-good.co.il',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), 'DTSTART;VALUE=DATE:' + d, 'SUMMARY:עדכון תיק הרציפות' + (S.form.group ? ' · ' + S.form.group : ''),
      'DESCRIPTION:בודקים שהשגרות, הצוותים, רשימת הקשר והמידע החשוב מעודכנים.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = el('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'עדכון-תיק-רציפות.ics';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  });
  F('reviewDate').value = S.review || (window.sbeIsoPlus ? sbeIsoPlus(30) : '');
  F('reviewDate').addEventListener('change', () => { S.review = F('reviewDate').value; save(); });

  // ── צעד 3: עמיתה מנסה ──
  F('toTrial').addEventListener('click', () => goStep(3));
  F('back1').addEventListener('click', () => goStep(1));
  F('back2').addEventListener('click', () => goStep(2));
  F('revise').addEventListener('click', async () => {
    const note = F('trialNote').value.trim(); F('err3').hidden = true;
    if (!note) return fail(F('err3'), 'כדי לתקן, נשמח לשמוע מה עלה בניסיון: מה היה חסר, מה לא היה ברור ומה עבד.');
    const b = F('revise'); b.disabled = true;
    const w = waiting(F('wait3'), 'מתקנת את התיק לפי הניסיון.', 90);
    let k = null, bad = null;
    try {
      k = await ask(C.reviseSystem(KB, WRITER), 'השדות:\n' + C.inputText(S.form) + '\n\nתיקיית השגרה הנוכחית (JSON):\n' + JSON.stringify(S.kit) +
        '\n\nמה עלה בניסיון של העמיתה' + (F('trialWho').value.trim() ? ' (' + F('trialWho').value.trim() + ')' : '') + ':\n' + note + '\n\nתקני את התיק.', C.valid);
    } catch (e) { bad = e; console.warn('תיק רציפות, תיקון:', e.message); }
    finally { w.stop(); b.disabled = false; }
    if (!C.valid(k)) return fail(F('err3'), why(bad));
    const changes = Array.isArray(k.changes) ? k.changes : []; delete k.changes;
    S.history.push({ version: S.version, at: S.at, note }); S.kit = k; S.version += 1; S.at = today(); save();
    const box = F('changes'); box.textContent = '';
    box.appendChild(el('h3', null, 'מה השתנה בגרסה ' + S.version));
    if (changes.length) box.appendChild(window.SBE_TABLE(['איפה בתיק', 'מה השתנה ולמה'], changes.map((c) => [txt(c.where), txt(c.why)]), 'kit-t'));
    box.appendChild(el('p', 'muted', 'התיק המעודכן מחכה בצעד 2. אפשר לחזור לשם, לקרוא ולהדפיס.'));
    F('trialNote').value = ''; showKit();
  });

  F('example').addEventListener('click', () => {
    const ex = { role: 'מחנכת כיתה', receiver: 'ממלאת מקום לכמה שבועות', age: 'ה–ו', group: 'ו׳2, 31 תלמידים, כיתה פעילה שאוהבת עבודה בקבוצות',
      routines: 'פתיחת בוקר 8:00: מעגל "מה שלומך" בסבב מילה אחת, ואז לוח היום. מעבר להפסקה: תורני השבוע מכבים אור וסוגרים חלונות. אחרי הפסקה: שתי דקות שקט עם מוזיקה. סיום יום: כל אחד כותב משפט אחד ביומן הכיתה.',
      roles: 'תורנים שבועיים (שניים, מתחלפים כל ראשון). אחראית לוח היום. ועדת הפסקה פעילה (ארבעה תלמידים).',
      decisions: 'משנה את סדר השיעורים ביום בעצמה. יציאה לחצר בשיעור רק אחרי בדיקה עם רכזת השכבה. שינוי מקומות ישיבה מחכה לי.',
      support: 'הכיתה נרגעת עם מוזיקה ושגרה צפויה. כמה תלמידים נעזרים בהסבר כתוב לצד ההסבר בעל פה.',
      procedures: 'נוכחות במערכת הנוכחות עד 8:30. יציאה מהכיתה עם כרטיס יציאה. תורנות חצר בהפסקה הגדולה ביום שלישי. אירוע חריג: מדווחים לרכזת השכבה באותו יום.',
      contacts: 'רכזת השכבה, המזכירות, המחנכת של ו׳1 מהכיתה הסמוכה.', where: 'רשימות ותוכנית השבוע בתיק הכחול במגירה העליונה. לוח התורנויות על הדלת.', update: 'פעם בחודש',
      platform: 'Google Classroom', emergNow: 'יש קבוצת הודעות להורים. לכל תלמיד יש חוברת עבודה בחשבון בבית.' };
    C.FIELDS.concat(C.EMERG_FIELDS).forEach((f) => { const i = F('f-' + f.k); if (f.type === 'select' && ex[f.k] && ![...i.options].some((o) => o.value === ex[f.k])) i.appendChild(new Option(ex[f.k], ex[f.k])); i.value = ex[f.k] || ''; });
    S.form = ex; save(); F('err1').hidden = true;
  });
  if (S.kit) showKit();
  goStep(1);
})();
