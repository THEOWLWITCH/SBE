// מעבדת שיח וחקר משותף: המסך (app/shared-dialogue-lab.html). ההנחיות למודל ומבנה התוצר ב-lib/dialogue-lab-model.js (SBE_DIALOGUE).
// לוח דיגיטלי אצל המורה, וכרטיסים להדפסה או להצגה בכיתה. בלי סנכרון בין מכשירים; הכול נשמר במכשיר לפי משתמש/ת (sbeUserKey).
// שמות המשתתפים (בכרטיסי התפקיד) נשארים במכשיר: לא נשלחים למודל (anonymize) ולא לשרת, ומופיעים רק בהדפסה.
// הצעות המודל לא משנות את העבודה לבד: מאמצים במפורש. תשובה שחוזרת אחרי שינוי בעבודה לא מוחלת (rev).
(function () {
  'use strict';
  const M = window.SBE_DIALOGUE, K = window.SBE_LABKIT, SRC = window.SBE_ADVISOR_SOURCES;
  const KB = SRC.forAdvisor('dialogue');
  const { el, btn, arr, txt } = K;
  const F = (id) => document.getElementById(id);
  const KEY = (b) => window.sbeUserKey ? sbeUserKey(b) : b + ':anon';
  const STORE = KEY('sbe.dialogue.v1');
  const today = () => new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  try { const h = sessionStorage.getItem('sbe.session.homeUrl'); if (h) F('nav-home').href = h; } catch (e) {}

  const ITEM = () => ({ id: 'd' + Date.now().toString(36), step: 1, rev: 0, form: {}, start: null, pick: '', question: '', criteria: [], how: '', roles: [], path: [], plan: [],
    claims: [], open: [], evidence: [], draft: { evidence: [] }, versions: [], gains: {}, chats: { 1: [], 2: [], 3: [], 4: [] }, feedback: [], sources: [] });
  let S = { items: [], cur: '' };
  try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && Array.isArray(v.items)) S = v; } catch (e) {}
  if (!S.items.length) { S.items.push(ITEM()); S.cur = S.items[0].id; }
  let I = S.items.find((x) => x.id === S.cur) || S.items[0];
  function save(edit) { if (edit) I.rev = (I.rev || 0) + 1; try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }
  const edited = () => save(true);
  const nameOf = (it) => (it.question || '').slice(0, 60) || it.form.topic && it.form.topic.slice(0, 50) || 'חקר חדש';
  const names = () => arr(I.roles).flatMap((r) => String(r.who || '').split(/[,،]/));
  const anon = (t) => M.anonymize(t, names());

  // ── סרגל העבודות ──
  function renderHub() {
    const box = F('hub'); box.textContent = '';
    S.items.forEach((it) => {
      const c = el('button', 'mech' + (it.id === I.id ? ' on' : '')); c.type = 'button';
      c.append(el('b', null, nameOf(it)), el('span', null, [it.form.subject, it.form.age, 'צעד ' + (it.step || 1) + ': ' + M.STAGES[(it.step || 1) - 1].t, it.versions.length ? 'גרסה ' + it.versions.length : ''].filter(Boolean).join(' · ')));
      c.addEventListener('click', () => { S.cur = it.id; I = it; save(); openItem(); });
      box.appendChild(c);
    });
    box.appendChild(btn('➕ חקר חדש', 'mech add', () => { const it = ITEM(); S.items.push(it); S.cur = it.id; I = it; save(); openItem(); }));
  }
  F('delItem').addEventListener('click', () => {
    if (!confirm('למחוק את "' + nameOf(I) + '" מהמכשיר? אי אפשר לשחזר.')) return;
    S.items = S.items.filter((x) => x.id !== I.id); if (!S.items.length) S.items.push(ITEM());
    I = S.items[0]; S.cur = I.id; save(); openItem();
  });
  F('saveFile').addEventListener('click', () => {
    if (!confirm('בקובץ יש גם את השמות שבכרטיסי התפקיד. כדאי לשמור אותו רק במקום פרטי. להמשיך?')) return;
    const a = el('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(I, null, 1)], { type: 'application/json' }));
    a.download = 'חקר משותף - ' + nameOf(I).replace(/[\\/:*?"<>|]/g, '') + '.json'; a.click();
  });
  F('openFile').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { try { const v = JSON.parse(r.result); if (!v || !v.form) throw 0; v.id = 'd' + Date.now().toString(36); S.items.push(Object.assign(ITEM(), v)); I = S.items[S.items.length - 1]; S.cur = I.id; save(); openItem(); } catch (x) { alert('הקובץ לא נפתח. כדאי לבדוק שזה קובץ ששמרתם מהמעבדה.'); } };
    r.readAsText(f); e.target.value = '';
  });

  // ── צעדים ──
  const mark = K.steps(F('steps'), M.STAGES, (n) => goStep(n));
  function goStep(n) {
    if (n > 1 && !I.question) n = 1;
    I.step = n; save();
    for (let i = 1; i <= 4; i++) { const s = F('s' + i); s.hidden = i !== n; if (i === n) K.enter(s); }
    mark(n, I.versions.length ? 4 : 0);
    [null, draw1, draw2, draw3, draw4][n]();
    renderHub(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => goStep(+b.dataset.go)));

  // ── עזרים ──
  const T = (key, rows) => window.SBE_TABLE(M.SECTIONS[key].cols, rows, 'kit-t');
  function head(root, key, extra) { const s = M.SECTIONS[key]; root.appendChild(el('h3', null, s.h + (extra || ''))); if (s.sub) root.appendChild(el('p', 'sub', s.sub)); }
  const roleNames = () => arr(I.roles).map((r) => r.role).filter(Boolean);
  const claimOpts = () => I.claims.map((c, i) => [String(i), 'טענה ' + (i + 1) + ': ' + String(c.text || '').slice(0, 40)]);
  function context() {
    return anon(['תחום: ' + (I.form.subject || ''), 'גיל: ' + (I.form.age || ''), 'שאלת החקר: ' + (I.question || I.form.topic || ''), 'המטרה: ' + (I.form.goal || ''),
      I.claims.length ? 'טענות:\n' + I.claims.map((c, i) => (i + 1) + '. ' + (c.text || '') + (c.state ? ' (' + c.state + ')' : '')).join('\n') : '',
      I.evidence.length ? 'ראיות:\n' + I.evidence.map((e, i) => (i + 1) + '. ' + (e.what || '') + (e.found ? ': ' + e.found : '')).join('\n') : ''].filter(Boolean).join('\n'));
  }
  const chatOpts = (n) => ({ history: () => (I.chats[n] = I.chats[n] || []), save: () => save(), context, system: () => M.stageSystem(n) });
  const fbOpts = { context, log: (x) => { I.feedback.push(x); save(); } };
  function withRefs(root, build) {
    if (window.SBE_REFS) SBE_REFS.begin(SRC, 'resilience-advisor-sources.html');
    build(root);
    if (window.SBE_REFS) { SBE_REFS.add(arr(I.sources)); const rs = SBE_REFS.end(); if (rs) root.appendChild(rs); }
  }

  // ── צעד 1: מנסחים שאלה ──
  function buildForm() {
    const form = F('form'); form.textContent = '';
    const grid = el('div', 'grid2');
    M.FIELDS.forEach((f) => {
      const box = el('div', 'f'), id = 'f-' + f.k, label = el('label', null, f.l); label.htmlFor = id;
      if (f.main) label.appendChild(el('span', 'main-tag', 'שדה עיקרי'));
      let input;
      if (f.type === 'select') { input = el('select'); input.appendChild(new Option('בחירה…', '')); f.opts.forEach((o) => input.appendChild(new Option(o, o))); if (f.closed) input.setAttribute('data-closed', ''); }
      else if (f.type === 'area') input = el('textarea');
      else { input = el('input'); input.type = 'text'; }
      input.id = id; if (f.ph) input.placeholder = f.ph;
      const v = I.form[f.k];
      if (v) { if (f.type === 'select' && ![...input.options].some((o) => o.value === v)) input.appendChild(new Option(v, v)); input.value = v; }
      const keep = () => { I.form[f.k] = input.value; edited(); };
      input.addEventListener('input', keep); input.addEventListener('change', keep);
      box.append(label, input); (f.type === 'area' ? form : grid).appendChild(box);
      if (f.k === 'time') form.appendChild(grid);
    });
    if (window.SBE_OPEN && SBE_OPEN.scan) try { SBE_OPEN.scan(form); } catch (e) {}
  }
  F('go').addEventListener('click', async () => {
    const d = {}; M.FIELDS.forEach((f) => { d[f.k] = (F('f-' + f.k).value || '').trim(); }); I.form = d; save();
    const miss = M.FIELDS.filter((f) => f.main && !d[f.k]).map((f) => f.l);
    F('err1').hidden = true;
    if (miss.length) { F('err1').textContent = 'כדי להמשיך, נשמח למלא: ' + miss.join(', ') + '.'; F('err1').hidden = false; return; }
    const b = F('go'); b.disabled = true; const stop = K.waiting(F('wait1'), 'מכינה שאלות חקר, תנאי בדיקה ותפקידים.', 60);
    const it = I, st = it.rev || 0; let o = null, bad = null;
    try { o = await K.json(M.startSystem(KB), anon('השדות:\n' + M.inputText(d) + '\n\nהכיני את נקודת הפתיחה.'), M.validStart, 16000); }
    catch (e) { bad = e; console.warn('מעבדת שיח וחקר:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!M.validStart(o)) { F('err1').textContent = K.why(bad); F('err1').hidden = false; return; }
    if (I !== it || (it.rev || 0) !== st) { F('err1').textContent = K.LATE; F('err1').hidden = false; return; }
    I.start = o; I.pick = ''; I.sources = arr(o.sources);
    I.roles = arr(o.roles).filter((r) => r && r.role).map((r) => Object.assign({ who: '', okReady: false }, r));
    I.path = arr(o.path); I.plan = arr(o.plan).map((x) => Object.assign({}, x));
    save(); draw1(); F('out1').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function draw1() {
    const out = F('out1'); out.textContent = '';
    if (!I.start) return;
    const kit = el('div', 'kit'); out.appendChild(kit);
    withRefs(kit, (root) => {
      head(root, 'questions');
      arr(I.start.questions).forEach((q, i) => {
        const c = el('label', 'choice' + (I.pick === String(i) ? ' on' : ''));
        c.append(el('b', null, txt(q.question)), el('span', null, txt(q.why)), el('span', null, 'ראיה שתענה: ' + txt(q.evidence)));
        c.addEventListener('click', () => { I.pick = String(i); I.question = txt(q.question); I.criteria = arr(q.criteria).map((x) => ({ what: txt(x.what), why: txt(x.why) })); edited(); draw1(); });
        root.appendChild(c);
      });
      const own = el('div', 'f'), ol = el('label', null, 'שאלת החקר שנבחרה (אפשר לנסח מחדש)');
      own.append(ol, K.field(I, 'question', 'שאלת החקר', true, () => { I.pick = I.pick || 'own'; edited(); renderHub(); }));
      root.appendChild(own);
      const hw = el('div', 'f'); hw.append(el('label', null, 'איך הקבוצה בחרה'), K.choice(I, 'how', 'איך הקבוצה בחרה', ['הסכמה בשיחה', 'הצבעה', 'בחירה של נציגים', 'המורה הציעה והקבוצה הסכימה'], edited));
      root.appendChild(hw);
      head(root, 'criteria');
      root.appendChild(K.etable([{ k: 'what', l: M.SECTIONS.criteria.cols[0], area: true }, { k: 'why', l: M.SECTIONS.criteria.cols[1], area: true }], I.criteria, edited, { add: 'הוספת תנאי' }));
      head(root, 'roles'); root.appendChild(roleTiles(true));
      if (I.path.length) { head(root, 'path'); root.appendChild(T('path', I.path.map((p) => [txt(p.what), txt(p.how)]))); }
      if (I.start.claimStart) root.appendChild(el('p', 'note', '💬 לפתיחת השלב הבא: ' + txt(I.start.claimStart)));
    });
    out.appendChild(K.gain(I.gains, 1, M.GAIN[1], () => save()));
    K.chat(out, chatOpts(1));
    const row = el('div', 'btns no-print');
    row.appendChild(btn('ממשיכים: בונים טענה ←', 'btn', () => { if (!String(I.question || '').trim()) { alert('כדי להמשיך, אפשר לבחור שאלת חקר או לנסח אחת.'); return; } goStep(2); }));
    out.appendChild(row);
  }
  function roleTiles(full) {
    const g = el('div', 'tiles');
    I.roles.forEach((r, ri) => {
      const c = el('div', 'tile' + (r.kind === 'מעטפת' ? ' env' : '') + (r.okReady ? ' ok' : ''));
      c.appendChild(el('span', 'pill-t', (r.kind === 'מעטפת' ? '🧰 מעטפת' : '🔎 חקר')));
      c.appendChild(el('h4', null, txt(r.role)));
      const wl = el('label', null, 'מי בתפקיד (נשאר במכשיר)'); c.append(wl, K.field(r, 'who', 'מי בתפקיד: ' + r.role, false, () => save()));
      if (full) M.ROLE_ROWS.forEach(([k, l]) => { if (k === 'byWhen' && !r[k] && r.kind !== 'מעטפת') return; c.append(el('label', null, l), K.field(r, k, l, true, edited)); });
      else ['deliverable', 'ready'].forEach((k) => { if (r[k]) c.appendChild(el('p', 'muted', (k === 'ready' ? 'מוכן כש: ' : 'מכין/ה: ') + txt(r[k]))); });
      const ok = el('label', 'okline'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!r.okReady;
      cb.addEventListener('change', () => { r.okReady = cb.checked; save(); c.classList.toggle('ok', r.okReady); c.classList.toggle('pop', r.okReady);
        if (r.okReady && I.roles.every((x) => x.okReady)) K.celebrate(); if (I.step === 3) drawGaps(); });
      ok.append(cb, document.createTextNode(r.kind === 'מעטפת' ? ' מוכן: התוצר זמין' : ' אישר/ה את התפקיד'));
      c.appendChild(ok);
      if (full) c.appendChild(btn('הסרה', 'btn ghost tiny no-print', () => { I.roles.splice(ri, 1); edited(); draw1(); }));
      g.appendChild(c);
    });
    const wrap = el('div'); wrap.appendChild(g);
    if (full) wrap.appendChild(btn('➕ תפקיד נוסף', 'btn ghost sm no-print', () => { I.roles.push({ role: 'תפקיד חדש', kind: 'חקר', who: '', okReady: false }); edited(); draw1(); }));
    return wrap;
  }

  // ── צעד 2: בונים טענה ──
  function draw2() {
    const out = F('out2'); out.textContent = '';
    out.appendChild(el('p', 'note', '❓ ' + I.question));
    const kit = el('div', 'kit'); out.appendChild(kit);
    head(kit, 'claims');
    kit.appendChild(el('p', 'sub', 'לפני שמגיבים לרעיון, מישהו/י אחר/ת מסביר/ה אותו במילים שלו/ה.'));
    kit.appendChild(K.etable([{ k: 'text', l: 'הטענה או ההסבר', area: true }, { k: 'by', l: 'מי הציע/ה (תפקיד)', opts: roleNames }, { k: 'peer', l: 'במילים של עמית/ה', area: true },
      { k: 'pro', l: 'נימוקים בעד', area: true }, { k: 'con', l: 'נימוקים נגד', area: true }, { k: 'state', l: 'מצב', opts: M.CLAIM_STATES }], I.claims, edited, { add: 'הוספת טענה', blank: () => ({ state: 'פתוחה' }) }));
    head(kit, 'open');
    kit.appendChild(K.etable([{ k: 'q', l: 'השאלה', area: true }, { k: 'from', l: 'מאיפה עלתה' }], I.open, edited, { add: 'הוספת שאלה פתוחה' }));
    out.appendChild(K.gain(I.gains, 2, M.GAIN[2], () => save()));
    K.feedback(out, fbOpts); K.chat(out, chatOpts(2));
  }

  // ── צעד 3: בודקים ראיות ──
  function drawGaps() {
    const box = F('gaps'); if (!box) return; box.textContent = '';
    const g = M.envelopeGaps(I.roles);
    if (g.length) box.appendChild(el('p', 'note', '🧰 לפני הבדיקה: ' + g.join(', ') + ' עוד לא מסומנים "מוכן". אפשר לתאם זמן, תמיכה או חלופה. אין צורך לחפש אשמים.'));
    else if (I.roles.length) box.appendChild(el('p', 'note ok', '✓ כל תפקידי המעטפת מוכנים. אפשר לצאת לבדיקה.'));
  }
  function draw3() {
    const out = F('out3'); out.textContent = '';
    out.appendChild(el('p', 'note', '❓ ' + I.question));
    const gaps = el('div'); gaps.id = 'gaps'; out.appendChild(gaps); drawGaps();
    const kit = el('div', 'kit'); out.appendChild(kit);
    head(kit, 'evidence');
    kit.appendChild(K.etable([{ k: 'what', l: 'מה בודקים', area: true }, { k: 'kind', l: 'סוג', opts: M.EVIDENCE_KINDS }, { k: 'source', l: 'מקור' }, { k: 'by', l: 'מי אחראי/ת', opts: roleNames },
      { k: 'until', l: 'עד מתי' }, { k: 'claim', l: 'לאיזו טענה', opts: claimOpts }, { k: 'found', l: 'מה נמצא', area: true }, { k: 'limits', l: 'מגבלות', area: true }, { k: 'stance', l: 'מה זה אומר', opts: M.EV_STANCE }],
      I.evidence, edited, { add: 'הוספת ראיה' }));
    head(kit, 'plan');
    kit.appendChild(K.etable([{ k: 'who', l: 'מי (תפקיד)', opts: roleNames }, { k: 'what', l: 'מה עושים', area: true }, { k: 'when', l: 'מתי' }, { k: 'conditions', l: 'באילו תנאים', area: true }, { k: 'check', l: 'איך נבדוק מול היעד', area: true }], I.plan, edited, { add: 'הוספת שורה' }));
    kit.appendChild(el('h3', null, 'מי מוכן/ה'));
    kit.appendChild(roleTiles(false));
    out.appendChild(K.gain(I.gains, 3, M.GAIN[3], () => save()));
    K.feedback(out, fbOpts); K.chat(out, chatOpts(3));
  }

  // ── צעד 4: מתקנים יחד ──
  function draw4() {
    const out = F('out4'); out.textContent = '';
    const last = I.versions[I.versions.length - 1];
    const base = last ? last.text : (I.claims.find((c) => c.state === 'נבחרה') || I.claims[0] || {}).text || '';
    out.appendChild(el('p', 'note', '❓ ' + I.question + (base ? '\n\nההסבר עד עכשיו: ' + base : '')));
    const sugg = el('div'); sugg.id = 'sugg'; out.appendChild(sugg);
    const d = I.draft; d.evidence = arr(d.evidence);
    const kit = el('div', 'kit'); out.appendChild(kit);
    head(kit, 'version', ' ' + (I.versions.length + 1));
    [['text', 'ההסבר או הפעולה בגרסה החדשה'], ['changed', 'מה השתנה'], ['why', 'למה (נשען על הראיות)'], ['open', 'שאלות שעדיין פתוחות'], ['alternative', 'עמדה חלופית שנשמרת, עם הנימוק שלה']].forEach(([k, l]) => {
      const f = el('div', 'f'); f.append(el('label', null, l), K.field(d, k, l, true, edited)); kit.appendChild(f);
    });
    kit.appendChild(el('label', null, 'על אילו ראיות השינוי נשען'));
    if (!I.evidence.length) kit.appendChild(el('p', 'muted', 'עוד אין ראיות בלוח. אפשר להוסיף אותן בצעד 3.'));
    I.evidence.forEach((e, i) => {
      const l = el('label', 'okline'), cb = el('input'); cb.type = 'checkbox'; cb.checked = d.evidence.includes(i);
      cb.addEventListener('change', () => { d.evidence = cb.checked ? d.evidence.concat(i) : d.evidence.filter((x) => x !== i); edited(); });
      l.append(cb, document.createTextNode(' ' + (i + 1) + '. ' + (e.what || '') + (e.found ? ': ' + e.found : '') + (e.stance ? ' (' + e.stance + ')' : ''))); kit.appendChild(l);
    });
    const ap = el('label', 'okline'), acb = el('input'); acb.type = 'checkbox'; acb.checked = !!d.approved;
    acb.addEventListener('change', () => { d.approved = acb.checked; save(); });
    ap.append(acb, document.createTextNode(' המורה בדקה ומאשרת את המסקנה'));
    const by = el('div', 'f'); by.append(el('label', null, 'מי אישר/ה'), K.field(d, 'by', 'מי אישר/ה', false, () => save()));
    kit.append(ap, by);
    const err = el('p', 'err'); err.hidden = true;
    const row = el('div', 'btns no-print');
    row.append(btn('🔒 קיבוע הגרסה', 'btn', () => {
      const miss = M.canFreeze(d); err.hidden = true;
      if (miss.length) { err.textContent = 'כדי לקבע גרסה, חסר: ' + miss.join(', ') + '.'; err.hidden = false; return; }
      I.versions.push({ v: I.versions.length + 1, at: today(), text: d.text, changed: d.changed, why: d.why, evidence: d.evidence.slice(), open: d.open || '', alternative: d.alternative || '', by: d.by || 'המורה' });
      I.draft = { evidence: [] }; edited(); K.celebrate(); draw4();
    }));
    kit.append(err, row);
    if (I.versions.length) { head(kit, 'versions'); kit.appendChild(T('versions', I.versions.map((v) => [String(v.v), v.at, v.text, [v.changed, v.why].filter(Boolean).join(' · '), v.evidence.map((x) => x + 1).join(', '), v.by]))); }
    if (I.feedback.length) { head(kit, 'feedback'); kit.appendChild(T('feedback', I.feedback.map((f) => [f.on || '', f.was, f.now || '', f.how]))); }
    out.appendChild(K.gain(I.gains, 4, M.GAIN[4], () => save()));
    K.feedback(out, fbOpts); K.chat(out, chatOpts(4));
  }
  F('revise').addEventListener('click', async () => {
    const box = F('sugg'); box.textContent = ''; F('err4').hidden = true;
    if (!I.evidence.some((e) => String(e.found || '').trim())) { F('err4').textContent = 'כדי לקבל הצעה לגרסה מתוקנת, נשמח לראיה אחת לפחות עם "מה נמצא" בצעד 3.'; F('err4').hidden = false; return; }
    const b = F('revise'); b.disabled = true; const stop = K.waiting(F('wait4'), 'מכינה הצעה לגרסה מתוקנת.', 40);
    const it = I, st = it.rev || 0; let o = null, bad = null;
    const content = anon(['שאלת החקר: ' + I.question, 'המטרה: ' + (I.form.goal || ''), 'גיל: ' + (I.form.age || '') + ' · תחום: ' + (I.form.subject || ''),
      'תנאי הבדיקה:\n' + I.criteria.map((c) => '- ' + c.what).join('\n'),
      'הטענות:\n' + I.claims.map((c, i) => (i + 1) + '. ' + (c.text || '') + ' | בעד: ' + (c.pro || '') + ' | נגד: ' + (c.con || '') + ' | ' + (c.state || '')).join('\n'),
      'הראיות (מספר. מה בודקים | מה נמצא | מגבלות | מה זה אומר):\n' + I.evidence.map((e, i) => i + '. ' + (e.what || '') + ' | ' + (e.found || 'לא נבדק עדיין') + ' | ' + (e.limits || '') + ' | ' + (e.stance || '')).join('\n'),
      'ההסבר הנוכחי: ' + ((I.versions[I.versions.length - 1] || {}).text || (I.claims.find((c) => c.state === 'נבחרה') || I.claims[0] || {}).text || 'עוד אין')].join('\n\n'));
    try { o = await K.json(M.reviseSystem(KB), content, M.validRevise, 8000); } catch (e) { bad = e; }
    finally { stop(); b.disabled = false; }
    if (!M.validRevise(o)) { F('err4').textContent = K.why(bad); F('err4').hidden = false; return; }
    if (I !== it || (it.rev || 0) !== st) { F('err4').textContent = K.LATE; F('err4').hidden = false; return; }
    I.sources = Array.from(new Set(arr(I.sources).concat(arr(o.sources))));
    const ev = arr(o.evidence).map(Number).filter((n) => n >= 0 && n < I.evidence.length);
    const card = el('div', 'tile'); card.appendChild(el('span', 'pill-t', '💡 הצעה. הקבוצה מחליטה אם לאמץ'));
    const rows = [['ההסבר המוצע', o.text], ['מה השתנה', o.changed], ['למה', o.why], ['על אילו ראיות', ev.map((x) => x + 1).join(', ')], ['שאלות פתוחות', arr(o.open).join(' · ')], ['עמדה חלופית', o.alternative]].filter((r) => String(r[1] || '').trim()).map((r) => [r[0], txt(r[1])]);
    card.appendChild(window.SBE_TABLE(['חלק', 'ההצעה'], rows, 'kit-t'));
    card.appendChild(btn('✓ אימוץ ההצעה לטיוטה', 'btn sm', () => {
      Object.assign(I.draft, { text: txt(o.text), changed: txt(o.changed), why: txt(o.why), evidence: ev, open: arr(o.open).map(txt).join('\n'), alternative: txt(o.alternative || '') });
      edited(); draw4();
    }));
    box.appendChild(card);
  });

  // ── הדפסה: תצוגה לקריאה בלבד, מהמצב ──
  function printNode(what) {
    const root = el('div', 'kit');
    if (what !== 'roles') {
      root.appendChild(el('h2', null, 'שאלת החקר: ' + (I.question || '')));
      root.appendChild(window.SBE_TABLE(null, [['תחום', I.form.subject], ['גיל', I.form.age], ['המטרה', I.form.goal], ['איך בחרנו', I.how]].filter((r) => r[1]), 'kit-t'));
      if (I.criteria.length) { head(root, 'criteria'); root.appendChild(T('criteria', I.criteria.map((c) => [c.what, c.why]))); }
      if (I.claims.length) { head(root, 'claims'); root.appendChild(T('claims', I.claims.map((c) => [c.text, c.by, c.peer, c.pro, c.con, c.state].map((x) => x || '')))); }
      if (I.open.length) { head(root, 'open'); root.appendChild(T('open', I.open.map((o) => [o.q || '', o.from || '']))); }
      if (I.evidence.length) { head(root, 'evidence'); root.appendChild(T('evidence', I.evidence.map((e) => [e.what, e.kind, e.source, e.by, e.until, e.claim !== undefined && e.claim !== '' ? 'טענה ' + (+e.claim + 1) : '', e.found, e.limits, e.stance].map((x) => x || '')))); }
    }
    if (what !== 'board') {
      if (I.roles.length) {
        head(root, 'roles'); const g = el('div', 'tiles');
        I.roles.forEach((r) => { const c = el('div', 'tile'); c.append(el('span', 'pill-t', r.kind === 'מעטפת' ? 'מעטפת' : 'חקר'), el('h4', null, r.role + (r.who ? ' · ' + r.who : '')));
          c.appendChild(window.SBE_TABLE(null, M.ROLE_ROWS.filter(([k]) => r[k]).map(([k, l]) => [l, txt(r[k])]), 'kit-t')); g.appendChild(c); });
        root.appendChild(g);
      }
    }
    if (what === 'all') {
      if (I.plan.length) { head(root, 'plan'); root.appendChild(T('plan', I.plan.map((p) => [p.who, p.what, p.when, p.conditions, p.check].map((x) => txt(x || ''))))); }
      const d = I.draft || {};
      if (String(d.text || '').trim()) {
        root.appendChild(el('h3', null, 'טיוטת הגרסה החדשה' + (d.approved ? '' : ' (ממתינה לאישור המורה)')));
        root.appendChild(window.SBE_TABLE(null, [['ההסבר', d.text], ['מה השתנה', d.changed], ['למה', d.why], ['על אילו ראיות', arr(d.evidence).map((x) => x + 1).join(', ')], ['שאלות פתוחות', d.open], ['עמדה חלופית', d.alternative]].filter((r) => String(r[1] || '').trim()).map((r) => [r[0], txt(r[1])]), 'kit-t'));
      }
      if (I.versions.length) { head(root, 'versions'); root.appendChild(T('versions', I.versions.map((v) => [String(v.v), v.at, v.text, [v.changed, v.why].filter(Boolean).join(' · '), v.evidence.map((x) => x + 1).join(', '), v.by]))); }
      const gains = [1, 2, 3, 4].filter((n) => String(I.gains[n] || '').trim()).map((n) => [M.STAGES[n - 1].t, M.GAIN[n], I.gains[n]]);
      if (gains.length) { head(root, 'gains'); root.appendChild(T('gains', gains)); }
    }
    return root;
  }
  window.sbeDialoguePrintNode = printNode;
  // מעבדת הדמו (?part=full): טענות וראיות לדוגמה לחקר שנפתח מהדוגמה, כדי להפיק מול המודל גם את הצעת הגרסה המתוקנת
  window.sbeDialogueDemoFill = function () {
    const r = roleNames();
    I.claims = [{ text: 'הצמח פונה לכיוון האור, כי אור עוזר לו לגדול.', by: r[0] || '', peer: 'הוא אומר שהצמח מתכופף אל החלון כי שם יש אור.', pro: 'כל הצמחים בחלון פונים לאותו כיוון.', con: 'אולי זה בגלל החום מהחלון ולא בגלל האור.', state: 'נבחרה' },
      { text: 'הצמח פונה לכיוון החום של החלון.', by: r[1] || '', peer: 'היא חושבת שהחום מושך את הצמח.', pro: 'ליד החלון חם יותר.', con: 'גם צמח ליד מנורה קרה פנה אליה.', state: 'נשמרת כחלופה' }];
    I.evidence = [{ what: 'זווית הגבעול בעציץ בתוך קופסה עם חור בצד אחד, במשך חמישה ימים', kind: 'מדידה', source: 'הניסוי שלנו', by: r[2] || '', until: 'סוף השבוע', claim: '0', found: 'הזווית גדלה מ-0 ל-35 מעלות לכיוון החור.', limits: 'עציץ אחד בלבד.', stance: 'תומכת' },
      { what: 'עציץ השוואה בלי קופסה, באמצע הכיתה', kind: 'תצפית', source: 'הניסוי שלנו', by: r[2] || '', until: 'סוף השבוע', claim: '0', found: 'הגבעול נשאר כמעט ישר.', limits: 'קשה למדוד זווית קטנה.', stance: 'תומכת' }];
    I.open = [{ q: 'האם זה קורה גם באור של מנורה?', from: 'שאלה של מתעד/ת' }];
    I.gains = Object.assign(I.gains || {}, { 2: 'הרעיון על החום עזר לנו לחשוב על בדיקה שמפרידה בין אור לחום.', 3: 'מכין/ת החומרים הכין/ה קופסה, ולכן יכולנו לבדוק אור מכיוון אחד.' });
    I.roles.forEach((x) => { x.okReady = true; });
    save(true);
  };
  const KINDS = { board: 'לוח שאלה, טענות וראיות', roles: 'כרטיסי תפקיד', all: 'תיק החקר' };
  document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => {
    const w = b.dataset.print; window.SBE_DOC.print({ title: I.question || 'חקר משותף', kind: KINDS[w], node: printNode(w) });
  }));

  // ── דוגמה (מנהלת המערכת בלבד) ──
  F('example').addEventListener('click', () => {
    I.form = { subject: 'מדעים', age: 'ה–ו', mode: 'שגרה', setting: 'פנים אל פנים', size: '5 תלמידים בקבוצה, 6 קבוצות', time: 'שלושה שיעורים של 45 דקות',
      topic: 'הצמחים על אדן החלון בכיתה נוטים כולם לאותו כיוון, וחלקם גדלים מהר יותר מאחרים.', goal: 'להסביר בעזרת ניסוי קטן איך אור משפיע על צמיחה של צמח.', context: 'הכיתה למדה על חלקי הצמח. יש עציצים, סרגלים וקופסאות קרטון.' };
    edited(); buildForm();
  });

  function openItem() {
    buildForm();
    ['err1', 'err4'].forEach((x) => { F(x).hidden = true; });
    goStep(I.step || 1);
  }
  openItem();
})();
