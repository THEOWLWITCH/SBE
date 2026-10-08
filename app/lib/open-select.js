// רשימות בחירה פתוחות (08/10/2026): בכל תפריט בחירה של ערכים בכלים — אפשרות "➕ חסר משהו? הוספה…".
// הערך שהוקלד נוסף לרשימה ונבחר, ונשמר במכשיר לפי משתמש/ת (sbeUserKey), כך שהוא מופיע שוב גם אחרי רענון.
// רשימות שכבר משותפות לכולם בשרת (addableSelect — "חסר משהו? הוספה לרשימה" מתחת לתפריט) לא מקבלות תוספת כפולה.
// לא פתוחים: תפריטים של קודים קבועים שהלוגיקה נשענת עליהם (מסומנים data-closed, או ברשימת CLOSED).
(function () {
  "use strict";
  var OTHER = "__sbe_other__";
  var CLOSED = ["rptType", "rptFit", "rptFriendly", "rptContinue", "scnSel", "fbAddType", "cfg-band", "focus", "coach-stage", "crisis", "youthMode", "experience", "critNewCat"];
  function key() { var b = "sbe.open.v1"; try { return window.sbeUserKey ? window.sbeUserKey(b) : b; } catch (e) { return b; } }
  function load() { try { return JSON.parse(localStorage.getItem(key()) || "{}") || {}; } catch (e) { return {}; } }
  function store(o) { try { localStorage.setItem(key(), JSON.stringify(o)); } catch (e) {} }
  var page = (location.pathname.split("/").pop() || "index.html");
  function sid(sel) {
    if (sel.id) return sel.id;
    if (sel.name) return sel.name;
    var w = sel.closest("label,.f,.field,div"); var l = w && w.querySelector("label");
    return "l:" + ((l ? l.textContent : "") || "").replace(/\s+/g, " ").trim().slice(0, 40);
  }
  function listFor(sel) { var o = load(); return o[page + "|" + sid(sel)] || []; }
  function allValues() { var o = load(), out = []; Object.keys(o).forEach(function (k) { if (k.indexOf(page + "|") === 0) out = out.concat(o[k]); }); return out; }
  function closed(sel) {
    if (sel.multiple || sel.hasAttribute("data-closed") || CLOSED.indexOf(sel.id) !== -1) return true;
    if (sel.closest("#rptDlg,#navPanel,[data-closed],.combo-other-group")) return true; // קטגוריה לפריט "אחר" שכבר נכתב
    var nx = sel.nextElementSibling; if (nx && nx.classList && nx.classList.contains("addmore")) return true; // רשימה משותפת בשרת
    return [].some.call(sel.options, function (o) { return /^\s*אחר/.test(o.textContent) && o.value !== OTHER; }); // כבר יש "אחר" עם שדה משלו
  }
  function addOption(sel, v) {
    if ([].some.call(sel.options, function (o) { return o.value === v; })) return;
    var o = document.createElement("option"); o.value = v; o.textContent = v; o.dataset.openAdded = "1";
    var other = sel.querySelector('option[value="' + OTHER + '"]');
    sel.insertBefore(o, other || null);
  }
  // שחזור טופס שמור (select.value = ערך שהוסף) — גם לפני שהתפריט "שודרג"
  var desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (desc && desc.set) Object.defineProperty(HTMLSelectElement.prototype, "value", {
    configurable: true, enumerable: desc.enumerable, get: desc.get,
    set: function (v) {
      var s = String(v == null ? "" : v);
      if (s && s !== OTHER && !closed(this) && ![].some.call(this.options, function (o) { return o.value === s; }) && allValues().indexOf(s) !== -1) addOption(this, s);
      desc.set.call(this, v);
    }
  });
  function enhance(sel) {
    if (sel.dataset.openDone || closed(sel)) return;
    sel.dataset.openDone = "1";
    listFor(sel).forEach(function (v) { addOption(sel, v); });
    var other = document.createElement("option"); other.value = OTHER; other.textContent = "➕ חסר משהו? הוספה…"; sel.appendChild(other);
    var prev = sel.value === OTHER ? "" : sel.value;
    var row = document.createElement("div"); row.className = "sbe-open-row no-print"; row.hidden = true;
    row.style.cssText = "display:flex;gap:.4rem;align-items:center;margin:.35rem 0 .2rem;flex-wrap:wrap";
    var inp = document.createElement("input"); inp.type = "text"; inp.maxLength = 80; inp.placeholder = "מה חסר ברשימה?";
    inp.style.cssText = "flex:1 1 12rem;min-width:0;font:inherit;padding:.4rem .55rem;border:1px solid currentColor;border-radius:6px;opacity:.95";
    var ok = document.createElement("button"); ok.type = "button"; ok.textContent = "הוספה";
    var no = document.createElement("button"); no.type = "button"; no.textContent = "ביטול";
    [ok, no].forEach(function (b) { b.style.cssText = "font:inherit;font-size:.9em;padding:.35rem .8rem;border-radius:6px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer"; });
    row.append(inp, ok, no);
    if (row.hidden) row.style.display = "none";
    sel.insertAdjacentElement("afterend", row);
    function show(on) { row.hidden = !on; row.style.display = on ? "flex" : "none"; if (on) inp.focus(); }
    sel.addEventListener("focus", function () { if (sel.value !== OTHER) prev = sel.value; });
    sel.addEventListener("input", function (e) { if (sel.value === OTHER) e.stopImmediatePropagation(); }, true);
    sel.addEventListener("change", function (e) {
      if (sel.value !== OTHER) { prev = sel.value; return; }
      e.stopImmediatePropagation(); desc.set.call(sel, prev); show(true);
    }, true);
    function add() {
      var v = inp.value.replace(/\s+/g, " ").trim(); if (v.length < 2) { inp.focus(); return; }
      var o = load(), k = page + "|" + sid(sel); o[k] = (o[k] || []).filter(function (x) { return x !== v; }).concat([v]).slice(-30); store(o);
      addOption(sel, v); desc.set.call(sel, v); prev = v; inp.value = ""; show(false);
      sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    ok.addEventListener("click", add);
    no.addEventListener("click", function () { inp.value = ""; show(false); sel.focus(); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") no.click(); });
  }
  function scan() { [].forEach.call(document.querySelectorAll("select"), function (s) { if (s.isConnected) enhance(s); }); }
  // אחרי שהדף בנה את התפריטים ואת "חסר משהו? הוספה לרשימה" המשותפים — ושוב לכל תפריט שנוסף בהמשך
  function later() { setTimeout(scan, 0); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", later); else later();
  window.addEventListener("load", later);
  try { new MutationObserver(function (ms) { if (ms.some(function (m) { return [].some.call(m.addedNodes, function (n) { return n.nodeType === 1 && (n.tagName === "SELECT" || (n.querySelector && n.querySelector("select"))); }); })) later(); })
    .observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  window.SBE_OPEN = { enhance: enhance, scan: scan, OTHER: OTHER };
})();
