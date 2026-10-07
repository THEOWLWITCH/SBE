// תוצר מעוצב — רכיב משותף לכל הכלים (05/10/2026).
// SBE_DOC.rich(text)        — טקסט מהמודל ← פסקאות, כותרות, תבליטים והדגשות (בלי כוכביות וסימני #).
// SBE_DOC.editable(node)    — הופך את התוצר לניתן לעריכה על המסך, עם הסבר קצר.
// SBE_DOC.print({title, subtitle, node}) — פותח מסמך להדפסה / שמירה כ-PDF: לוגו, כותרת, תאריך,
//   שוליים נדיבים ו-break-inside:avoid (הנחיות העיצוב ב-CLAUDE.md).
(function () {
  "use strict";

  function inline(text) {
    const frag = document.createDocumentFragment();
    String(text || "").split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
      const m = part.match(/^\*\*([^*]+)\*\*$/);
      if (m) { const b = document.createElement("b"); b.textContent = m[1]; frag.append(b); }
      else if (part) frag.append(document.createTextNode(part.replace(/\*\*/g, "")));
    });
    return frag;
  }

  function rich(text) {
    const box = document.createElement("div"); box.className = "sbe-rich";
    let list = null;
    String(text || "").replace(/\r/g, "").split("\n").forEach((raw) => {
      const line = raw.trim();
      if (!line) { list = null; return; }
      let m;
      const add = (tag, content) => { const n = document.createElement(tag); n.append(inline(content)); box.append(n); return n; };
      if ((m = line.match(/^#{1,6}\s*(.+)$/)) || (m = line.match(/^\*\*([^*]+)\*\*[:：]?$/))) { list = null; add("h4", m[1]); return; }
      if ((m = line.match(/^(?:[-•*●▪–])\s+(.+)$/))) {
        if (!list || list.tagName !== "UL") { list = document.createElement("ul"); box.append(list); }
        const li = document.createElement("li"); li.append(inline(m[1])); list.append(li); return;
      }
      if ((m = line.match(/^(\d{1,2})[.)]\s+(.+)$/))) {
        if (!list || list.tagName !== "OL") { list = document.createElement("ol"); list.start = +m[1]; box.append(list); }
        const li = document.createElement("li"); li.append(inline(m[2])); list.append(li); return;
      }
      list = null; add("p", line);
    });
    return box;
  }

  const STYLE = `.sbe-rich{line-height:1.75;font-size:15px}
.sbe-rich h4{font-size:15.5px;margin:18px 0 6px;font-weight:800}
.sbe-rich h4:first-child{margin-top:0}
.sbe-rich p{margin:0 0 10px}
.sbe-rich ul,.sbe-rich ol{margin:0 0 12px;padding-inline-start:22px}
.sbe-rich li{margin-bottom:5px}
.sbe-edit{outline:none;border-radius:6px;transition:box-shadow .15s}
.sbe-edit:hover{box-shadow:0 0 0 1px rgba(46,90,125,.35)}
.sbe-edit:focus{box-shadow:0 0 0 2px rgba(46,90,125,.55)}
.sbe-edit-hint{font-size:12.5px;color:#5C6771;background:rgba(46,90,125,.08);border-radius:6px;padding:6px 10px;margin:0 0 10px}`;
  function ensureStyle() {
    if (document.getElementById("sbe-doc-style")) return;
    const s = document.createElement("style"); s.id = "sbe-doc-style"; s.textContent = STYLE; document.head.append(s);
  }

  function editable(node) {
    ensureStyle();
    node.classList.add("sbe-edit");
    node.setAttribute("contenteditable", "true");
    node.setAttribute("spellcheck", "true");
    const hint = document.createElement("p"); hint.className = "sbe-edit-hint";
    hint.textContent = "✎ אפשר לערוך את הטקסט ישירות כאן — למחוק, להוסיף ולנסח מחדש. ההדפסה ושמירת ה-PDF יכללו את הנוסח הערוך.";
    const wrap = document.createElement("div"); wrap.append(hint, node);
    return wrap;
  }

  // הלוגו מוטמע במסמך (data URL) — חלון הדפסה ריק לא תמיד טוען תמונות מכתובת.
  function logoSrc() {
    const url = new URL("assets/begood-logo.webp", document.baseURI.replace(/\/products\/[^/]*$/, "/")).href;
    const img = [...document.images].find((i) => /begood-logo|alt="?Begood/i.test(i.src + ' alt="' + i.alt) && i.complete && i.naturalWidth);
    if (!img) return url;
    if (img.src.startsWith("data:")) return img.src;
    try {
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0); return c.toDataURL("image/png");
    } catch (e) { return url; }
  }

  function esc(s) { return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // node: אלמנט (או כמה) עם התוכן. העותק מנוקה מכפתורים, מהסברים ומ-contenteditable.
  function print({ title, subtitle, node, nodes, inline = false, landscape = false }) {
    const parts = (nodes || [node]).filter(Boolean).map((n) => {
      const c = n.cloneNode(true);
      c.querySelectorAll("button,.sbe-edit-hint,.no-print,style,script").forEach((x) => x.remove());
      [c, ...c.querySelectorAll("[contenteditable]")].forEach((x) => { x.removeAttribute("contenteditable"); x.removeAttribute("spellcheck"); x.classList.remove("sbe-edit"); });
      return c.outerHTML;
    }).join("");
    const logo = logoSrc();
    const date = new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
    let w;
    if (inline) {
      // An authenticated export can finish after the browser's popup gesture expires.
      const preview = document.createElement("dialog");
      preview.setAttribute("aria-label", "תצוגה מקדימה להדפסה");
      preview.style.cssText = "width:min(900px,94vw);height:90vh;padding:12px;border:1px solid #CDD3D8;border-radius:10px";
      const close = document.createElement("button");
      close.type = "button"; close.textContent = "סגירת התצוגה";
      close.style.cssText = "font:inherit;padding:6px 12px;margin-bottom:8px";
      close.addEventListener("click", () => preview.close());
      preview.addEventListener("close", () => preview.remove(), { once: true });
      const frame = document.createElement("iframe");
      frame.title = "מסמך להדפסה: " + String(title || "Begood");
      frame.style.cssText = "display:block;width:100%;height:calc(100% - 48px);border:0";
      preview.append(close, frame); document.body.append(preview); preview.showModal();
      w = frame.contentWindow;
    } else {
      w = window.open("", "_blank");
    }
    if (!w) { alert("הדפדפן חסם את חלון ההדפסה. אפשרי חלונות קופצים לאתר ונסי שוב."); return; }
    w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)} — Begood</title>
<style>
@page{size:A4${landscape ? " landscape" : ""};margin:18mm 20mm}
body{font-family:"Assistant","Segoe UI",Arial,sans-serif;color:#141C24;max-width:${landscape ? 1040 : 720}px;margin:24px auto;padding:0 16px;line-height:1.7;font-size:14.5px}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #2E5A7D;padding-bottom:10px;margin-bottom:18px;gap:16px}
.hd img{height:54px}
.hd .dt{font-size:12.5px;color:#5C6771}
h1{font-size:22px;margin:0 0 4px;break-after:avoid}
.sub{color:#5C6771;margin:0 0 18px;font-size:13.5px}
h4,h3,h2{break-after:avoid;font-size:15px;margin:18px 0 6px}
p,li{orphans:3;widows:3}
.draftbox,.rcard,.sbe-rich,.card,.act,.session-card,.step-card,.claims-box,li{break-inside:avoid}
.draftbox{white-space:pre-line;border:1px solid #CDD3D8;border-radius:6px;padding:12px 14px;margin-bottom:12px}
.rcard{border:1px solid #CDD3D8;border-radius:8px;padding:12px 14px;background:#F3F6F8}
.rcard-row{margin-bottom:8px}.rcard-row b{display:block;font-size:12px;color:#5C6771}
.rcard-meta{font-size:12px;color:#5C6771;margin-bottom:8px}
.sbe-rich h4{font-size:15px}
.tree2-root,.tree2-row,.tree2-end{border:1px solid #CDD3D8;border-radius:6px;padding:8px 10px;margin-bottom:6px;break-inside:avoid}
.tree2-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.kit-table{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:13px;line-height:1.5}
.kit-table th,.kit-table td{border:1px solid #CDD3D8;padding:6px 8px;text-align:right;vertical-align:top}
.kit-table thead th{background:#2E5A7D;color:#fff;font-weight:700}
.kit-table tbody th{background:#F3F6F8;width:18%;font-weight:700}
.kit-table tr{break-inside:avoid}.kit-table thead{display:table-header-group}
.kit-table p{margin:0 0 4px}.kit-table ul,.kit-table ol{margin:0;padding-inline-start:18px}
.kit-facts tbody th{width:12%}.kit-facts td{width:38%}
.kit-steps td:nth-child(1){width:13%}.kit-steps td:nth-child(2){width:27%}.kit-steps td:nth-child(3){width:27%}.kit-steps td:nth-child(4){width:15%}.kit-steps td:nth-child(5){width:18%}
.kit-steps tbody tr:nth-child(even) td{background:#FAFBFC}
.kit-close td{width:33%}.kit-close thead th{background:#4A6B5A}
.kit-h{font-size:16px;color:#2E5A7D;margin:20px 0 4px}.kit-sub{margin:0 0 6px;font-size:13.5px}
.kit-min,.kit-muted{color:#5C6771;font-size:12px}.kit-session{break-before:auto}
.ft{margin-top:26px;border-top:1px solid #CDD3D8;padding-top:8px;font-size:11.5px;color:#5C6771}
.bar{position:sticky;top:0;background:#fff;padding:8px 0;margin-bottom:10px;text-align:left}
.bar button{font:inherit;font-weight:700;padding:7px 16px;border-radius:6px;border:1px solid #2E5A7D;background:#2E5A7D;color:#fff;cursor:pointer}
@media print{.bar{display:none}body{margin:0;max-width:none}}
</style></head><body>
<div class="bar"><button onclick="window.print()">הדפסה / שמירה כ-PDF</button></div>
<div class="hd"><div><h1>${esc(title)}</h1>${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ""}<div class="dt">${esc(date)}</div></div><img src="${logo}" alt="Begood"></div>
${parts}
<div class="ft">הופק ב-Begood · be-good.co.il</div>
<script>${inline ? "" : "window.onload=function(){setTimeout(function(){window.print()},300)}"}<\/script>
</body></html>`);
    w.document.close();
  }

  window.SBE_DOC = { rich, editable, print, ensureStyle };
})();
