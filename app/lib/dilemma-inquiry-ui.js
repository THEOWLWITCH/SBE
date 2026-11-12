// בירור דילמות: סביבת המנחה (dilemma-inquiry.html). כניסה עם קוד Begood שיש בו את הכלי (הרשאה dilemma).
// יצירת פעילות (מתבנית או ריקה) ← הדילמה והמקורות ← כיתות וקבוצות, עם QR לכל כיתה (ביטול והפקה מחדש) ←
// הגדרות המחקר וההסכמה ← פתיחה ← צפייה בלוחות בזמן אמת ובדיווחים ← סגירה וייצוא מחקרי לפי ההסכמות.
(function () {
  'use strict';
  const M = window.SBE_DILEMMA, U = window.SBE_DLM_UI, esc = M.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $('#app'), dlg = $('#dlg'), dlgBody = $('#dlgBody');
  $('#cardDesc').textContent = M.CARD_DESC; $('#gq').textContent = M.GUIDING_QUESTION;
  const token = () => { try { return sessionStorage.getItem('sbe.session.token') || ''; } catch (e) { return ''; } };
  const call = (op, input) => U.api(op, input, { token: token() });
  const msg = (t, cls) => '<div class="dlm-msg' + (cls ? ' ' + cls : '') + '" role="' + (cls === 'err' ? 'alert' : 'status') + '">' + esc(t) + '</div>';
  const STATUS = { draft: 'טיוטה (סגורה למשתתפים)', open: 'פתוחה', closed: 'הסתיימה' };
  const S = { a: null, tab: 'dilemma', stats: null, board: null, g: null, timer: null };
  const joinUrl = (code) => location.href.replace(/[^/]*$/, '') + 'dilemma-join.html?c=' + code;
  function openDlg(html) { dlgBody.innerHTML = html; if (!dlg.open) dlg.showModal(); }
  dlg.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close') || e.target === dlg) dlg.close(); });
  function fail(e, where) { (where || app).insertAdjacentHTML('afterbegin', msg(e.message || 'משהו לא הצליח. אפשר לנסות שוב.', 'err')); }

  // ── רשימת הפעילויות ──
  async function list() {
    clearInterval(S.timer); S.a = null;
    let rows = [];
    try { rows = (await call('f.mine')).activities; } catch (e) { app.innerHTML = msg(e.message, 'err'); return; }
    app.innerHTML = '<div class="dlm-card"><h2>פעילות חדשה</h2><div class="dlm-grid2"><div><label for="nt">מאיזו דילמה מתחילים?</label><select id="nt"><option value="">דילמה חדשה (ריקה)</option>'
      + M.TEMPLATES.map((t) => '<option value="' + t.id + '">' + esc(t.title) + '</option>').join('') + '</select></div>'
      + '<div><label for="nn">שם הפעילות</label><input type="text" id="nn" placeholder="למשל: בירור דילמות · קבוצה ב׳"></div>'
      + '<div><label for="nm">אופן העבודה</label><select id="nm"><option value="group">קבוצתי: לוח לכל קבוצה</option><option value="personal">אישי: לוח לכל משתתף/ת</option></select></div>'
      + '<div><label for="nd">משך משוער (דקות)</label><input type="number" id="nd" min="20" max="240" value="90"></div></div>'
      + '<label style="font-weight:400"><input type="checkbox" id="nr" checked> הפעילות מלווה במחקר (המשתתפים יבחרו אם להשתתף בו)</label>'
      + '<p><button class="dlm-btn main" id="create">יצירת הפעילות</button></p><div id="cm"></div></div>'
      + '<div class="dlm-card soft"><h2>הפעילויות שלי</h2>' + (rows.length ? '<table class="dlm-table"><thead><tr><th>הפעילות</th><th>מצב</th><th>כיתות</th><th>עודכנה</th></tr></thead><tbody>'
        + rows.map((r) => '<tr><td><a href="#" data-open="' + esc(r.id) + '">' + esc(r.title) + '</a></td><td>' + esc(STATUS[r.status]) + '</td><td>' + r.classes + '</td><td>' + esc(new Date(r.updatedAt).toLocaleDateString('he-IL')) + '</td></tr>').join('') + '</tbody></table>'
        : '<p>עדיין אין פעילויות. אפשר להתחיל מאחת משלוש הדילמות המוכנות.</p>') + '</div>';
    $('#nt').onchange = () => { const t = M.TEMPLATES.find((x) => x.id === $('#nt').value); if (t && !$('#nn').value) $('#nn').value = t.title; };
    $('#create').onclick = async () => {
      try { const t = M.TEMPLATES.find((x) => x.id === $('#nt').value);
        const r = await call('f.create', { template: $('#nt').value, title: $('#nn').value || (t && t.title) || '', mode: $('#nm').value, durationMin: +$('#nd').value, research: $('#nr').checked });
        open(r.activity.id); }
      catch (e) { $('#cm').innerHTML = msg(e.message, 'err'); }
    };
    app.querySelectorAll('[data-open]').forEach((a) => a.onclick = (e) => { e.preventDefault(); open(a.dataset.open); });
  }

  async function open(id) {
    try { const r = await call('f.get', { id }); S.a = r.activity; S.stats = r.stats; draw(); } catch (e) { fail(e); }
  }
  async function save(input) { const r = await call('f.update', Object.assign({ id: S.a.id }, input)); S.a = r.activity; return r; }

  function draw() {
    clearInterval(S.timer);
    const a = S.a, st = S.stats || {};
    const TABS = [['dilemma', '🧭 הדילמה'], ['sources', '📚 מקורות'], ['classes', '🏫 כיתות ו־QR'], ['research', '🔒 מחקר והסכמה'], ['boards', '🗂 הלוחות'], ['export', '⇩ ייצוא']];
    app.innerHTML = '<p><a href="#" id="back">→ לכל הפעילויות</a></p><div class="dlm-card"><div class="dlm-row" style="justify-content:space-between"><div><h2 style="margin:0">' + esc(a.title) + '</h2>'
      + '<p class="dlm-sub">' + esc(a.mode === 'group' ? 'עבודה קבוצתית' : 'עבודה אישית') + ' · ' + a.durationMin + ' דקות · משתתפים: ' + (st.participants || 0) + (a.research.enabled ? ' (במחקר: ' + (st.research || 0) + ', לימודי בלבד: ' + (st.learning || 0) + ')' : '') + '</p></div>'
      + '<div class="dlm-row"><button class="dlm-btn acc" id="projBtn"' + (a.classes.length ? '' : ' disabled title="אפשר להוסיף כיתה קודם"') + '>📽 מצב הקרנה</button><b>מצב: ' + esc(STATUS[a.status]) + '</b>' + (a.status !== 'open' ? '<button class="dlm-btn main" data-st="open">פתיחה למשתתפים</button>' : '<button class="dlm-btn" data-st="closed">סיום הפעילות</button>')
      + (a.status === 'closed' ? '' : a.status === 'open' ? '<button class="dlm-btn small" data-st="draft">השהיה</button>' : '') + '</div></div><div id="topmsg"></div></div>'
      + '<nav class="dlm-steps">' + TABS.map(([k, t]) => '<button type="button" data-tab="' + k + '"' + (S.tab === k ? ' aria-current="step"' : '') + '>' + t + '</button>').join('') + '</nav><div id="tab"></div>';
    $('#back').onclick = (e) => { e.preventDefault(); list(); };
    $('#projBtn').onclick = () => projector();
    app.querySelectorAll('[data-st]').forEach((b) => b.onclick = async () => {
      if (b.dataset.st === 'closed' && !confirm('לסיים את הפעילות? המשתתפים יוכלו לקרוא, אבל לא לכתוב.')) return;
      try { const r = await call('f.status', { id: a.id, status: b.dataset.st }); S.a = r.activity; draw(); } catch (e) { $('#topmsg').innerHTML = msg(e.message, 'err'); }
    });
    app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; draw(); });
    ({ dilemma: tabDilemma, sources: tabSources, classes: tabClasses, research: tabResearch, boards: tabBoards, export: tabExport })[S.tab]();
  }
  const tab = () => $('#tab');

  function tabDilemma() {
    const d = S.a.dilemma, a = S.a;
    const f = (k, t, area, ph) => '<label for="d-' + k + '">' + esc(t) + '</label>' + (area ? '<textarea id="d-' + k + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(d[k]) + '</textarea>' : '<input type="text" id="d-' + k + '" value="' + esc(d[k]) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>');
    tab().innerHTML = '<div class="dlm-card"><label for="d-title0">שם הפעילות</label><input type="text" id="d-title0" value="' + esc(a.title) + '">'
      + f('topic', 'נושא הדילמה') + f('title', 'כותרת הדילמה') + f('claim', 'הטענה המרכזית', true) + f('background', 'רקע', true) + f('concepts', 'מושגים', true)
      + '<label for="d-oq">שאלות פתיחה (שורה לכל שאלה)</label><textarea id="d-oq">' + esc(d.openingQuestions.join('\n')) + '</textarea>'
      + f('examples', 'דוגמאות (רשות)', true) + f('args', 'נימוקים וטיעונים (רשות)', true)
      + '<div class="dlm-grid2"><div><label for="d-mode">אופן העבודה</label><select id="d-mode"><option value="group"' + (a.mode === 'group' ? ' selected' : '') + '>קבוצתי</option><option value="personal"' + (a.mode === 'personal' ? ' selected' : '') + '>אישי</option></select></div>'
      + '<div><label for="d-dur">משך משוער (דקות)</label><input type="number" id="d-dur" min="20" max="240" value="' + a.durationMin + '"></div>'
      + '<div><label for="d-ch">מי מציג מידע מאתגר?</label><select id="d-ch"><option value="facilitator"' + (a.challengeMode === 'facilitator' ? ' selected' : '') + '>המנחה פותח/ת אותו לכולם</option><option value="group"' + (a.challengeMode === 'group' ? ' selected' : '') + '>הקבוצה, כשהיא מוכנה</option></select></div>'
      + '<div><label>&nbsp;</label><label style="font-weight:400"><input type="checkbox" id="d-cho"' + (a.challengeOpen ? ' checked' : '') + '> המידע המאתגר פתוח עכשיו</label></div></div>'
      + '<label for="d-rq">שאלות הרפלקציה (שורה לכל שאלה)</label><textarea id="d-rq" style="min-height:160px">' + esc(a.reflectionQs.join('\n')) + '</textarea>'
      + '<p><button class="dlm-btn main" id="dsave">שמירה</button></p><div id="dm"></div></div>';
    $('#dsave').onclick = async () => {
      const dd = {}; ['topic', 'title', 'claim', 'background', 'concepts', 'examples', 'args'].forEach((k) => { dd[k] = $('#d-' + k).value; });
      dd.openingQuestions = $('#d-oq').value.split('\n').map((x) => x.trim()).filter(Boolean);
      try { await save({ title: $('#d-title0').value, dilemma: dd, mode: $('#d-mode').value, durationMin: +$('#d-dur').value, challengeMode: $('#d-ch').value, challengeOpen: $('#d-cho').checked, reflectionQs: $('#d-rq').value.split('\n').map((x) => x.trim()).filter(Boolean) });
        $('#dm').innerHTML = msg('נשמר.'); } catch (e) { $('#dm').innerHTML = msg(e.message, 'err'); }
    };
  }

  function tabSources() {
    const a = S.a;
    tab().innerHTML = '<div class="dlm-card"><h2>מקורות שהמשתתפים יראו מההתחלה</h2><p class="dlm-hint">מקור חדש מוצג באפור (טרם נבדק) עד שמעריכים אותו. אפשר להעריך בעצמכם, או לבקש הערכה מה־AI ולאשר.</p>'
      + a.sources.map((s) => '<div class="dlm-row" style="justify-content:space-between"><div data-src="' + esc(s.id) + '" style="cursor:pointer;flex:1">' + U.sourceRowHTML(s, null) + '</div><button class="dlm-btn small red" data-rm="' + esc(s.id) + '">הסרה</button></div>').join('')
      + '<h3>הוספת מקור</h3><div class="dlm-grid2"><div><label for="s-title">שם המקור (שדה עיקרי)</label><input type="text" id="s-title"></div><div><label for="s-pub">מחבר או גוף מפרסם</label><input type="text" id="s-pub"></div>'
      + '<div><label for="s-date">תאריך פרסום</label><input type="text" id="s-date"></div><div><label for="s-type">סוג המקור</label><select id="s-type"><option value="">(רשות)</option>' + M.SOURCE_TYPES.map((t) => '<option>' + esc(t) + '</option>').join('') + '</select></div></div>'
      + '<label for="s-url">קישור</label><input type="url" id="s-url" dir="ltr" placeholder="https://"><label for="s-file">או קובץ (PDF, תמונה או טקסט, עד 1 מגה)</label><input type="file" id="s-file" accept="application/pdf,image/png,image/jpeg,image/webp,text/plain">'
      + '<label for="s-ex">קטע מהמקור (רשות)</label><textarea id="s-ex"></textarea><p><button class="dlm-btn main" id="sadd">הוספה</button></p><div id="sm"></div></div>';
    tab().querySelectorAll('[data-src]').forEach((b) => b.onclick = () => sourceDlg(b.dataset.src));
    tab().querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => { if (!confirm('להסיר את המקור?')) return; try { const r = await call('f.sourceEdit', { id: a.id, sourceId: b.dataset.rm, remove: true }); S.a = r.activity; tabSources(); } catch (e) { fail(e, tab()); } });
    $('#sadd').onclick = async () => {
      const src = { title: $('#s-title').value, publisher: $('#s-pub').value, date: $('#s-date').value, type: $('#s-type').value, url: $('#s-url').value, excerpt: $('#s-ex').value };
      try {
        const file = $('#s-file').files[0];
        if (file) {
          if (file.size > 1_000_000) throw new Error('הקובץ גדול מ־1 מגה.');
          const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(file); });
          const up = await call('f.file', { id: a.id, name: file.name, type: file.type, data }); src.fileId = up.fileId; src.fileName = file.name; if (!src.title) src.title = file.name;
        }
        const r = await call('f.sourceAdd', { id: a.id, source: src }); S.a = r.activity;
        const added = S.a.sources[S.a.sources.length - 1];
        if (added.url) call('f.verify', { id: a.id, sourceId: added.id }).then((v) => { S.a = v.activity; if (S.tab === 'sources') tabSources(); }).catch(() => {});
        tabSources();
      } catch (e) { $('#sm').innerHTML = msg(e.message, 'err'); }
    };
  }
  function sourceDlg(sid) {
    const s = S.a.sources.find((x) => x.id === sid); if (!s) return;
    openDlg(U.sourceCardHTML(s, null, { openWhy: true }) + '<h3>פעולות</h3><div class="dlm-row">' + (s.url ? '<button class="dlm-btn small" id="fv">בדיקה שהקישור קיים</button>' : '')
      + '<button class="dlm-btn small" id="fai">הערכה בעזרת AI</button><button class="dlm-btn small" id="fman">הערכה שלי</button>' + (s.assessments.length ? '<button class="dlm-btn small" id="fhum">סימון בדיקה אנושית להערכה האחרונה</button>' : '') + '</div><div id="fo"></div>');
    const out = $('#fo');
    if ($('#fv')) $('#fv').onclick = async () => { out.innerHTML = msg('בודקים…'); try { const r = await call('f.verify', { id: S.a.id, sourceId: sid }); S.a = r.activity; sourceDlg(sid); } catch (e) { out.innerHTML = msg(e.message, 'err'); } };
    $('#fman').onclick = () => manual(out, sid, {});
    if ($('#fhum')) $('#fhum').onclick = () => {
      out.innerHTML = '<label style="font-weight:400"><input type="checkbox" id="hag" checked> אני מסכים/ה עם ההערכה</label><label for="hn">הערה (רשות)</label><input type="text" id="hn"><p><button class="dlm-btn main" id="hs">שמירה</button></p>';
      $('#hs').onclick = async () => { try { const r = await call('f.assess', { id: S.a.id, sourceId: sid, reviewIndex: s.assessments.length - 1, agree: $('#hag').checked, note: $('#hn').value }); S.a = r.activity; sourceDlg(sid); } catch (e) { out.innerHTML = msg(e.message, 'err'); } };
    };
    $('#fai').onclick = async () => {
      out.innerHTML = msg('ה־AI מעריך את המקור… זה נמשך כ־30 שניות.');
      const ctx = { dilemma: S.a.dilemma, sources: [{ title: s.title, publisher: s.publisher, date: s.date, type: s.type, url: s.url, excerpt: s.excerpt, score: null }], request: 'הערכת המקור S1 בהקשר הטענה: ' + S.a.dilemma.claim };
      try { const r = await U.ai('assess', ctx, null); manual(out, sid, Object.assign({}, r.out, { claim: S.a.dilemma.claim, method: 'ai' }), true); }
      catch (e) { out.innerHTML = msg('ה־AI לא זמין כרגע. אפשר להעריך בלעדיו, ולנסות שוב מאוחר יותר.', 'warn'); }
    };
  }
  function manual(out, sid, p, fromAI) {
    out.innerHTML = (fromAI ? '<p class="dlm-tag ai">הצעת ההערכה של ה־AI. אפשר לשנות לפני השמירה.</p>' : '')
      + '<label for="ms">הציון</label><select id="ms"><option value="">טרם נבדק (אפור)</option>' + M.RUBRIC.map((r) => '<option value="' + r.score + '"' + (p.score === r.score ? ' selected' : '') + '>' + r.score + ' · ' + esc(r.label) + '</option>').join('') + '</select>'
      + '<label for="mc">הטענה שנבדקה</label><input type="text" id="mc" value="' + esc(p.claim || S.a.dilemma.claim) + '"><label for="me">למה זה הציון?</label><textarea id="me">' + esc(p.explanation) + '</textarea>'
      + '<label for="mr">רלוונטיות לטענה</label><input type="text" id="mr" value="' + esc(p.relevance) + '"><label for="ml">מגבלות ההערכה</label><input type="text" id="ml" value="' + esc(p.limits) + '">'
      + '<p><button class="dlm-btn main" id="mss">שמירת ההערכה</button></p><div id="msm"></div>';
    $('#mss').onclick = async () => {
      const v = $('#ms').value;
      try { const r = await call('f.assess', { id: S.a.id, sourceId: sid, assessment: { score: v === '' ? null : +v, claim: $('#mc').value, explanation: $('#me').value, relevance: $('#mr').value, limits: $('#ml').value, criteria: p.criteria || [], method: fromAI ? 'ai' : 'facilitator' } });
        S.a = r.activity; sourceDlg(sid); tabSources(); } catch (e) { $('#msm').innerHTML = msg(e.message, 'err'); }
    };
  }

  function tabClasses() {
    const a = S.a;
    tab().innerHTML = '<div class="dlm-card"><h2>כיתות וקבוצות</h2><p class="dlm-hint">לכל כיתה QR משלה. ה־QR כולל רק קוד כיתה אקראי, בלי פרטים אישיים. אם הקישור הגיע למקום לא נכון: "ביטול והפקת קוד חדש". הקוד הישן מפסיק לעבוד מיד, ומי שכבר נכנס/ה ממשיך/ה כרגיל.</p>'
      + a.classes.map((c) => '<div class="dlm-card soft"><div class="dlm-row" style="justify-content:space-between;align-items:flex-start"><div><h3>' + esc(c.name) + '</h3><p>קוד הכיתה: <span class="dlm-code">' + esc(c.code) + '</span></p>'
        + '<p dir="ltr" style="text-align:start"><a href="' + esc(joinUrl(c.code)) + '" target="_blank" rel="noopener">' + esc(joinUrl(c.code)) + '</a></p>'
        + '<div class="dlm-row"><button class="dlm-btn small" data-copy="' + esc(joinUrl(c.code)) + '">העתקת הקישור</button><a class="dlm-btn small" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('בירור דילמות · ' + a.title + ': ' + joinUrl(c.code)) + '">וואטסאפ</a><button class="dlm-btn small red" data-recode="' + esc(c.id) + '">ביטול והפקת קוד חדש</button></div>'
        + '<p><b>קבוצות' + (a.mode === 'personal' ? ' (לא בשימוש בעבודה אישית)' : '') + ':</b> ' + c.groups.map((g) => esc(g.name) + ' (' + ((S.stats.byGroup || {})[g.id] || 0) + ')').join(' · ') + '</p>'
        + '<div class="dlm-row"><input type="text" data-ng="' + esc(c.id) + '" aria-label="קבוצה חדשה" placeholder="קבוצה חדשה" style="max-width:220px"><button class="dlm-btn small" data-addg="' + esc(c.id) + '">➕ הוספת קבוצה</button></div></div>'
        + '<div class="dlm-qr" data-qr="' + esc(joinUrl(c.code)) + '"></div></div></div>').join('')
      + '<h3>כיתה חדשה</h3><div class="dlm-grid2"><div><label for="cn">שם הכיתה</label><input type="text" id="cn" placeholder="למשל: הוראת מדעים, שנה ב׳"></div><div><label for="cg">שמות הקבוצות (שורה לכל קבוצה, רשות)</label><textarea id="cg" placeholder="למשל: קבוצה 1"></textarea></div></div>'
      + '<p><button class="dlm-btn main" id="cadd">הוספת הכיתה</button></p><div id="ccm"></div></div>';
    tab().querySelectorAll('[data-qr]').forEach((n) => U.qr(n, n.dataset.qr));
    tab().querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy); b.textContent = '✓ הועתק'; });
    tab().querySelectorAll('[data-recode]').forEach((b) => b.onclick = async () => { if (!confirm('לבטל את הקוד הנוכחי ולהפיק קוד חדש? ה־QR הישן יפסיק לעבוד.')) return; try { const r = await call('f.classCode', { id: a.id, classId: b.dataset.recode }); S.a = r.activity; tabClasses(); } catch (e) { fail(e, tab()); } });
    tab().querySelectorAll('[data-addg]').forEach((b) => b.onclick = async () => { const v = tab().querySelector('[data-ng="' + b.dataset.addg + '"]').value.trim(); if (!v) return; try { const r = await call('f.classEdit', { id: a.id, classId: b.dataset.addg, addGroup: v }); S.a = r.activity; tabClasses(); } catch (e) { fail(e, tab()); } });
    $('#cadd').onclick = async () => { try { const r = await call('f.classAdd', { id: a.id, name: $('#cn').value, groups: $('#cg').value.split('\n').map((x) => x.trim()).filter(Boolean) }); S.a = r.activity; tabClasses(); } catch (e) { $('#ccm').innerHTML = msg(e.message, 'err'); } };
  }

  function tabResearch() {
    const r = S.a.research;
    tab().innerHTML = '<div class="dlm-card"><h2>מחקר והסכמה מדעת</h2><label style="font-weight:400"><input type="checkbox" id="re"' + (r.enabled ? ' checked' : '') + '> הפעילות מלווה במחקר</label>'
      + '<p class="dlm-hint">המשתתפים רואים את ההסבר ושתי אפשרויות נפרדות, שאף אחת מהן לא מסומנת מראש: השתתפות במחקר, או בפעילות הלימודית בלבד. הנוסח כאן טיוטה, והנוסח הסופי לפי אישור ועדת האתיקה. כל שינוי בנוסח מקבל גרסה חדשה, וכל הסכמה נשמרת עם הגרסה שבה ניתנה. גרסה נוכחית: ' + esc(r.consentVersion) + '</p>'
      + '<label for="reth">מספר אישור ועדת האתיקה</label><input type="text" id="reth" value="' + esc(r.ethics) + '" placeholder="' + esc(M.CONSENT.ethics) + '">'
      + '<label for="rcon">פרטי קשר לשאלות</label><input type="text" id="rcon" value="' + esc(r.contact) + '" placeholder="למשל: מייל של צוות המחקר">'
      + M.CONSENT.sections.filter((s) => s.k !== 'contact').map((s) => '<label for="rs-' + s.k + '">' + esc(s.t) + '</label><textarea id="rs-' + s.k + '" placeholder="' + esc(s.k === 'who' ? M.CONSENT.researchers : s.d) + '">' + esc((r.sections || {})[s.k] || '') + '</textarea>').join('')
      + '<p class="dlm-hint">שדה ריק מציג את הנוסח המוצע (שמופיע בתוך השדה).</p><p><button class="dlm-btn main" id="rsave">שמירה</button></p><div id="rm"></div></div>';
    $('#rsave').onclick = async () => {
      const sections = {}; M.CONSENT.sections.filter((s) => s.k !== 'contact').forEach((s) => { sections[s.k] = $('#rs-' + s.k).value; });
      try { await save({ research: { enabled: $('#re').checked, ethics: $('#reth').value, contact: $('#rcon').value, sections } }); tabResearch(); $('#rm').innerHTML = msg('נשמר.'); } catch (e) { $('#rm').innerHTML = msg(e.message, 'err'); }
    };
  }

  // ── הלוחות בזמן אמת ──
  async function tabBoards() {
    tab().innerHTML = '<div class="dlm-card"><div class="dlm-row" style="justify-content:space-between"><h2 style="margin:0">הלוחות</h2><button class="dlm-btn small" id="bref">רענון</button></div><div id="blist"><p>טוען…</p></div></div><div id="bview"></div>';
    $('#bref').onclick = loadBoards; await loadBoards();
    S.timer = setInterval(() => { if (!document.hidden && S.tab === 'boards' && !dlg.open) { loadBoards(); if (S.g) viewBoard(S.g, true); } }, 8000);
  }
  async function loadBoards() {
    try { const r = await call('f.boards', { id: S.a.id }); const el = $('#blist'); if (!el) return;
      el.innerHTML = r.boards.length ? '<table class="dlm-table"><thead><tr><th>הלוח</th><th>כרטיסים</th><th>מקורות</th><th>התרעות</th><th>מסקנה</th></tr></thead><tbody>'
        + r.boards.map((b) => '<tr><td><a href="#" data-g="' + esc(b.groupId) + '">' + esc(b.name) + '</a></td><td>' + b.items + '</td><td>' + (b.sources || 0) + '</td><td>' + (b.alerts || 0) + '</td><td>' + (b.conclusion ? '✓ הוגשה' : '') + '</td></tr>').join('') + '</tbody></table>'
        : '<p>אין עדיין לוחות. אפשר להוסיף כיתה ולפתוח את הפעילות.</p>';
      el.querySelectorAll('[data-g]').forEach((a) => a.onclick = (e) => { e.preventDefault(); viewBoard(a.dataset.g); });
    } catch (e) { const el = $('#blist'); if (el) el.innerHTML = msg(e.message, 'err'); }
  }
  async function viewBoard(g, quiet) {
    S.g = g;
    try {
      const r = await call('f.board', { id: S.a.id, g }); const b = S.board = r.board; const v = $('#bview'); if (!v) return;
      const keepScroll = quiet ? window.scrollY : null;
      v.innerHTML = '<div class="dlm-card"><h2>הלוח</h2><p class="dlm-hint">תצוגה בלבד. התגובות האישיות והרפלקציות אינן מוצגות כאן.</p><div class="dlm-boardwrap"><div>' + U.boardHTML(b, { readOnly: true }) + '</div><aside>' + M.legendHTML() + '</aside></div>'
        + (b.challenges.length ? '<h3>מידע מאתגר</h3><ul>' + b.challenges.map((c) => '<li>' + esc(c.info) + (c.decision ? ' · <b>' + esc({ update: 'עדכנו את הלוח', keep: 'השאירו את הלוח', open: 'נשאר פתוח' }[c.decision.value]) + '</b>' + (c.decision.note ? ': ' + esc(c.decision.note) : '') : ' · טרם הוחלט') + '</li>').join('') + '</ul>' : '')
        + (b.conclusion ? '<h3>המסקנה המותנית' + (b.conclusion.submitted ? ' (הוגשה)' : ' (טיוטה)') + '</h3>' + M.CONCLUSION_Q.map((q) => b.conclusion[q.k] ? '<p><b>' + esc(q.t) + '</b> ' + esc(b.conclusion[q.k]) + '</p>' : '').join('') : '')
        + (b.alerts.length ? '<h3>התרעות</h3><ul>' + b.alerts.map((al) => '<li>⚠ ' + esc(al.type === 'media' ? 'בירור מדיה' : 'סימני קונספירציה') + ': ' + esc(al.target.slice(0, 120)) + ' · תגובות: ' + al.responses.length + '</li>').join('') + '</ul>' : '')
        + '<h3>דיווחים על בעיות</h3>' + (b.reports.length ? '<table class="dlm-table"><thead><tr><th>על מה</th><th>הבעיה</th><th>מצב</th></tr></thead><tbody>' + b.reports.map((x) => '<tr><td>' + esc({ source: 'מקור', ai: 'תשובת AI', assessment: 'הערכת אמינות', alert: 'התרעה' }[x.target]) + '</td><td>' + esc(x.text) + '</td><td><select data-rep="' + esc(x.id) + '" aria-label="מצב הדיווח">'
          + [['new', 'חדש'], ['reviewed', 'נקרא'], ['fixed', 'תוקן'], ['dismissed', 'לא נדרש שינוי']].map(([k, t]) => '<option value="' + k + '"' + (x.status === k ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></td></tr>').join('') + '</tbody></table>' : '<p class="dlm-hint">אין דיווחים.</p>')
        + '</div>';
      v.querySelectorAll('[data-src]').forEach((x) => x.onclick = () => { const s = U.sourceById(b, x.dataset.src); if (s) openDlg(U.sourceCardHTML(s, b, { openWhy: true })); });
      v.querySelectorAll('[data-rep]').forEach((x) => x.onchange = () => call('f.reportStatus', { id: S.a.id, g, reportId: x.dataset.rep, status: x.value }).catch((e) => fail(e, v)));
      if (keepScroll != null) window.scrollTo(0, keepScroll);
    } catch (e) { if (!quiet) fail(e, $('#bview')); }
  }

  function tabExport() {
    tab().innerHTML = '<div class="dlm-card"><h2>ייצוא מחקרי</h2><p>הקובץ כולל רק משתתפים שהסכימו למחקר (לפי ההחלטה האחרונה שלהם). תרומות של מי שלא הסכים/ה אינן נכללות. מסקנה קבוצתית נכללת רק כשכל מי שתרם/ה לה הסכים/ה. הנתונים פסאודונימיים: קודים אקראיים, בלי שמות.</p>'
      + '<p><button class="dlm-btn main" id="exp">הורדת קובץ JSON</button></p><div id="em"></div>'
      + '<h2>מחיקת הפעילות</h2><p class="dlm-hint">מוחקת את הפעילות, את הלוחות ואת כל מה שהמשתתפים כתבו. אי אפשר לבטל.</p><button class="dlm-btn red" id="del">מחיקת הפעילות</button></div>';
    $('#exp').onclick = async () => {
      try { const r = await call('f.export', { id: S.a.id }); const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'begood-dilemma-' + S.a.id.slice(0, 8) + '-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
        $('#em').innerHTML = msg('הקובץ ירד: ' + r.participants.filter((p) => !p.excluded).length + ' משתתפים במחקר, ' + r.participants.filter((p) => p.excluded).length + ' לא נכללו.'); }
      catch (e) { $('#em').innerHTML = msg(e.message, 'err'); }
    };
    $('#del').onclick = async () => { if (!confirm('למחוק את הפעילות ואת כל הנתונים שלה? אי אפשר לבטל.')) return; try { await call('f.delete', { id: S.a.id }); list(); } catch (e) { fail(e, tab()); } };
  }

  // ── מצב הקרנה (12/11/2026): מסך מלא באותיות גדולות, בלי כפתורי עבודה ובלי קודים אישיים.
  // כל הקבוצות יחד (תקציר לכל קבוצה) או קבוצה אחת בגדול, מעבר אוטומטי בין הקבוצות, ו־QR של הכיתה למי שמצטרף/ת.
  // התגובות האישיות והרפלקציות לא מגיעות לכאן בכלל (השרת לא שולח אותן למנחה).
  const P = { cls: null, view: 'all', g: null, auto: false, qr: true, zoom: 1, timer: null, rot: null, boards: {} };
  function projector() {
    const a = S.a; if (!a.classes.length) return;
    P.cls = P.cls && a.classes.some((c) => c.id === P.cls) ? P.cls : a.classes[0].id;
    let ov = $('#dlmProj');
    if (!ov) { ov = document.createElement('div'); ov.id = 'dlmProj'; ov.className = 'dlm-proj dlm-page'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'מצב הקרנה'); document.body.appendChild(ov); }
    ov.hidden = false; document.documentElement.classList.add('dlm-proj-on');
    try { if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {}); } catch (e) {}
    drawProj(); projLoad();
    clearInterval(P.timer); P.timer = setInterval(() => { if (!document.hidden) projLoad(); }, 8000);
    document.addEventListener('keydown', projKey);
  }
  function projKey(e) {
    if (e.key === 'Escape') projClose();
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') projStep(e.key === 'ArrowLeft' ? 1 : -1);
  }
  function projClose() {
    clearInterval(P.timer); clearInterval(P.rot); P.auto = false;
    const ov = $('#dlmProj'); if (ov) ov.hidden = true; document.documentElement.classList.remove('dlm-proj-on');
    document.removeEventListener('keydown', projKey);
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  }
  const projCls = () => S.a.classes.find((c) => c.id === P.cls) || S.a.classes[0];
  const projGroups = () => (S.a.mode === 'personal' ? Object.keys(P.boards).map((g) => ({ id: g, name: 'עבודה אישית ' + g.slice(-4).toUpperCase() })) : projCls().groups);
  function projStep(d) {
    const gs = projGroups(); if (!gs.length) return;
    const i = gs.findIndex((g) => g.id === P.g);
    P.view = 'one'; P.g = gs[((i < 0 ? -1 : i) + d + gs.length) % gs.length].id; drawProj();
  }
  async function projLoad() {
    try {
      const a = S.a, gs = a.mode === 'personal' ? (await call('f.boards', { id: a.id })).boards.filter((b) => /^p-/.test(b.groupId)).map((b) => b.groupId) : projCls().groups.map((g) => g.id);
      const want = P.view === 'one' && P.g ? [P.g] : gs;
      const got = await Promise.all(want.map((g) => call('f.board', { id: a.id, g }).then((r) => [g, r.board]).catch(() => [g, null])));
      if (a.mode === 'personal') for (const k of Object.keys(P.boards)) if (!gs.includes(k)) delete P.boards[k];
      for (const [g, b] of got) if (b) P.boards[g] = b;
      drawProj(true);
    } catch (e) {}
  }
  // תצוגה בלי קודים אישיים: מסירים את "by" לפני הציור.
  const anon = (b) => b && Object.assign({}, b, { items: (b.items || []).map((i) => Object.assign({}, i, { by: '' })) });
  function groupSummary(g) {
    const b = P.boards[g.id], items = (b && b.items) || [];
    const zone = (k) => items.filter((i) => i.zone === k);
    const srcs = zone('sources'), cl = zone('claims'), q = zone('questions');
    const conc = b && b.conclusion && b.conclusion.submitted;
    return '<button type="button" class="dlm-proj-tile" data-pg="' + esc(g.id) + '"><h2>' + esc(g.name) + (conc ? ' <span class="dlm-tag ok">✓ מסקנה</span>' : '') + '</h2>'
      + '<p class="dlm-proj-count">' + items.length + ' כרטיסים · ' + srcs.length + ' מקורות' + (b && b.alerts.length ? ' · ⚠ ' + b.alerts.length : '') + '</p>'
      + (srcs.length ? '<p class="dlm-proj-dots">' + srcs.map((i) => { const s = i.sourceId && U.sourceById(b, i.sourceId); return s ? M.dotHTML(U.scoreNow(s, b)) : ''; }).join(' ') + '</p>' : '')
      + (cl.length ? '<ul>' + cl.slice(-3).map((i) => '<li>' + esc(i.text.slice(0, 90)) + '</li>').join('') + '</ul>' : '<p class="dlm-hint">עוד אין טענות בלוח</p>')
      + (q.length ? '<p class="dlm-hint">❓ ' + esc(q[q.length - 1].text.slice(0, 80)) + '</p>' : '') + '</button>';
  }
  function drawProj(soft) {
    const ov = $('#dlmProj'); if (!ov || ov.hidden) return;
    const a = S.a, c = projCls(), gs = projGroups();
    if (P.view === 'one' && !gs.some((g) => g.id === P.g)) P.view = 'all';
    const url = joinUrl(c.code);
    const scroll = soft ? (ov.querySelector('.dlm-proj-body') || {}).scrollTop : 0;
    let bodyHTML;
    if (P.view === 'one') {
      const g = gs.find((x) => x.id === P.g), b = P.boards[P.g];
      const conc = b && b.conclusion;
      bodyHTML = '<h2 class="dlm-proj-gname">' + esc(g.name) + '</h2>' + (b ? '<div class="dlm-boardwrap"><div>' + U.boardHTML(anon(b), { readOnly: true }) + '</div><aside>' + M.legendHTML() + '</aside></div>'
        + (conc && (conc.confident || conc.disputed || conc.next) ? '<div class="dlm-card soft"><h3>המסקנה המותנית' + (conc.submitted ? ' (הוגשה)' : ' (בעבודה)') + '</h3>' + M.CONCLUSION_Q.map((q) => conc[q.k] ? '<p><b>' + esc(q.t) + '</b> ' + esc(conc[q.k]) + '</p>' : '').join('') + '</div>' : '')
        : '<p>טוען…</p>');
    } else {
      bodyHTML = gs.length ? '<div class="dlm-proj-grid">' + gs.map(groupSummary).join('') + '</div>' : '<p class="dlm-hint">עוד אין לוחות. אפשר לסרוק את ה־QR ולהצטרף.</p>';
    }
    ov.innerHTML = '<div class="dlm-proj-bar dlm-noprint">'
      + (a.classes.length > 1 ? '<select id="pjCls" aria-label="הכיתה">' + a.classes.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>' : '')
      + '<button type="button" class="dlm-btn small' + (P.view === 'all' ? ' main' : '') + '" data-pv="all">כל הקבוצות</button>'
      + gs.map((g) => '<button type="button" class="dlm-btn small' + (P.view === 'one' && P.g === g.id ? ' main' : '') + '" data-pg="' + esc(g.id) + '">' + esc(g.name) + '</button>').join('')
      + '<span class="dlm-proj-sep"></span>'
      + '<button type="button" class="dlm-btn small' + (P.auto ? ' main' : '') + '" id="pjAuto">' + (P.auto ? '⏸ עצירת המעבר' : '▶ מעבר אוטומטי') + '</button>'
      + '<button type="button" class="dlm-btn small" id="pjQr">' + (P.qr ? 'הסתרת ה־QR' : 'הצגת ה־QR') + '</button>'
      + '<button type="button" class="dlm-btn small" id="pjMinus" aria-label="הקטנת הטקסט">א־</button><button type="button" class="dlm-btn small" id="pjPlus" aria-label="הגדלת הטקסט">א+</button>'
      + '<button type="button" class="dlm-btn small red" id="pjExit">✕ יציאה</button></div>'
      + '<div class="dlm-proj-body" style="font-size:' + P.zoom + 'em">'
      + '<header class="dlm-proj-head"><div><h1>' + esc(a.dilemma.title || a.title) + '</h1><p class="dlm-gq">' + esc(M.GUIDING_QUESTION) + '</p></div>'
      + (P.qr ? '<div class="dlm-proj-qr"><div class="dlm-qr" id="pjQrBox"></div><p>להצטרפות: סריקה, או קוד הכיתה <b dir="ltr">' + esc(c.code) + '</b></p></div>' : '') + '</header>'
      + bodyHTML + '</div>';
    if (P.qr) U.qr($('#pjQrBox'), url);
    const pb = ov.querySelector('.dlm-proj-body'); if (soft && scroll) pb.scrollTop = scroll;
    if ($('#pjCls')) $('#pjCls').onchange = () => { P.cls = $('#pjCls').value; P.view = 'all'; P.boards = {}; drawProj(); projLoad(); };
    ov.querySelectorAll('[data-pv]').forEach((b) => b.onclick = () => { P.view = 'all'; drawProj(); projLoad(); });
    ov.querySelectorAll('[data-pg]').forEach((b) => b.onclick = () => { P.view = 'one'; P.g = b.dataset.pg; drawProj(); projLoad(); });
    ov.querySelectorAll('.dlm-proj-body [data-src]').forEach((x) => x.onclick = () => { const b = P.boards[P.g]; const s = b && U.sourceById(b, x.dataset.src); if (s) openDlg(U.sourceCardHTML(s, b, { openWhy: true })); });
    $('#pjAuto').onclick = () => { P.auto = !P.auto; clearInterval(P.rot); if (P.auto) { projStep(1); P.rot = setInterval(() => { projStep(1); projLoad(); }, 20000); } else drawProj(); };
    $('#pjQr').onclick = () => { P.qr = !P.qr; drawProj(); };
    $('#pjPlus').onclick = () => { P.zoom = Math.min(1.8, +(P.zoom + 0.1).toFixed(1)); drawProj(true); };
    $('#pjMinus').onclick = () => { P.zoom = Math.max(0.8, +(P.zoom - 0.1).toFixed(1)); drawProj(true); };
    $('#pjExit').onclick = projClose;
  }

  list();
})();
