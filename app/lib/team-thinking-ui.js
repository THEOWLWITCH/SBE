// חשיבת צוות: המסך (app/team-thinking.html). ההנחיות למודל ב-lib/team-thinking-model.js (SBE_TEAMTHINK).
// כמה צוותים במקביל, ולכל צוות סבבים: בכל סבב התפקידים מתחלפים. הכול נשמר במכשיר לפי משתמש/ת (sbeUserKey).
// שמות (בתפקידים ובפרגון) נשארים במכשיר: לא נשלחים למודל (anonymize) ולא לשרת, ומופיעים רק בהדפסה.
(function () {
  'use strict';
  const M = window.SBE_TEAMTHINK, K = window.SBE_LABKIT, SRC = window.SBE_ADVISOR_SOURCES;
  const KB = SRC.forAdvisor('teamthink');
  const { el, btn, arr, txt } = K;
  const F = (id) => document.getElementById(id);
  const KEY = (b) => window.sbeUserKey ? sbeUserKey(b) : b + ':anon';
  const STORE = KEY('sbe.teamthink.v1');
  const today = () => new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  try { const h = sessionStorage.getItem('sbe.session.homeUrl'); if (h) F('nav-home').href = h; } catch (e) {}

  const ROUND = () => ({ ideas: [], missing: '', weigh: [], decision: {}, thanks: [], learned: '', pride: '', reflect: null, gains: {}, chats: { 1: [], 2: [], 3: [], 4: [] }, feedback: [] });
  const ITEM = () => Object.assign({ id: 't' + Date.now().toString(36), step: 1, rev: 0, form: {}, plan: null, roles: [], rounds: [], sources: [] }, ROUND());
  let S = { items: [], cur: '' };
  try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && Array.isArray(v.items)) S = v; } catch (e) {}
  if (!S.items.length) { S.items.push(ITEM()); S.cur = S.items[0].id; }
  let I = S.items.find((x) => x.id === S.cur) || S.items[0];
  function save(edit) { if (edit) I.rev = (I.rev || 0) + 1; try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }
  const edited = () => save(true);
  const nameOf = (it) => txt(it.plan && it.plan.title) || (it.form.challenge || '').slice(0, 50) || 'אתגר חדש';
  const names = () => arr(I.roles).flatMap((r) => String(r.who || '').split(/[,،]/)).concat(arr(I.thanks).map((t) => t.who || ''));
  const anon = (t) => M.anonymize(t, names());

  // ── סרגל הצוותים ──
  function renderHub() {
    const box = F('hub'); box.textContent = '';
    S.items.forEach((it) => {
      const c = el('button', 'mech' + (it.id === I.id ? ' on' : '')); c.type = 'button';
      c.append(el('b', null, nameOf(it)), el('span', null, [it.form.team, 'צעד ' + (it.step || 1) + ': ' + M.STAGES[(it.step || 1) - 1].t, 'סבב ' + (arr(it.rounds).length + 1)].filter(Boolean).join(' · ')));
      c.addEventListener('click', () => { S.cur = it.id; I = it; save(); openItem(); });
      box.appendChild(c);
    });
    box.appendChild(btn('➕ אתגר חדש', 'mech add', () => { const it = ITEM(); S.items.push(it); S.cur = it.id; I = it; save(); openItem(); }));
  }
  F('delItem').addEventListener('click', () => {
    if (!confirm('למחוק את "' + nameOf(I) + '" מהמכשיר? אי אפשר לשחזר.')) return;
    S.items = S.items.filter((x) => x.id !== I.id); if (!S.items.length) S.items.push(ITEM());
    I = S.items[0]; S.cur = I.id; save(); openItem();
  });

  const mark = K.steps(F('steps'), M.STAGES, (n) => goStep(n));
  function goStep(n) {
    if (n > 1 && !I.plan) n = 1;
    I.step = n; save();
    for (let i = 1; i <= 4; i++) { const s = F('s' + i); s.hidden = i !== n; if (i === n) K.enter(s); }
    mark(n, 0);
    [null, draw1, draw2, draw3, draw4][n]();
    renderHub(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => goStep(+b.dataset.go)));

  const T = (key, rows) => window.SBE_TABLE(M.SECTIONS[key].cols, rows, 'kit-t');
  function head(root, key, extra) { const s = M.SECTIONS[key]; root.appendChild(el('h3', null, s.h + (extra || ''))); if (s.sub) root.appendChild(el('p', 'sub', s.sub)); }
  const roleNames = () => arr(I.roles).map((r) => r.role).filter(Boolean).concat(['משתתף/ת']);
  const ideaOpts = () => I.ideas.map((x, i) => [String(i), 'רעיון ' + (i + 1) + ': ' + String(x.idea || '').slice(0, 40)]);
  function context() {
    return anon(['הצוות: ' + (I.form.team || ''), 'האתגר: ' + (I.form.challenge || ''), 'מה רוצים בסוף: ' + (I.form.outcome || ''),
      I.ideas.length ? 'רעיונות:\n' + I.ideas.map((x, i) => (i + 1) + '. ' + (x.idea || '')).join('\n') : ''].filter(Boolean).join('\n'));
  }
  const chatOpts = (n) => ({ history: () => (I.chats[n] = I.chats[n] || []), save: () => save(), context, system: () => M.stageSystem(n) });
  const fbOpts = { context, log: (x) => { I.feedback.push(x); save(); } };
  function withRefs(root, build) {
    if (window.SBE_REFS) SBE_REFS.begin(SRC, 'resilience-advisor-sources.html');
    build(root);
    if (window.SBE_REFS) { SBE_REFS.add(arr(I.sources)); const rs = SBE_REFS.end(); if (rs) root.appendChild(rs); }
  }

  // ── צעד 1: האתגר שלנו ──
  function buildForm() {
    const form = F('form'); form.textContent = '';
    const grid = el('div', 'grid2');
    M.FIELDS.forEach((f) => {
      const box = el('div', 'f'), id = 'f-' + f.k, label = el('label', null, f.l); label.htmlFor = id;
      if (f.main) label.appendChild(el('span', 'main-tag', 'שדה עיקרי'));
      let input;
      if (f.type === 'select') { input = el('select'); input.appendChild(new Option('בחירה…', '')); f.opts.forEach((o) => input.appendChild(new Option(o, o))); }
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
    const b = F('go'); b.disabled = true; const stop = K.waiting(F('wait1'), 'מכינה מהלך חשיבה, תפקידים והסכמות.', 45);
    const it = I, st = it.rev || 0; let o = null, bad = null;
    try { o = await K.json(M.planSystem(KB), anon('השדות:\n' + M.inputText(d) + '\n\nהכיני את מהלך החשיבה.'), M.validPlan, 12000); }
    catch (e) { bad = e; console.warn('חשיבת צוות:', e.message); }
    finally { stop(); b.disabled = false; }
    if (!M.validPlan(o)) { F('err1').textContent = K.why(bad); F('err1').hidden = false; return; }
    if (I !== it || (it.rev || 0) !== st) { F('err1').textContent = K.LATE; F('err1').hidden = false; return; }
    const old = I.roles; I.plan = o; I.sources = arr(o.sources);
    I.roles = arr(o.roles).filter((r) => r && r.role).map((r, i) => Object.assign({ who: (old[i] || {}).who || '', ok: false }, r));
    save(); draw1(); F('out1').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function planBlocks(root, editable) {
    const P = I.plan;
    if (P.opening) root.appendChild(el('p', 'note', '💬 ' + txt(P.opening)));
    head(root, 'moves');
    const phases = M.PHASES.filter((ph) => arr(P.moves).some((m) => m.phase === ph)).concat(arr(P.moves).some((m) => !M.PHASES.includes(m.phase)) ? [''] : []);
    root.appendChild(T('moves', arr(P.moves).slice().sort((a, b) => phases.indexOf(a.phase) - phases.indexOf(b.phase)).map((m) => [txt(m.phase), txt(m.move), txt(m.what), txt(m.say), txt(m.value), m.minutes ? String(m.minutes) : ''])));
    head(root, 'roles'); root.appendChild(roleTiles(editable));
    if (arr(P.agreements).length) { head(root, 'agreements'); root.appendChild(T('agreements', arr(P.agreements).map((a) => [txt(a)]))); }
    if (arr(P.ifthen).length) { head(root, 'ifthen'); root.appendChild(T('ifthen', arr(P.ifthen).map((x) => [txt(x.if), txt(x.then)]))); }
  }
  function roleTiles(editable) {
    const g = el('div', 'tiles');
    I.roles.forEach((r) => {
      const c = el('div', 'tile' + (r.ok ? ' ok' : ''));
      c.append(el('span', 'pill-t', '🎭 ' + (txt(r.practice) || 'תפקיד')), el('h4', null, txt(r.role)));
      if (r.does) c.appendChild(el('p', null, txt(r.does)));
      if (r.say) c.appendChild(el('p', 'muted', '💬 ' + txt(r.say)));
      if (editable) {
        c.append(el('label', null, 'מי בתפקיד בסבב הזה (נשאר במכשיר)'), K.field(r, 'who', 'מי בתפקיד: ' + r.role, false, () => save()));
        const ok = el('label', 'okline'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!r.ok;
        cb.addEventListener('change', () => { r.ok = cb.checked; save(); c.classList.toggle('ok', r.ok); c.classList.toggle('pop', r.ok); if (r.ok && I.roles.every((x) => x.ok)) K.celebrate(); });
        ok.append(cb, document.createTextNode(' לקח/ה את התפקיד')); c.appendChild(ok);
      } else if (r.who) c.appendChild(el('p', 'muted', 'בתפקיד: ' + r.who));
      g.appendChild(c);
    });
    return g;
  }
  function draw1() {
    const out = F('out1'); out.textContent = '';
    if (!I.plan) return;
    const kit = el('div', 'kit'); out.appendChild(kit);
    withRefs(kit, (root) => planBlocks(root, true));
    out.appendChild(K.gain(I.gains, 1, M.GAIN[1], () => save()));
    K.chat(out, chatOpts(1));
    const row = el('div', 'btns no-print');
    row.append(btn('🖨 מהלך החשיבה ותפקידים', 'btn ghost sm', () => print('plan')), btn('מתחילים: כל הקולות ←', 'btn', () => goStep(2)));
    out.appendChild(row);
  }

  // ── צעד 2: כל הקולות ──
  function voicesLine() {
    const v = M.voices(I.ideas, I.form.size), box = F('voices'); if (!box) return;
    box.textContent = '';
    if (!v.of) { box.appendChild(el('p', 'note', '🗣 ' + v.heard + ' קולות נשמעו עד עכשיו.')); return; }
    const all = v.heard >= v.of;
    box.appendChild(el('p', 'note' + (all ? ' ok' : ''), all ? '✓ כל ' + v.of + ' הקולות נשמעו.' : '🗣 נשמעו ' + v.heard + ' מתוך ' + v.of + ' קולות. אפשר להזמין את מי שעוד לא דיבר/ה: סבב, כתיבה שקטה או תור.'));
  }
  function draw2() {
    const out = F('out2'); out.textContent = '';
    out.appendChild(el('p', 'note', '🎯 ' + (I.form.challenge || '')));
    const v = el('div'); v.id = 'voices'; out.appendChild(v); voicesLine();
    const kit = el('div', 'kit'); out.appendChild(kit);
    head(kit, 'ideas');
    kit.appendChild(el('p', 'sub', 'לפני שמגיבים, מישהו/י אחר/ת מסביר/ה את הרעיון במילים שלו/ה. "מי הציע/ה": תפקיד, או "משתתף/ת 1", "משתתף/ת 2".'));
    kit.appendChild(K.etable([{ k: 'idea', l: 'הרעיון', area: true }, { k: 'by', l: 'מי הציע/ה' }, { k: 'peer', l: 'במילים של עמית/ה', area: true }, { k: 'adds', l: 'מה זה מוסיף', area: true }], I.ideas,
      () => { edited(); voicesLine(); }, { add: 'הוספת רעיון', after: voicesLine }));
    const f = el('div', 'f'); f.append(el('label', null, 'מי עוד לא נשמע/ה, ואיך נזמין (בלי שמות)'), K.field(I, 'missing', 'מי עוד לא נשמע/ה', true, edited)); kit.appendChild(f);
    out.appendChild(K.gain(I.gains, 2, M.GAIN[2], () => save()));
    K.chat(out, chatOpts(2));
  }

  // ── צעד 3: שוקלים יחד ──
  function draw3() {
    const out = F('out3'); out.textContent = '';
    const kit = el('div', 'kit'); out.appendChild(kit);
    head(kit, 'weigh');
    kit.appendChild(el('p', 'sub', 'ביקורת על הרעיון ועל הנימוק, לא על מי שהציע/ה. מחלוקת עניינית היא חלק מהחשיבה, והיא נשמרת.'));
    kit.appendChild(K.etable([{ k: 'idea', l: 'הרעיון', opts: ideaOpts }, { k: 'pro', l: 'בעד, ולמה', area: true }, { k: 'con', l: 'נגד, ולמה', area: true }, { k: 'combine', l: 'שילוב אפשרי', area: true }, { k: 'dispute', l: 'מחלוקת שנשארת', area: true }],
      I.weigh, edited, { add: 'שוקלים עוד רעיון' }));
    out.appendChild(K.gain(I.gains, 3, M.GAIN[3], () => save()));
    K.feedback(out, fbOpts); K.chat(out, chatOpts(3));
  }

  // ── צעד 4: מה הרווחנו ──
  function draw4() {
    const out = F('out4'); out.textContent = '';
    const kit = el('div', 'kit'); out.appendChild(kit);
    head(kit, 'decision');
    const D = I.decision;
    [['what', 'מה בחרנו', true], ['how', 'איך החלטנו', false, M.DECIDE], ['who', 'מי מוביל/ה את הצעד הבא (תפקיד)', false], ['when', 'עד מתי', false], ['kept', 'אפשרויות שנשמרות, עם הנימוק שלהן', true]].forEach(([k, l, area, opts]) => {
      const f = el('div', 'f'); f.append(el('label', null, l), opts ? K.choice(D, k, l, opts, edited) : K.field(D, k, l, area, edited)); kit.appendChild(f);
    });
    head(kit, 'thanks');
    kit.appendChild(K.etable([{ k: 'who', l: 'מי (תפקיד או משתתף/ת)' }, { k: 'did', l: 'מה עשה/תה', area: true }, { k: 'enabled', l: 'מה זה אפשר לנו', area: true }], I.thanks, edited, { add: 'הוספת פרגון' }));
    [['learned', 'מה למדנו מקושי או מניסיון שלא הצליח'], ['pride', 'משפט אחד שאנחנו גאים בו כצוות']].forEach(([k, l]) => {
      const f = el('div', 'f'); f.append(el('label', null, l), K.field(I, k, l, true, edited)); kit.appendChild(f);
    });
    out.appendChild(K.gain(I.gains, 4, M.GAIN[4], () => save()));
    const rb = el('div', 'btns no-print'), w = el('div', 'wait'), err = el('p', 'err'); w.hidden = true; err.hidden = true;
    const refl = el('div', 'kit'); out.append(rb, w, err, refl);
    const go = btn('משוב על התהליך', 'btn', async () => {
      err.hidden = true;
      if (!I.ideas.length) { err.textContent = 'כדי לקבל משוב על התהליך, נשמח לרעיון אחד לפחות בצעד 2.'; err.hidden = false; return; }
      go.disabled = true; const stop = K.waiting(w, 'קוראת את מה שעשיתם.', 30);
      const it = I, st = it.rev || 0; let o = null, bad = null;
      const content = anon([context(), 'מי עוד לא נשמע/ה: ' + (I.missing || ''),
        'במילים של עמית/ה:\n' + I.ideas.map((x, i) => (i + 1) + '. ' + (x.peer || 'לא נכתב')).join('\n'),
        'שקילה:\n' + I.weigh.map((x) => 'רעיון ' + (+x.idea + 1 || '') + ' | בעד: ' + (x.pro || '') + ' | נגד: ' + (x.con || '') + ' | שילוב: ' + (x.combine || '') + ' | מחלוקת: ' + (x.dispute || '')).join('\n'),
        'ההחלטה: ' + (D.what || '') + ' · איך: ' + (D.how || '') + ' · נשמר: ' + (D.kept || ''),
        'פרגון:\n' + I.thanks.map((x) => '- ' + (x.did || '') + ' → ' + (x.enabled || '')).join('\n'),
        'מה למדנו מקושי: ' + (I.learned || ''), 'גאווה: ' + (I.pride || ''),
        'מה הרווחנו (לפי שלבים):\n' + [1, 2, 3, 4].map((n) => M.GAIN[n] + ' ' + (I.gains[n] || '')).join('\n'),
        'יומן משוב: ' + I.feedback.map((f) => f.how).join(', ')].join('\n\n'));
      try { o = await K.json(M.reflectSystem(KB), content, M.validReflect, 6000); } catch (e) { bad = e; }
      finally { stop(); go.disabled = false; }
      if (!M.validReflect(o)) { err.textContent = K.why(bad); err.hidden = false; return; }
      if (I !== it || (it.rev || 0) !== st) { err.textContent = K.LATE; err.hidden = false; return; }
      I.reflect = o; I.sources = Array.from(new Set(arr(I.sources).concat(arr(o.sources)))); save(); drawReflect(refl);
    });
    rb.append(go, btn('🏁 סיום הסבב', 'btn ghost', finishRound), btn('🖨 סיכום הסבב', 'btn ghost sm', () => print('round')));
    drawReflect(refl);
    if (I.rounds.length) { head(kit, 'rounds'); kit.appendChild(T('rounds', I.rounds.map((r, i) => [String(i + 1), r.at, r.what, r.gain]))); }
    K.feedback(out, fbOpts); K.chat(out, chatOpts(4));
  }
  function drawReflect(box) {
    box.textContent = ''; const R = I.reflect; if (!R) return;
    withRefs(box, (root) => {
      head(root, 'reflect');
      if (arr(R.worked).length) { head(root, 'worked'); root.appendChild(T('worked', arr(R.worked).map((x) => [txt(x.move), txt(x.seen)]))); }
      if (arr(R.try).length) { head(root, 'tryNext'); root.appendChild(T('tryNext', arr(R.try).map((x) => [txt(x.what), txt(x.why)]))); }
      if (arr(R.values).length) { head(root, 'valuesSeen'); root.appendChild(T('valuesSeen', arr(R.values).map((x) => [txt(x.value), txt(x.seen)]))); }
      if (R.next) root.appendChild(el('p', 'note ok', '➡️ ' + txt(R.next)));
    });
  }
  function finishRound() {
    if (!confirm('לסיים את הסבב? הסיכום נשמר, והתפקידים עוברים הלאה לסבב הבא.')) return;
    I.rounds.push({ at: today(), what: I.decision.what || '', gain: I.gains[4] || '', ideas: I.ideas.length });
    const keepRoles = M.rotate(I.roles).map((r) => Object.assign(r, { ok: false }));
    Object.assign(I, ROUND(), { roles: keepRoles, rounds: I.rounds, step: 1 });
    edited(); K.celebrate(); goStep(1);
  }

  // ── הדפסה ──
  function printNode(what) {
    const root = el('div', 'kit');
    root.appendChild(window.SBE_TABLE(null, [['הצוות', I.form.team], ['האתגר', I.form.challenge], ['מה רוצים בסוף', I.form.outcome]].filter((r) => r[1]), 'kit-t'));
    if (what === 'plan' && I.plan) { planBlocks(root, false); return root; }
    if (I.ideas.length) { head(root, 'ideas'); root.appendChild(T('ideas', I.ideas.map((x) => [x.idea, x.by, x.peer, x.adds].map((v) => v || '')))); }
    if (I.weigh.length) { head(root, 'weigh'); root.appendChild(T('weigh', I.weigh.map((x) => [x.idea !== undefined && x.idea !== '' ? 'רעיון ' + (+x.idea + 1) : '', x.pro, x.con, x.combine, x.dispute].map((v) => v || '')))); }
    const D = I.decision;
    if (D.what) { head(root, 'decision'); root.appendChild(window.SBE_TABLE(null, [['מה בחרנו', D.what], ['איך החלטנו', D.how], ['מי מוביל/ה', D.who], ['עד מתי', D.when], ['אפשרויות שנשמרות', D.kept]].filter((r) => r[1]), 'kit-t')); }
    if (I.thanks.length) { head(root, 'thanks'); root.appendChild(T('thanks', I.thanks.map((x) => [x.who, x.did, x.enabled].map((v) => v || '')))); }
    const extra = [['מה למדנו מקושי', I.learned], ['מה אנחנו גאים בו', I.pride]].filter((r) => r[1]);
    if (extra.length) root.appendChild(window.SBE_TABLE(null, extra, 'kit-t'));
    const gains = [1, 2, 3, 4].filter((n) => String(I.gains[n] || '').trim()).map((n) => [M.STAGES[n - 1].t, M.GAIN[n], I.gains[n]]);
    if (gains.length) { head(root, 'gains'); root.appendChild(T('gains', gains)); }
    if (I.reflect) { const r = el('div'); drawReflect(r); root.appendChild(r); }
    return root;
  }
  window.sbeTeamThinkPrintNode = printNode;
  // מעבדת הדמו (?part=round): סבב לדוגמה לאתגר שנפתח מהדוגמה, כדי להפיק מול המודל גם את המשוב על התהליך
  window.sbeTeamThinkDemoFill = function () {
    I.ideas = [{ idea: 'משחק תחנות בחצר: כל יום תחנה אחרת, וכל אחד בוחר תחנה.', by: 'משתתף/ת 1', peer: 'אם הבנתי נכון, יהיו כמה משחקים במקביל ואפשר לבחור.', adds: 'יש מקום גם למי שלא אוהב/ת כדורגל.' },
      { idea: 'חבר/ה להפסקה: מי שאין לו עם מי לשחק מקבל/ת שותף/ה.', by: 'משתתף/ת 2', peer: 'היא מציעה שמישהו ידאג שאף אחד לא יישאר לבד.', adds: 'שם לב למי שבדרך כלל לבד.' },
      { idea: 'פינת משחקי קופסה ליד הכיתה.', by: 'משתתף/ת 3', peer: 'הוא רוצה מקום שקט למי שלא רוצה לרוץ.', adds: 'אפשרות שקטה.' },
      { idea: 'לשאול את כל הכיתה מה הם אוהבים לשחק.', by: 'מתעד/ת', peer: 'קודם לבדוק מה כולם רוצים.', adds: 'ההחלטה נשענת על כולם.' }];
    I.missing = 'שני משתתפים עוד לא הציעו. נזמין אותם בכתיבה שקטה בסבב הבא.';
    I.weigh = [{ idea: '0', pro: 'כולם יכולים להצטרף, כי יש כמה תחנות.', con: 'מישהו יארגן את זה כל יום, וזה הרבה עבודה.', combine: 'אפשר לשלב עם חבר/ה להפסקה בתחנה אחת.', dispute: 'אם תחנה אחת תהיה רק כדורגל.' },
      { idea: '1', pro: 'אף אחד לא נשאר לבד.', con: 'עלול להרגיש מביך למי שמקבל/ת שותף/ה.', combine: 'השותף/ה מזמין/ה לתחנה, בלי לסמן מי לבד.', dispute: '' }];
    I.decision = { what: 'משחק תחנות בחצר, עם מזמין/ה בכל תחנה.', how: 'שילוב של שני רעיונות', who: 'מנחה תור', when: 'יום ראשון הבא', kept: 'פינת משחקי קופסה: נבדוק אחרי שבועיים אם יש ביקוש.' };
    I.thanks = [{ who: 'משתתף/ת 2', did: 'שמה לב למי שנשאר לבד.', enabled: 'בזכות זה הוספנו מזמין/ה לכל תחנה.' }, { who: 'מתעד/ת', did: 'הציע/ה לשאול את כל הכיתה.', enabled: 'ההחלטה תתאים לכולם.' }];
    I.learned = 'בפעם הקודמת רק חלק הצטרפו למשחק אחד. הפעם יש כמה אפשרויות.';
    I.pride = 'חשבנו יחד על כולם, גם על מי שלא היה כאן.';
    I.gains = Object.assign(I.gains || {}, { 2: 'הרעיון של חבר/ה להפסקה לא היה עולה לנו לבד.', 3: 'מהמחלוקת על הכדורגל הבנו שכדאי כמה תחנות.', 4: 'הגענו לרעיון משולב שאף אחד לא הציע לבד.' });
    save(true);
  };
  function print(what) { window.SBE_DOC.print({ title: nameOf(I), kind: what === 'plan' ? 'מהלך החשיבה ותפקידים' : 'סיכום הסבב', node: printNode(what) }); }

  F('example').addEventListener('click', () => {
    I.form = { team: 'קבוצת תלמידים', age: 'ה–ו', size: '6', time: '40 דקות', challenge: 'איך מארגנים הפסקה ארוכה שבה לכל אחד ואחת בכיתה יש עם מי לשחק.',
      outcome: 'שתי הצעות שהצוות בוחר ביניהן, ומי מוביל/ה כל אחת בשבוע הבא.', known: 'ניסינו פעם משחק כיתתי בחצר, ורק חלק הצטרפו.', hard: 'אותם שניים מדברים הרבה, ויש שמחכים בשקט.' };
    edited(); buildForm();
  });

  function openItem() { buildForm(); F('err1').hidden = true; goStep(I.step || 1); }
  openItem();
})();
