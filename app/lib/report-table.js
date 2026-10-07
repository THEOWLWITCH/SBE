// טבלאות בדוחות (07/10/2026) — במקום הרבה כרטיסים ושורות קצרות. בשימוש בדוח של פרקטי ושל נוגי.
// SBE_TABLE(head, rows, cls):
//   head — כותרות עמודות (לכל תא data-label, כדי שבטלפון כל שורה תיערם לכרטיס עם תוויות),
//          או null — אז העמודה הראשונה היא תווית (th).
//   rows — מערך שורות; תא הוא טקסט, צומת או null (ריק: "—", ומוסתר בטלפון).
(function () {
  "use strict";
  const CSS = `
.rtable{width:100%;border-collapse:collapse;margin:.4rem 0 1rem;font-size:.92rem;line-height:1.55}
.rtable th,.rtable td{border:1px solid var(--hair,#CDD3D8);padding:.5rem .65rem;text-align:right;vertical-align:top}
.rtable thead th{background:#2E5A7D;color:#fff;font-weight:700}
.rtable tbody th{background:var(--surface-2,#EDEFF1);width:22%;font-weight:700}
.rtable p{margin:0 0 .3rem}.rtable ul,.rtable ol{margin:0;padding-inline-start:1.1rem}
.rtable .act-tags{margin:.3rem 0 0}.rtable .basis{margin:.35rem 0 0;font-size:.8rem}.rtable .act-r{margin:.3rem 0 0}
.rtable .act-d{margin:0}.rtable .rt-title{font-weight:700}
.rtable td.empty{color:var(--muted,#5C6771)}
@media (max-width:640px){
  .rtable thead{display:none}
  .rtable,.rtable tbody,.rtable tr,.rtable td,.rtable tbody th{display:block;width:auto}
  .rtable tr{border:1px solid var(--hair,#CDD3D8);border-radius:8px;margin:.5rem 0;overflow:hidden}
  .rtable td,.rtable tbody th{border:0;border-bottom:1px solid var(--hair,#CDD3D8)}
  .rtable td.empty{display:none}
  .rtable td[data-label]::before{content:attr(data-label);display:block;font-weight:700;font-size:.8rem;color:var(--muted,#5C6771)}
}
@media print{
  .rtable{font-size:10pt}.rtable tr{break-inside:avoid;page-break-inside:avoid}.rtable thead{display:table-header-group}
  .rtable thead th{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;
  function style() {
    if (document.getElementById("sbe-rtable-style")) return;
    const s = document.createElement("style"); s.id = "sbe-rtable-style"; s.textContent = CSS; document.head.append(s);
  }
  window.SBE_TABLE = function (head, rows, cls) {
    style();
    const t = document.createElement("table"); t.className = "rtable" + (cls ? " " + cls : "");
    if (head) {
      const th = document.createElement("thead"), tr = document.createElement("tr");
      head.forEach((h) => { const c = document.createElement("th"); c.textContent = h; tr.append(c); });
      th.append(tr); t.append(th);
    }
    const tb = document.createElement("tbody");
    (rows || []).forEach((r) => {
      const tr = document.createElement("tr");
      r.forEach((v, i) => {
        const c = document.createElement(!head && i === 0 ? "th" : "td");
        if (v == null || v === "") { c.textContent = "—"; c.classList.add("empty"); }
        else if (v instanceof Node) c.append(v); else c.textContent = String(v);
        if (head) c.dataset.label = head[i];
        tr.append(c);
      });
      tb.append(tr);
    });
    t.append(tb); return t;
  };
})();
