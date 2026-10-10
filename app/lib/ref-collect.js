// מקורות בסוף המסמך ולא בתוך הטקסט (08/10/2026: "זה מקשה על הקריאה").
// SBE_REFS.begin(src, link) — מתחילים לאסוף (src: בנק המקורות עם byKey; link: דף רשימת המקורות).
// SBE_REFS.strip(text)     — מסיר מהטקסט [מפתח] ו-(מפתח, מפתח), ושומר את המפתחות המוכרים.
// SBE_REFS.add(keys)       — מוסיף מפתחות (למשל "basis" של פעילות) בלי להציג אותם בטקסט.
// SBE_REFS.end(title)      — מחזיר סעיף "מקורות" (כותרת ורשימה ממוספרת), או null כשאין מקורות. מסיים את האיסוף.
// SBE_REFS.fold(sec, n)    — סעיף מקורות סגור (09/10/2026: "רשימת המקורות לא תהיה פתוחה... אני מניחה שרוב האנשים לא ירצו בה"):
//                            כפתור "📚 מקורות (n)" פותח וסוגר, וכפתור "צירוף המקורות לקובץ" קובע אם הם נכנסים להדפסה, ל-PDF ולשמירה.
//                            ברירת המחדל: סגור ולא מצורף. תאים עם .refs-cell (למשל מקורות לכל מפגש) הולכים לפי אותה בחירה.
(function () {
  "use strict";
  var cur = null, SRC = null, LINK = "";
  var KEY = "[A-Za-z][A-Za-z]+[0-9]{4}[a-z]?";
  var BRACKET = new RegExp("\\s*\\[(" + KEY + ")\\]", "g");
  var PAREN = new RegExp("\\s*\\(((?:" + KEY + ")(?:\\s*[,;]\\s*(?:" + KEY + "))*)\\)", "g");
  function known(k) { return SRC && SRC.byKey && SRC.byKey[k]; }
  function add(keys) { (Array.isArray(keys) ? keys : [keys]).forEach(function (k) { k = String(k || "").trim(); if (cur && known(k) && cur.indexOf(k) === -1) cur.push(k); }); }
  function strip(text) {
    var t = String(text == null ? "" : text);
    t = t.replace(BRACKET, function (m, k) { add(k); return ""; });
    t = t.replace(PAREN, function (m, ks) { add(ks.split(/[,;]/)); return ""; });
    return t.replace(/[ \t]+([.,:;!?])/g, "$1").replace(/[ \t]{2,}/g, " ");
  }
  function begin(src, link) { SRC = src || SRC; LINK = link || LINK; cur = []; }
  function end(title) {
    var ks = cur || []; cur = null;
    if (!ks.length) return null;
    var sec = document.createElement("section"); sec.className = "sbe-refs";
    var h = document.createElement("h3"); h.textContent = title || "מקורות"; sec.appendChild(h);
    var ol = document.createElement("ol");
    ks.forEach(function (k) {
      var s = SRC.byKey[k], li = document.createElement("li");
      if (s.hidden) li.textContent = "שדה, י׳. חומר של Begood שטרם פורסם.";
      else {
        li.appendChild(document.createTextNode(s.apa || k));
        if (LINK) { var a = document.createElement("a"); a.href = LINK + (LINK.indexOf("#") === -1 ? "#" + k : ""); a.target = "_blank"; a.rel = "noopener"; a.textContent = " ↗"; a.className = "no-print"; a.setAttribute("aria-label", "פרטי המקור"); li.appendChild(a); }
      }
      ol.appendChild(li);
    });
    sec.appendChild(ol);
    return fold(sec, ks.length);
  }
  function fold(sec, n) {
    if (!sec || sec.querySelector(":scope > .refs-bar")) return sec;
    sec.classList.add("sbe-refs");
    var body = document.createElement("div"); body.className = "refs-body";
    while (sec.firstChild) body.appendChild(sec.firstChild);
    var bar = document.createElement("div"); bar.className = "refs-bar no-print";
    var open = document.createElement("button"), attach = document.createElement("button");
    open.type = attach.type = "button"; open.className = "refs-open"; attach.className = "refs-attach";
    open.setAttribute("aria-expanded", "false");
    var root = function () { return sec.closest("article,.docview,.dlg-b,#report,.sbe-doc-root") || sec.parentElement; };
    function draw() {
      var o = sec.classList.contains("open"), a = sec.classList.contains("attach");
      open.textContent = "📚 מקורות" + (n ? " (" + n + ")" : "") + (o ? " · הסתרה" : " · הצגה");
      open.setAttribute("aria-expanded", o ? "true" : "false");
      attach.textContent = a ? "✓ המקורות יצורפו לקובץ · ביטול" : "צירוף המקורות לקובץ";
      attach.setAttribute("aria-pressed", a ? "true" : "false");
      var r = root(); if (r) { r.classList.add("has-refs"); r.classList.toggle("refs-shown", o); r.classList.toggle("refs-attached", a); }
    }
    open.addEventListener("click", function () { sec.classList.toggle("open"); draw(); });
    attach.addEventListener("click", function () { sec.classList.toggle("attach"); draw(); });
    bar.appendChild(open); bar.appendChild(attach);
    sec.appendChild(bar); sec.appendChild(body);
    // הכיתוב קבוע בתוך הכפתורים; הצביעה מחדש כשהסעיף כבר בעמוד
    draw(); setTimeout(draw, 0);
    return sec;
  }
  // לפני הדפסה בחלון נפרד (SBE_DOC.print): מסירים מקורות שלא בחרו לצרף, ומשאירים רשימה נקייה במקורות שבחרו לצרף.
  function forPrint(root) {
    if (!root || !root.querySelectorAll) return root;
    var attached = !!root.querySelector(".sbe-refs.attach") || root.classList && root.classList.contains("refs-attached");
    root.querySelectorAll(".sbe-refs").forEach(function (sec) {
      if (!sec.classList.contains("attach")) { sec.remove(); return; }
      var bar = sec.querySelector(":scope > .refs-bar"); if (bar) bar.remove();
      var b = sec.querySelector(":scope > .refs-body"); if (b) { while (b.firstChild) sec.appendChild(b.firstChild); b.remove(); }
    });
    if (root.querySelector(".has-refs, .refs-cell") || (root.classList && root.classList.contains("has-refs")))
      if (!attached) root.querySelectorAll(".refs-cell").forEach(function (c) { c.remove(); });
    return root;
  }
  if (!document.getElementById("sbe-refs-style")) {
    var st = document.createElement("style"); st.id = "sbe-refs-style";
    st.textContent = ".sbe-refs{margin-top:1.4rem;padding-top:.8rem;border-top:1px solid var(--hair,#CDD3D8)}.sbe-refs h3{font-size:1rem;margin:0 0 .4rem}" +
      ".refs-bar{display:flex;flex-wrap:wrap;gap:8px}.refs-bar button{font:inherit;font-size:.88rem;font-weight:600;padding:5px 12px;border-radius:99px;border:1px solid var(--hair,#CDD3D8);background:transparent;color:var(--spoken,#2E5A7D);cursor:pointer}" +
      ".refs-bar .refs-attach[aria-pressed=true]{border-color:var(--spoken,#2E5A7D);background:rgba(46,90,125,.1)}" +
      ".sbe-refs:not(.open)>.refs-body{display:none}.sbe-refs.open>.refs-body{margin-top:.6rem}" +
      ".has-refs:not(.refs-shown) .refs-cell{display:none}" +
      "@media print{.sbe-refs:not(.attach){display:none!important}.sbe-refs.attach>.refs-body{display:block!important}.refs-bar{display:none!important}" +
      ".has-refs .refs-cell{display:none!important}.has-refs.refs-attached .refs-cell{display:table-cell!important}}" +
      ".sbe-refs ol{margin:0;padding-inline-start:1.3rem;font-size:.85rem;line-height:1.55;color:var(--muted,#5C6771)}.sbe-refs li{margin-bottom:.3rem}.sbe-refs a{text-decoration:none}";
    (document.head || document.documentElement).appendChild(st);
  }
  window.SBE_REFS = { begin: begin, strip: strip, add: add, end: end, fold: fold, forPrint: forPrint };
})();
