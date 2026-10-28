// מעבדת האופק (28/10/2026): החיבור של תשעת הכלים למערכת Begood.
// הכלים נכתבו מול window.claude.use(name). כאן אותו ממשק, על התשתית של Begood:
//   sample    → sbeCallAI / sbeParseJSON (ai-call.js) מול /api/complete בשרת. access-guard.js מוסיף את _auth,
//               והשרת מוסיף לכל קריאה את כללי השפה של Begood (invite-language.js).
//   db        → במכשיר, לפי משתמש/ת (sbeUserKey). בשלושה כלים (קול הקהילה, מחולל העתידים, תמונת עתיד קבוצתית)
//               אפשר לפתוח עבודה לשיתוף בין מכשירים: "חדר" בשרת (harness/lib/hl-rooms.mjs), עם קישור ו-QR.
//               המכשירים שואלים כל כמה שניות רק אם הגרסה השתנתה, ומקבלים רק את מה שהשתנה. החדר נמחק אחרי 30 יום.
//   user      → בעבודה במכשיר ובחדר שפתחת: בעלים. משתתף/ת שנכנס/ה בקישור: לא בעלים.
//   downloads → הורדה רגילה מהדפדפן.
// נטען ב-<head>, אחרי access-guard.js ו-ai-call.js, ולפני הסקריפט של הכלי.
(function () {
  "use strict";
  var AI_SERVER = (typeof window.sbeAIOrigin === "function" && window.sbeAIOrigin()) || "https://sbe-server.onrender.com";
  var ACCESS = AI_SERVER + "/api/access";
  var err = function (code, message, text) { var e = new Error(message || code); e.code = code; if (text !== undefined) e.text = text; return e; };
  var PAGE = (location.pathname.split("/").pop() || "").toLowerCase();
  // מה משותף בכל כלי: האוסף הראשי, שם המשתנה של העבודה הפתוחה בכלי, והשדה ב-config/active.
  var SHARE = {
    "hl-voice.html":   { root: "processes", v: "PID", f: "pid", what: "התהליך", verb: "להתראיין ולדרג", start: "interview" },
    "hl-futures.html": { root: "workshops", v: "WID", f: "wid", what: "הסדנה", verb: "להצביע ולמלא", start: "vote" },
    "hl-collage.html": { root: "collages",  v: "CID", f: "cid", what: "התמונה", verb: "להוסיף פריטים" }
  }[PAGE] || null;

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

  /* ---------- storage backends ---------- */
  var clone = function (v) { return v == null ? v : JSON.parse(JSON.stringify(v)); };
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  var NS = (window.sbeUserKey ? window.sbeUserKey("sbe.hl.db") : "sbe.hl.db") + ":";
  var LOCAL = {
    ready: Promise.resolve(),
    get: function (k) { try { var v = localStorage.getItem(NS + k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); return Promise.resolve(); } catch (e) { return Promise.reject(err("quota", "המקום לשמירה במכשיר התמלא")); } },
    del: function (k) { try { localStorage.removeItem(NS + k); } catch (e) {} return Promise.resolve(); },
    keys: function () { var out = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(NS) === 0) out.push(k.slice(NS.length)); } } catch (e) {} return out; }
  };
  var subs = new Set();
  function changed() { subs.forEach(function (f) { try { f(); } catch (e) {} }); }
  window.addEventListener("storage", function (e) { if (B === LOCAL && e.key && e.key.indexOf(NS) === 0) changed(); });

  // שיתוף: מזהה משתתף/ת במכשיר, והחדרים שפתחת (לפי משתמש/ת).
  var GUEST = lsGet("sbe.hl.g");
  if (!GUEST || !/^[a-z0-9]{6,24}$/.test(GUEST)) { GUEST = "g" + Math.random().toString(36).slice(2, 12); lsSet("sbe.hl.g", GUEST); }
  var ROOMKEY = (window.sbeUserKey ? window.sbeUserKey("sbe.hl.room") : "sbe.hl.room") + ":" + PAGE;
  var myRoom = function () { try { return JSON.parse(lsGet(ROOMKEY) || "null"); } catch (e) { return null; } };
  var urlRoom = (location.search.match(/[?&]room=([a-f0-9]{24})(?:&|$)/) || [])[1] || null;
  function api(action, data) {
    return fetch(ACCESS, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ action: action }, data)) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = err(r.status === 404 ? "closed" : r.status === 413 ? "quota_exceeded" : r.status === 403 ? "invalid_argument" : "network", j.error || String(r.status)); e.status = r.status; throw e; } return j; }); });
  }

  function Remote(room, key) {
    var mirror = new Map(), ver = -1, timer = null, stopped = false, owner = !!key, onGone = null, pending = Promise.resolve();
    var self = {
      room: room, key: key, exp: null, isRemote: true,
      get: function (k) { return mirror.has(k) ? clone(mirror.get(k)) : null; },
      keys: function () { return Array.from(mirror.keys()); },
      set: function (k, v) { mirror.set(k, clone(v)); changed(); return write([{ p: k, d: v }]); },
      del: function (k) { mirror.delete(k); changed(); return write([{ p: k, d: null }]); },
      stop: function () { stopped = true; clearTimeout(timer); },
      onGone: function (f) { onGone = f; },
      isOwner: function () { return owner; },
      flush: function () { return pending; },
      writeMany: function (ops) { return write(ops); }
    };
    // כתיבות נשלחות לפי הסדר, בחבילות של עד כ-1.4 מגה.
    function write(ops) {
      var batches = [], cur = [], sz = 0;
      ops.forEach(function (o) { var s = JSON.stringify(o).length; if (cur.length && (sz + s > 1400000 || cur.length >= 300)) { batches.push(cur); cur = []; sz = 0; } cur.push(o); sz += s; });
      if (cur.length) batches.push(cur);
      var run = pending.then(async function () {
        for (var i = 0; i < batches.length; i++) {
          var r = await api("hlWrite", { room: room, key: key || undefined, g: GUEST, ops: batches[i] });
          if (r.ver === ver + 1) ver = r.ver; // אם רק אנחנו כתבנו, אין מה למשוך
        }
      });
      pending = run.catch(function () {});
      run.catch(function () { poll(true); });
      return run;
    }
    async function poll(once) {
      if (stopped) return;
      try {
        var r = await api("hlPoll", { room: room, since: ver, key: key || undefined });
        self.exp = r.exp || self.exp;
        if (r.docs) {
          if (r.full) mirror.clear();
          r.docs.forEach(function (d) { if (d.del) mirror.delete(d.p); else mirror.set(d.p, d.d); });
          ver = r.ver; changed();
        } else ver = r.ver;
        if (typeof r.owner === "boolean") owner = owner || r.owner;
      } catch (e) {
        if (e.code === "closed") { stopped = true; if (onGone) onGone(); return; }
      }
      if (!once && !stopped) timer = setTimeout(function () { poll(false); }, document.hidden ? 15000 : 3000);
    }
    self.ready = poll(true).then(function () { if (!stopped) timer = setTimeout(function () { poll(false); }, 3000); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden && !stopped) { clearTimeout(timer); poll(false); } });
    return self;
  }

  var B = LOCAL, GUEST_MODE = false;
  if (SHARE && urlRoom) {
    var mine = myRoom();
    B = Remote(urlRoom, mine && mine.room === urlRoom ? mine.key : null);
    GUEST_MODE = !(mine && mine.room === urlRoom);
  } else if (SHARE && myRoom()) {
    var mr = myRoom(); B = Remote(mr.room, mr.key);
  }
  // משתתפים בקישור מתחילים בחלק שלהם (ראיון, הצבעה); בתמונת העתיד הכלי עצמו פותח את ״הוספת פריט״.
  if (GUEST_MODE && SHARE.start && !location.hash) { try { history.replaceState(null, "", location.pathname + location.search + "#" + SHARE.start); } catch (e) {} }
  if (B.isRemote) B.onGone(function () {
    var wasGuest = GUEST_MODE;
    if (!wasGuest) lsSet(ROOMKEY, null);
    B = LOCAL; changed(); renderPanel();
    toast(wasGuest ? "העבודה המשותפת נסגרה או שהקישור כבר לא בתוקף." : "השיתוף הסתיים. העבודה ממשיכה במכשיר הזה.");
  });

  /* ---------- db: documents and collections ---------- */
  var isDoc = function (p) { return String(p).split("/").length % 2 === 0; };
  function snapDoc(path) { var d = B.get(path); return { id: path.split("/").pop(), exists: d != null, data: function () { return clone(d) || undefined; }, ref: { path: path }, metadata: { hasPendingWrites: false } }; }
  function listColl(path, q) {
    var depth = path.split("/").length + 1, pre = path + "/";
    var docs = B.keys().filter(function (k) { return k.indexOf(pre) === 0 && k.split("/").length === depth; }).map(function (k) { return { id: k.split("/").pop(), data: B.get(k) }; }).filter(function (d) { return d.data != null; });
    (q.where || []).forEach(function (w) { docs = docs.filter(function (d) { var a = d.data[w[0]], v = w[2]; switch (w[1]) { case "==": return a == v; case "!=": return a != v; case "<": return a < v; case "<=": return a <= v; case ">": return a > v; case ">=": return a >= v; case "in": return Array.isArray(v) && v.indexOf(a) >= 0; default: return true; } }); });
    if (q.orderBy) docs.sort(function (a, b) { var x = a.data[q.orderBy], y = b.data[q.orderBy], c = x < y ? -1 : x > y ? 1 : 0; return q.dir === "desc" ? -c : c; });
    if (q.limit) docs = docs.slice(0, q.limit);
    return { empty: !docs.length, size: docs.length, docs: docs.map(function (d) { return { id: d.id, exists: true, data: function () { return clone(d.data); } }; }), forEach: function (f) { this.docs.forEach(f); } };
  }
  function watch(read, cb) {
    var last = null;
    var run = function () { var s = read(); var k = JSON.stringify(s.raw); if (k !== last) { last = k; cb(s.snap); } };
    Promise.resolve(B.ready).then(function () { setTimeout(run, 0); }); subs.add(run);
    return function () { subs.delete(run); };
  }
  function docRef(path) {
    if (!isDoc(path)) throw err("bad_path", path);
    return {
      path: path, id: path.split("/").pop(),
      get: async function () { await B.ready; return snapDoc(path); },
      set: async function (data) { await B.set(path, data); changed(); },
      update: async function (data) { await B.ready; var old = B.get(path) || {}; await B.set(path, Object.assign(old, data)); changed(); },
      delete: async function () { await B.ready; var pre = path + "/"; var ks = B.keys().filter(function (k) { return k === path || k.indexOf(pre) === 0; }); for (var i = 0; i < ks.length; i++) await B.del(ks[i]); changed(); },
      onSnapshot: function (cb) { return watch(function () { return { raw: B.get(path), snap: snapDoc(path) }; }, cb); },
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
      get: async function () { await B.ready; return listColl(path, q); },
      add: async function (data) { var r = docRef(path + "/d" + Math.random().toString(36).slice(2, 12)); await r.set(data); return r; },
      onSnapshot: function (cb) { return watch(function () { var s = listColl(path, q); return { raw: s.docs.map(function (d) { return [d.id, d.data()]; }), snap: s }; }, cb); }
    };
  }
  var db = { doc: docRef, collection: function (p) { return collRef(p); } };

  /* ---------- user ---------- */
  var uid = GUEST;
  var owner = function () { return !GUEST_MODE; };
  var user = {
    isOwner: async function () { await B.ready; return owner(); }, canEdit: async function () { return true; },
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

  /* ---------- share panel ---------- */
  if (!SHARE) return;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var dateIL = function (iso) { try { return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" }); } catch (e) { return ""; } };
  var loggedIn = function () { try { return !!sessionStorage.getItem("sbe.session.token"); } catch (e) { return false; } };
  // העבודה שפתוחה עכשיו בכלי (משתנה גלובלי בסקריפט של הכלי).
  var activeId = function () { try { var v = (0, eval)("typeof " + SHARE.v + " !== 'undefined' ? " + SHARE.v + " : null"); return v ? String(v) : null; } catch (e) { return null; } };
  function toast(t) {
    var d = document.createElement("div"); d.className = "hlsh-toast"; d.setAttribute("role", "status"); d.textContent = t;
    (document.body || document.documentElement).appendChild(d); setTimeout(function () { d.remove(); }, 5000);
  }
  var CSS = ".hlsh-btn{position:fixed;inset-inline-start:14px;bottom:14px;z-index:60;border:1.5px solid var(--accent,#1b9aaa);background:var(--surface,#fff);color:var(--ink,#123);border-radius:999px;padding:9px 16px;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.12)}"
    + ".hlsh-btn.on{background:var(--accent,#1b9aaa);color:#fff}"
    + ".hlsh-dlg{border:1px solid var(--line,#ccd);border-radius:16px;padding:20px 22px;max-width:520px;width:calc(100% - 32px);background:var(--surface,#fff);color:var(--ink,#123);font:inherit;text-align:start}"
    + ".hlsh-dlg::backdrop{background:rgba(10,30,40,.35)}.hlsh-dlg h2{margin:0 0 8px;font-size:1.2rem}.hlsh-dlg p{margin:.5em 0;line-height:1.55;text-align:justify}"
    + ".hlsh-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.hlsh-row button,.hlsh-row a{font:inherit;border:1px solid var(--line,#ccd);background:var(--surface,#fff);color:var(--ink,#123);border-radius:10px;padding:7px 12px;cursor:pointer;text-decoration:none}"
    + ".hlsh-row .main{background:var(--accent,#1b9aaa);border-color:var(--accent,#1b9aaa);color:#fff;font-weight:700}"
    + ".hlsh-link{direction:ltr;text-align:left;width:100%;box-sizing:border-box;font:inherit;font-size:.9rem;padding:7px 9px;border:1px solid var(--line,#ccd);border-radius:8px;background:var(--bg,#f6f8f9);color:inherit}"
    + ".hlsh-qr{display:flex;justify-content:center;margin:10px 0}.hlsh-qr img,.hlsh-qr canvas{background:#fff;padding:8px;border-radius:8px}"
    + ".hlsh-note{font-size:.92rem;opacity:.85}.hlsh-st{min-height:1.3em;font-size:.92rem}"
    + ".hlsh-guest{position:sticky;top:0;z-index:55;background:var(--accent,#1b9aaa);color:#fff;padding:8px 14px;text-align:center;font-weight:600}"
    + ".hlsh-toast{position:fixed;bottom:70px;inset-inline-start:50%;transform:translateX(50%);z-index:70;background:#123;color:#fff;padding:10px 16px;border-radius:10px;max-width:90vw}"
    + "html.hl-guest .bgkit-bar,html.hl-guest #sbeScreensBtn,html.hl-guest #pSave,html.hl-guest #pOpen,html.hl-guest #pNew,html.hl-guest #pActive,html.hl-guest #wsSave,html.hl-guest #wsOpen,html.hl-guest #wsNew,html.hl-guest #wsActive,html.hl-guest #cSave,html.hl-guest #cOpen,html.hl-guest #cNew,html.hl-guest #voteMode{display:none!important}"
    + "@media print{.hlsh-btn,.hlsh-guest,.hlsh-dlg{display:none!important}}";
  var btn, dlg;
  function loadQR(cb) {
    if (window.QRCode) return cb();
    var s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload = cb; s.onerror = cb; document.head.appendChild(s);
  }
  function link() { return location.origin + location.pathname + "?room=" + B.room; }
  function renderPanel() {
    if (!btn) return;
    if (GUEST_MODE) { btn.hidden = true; return; }
    btn.hidden = !loggedIn() && !B.isRemote;
    btn.classList.toggle("on", !!B.isRemote);
    btn.textContent = B.isRemote ? "👥 משותף עם הקבוצה" : "👥 שיתוף עם הקבוצה";
    if (typeof window.renderShare === "function") { try { window.renderShare(); } catch (e) {} }
  }
  function openDlg() {
    var shared = !!B.isRemote;
    var html = "<h2>שיתוף " + esc(SHARE.what) + " עם הקבוצה</h2>";
    if (!shared) {
      html += "<p>אפשר לפתוח את " + esc(SHARE.what) + " למשתתפים, כדי שכל אחד ואחת יוכלו " + esc(SHARE.verb) + " מהטלפון או מהמחשב שלהם. כל מה שנוסף מופיע אצל כולם תוך כמה שניות.</p>"
        + "<p class=\"hlsh-note\">המשתתפים נכנסים בקישור או ב-QR, בלי קוד, ורואים רק את " + esc(SHARE.what) + " הזה. העבודה נשמרת בשרת של Begood עד שמסיימים את השיתוף, ולכל היותר 30 יום. כדאי לא לכתוב שמות מלאים או פרטים מזהים.</p>"
        + "<div class=\"hlsh-row\"><button type=\"button\" class=\"main\" data-a=\"open\">פתיחת שיתוף</button><button type=\"button\" data-a=\"close\">סגירה</button></div>";
    } else {
      html += "<p>" + esc(SHARE.what) + " פתוח/ה לשיתוף. שולחים לקבוצה את הקישור, או מציגים את ה-QR על המסך.</p>"
        + "<input class=\"hlsh-link\" readonly value=\"" + esc(link()) + "\" aria-label=\"הקישור למשתתפים\">"
        + "<div class=\"hlsh-row\"><button type=\"button\" class=\"main\" data-a=\"copy\">העתקת הקישור</button><a target=\"_blank\" rel=\"noopener\" href=\"https://wa.me/?text=" + encodeURIComponent("מצטרפים אלינו במעבדת האופק: " + link()) + "\">שליחה בוואטסאפ</a><button type=\"button\" data-a=\"qr\">הצגת QR</button></div>"
        + "<div class=\"hlsh-qr\" hidden></div>"
        + "<p class=\"hlsh-note\">השיתוף פתוח עד " + esc(dateIL(B.exp)) + ". בסיום השיתוף העבודה חוזרת למכשיר הזה ונמחקת מהשרת, והקישור מפסיק לעבוד.</p>"
        + "<div class=\"hlsh-row\"><button type=\"button\" data-a=\"stop\">סיום השיתוף</button><button type=\"button\" data-a=\"close\">סגירה</button></div>";
    }
    html += "<div class=\"hlsh-st\" role=\"status\"></div>";
    dlg.innerHTML = html;
    if (!dlg.open) dlg.showModal();
  }
  async function startShare(st) {
    var id = activeId();
    if (!id) { st.textContent = "כדי לשתף, שומרים קודם (״שמירה״ בסרגל למעלה), ואז פותחים שיתוף."; return; }
    st.textContent = "פותחים שיתוף…";
    try {
      var tok = sessionStorage.getItem("sbe.session.token") || "";
      var r = await api("hlRoomCreate", { token: tok, page: PAGE });
      var base = SHARE.root + "/" + id, ops = [];
      LOCAL.keys().forEach(function (k) { if (k === base || k.indexOf(base + "/") === 0) ops.push({ p: k, d: LOCAL.get(k) }); });
      var act = {}; act[SHARE.f] = id; act.at = Date.now();
      ops.push({ p: "config/active", d: act });
      var R = Remote(r.room, r.key);
      await R.ready; await R.writeMany(ops);
      lsSet(ROOMKEY, JSON.stringify({ room: r.room, key: r.key, exp: r.exp }));
      R.exp = r.exp; R.onGone(function () { lsSet(ROOMKEY, null); B = LOCAL; changed(); renderPanel(); toast("השיתוף הסתיים. העבודה ממשיכה במכשיר הזה."); });
      B = R; changed(); renderPanel(); openDlg();
    } catch (e) {
      st.textContent = e.status === 429 ? "יש כבר הרבה עבודות פתוחות לשיתוף. אפשר לסיים שיתוף ישן ולנסות שוב."
        : e.status === 403 ? "כדי לפתוח שיתוף, נכנסים עם קוד שיש בו את מעבדת האופק."
        : e.code === "quota_exceeded" ? "העבודה גדולה מדי לשיתוף. אפשר להקטין תמונות או למחוק חלק מהפריטים."
        : "פתיחת השיתוף לא הצליחה. אפשר לנסות שוב בעוד רגע.";
    }
  }
  async function stopShare(st) {
    st.textContent = "מסיימים את השיתוף ושומרים במכשיר…";
    try {
      var R = B; await R.flush();
      R.keys().forEach(function (k) { if (!/^config\//.test(k)) LOCAL.set(k, R.get(k)); });
      R.stop();
      await api("hlRoomClose", { room: R.room, key: R.key });
      lsSet(ROOMKEY, null); B = LOCAL; changed(); renderPanel(); dlg.close();
      toast("השיתוף הסתיים. העבודה שמורה במכשיר הזה.");
    } catch (e) { st.textContent = "סיום השיתוף לא הצליח. אפשר לנסות שוב."; }
  }
  function mount() {
    if (GUEST_MODE) document.documentElement.classList.add("hl-guest");
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    if (GUEST_MODE) {
      document.documentElement.classList.add("hl-guest");
      var g = document.createElement("div"); g.className = "hlsh-guest";
      g.textContent = "הצטרפת לעבודה המשותפת של הקבוצה. מה שמוסיפים כאן מופיע אצל כולם.";
      document.body.insertBefore(g, document.body.firstChild);
    }
    btn = document.createElement("button"); btn.type = "button"; btn.className = "hlsh-btn";
    dlg = document.createElement("dialog"); dlg.className = "hlsh-dlg"; dlg.setAttribute("dir", "rtl");
    document.body.appendChild(btn); document.body.appendChild(dlg);
    btn.addEventListener("click", openDlg);
    dlg.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      var st = dlg.querySelector(".hlsh-st"), a = b.dataset.a;
      if (a === "close") dlg.close();
      else if (a === "open") startShare(st);
      else if (a === "stop") stopShare(st);
      else if (a === "copy") { var inp = dlg.querySelector(".hlsh-link"); (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).then(function () { st.textContent = "הקישור הועתק."; }, function () { inp.select(); st.textContent = "אפשר להעתיק את הקישור מהתיבה."; }); }
      else if (a === "qr") {
        var box = dlg.querySelector(".hlsh-qr"); box.hidden = !box.hidden; b.textContent = box.hidden ? "הצגת QR" : "הסתרת QR";
        if (!box.hidden && !box.childNodes.length) loadQR(function () { if (window.QRCode) { try { new QRCode(box, { text: link(), width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M }); } catch (x) {} } else box.textContent = "ה-QR לא נטען. אפשר לשלוח את הקישור."; });
      }
    });
    renderPanel();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
