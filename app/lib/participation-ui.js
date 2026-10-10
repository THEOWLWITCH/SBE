// מסלולי השתתפות בלמידה: שלב בתוך תכנון פעילות ותכנון רצף (activity-planner.html). ההנחיות למודל ב-lib/participation-model.js (SBE_PATHS).
// SBE_PATHS_UI.mount(node, { mode: 'single' | 'seq', context: () => ({...}), insert?: (text) => {} })
// ארבעה חלקים, לפי הסדר: 1 מציעים ובוחרים מסלולים · 2 קריטריונים לראיית למידה, כרטיסים ודף תצפית · 3 אחרי השיעור: תצפית והתאמה · 4 מעקב לאורך הרצף.
// בלי חיבור למודל אין הצעה; הרשימה הארוכה זמינה תמיד, להוספה ידנית. נשמר במכשיר לפי משתמש/ת.
(function () {
  'use strict';
  const M = window.SBE_PATHS, SRC = window.SBE_ADVISOR_SOURCES;
  const KB = SRC ? SRC.forAdvisor('paths') : [];
  const SERVER = window.sbeAIOrigin ? window.sbeAIOrigin() : 'https://sbe-server.onrender.com';
  const NO_MODEL = 'אין כרגע חיבור למודל, ולכן לא הוכנה הצעה. אפשר לנסות שוב בעוד דקה, או לבחור מסלולים מהרשימה המלאה.';
  const PARTIAL = 'ההצעה חזרה חלקית. אפשר לנסות שוב.';
  const why = (e) => (e && e.code === 'incomplete') ? PARTIAL : NO_MODEL;
  const CSS = `
.paths{border:2px solid #2E5A7D;border-radius:12px;padding:.2rem 1rem .9rem;margin:1rem 0;background:#fff}
.paths>summary{cursor:pointer;font-weight:800;font-size:1.05rem;color:#2E5A7D;padding:.6rem 0}
.paths h4{margin:1rem 0 .3rem;color:#2E5A7D}.paths .sub{color:#5C6771;font-size:.88rem;margin:0 0 .4rem}
.paths .pbtn{font:inherit;font-weight:700;padding:.45rem .9rem;border-radius:8px;border:1px solid #2E5A7D;background:#2E5A7D;color:#fff;cursor:pointer;margin:.2rem 0 .2rem .4rem}
.paths .pbtn.ghost{background:transparent;color:#2E5A7D}.paths .pbtn:disabled{opacity:.5}
.paths .pcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.6rem}
.paths .pcard{border:1px solid #CDD3D8;border-radius:10px;padding:.5rem .75rem;background:#FAFBFC}
.paths .pcard.on{border:2px solid #4A6B5A;background:#EEF5F0}
.paths .pcard h5{margin:0 0 .25rem;font-size:.98rem}.paths .pcard .mode{font-size:.75rem;font-weight:700;color:#2E5A7D;background:#DCE7EF;border-radius:99px;padding:.05rem .5rem;margin-inline-start:.3rem}
.paths .pcard p{margin:.2rem 0;font-size:.88rem}.paths .pcard b{font-size:.78rem;color:#5C6771;display:block}
.paths .pcard label{font-weight:700;font-size:.88rem;display:flex;gap:.35rem;align-items:center;margin-top:.3rem}
.paths textarea,.paths input[type=text],.paths input[type=number],.paths select{width:100%;font:inherit;font-size:.9rem;padding:.35rem .5rem;border:1px solid #CDD3D8;border-radius:6px;box-sizing:border-box}
.paths .perr{color:#8C3A34;font-weight:600}.paths .pwait{color:#5C6771;font-size:.9rem}
.paths .pnote{background:#F5EAD9;border-radius:6px;padding:.4rem .7rem;font-size:.9rem;margin:.4rem 0}
.paths .row2{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}@media (max-width:640px){.paths .row2{grid-template-columns:1fr}}
.paths .ptrack td{text-align:center}.paths .ptrack td:first-child{text-align:right}`;
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  function btn(text, cls, fn) { const b = el('button', 'pbtn' + (cls ? ' ' + cls : ''), text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  const txt = (x) => window.SBE_REFS ? SBE_REFS.strip(String(x == null ? '' : x)) : String(x || '');
  const arr = (x) => Array.isArray(x) ? x : [];
  const today = () => new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const T = (cols, rows, cls) => window.SBE_TABLE(cols, rows, 'kit-t' + (cls ? ' ' + cls : ''));

  function mount(node, opts) {
    if (!node || !M) return;
    if (!document.getElementById('sbe-paths-css')) { const st = el('style'); st.id = 'sbe-paths-css'; st.textContent = CSS; document.head.appendChild(st); }
    const KEY = (window.sbeUserKey ? sbeUserKey('sbe.paths.v1') : 'sbe.paths.v1:anon') + '.' + opts.mode;
    const EMPTY = () => ({ must: '', choose: '', cards: [], obs: {}, adjust: null, pick: '', lessons: [], cur: 0, resilience: '', sources: [], open: false });
    let S = EMPTY();
    try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.cards) S = Object.assign(EMPTY(), v); } catch (e) {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
    const ctx = () => { try { return opts.context() || {}; } catch (e) { return {}; } };
    const seqMode = opts.mode === 'seq';
    const box = el('details', 'paths'); box.open = !!S.open;
    box.addEventListener('toggle', () => { S.open = box.open; save(); if (box.open) draw(); });
    const sm = el('summary', null, '🧭 מסלולי השתתפות בלמידה'); box.appendChild(sm);
    const body = el('div'); box.appendChild(body);
    node.appendChild(box);
    const picked = () => S.cards.filter((c) => c.on);

    function ctxText() {
      const c = ctx(), lines = [];
      if (c.goal) lines.push('מטרת הפעילות: ' + c.goal);
      if (c.smart) lines.push('היעד: ' + c.smart);
      if (c.topic) lines.push('נושא הרצף: ' + c.topic);
      if (arr(c.goals).length) lines.push('מטרות הרצף: ' + c.goals.join('; '));
      if (seqMode && arr(c.sessions)[S.cur]) lines.push('המפגש: ' + c.sessions[S.cur]);
      if (c.age) lines.push('גיל: ' + c.age);
      if (c.audience) lines.push('קהל היעד: ' + c.audience);
      if (c.domain) lines.push('תחום: ' + c.domain);
      if (c.duration) lines.push('משך: ' + c.duration);
      if (c.group) lines.push('אופי הפעילות: ' + c.group);
      return lines.join('\n');
    }
    function waiting(n, text, exp) {
      n.hidden = false; const t0 = Date.now();
      const tick = () => { n.textContent = text + ' בדרך כלל ' + exp + ' שניות. עברו ' + Math.round((Date.now() - t0) / 1000) + ' שניות.'; };
      tick(); const iv = setInterval(tick, 1000); return () => { clearInterval(iv); n.hidden = true; };
    }
    function area(obj, k, label, rows, ph) { const t = el('textarea'); t.rows = rows || 2; t.value = txt(obj[k] || ''); t.setAttribute('aria-label', label); if (ph) t.placeholder = ph; t.addEventListener('input', () => { obj[k] = t.value; save(); }); return t; }
    function sel(obj, k, label, list, onChange) {
      const s = el('select'); s.setAttribute('data-closed', ''); s.setAttribute('aria-label', label); s.appendChild(new Option('בחירה…', ''));
      list.forEach((o) => s.appendChild(new Option(o, o))); s.value = obj[k] || ''; s.addEventListener('change', () => { obj[k] = s.value; save(); if (onChange) onChange(); }); return s;
    }

    async function suggest(b, err, wait) {
      const c = ctxText(); err.hidden = true;
      if (!/מטרת הפעילות|היעד|נושא הרצף|מטרות הרצף/.test(c)) { err.textContent = 'כדי להציע מסלולים, נשמח למטרה (או לנושא הרצף) בטופס התכנון.'; err.hidden = false; return; }
      b.disabled = true; const stop = waiting(wait, 'מציעה מסלולי השתתפות למטרה.', 40);
      let k = null, bad = null;
      try { k = await window.sbeCallAIJson(SERVER, { system: M.suggestSystem(KB), messages: [{ role: 'user', content: c + '\n\nהציעי מסלולים.' }], maxTokens: 4000, customerReview: true }, 180000, M.valid); }
      catch (e) { bad = e; console.warn('מסלולים:', e.message); } finally { stop(); b.disabled = false; }
      if (!M.valid(k)) { err.textContent = why(bad); err.hidden = false; return; }
      const keep = picked();
      S.must = k.must || ''; S.choose = k.choose || ''; S.resilience = k.resilience || ''; S.sources = arr(k.sources);
      S.cards = keep.concat(arr(k.cards).filter((x) => x && x.name && !keep.some((p) => p.name === x.name)).map((x) => ({ name: x.name, mode: x.mode, how: x.how, crit: x.evidence, support: x.support, access: x.access, fit: x.fit, on: false, ok: false })));
      S.adjust = null; save(); draw();
    }
    async function adjust(b, err, wait) {
      const ps = picked(); err.hidden = true;
      const log = ps.map((p) => { const o = S.obs[p.name] || {}; return p.name + ': בחרו ' + (o.count || 'לא תועד') + ' · עדות להבנה: ' + (o.ev || 'לא תועד') + ' · מה אפשר או עיכב: ' + (o.cond || 'לא נכתב'); }).join('\n');
      if (!ps.some((p) => { const o = S.obs[p.name] || {}; return o.count || o.ev || o.cond; })) { err.textContent = 'כדי להציע התאמה, נשמח לתיעוד של מסלול אחד לפחות בדף התצפית.'; err.hidden = false; return; }
      b.disabled = true; const stop = waiting(wait, 'מציעה התאמה לשיעור הבא.', 30);
      let k = null, bad = null;
      try { k = await window.sbeCallAIJson(SERVER, { system: M.adjustSystem(KB), messages: [{ role: 'user', content: ctxText() + '\n\nמה כולם מדגימים: ' + S.must + '\n\nהמסלולים והקריטריונים:\n' + ps.map((p) => p.name + ' (' + p.mode + '): ' + txt(p.crit)).join('\n') + '\n\nדף התצפית:\n' + log + '\n\nהציעי התאמה.' }], maxTokens: 2000, customerReview: true }, 120000, M.validAdjust); }
      catch (e) { bad = e; } finally { stop(); b.disabled = false; }
      if (!M.validAdjust(k)) { err.textContent = why(bad); err.hidden = false; return; }
      S.adjust = k; S.pick = ''; save(); draw();
    }
    function saveLesson() {
      const ps = picked(), c = ctx();
      const lesson = { label: seqMode ? 'מפגש ' + (S.cur + 1) : 'שיעור ' + (S.lessons.length + 1), date: today(), offered: ps.map((p) => p.name),
        used: Object.fromEntries(ps.map((p) => [p.name, +((S.obs[p.name] || {}).count) || 0])), decision: S.pick || '' };
      if (seqMode) { const n = Math.max(arr(c.sessions).length, S.cur + 1); while (S.lessons.length < n) S.lessons.push({ label: 'מפגש ' + (S.lessons.length + 1), offered: [], used: {} }); S.lessons[S.cur] = lesson; }
      else S.lessons.push(lesson);
      S.obs = {}; S.adjust = null; S.pick = ''; if (seqMode) S.cur = Math.min(S.cur + 1, Math.max(0, arr(c.sessions).length - 1));
      save(); draw();
    }

    function printCards() {
      const out = el('div'); out.appendChild(el('p', null, 'מה כולם מדגימים: ' + txt(S.must)));
      picked().forEach((p) => { const c = el('div', 'rcard'); c.appendChild(el('h3', null, txt(p.name) + ' · ' + txt(p.mode)));
        [['מה עושים', p.how], ['איך מראים שהבנתי', p.crit], ['מה עוזר אם נתקעים', p.support]].forEach(([l, v]) => { if (!v) return; const r = el('div', 'rcard-row'); r.appendChild(el('b', null, l)); r.appendChild(el('span', null, txt(v))); c.appendChild(r); });
        out.appendChild(c); });
      window.SBE_DOC.print({ title: 'כרטיסי מסלולים', subtitle: txt(ctx().goal || ctx().topic || ''), kind: 'כרטיסי מסלולי השתתפות', node: out });
    }
    function printObs() {
      const out = el('div'); out.appendChild(el('p', null, 'תאריך: ____________   ' + (seqMode ? 'מפגש ' + (S.cur + 1) : '')));
      out.appendChild(el('p', null, 'מה כולם מדגימים: ' + txt(S.must)));
      out.appendChild(T(['המסלול', 'הקריטריון לעדות ללמידה', 'כמה בחרו', 'נראתה עדות להבנה? (כן / בחלקו / לא)', 'מה אפשר או עיכב השתתפות'],
        picked().map((p) => [txt(p.name), txt(p.crit), ' ', ' ', (() => { const d = el('div'); d.style.height = '3.2em'; return d; })()])));
      out.appendChild(el('p', null, 'התצפית היא על התנאים והפעולות, לא על התלמידים.'));
      window.SBE_DOC.print({ title: 'דף תצפית: מסלולי השתתפות', subtitle: txt(ctx().goal || ctx().topic || ''), kind: 'דף תצפית', node: out });
    }

    function draw() {
      if (!box.open) return;
      body.textContent = '';
      body.appendChild(el('p', 'sub', 'אין דרך אחת ללמוד. בחרי כמה דרכים להשתתף ולהראות הבנה סביב אותה מטרה, ובדקי אחרי השיעור מה אפשר השתתפות ולמידה.'));
      const c = ctx();
      if (seqMode) {
        const ss = arr(c.sessions); const d = el('div'); d.appendChild(el('b', null, 'לאיזה מפגש מתכננים עכשיו'));
        const s = el('select'); s.setAttribute('data-closed', ''); s.setAttribute('aria-label', 'המפגש'); (ss.length ? ss : ['מפגש 1']).forEach((x, i) => s.appendChild(new Option(x.length > 70 ? x.slice(0, 70) + '…' : x, String(i))));
        s.value = String(S.cur); s.addEventListener('change', () => { S.cur = +s.value; save(); draw(); }); d.appendChild(s); body.appendChild(d);
      }
      // 1. הצעה ובחירה
      body.appendChild(el('h4', null, '1. מסלולים לבחירה'));
      const err = el('p', 'perr'); err.hidden = true; const wait = el('p', 'pwait'); wait.hidden = true;
      const sb = btn(S.cards.length ? 'הצעה חדשה למטרה' : 'הצעת מסלולים למטרה', S.cards.length ? 'ghost' : '', () => suggest(sb, err, wait));
      body.append(sb, wait, err);
      if (S.cards.length || S.must) {
        body.appendChild(el('p', 'sub', M.SECTIONS.frame.h));
        const r2 = el('div', 'row2'), a = el('div'), b2 = el('div');
        a.append(el('b', null, 'מה כולם מדגימים (לא בבחירה)'), area(S, 'must', 'מה כולם מדגימים', 2)); b2.append(el('b', null, 'מה התלמידים בוחרים'), area(S, 'choose', 'מה התלמידים בוחרים', 2));
        r2.append(a, b2); body.appendChild(r2);
      }
      if (S.cards.length) {
        body.appendChild(el('p', 'sub', M.SECTIONS.cards.sub));
        const grid = el('div', 'pcards');
        S.cards.forEach((p) => {
          const cd = el('div', 'pcard' + (p.on ? ' on' : '')); const h = el('h5', null, txt(p.name)); h.appendChild(el('span', 'mode', p.mode || '')); cd.appendChild(h);
          [['מה עושים', p.how], ['למה זה מתאים', p.fit], ['מה עוזר', p.support], ['איך זה מנגיש לעמיתים', p.access]].forEach(([l, v]) => { if (!v) return; const q = el('p'); q.appendChild(el('b', null, l)); q.appendChild(document.createTextNode(txt(v))); cd.appendChild(q); });
          if (!p.how) { cd.appendChild(el('b', null, 'מה עושים')); cd.appendChild(area(p, 'how', 'מה עושים: ' + p.name, 2, 'בשניים או שלושה משפטים, כמו בכרטיס לתלמיד')); }
          const lb = el('label'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!p.on; cb.addEventListener('change', () => { p.on = cb.checked; save(); draw(); });
          lb.append(cb, document.createTextNode(' בוחרת במסלול הזה')); cd.appendChild(lb); grid.appendChild(cd);
        });
        body.appendChild(grid);
      }
      // הרשימה הארוכה: תמיד זמינה
      const all = el('details'); all.appendChild(el('summary', null, 'הרשימה המלאה (' + M.CATALOG.length + ' מסלולים)'));
      M.MODES.forEach((m) => { all.appendChild(el('b', null, m)); const u = el('div');
        M.CATALOG.filter((x) => x.m === m).forEach((x) => { const has = S.cards.some((p) => p.name === x.n);
          const b = btn((has ? '✓ ' : '➕ ') + x.n, 'ghost', () => { if (!has) { S.cards.push({ name: x.n, mode: x.m, how: '', crit: '', support: '', access: '', fit: '', on: true, ok: false }); save(); draw(); } }); b.disabled = has; u.appendChild(b); });
        all.appendChild(u); });
      body.appendChild(all);
      const ps = picked();
      if (ps.length === 1) body.appendChild(el('p', 'pnote', 'כדאי לבחור לפחות שתי דרכים סביב אותה מטרה, כדי שתהיה בחירה אמיתית.'));
      if (ps.length > 4) body.appendChild(el('p', 'pnote', 'בחירה טובה היא בין שתיים לארבע אפשרויות. אפשר להשאיר את השאר לשיעור אחר.'));
      // 2. קריטריונים, כרטיסים ודף תצפית
      if (ps.length) {
        body.appendChild(el('h4', null, '2. ' + M.SECTIONS.criteria.h)); body.appendChild(el('p', 'sub', M.SECTIONS.criteria.sub));
        body.appendChild(T(M.SECTIONS.criteria.cols, ps.map((p) => { const ok = el('input'); ok.type = 'checkbox'; ok.checked = !!p.ok; ok.setAttribute('aria-label', 'אישרתי: ' + p.name); ok.addEventListener('change', () => { p.ok = ok.checked; save(); }); return [txt(p.name) + ' · ' + (p.mode || ''), area(p, 'crit', 'הקריטריון: ' + p.name, 2, 'מה תראי או תשמעי שיגיד שהבינו'), ok]; })));
        const row = el('div');
        row.append(btn('🖨 כרטיסי מסלולים לתלמידים', 'ghost', printCards), btn('🖨 דף תצפית', 'ghost', printObs));
        if (opts.insert) row.appendChild(btn('➕ הוספה לתכנון הפעילות', 'ghost', () => { opts.insert('מסלולי השתתפות: ' + ps.map((p) => p.name + ' (' + p.mode + ')').join('; ') + '. מה כולם מדגימים: ' + txt(S.must)); }));
        body.appendChild(row);
        // 3. אחרי השיעור
        body.appendChild(el('h4', null, '3. אחרי השיעור: ' + M.SECTIONS.observe.h)); body.appendChild(el('p', 'sub', M.SECTIONS.observe.sub));
        body.appendChild(T(M.SECTIONS.observe.cols, ps.map((p) => { const o = S.obs[p.name] || (S.obs[p.name] = {}); const n = el('input'); n.type = 'number'; n.min = '0'; n.value = o.count || ''; n.setAttribute('aria-label', 'כמה בחרו: ' + p.name); n.addEventListener('input', () => { o.count = n.value; save(); });
          return [txt(p.name), n, sel(o, 'ev', 'עדות להבנה: ' + p.name, M.OBS), area(o, 'cond', 'מה אפשר או עיכב: ' + p.name, 2, 'תנאים ופעולות, למשל: הוראה כתובה על הלוח, זמן, גודל הקבוצה')]; })));
        const e2 = el('p', 'perr'); e2.hidden = true; const w2 = el('p', 'pwait'); w2.hidden = true;
        const ab = btn('הצעת התאמה לשיעור הבא', S.adjust ? 'ghost' : '', () => adjust(ab, e2, w2)); body.append(ab, w2, e2);
        if (S.adjust) {
          body.appendChild(T(M.SECTIONS.adjust.cols, arr(S.adjust.options).map((o) => [txt(o.name), txt(o.change), txt(o.why)])));
          if (S.adjust.keep) body.appendChild(el('p', null, 'מה כדאי לשמור: ' + txt(S.adjust.keep)));
          if (S.adjust.learned) body.appendChild(el('p', 'pnote', txt(S.adjust.learned)));
          const d = el('div'); d.appendChild(el('b', null, 'ההחלטה שלי לשיעור הבא')); d.appendChild(sel(S, 'pick', 'ההחלטה לשיעור הבא', arr(S.adjust.options).map((o) => txt(o.name)))); body.appendChild(d);
        }
        body.appendChild(btn('💾 שמירת ' + (seqMode ? 'המפגש' : 'השיעור') + ' במעקב', '', saveLesson));
      }
      // 4. מעקב
      const done = S.lessons.filter((l) => arr(l.offered).length);
      if (done.length) {
        body.appendChild(el('h4', null, '4. ' + M.SECTIONS.track.h)); body.appendChild(el('p', 'sub', M.SECTIONS.track.sub));
        const tr = M.track(S.lessons);
        body.appendChild(T(['המסלול'].concat(S.lessons.map((l) => l.label)), tr.rows.map((r) => [r.name].concat(r.cells)), 'ptrack'));
        const dec = S.lessons.filter((l) => l.decision).map((l) => [l.label + (l.date ? ' (' + l.date + ')' : ''), l.decision]);
        if (dec.length) body.appendChild(T(['השיעור', 'ההחלטה לשיעור הבא'], dec));
        if (tr.never.length) body.appendChild(el('p', 'pnote', 'הוצעו ולא נבחרו עדיין: ' + tr.never.join('; ') + '. אפשר לבדוק מה יעזור לנסות אותם, או להחליף.'));
        if (tr.single.length) body.appendChild(el('p', 'pnote', 'בשיעורים ' + tr.single.join(', ') + ' הוצעה דרך השתתפות מסוג אחד בלבד (רק לבד, או רק בקבוצה).'));
      }
      if (window.SBE_REFS && S.sources.length) { SBE_REFS.begin(SRC, 'resilience-advisor-sources.html'); const rr = el('div'); if (S.resilience) { rr.appendChild(el('h4', null, 'מה זה בונה בחוסן')); rr.appendChild(el('p', null, txt(S.resilience))); } SBE_REFS.add(S.sources); const rs = SBE_REFS.end(); if (rs) rr.appendChild(rs); body.appendChild(rr); }
      if (window.SBE_OPEN && SBE_OPEN.scan) try { SBE_OPEN.scan(); } catch (e) {}
    }
    draw();
  }
  window.SBE_PATHS_UI = { mount };
})();
