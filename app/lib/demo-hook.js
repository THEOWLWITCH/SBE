// מעבדת הדמו (07/10/2026) — "מתכון" לכל כלי: טוען את הדוגמה של הכלי, מפיק מול המודל האמיתי,
// ושולח את התוצר (כמסמך HTML עצמאי) למסך demo-lab.html שפתח את הכלי במסגרת (iframe).
// פועל רק כשהכתובת כוללת ?demolab=1, הכלי נפתח בתוך מעבדת הדמו, והכניסה היא של מנהלת המערכת.
// בכל מצב אחר הקובץ לא עושה דבר.
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  if (q.get("demolab") !== "1" || window.parent === window) return;
  var sys = false;
  try { sys = sessionStorage.getItem("sbe.session.homeUrl") === "admin.html?role=sys"; } catch (e) {}
  if (!sys) return;
  window.confirm = function () { return true; };
  window.alert = function () {};

  var page = (location.pathname.split("/").pop() || "").toLowerCase();
  var $ = function (s) { return document.querySelector(s); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function post(msg) { msg.sbeDemo = true; msg.page = page; try { window.parent.postMessage(msg, location.origin); } catch (e) {} }
  async function waitFor(test, ms, what) {
    var t0 = Date.now();
    while (Date.now() - t0 < ms) {
      var r = null; try { r = typeof test === "string" ? $(test) : test(); } catch (e) {}
      if (r) return r;
      await sleep(1500);
    }
    throw new Error("הזמן עבר בהמתנה ל" + (what || "תוצר"));
  }
  function click(sel) { var b = typeof sel === "string" ? $(sel) : sel; if (!b) throw new Error("לא נמצא " + sel); b.disabled = false; b.click(); }
  function setVal(id, v) {
    var n = document.getElementById(id); if (!n) return;
    if (n.tagName === "SELECT" && v && ![].some.call(n.options, function (o) { return o.value === v; })) { var o = document.createElement("option"); o.value = o.textContent = v; n.appendChild(o); }
    n.value = v; n.dispatchEvent(new Event("input", { bubbles: true })); n.dispatchEvent(new Event("change", { bubbles: true }));
  }
  // מילוי הטופס מתוך דוגמת הכלי (SAMPLE — אותם שדות i-<מפתח> שהמודל ממלא ב"מילוי הצעות")
  function fillSample() {
    var S = null; try { S = SAMPLE; } catch (e) {} // eslint-disable-line no-undef
    if (!S) throw new Error("אין דוגמה בכלי הזה");
    Object.keys(S).forEach(function (k) { if (typeof S[k] === "string") setVal("i-" + k, S[k]); });
    try { if (typeof refresh === "function") refresh(); } catch (e) {} // eslint-disable-line no-undef
  }
  // סיכום הקלט — מוצג ליד התוצר בספרייה
  function inputSummary(root) {
    var out = [];
    (root || document).querySelectorAll("input[type=text],input[type=number],input:not([type]),textarea,select").forEach(function (n) {
      if (n.closest("dialog") || n.type === "hidden" || n.type === "file") return;
      var v = (n.value || "").trim(); if (!v || v.length < 2) return;
      var lab = "";
      if (n.id) { var l = document.querySelector('label[for="' + n.id + '"]'); if (l) lab = l.textContent; }
      if (!lab && n.closest("label")) lab = n.closest("label").childNodes[0] && n.closest("label").childNodes[0].textContent;
      if (!lab && n.closest(".f")) { var l2 = n.closest(".f").querySelector("label"); if (l2) lab = l2.textContent; }
      lab = (lab || n.placeholder || n.id || "").replace(/\s+/g, " ").replace(/·.*$/, "").trim().slice(0, 50);
      out.push((lab ? lab + ": " : "") + v.replace(/\s+/g, " ").slice(0, 160));
    });
    return out.slice(0, 18).join("\n").slice(0, 3000);
  }
  // מסמך HTML עצמאי מאזור בדף: עם הסגנונות של הכלי, בלי כפתורים, בלי עריכה ובלי סקריפטים
  function standalone(node, title) {
    var c = node.cloneNode(true);
    c.querySelectorAll("button,script,.sbe-edit-hint,.no-print,textarea,input,select,.actions,.toolbar").forEach(function (x) { x.remove(); });
    [c].concat([].slice.call(c.querySelectorAll("[contenteditable]"))).forEach(function (x) { x.removeAttribute("contenteditable"); });
    c.querySelectorAll("details").forEach(function (d) { d.setAttribute("open", ""); });
    var css = [].map.call(document.querySelectorAll("style"), function (s) { return s.textContent; }).join("\n");
    var links = [].map.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) { return '<link rel="stylesheet" href="' + l.href + '">'; }).join("");
    var base = location.href.replace(/[^/]*$/, "");
    return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<base href="' + base + '"><title>' + String(title).replace(/</g, "&lt;") + ' — Begood</title>' + links + "<style>" + css +
      "\nbody{padding:18px 16px 40px}html.sbe-sysonly,.sbe-sysonly{display:none!important}</style></head><body><main style=\"max-width:880px;margin:0 auto\">" +
      c.outerHTML + "</main></body></html>";
  }
  function withBase(html) {
    var base = location.href.replace(/[^/]*$/, "");
    return /<base\s/i.test(html) ? html : String(html).replace(/<head([^>]*)>/i, '<head$1><base href="' + base + '">');
  }
  function vis(n) { return n ? String(n.innerText || "").trim() : ""; }
  function openDialogBody() { var d = $("dialog[open]"); return d && (d.querySelector("#dlgB,.dlg-b,.body") || d); }
  function dialogFrameHtml() { var d = $("dialog[open]"); var f = d && d.querySelector("iframe"); return f && f.srcdoc && f.srcdoc.length > 500 ? f.srcdoc : null; }
  function closeDialog() { var d = $("dialog[open]"); if (d) d.close(); }

  // תרחישים (סטודנטים, הורים, נוער): narrative-build.js קורא לזה עם כל מסמכי התוצר
  var gotFiles = null;
  window.SBE_DEMO_FILES = function (files, scn) { gotFiles = { files: files, scn: scn }; };

  async function scenario(tool, label, input) {
    fillSample();
    var inp = inputSummary();
    click("#bBuild");
    var r = await waitFor(function () { return gotFiles || (openDialogBody() && /לא נבנה|לא הופק|אין כרגע חיבור/.test(vis($("dialog[open]"))) && { fail: true }); }, 40 * 60e3, "בניית התרחיש");
    if (r.fail) throw new Error(vis(openDialogBody()).slice(0, 300) || "התרחיש לא נבנה");
    var name = (r.scn && r.scn.name) || label;
    return r.files.map(function (f) { return { tool: tool, title: name + " — " + (f[2] || f[0]), label: label + " · " + (f[2] || ""), html: withBase(f[1]), input: inp }; });
  }
  async function dialogProduct(tool, title, label, trigger) {
    var inp = inputSummary();
    trigger();
    var body = await waitFor(function () {
      var b = openDialogBody(); if (!b) return null;
      var t = vis(b);
      if (/אין כרגע חיבור למודל|לא הופק|לא נבנה/.test(t) && t.length < 600) return { fail: t };
      return t.length > 400 ? b : null;
    }, 15 * 60e3, title);
    if (body.fail) throw new Error(body.fail.trim().slice(0, 300));
    var html = dialogFrameHtml() ? withBase(dialogFrameHtml()) : standalone(body, title);
    closeDialog();
    return [{ tool: tool, title: title, label: label, html: html, input: inp }];
  }
  // הפקה בתוך הדף: טוענים את הדוגמה של הכלי, מנקים תוצר קודם, ומחכים לתוצר — או לכפתור שחזר לפעול בלי תוצר (שגיאה)
  async function inPage(tool, title, label, example, go, ready, capture, area) {
    click(example); await sleep(1200);
    var inp = inputSummary();
    var cap = $(capture); if (cap) cap.textContent = "";
    var t0 = Date.now();
    click(go);
    var node = await waitFor(function () {
      var r = $(ready); if (r) return r;
      var b = $(go);
      if (b && !b.disabled && Date.now() - t0 > 4000) return { fail: vis($(area || capture)).slice(0, 300) || "התוצר לא הופק" };
      return null;
    }, 15 * 60e3, title);
    if (node.fail) throw new Error(node.fail);
    await sleep(800);
    return [{ tool: tool, title: title, label: label, html: standalone($(capture), title), input: inp }];
  }

  var RECIPES = {
    "resilience-advisor.html": function () { return inPage("practi", "פרקטי — דוח לכיתה", "פרקטי", "#btn-example", "#btn-analyze", "#report h2", "#report"); },
    "leadership-advisor.html": function () { return inPage("nugi", "נוגי — דוח סיכום והמלצות", "נוגי", "#btn-example", "#btn-analyze", "#report h2", "#report"); },
    "facilitation-advisor.html": function () { return inPage("nana", "ננה — מדריך הנחיה", "ננה", "#btn-example", "#btn-go", "#guide-doc", "#guide-doc", "#guide"); },
    "message-writer.html": function () { return inPage("writer", "כתיבה מקדמת חוסן — הודעה", "כתיבה מקדמת חוסן", "#rw-example", "#rw-go", "#rw-out .rw-new", "#rw-out", "#rw-err"); },
    "conversation-planner.html": function () { fillSample(); return dialogProduct("conv", "תכנון שיחה — התוצר", "תכנון שיחה", function () { click("#bBuild"); }); },
    "activity-planner.html": async function () {
      if (q.get("part") === "seq") {
        click("#mSeq"); await sleep(600); click("#sqLoadSample"); await sleep(1500);
        var a = await dialogProduct("act-seq", "תכנון פעילות — רצף מפגשים", "רצף מפגשים", function () { click("#bSeqBuild"); });
        await sleep(800);
        var b = await dialogProduct("act-seq", "תכנון פעילות — משוב ודו״ח ניתוח לרצף", "רצף מפגשים · משוב", function () { click("#bSeqReport"); });
        return a.concat(b);
      }
      fillSample();
      return dialogProduct("act-single", "תכנון פעילות — מפגש אחד", "מפגש אחד", function () { click("#bBuild"); });
    },
    "academic-review.html": async function () {
      setVal("creatorName", "נועה (סטודנטית לדוגמה)");
      setVal("i-age", "סטודנטים/ות");
      setVal("workText", DEMO_ESSAY);
      var k = [].find.call(document.querySelectorAll("#fbKind button"), function (b) { return /רך/.test(b.textContent); });
      if (k) k.click();
      await sleep(600);
      return dialogProduct("review", "משוב לעבודה — משוב רך", "משוב לעבודות", function () { click("#bReview"); });
    },
    "resilience-team.html": async function () {
      click("#btn-demo"); await sleep(1500);
            var tab = [].find.call(document.querySelectorAll("[data-tab],.tab,button"), function (b) { return /סיכום והמלצות/.test(b.textContent); }); if (tab) tab.click();
      await sleep(500);
      var inp = "כיתת הדמו של המערכת (אופק · ח׳1), עם תשובות לשאלון החוסן בשני סבבים.";
      click("#btn-sum-gen");
      // מצב ההפקה לפי הדף עצמו: הכפתור נעול בזמן ההפקה; בסיום — סיכום חדש, או הודעת שגיאה
      var t1 = Date.now(), seenBusy = false;
      var r = await waitFor(function () {
        var g = $("#btn-sum-gen"); if (!g) return null;
        if (g.disabled) { seenBusy = true; return null; }
        var box = $("#summary-content");
        var err = [].find.call(box.querySelectorAll("p"), function (p) { return /ההפקה לא הצליחה|לקחה יותר מדי זמן/.test(p.textContent); });
        if (seenBusy && err) return { fail: err.textContent };
        if (seenBusy) return true;
        if (Date.now() - t1 > 30000) return { fail: "הסיכום לא התחיל — כנראה כיתת הדמו לא נטענה" };
        return null;
      }, 15 * 60e3, "סיכום החוסן");
      if (r.fail) throw new Error(r.fail.slice(0, 300));
      await sleep(800);
      return [{ tool: "resil", title: "מיפוי חוסן — סיכום והמלצות לכיתה", label: "מיפוי חוסן", html: standalone($("#summary-content"), "מיפוי חוסן — סיכום והמלצות"), input: inp }];
    },
    "input-screen.html": function () { return scenario("edu", "סימולציה — סטודנטים/ות"); },
    "parent-input-screen.html": function () { return scenario("parents", "סימולציה — הורים"); },
    "student-input-screen.html": function () { return scenario("youth", "סימולציה — נוער"); }
  };

  // עבודה סמינריונית קצרה לדוגמה — קלט בלבד, לבדיקת המשוב (לא תוצר של המערכת)
  var DEMO_ESSAY = "מבוא\nבעבודה זו אבחן את הקשר בין תחושת שייכות של תלמידים בחטיבת הביניים לבין נכונותם לבקש עזרה מחברים ומהצוות. " +
    "השאלה עלתה בעקבות ההתנסות שלי בכיתה ח׳, שבה ראיתי תלמידים שמתקשים אבל לא פונים לאף אחד.\n\n" +
    "סקירת ספרות\nמחקרים רבים מראים ששייכות לבית הספר קשורה להישגים ולרווחה. תלמידים שמרגישים שייכים משתתפים יותר. " +
    "יש גם מחקרים על בקשת עזרה, אבל הם בעיקר על סטודנטים ולא על נוער. לכן חשוב לבדוק את זה בחטיבה.\n\n" +
    "שיטה\nהעברתי שאלון קצר ל-27 תלמידים בכיתה אחת, עם שאלות על שייכות ועל בקשת עזרה. בנוסף ראיינתי שלושה תלמידים.\n\n" +
    "ממצאים\nרוב התלמידים דיווחו על שייכות בינונית. מי שדיווחו על שייכות גבוהה אמרו יותר שהם מבקשים עזרה מחברים, אבל לא בהכרח מהצוות. " +
    "בראיונות אחד התלמידים אמר: \"אני לא רוצה שיחשבו שאני חלש\".\n\n" +
    "דיון\nנראה ששייכות עוזרת לבקש עזרה מחברים. הצוות צריך לעשות יותר כדי שתלמידים יפנו אליו. " +
    "המחקר קטן ולכן אי אפשר להכליל.\n\nסיכום\nשייכות חשובה ויש לחזק אותה בכל בית ספר.";

  var recipe = RECIPES[page];
  if (!recipe) return;
  function start() {
    setTimeout(async function () {
      post({ status: "running" });
      try { var items = await recipe(); post({ status: "done", items: items }); }
      catch (e) { post({ status: "error", message: String(e && e.message || e).slice(0, 400) }); }
    }, 2500);
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
