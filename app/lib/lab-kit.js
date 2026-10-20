// ערכת עזר משותפת למעבדת שיח וחקר משותף ולחשיבת צוות (11/10/2026).
// SBE_LABKIT: בניית אלמנטים, לוח צעדים, טבלה לעריכה, המתנה למודל, שיחה בכל שלב, משוב מכבד, חגיגה קטנה ושומר תשובות מאוחרות.
// המשוב המכבד (FEEDBACK_SYSTEM): הרעיון כפי שהבנו אותו · תרומה אפשרית ליעד · קושי מנומק · הצעה · שאלה פתוחה.
// לא ממציאים חולשה, ראיה או יתרון, ולא הופכים התנגדות להסכמה. פגיעה אישית עוצרת את השיתוף ומזמינה מבוגר.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_LABKIT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FEEDBACK_SYSTEM = [
    'את עוזרת לקבוצה לתת משוב שהוא גם מודל לשיח. קיבלת משוב שמשתתף/ת כתב/ה על רעיון, הסבר או ראיה של הקבוצה, ואת ההקשר (השאלה או האתגר, והיעד).',
    'בני משוב בחמישה חלקים: idea (הרעיון כפי שהבנו אותו, במשפט אחד), contribution (תרומה אפשרית ליעד, רק אם יש כזו באמת), difficulty (הקושי או החיסרון, רק אם נמסר נימוק אמיתי, בניסוח ענייני), suggestion (הצעה לבדיקה או לשיפור), question (שאלה פתוחה אחת).',
    'rewrite: ניסוח מכבד של המשוב, בגוף ראשון של מי שכתב/ה, שמשמר את הביקורת העניינית. ביקורת מתייחסת לרעיון, להסבר ולראיה, ושומרת על כבוד האדם.',
    'kind: "ok" כשהמשוב כבר ענייני ומכבד (אז rewrite קרוב מאוד למקור). "rephrase" כשיש בו פגיעה או זלזול, אבל גם נימוק אמיתי: משמרים את הנימוק בניסוח מכבד. "clarify" כשיש רק זלזול בלי נימוק: rewrite מבקש הסבר ודרך לבדוק, למשל "אני עדיין לא מבין/ה איך ההצעה עוזרת לשאלה שלנו. אפשר להסביר את הקשר ולהציע דרך לבדוק אותו?". "stop" כשיש פגיעה אישית, השפלה, איום או חשיפת מידע פרטי: לא מנסחים מחדש, ו-note מזמין את המבוגר/ת לתווך בשיחה.',
    'כללים: לא ממציאים חולשה, ראיה או יתרון כדי להשלים תבנית. לא הופכים התנגדות להסכמה ולא מחליפים ביקורת מנומקת בפרגון ריק. מחלוקת עניינית היא חלק מהחקר. בלי ציונים לאנשים ובלי תיוג. עברית פשוטה ומשפטים מלאים עם נקודה בסוף.',
    'note: משפט קצר למי שכתב/ה, מה השתנה בניסוח ולמה (או למה כדאי לעצור ולדבר עם המבוגר/ת; בצוות של מבוגרים: עם המנחה או בצוות).',
    'החזירי אך ורק JSON: {"kind":"ok","idea":"","contribution":"","difficulty":"","suggestion":"","question":"","rewrite":"","note":""}'
  ].join('\n\n');
  const FB_KINDS = { ok: '✓ המשוב ענייני ומכבד', rephrase: '🌱 הצעה לניסוח מכבד, עם אותה ביקורת', clarify: '❓ חסר נימוק: הצעה לבקש הסבר', stop: '✋ כדאי לעצור ולדבר עם המבוגר/ת' };
  function validFeedback(o) { return !!(o && typeof o === 'object' && FB_KINDS[o.kind] && (o.kind === 'stop' ? o.note : o.rewrite)); }

  if (typeof document === 'undefined') return { FEEDBACK_SYSTEM, FB_KINDS, validFeedback };

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
  const btn = (text, cls, fn) => { const b = el('button', cls || 'btn ghost sm', text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };
  const arr = (x) => Array.isArray(x) ? x : [];
  const txt = (x) => window.SBE_REFS ? SBE_REFS.strip(String(x == null ? '' : x)) : String(x == null ? '' : x);
  const SERVER = () => (window.sbeAIOrigin ? sbeAIOrigin() : 'https://sbe-server.onrender.com');
  const NO_MODEL = 'אין כרגע חיבור למודל, ולכן התוצר לא הוכן. מה שמולא נשמר, ואפשר לנסות שוב בעוד דקה או שתיים.';
  const PARTIAL = 'התוצר חזר חלקי. מה שמולא נשמר, ואפשר לנסות שוב.';
  const LATE = 'התשובה הגיעה אחרי שינוי בעבודה, ולכן היא לא הוחלה. אפשר לבקש שוב.';
  const why = (e) => (typeof window !== 'undefined' && window.sbeAIError) ? window.sbeAIError(e, NO_MODEL, PARTIAL) : ((e && e.code === 'incomplete') ? PARTIAL : NO_MODEL);

  // לוח הצעדים: אסימון וסמל לכל צעד
  function steps(host, stages, onGo) {
    host.textContent = '';
    stages.forEach((s) => {
      const li = el('li'); li.dataset.step = s.n;
      li.append(el('span', 'tok', s.i), el('b', null, s.n + '. ' + s.t), el('span', 'sd', s.d));
      li.addEventListener('click', () => onGo(s.n)); host.appendChild(li);
    });
    return (n, doneUpTo) => host.querySelectorAll('li').forEach((li) => {
      const i = +li.dataset.step; li.classList.toggle('on', i === n); li.classList.toggle('done', i < n || i <= (doneUpTo || 0));
    });
  }
  function enter(sec) { sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter'); }

  function waiting(node, text, exp) {
    node.hidden = false; node.textContent = '';
    const line = el('div'), bar = el('div', 'bar'), fill = el('div'); bar.appendChild(fill); node.append(line, bar);
    const t0 = Date.now();
    const tick = () => { const s = Math.round((Date.now() - t0) / 1000); line.textContent = text + ' התהליך נמשך כ־' + exp + ' שניות. חלפו ' + s + ' שניות.'; fill.style.width = Math.min(95, s / exp * 90) + '%'; };
    tick(); const iv = setInterval(tick, 1000);
    return () => { clearInterval(iv); node.hidden = true; };
  }

  // שדה שנשמר מיד
  function field(obj, k, label, area, onChange) {
    const i = area ? el('textarea') : el('input'); if (!area) i.type = 'text'; else i.rows = 2;
    i.value = obj[k] == null ? '' : String(obj[k]); i.setAttribute('aria-label', label);
    i.addEventListener('input', () => { obj[k] = i.value; if (onChange) onChange(); }); return i;
  }
  function choice(obj, k, label, opts, onChange) {
    const s = el('select'); s.setAttribute('data-closed', ''); s.setAttribute('aria-label', label);
    s.appendChild(new Option('בחירה…', ''));
    opts.forEach((o) => { const v = Array.isArray(o) ? o : [o, o]; s.appendChild(new Option(v[1], v[0])); });
    s.value = obj[k] == null ? '' : String(obj[k]);
    s.addEventListener('change', () => { obj[k] = s.value; if (onChange) onChange(); }); return s;
  }
  // טבלה לעריכה: עמודה לכל מפתח; spec: {k, l, area, opts: [..] | () => [..]}
  function etable(cols, list, onChange, opts) {
    opts = opts || {};
    const wrap = el('div');
    const redraw = () => {
      wrap.textContent = '';
      const rows = list.map((r, ri) => cols.map((c, ci) => {
        const cell = el('div');
        const o = typeof c.opts === 'function' ? c.opts() : c.opts;
        cell.appendChild(o ? choice(r, c.k, c.l, o, onChange) : field(r, c.k, c.l, c.area, onChange));
        if (ci === cols.length - 1 && opts.remove !== false) {
          const x = btn('✕', 'xbtn no-print', () => { list.splice(ri, 1); onChange(); redraw(); if (opts.after) opts.after(); });
          x.setAttribute('aria-label', 'הסרת השורה'); cell.appendChild(x);
        }
        return cell;
      }));
      wrap.appendChild(window.SBE_TABLE(cols.map((c) => c.l), rows, 'kit-t etable'));
      if (opts.add) wrap.appendChild(btn('➕ ' + opts.add, 'btn ghost sm no-print', () => { list.push(opts.blank ? opts.blank() : {}); onChange(); redraw(); if (opts.after) opts.after(); }));
    };
    redraw(); return wrap;
  }

  // "מה הרווחנו מהחשיבה ביחד?" בכל שלב
  function gain(obj, k, question, onChange) {
    const box = el('div', 'gain'); box.appendChild(el('b', null, '🤝 ' + question));
    // מתי, מי שואל את מי ובשביל מה (12/10/2026, בדיקת הלקוחה)
    box.appendChild(el('p', 'sub', 'בסוף השלב המנחה שואל/ת את כל הקבוצה. כל אחד ואחת עונים במשפט, והמתעד/ת כותב/ת כאן, כדי שנראה מה הרווחנו יחד.'));
    box.appendChild(field(obj, k, question, true, onChange)); return box;
  }

  function celebrate() {
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
    const box = el('div', 'confetti'); box.setAttribute('aria-hidden', 'true');
    const C = ['#2A9D8F', '#E3A72F', '#4E9A4F', '#D9694B', '#24476B'];
    for (let i = 0; i < 36; i++) {
      const p = el('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = C[i % C.length];
      p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = Math.random() * .35 + 's'; if (i % 3 === 0) p.style.borderRadius = '50%'; box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2400);
  }

  const json = (system, content, check, maxTokens) => window.sbeCallAIJson(SERVER(), { system, messages: [{ role: 'user', content }], maxTokens: maxTokens || 6000, customerReview: true }, 300000, check);
  const plain = (system, messages, maxTokens) => window.sbeCallAI(SERVER(), { system, messages, maxTokens: maxTokens || 3000 }, 180000);

  // שיחה בכל שלב: שאלה, בקשת הבהרה או הצעת שיפור. התשובה לא משנה את העבודה: מה שמאמצים, מאמצים במפורש.
  function chat(host, o) {
    const det = el('details', 'side no-print'); det.appendChild(el('summary', null, '💬 שאלה על השלב: הבהרה או הצעה'));
    const log = el('div'), ta = el('textarea'); ta.rows = 2; ta.placeholder = o.ph || 'למשל: איך אפשר לבדוק את הטענה הזאת בכיתה?';
    const w = el('div', 'wait'); w.hidden = true; const err = el('p', 'err'); err.hidden = true;
    const hist = o.history();
    const draw = () => { log.textContent = ''; hist.forEach((m) => { const d = el('div', 'msg ' + (m.role === 'user' ? 'me' : 'bot')); if (m.role === 'user') d.textContent = m.content; else d.appendChild(window.SBE_DOC ? SBE_DOC.rich(txt(m.content)) : el('div', null, m.content)); log.appendChild(d); }); };
    const send = btn('שליחה', 'btn sm', async () => {
      const q = ta.value.trim(); if (!q) return; err.hidden = true;
      hist.push({ role: 'user', content: q }); ta.value = ''; draw(); o.save();
      send.disabled = true; const stop = waiting(w, 'חושבת על השאלה.', 20);
      try {
        const msgs = hist.slice(-8).map((m, i, a) => ({ role: m.role, content: i === 0 && m.role === 'user' ? 'ההקשר של העבודה עכשיו:\n' + o.context() + '\n\nהשאלה: ' + m.content : m.content }));
        if (msgs[0].role !== 'user') msgs.shift();
        const a = await plain(o.system(), msgs, 3000);
        if (!String(a || '').trim()) throw new Error('empty');
        hist.push({ role: 'assistant', content: String(a).trim() }); o.save(); draw();
      } catch (e) { hist.pop(); o.save(); draw(); ta.value = q; err.textContent = NO_MODEL; err.hidden = false; }
      finally { stop(); send.disabled = false; }
    });
    det.append(log, ta, el('div', 'btns'), w, err); det.querySelector('.btns').appendChild(send);
    draw(); host.appendChild(det); return det;
  }

  // משוב מכבד: המקור וההצעה זה לצד זה; האדם בוחר לאמץ, לערוך או להשאיר לדיון עם המורה
  function feedback(host, o) {
    const det = el('details', 'side no-print'); det.appendChild(el('summary', null, '🌱 משוב מכבד: לנסח ביחד'));
    det.appendChild(el('p', 'muted', 'כותבים את המשוב כפי שנאמר. מקבלים ניסוח שמשמר את הביקורת העניינית, ובוחרים מה עושים איתו.'));
    const ta = el('textarea'); ta.rows = 2; ta.placeholder = 'למשל: הרעיון הזה לא יעבוד, אין לו שום קשר לשאלה.';
    const about = el('input'); about.type = 'text'; about.placeholder = 'על איזה רעיון, טענה או ראיה (אפשר להשאיר ריק)';
    const w = el('div', 'wait'); w.hidden = true; const err = el('p', 'err'); err.hidden = true; const out = el('div');
    const go = btn('ניסוח מכבד', 'btn sm', async () => {
      const t = ta.value.trim(); if (!t) return; err.hidden = true; out.textContent = '';
      go.disabled = true; const stop = waiting(w, 'קוראת את המשוב.', 15);
      let r = null, bad = null;
      try { r = await window.sbeCallAIJson(SERVER(), { system: FEEDBACK_SYSTEM, messages: [{ role: 'user', content: 'ההקשר:\n' + o.context() + (about.value.trim() ? '\n\nהמשוב מתייחס ל: ' + about.value.trim() : '') + '\n\nהמשוב כפי שנכתב:\n' + t }], maxTokens: 3000 }, 120000, validFeedback); }
      catch (e) { bad = e; }
      finally { stop(); go.disabled = false; }
      if (!validFeedback(r)) { err.textContent = why(bad); err.hidden = false; return; }
      show(t, about.value.trim(), r);
    });
    function show(orig, on, r) {
      out.textContent = '';
      out.appendChild(el('p', 'note' + (r.kind === 'ok' ? ' ok' : ''), (r.kind === 'stop' && o.adult && o.adult() ? '✋ כדאי לעצור ולדבר על זה בצוות, עם המנחה' : FB_KINDS[r.kind]) + (r.note ? '. ' + txt(r.note) : '')));
      if (r.kind === 'stop') { o.log({ at: new Date().toISOString(), on, was: orig, now: '', how: o.adult && o.adult() ? 'לשיחה בצוות, עם המנחה' : 'לשיחה עם המבוגר/ת' }); return; }
      const pair = el('div', 'fb-pair'), a = el('div', 'was'), b = el('div', 'now');
      a.append(el('b', null, 'כפי שנכתב'), el('div', null, orig));
      const edit = el('textarea'); edit.value = txt(r.rewrite); edit.rows = 3;
      b.append(el('b', null, 'הצעה לניסוח'), edit); pair.append(a, b); out.appendChild(pair);
      const rows = [['הרעיון כפי שהבנו אותו', r.idea], ['תרומה אפשרית ליעד', r.contribution], ['קושי מנומק', r.difficulty], ['הצעה לבדיקה או לשיפור', r.suggestion], ['שאלה פתוחה', r.question]].filter((x) => String(x[1] || '').trim()).map((x) => [x[0], txt(x[1])]);
      if (rows.length) out.appendChild(window.SBE_TABLE(['חלק במשוב', 'מה כתוב'], rows, 'kit-t'));
      const keep = (how, now) => { o.log({ at: new Date().toISOString(), on, was: orig, now, how }); out.textContent = ''; out.appendChild(el('p', 'note ok', '✓ נשמר ביומן המשוב: ' + how + '.')); ta.value = ''; };
      const row = el('div', 'btns');
      row.append(btn('✓ אימוץ הניסוח', 'btn sm', () => keep('אומץ', edit.value.trim())), btn('השארת הנוסח שלי', 'btn ghost sm', () => keep('נשאר כפי שנכתב', orig)), btn(o.adult && o.adult() ? 'לדיון בצוות' : 'לדיון עם המורה', 'btn ghost sm', () => keep(o.adult && o.adult() ? 'לדיון בצוות' : 'לדיון עם המורה', edit.value.trim())));
      out.appendChild(row);
    }
    det.append(ta, about, el('div', 'btns'), w, err, out); det.querySelector('.btns').appendChild(go);
    host.appendChild(det); return det;
  }

  return { FEEDBACK_SYSTEM, FB_KINDS, validFeedback, el, btn, arr, txt, steps, enter, waiting, field, choice, etable, gain, celebrate, json, plain, chat, feedback, NO_MODEL, LATE, why };
});
