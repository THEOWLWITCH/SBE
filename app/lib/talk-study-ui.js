// מסלול הסטודנטיות במחקר שיחות מאתגרות (18/11/2026): דף אחד, בלי כניסה ובלי מעבר לכלים אחרים.
// talk-study.html?c=<קוד הקבוצה>. הקוד האישי והמפתח נשמרים במכשיר (sbe.ts.<קוד>), ואפשר להמשיך במכשיר אחר בקישור אישי (#p=).
// התרגול עצמו בכלי התרגול (talk-practice.html = practice.html במצב מחקר), שמחזיר לכאן את התמליל והמשוב (sbe.ts.result).
(function () {
  'use strict';
  const T = window.SBE_TALKSTUDY, BG = window.SBE_BGSTUDY;
  const SERVER = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? '' : 'https://sbe-server.onrender.com';
  const qs = new URLSearchParams(location.search);
  const code = String(qs.get('c') || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8);
  const root = document.getElementById('root'), who = document.getElementById('who'), foot = document.getElementById('foot');
  const KEY = 'sbe.ts.' + code;
  let cred = null, me = null, cls = null;

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const draftKey = (n, part) => KEY + '.draft.' + n + '.' + part;

  async function api(op, input, tries) {
    tries = tries || 0;
    try {
      const r = await fetch(SERVER + '/api/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'tsCall', op, input }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(j.error || 'הפעולה לא הושלמה'); e.status = r.status; throw e; }
      return j;
    } catch (e) {
      if (e.status || tries >= 3) throw e.status ? e : Object.assign(new Error('אין כרגע חיבור לשרת. מה שכתבתם נשמר במכשיר, ואפשר לנסות שוב בעוד רגע.'), { offline: true });
      await new Promise((r) => setTimeout(r, 6000)); return api(op, input, tries + 1);
    }
  }
  function say(parent, text, bad) { let s = parent.querySelector(':scope > .status'); if (!s) { s = el('p', 'status'); s.setAttribute('role', 'status'); parent.append(s); } s.textContent = text; s.className = 'status' + (bad ? ' bad' : ''); s.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  function busy(btn, on, label) { btn.disabled = on; if (on) { btn.dataset.l = btn.textContent; btn.textContent = label || 'שומרים…'; } else if (btn.dataset.l) btn.textContent = btn.dataset.l; }

  // ── התחלה ──
  // 7777: כניסת בדיקה (22/11/2026: "תאפשר לי כניסה לגירסת הסטודנטיות עם הקוד 7777... אבטל זאת בהמשך";
  // ובאותו יום: "הרחב את ההרשאה לקוד 7777 גם לעינת ולאיבנה"). מנהלת המערכת, ומי שנכנס/ה עם קוד שיש בו בירור דילמות
  // או בדיקת אמינות של מקורות: נפתחת (או נמצאת) קבוצת בדיקה קבועה, מחוץ לכל מחקר (studyId: sys-test), ועוברים אליה (f.test).
  // לביטול: למחוק את הבלוק הזה, את f.test בשרת ואת השורה של 7777 ב-entry.html.
  async function sysTest() {
    let token = '';
    try { token = sessionStorage.getItem('sbe.session.token') || ''; if (!token) { const m = JSON.parse(localStorage.getItem('sbe.session.mirror') || 'null'); token = (m && m.data && m.data['sbe.session.token']) || ''; } } catch (e) {}
    let dev = null; try { dev = JSON.parse(localStorage.getItem('sbe.sys.device') || 'null'); } catch (e) {}
    // כניסה ישירה בלי מסך הכניסה של Be Good (24/11/2026: "אני צריכה כניסה ישירה לכלי הזה לא דרך מסך הכניסה של בי גוד.
    // עינת מסתבכת"): הקוד האישי מוקלד כאן, ונשמר במכשיר (sbe.remember.code), כך שבפעם הבאה נכנסים לבד.
    // מנהלת המערכת עם מכשיר מוכר עדיין עוברת דרך entry.html, שנכנס לבד וחוזר לכאן.
    if (!token && dev) return location.replace('entry.html?next=' + encodeURIComponent('talk-study.html?c=7777'));
    if (!token) {
      let saved = ''; try { const r = JSON.parse(localStorage.getItem('sbe.remember.code') || 'null'); saved = (r && r.code) || ''; } catch (e) {}
      if (saved) { const res = await codeLogin(saved); if (res.token) token = res.token; else if (res.error === 'wrong') { try { localStorage.removeItem('sbe.remember.code'); } catch (e) {} } }
      if (!token) return staffLogin();
    }
    root.replaceChildren(el('p', 'sub', 'פותחים את קבוצת הבדיקה…'));
    try {
      const r = await fetch(SERVER + '/api/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'tsCall', op: 'f.test', input: {}, token }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) { try { sessionStorage.removeItem('sbe.session.token'); } catch (e) {} if (r.status === 401) return staffLogin(); root.replaceChildren(card('הקוד 7777 פתוח רק לצוות המחקר', ['הקוד האישי הזה לא מורשה למצב הבדיקה.'])); return; }
      if (!r.ok || !j.class) throw new Error(j.error || 'הפעולה לא הושלמה');
      location.replace('talk-study.html?c=' + j.class.code);
    } catch (e) { root.replaceChildren(card('לא הצלחנו לפתוח את קבוצת הבדיקה', [e.message])); }
  }

  async function codeLogin(secret) {
    try {
      const r = await fetch(SERVER + '/api/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'login', kind: 'code', secret }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.token) {
        try {
          sessionStorage.setItem('sbe.session.token', d.token);
          sessionStorage.setItem('sbe.session.perms', JSON.stringify(d.perms || []));
          sessionStorage.setItem('sbe.session.info', JSON.stringify({ kind: d.kind, inst: d.inst, label: d.label, notices: d.notices || [], sub: d.sub || null, space: d.space || null }));
          sessionStorage.setItem('sbe.session.role', d.label || d.inst || '');
          sessionStorage.setItem('sbe.session.homeUrl', 'home.html');
        } catch (e) {}
        return d;
      }
      return { error: r.status === 403 ? 'wrong' : 'down' };
    } catch (e) { return { error: 'down' }; }
  }
  function staffLogin() {
    const inp = el('input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'הקוד האישי ב־Be Good');
    const stay = el('input'); stay.type = 'checkbox'; stay.checked = true;
    const btn = el('button', 'primary', 'כניסה למצב הבדיקה');
    const c = card('כניסה לצוות המחקר', ['מצב הבדיקה פתוח לצוות המחקר בלבד. אפשר להקליד כאן את הקוד האישי ב־Be Good, בלי לעבור דרך מסך הכניסה.']);
    const lab = el('label', ''); lab.style.cssText = 'display:flex;gap:8px;align-items:center;margin:10px 0;font-size:14px'; lab.append(stay, document.createTextNode('להישאר מחובר/ת במכשיר הזה, בלי קוד בפעם הבאה'));
    inp.style.cssText = 'width:100%;font-size:18px;padding:10px;margin-top:8px;direction:ltr;text-align:center';
    c.append(inp, lab, btn);
    root.replaceChildren(c); inp.focus();
    const go = async () => {
      const v = inp.value.replace(/[\u200e\u200f\u061c\s]/g, '').toUpperCase();
      if (!v) { say(c, 'אפשר להקליד את הקוד האישי.', true); return; }
      busy(btn, true, 'נכנסים… (עד כ־30 שניות)');
      const res = await codeLogin(v);
      busy(btn, false);
      if (!res.token) { say(c, res.error === 'wrong' ? 'הקוד לא נמצא. אפשר לבדוק אותו ולנסות שוב.' : 'אין כרגע חיבור לשרת. אפשר לנסות שוב בעוד רגע.', true); return; }
      try { if (stay.checked) localStorage.setItem('sbe.remember.code', JSON.stringify({ code: v, at: new Date().toISOString() })); } catch (e) {}
      sysTest();
    };
    btn.onclick = go; inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  }

  async function start() {
    if (code === '7777') return sysTest();
    if (!code) { root.replaceChildren(card('הקישור לא שלם', ['אפשר לבקש מהמרצה את הקישור לקבוצה שלכם.'])); return; }
    const m = /[#&]p=([A-Z2-9]{6})\.([a-f0-9]{48})/.exec(location.hash || '');
    if (m) { store.set(KEY, { pid: m[1], key: m[2] }); history.replaceState(null, '', location.pathname + location.search); }
    cred = store.get(KEY);
    const t = setTimeout(() => { root.replaceChildren(el('p', 'sub', 'מתחברים לשרת. החיבור הראשון נמשך עד כ־30 שניות.')); }, 2500);
    try {
      if (cred) { const r = await api('p.get', { code, pid: cred.pid, key: cred.key }); cls = r.class; me = r.participant; }
      else { cls = (await api('p.info', { code })).class; }
    } catch (e) {
      clearTimeout(t);
      if (cred && e.status === 404) { store.del(KEY); cred = null; return start(); }
      root.replaceChildren(card('לא הצלחנו לפתוח את המסלול', [e.message])); return;
    }
    clearTimeout(t);
    await takePracticeResult();
    if (justDone) { const n = justDone; justDone = 0; return doneView(n); }
    render();
  }

  // התוצאה מהתרגול (talk-practice.html) נשמרת בשרת כשחוזרים לכאן
  async function takePracticeResult() {
    if (!me) return;
    const res = store.get('sbe.ts.result');
    if (!res || res.code !== code || res.pid !== me.pid) return;
    try { const r = await api('p.save', { code, pid: cred.pid, key: cred.key, session: res.session, part: res.extra ? 'extra' : 'practice', data: res.data }); me = r.participant; store.del('sbe.ts.result'); if (!res.extra && res.session < 3) justDone = res.session;
      try { me = (await api('p.save', { code, pid: cred.pid, key: cred.key, session: res.session, part: 'autosave', data: { consumed: true } })).participant; } catch (e) {} }
    catch (e) { /* נשאר במכשיר, וננסה שוב בפעם הבאה */ }
  }

  function currentSession() { for (const n of [1, 2, 3]) if (!me.sessions?.[n]?.doneAt) return n; return 4; }
  function currentStep(n) { const s = me.sessions?.[n] || {}; for (const st of T.stepsFor(n)) { if (!s[st.id]) return st.id; } return 'done'; }
  let justDone = 0;

  function render() {
    advancePreview();
    who.textContent = me ? 'קוד המשתתף/ת: ' + me.pid : '';
    root.replaceChildren();
    const head = el('div');
    head.append(el('h1', '', cls.studyTitle || 'הכנה לשיחות מאתגרות'));
    if (!me) { head.append(el('p', 'sub', 'מסלול תרגול במחקר' + (cls.group ? ' · ' + cls.group : ''))); root.append(head); return consentView(); }
    if (cls.test) root.append(testBar());
    const n = preview ? preview.n : currentSession();
    if (n > 3) { head.append(el('p', 'sub', 'שלושת המפגשים הושלמו')); root.append(head, card('תודה רבה!', ['סיימת את כל שלושת המפגשים של המחקר. התרומה שלך חשובה לנו מאוד.', 'פנקס הכיס נשאר אצלך, לכל שיחה מאתגרת שתבוא.'])); if (cls.status === 'open') root.append(autosaveCard(3), myExercises(4, 'done')); root.append(pocketCard()); return footer(); }
    head.append(el('p', 'sub', 'מפגש ' + n + ' מתוך 3' + (cls.group ? ' · ' + cls.group : '')));
    root.append(head);
    const step = preview ? preview.step : currentStep(n);
    root.append(stepper(n, step === 'done' ? 'done' : step));
    if (cls.status !== 'open') root.append(card('המסלול סגור כרגע', ['אפשר לפנות למרצה. מה שכבר נשמר נשאר שמור.']));
    else {
      root.append(autosaveCard(n));
      if (switchTo) { const st = switchTo; switchTo = null; modelView(n, st.origin); }
      else if (step === 'pre' || step === 'post') questionnaireView(n, step);
      else if (step === 'model') modelView(n);
    else if (step === 'practice') practiceView(n);
      else if (step === 'reflection') reflectionView(n);
      root.append(myExercises(n, step), questionnairesCard(n, step));
    }
    root.append(pocketCard());
    footer();
  }

  // ── מצב בדיקה (7777, 23/11/2026: "תאפשר לראות את כל התהליך והשאלונים בקוד 7777"): מעבר חופשי לכל מפגש ולכל שלב,
  // כולל השאלונים של מפגשים 2 ו-3, והתחלה מחדש. רק בקבוצת הבדיקה (sys-test), מחוץ לכל מחקר.
  let preview = null;
  function testBar() {
    const c = el('section', 'card soft');
    c.append(el('h2', '', 'מצב בדיקה (7777): כל המסלול'), el('p', 'sub', 'אפשר לפתוח כל שלב בכל מפגש. מה ששומרים כאן נשמר בקבוצת הבדיקה בלבד, ולא נכנס למחקר.'));
    for (const n of [1, 2, 3]) {
      const row = el('p'); row.append(el('b', '', 'מפגש ' + n + ': '));
      T.stepsFor(n).forEach((st, i) => {
        if (i) row.append(document.createTextNode(' · '));
        const a = el('button', 'link', st.label + (me.sessions?.[n]?.[st.id] ? ' ✓' : ''));
        if (preview && preview.n === n && preview.step === st.id) a.style.fontWeight = '700';
        a.onclick = () => { preview = { n, step: st.id, at: me.sessions?.[n]?.[st.id]?.at || '' }; render(); window.scrollTo(0, 0); };
        row.append(a);
      });
      c.append(row);
    }
    const b = el('div', 'btns');
    const flow = el('button', 'soft', 'המסלול כפי שמשתתף/ת רואה אותו'); flow.onclick = () => { preview = null; render(); };
    const reset = el('button', 'soft', 'התחלה מחדש מההתחלה');
    reset.onclick = async () => { busy(reset, true, 'מתחילים מחדש…'); try { await api('p.withdraw', { code, pid: cred.pid, key: cred.key }); } catch (e) {} store.del(KEY); cred = null; me = null; preview = null; render(); window.scrollTo(0, 0); };
    b.append(flow, reset); c.append(b);
    return c;
  }
  // אחרי שמירה במצב בדיקה: עוברים לשלב הבא באותו מפגש
  function advancePreview() {
    if (!preview || !me) return;
    const at = me.sessions?.[preview.n]?.[preview.step]?.at || '';
    if (!at || at === preview.at) return;
    const list = T.stepsFor(preview.n).map((x) => x.id), i = list.indexOf(preview.step);
    preview = list[i + 1] ? { n: preview.n, step: list[i + 1], at: me.sessions?.[preview.n]?.[list[i + 1]]?.at || '' } : null;
  }

  function stepper(n, now) {
    const ol = el('ol', 'steps'), list = T.stepsFor(n);
    for (const st of list) {
      const li = el('li', '', st.label);
      const done = !!me.sessions?.[n]?.[st.id];
      if (st.id === now) li.className = 'now'; else if (done) li.className = 'done';
      ol.append(li);
    }
    return ol;
  }
  function card(title, paras, cls2) { const c = el('section', 'card' + (cls2 ? ' ' + cls2 : '')); c.append(el('h2', '', title)); for (const p of paras || []) c.append(el('p', '', p)); return c; }

  // ── הצטרפות (25/11/2026: שלב ההסכמה הוסר מהכלי ומהמצגת) ──
  function consentView() {
    const C = T.CONSENT, c = card(C.title, []);
    if (cls.status !== 'open') { c.append(el('p', 'status bad', 'ההצטרפות סגורה כרגע. אפשר לפנות למרצה.')); root.append(c); return footer(); }
    const rl = el('label', 'check'), want = el('input'); want.type = 'checkbox'; rl.append(want, el('span', '', C.report)); c.append(el('h3', '', 'דו״ח משוב אישי (רשות)'), rl);
    const ml = el('label', 'f', 'כתובת מייל לדו״ח'), mail = el('input'); mail.type = 'email'; mail.placeholder = 'למשל: name@example.com'; ml.hidden = mail.hidden = true;
    want.onchange = () => { ml.hidden = mail.hidden = !want.checked; };
    c.append(ml, mail);
    const go = el('button', '', 'מתחילים'), b = el('div', 'btns'); b.append(go); c.append(b);
    go.onclick = async () => {
      if (want.checked && !/^\S+@\S+\.\S+$/.test(mail.value.trim())) return say(c, 'אפשר לבדוק את כתובת המייל, או להוריד את הסימון של הדו״ח.', true);
      busy(go, true, 'מצטרפים…');
      try {
        const r = await api('p.join', { code, report: { want: want.checked, email: mail.value.trim() } });
        cred = { pid: r.pid, key: r.key }; store.set(KEY, cred); me = r.participant; render();
      } catch (e) { busy(go, false); say(c, e.message, true); }
    };
    root.append(c); footer();
  }

  // ── שאלונים ──
  function questionnaireView(n, part) {
    const def = T.questionnaire(n, part), c = card(def.title, [def.description || '']);
    const saved = store.get(draftKey(n, part)) || {};
    const read = [];
    for (const item of def.items) {
      if (/_other$/.test(item.id) && def.items.some((x) => x.id + '_other' === item.id)) continue;
      const q = el('div', 'q'); q.dataset.q = item.id;
      q.append(el('div', '', item.label));
      if (item.type === 'likert') {
        const sc = el('div', 'scale'), name = 'q_' + item.id;
        for (let v = item.min; v <= item.max; v++) { const l = el('label'), i = el('input'); i.type = 'radio'; i.name = name; i.value = String(v); if (saved[item.id] === v) i.checked = true; l.append(i, el('span', '', String(v))); sc.append(l); }
        q.append(sc);
        read.push([item.id, () => { const x = c.querySelector('input[name="' + name + '"]:checked'); return !x ? undefined : Number(x.value); }]);
      } else if (item.type === 'choice') {
        const s = el('select'); s.append(new Option('בחירת תשובה', '')); for (const o of item.options) s.append(new Option(o, o)); if (saved[item.id]) s.value = saved[item.id];
        q.append(s); read.push([item.id, () => s.value || undefined]);
        // "אחר": שדה לכתוב מה שלא נמצא ברשימה (24/11/2026)
        const oi = def.items.find((x) => x.id === item.id + '_other');
        if (oi) { const t = el('input'); t.type = 'text'; t.placeholder = 'אחר: אפשר לפרט'; t.value = saved[oi.id] || ''; t.hidden = s.value !== BG.OTHER; s.addEventListener('change', () => { t.hidden = s.value !== BG.OTHER; if (!t.hidden) t.focus(); }); q.append(t); read.push([oi.id, () => (!t.hidden && t.value.trim()) || undefined]); }
      } else {
        const t = el('textarea'); t.value = saved[item.id] || ''; q.append(t); read.push([item.id, () => t.value.trim() || undefined]);
      }
      c.append(q);
    }
    const anchors = el('p', 'sub', '1 = ' + BG.SCALE.anchors[1] + ' · 5 = ' + BG.SCALE.anchors[5]);
    c.insertBefore(anchors, c.children[2] || null);
    const collect = () => Object.fromEntries(read.map(([id, f]) => [id, f()]).filter(([, v]) => v !== undefined));
    c.addEventListener('change', (e) => { store.set(draftKey(n, part), collect()); const q = e.target.closest && e.target.closest('.q.qmiss'); if (q) q.classList.remove('qmiss'); });
    c.addEventListener('input', () => store.set(draftKey(n, part), collect()));
    const go = el('button', '', 'שמירה והמשך'), b = el('div', 'btns'); b.append(go); c.append(b);
    go.onclick = async () => {
      const answers = collect(), likertIds = def.items.filter((i) => i.type === 'likert').map((i) => i.id);
      // היגד שלא סומן מודגש לסטודנט/ית, והמסך עובר אליו (24/11/2026)
      const miss = likertIds.filter((id) => !(id in answers));
      c.querySelectorAll('.q.qmiss').forEach((x) => x.classList.remove('qmiss'));
      if (miss.length) {
        const boxes = miss.map((id) => c.querySelector('.q[data-q="' + id + '"]')).filter(Boolean);
        boxes.forEach((x) => x.classList.add('qmiss'));
        say(c, miss.length === 1 ? 'נשאר היגד אחד בלי תשובה. הוא מסומן באדום.' : 'נשארו ' + miss.length + ' היגדים בלי תשובה. הם מסומנים באדום.', true);
        if (boxes[0]) boxes[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      busy(go, true);
      try { me = (await api('p.save', { code, pid: cred.pid, key: cred.key, session: n, part, data: { answers, title: def.title } })).participant; store.del(draftKey(n, part)); render(); window.scrollTo(0, 0); }
      catch (e) { busy(go, false); say(c, e.message, true); }
    };
    root.append(c);
  }

  // ── בחירת מודל: על איזו שיחה מתאמנים, הכנה עצמית, ובחירת המודל ──
  // ── תכנון השיחה (23/11/2026, נבחר: "המסלול עם טופס תכנון השיחה"): טופס התכנון המלא (talk-plan.html),
  // עם בחירת המודל והנימוק, תדריך שהמודל הוא הלב שלו, ומשם ישר לתרגול. הטופס הקצר (modelViewShort) נשאר גיבוי.
  // ── שיחה שכבר נוצרה (24/11/2026: "אפשר לסטודנטית להגיע לתרגול על שיחה שהיא כבר יצרה מבלי ליצור שוב - זהו חלק מהמחקר"):
  // במפגשים 2 ו-3 אפשר לבחור שיחה ממפגש קודם, בלי למלא שוב את הטופס. בוחרים מודל (ברירת מחדל: המודל הקודם) וכותבים נימוק,
  // כמו בטופס המלא. השיחה נשמרת במפגש הזה עם reusedFrom (המפגש שבו נוצרה), כדי שבניתוח יהיה ברור שזו אותה שיחה.
  // התדריך נשמר רק כשהמודל לא השתנה; מודל אחר מקבל תדריך חדש בכלי התרגול.
  // כל השיחות שהסטודנט/ית יצר/ה: בכל מפגש עד n (כולל n כש-withCurrent), וגם בתרגילים הנוספים (extras)
  function priorCases(n, withCurrent) {
    const out = [], seen = new Set();
    const idsOf = (names) => T.MODELS.filter((m) => (names || []).includes(m.name)).map((m) => m.id);
    for (let k = withCurrent ? Math.min(n, 3) : n - 1; k >= 1; k--) {
      const ss = me.sessions?.[k] || {};
      (ss.extras || []).slice().reverse().forEach((x, i) => {
        const cs = x.extraCase; if (!cs || !cs.fields) return;
        const origin = cs.reusedFrom || (k + 'x' + ((ss.extras.length - 1) - i)); const sig = JSON.stringify(cs.fields);
        if (seen.has(origin) || seen.has(sig)) return; seen.add(origin); seen.add(sig);
        out.push({ k, origin, cs, md: { ids: idsOf(x.extraModel), names: x.extraModel || [] }, extra: true });
      });
      const cs = ss.case, md = ss.model;
      if (!cs || !cs.fields) continue;
      const origin = cs.reusedFrom || k, sig = JSON.stringify(cs.fields);
      if (seen.has(origin) || seen.has(sig)) continue;
      seen.add(origin); seen.add(sig); out.push({ k, origin, cs, md: md || {} });
    }
    return out;
  }
  const originLabel = (o) => /x/.test(String(o)) ? 'תרגיל נוסף במפגש ' + String(o).split('x')[0] : 'מפגש ' + o;
  function reuseCard(n, pre) {
    const list = priorCases(n, !!pre); if (!list.length) return null;
    const c = card('להתאמן על שיחה שכבר יצרת', ['אפשר להמשיך עם שיחה ממפגש קודם, בלי למלא שוב את טופס התכנון. בוחרים את השיחה ואת המודל, וכותבים משפט או שניים למה.']);
    let pick = list.find((x) => String(x.origin) === String(pre)) || list[0];
    const rows = el('div');
    list.forEach((x, i) => {
      const l = el('label', 'check'), r = el('input'); r.type = 'radio'; r.name = 'reuse'; r.checked = x === pick;
      r.onchange = () => { pick = x; setModel(x.md.ids || []); };
      l.append(r, el('span', '', 'השיחה מ' + originLabel(x.origin) + ': ' + [x.cs.fields?.other, x.cs.type].filter(Boolean).join(' · ') + (x.md.names?.length ? ' · מודל: ' + x.md.names.join(' + ') : '')));
      rows.append(l);
    });
    c.append(rows);
    c.append(el('h3', '', 'המודל לתרגול הזה'));
    const picked = new Set(pick.md.ids || []), boxes = [];
    for (const m of T.MODELS) { const l = el('label', 'check'), cb = el('input'); cb.type = 'checkbox'; cb.value = m.id; cb.onchange = () => { cb.checked ? picked.add(m.id) : picked.delete(m.id); }; boxes.push(cb); l.append(cb, el('span', '', m.name)); c.append(l); }
    function setModel(ids) { picked.clear(); ids.forEach((x) => picked.add(x)); boxes.forEach((b) => { b.checked = picked.has(b.value); }); }
    setModel(pick.md.ids || []);
    const rL = el('label', 'f', 'למה ממשיכים באותו מודל, או למה מחליפים? משפט או שניים'), r = el('textarea'); r.placeholder = 'למשל: התפנית שנתקעתי בה דורשת עוד תרגול באותו מודל';
    const dk = draftKey(n, 'reuse'); r.value = (store.get(dk) || {}).reason || ''; r.oninput = () => store.set(dk, { reason: r.value });
    c.append(rL, r);
    const go = el('button', '', 'ממשיכים לתרגול עם השיחה הזאת ▶'), b = el('div', 'btns'); b.append(go); c.append(b);
    go.onclick = async () => {
      const ids = [...picked], reason = r.value.trim();
      if (!ids.length) return say(c, 'כדי להמשיך, אפשר לבחור מודל אחד לפחות.', true);
      if (!reason) return say(c, 'נשמח למשפט קצר: למה המודל הזה.', true);
      const prevIds = me.sessions?.[n - 1]?.model?.ids || pick.md.ids || [];
      const sameAsCase = sameIds(pick.md.ids || [], ids);
      const cs = structuredClone(pick.cs); delete cs.at;
      cs.reusedFrom = pick.origin; cs.reusedAt = n; if (!sameAsCase) cs.briefing = '';
      busy(go, true);
      try {
        await api('p.save', { code, pid: cred.pid, key: cred.key, session: n, part: 'case', data: cs });
        me = (await api('p.save', { code, pid: cred.pid, key: cred.key, session: n, part: 'model', data: { ids, names: T.MODELS.filter((m) => ids.includes(m.id)).map((m) => m.name), reason, prevIds, kept: sameIds(prevIds, ids), sameCase: true } })).participant;
        store.del(dk); render(); window.scrollTo(0, 0);
      } catch (e) { busy(go, false); say(c, e.message, true); }
    };
    return c;
  }

  function modelView(n, pre) {
    const prevCase = me.sessions?.[n - 1]?.case, prevModel = me.sessions?.[n - 1]?.model;
    const c = card('תכנון השיחה', ['ממלאים את טופס תכנון השיחה: על איזו שיחה מתאמנים, מי את/ה בשיחה, מי מולך, מה המטרה ומה מאתגר. בוחרים מודל אחד משלושת המודלים, וכותבים משפט או שניים למה.',
      'בסוף הטופס מקבלים תדריך לשיחה, שהמודל שבחרת הוא הלב שלו: מה בשיחה שלך קשור לכל שלב, ואיך זה בא לידי ביטוי. מהתדריך ממשיכים ישר לתרגול.']
      .concat(prevModel?.names?.length ? ['במפגש הקודם בחרת: ' + prevModel.names.join(' + ') + '. הטופס נפתח עם השיחה מהמפגש הקודם. אפשר להמשיך באותה שיחה ובאותו מודל, או לשנות.'] : []));
    c.append(el('p', 'sub', 'בלי שמות ובלי פרטים מזהים. מה שממלאים נשמר במכשיר תוך כדי.'));
    const go = el('button', '', '▶ לטופס תכנון השיחה'), b = el('div', 'btns'); b.append(go);
    const short = el('button', 'link', 'טופס קצר במקום זה'); short.onclick = () => { root.replaceChildren(); modelViewShort(n); root.append(pocketCard()); footer(); };
    b.append(short); c.append(b);
    go.onclick = () => {
      const rounds = T.ROUNDS[n] || 1;
      store.set('sbe.ts.cred', { c: code, p: cred.pid, key: cred.key });
      store.set('sbe.ts.planctx', { code, pid: cred.pid, session: n, rounds, next: nextLabel(n), back: backUrl(), prevModel: prevModel ? { ids: prevModel.ids, names: prevModel.names } : null, prevPlan: prevCase?.plan || null });
      location.href = 'talk-plan.html';
    };
    const reuse = (n > 1 || pre) ? reuseCard(n, pre) : null;
    if (reuse) { c.querySelector('h2').textContent = 'או: תכנון שיחה חדשה'; root.append(reuse); if (pre) setTimeout(() => reuse.scrollIntoView({ behavior: 'smooth' }), 50); }
    root.append(c);
  }
  const nextLabel = (n) => n === 1 ? 'סיום המפגש ←' : n === 2 ? 'המשך: שאלון עמדות ←' : 'המשך: שאלון עמדות מסכם ←';
  const backUrl = () => location.pathname.split('/').pop() + '?c=' + code;

  function modelViewShort(n) {
    const d = store.get(draftKey(n, 'model')) || {};
    const prev = me.sessions?.[n - 1]?.case;
    const c1 = card('על איזו שיחה מתאמנים?', ['שיחה אמיתית מהעבודה, שכבר הייתה או שעוד לפניך. בלי שמות ובלי פרטים מזהים.']);
    if (prev && !d.story) { const again = el('button', 'link', 'להמשיך עם השיחה מהמפגש הקודם'); again.onclick = () => { Object.assign(d, prev.fields || {}, { type: prev.type, difficulty: prev.difficulty }); store.set(draftKey(n, 'model'), d); render(); }; c1.append(again); }
    const f = {};
    for (const [k, label, ph, main] of T.CASE.fields) {
      const l = el('label', 'f', label), i = k === 'story' ? el('textarea') : el('input'); if (k !== 'story') i.type = 'text';
      i.placeholder = ph; i.value = d[k] || ''; f[k] = i; c1.append(l, i);
    }
    const meL = el('label', 'f', 'איך לפנות אליי'), meS = el('select'); meS.append(new Option('בלשון נקבה', 'נקבה'), new Option('בלשון זכר', 'זכר'), new Option('אחר: בלשון כוללת', 'כוללת')); meS.value = d.me || 'נקבה'; c1.append(meL, meS);
    const tL = el('label', 'f', 'סוג השיחה'), tS = el('select'); tS.append(new Option('בחירה', '')); for (const t of T.CASE.types) tS.append(new Option(t, t)); tS.append(new Option('אחר', 'אחר'));
    // "אחר": כותבים סוג שיחה שלא ברשימה (24/11/2026)
    const tO = el('input'); tO.type = 'text'; tO.placeholder = 'אחר: איזו שיחה?'; const known = !d.type || T.CASE.types.includes(d.type); tS.value = known ? (d.type || '') : 'אחר'; tO.value = known ? '' : d.type; tO.hidden = tS.value !== 'אחר'; tS.addEventListener('change', () => { tO.hidden = tS.value !== 'אחר'; if (!tO.hidden) tO.focus(); }); c1.append(tL, tS, tO);
    const dL = el('label', 'f', 'כמה השיחה מאתגרת אותי, מ־1 עד 5'), dS = el('select'); dS.append(new Option('בחירה', '')); for (let i = 1; i <= 5; i++) dS.append(new Option(String(i), String(i))); dS.value = d.difficulty ? String(d.difficulty) : ''; c1.append(dL, dS);

    const c2 = card('הכנה עצמית', ['לפני שבוחרים מודל, כמה מילים משלך.']);
    const p = {};
    for (const [k, label] of T.CASE.prep) { const l = el('label', 'f', label), i = el('textarea'); i.value = d['prep_' + k] || ''; i.style.minHeight = '60px'; p[k] = i; c2.append(l, i); }

    const prevModel = me.sessions?.[n - 1]?.model;
    const c3 = card('בחירת מודל לשיחה', ['אפשר לבחור מודל אחד, או לשלב שניים או שלושה. המודל הוא מסגרת חשיבה, לא תסריט.'].concat(prevModel?.names?.length ? ['במפגש הקודם בחרת: ' + prevModel.names.join(' + ') + '. אפשר להמשיך באותו מודל או להחליף. שתי האפשרויות טובות, כשיש להן נימוק.'] : []));
    const picked = new Set(d.ids || prevModel?.ids || []);
    const box = el('div', 'models');
    for (const m of T.MODELS) {
      const mc = el('div', 'model' + (picked.has(m.id) ? ' on' : '')); mc.tabIndex = 0; mc.setAttribute('role', 'checkbox'); mc.setAttribute('aria-checked', String(picked.has(m.id)));
      const hd = el('div', 'hd'); hd.append(el('b', '', (picked.has(m.id) ? '✓ ' : '') + m.name), el('span', 'tag', m.tag)); mc.append(hd, el('p', '', m.what));
      const ol = el('ol'); for (const [k, t, x] of m.steps) { const li = el('li'); li.append(el('span', 'k', k), document.createTextNode(' ' + t + ': ' + x)); ol.append(li); } mc.append(ol);
      mc.append(el('small', '', 'מתאים ל: ' + m.fits), el('small', '', 'היתרון: ' + m.strength));
      const toggle = () => { picked.has(m.id) ? picked.delete(m.id) : picked.add(m.id); save(); render(); };
      mc.onclick = toggle; mc.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
      box.append(mc);
    }
    c3.append(box);
    const rL = el('label', 'f', prevModel?.ids?.length ? 'למה ממשיכים באותו מודל, או למה מחליפים? משפט או שניים' : 'למה בחרתי במודל הזה? משפט או שניים'), r = el('textarea'); r.value = d.reason || ''; r.placeholder = 'למשל: כי אצטרך למסור מידע קשה, ולתת מקום לכעס'; c3.append(rL, r);

    function read() { const o = { ids: [...picked], reason: r.value.trim(), me: meS.value, type: tS.value === 'אחר' ? tO.value.trim() : tS.value, difficulty: Number(dS.value) || null }; for (const k in f) o[k] = f[k].value.trim(); for (const k in p) o['prep_' + k] = p[k].value.trim(); return o; }
    function save() { store.set(draftKey(n, 'model'), read()); }
    [c1, c2, c3].forEach((c) => c.addEventListener('input', save));
    [meS, tS, dS].forEach((s) => s.addEventListener('change', save));
    const go = el('button', '', 'שמירה: ממשיכים לתרגול'), b = el('div', 'btns'); b.append(go); c3.append(b);
    go.onclick = async () => {
      const o = read();
      const miss = T.CASE.fields.filter((x) => x[3] && !o[x[0]]).map((x) => x[1]);
      if (miss.length) return say(c3, 'כדי להמשיך, אפשר למלא: ' + miss.join(', ') + '.', true);
      if (!o.type || !o.difficulty) return say(c3, 'כדי להמשיך, אפשר לבחור את סוג השיחה וכמה היא מאתגרת.', true);
      if (!o.ids.length) return say(c3, 'כדי להמשיך, אפשר לבחור מודל אחד לפחות.', true);
      if (!o.reason) return say(c3, 'נשמח למשפט קצר: למה המודל הזה.', true);
      if (/\b05\d[-\s]?\d{7}\b|@\S+\.\S+|\b\d{9}\b/.test(o.story)) return say(c3, 'נראה שבתיאור יש טלפון, מייל או מספר זהות. אפשר להסיר אותם ולנסות שוב.', true);
      busy(go, true);
      try {
        const fields = Object.fromEntries(T.CASE.fields.map((x) => [x[0], o[x[0]]]));
        await api('p.save', { code, pid: cred.pid, key: cred.key, session: n, part: 'case', data: { fields, me: o.me, type: o.type, difficulty: o.difficulty, prep: Object.fromEntries(T.CASE.prep.map((x) => [x[0], o['prep_' + x[0]]])) } });
        me = (await api('p.save', { code, pid: cred.pid, key: cred.key, session: n, part: 'model', data: { ids: o.ids, names: T.MODELS.filter((m) => o.ids.includes(m.id)).map((m) => m.name), reason: o.reason, ...(prevModel?.ids ? { prevIds: prevModel.ids, kept: sameIds(prevModel.ids, o.ids) } : {}) } })).participant;
        store.del(draftKey(n, 'model')); render(); window.scrollTo(0, 0);
      } catch (e) { busy(go, false); say(c3, e.message, true); }
    };
    root.append(c1, c2, c3);
  }

  function sameIds(a, b) { return a.length === b.length && a.every((x) => b.includes(x)); }

  // החלפת מודל לפני תרגול (גם בין שני הסבבים של מפגש 2), עם נימוק
  function switchModelBox(n, md) {
    const det = el('details'); det.append(el('summary', '', 'להחליף מודל לפני התרגול?'));
    det.append(el('p', '', 'אפשר להמשיך באותו מודל או להחליף. שתי האפשרויות טובות, כשיש להן נימוק.'));
    const picked = new Set(md.ids || []);
    for (const m of T.MODELS) {
      const l = el('label', 'f'), cb = el('input'); cb.type = 'checkbox'; cb.checked = picked.has(m.id);
      cb.onchange = () => { cb.checked ? picked.add(m.id) : picked.delete(m.id); };
      l.append(cb, document.createTextNode(' ' + m.name)); det.append(l);
    }
    const rL = el('label', 'f', 'למה מחליפים, או למה ממשיכים? משפט או שניים'), r = el('textarea');
    const go = el('button', 'soft', 'שמירת המודל'), b = el('div', 'btns'); b.append(go);
    det.append(rL, r, b);
    go.onclick = async () => {
      const ids = [...picked], reason = r.value.trim();
      if (!ids.length) return say(det, 'כדי להמשיך, אפשר לבחור מודל אחד לפחות.', true);
      if (!reason) return say(det, 'נשמח למשפט קצר: למה המודל הזה.', true);
      busy(go, true);
      try {
        const history = (md.history || []).concat([{ ids: md.ids, names: md.names, reason: md.reason, at: md.at }]);
        if (!sameIds(md.ids || [], ids) && me.sessions?.[n]?.case?.briefing) { const cs = structuredClone(me.sessions[n].case); delete cs.at; cs.briefing = ''; await api('p.save', { code, pid: cred.pid, key: cred.key, session: n, part: 'case', data: cs }); }
        me = (await api('p.save', { code, pid: cred.pid, key: cred.key, session: n, part: 'model', data: { ids, names: T.MODELS.filter((m) => ids.includes(m.id)).map((m) => m.name), reason, prevIds: md.ids, kept: sameIds(md.ids || [], ids), switchedInSession: true, history } })).participant;
        render();
      } catch (e) { busy(go, false); say(det, e.message, true); }
    };
    return det;
  }

  // ── התרגילים שלי (24/11/2026: "סטודנטית שולטת בתרגילים שלה. היא תמיד יכולה לפתוח תרגיל שכבר הופק או ליצור תרגיל חדש") ──
  // לפני שהתרגול של המפגש נרשם: בחירת שיחה קיימת או חדשה היא השיחה של המפגש (עם מודל ונימוק).
  // אחרי שהתרגול של המפגש נרשם: תרגיל נוסף (part: extra), שלא משנה את נתוני המפגש.
  let switchTo = null;
  function sessionOpenForPractice(n, step) { return n <= 3 && (step === 'model' || step === 'practice') && !me.sessions?.[n]?.practice; }
  function myExercises(n, step) {
    const list = priorCases(Math.min(n, 3), true);
    const c = el('section', 'card soft');
    c.append(el('h2', '', 'התרגילים שלי'));
    const inSession = sessionOpenForPractice(n, step);
    c.append(el('p', 'sub', inSession ? 'אפשר לבחור שיחה שכבר יצרת, או לתכנן שיחה חדשה. מה שנבחר כאן הוא השיחה של המפגש הזה.' : 'אפשר תמיד לפתוח שוב שיחה שכבר יצרת, או ליצור שיחה חדשה. זה תרגיל נוסף, והוא לא משנה את מה שכבר נרשם במפגש.'));
    if (!list.length) c.append(el('p', 'sub', 'עוד אין כאן שיחות. השיחה הראשונה נוצרת בתכנון השיחה.'));
    for (const x of list) {
      const row = el('div', 'btns'); row.style.alignItems = 'center';
      row.append(el('span', '', [x.cs.fields?.other, x.cs.type].filter(Boolean).join(' · ') + ' · ' + originLabel(x.origin) + (x.md.names?.length ? ' · ' + x.md.names.join(' + ') : '')));
      const b = el('button', 'soft', inSession ? 'לבחור לתרגול במפגש' : 'לתרגל שוב');
      b.onclick = () => { if (inSession) { switchTo = { origin: x.origin }; render(); } else extraPractice(n, x); };
      row.append(b); c.append(row);
    }
    const nb = el('button', 'link', '➕ תרגיל חדש: תכנון שיחה חדשה'), b2 = el('div', 'btns'); b2.append(nb); c.append(b2);
    nb.onclick = () => {
      if (inSession) { root.replaceChildren(); modelView(Math.min(n, 3)); root.append(pocketCard()); footer(); return; }
      store.set('sbe.ts.cred', { c: code, p: cred.pid, key: cred.key });
      store.set('sbe.ts.planctx', { code, pid: cred.pid, session: Math.min(n, 3), rounds: 1, extra: true, next: 'חזרה למסלול ←', back: backUrl(), prevModel: null, prevPlan: null });
      location.href = 'talk-plan.html';
    };
    return c;
  }
  function extraPractice(n, x) {
    const cs = x.cs, md = x.md, sn = Math.min(n, 3);
    const prevPractice = /x/.test(String(x.origin)) ? null : me.sessions?.[x.origin]?.practice;
    store.set('sbe.ts.cred', { c: code, p: cred.pid, key: cred.key });
    store.set('sbe.ts.handoff', { code, pid: cred.pid, session: sn, rounds: 1, extra: true, next: 'חזרה למסלול ←', fields: cs.fields || {}, me: cs.me || 'נקבה', prep: cs.prep || {}, type: cs.type || '', plan: cs.plan || null,
      modelNote: T.modelNote(md), modelNames: md.names || [], modelSteps: T.MODELS.filter((m) => (md.ids || []).includes(m.id)).map((m) => m.name + ': ' + m.steps.map((y) => y[1] + ' (' + y[2] + ')').join(' · ')),
      back: backUrl(), briefing: cs.briefing || '', character: (prevPractice && prevPractice.character) || null });
    location.href = 'talk-practice.html';
  }
  // תרגול שנשמר אוטומטית ולא נרשם (הדף נסגר לפני "המשך")
  function autosaveCard(n) {
    for (const k of [1, 2, 3]) {
      const ss = me.sessions?.[k] || {}, a = ss.autosave;
      if (!a || a.consumed || !a.at || (!a.extra && !ss.case)) continue;
      const after = a.extra ? (ss.extras || []).some((x) => x.at > a.at) : (ss.practice && ss.practice.at > a.at);
      if (after) continue;
      const pending = store.get('sbe.ts.result'); if (pending && pending.code === code && pending.pid === cred.pid) continue;
      const c = card('יש תרגול שנשמר אוטומטית', ['התרגול ' + (a.extra ? 'הנוסף ' : '') + 'במפגש ' + k + ' נשמר תוך כדי, אבל לא נרשם במסלול, כנראה כי הדף נסגר לפני הכפתור בסוף המשוב. אפשר לרשום אותו עכשיו.']);
      const go = el('button', '', 'רישום התרגול שנשמר'), b = el('div', 'btns'); b.append(go); c.append(b);
      go.onclick = async () => {
        busy(go, true);
        try {
          const data = { ...a }; delete data.at; delete data.consumed; const extra = !!data.extra; if (!extra) { delete data.extraCase; delete data.extraModel; }
          data.fromAutosave = true;
          await api('p.save', { code, pid: cred.pid, key: cred.key, session: k, part: extra ? 'extra' : 'practice', data });
          me = (await api('p.save', { code, pid: cred.pid, key: cred.key, session: k, part: 'autosave', data: { consumed: true } })).participant;
          render(); window.scrollTo(0, 0);
        } catch (e) { busy(go, false); say(c, e.message, true); }
      };
      return c;
    }
    return document.createDocumentFragment();
  }
  // השאלונים: מה מולא, ומה פתוח עכשיו (24/11/2026: "כפתורי השאלונים")
  function questionnairesCard(n, step) {
    const c = el('section', 'card soft'); c.append(el('h2', '', 'השאלונים שלי'));
    for (const k of [1, 2, 3]) for (const part of ['pre', 'post']) {
      if (!T.stepsFor(k).some((x) => x.id === part)) continue;
      const done = me.sessions?.[k]?.[part], def = T.questionnaire(k, part);
      const row = el('div', 'btns'); row.style.alignItems = 'center';
      row.append(el('span', '', (done ? '✓ ' : '') + def.title + ' · מפגש ' + k));
      if (done) row.append(el('span', 'sub', 'מולא'));
      else if (k === n && step === part) { const b = el('button', 'soft', 'למילוי עכשיו'); b.onclick = () => { const q = root.querySelector('.q'); (q ? q.closest('section') : root).scrollIntoView({ behavior: 'smooth' }); }; row.append(b); }
      else row.append(el('span', 'sub', k < n ? 'לא מולא' : part === 'pre' ? 'בתחילת המפגש' : 'אחרי התרגול במפגש ' + k));
      c.append(row);
    }
    return c;
  }

  // ── תרגול: בכלי התרגול, ומשם חוזרים לכאן ──
  function practiceView(n) {
    const s = me.sessions?.[n] || {}, cs = s.case || {}, md = s.model || {};
    if (!cs.fields || !md.ids) { root.append(card('תרגול ומשוב', ['התרגול נפתח אחרי תכנון השיחה במפגש הזה.'])); return; }
    const rounds = T.ROUNDS[n] || 1;
    const c = card('תרגול ומשוב', ['קודם קוראים תדריך הכנה קצר לשיחה שלך, לפי המודל שבחרת. אחר כך הכלי בונה מהתיאור שלך דמות, ומדברים איתה. אחרי כל שיחה מקבלים משוב, ואפשר לבחור כל רגע בשיחה ולנסות אותו שוב. כפתור "עצירה" זמין בכל רגע.'].concat(rounds > 1 ? ['במפגש הזה מתרגלים פעמיים: תרגול ומשוב, ואחר כך "תרגול נוסף" ועוד משוב.'] : []));
    c.append(el('p', '', 'השיחה: ' + (cs.fields?.other || '') + ' · ' + (cs.type || '') + (cs.reusedFrom ? ' (אותה שיחה מ' + originLabel(cs.reusedFrom) + ')' : '')), el('p', '', 'המודל: ' + (md.names || []).join(' + ')));
    c.append(switchModelBox(n, md));
    const go = el('button', '', '▶ לתדריך ולתרגול'), b = el('div', 'btns'); b.append(go); c.append(b);
    go.onclick = () => {
      store.set('sbe.ts.cred', { c: code, p: cred.pid, key: cred.key });
      store.set('sbe.ts.handoff', { code, pid: cred.pid, session: n, rounds, next: nextLabel(n), fields: cs.fields || {}, me: cs.me || 'נקבה', prep: cs.prep || {}, type: cs.type || '', modelNote: T.modelNote(md), modelNames: md.names || [], modelSteps: T.MODELS.filter((m) => (md.ids || []).includes(m.id)).map((m) => m.name + ': ' + m.steps.map((x) => x[1] + ' (' + x[2] + ')').join(' · ')), back: backUrl(), briefing: cs.briefing || '', character: (cs.reusedFrom && me.sessions?.[cs.reusedFrom]?.practice?.character) || null });
      location.href = 'talk-practice.html';
    };
    const pending = store.get('sbe.ts.result');
    if (pending && pending.code === code && pending.pid === cred.pid) {
      const r = el('button', 'soft', 'שמירת התרגול שכבר נעשה');
      r.onclick = async () => { busy(r, true); await takePracticeResult(); render(); };
      b.append(r);
    }
    root.append(c);
  }

  // ── רפלקציה אישית ──
  function reflectionView(n) {
    const d = store.get(draftKey(n, 'reflection')) || {};
    const c = card('רפלקציה אישית', ['על כל שלושת המפגשים. אין תשובות נכונות. מה שכתוב כאן עוזר לך לסכם, ועוזר לנו להבין מה התרגול נותן.']);
    const f = {};
    for (const [k, label, ph] of T.REFLECTION.main) { const l = el('label', 'f', label), i = el('textarea'); i.placeholder = ph; i.value = d[k] || ''; f[k] = i; c.append(l, i); }
    const det = el('details'); det.append(el('summary', '', 'עוד שלוש שאלות קצרות (רשות)'));
    for (const [k, label] of T.REFLECTION.short) { const l = el('label', 'f', label), i = el('textarea'); i.style.minHeight = '60px'; i.value = d[k] || ''; f[k] = i; det.append(l, i); }
    if (T.REFLECTION.short.some(([k]) => d[k])) det.open = true;
    c.append(det);
    c.addEventListener('input', () => store.set(draftKey(n, 'reflection'), Object.fromEntries(Object.entries(f).map(([k, i]) => [k, i.value]))));
    const go = el('button', '', 'שמירה וסיום המסלול'), b = el('div', 'btns'); b.append(go); c.append(b);
    go.onclick = async () => {
      const data = Object.fromEntries(Object.entries(f).map(([k, i]) => [k, i.value.trim()]));
      if (T.REFLECTION.main.some(([k]) => !data[k])) return say(c, 'נשמח לכמה מילים בכל אחת מהשאלות.', true);
      busy(go, true);
      try { me = (await api('p.save', { code, pid: cred.pid, key: cred.key, session: n, part: 'reflection', data })).participant; store.del(draftKey(n, 'reflection')); doneView(n); }
      catch (e) { busy(go, false); say(c, e.message, true); }
    };
    root.append(c);
  }
  function doneView(n) {
    root.replaceChildren();
    root.append(el('h1', '', cls.studyTitle || 'הכנה לשיחות מאתגרות'));
    if (n >= 3) { render(); return; }
    const c = card('מפגש ' + n + ' הושלם. תודה!', ['המפגש הבא בשיעור הבא, בעוד כשבוע. נכנסים באותו קישור, באותו מכשיר.', 'במכשיר אחר: אפשר לשמור את הקישור האישי שלך.']);
    const b = el('div', 'btns'), cp = el('button', 'soft', 'העתקת הקישור האישי'), nx = el('button', 'link', 'אני כבר במפגש הבא: להמשיך');
    cp.onclick = async () => { const u = location.origin + location.pathname + '?c=' + code + '#p=' + cred.pid + '.' + cred.key; try { await navigator.clipboard.writeText(u); say(c, '✓ הקישור הועתק. כדאי לשמור אותו רק לעצמך.'); } catch (e) { say(c, u); } };
    nx.onclick = () => { render(); window.scrollTo(0, 0); };
    b.append(cp, nx); c.append(b); root.append(c, pocketCard()); footer();
  }

  // ── פנקס הכיס ──
  function pocketCard() {
    const c = el('section', 'card soft'), row = el('div', 'pocket');
    row.append(el('span', 'ico', '📱'));
    const txt = el('div'); txt.append(el('h2', '', 'פנקס הכיס לשיחה מאתגרת'), el('p', '', 'דף תזכורת לכל אחד משלושת המודלים, ואיך בוחרים ביניהם. כדאי להתקין אותו בטלפון: נפתח בלחיצה אחת, גם בלי אינטרנט.'));
    row.append(txt); c.append(row);
    const b = el('div', 'btns');
    const open = el('a', 'btn', 'פתיחת הפנקס והתקנה בטלפון'); open.href = 'pocket-talk.html'; open.target = '_blank'; open.rel = 'noopener';
    const dl = el('a', 'btn soft', '⬇ הורדה כ־PDF למחשב או לטלפון'); dl.href = 'assets/pocket-talk/pocket-talk.pdf'; dl.download = 'פנקס כיס לשיחה מאתגרת · Begood.pdf';
    b.append(open, dl); c.append(b);
    return c;
  }

  function footer() {
    foot.replaceChildren(document.createTextNode('Begood · be-good.co.il'));
    if (!me) return;
    foot.append(document.createTextNode(' · '));
    const w = el('button', 'link', 'יציאה מהמחקר ומחיקת הנתונים שלי');
    w.onclick = () => {
      const d = el('dialog'); d.append(el('p', '', 'למחוק את כל מה שנשמר במחקר מהמכשיר הזה ומהשרת? אי אפשר לבטל את המחיקה.'));
      const b = el('div', 'btns'), yes = el('button', '', 'כן, למחוק'), no = el('button', 'soft', 'ביטול'); b.append(yes, no); d.append(b); document.body.append(d); d.showModal();
      no.onclick = () => d.remove();
      yes.onclick = async () => { busy(yes, true, 'מוחקים…'); try { await api('p.withdraw', { code, pid: cred.pid, key: cred.key }); store.del(KEY); me = null; cred = null; d.remove(); root.replaceChildren(card('הנתונים נמחקו', ['תודה על מה שכבר עשית. אפשר לסגור את הדף.'])); foot.replaceChildren(); who.textContent = ''; } catch (e) { busy(yes, false); d.append(el('p', 'status bad', e.message)); } };
    };
    foot.append(w);
  }

  start();
})();
