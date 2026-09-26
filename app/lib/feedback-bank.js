// בנק מדדי המשוב — מקור אמת יחיד לשלושת השאלונים (מנחה / מתנסה / צופה).
// נטען כ-<script src="lib/feedback-bank.js"> ב-feedback.html, facilitator-screen.html,
// feedback-results.html ו-admin.html. עד 24/09/2026 הבנק הועתק ידנית לשלושה קבצים.
//
// 24/09/2026, בקשת המשתמשת: "אני חושבת שצריכים להיות הרבה יותר מדדים והמנחה
// תבחר בהם כחלק מבחירותיה בהכנת הסימולציה, אחרת יוצא מצב שחלק מהמדדים אינו
// רלוונטי. מציע להגביל את הבחירה בין 5-10 מדדים ולא יותר."
//
// איך זה עובד:
//  - כל מדד שייך לשאלון (לפי הקידומת במזהה: fac_ / trainee_ / obs_) ולקבוצה (g).
//  - המנחה בוחרת 5–10 מדדים לכל שאלון במסך הסדנה, לפני "פתיחת סדנה".
//  - הבחירה נשמרת במכשיר (WS_KEY) ונכנסת גם לקישור המשוב (?m=...) — כך טפסים
//    שנפתחים בטלפונים של המשתתפות מקבלים את אותם מדדים. הקוד עצמו לא נשמר.
//  - "active" בבנק = ברירת המחדל שמוצעת למנחה (נערכת במסך הניהול).
//  - מזהי המדדים לא משתנים לעולם: משובים שכבר נשמרו נשארים קריאים.
//  - מדד שחסר (24/09): המנחה מוסיפה אותו במסך הסדנה, ומנהלת מוסד במסך הניהול
//    (addMetric). הוא נכנס לבנק המשותף עם קרדיט — שם, מוסד ותאריך. אין שרת,
//    ולכן הניסוח של מדד שנוסף עובר גם בקישור (&c=...) — אחרת הטלפון של
//    המשתתפת, שאין בו את המדד, היה מדלג עליו בשקט — ונשמר עם המשוב (_defs).
(function(){
  "use strict";
  const MIN = 5, MAX = 10;
  const BANK_KEY = "sbe.feedback.bank.v1";
  const WS_KEY = "sbe.workshop.feedback.v1";
  const VERSION = 2;
  const ROLES = ["fac", "trainee", "obs"];
  const ROLE_LABEL = { fac:"מנחה", trainee:"מתנסה", obs:"צופה" };

  const AGREE = ["כלל לא","במידה מועטה","במידה בינונית","במידה רבה","במידה רבה מאוד"];
  const RELEVANT = ["לא רלוונטי","מעט","במידה בינונית","רלוונטי","רלוונטי מאוד"];
  const AMOUNT = ["כלל לא","מעט","במידה בינונית","הרבה","הרבה מאוד"];
  const CUSTOM_GROUP = "מדדים שנוספו על ידי הקהילה";

  const sc = (g, l, opts) => ({ g, l, type:"scale", opts: opts || AGREE });
  const op = (g, l, opts, extra) => Object.assign({ g, l, type:"opts", opts }, extra || {});
  const tx = (g, l, extra) => Object.assign({ g, l, type:"text" }, extra || {});

  const DEFAULTS = {
    fac: { title:"משוב מנחה", active:["fac_worked","fac_realism","fac_relevance","fac_level","fac_debrief","fac_missing","fac_again"],
      groups:["התרחיש והדמויות","התאמה לקבוצה","מהלך הסדנה","התחקיר והלמידה"], bank:{
      fac_worked:    op("התרחיש והדמויות", "האם התרחיש השיג את מטרתו החינוכית?", ["השיג את מטרתו","השיג חלקית","לא השיג"], { reason:true }),
      fac_realism:   sc("התרחיש והדמויות", "התרחיש היה אמין ודומה למצבים שאנשי חינוך פוגשים בשטח"),
      fac_depth:     sc("התרחיש והדמויות", "לדמות שגילמה השחקנית היה רובד סמוי שהורגש בשיחה"),
      fac_conflict:  sc("התרחיש והדמויות", "שני הצדדים בקונפליקט היו לגיטימיים, בלי צד \"צודק\" מובהק"),
      fac_turns:     op("התרחיש והדמויות", "כמה מתפניות הליבה התרחשו בפועל?", ["שתיהן","אחת","אף אחת"]),
      fac_missing:   tx("התרחיש והדמויות", "מה היה חסר בתרחיש?", { sub:"זו השאלה שמשפרת את המערכת. פרט אחד קונקרטי עדיף על הערכה כללית." }),
      fac_relevance: sc("התאמה לקבוצה", "מה מידת הרלוונטיות לעבודתי החינוכית?", RELEVANT),
      fac_level:     op("התאמה לקבוצה", "רמת הקושי ביחס לשלב ההכשרה של הקבוצה", ["קלה מדי","מתאימה","קשה מדי"]),
      fac_approach:  sc("התאמה לקבוצה", "הגישה החינוכית שנבחרה ניכרה בהתנהגות הדמות ובשאלות התחקיר"),
      fac_skills:    sc("התאמה לקבוצה", "המיומנויות שבדף הצפייה אכן נדרשו בשיחה"),
      fac_pretalk:   sc("מהלך הסדנה", "השיחה המקדימה מיקדה את הצופים"),
      fac_actorprep: sc("מהלך הסדנה", "לשחקנית היה די מידע כדי להוביל את הסימולציה"),
      fac_safety:    sc("מהלך הסדנה", "האווירה אפשרה למתנסה לטעות בלי חשש"),
      fac_time:      op("מהלך הסדנה", "משך הסימולציה", ["קצר מדי","מתאים","ארוך מדי"]),
      fac_obssheet:  sc("מהלך הסדנה", "סימוני דף הצפייה עזרו לבחור קטעים לתחקיר"),
      fac_debrief:   sc("התחקיר והלמידה", "שאלות התחקיר עוררו דיון משמעותי"),
      fac_insight:   sc("התחקיר והלמידה", "בתחקיר עלתה תובנה שהקבוצה לא הגיעה אליה קודם"),
      fac_moment:    tx("התחקיר והלמידה", "באיזה רגע בסימולציה קרתה הלמידה העיקרית?"),
      fac_again:     op("התחקיר והלמידה", "האם להעביר את התרחיש שוב?", ["כן","בשינויים","לא"]),
      fac_change:    tx("התחקיר והלמידה", "שינוי אחד שכדאי לעשות לפני ההעברה הבאה"),
    }},
    trainee: { title:"משוב מתנסה", active:["trainee_realism","trainee_safety","trainee_challengevalue","trainee_prep","trainee_debrief","trainee_diff"],
      groups:["חוויית ההתנסות","ההכנה","המיומנויות בשיחה","הלמידה וההמשך"], bank:{
      trainee_realism:        sc("חוויית ההתנסות", "השיחה הרגישה אמיתית"),
      trainee_immersion:      sc("חוויית ההתנסות", "היה קל להיכנס לתפקיד"),
      trainee_safety:         sc("חוויית ההתנסות", "היה אפשר לטעות בלי חשש"),
      trainee_intensity:      op("חוויית ההתנסות", "עוצמת הרגשות בשיחה", ["נמוכה","מתאימה","גבוהה מדי"]),
      trainee_challengevalue: sc("חוויית ההתנסות", "התפקיד היה מאתגר וחשוב מקצועית"),
      trainee_challenge:      tx("חוויית ההתנסות", "מה היה הכי מאתגר בתפקיד?"),
      trainee_prep:           op("ההכנה", "ההכנה לפני השיחה", ["הספיקה","חסר מידע","היה יותר מדי"]),
      trainee_opening:        sc("ההכנה", "פסקת הפתיחה נתנה די הקשר כדי להתחיל"),
      trainee_listen:         sc("המיומנויות בשיחה", "מידת ההצלחה להקשיב בלי למהר לענות"),
      trainee_facts:          sc("המיומנויות בשיחה", "מידת ההצלחה לומר עובדות בלי פרשנות"),
      trainee_boundary:       sc("המיומנויות בשיחה", "מידת ההצלחה להציב גבול ולשמור על הקשר"),
      trainee_beneath:        sc("המיומנויות בשיחה", "מידת ההבנה של מה שעמד מאחורי דברי הדמות"),
      trainee_turn:           tx("המיומנויות בשיחה", "רגע שבו השיחה השתנתה — מה קרה בו?"),
      trainee_debrief:        sc("הלמידה וההמשך", "התחקיר עזר להבין מה קרה בשיחה"),
      trainee_obsfeedback:    sc("הלמידה וההמשך", "המשוב מהצופים היה מועיל"),
      trainee_diff:           tx("הלמידה וההמשך", "מה היית עושה אחרת?"),
      trainee_transfer:       sc("הלמידה וההמשך", "מידת הביטחון ליישם את מה שנלמד בשיחה אמיתית"),
      trainee_contribution:   tx("הלמידה וההמשך", "מה התרומה להמשך העיסוק בחינוך?"),
      trainee_again:          sc("הלמידה וההמשך", "רצון לתרגל תרחיש נוסף"),
    }},
    obs: { title:"משוב לצופה", active:["obs_focus","obs_sheet","obs_realism","obs_relevance","obs_contribution","obs_improve"],
      groups:["הצפייה","התרחיש","הלמידה"], bank:{
      obs_focus:        sc("הצפייה", "השיחה המקדימה מיקדה את הצפייה"),
      obs_sheet:        sc("הצפייה", "דף הצפייה היה נוח לשימוש בזמן אמת"),
      obs_skillsclear:  sc("הצפייה", "המיומנויות בדף הצפייה היו ברורות וניתנות לזיהוי"),
      obs_hidden:       sc("הצפייה", "מידת ההבחנה במה שהדמות לא אמרה בקול"),
      obs_moment:       tx("הצפייה", "הרגע המשמעותי ביותר בשיחה"),
      obs_realism:      sc("התרחיש", "התרחיש היה אמין"),
      obs_relevance:    sc("התרחיש", "מידת הרלוונטיות של התרחיש להכשרה בחינוך", RELEVANT),
      obs_identify:     sc("התרחיש", "מידת ההזדהות עם המתנסה"),
      obs_otherside:    sc("התרחיש", "מידת ההבנה של נקודת המבט של הדמות"),
      obs_contribution: sc("הלמידה", "מידת התרומה של הסדנה להכשרה בחינוך", AMOUNT),
      obs_debrief:      sc("הלמידה", "התחקיר חיבר בין מה שנצפה למה שנלמד"),
      obs_learned:      tx("הלמידה", "דבר אחד שנלמד מהצפייה"),
      obs_try:          sc("הלמידה", "מוכנות להתנסות בתפקיד המתנסה בפעם הבאה"),
      obs_skilltry:     tx("הלמידה", "מיומנות אחת שכדאי לי לתרגל בעצמי"),
      obs_improve:      tx("הלמידה", "מה כדאי לשפר?"),
    }},
  };

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const roleOf = (id) => ROLES.find(r => String(id).startsWith(r + "_")) || null;

  // הבנק = ברירות המחדל + מה שמוסדות הוסיפו (נשמר ב-BANK_KEY). ניסוחי מדדי
  // ברירת המחדל תמיד מכאן, כדי שתיקון ניסוח יחול גם על בנק שנשמר לפני התיקון.
  function loadBank(){
    const bank = clone(DEFAULTS);
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(BANK_KEY)); } catch(e){}
    if (saved && typeof saved === "object") {
      ROLES.forEach(role => {
        const s = saved[role]; if (!s || !s.bank) return;
        Object.entries(s.bank).forEach(([id, q]) => {
          if (bank[role].bank[id] || !q || !q.l) return;
          bank[role].bank[id] = Object.assign({ type:"text" }, q, { g: CUSTOM_GROUP });
        });
        // "active" ישן (לפני 24/09) היה רשימת 3 השאלות שבטופס — פחות מהמינימום.
        // רק בנק בגרסה הנוכחית קובע את ברירת המחדל שמוצעת למנחה.
        if (saved.v === VERSION && Array.isArray(s.active)) {
          const act = s.active.filter(id => bank[role].bank[id]);
          if (act.length) bank[role].active = act;
        }
      });
    }
    ROLES.forEach(role => {
      const hasCustom = Object.values(bank[role].bank).some(q => q.g === CUSTOM_GROUP);
      if (hasCustom && !bank[role].groups.includes(CUSTOM_GROUP)) bank[role].groups.push(CUSTOM_GROUP);
    });
    return bank;
  }
  function saveBank(bank){
    const out = { v: VERSION };
    ROLES.forEach(role => {
      const custom = {};
      Object.entries(bank[role].bank).forEach(([id, q]) => { if (!DEFAULTS[role].bank[id]) custom[id] = q; });
      out[role] = { active: bank[role].active.slice(), bank: custom };
    });
    try { localStorage.setItem(BANK_KEY, JSON.stringify(out)); } catch(e){}
  }
  function resetBank(){
    const cur = loadBank();
    // איפוס מחזיר את ברירות המחדל; מדדים שמוסדות תרמו לא נמחקים (הם שייכים לקהילה)
    ROLES.forEach(role => { cur[role].active = DEFAULTS[role].active.slice(); });
    saveBank(cur);
  }

  // ── מדד שנוסף (מנחה במסך הסדנה / מנהלת מוסד במסך הניהול) ──
  // ניסוח זהה למדד קיים באותו שאלון מחזיר את הקיים, בלי כפילות.
  function customDef(type, l, extra){
    return Object.assign({ g: CUSTOM_GROUP, l: String(l).trim().slice(0, 300), type: type === "scale" ? "scale" : "text" },
      type === "scale" ? { opts: AGREE } : {}, extra || {});
  }
  function ensureGroup(bank, role){
    if (!bank[role].groups.includes(CUSTOM_GROUP)) bank[role].groups.push(CUSTOM_GROUP);
  }
  function addMetric(role, fields, bank){
    const l = String((fields && fields.l) || "").trim();
    if (!l || !ROLES.includes(role)) return null;
    const fresh = loadBank();
    const same = Object.entries(fresh[role].bank).find(([, q]) => q.l.trim() === l);
    const id = same ? same[0] : role + "_" + Date.now();
    if (!same) {
      fresh[role].bank[id] = customDef(fields.type, l, { creator: fields.creator || null, by: fields.by || null,
        date: new Date().toISOString().slice(0, 10) });
      saveBank(fresh);
    }
    if (bank && !bank[role].bank[id]) { bank[role].bank[id] = fresh[role].bank[id]; ensureGroup(bank, role); }
    return id;
  }

  // ניסוחי המדדים שנוספו (לא מדדי ברירת המחדל) מתוך בחירה — לקישור ולמשוב
  function customList(sets, bank){
    const list = [];
    ROLES.forEach(r => (sets[r] || []).forEach(id => {
      const q = bank[r].bank[id];
      if (q && !DEFAULTS[r].bank[id]) list.push([id, q.type, q.l]);
    }));
    return list;
  }
  // מוסיף לבנק שבזיכרון (לא שומר) ניסוחים שהגיעו מקישור או ממשוב שמור.
  // הקלט לא אמין: רק מזהה בתבנית של השאלון, סוג מוכר, ניסוח קצוב — ומוצג כטקסט.
  function addCustom(list, bank){
    if (!Array.isArray(list)) return;
    list.forEach(x => {
      if (!Array.isArray(x)) return;
      const [id, type, l] = x, r = roleOf(id);
      if (!r || !/^[a-z]+_[A-Za-z0-9]+$/.test(String(id)) || !l || bank[r].bank[id]) return;
      bank[r].bank[id] = customDef(type, l);
      ensureGroup(bank, r);
    });
  }
  function b64e(str){
    let bin = ""; new TextEncoder().encode(str).forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64d(str){
    let t = String(str).replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) t += "=";
    return new TextDecoder().decode(Uint8Array.from(atob(t), c => c.charCodeAt(0)));
  }
  function encodeCustom(sets, bank){
    const list = customList(sets, bank);
    return list.length ? b64e(JSON.stringify(list)) : "";
  }

  // מדדים לפי קבוצה, בסדר הקבוצות של השאלון
  function grouped(role, bank){
    const r = bank[role];
    return r.groups.map(g => ({ g, items: Object.entries(r.bank).filter(([, q]) => q.g === g).map(([id, q]) => ({ id, q })) }))
      .filter(x => x.items.length);
  }

  const valid = (n) => n >= MIN && n <= MAX;

  // ── הבחירה של הסדנה ──
  function loadWorkshop(){
    try { const w = JSON.parse(localStorage.getItem(WS_KEY)); if (w && w.sets) return w; } catch(e){}
    return null;
  }
  function saveWorkshop(sets, meta){
    const w = Object.assign({ sets, at: new Date().toISOString() }, meta || {});
    try { localStorage.setItem(WS_KEY, JSON.stringify(w)); } catch(e){}
    return w;
  }
  function encode(sets){ return ROLES.flatMap(r => sets[r] || []).join(","); }
  function decode(str, bank){
    const sets = { fac:[], trainee:[], obs:[] };
    String(str || "").split(",").map(s => s.trim()).filter(Boolean).forEach(id => {
      const r = roleOf(id); if (r && bank[r].bank[id] && !sets[r].includes(id)) sets[r].push(id);
    });
    return sets;
  }
  // מה יופיע בטופס: קישור עם ?m= > בחירת הסדנה במכשיר הזה > ברירת המחדל של המוסד
  function resolveSets(bank, search){
    const params = new URLSearchParams(search || location.search);
    const c = params.get("c");
    if (c) { try { addCustom(JSON.parse(b64d(c)), bank); } catch(e){} }
    const m = params.get("m");
    if (m) {
      const s = decode(m, bank);
      if (ROLES.some(r => s[r].length)) return { sets: fillMissing(s, bank), source:"link" };
    }
    const w = loadWorkshop();
    if (w) {
      const s = {}; ROLES.forEach(r => { s[r] = (w.sets[r] || []).filter(id => bank[r].bank[id]); });
      if (ROLES.some(r => s[r].length)) return { sets: fillMissing(s, bank), source:"workshop", scenario: w.scenario || "" };
    }
    return { sets: fillMissing({}, bank), source:"default" };
  }
  function fillMissing(s, bank){
    const out = {};
    ROLES.forEach(r => { out[r] = (s[r] && s[r].length) ? s[r] : bank[r].active.slice(); });
    return out;
  }

  window.SBE_FB = { MIN, MAX, ROLES, ROLE_LABEL, CUSTOM_GROUP, loadBank, saveBank, resetBank, grouped, valid,
    loadWorkshop, saveWorkshop, encode, decode, resolveSets, roleOf,
    addMetric, customList, addCustom, encodeCustom };
})();
