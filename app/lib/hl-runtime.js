// מעבדת האופק (28/10/2026): החיבור של תשעת הכלים למערכת Begood.
// הכלים נכתבו מול window.claude.use(name). כאן אותו ממשק, על התשתית של Begood:
//   sample    → sbeCallAI / sbeParseJSON (ai-call.js) מול /api/complete בשרת. access-guard.js מוסיף את _auth,
//               והשרת מוסיף לכל קריאה את כללי השפה של Begood (invite-language.js).
//   db        → שמירה במכשיר בלבד, לפי משתמש/ת (sbeUserKey), כמו בשאר הכלים ("Begood לא בונה אחסון משותף משלה
//               בשרת"). שתי לשוניות באותו דפדפן מתעדכנות זו מזו. שיתוף בין מכשירים: עדיין לא, עד החלטה.
//   user      → מי שנכנס/ה הוא/היא הבעלים של העבודה שבמכשיר.
//   downloads → הורדה רגילה מהדפדפן.
// נטען ב-<head>, אחרי access-guard.js ו-ai-call.js, ולפני הסקריפט של הכלי.
(function () {
  "use strict";
  var AI_SERVER = "https://sbe-server.onrender.com";
  var err = function (code, message, text) { var e = new Error(message || code); e.code = code; if (text !== undefined) e.text = text; return e; };

  /* ---------- sample ---------- */
  function blobToPart(b) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result); res({ type: "image", source: { type: "base64", media_type: b.type || "image/jpeg", data: s.slice(s.indexOf(",") + 1) } }); };
      r.onerror = rej; r.readAsDataURL(b);
    });
  }
  async function callAI(input, opts) {
    opts = opts || {};
    if (typeof window.sbeCallAI !== "function") throw err("not_granted", "ai-call.js missing");
    var messages = typeof input === "string" ? [{ role: "user", content: input }] : input.map(function (m) { return { role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }; });
    if (opts.images && opts.images.length) {
      var parts = await Promise.all(opts.images.slice(0, 8).map(blobToPart));
      var last = messages[messages.length - 1];
      last.content = parts.concat([{ type: "text", text: String(last.content) }]);
    }
    var tier = opts.modelTier || "default";
    var body = { messages: messages, maxTokens: tier === "quick" || tier === "fast" ? 3000 : 9000, fast: tier !== "complex" };
    var text;
    try { text = await window.sbeCallAI(AI_SERVER, body, 240000); }
    catch (e) {
      if (opts.signal && opts.signal.aborted) throw err("cancelled", "cancelled");
      var m = String((e && e.message) || "");
      if (/401|403|היכנסו שוב|הכניסה הסתיימה/.test(m)) throw err("session_expired", m);
      if (/429|rate/i.test(m)) throw err("rate_limited", m);
      throw err("network", m);
    }
    if (opts.signal && opts.signal.aborted) throw err("cancelled", "cancelled");
    text = String(text || "");
    if (typeof opts.onText === "function") { try { opts.onText({ text: text, delta: text }); } catch (x) {} }
    return { text: text, truncated: false };
  }
  var sample = function (input, opts) { return callAI(input, opts); };
  sample.json = async function (input, opts) {
    var r = await callAI(input, opts);
    var v = window.sbeParseJSON ? window.sbeParseJSON(r.text) : null;
    if (v == null) { try { v = JSON.parse(String(r.text).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")); } catch (x) { v = null; } }
    if (v == null) throw err("invalid_json", "invalid_json", r.text);
    return v;
  };
  sample.limits = async function () { return { images: true }; };

  /* ---------- db: documents and collections, kept on this device ---------- */
  var NS = (window.sbeUserKey ? window.sbeUserKey("sbe.hl.db") : "sbe.hl.db") + ":";
  var LS = {
    get: function (k) { try { var v = localStorage.getItem(NS + k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(NS + k); } catch (e) {} },
    keys: function () { var out = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(NS) === 0) out.push(k.slice(NS.length)); } } catch (e) {} return out; }
  };
  var subs = new Set();
  function changed() { subs.forEach(function (f) { try { f(); } catch (e) {} }); }
  window.addEventListener("storage", function (e) { if (e.key && e.key.indexOf(NS) === 0) changed(); });
  var clone = function (v) { return v == null ? v : JSON.parse(JSON.stringify(v)); };
  var isDoc = function (p) { return String(p).split("/").length % 2 === 0; };
  function snapDoc(path) { var d = LS.get(path); return { id: path.split("/").pop(), exists: d != null, data: function () { return clone(d) || undefined; }, ref: { path: path } }; }
  function listColl(path, q) {
    var depth = path.split("/").length + 1, pre = path + "/";
    var docs = LS.keys().filter(function (k) { return k.indexOf(pre) === 0 && k.split("/").length === depth; }).map(function (k) { return { id: k.split("/").pop(), data: LS.get(k) }; }).filter(function (d) { return d.data != null; });
    (q.where || []).forEach(function (w) { docs = docs.filter(function (d) { var a = d.data[w[0]], v = w[2]; switch (w[1]) { case "==": return a == v; case "!=": return a != v; case "<": return a < v; case "<=": return a <= v; case ">": return a > v; case ">=": return a >= v; case "in": return Array.isArray(v) && v.indexOf(a) >= 0; default: return true; } }); });
    if (q.orderBy) docs.sort(function (a, b) { var x = a.data[q.orderBy], y = b.data[q.orderBy], c = x < y ? -1 : x > y ? 1 : 0; return q.dir === "desc" ? -c : c; });
    if (q.limit) docs = docs.slice(0, q.limit);
    return { empty: !docs.length, size: docs.length, docs: docs.map(function (d) { return { id: d.id, exists: true, data: function () { return clone(d.data); } }; }), forEach: function (f) { this.docs.forEach(f); } };
  }
  function watch(read, cb) {
    var last = null;
    var run = function () { var s = read(); var k = JSON.stringify(s.raw); if (k !== last) { last = k; cb(s.snap); } };
    setTimeout(run, 0); subs.add(run);
    return function () { subs.delete(run); };
  }
  function docRef(path) {
    if (!isDoc(path)) throw err("bad_path", path);
    return {
      path: path, id: path.split("/").pop(),
      get: async function () { return snapDoc(path); },
      set: async function (data) { if (!LS.set(path, data)) throw err("quota", "המקום לשמירה במכשיר התמלא"); changed(); },
      update: async function (data) { var old = LS.get(path) || {}; if (!LS.set(path, Object.assign(old, data))) throw err("quota", "המקום לשמירה במכשיר התמלא"); changed(); },
      delete: async function () { var pre = path + "/"; LS.keys().forEach(function (k) { if (k === path || k.indexOf(pre) === 0) LS.del(k); }); changed(); },
      onSnapshot: function (cb) { return watch(function () { return { raw: LS.get(path), snap: snapDoc(path) }; }, cb); },
      collection: function (name) { return collRef(path + "/" + name); }
    };
  }
  function collRef(path, q) {
    q = q || {};
    return {
      path: path,
      doc: function (id) { return docRef(path + "/" + (id || ("d" + Math.random().toString(36).slice(2, 12)))); },
      orderBy: function (f, dir) { return collRef(path, Object.assign({}, q, { orderBy: f, dir: dir || "asc" })); },
      limit: function (n) { return collRef(path, Object.assign({}, q, { limit: n })); },
      where: function (f, op, v) { return collRef(path, Object.assign({}, q, { where: (q.where || []).concat([[f, op, v]]) })); },
      get: async function () { return listColl(path, q); },
      add: async function (data) { var r = docRef(path + "/d" + Math.random().toString(36).slice(2, 12)); await r.set(data); return r; },
      onSnapshot: function (cb) { return watch(function () { var s = listColl(path, q); return { raw: s.docs.map(function (d) { return [d.id, d.data()]; }), snap: s }; }, cb); }
    };
  }
  var db = { doc: docRef, collection: function (p) { return collRef(p); } };

  /* ---------- user ---------- */
  var uid = (function () { try { var u = localStorage.getItem("sbe.hl.uid"); if (!u) { u = "u" + Math.random().toString(36).slice(2, 10); localStorage.setItem("sbe.hl.uid", u); } return u; } catch (e) { return "u0"; } })();
  var user = {
    isOwner: async function () { return true; }, canEdit: async function () { return true; },
    can: async function () { return true; }, id: async function () { return uid; },
    me: async function () { return { id: uid, name: "" }; },
    profiles: async function (ids) { var o = {}; (ids || []).forEach(function (i) { o[i] = { id: i, name: "" }; }); return o; },
    search: async function () { return []; }
  };

  /* ---------- downloads ---------- */
  var MIME = { html: "text/html", svg: "image/svg+xml", json: "application/json", txt: "text/plain", csv: "text/csv", md: "text/markdown" };
  var downloads = { save: async function (o) {
    var ext = String(o.filename || "").split(".").pop().toLowerCase();
    var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: (o.mimeType || MIME[ext] || "application/octet-stream") + ";charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = o.filename || "download"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return { ok: true };
  } };

  var caps = { sample: sample, db: db, user: user, downloads: downloads };
  window.claude = { use: async function (name) { return caps[name] || null; } };
})();
