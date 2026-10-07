// "בנייה" במסכי הקלט — הפקת התוצר הנרטיבי, משותף לשלושת מסכי הקלט.
//   input-screen.html          → SBE_BUILD.buildEdu(...)   (הצינור התלת-שלבי, /api/pipeline)
//   parent-input-screen.html   → SBE_BUILD.buildRole({track:"parents"}) (/api/complete, סכימת scenarios/*.json)
//   student-input-screen.html  → SBE_BUILD.buildRole({track:"youth"})
//
// למה זה קיים (21/09/2026): עד עכשיו "בנייה" הציג JSON גולמי של השדות.
// המשתמשת: "הלקוחות אינם צריכים לראות את הרשימות. הרשימות הן חומר הגלם
// עבור ה-AI ליצירת התוצר. התוצר חייב להיות תחת הלוגו ועם פרטים מזהים."
// כאן השדות נשלחים למודל כחומר גלם, המודל מחזיר את שדות הפרוזה לפי
// prompts/narrative-products.md, והתבנית (lib/narrative-doc.js — אותו קוד
// בדיוק כמו build-docs.mjs/build-role-docs.mjs) מרכיבה מהם את המסמכים.
//
// בלי שרת AI זמין (עודכן 23/09/2026): לא מוצג שום תוצר מוכן מראש. עד היום
// נטען כאן "תרחיש הדוגמה" של המסלול — תוצר שנכתב לפני החיבור למודל. המשתמשת:
// "תמחקי את כל התוצרים שיצרת לפני החיבור למודל - זה לא רלוונטי וזה היה רעיון
// רע." עכשיו: הודעה כנה שהתוצר לא נבנה, למה, ומה לעשות — ואף פעם לא JSON.
//
// דורש: window.SBE_DOC (lib/narrative-doc.js) טעון לפני הקובץ הזה.
(function () {
  "use strict";

  const el = (t, a = {}, ...kids) => {
    const n = document.createElement(t);
    for (const [k, v] of Object.entries(a)) { if (k === "class") n.className = v; else if (k === "style") n.style.cssText = v; else n.setAttribute(k, v); }
    for (const k of kids) n.append(k);
    return n;
  };

  // ── קריאה למודל ──────────────────────────────────────────────────
  async function postJson(url, body, timeoutMs, signal) {
    const ctrl = new AbortController();
    if (signal?.aborted) throw staleBuild();
    const stop = () => ctrl.abort();
    signal?.addEventListener('abort', stop, { once: true });
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "POST", headers: window.sbeAIHeaders(), body: JSON.stringify(body), signal: ctrl.signal });
      // תשובה ריקה או קטועה (החיבור נותק באמצע) — הודעה ברורה במקום "Unexpected end of JSON input"
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch (e) { const x = new Error("החיבור לשרת נקטע באמצע (" + res.status + ")"); x.cut = true; throw x; }
      if (!res.ok || data.error) throw Object.assign(new Error(data.error || ("שגיאת שרת " + res.status)), { status: res.status, code: data.code });
      return data;
    } catch (e) { if (signal?.aborted) throw staleBuild(); throw e; }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
  }
  let activeEdu = null;
  function staleBuild() { return Object.assign(new Error('הבנייה בוטלה לאחר ביטול, ניקוי או שינוי בשדות. הטיוטה הקודמת נשמרת.'), { cancelled: true }); }
  function cancelEduJob(run) {
    if (run.jobId) postJson(run.server + '/api/pipeline-cancel', { jobId: run.jobId }, 30000).catch(() => {});
  }
  function awaitEduStart(acknowledgment, run) {
    if (!run) return acknowledgment;
    return new Promise((resolve, reject) => {
      const stop = () => reject(staleBuild());
      run.ctrl.signal.addEventListener('abort', stop, { once: true });
      if (run.ctrl.signal.aborted) stop();
      acknowledgment.then(value => { run.ctrl.signal.removeEventListener('abort', stop); resolve(value); },
        error => { run.ctrl.signal.removeEventListener('abort', stop); reject(error); });
    });
  }
  function invalidateEdu() {
    const run = activeEdu;
    if (!run) return;
    run.ctrl.abort();
    cancelEduJob(run);
    try { localStorage.removeItem(JOB_KEY); } catch (_) {}
  }
  function beginEdu(server) {
    invalidateEdu();
    const run = { ctrl: new AbortController(), server, jobId: null };
    activeEdu = run;
    const cancel = document.getElementById('bCancelBuild'); if (cancel) cancel.hidden = false;
    return run;
  }
  function checkEdu(run) { if (run && (activeEdu !== run || run.ctrl.signal.aborted)) throw staleBuild(); }
  function endEdu(run) {
    if (activeEdu !== run) return;
    activeEdu = null;
    const cancel = document.getElementById('bCancelBuild'); if (cancel) cancel.hidden = true;
  }
  function extractJson(text) {
    const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : String(text);
    const s = body.indexOf("{"), e = body.lastIndexOf("}");
    if (s < 0 || e <= s) throw new Error("לא נמצא JSON בתשובה");
    return JSON.parse(body.slice(s, e + 1));
  }
  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error("לא נמצא " + path);
    return res.json();
  }

  // ── עקרונות הכתיבה, מתומצתים לפרומפט (המקור: prompts/narrative-products.md) ──
  const PRINCIPLES = [
    "את כותבת תוצר שמישהי תקרא לפני שהיא נכנסת לחדר — לא טופס. כל שדה פרוזה הוא פסקאות רציפות, בלי כותרות-משנה, בלי תוויות ונקודתיים, בלי רשימות.",
    "כרטיס דמות נכתב בגוף שני, במגדר של הדמות: \"את מיכל, בת שלושים ושמונה\". התסריט למנחה — בגוף שלישי.",
    "מהגלוי אל הסמוי באותה פסקה: \"בקול יש כעס ותסכול; מתחת יש בושה — כל הכיתה קראה משהו שכתבת בחצות.\" הסמוי מוסבר דרך מה שגרם לו. הצורך שלא ייאמר: \"מה שאת צריכה ולא תבקשי: תמיכה.\"",
    "הביטוי החוזר, מה שהדמות לא תגיד, והתגובה בלחץ נשמעים בטקסט עם הסיבה — לא מדווחים. \"המשפט שלעולם לא תגידי: 'אני מתביישת בך' — את יודעת שזה יישאר.\"",
    "הסתירה נכתבת כ\"מה שלא מסתדר\" ותמיד מחוברת לאיך היא יכולה לעלות בשיחה ולמה היא פתח.",
    "\"מי מולך\" מתאר את הצד השני כדי להוביל, לא כדי לרחם: מה הוא יטה לעשות, ואילו הזדמנויות אמיתיות לתת לו.",
    "הגישה החינוכית אומרת משהו על הרגע הזה, לא על עצמה: מה מכריע את חמש הדקות לפיה, ומה שאלת התחקיר ששייכת לה.",
    "\"איך חמש הדקות יכולות להתגלגל\" — קשת, לא סקריפט; תמיד עם המשפט שהתפניות הן מלאי ולא רצף. הסיומים — פסקה אחת שאומרת שאחד מהם אינו טוב.",
    "חוק הספציפיות: שם, מספר, חפץ, מקום, משפט במרכאות. משפט שאפשר להעתיק לתרחיש אחר בלי לשנות מילה נפסל.",
    "בכל תפנית, branches: move הוא מה שהצד השני עושה (פועל בגוף שלישי, בלי כינוי, למשל \"חוזרת: 'עומר, שמעת?'\"), says הוא מה שהדמות מגיבה. הקוד מוסיף בעצמו \"אם מיכל\" / \"אז עומר\".",
    "קווים אדומים: אין מניפולציה, מלכודת, השפלה, אלימות או סכום אפס אצל אף דמות. ילד או נער בתרחיש יכולים לצעוק, לטרוק דלת, לומר דברים חדים — זה חומר של השיחה. תוכן מיני עם קטין/ה, תיאור מפורש או הדרכתי של פגיעה — אסורים בהחלט.",
    "ניסוח נייטרלי מגדרית בכל מקום שאינו פנייה לדמות מסוימת. שם פרטי בלבד לדמויות, בלי שם משפחה.",
    "אסור לכתוב שם של מחבר, מאמר, ספר, מחקר או שנת פרסום — גם כשמסבירים גישה. אפשר להזכיר את הגישה ואת רעיונותיה במילים. מקורות מגיעים רק מספריית המקורות המאומתת של המערכת.",
  ].join("\n");

  const ROLE_SCHEMA = `{
  "name": "שם ספרותי, 2-4 מילים, נגזר ממשפט שנאמר בתרחיש — לא מתאר את הנושא",
  "subtitle": "[סוג המחלוקת] בין [מי] ל[מי] על [הנושא]",
  "background": ["פסקה: מה קרה ואיפה נפגשים", "פסקה: מה הקונפליקט, ולמה אין כאן צד רע"],
  "characters": [
    { "key": "char1", "name": "שם פרטי", "pronoun": "את | אתה", "badge": "כרטיס דמות · <שם>",
      "portrait": ["3 פסקאות בגוף שני: מי את/ה היום ואיך את/ה מדבר/ת", "מה את/ה רוצה, מה מתחת, החשש, והמשפט שלא ייאמר", "מה שלא מסתדר — ואיך זה יכול לעלות"],
      "facing": ["1-2 פסקאות: מי מולך, מה לצפות, ואילו הזדמנויות את/ה נותן/ת"],
      "summary": ["1-2 פסקאות בגוף שלישי, לתסריט של המנחה"] },
    { "key": "char2", "name": "", "pronoun": "", "badge": "", "portrait": [], "facing": [], "summary": [] }
  ],
  "approachText": ["2 פסקאות: מה הגישה אומרת על הרגע הזה"],
  "arc": ["2 פסקאות: איך חמש הדקות יכולות להתגלגל"],
  "turningPoints": [
    { "n": 1, "name": "", "type": "פתיחה | סגירה | מותנה | היפוך | פתיחה עמוקה | ניתוק", "core": true, "who": "char1 | char2",
      "trigger": "", "does": "", "demands": "", "missed": "",
      "branches": [ { "move": "", "says": "", "effect": "פותח | מחזיק | סוגר", "quality": "מקדם | שגוי | נכון אך כואב" }, { "move": "", "says": "", "effect": "", "quality": "" } ] }
  ],
  "endingsProse": "פסקה אחת",
  "watch": ["4-5 נקודות לצפייה"],
  "debrief": ["5 שאלות לתחקיר, בעדשת הגישה"]
}`;

  function fieldsText(fields, labels) {
    return Object.entries(fields)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `${labels[k] || k}: ${String(v).trim()}`)
      .join("\n");
  }

  // ── תצוגת התוצר בדיאלוג ───────────────────────────────────────────
  // files: [[filename, html, label], ...]
  function docsPanel({ files, mock, mockNote, saveKey, meta, scenario, server }) {
    saveKey = window.sbeUserKey(saveKey);
    // הדיאלוג של מסכי הקלט צר (כ-640px) — המסמך רחב יותר, אז מרחיבים אותו
    // לתצוגת התוצר. לא משנה שום דיאלוג אחר.
    const dlg = document.getElementById("dlg");
    if (dlg) { dlg.style.maxWidth = "940px"; dlg.style.width = "94vw"; }
    const wrap = el("div", { class: "sbe-build" });
    wrap.append(el("style", {}, `
      .sbe-build .sb-banner{border-radius:6px;padding:9px 12px;font-size:12.5px;line-height:1.5;margin-bottom:10px;}
      .sbe-build .sb-banner.mock{background:#FAEFDC;border-inline-start:3px solid #8F5F2E;color:#5C3D1A;}
      .sbe-build .sb-banner.ai{background:#E7EFE9;border-inline-start:3px solid #3F6B52;color:#25452F;}
      .sbe-build .sb-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;}
      .sbe-build .sb-tabs button{font-family:inherit;font-size:13px;padding:6px 12px;border-radius:16px;border:1px solid #CDD3D8;background:#EDEFF1;color:#141C24;cursor:pointer;}
      .sbe-build .sb-tabs button.on{background:#2E5A7D;border-color:#2E5A7D;color:#fff;}
      .sbe-build iframe{width:100%;height:52vh;border:1px solid #CDD3D8;border-radius:6px;background:#E9ECEE;}
      .sbe-build .sb-note{font-size:12.5px;color:#5C6771;margin:10px 0 8px;line-height:1.5;}
      .sbe-build .sb-actions{display:flex;gap:8px;flex-wrap:wrap;}
      .sbe-build .sb-actions button{font-family:inherit;font-size:13.5px;font-weight:600;padding:8px 14px;border-radius:6px;border:1px solid #CDD3D8;background:#E4E7EA;color:#141C24;cursor:pointer;}
      .sbe-build .sb-actions button.p{background:#2E5A7D;border-color:#2E5A7D;color:#fff;}
    `));
    wrap.append(el("div", { class: "sb-banner " + (mock ? "mock" : "ai") },
      mock ? (mockNote || "⚠ אין חיבור למודל כרגע — מוצג תרחיש הדוגמה של המסלול הזה, באותה תבנית בדיוק שבה ייבנה התרחיש שלך כשהשרת המקומי פועל.")
           : "התוצר נכתב על ידי המודל מתוך השדות שמילאת. קראי, ואם משהו לא מדויק — ערכי את השדה למעלה ובני מחדש."));
    if (scenario && window.SBE_ACTIVITY_REVIEW) {
      const editor = el('div'); wrap.append(editor);
      window.SBE_ACTIVITY_REVIEW.mount(editor, { scenario, server, onApproved: artifact => {
        // Workshop choices only come from the server-derived, explicitly approved snapshot.
        saveWorkshopScenario(artifact.content.scenario, 'edu');
      } });
    }
    const tabs = el("div", { class: "sb-tabs" });
    const frame = el("iframe", { title: scenario ? "תצוגת המסמכים המקוריים — גיבוי פרטי" : "תצוגת התוצר", sandbox: "allow-same-origin allow-modals" });
    let current = 0;
    const select = (i) => {
      current = i;
      [...tabs.children].forEach((b, j) => b.classList.toggle("on", j === i));
      frame.srcdoc = files[i][1];
    };
    files.forEach(([, , label], i) => {
      const b = el("button", { type: "button" }, label);
      b.addEventListener("click", () => select(i));
      tabs.append(b);
    });
    wrap.append(tabs, frame);
    select(0);
    wrap.append(el("p", { class: "sb-note" },
      "אפשר לסגור, לערוך כל שדה למעלה ולבנות מחדש — התוצר כאן הוא תמיד הגרסה האחרונה שבנית. מרוצה? שמרי אותו למטה. כל מסמך נשמר כקובץ HTML שנפתח בדפדפן ומודפס/נשמר כ-PDF משם."));
    const actions = el("div", { class: "sb-actions" });
    const openBtn = el("button", { type: "button", class: "p" }, "פתיחה בחלון חדש / הדפסה");
    openBtn.addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([files[current][1]], { type: "text/html;charset=utf-8" }));
      window.open(url, "_blank");
    });
    const dlBtn = el("button", { type: "button" }, "שמירה למחשב (המסמך הנוכחי)");
    dlBtn.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([files[current][1]], { type: "text/html;charset=utf-8" }));
      a.download = files[current][0]; document.body.append(a); a.click(); a.remove();
    });
    const dlAll = el("button", { type: "button" }, "שמירה למחשב (כל המסמכים)");
    dlAll.addEventListener("click", () => {
      files.forEach(([name, html], i) => setTimeout(() => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
        a.download = name; document.body.append(a); a.click(); a.remove();
      }, i * 400));
    });
    if (scenario) wrap.append(el('p', { class: 'sb-note' }, 'המסמכים כאן הם גיבוי פרטי של הנוסח המקורי. שלבים והסברים ערוכים נשמרים בהכנה הפרטית למעלה; לתרגול השתמשי בקישור של הגרסה שאישרת.'));
    const sysBtn = el("button", { type: "button" }, scenario ? "שמירת המסמכים המקוריים במכשיר — גיבוי פרטי" : "שמירה במכשיר");
    sysBtn.addEventListener("click", () => {
      try {
        const list = JSON.parse(localStorage.getItem(saveKey) || "[]");
        list.push({ savedAt: new Date().toISOString(), mock: !!mock, meta: meta || null, files: files.map(([n, h, l]) => ({ name: n, label: l, html: h })) });
        localStorage.setItem(saveKey, JSON.stringify(list));
        sysBtn.textContent = "הגיבוי הפרטי נשמר במכשיר ✓";
      } catch (e) { sysBtn.textContent = 'הגיבוי לא נשמר — אפשר להוריד קובץ למחשב'; }
    });
    actions.append(openBtn, dlBtn, dlAll, sysBtn);
    wrap.append(actions);
    return wrap;
  }

  function busy(button, text) {
    const prev = button.textContent; button.disabled = true; button.textContent = text;
    return () => { button.disabled = false; button.textContent = prev; };
  }

  // התוצר לא נבנה — הודעה כנה במקום תוצר מוכן מראש. reason הוא הודעת השגיאה
  // הגולמית; מתורגמת לשני המקרים השכיחים (השרת כבוי / המודל החזיר תשובה חסרה).
  function notBuilt(reason) {
    const why = String(reason || "");
    const offline = /Failed to fetch|NetworkError|ECONNREFUSED|Load failed/i.test(why);
    const slow = !offline && /abort|timeout/i.test(why);
    const box = el("div", { class: "sbe-build" });
    box.append(el("style", {}, `.sbe-build .sb-banner{border-radius:6px;padding:10px 13px;font-size:14px;line-height:1.6;margin-bottom:10px;background:#FAEFDC;border-inline-start:3px solid #8F5F2E;color:#5C3D1A;}
      .sbe-build .sb-why{font-size:12px;color:#5C6771;direction:ltr;text-align:left;background:#EDEFF1;border-radius:6px;padding:6px 9px;word-break:break-word;}`));
    box.append(el("div", { class: "sb-banner" }, offline
      ? "התוצר לא נבנה: אין חיבור לשרת. אם את עובדת בענן — השרת ישן ומתעורר, המתיני כ-60 שניות ולחצי שוב על \"בנייה\". אם את עובדת מקומית — ודאי שחלון \"S.B.E - AI\" פתוח ושתופיע ההודעה \"שרת ה-AI פועל\". כל מה שמילאת בטופס נשמר."
      : slow
      ? "התוצר לא נבנה: הבנייה לקחה יותר מ-30 דקות — זה קורה לפעמים כשהשרת עמוס. כל מה שמילאת בטופס נשמר — לחצי שוב על \"בנייה\"."
      : "התוצר לא נבנה: המודל החזיר תשובה חסרה או שהקריאה נכשלה באמצע. כל מה שמילאת בטופס נשמר — לחצי שוב על \"בנייה\". אם זה חוזר, העתיקי את השורה למטה ושלחי אותה בכפתור \"דיווח\"."));
    if (reason) box.append(el("div", { class: "sb-why" }, String(reason).slice(0, 300)));
    return box;
  }

  // ── מסלולי הורים / נוער ───────────────────────────────────────────
  async function buildRole({ track, fields, labels, button, server, samplePath, setStatus, show, meta }) {
    const done = busy(button, "כותבת את התוצר... עד כ-8 דקות");
    let scn = null;
    try {
      const trackNote = track === "parents"
        ? "המסלול: הורים. שתי דמויות שוות (הורה וילד/ה, או שני בני משפחה) — מי מגלמת את מי נקבע בזמן התרגול. \"מה הגישה אומרת בערב הזה\"."
        : "המסלול: נוער. שתי דמויות נוער שוות במשחק תפקידים חי עם מנחה. הגישה החינוכית היא עדשת התחקיר של המנחה, לא התנהגות בסצנה. \"מה הגישה אומרת בשיחה הזאת\".";
      const system = [
        "את כותבת תוצר נרטיבי לסימולציה חינוכית עבור מערכת Begood, בעברית. מקבלת שדות גולמיים שמולאו במסך הקלט (חלקם על ידי המשתמשת, חלקם הוצעו), ומחזירה JSON אחד בדיוק לפי הסכימה בסוף — כל ערך טקסט בו הוא פרוזה שנכתבה לפי העקרונות.",
        trackNote,
        "עקרונות הכתיבה (מחייבים):\n" + PRINCIPLES,
        "השדות שסומנו כנעולים נכתבו על ידי המשתמשת — אסור לסתור אותם ואסור לנסח מחדש עובדה שנמסרה בהם. שאר השדות הם חומר גלם: הרגשות, הצרכים, הביטוי החוזר, מה שלא ייאמר, התגובה בלחץ והסתירה של כל דמות חייבים להישמע בתוך הפרוזה של הכרטיס שלה.",
        "חמש נקודות תפנית בדיוק, שתיים מהן core, לפחות אחת מסוג סגירה או ניתוק; לכל תפנית שני ענפים (אחד פותח, אחד סוגר/מחזיק). who הוא הדמות שעושה את does ומגיבה ב-says.",
        "החזירי אך ורק JSON תקין אחד, בלי טקסט לפני או אחרי. הסכימה:\n" + ROLE_SCHEMA,
      ].join("\n\n");
      const user = "השדות:\n" + fieldsText(fields, labels) + "\n\nכתבי את התוצר.";
      const text = await runCompleteJob(server, { system, messages: [{ role: "user", content: user }], maxTokens: 24000 }, button);
      scn = extractJson(text);
      if (!scn.characters || scn.characters.length !== 2 || !Array.isArray(scn.turningPoints)) throw new Error("המבנה שחזר מהמודל חסר");
      if (setStatus) setStatus("ok");
    } catch (e) {
      console.warn("בנייה: התוצר לא נבנה. סיבה:", e.message);
      if (setStatus) setStatus("mock");
      show("התוצר לא נבנה", notBuilt(e.message));
      return;
    } finally { done(); }

    // השלמת שדות המעטפת מהמסך, וקביעת שמות קבצים
    const stamp = new Date();
    const dateHe = stamp.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
    const keys = scn.characters.map((c) => c.key || "");
    scn.id = scn.id || (track === "parents" ? "PR" : "YT") + "-" + String(stamp.getMonth() + 1).padStart(2, "0") + String(stamp.getDate()).padStart(2, "0") + "-" + String(stamp.getHours()).padStart(2, "0") + String(stamp.getMinutes()).padStart(2, "0");
    scn.track = track;
    scn.institution = scn.institution || fields.inst || (meta && meta.institution) || "";
    scn.creator = scn.creator || fields.creator || "";
    scn.date = scn.date || fields.date || dateHe;
    scn.duration = scn.duration || String(fields.dur || "5").replace(/\D+/g, "") || "5";
    scn.age = scn.age || fields.ageBand || fields.otherAgeBand || "";
    scn.approach = scn.approach || fields.approach || "";
    scn.conflictType = scn.conflictType || fields.conflictType || "";
    scn.scenarioBadge = scn.scenarioBadge || (track === "youth" ? "תסריט למשחק תפקידים · למנחה" : "תסריט למשחק תפקידים");
    scn.redLine = scn.redLine || (track === "parents"
      ? "קו אדום: גם במצבים מתוחים, אלימות מכל סוג, השפלה, זלזול או מניפולציה של סכום אפס אינם לגיטימיים. ילד שצועק, טורק דלת או אומר \"את הכי גרועה\" — זה חלק מהתרחיש, לא חצייה של קו אדום. הקו האדום חל על המבוגר. אם זה קורה בכל זאת, המנחה עוצרת — וזה רגע ללמידה, לא כישלון."
      : "קו אדום: גם במצבים מתוחים, אלימות מכל סוג, השפלה, זלזול או מניפולציה של סכום אפס אינם לגיטימיים. בני נוער בתרחיש יכולים לצעוק, להתרחק, לומר דברים חדים — זה חומר של השיחה. הקו האדום חל על מי שמגלמת את הדמות, לא על הדמות. אם זה קורה בכל זאת, המנחה עוצרת — וזה רגע ללמידה, לא כישלון.");
    if (!scn.outputs) {
      const slug = (s) => String(s || "").replace(/[^A-Za-z0-9֐-׿]+/g, "-").replace(/^-|-$/g, "");
      scn.outputs = { scenario: track + "-" + slug(scn.name), cards: {} };
      scn.characters.forEach((c) => { scn.outputs.cards[c.key] = track + "-" + slug(c.name); });
    }
    scn.characters.forEach((c) => { c.badge = c.badge || ("כרטיס דמות · " + c.name); c.pronoun = c.pronoun || "את"; });
    scn.turningPoints.forEach((t, i) => { t.n = t.n || i + 1; if (!keys.includes(t.who)) t.who = keys[0]; });

    saveWorkshopScenario(scn, track);
    const { files } = window.SBE_DOC.renderRoleDocs(scn);
    show("התוצר — " + scn.name,
      docsPanel({ files, mock: false, saveKey: "sbe." + track + ".built.v1", meta: { id: scn.id, name: scn.name, creator: scn.creator, date: scn.date } }));
  }

  // ── תרחישים לסדנה (05/10/2026) ──────────────────────────────────
  // כל תרחיש שנבנה נשמר במכשיר כ"כרטיס סדנה" (שם, שאלות פתיחה, תפניות, מה לראות, תחקיר),
  // כדי שהמנחה תבחר אותו במסך הסדנה (facilitator-screen.html) — סטודנטים, הורים או נוער.
  const WS_KEY = window.sbeUserKey("sbe.workshop.scenarios.v1");
  const GENERIC_PRE = ["מתי לאחרונה הייתם בשיחה שבה שני הצדדים צדקו?", "מה עוזר לכם להישאר בשיחה כשהיא נעשית קשה?"];
  function saveWorkshopScenario(scn, track) {
    try {
      const f = scn.facilitator || {};
      const card = {
        id: scn.id || (track + "-" + Date.now()), track, name: scn.name || "תרחיש", sub: scn.subtitle || "",
        lang: scn.language || "עברית", minutes: Number(String(scn.duration || "5").replace(/\D+/g, "")) || 5,
        pre: (f.preQuestions && f.preQuestions.length ? f.preQuestions : GENERIC_PRE).slice(0, 4),
        core: (scn.turningPoints || []).filter((t) => t.core).slice(0, 3).map((t) => ({ n: t.n, name: t.name || "", demands: t.demands || "" })),
        watch: (f.watchFor || scn.watch || []).slice(0, 6), debrief: (f.debrief || scn.debrief || []).slice(0, 6), at: Date.now(),
      };
      const list = JSON.parse(localStorage.getItem(WS_KEY) || "[]").filter((x) => x.id !== card.id);
      list.unshift(card);
      localStorage.setItem(WS_KEY, JSON.stringify(list.slice(0, 15)));
    } catch (e) {}
  }

  // ── עבודת רקע בשרת (04/10/2026) ─────────────────────────────────
  // הצינור רץ 10–20 דקות. במקום בקשה אחת ארוכה (שנקטעה כשהטלפון נכנס להמתנה או בניתוק רגעי),
  // השרת מחזיר מזהה עבודה, והדף שואל כל כמה שניות מה המצב ומראה באיזה שלב הבנייה.
  // המזהה נשמר במכשיר, כך שאפשר לרענן את הדף או לחזור אליו — והבנייה ממשיכה.
  const JOB_KEY = window.sbeUserKey("sbe.edu.job.v1");
  const STAGE_TXT = [["stage1", "שלב 1 מתוך 3: הדמויות והקונפליקט"], ["stage2", "שלב 2 מתוך 3: נקודות התפנית ופתיחה למתנסה"], ["stage3", "שלב 3 מתוך 3: כתיבת המסמכים"]];
  function stageLine(st, elapsed) {
    st = st || {};
    let cur = STAGE_TXT[0][1];
    if (st.stage1 === "done") cur = STAGE_TXT[1][1];
    if (st.stage2 === "done" && st.trainee === "done") cur = STAGE_TXT[2][1];
    const retry = Object.values(st).includes("retry") ? " · ניסיון נוסף אחרי עיכוב קצר" : "";
    return "בונה את התרחיש — " + cur + " · " + Math.max(1, Math.round((elapsed || 0) / 60)) + " דק׳" + retry;
  }
  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(staleBuild()); return; }
    const stop = () => { clearTimeout(timer); reject(staleBuild()); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
    signal?.addEventListener('abort', stop, { once: true });
  });
  // תקלה זמנית אצל ספק המודל (עומס, זמן, שגיאת שרת) — שווה לנסות שוב פעם אחת
  const TRANSIENT = /overload|529|503|502|500|rate.?limit|timeout|timed out|ECONNRESET|socket|fetch failed|עומס|נקטע/i;
  async function pollOnce(server, jobId, signal) {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 30000);
    const stop = () => ctrl.abort(); signal?.addEventListener('abort', stop, { once: true });
    try {
      const res = await fetch(server + "/api/pipeline-status", { method: "POST", headers: window.sbeAIHeaders(), body: JSON.stringify({ jobId }), signal: ctrl.signal });
      if (!res.ok) throw Object.assign(new Error("status " + res.status), { status: res.status });
      return await res.json();
    } catch (e) { if (signal?.aborted) throw staleBuild(); throw e; }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
  }
  async function pollJob(server, jobId, button, want, run) {
    const t0 = Date.now(); let misses = 0;
    while (Date.now() - t0 < 45 * 60000) {
      checkEdu(run);
      await sleep(document.hidden ? 15000 : 7000, run?.ctrl.signal);
      let d;
      // לא דרך postJson: עבודה שנכשלה מחזירה status:"error" עם שדה error, ו-postJson זרק אותה כ"ניתוק" —
      // הסיבה האמיתית הוסתרה עד "החיבור לשרת נקטע לזמן ארוך" (06/10/2026).
      try { d = await pollOnce(server, jobId, run?.ctrl.signal); checkEdu(run); misses = 0; }
      catch (e) { if (e.cancelled) throw e; if ([401,403,404].includes(e.status)) throw e; if (++misses >= 12) throw new Error("החיבור לשרת נקטע לזמן ארוך"); continue; }
      if (want === "text" && d.status === "done" && typeof d.text === "string") return d.text;
      if (d.status === "done" && d.scenario) return d.scenario;
      if (d.status === "error") { const e = new Error(d.error || "הבנייה נכשלה"); e.transient = TRANSIENT.test(e.message); throw e; }
      if (d.status === 'cancelled') throw staleBuild();
      if (d.status === "unknown" || d.status === "lost") { const e = new Error("השרת הופעל מחדש באמצע הבנייה"); e.lost = true; throw e; }
      if (button) button.textContent = want === "text"
        ? "כותבת את התוצר · " + Math.max(1, Math.round((d.elapsed || 0) / 60)) + " דק׳ (בדרך כלל 5–9)"
        : stageLine(d.stages, d.elapsed);
    }
    throw new Error("timeout: הבנייה נמשכה יותר מ-45 דקות");
  }
  // קריאה ארוכה אחת למודל (תוצרי הורים ונוער) — ברקע, עם שאילת התקדמות. השרת הופעל מחדש באמצע → מתחילים שוב פעם אחת.
  async function runCompleteJob(server, body, button, retried) {
    body = { ...body, requestId: body.requestId || window.crypto.randomUUID() };
    const start = await postJson(server + "/api/complete", { ...body, async: true }, 90000);
    if (!start.jobId) { if (typeof start.text === "string") return start.text; throw new Error(start.error || "המודל לא החזיר תשובה"); } // שרת ישן
    try { return await pollJob(server, start.jobId, button, "text"); }
    catch (e) {
      if ((e.lost || e.transient) && !retried) { if (button) button.textContent = (e.lost ? "השרת התחיל מחדש" : "עומס זמני אצל המודל") + " — מתחילה שוב את הכתיבה..."; return await runCompleteJob(server, {...body, requestId: window.crypto.randomUUID()}, button, true); }
      throw e;
    }
  }
  async function runEduJob(server, body, button, retried, run) {
    checkEdu(run);
    body = { ...body, requestId: body.requestId || window.crypto.randomUUID() };
    // UI cancellation ends immediately, while the bounded startup connection
    // can still receive the accepted job ID and cancel that specific job.
    const acknowledgment = postJson(server + "/api/pipeline", { ...body, async: true }, 90000).then(start => {
      if (run && start.jobId) {
        run.jobId = start.jobId;
        if (activeEdu !== run || run.ctrl.signal.aborted) cancelEduJob(run);
      }
      checkEdu(run); return start;
    });
    const start = await awaitEduStart(acknowledgment, run);
    if (!start.jobId) { // שרת ישן בלי מצב רקע — הבקשה הארוכה הרגילה
      if (start.scenario) return start.scenario;
      throw new Error(start.error || "הצינור לא החזיר תרחיש");
    }
    if (run) run.jobId = start.jobId;
    // גם הבקשה עצמה נשמרת, כדי שאפשר יהיה להתחיל מחדש גם אחרי רענון של הדף
    try { localStorage.setItem(JOB_KEY, JSON.stringify({ jobId: start.jobId, at: Date.now(), title: body.input && body.input.title || "", body, retried: !!retried })); } catch (e) {}
    try { return await pollJob(server, start.jobId, button, undefined, run); }
    catch (e) {
      // השרת הופעל מחדש באמצע (Deploy, עומס): מתחילים שוב לבד — פעם אחת
      if ((e.lost || e.transient) && !retried) { checkEdu(run); if (button) button.textContent = (e.lost ? "השרת התחיל מחדש" : "עומס זמני אצל המודל") + " — מתחילה שוב את הבנייה..."; return await runEduJob(server, {...body, requestId: window.crypto.randomUUID()}, button, true, run); }
      throw e;
    }
    finally { try { localStorage.removeItem(JOB_KEY); } catch (e) {} }
  }
  // חזרה לדף באמצע בנייה: ממשיכים לחכות לאותה עבודה (עד 3 שעות מתחילתה)
  async function resumeEdu({ button, server, setStatus, show }) {
    let job = null;
    try { job = JSON.parse(localStorage.getItem(JOB_KEY) || "null"); } catch (e) {}
    if (!job || !job.jobId || Date.now() - job.at > 3 * 3600000) { try { localStorage.removeItem(JOB_KEY); } catch (e) {} return; }
    const run = beginEdu(server); run.jobId = job.jobId;
    const done = busy(button, "ממשיכה לבנות את התרחיש שהתחלת" + (job.title ? " (" + job.title + ")" : "") + "...");
    let scn = null;
    try {
      try { scn = await pollJob(server, job.jobId, button, undefined, run); }
      catch (e) {
        if (e.lost && job.body && !job.retried) { checkEdu(run); button.textContent = "השרת התחיל מחדש — מתחילה שוב את הבנייה..."; scn = await runEduJob(server, {...job.body, requestId: window.crypto.randomUUID()}, button, true, run); }
        else if (e.lost) { done(); try { localStorage.removeItem(JOB_KEY); } catch (x) {} return; } // בנייה ישנה שכבר לא קיימת — מנקים בשקט, בלי הודעת שגיאה
        else throw e;
      }
      checkEdu(run); if (setStatus) setStatus("ok");
    }
    catch (e) { if (e.cancelled) return; if (setStatus) setStatus("mock"); show("התוצר לא נבנה", notBuilt(e.message)); return; }
    finally { done(); endEdu(run); try { localStorage.removeItem(JOB_KEY); } catch (e) {} }
    showEdu(scn, show, server);
  }
  function showEdu(scn, show, server) {
    const { files, leaked } = window.SBE_DOC.renderEduDocs(scn);
    if (leaked.length) throw new Error('בדיקת פרטיות נכשלה. המסמכים לא יוצגו.');
    const prefix = (scn.id || "scenario") + "-";
    const named = files.map(([n, h, l]) => [prefix + n, h, l]);
    window._sbeScenarioBuilt = true;
    show("התוצר — " + scn.name,
      docsPanel({ files: named, mock: false, saveKey: "sbe.edu.built.v1", meta: { id: scn.id, name: scn.name }, scenario: scn, server }));
  }

  // ── מסלול אנשי חינוך: הצינור התלת-שלבי ───────────────────────────
  async function buildEdu({ fields, labels, button, server, samplePath, setStatus, show }) {
    const run = beginEdu(server);
    const done = busy(button, "מתחילה לבנות את התרחיש — כ-15 דקות. אפשר להשאיר את הדף פתוח, וגם לחזור אליו אחר כך.");
    let scn = null;
    try {
      const skills = String(fields.skills || "").split(",").map((s) => s.trim()).filter(Boolean);
      const input = {
        id: 0,
        title: [fields.traineeRole, fields.actorRole].filter(Boolean).join(" ↔ "),
        conflictType: fields.cType || "",
        language: fields.lang || "עברית",
        approach: fields.approach || "",
        experience: fields.exp || "קבוצה מנוסה",
        age: fields.age || "",
        skills,
        given: {
          who: [fields.traineeRole, fields.actorRole].filter(Boolean).join(" ו"),
          whatHappened: fields.event || "",
          goals: [fields.tGoal ? "המתנסה: " + fields.tGoal : "", fields.actorGoal ? "הדמות: " + fields.actorGoal : ""].filter(Boolean).join(". "),
        },
        locked: Object.fromEntries([['characters.trainee.role', fields.traineeRole], ['characters.actor.role', fields.actorRole], ['given.whatHappened', fields.event]].filter(([,v]) => v && String(v).trim())),
        // שאר השדות שמולאו במסך — חומר גלם שהצינור רשאי להישען עליו
        given_extra: fieldsText(fields, labels),
      };
      const meta = { institution: fields.inst || "", institutionId: String(fields.inst || "").trim(), eventDesc: fields.event || "", productType: "תרחיש", creator: fields.creator || "", date: fields.date || "", duration: String(fields.dur || "5").replace(/\D+/g, "") || "5", age: fields.age || "", audience: fields.audience || "" };
      scn = await runEduJob(server, { input, meta }, button, false, run);
      checkEdu(run);
      if (!scn || !scn.actor || !scn.trainee) throw new Error("הצינור לא החזיר תרחיש");
      if (setStatus) setStatus("ok");
    } catch (e) {
      if (e.cancelled) return;
      console.warn("בנייה: התוצר לא נבנה. סיבה:", e.message);
      if (setStatus) setStatus("mock");
      show("התוצר לא נבנה", notBuilt(e.message));
      return;
    } finally { done(); endEdu(run); }
    showEdu(scn, show, server);
  }

  window.SBE_BUILD = { buildRole, buildEdu, resumeEdu, docsPanel, invalidateEdu, PRINCIPLES, ROLE_SCHEMA };
})();
