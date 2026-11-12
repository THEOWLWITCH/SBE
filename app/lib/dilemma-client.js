// בירור דילמות: עזרים משותפים לדף המנחה ולדף המשתתפים (SBE_DLM_UI).
//  api(op, input, cred): POST /api/access {action:'dlmCall'}. cred = {token} למנחה, או {a, p, key} למשתתף/ת.
//  ai(action, ctx, auth): פנייה למודל דרך /api/complete (ברקע) ו-/api/pipeline-status, עם _auth בשתי הבקשות.
//     המשתתפים לא טוענים את access-guard.js, ולכן _auth נבנה כאן: {page:'dilemma-join.html', dlm:{a,p,key}}.
//  scoreNow(source, board): הציון הנוכחי (ההערכה האחרונה) או null (אפור).  boardHTML, sourceCardHTML.
(function () {
  'use strict';
  const M = window.SBE_DILEMMA, esc = M.esc;
  const SERVER = (typeof window.sbeAIOrigin === 'function' && window.sbeAIOrigin()) || 'https://sbe-server.onrender.com';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function api(op, input, cred) {
    const body = Object.assign({ action: 'dlmCall', op, input: input || {} }, cred || {});
    let r;
    try { r = await fetch(SERVER + '/api/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { const x = new Error('אין כרגע חיבור לשרת. מה שכתבתם נשמר במכשיר, ואפשר לנסות שוב בעוד רגע.'); x.offline = true; throw x; }
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const x = new Error(j.error || ('שגיאה ' + r.status)); x.status = r.status; throw x; }
    return j;
  }

  async function post(path, body, ms) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(SERVER + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
      let j = {}; try { j = await r.json(); } catch (e) {}
      return { ok: r.ok, status: r.status, data: j };
    } finally { clearTimeout(t); }
  }
  // auth: למשתתפים {page, dlm}; למנחה {token, page} (או בלי, ואז access-guard.js מוסיף בעצמו).
  async function callModel(system, user, auth, maxTokens) {
    const base = { system, messages: [{ role: 'user', content: user }], maxTokens: maxTokens || 1800, fast: true };
    const s = await post('/api/complete', Object.assign({}, base, { async: true }, auth ? { _auth: auth } : {}), 90000);
    if (!s.ok || s.data.error) { const e = new Error(s.data.error || ('שגיאת שרת ' + s.status)); e.status = s.status; throw e; }
    if (!s.data.jobId) { if (typeof s.data.text === 'string') return s.data.text; throw new Error('אין תשובה'); }
    const t0 = Date.now();
    while (Date.now() - t0 < 180000) {
      await sleep(document.hidden ? 6000 : 2500);
      let r; try { r = await post('/api/pipeline-status', Object.assign({ jobId: s.data.jobId }, auth ? { _auth: auth } : {}), 30000); } catch (e) { continue; }
      if (!r.ok) { const e = new Error(r.data.error || ('status ' + r.status)); e.status = r.status; throw e; }
      if (r.data.status === 'done' && typeof r.data.text === 'string') return r.data.text;
      if (r.data.status === 'error' || r.data.status === 'lost' || r.data.status === 'unknown') throw new Error(r.data.error || 'הקריאה למודל לא הושלמה');
    }
    throw new Error('timeout');
  }
  // פעולת AI על הלוח: מחזירה תשובה מנוקה (cleanAI), או זורקת שגיאה. המקורות נשלחים עם מזהים קצרים (S1...).
  async function ai(action, ctx, auth) {
    const refs = (ctx.sources || []).map((s, i) => Object.assign({}, s, { ref: 'S' + (i + 1) }));
    const user = M.aiInput(Object.assign({}, ctx, { sources: refs }));
    const text = await callModel(M.aiSystem(action), user, auth, action === 'manipulation' || action === 'assess' ? 2200 : 1800);
    const out = M.cleanAI(action, M.parseJSON(text), refs.map((r) => r.ref));
    if (!out) throw new Error('התשובה לא נקראה');
    return { out, refs, request: user };
  }

  const latest = (arr) => (arr && arr.length ? arr[arr.length - 1] : null);
  function assessOf(source, board) {
    const own = board && board.assess && board.assess[source.id];
    return latest(own) || latest(source.assessments) || null;
  }
  function scoreNow(source, board) { const a = assessOf(source, board); return a ? a.score : null; }
  function sourceById(board, id) { return ((board && board.sourcesAll) || []).find((s) => s.id === id) || null; }
  const verifyLabel = (v) => M.VERIFY[(v && v.status) || 'not_checked'] || M.VERIFY.not_checked;

  function sourceRowHTML(s, board, attrs) {
    const sc = scoreNow(s, board), v = (s.verify || {}).status || 'not_checked';
    return '<div class="dlm-src" ' + (attrs || '') + '>' + M.dotHTML(sc) + '<div><div class="t">' + esc(s.title) + '</div><div class="s">'
      + esc([s.publisher, s.date, s.type].filter(Boolean).join(' · ')) + '</div><div class="s">'
      + '<span class="dlm-tag' + (s.origin === 'ai' ? ' ai' : '') + '">' + esc(M.ORIGINS[s.origin] || '') + '</span>'
      + '<span class="dlm-tag ' + (v === 'exists' || v === 'file' ? 'ok' : 'unv') + '">' + esc(verifyLabel(s.verify)) + '</span></div></div></div>';
  }

  // כרטיס המקור המלא, בתוך חלון. actions: האם להציג פעולות (משתתפים).
  function sourceCardHTML(s, board, opts) {
    const o = opts || {}, a = assessOf(s, board), r = M.scoreOf(a ? a.score : null);
    const checks = (board && board.checks && board.checks[s.id]) || [];
    const all = [].concat(s.assessments || [], (board && board.assess && board.assess[s.id]) || []);
    const kv = (k, v) => (v ? '<b>' + esc(k) + '</b><span>' + v + '</span>' : '');
    return '<h2>' + M.dotHTML(r.score, { big: true }) + ' ' + esc(s.title) + '</h2>'
      + '<div class="dlm-kv">'
      + kv('מחבר או גוף מפרסם', esc(s.publisher)) + kv('תאריך פרסום', esc(s.date)) + kv('סוג המקור', esc(s.type))
      + kv('קישור', s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" dir="ltr">' + esc(s.url) + '</a>' : '')
      + kv('קובץ', s.fileId ? '<button type="button" class="dlm-btn small" data-file="' + esc(s.fileId) + '">פתיחת ' + esc(s.fileName || 'הקובץ') + '</button>' : '')
      + kv('מאיפה המקור', esc(M.ORIGINS[s.origin] || ''))
      + kv('סטטוס אימות', esc(verifyLabel(s.verify)) + (s.verify && s.verify.at ? ' · ' + esc(new Date(s.verify.at).toLocaleDateString('he-IL')) : '') + (s.verify && s.verify.title ? '<br><span class="dlm-hint">כותרת הדף: ' + esc(s.verify.title) + '</span>' : '') + (s.verify && s.verify.note ? '<br><span class="dlm-hint">' + esc(s.verify.note) + '</span>' : ''))
      + kv('דירוג אמינות', esc(r.score === null ? 'טרם נבדק' : r.score + ' · ' + r.label) + ' (' + esc(r.name) + ')')
      + kv('החלק במקור שעליו נשענת הטענה', esc(s.part)) + kv('קטע מהמקור', s.excerpt ? '<q>' + esc(s.excerpt) + '</q>' : '')
      + kv('בדיקה אנושית', checks.length ? esc(checks.length + ' סימונים של "בדקתי את המקור". הסימון נרשם, ואינו מעיד בהכרח על בדיקה מעמיקה.') : 'עדיין לא סומן "בדקתי את המקור"')
      + '</div>'
      + '<details' + (o.openWhy ? ' open' : '') + '><summary><b>למה זה הציון?</b></summary>'
      + (a ? '<p>' + esc(a.explanation || 'לא נכתב הסבר.') + '</p>'
        + (a.claim ? '<p><b>הטענה שנבדקה:</b> ' + esc(a.claim) + '</p>' : '')
        + (a.criteria && a.criteria.length ? '<ul>' + a.criteria.map((c) => '<li><b>' + esc((M.CRITERIA.find((k) => k.k === c.k) || {}).t || c.k) + ':</b> ' + esc(c.note) + '</li>').join('') + '</ul>' : '')
        + (a.relevance ? '<p><b>רלוונטיות:</b> ' + esc(a.relevance) + '</p>' : '') + (a.limits ? '<p><b>מגבלות ההערכה:</b> ' + esc(a.limits) + '</p>' : '')
        + '<p class="dlm-hint">הערכה ' + esc(a.method === 'ai' ? 'של AI' : a.method === 'facilitator' ? 'של המנחה' : 'של משתתף/ת') + ' · ' + esc(new Date(a.at).toLocaleString('he-IL')) + ' · ' + esc(a.rubric || M.RUBRIC_VERSION)
        + (a.human ? ' · נבדקה בידי המנחה' + (a.human.agree === false ? ' (המנחה לא הסכים/ה: ' + esc(a.human.note) + ')' : a.human.note ? ': ' + esc(a.human.note) : '') : '') + '</p>'
        : '<p>' + esc(M.RUBRIC_NOTES.grey) + '</p>')
      + (all.length > 1 ? '<p class="dlm-hint">היסטוריית הערכות: ' + all.map((x) => (x.score === null ? '—' : x.score)).join(' ← ') + '</p>' : '')
      + '<p class="dlm-hint">' + esc(M.RUBRIC_NOTES.remember.join(' ')) + '</p></details>';
  }

  // הלוח: שישה אזורים, כרטיסים עם קשרים, ונקודת אמינות לכל מקור. readOnly למנחה.
  function boardHTML(board, opts) {
    const o = opts || {}, items = (board && board.items) || [];
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    const alertsOf = (id) => ((board && board.alerts) || []).filter((a) => a.itemId === id);
    const conf = (k) => (M.CONFIDENCE.find((c) => c.k === k) || {}).t;
    const zone = (z) => {
      const list = items.filter((i) => i.zone === z.k);
      return '<section class="dlm-zone" data-zone="' + z.k + '" aria-label="' + esc(z.t) + '"><h3>' + esc(z.t) + '</h3><p class="dlm-hint">' + esc(z.d) + '</p>'
        + list.map((i) => {
          const s = i.sourceId ? sourceById(board, i.sourceId) : null;
          const links = ((board && board.links) || []).filter((l) => l.from === i.id).map((l) => {
            const to = byId[l.to]; return to ? '<div>↳ ' + esc((M.RELATIONS.find((r) => r.k === l.rel) || {}).t) + ': ' + esc(to.text.slice(0, 50)) + (o.readOnly ? '' : ' <button type="button" class="dlm-btn small" data-unlink="' + esc(l.id) + '" aria-label="הסרת הקשר">✕</button>') + '</div>' : '';
          }).join('');
          const al = alertsOf(i.id);
          return '<div class="dlm-item' + (o.sel === i.id ? ' sel' : '') + '" data-item="' + esc(i.id) + '">'
            + (s ? M.dotHTML(scoreNow(s, board)) + ' ' : '') + (al.length ? '<span class="dlm-warnmark" title="התרעה: לבדיקה" aria-label="יש התרעה לבדיקה">⚠</span> ' : '')
            + esc(i.text)
            + '<div class="meta">' + (i.origin === 'ai' ? '<span class="dlm-tag ai">AI</span>' : '') + (s && s.origin === 'ai' && !['exists', 'file'].includes((s.verify || {}).status) ? '<span class="dlm-tag unv">טרם אומת</span>' : '')
            + (i.confidence ? '<span class="dlm-tag">ביטחון בטענה: ' + esc(conf(i.confidence)) + '</span>' : '') + '<span>' + esc(i.by || '') + '</span></div>'
            + (links ? '<div class="dlm-links">' + links + '</div>' : '')
            + (o.readOnly ? (s ? '<div class="acts"><button type="button" data-src="' + esc(s.id) + '">כרטיס המקור</button></div>' : '')
              : '<div class="acts">' + (s ? '<button type="button" data-src="' + esc(s.id) + '">כרטיס המקור</button>' : '')
              + '<button type="button" data-edit="' + esc(i.id) + '">עריכה</button><button type="button" data-link="' + esc(i.id) + '">קשר לכרטיס</button>'
              + (z.k !== 'sources' ? '<button type="button" data-conf="' + esc(i.id) + '">מידת ביטחון</button>' : '')
              + '<button type="button" data-alert="' + esc(i.id) + '">בדיקת סימני מניפולציה</button><button type="button" data-del="' + esc(i.id) + '">הסרה</button></div>')
            + '</div>';
        }).join('')
        + (o.readOnly ? '' : z.k === 'sources'
          ? '<div class="dlm-add"><button type="button" class="dlm-btn small" data-addsrc="1">➕ הוספת מקור</button></div>'
          : '<form class="dlm-add" data-addto="' + z.k + '"><input type="text" aria-label="כרטיס חדש: ' + esc(z.t) + '" placeholder="למשל: ' + esc(z.k === 'claims' ? 'טענה ונימוק' : z.k === 'questions' ? 'מה עוד לבדוק?' : z.d) + '"><button class="dlm-btn small" type="submit" aria-label="הוספה">➕</button></form>')
        + '</section>';
    };
    return '<div class="dlm-board">' + M.ZONES.map(zone).join('') + '</div>';
  }

  // חומר ל־AI מהלוח: טענות ומקורות (בלי קודים אישיים).
  function boardContext(activity, board) {
    const items = (board && board.items) || [];
    const sources = ((board && board.sourcesAll) || activity.sources || []).map((s) => ({ id: s.id, title: s.title, publisher: s.publisher, date: s.date, type: s.type, url: s.url, excerpt: s.excerpt, score: scoreNow(s, board), origin: s.origin, verify: s.verify }));
    const text = M.ZONES.map((z) => { const l = items.filter((i) => i.zone === z.k); return l.length ? z.t + ':\n' + l.map((i) => '- ' + i.text).join('\n') : ''; }).filter(Boolean).join('\n');
    return { dilemma: activity.dilemma, claims: items.filter((i) => i.zone === 'claims').map((i) => i.text), sources, board: text };
  }

  function loadQR() {
    if (window.QRCode) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  async function qr(node, text) { node.innerHTML = ''; try { await loadQR(); new window.QRCode(node, { text, width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { node.textContent = 'לא ניתן לצייר QR כרגע. אפשר להעתיק את הקישור.'; } }

  window.SBE_DLM_UI = { SERVER, api, ai, callModel, scoreNow, assessOf, sourceById, sourceRowHTML, sourceCardHTML, boardHTML, boardContext, verifyLabel, qr };
})();
