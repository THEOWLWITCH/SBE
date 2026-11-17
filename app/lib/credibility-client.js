// בדיקת אמינות של מקורות: עזרים משותפים לדף המרצות ולדף הצוותים (SBE_CRD_UI).
//  api(op, input, cred): POST /api/access {action:'crdCall'} (העלאה והורדה של קבצים: /api/access-upload).
//  model(system, user, auth, maxTokens): פנייה למודל ברקע (/api/complete + /api/pipeline-status), עם _auth בשתי הבקשות.
//  ask/say: חלונות בתוך הדף (confirm ו־prompt לא עובדים בכל הדפדפנים).
(function () {
  'use strict';
  const M = window.SBE_CRED, esc = M.esc;
  const SERVER = (typeof window.sbeAIOrigin === 'function' && window.sbeAIOrigin()) || 'https://sbe-server.onrender.com';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function api(op, input, cred) {
    const body = Object.assign({ action: 'crdCall', op, input: input || {} }, cred || {});
    const path = ['p.upload', 'p.file', 'f.file'].includes(op) ? '/api/access-upload' : '/api/access';
    let r;
    try { r = await fetch(SERVER + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { const x = new Error('אין כרגע חיבור לשרת. אפשר לנסות שוב בעוד רגע.'); x.offline = true; throw x; }
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
  // user: טקסט, או מערך של חלקים (טקסט, תמונה, PDF)
  async function model(system, user, auth, maxTokens) {
    const base = { system, messages: [{ role: 'user', content: user }], maxTokens: maxTokens || 2000, fast: true };
    const s = await post('/api/complete', Object.assign({}, base, { async: true }, auth ? { _auth: auth } : {}), 120000);
    if (!s.ok || s.data.error) { const e = new Error(s.data.error || ('שגיאת שרת ' + s.status)); e.status = s.status; throw e; }
    if (!s.data.jobId) { if (typeof s.data.text === 'string') return s.data.text; throw new Error('אין תשובה'); }
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      await sleep(document.hidden ? 6000 : 2500);
      let r; try { r = await post('/api/pipeline-status', Object.assign({ jobId: s.data.jobId }, auth ? { _auth: auth } : {}), 30000); } catch (e) { continue; }
      if (!r.ok) { const e = new Error(r.data.error || ('status ' + r.status)); e.status = r.status; throw e; }
      if (r.data.status === 'done' && typeof r.data.text === 'string') return r.data.text;
      if (r.data.status === 'error' || r.data.status === 'lost' || r.data.status === 'unknown') throw new Error(r.data.error || 'הקריאה למודל לא הושלמה');
    }
    throw new Error('המודל לא הספיק לענות בזמן. אפשר לנסות שוב.');
  }
  function blobOf(r) { const bin = atob(r.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], { type: r.type }); }
  function showFile(r, dl) {
    const url = URL.createObjectURL(blobOf(r));
    if (dl) { const a = document.createElement('a'); a.href = url; a.download = r.name || 'קובץ'; document.body.appendChild(a); a.click(); a.remove(); } else window.open(url, '_blank', 'noopener');
  }
  function readFile(file) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(new Error('הקובץ לא נקרא')); fr.readAsDataURL(file); });
  }
  // תמונה גדולה מוקטנת בדפדפן לפני ההעלאה
  async function shrinkImage(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size < 1_500_000) return null;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    } catch (e) { return null; } finally { URL.revokeObjectURL(url); }
  }
  function askBox(text, o) {
    o = o || {};
    return new Promise((res) => {
      const d = document.createElement('dialog'); d.className = 'dlm-dialog dlm-ask'; d.dir = 'rtl';
      d.innerHTML = '<div class="in"><p style="white-space:pre-line;margin:.2rem 0 .8rem">' + esc(text) + '</p>'
        + (o.input !== undefined ? '<input type="text" class="crd-ask-in" style="width:100%;box-sizing:border-box;margin-bottom:.8rem">' : '')
        + '<div class="dlm-row"><button type="button" class="dlm-btn main" data-ok>' + esc(o.ok || 'אישור') + '</button>' + (o.alert ? '' : '<button type="button" class="dlm-btn" data-no>' + esc(o.no || 'ביטול') + '</button>') + '</div></div>';
      document.body.appendChild(d);
      const inp = d.querySelector('.crd-ask-in'); if (inp) inp.value = o.input || '';
      const done = (v) => { try { d.close(); } catch (e) {} d.remove(); res(v); };
      d.querySelector('[data-ok]').onclick = () => done(inp ? inp.value : true);
      const no = d.querySelector('[data-no]'); if (no) no.onclick = () => done(inp ? null : false);
      d.addEventListener('cancel', (e) => { e.preventDefault(); done(o.alert ? true : inp ? null : false); });
      try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
      (inp || d.querySelector('[data-ok]')).focus();
    });
  }
  const ask = (t, o) => askBox(t, o), askText = (t, def) => askBox(t, { input: def || '' }), say = (t) => askBox(t, { alert: true, ok: 'סגירה' });
  function loadQR() {
    if (window.QRCode) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  async function qr(node, text, size) { node.innerHTML = ''; try { await loadQR(); new window.QRCode(node, { text, width: size || 180, height: size || 180, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { node.textContent = 'לא ניתן לצייר QR כרגע. אפשר להעתיק את הקישור.'; } }

  // כרטיס הערכה של המודל
  function assessHTML(r, title) {
    if (!r) return '';
    const l = M.levelOf(r.score);
    const li = (arr) => arr && arr.length ? '<ul>' + arr.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '';
    return '<div class="crd-assess"><div class="crd-assess-h">' + M.dotHTML(r.score, { big: true }) + '<div><b>' + esc(title) + '</b><br>' + esc(l ? l.score + ' · ' + l.name : 'לא ניתן להעריך כרגע') + '</div></div>'
      + '<p>' + esc(r.summary) + '</p>'
      + (r.basis && r.basis.length ? '<h4>על מה זה נשען</h4>' + li(r.basis) : '')
      + (r.missing && r.missing.length ? '<h4>מה חסר כדי לדעת יותר</h4>' + li(r.missing) : '')
      + (r.warnings && r.warnings.length ? '<h4>סימנים שכדאי לבדוק</h4>' + li(r.warnings) : '')
      + (r.checks && r.checks.length ? '<h4>מה כדאי לחקור, ואיפה</h4><ol>' + r.checks.map((c) => '<li><b>' + esc(c.what) + '</b>' + (c.where ? ': ' + esc(c.where) : '') + '</li>').join('') + '</ol>' : '')
      + (r.vsTeam ? '<h4>מול הציון שלכם</h4><p>' + esc(r.vsTeam) + '</p>' : '') + (r.changed ? '<h4>מה השתנה מההערכה הראשונה</h4><p>' + esc(r.changed) + '</p>' : '')
      + (r.process && (r.process.strong.length || r.process.improve.length || r.process.tip) ? '<h4>משוב על תהליך הבדיקה שלכם</h4>' + (r.process.strong.length ? '<p><b>מה עשיתם טוב</b></p>' + li(r.process.strong) : '') + (r.process.improve.length ? '<p><b>מה אפשר לעשות אחרת בבדיקה הבאה</b></p>' + li(r.process.improve) : '') + (r.process.tip ? '<p><b>עצה לבדיקה הבאה:</b> ' + esc(r.process.tip) + '</p>' : '') : '')
      + '<p class="dlm-hint">זו הצעה של AI לבדיקה. ה־AI אינו מחובר לאינטרנט ויכול לטעות.</p></div>';
  }
  function scoresRow(k) {
    const cell = (t, v) => '<div class="crd-sc"><span>' + esc(t) + '</span>' + M.dotHTML(v === undefined ? null : v) + '</div>';
    return '<div class="crd-scores">' + cell('הצוות', k.team ? k.team.score : undefined) + '<span class="crd-arr">←</span>' + cell('AI, ראשונה', k.first ? k.first.score : undefined) + '<span class="crd-arr">←</span>' + cell('AI, חוזרת', k.final ? k.final.score : undefined) + '</div>';
  }
  window.SBE_CRD_UI = { SERVER, api, model, showFile, blobOf, readFile, shrinkImage, ask, askText, say, qr, assessHTML, scoresRow };
})();
