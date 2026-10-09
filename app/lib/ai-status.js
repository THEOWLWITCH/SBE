// מצב החיבור למודל (06/10/2026) — בדיקה פעילה כשהמסך נפתח, במקום "בודקת חיבור למודל..." שנשאר
// עד הפנייה הראשונה. מוצג רק למנהלת המערכת (sbe-sysonly), עם הסבר מה כל מצב אומר ומתי אי אפשר לעבוד.
// אם המסך עצמו כבר עדכן את המצב (setAIStatus אחרי קריאה אמיתית) — לא דורסים.
(function () {
  "use strict";
  var SERVER = "https://sbe-server.onrender.com";
  function run() {
    var chip = document.getElementById("aiStatusChip");
    if (!chip) return;
    var host = chip.parentNode;
    var dot = '<span class="dot"></span> ';
    var mine = true, last = chip.className, lastHtml = chip.innerHTML;
    function set(cls, text) {
      if (!mine) return;
      // המסך עצמו כבר קבע מצב (setAIStatus אחרי קריאה אמיתית) — לא דורסים
      if (chip.className !== last || chip.innerHTML !== lastHtml) { mine = false; return; }
      chip.className = "ai-status sbe-sysonly " + cls; chip.innerHTML = dot + text;
      last = chip.className; lastHtml = chip.innerHTML;
    }
    // הסבר קצר — נפתח בלחיצה
    var det = document.createElement("details");
    det.style.cssText = "margin-top:6px;font-size:12.5px;line-height:1.6;color:inherit";
    det.innerHTML = '<summary style="cursor:pointer;font-weight:600">מה זה אומר?</summary>' +
      '<div style="margin-top:4px">' +
      '<b>המודל זמין</b>: אפשר לעבוד (מילוי הצעות, בנייה, משוב ודוחות).<br>' +
      '<b>בודקת / השרת מתעורר</b>: השרת של Begood "נרדם" כשלא משתמשים בו זמן מה, והפנייה הראשונה מעירה אותו (עד כדקה). בינתיים אפשר למלא את הטופס; רק הפקת תוצר מחכה לחיבור.<br>' +
      '<b>אין חיבור לשרת</b>: אי אפשר להפיק תוצרים עכשיו (משוב, בנייה, דוח). מה שמילאת נשמר. מנסים שוב בעוד דקה–שתיים; אם זה נמשך, לבדוק ב-Render שהשירות sbe-server פועל.<br>' +
      '<b>חסר מפתח למודל</b>: השרת פועל, אבל לא מוגדר בו מפתח (ANTHROPIC_API_KEY ב-Render), ולכן אי אפשר להפיק תוצרים עד שיוגדר.' +
      '</div>';
    host.appendChild(det);
    var t0 = Date.now();
    var tick = setInterval(function () {
      var s = Math.round((Date.now() - t0) / 1000);
      if (s >= 5) set("unknown", "בודקת חיבור למודל... " + s + " שניות: השרת מתעורר, עד כדקה");
    }, 1000);
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, 90000);
    fetch(SERVER + "/health", { signal: ctrl.signal, cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && d.hasKey) set("ok", "המודל זמין: אפשר לעבוד");
        else if (d && d.ok) set("mock", "השרת פועל, אבל חסר מפתח למודל. אי אפשר להפיק תוצרים");
        else set("mock", "אין חיבור לשרת: אי אפשר להפיק תוצרים כרגע");
      })
      .catch(function () { set("mock", "אין חיבור לשרת: אי אפשר להפיק תוצרים כרגע. נסי שוב בעוד דקה"); })
      .then(function () { clearInterval(tick); clearTimeout(to); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
