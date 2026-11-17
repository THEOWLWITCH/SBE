// בדיקת אמינות של מקורות: המרחב של הכיתה והצוות (credibility-join.html). בלי קוד Begood ובלי מעבר לכלים אחרים.
// סורקים QR של הכיתה ← פותחים צוות (שם, משתתפים והסכמה לכל אחד ואחת) או מצטרפים לצוות עם קוד הצוות ←
// בדיקת מקור בחמישה שלבים ← עמדה ורפלקציה. המפתח של הצוות נשמר בדפדפן (לפי קוד הכיתה).
(function () {
  'use strict';
  const M = window.SBE_CRED, U = window.SBE_CRD_UI, esc = M.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $('#app');
  const qs = new URLSearchParams(location.search);
  let classCode = (qs.get('c') || '').toUpperCase().trim();
  const S = { cred: null, data: null, open: null, tab: 'checks', busy: false, files: {}, timer: null };
  const credKey = (c) => 'sbe.crd.team.' + c;
  const loadCred = (c) => { try { return JSON.parse(localStorage.getItem(credKey(c)) || 'null'); } catch (e) { return null; } };
  const saveCred = (c, v) => { try { if (v) localStorage.setItem(credKey(c), JSON.stringify(v)); else localStorage.removeItem(credKey(c)); } catch (e) {} };
  const me = () => { try { return localStorage.getItem('sbe.crd.me.' + (S.cred && S.cred.t)) || ''; } catch (e) { return ''; } };
  const setMe = (v) => { try { localStorage.setItem('sbe.crd.me.' + S.cred.t, v); } catch (e) {} };
  const call = (op, input) => U.api(op, input, Object.assign({ by: me() || null }, S.cred));
  const auth = () => ({ page: 'credibility-join.html', crd: S.cred });
  const msg = (t, cls) => '<div class="dlm-msg' + (cls ? ' ' + cls : '') + '" role="' + (cls === 'err' ? 'alert' : 'status') + '">' + esc(t) + '</div>';
  const flash = (node, e) => { node.insertAdjacentHTML('afterbegin', msg(e.message || String(e), 'err')); };
  $('#aboutBtn').onclick = () => { const d = $('#dlg'); $('#dlgBody').innerHTML = M.aboutHTML(); d.showModal(); };
  $('#dlg').addEventListener('click', (e) => { if (e.target.hasAttribute('data-close') || e.target === $('#dlg')) $('#dlg').close(); });

  // ── כניסה ──
  async function start() {
    if (!classCode) {
      app.innerHTML = '<div class="dlm-card"><h1>בדיקת אמינות של מקורות</h1><p>אפשר לסרוק את ה־QR שהמרצה מציגה, או להקליד את קוד הכיתה.</p>'
        + '<label for="cc">קוד הכיתה</label><input type="text" id="cc" dir="ltr" autocomplete="off" style="max-width:14rem"> <button class="dlm-btn main" id="go">כניסה</button><div id="m"></div></div>';
      $('#go').onclick = () => { classCode = $('#cc').value.toUpperCase().trim(); if (classCode) { history.replaceState(null, '', '?c=' + classCode); start(); } };
      return;
    }
    const c = loadCred(classCode);
    if (c) { S.cred = c; return load(); }
    let info;
    try { info = await U.api('p.class', { code: classCode }); }
    catch (e) { app.innerHTML = msg(e.message, 'err') + '<p><button class="dlm-btn" id="other">קוד כיתה אחר</button></p>'; $('#other').onclick = () => { classCode = ''; start(); }; return; }
    if (info.pick) {
      $('#topTitle').textContent = info.pick.title;
      app.innerHTML = '<div class="dlm-card"><h1>' + esc(info.pick.title) + '</h1><h2>באיזו כיתה אני?</h2><p class="crd-pick">'
        + info.pick.classes.map((c) => '<button class="dlm-btn main" data-pick="' + esc(c.code) + '">' + esc(c.name) + '</button>').join('') + '</p></div>';
      app.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => { classCode = b.dataset.pick; history.replaceState(null, '', '?c=' + classCode); start(); }; });
      return;
    }
    const a = info.activity;
    $('#topTitle').textContent = a.title;
    app.innerHTML = '<div class="dlm-card"><h1>' + esc(a.title) + '</h1><p class="dlm-sub">' + esc(a.class.name) + '</p>'
      + (a.dilemma ? '<p><b>הדילמה:</b> ' + esc(a.dilemma) + '</p>' : '')
      + (a.status !== 'open' ? msg('הפעילות סגורה כרגע. המרצה תפתח אותה.') : '')
      + '<div class="dlm-grid2"><div class="dlm-card soft"><h2>הצוות שלנו כבר נפתח</h2><p class="dlm-hint">כל אחד ואחת מהצוות נכנס/ת עם קוד הצוות שמופיע אצל מי שפתח/ה אותו.</p>'
      + '<label for="tc">קוד הצוות</label><input type="text" id="tc" dir="ltr" autocomplete="off" maxlength="6" style="max-width:10rem"> <button class="dlm-btn main" id="join">הצטרפות לצוות</button><div id="jm"></div></div>'
      + '<div class="dlm-card soft"><h2>פתיחת צוות חדש</h2>' + (info.full ? '<p>בכיתה כבר יש 10 צוותים. אפשר להצטרף לצוות קיים עם קוד הצוות.</p>' : '<p class="dlm-hint">אחד/ת מהצוות פותח/ת, וכותב/ת את שמות כל המשתתפים.</p><button class="dlm-btn main" id="new">פתיחת צוות</button>') + '</div></div>'
      + (info.teams.length ? '<p class="dlm-hint">צוותים בכיתה: ' + info.teams.map((t) => esc(t.name)).join(' · ') + '</p>' : '') + '</div>';
    $('#join').onclick = async () => {
      try { const r = await U.api('p.teamJoin', { code: classCode, tcode: $('#tc').value }); S.cred = { a: r.a, t: r.t, key: r.key }; saveCred(classCode, S.cred); load(); }
      catch (e) { $('#jm').innerHTML = msg(e.message, 'err'); }
    };
    const nb = $('#new'); if (nb) nb.onclick = () => newTeam(info);
  }
  function memberRow(m, i) {
    const learn = m.consent === 'learning';
    return '<div class="crd-mrow" data-i="' + i + '"><input type="text" class="mn" aria-label="שם משתתף/ת ' + (i + 1) + '" placeholder="שם מלא" value="' + esc(m.name || '') + '">'
      + (learn ? '<span class="dlm-hint">סומן/ה בידי המנחה: רק ללמידה</span><input type="hidden" class="mlearn" value="1">'
        : '<label><input type="checkbox" class="msign"' + (m.consent === 'research' ? ' checked' : '') + '> ' + esc(M.CONSENT.research) + '</label>')
      + (m.id ? '<input type="hidden" class="mid" value="' + esc(m.id) + '">' : '') + '</div>';
  }
  const readMembers = (root) => [...root.querySelectorAll('.crd-mrow')].map((r) => ({ id: (r.querySelector('.mid') || {}).value, name: r.querySelector('.mn').value.trim(),
    consent: r.querySelector('.mlearn') ? 'learning' : ((r.querySelector('.msign') || {}).checked ? 'research' : '') }))
    .filter((m) => m.name || m.id);
  function consentHTML(a) {
    return '<details class="crd-consent" open><summary><b>' + esc(M.CONSENT.title) + '</b></summary>' + M.CONSENT.text.map((t) => '<p>' + esc(t) + '</p>').join('')
      + '<p class="dlm-hint">החוקרות: ' + esc(M.CONSENT.researchers) + (a.consent.ethics ? ' · אישור ועדת האתיקה: ' + esc(a.consent.ethics) : '') + (a.consent.contact ? ' · ליצירת קשר: ' + esc(a.consent.contact) : '') + '</p></details>';
  }
  function newTeam(info) {
    const rows = [{}, {}, {}, {}];
    app.innerHTML = '<div class="dlm-card"><h1>פתיחת צוות</h1>' + consentHTML(info.activity)
      + '<label for="tn">שם הצוות</label><input type="text" id="tn" maxlength="80" placeholder="למשל: צוות 3">'
      + '<h3>המשתתפים בצוות</h3><p class="dlm-hint">לכל משתתף/ת: שם, וחתימה על ההסכמה.</p>'
      + '<div id="mrows">' + rows.map(memberRow).join('') + '</div><p><button class="crd-link" id="addm">➕ משתתף/ת נוסף/ת</button></p>'
      + '<p><button class="dlm-btn main" id="save">פתיחת הצוות</button> <button class="dlm-btn" id="back">חזרה</button></p><div id="m"></div></div>';
    $('#addm').onclick = () => { const n = $('#mrows').children.length; if (n < 8) $('#mrows').insertAdjacentHTML('beforeend', memberRow({}, n)); };
    $('#back').onclick = start;
    $('#save').onclick = async () => {
      const members = readMembers($('#mrows'));
      if (members.some((m) => !m.consent)) { $('#m').innerHTML = msg('כדי לפתוח את הצוות, כל משתתף/ת חותם/ת על ההסכמה.', 'err'); return; }
      try {
        const r = await U.api('p.teamCreate', { code: classCode, name: $('#tn').value, members });
        S.cred = { a: r.a, t: r.t, key: r.key }; saveCred(classCode, S.cred);
        await U.say('הצוות נפתח. קוד הצוות: ' + r.team.code + '\nשאר חברי הצוות נכנסים עם הקוד הזה, מהמכשיר שלהם.');
        load();
      } catch (e) { $('#m').innerHTML = msg(e.message, 'err'); }
    };
  }

  // ── מרחב הצוות ──
  async function load(quiet) {
    try { S.data = await call('p.get'); }
    catch (e) {
      if (e.status === 401 || e.status === 404) { saveCred(classCode, null); S.cred = null; return start(); }
      if (!quiet) app.innerHTML = msg(e.message, 'err'); return;
    }
    if (!quiet || !S.busy) render();
    clearInterval(S.timer); S.timer = setInterval(() => { if (!S.busy && !document.hidden && !document.querySelector('dialog[open]') && !isTyping()) load(true); }, 12000);
  }
  const isTyping = () => { const el = document.activeElement; return el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.value; };
  function render() {
    const D = S.data, t = D.team;
    $('#topTitle').textContent = D.activity.title;
    const who = me();
    const head = '<div class="dlm-card crd-team"><div class="dlm-row" style="justify-content:space-between"><div><h1>' + esc(t.name) + '</h1><div class="dlm-hint">' + esc(D.activity.class.name) + ' · קוד הצוות: <b dir="ltr">' + esc(t.code) + '</b></div></div>'
      + '<div><label for="who">מי עובד/ת עכשיו במכשיר הזה?</label><select id="who" data-closed><option value="">בחירה</option>' + t.members.map((m) => '<option value="' + esc(m.id) + '"' + (who === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') + '</select></div></div>'
      + (D.activity.dilemma ? '<p><b>הדילמה:</b> ' + esc(D.activity.dilemma) + '</p>' : '')
      + (D.activity.status !== 'open' ? msg('הפעילות סגורה כרגע: אפשר לצפות, אבל לא לשנות.') : '')
      + '<div class="dlm-steps" role="tablist">' + [['checks', 'בדיקת מקורות'], ['reflect', 'עמדה ורפלקציה'], ['team', 'הצוות'], ['scale', 'המחוון']].map((x) => '<button type="button" role="tab" data-tab="' + x[0] + '"' + (S.tab === x[0] ? ' aria-current="step"' : '') + '>' + x[1] + '</button>').join('') + '</div></div>';
    let body = '';
    const missingPre = t.members.filter((m) => !(D.reflections[m.id] || {}).pre);
    const myPreDone = me() && !missingPre.some((m) => m.id === me()) && t.members.some((m) => m.id === me());
    if (S.tab === 'checks') body = missingPre.length && !(t.workOpen && myPreDone) ? preView(missingPre) : (S.open ? checkView(D.checks.find((k) => k.id === S.open)) : checksList());
    else if (S.tab === 'reflect') body = reflectView();
    else if (S.tab === 'team') body = teamView();
    else body = '<div class="dlm-card">' + M.aboutHTML() + '</div>';
    app.innerHTML = head + '<div id="body">' + body + '</div>';
    $('#who').onchange = (e) => { setMe(e.target.value); };
    app.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { S.tab = b.dataset.tab; S.open = null; render(); }; });
    bind();
  }
  // שאלון עמדות: כל היגד בשורה, סולם 1–5
  function attForm(pfx, vals) {
    vals = vals || {};
    return '<div class="crd-att"><div class="crd-att-head" aria-hidden="true"><span class="crd-att-hq"></span><div class="crd-att-o">' + M.ATT_SCALE.map((o) => '<span class="crd-att-hl">' + esc(o[1]) + '</span>').join('') + '</div></div>' + M.ATTITUDES.map((q, i) => '<fieldset class="crd-att-q"><legend><span class="crd-att-n">' + (i + 1) + '</span> ' + esc(q.t) + '</legend><div class="crd-att-o">'
      + M.ATT_SCALE.map((o) => '<label title="' + esc(o[1]) + '"><input type="radio" name="' + pfx + q.k + '" value="' + o[0] + '"' + (String(vals[q.k]) === String(o[0]) ? ' checked' : '') + '><span>' + o[0] + '</span><i class="crd-att-sr">' + esc(o[1]) + '</i></label>').join('')
      + '</div></fieldset>').join('')
      + '</div>';
  }
  const readAtt = (pfx) => { const r = {}; for (const q of M.ATTITUDES) { const c = app.querySelector('input[name="' + pfx + q.k + '"]:checked'); if (!c) return null; r[q.k] = Number(c.value); } return r; };
  function preView(missing) {
    const t = S.data.team, done = t.members.filter((m) => (S.data.reflections[m.id] || {}).pre);
    const isMiss = (id) => missing.some((m) => m.id === id);
    const mine = me() && !isMiss(me()) && t.members.find((m) => m.id === me());
    const sel = isMiss(S.pm) ? S.pm : isMiss(me()) ? me() : (!mine && missing.length === 1 ? missing[0].id : '');
    return '<div class="dlm-card"><h2>' + esc(M.ATT.pre) + '</h2>'
      + '<p>לפני שמתחילים לבדוק מקורות, כל משתתף/ת ממלא/ת שאלון עמדות אישי קצר. עבודת הצוות נפתחת אחרי שכולם מילאו.</p>'
      + '<p class="dlm-hint">' + esc(M.ATT.note) + '</p>'
      + (mine && !t.workOpen ? '<div class="dlm-msg">✓ השאלון של ' + esc(mine.name) + ' נשמר. עוד לא מילאו: ' + missing.map((m) => esc(m.name)).join(', ') + '.</div><p><button class="dlm-btn main" id="openWork">פתיחת אזור העבודה</button></p><p class="dlm-hint">אזור העבודה נפתח לכל הצוות. מי שעוד לא מילא/ה את השאלון ממלא/ת אותו כשנכנס/ת מהמכשיר שלו/ה.</p>' : '')
      + (done.length && !(mine && !t.workOpen) ? (t.workOpen ? '<p>אזור העבודה פתוח. כבר מילאת? לוחצים על השם: ' + done.map((m) => '<button type="button" class="crd-link" data-pme="' + esc(m.id) + '">' + esc(m.name) + ' ✓</button>').join(' · ') + '</p>' : '<p class="dlm-hint">כבר מילאו: ' + done.map((m) => esc(m.name) + ' ✓').join(' · ') + '</p>') : '')
      + (missing.length > 1 || !sel ? '<p class="crd-pre-who">' + (mine ? 'ממלאים עכשיו במכשיר הזה בשם אחר? ' : done.length ? 'עוד לא מילאו. מי ממלא/ת עכשיו? ' : 'מי ממלא/ת עכשיו? ') + missing.map((m) => '<button type="button" class="crd-link" data-pm="' + esc(m.id) + '"' + (sel === m.id ? ' aria-pressed="true"' : '') + '>' + esc(m.name) + '</button>').join(' · ') + '</p>' : '')
      + (sel ? '<h3>השאלון של ' + esc((t.members.find((m) => m.id === sel) || {}).name || '') + '</h3><input type="hidden" id="pm" value="' + esc(sel) + '">' + attForm('pre-') + '<label for="pi" class="crd-ini-h">' + esc(M.INITIAL.t) + ' <span class="crd-req">(שדה עיקרי)</span> <span class="crd-min">' + esc(M.REFLECT_MIN) + '</span></label><textarea id="pi" rows="5"></textarea>'
        + '<p><button class="dlm-btn main" id="savePre">שליחת השאלון</button></p>' : '')
      + '<div id="pmm"></div></div>';
  }
  function checksList() {
    const ks = S.data.checks;
    return '<div class="dlm-card"><h2>המקורות שאנחנו בודקים</h2>'
      + (ks.length ? '<div class="crd-list">' + ks.map((k) => '<button type="button" class="crd-item" data-open="' + esc(k.id) + '"><b>' + esc(k.title || 'מקור') + '</b>' + U.scoresRow(k) + '<span class="dlm-hint">' + stageLabel(k) + '</span></button>').join('') + '</div>'
        : '<p>עוד לא התחלנו. מעלים מקור (קובץ או קישור) ולוחצים על "בדיקת אמינות באמצעות AI".</p>')
      + '<h3>➕ מקור חדש לבדיקה</h3><div class="dlm-grid2"><div><label for="nf">העלאת קובץ</label><input type="file" id="nf" accept="image/*,application/pdf,text/plain,audio/*,video/*">'
      + '<p class="dlm-hint">תמונה, צילום מסך, PDF, טקסט, הקלטה או וידאו קצר.</p></div><div><label for="nu">או קישור</label><input type="url" id="nu" dir="ltr" placeholder="https://"></div></div>'
      + '<label for="nt">שם קצר למקור (רשות)</label><input type="text" id="nt" placeholder="למשל: הפוסט על הנתונים המזויפים">'
      + '<p><button class="dlm-btn main" id="addk">התחלת בדיקה</button></p><div id="km"></div></div>';
  }
  function stageLabel(k) {
    if (k.final) return 'הבדיקה הושלמה';
    if (k.team) return 'מחכה להערכה החוזרת של ה־AI';
    if (k.done) return 'מחכה לציון של הצוות';
    if (k.first) return 'בחקירה';
    return 'מתחילים: תיאור המקור';
  }
  const STAGES = [['describe', '1. תיאור המקור'], ['first', '2. בדיקה עם AI'], ['inquiry', '3. ממשיכים לחקור'], ['team', '4. הציון שלנו'], ['final', '5. הערכה חוזרת']];
  function stageOf(k) { return k.final ? 'final' : k.team ? 'final' : k.done ? 'team' : k.first ? 'inquiry' : (k.fields && k.fields.claim) ? 'first' : 'describe'; }
  function checkView(k) {
    if (!k) { S.open = null; return checksList(); }
    const st = S.stage && S.stageFor === k.id ? S.stage : stageOf(k);
    const reach = { describe: true, first: !!(k.fields && k.fields.claim) || !!k.first, inquiry: !!k.first, team: !!k.done, final: !!k.team };
    const nav = '<div class="dlm-steps crd-steps">' + STAGES.map((s) => '<button type="button" data-stage="' + s[0] + '"' + (st === s[0] ? ' aria-current="step"' : '') + (reach[s[0]] ? '' : ' disabled') + '>' + s[1] + '</button>').join('') + '</div>';
    const src = '<div class="crd-src"><b>' + esc(k.title) + '</b>' + (k.url ? ' · <a href="' + esc(k.url) + '" target="_blank" rel="noopener noreferrer" dir="ltr">' + esc(k.url.slice(0, 60)) + '</a>' : '')
      + (k.fileId ? ' · <button type="button" class="crd-link" data-file="' + esc(k.fileId) + '">פתיחת הקובץ</button>' : '')
      + (k.verify ? ' <span class="dlm-tag">' + esc({ exists: 'הקישור נפתח', not_found: 'הקישור לא נמצא', unreachable: 'הקישור לא נפתח' }[k.verify.status] || '') + '</span>' : '') + U.scoresRow(k) + '</div>';
    let inner = '';
    if (st === 'describe') inner = describeHTML(k);
    else if (st === 'first') inner = '<h3>בדיקת אמינות באמצעות AI</h3>' + (k.first ? U.assessHTML(k.first, 'ההערכה הראשונה של ה־AI') + '<p><button class="dlm-btn" data-ai="first">בדיקה מחדש</button> <button class="dlm-btn main" data-stage="inquiry">ממשיכים לחקור ←</button></p>'
      : '<p>ה־AI יקרא את המקור ואת התיאור שלכם, ויחזיר ציון 1–5, הסבר, ומה כדאי לבדוק.</p><p><button class="dlm-btn main" data-ai="first">בדיקת אמינות באמצעות AI</button></p>');
    else if (st === 'inquiry') inner = inquiryHTML(k);
    else if (st === 'team') inner = teamScoreHTML(k);
    else inner = finalHTML(k);
    return '<div class="dlm-card"><p><button class="crd-link" id="backList">לכל המקורות</button></p>' + src + nav + '<div id="stage">' + inner + '</div><div id="sm"></div></div>';
  }
  function describeHTML(k) {
    const f = k.fields || {};
    return '<h3>מה ידוע לנו על המקור?</h3><p class="dlm-hint">ה־AI יכול למלא את מה שרואים במקור, ואתם משלימים ומתקנים. מה שלא ידוע: כותבים "לא ידוע".</p>'
      + '<p><button class="dlm-btn" data-ai="fields">✨ הכנת הסעיפים עם AI</button></p>' + (k.seen ? '<p class="crd-seen"><b>מה ה־AI ראה במקור:</b> ' + esc(k.seen) + '</p>' : '')
      + '<label for="ft">שם המקור</label><input type="text" id="ft" value="' + esc(k.title) + '">'
      + M.FIELDS.map((x) => '<label for="f-' + x.k + '">' + esc(x.t) + (x.k === 'claim' ? ' (שדה עיקרי)' : '') + '</label><textarea id="f-' + x.k + '" rows="2" placeholder="' + esc(x.ph) + '">' + esc(f[x.k] || '') + '</textarea>').join('')
      + (k.extra || []).map((x, i) => '<label for="fx-' + i + '">' + esc(x.t) + '</label><textarea id="fx-' + i + '" rows="2" data-t="' + esc(x.t) + '" data-ph="' + esc(x.ph || '') + '" placeholder="' + esc(x.ph || '') + '">' + esc(x.v || '') + '</textarea>').join('')
      + '<p><button class="dlm-btn main" id="saveFields">שמירה וממשיכים ←</button></p>';
  }
  function inquiryHTML(k) {
    const chat = (k.chat || []).map((m) => '<div class="crd-msg ' + (m.role === 'ai' ? 'ai' : 'me') + '"><b>' + (m.role === 'ai' ? 'AI' : esc(nameOf(m.by) || 'הצוות')) + '</b><div>' + esc(m.text).replace(/\n/g, '<br>') + '</div></div>').join('');
    const ext = (k.external || []).map((e) => '<li><b>' + esc(e.title || e.url) + '</b>' + (e.url ? ' · <a href="' + esc(e.url) + '" target="_blank" rel="noopener noreferrer" dir="ltr">קישור</a>' : '') + ' · ' + esc((M.EXT_KINDS.find((x) => x.k === e.kind) || {}).t || '')
      + (e.verify ? ' <span class="dlm-tag">' + esc({ exists: 'נפתח', not_found: 'לא נמצא', unreachable: 'לא נפתח' }[e.verify.status] || '') + '</span>' : '') + '<br>' + esc(e.found)
      + (k.done ? '' : ' <button type="button" class="crd-link" data-extdel="' + esc(e.id) + '" aria-label="הסרה">✕</button>') + '</li>').join('');
    return '<h3>ממשיכים לחקור</h3><p class="dlm-hint">ה־AI ישלח אתכם לבדוק במקורות חיצוניים. כל מה שמצאתם, כותבים כאן. הבדיקה נמשכת עד שאתם קובעים: אין לנו יותר מידע.</p>'
      + '<details><summary>ההערכה הראשונה של ה־AI</summary>' + U.assessHTML(k.first, 'ההערכה הראשונה') + '</details>'
      + '<div class="crd-chat" id="chat">' + (chat || '<p class="dlm-hint">אפשר להתחיל: "מאיפה כדאי להתחיל?", או לכתוב מה כבר מצאתם.</p>') + '</div>'
      + (k.done ? '' : '<div class="crd-say"><textarea id="say" rows="2" placeholder="מה מצאתם, או מה תרצו לשאול?"></textarea><button class="dlm-btn main" id="send">שליחה</button></div>')
      + '<h3>מקורות חיצוניים שמצאנו (' + (k.external || []).length + ')</h3>' + (ext ? '<ol class="crd-ext">' + ext + '</ol>' : '<p class="dlm-hint">עוד לא נוספו. הצלבה עם מקורות עצמאיים היא הלב של הבדיקה.</p>')
      + (k.done ? '' : '<details class="crd-addext"' + ((k.external || []).length ? '' : ' open') + '><summary><b>➕ הוספת מקור שמצאנו</b></summary><div class="dlm-grid2"><div><label for="eu">קישור</label><input type="url" id="eu" dir="ltr" placeholder="https://"></div><div><label for="et">שם המקור</label><input type="text" id="et" placeholder="למשל: אתר הכנסת, פסק הדין"></div></div>'
        + '<label for="ek">סוג המקור</label><select id="ek" data-closed>' + M.EXT_KINDS.map((x) => '<option value="' + x.k + '">' + esc(x.t) + '</option>').join('') + '</select>'
        + '<label for="ef">מה מצאנו, ומה זה אומר על הטענה?</label><textarea id="ef" rows="2"></textarea><p><button class="dlm-btn" id="addext">הוספה</button></p></details>')
      + (k.done ? '<p>' + msg('קבעתם: אין לנו יותר מידע.') + ' <button class="crd-link" id="reopen">ממשיכים לחקור</button> <button class="dlm-btn main" data-stage="team">לציון שלנו ←</button></p>'
        : '<p class="crd-donebar"><button class="dlm-btn main" id="done">✋ אין לנו יותר מידע</button></p>');
  }
  function teamScoreHTML(k) {
    const sc = k.team ? k.team.score : null;
    return '<h3>הציון שלנו</h3><p class="dlm-hint">הציון ניתן למקור בהקשר של הטענה. כדאי לעבור על עשר השאלות במחוון לפני שמחליטים.</p>'
      + '<div class="crd-pick" role="radiogroup" aria-label="הציון של הצוות">' + M.SCALE.map((l) => '<label class="crd-opt"><input type="radio" name="ts" value="' + l.score + '"' + (sc === l.score ? ' checked' : '') + (k.final ? ' disabled' : '') + '>' + M.dotHTML(l.score) + '<span><b>' + esc(l.name) + '</b><br>' + esc(l.d) + '</span></label>').join('') + '</div>'
      + '<label for="tw">הנימוק שלנו (שדה עיקרי)</label><textarea id="tw" rows="3" placeholder="על אילו ראיות הציון נשען, ומה עדיין לא ידוע"' + (k.final ? ' disabled' : '') + '>' + esc(k.team ? k.team.why : '') + '</textarea>'
      + '<label for="tb">במה אנחנו מסכימים או חולקים על ה־AI?</label><textarea id="tb" rows="2"' + (k.final ? ' disabled' : '') + '>' + esc(k.team ? k.team.basis : '') + '</textarea>'
      + (k.final ? '' : '<p><button class="dlm-btn main" id="saveTeam">שמירת הציון שלנו ←</button></p>');
  }
  function finalHTML(k) {
    return '<h3>הערכה חוזרת של ה־AI</h3>' + (k.final ? U.assessHTML(k.final, 'ההערכה החוזרת של ה־AI') + '<h4>שלושת הציונים</h4>' + U.scoresRow(k) + '<p class="dlm-hint">אפשר לדבר בצוות: מה גרם להבדלים? מה הייתם עושים אחרת?</p>'
      : '<p>ה־AI יקרא את כל מה שמצאתם ואת הציון והנימוק שלכם, וייתן הערכה חוזרת.</p><p><button class="dlm-btn main" data-ai="final">הערכה חוזרת של ה־AI</button></p>');
  }
  const nameOf = (id) => ((S.data.team.members.find((m) => m.id === id) || {}).name || '');

  const reflectReady = () => !!(S.data.activity.reflectOpen || (S.data.checks || []).some((k) => k.final));
  function reflectView() {
    const t = S.data.team, sel = S.rm || me();
    const m = t.members.find((x) => x.id === sel);
    const st = m ? S.data.reflections[m.id] || {} : {};
    let local = {}; try { local = JSON.parse(localStorage.getItem('sbe.crd.refl.' + S.cred.t + '.' + sel) || '{}'); } catch (e) {}
    if (!local.initial && st.initial && st.initial.text) local.initial = st.initial.text;
    const r = local.reflect || (st.reflect && typeof st.reflect === 'object' ? st.reflect : {});
    return '<div class="dlm-card"><h2>עמדה ורפלקציה</h2><p class="dlm-hint">כל אחד ואחת כותב/ת את הרפלקציה בעצמו/ה. הרפלקציה משותפת עם הצוות, וה־AI מנתח אותה לפי קריטריונים שנקבעו מראש.</p>'
      + (m ? '<input type="hidden" id="rm" value="' + esc(m.id) + '"><p class="crd-pre-who">' + esc(m.name) + ' · <button type="button" class="crd-link" data-rmx="1">לא ' + esc(m.name) + '? בחירת שם אחר</button></p>' : '<p class="crd-pre-who">מי כותב/ת עכשיו? ' + t.members.map((x) => '<button type="button" class="crd-link" data-rmp="' + esc(x.id) + '">' + esc(x.name) + ((S.data.reflections[x.id] || {}).reflect ? ' ✓' : '') + '</button>').join(' · ') + '</p>')
      + (!m ? '' : (st.initial && st.initial.text ? '<h3>' + esc(M.INITIAL.h) + '</h3><p class="crd-quote">' + esc(st.initial.text) + '</p>' : '')
        + (!reflectReady() ? '<div class="dlm-msg">הרפלקציה ושאלון העמדות המסכם נפתחים בסיום התרגיל: אחרי שבדיקה של מקור אחד לפחות מגיעה להערכה החוזרת (שלב 5).</div>' : '<h3>' + esc(M.ATT.post) + ' <span class="crd-req">(שדה עיקרי)</span>' + (st.post ? ' ✓ נשלח' : '') + '</h3><p class="dlm-hint">אותם היגדים כמו בהתחלה, כדי לראות אם משהו השתנה. התשובות האישיות לא מוצגות לצוות.</p>'
        + attForm('post-')
        + '<h3>רפלקציה' + (st.reflect ? ' ✓ נשלחה' : '') + '</h3><p class="dlm-hint">' + esc(M.REFLECT_NOTE) + '</p>'
        + M.REFLECT.map((q) => q.opts ? '<fieldset class="crd-fs"><legend>' + esc(q.t) + '</legend>' + q.opts.map((o) => '<label><input type="radio" name="rf-' + q.k + '" value="' + o[0] + '"' + (r[q.k] === o[0] ? ' checked' : '') + '> ' + esc(o[1]) + '</label>').join(' ') + '</fieldset>'
          : '<div class="crd-q" data-when="' + esc((q.when || []).join(',')) + '"><label for="rf-' + q.k + '">' + esc(q.t) + ' <span class="crd-min">' + esc(M.REFLECT_MIN) + '</span></label><textarea id="rf-' + q.k + '" rows="3" placeholder="' + esc(q.ph || '') + '">' + esc(r[q.k] || '') + '</textarea></div>').join('')
        + '<p><button class="dlm-btn main" id="saveRefl">שליחת השאלון והרפלקציה</button></p>')) + '<div id="rmm"></div></div>'
      + teamReflections();
  }
  // הרפלקציות של הצוות, עם ניתוח ה־AI לפי הקריטריונים
  function teamReflections() {
    const t = S.data.team, done = t.members.filter((m) => (S.data.reflections[m.id] || {}).reflect);
    if (!done.length) return '';
    return '<div class="dlm-card"><h2>הרפלקציות של הצוות</h2>' + done.map((m) => {
      const st = S.data.reflections[m.id], r = st.reflect || {};
      const ans = M.REFLECT.filter((q) => r[q.k]).map((q) => '<p><b>' + esc(q.t) + '</b> ' + esc(q.opts ? ((q.opts.find((o) => o[0] === r[q.k]) || [, r[q.k]])[1]) : r[q.k]) + '</p>').join('');
      return '<details class="dlm-card soft" open><summary><b>' + esc(m.name) + '</b>' + (st.ai ? ' · נותחה' : '') + '</summary>' + ans + reflectAIHTML(st.ai, m.id) + '</details>';
    }).join('') + '</div>';
  }
  function reflectAIHTML(ai, id) {
    if (!ai) return '<p><button class="crd-link" data-rai="' + esc(id) + '">ניתוח ה־AI לפי הקריטריונים</button></p>';
    return '<div class="crd-assess"><h4>ניתוח ה־AI לפי הקריטריונים</h4><table class="rtable crd-rt"><thead><tr><th>הקריטריון</th><th>עולה ברפלקציה?</th><th>מה נכתב</th></tr></thead><tbody>'
      + M.REFLECT_CRITERIA.map((c) => { const x = (ai.criteria || []).find((y) => y.k === c.k) || {}; return '<tr><td>' + esc(c.t) + '</td><td class="ck">' + (x.found ? '✓' : '○') + '</td><td>' + esc(x.note || '') + '</td></tr>'; }).join('')
      + '</tbody></table>' + (ai.strength ? '<p><b>מה חזק:</b> ' + esc(ai.strength) + '</p>' : '') + (ai.question ? '<p><b>שאלה להעמקה:</b> ' + esc(ai.question) + '</p>' : '')
      + '<p class="dlm-hint">הניתוח של ה־AI הוא הצעה לקריאה, והוא יכול לטעות.</p><p><button class="crd-link" data-rai="' + esc(id) + '">ניתוח מחדש</button></p></div>';
  }
  async function analyzeReflection(id) {
    const st = S.data.reflections[id] || {};
    if (!st.reflect) return;
    const checks = (S.data.checks || []).map((k) => (k.title || 'מקור') + ': ' + [k.first && k.first.score, k.team && k.team.score, k.final && k.final.score].map((v) => v || '-').join('/')).join('; ');
    const ctx = { dilemma: S.data.activity.dilemma, initial: st.initial && st.initial.text, reflect: st.reflect, checks };
    const stop = waiting('ה־AI מנתח את הרפלקציה. זה נמשך כ־20 שניות.');
    try {
      const out = M.cleanReflectAI(M.parseJSON(await U.model(M.reflectSystem(), M.reflectText(ctx), auth(), 1500)));
      if (!out) throw new Error('הניתוח לא נקרא. אפשר לנסות שוב.');
      await call('p.reflect', { member: id, ai: out });
      st.ai = { criteria: out.criteria, strength: out.strength, question: out.question };
    } finally { stop(); }
  }
  function teamView() {
    const t = S.data.team;
    return '<div class="dlm-card"><h2>הצוות</h2><p>קוד הצוות: <b dir="ltr" class="dlm-code">' + esc(t.code) + '</b>. כל אחד ואחת מהצוות נכנס/ת עם הקוד הזה ועם קוד הכיתה, מהמכשיר שלו/ה.</p>'
      + '<label for="tn2">שם הצוות</label><input type="text" id="tn2" value="' + esc(t.name) + '">'
      + '<div id="mrows">' + t.members.map(memberRow).join('') + '</div><p><button class="crd-link" id="addm">➕ משתתף/ת נוסף/ת</button></p>'
      + '<p><button class="dlm-btn main" id="saveTeamM">שמירה</button></p><div id="tm"></div>'
      + '<p class="dlm-hint">יציאה מהצוות במכשיר הזה: <button class="crd-link" id="leave">יציאה</button></p></div>';
  }

  // ── פעולות ──
  async function act(fn, node) {
    if (S.busy) return; S.busy = true;
    try { await fn(); } catch (e) { flash(node || $('#sm') || app, e); } finally { S.busy = false; }
  }
  async function saveCheck(kind, input) {
    const r = await call('p.check', Object.assign({ kind }, input));
    if (r.check) { const i = S.data.checks.findIndex((x) => x.id === r.check.id); if (i >= 0) S.data.checks[i] = r.check; else S.data.checks.push(r.check); }
    return r;
  }
  async function fileFor(k) {
    if (!k.fileId) return null;
    if (!S.files[k.fileId]) S.files[k.fileId] = await call('p.file', { fid: k.fileId });
    return S.files[k.fileId];
  }
  // התוכן שנשלח למודל: טקסט, ותמונה או PDF כשיש
  async function userContent(k, text) {
    const f = await fileFor(k);
    if (f && /^image\//.test(f.type)) return [{ type: 'text', text }, { type: 'image', source: { type: 'base64', media_type: f.type, data: f.data } }];
    if (f && f.type === 'application/pdf') return [{ type: 'text', text }, { type: 'document', source: { type: 'base64', media_type: f.type, data: f.data } }];
    return text;
  }
  async function fileText(k) {
    const f = await fileFor(k);
    if (f && f.type === 'text/plain') { try { return new TextDecoder().decode(Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))); } catch (e) {} }
    return '';
  }
  const ctxOf = async (k) => ({ dilemma: S.data.activity.dilemma, source: k, fields: k.fields, extra: k.extra, seen: k.seen, text: await fileText(k), first: k.first, chat: k.chat, external: k.external, doneNote: k.done && k.done.note, team: k.team });
  function waiting(text) { const n = $('#stage') || $('#rmm'); if (n) n.insertAdjacentHTML('beforeend', '<div class="dlm-msg crd-wait" role="status">' + esc(text) + ' <span class="crd-sec">0</span></div>'); const t0 = Date.now(); const iv = setInterval(() => { const s = document.querySelector('.crd-sec'); if (s) s.textContent = 'חלפו ' + Math.round((Date.now() - t0) / 1000) + ' שניות'; else clearInterval(iv); }, 1000); return () => clearInterval(iv); }
  async function runAI(k, what) {
    const ctx = await ctxOf(k);
    const stop = waiting(what === 'fields' ? 'ה־AI קורא את המקור. זה נמשך כ־20 שניות.' : what === 'chat' ? 'ה־AI עונה.' : 'ה־AI בודק את המקור. זה נמשך עד כדקה.');
    try {
      if (what === 'fields') {
        const out = M.cleanFields(M.parseJSON(await U.model(M.fieldsSystem(), await userContent(k, M.sourceText(ctx)), auth(), 1500)));
        if (!out) throw new Error('התשובה של ה־AI לא נקראה. אפשר לנסות שוב.');
        const f = Object.assign({}, k.fields || {}); for (const x of M.FIELDS) if (!f[x.k] && out.fields[x.k]) f[x.k] = out.fields[x.k];
        await saveCheck('fields', { id: k.id, fields: f, extra: out.extra.map((x) => ({ t: x.t, ph: x.ph, v: ((k.extra || []).find((y) => y.t === x.t) || {}).v || '' })), seen: out.seen });
      } else if (what === 'first' || what === 'final') {
        const text = M.sourceText(ctx) + (what === 'final' ? '\n\n' + M.inquiryText(ctx) : '');
        const out = M.cleanAssess(M.parseJSON(await U.model(M.assessSystem(what), await userContent(k, text), auth(), 2200)), what);
        if (!out) throw new Error('התשובה של ה־AI לא נקראה. אפשר לנסות שוב.');
        await saveCheck('ai', { id: k.id, stage: what, result: out });
        if (what === 'first' && !(k.chat || []).length) S.stage = 'first';
      } else if (what === 'chat') {
        const text = M.sourceText(ctx) + '\n\n' + M.inquiryText(ctx);
        const reply = M.cleanChat(await U.model(M.chatSystem(), text, auth(), 900));
        if (!reply) throw new Error('אין תשובה. אפשר לנסות שוב.');
        await saveCheck('msg', { id: k.id, role: 'ai', text: reply });
      }
    } finally { stop(); }
  }
  function bind() {
    const k = S.open && S.data.checks.find((x) => x.id === S.open);
    const on = (sel, fn) => { const n = $(sel); if (n) n.onclick = fn; };
    app.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => { S.open = b.dataset.open; S.stage = null; render(); }; });
    app.querySelectorAll('[data-stage]').forEach((b) => { b.onclick = () => { S.stage = b.dataset.stage; S.stageFor = S.open; render(); }; });
    app.querySelectorAll('[data-file]').forEach((b) => { b.onclick = () => act(async () => U.showFile(await fileFor(k))); });
    app.querySelectorAll('[data-ai]').forEach((b) => { b.onclick = () => act(async () => { b.disabled = true; await runAI(k, b.dataset.ai); S.stage = b.dataset.ai === 'fields' ? 'describe' : b.dataset.ai; S.stageFor = k.id; render(); }); });
    app.querySelectorAll('[data-extdel]').forEach((b) => { b.onclick = () => act(async () => { await saveCheck('extDel', { id: k.id, extId: b.dataset.extdel }); render(); }); });
    on('#backList', () => { S.open = null; render(); });
    on('#addk', () => act(async () => {
      const f = $('#nf').files[0], url = $('#nu').value.trim(), title = $('#nt').value.trim();
      if (!f && !url) throw new Error('אפשר להעלות קובץ או להדביק קישור.');
      let fileId = '', fileName = '', fileType = '';
      if (f) {
        $('#km').innerHTML = msg('מעלים את הקובץ…');
        const small = await U.shrinkImage(f);
        const up = await call('p.upload', { data: small || await U.readFile(f), type: small ? 'image/jpeg' : f.type, name: f.name });
        fileId = up.fid; fileName = f.name; fileType = small ? 'image/jpeg' : f.type;
      }
      const r = await saveCheck('new', { url, title, fileId, fileName, fileType });
      S.open = r.id; S.stage = 'describe'; S.stageFor = r.id; render();
    }, $('#km')));
    on('#saveFields', () => act(async () => {
      const fields = {}; for (const x of M.FIELDS) fields[x.k] = $('#f-' + x.k).value;
      if (!fields.claim.trim()) throw new Error('אפשר לנסח את הטענה במשפט אחד. זה השדה העיקרי.');
      const extra = [...app.querySelectorAll('[id^=fx-]')].map((n) => ({ t: n.dataset.t, ph: n.dataset.ph, v: n.value }));
      await saveCheck('fields', { id: k.id, fields, extra, title: $('#ft').value || k.title });
      S.stage = 'first'; S.stageFor = k.id; render();
    }));
    on('#send', () => act(async () => {
      const v = $('#say').value.trim(); if (!v) return;
      await saveCheck('msg', { id: k.id, role: 'team', text: v }); render();
      await runAI(S.data.checks.find((x) => x.id === k.id), 'chat'); render(); scrollChat();
    }));
    const say = $('#say'); if (say) say.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#send').click(); } });
    on('#addext', () => act(async () => {
      const url = $('#eu').value.trim(), title = $('#et').value.trim(), found = $('#ef').value.trim();
      if (!found) throw new Error('אפשר לכתוב מה מצאתם במקור הזה.');
      await saveCheck('ext', { id: k.id, url, title, extKind: $('#ek').value, found });
      // ה־AI מגיב למקור החדש ושולח לבדיקה הבאה
      const kk = S.data.checks.find((x) => x.id === k.id);
      await saveCheck('msg', { id: k.id, role: 'team', text: 'הוספנו מקור: ' + (title || url) + '. מה מצאנו: ' + found });
      render(); await runAI(S.data.checks.find((x) => x.id === kk.id), 'chat'); render(); scrollChat();
    }));
    on('#done', () => act(async () => {
      const n = (k.external || []).length;
      const ok = await U.ask(n ? 'לקבוע שאין לכם יותר מידע? אחרי זה נותנים ציון.' : 'עוד לא הוספתם אף מקור חיצוני. הצלבה היא הלב של הבדיקה.\nלקבוע בכל זאת שאין לכם יותר מידע?', { ok: 'כן, אין לנו יותר מידע', no: 'ממשיכים לחקור' });
      if (!ok) return;
      await saveCheck('done', { id: k.id }); S.stage = 'team'; S.stageFor = k.id; render();
    }));
    on('#reopen', () => act(async () => { await saveCheck('reopen', { id: k.id }); S.stage = 'inquiry'; S.stageFor = k.id; render(); }));
    on('#saveTeam', () => act(async () => {
      const s = (app.querySelector('input[name=ts]:checked') || {}).value;
      if (!s) throw new Error('אפשר לבחור ציון מ־1 עד 5.');
      if (!$('#tw').value.trim()) throw new Error('אפשר לכתוב נימוק: על אילו ראיות הציון נשען.');
      await saveCheck('team', { id: k.id, score: Number(s), why: $('#tw').value, basis: $('#tb').value }); S.stage = 'final'; S.stageFor = k.id; render();
    }));
    // רפלקציה
    app.querySelectorAll('[data-rmp]').forEach((x) => { x.onclick = () => { S.rm = x.dataset.rmp; setMe(x.dataset.rmp); render(); }; });
    app.querySelectorAll('[data-rmx]').forEach((x) => { x.onclick = () => { S.rm = '-'; render(); }; });
    const toggleWhen = () => { const v = (app.querySelector('input[name=rf-changed]:checked') || {}).value || ''; app.querySelectorAll('.crd-q[data-when]').forEach((q) => { const w = q.dataset.when; q.hidden = !!w && !w.split(',').includes(v); }); };
    app.querySelectorAll('input[name=rf-changed]').forEach((r) => { r.onchange = toggleWhen; }); toggleWhen();
    const lk = () => 'sbe.crd.refl.' + S.cred.t + '.' + $('#rm').value;
    const keepLocal = (patch) => { try { const cur = JSON.parse(localStorage.getItem(lk()) || '{}'); localStorage.setItem(lk(), JSON.stringify(Object.assign(cur, patch))); } catch (e) {} };
    app.querySelectorAll('[data-pm]').forEach((x) => { x.onclick = () => { S.pm = x.dataset.pm; setMe(x.dataset.pm); render(); }; });
    app.querySelectorAll('[data-pme]').forEach((x) => { x.onclick = () => { setMe(x.dataset.pme); S.tab = 'checks'; render(); }; });
    on('#openWork', () => act(async () => { const r = await call('p.openWork', {}); S.data.team = r.team; S.tab = 'checks'; render(); window.scrollTo(0, 0); }, $('#pmm')));
    on('#savePre', () => act(async () => {
      const id = $('#pm').value, pre = readAtt('pre-');
      if (!id) throw new Error('אפשר לבחור את השם שלך.');
      if (!pre) throw new Error('כדי לשלוח, אפשר לבחור תשובה בכל אחד מההיגדים.');
      const init = $('#pi').value.trim();
      if (!init) throw new Error('כדי לשלוח, אפשר לכתוב את עמדתך לגבי ספקולציות, פייק ניוז, קונספירציות ודיסאינפורמציה.');
      await call('p.reflect', { member: id, pre, initial: init });
      if (!me()) setMe(id);
      S.pm = ''; window.scrollTo(0, 0); await load();
    }, $('#pmm')));
    on('#saveRefl', () => act(async () => {
      const r = {}; for (const q of M.REFLECT) r[q.k] = q.opts ? ((app.querySelector('input[name=rf-' + q.k + ']:checked') || {}).value || '') : $('#rf-' + q.k).value;
      const post = readAtt('post-'), had = (S.data.reflections[$('#rm').value] || {}).post;
      if (!post && !had) throw new Error('כדי לשלוח, אפשר לבחור תשובה בכל אחד מההיגדים בשאלון העמדות המסכם.');
      await call('p.reflect', Object.assign({ member: $('#rm').value, reflect: r }, post ? { post } : {})); keepLocal({ reflect: r });
      const id = $('#rm').value;
      S.data.reflections[id] = Object.assign({}, S.data.reflections[id], { reflect: r, post: true, ai: null }); render(); $('#rmm').innerHTML = msg('הרפלקציה נשלחה. תודה! עכשיו ה־AI מנתח אותה.');
      try { await analyzeReflection(id); render(); $('#rmm').innerHTML = msg('הרפלקציה נשלחה ונותחה.'); } catch (e) { render(); $('#rmm').innerHTML = msg('הרפלקציה נשלחה. הניתוח לא הצליח: ' + (e.message || '') + ' אפשר ללחוץ על "ניתוח ה־AI".'); }
    }, $('#rmm')));
    app.querySelectorAll('[data-rai]').forEach((b) => { b.onclick = () => act(async () => { await analyzeReflection(b.dataset.rai); render(); }, $('#rmm')); });
    // הצוות
    on('#addm', () => { const n = $('#mrows').children.length; if (n < 8) $('#mrows').insertAdjacentHTML('beforeend', memberRow({}, n)); });
    on('#saveTeamM', () => act(async () => { const members = readMembers($('#mrows')); if (members.some((m) => !m.consent)) throw new Error('כדי לשמור, כל משתתף/ת חותם/ת על ההסכמה.'); const r = await call('p.members', { members, name: $('#tn2').value }); S.data.team = r.team; render(); $('#tm').innerHTML = msg('נשמר.'); }, $('#tm')));
    on('#leave', async () => { if (await U.ask('לצאת מהצוות במכשיר הזה? אפשר לחזור עם קוד הצוות.')) { saveCred(classCode, null); S.cred = null; clearInterval(S.timer); start(); } });
    scrollChat();
  }
  function scrollChat() { const c = $('#chat'); if (c) c.scrollTop = c.scrollHeight; }
  start();
})();
