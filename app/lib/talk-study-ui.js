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
  // 7777: כניסה לבדיקה של מנהלת המערכת בלבד (22/11/2026: "תאפשר לי כניסה לגירסת הסטודנטיות עם הקוד 7777... אבטל זאת בהמשך").
  // רק עם כניסת מנהלת המערכת: נפתחת (או נמצאת) קבוצת בדיקה קבועה, מחוץ לכל מחקר (studyId: sys-test), ועוברים אליה.
  // לביטול: למחוק את הבלוק הזה ואת השורה של 7777 ב-entry.html.
  async function sysTest() {
    let token = '';
    try { token = sessionStorage.getItem('sbe.session.token') || ''; if (!token) { const m = JSON.parse(localStorage.getItem('sbe.session.mirror') || 'null'); token = (m && m.data && m.data['sbe.session.token']) || ''; } } catch (e) {}
    let dev = null; try { dev = JSON.parse(localStorage.getItem('sbe.sys.device') || 'null'); } catch (e) {}
    const relogin = () => location.replace('entry.html?' + (dev ? '' : 'expired=1&who=sys&') + 'next=' + encodeURIComponent('talk-study.html?c=7777'));
    if (!token) { if (dev) return relogin(); root.replaceChildren(card('הקישור לא שלם', ['אפשר לבקש מהמרצה את הקישור לקבוצה שלכם.'])); return; }
    root.replaceChildren(el('p', 'sub', 'פותחים את קבוצת הבדיקה…'));
    const call = async (op, input) => { const r = await fetch(SERVER + '/api/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'tsCall', op, input, token }) }); const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || 'הפעולה לא הושלמה'); e.status = r.status; throw e; } return j; };
    try {
      const list = await call('f.list', { studyId: 'sys-test' });
      let c = (list.classes || []).find((x) => x.status === 'open');
      if (!c) c = (await call('f.create', { studyId: 'sys-test', studyTitle: 'בדיקה של מנהלת המערכת', group: 'בדיקה', label: 'כניסת בדיקה 7777' })).class;
      location.replace('talk-study.html?c=' + c.code);
    } catch (e) {
      if (e.status === 403) { if (dev) return relogin(); root.replaceChildren(card('הקוד 7777 פתוח רק אחרי כניסה כמנהלת המערכת', ['אפשר להיכנס כמנהלת המערכת ולנסות שוב.'])); return; }
      root.replaceChildren(card('לא הצלחנו לפתוח את קבוצת הבדיקה', [e.message]));
    }
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
    try { const r = await api('p.save', { code, pid: cred.pid, key: cred.key, session: res.session, part: 'practice', data: res.data }); me = r.participant; store.del('sbe.ts.result'); if (res.session < 3) justDone = res.session; }
    catch (e) { /* נשאר במכשיר, וננסה שוב בפעם הבאה */ }
  }

  function currentSession() { for (const n of [1, 2, 3]) if (!me.sessions?.[n]?.doneAt) return n; return 4; }
  function currentStep(n) { const s = me.sessions?.[n] || {}; for (const st of T.stepsFor(n)) { if (st.id === 'consent') continue; if (!s[st.id]) return st.id; } return 'done'; }
  let justDone = 0;

  function render() {
    who.textContent = me ? 'קוד המשתתף/ת: ' + me.pid : '';
    root.replaceChildren();
    const head = el('div');
    head.append(el('h1', '', cls.studyTitle || 'הכנה לשיחות מאתגרות'));
    if (!me) { head.append(el('p', 'sub', 'מסלול תרגול במחקר' + (cls.group ? ' · ' + cls.group : ''))); root.append(head); return consentView(); }
    const n = currentSession();
    if (n > 3) { head.append(el('p', 'sub', 'שלושת המפגשים הושלמו')); root.append(head, card('תודה רבה!', ['סיימת את כל שלושת המפגשים של המחקר. התרומה שלך חשובה לנו מאוד.', 'פנקס הכיס נשאר אצלך, לכל שיחה מאתגרת שתבוא.']), pocketCard()); return footer(); }
    head.append(el('p', 'sub', 'מפגש ' + n + ' מתוך 3' + (cls.group ? ' · ' + cls.group : '')));
    root.append(head);
    const step = currentStep(n);
    root.append(stepper(n, step === 'done' ? 'done' : step));
    if (cls.status !== 'open') root.append(card('המסלול סגור כרגע', ['אפשר לפנות למרצה. מה שכבר נשמר נשאר שמור.']));
    else if (step === 'pre' || step === 'post') questionnaireView(n, step);
    else if (step === 'model') modelView(n);
    else if (step === 'practice') practiceView(n);
    else if (step === 'reflection') reflectionView(n);
    root.append(pocketCard());
    footer();
  }

  function stepper(n, now) {
    const ol = el('ol', 'steps'), list = T.stepsFor(n);
    for (const st of list) {
      const li = el('li', '', st.label);
      const done = st.id === 'consent' || !!me.sessions?.[n]?.[st.id];
      if (st.id === now) li.className = 'now'; else if (done) li.className = 'done';
      ol.append(li);
    }
    return ol;
  }
  function card(title, paras, cls2) { const c = el('section', 'card' + (cls2 ? ' ' + cls2 : '')); c.append(el('h2', '', title)); for (const p of paras || []) c.append(el('p', '', p)); return c; }

  // ── הסכמה ──
  function consentView() {
    const C = T.CONSENT, c = card(C.title, C.intro);
    if (cls.status !== 'open') { c.append(el('p', 'status bad', 'ההצטרפות סגורה כרגע. אפשר לפנות למרצה.')); root.append(c); return footer(); }
    c.append(el('h3', '', 'לפני שמתחילים, אפשר לסמן את כל התיבות:'));
    const boxes = {};
    for (const [k, t] of C.items) { const l = el('label', 'check'), i = el('input'); i.type = 'checkbox'; boxes[k] = i; l.append(i, el('span', '', t)); c.append(l); }
    const rl = el('label', 'check'), want = el('input'); want.type = 'checkbox'; rl.append(want, el('span', '', C.report)); c.append(el('h3', '', 'דו״ח משוב אישי (רשות)'), rl);
    const ml = el('label', 'f', 'כתובת מייל לדו״ח'), mail = el('input'); mail.type = 'email'; mail.placeholder = 'למשל: name@example.com'; ml.hidden = mail.hidden = true;
    want.onchange = () => { ml.hidden = mail.hidden = !want.checked; };
    c.append(ml, mail);
    const go = el('button', '', 'מסכים/ה, מתחילים'), b = el('div', 'btns'); b.append(go); c.append(b);
    go.onclick = async () => {
      const items = Object.fromEntries(Object.entries(boxes).map(([k, i]) => [k, i.checked]));
      if (!Object.values(items).every(Boolean)) return say(c, 'כדי להתחיל, אפשר לסמן את כל התיבות.', true);
      if (want.checked && !/^\S+@\S+\.\S+$/.test(mail.value.trim())) return say(c, 'אפשר לבדוק את כתובת המייל, או להוריד את הסימון של הדו״ח.', true);
      busy(go, true, 'מצטרפים…');
      try {
        const r = await api('p.join', { code, consent: { version: C.version, required: C.items.map((x) => x[0]), items }, report: { want: want.checked, email: mail.value.trim() } });
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
      const q = el('div', 'q');
      q.append(el('div', '', item.label));
      if (item.type === 'likert') {
        const sc = el('div', 'scale'), name = 'q_' + item.id;
        for (let v = item.min; v <= item.max; v++) { const l = el('label'), i = el('input'); i.type = 'radio'; i.name = name; i.value = String(v); if (saved[item.id] === v) i.checked = true; l.append(i, el('span', '', String(v))); sc.append(l); }
        const dl = el('label', 'dec'), d = el('input'); d.type = 'radio'; d.name = name; d.value = 'x'; if (saved[item.id] === null) d.checked = true; dl.append(d, el('span', '', BG.SCALE.decline)); sc.append(dl);
        q.append(sc);
        read.push([item.id, () => { const x = c.querySelector('input[name="' + name + '"]:checked'); return !x ? undefined : x.value === 'x' ? null : Number(x.value); }]);
      } else if (item.type === 'choice') {
        const s = el('select'); s.append(new Option('בחירת תשובה', '')); for (const o of item.options) s.append(new Option(o, o)); if (saved[item.id]) s.value = saved[item.id];
        q.append(s); read.push([item.id, () => s.value || undefined]);
      } else {
        const t = el('textarea'); t.value = saved[item.id] || ''; q.append(t); read.push([item.id, () => t.value.trim() || undefined]);
      }
      c.append(q);
    }
    const anchors = el('p', 'sub', '1 = ' + BG.SCALE.anchors[1] + ' · 5 = ' + BG.SCALE.anchors[5]);
    c.insertBefore(anchors, c.children[2] || null);
    const collect = () => Object.fromEntries(read.map(([id, f]) => [id, f()]).filter(([, v]) => v !== undefined));
    c.addEventListener('change', () => store.set(draftKey(n, part), collect()));
    c.addEventListener('input', () => store.set(draftKey(n, part), collect()));
    const go = el('button', '', 'שמירה והמשך'), b = el('div', 'btns'); b.append(go); c.append(b);
    go.onclick = async () => {
      const answers = collect(), likertIds = def.items.filter((i) => i.type === 'likert').map((i) => i.id);
      const missing = likertIds.filter((id) => !(id in answers)).length;
      if (missing) return say(c, 'נשארו ' + missing + ' היגדים בלי תשובה. אפשר לענות, או לבחור "' + BG.SCALE.decline + '".', true);
      busy(go, true);
      try { me = (await api('p.save', { code, pid: cred.pid, key: cred.key, session: n, part, data: { answers, title: def.title } })).participant; store.del(draftKey(n, part)); render(); window.scrollTo(0, 0); }
      catch (e) { busy(go, false); say(c, e.message, true); }
    };
    root.append(c);
  }

  // ── בחירת מודל: על איזו שיחה מתאמנים, הכנה עצמית, ובחירת המודל ──
  function modelView(n) {
    const d = store.get(draftKey(n, 'model')) || {};
    const prev = me.sessions?.[n - 1]?.case;
    const c1 = card('על איזו שיחה מתאמנים?', ['שיחה אמיתית מהעבודה, שכבר הייתה או שעוד לפניך. בלי שמות ובלי פרטים מזהים.']);
    if (prev && !d.story) { const again = el('button', 'link', 'להמשיך עם השיחה מהמפגש הקודם'); again.onclick = () => { Object.assign(d, prev.fields || {}, { type: prev.type, difficulty: prev.difficulty }); store.set(draftKey(n, 'model'), d); render(); }; c1.append(again); }
    const f = {};
    for (const [k, label, ph, main] of T.CASE.fields) {
      const l = el('label', 'f', label), i = k === 'story' ? el('textarea') : el('input'); if (k !== 'story') i.type = 'text';
      i.placeholder = ph; i.value = d[k] || ''; f[k] = i; c1.append(l, i);
    }
    const meL = el('label', 'f', 'איך לפנות אליי'), meS = el('select'); meS.append(new Option('בלשון נקבה', 'נקבה'), new Option('בלשון זכר', 'זכר')); meS.value = d.me || 'נקבה'; c1.append(meL, meS);
    const tL = el('label', 'f', 'סוג השיחה'), tS = el('select'); tS.append(new Option('בחירה', '')); for (const t of T.CASE.types) tS.append(new Option(t, t)); tS.value = d.type || ''; c1.append(tL, tS);
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

    function read() { const o = { ids: [...picked], reason: r.value.trim(), me: meS.value, type: tS.value, difficulty: Number(dS.value) || null }; for (const k in f) o[k] = f[k].value.trim(); for (const k in p) o['prep_' + k] = p[k].value.trim(); return o; }
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
        me = (await api('p.save', { code, pid: cred.pid, key: cred.key, session: n, part: 'model', data: { ids, names: T.MODELS.filter((m) => ids.includes(m.id)).map((m) => m.name), reason, prevIds: md.ids, kept: sameIds(md.ids || [], ids), switchedInSession: true, history } })).participant;
        render();
      } catch (e) { busy(go, false); say(det, e.message, true); }
    };
    return det;
  }

  // ── תרגול: בכלי התרגול, ומשם חוזרים לכאן ──
  function practiceView(n) {
    const s = me.sessions[n], cs = s.case || {}, md = s.model || {};
    const rounds = T.ROUNDS[n] || 1;
    const c = card('תרגול ומשוב', ['הכלי בונה מהתיאור שלך דמות, ואפשר לדבר איתה. אחרי כל שיחה מקבלים משוב, ואפשר לחזור לרגע המאתגר ולנסות שוב. כפתור "עצירה" זמין בכל רגע.'].concat(rounds > 1 ? ['במפגש הזה מתרגלים פעמיים: תרגול ומשוב, ואחר כך "תרגול נוסף" ועוד משוב.'] : []));
    c.append(el('p', '', 'השיחה: ' + (cs.fields?.other || '') + ' · ' + (cs.type || '')), el('p', '', 'המודל: ' + (md.names || []).join(' + ')));
    c.append(switchModelBox(n, md));
    const go = el('button', '', '▶ פתיחת התרגול'), b = el('div', 'btns'); b.append(go); c.append(b);
    go.onclick = () => {
      store.set('sbe.ts.cred', { c: code, p: cred.pid, key: cred.key });
      store.set('sbe.ts.handoff', { code, pid: cred.pid, session: n, rounds, next: n === 1 ? 'סיום המפגש ←' : n === 2 ? 'המשך: שאלון עמדות ←' : 'המשך: שאלון עמדות מסכם ←', fields: cs.fields || {}, me: cs.me || 'נקבה', modelNote: T.modelNote(md), modelNames: md.names || [], back: location.pathname.split('/').pop() + '?c=' + code });
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
