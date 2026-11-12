// בירור דילמות: דף המשתתפים (dilemma-join.html?c=<קוד כיתה>).
// כניסה: סריקת QR ← מסך הסכמה מדעת (שתי אפשרויות, אף אחת לא מסומנת מראש) ← קוד אישי אקראי ← קבוצה ← שישה שלבים.
// המפתח האישי נשמר במכשיר (localStorage); אפשר לחזור במכשיר אחר עם קוד הכיתה והקוד האישי.
// טיוטות (תגובה אישית, רפלקציה, מסקנה) נשמרות גם במכשיר, כך שתקלה בשרת או ב־AI לא מוחקת כלום.
(function () {
  'use strict';
  const M = window.SBE_DILEMMA, U = window.SBE_DLM_UI, esc = M.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $('#app'), dlg = $('#dlg'), dlgBody = $('#dlgBody'), saveEl = $('#saveState');
  const qs = new URLSearchParams(location.search);
  const CLASS = String(qs.get('c') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const S = { cred: null, me: null, activity: null, board: null, priv: {}, step: 'dilemma', sel: null, ver: -1, linkFrom: null, aiOut: null, busy: false };
  const LS = { get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
  const sessKey = (c) => 'sbe.dlm.s.' + c;
  const draftKey = (kind) => 'sbe.dlm.d.' + S.cred.a + '.' + S.cred.p + '.' + kind;
  const auth = () => ({ page: 'dilemma-join.html', dlm: S.cred });
  const say = (t, cls) => { saveEl.textContent = t || ''; saveEl.className = 'dlm-save' + (cls ? ' ' + cls : ''); };
  const msg = (t, cls) => '<div class="dlm-msg' + (cls ? ' ' + cls : '') + '" role="' + (cls === 'err' ? 'alert' : 'status') + '">' + esc(t) + '</div>';
  function openDlg(html) { dlgBody.innerHTML = html; if (!dlg.open) dlg.showModal(); }
  dlg.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close') || e.target === dlg) dlg.close(); });
  $('#aboutBtn').onclick = () => openDlg(M.aboutHTML() + M.legendHTML());

  async function call(op, input) { return U.api(op, input, S.cred); }

  // ── כניסה ──
  async function start() {
    if (!CLASS) return resumeView('');
    const saved = LS.get(sessKey(CLASS));
    if (saved && saved.a && saved.p && saved.key) {
      S.cred = { a: saved.a, p: saved.p, key: saved.key };
      try { return await loadState(); } catch (e) { if (e.status === 401 || e.status === 403 || e.status === 404) { LS.del(sessKey(CLASS)); S.cred = null; } else return fatal(e); }
    }
    try { const r = await U.api('p.open', { code: CLASS }); S.activity = r.activity; consentView(); }
    catch (e) { app.innerHTML = '<div class="dlm-card">' + msg(e.message, 'err') + '<p>כבר השתתפתם בפעילות? אפשר לחזור עם הקוד האישי.</p><button class="dlm-btn" id="toResume">חזרה עם קוד אישי</button></div>'; $('#toResume').onclick = () => resumeView(CLASS); }
  }
  function fatal(e) { app.innerHTML = '<div class="dlm-card">' + msg(e.message || 'לא ניתן לטעון כרגע. אפשר לרענן את הדף.', 'err') + '</div>'; }

  function consentView() {
    const a = S.activity, c = a.consent;
    $('#topTitle').textContent = 'בירור דילמות · ' + a.title;
    app.innerHTML = '<div class="dlm-card dlm-consent"><h1>' + esc(a.title) + '</h1><p class="dlm-gq">' + esc(M.GUIDING_QUESTION) + '</p>'
      + '<h2>הסכמה מדעת</h2><p>לפני שמתחילים: הסבר קצר על הפעילות ועל המחקר שמלווה אותה. אפשר לפתוח כל סעיף.</p>'
      + c.sections.map((s) => '<details><summary>' + esc(s.t) + '</summary><p>' + esc(s.d) + '</p></details>').join('')
      + '<p class="dlm-hint">אישור ועדת האתיקה: ' + esc(c.ethics) + ' · גרסת נוסח: ' + esc(c.version) + '</p>'
      + '<fieldset style="border:none;padding:0;margin:.8rem 0"><legend><b>מה בחרתם?</b> (אחת משתי האפשרויות)</legend>'
      + (a.researchEnabled ? '<label class="opt"><input type="radio" name="consent" value="research"><span>' + esc(c.research) + '</span></label>' : '<p class="dlm-hint">בפעילות הזו לא נאסף מידע למחקר.</p>')
      + '<label class="opt"><input type="radio" name="consent" value="learning"><span>' + esc(c.learning) + '</span></label></fieldset>'
      + '<p>' + esc(c.note) + '</p><p class="dlm-hint">' + esc(c.recording) + '</p>'
      + '<div class="dlm-row"><button class="dlm-btn main" id="enter" disabled>כניסה לפעילות</button><button class="dlm-btn small" id="toResume">כבר השתתפתי: חזרה עם הקוד האישי</button></div><div id="cmsg"></div></div>';
    app.querySelectorAll('input[name=consent]').forEach((r) => r.addEventListener('change', () => { $('#enter').disabled = false; }));
    $('#toResume').onclick = () => resumeView(CLASS);
    $('#enter').onclick = async () => {
      const v = (app.querySelector('input[name=consent]:checked') || {}).value;
      if (!v) return;
      $('#enter').disabled = true;
      try {
        const r = await U.api('p.enter', { code: CLASS, consent: v });
        S.cred = { a: r.a, p: r.p, key: r.key }; LS.set(sessKey(CLASS), Object.assign({ code: r.me.code }, S.cred));
        S.me = r.me; S.activity = r.activity;
        app.innerHTML = '<div class="dlm-card"><h2>הקוד האישי שלך</h2><p><span class="dlm-code">' + esc(r.me.code) + '</span></p>'
          + '<p>הקוד אקראי ואינו קשור לשם. כדאי לרשום אותו: בעזרתו ובעזרת ה־QR של הכיתה אפשר לחזור לפעילות גם ממכשיר אחר.</p>'
          + '<p class="dlm-hint">בחרתם: ' + esc(r.me.consent.type === 'research' ? c.research : c.learning) + ' אפשר לשנות בכל שלב, בכפתור "ההשתתפות שלי".</p>'
          + '<button class="dlm-btn main" id="go">המשך</button></div>';
        $('#go').onclick = () => loadState().catch(fatal);
      } catch (e) { $('#cmsg').innerHTML = msg(e.message, 'err'); $('#enter').disabled = false; }
    };
  }

  function resumeView(code) {
    app.innerHTML = '<div class="dlm-card"><h1>חזרה לפעילות</h1><p>אפשר להזין את קוד הכיתה (מתחת ל־QR) ואת הקוד האישי שקיבלתם בכניסה הראשונה.</p>'
      + '<form id="rf"><label for="rc">קוד הכיתה</label><input type="text" id="rc" dir="ltr" autocomplete="off" value="' + esc(code) + '" placeholder="למשל: AB12CD34EF">'
      + '<label for="rp">הקוד האישי</label><input type="text" id="rp" dir="ltr" autocomplete="off" placeholder="למשל: ABCD-2345">'
      + '<p><button class="dlm-btn main" type="submit">כניסה</button></p></form><div id="rmsg"></div></div>';
    $('#rf').onsubmit = async (e) => {
      e.preventDefault();
      const c = $('#rc').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      try {
        const r = await U.api('p.resume', { code: c, pcode: $('#rp').value });
        S.cred = { a: r.a, p: r.p, key: r.key }; LS.set(sessKey(c), Object.assign({ code: r.me.code }, S.cred));
        if (c !== CLASS) { location.search = '?c=' + c; return; }
        await loadState();
      } catch (x) { $('#rmsg').innerHTML = msg(x.message, 'err'); }
    };
  }

  async function loadState() {
    const r = await call('p.state');
    S.me = r.me; S.activity = r.activity; S.priv = r.private || {}; S.board = r.board; S.ver = r.board ? r.board.ver : -1;
    $('#topTitle').textContent = 'בירור דילמות · ' + S.activity.title;
    $('#meBtn').hidden = false;
    if (S.activity.mode === 'group' && !S.me.groupId) return groupView();
    main();
    poll();
  }

  function groupView() {
    const g = S.activity.class.groups;
    app.innerHTML = '<div class="dlm-card"><h2>באיזו קבוצה אתם?</h2><p>' + esc(S.activity.class.name) + '. כל קבוצה עובדת על לוח משלה, ורואה רק אותו.</p><div class="dlm-row">'
      + g.map((x) => '<button class="dlm-btn" data-g="' + esc(x.id) + '">' + esc(x.name) + '</button>').join('') + '</div><div id="gmsg"></div></div>';
    app.querySelectorAll('[data-g]').forEach((b) => b.onclick = async () => {
      try { const r = await call('p.group', { groupId: b.dataset.g }); S.me = r.me; await loadState(); } catch (e) { $('#gmsg').innerHTML = msg(e.message, 'err'); }
    });
  }

  // ── המסך הראשי: שישה שלבים ──
  function main() {
    const a = S.activity;
    const grp = a.mode === 'group' ? (a.class.groups.find((g) => g.id === S.me.groupId) || {}).name : 'עבודה אישית';
    app.innerHTML = '<div class="dlm-row" style="justify-content:space-between"><div><h1>' + esc(a.dilemma.title || a.title) + '</h1><p class="dlm-sub">' + esc(a.class.name) + ' · ' + esc(grp || '') + ' · הקוד שלי: <b dir="ltr">' + esc(S.me.code) + '</b></p></div></div>'
      + (a.status !== 'open' ? msg(a.status === 'closed' ? 'הפעילות הסתיימה. אפשר לקרוא, אבל לא לכתוב.' : 'הפעילות עוד לא נפתחה לכתיבה.', 'warn') : '')
      + '<nav class="dlm-steps" aria-label="שלבי הפעילות">' + M.STEPS.map((s) => '<button type="button" data-step="' + s.k + '"' + (S.step === s.k ? ' aria-current="step"' : '') + '>' + s.i + ' ' + s.n + '. ' + esc(s.t) + '</button>').join('') + '</nav>'
      + '<div id="stepBody"></div>';
    app.querySelectorAll('[data-step]').forEach((b) => b.onclick = () => { S.step = b.dataset.step; main(); });
    ({ dilemma: stepDilemma, personal: stepPersonal, board: stepBoard, challenge: stepChallenge, conclusion: stepConclusion, reflection: stepReflection })[S.step]();
  }
  const body = () => $('#stepBody');
  const nextBtn = (k, t) => '<p><button class="dlm-btn main" data-next="' + k + '">' + esc(t) + ' ←</button></p>';
  function bindNext() { body().querySelectorAll('[data-next]').forEach((b) => b.onclick = () => { S.step = b.dataset.next; main(); window.scrollTo(0, 0); }); }

  function stepDilemma() {
    const d = S.activity.dilemma, srcs = S.activity.sources;
    body().innerHTML = '<div class="dlm-card"><p class="dlm-gq">' + esc(M.GUIDING_QUESTION) + '</p>'
      + (d.topic ? '<p><b>נושא:</b> ' + esc(d.topic) + '</p>' : '') + (d.claim ? '<h2>הטענה</h2><p><b>' + esc(d.claim) + '</b></p>' : '')
      + (d.background ? '<h3>רקע</h3><p>' + esc(d.background) + '</p>' : '') + (d.concepts ? '<h3>מושגים</h3><p>' + esc(d.concepts) + '</p>' : '')
      + (d.examples ? '<h3>דוגמאות</h3><p>' + esc(d.examples) + '</p>' : '') + (d.args ? '<h3>נימוקים וטיעונים</h3><p>' + esc(d.args) + '</p>' : '')
      + (d.openingQuestions.length ? '<h3>שאלות פתיחה</h3><ol>' + d.openingQuestions.map((q) => '<li>' + esc(q) + '</li>').join('') + '</ol>' : '')
      + (srcs.length ? '<h3>מקורות שהמנחה צירף/ה</h3>' + srcs.map((s) => '<div data-src="' + esc(s.id) + '" style="cursor:pointer">' + U.sourceRowHTML(s, S.board) + '</div>').join('') : '')
      + '<p class="dlm-hint">' + esc(M.PROTOCOL.lead) + '</p>' + nextBtn('personal', 'לתגובה האישית') + '</div>';
    bindSourceClicks(body()); bindNext();
  }

  // ── טיוטות: במכשיר מיד, ובשרת אחרי רגע ──
  const timers = {};
  function draft(kind, value, send) {
    LS.set(draftKey(kind), { at: Date.now(), value });
    say('נשמר במכשיר…');
    clearTimeout(timers[kind]);
    timers[kind] = setTimeout(async () => {
      try { await send(value); say('נשמר'); }
      catch (e) { say('נשמר במכשיר. השמירה בשרת תתבצע כשהחיבור יחזור.', 'warn'); }
    }, 1500);
  }
  function fromDraft(kind, server, serverAt) {
    const d = LS.get(draftKey(kind));
    return d && (!serverAt || d.at > Date.parse(serverAt)) ? d.value : server;
  }

  function stepPersonal() {
    const r = S.priv.response, cur = fromDraft('response', r ? r.answers : {}, r && r.at) || {};
    body().innerHTML = '<div class="dlm-card soft"><h2>תגובה אישית</h2><p>לפני העבודה בקבוצה. התגובה נשמרת בנפרד, ואינה נחשפת לחברי הקבוצה.</p>'
      + M.INDIVIDUAL_Q.map((q) => '<label for="pq-' + q.k + '">' + esc(q.t) + '</label><textarea id="pq-' + q.k + '" data-k="' + q.k + '">' + esc(cur[q.k] || '') + '</textarea>').join('')
      + nextBtn('board', 'ללוח הקבוצתי') + '</div>';
    const ro = S.activity.status !== 'open';
    body().querySelectorAll('textarea').forEach((t) => { t.readOnly = ro; t.addEventListener('input', () => {
      const answers = {}; body().querySelectorAll('textarea[data-k]').forEach((x) => { answers[x.dataset.k] = x.value; });
      draft('response', answers, (v) => call('p.private', { kind: 'response', answers: v }).then((x) => { S.priv = x.private; }));
    }); });
    bindNext();
  }

  // ── הלוח ──
  function stepBoard() {
    const ro = S.activity.status !== 'open';
    body().innerHTML = '<div class="dlm-card"><h2>הלוח ' + (S.activity.mode === 'group' ? 'הקבוצתי' : 'שלי') + '</h2>'
      + '<details><summary><b>כיצד עובדים עם הלוח?</b></summary><p><b>' + esc(M.PROTOCOL.lead) + '</b></p><ol>' + M.PROTOCOL.steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol><p>' + esc(M.PROTOCOL.rolesNote) + ' לדוגמה: ' + esc(M.PROTOCOL.roles.join(', ')) + '.</p><p class="dlm-hint">' + esc(M.PROTOCOL.noSummary) + '</p></details>'
      + (S.linkFrom ? msg('בחרו כרטיס אחר כדי לקשר אליו, או לחצו כאן לביטול.', 'warn').replace('<div class="dlm-msg', '<div data-cancel-link class="dlm-msg') : '')
      + '<div class="dlm-boardwrap"><div id="boardHost">' + U.boardHTML(S.board, { readOnly: ro, sel: S.linkFrom }) + '</div><aside>' + M.legendHTML()
      + '<p class="dlm-hint" style="margin-top:.6rem">' + esc(M.RUBRIC_NOTES.grey) + '</p></aside></div></div>'
      + (ro ? '' : aiPanelHTML()) + nextBtn('challenge', 'למידע החדש או הסותר');
    bindBoard(); if (!ro) bindAI(); bindNext();
  }
  function refreshBoard() {
    const host = $('#boardHost'); if (!host) return;
    host.innerHTML = U.boardHTML(S.board, { readOnly: S.activity.status !== 'open', sel: S.linkFrom });
    bindBoard(true);
  }
  async function boardOp(input) {
    try { const r = await call('p.board', input); S.board = r.board; S.ver = r.board.ver; say('נשמר'); return r; }
    catch (e) { say(e.message, 'warn'); alertBox(e.message); throw e; }
  }
  function alertBox(t) { openDlg(msg(t, 'err') + '<p><button class="dlm-btn" data-close>סגירה</button></p>'); }

  function bindSourceClicks(root) {
    root.querySelectorAll('[data-src]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); sourceDialog(b.dataset.src); });
  }
  function bindBoard(onlyBoard) {
    const root = onlyBoard ? $('#boardHost') : body();
    bindSourceClicks(root);
    const cl = $('[data-cancel-link]'); if (cl) cl.onclick = () => { S.linkFrom = null; stepBoard(); };
    root.querySelectorAll('form[data-addto]').forEach((f) => f.onsubmit = async (e) => {
      e.preventDefault(); const v = f.querySelector('input').value.trim(); if (!v) return;
      await boardOp({ kind: 'add', zone: f.dataset.addto, text: v }).catch(() => {}); refreshBoard();
    });
    root.querySelectorAll('[data-addsrc]').forEach((b) => b.onclick = () => sourceForm());
    root.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (confirm('להסיר את הכרטיס מהלוח? הגרסה הקודמת נשמרת ביומן.')) { await boardOp({ kind: 'remove', id: b.dataset.del }).catch(() => {}); refreshBoard(); } });
    root.querySelectorAll('[data-unlink]').forEach((b) => b.onclick = async () => { await boardOp({ kind: 'unlink', id: b.dataset.unlink }).catch(() => {}); refreshBoard(); });
    root.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => editDialog(b.dataset.edit));
    root.querySelectorAll('[data-conf]').forEach((b) => b.onclick = () => confDialog(b.dataset.conf));
    root.querySelectorAll('[data-alert]').forEach((b) => b.onclick = () => manipDialog(b.dataset.alert));
    root.querySelectorAll('[data-link]').forEach((b) => b.onclick = () => { S.linkFrom = b.dataset.link; stepBoard(); });
    if (S.linkFrom) root.querySelectorAll('.dlm-item').forEach((el) => { if (el.dataset.item !== S.linkFrom) el.addEventListener('click', (e) => { if (e.target.closest('button')) return; linkDialog(S.linkFrom, el.dataset.item); }); el.style.cursor = 'pointer'; });
  }
  const itemById = (id) => (S.board.items || []).find((i) => i.id === id);

  function editDialog(id) {
    const it = itemById(id); if (!it) return;
    openDlg('<h2>עריכת כרטיס</h2><label for="et">הטקסט</label><textarea id="et">' + esc(it.text) + '</textarea><label for="ez">האזור בלוח</label><select id="ez">'
      + M.ZONES.map((z) => '<option value="' + z.k + '"' + (z.k === it.zone ? ' selected' : '') + '>' + esc(z.t) + '</option>').join('') + '</select>'
      + (it.history && it.history.length ? '<p class="dlm-hint">היו ' + it.history.length + ' גרסאות קודמות. הן נשמרות ביומן.</p>' : '')
      + '<p><button class="dlm-btn main" id="es">שמירה</button></p>');
    $('#es').onclick = async () => { await boardOp({ kind: 'edit', id, text: $('#et').value, zone: $('#ez').value }).catch(() => {}); dlg.close(); refreshBoard(); };
  }
  function confDialog(id) {
    const it = itemById(id); if (!it) return;
    openDlg('<h2>מידת הביטחון בטענה</h2><p>' + esc(it.text) + '</p><p class="dlm-hint">זו לא אמינות המקור. מקור אמין יכול להיות לא רלוונטי לטענה הזו.</p>'
      + '<label for="cf">מידת הביטחון</label><select id="cf"><option value="">לא סומן</option>' + M.CONFIDENCE.map((c) => '<option value="' + c.k + '"' + (it.confidence === c.k ? ' selected' : '') + '>' + esc(c.t) + '</option>').join('') + '</select>'
      + '<label for="cw">על מה זה נשען? (רשות)</label><textarea id="cw">' + esc(it.confidenceWhy || '') + '</textarea><p><button class="dlm-btn main" id="cs">שמירה</button></p>');
    $('#cs').onclick = async () => { await boardOp({ kind: 'edit', id, confidence: $('#cf').value || null, confidenceWhy: $('#cw').value }).catch(() => {}); dlg.close(); refreshBoard(); };
  }
  function linkDialog(from, to) {
    const a = itemById(from), b = itemById(to); if (!a || !b) return;
    openDlg('<h2>קשר בין כרטיסים</h2><p><b>' + esc(a.text) + '</b></p><label for="lr">הקשר</label><select id="lr">' + M.RELATIONS.map((r) => '<option value="' + r.k + '">' + esc(r.t) + '</option>').join('') + '</select><p><b>' + esc(b.text) + '</b></p><p><button class="dlm-btn main" id="ls">שמירת הקשר</button></p>');
    $('#ls').onclick = async () => { S.linkFrom = null; await boardOp({ kind: 'link', from, to, rel: $('#lr').value }).catch(() => {}); dlg.close(); stepBoard(); };
  }
  function sourceForm(prefill) {
    const p = prefill || {};
    openDlg('<h2>הוספת מקור</h2><p class="dlm-hint">מקור חדש מוצג באפור (טרם נבדק) עד שמעריכים אותו. אין לכתוב פרטים מזהים.</p>'
      + '<label for="sf-title">שם המקור (שדה עיקרי)</label><input type="text" id="sf-title" value="' + esc(p.title) + '">'
      + '<div class="dlm-grid2"><div><label for="sf-pub">מחבר או גוף מפרסם</label><input type="text" id="sf-pub" value="' + esc(p.publisher) + '"></div><div><label for="sf-date">תאריך פרסום</label><input type="text" id="sf-date" value="' + esc(p.date) + '" placeholder="למשל: 2023"></div></div>'
      + '<label for="sf-type">סוג המקור</label><select id="sf-type"><option value="">(רשות)</option>' + M.SOURCE_TYPES.map((t) => '<option' + (p.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>'
      + '<label for="sf-url">קישור</label><input type="url" id="sf-url" dir="ltr" value="' + esc(p.url) + '" placeholder="https://">'
      + '<label for="sf-part">החלק במקור שעליו נשענת הטענה (רשות)</label><input type="text" id="sf-part" placeholder="למשל: עמוד 12, טבלה 3">'
      + '<label for="sf-ex">קטע מהמקור (רשות)</label><textarea id="sf-ex"></textarea>'
      + '<p><button class="dlm-btn main" id="sf-save">הוספה ללוח</button></p><div id="sf-msg"></div>');
    $('#sf-save').onclick = async () => {
      const source = { title: $('#sf-title').value, publisher: $('#sf-pub').value, date: $('#sf-date').value, type: $('#sf-type').value, url: $('#sf-url').value, part: $('#sf-part').value, excerpt: $('#sf-ex').value, origin: p.origin || 'participant' };
      try { const r = await call('p.board', { kind: 'add', source, origin: p.origin === 'ai' ? 'ai' : 'participant', text: source.title }); S.board = r.board; S.ver = r.board.ver; dlg.close(); refreshBoard();
        const it = itemById(r.id); if (it && source.url) verifySource(it.sourceId, true); }
      catch (e) { $('#sf-msg').innerHTML = msg(e.message, 'err'); }
    };
  }
  async function verifySource(sid, quiet) {
    try { const r = await call('p.verify', { sourceId: sid }); S.board = r.board; S.ver = r.board.ver; refreshBoard(); if (!quiet) sourceDialog(sid); }
    catch (e) { if (!quiet) alertBox(e.message); }
  }

  function sourceDialog(sid) {
    const s = U.sourceById(S.board, sid) || S.activity.sources.find((x) => x.id === sid); if (!s) return;
    const ro = S.activity.status !== 'open';
    openDlg(U.sourceCardHTML(s, S.board) + (ro ? '' : '<h3>פעולות</h3><div class="dlm-row">'
      + (s.url ? '<button class="dlm-btn small" id="sd-verify">בדיקה שהקישור קיים</button>' : '')
      + '<button class="dlm-btn small" id="sd-ai">הערכת אמינות בעזרת AI</button><button class="dlm-btn small" id="sd-man">הערכה שלנו</button>'
      + '<button class="dlm-btn small" id="sd-checked">✓ בדקתי את המקור</button><button class="dlm-btn small red" id="sd-report">מצאתי בעיה</button></div><div id="sd-out"></div>'));
    const f = dlgBody.querySelector('[data-file]'); if (f) f.onclick = () => openFile(f.dataset.file);
    if (ro) return;
    const out = $('#sd-out');
    if ($('#sd-verify')) $('#sd-verify').onclick = () => { out.innerHTML = msg('בודקים את הקישור…'); verifySource(sid); };
    $('#sd-checked').onclick = () => {
      out.innerHTML = '<label for="ck">מה בדקתם? (רשות)</label><textarea id="ck" placeholder="למשל: פתחנו את הדוח, הנתון מופיע בעמוד 12"></textarea><p class="dlm-hint">הסימון נרשם, ואינו מעיד בהכרח על בדיקה מעמיקה.</p><button class="dlm-btn main" id="cks">שמירה</button>';
      $('#cks').onclick = async () => { await boardOp({ kind: 'checked', sourceId: sid, note: $('#ck').value }).catch(() => {}); sourceDialog(sid); };
    };
    $('#sd-report').onclick = () => reportForm(out, 'source', sid);
    $('#sd-man').onclick = () => manualAssess(out, sid);
    $('#sd-ai').onclick = async () => {
      const claim = prompt('לאיזו טענה בודקים את המקור? (רשות)', (S.board.items.find((i) => i.zone === 'claims') || {}).text || S.activity.dilemma.claim || '') || '';
      out.innerHTML = msg('ה־AI מעריך את המקור… זה נמשך כ־30 שניות.');
      const ctx = U.boardContext(S.activity, S.board); ctx.sources = [ctx.sources.find((x) => x.id === sid)].filter(Boolean); ctx.request = 'הערכת אמינות המקור S1 בהקשר הטענה: ' + claim;
      try {
        const r = await U.ai('assess', ctx, auth()); logAI('assess', r.request, r.out, ['S1'], 'הערכה, ממתינה לאישור הקבוצה');
        const sc = M.scoreOf(r.out.score);
        out.innerHTML = '<div class="dlm-ai"><p>' + M.dotHTML(r.out.score, { big: true }) + ' <b>' + esc(sc.score === null ? 'לא ניתן להעריך' : sc.score + ' · ' + sc.label) + '</b> <span class="dlm-tag ai">הערכה של AI</span></p><p>' + esc(r.out.explanation) + '</p>'
          + (r.out.limits ? '<p class="dlm-hint">מגבלות: ' + esc(r.out.limits) + '</p>' : '') + checkList(r.out.checkPrompts)
          + '<p>הערכה של AI היא הצעה. אפשר לשמור אותה, לשנות או לכתוב הערכה משלכם.</p><div class="dlm-row"><button class="dlm-btn main" id="aiKeep">שמירת ההערכה</button><button class="dlm-btn small" id="aiMan">הערכה שלנו</button><button class="dlm-btn small red" id="aiRep">מצאתי בעיה בתשובה</button></div></div>';
        $('#aiKeep').onclick = async () => { await boardOp({ kind: 'assess', sourceId: sid, assessment: Object.assign({}, r.out, { claim, method: 'ai' }) }).catch(() => {}); refreshBoard(); sourceDialog(sid); };
        $('#aiMan').onclick = () => manualAssess(out, sid, Object.assign({}, r.out, { claim }));
        $('#aiRep').onclick = () => reportForm(out, 'assessment', sid);
      } catch (e) { logAI('assess', claim, String(e.message), [], 'נכשל', false); out.innerHTML = aiFail(); }
    };
  }
  function manualAssess(out, sid, pre) {
    const p = pre || {};
    out.innerHTML = '<label for="ms">הציון (0 עד 7)</label><select id="ms"><option value="">טרם נבדק (אפור)</option>' + M.RUBRIC.map((r) => '<option value="' + r.score + '"' + (p.score === r.score ? ' selected' : '') + '>' + r.score + ' · ' + esc(r.label) + '</option>').join('') + '</select>'
      + '<label for="mc">הטענה שנבדקה</label><input type="text" id="mc" value="' + esc(p.claim) + '">'
      + '<label for="me">למה זה הציון? (שדה עיקרי כשיש ציון)</label><textarea id="me">' + esc(p.explanation) + '</textarea>'
      + '<fieldset style="border:none;padding:0"><legend class="dlm-hint">מה בדקנו (רשות)</legend>' + M.CRITERIA.map((c) => '<label style="font-weight:400"><input type="checkbox" value="' + c.k + '"' + ((p.criteria || []).some((x) => x.k === c.k) ? ' checked' : '') + '> ' + esc(c.t) + '</label>').join('') + '</fieldset>'
      + '<label for="ml">מגבלות ההערכה (רשות)</label><input type="text" id="ml" value="' + esc(p.limits) + '"><p><button class="dlm-btn main" id="mss">שמירת ההערכה</button></p><div id="msm"></div>';
    $('#mss').onclick = async () => {
      const v = $('#ms').value, crit = [...out.querySelectorAll('fieldset input:checked')].map((x) => ({ k: x.value, note: ((p.criteria || []).find((c) => c.k === x.value) || {}).note || '' }));
      try { const r = await call('p.board', { kind: 'assess', sourceId: sid, assessment: { score: v === '' ? null : Number(v), claim: $('#mc').value, explanation: $('#me').value, limits: $('#ml').value, criteria: crit, method: 'participant', relevance: p.relevance || '' } });
        S.board = r.board; refreshBoard(); sourceDialog(sid); }
      catch (e) { $('#msm').innerHTML = msg(e.message, 'err'); }
    };
  }
  function reportForm(out, target, targetId) {
    const ISS = { not_exist: 'המקור לא קיים', not_support: 'המקור לא תומך בטענה', misread: 'פרשנות שגויה של המקור', outdated: 'מידע לא עדכני', missing_caveat: 'חסרה הסתייגות חשובה', wrong_score: 'הציון לא מתאים', other: 'אחר' };
    out.innerHTML = '<h3>מצאתי בעיה</h3><label for="ri">מה הבעיה?</label><select id="ri">' + Object.entries(ISS).map(([k, t]) => '<option value="' + k + '">' + esc(t) + '</option>').join('') + '</select>'
      + '<label for="rt">פירוט</label><textarea id="rt" placeholder="למשל: הקישור מוביל לדף אחר, והנתון לא מופיע שם"></textarea><p><button class="dlm-btn main" id="rs">שליחת הדיווח</button></p><div id="rm"></div>';
    $('#rs').onclick = async () => { try { await boardOp({ kind: 'report', target, targetId, issue: $('#ri').value, text: $('#rt').value }); $('#rm').innerHTML = msg('הדיווח נשמר, והמנחה יראה אותו. תודה!'); } catch (e) {} };
  }
  async function openFile(fid) {
    try { const r = await call('p.file', { fileId: fid }); const bin = atob(r.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      window.open(URL.createObjectURL(new Blob([u8], { type: r.type })), '_blank', 'noopener'); }
    catch (e) { alertBox(e.message); }
  }

  // ── סימני מניפולציה: קונספירציה, ובירור מדיה מודרך ──
  function manipDialog(id) {
    const it = itemById(id); if (!it) return;
    const al = (S.board.alerts || []).filter((a) => a.itemId === id);
    openDlg('<h2>בדיקת סימני מניפולציה</h2><p><b>' + esc(it.text) + '</b></p>'
      + al.map(alertHTML).join('')
      + '<div class="dlm-row"><button class="dlm-btn" id="mdAI">בדיקה בעזרת AI</button><button class="dlm-btn" id="mdCons">סימון ידני: קונספירציה</button><button class="dlm-btn" id="mdMedia">בירור מדיה מודרך (דיפ־פייק)</button></div><div id="mdOut"></div>');
    bindAlertResponses();
    const out = $('#mdOut');
    $('#mdAI').onclick = async () => {
      out.innerHTML = msg('ה־AI בודק… זה נמשך כ־30 שניות.');
      const ctx = U.boardContext(S.activity, S.board); ctx.request = 'הטקסט לבדיקה: ' + it.text;
      try {
        const r = await U.ai('manipulation', ctx, auth()); logAI('manipulation', r.request, r.out, [], 'סימנים לבדיקה');
        const c = r.out.conspiracy, m = r.out.media;
        out.innerHTML = '<div class="dlm-ai">' + (r.out.summary ? '<p>' + esc(r.out.summary) + '</p>' : '')
          + (c.signs.length ? '<p class="dlm-msg warn">⚠ ' + esc(M.CONSPIRACY.alert) + '</p><ul>' + c.signs.map((s) => '<li><b>' + esc(M.CONSPIRACY.signs.find((k) => k.k === s.k).t) + '</b>' + (s.quote ? ': "' + esc(s.quote) + '"' : '') + (s.why ? '. ' + esc(s.why) : '') + '</li>').join('') + '</ul>'
            + (c.questions.length ? '<p><b>שאלות לבדיקה:</b></p><ul>' + c.questions.map((q) => '<li>' + esc(q) + '</li>').join('') + '</ul>' : '')
            + (c.alternatives.length ? '<p><b>הסברים חלופיים:</b></p><ul>' + c.alternatives.map((q) => '<li>' + esc(q) + '</li>').join('') + '</ul>' : '')
            : '<p>לא זוהו סימנים לטיעון קונספירטיבי.</p>')
          + '<ul class="dlm-hint">' + M.CONSPIRACY.limits.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>'
          + (m.alert !== 'none' ? '<p><b>מדיה:</b> ' + esc((M.DEEPFAKE.alerts.find((a) => a.k === m.alert) || {}).t || '') + '. ' + esc(m.basis) + '</p><p class="dlm-hint">' + esc(M.DEEPFAKE.noDetector) + '</p>' : '')
          + '<div class="dlm-row">' + (c.signs.length ? '<button class="dlm-btn main" id="saveCons">שמירת ההתרעה בלוח</button>' : '') + (m.alert !== 'none' ? '<button class="dlm-btn" id="saveMedia">שמירת התרעת מדיה</button>' : '') + '<button class="dlm-btn small red" id="repAI">מצאתי בעיה בתשובה</button></div></div>';
        if ($('#saveCons')) $('#saveCons').onclick = async () => { await boardOp({ kind: 'alert', type: 'conspiracy', itemId: id, target: it.text, data: { by: 'ai', signs: c.signs, questions: c.questions, alternatives: c.alternatives } }).catch(() => {}); refreshBoard(); manipDialog(id); };
        if ($('#saveMedia')) $('#saveMedia').onclick = async () => { await boardOp({ kind: 'alert', type: 'media', itemId: id, target: it.text, data: Object.assign({ by: 'ai' }, m) }).catch(() => {}); refreshBoard(); manipDialog(id); };
        $('#repAI').onclick = () => reportForm(out, 'ai', 'manipulation');
      } catch (e) { logAI('manipulation', it.text, String(e.message), [], 'נכשל', false); out.innerHTML = aiFail(); }
    };
    $('#mdCons').onclick = () => {
      out.innerHTML = '<p>אילו סימנים זיהיתם? (כל סימן לבדיקה, לא הוכחה)</p>' + M.CONSPIRACY.signs.map((s) => '<label style="font-weight:400"><input type="checkbox" value="' + s.k + '"> ' + esc(s.t) + '</label>').join('')
        + '<label for="cq">מה כדאי לבדוק?</label><textarea id="cq"></textarea><ul class="dlm-hint">' + M.CONSPIRACY.limits.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul><button class="dlm-btn main" id="cs2">שמירת ההתרעה</button>';
      $('#cs2').onclick = async () => { const signs = [...out.querySelectorAll('input:checked')].map((x) => ({ k: x.value })); if (!signs.length) return;
        await boardOp({ kind: 'alert', type: 'conspiracy', itemId: id, target: it.text, data: { by: 'participant', signs, questions: [$('#cq').value].filter(Boolean) } }).catch(() => {}); refreshBoard(); manipDialog(id); };
    };
    $('#mdMedia').onclick = () => {
      out.innerHTML = '<p class="dlm-msg warn">' + esc(M.DEEPFAKE.noDetector) + '</p><p>לכל היבט: מה בדקתם ומה מצאתם (רשות).</p>'
        + M.DEEPFAKE.aspects.map((a) => '<label for="dfa-' + a.k + '">' + esc(a.t) + '</label><input type="text" id="dfa-' + a.k + '" data-a="' + a.k + '">').join('')
        + '<label for="dfc">מה נראה כרגע?</label><select id="dfc">' + M.DEEPFAKE.categories.map((c) => '<option value="' + c.k + '">' + esc(c.t) + '</option>').join('') + '</select>'
        + '<label for="dfl">ההתרעה</label><select id="dfl">' + M.DEEPFAKE.alerts.map((c) => '<option value="' + c.k + '">' + esc(c.t) + '</option>').join('') + '</select>'
        + '<label for="dfb">על מה זה נשען? ומה עוד לעשות?</label><textarea id="dfb"></textarea><ul class="dlm-hint">' + M.DEEPFAKE.limits.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul><button class="dlm-btn main" id="dfs">שמירת הבירור</button>';
      $('#dfs').onclick = async () => {
        const aspects = {}; out.querySelectorAll('[data-a]').forEach((x) => { if (x.value.trim()) aspects[x.dataset.a] = x.value.trim(); });
        if ($('#dfl').value === 'technical_evidence' && !aspects.service && !aspects.c2pa && !aspects.meta) { alert('"קיימת ראיה טכנית" מתאים רק כשיש תוצאה של בדיקה טכנית ממשית (מטא־דאטה, C2PA או שירות זיהוי). אפשר לבחור התרעה אחרת.'); return; }
        await boardOp({ kind: 'alert', type: 'media', itemId: id, target: it.text, data: { by: 'participant', aspects, category: $('#dfc').value, alert: $('#dfl').value, basis: $('#dfb').value } }).catch(() => {}); refreshBoard(); manipDialog(id);
      };
    };
  }
  function alertHTML(al) {
    const d = al.data || {};
    const head = al.type === 'media' ? '⚠ ' + ((M.DEEPFAKE.alerts.find((a) => a.k === d.alert) || {}).t || 'בירור מדיה') : '⚠ ' + M.CONSPIRACY.alert;
    return '<div class="dlm-msg warn"><b>' + esc(head) + '</b>'
      + (d.signs ? '<ul>' + d.signs.map((s) => '<li>' + esc((M.CONSPIRACY.signs.find((k) => k.k === s.k) || {}).t || '') + (s.quote ? ': "' + esc(s.quote) + '"' : '') + '</li>').join('') + '</ul>' : '')
      + (d.category ? '<p>' + esc((M.DEEPFAKE.categories.find((c) => c.k === d.category) || {}).t || '') + (d.basis ? '. ' + esc(d.basis) : '') + '</p>' : '')
      + (al.type === 'media' ? '<p class="dlm-hint">' + esc(M.DEEPFAKE.noDetector) + '</p>' : '')
      + al.responses.map((r) => '<p>↳ ' + esc(r.text) + ' <span class="dlm-hint">(' + esc(r.by) + ')</span></p>').join('')
      + '<p><button class="dlm-btn small" data-respond="' + esc(al.id) + '">מה בדקנו ומה המסקנה</button></p></div>';
  }
  function bindAlertResponses() {
    dlgBody.querySelectorAll('[data-respond]').forEach((b) => b.onclick = () => {
      b.outerHTML = '<textarea id="ar-' + b.dataset.respond + '" aria-label="מה בדקנו ומה המסקנה"></textarea><select id="arc-' + b.dataset.respond + '" aria-label="המסקנה"><option value="needs_more">צריך לבדוק עוד</option><option value="dismissed">בדקנו, ואין סיבה לחשד</option><option value="confirmed_concern">החשד התחזק</option><option value="undetermined">לא ניתן לקבוע</option></select><button class="dlm-btn small main" data-ars="' + b.dataset.respond + '">שמירה</button>';
      dlgBody.querySelector('[data-ars="' + b.dataset.respond + '"]').onclick = async (e) => {
        const id = e.target.dataset.ars; await boardOp({ kind: 'alertRespond', id, text: $('#ar-' + id).value, conclusion: $('#arc-' + id).value }).catch(() => {});
        const al = S.board.alerts.find((x) => x.id === id); if (al && al.itemId) manipDialog(al.itemId); else dlg.close();
      };
    });
  }

  // ── עזרת AI ──
  function aiPanelHTML() {
    return '<div class="dlm-card soft"><h2>עזרה מה־AI</h2><p class="dlm-hint">קודם שיחה בקבוצה, אחר כך הלוח, ורק אז AI. כל תשובה היא הצעה לבדיקה: מה שלא נשען על מקור ברשימה מסומן "טרם אומת".</p>'
      + '<div class="dlm-ai"><label for="aiAct">מה לבקש?</label><select id="aiAct">' + M.AI_ACTIONS.map((x) => '<option value="' + x.k + '">' + esc(x.t) + '</option>').join('') + '</select><div id="aiInputs"></div>'
      + '<p><button class="dlm-btn acc" id="aiRun">שליחה ל־AI</button></p><div id="aiRes" class="dlm-ai-res"></div></div>'
      + '<details><summary>למה בודקים את ה־AI?</summary><ul>' + M.AI_WHY_CHECK.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></details></div>';
  }
  function bindAI() {
    const act = $('#aiAct'), inp = $('#aiInputs');
    const srcOpts = () => (S.board.sourcesAll || []).map((s) => '<option value="' + esc(s.id) + '">' + esc(s.title) + '</option>').join('');
    const itemOpts = () => (S.board.items || []).filter((i) => i.zone !== 'sources').map((i) => '<option value="' + esc(i.id) + '">' + esc(i.text.slice(0, 80)) + '</option>').join('');
    const draw = () => {
      const a = M.AI_ACTIONS.find((x) => x.k === act.value);
      inp.innerHTML = a.need === 'term' || a.need === 'text' ? '<label for="aiText">' + esc(a.ph) + '</label><textarea id="aiText"></textarea>'
        : a.need === 'source' ? '<label for="aiSrc">איזה מקור?</label><select id="aiSrc">' + srcOpts() + '</select><label for="aiText">לאיזו טענה? (רשות)</label><input type="text" id="aiText">'
        : a.need === 'claim_source' ? '<label for="aiItem">הטענה</label><select id="aiItem">' + itemOpts() + '</select><label for="aiSrc">הראיה (מקור)</label><select id="aiSrc">' + srcOpts() + '</select>'
        : '<p class="dlm-hint">ה־AI יקרא את מה שכבר בלוח.</p>';
    };
    act.onchange = draw; draw();
    $('#aiRun').onclick = async () => {
      const k = act.value, res = $('#aiRes');
      const ctx = U.boardContext(S.activity, S.board), text = ($('#aiText') || {}).value || '';
      let refsOnly = null;
      if (k === 'assess' || k === 'match') { const sid = $('#aiSrc').value; refsOnly = [ctx.sources.find((s) => s.id === sid)].filter(Boolean); if (!refsOnly.length) { res.innerHTML = msg('אפשר להוסיף מקור ללוח קודם.', 'warn'); return; } }
      if (k === 'match') { const it = itemById($('#aiItem').value); ctx.request = 'האם המקור S1 תומך בטענה: ' + (it ? it.text : ''); }
      else if (k === 'assess') ctx.request = 'הערכת המקור S1 בהקשר הטענה: ' + (text || S.activity.dilemma.claim);
      else ctx.request = text || M.AI_ACTIONS.find((x) => x.k === k).t;
      if ((M.AI_ACTIONS.find((x) => x.k === k).need === 'text' || k === 'explain') && !text.trim()) { res.innerHTML = msg('אפשר לכתוב קודם מה לבדוק.', 'warn'); return; }
      if (refsOnly) ctx.sources = refsOnly;
      res.innerHTML = msg('ה־AI עובד על זה… זה נמשך כ־30 שניות. אפשר להמשיך לעבוד בלוח בינתיים.');
      try {
        const r = await U.ai(k, ctx, auth());
        logAI(k, r.request, r.out, (r.out.items || []).flatMap((i) => i.sourceRefs || []), (r.out.items || []).some((i) => !i.verified) ? 'יש מידע שטרם אומת' : 'נשען על מקורות מהרשימה');
        S.aiOut = { k, r }; res.innerHTML = aiResultHTML(k, r); bindAIResult(k, r, res);
      } catch (e) { logAI(k, ctx.request, String(e.message), [], 'נכשל', false); res.innerHTML = aiFail(); }
    };
  }
  const aiFail = () => msg('ה־AI לא זמין כרגע. שום דבר לא נמחק: אפשר להמשיך לעבוד בלוח בלי AI, ולנסות שוב מאוחר יותר.', 'warn');
  const checkList = (extra) => '<details><summary>כדאי לבדוק</summary><ul>' + [].concat(extra || [], M.AI_CHECK_PROMPTS).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></details>';
  function refName(r, ref) { const s = r.refs.find((x) => x.ref === ref); return s ? s.title : ref; }
  function aiResultHTML(k, r) {
    const o = r.out;
    if (k === 'assess') { const sc = M.scoreOf(o.score); return '<p>' + M.dotHTML(o.score, { big: true }) + ' <b>' + esc(sc.score === null ? 'לא ניתן להעריך' : sc.score + ' · ' + sc.label) + '</b></p><p>' + esc(o.explanation) + '</p>' + (o.limits ? '<p class="dlm-hint">' + esc(o.limits) + '</p>' : '') + '<p><button class="dlm-btn main" id="aiSaveAssess">שמירת ההערכה למקור</button></p>' + checkList(o.checkPrompts) + '<p><button class="dlm-btn small red" id="aiRep">מצאתי בעיה בתשובה</button></p>'; }
    if (k === 'manipulation') return '<p>' + esc(o.summary) + '</p>' + (o.conspiracy.signs.length ? '<p class="dlm-msg warn">⚠ ' + esc(M.CONSPIRACY.alert) + '</p><ul>' + o.conspiracy.signs.map((s) => '<li>' + esc(M.CONSPIRACY.signs.find((x) => x.k === s.k).t) + (s.quote ? ': "' + esc(s.quote) + '"' : '') + '</li>').join('') + '</ul>' : '<p>לא זוהו סימנים לטיעון קונספירטיבי.</p>') + '<ul class="dlm-hint">' + M.CONSPIRACY.limits.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul><p class="dlm-hint">כדי לשמור התרעה על כרטיס, אפשר ללחוץ בכרטיס על "בדיקת סימני מניפולציה".</p><p><button class="dlm-btn small red" id="aiRep">מצאתי בעיה בתשובה</button></p>';
    return (o.summary ? '<p>' + esc(o.summary) + '</p>' : '')
      + (o.relation ? '<p><b>הקשר בין הטענה לראיה:</b> ' + esc(M.RELATIONS.find((x) => x.k === o.relation).t) + '</p>' : '')
      + o.items.map((it, i) => '<div class="it">' + (it.verified ? '<span class="dlm-tag ok">נשען על: ' + esc(it.sourceRefs.map((x) => refName(r, x)).join(', ')) + '</span>' : '<span class="dlm-tag unv">טרם אומת</span>') + ' ' + esc(it.text)
        + ' <button class="dlm-btn small" data-aiadd="' + i + '">הוספה ללוח</button></div>').join('')
      + (o.proposedSources.length ? '<h3>מקורות שה־AI הציע</h3><p class="dlm-hint">אלה הצעות שטרם אומתו. אחרי ההוספה המערכת בודקת שהקישור קיים, והמקור מוצג באפור עד שמעריכים אותו.</p>'
        + o.proposedSources.map((s, i) => '<div class="it"><span class="dlm-tag unv">טרם אומת</span> <b>' + esc(s.title) + '</b> ' + esc([s.publisher, s.date].filter(Boolean).join(' · ')) + (s.url ? ' <span dir="ltr" class="dlm-hint">' + esc(s.url) + '</span>' : ' <span class="dlm-hint">(אין קישור)</span>') + (s.why ? '<br><span class="dlm-hint">' + esc(s.why) + '</span>' : '') + ' <button class="dlm-btn small" data-aisrc="' + i + '">הוספה ללוח לבדיקה</button></div>').join('') : '')
      + (o.caveats.length ? '<p><b>הסתייגויות:</b></p><ul>' + o.caveats.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '')
      + checkList(o.checkPrompts) + '<p><button class="dlm-btn small red" id="aiRep">מצאתי בעיה בתשובה</button></p>';
  }
  function bindAIResult(k, r, res) {
    const ZONE_OF = { fact: 'claims', interpretation: 'claims', hypothesis: 'alternatives', opinion: 'claims', question: 'questions', argument: 'claims', missing: 'missing', alternative: 'alternatives' };
    res.querySelectorAll('[data-aiadd]').forEach((b) => b.onclick = async () => {
      const it = r.out.items[+b.dataset.aiadd];
      const srcId = it.verified ? (r.refs.find((x) => x.ref === it.sourceRefs[0]) || {}).id : null;
      await boardOp(Object.assign({ kind: 'add', zone: ZONE_OF[it.kind] || 'claims', text: (it.verified ? '' : '(טרם אומת) ') + it.text, origin: 'ai' }, srcId ? { sourceId: srcId } : {})).catch(() => {});
      b.disabled = true; b.textContent = '✓ נוסף'; refreshBoard();
    });
    res.querySelectorAll('[data-aisrc]').forEach((b) => b.onclick = async () => {
      const s = r.out.proposedSources[+b.dataset.aisrc];
      try { const x = await boardOp({ kind: 'add', origin: 'ai', text: s.title, source: Object.assign({}, s, { origin: 'ai', excerpt: '', part: '' }) }); b.disabled = true; b.textContent = '✓ נוסף, בודקים את הקישור…'; refreshBoard();
        const it = itemById(x.id); if (it && s.url) { await verifySource(it.sourceId, true); const src = U.sourceById(S.board, it.sourceId); b.textContent = '✓ נוסף · ' + U.verifyLabel(src && src.verify); } }
      catch (e) {}
    });
    const sa = $('#aiSaveAssess'); if (sa) sa.onclick = async () => { await boardOp({ kind: 'assess', sourceId: r.refs[0].id, assessment: Object.assign({}, r.out, { claim: S.activity.dilemma.claim, method: 'ai' }) }).catch(() => {}); sa.disabled = true; sa.textContent = '✓ נשמר'; refreshBoard(); };
    const rp = $('#aiRep'); if (rp) rp.onclick = () => { const box = document.createElement('div'); res.appendChild(box); reportForm(box, 'ai', k); };
  }
  function logAI(action, request, response, sources, verification, ok) {
    call('p.aiLog', { action, request: String(request || '').slice(0, 5000), response: typeof response === 'string' ? response : JSON.stringify(response).slice(0, 11000), sources, verification, ok: ok !== false }).catch(() => {});
  }

  // ── מידע חדש או סותר ──
  function stepChallenge() {
    const a = S.activity, b = S.board, ro = a.status !== 'open';
    const allowed = a.challengeMode === 'group' || a.challengeOpen;
    const eligible = (b.sourcesAll || []).filter((s) => s.origin === 'facilitator' || ['exists', 'file'].includes((s.verify || {}).status));
    body().innerHTML = '<div class="dlm-card"><h2>מידע חדש או סותר</h2><p>מידע שמאתגר את מה שכבר בלוח. לפני שהוא מוצג, נשמרת גרסה של הלוח, כדי שאפשר יהיה לראות מה השתנה. המידע מגיע רק ממקור של המנחה או ממקור שאומת.</p>'
      + (b.challenges || []).map((c) => { const s = U.sourceById(b, c.sourceRef); return '<div class="dlm-card soft"><p><b>' + esc(c.info) + '</b></p>' + (s ? '<div data-src="' + esc(s.id) + '" style="cursor:pointer">' + U.sourceRowHTML(s, b) + '</div>' : '')
        + (c.challenges ? '<p><b>מה זה מאתגר:</b> ' + esc(c.challenges) + '</p>' : '') + (c.caveats.length ? '<p><b>הסתייגויות:</b> ' + esc(c.caveats.join(' · ')) + '</p>' : '') + (c.check.length ? '<p><b>מה כדאי לבדוק:</b> ' + esc(c.check.join(' · ')) + '</p>' : '')
        + '<p class="dlm-hint">גרסת הלוח נשמרה לפני ההצגה.</p>'
        + (c.decision ? '<p><b>ההחלטה שלנו:</b> ' + esc({ update: 'מעדכנים את הלוח', keep: 'משאירים את הלוח כמו שהוא', open: 'השאלה נשארת פתוחה' }[c.decision.value]) + (c.decision.note ? ': ' + esc(c.decision.note) : '') + '</p>' : '')
        + (ro ? '' : '<div class="dlm-row"><select data-dv="' + esc(c.id) + '" aria-label="ההחלטה"><option value="update">מעדכנים את הלוח</option><option value="keep">משאירים את הלוח כמו שהוא</option><option value="open">השאלה נשארת פתוחה</option></select><input type="text" data-dn="' + esc(c.id) + '" aria-label="הסבר" placeholder="למה? (רשות)"><button class="dlm-btn small main" data-ds="' + esc(c.id) + '">שמירת ההחלטה</button></div>') + '</div>'; }).join('')
      + (ro ? '' : !allowed ? msg('המידע המאתגר ייפתח כשהמנחה יפתח אותו.', 'warn')
        : '<h3>הוספת מידע מאתגר</h3><div class="dlm-row"><button class="dlm-btn acc" id="chAI">הצעה מה־AI (רק מהמקורות שברשימה)</button></div><div id="chOut"></div>'
          + (eligible.length ? '<details><summary>הוספה ידנית ממקור</summary><label for="chS">המקור</label><select id="chS">' + eligible.map((s) => '<option value="' + esc(s.id) + '">' + esc(s.title) + '</option>').join('') + '</select><label for="chI">המידע</label><textarea id="chI"></textarea><label for="chC">מה הוא מאתגר בלוח?</label><input type="text" id="chC"><p><button class="dlm-btn main" id="chM">הצגת המידע</button></p></details>' : '<p class="dlm-hint">עדיין אין מקור של המנחה או מקור שאומת.</p>'))
      + nextBtn('conclusion', 'למסקנה המותנית') + '</div>';
    bindSourceClicks(body()); bindNext();
    body().querySelectorAll('[data-ds]').forEach((x) => x.onclick = async () => { const id = x.dataset.ds; await boardOp({ kind: 'challengeDecide', id, value: body().querySelector('[data-dv="' + id + '"]').value, note: body().querySelector('[data-dn="' + id + '"]').value }).catch(() => {}); stepChallenge(); });
    if ($('#chM')) $('#chM').onclick = async () => { await boardOp({ kind: 'challenge', sourceRef: $('#chS').value, info: $('#chI').value, challenges: $('#chC').value }).catch(() => {}); stepChallenge(); };
    if ($('#chAI')) $('#chAI').onclick = async () => {
      const out = $('#chOut'); out.innerHTML = msg('ה־AI מחפש מידע מאתגר במקורות שברשימה…');
      const ctx = U.boardContext(a, b); ctx.sources = ctx.sources.filter((s) => eligible.some((e) => e.id === s.id)).map((s) => Object.assign({}, s));
      if (!ctx.sources.length) { out.innerHTML = msg('אין עדיין מקור של המנחה או מקור שאומת.', 'warn'); return; }
      try {
        const r = await U.ai('challenge', ctx, auth()); logAI('challenge', r.request, r.out, r.out.sourceRef ? [r.out.sourceRef] : [], r.out.none ? 'אין מידע מתאים' : 'מבוסס על מקור מהרשימה');
        if (r.out.none) { out.innerHTML = msg(r.out.why || 'לא נמצא ברשימה מידע מאתגר מתאים.', 'warn'); return; }
        const sid = r.refs.find((x) => x.ref === r.out.sourceRef).id;
        await boardOp({ kind: 'challenge', sourceRef: sid, info: r.out.info, challenges: r.out.challenges, caveats: r.out.caveats, check: r.out.check }); stepChallenge();
      } catch (e) { logAI('challenge', '', String(e.message), [], 'נכשל', false); out.innerHTML = aiFail(); }
    };
  }

  // ── מסקנה מותנית ──
  function stepConclusion() {
    const c = S.board.conclusion || {}, ro = S.activity.status !== 'open';
    const cur = fromDraft('conclusion', c, c.at) || {};
    body().innerHTML = '<div class="dlm-card"><h2>מסקנה מותנית</h2><p>אפשר להגיע למסקנה מורכבת ומסויגת גם בלי הסכמה מלאה. מחלוקת יכולה להישאר פתוחה. ' + (S.activity.mode === 'group' ? 'זו מסקנה של הקבוצה, וכל אחד ואחת בקבוצה יכולים לערוך אותה.' : '') + '</p>'
      + (c.submitted ? msg('המסקנה הוגשה. אפשר עדיין לעדכן אותה.') : '')
      + M.CONCLUSION_Q.map((q) => '<label for="cq-' + q.k + '">' + esc(q.t) + '</label><textarea id="cq-' + q.k + '" data-k="' + q.k + '"' + (ro ? ' readonly' : '') + '>' + esc(cur[q.k] || '') + '</textarea>').join('')
      + (ro ? '' : '<div class="dlm-row"><button class="dlm-btn" id="cSave">שמירה</button><button class="dlm-btn main" id="cSub">הגשת המסקנה</button><button class="dlm-btn acc" id="cAI">בדיקה מול הלוח בעזרת AI</button></div><div id="cOut"></div>')
      + nextBtn('reflection', 'לרפלקציה האישית') + '</div>';
    bindNext(); if (ro) return;
    const fields = () => { const f = {}; body().querySelectorAll('textarea[data-k]').forEach((x) => { f[x.dataset.k] = x.value; }); return f; };
    body().querySelectorAll('textarea[data-k]').forEach((t) => t.addEventListener('input', () => { LS.set(draftKey('conclusion'), { at: Date.now(), value: fields() }); say('נשמר במכשיר'); }));
    const save = async (submit) => { try { await boardOp({ kind: 'conclusion', fields: fields(), submit }); LS.del(draftKey('conclusion')); $('#cOut').innerHTML = msg(submit ? 'המסקנה הוגשה.' : 'נשמר.'); } catch (e) { $('#cOut').innerHTML = msg(e.message, 'err'); } };
    $('#cSave').onclick = () => save(false); $('#cSub').onclick = () => save(true);
    $('#cAI').onclick = async () => {
      const out = $('#cOut'); out.innerHTML = msg('ה־AI משווה את המסקנה ללוח…');
      const ctx = U.boardContext(S.activity, S.board); const f = fields(); ctx.request = 'המסקנה: ' + M.CONCLUSION_Q.map((q) => q.t + ' ' + (f[q.k] || '')).join(' | ');
      try { const r = await U.ai('conclusion_check', ctx, auth()); logAI('conclusion_check', r.request, r.out, [], 'שאלות לבדיקה');
        out.innerHTML = '<div class="dlm-ai"><p class="dlm-hint">ה־AI לא משנה את המסקנה. אלה שאלות לבדיקה:</p>' + (r.out.summary ? '<p>' + esc(r.out.summary) + '</p>' : '') + '<ul>' + r.out.items.map((i) => '<li>' + esc(i.text) + '</li>').join('') + '</ul></div>'; }
      catch (e) { out.innerHTML = aiFail(); }
    };
  }

  // ── רפלקציה אישית ──
  function stepReflection() {
    const r = S.priv.reflection || {}, qs2 = S.activity.reflectionQs, ro = S.activity.status !== 'open';
    const cur = fromDraft('reflection', r.answers || [], r.at) || [];
    body().innerHTML = '<div class="dlm-card soft"><h2>רפלקציה אישית</h2><p>הרפלקציה אינה גלויה לחברי הקבוצה. ' + esc(M.REFLECTION_NOTE) + '</p>'
      + (r.status === 'submitted' ? msg('הרפלקציה הוגשה. תודה!') : '')
      + qs2.map((q, i) => '<label for="rq-' + i + '">' + (i + 1) + '. ' + esc(q) + '</label><textarea id="rq-' + i + '" data-i="' + i + '"' + (ro ? ' readonly' : '') + '>' + esc(cur[i] || '') + '</textarea>').join('')
      + (ro ? '' : '<div class="dlm-row"><button class="dlm-btn" id="rSave">שמירה</button><button class="dlm-btn main" id="rSub">הגשת הרפלקציה</button></div><div id="rOut"></div>') + '</div>';
    if (ro) return;
    const answers = () => [...body().querySelectorAll('textarea[data-i]')].map((x) => x.value);
    body().querySelectorAll('textarea[data-i]').forEach((t) => t.addEventListener('input', () => draft('reflection', answers(), (v) => call('p.private', { kind: 'reflection', answers: v }).then((x) => { S.priv = x.private; }))));
    const save = async (submit) => { clearTimeout(timers.reflection); try { const x = await call('p.private', { kind: 'reflection', answers: answers(), submit }); S.priv = x.private; LS.del(draftKey('reflection')); $('#rOut').innerHTML = msg(submit ? 'הרפלקציה הוגשה. תודה!' : 'נשמר.'); } catch (e) { $('#rOut').innerHTML = msg(e.message, 'err'); } };
    $('#rSave').onclick = () => save(false); $('#rSub').onclick = () => save(true);
  }

  // ── ההשתתפות שלי: הקוד, וההחלטה על המחקר ──
  $('#meBtn').onclick = () => {
    const c = S.activity.consent, cur = S.me.consent.type;
    openDlg('<h2>ההשתתפות שלי</h2><p>הקוד האישי: <span class="dlm-code">' + esc(S.me.code) + '</span></p><p>הבחירה הנוכחית: <b>' + esc(cur === 'research' ? c.research : c.learning) + '</b></p>'
      + (S.activity.researchEnabled ? '<h3>שינוי הבחירה</h3><label class="opt" style="font-weight:400"><input type="radio" name="nc" value="research"' + (cur === 'research' ? ' checked' : '') + '> ' + esc(c.research) + '</label><label class="opt" style="font-weight:400"><input type="radio" name="nc" value="learning"' + (cur === 'learning' ? ' checked' : '') + '> ' + esc(c.learning) + '</label>'
        + '<label style="font-weight:400"><input type="checkbox" id="wd"> אני מבקש/ת שהנתונים שלי לא ישמשו במחקר, גם מה שכבר נאסף</label><p><button class="dlm-btn main" id="ncs">שמירה</button></p><div id="ncm"></div>' : '')
      + '<details><summary>הסבר ההסכמה המלא</summary>' + c.sections.map((s) => '<p><b>' + esc(s.t) + ':</b> ' + esc(s.d) + '</p>').join('') + '</details>');
    if ($('#ncs')) $('#ncs').onclick = async () => {
      const v = (dlgBody.querySelector('input[name=nc]:checked') || {}).value, wd = $('#wd').checked;
      try { const r = await call('p.consent', { consent: wd ? 'learning' : v, withdrawData: wd }); S.me = r.me; $('#ncm').innerHTML = msg('הבחירה נשמרה. ההשתתפות בפעילות נמשכת כרגיל.'); } catch (e) { $('#ncm').innerHTML = msg(e.message, 'err'); }
    };
  };

  // ── עדכון חי: שואלים את השרת כל כמה שניות אם הלוח השתנה ──
  let pollT = null;
  function poll() {
    clearTimeout(pollT);
    pollT = setTimeout(async () => {
      if (S.cred && ['board', 'challenge', 'conclusion'].includes(S.step) && !dlg.open && !document.hidden) {
        try {
          const r = await call('p.poll', { since: S.ver });
          if (r.status !== S.activity.status || r.challengeOpen !== S.activity.challengeOpen) { S.activity.status = r.status; S.activity.challengeOpen = r.challengeOpen; if (r.board) { S.board = r.board; S.ver = r.ver; } main(); }
          else if (r.board) { const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.value; if (!typing) { S.board = r.board; S.ver = r.ver; if (S.step === 'board') refreshBoard(); else if (S.step === 'challenge') stepChallenge(); } }
        } catch (e) { if (e.status === 401) { say('הכניסה הסתיימה. אפשר לחזור עם הקוד האישי.', 'warn'); return; } }
      }
      poll();
    }, 4000);
  }

  start().catch(fatal);
})();
