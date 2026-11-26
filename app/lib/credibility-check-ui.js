// בדיקת אמינות של מקורות: סביבת המרצות (credibility-check.html). כניסה עם קוד Begood עם הרשאה credibility או dilemma.
// פעילות ← כיתות עם QR (כניסה ישירה למרחב הכיתה) ← צוותים ועבודתם ← ציון לפי המחוון ← ממצאים ← ייצוא מחקרי.
(function () {
  'use strict';
  const M = window.SBE_CRED, U = window.SBE_CRD_UI, esc = M.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $('#app'), dlg = $('#dlg'), dlgBody = $('#dlgBody');
  const token = () => { try { return sessionStorage.getItem('sbe.session.token') || ''; } catch (e) { return ''; } };
  const call = (op, input) => U.api(op, input, { token: token() });
  const msg = (t, cls) => '<div class="dlm-msg' + (cls ? ' ' + cls : '') + '" role="' + (cls === 'err' ? 'alert' : 'status') + '">' + esc(t) + '</div>';
  const joinUrl = (code) => location.href.replace(/[^/]*$/, '').split('?')[0] + 'credibility-join.html?c=' + code;
  const S = { a: null, teams: [], tab: 'classes', details: {}, timer: null };
  const PLACE = 'sbe.crd.fac.place';
  const place = (v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(PLACE) || 'null'); if (v === null) localStorage.removeItem(PLACE); else localStorage.setItem(PLACE, JSON.stringify(v)); } catch (e) { return null; } };
  function openDlg(html) { dlgBody.innerHTML = html; if (!dlg.open) dlg.showModal(); }
  dlg.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close') || e.target === dlg) dlg.close(); });
  $('#aboutBtn').onclick = () => openDlg(M.aboutHTML());

  async function list() {
    clearInterval(S.timer); S.a = null; place(null);
    let rows = [];
    try { rows = (await call('f.mine')).activities; } catch (e) { app.innerHTML = msg(e.message, 'err'); return; }
    app.innerHTML = '<div class="dlm-card"><h2>פעילות חדשה</h2><div class="dlm-grid2"><div><label for="nn">שם הפעילות</label><input type="text" id="nn" placeholder="למשל: בדיקת אמינות · גורדון · נובמבר"></div>'
      + '<div><label for="ne">מספר אישור ועדת האתיקה (רשות)</label><input type="text" id="ne"></div></div>'
      + '<label for="nd">הדילמה (רשות)</label><textarea id="nd" rows="2" placeholder="למשל: האם התקשורת שמאלנית?"></textarea>'
      + '<label style="font-weight:400"><input type="checkbox" id="nr" checked> הפעילות מלווה במחקר (כל משתתף/ת בוחר/ת אם להשתתף בו)</label>'
      + '<p><button class="dlm-btn main" id="create">יצירת הפעילות</button></p><div id="cm"></div></div>'
      + '<div class="dlm-card"><h2>הפעילויות שלי</h2>' + (rows.length ? '<table class="dlm-table"><thead><tr><th>פעילות</th><th>כיתות</th><th>מצב</th><th></th></tr></thead><tbody>'
        + rows.map((r) => '<tr><td><b>' + esc(r.title) + '</b>' + (r.co ? ' <span class="dlm-tag">שותפות</span>' : '') + '</td><td>' + esc(r.classes.join(' · ')) + '</td><td>' + (r.status === 'open' ? 'פתוחה' : 'סגורה') + '</td><td><button class="crd-link" data-go="' + esc(r.id) + '">פתיחה</button></td></tr>').join('') + '</tbody></table>'
        : '<p>עוד אין פעילויות.</p>')
      + '<details><summary>קיבלתי קוד שותפות ממרצה אחרת</summary><label for="cj">קוד השותפות</label><input type="text" id="cj" dir="ltr" style="max-width:14rem"> <button class="dlm-btn" id="cjb">הצטרפות</button><div id="cjm"></div></details></div>';
    $('#create').onclick = async () => {
      try { const r = await call('f.create', { title: $('#nn').value, dilemma: $('#nd').value, ethics: $('#ne').value, research: $('#nr').checked }); open(r.activity.id); }
      catch (e) { $('#cm').innerHTML = msg(e.message, 'err'); }
    };
    $('#cjb').onclick = async () => { try { const r = await call('f.coJoin', { code: $('#cj').value }); open(r.id); } catch (e) { $('#cjm').innerHTML = msg(e.message, 'err'); } };
    app.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => open(b.dataset.go); });
  }

  async function open(id, quiet) {
    try { const r = await call('f.get', { id }); S.a = r.activity; S.teams = r.teams; }
    catch (e) { if (!quiet) { place(null); app.innerHTML = msg(e.message, 'err') + '<p><button class="dlm-btn" id="bk">לכל הפעילויות</button></p>'; $('#bk').onclick = list; } return; }
    place({ id: S.a.id, tab: S.tab });
    if (!quiet || !document.querySelector('dialog[open]')) render();
    clearInterval(S.timer); S.timer = setInterval(() => { if (!document.hidden && !dlg.open && S.tab !== 'findings') open(S.a.id, true); }, 20000);
  }
  function render() {
    const a = S.a;
    const tabs = [['classes', 'כיתות וכניסה'], ['teams', 'צוותים ועבודה'], ['findings', 'ממצאים'], ['bank', 'מאגר הידיעות'], ['settings', 'הגדרות']];
    app.innerHTML = '<div class="dlm-card"><p><button class="crd-link" id="all">לכל הפעילויות</button></p><h2>' + esc(a.title) + '</h2>'
      + '<p>' + (a.status === 'open' ? '<b>פתוחה:</b> הצוותים יכולים להיכנס ולעבוד.' : '<b>סגורה:</b> הצוותים רואים את העבודה ואינם יכולים לשנות.') + ' <button class="crd-link" id="st">' + (a.status === 'open' ? 'סגירה' : 'פתיחה') + '</button></p>'
      + '<p>' + (a.reflectOpen ? '<b>הרפלקציה פתוחה</b> לכל הצוותים.' : '<b>הרפלקציה סגורה.</b>') + ' <button class="crd-link" id="rfo">' + (a.reflectOpen ? 'סגירת הרפלקציה' : 'פתיחת הרפלקציה') + '</button></p>'
      + '<div class="dlm-steps" role="tablist">' + tabs.map((t) => '<button type="button" data-tab="' + t[0] + '"' + (S.tab === t[0] ? ' aria-current="step"' : '') + '>' + t[1] + '</button>').join('') + '</div></div><div id="tab"></div>';
    $('#all').onclick = list;
    $('#rfo').onclick = async () => { try { await call('f.update', { id: a.id, reflectOpen: !a.reflectOpen }); open(a.id); } catch (e) { U.say(e.message); } };
    $('#st').onclick = async () => { try { await call('f.status', { id: a.id, status: a.status === 'open' ? 'closed' : 'open' }); open(a.id); } catch (e) { U.say(e.message); } };
    app.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { S.tab = b.dataset.tab; place({ id: a.id, tab: S.tab }); render(); }; });
    ({ classes: classesTab, teams: teamsTab, findings: findingsTab, bank: bankTab, settings: settingsTab })[S.tab]();
  }

  function classesTab() {
    const a = S.a, n = $('#tab');
    n.innerHTML = '<div class="dlm-card"><h3>הוספת כיתה</h3><p class="dlm-hint">לכל כיתה QR משלה. הסטודנטים סורקים, ונכנסים ישר למרחב הכיתה: פותחים צוות (עד 10 בכיתה) או מצטרפים לצוות שלהם.</p>'
      + '<label for="cn">שם הכיתה</label><input type="text" id="cn" placeholder="למשל: גורדון · הוראת האזרחות"> <button class="dlm-btn main" id="ca">הוספה</button><div id="cam"></div></div>'
      + (a.allCode ? '<div class="dlm-card"><div class="dlm-grid2"><div><h3>QR אחד לכל הכיתות</h3><p class="dlm-hint">סורקים, בוחרים את הכיתה (' + a.classes.map((c) => esc(c.name)).join(' / ') + '), ונכנסים למרחב שלה.</p>'
        + '<p><input type="text" readonly dir="ltr" value="' + esc(joinUrl(a.allCode)) + '" aria-label="קישור הכניסה לכל הכיתות"></p>'
        + '<div class="dlm-row">' + '<a class="crd-link" target="_blank" rel="noopener" href="' + esc(joinUrl(a.allCode)) + '">פתיחת הקישור</a>' + '<button class="crd-link" data-copy="' + esc(joinUrl(a.allCode)) + '">העתקת הקישור</button><a class="crd-link" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('כניסה לבדיקת אמינות של מקורות: ' + joinUrl(a.allCode)) + '">וואטסאפ</a>'
        + '<button class="crd-link" id="bigAll">QR גדול להקרנה</button><button class="crd-link" id="recodeAll">קוד חדש</button></div></div><div class="dlm-qr" data-qr="' + esc(a.allCode) + '"></div></div></div>'
        : a.classes.length >= 2 ? '<div class="dlm-card"><button class="crd-link" id="recodeAll">יצירת QR אחד לכל הכיתות</button></div>' : '')
      + a.classes.map((c) => {
        const t = S.teams.filter((x) => x.classId === c.id);
        return '<div class="dlm-card"><div class="dlm-grid2"><div><h3>' + esc(c.name) + '</h3><p>קוד הכיתה: <b class="dlm-code" dir="ltr">' + esc(c.code) + '</b></p>'
          + '<p><input type="text" readonly dir="ltr" value="' + esc(joinUrl(c.code)) + '" aria-label="קישור הכניסה"></p>'
          + '<div class="dlm-row">' + '<a class="crd-link" target="_blank" rel="noopener" href="' + esc(joinUrl(c.code)) + '">פתיחת הקישור</a>' + '<button class="crd-link" data-copy="' + esc(joinUrl(c.code)) + '">העתקת הקישור</button><a class="crd-link" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('כניסה לבדיקת אמינות של מקורות (' + c.name + '): ' + joinUrl(c.code)) + '">וואטסאפ</a>'
          + '<button class="crd-link" data-big="' + esc(c.id) + '">QR גדול להקרנה</button><button class="crd-link" data-recode="' + esc(c.id) + '">קוד חדש</button><button class="crd-link" data-ren="' + esc(c.id) + '">שינוי שם</button></div>'
          + '<p class="dlm-hint">' + t.length + ' צוותים · ' + t.reduce((s, x) => s + x.members.length, 0) + ' משתתפים</p>'
          + (t.length ? '<p class="dlm-hint">קודי הצוותים: ' + t.slice().sort((p, q) => String(p.code).localeCompare(String(q.code))).map((x) => esc(x.name) + ' <b dir="ltr">' + esc(x.code || '') + '</b>').join(' · ') + '</p>' : '')
          + '<p class="crd-mk">צוותים מוכנים עם קוד של ספרות (מכללה, כיתה, צוות): מכללה <input type="text" inputmode="numeric" maxlength="1" class="crd-d" data-col="' + esc(c.id) + '" value="' + (a.classes.indexOf(c) + 1) + '" aria-label="ספרת המכללה"> כיתה <input type="text" inputmode="numeric" maxlength="1" class="crd-d" data-cls="' + esc(c.id) + '" value="1" aria-label="ספרת הכיתה"> מספר צוותים <input type="text" inputmode="numeric" maxlength="2" class="crd-d" data-n="' + esc(c.id) + '" value="7" aria-label="מספר הצוותים"> <button class="crd-link" data-mk="' + esc(c.id) + '">פתיחת הצוותים</button></p></div><div class="dlm-qr" data-qr="' + esc(c.code) + '"></div></div></div>';
      }).join('');
    n.querySelectorAll('[data-qr]').forEach((q) => U.qr(q, joinUrl(q.dataset.qr)));
    n.querySelectorAll('[data-mk]').forEach((b) => { b.onclick = async () => { const id = b.dataset.mk; try { const r = await call('f.teamsMake', { id: a.id, classId: id, college: n.querySelector('[data-col="' + id + '"]').value, cls: n.querySelector('[data-cls="' + id + '"]').value, n: Number(n.querySelector('[data-n="' + id + '"]').value) || 7 }); U.say(r.made.length ? 'נפתחו צוותים: ' + r.made.join(', ') : 'הצוותים כבר פתוחים.'); open(a.id); } catch (e) { U.say(e.message); } }; });
    if ($('#bigAll')) $('#bigAll').onclick = () => { openDlg('<div style="text-align:center"><h2>' + esc(a.title) + '</h2><h3>' + a.classes.map((c) => esc(c.name)).join(' / ') + '</h3><div id="bigqr" style="display:inline-block"></div><p class="dlm-hint" dir="ltr"><a target="_blank" rel="noopener" href="' + esc(joinUrl(a.allCode)) + '">' + esc(joinUrl(a.allCode)) + '</a></p></div>'); U.qr($('#bigqr'), joinUrl(a.allCode), 360); };
    if ($('#recodeAll')) $('#recodeAll').onclick = async () => { if (!a.allCode || await U.ask('להפיק קוד חדש ל־QR המשותף? ה־QR הישן יפסיק לעבוד.')) { try { await call('f.allCode', { id: a.id }); open(a.id); } catch (e) { U.say(e.message); } } };
    $('#ca').onclick = async () => { try { await call('f.classAdd', { id: a.id, name: $('#cn').value }); open(a.id); } catch (e) { $('#cam').innerHTML = msg(e.message, 'err'); } };
    n.querySelectorAll('[data-copy]').forEach((b) => { b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'הועתק ✓'; } catch (e) {} }; });
    n.querySelectorAll('[data-recode]').forEach((b) => { b.onclick = async () => { if (await U.ask('להפיק קוד כיתה חדש? ה־QR הישן יפסיק לעבוד. צוותים שכבר נכנסו ממשיכים כרגיל.')) { try { await call('f.classCode', { id: a.id, classId: b.dataset.recode }); open(a.id); } catch (e) { U.say(e.message); } } }; });
    n.querySelectorAll('[data-ren]').forEach((b) => { b.onclick = async () => { const c = a.classes.find((x) => x.id === b.dataset.ren); const v = await U.askText('שם הכיתה', c.name); if (v) { try { await call('f.classEdit', { id: a.id, classId: c.id, name: v }); open(a.id); } catch (e) { U.say(e.message); } } }; });
    n.querySelectorAll('[data-big]').forEach((b) => { b.onclick = () => { const c = a.classes.find((x) => x.id === b.dataset.big); openDlg('<div style="text-align:center"><h2>' + esc(a.title) + '</h2><h3>' + esc(c.name) + '</h3><div id="bigqr" style="display:inline-block"></div><p style="font-size:1.6rem">קוד הכיתה: <b dir="ltr">' + esc(c.code) + '</b></p><p class="dlm-hint" dir="ltr"><a target="_blank" rel="noopener" href="' + esc(joinUrl(c.code)) + '">' + esc(joinUrl(c.code)) + '</a></p></div>'); U.qr($('#bigqr'), joinUrl(c.code), 360); }; });
  }

  const cname = (id) => ((S.a.classes.find((c) => c.id === id) || {}).name || '');
  function teamsTab() {
    const n = $('#tab');
    if (!S.teams.length) { n.innerHTML = '<div class="dlm-card"><p>עוד לא נפתחו צוותים. הצוותים נפתחים בסריקת ה־QR של הכיתה.</p></div>'; return; }
    n.innerHTML = '<div class="dlm-card"><h3>הצוותים</h3><p class="dlm-hint">הציונים: AI ראשונה ← הצוות ← AI חוזרת. ✓ = חתם/ה על ההסכמה, ○ = רק ללמידה (חריג שהמנחה סימנה).</p><div class="crd-tablewrap"><table class="dlm-table"><thead><tr><th>צוות</th><th>כיתה</th><th>משתתפים</th><th>שאלון ראשוני</th><th>מקורות שנבדקו</th><th>רפלקציות</th><th>ציון בתרגיל</th><th></th></tr></thead><tbody>'
      + S.teams.map((t) => '<tr><td><b>' + esc(t.name) + '</b><br><span class="dlm-hint" dir="ltr">' + esc(t.code) + '</span></td><td>' + esc(cname(t.classId)) + '</td><td>' + t.members.map((m) => esc(m.name) + ' ' + (m.consent === 'research' ? '✓' : '○')).join('<br>') + '</td>'
        + '<td>' + t.reflections.filter((r) => r.pre).length + ' מתוך ' + t.members.length + '</td>'
        + '<td>' + (t.checks.length ? t.checks.map((k) => '<div>' + esc(k.title.slice(0, 40)) + ' ' + [k.team, k.first, k.final].map((v) => M.dotHTML(v === undefined ? null : v)).join(' ') + ' <span class="dlm-hint">' + k.ext + ' מקורות</span></div>').join('') : '—') + '</td>'
        + '<td>' + t.reflections.filter((r) => r.reflect).length + ' מתוך ' + t.members.length + '</td><td>' + (t.grade && t.grade.total != null ? '<b>' + t.grade.total + '</b>' : '—') + '</td>'
        + '<td><button class="crd-link" data-team="' + esc(t.id) + '">פתיחה</button></td></tr>').join('') + '</tbody></table></div></div>';
    n.querySelectorAll('[data-team]').forEach((b) => { b.onclick = () => teamDialog(b.dataset.team); });
  }
  async function teamDetail(id) { if (!S.details[id] || Date.now() - S.details[id].t > 15000) S.details[id] = { t: Date.now(), d: await call('f.team', { id: S.a.id, teamId: id }) }; return S.details[id].d; }
  async function teamDialog(id) {
    openDlg('<p>טוען…</p>');
    let d; try { d = await teamDetail(id); } catch (e) { dlgBody.innerHTML = msg(e.message, 'err'); return; }
    const t = d.team, nm = (mid) => ((t.members.find((m) => m.id === mid) || {}).name || '');
    const checkHTML = (k) => '<details class="dlm-card soft"><summary><b>' + esc(k.title) + '</b> ' + U.scoresRow(k) + '</summary>'
      + (k.url ? '<p><a href="' + esc(k.url) + '" target="_blank" rel="noopener noreferrer" dir="ltr">' + esc(k.url) + '</a></p>' : '') + (k.fileId ? '<p><button class="crd-link" data-f="' + esc(k.fileId) + '">פתיחת הקובץ</button></p>' : '')
      + '<h4>תיאור המקור</h4><table class="dlm-table">' + M.FIELDS.map((x) => '<tr><th>' + esc(x.t) + '</th><td>' + esc((k.fields || {})[x.k] || '') + '</td></tr>').join('') + (k.extra || []).map((x) => '<tr><th>' + esc(x.t) + '</th><td>' + esc(x.v || '') + '</td></tr>').join('') + '</table>'
      + (k.team ? '<h4>הציון של הצוות, לפני ה־AI: ' + M.dotHTML(k.team.score) + '</h4><p>' + esc(k.team.why) + '</p>' : '')
      + U.assessHTML(k.first, 'AI, הערכה ראשונה')
      + ((k.chat || []).length ? '<h4>השיחה עם ה־AI (' + k.chat.length + ')</h4><div class="crd-chat">' + k.chat.map((m) => '<div class="crd-msg ' + (m.role === 'ai' ? 'ai' : 'me') + '"><b>' + (m.role === 'ai' ? 'AI' : esc(nm(m.by) || 'הצוות')) + '</b><div>' + esc(m.text).replace(/\n/g, '<br>') + '</div></div>').join('') + '</div>' : '')
      + '<h4>מקורות חיצוניים (' + (k.external || []).length + ')</h4><ol>' + (k.external || []).map((e) => '<li><b>' + esc(e.title || e.url) + '</b> · ' + esc((M.EXT_KINDS.find((x) => x.k === e.kind) || {}).t || '') + (e.url ? ' · <a href="' + esc(e.url) + '" target="_blank" rel="noopener noreferrer">קישור</a>' : '') + '<br>' + esc(e.found) + '</li>').join('') + '</ol>'
      + U.assessHTML(k.final, 'AI, הערכה חוזרת') + '</details>';
    const refl = t.members.map((m) => { const r = d.reflections[m.id] || {}; const rf = r.reflect;
      return '<details class="dlm-card soft"><summary><b>' + esc(m.name) + '</b> ' + (m.consent === 'research' ? '✓ חתם/ה על ההסכמה' : '○ רק ללמידה (חריג)') + ' · ' + (r.initial ? 'עמדה ✓' : 'בלי עמדה') + ' · ' + (rf ? 'רפלקציה ✓' : 'עוד בלי רפלקציה') + '</summary>'
        + (r.initial ? '<h4>' + esc(M.INITIAL.h) + '</h4><p class="dlm-hint">' + esc(M.INITIAL.t) + '</p><p>' + esc(r.initial.text) + '</p>' : '')
        + (rf ? M.REFLECT.map((q) => rf[q.k] ? '<h4>' + esc(q.t) + '</h4><p>' + esc(M.reflectValue(q, rf[q.k])).replace(/\n/g, '<br>') + '</p>' : '').join('') : '') + reflAI(r.ai) + '</details>'; }).join('');
    function reflAI(ai) {
      if (!ai) return '';
      const lv = (v) => (M.GRADE.levels.find((l) => l[0] === v) || [, ''])[1];
      return '<div class="crd-assess"><h4>ניתוח ה־AI לפי הקריטריונים</h4><table class="dlm-table"><thead><tr><th>הקריטריון</th><th>עולה?</th><th>מה נכתב</th></tr></thead><tbody>'
        + M.REFLECT_CRITERIA.map((c) => { const x = (ai.criteria || []).find((y) => y.k === c.k) || {}; return '<tr><th>' + esc(c.t) + '</th><td class="ck">' + (x.found ? '✓' : '○') + '</td><td>' + esc(x.note || '') + '</td></tr>'; }).join('')
        + '</tbody></table>' + (ai.level ? '<p><b>רמה מוצעת לקריטריון "רפלקציה אישית":</b> ' + esc(lv(ai.level)) + (ai.levelWhy ? '. ' + esc(ai.levelWhy) : '') + ' <span class="dlm-hint">(רק המנחה רואה את זה. הציון בידי המנחה.)</span></p>' : '')
        + (ai.strength ? '<p><b>מה חזק:</b> ' + esc(ai.strength) + '</p>' : '') + (ai.question ? '<p><b>שאלה להעמקה:</b> ' + esc(ai.question) + '</p>' : '') + '</div>';
    }
    const g = t.grade || {};
    const grade = '<h3>ציון בתרגיל לפי המחוון</h3><div class="crd-tablewrap"><table class="dlm-table"><thead><tr><th>קריטריון</th><th>משקל</th>' + M.GRADE.levels.map((l) => '<th>' + esc(l[1]) + '</th>').join('') + '</tr></thead><tbody>'
      + M.GRADE.criteria.map((c) => '<tr><th>' + esc(c.t) + '</th><td>' + c.w + '</td>' + M.GRADE.levels.map((l, i) => '<td><label style="font-weight:400"><input type="radio" name="g-' + c.k + '" value="' + l[0] + '"' + (g[c.k] === l[0] ? ' checked' : '') + '> ' + esc(c.l[i]) + '</label></td>').join('') + '</tr>').join('')
      + '</tbody></table></div><label for="gn">הערה לצוות</label><textarea id="gn" rows="2">' + esc(g.note || '') + '</textarea><p><button class="dlm-btn main" id="gs">שמירת הציון</button> <b id="gt">' + (g.total != null ? 'סך הכול: ' + g.total : '') + '</b></p><div id="gm"></div>';
    dlgBody.innerHTML = '<h2>' + esc(t.name) + '</h2><p class="dlm-hint">' + esc(cname(t.classId)) + ' · קוד הצוות: ' + esc(t.code) + '</p>'
      + '<h3>המקורות שנבדקו (' + d.checks.length + ')</h3>' + (d.checks.map(checkHTML).join('') || '<p>עוד אין.</p>')
      + '<h3>עמדות ורפלקציות</h3>' + refl
      + '<details class="dlm-card soft"><summary>חריג בהסכמה למחקר</summary><p class="dlm-hint">כל המשתתפים בצוות נכללים במחקר. כשצריך לפתור מקרה נקודתי, אפשר לסמן כאן "רק ללמידה": העבודה נשארת בכלי, ולא נכנסת לייצוא המחקרי.</p>'
      + t.members.map((m) => '<p><label><input type="checkbox" class="cx" value="' + esc(m.id) + '"' + (m.consent === 'learning' ? ' checked' : '') + '> ' + esc(m.name) + ': רק ללמידה</label></p>').join('')
      + '<p><button class="crd-link" id="cxs">שמירת החריגים</button></p><div id="cxm"></div></details>' + grade
      + '<p style="margin-top:1.5rem"><button class="crd-link" id="tdel" style="color:#b3261e">מחיקת הצוות</button></p>';
    dlgBody.querySelectorAll('[data-f]').forEach((b) => { b.onclick = async () => { try { U.showFile(await call('f.file', { id: S.a.id, fid: b.dataset.f })); } catch (e) { U.say(e.message); } }; });
    $('#gs').onclick = async () => {
      const gr = {}; for (const c of M.GRADE.criteria) { const v = (dlgBody.querySelector('input[name=g-' + c.k + ']:checked') || {}).value; if (v) gr[c.k] = Number(v); }
      try { const r = await call('f.grade', { id: S.a.id, teamId: t.id, grade: gr, note: $('#gn').value }); $('#gt').textContent = r.grade.total != null ? 'סך הכול: ' + r.grade.total : ''; $('#gm').innerHTML = msg('נשמר.'); delete S.details[t.id]; }
      catch (e) { $('#gm').innerHTML = msg(e.message, 'err'); }
    };
    $('#cxs').onclick = async () => {
      const learn = new Set([...dlgBody.querySelectorAll('.cx:checked')].map((x) => x.value));
      const members = t.members.map((m) => ({ id: m.id, name: m.name, consent: learn.has(m.id) ? 'learning' : 'research' }));
      try { const r = await call('f.teamEdit', { id: S.a.id, teamId: t.id, members }); t.members = r.team.members; delete S.details[t.id]; $('#cxm').innerHTML = msg('נשמר.'); }
      catch (e) { $('#cxm').innerHTML = msg(e.message, 'err'); }
    };
    $('#tdel').onclick = async () => { if (await U.ask('למחוק את הצוות "' + t.name + '" וכל העבודה שלו? אי אפשר לבטל.', { ok: 'מחיקה' })) { try { await call('f.teamRemove', { id: S.a.id, teamId: t.id }); dlg.close(); open(S.a.id); } catch (e) { U.say(e.message); } } };
  }

  // ── ממצאים: מה רואים בנתונים, עם הסבר קצר לכל מדד (17/11/2026: "כדי שאיבנה ועינת יבינו") ──
  async function findingsTab() {
    const n = $('#tab'); n.innerHTML = '<div class="dlm-card"><p>אוספים את הנתונים…</p></div>';
    const only = S.onlyResearch !== false;
    const all = [];
    for (const t of S.teams) { try { all.push(await teamDetail(t.id)); } catch (e) {} }
    const teams = all.filter((d) => !only || d.team.members.every((m) => m.consent === 'research'));
    const checks = teams.flatMap((d) => d.checks.map((k) => Object.assign({ _team: d.team }, k)));
    const has = (k, s) => k[s] && Number.isInteger(k[s].score);
    const mean = (arr) => arr.length ? (arr.reduce((s, x) => s + x, 0) / arr.length) : null;
    const f1 = (v) => v == null ? '—' : v.toFixed(1);
    const firsts = checks.filter((k) => has(k, 'first')).map((k) => k.first.score), tms = checks.filter((k) => has(k, 'team')).map((k) => k.team.score), fins = checks.filter((k) => has(k, 'final')).map((k) => k.final.score);
    const both = checks.filter((k) => has(k, 'first') && has(k, 'team')), trio = checks.filter((k) => has(k, 'first') && has(k, 'team') && has(k, 'final'));
    const same = both.filter((k) => k.first.score === k.team.score).length, lower = both.filter((k) => k.team.score < k.first.score).length, higher = both.filter((k) => k.team.score > k.first.score).length;
    const aiMoved = trio.filter((k) => k.final.score !== k.first.score).length, aiToTeam = trio.filter((k) => Math.abs(k.final.score - k.team.score) < Math.abs(k.first.score - k.team.score)).length;
    const ext = checks.map((k) => (k.external || []).length), kinds = {};
    checks.forEach((k) => (k.external || []).forEach((e) => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; }));
    const turns = checks.map((k) => (k.chat || []).filter((m) => m.role === 'team').length);
    const people = teams.flatMap((d) => d.team.members.filter((m) => !only || m.consent === 'research').map((m) => d.reflections[m.id] || {}));
    const ch = { yes: 0, partly: 0, no: 0 }; people.forEach((r) => { if (r.reflect && ch[r.reflect.changed] !== undefined) ch[r.reflect.changed]++; });
    const nRefl = people.filter((r) => r.reflect).length;
    const bars = (obj, labels, tot) => Object.keys(labels).map((k) => '<div class="crd-bar"><span style="min-width:9rem">' + esc(labels[k]) + '</span><i style="width:' + (tot ? Math.round(240 * (obj[k] || 0) / tot) : 0) + 'px"></i><b>' + (obj[k] || 0) + '</b></div>').join('');
    const dist = (arr) => { const o = {}; arr.forEach((v) => { o[v] = (o[v] || 0) + 1; }); return o; };
    const lbl5 = Object.fromEntries(M.SCALE.map((l) => [l.score, l.score + ' · ' + l.name]));
    const ex = (t) => '<p class="crd-explain">' + esc(t) + '</p>';
    n.innerHTML = '<div class="dlm-card"><h3>ממצאים</h3><p class="dlm-hint">תמונה מספרית של העבודה בכלי, לכל הכיתות בפעילות. המספרים קטנים (עשרות צוותים לכל היותר), ולכן הם מתארים ולא מוכיחים. הם עוזרים לבחור אילו בדיקות לקרוא לעומק.</p>'
      + '<label style="font-weight:400"><input type="checkbox" id="onlyR"' + (only ? ' checked' : '') + '> רק צוותים שכל חבריהם הסכימו להשתתף במחקר (לניתוח המחקרי)</label>'
      + '<div class="crd-kpi"><div><b>' + teams.length + '</b>צוותים</div><div><b>' + checks.length + '</b>מקורות שנבדקו</div><div><b>' + trio.length + '</b>בדיקות שהושלמו (שלושה ציונים)</div><div><b>' + nRefl + '</b>רפלקציות</div></div>'
      + '<h4>ממוצע הציונים</h4><div class="crd-kpi"><div><b>' + f1(mean(firsts)) + '</b>AI, הערכה ראשונה</div><div><b>' + f1(mean(tms)) + '</b>הצוותים</div><div><b>' + f1(mean(fins)) + '</b>AI, הערכה חוזרת</div></div>'
      + ex('הציון הוא 1 עד 5. ממוצע של הצוותים נמוך מהממוצע של ה־AI אומר שהצוותים היו זהירים יותר, למשל כי לא מצאו מקור ראשוני. ממוצע גבוה יותר אומר שמצאו ראיות שה־AI לא ראה בהתחלה.')
      + '<h4>הצוות מול ההערכה הראשונה של ה־AI</h4>' + bars({ same, lower, higher }, { same: 'אותו ציון', lower: 'הצוות נתן ציון נמוך יותר', higher: 'הצוות נתן ציון גבוה יותר' }, both.length)
      + ex('הצוות נותן ציון לפני שהוא רואה את ה־AI. ההשוואה מראה עד כמה השיפוט העצמאי של הצוות קרוב להערכה של המודל, ואיפה הם רחוקים. כדאי לקרוא את שני הנימוקים.')
      + '<h4>ההערכה החוזרת של ה־AI</h4><p>' + aiMoved + ' מתוך ' + trio.length + ' פעמים ה־AI שינה את הציון אחרי החקירה, ו־' + aiToTeam + ' פעמים התקרב לציון שהצוות נתן בהתחלה.</p>'
      + ex('האם פריטי המידע שהצוות הביא בחקירה שינו את ההערכה? שינוי בציון החוזר מראה שהמידע החדש היה משמעותי.')
      + '<h4>התפלגות הציונים של הצוותים</h4>' + bars(dist(tms), lbl5, tms.length)
      + '<h4>פריטי מידע נוספים מהחקירה</h4><p>בממוצע ' + f1(mean(ext)) + ' פריטים לכל מקור שנבדק. ' + ext.filter((x) => x === 0).length + ' בדיקות הסתיימו בלי אף פריט נוסף.</p>'
      + bars(kinds, Object.fromEntries(M.EXT_KINDS.map((x) => [x.k, x.t.replace(/ \(.*/, '')])), Math.max(1, ...Object.values(kinds)))
      + ex('הצלבה היא הלב של קריאה לרוחב. מקור ראשוני או רשמי חזק יותר מכלי תקשורת נוסף שמעתיק את אותו נוסח.')
      + '<h4>האם חל שינוי בעמדה כלפי הדילמה? (' + nRefl + ' רפלקציות)</h4>' + bars(ch, { yes: 'כן', partly: 'חלקית', no: 'לא' }, nRefl)
      + ex('זה דיווח עצמי. המשמעות נמצאת בתשובות הפתוחות: מה הביא לשינוי, ומה היה יכול לשנות את הדעה. אפשר לקרוא אותן בלשונית הצוותים, או בקובץ הייצוא.')
      + '<h4>בדיקות לקריאה לעומק</h4><ul>' + checks.filter((k) => has(k, 'first') && has(k, 'team') && Math.abs(k.first.score - k.team.score) >= 2).map((k) => '<li>' + esc(k._team.name) + ': ' + esc(k.title) + ' (AI ' + k.first.score + ', צוות ' + k.team.score + ')</li>').join('') + '</ul>'
      + ex('בדיקות שבהן הצוות והמודל רחוקים זה מזה בשתי רמות או יותר. אלה בדרך כלל המקרים המעניינים ביותר לניתוח.')
      + '<p><button class="dlm-btn" id="exp">⬇ ייצוא מחקרי (JSON)</button> <button class="dlm-btn" id="csv">⬇ טבלת בדיקות (CSV, נפתח באקסל)</button></p><p class="dlm-hint">הייצוא כולל רק משתתפים שהסכימו למחקר, בלי שמות. תוצר צוותי נכלל רק אם כל חברי הצוות הסכימו.</p></div>';
    $('#onlyR').onchange = (e) => { S.onlyResearch = e.target.checked; findingsTab(); };
    const dl = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
    $('#exp').onclick = async () => { try { dl('credibility-research.json', JSON.stringify(await call('f.export', { id: S.a.id }), null, 2), 'application/json'); } catch (e) { U.say(e.message); } };
    $('#csv').onclick = async () => {
      try {
        const x = await call('f.export', { id: S.a.id });
        const rows = [['class', 'team', 'source', 'ai_first', 'team_score', 'ai_final', 'external_sources', 'team_messages', 'done']];
        x.teams.forEach((t) => (t.summary || []).forEach((s) => rows.push([t.class, t.code, s.title || '', s.first ?? '', s.team ?? '', s.final ?? '', s.ext, s.turns, s.done ? 1 : 0])));
        dl('credibility-checks.csv', '﻿' + rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv');
      } catch (e) { U.say(e.message); }
    };
  }

  // מאגר הידיעות (26/11/2026: "איבנה לא רואה את המאגר"): הצוותים בוחרים ממנו אחרי שאלון העמדות; כאן המרצות רואות את כל הידיעות
  function bankTab() {
    const n = $('#tab'), B = window.SBE_CRED_BANK;
    if (!B) { n.innerHTML = '<div class="dlm-card"><p>המאגר לא נטען. אפשר לרענן את הדף.</p></div>'; return; }
    n.innerHTML = '<div class="dlm-card"><h3>מאגר הידיעות (' + B.all().length + ')</h3><p class="dlm-hint">אלה הידיעות שהצוותים יכולים לבחור מהן. אצל הצוותים המאגר מופיע בלשונית בדיקת המקורות, אחרי שאלון העמדות ופתיחת אזור העבודה, מעל העלאת הקובץ. הקבוצה של הדילמה של הפעילות מופיעה ראשונה.</p>'
      + B.ordered(S.a.dilemma).map((g) => '<details class="crd-bank"><summary>' + esc(g.t) + ' (' + g.items.length + ')</summary>'
        + g.items.map((x) => '<details class="crd-bank"><summary>' + esc(x.title) + ' <span class="dlm-hint">' + esc(x.outlet + ' · ' + x.date) + '</span></summary><pre class="crd-bank-text">' + esc(B.text(x)) + '</pre>' + (x.url ? '<p><a href="' + esc(x.url) + '" target="_blank" rel="noopener">קישור למקור</a></p>' : '') + '</details>').join('')
        + '</details>').join('') + '</div>';
  }

  function settingsTab() {
    const a = S.a, n = $('#tab');
    n.innerHTML = '<div class="dlm-card"><h3>הגדרות</h3><label for="sn">שם הפעילות</label><input type="text" id="sn" value="' + esc(a.title) + '">'
      + '<label for="sd">הדילמה</label><textarea id="sd" rows="2">' + esc(a.dilemma || '') + '</textarea>'
      + '<label for="se">מספר אישור ועדת האתיקה (רשות)</label><input type="text" id="se" value="' + esc(a.research.ethics || '') + '">'
      + '<label for="sc">פרטי קשר לשאלות על המחקר (רשות)</label><input type="text" id="sc" value="' + esc(a.research.contact || '') + '">'
      + '<label style="font-weight:400"><input type="checkbox" id="sr"' + (a.research.enabled ? ' checked' : '') + '> הפעילות מלווה במחקר</label>'
      + '<label style="font-weight:400"><input type="checkbox" id="sro"' + (a.reflectOpen ? ' checked' : '') + '> הרפלקציה פתוחה לכל הצוותים</label><p class="dlm-hint">פתוחה מראש. אפשר לסגור אותה, ואז הצוותים לא רואים אותה.</p>'
      + '<p><button class="dlm-btn main" id="ss">שמירה</button></p><div id="sm"></div></div>'
      + (a.isOwner ? '<div class="dlm-card"><h3>שותפות</h3><p class="dlm-hint">החוקרות השותפות (איבנה, עינת ויעל) נכנסות לפעילות עם קוד שותפות, ורואות את כל הכיתות והצוותים.</p>'
        + (a.coCode ? '<p>קוד השותפות: <b class="dlm-code" dir="ltr">' + esc(a.coCode) + '</b></p>' : '') + '<button class="dlm-btn" id="co">' + (a.coCode ? 'קוד שותפות חדש' : 'הפקת קוד שותפות') + '</button> <span class="dlm-hint">שותפות: ' + a.cofacs + '</span></div>'
        + '<div class="dlm-card"><h3>מחיקת הפעילות</h3><button class="dlm-btn" id="del" style="color:#b3261e">מחיקה</button></div>' : '');
    $('#ss').onclick = async () => { try { await call('f.update', { id: a.id, title: $('#sn').value, dilemma: $('#sd').value, research: { ethics: $('#se').value, contact: $('#sc').value, enabled: $('#sr').checked }, reflectOpen: $('#sro').checked }); $('#sm').innerHTML = msg('נשמר.'); open(a.id, true); } catch (e) { $('#sm').innerHTML = msg(e.message, 'err'); } };
    const co = $('#co'); if (co) co.onclick = async () => { try { await call('f.coCode', { id: a.id }); open(a.id); } catch (e) { U.say(e.message); } };
    const del = $('#del'); if (del) del.onclick = async () => { if (await U.ask('למחוק את הפעילות וכל העבודה של כל הצוותים? אי אפשר לבטל.', { ok: 'מחיקה' })) { try { await call('f.delete', { id: a.id }); list(); } catch (e) { U.say(e.message); } } };
  }

  const p = place();
  if (p && p.id) { S.tab = p.tab || 'classes'; open(p.id); } else list();
})();
