// מערך המוכנות: המסך (03/11/2026). התוכן מ-readiness-model.js (SBE_PREP), השמירה בשרת (harness/lib/readiness.mjs, פעולות rdy*).
// אב־הטיפוס: המערך שלנו · התוכנית · מפגש 1 · מפגש 2 · מפגש 3 (תרחיש "אזעקות ופינוי", הקלטה בטלפון ותחקיר),
// ובצד: קצוות פתוחים, טבלת הפעולות ורישום השינויים. docs/readiness-program/00-screen-plan.md.
(function () {
  'use strict';
  const P = window.SBE_PREP;
  const app = document.getElementById('app');
  if (!P || !app) return;
  const ss = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const SERVER = (typeof window.sbeAIOrigin === 'function' && window.sbeAIOrigin()) || 'https://sbe-server.onrender.com';
  const TOKEN = ss('sbe.session.token');
  const UK = (b) => (window.sbeUserKey && TOKEN ? window.sbeUserKey(b) : b);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(UK(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(UK(k), JSON.stringify(v)); } catch (e) {} }
  };
  const S = { lang: LS.get('sbe.prep.lang', 'he') === 'ar' ? 'ar' : 'he', by: LS.get('sbe.prep.by', ''), doc: null, list: null, step: 0, panel: '', exId: '', busy: false };
  let L = P.content(S.lang);

  // טקסטים קבועים שנוספו במסך (העיקריים ב-P.UI). ערבית ספרותית פשוטה.
  const X = {
    he: { login: 'כדי לפתוח את מערך המוכנות, אפשר להיכנס עם קוד שיש בו את הכלי.', ours: 'המערכים שלנו', none: 'עוד אין מערך מוכנות.', updated: 'עודכן',
      sessions: 'המפגשים', later: 'בשלב הבא', escalate: 'קצוות שעולים למנהל/ת מצב החירום', partners: 'שותפים: עם מי מתאמים בחירום?', expect: 'מה אנחנו מצפים לקבל', provide: 'מה אנחנו מספקים',
      ifGap: 'פער ממשק: חסר צד אחד', partner: 'שותף/ה', step: 'שלב', product: 'התוצר', questions: 'שאלות לצוות', ourText: 'מה כתבנו', ask: 'חוליות חלשות וחלופות', working: 'עובדים על זה…',
      gaps: 'פערים', alts: 'חלופות שאולי לא עלו', nextSteps: 'צעדי המשך', toEnds: 'לקצוות הפתוחים', addGap: 'לרשימת הפערים', before: 'לפני המפגש', during: 'במפגש', our: 'שלנו',
      teamsT: 'טבלת הצוותים', addMember: '➕ חבר/ה בצוות', checklist: 'רשימת בדיקה', yes: 'קיים', part: 'חלקי', no: 'חסר', reportOf: 'הדיווח של הצוות', timer3: 'שעון של 3 דקות',
      version: 'אורך התרגיל', v20: '20 דקות (ישיבת צוות)', v60: 'שעה', startEx: 'התחלת התרגיל', exercises: 'התרגילים', cont: 'המשך', finish: 'סיום התרחיש', opening: 'פתיחה',
      closing: 'סגירה', copy: 'העתקה', copied: 'הועתק', openRec: 'פתיחת קישור לטלפון', recOn: 'ההקלטה פתוחה', marks: 'רגעי החלטה', segs: 'קטעים בתמליל', loadTr: 'טעינת התמליל',
      editTr: 'עריכת התמליל (לפני שהוא משמש לדוח)', saveTr: 'שמירת התמליל', worked: 'מה עבד', timeline: 'ציר הזמן', fb: 'משוב מקצועי', src: 'מקור', addRow: '➕ שורה',
      toPlan: 'לעדכון במערך', printCards: '🖨 כרטיסי העדכונים (בלי חשמל)', printReport: '🖨 דוח התחקיר', printSummary: '🖨 סיכום המפגש', printPlan: '🖨 התוכנית והנספחים', printTeams: '🖨 טבלת הצוותים',
      confirmClose: 'לסגור את הקצה? מי שפתח/ה אותו יקבל/תקבל עדכון במפגש הבא.', confirmApprove: 'לאשר את הדוח? התמליל יימחק, והדוח והסימונים נשארים.', deleted: 'נמחק',
      none2: 'אין עדיין.', mailSent: 'נשלחו', reloaded: 'מישהו אחר עדכן את המערך. המסך נטען מחדש.', serverOld: 'השרת עוד לא עודכן לכלי הזה. אחרי עדכון השרת הכלי יעבוד.',
      waking: 'מתחברים לשרת… החיבור הראשון ביום נמשך עד כדקה.', missed: 'פעמים שעבר המועד', moveNext: 'עדכון מועד', when: 'מתי', extra: 'עוד', annexText: 'מה כתוב בנספח',
      callAfter: 'אחרי שההודעה נשלחת', recNo: 'בלי טלפון או בלי הסכמה: מסמנים רגעי החלטה כאן, בכפתור.', ledByDeputy: 'ממלא/ת המקום הוביל/ה', builtByTeam: 'התרחיש נבנה על ידי הצוות',
      min: 'דק׳', byName: 'השם שלי', allTeams: 'כל הצוות', exportNote: 'שמות של תלמידים לא נכנסים לכלי. הפרטים נשמרים בבית הספר.' },
    ar: { login: 'لفتح منظومة الجاهزية، يمكن الدخول برمز يشمل هذه الأداة.', ours: 'منظوماتنا', none: 'لا توجد منظومة جاهزية بعد.', updated: 'آخر تحديث',
      sessions: 'اللقاءات', later: 'في المرحلة القادمة', escalate: 'أطراف تُرفع إلى مدير/ة حالة الطوارئ', partners: 'الشركاء: مع من ننسّق في الطوارئ؟', expect: 'ما نتوقع أن نحصل عليه', provide: 'ما نقدّمه',
      ifGap: 'فجوة في التنسيق: ينقص أحد الطرفين', partner: 'الشريك/ة', step: 'مرحلة', product: 'الناتج', questions: 'أسئلة للطاقم', ourText: 'ما كتبناه', ask: 'حلقات ضعيفة وبدائل', working: 'نعمل على ذلك…',
      gaps: 'فجوات', alts: 'بدائل ربما لم تُطرح', nextSteps: 'خطوات تالية', toEnds: 'إلى الأطراف المفتوحة', addGap: 'إلى قائمة الفجوات', before: 'قبل اللقاء', during: 'في اللقاء', our: 'لنا',
      teamsT: 'جدول الطواقم', addMember: '➕ عضو/ة في الطاقم', checklist: 'قائمة فحص', yes: 'موجود', part: 'جزئي', no: 'ناقص', reportOf: 'تقرير الطاقم', timer3: 'ساعة لثلاث دقائق',
      version: 'مدة التمرين', v20: '20 دقيقة (جلسة طاقم)', v60: 'ساعة', startEx: 'بدء التمرين', exercises: 'التمارين', cont: 'متابعة', finish: 'إنهاء السيناريو', opening: 'افتتاح',
      closing: 'إغلاق', copy: 'نسخ', copied: 'تم النسخ', openRec: 'فتح رابط للهاتف', recOn: 'التسجيل مفتوح', marks: 'لحظات قرار', segs: 'مقاطع في النص المكتوب', loadTr: 'تحميل النص المكتوب',
      editTr: 'تحرير النص المكتوب (قبل استخدامه في التقرير)', saveTr: 'حفظ النص المكتوب', worked: 'ما الذي نجح', timeline: 'التسلسل الزمني', fb: 'ملاحظات مهنية', src: 'مصدر', addRow: '➕ سطر',
      toPlan: 'للتحديث في المنظومة', printCards: '🖨 بطاقات التحديثات (بدون كهرباء)', printReport: '🖨 تقرير استخلاص العبر', printSummary: '🖨 تلخيص اللقاء', printPlan: '🖨 الخطة والملاحق', printTeams: '🖨 جدول الطواقم',
      confirmClose: 'هل نغلق هذا الطرف؟ من فتحه سيحصل على تحديث في اللقاء القادم.', confirmApprove: 'هل نصادق على التقرير؟ سيُحذف النص المكتوب، ويبقى التقرير والإشارات.', deleted: 'حُذف',
      none2: 'لا يوجد بعد.', mailSent: 'أُرسلت', reloaded: 'قام شخص آخر بتحديث المنظومة. أُعيد تحميل الشاشة.', serverOld: 'لم يُحدَّث الخادم بعد لهذه الأداة. بعد التحديث ستعمل الأداة.',
      waking: 'نتصل بالخادم… الاتصال الأول في اليوم يستغرق حتى دقيقة.', missed: 'مرات تجاوز الموعد', moveNext: 'تحديث الموعد', when: 'متى', extra: 'المزيد', annexText: 'ما هو مكتوب في الملحق',
      callAfter: 'بعد إرسال الرسالة', recNo: 'بدون هاتف أو بدون موافقة: نشير إلى لحظات القرار هنا، بالزر.', ledByDeputy: 'قاد/ت القائم/ة بالأعمال', builtByTeam: 'بنى الطاقم السيناريو',
      min: 'د', byName: 'اسمي', allTeams: 'كل الطاقم', exportNote: 'أسماء الطلاب لا تدخل الأداة. التفاصيل تُحفظ في المدرسة.' }
  };
  const T = (k) => P.t(S.lang, k);
  const Y = (k) => (X[S.lang] && X[S.lang][k]) || X.he[k] || k;

  // ---------- עזרים ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return el;
  }
  const uid = (p) => (p || 'x') + '-' + Math.random().toString(16).slice(2, 10);
  const nowIso = () => new Date().toISOString();
  const dateIL = (iso) => (window.sbeDateIL ? window.sbeDateIL(String(iso || '').slice(0, 10)) : String(iso || '').slice(0, 10));
  const plus = (days) => (window.sbeIsoPlus ? window.sbeIsoPlus(days) : new Date(Date.now() + days * 864e5).toISOString().slice(0, 10));
  const teamName = (id) => { const t = L.TEAMS.find((x) => x.id === id); return t ? t.name : id === 'all' ? Y('allTeams') : (id || ''); };
  function toast(msg) { const t = h('div', { class: 'toast', role: 'status', text: msg }); document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
  function piiCheck(el) { el.addEventListener('blur', () => { if (P.PII_RX.test(el.value)) toast(T('piiWarn')); }); return el; }
  const parts = () => (S.doc ? S.doc.parts : {});
  const arr = (k) => (Array.isArray(parts()[k]) ? parts()[k] : []);
  const obj = (k) => (parts()[k] && typeof parts()[k] === 'object' && !Array.isArray(parts()[k]) ? parts()[k] : {});

  async function api(action, extra = {}, tries = 4) {
    let res;
    for (let i = 0; ; i++) {
      try {
        res = await fetch(SERVER + '/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token: TOKEN, ...extra }) });
        if (res.status < 500 || i >= tries - 1) break;
      } catch (e) { if (i >= tries - 1) return [0, { error: Y('waking') }]; }
      if (!S.doc && !S.list) app.replaceChildren(h('p', { class: 'muted', text: Y('waking') }));
      await new Promise((r) => setTimeout(r, 8000));
    }
    const data = await res.json().catch(() => ({ error: '' }));
    if (/unknown action/i.test(data.error || '')) return [res.status, { error: Y('serverOld') }];
    return [res.status, data];
  }

  // שמירת חלק: גרסה לכל חלק; כשמישהו אחר עדכן, המסך נטען מחדש עם הגרסה העדכנית.
  const timers = {};
  async function save(part, what) {
    clearTimeout(timers[part]); delete timers[part];
    const [st, out] = await api('rdySave', { id: S.doc.id, part, value: S.doc.parts[part], rev: S.doc.revs[part] || 0, what: what || '', by: S.by });
    if (st === 200) { S.doc.revs[part] = out.rev; S.doc.updatedAt = out.updatedAt; if (what) S.doc.log.push({ at: out.updatedAt, by: S.by || '', part, what }); return true; }
    if (st === 409 && out.doc) { S.doc = out.doc; toast(Y('reloaded')); render(); return false; }
    toast(out.error || 'לא נשמר'); return false;
  }
  function saveSoon(part, what) { clearTimeout(timers[part]); timers[part] = setTimeout(() => save(part, what), 900); }
  function setPart(part, value, what, soon) { S.doc.parts[part] = value; return soon ? saveSoon(part, what) : save(part, what); }

  function bindText(el, get, set, part, what) {
    el.value = get() || '';
    el.addEventListener('input', () => { set(el.value); saveSoon(part, what); });
    return piiCheck(el);
  }
  const field = (label, el, hint) => h('div', {}, h('label', { class: 'f' }, label, hint ? h('small', {}, ' (' + hint + ')') : null), el);

  function makeTimer(sec) {
    let left = sec, iv = null;
    const out = h('span', { class: 'timer', 'aria-live': 'off' });
    const show = () => { out.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); };
    const go = h('button', { class: 'btn sm', type: 'button', text: T('start'), onclick: () => {
      if (iv) { clearInterval(iv); iv = null; go.textContent = T('start'); return; }
      go.textContent = T('stop'); iv = setInterval(() => { left = Math.max(0, left - 1); show(); if (!left) { clearInterval(iv); iv = null; go.textContent = T('start'); } }, 1000);
    } });
    const rs = h('button', { class: 'btn ghost sm', type: 'button', text: T('reset'), onclick: () => { left = sec; show(); } });
    show();
    return h('span', { class: 'row noprint' }, h('span', { class: 'muted', text: T('timer') + ':' }), out, go, rs);
  }

  // ---------- ראשי ----------
  function setLang(lang) {
    S.lang = lang; LS.set('sbe.prep.lang', lang); L = P.content(lang);
    document.documentElement.lang = lang;
    document.getElementById('title').textContent = T('tool');
    document.getElementById('subtitle').textContent = T('sub');
    render();
  }

  async function start() {
    if (S.lang === 'ar') { document.documentElement.lang = 'ar'; document.getElementById('title').textContent = T('tool'); document.getElementById('subtitle').textContent = T('sub'); }
    if (!TOKEN) { app.replaceChildren(h('div', { class: 'card', text: Y('login') })); return; }
    const [st, out] = await api('rdyMine');
    if (st !== 200) { app.replaceChildren(h('div', { class: 'warn', text: out.error || '' })); return; }
    S.list = out.items;
    const last = LS.get('sbe.prep.last', '');
    const want = new URLSearchParams(location.search).get('id') || last;
    if (want && S.list.some((x) => x.id === want)) return openDoc(want);
    if (S.list.length === 1) return openDoc(S.list[0].id);
    render();
  }
  async function openDoc(id) {
    const [st, out] = await api('rdyGet', { id });
    if (st !== 200) { toast(out.error || ''); S.doc = null; render(); return; }
    S.doc = out.doc; LS.set('sbe.prep.last', id); S.step = LS.get('sbe.prep.step.' + id, 0) || 0;
    const ex = arr('exercises'); S.exId = ex.length ? ex[ex.length - 1].id : '';
    render();
  }

  function render() {
    if (!S.doc) return renderList();
    const sessions = obj('sessions');
    const st = P.stats(S.doc);
    const head = h('div', { class: 'row noprint' },
      h('b', { class: 'grow', text: parts().profile?.name || '' }),
      h('label', { class: 'row muted' }, Y('byName') + ': ', piiCheck(h('input', { type: 'text', value: S.by, style: 'width:150px', 'aria-label': T('by'), oninput: (e) => { S.by = e.target.value.slice(0, 60); LS.set('sbe.prep.by', S.by); } }))),
      h('button', { class: 'btn ghost sm', type: 'button', text: T('lang2'), onclick: () => setLang(S.lang === 'ar' ? 'he' : 'ar') }),
      h('button', { class: 'btn ghost sm', type: 'button', text: Y('ours'), onclick: () => { S.doc = null; LS.set('sbe.prep.last', ''); start(); } }));
    const steps = h('ol', { class: 'steps noprint', 'aria-label': T('tool') }, T('steps').map((label, i) =>
      h('li', {}, h('button', { type: 'button', class: (i >= 2 && sessions[i - 1] && sessions[i - 1].done) ? 'done' : '', 'aria-current': S.step === i ? 'step' : null,
        text: label, onclick: () => { S.step = i; S.panel = ''; LS.set('sbe.prep.step.' + S.doc.id, i); render(); window.scrollTo(0, 0); } }))));
    const side = h('div', { class: 'side noprint' },
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { S.panel = S.panel === 'ends' ? '' : 'ends'; render(); } }, T('ends') + ' ', h('span', { class: 'pill' + (st.escalate ? ' red' : ''), text: String(st.openEnds) })),
      h('button', { class: 'btn ghost sm', type: 'button', text: T('actions'), onclick: () => { S.panel = S.panel === 'actions' ? '' : 'actions'; render(); } }),
      h('button', { class: 'btn ghost sm', type: 'button', text: T('log'), onclick: () => { S.panel = S.panel === 'log' ? '' : 'log'; render(); } }));
    const body = S.panel === 'ends' ? viewEnds() : S.panel === 'actions' ? viewActions() : S.panel === 'log' ? viewLog()
      : [viewHome, viewPlan, viewS1, viewS2, viewS3][S.step]();
    app.replaceChildren(head, steps, side, body);
  }

  function renderList() {
    const list = h('div', { class: 'card' }, h('h2', { text: Y('ours') }),
      (S.list || []).length ? h('ul', { class: 'list' }, S.list.map((x) => h('li', {}, h('button', { class: 'btn ghost sm', type: 'button', text: x.name, onclick: () => openDoc(x.id) }),
        ' ', h('span', { class: 'muted', text: Y('updated') + ' ' + dateIL(x.updatedAt) + ' · ' + x.sessionsDone + '/5 · ' + T('ends') + ': ' + x.openEnds })))) : h('p', { class: 'muted', text: Y('none') }));
    const f = { name: h('input', { type: 'text', required: true }), levels: h('input', { type: 'text', placeholder: 'למשל: א׳ עד ו׳' }),
      lang: h('select', { 'data-closed': '' }, ['he', 'ar', 'both'].map((v) => h('option', { value: v, text: T(v) }))),
      size: h('select', { 'data-closed': '' }, h('option', { value: 'big', text: T('big') }), h('option', { value: 'small', text: T('small') })) };
    if (S.lang === 'ar') f.lang.value = 'ar';
    const go = h('button', { class: 'btn', type: 'button', text: T('open'), onclick: async () => {
      if (!f.name.value.trim()) { f.name.focus(); toast(T('name') + ': ' + T('main')); return; }
      go.disabled = true;
      const [st, out] = await api('rdyCreate', { by: S.by, profile: { name: f.name.value.trim(), levels: f.levels.value.trim(), lang: f.lang.value, size: f.size.value } });
      go.disabled = false;
      if (st !== 201) { toast(out.error || ''); return; }
      S.doc = out.doc; S.step = 0;
      // הצוותים וההגדרה של מנהל/ת מצב החירום מהמתווה, כנקודת התחלה שהצוות משנה. רשימת המשימות נשארת ריקה: הצוות כותב קודם.
      S.doc.parts.teams = L.TEAMS.map((t) => ({ id: t.id, name: t.name, lead: { name: '', email: '' }, deputy: { name: '', email: '' }, members: [] }));
      await save('teams', 'פתיחת טבלת הצוותים');
      S.doc.parts.em = { does: L.EM.does.slice(), doesnt: L.EM.doesnt.slice() };
      await save('em', '');
      LS.set('sbe.prep.last', S.doc.id);
      render();
    } });
    const form = h('div', { class: 'card' }, h('h2', { text: T('newProgram') }),
      field(T('name'), piiCheck(f.name), T('main')), field(T('levels'), f.levels, T('opt')), h('div', { class: 'row' }, h('div', { class: 'grow' }, field(T('lang'), f.lang)), h('div', { class: 'grow' }, field(T('size'), f.size))),
      h('p', { class: 'muted', text: Y('exportNote') }), go);
    app.replaceChildren(list, form);
  }

  // ---------- 🏠 המערך שלנו ----------
  function viewHome() {
    const st = P.stats(S.doc), ind = P.independence(S.doc), sessions = obj('sessions');
    const next = L.SESSIONS.find((s) => !(sessions[s.n] && sessions[s.n].done)) || null;
    const prog = h('div', { class: 'card' }, h('h2', { text: Y('sessions') }),
      h('div', { class: 'grid3' }, L.SESSIONS.map((s) => h('div', { class: 'tile' }, h('b', { text: s.n + '. ' + s.title }),
        (sessions[s.n] && sessions[s.n].done) ? h('span', { class: 'pill green', text: '✓ ' + dateIL(sessions[s.n].at) }) : s.n > 3 ? h('span', { class: 'pill', text: Y('later') }) : null))));
    const nextCard = next ? h('div', { class: 'note' }, h('b', { text: T('next1') + ': ' + next.n + '. ' + next.title }), h('div', { text: Y('before') + ': ' + next.before })) : null;
    const pill = (p) => {
      const lines = p.k === 'rel' ? [Y('partners').split(':')[0] + ': ' + st.rel.partners, T('deputy') + ': ' + st.rel.withDeputy + '/' + st.rel.teams]
        : p.k === 'info' ? [T('actions') + ': ' + st.info.actionsDone + '/' + st.info.actions, T('log') + ': ' + st.info.logs]
          : [T('lead') + ': ' + st.inst.staffed + '/' + st.inst.teams, Y('exercises') + ': ' + st.inst.exercises];
      return h('div', { class: 'tile' }, h('b', { text: p.name }), h('div', { class: 'muted', text: p.what }), h('ul', { class: 'list' }, lines.map((x) => h('li', { text: x }))));
    };
    const pillars = h('div', { class: 'card' }, h('h2', { text: T('pillars') }), h('div', { class: 'grid3' }, L.PILLARS.map(pill)));
    const indep = h('div', { class: 'card' }, h('h2', { text: T('independence') }),
      h('div', { class: 'grid3' }, L.INDEPENDENCE.map((x) => h('div', { class: 'tile' }, h('span', { class: 'big', text: String(ind[x.k] || 0) }), h('div', { text: x.name })))));
    const esc = st.escalate ? h('div', { class: 'warn' }, h('b', { text: Y('escalate') + ': ' + st.escalate + ' ' }), h('button', { class: 'btn sm', type: 'button', text: T('ends'), onclick: () => { S.panel = 'ends'; render(); } })) : null;
    return h('div', {}, esc, nextCard, prog, pillars, indep, viewPartners(), routineCard(), h('p', { class: 'muted', text: L.TABLETOP_NOTE }));
  }
  function routineCard() {
    return h('div', { class: 'card' }, h('h2', { text: T('routine') }), h('p', { text: String(L.ROUTINE).replace(/^[^:：]{2,30}[:：]\s*/, '') }),
      h('div', { class: 'row' }, L.ROUTINE_LINKS.map(([f, label]) => h('a', { class: 'btn ghost sm', href: f, text: label }))));
  }
  function viewPartners() {
    const list = arr('partners');
    const rows = list.map((p, i) => {
      const inp = (k) => bindText(h('input', { type: 'text' }), () => p[k], (v) => { p[k] = v; }, 'partners', 'שותפים');
      const gap = (!String(p.expect || '').trim() || !String(p.provide || '').trim()) && String(p.name || '').trim();
      return h('tr', {}, h('td', { 'data-h': Y('partner') }, inp('name')), h('td', { 'data-h': Y('expect') }, inp('expect')), h('td', { 'data-h': Y('provide') }, inp('provide')),
        h('td', {}, gap ? h('span', { class: 'pill red', text: Y('ifGap') }) : null, h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { list.splice(i, 1); setPart('partners', list, 'שותפים'); render(); } })));
    });
    return h('div', { class: 'card' }, h('h2', { text: Y('partners') }),
      h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [Y('partner'), Y('expect'), Y('provide'), ''].map((x) => h('th', { text: x })))), h('tbody', {}, rows)),
      h('button', { class: 'btn ghost sm', type: 'button', text: T('add'), onclick: () => { list.push({ id: uid('pt'), name: '', expect: '', provide: '' }); setPart('partners', list, ''); render(); } }));
  }

  // ---------- ✍️ התוכנית ----------
  function viewPlan() {
    const plan = obj('plan'); plan.steps = plan.steps || {}; plan.fb = plan.fb || {};
    if (!Array.isArray(plan.annexes) || !plan.annexes.length) plan.annexes = L.ANNEXES.map((a) => ({ id: a.id, name: a.name, team: a.team, maturity: -1, text: '' }));
    S.doc.parts.plan = plan;
    const steps = L.REMS.map((r) => {
      const ta = bindText(h('textarea', { rows: 4 }), () => plan.steps[r.n], (v) => { plan.steps[r.n] = v; }, 'plan', 'התוכנית: ' + r.title);
      const out = h('div', {});
      const fb = plan.fb[r.n]; if (fb) out.appendChild(fbView(fb));
      const ask = h('button', { class: 'btn ghost sm', type: 'button', text: Y('ask'), onclick: async () => {
        if (String(ta.value).trim().length < 30) { toast(T('feedbackAfter')); return; }
        ask.disabled = true; out.replaceChildren(h('p', { class: 'muted', text: Y('working') }));
        try {
          const srcs = (window.SBE_ADVISOR_SOURCES ? window.SBE_ADVISOR_SOURCES.forAdvisor('readiness') : []).map((s) => s.k + ': ' + String(s.gist || '').slice(0, 160)).join('\n');
          const content = 'שלב ' + r.n + ': ' + r.title + '\nמה עושים בשלב: ' + r.do + '\nהשאלות: ' + r.q.join(' ') + '\n\nמה הצוות כתב:\n' + ta.value + '\n\nמקורות אפשריים:\n' + srcs;
          const v = await window.sbeCallAIJson(SERVER, { system: P.planSystem(S.lang), messages: [{ role: 'user', content }], maxTokens: 4000 }, 180000, P.validPlan);
          plan.fb[r.n] = v; await save('plan', ''); out.replaceChildren(fbView(v));
        } catch (e) { out.replaceChildren(h('div', { class: 'warn', text: T('noModel') })); }
        ask.disabled = false;
      } });
      return h('details', { class: 'card', open: !plan.steps[r.n] && r.n === firstEmpty(plan) },
        h('summary', { text: r.n + '. ' + r.title + (plan.steps[r.n] ? ' ✓' : '') }),
        h('p', { text: r.do }), h('p', { class: 'muted', text: Y('product') + ': ' + r.product }),
        h('b', { text: Y('questions') }), h('ul', { class: 'list' }, r.q.map((q) => h('li', { text: q }))),
        field(Y('ourText'), ta), h('div', { class: 'row noprint' }, ask, h('span', { class: 'muted', text: T('feedbackAfter') })), out);
    });
    const annex = h('div', { class: 'card' }, h('h2', { text: T('annexes') }),
      h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('annexes'), T('team'), T('maturity'), Y('annexText')].map((x) => h('th', { text: x })))),
        h('tbody', {}, plan.annexes.map((a) => {
          const base = L.ANNEXES.find((x) => x.id === a.id) || {};
          const sel = h('select', { 'data-closed': '', 'aria-label': T('maturity') }, h('option', { value: '-1', text: '…' }), L.MATURITY.map((m, i) => h('option', { value: String(i), text: m })));
          sel.value = String(a.maturity == null ? -1 : a.maturity);
          sel.addEventListener('change', () => { a.maturity = Number(sel.value); a.updatedAt = nowIso(); a.by = S.by; save('plan', 'נספח ' + a.name + ': ' + (L.MATURITY[a.maturity] || '')); });
          const ta = bindText(h('textarea', { rows: 2, placeholder: base.q || '' }), () => a.text, (v) => { a.text = v; a.updatedAt = nowIso(); a.by = S.by; }, 'plan', 'נספח ' + a.name);
          return h('tr', {}, h('td', { 'data-h': T('annexes') }, h('b', { text: base.name || a.name })), h('td', { 'data-h': T('team'), text: teamName(a.team) }), h('td', { 'data-h': T('maturity') }, sel), h('td', { 'data-h': Y('annexText') }, ta));
        }))));
    const pm = bindText(h('textarea', { rows: 3 }), () => plan.premortem, (v) => { plan.premortem = v; }, 'plan', 'תחקיר מקדים');
    return h('div', {}, h('div', { class: 'note', text: L.TABLETOP_NOTE }), steps, annex,
      h('div', { class: 'card' }, h('h2', { text: T('premortem') }), h('p', { text: L.REMS[4].q[1] }), pm),
      h('div', { class: 'row noprint' }, h('button', { class: 'btn ghost', type: 'button', text: Y('printPlan'), onclick: printPlan })));
  }
  const firstEmpty = (plan) => (L.REMS.find((r) => !plan.steps[r.n]) || L.REMS[0]).n;
  function fbView(v) {
    const box = h('div', { class: 'sunny' });
    if ((v.gaps || []).length) box.append(h('b', { text: Y('gaps') }), h('ul', { class: 'list' }, v.gaps.map((g) => h('li', {}, g.text + (g.why ? ' · ' + g.why : '') + ' ',
      h('button', { class: 'btn ghost sm noprint', type: 'button', text: Y('addGap'), onclick: () => addGap(g.text, 'plan') })))));
    if ((v.alternatives || []).length) box.append(h('b', { text: Y('alts') }), h('table', { class: 'rt' }, h('thead', {}, h('tr', {}, [T('alt'), T('allows'), T('gives'), Y('src')].map((x) => h('th', { text: x })))),
      h('tbody', {}, v.alternatives.map((a) => h('tr', {}, h('td', { text: a.text || '' }), h('td', { text: a.allows || '' }), h('td', { text: a.gives || '' }), h('td', { text: srcLabel(a.source) }))))));
    if ((v.next || []).length) box.append(h('b', { text: Y('nextSteps') }), h('ul', { class: 'list' }, v.next.map((x) => h('li', { text: x }))));
    return box;
  }
  function srcLabel(k) {
    const s = k && window.SBE_ADVISOR_SOURCES && window.SBE_ADVISOR_SOURCES.byKey[k];
    return s ? String(s.apa || k).split('. (')[0] + ' (' + (String(s.apa).match(/\((\d{4})/) || [, ''])[1] + ')' : '';
  }
  function addGap(text, src, team) {
    const gaps = arr('gaps'); gaps.push({ id: uid('g'), text, src: src || '', team: team || '', at: nowIso() }); S.doc.parts.gaps = gaps; save('gaps', 'פער: ' + String(text).slice(0, 80));
    const acts = arr('actions'); acts.push({ id: uid('a'), text, team: team || '', owner: '', due: plus(14), status: 'todo', src: src || '' }); S.doc.parts.actions = acts; save('actions', '');
    toast(Y('addGap') + ' ✓');
  }

  // ---------- 👥 מפגש 1 ----------
  function sessionHead(n) {
    const s = L.SESSIONS[n - 1], done = obj('sessions')[n];
    return h('div', { class: 'card' }, h('h2', { text: n + '. ' + s.title }),
      h('table', { class: 'rt' }, h('tbody', {}, h('tr', {}, h('th', { text: Y('before') }), h('td', { text: s.before })), h('tr', {}, h('th', { text: Y('during') }), h('td', { text: s.during })), h('tr', {}, h('th', { text: Y('product') }), h('td', { text: s.product })))),
      h('label', { class: 'row noprint' }, h('input', { type: 'checkbox', checked: !!(done && done.done), onchange: (e) => { const ss2 = obj('sessions'); ss2[n] = { done: e.target.checked, at: nowIso() }; S.doc.parts.sessions = ss2; save('sessions', 'מפגש ' + n + (e.target.checked ? ' הושלם' : '')); } }), ' ', T('sessionDone')));
  }
  function viewS1() {
    const tasks = arr('tasks'); S.doc.parts.tasks = tasks;
    const teamSel = (val, on) => { const s = h('select', { 'data-closed': '' }, [...L.TEAMS.map((t) => h('option', { value: t.id, text: t.name })), h('option', { value: 'all', text: Y('allTeams') })]); s.value = val || 'mgmt'; s.addEventListener('change', () => on(s.value)); return s; };
    const whenSel = (val, on) => { const s = h('select', { 'data-closed': '' }, Object.entries(L.WHEN).map(([k, v]) => h('option', { value: k, text: v }))); s.value = val || 'before'; s.addEventListener('change', () => on(s.value)); return s; };
    const own = h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('text'), Y('when'), T('team'), ''].map((x) => h('th', { text: x })))),
      h('tbody', {}, tasks.map((tk, i) => h('tr', {},
        h('td', { 'data-h': T('text') }, bindText(h('input', { type: 'text' }), () => tk.text, (v) => { tk.text = v; }, 'tasks', 'רשימת המשימות')),
        h('td', { 'data-h': Y('when') }, whenSel(tk.when, (v) => { tk.when = v; save('tasks', ''); })),
        h('td', { 'data-h': T('team') }, teamSel(tk.team, (v) => { tk.team = v; save('tasks', ''); })),
        h('td', {}, h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { tasks.splice(i, 1); save('tasks', ''); render(); } }))))));
    const addTask = h('button', { class: 'btn ghost sm', type: 'button', text: T('add'), onclick: () => { tasks.push({ id: uid('t'), text: '', when: 'before', team: 'mgmt', own: true }); save('tasks', ''); render(); } });
    const ownCount = tasks.filter((t) => t.own && String(t.text).trim()).length;
    const ref = h('details', { class: 'card' }, h('summary', { text: T('showRef') }),
      ownCount < 3 ? h('p', { class: 'muted', text: T('ownFirst') }) :
        h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('text'), Y('when'), T('team'), ''].map((x) => h('th', { text: x })))),
          h('tbody', {}, L.TASKS.map((m) => { const has = tasks.some((t) => t.ref === m.id); return h('tr', {}, h('td', { 'data-h': T('text'), text: m.text }), h('td', { 'data-h': Y('when'), text: L.WHEN[m.when] }), h('td', { 'data-h': T('team'), text: teamName(m.team) }),
            h('td', {}, has ? h('span', { class: 'pill green', text: '✓' }) : h('button', { class: 'btn ghost sm', type: 'button', text: T('take'), onclick: () => { tasks.push({ id: uid('t'), ref: m.id, text: m.text, when: m.when, team: m.team }); save('tasks', 'משימה מהמתווה: ' + m.text.slice(0, 60)); render(); } }))); }))));
    return h('div', {}, sessionHead(1),
      h('div', { class: 'card' }, h('h2', { text: T('mine') }), h('p', { class: 'muted', text: T('ownFirst') }), own, addTask), ref,
      viewTeams(), viewEM(),
      h('div', { class: 'row noprint' }, h('button', { class: 'btn ghost', type: 'button', text: Y('printTeams'), onclick: printTeams })));
  }
  function viewTeams() {
    const teams = arr('teams'); S.doc.parts.teams = teams;
    const person = (o, k, label) => h('div', { class: 'row' },
      h('div', { class: 'grow' }, bindText(h('input', { type: 'text', placeholder: label + ' · ' + T('fullName'), 'aria-label': label }), () => o[k] && o[k].name, (v) => { o[k] = o[k] || {}; o[k].name = v; }, 'teams', 'טבלת הצוותים')),
      h('div', { class: 'grow' }, bindText(h('input', { type: 'email', placeholder: T('email'), 'aria-label': label + ' ' + T('email') }), () => o[k] && o[k].email, (v) => { o[k] = o[k] || {}; o[k].email = v; }, 'teams', '')));
    const cards = teams.map((t) => {
      const base = L.TEAMS.find((x) => x.id === t.id) || {};
      const n = 1 + (t.deputy && t.deputy.name ? 1 : 0) + (t.members || []).filter((m) => m.name).length;
      const warns = [];
      if (!(t.deputy && t.deputy.name)) warns.push(T('noDeputy'));
      if (n > 8) warns.push(T('tooMany'));
      if (t.id !== 'educators' && n < 3) warns.push(T('tooFew'));
      t.members = t.members || [];
      return h('div', { class: 'teamcard' }, h('b', { text: base.name || t.name }), h('div', { class: 'muted', text: base.duty || '' }),
        h('div', { class: 'muted', text: T('lead') + ': ' + (base.lead || '') }),
        person(t, 'lead', T('lead')), person(t, 'deputy', T('deputy')),
        h('div', { class: 'muted', text: T('members') }),
        t.members.map((m, i) => h('div', { class: 'row' }, h('div', { class: 'grow' }, person(t.members, i, T('fullName'))),
          h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { t.members.splice(i, 1); save('teams', ''); render(); } }))),
        h('button', { class: 'btn ghost sm', type: 'button', text: Y('addMember'), onclick: () => { t.members.push({ name: '', email: '' }); save('teams', ''); render(); } }),
        warns.length ? h('div', { class: 'row' }, warns.map((w) => h('span', { class: 'pill red', text: w }))) : null);
    });
    return h('div', { class: 'card' }, h('h2', { text: Y('teamsT') }), h('ul', { class: 'list muted' }, L.TEAM_NOTES.map((x) => h('li', { text: x }))), cards);
  }
  function viewEM() {
    const em = obj('em'); em.does = em.does || L.EM.does.slice(); em.doesnt = em.doesnt || L.EM.doesnt.slice(); S.doc.parts.em = em;
    const list = (key) => h('div', { class: 'grow' }, h('h3', { text: key === 'does' ? T('emDoes') : T('emDoesnt') }),
      em[key].map((x, i) => h('div', { class: 'row' }, h('div', { class: 'grow' }, bindText(h('input', { type: 'text' }), () => em[key][i], (v) => { em[key][i] = v; }, 'em', 'מנהל/ת מצב החירום')),
        h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { em[key].splice(i, 1); save('em', ''); render(); } }))),
      h('button', { class: 'btn ghost sm', type: 'button', text: T('add'), onclick: () => { em[key].push(''); render(); } }));
    return h('div', { class: 'card' }, h('h2', { text: L.TEAMS[0].lead.split(',')[0] }), h('div', { class: 'row', style: 'align-items:flex-start' }, list('does'), list('doesnt')));
  }

  // ---------- 🗺 מפגש 2 ----------
  function viewS2() {
    const mp = obj('mapping'); S.doc.parts.mapping = mp;
    const cards = L.TEAMS.map((t) => {
      const m = mp[t.id] = mp[t.id] || { checks: {}, report: [] };
      const checks = L.MAPPING[t.id] || [];
      const rows = checks.map((c, i) => {
        const sel = h('select', { 'data-closed': '', 'aria-label': c }, h('option', { value: '', text: '…' }), ['yes', 'part', 'no'].map((k) => h('option', { value: k, text: Y(k) })));
        sel.value = m.checks[i] || '';
        sel.addEventListener('change', () => { m.checks[i] = sel.value; save('mapping', 'מיפוי: ' + t.name); render(); });
        return h('tr', {}, h('td', { 'data-h': Y('checklist'), text: c }), h('td', { 'data-h': T('status') }, sel),
          h('td', {}, (m.checks[i] === 'no' || m.checks[i] === 'part') ? h('button', { class: 'btn ghost sm', type: 'button', text: Y('addGap'), onclick: () => addGap(c, 'מפגש 2', t.id) }) : null));
      });
      const rep = L.REPORT.map(([k, hint], i) => field(k, bindText(h('input', { type: 'text', placeholder: hint }), () => m.report[i], (v) => { m.report[i] = v; }, 'mapping', 'דיווח: ' + t.name)));
      return h('details', { class: 'card' }, h('summary', { text: t.name }),
        h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [Y('checklist'), T('status'), ''].map((x) => h('th', { text: x })))), h('tbody', {}, rows)),
        h('h3', { text: Y('reportOf') }), makeTimer(180), rep);
    });
    return h('div', {}, sessionHead(2), h('div', { class: 'note' }, h('b', { text: T('report') + ': ' }), L.REPORT.map((r) => r[0]).join(' · ')), cards,
      h('div', { class: 'row noprint' }, h('button', { class: 'btn ghost', type: 'button', text: Y('printSummary'), onclick: () => printSummary(2) })));
  }

  // ---------- 🎬 מפגש 3: תרגיל ותחקיר ----------
  const curEx = () => arr('exercises').find((x) => x.id === S.exId) || null;
  function viewS3() {
    const ex = curEx();
    const pickV = h('select', { 'data-closed': '' }, h('option', { value: '20', text: Y('v20') }), h('option', { value: '60', text: Y('v60') }));
    const startBtn = h('button', { class: 'btn', type: 'button', text: Y('startEx'), onclick: async () => {
      const list = arr('exercises');
      const e = { id: uid('ex'), session: 3, scenario: 'sirens', title: L.SIRENS.title, version: Number(pickV.value), startedAt: nowIso(), round: 1, rounds: [{}, {}, {}], marks: [], debrief: {}, ledByTeam: true };
      list.push(e); S.doc.parts.exercises = list; S.exId = e.id; await save('exercises', 'התחלת תרגיל: ' + e.title); render();
    } });
    const pastList = arr('exercises').length ? h('div', { class: 'row' }, h('span', { class: 'muted', text: Y('exercises') + ':' }), arr('exercises').map((x) => h('button', { class: 'btn ghost sm', type: 'button', 'aria-pressed': x.id === S.exId ? 'true' : 'false', text: dateIL(x.startedAt) + ' · ' + x.title, onclick: () => { S.exId = x.id; render(); } }))) : null;
    const top = h('div', {}, sessionHead(3), h('div', { class: 'note', text: L.TABLETOP_NOTE }),
      h('div', { class: 'card' }, h('h2', { text: L.SIRENS.title }), h('p', { text: L.SIRENS.intro }),
        h('table', { class: 'rt' }, h('thead', {}, h('tr', {}, [Y('step'), '20', '60'].map((x) => h('th', { text: x })))), h('tbody', {}, L.SIRENS.timing.map((r) => h('tr', {}, r.map((c) => h('td', { text: String(c) })))))),
        h('div', { class: 'row noprint' }, field(Y('version'), pickV), startBtn), pastList));
    if (!ex) return top;
    return h('div', {}, top, viewRec(ex), viewRun(ex), viewDebrief(ex));
  }

  function viewRec(ex) {
    const box = h('div', { class: 'card noprint' }, h('h2', { text: T('rec') }), h('p', { text: T('recInfo') }));
    const consent = h('input', { type: 'checkbox', id: 'rdyConsent' });
    const out = h('div', {});
    const open = h('button', { class: 'btn', type: 'button', text: Y('openRec'), onclick: async () => {
      if (!consent.checked) { consent.focus(); toast(T('consent')); return; }
      open.disabled = true;
      const [st, r] = await api('rdyRecStart', { id: S.doc.id, exId: ex.id, consent: true });
      open.disabled = false;
      if (st !== 200) { toast(r.error || ''); return; }
      ex.rec = { on: true, consentAt: nowIso() };
      const link = new URL('readiness-rec.html?rk=' + r.rk, location.href).href;
      const qr = h('div', { class: 'qr' });
      out.replaceChildren(h('p', { class: 'muted', text: T('recLink') }), h('div', { class: 'row' }, h('input', { type: 'text', value: link, readonly: true, class: 'grow' }),
        h('button', { class: 'btn ghost sm', type: 'button', text: Y('copy'), onclick: () => { navigator.clipboard && navigator.clipboard.writeText(link); toast(Y('copied')); } })), qr);
      if (window.QRCode) { try { new window.QRCode(qr, { text: link, width: 168, height: 168, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) {} }
    } });
    box.append(h('label', { class: 'row', for: 'rdyConsent' }, consent, ' ', T('consent')), open, out,
      h('p', { class: 'muted', text: Y('recNo') }));
    if (ex.rec && ex.rec.on) box.append(h('p', {}, h('span', { class: 'pill green', text: Y('recOn') })));
    return box;
  }

  function viewRun(ex) {
    const r = Math.min(3, Math.max(1, ex.round || 1));
    const R = L.SIRENS.rounds[r - 1];
    const st = ex.rounds[r - 1] = ex.rounds[r - 1] || {};
    const tabs = h('div', { class: 'row noprint' }, L.SIRENS.rounds.map((x) => h('button', { class: 'btn ghost sm', type: 'button', 'aria-pressed': x.n === r ? 'true' : 'false', text: T('round') + ' ' + x.n + ' · ' + x.time, onclick: () => { ex.round = x.n; save('exercises', ''); render(); } })));
    const mark = h('button', { class: 'btn ghost sm', type: 'button', text: T('markManual'), onclick: () => { ex.marks.push({ t: Date.now() - Date.parse(ex.startedAt), round: r, note: '' }); save('exercises', ''); toast('⭐'); } });
    const updates = [h('div', { class: 'update all' }, h('b', { text: T('toAll') }), h('div', { text: R.all })),
      ...L.TEAMS.filter((t) => R.teams[t.id]).map((t) => h('div', { class: 'update' }, h('b', { text: t.name }), h('div', { text: R.teams[t.id] })))];
    const mail = h('button', { class: 'btn ghost sm', type: 'button', text: T('sendMail'), onclick: async () => {
      mail.disabled = true;
      const items = L.TEAMS.map((t) => ({ teamId: t.id, text: R.all + (R.teams[t.id] ? '\n\n' + R.teams[t.id] : '') }));
      const [s, o] = await api('rdyMail', { id: S.doc.id, subject: T('round') + ' ' + r + ' · ' + R.time + ' · ' + R.title, items });
      mail.disabled = false;
      toast(s === 200 ? (o.available ? Y('mailSent') + ': ' + o.sent : T('mailOff')) : (o.error || ''));
    } });
    const decision = bindText(h('textarea', { rows: 2 }), () => st.decision, (v) => { st.decision = v; }, 'exercises', '');
    const planQ = bindText(h('input', { type: 'text' }), () => st.plan, (v) => { st.plan = v; }, 'exercises', '');
    const noPlan = h('button', { class: 'btn ghost sm', type: 'button', text: T('noPlan'), onclick: () => { st.noPlan = true; addGap(R.decision + ': ' + (L.SIRENS.planQuestion), 'מפגש 3'); save('exercises', ''); } });
    const altsBox = h('div', {});
    const drawAlts = () => altsBox.replaceChildren(h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('alt'), T('allows'), T('gives')].map((x) => h('th', { text: x })))),
      h('tbody', {}, R.alts.map((a) => h('tr', {}, a.map((c, i) => h('td', { 'data-h': [T('alt'), T('allows'), T('gives')][i], text: c })))))));
    if (st.altsShown) drawAlts();
    const showAlts = h('button', { class: 'btn ghost sm', type: 'button', text: T('showAlts'), onclick: () => { if (!String(st.decision || '').trim()) { decision.focus(); toast(T('decision')); return; } st.altsShown = true; save('exercises', ''); drawAlts(); } });
    const extra = [];
    if (R.callHelp) {
      ex.callHelpParts = ex.callHelpParts || [];
      extra.push(h('div', { class: 'card' }, h('h3', { text: T('callHelp') }),
        L.SIRENS.callHelp.map((label, i) => field((i + 1) + '. ' + label, bindText(h('input', { type: 'text' }), () => ex.callHelpParts[i], (v) => { ex.callHelpParts[i] = v; ex.callHelp = ex.callHelpParts.filter(Boolean).join(' · '); }, 'exercises', ''))),
        h('b', { text: Y('callAfter') }), L.SIRENS.callHelpAfter.map((q, i) => field(q, bindText(h('input', { type: 'text' }), () => (ex.callHelpAfter || [])[i], (v) => { ex.callHelpAfter = ex.callHelpAfter || []; ex.callHelpAfter[i] = v; }, 'exercises', '')))));
    }
    if (R.hardTalk) {
      const HT = L.SIRENS.hardTalk;
      const ans = bindText(h('textarea', { rows: 3 }), () => ex.hardTalk, (v) => { ex.hardTalk = v; }, 'exercises', '');
      const after = h('div', {});
      const reveal = () => after.replaceChildren(h('ul', { class: 'list' }, HT.feedback.map((q) => h('li', { text: q }))), h('p', { class: 'muted' }, HT.card + ' ', h('a', { href: 'yesh-ma-laasot.html?back=home', target: '_blank', rel: 'noopener', text: 'يوجد ما نفعله / יש מה לעשות'.split(' / ')[S.lang === 'ar' ? 0 : 1] })));
      if (String(ex.hardTalk || '').trim()) reveal();
      ans.addEventListener('change', () => { if (String(ans.value).trim()) reveal(); });
      extra.push(h('div', { class: 'card' }, h('h3', { text: T('hardTalk') }), h('p', { class: 'big', style: 'font-size:1.15rem', text: HT.q }), h('p', { class: 'muted', text: HT.how }), field(T('answer'), ans), after));
    }
    const rd = h('div', { class: 'card' }, h('h3', { text: T('roundDebrief') }), makeTimer(150),
      field(L.ROUND_DEBRIEF[0], bindText(h('textarea', { rows: 2 }), () => st.worked, (v) => { st.worked = v; }, 'exercises', '')),
      r > 1 ? field(L.ROUND_DEBRIEF[1], bindText(h('textarea', { rows: 2 }), () => st.improved, (v) => { st.improved = v; }, 'exercises', '')) : null);
    const nav = h('div', { class: 'row noprint' },
      r < 3 ? h('button', { class: 'btn', type: 'button', text: Y('cont') + ': ' + T('round') + ' ' + (r + 1), onclick: () => { ex.round = r + 1; save('exercises', ''); render(); window.scrollTo(0, 0); } })
        : h('button', { class: 'btn', type: 'button', text: Y('finish'), onclick: () => { ex.finishedAt = ex.finishedAt || nowIso(); save('exercises', 'סיום התרחיש: ' + ex.title); render(); } }),
      h('button', { class: 'btn ghost', type: 'button', text: Y('printCards'), onclick: () => printCards() }));
    return h('div', { class: 'card' }, h('h2', { text: T('round') + ' ' + r + ' · ' + R.time + ' · ' + R.title }),
      r === 1 ? h('div', { class: 'note' }, h('b', { text: Y('opening') + ': ' }), L.SIRENS.opening) : null,
      h('div', { class: 'row' }, tabs, mark), updates, h('div', { class: 'row noprint' }, mail),
      h('h3', { text: R.decision }), field(T('decision'), decision), field(T('planQ'), planQ), noPlan, h('div', { class: 'row noprint' }, showAlts), altsBox,
      extra, rd, r === 3 && ex.finishedAt ? h('div', { class: 'note' }, h('b', { text: Y('closing') + ': ' }), L.SIRENS.closing) : null, nav);
  }

  function viewDebrief(ex) {
    if (!ex.finishedAt) return h('div', {});
    ex.debrief = ex.debrief || {};
    const steps = L.DEBRIEF.map((d, i) => h('details', { class: 'card', open: i === 0 }, h('summary', { text: (i + 1) + '. ' + d.title + ' · ' + d.min + ' ' + Y('min') }),
      h('p', { text: d.text }), makeTimer(d.min * 60),
      bindText(h('textarea', { rows: 3 }), () => ex.debrief[d.k], (v) => { ex.debrief[d.k] = v; }, 'exercises', '')));
    const draftBox = h('div', {});
    if (ex.draft) draftBox.appendChild(draftView(ex));
    const draftBtn = h('button', { class: 'btn', type: 'button', text: T('draft'), onclick: async () => {
      draftBtn.disabled = true; draftBox.replaceChildren(h('p', { class: 'muted', text: Y('working') }));
      let tr = null;
      const [s, o] = await api('rdyTranscriptGet', { id: S.doc.id, exId: ex.id }); if (s === 200) tr = o.transcript;
      if (tr && ex.marks.length) tr.marks = (tr.marks || []).concat(ex.marks);
      else if (!tr) tr = { segments: [], marks: ex.marks };
      try {
        const srcs = window.SBE_ADVISOR_SOURCES ? window.SBE_ADVISOR_SOURCES.forAdvisor('readiness') : [];
        const v = await window.sbeCallAIJson(SERVER, { system: P.debriefSystem(S.lang), messages: [{ role: 'user', content: P.debriefInput(ex, tr, srcs) }], maxTokens: 12000, customerReview: true }, 300000, P.validDebrief);
        ex.draft = v;
        ex.report = ex.report || {};
        ex.report.rows = (v.gaps || []).map((g) => ({ topic: g.topic || '', planned: g.planned || '', happened: g.happened || '', how: g.how || '', keep: g.keep === 'keep' ? 'keep' : 'improve', action: g.action || '', owner: g.team ? teamName(g.team) : '', due: plus(14), team: g.team || '' }));
        for (const t of P.detectEnds((tr.segments || []).map((x) => x.text).join(' '))) (v.ends = v.ends || []).push({ text: t });
        await save('exercises', 'טיוטת תחקיר');
        draftBox.replaceChildren(draftView(ex));
      } catch (e) { draftBox.replaceChildren(h('div', { class: 'warn', text: T('noModel') })); }
      draftBtn.disabled = false;
    } });
    const trBox = h('div', {});
    const trBtn = h('button', { class: 'btn ghost sm', type: 'button', text: Y('loadTr'), onclick: async () => {
      const [s, o] = await api('rdyTranscriptGet', { id: S.doc.id, exId: ex.id });
      if (s !== 200) { toast(o.error || ''); return; }
      const segs = o.transcript.segments || [];
      const areas = segs.map((g) => { const ta = h('textarea', { rows: 2 }); ta.value = g.text; ta.addEventListener('input', () => { g.text = ta.value; }); return field(T('round') + ' ' + g.round, piiCheck(ta)); });
      trBox.replaceChildren(h('p', { class: 'muted', text: Y('segs') + ': ' + segs.length + ' · ' + Y('marks') + ': ' + (o.transcript.marks || []).length }), areas,
        segs.length ? h('button', { class: 'btn ghost sm', type: 'button', text: Y('saveTr'), onclick: async () => { const [s2, o2] = await api('rdyTranscriptSave', { id: S.doc.id, exId: ex.id, segments: segs }); toast(s2 === 200 ? T('saved') : (o2.error || '')); } }) : null);
    } });
    return h('div', {}, h('div', { class: 'card' }, h('h2', { text: T('debrief') }), h('p', { class: 'muted', text: L.SIRENS.timing.map((x) => x[0] + ' ' + x[1] + '/' + x[2]).join(' · ') })), steps,
      h('div', { class: 'card noprint' }, h('h3', { text: T('transcript') }), h('p', { class: 'muted', text: Y('editTr') }), trBtn, trBox),
      h('div', { class: 'card' }, h('h2', { text: T('reportT') }), ex.report && ex.report.approvedAt ? h('p', {}, h('span', { class: 'pill green', text: T('approved') + ' · ' + dateIL(ex.report.approvedAt) })) : h('div', { class: 'row noprint' }, draftBtn), draftBox));
  }
  function draftView(ex) {
    const v = ex.draft || {}, rep = ex.report = ex.report || { rows: [] };
    const box = h('div', {});
    if ((v.timeline || []).length) box.append(h('h3', { text: Y('timeline') }), h('ul', { class: 'list' }, v.timeline.map((x) => h('li', { text: (x.t ? x.t + ' · ' : '') + (x.what || '') }))));
    if ((v.worked || []).length) box.append(h('h3', { text: Y('worked') }), h('ul', { class: 'list' }, v.worked.map((x) => h('li', { text: x }))));
    const cols = L.REPORT_COLS;
    const keys = ['topic', 'planned', 'happened', 'how', 'keep', 'action', 'owner', 'due'];
    box.append(h('h3', { text: T('reportT') }), h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, cols.map((c) => h('th', { text: c })), h('th', { class: 'noprint' }))),
      h('tbody', {}, rep.rows.map((row, i) => h('tr', {}, keys.map((k, j) => {
        if (k === 'keep') { const s = h('select', { 'data-closed': '' }, Object.entries(L.KEEP).map(([a, b]) => h('option', { value: a, text: b }))); s.value = row.keep || 'improve'; s.onchange = () => { row.keep = s.value; save('exercises', ''); }; return h('td', { 'data-h': cols[j] }, s); }
        if (k === 'due') { const d = h('input', { type: 'date', value: row.due || '' }); d.onchange = () => { row.due = d.value; save('exercises', ''); }; return h('td', { 'data-h': cols[j] }, d); }
        return h('td', { 'data-h': cols[j] }, bindText(h('textarea', { rows: 3, class: 'cell' }), () => row[k], (val) => { row[k] = val; }, 'exercises', ''));
      }), h('td', { class: 'noprint' }, h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { rep.rows.splice(i, 1); save('exercises', ''); render(); } })))))),
    h('button', { class: 'btn ghost sm noprint', type: 'button', text: Y('addRow'), onclick: () => { rep.rows.push({ keep: 'improve', due: plus(14) }); save('exercises', ''); render(); } }));
    if ((v.ends || []).length) box.append(h('h3', { text: T('ends') }), h('ul', { class: 'list' }, v.ends.map((e) => h('li', {}, e.text + ' ', h('button', { class: 'btn ghost sm noprint', type: 'button', text: Y('toEnds'), onclick: () => { addEnd(e.text, e.team, 'תחקיר מפגש 3'); } })))));
    if ((v.ideas || []).length) box.append(h('h3', { text: T('ideas') }), h('ul', { class: 'list' }, v.ideas.map((x) => h('li', { text: x.text + (x.ifThen ? ' · ' + x.ifThen : '') }))));
    if ((v.feedback || []).length) box.append(h('h3', { text: Y('fb') }), h('ul', { class: 'list' }, v.feedback.map((x) => h('li', {}, x.text, x.source ? h('span', { class: 'muted', text: ' · ' + srcLabel(x.source) }) : null))));
    const approve = h('button', { class: 'btn noprint', type: 'button', text: T('approve'), onclick: async () => {
      if (!confirm(Y('confirmApprove'))) return;
      rep.approvedAt = nowIso();
      const acts = arr('actions'), gaps = arr('gaps'), ideas = arr('ideas');
      for (const row of rep.rows) {
        if (row.keep === 'improve' && row.action) acts.push({ id: uid('a'), text: row.action, team: row.team || '', owner: row.owner || '', due: row.due || plus(14), status: 'todo', src: 'תחקיר מפגש 3' });
        if (row.keep === 'improve' && row.topic) gaps.push({ id: uid('g'), text: row.topic + (row.happened ? ': ' + row.happened : ''), team: row.team || '', src: 'תחקיר מפגש 3', at: nowIso() });
      }
      for (const x of v.ideas || []) ideas.push({ id: uid('i'), text: x.text, ifThen: x.ifThen || '', at: nowIso(), decision: '' });
      S.doc.parts.actions = acts; S.doc.parts.gaps = gaps; S.doc.parts.ideas = ideas;
      const sess = obj('sessions'); if (!(sess[3] && sess[3].done)) { sess[3] = { done: true, at: nowIso() }; S.doc.parts.sessions = sess; await save('sessions', 'מפגש 3 הושלם'); }
      await save('exercises', 'אישור דוח התחקיר'); await save('actions', ''); await save('gaps', ''); await save('ideas', '');
      await api('rdyTranscriptDelete', { id: S.doc.id, exId: ex.id });
      render();
    } });
    box.append(h('div', { class: 'row noprint' }, rep.approvedAt ? null : approve, h('button', { class: 'btn ghost', type: 'button', text: Y('printReport'), onclick: () => printReport(ex) }), h('button', { class: 'btn ghost', type: 'button', text: Y('printSummary'), onclick: () => printSummary(3) })));
    return box;
  }

  // ---------- צד: קצוות פתוחים, פעולות, רישום ----------
  function addEnd(text, team, src) {
    const ends = arr('ends');
    ends.push({ id: uid('e'), text: String(text || ''), owner: team ? teamName(team) : '', openedAt: nowIso(), next: plus(1), status: 'open', missed: 0, src: src || '', by: S.by });
    S.doc.parts.ends = ends; save('ends', 'קצה פתוח: ' + String(text).slice(0, 80)); toast(Y('toEnds') + ' ✓');
  }
  function viewEnds() {
    const ends = arr('ends'); S.doc.parts.ends = ends;
    const open = ends.filter((e) => e.status !== 'closed'), closed = ends.filter((e) => e.status === 'closed');
    const row = (e) => {
      const state = P.endState(e);
      const next = h('input', { type: 'date', value: String(e.next || '').slice(0, 10) });
      next.onchange = () => { if (state === 'late' || state === 'escalate') e.missed = (e.missed || 0) + 1; e.next = next.value; save('ends', ''); render(); };
      const st = h('select', { 'data-closed': '' }, Object.entries(L.END_STATUS).map(([k, v]) => h('option', { value: k, text: v }))); st.value = e.status || 'open';
      st.onchange = () => { if (st.value === 'closed' && !confirm(Y('confirmClose'))) { st.value = e.status; return; } if (st.value === 'closed') { e.closedAt = nowIso(); e.closedLate = state === 'late' || state === 'escalate'; } e.status = st.value; save('ends', st.value === 'closed' ? 'קצה נסגר: ' + String(e.text).slice(0, 80) : ''); render(); };
      return h('tr', {},
        h('td', { 'data-h': T('text') }, bindText(h('input', { type: 'text' }), () => e.text, (v) => { e.text = v; }, 'ends', '')),
        h('td', { 'data-h': T('endOpened'), text: e.src || dateIL(e.openedAt) }),
        h('td', { 'data-h': T('owner') }, bindText(h('input', { type: 'text', list: 'rdyTeams' }), () => e.owner, (v) => { e.owner = v; }, 'ends', '')),
        h('td', { 'data-h': T('endNext') }, next),
        h('td', { 'data-h': T('endState') }, st, state === 'noOwner' ? h('span', { class: 'pill red', text: T('noOwner') }) : state === 'escalate' ? h('span', { class: 'pill red', text: Y('escalate') }) : state === 'late' ? h('span', { class: 'pill red', text: T('late') }) : null));
    };
    const head = h('thead', {}, h('tr', {}, [T('text'), T('endOpened'), T('owner'), T('endNext'), T('endState')].map((x) => h('th', { text: x }))));
    return h('div', { class: 'card' }, h('h2', { text: T('ends') }),
      h('datalist', { id: 'rdyTeams' }, L.TEAMS.map((t) => h('option', { value: t.name }))),
      open.length ? h('table', { class: 'rt stack' }, head, h('tbody', {}, open.map(row))) : h('p', { class: 'muted', text: Y('none2') }),
      h('button', { class: 'btn ghost sm noprint', type: 'button', text: T('add'), onclick: () => { addEnd('', '', ''); render(); } }),
      closed.length ? h('details', {}, h('summary', { text: L.END_STATUS.closed + ' (' + closed.length + ')' }), h('table', { class: 'rt stack' }, head, h('tbody', {}, closed.map(row)))) : null);
  }
  function viewActions() {
    const acts = arr('actions'); S.doc.parts.actions = acts;
    const teamSel = (a) => { const s = h('select', { 'data-closed': '' }, h('option', { value: '', text: '…' }), [...L.TEAMS.map((t) => h('option', { value: t.id, text: t.name })), h('option', { value: 'all', text: Y('allTeams') })]); s.value = a.team || ''; s.onchange = () => { a.team = s.value; save('actions', ''); }; return s; };
    const rows = acts.map((a, i) => {
      const st = h('select', { 'data-closed': '' }, Object.entries(L.STATUS).map(([k, v]) => h('option', { value: k, text: v }))); st.value = a.status || 'todo';
      st.onchange = () => { a.status = st.value; save('actions', 'פעולה: ' + L.STATUS[a.status] + ': ' + String(a.text).slice(0, 60)); };
      const due = h('input', { type: 'date', value: a.due || '' }); due.onchange = () => { a.due = due.value; save('actions', ''); };
      return h('tr', {}, h('td', { 'data-h': T('text') }, bindText(h('input', { type: 'text' }), () => a.text, (v) => { a.text = v; }, 'actions', '')),
        h('td', { 'data-h': T('team') }, teamSel(a)), h('td', { 'data-h': T('owner') }, bindText(h('input', { type: 'text' }), () => a.owner, (v) => { a.owner = v; }, 'actions', '')),
        h('td', { 'data-h': T('due') }, due), h('td', { 'data-h': T('status') }, st),
        h('td', { class: 'noprint' }, h('button', { class: 'btn ghost sm', type: 'button', text: T('del'), onclick: () => { acts.splice(i, 1); save('actions', ''); render(); } })));
    });
    return h('div', { class: 'card' }, h('h2', { text: T('actions') }),
      h('p', { class: 'muted', text: L.STATUS.tested + ': ' + (S.lang === 'ar' ? 'يُغلق الإجراء فقط بعد فحصه في تمرين أو في يوم الصمود.' : 'פעולה נסגרת רק אחרי שנבדקה בתרגיל או ביום החוסן.') }),
      acts.length ? h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [T('text'), T('team'), T('owner'), T('due'), T('status'), ''].map((x) => h('th', { text: x })))), h('tbody', {}, rows)) : h('p', { class: 'muted', text: Y('none2') }),
      h('button', { class: 'btn ghost sm noprint', type: 'button', text: T('add'), onclick: () => { acts.push({ id: uid('a'), text: '', team: '', owner: '', due: plus(14), status: 'todo' }); save('actions', ''); render(); } }));
  }
  function viewLog() {
    const log = (S.doc.log || []).slice().reverse();
    return h('div', { class: 'card' }, h('h2', { text: T('log') }),
      log.length ? h('table', { class: 'rt stack' }, h('thead', {}, h('tr', {}, [Y('when'), T('fullName'), T('text')].map((x) => h('th', { text: x })))),
        h('tbody', {}, log.map((l) => h('tr', {}, h('td', { 'data-h': Y('when'), text: dateIL(l.at) + ' ' + String(l.at || '').slice(11, 16) }), h('td', { 'data-h': T('fullName'), text: l.by || '' }), h('td', { 'data-h': T('text'), text: l.what || '' }))))) : h('p', { class: 'muted', text: Y('none2') }));
  }

  // ---------- הדפסות (SBE_DOC.print: לוגו, שוליים, כותרת טבלה חוזרת) ----------
  const tbl = (cols, rows) => h('table', { class: 'rtable' }, h('thead', {}, h('tr', {}, cols.map((c) => h('th', { text: c })))), h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', { text: c == null ? '' : String(c) }))))));
  function doPrint(title, kind, nodes) {
    if (!window.SBE_DOC) return window.print();
    const node = h('div', {}, nodes, h('p', { class: 'muted', text: L.TABLETOP_NOTE }));
    window.SBE_DOC.print({ title, subtitle: parts().profile?.name || '', kind, node });
  }
  function printTeams() {
    const teams = arr('teams');
    doPrint(Y('teamsT'), Y('teamsT'), [h('h2', { text: Y('teamsT') }),
      tbl([T('team'), T('lead'), T('deputy'), T('members')], teams.map((t) => [teamName(t.id) || t.name, t.lead && t.lead.name, t.deputy && t.deputy.name, (t.members || []).map((m) => m.name).filter(Boolean).join(', ')])),
      h('h2', { text: L.TEAMS[0].lead.split(',')[0] }), tbl([T('emDoes'), T('emDoesnt')], Array.from({ length: Math.max((obj('em').does || []).length, (obj('em').doesnt || []).length) }, (_, i) => [(obj('em').does || [])[i], (obj('em').doesnt || [])[i]])),
      h('h2', { text: T('mine') }), tbl([T('text'), Y('when'), T('team')], arr('tasks').map((t) => [t.text, L.WHEN[t.when], teamName(t.team)]))]);
  }
  function printPlan() {
    const plan = obj('plan');
    doPrint(T('tool'), Y('printPlan').replace('🖨 ', ''), [
      h('h2', { text: 'REMS' }), tbl([Y('step'), Y('ourText')], L.REMS.map((r) => [r.n + '. ' + r.title, (plan.steps || {})[r.n] || ''])),
      h('h2', { text: T('annexes') }), tbl([T('annexes'), T('team'), T('maturity'), Y('annexText')], (plan.annexes || []).map((a) => [a.name, teamName(a.team), L.MATURITY[a.maturity] || '', a.text || ''])),
      plan.premortem ? h('div', {}, h('h2', { text: T('premortem') }), h('p', { text: plan.premortem })) : null,
      h('h2', { text: T('log') }), tbl([Y('when'), T('fullName'), T('text')], (S.doc.log || []).slice(-40).map((l) => [dateIL(l.at), l.by, l.what]))]);
  }
  function printCards() {
    const cards = [];
    for (const R of L.SIRENS.rounds) {
      cards.push(h('h2', { text: T('round') + ' ' + R.n + ' · ' + R.time + ' · ' + R.title }));
      cards.push(tbl([T('team'), T('round') + ' ' + R.n], [[T('toAll'), R.all], ...L.TEAMS.filter((t) => R.teams[t.id]).map((t) => [t.name, R.teams[t.id]])]));
      cards.push(tbl([T('alt'), T('allows'), T('gives')], R.alts));
    }
    cards.push(h('h2', { text: T('callHelp') }), h('ol', {}, L.SIRENS.callHelp.map((x) => h('li', { text: x }))));
    cards.push(h('h2', { text: T('hardTalk') }), h('p', { text: L.SIRENS.hardTalk.q }), h('ul', {}, L.SIRENS.hardTalk.feedback.map((x) => h('li', { text: x }))));
    doPrint(L.SIRENS.title, Y('printCards').replace('🖨 ', ''), cards);
  }
  function printReport(ex) {
    const rep = ex.report || { rows: [] }, v = ex.draft || {};
    doPrint(T('reportT') + ' · ' + ex.title, T('reportT'), [
      h('p', { text: dateIL(ex.startedAt) + ' · ' + ex.title + (rep.approvedAt ? ' · ' + T('approved') + ' ' + dateIL(rep.approvedAt) : '') }),
      (v.worked || []).length ? h('div', {}, h('h2', { text: Y('worked') }), h('ul', {}, v.worked.map((x) => h('li', { text: x })))) : null,
      h('h2', { text: T('reportT') }), tbl(L.REPORT_COLS, rep.rows.map((r) => [r.topic, r.planned, r.happened, r.how, L.KEEP[r.keep] || '', r.action, r.owner, dateIL(r.due)])),
      (v.ideas || []).length ? h('div', {}, h('h2', { text: T('ideas') }), tbl([T('text'), T('ifThen')], v.ideas.map((x) => [x.text, x.ifThen]))) : null,
      (v.feedback || []).length ? h('div', {}, h('h2', { text: Y('fb') }), tbl([T('text'), Y('src')], v.feedback.map((x) => [x.text, srcLabel(x.source)]))) : null]);
  }
  function printSummary(n) {
    const acts = arr('actions'), ends = arr('ends').filter((e) => e.status !== 'closed');
    const ex = n === 3 ? curEx() : null;
    doPrint(L.SESSIONS[n - 1].title, Y('printSummary').replace('🖨 ', ''), [
      ex ? h('div', {}, h('h2', { text: T('decision') }), tbl([T('round'), T('decision')], (ex.rounds || []).map((r, i) => [String(i + 1), r.decision || '']))) : null,
      h('h2', { text: T('actions') }), tbl([T('text'), T('team'), T('owner'), T('due'), T('status')], acts.map((a) => [a.text, teamName(a.team), a.owner, dateIL(a.due), L.STATUS[a.status] || ''])),
      h('h2', { text: T('ends') }), tbl([T('text'), T('owner'), T('endNext')], ends.map((e) => [e.text, e.owner, dateIL(e.next)]))]);
  }

  window.sbeReadiness = { state: S, render, model: P };
  start();
})();
