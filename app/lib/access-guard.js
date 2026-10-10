/* ── שמירת הרשאות לכל דף ──
   נטען ב-<head> של כל מסך (חוץ ממסך הכניסה ושאלון החוסן שנפתח מ-QR), לפני
   שהדף מוצג. בודק מי נכנסה בלשונית הזאת (sbe.session.homeUrl, נשמר ב-entry.html
   אחרי בדיקה בשרת) ואם המסך הזה ברשימה של התפקיד. אם לא — חזרה למסך הבית של
   התפקיד, או למסך הכניסה כשאין כניסה.

   הרשימות משקפות את הניווט האמיתי של כל תפקיד (הקישורים שהוא רואה ומה שהם
   פותחים). מנהלת המערכת רואה הכול. מסך חדש שלא נוסף כאן פתוח רק לה.

   לשונית חדשה (קישור שנפתח ב-target="_blank") לא מקבלת את sessionStorage של
   הלשונית שפתחה אותה, ולכן הכניסה משוכפלת גם ל-localStorage ל-12 שעות.
   חזרה למסך הכניסה מוחקת את שתיהן.

   זו חסימה בדפדפן: היא עוצרת כל משתמשת רגילה, אבל הקבצים עצמם סטטיים. מה
   שחייב להיות מוגן באמת (סיסמאות, נתוני החוסן) נבדק בשרת. */
(function(){
  "use strict";
  var KEYS = ["sbe.session.homeUrl", "sbe.session.name", "sbe.session.role", "sbe.session.token", "sbe.session.modules",
              "sbe.session.perms", "sbe.session.info", "sbe.session.wf"];
  var MIRROR = "sbe.session.mirror", HOURS = 12;

  function ss(k){ try { return sessionStorage.getItem(k); } catch(e){ return null; } }

  // פנייה למודל (10/10/2026): השרת עונה רק למי שנכנס/ה, ורק לכלי שפתוח לו או לה (authorizeModel ב-harness/lib/access.mjs).
  // כאן, במקום אחד לכל הכלים, כל בקשה ל-/api/complete, /api/character-turn ו-/api/pipeline מקבלת את פרטי הכניסה:
  // האסימון החתום, הדף, ומזהה הסדנה למשתתפות סדנה.
  try {
    var _fetch = window.fetch;
    if (_fetch && !_fetch.sbeAuth) {
      var wrapped = function(url, opts){
        try {
          var u = typeof url === "string" ? url : (url && url.url) || "";
          if (/\/api\/(complete|character-turn|pipeline)(\?|$)/.test(u) && opts && typeof opts.body === "string" && opts.body.charAt(0) === "{") {
            var b = JSON.parse(opts.body);
            b._auth = { token: ss("sbe.session.token") || "", page: location.pathname.split("/").pop() || "index.html", w: ss("sbe.session.wf") || "" };
            opts = Object.assign({}, opts, { body: JSON.stringify(b) });
          }
        } catch(e){}
        return _fetch.call(this, url, opts);
      };
      wrapped.sbeAuth = true;
      window.fetch = wrapped;
    }
  } catch(e){}

  // שחזור כניסה בלשונית חדשה / רענון שכפול הכניסה ל-localStorage.
  try {
    if (!ss("sbe.session.homeUrl")) {
      var m = JSON.parse(localStorage.getItem(MIRROR) || "null");
      if (m && m.exp > Date.now() && m.data) {
        KEYS.forEach(function(k){ if (m.data[k] != null) sessionStorage.setItem(k, m.data[k]); });
      }
    }
    if (ss("sbe.session.homeUrl")) {
      var data = {};
      KEYS.forEach(function(k){ var v = ss(k); if (v != null) data[k] = v; });
      localStorage.setItem(MIRROR, JSON.stringify({ exp: Date.now() + HOURS * 3600e3, data: data }));
    }
  } catch(e){}

  // ── שמירה במכשיר לפי משתמש/ת (02/10/2026) ──
  // טופס שנשמר בדפדפן (פרקטי, נוגי, כתיבה מקדמת חוסן, משוב לעבודות) נשמר תחת מפתח של מי שנכנס/ה —
  // לפי הקוד שבאסימון — כדי שמי שנכנס/ת עם קוד אחר באותו דפדפן יקבל/תקבל טופס נקי.
  window.sbeUserKey = function(base){
    var id = "anon";
    try {
      var t = ss("sbe.session.token") || "";
      if (t.indexOf(".") > 0) {
        var b = t.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
        var bytes = Uint8Array.from(atob(b), function(ch){ return ch.charCodeAt(0); });
        var p = JSON.parse(new TextDecoder().decode(bytes));
        // קוד קורס: כל הסטודנטים עם אותו קוד — מבדילים לפי מזהה המכשיר (s)
        // Legacy institutional sessions share c=LEGACY; scope by the signed institution instead.
        // Ambiguous old c-LEGACY records are deliberately not migrated between institutions.
        id = p.k === "code" && p.c === "LEGACY" ? "legacy-inst-" + encodeURIComponent(p.inst || "")
          : p.k === "code" ? "c-" + p.c + (p.s ? "-" + p.s : "") : p.k === "inst" ? "inst-" + p.inst : String(p.k || "anon");
      } else if (ss("sbe.session.homeUrl")) id = "h-" + ss("sbe.session.homeUrl");
    } catch(e){}
    return base + ":" + id;
  };
  // ניקוי חד־פעמי של שמירות ישנות שלא היו לפי משתמש/ת (הן הציגו פרטים של מישהו אחר)
  try { ["sbe.advisor.v1", "sbe.nugi.v1", "sbe.writer.v1", "sbe.review.draft.v1"].forEach(function(k){ localStorage.removeItem(k); }); } catch(e){}

  var home = ss("sbe.session.homeUrl") || "";
  // רכיבים טכניים (למשל מצב החיבור למודל) — מוצגים רק למנהלת המערכת: class="sbe-sysonly"
  try {
    if (home === "admin.html?role=sys") document.documentElement.classList.add("sbe-sys");
    var st = document.createElement("style"); st.textContent = "html:not(.sbe-sys) .sbe-sysonly{display:none!important}";
    (document.head || document.documentElement).appendChild(st);
  } catch(e){}

  // בלי הערות מערכת במסכים (09/10/2026: "ההנחיות האלה אינן למשתמשים"):
  //  - הסבר מתחת לבחירה או לשדה (.hint, .crit-mode-d, .critadd-note, .seq-note, [data-info]) הופך לסימן ⓘ:
  //    הטקסט מופיע בריחוף או בלחיצה. [data-keep] נשאר גלוי (למשל ההנחיה במסך הכניסה).
  //  - שורות מצב (#ready, #hint, #sqReady, #sqHint, .fbstatus, [data-status-line]) לא מוצגות.
  //    כשהכפתור לידן כבוי, הטקסט עובר לריחוף על הכפתור, כדי שיהיה ברור למה.
  try {
    var qs = document.createElement("style");
    qs.textContent = ".sbe-q{display:none!important}.sbe-q.sbe-q-open{display:block!important;background:#F4F7FA;border:1px solid #CDD3D8;border-radius:8px;padding:.35rem .6rem;margin:.25rem 0;font-size:.88rem;color:#3C4650}" +
      "span.sbe-q.sbe-q-open{display:inline-block!important}" +
      ".sbe-i{font:inherit;font-size:.9em;line-height:1;border:none;background:none;color:#2E5A7D;cursor:pointer;padding:0 .3em;vertical-align:baseline}.sbe-i:focus-visible{outline:2px solid #2E5A7D;border-radius:4px}" +
      ".sbe-status-off{display:none!important}@media print{.sbe-i{display:none!important}}";
    (document.head || document.documentElement).appendChild(qs);
    var INFO = ".hint:not(.note):not([data-keep]),.crit-mode-d,.critadd-note,.seq-note,[data-info]";
    var STATUS = "#ready.note,#hint.note,#sqReady,#sqHint,.fbstatus,[data-status-line]";
    // במסך הכניסה ההנחיות הן העיקר, ולכן נשארות גלויות
    var keepInfo = /(^|\/)entry(\.html)?$/.test(location.pathname);
    var quiet = function(){
      if (!keepInfo) document.querySelectorAll(INFO).forEach(function(el){
        if (el.getAttribute("data-quiet") || el.closest(".sbe-sysonly")) return;
        el.setAttribute("data-quiet", "1");
        var b = document.createElement("button"); b.type = "button"; b.className = "sbe-i"; b.textContent = "ⓘ";
        b.setAttribute("aria-label", "הסבר"); b.setAttribute("aria-expanded", "false");
        var sync = function(){ b.title = (el.textContent || "").replace(/\s+/g, " ").replace(/^\s*·\s*/, "").trim(); b.hidden = !b.title; };
        sync(); try { new MutationObserver(sync).observe(el, {childList: true, characterData: true, subtree: true}); } catch(e){}
        b.addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); var o = el.classList.toggle("sbe-q-open"); b.setAttribute("aria-expanded", String(o)); });
        el.classList.add("sbe-q"); el.parentNode.insertBefore(b, el);
      });
      document.querySelectorAll(STATUS).forEach(function(el){
        if (el.getAttribute("data-quiet")) return;
        el.setAttribute("data-quiet", "1"); el.classList.add("sbe-status-off");
        var box = el.parentNode;
        var sync = function(){ var t = (el.textContent || "").trim(); if (!box) return;
          box.querySelectorAll("button").forEach(function(btn){ if (btn.disabled && t) btn.title = t; else if (btn.getAttribute("data-status-title")) btn.removeAttribute("title"); if (btn.disabled && t) btn.setAttribute("data-status-title", "1"); }); };
        sync(); try { new MutationObserver(sync).observe(el, {childList: true, characterData: true, subtree: true}); } catch(e){}
      });
    };
    var pending = 0;
    var later = function(){ if (pending) return; pending = setTimeout(function(){ pending = 0; quiet(); }, 60); };
    document.addEventListener("DOMContentLoaded", function(){ quiet(); try { new MutationObserver(later).observe(document.body, {childList: true, subtree: true}); } catch(e){} });
  } catch(e){}

  // תאריך כמקובל בישראל, בכל המערכת (10/10/2026: "תאריך יופיע כברירת מחדל ועם אפשרות לשנות. באופן בו הוא מופיע בכל המערכת"):
  // שדה תאריך של הדפדפן מוצג לפי שפת הדפדפן (לפעמים mm/dd/yyyy). כאן כל input[type=date] מקבל שדה טקסט בפורמט 10.10.26,
  // שאפשר להקליד בו (גם 10/10/2026), וכפתור 📅 שפותח את לוח השנה. הערך של השדה המקורי נשאר yyyy-mm-dd, כך שהקוד לא משתנה.
  try {
    var p2 = function(n){ return (n < 10 ? "0" : "") + n; };
    window.sbeDateIL = function(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); return m ? m[3] + "." + m[2] + "." + m[1].slice(2) : ""; };
    window.sbeIsoPlus = function(days){ var d = new Date(); d.setDate(d.getDate() + (days || 0)); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
    var parseIL = function(t){
      var m = /^\s*(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2}|\d{4})\s*$/.exec(String(t || "")); if (!m) return null;
      var y = +m[3]; if (y < 100) y += 2000; var mo = +m[2], d = +m[1], dt = new Date(y, mo - 1, d);
      return dt.getMonth() === mo - 1 && dt.getDate() === d ? y + "-" + p2(mo) + "-" + p2(d) : null;
    };
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    var dateIL = function(inp){
      if (inp.getAttribute("data-il") || inp.closest("[data-native-date]")) return; inp.setAttribute("data-il", "1");
      var t = document.createElement("input"); t.type = "text"; t.inputMode = "numeric"; t.className = "sbe-date " + (inp.className || "");
      t.placeholder = "יום.חודש.שנה"; t.setAttribute("aria-label", inp.getAttribute("aria-label") || (inp.id && document.querySelector('label[for="' + inp.id + '"]') ? document.querySelector('label[for="' + inp.id + '"]').textContent : "תאריך"));
      t.style.cssText = "width:7.5em;direction:ltr;text-align:right";
      var cal = document.createElement("button"); cal.type = "button"; cal.textContent = "📅"; cal.title = "לוח שנה"; cal.setAttribute("aria-label", "פתיחת לוח שנה");
      cal.style.cssText = "font:inherit;border:1px solid #CDD3D8;border-radius:6px;background:transparent;cursor:pointer;padding:.2rem .4rem;margin-inline-start:.25rem";
      var sync = function(){ t.value = window.sbeDateIL(desc.get.call(inp)); t.style.borderColor = ""; };
      Object.defineProperty(inp, "value", { configurable: true, get: function(){ return desc.get.call(this); }, set: function(v){ desc.set.call(this, v); sync(); } });
      inp.style.cssText += ";position:absolute;opacity:0;width:1px;height:1px;pointer-events:none;border:0;padding:0";
      inp.tabIndex = -1; inp.setAttribute("aria-hidden", "true");
      inp.parentNode.insertBefore(t, inp); inp.parentNode.insertBefore(cal, inp.nextSibling);
      inp.addEventListener("change", sync);
      cal.addEventListener("click", function(){ try { if (inp.showPicker) { inp.style.pointerEvents = "auto"; inp.showPicker(); inp.style.pointerEvents = "none"; return; } } catch(e){} t.focus(); });
      t.addEventListener("change", function(){
        var v = t.value.trim();
        if (!v) { desc.set.call(inp, ""); inp.dispatchEvent(new Event("change", { bubbles: true })); return; }
        var iso = parseIL(v);
        if (!iso) { t.style.borderColor = "#B3261E"; t.title = "כדי לשמור, כתבו תאריך כמו 25.10.26"; return; }
        desc.set.call(inp, iso); sync(); inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true }));
      });
      sync();
    };
    var scanDates = function(){ [].forEach.call(document.querySelectorAll('input[type="date"]:not([data-il])'), dateIL); };
    var dPending = 0;
    document.addEventListener("DOMContentLoaded", function(){ scanDates(); try { new MutationObserver(function(){ if (dPending) return; dPending = setTimeout(function(){ dPending = 0; scanDates(); }, 0); }).observe(document.body, {childList: true, subtree: true}); } catch(e){} });
  } catch(e){}

  // המסך הנוכחי, יחסית ל-app/ (products/x.html לתוצרים).
  var parts = location.pathname.split("/");
  var file = (parts.pop() || "index.html").toLowerCase();
  if (!/\.html$/.test(file)) file += ".html"; // כתובות בלי סיומת (Netlify)
  var inProducts = parts[parts.length - 1] === "products";
  var page = (inProducts ? "products/" : "") + file;
  var base = inProducts ? "../" : "";

  var q = new URLSearchParams(home.split("?")[1] || "");
  var ALL_USERS = ["entry.html", "index.html", "sources-library.html", "examples.html"];
  var WORKSHOP = {
    // תוצרי הסימולציה (גרסת המתנסה/השחקנית/המנחה, כרטיס שחקנית) — רק למנהלת המערכת ולמנחות הסימולציה (02/10/2026).
    trainee: ["observation-sheet.html", "practice.html", "feedback.html",
              "conversation-planner.html", "activity-planner.html", "academic-review.html"],
    actor:   ["practice.html", "feedback.html",
              "conversation-planner.html", "activity-planner.html", "academic-review.html"],
    parent:  ["parent-input-screen.html", "practice.html", "feedback.html", "conversation-planner.html"],
    youth:   ["practice.html", "feedback.html", "conversation-planner.html"]
  };
  var TRACK_INPUT = { trainee: "input-screen.html", parent: "parent-input-screen.html", youth: "student-input-screen.html" };

  // כניסה בקוד (30/09/2026): הבית הוא home.html, והמסכים נגזרים מההרשאות
  // שהשרת החזיר לקוד (sbe.session.perms).
  var PAGES_BY_PERM = {
    fac_trainee: ["input-screen.html"], fac_parent: ["parent-input-screen.html"], fac_youth: ["student-input-screen.html"],
    conv: ["conversation-planner.html"], activity: ["activity-planner.html"], academic: ["academic-review.html"],
    resilience: ["resilience-team.html", "resilience-fill.html", "resilience-advisor.html", "resilience-advisor-sources.html"],
    leadership: ["leadership-advisor.html", "resilience-advisor-sources.html"],
    practi: ["resilience-advisor.html", "resilience-advisor-sources.html"],
    studio: ["resilience-studio.html"], // עד לאישור המקצועי — רק בהרשאה הזאת (studio.mjs: STUDIO_PERMS)
    journey: ["journey.html"],
    writer: ["message-writer.html", "resilience-advisor-sources.html"], // כתיבה מקדמת חוסן — רק בהרשאה הזאת (02/10/2026)
    nana: ["facilitation-advisor.html", "resilience-advisor-sources.html"] // ננה — מהוראה להנחיה (07/10/2026)
  };
  var SIM_DOCS = ["doc-trainee.html", "doc-actor.html", "card-actor.html", "doc-facilitator.html"];
  var FAC_PAGES = ["facilitator-screen.html", "feedback.html", "feedback-results.html", "search.html"].concat(SIM_DOCS);

  var allowed = null; // null = הכול
  if (home === "home.html") {
    var perms = [];
    try { perms = JSON.parse(ss("sbe.session.perms") || "[]") || []; } catch(e){}
    allowed = ["home.html"];
    perms.forEach(function(p){ (PAGES_BY_PERM[p] || []).forEach(function(x){ allowed.push(x); }); });
    if (perms.some(function(p){ return /^fac_/.test(p); })) allowed = allowed.concat(FAC_PAGES);
  } else if (home === "admin.html?role=sys") {
    allowed = null;
  } else if (home === "admin.html?role=inst") {
    allowed = ["admin.html"];
  } else if (/^system-select\.html/.test(home)) {
    var track = q.get("track");
    allowed = ["system-select.html", "search.html", "facilitator-screen.html",
               "feedback.html", "feedback-results.html"].concat(SIM_DOCS);
    if (TRACK_INPUT[track]) allowed.push(TRACK_INPUT[track]);
    else for (var t in TRACK_INPUT) allowed.push(TRACK_INPUT[t]);
    // הכלים הנוספים — רק מה שנפתח למוסד (sbe.session.modules, נשמר ב-system-select.html).
    var mods = {};
    try { mods = JSON.parse(ss("sbe.session.modules") || "{}") || {}; } catch(e){}
    if (mods.studio === true) allowed.push("resilience-studio.html");
    if (track !== "parent" && track !== "youth") {
      if (mods.conv === true) allowed.push("conversation-planner.html");
      if (mods.activity === true) allowed.push("activity-planner.html");
      if (mods.academic === true) allowed.push("academic-review.html");
    }
  } else if (/^entry\.html\?home=/.test(home)) {
    allowed = WORKSHOP[q.get("home")] || [];
  } else if (home === "academic-review.html") {
    allowed = ["academic-review.html"];
  } else if (home === "resilience-advisor.html") {
    // התנסות חברות.י הקהילה (זמני, להרצאה) — אורח/ת: רק פרקטי והמקורות שלה, עד 31.10.2026
    var COMMUNITY_OPEN = false; // סגור עד שמנהלת המערכת מבקשת לפתוח (יחד עם entry.html)
    allowed = COMMUNITY_OPEN && new Date() <= new Date("2026-10-31T23:59:59")
      ? ["resilience-advisor.html", "resilience-advisor-sources.html"] : [];
    if (!allowed.length) home = "";
  } else if (home === "resilience-team.html") {
    allowed = ["resilience-team.html", "resilience-fill.html"];
  } else {
    allowed = [];
    home = "";
  }

  // טופס המשוב מקישור/QR של סדנה (?w=) — פתוח גם בלי כניסה: המשתתפות סורקות בטלפון בסוף התחקיר.
  // השרת מקבל משוב רק לסדנה שנפתחה (wfSubmit), ולא חושף משובים של אחרים.
  // ספריית התוצרים לדוגמה — פתוחה לכל מי שמתעניין/ת, גם בלי כניסה (רק מה שמנהלת המערכת סימנה להצגה).
  if (page === "examples.html") return;
  if (page === "feedback.html" && /[?&]w=[a-z0-9]{8,32}(&|$)/.test(location.search)) return;
  // כניסה שהסתיימה (07/10/2026): האסימון החתום תקף 12 שעות, אבל לשונית פתוחה שומרת אותו גם אחר כך —
  // והשרת דוחה אותו ("אין הרשאה פעילה"). חוזרים למסך הכניסה עם הסבר, במקום הודעת הרשאה מבלבלת.
  if (ALL_USERS.indexOf(page) === -1) {
    try {
      var tk = ss("sbe.session.token") || "";
      if (tk.indexOf(".") > 0) {
        var raw = Uint8Array.from(atob(tk.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")), function(ch){ return ch.charCodeAt(0); });
        var pl = JSON.parse(new TextDecoder().decode(raw));
        if (pl.exp && pl.exp < Date.now()) {
          KEYS.forEach(function(k){ sessionStorage.removeItem(k); });
          localStorage.removeItem(MIRROR);
          document.documentElement.style.display = "none";
          location.replace(base + "entry.html?expired=1");
          return;
        }
      }
    } catch(e){}
  }
  if (allowed === null || (home && ALL_USERS.indexOf(page) !== -1) || allowed.indexOf(page) !== -1) return;

  // אין הרשאה — לא מציגים את הדף, וחוזרים למסך הבית (או למסך הכניסה).
  document.documentElement.style.display = "none";
  location.replace(base + (home || "entry.html"));
})();
