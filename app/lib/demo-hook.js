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
    // הכלי ומטרתו בראש התוצר (08/10/2026: "חייב להיות הקשר"), ושם קובץ ברור
    var D = window.SBE_DOC, t = D && D.toolInfo ? D.toolInfo() : null;
    var ctx = t ? '<div style="border-bottom:2px solid #2E5A7D;padding-bottom:8px;margin-bottom:14px;font-family:Assistant,Arial,sans-serif"><div style="font-size:13px;color:#2E5A7D"><b>' + t.name + '</b> · ' + t.purpose + '</div><div style="font-size:21px;font-weight:700;color:#141C24">' + String(title).replace(/</g, "&lt;") + '</div></div>' : '';
    return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<base href="' + base + '"><title>' + String(D && D.fileTitle ? D.fileTitle(title) : title + ' · Begood').replace(/</g, "&lt;") + '</title>' + links + "<style>" + css +
      "\nbody{padding:18px 16px 40px}html.sbe-sysonly,.sbe-sysonly{display:none!important}\n/* התוכן הועתק מתוך חלון (dialog), בלי גובה קבוע וגלילה פנימית, כדי שלא ייחתך במסמך וב-PDF */\nhtml,body{height:auto!important;overflow:visible!important}main,main *{max-height:none!important;overflow:visible!important}</style></head><body><main style=\"max-width:880px;margin:0 auto\">" + ctx +
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
    return r.files.map(function (f) { return { tool: tool, title: name + ": " + (f[2] || f[0]), label: label + " · " + (f[2] || ""), html: withBase(f[1]), input: inp }; });
  }
  async function dialogProduct(tool, title, label, trigger) {
    var inp = inputSummary();
    trigger();
    var body = await waitFor(function () {
      var b = openDialogBody(); if (!b) return null;
      var t = vis(b);
      if (/אין כרגע חיבור למודל|לא הופק|לא נבנה/.test(t) && t.length < 600) return { fail: t };
      return (t.length > 400 || dialogFrameHtml()) ? b : null; // תוצר בתוך מסגרת (רצף, דו״ח) — הטקסט שלו לא נספר ב-innerText
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
    "resilience-advisor.html": function () { return inPage("practi", "פרקטי: דוח לכיתה", "פרקטי", "#btn-example", "#btn-analyze", "#report h2", "#report"); },
    "leadership-advisor.html": function () { return inPage("nugi", "נוגי: דוח סיכום והמלצות", "נוגי", "#btn-example", "#btn-analyze", "#report h2", "#report"); },
    "facilitation-advisor.html": function () { return inPage("nana", "ננה: מדריך הנחיה", "ננה", "#btn-example", "#btn-go", "#guide-doc", "#guide-doc", "#guide"); },
    "team-lab.html": function () { return inPage("teamlab", "מעבדת צוות: סבב", "מעבדת צוות", "#example", "#go", "#out2 .card-move", "#out2", "#err1"); },
    "continuity-kit.html": function () { return inPage("continuity", "תיק רציפות", "תיק רציפות", "#example", "#go", "#kit .kit h2", "#kit", "#err1"); },
    "message-writer.html": function () { return inPage("writer", "כתיבה מקדמת חוסן: הודעה", "כתיבה מקדמת חוסן", "#rw-example", "#rw-go", "#rw-out .rw-new", "#rw-out", "#rw-err"); },
    "conversation-planner.html": function () { fillSample(); return dialogProduct("conv", "תכנון שיחה: התוצר", "תכנון שיחה", function () { click("#bBuild"); }); },
    "activity-planner.html": async function () {
      if (q.get("part") === "seq") {
        click("#mSeq"); await sleep(600); click("#sqLoadSample"); await sleep(1500);
        // שם היוצר/ת הוא שדה עיקרי — בלעדיו דו״ח הניתוח לא נשלח למודל
        var cf = Array.prototype.slice.call(document.querySelectorAll("#screen-seq .f[data-req]")).filter(function (x) { return /שם היוצר/.test(x.textContent); })[0];
        var ci = cf && cf.querySelector("input,textarea");
        if (ci && !ci.value.trim()) { var nm = ""; try { nm = sessionStorage.getItem("sbe.session.name") || ""; } catch (e) {} ci.value = nm || "מעבדת הדמו"; ci.dispatchEvent(new Event("input", { bubbles: true })); await sleep(300); }
        var a = await dialogProduct("act-seq", "תכנון פעילות: רצף מפגשים", "רצף מפגשים", function () { click("#bSeqBuild"); });
        await sleep(800);
        var b = await dialogProduct("act-seq", "תכנון פעילות: משוב ודו״ח ניתוח לרצף", "רצף מפגשים · משוב", function () { click("#bSeqReport"); });
        return a.concat(b);
      }
      fillSample();
      return dialogProduct("act-single", "תכנון פעילות: מפגש אחד", "מפגש אחד", function () { click("#bBuild"); });
    },
    "academic-review.html": async function () {
      setVal("creatorName", "נועה (סטודנטית לדוגמה)");
      setVal("i-age", "סטודנטים/ות");
      setVal("workText", DEMO_ESSAY);
      var k = [].find.call(document.querySelectorAll("#fbKind button"), function (b) { return /רך/.test(b.textContent); });
      if (k) k.click();
      await sleep(600);
      return dialogProduct("review", "משוב לעבודה: משוב רך", "משוב לעבודות", function () { click("#bReview"); });
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
        if (Date.now() - t1 > 30000) return { fail: "הסיכום לא התחיל: כנראה כיתת הדמו לא נטענה" };
        return null;
      }, 15 * 60e3, "סיכום החוסן");
      if (r.fail) throw new Error(r.fail.slice(0, 300));
      await sleep(800);
      return [{ tool: "resil", title: "מיפוי חוסן חברתי: סיכום והמלצות לכיתה", label: "מיפוי חוסן חברתי", html: standalone($("#summary-content"), "מיפוי חוסן חברתי: סיכום והמלצות"), input: inp }];
    },
    // סטודיו חוסן (07/10/2026): תקציר לדוגמה ← בדיקה והצעת מוקד ← אישור ← בניית הפעילות ← ערכת המנחה וחומרי המשתתפים כמסמכי הדפסה
    "resilience-studio.html": async function () {
      var busyOp = async function (sel, what) {
        click(sel); var t0 = Date.now(), seen = false;
        await waitFor(function () {
          if (document.body.classList.contains("busy")) { seen = true; return null; }
          return (seen || Date.now() - t0 > 5000) ? true : null;
        }, 20 * 60e3, what);
        var e = $("#studio-error"); if (e && !e.hidden && e.textContent.trim()) throw new Error(e.textContent.trim().slice(0, 300));
      };
      [["startingPoint", "כיתה ח׳ אחרי חופשה ארוכה: התלמידים חוזרים בקבוצות נפרדות, ויש מעט עזרה הדדית."],
       ["goal", "לחזק עזרה הדדית ותחושת אחריות משותפת בכיתה"], ["participants", "תלמידי כיתה ח׳"], ["participantAge", "13–14"],
       ["count", "24"], ["duration", "45"], ["sessions", "2"], ["format", "פעילות"], ["space", "כיתה רגילה, אפשר להזיז שולחנות"],
       ["materials", "דפים, טושים, לוח"], ["context", "בית ספר, בשעת חינוך"], ["language", "עברית"]].forEach(function (x) { setVal(x[0], x[1]); });
      var inp = inputSummary($("#brief-form"));
      await busyOp("#to-build", "בדיקת התקציר");
      var f = $("#focus"); if (f && !f.value) { var o = [].find.call(f.options, function (x) { return x.value; }); if (o) setVal("focus", o.value); }
      var cp = $("#clarification-panel"); if (cp && !cp.hidden) setVal("clarifications", "אין הבהרות נוספות: אפשר להמשיך לפי התקציר.");
      var bc = $("#brief-confirmed"); if (bc && !bc.checked) { bc.disabled = false; bc.checked = true; bc.dispatchEvent(new Event("change", { bubbles: true })); }
      await busyOp("#generate-activity", "בניית הפעילות");
      if ($("#activity-section").hidden) throw new Error("הפעילות לא נבנתה");
      var printed = async function (sel, title, label) {
        await busyOp(sel, title);
        var fr = await waitFor(function () { var d = $("dialog[open] iframe"); return d && d.contentDocument && d.contentDocument.body && String(d.contentDocument.body.innerText || "").trim().length > 150 ? d : null; }, 60e3, title);
        var html = "<!doctype html>" + fr.contentDocument.documentElement.outerHTML;
        var dlg = fr.closest("dialog"); if (dlg) dlg.close();
        await sleep(600);
        return { tool: "studio", title: title, label: label, html: withBase(html), input: inp };
      };
      var kit = await printed("#print-kit", "סטודיו חוסן: ערכת המנחה", "סטודיו חוסן · ערכת המנחה");
      var part = await printed("#print-participant", "סטודיו חוסן: חומרי המשתתפים", "סטודיו חוסן · חומרי המשתתפים");
      return [kit, part];
    },
    // מסע אל החוסן (07/10/2026): מסע דמו (בלי מיילים, לא נספר בדוחות ובמחקר) ← מיפוי לדוגמה ← הצעת מסע ← בחירות ← טיוטת אבני הדרך
    "journey.html": async function () {
      var J = window.SBE_JOURNEY, tok = ""; try { tok = sessionStorage.getItem("sbe.session.token") || ""; } catch (e) {}
      var api = async function (action, b) {
        var r = await fetch("https://sbe-server.onrender.com/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ action: action, token: tok }, b)) });
        return r.json().catch(function () { return {}; });
      };
      var unit = (J.UNITS.find(function (u) { return /בית ספר/.test(u.t); }) || J.UNITS[0]);
      var made = await api("jrCreate", { unit: unit.k, unitName: "בית ספר הדר (מסע לדוגמה)", by: "מעבדת הדמו", demo: true });
      if (!made.id) throw new Error("לא נוצר מסע דמו");
      location.hash = made.id;
      var btnByText = function (re) { return [].find.call(document.querySelectorAll("#app button"), function (b) { return re.test(b.textContent); }); };
      await waitFor(function () { return btnByText(/לקבלת הצעת מסע/); }, 60e3, "המיפוי");
      [].forEach.call(document.querySelectorAll("#app select"), function (sel, i) { var n = sel.options.length; if (n > 1) { sel.selectedIndex = 1 + (i * 7) % (n - 1); sel.dispatchEvent(new Event("change", { bubbles: true })); } });
      var notes = document.querySelector("#app textarea"); if (notes) { notes.value = "בית ספר יסודי, אחרי תקופה של שיבושים. הצוות מחויב אבל עייף; יש מועצת תלמידים פעילה וקשר טוב עם המתנ\"ס."; notes.dispatchEvent(new Event("input", { bubbles: true })); }
      var inp = "בית ספר יסודי (מסע לדוגמה) · מיפוי מגוון בחמשת האשכולות ובנקודות השבירה · " + notes.value;
      await sleep(900);
      var errText = function () { var e = [].find.call(document.querySelectorAll("#app .err"), function (x) { return !x.hidden && x.textContent.trim(); }); return e ? e.textContent.trim() : ""; };
      btnByText(/לקבלת הצעת מסע/).click();
      var r1 = await waitFor(function () { var h = [].find.call(document.querySelectorAll("#app h2"), function (x) { return /הצעת המסע שלכם/.test(x.textContent); }); return h || (errText() && { fail: errText() }); }, 15 * 60e3, "הצעת המסע");
      if (r1.fail) throw new Error(r1.fail);
      await sleep(600);
      var wrap = document.createElement("div");
      [].forEach.call(document.querySelectorAll("#app .card"), function (c) { var h = c.querySelector("h2"); if (h && /הצעת המסע שלכם|ההחלטות שלכם/.test(h.textContent)) wrap.appendChild(c.cloneNode(true)); });
      var items = [{ tool: "journey", title: "מסע אל החוסן: הצעת המסע", label: "מסע אל החוסן · הצעה", html: standalone(wrap, "מסע אל החוסן: הצעת המסע"), input: inp }];
      // בחירות לדוגמה: האפשרות הראשונה בכל החלטה, סיבה אחת והסבר קצר
      [].forEach.call(document.querySelectorAll("#app .dec"), function (box) {
        var r = box.querySelector("input[type=radio]"); if (r) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); }
        var c = box.querySelector(".chips input[type=checkbox]"); if (c) { c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); }
        var t = box.querySelector("textarea"); if (t) { t.value = "זו האפשרות שמתאימה לקצב של הצוות כרגע, ומשאירה מקום לתלמידים להוביל."; t.dispatchEvent(new Event("input", { bubbles: true })); }
      });
      await sleep(500);
      btnByText(/שליחת הבחירות/).click();
      var r2 = await waitFor(function () { var h = [].find.call(document.querySelectorAll("#app h2"), function (x) { return /אצל ד״ר יעל שדה/.test(x.textContent); }); return h || (errText() && { fail: errText() }); }, 15 * 60e3, "אבני הדרך");
      if (r2.fail) throw new Error(r2.fail);
      var jd = await api("jrGet", { id: made.id }), ms = ((jd.journey || {}).plan || {}).milestones || [];
      if (ms.length) {
        var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
        var stT = function (n) { var st = (J.STAGES || []).find(function (x) { return x.n === n || x.k === n; }); return st ? st.t : String(n); };
        var clT = function (k) { var c = (J.CLUSTERS || []).find(function (x) { return x.k === k; }); return c ? c.t : String(k); };
        var rows = ms.map(function (m, i) {
          var goals = (m.goals || []).map(function (g) { return "<li><b>" + esc(clT(g.c)) + ":</b> " + esc(g.goal) + (g.measure ? " — <i>" + esc(g.measure) + "</i>" : "") + "</li>"; }).join("");
          return "<tr><td>" + (i + 1) + "</td><td><b>" + (m.gate ? "🚪 " : "") + esc(m.title) + "</b></td><td>" + esc(stT(m.stage)) + "</td><td><ul>" + goals + "</ul></td></tr>";
        }).join("");
        var t = document.createElement("div");
        t.innerHTML = "<h2>טיוטת אבני הדרך: " + ms.length + "</h2><table class=\"jr-plan\" style=\"width:100%;border-collapse:collapse\"><thead><tr><th>#</th><th>אבן הדרך</th><th>שלב</th><th>יעדים ואיך יודעים שהושגו</th></tr></thead><tbody>" + rows + "</tbody></table>" +
          "<style>.jr-plan th,.jr-plan td{border:1px solid #CDD3D8;padding:6px 8px;text-align:right;vertical-align:top}.jr-plan thead th{background:#2E5A7D;color:#fff}.jr-plan ul{margin:0;padding-inline-start:18px}.jr-plan tr{break-inside:avoid}</style>";
        items.push({ tool: "journey", title: "מסע אל החוסן: טיוטת אבני הדרך", label: "מסע אל החוסן · אבני דרך", html: standalone(t, "מסע אל החוסן: טיוטת אבני הדרך").replace("</main>", t.querySelector("style").outerHTML + "</main>"), input: inp });
      }
      return items;
    },
    // תרגול עצמי בסימולציה (07/10/2026): התרחיש הראשון ← ארבעה תורות של אשת החינוך ← סיום ← השיחה והמשוב
    "practice.html": async function () {
      var card = await waitFor(".scenario-card", 30e3, "רשימת התרחישים");
      var scName = (card.querySelector(".sc-name") || {}).textContent || "תרחיש";
      card.click(); await sleep(600); click("#bStart");
      await waitFor(function () { var s = $("#screen-chat"); return s && !s.hidden && $("#transcript").children.length ? true : null; }, 120e3, "פתיחת השיחה");
      var lines = ["שלום, תודה שבאת. חשוב לי לשמוע איך את/ה רואה את מה שקרה.",
        "אני שומעת שזה מטריד אותך. מה הכי חשוב לך שיקרה עכשיו?",
        "אני מציעה שנחשוב יחד על צעד ראשון קטן. מה דעתך?",
        "תודה ששיתפת. בוא/י נקבע לשוחח שוב בעוד שבוע ונראה מה השתנה."];
      for (var i = 0; i < lines.length; i++) {
        if ($("#screen-feedback") && !$("#screen-feedback").hidden) break;
        var before = $("#transcript").children.length;
        setVal("composerInput", lines[i]); click("#bSend");
        await waitFor(function () { var b = $("#bSend"); return (b && !b.disabled && $("#transcript").children.length >= before + 2) || ($("#screen-feedback") && !$("#screen-feedback").hidden) ? true : null; }, 5 * 60e3, "תשובת הדמות");
        await sleep(400);
      }
      if ($("#screen-feedback").hidden) { var be = $("#bEndChat"); be.disabled = false; be.click(); }
      await waitFor(function () { return !$("#screen-feedback").hidden ? true : null; }, 30e3, "המשוב");
      var wrap = document.createElement("div");
      var h1 = document.createElement("h2"); h1.textContent = "השיחה: " + scName; wrap.appendChild(h1); wrap.appendChild($("#transcript").cloneNode(true));
      var h2 = document.createElement("h2"); h2.textContent = "המשוב"; wrap.appendChild(h2); wrap.appendChild($("#screen-feedback").cloneNode(true));
      wrap.querySelectorAll("[hidden]").forEach(function (x) { x.removeAttribute("hidden"); });
      return [{ tool: "practice", title: "תרגול עצמי: " + scName, label: "תרגול עצמי בסימולציה", html: standalone(wrap, "תרגול עצמי: " + scName), input: "התרחיש: " + scName + "\nתורות אשת החינוך:\n" + lines.join("\n") }];
    },
    "input-screen.html": function () { return scenario("edu", "סימולציה: סטודנטים/ות"); },
    "parent-input-screen.html": function () { return scenario("parents", "סימולציה: הורים"); },
    "student-input-screen.html": function () { return scenario("youth", "סימולציה: נוער"); }
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
