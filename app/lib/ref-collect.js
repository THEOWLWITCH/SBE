// מקורות בסוף המסמך ולא בתוך הטקסט (08/10/2026: "זה מקשה על הקריאה").
// SBE_REFS.begin(src, link) — מתחילים לאסוף (src: בנק המקורות עם byKey; link: דף רשימת המקורות).
// SBE_REFS.strip(text)     — מסיר מהטקסט [מפתח] ו-(מפתח, מפתח), ושומר את המפתחות המוכרים.
// SBE_REFS.add(keys)       — מוסיף מפתחות (למשל "basis" של פעילות) בלי להציג אותם בטקסט.
// SBE_REFS.end(title)      — מחזיר סעיף "מקורות" (כותרת ורשימה ממוספרת), או null כשאין מקורות. מסיים את האיסוף.
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
    return sec;
  }
  if (!document.getElementById("sbe-refs-style")) {
    var st = document.createElement("style"); st.id = "sbe-refs-style";
    st.textContent = ".sbe-refs{margin-top:1.4rem;padding-top:.8rem;border-top:1px solid var(--hair,#CDD3D8)}.sbe-refs h3{font-size:1rem;margin:0 0 .4rem}" +
      ".sbe-refs ol{margin:0;padding-inline-start:1.3rem;font-size:.85rem;line-height:1.55;color:var(--muted,#5C6771)}.sbe-refs li{margin-bottom:.3rem}.sbe-refs a{text-decoration:none}";
    (document.head || document.documentElement).appendChild(st);
  }
  window.SBE_REFS = { begin: begin, strip: strip, add: add, end: end };
})();
