// קריאה למודל ברקע (06/10/2026) — לכלים שקוראים ל-/api/complete ישירות (תכנון פעילות, תכנון שיחה).
// בקשה אחת ארוכה (עד 7 דקות) נקטעה בדרך, ומנות שלמות של רצף מפגשים לא חזרו. עכשיו: מתחילים עבודה
// בשרת (async:true ← jobId), ושואלים על המצב כל כמה שניות ב-/api/pipeline-status. שרת ישן — הבקשה הרגילה.
// השרת הופעל מחדש באמצע — מתחילים שוב פעם אחת.
(function () {
  "use strict";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function post(url, body, ms) {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch (e) { throw new Error("החיבור לשרת נקטע באמצע (" + res.status + ")"); }
      return { ok: res.ok, status: res.status, data };
    } finally { clearTimeout(timer); }
  }
  async function sbeCallAI(server, body, timeoutMs, retried) {
    const s = await post(server + "/api/complete", Object.assign({}, body, { async: true }), 90000);
    if (!s.ok || s.data.error) throw new Error(s.data.error || ("שגיאת שרת " + s.status));
    if (!s.data.jobId) { if (typeof s.data.text === "string") return s.data.text; throw new Error("המודל לא החזיר תשובה"); }
    const t0 = Date.now(), limit = (timeoutMs || 60000) + 120000; let misses = 0;
    while (Date.now() - t0 < limit) {
      await sleep(document.hidden ? 8000 : 3000);
      let d;
      try { const r = await post(server + "/api/pipeline-status", { jobId: s.data.jobId }, 30000); if (!r.ok) throw new Error("status " + r.status); d = r.data; misses = 0; }
      catch (e) { if (++misses >= 20) throw new Error("החיבור לשרת נקטע לזמן ארוך"); continue; }
      if (d.status === "done" && typeof d.text === "string") return d.text;
      if (d.status === "error") throw new Error(d.error || "הקריאה למודל נכשלה");
      if (d.status === "lost" || d.status === "unknown") {
        if (!retried) return sbeCallAI(server, body, timeoutMs, true);
        throw new Error("השרת הופעל מחדש באמצע");
      }
    }
    throw new Error("timeout: הקריאה למודל נמשכה יותר מדי");
  }
  window.sbeCallAI = sbeCallAI;
  // תוצר במבנה JSON (09/10/2026: "לוודא שלא תחזור תקלה כזאת בכלים אחרים"): כשהתשובה לא נקראת או חסרים בה
  // חלקים (check), מבקשים פעם אחת נוספת עם הערה למודל, ורק אז מציגים שגיאה (code: 'incomplete').
  function parseLoose(t) {
    const x = String(t || "").trim();
    try { return JSON.parse(x); } catch (e) {}
    const m = x.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
  }
  async function sbeCallAIJson(server, body, timeoutMs, check) {
    const ok = (v) => v && typeof v === "object" && (!check || check(v));
    let v = parseLoose(await sbeCallAI(server, body, timeoutMs));
    if (ok(v)) return v;
    const again = Object.assign({}, body, { system: String(body.system || "") + "\n\nהתשובה הקודמת לא הגיעה במבנה המלא שביקשתי (JSON חסר, חלקי או לא תקין). החזירי עכשיו רק JSON תקין ומלא, בדיוק במבנה שביקשתי." });
    delete again.requestId;
    v = parseLoose(await sbeCallAI(server, again, timeoutMs));
    if (ok(v)) return v;
    throw Object.assign(new Error("התוצר חזר חלקי"), { code: "incomplete" });
  }
  window.sbeCallAIJson = sbeCallAIJson;
  window.sbeParseJSON = parseLoose;
})();
