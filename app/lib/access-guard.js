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
              "sbe.session.perms", "sbe.session.info"];
  var MIRROR = "sbe.session.mirror", HOURS = 12;

  function ss(k){ try { return sessionStorage.getItem(k); } catch(e){ return null; } }

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

  var home = ss("sbe.session.homeUrl") || "";

  // המסך הנוכחי, יחסית ל-app/ (products/x.html לתוצרים).
  var parts = location.pathname.split("/");
  var file = (parts.pop() || "index.html").toLowerCase();
  if (!/\.html$/.test(file)) file += ".html"; // כתובות בלי סיומת (Netlify)
  var inProducts = parts[parts.length - 1] === "products";
  var page = (inProducts ? "products/" : "") + file;
  var base = inProducts ? "../" : "";

  var q = new URLSearchParams(home.split("?")[1] || "");
  var ALL_USERS = ["entry.html", "index.html", "sources-library.html"];
  var WORKSHOP = {
    trainee: ["doc-trainee.html", "observation-sheet.html", "practice.html", "feedback.html",
              "conversation-planner.html", "activity-planner.html", "academic-review.html"],
    actor:   ["card-actor.html", "practice.html", "feedback.html",
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
    resilience: ["resilience-team.html", "resilience-fill.html", "resilience-advisor.html", "resilience-advisor-sources.html"]
  };
  var FAC_PAGES = ["facilitator-screen.html", "feedback.html", "feedback-results.html", "search.html", "doc-trainee.html"];

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
    allowed = ["admin.html", "doc-facilitator.html"];
  } else if (/^system-select\.html/.test(home)) {
    var track = q.get("track");
    allowed = ["system-select.html", "search.html", "doc-trainee.html", "facilitator-screen.html",
               "feedback.html", "feedback-results.html"];
    if (TRACK_INPUT[track]) allowed.push(TRACK_INPUT[track]);
    else for (var t in TRACK_INPUT) allowed.push(TRACK_INPUT[t]);
    // הכלים הנוספים — רק מה שנפתח למוסד (sbe.session.modules, נשמר ב-system-select.html).
    var mods = {};
    try { mods = JSON.parse(ss("sbe.session.modules") || "{}") || {}; } catch(e){}
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
    allowed = new Date() <= new Date("2026-10-31T23:59:59")
      ? ["resilience-advisor.html", "resilience-advisor-sources.html"] : [];
    if (!allowed.length) home = "";
  } else if (home === "resilience-team.html") {
    allowed = ["resilience-team.html", "resilience-fill.html"];
  } else {
    allowed = [];
    home = "";
  }

  if (allowed === null || (home && ALL_USERS.indexOf(page) !== -1) || allowed.indexOf(page) !== -1) return;

  // אין הרשאה — לא מציגים את הדף, וחוזרים למסך הבית (או למסך הכניסה).
  document.documentElement.style.display = "none";
  location.replace(base + (home || "entry.html"));
})();
