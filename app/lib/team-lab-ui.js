// מעבדת צוות: המסך (app/team-lab.html). ההנחיות למודל ומבנה הסבב ב-lib/team-lab-model.js (SBE_TEAMLAB).
// חמישה צעדים, אחד בכל פעם: 1 בוחרים מהלך · 2 מתרגלים בעמיתים · 3 מנסים במפגש · 4 משפרים ושומרים · 5 מתכננים קדימה.
// בלי חיבור למודל אין תוצר. הכול נשמר במכשיר לפי משתמש/ת (sbeUserKey), והרפרטואר עובר בין חברות הצוות כקובץ.
// החשש הפרטי והתמיכה בו (.sens) מופיעים רק במסך, לא בהדפסה ולא בקובץ הרפרטואר.
(function () {
  'use strict';
  const M = window.SBE_TEAMLAB, SRC = window.SBE_ADVISOR_SOURCES;
  const KB = SRC.forAdvisor('teamlab');
  const WRITER = window.SBE_WRITER ? window.SBE_WRITER.rule : '';
  const STORE = window.sbeUserKey ? sbeUserKey('sbe.teamlab.v1') : 'sbe.teamlab.v1:anon';
  const SERVER = window.sbeAIOrigin ? window.sbeAIOrigin() : 'https://sbe-server.onrender.com';
  const F = (id) => document.getElementById(id);
  const NO_MODEL = 'אין כרגע חיבור למודל, ולכן הסבב לא הוכן. מה שמילאת נשמר, ואפשר לנסות שוב בעוד דקה או שתיים.';
  const PARTIAL = 'הסבב חזר חלקי. מה שמילאת נשמר, ואפשר לנסות שוב.';
  const why = (e) => (e && e.code === 'incomplete') ? PARTIAL : NO_MODEL;
  try { const h = sessionStorage.getItem('sbe.session.homeUrl'); if (h) F('nav-home').href = h; } catch (e) {}
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  function btn(text, cls, fn) { const b = el('button', cls || 'btn btn-ghost', text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  const today = () => new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const EMPTY = () => ({ form: {}, kit: null, version: 0, at: '', step: 1, rehearsal: '', obs: {}, session: '', choice: '', forward: [], repertoire: [], changes: [], recommend: null });
  let S = EMPTY();
  try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && v.form) S = Object.assign(EMPTY(), v); } catch (e) {}
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }

  // ── הטופס ──
  (function buildForm() {
    const form = F('form'), grid = el('div', 'grid2');
    M.FIELDS.forEach((f) => {
      const box = el('div', 'f' + (f.private ? ' private' : '')), id = 'f-' + f.k, label = el('label', null, f.l);
      label.htmlFor = id;
      if (f.main) label.appendChild(el('span', 'main-tag', 'שדה עיקרי'));
      box.appendChild(label);
      let input;
      if (f.type === 'select') { input = el('select'); input.appendChild(new Option('בחירה…', '')); f.opts.forEach((o) => input.appendChild(new Option(o, o))); }
      else if (f.type === 'area') { input = el('textarea'); input.maxLength = 4000; }
      else { input = el('input'); input.type = 'text'; input.maxLength = 300; }
      input.id = id; if (f.ph) input.placeholder = f.ph;
      const v = S.form[f.k];
      if (v) { if (f.type === 'select' && ![...input.options].some((o) => o.value === v)) input.appendChild(new Option(v, v)); input.value = v; }
      const keep = () => { S.form[f.k] = input.value; save(); };
      input.addEventListener('input', keep); input.addEventListener('change', keep);
      box.appendChild(input);
      (f.type === 'area' ? form : grid).appendChild(box);
      if (f.k === 'size') form.appendChild(grid);
    });
    if (!grid.parentNode) form.prepend(grid);
  })();
  function readForm() { const d = {}; M.FIELDS.forEach((f) => { d[f.k] = (F('f-' + f.k).value || '').trim(); }); return d; }

  // ── צעדים ──
  const STEPS = F('steps');
  M.STAGES.forEach((s) => { const li = el('li'); li.dataset.step = s.n; li.appendChild(el('b', null, s.n + '. ' + s.t)); li.appendChild(document.createTextNode(s.d)); STEPS.appendChild(li); });
  function goStep(n) {
    if (n > 1 && !S.kit) n = 1;
    S.step = n; save();
    for (let i = 1; i <= 5; i++) F('s' + i).hidden = i !== n;
    STEPS.querySelectorAll('li').forEach((li) => { const i = +li.dataset.step; li.classList.toggle('on', i === n); li.classList.toggle('done', i < n && !!S.kit); });
    if (n > 1) draw(n);
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
  const ask = (system, content) => window.sbeCallAIJson(SERVER, { system, messages: [{ role: 'user', content }], maxTokens: 7000, customerReview: true }, 300000, M.valid);

  // ── התצוגה ──
  function txt(x) { return window.SBE_REFS ? SBE_REFS.strip(String(x == null ? '' : x)) : String(x || ''); }
  function head(root, key, extra) { const s = M.SECTIONS[key], h = el('h3', null, s.h + (extra || '')); root.appendChild(h); if (s.sub) root.appendChild(el('p', 'sub', s.sub)); }
  const T = (key, rows) => window.SBE_TABLE(M.SECTIONS[key].cols, rows, 'kit-t');
  function list(xs) { const u = el('ul'); (xs || []).filter(Boolean).forEach((x) => u.appendChild(el('li', null, txt(x)))); return u; }
  function moveCard(k) {
    const box = el('section', 'card-move'); head(box, 'move');
    const m = k.move || {};
    box.appendChild(window.SBE_TABLE(null, [['המהלך', txt(m.name)], ['המטרה', txt(m.purpose)], ['מתי משתמשים בו', txt(m.when)]], 'kit-t'));
    box.appendChild(T('move', (m.steps || []).map((s) => [txt(s.do), txt(s.say)])));
    if ((m.watch || []).length) { box.appendChild(el('p', 'sub', 'כדאי לשים לב:')); box.appendChild(list(m.watch)); }
    return box;
  }
  function scriptBlock(k) {
    const box = el('section'), sc = k.script || {};
    if ((sc.roles || []).length) { head(box, 'roles'); box.appendChild(T('roles', sc.roles.map((r) => [txt(r.role), txt(r.task)]))); }
    head(box, 'script', S.form.time ? ' (' + S.form.time + ')' : '');
    box.appendChild(T('script', (sc.rounds || []).map((r) => [txt(r.round), r.minutes ? r.minutes + ' דקות' : '', txt(r.what), txt(r.lines)])));
    if ((sc.feedback || []).length) { head(box, 'feedback'); box.appendChild(T('feedback', sc.feedback.map((r) => [txt(r.when), txt(r.question), txt(r.why)]))); }
    return box;
  }
  function observeSheet(k, editable) {
    const box = el('section'); head(box, 'observe');
    box.appendChild(T('observe', (k.observe || []).map((o) => {
      let cell = el('span', 'fill', ' ');
      if (editable) { cell = el('textarea'); cell.rows = 2; cell.value = S.obs[o.action] || ''; cell.setAttribute('aria-label', 'מה ראיתי: ' + o.action); cell.addEventListener('input', () => { S.obs[o.action] = cell.value; save(); }); }
      return [txt(o.action), txt(o.lookFor), cell];
    })));
    return box;
  }
  function trialBlock(k) {
    const box = el('section'), t = k.trial || {};
    head(box, 'trial'); box.appendChild(T('trial', [[txt(t.when) || S.form.nextDate || '', txt(t.change), txt(t.signs)]]));
    if ((k.debrief || []).length) { head(box, 'debrief'); box.appendChild(T('debrief', k.debrief.map((d) => [txt(d.when), txt(d.who), txt(d.question), txt(d.why)]))); }
    return box;
  }
  function decisionBlock(k) {
    const box = el('section'), d = k.decision || {};
    head(box, 'decision');
    box.appendChild(T('decision', (d.options || []).map((o) => [txt(o.option), txt(o.when)])));
    if (d.how || d.who) box.appendChild(window.SBE_TABLE(null, [['איך מחליטים', txt(d.how)], ['מי מחליט ומעדכן', txt(d.who)]], 'kit-t'));
    return box;
  }
  function seedForward() {
    if (!S.forward.length && S.kit && S.kit.forward) S.forward = (S.kit.forward.steps || []).map((s) => ({ c0: txt(s.step), c1: txt(s.owner), c2: txt(s.by), c3: txt(s.update) }));
  }
  function forwardBlock(k, editable) {
    const box = el('section'), f = k.forward || {};
    head(box, 'forward');
    box.appendChild(window.SBE_TABLE(null, [['תמונת העתיד', txt(f.picture)], ['מה עלול לעכב', txt(f.obstacle)], ['אם... אז...', txt(f.ifThen)]], 'kit-t'));
    seedForward();
    const cols = M.SECTIONS.forward.cols;
    if (editable) {
      const t = el('table', 'kit-table etable'), th = el('thead'), hr = el('tr'); cols.forEach((c) => hr.appendChild(el('th', null, c))); hr.appendChild(el('th', 'no-print', '')); th.appendChild(hr); t.appendChild(th);
      const tb = el('tbody'); t.appendChild(tb);
      const redraw = () => {
        tb.textContent = '';
        S.forward.forEach((r, ri) => {
          const tr = el('tr');
          cols.forEach((c, ci) => { const td = el('td'); td.setAttribute('data-label', c); const i = el('input'); i.type = 'text'; i.value = r['c' + ci] || ''; i.setAttribute('aria-label', c); i.addEventListener('input', () => { r['c' + ci] = i.value; save(); }); td.appendChild(i); tr.appendChild(td); });
          const x = el('td', 'no-print'); const xb = btn('✕', 'xbtn', () => { S.forward.splice(ri, 1); save(); redraw(); }); xb.setAttribute('aria-label', 'הסרת הצעד'); x.appendChild(xb); tr.appendChild(x);
          tb.appendChild(tr);
        });
      };
      redraw(); box.appendChild(t);
      box.appendChild(btn('➕ הוספת צעד', 'btn btn-ghost sm no-print', () => { S.forward.push({}); save(); redraw(); }));
    } else box.appendChild(window.SBE_TABLE(cols, S.forward.map((r) => [r.c0, r.c1, r.c2, r.c3]), 'kit-t'));
    if (f.contribution) { box.appendChild(el('h4', null, 'מה זה מוסיף לתשתית החוסן')); box.appendChild(el('p', null, txt(f.contribution))); }
    return box;
  }
  function supportBlock(k) {
    if (!k.support) return null;
    const box = el('section', 'sens support'); head(box, 'support'); box.appendChild(window.SBE_DOC.rich(txt(k.support))); return box;
  }
  function withRefs(build) {
    const root = el('div', 'kit');
    if (window.SBE_REFS) SBE_REFS.begin(SRC, 'resilience-advisor-sources.html');
    build(root);
    if (window.SBE_REFS) { SBE_REFS.add(S.kit.sources || []); const rs = SBE_REFS.end(); if (rs) root.appendChild(rs); }
    return root;
  }
  function draw(n) {
    const k = S.kit; if (!k) return;
    const box = F('out' + n); box.textContent = '';
    box.appendChild(el('p', 'kit-meta', (txt(k.title) || 'מעבדת צוות') + ' · גרסה ' + S.version + ' · ' + (S.at || today())));
    if (n === 2) {
      const sp = supportBlock(k); if (sp) box.appendChild(sp);
      box.appendChild(window.SBE_DOC.editable(withRefs((r) => { r.appendChild(moveCard(k)); r.appendChild(scriptBlock(k)); })));
      box.appendChild(noteBox('מה עלה בחזרה', 'rehearsal', 'מה עבד, מה היה קשה, ומה החלטנו לשנות לפני המפגש.'));
    }
    if (n === 3) {
      box.appendChild(trialBlock(k)); box.appendChild(observeSheet(k, true));
      box.appendChild(noteBox('מה קרה במפגש', 'session', 'מה קרה כשניסינו, בלי שמות. מה הפתיע, ומה התלמידים או המשתתפים עשו.'));
    }
    if (n === 4) {
      if (S.changes.length) { head(box, 'changes', ' ' + S.version); box.appendChild(T('changes', S.changes.map((c) => [txt(c.where), txt(c.why)]))); }
      box.appendChild(decisionBlock(k));
      if (S.recommend && S.recommend.option) box.appendChild(el('p', 'recommend', 'מה מתאים לסבב הבא לפי מה שנצפה: ' + txt(S.recommend.option) + (S.recommend.why ? '. ' + txt(S.recommend.why) : '')));
      const ch = el('div', 'f'), l = el('label', null, 'מה הצוות בחר לסבב הבא'), sel = el('select');
      sel.id = 'choice'; l.htmlFor = 'choice'; sel.setAttribute('data-closed', ''); sel.appendChild(new Option('בחירה…', ''));
      ((k.decision || {}).options || []).forEach((o) => sel.appendChild(new Option(txt(o.option), txt(o.option)))); sel.value = S.choice || '';
      sel.addEventListener('change', () => { S.choice = sel.value; save(); }); ch.append(l, sel); box.appendChild(ch);
      renderRepertoire(box);
    }
    if (n === 5) {
      box.appendChild(window.SBE_DOC.editable(withRefs((r) => { r.appendChild(forwardBlock(k, true)); if (k.resilience) { head(r, 'resilience'); r.appendChild(el('p', null, txt(k.resilience))); } })));
    }
  }
  function noteBox(label, key, ph) {
    const b = el('div', 'f'), l = el('label', null, label), t = el('textarea'); t.id = 'note-' + key; l.htmlFor = t.id; t.placeholder = ph; t.value = S[key] || '';
    t.addEventListener('input', () => { S[key] = t.value; save(); }); b.append(l, t); return b;
  }

  // ── הרפרטואר: גרסאות שנוסו ונבחרו לשמירה ──
  function renderRepertoire(box) {
    const sec = el('section', 'repertoire'); head(sec, 'repertoire');
    const row = el('div', 'btns no-print');
    row.appendChild(btn('📌 שמירת הגרסה הזאת ברפרטואר', 'btn sm', () => {
      const k = S.kit, entry = { name: txt(k.move && k.move.name) || S.form.move, version: S.version, context: [S.form.teamType, S.form.context].filter(Boolean).join(' · ').slice(0, 300),
        adapt: txt(k.adaptations || ''), at: today(), card: { move: k.move, observe: k.observe, title: k.title } };
      S.repertoire = S.repertoire.filter((r) => !(r.name === entry.name && r.version === entry.version)); S.repertoire.unshift(entry); save(); draw(4);
    }));
    row.appendChild(btn('💾 קובץ הרפרטואר לצוות', 'btn btn-ghost sm', () => {
      const blob = new Blob([JSON.stringify({ type: 'begood-team-repertoire', v: 1, savedAt: new Date().toISOString(), repertoire: S.repertoire })], { type: 'application/json' });
      const a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'רפרטואר-הצוות.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }));
    const lbl = el('label', 'btn btn-ghost sm filebtn', '📂 הוספה מקובץ של הצוות'), inp = el('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.hidden = true; lbl.appendChild(inp);
    inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const o = JSON.parse(await f.text());
        if (!o || o.type !== 'begood-team-repertoire' || !Array.isArray(o.repertoire)) throw new Error('זה לא קובץ רפרטואר של מעבדת צוות');
        const key = (r) => r.name + '|' + r.version + '|' + r.at;
        const have = new Set(S.repertoire.map(key));
        o.repertoire.filter((r) => r && typeof r.name === 'string' && !have.has(key(r))).forEach((r) => S.repertoire.push({ name: String(r.name).slice(0, 200), version: Number(r.version) || 1, context: String(r.context || '').slice(0, 300), adapt: String(r.adapt || '').slice(0, 500), at: String(r.at || '').slice(0, 20), card: r.card && typeof r.card === 'object' ? r.card : null }));
        save(); draw(4);
      } catch (e) { alert('לא הצלחנו לפתוח את הקובץ: ' + e.message); } finally { inp.value = ''; }
    });
    row.appendChild(lbl); sec.appendChild(row);
    if (S.repertoire.length) sec.appendChild(T('repertoire', S.repertoire.map((r) => [r.name, String(r.version), r.context, r.adapt, r.at])));
    else sec.appendChild(el('p', 'muted', 'עוד אין גרסאות שמורות.'));
    box.appendChild(sec);
  }

  // ── הפקה ושיפור ──
  function fail(n, m) { n.textContent = m; n.hidden = false; }
  F('go').addEventListener('click', async () => {
    const d = readForm(); S.form = d; save();
    const missing = M.FIELDS.filter((f) => f.main && !d[f.k]).map((f) => f.l);
    F('err1').hidden = true;
    if (missing.length) return fail(F('err1'), 'כדי להמשיך, נשמח למלא: ' + missing.join(', ') + '.');
    const b = F('go'); b.disabled = true; const stop = waiting(F('wait1'), 'מכינה את כרטיס המהלך, התסריט, דף התצפית והתכנון קדימה.', 90);
    let k = null, bad = null;
    try { k = await ask(M.system(KB, WRITER), 'השדות:\n' + M.inputText(d, true) + '\n\nהכיני את הסבב.'); } catch (e) { bad = e; console.warn('מעבדת צוות:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!M.valid(k)) return fail(F('err1'), why(bad));
    S.kit = k; S.version = (S.version || 0) + 1; S.at = today(); S.rehearsal = ''; S.obs = {}; S.session = ''; S.choice = ''; S.forward = []; S.changes = []; S.recommend = null; save();
    goStep(2);
  });
  F('improve').addEventListener('click', async () => {
    const obs = (S.kit.observe || []).map((o) => o.action + ': ' + (S.obs[o.action] || '').trim()).filter((x) => !/:\s*$/.test(x)).join('\n');
    if (!S.rehearsal.trim() && !S.session.trim() && !obs) { goStep(3); return fail(F('err3'), 'כדי לשפר, נשמח לשמוע מה עלה בחזרה או במפגש, או מה ראיתן בדף התצפית.'); }
    F('err4').hidden = true;
    const b = F('improve'); b.disabled = true; const stop = waiting(F('wait4'), 'משפרת את המהלך לפי מה שנצפה.', 90);
    let k = null, bad = null;
    try {
      k = await ask(M.reviseSystem(KB, WRITER), 'השדות:\n' + M.inputText(S.form, true) + '\n\nהסבב הנוכחי (JSON):\n' + JSON.stringify(S.kit) +
        '\n\nמה עלה בחזרה:\n' + (S.rehearsal || '[לא נכתב]') + '\n\nמה נצפה במפגש:\n' + (obs || '[לא נכתב]') + '\n\nמה קרה במפגש:\n' + (S.session || '[לא נכתב]') + '\n\nשפרי את הסבב.');
    } catch (e) { bad = e; console.warn('מעבדת צוות, שיפור:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!M.valid(k)) return fail(F('err4'), why(bad));
    S.changes = Array.isArray(k.changes) ? k.changes : []; S.recommend = k.recommend || null; delete k.changes; delete k.recommend;
    S.kit = k; S.version += 1; S.at = today(); S.forward = []; save(); draw(4);
  });

  // ── הדפסה ──
  function printable(only) {
    const k = S.kit, out = el('div');
    if (only === 'observe') { out.appendChild(trialBlock(k)); out.appendChild(observeSheet(k, false)); return out; }
    out.appendChild(withRefs((r) => {
      [moveCard(k), scriptBlock(k), observeSheet(k, false), trialBlock(k), decisionBlock(k), forwardBlock(k, false)].forEach((x) => r.appendChild(x));
      if (k.resilience) { head(r, 'resilience'); r.appendChild(el('p', null, txt(k.resilience))); }
    }));
    // מקורות רק אם צורפו בצעד 5
    const attached = !!document.querySelector('#out5 .sbe-refs.attach');
    out.querySelectorAll('.sbe-refs').forEach((x) => { if (attached) x.classList.add('attach'); });
    return out;
  }
  function doPrint(only) {
    const title = (txt(S.kit.title) || '').replace(/^מעבדת צוות:?\s*/, '') || S.form.move || 'מעבדת צוות';
    window.SBE_DOC.print({ title, subtitle: [S.form.teamType, S.form.nextDate].filter(Boolean).join(' · ') + ' · גרסה ' + S.version, kind: only === 'observe' ? 'דף תצפית' : 'סבב צוות', node: printable(only) });
  }
  document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => doPrint(b.dataset.print)));
  F('remind').addEventListener('click', () => {
    const v = F('roundDate').value; if (!v) { F('roundDate').focus(); return; }
    const d = v.replace(/-/g, ''), ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Begood//TeamLab//HE', 'BEGIN:VEVENT', 'UID:' + Date.now() + '@be-good.co.il',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), 'DTSTART;VALUE=DATE:' + d, 'SUMMARY:סבב הבא במעבדת הצוות' + (S.form.move ? ' · ' + S.form.move : ''),
      'DESCRIPTION:בודקים את הצעדים בתכנון קדימה, ובוחרים את המהלך לסבב הבא.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = el('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'סבב-הבא-מעבדת-צוות.ics';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  });

  F('example').addEventListener('click', () => {
    const ex = { teamType: 'צוות שכבה או צוות מקצועי', size: '4 מחנכות של שכבת ו׳', move: 'שאלה פתוחה וזמן המתנה',
      context: 'שיחת כיתה שבועית על מה שקרה בהפסקות. היום המחנכת שואלת ועונים בעיקר שניים או שלושה תלמידים.',
      goal: 'שבשיחת הכיתה יותר תלמידים ישתתפו, ובסוף נבחר יחד צעד אחד לשבוע.', observe: 'כמה תלמידים דיברו, כמה זמן חיכינו אחרי שאלה, האם השאלה הייתה פתוחה.',
      time: '20 דקות', nextDate: 'יום שלישי, שיעור חינוך', concern: '' };
    M.FIELDS.forEach((f) => { const i = F('f-' + f.k); if (f.type === 'select' && ex[f.k] && ![...i.options].some((o) => o.value === ex[f.k])) i.appendChild(new Option(ex[f.k], ex[f.k])); i.value = ex[f.k] || ''; });
    S.form = ex; save(); F('err1').hidden = true;
  });
  goStep(S.kit ? (S.step || 2) : 1);
})();
