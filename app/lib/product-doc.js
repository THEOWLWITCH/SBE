// תוצר מעוצב — רכיב משותף לכל הכלים (05/10/2026).
// SBE_DOC.rich(text)        — טקסט מהמודל ← פסקאות, כותרות, תבליטים והדגשות (בלי כוכביות וסימני #).
// SBE_DOC.editable(node)    — הופך את התוצר לניתן לעריכה על המסך, עם הסבר קצר.
// SBE_DOC.sections(text)    — טקסט עם כותרות מודגשות ← טבלה: כותרת | תוכן (null כשיש פחות משני חלקים).
// SBE_DOC.table(rows)       — טבלת תווית | תוכן (תוכן: טקסט או צומת).
// SBE_DOC.print({title, subtitle, node}) — פותח מסמך להדפסה / שמירה כ-PDF: לוגו, כותרת, תאריך,
//   שוליים נדיבים ו-break-inside:avoid (הנחיות העיצוב ב-CLAUDE.md).
// SBE_DOC.printPage({title}) — הדפסת הדף עצמו עם שורת הקשר (הכלי ומטרתו) ושם קובץ ברור.
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
    if (window.SBE_QUOTES) text = SBE_QUOTES.fix(String(text == null ? '' : text)); // מרכאות אחידות (lib/quotes.js)
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

  // טבלה במקום שורות קצרות (07/10/2026): כל חלק בטקסט (כותרת מודגשת בשורה משלה) הופך לשורה בטבלה
  function sections(text) {
    const parts = []; let cur = null;
    String(text || "").replace(/\r/g, "").split("\n").forEach((raw) => {
      const line = raw.trim(); let m;
      if ((m = line.match(/^#{1,6}\s*(.+)$/)) || (m = line.match(/^\*\*([^*]+)\*\*[:：]?$/))) { cur = { t: m[1].replace(/\*\*/g, "").trim().replace(/[:：]$/, ""), b: [] }; parts.push(cur); return; }
      // "**כותרת** — תוכן" / "**כותרת**: תוכן" בשורה אחת — גם זו כותרת (קצרה), והתוכן נכנס לשורה שלה
      if ((m = line.match(/^\*\*([^*]{2,40})\*\*\s*[:：—–-]\s*(.+)$/))) { cur = { t: m[1].replace(/[:：]$/, "").trim(), b: [m[2]] }; parts.push(cur); return; }
      if (!cur) { if (!line) return; cur = { t: "", b: [] }; parts.push(cur); }
      cur.b.push(raw);
    });
    const real = parts.filter((p) => p.t);
    if (real.length < 2) return null;
    return table(parts.map((p) => [p.t, rich(p.b.join("\n"))]));
  }
  function table(rows) {
    ensureStyle();
    const t = document.createElement("table"); t.className = "kit-table kit-two";
    const tb = document.createElement("tbody");
    rows.forEach(([label, content]) => {
      if (content == null || content === "") return;
      const tr = document.createElement("tr");
      if (label) { const th = document.createElement("th"); th.textContent = label; tr.append(th); }
      const td = document.createElement("td"); if (!label) td.colSpan = 2;
      if (content instanceof Node) td.append(content); else td.textContent = String(content);
      tr.append(td); tb.append(tr);
    });
    t.append(tb); return t;
  }
  // מהלך מפגש אחיד בכל התוצרים (08/10/2026): פתיחה · פעילות מרכזית · סיכום · אחרי המפגש, ושלוש עמודות:
  // תיאור הפעילות · הנחיה למנחה (כולל השאלות) · עזרים ומשאבים. עמודה בלי תוכן לא מוצגת.
  // rows: [{phase, time, title, minutes, desc, guide, res}] (desc/guide/res: טקסט או צומת)
  const PHASES = ["לפני המפגש", "פתיחה", "פעילות מרכזית", "סיכום", "אחרי המפגש"];
  function flowTable(rows, columns) {
    ensureStyle();
    const has = (v) => v instanceof Node ? (v.textContent || "").trim() !== "" || !!v.querySelector("img,table") : String(v == null ? "" : v).trim() !== "";
    const cols = (columns || [["desc", "תיאור הפעילות"], ["guide", "הנחיה למנחה"], ["res", "עזרים ומשאבים"]]).filter(([k]) => rows.some((r) => has(r[k])));
    const t = document.createElement("table"); t.className = "kit-table kit-flow";
    const thead = document.createElement("thead"); const htr = document.createElement("tr");
    cols.forEach(([, h]) => { const th = document.createElement("th"); th.textContent = h; htr.append(th); });
    thead.append(htr); t.append(thead);
    const tb = document.createElement("tbody");
    const order = (p) => { const i = PHASES.indexOf(p); return i < 0 ? 2 : i; };
    const sorted = rows.map((r, i) => ({ r, i })).sort((a, b) => order(a.r.phase) - order(b.r.phase) || a.i - b.i).map((x) => x.r);
    let cur = null;
    sorted.forEach((r) => {
      if (r.phase !== cur) {
        cur = r.phase;
        const tr = document.createElement("tr"); tr.className = "ph";
        const th = document.createElement("th"); th.colSpan = cols.length;
        const mins = sorted.filter((x) => x.phase === cur).reduce((s, x) => s + (Number(x.minutes) || 0), 0);
        th.textContent = (cur || "פעילות מרכזית") + (mins ? " · " + mins + " דקות" : (sorted.find((x) => x.phase === cur && x.time) || {}).time ? " · " + sorted.find((x) => x.phase === cur && x.time).time : "");
        tr.append(th); tb.append(tr);
      }
      const tr = document.createElement("tr");
      cols.forEach(([k]) => {
        const td = document.createElement("td"); td.setAttribute("data-label", cols.find((c) => c[0] === k)[1]);
        if (k === "desc" && r.title) { const b = document.createElement("b"); b.textContent = r.title + (r.minutes ? " (" + (typeof r.minutes === "number" ? r.minutes + " דק׳" : r.minutes) + ")" : ""); const d = document.createElement("div"); d.append(b); td.append(d); }
        const v = r[k];
        if (v instanceof Node) td.append(v); else if (has(v)) { const d = document.createElement("div"); d.style.whiteSpace = "pre-line"; d.textContent = String(v); td.append(d); }
        
        tr.append(td);
      });
      tb.append(tr);
    });
    t.append(tb); return t;
  }

  const STYLE = `.kit-table{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:14.5px;line-height:1.6}
.kit-table th,.kit-table td{border:1px solid #CDD3D8;padding:8px 10px;text-align:right;vertical-align:top}
.kit-table tbody th{background:rgba(46,90,125,.08);width:22%;font-weight:700}
/* יישור לשני הצדדים בכל התוצרים, גם בטבלאות (12/10/2026) */
.kit-table td,.rtable td,.ktable td,.sbe-rich p,.sbe-rich li,.sbe-edit p,.sbe-edit li,.sbe-edit td{text-align:justify;text-justify:inter-word}
/* תא צר (טבלה של שלוש עמודות ומעלה): יישור לימין, בלי רווחים גדולים בין המילים */
table tr>:first-child:nth-last-child(n+3)~td:not(.n):not(.ck),table tr>:first-child:nth-last-child(n+3)~td:not(.n):not(.ck) p,table tr>:first-child:nth-last-child(n+3)~td:not(.n):not(.ck) li,table tr>td:first-child:nth-last-child(n+3),table tr>td:first-child:nth-last-child(n+3) p,table tr>td:first-child:nth-last-child(n+3) li{text-align:start}table tr>td:first-child:nth-last-child(2),table tr>td:first-child:nth-last-child(2) p{text-align:start}
.kit-table thead th{background:#2E5A7D;color:#fff;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kit-flow tr.ph th{background:#DCE7EF;color:#1E3F5A;text-align:right;font-size:15px;width:auto}
.kit-flow td{width:33%}
.kit-table .sbe-rich{font-size:14.5px;line-height:1.65}.kit-table .sbe-rich p:last-child,.kit-table .sbe-rich ul:last-child{margin-bottom:0}
@media screen and (max-width:640px){.kit-table,.kit-table tbody,.kit-table tr,.kit-table th,.kit-table td{display:block;width:auto}.kit-table tr{border:1px solid #CDD3D8;border-radius:8px;margin:8px 0;overflow:hidden}.kit-table th,.kit-table td{border:0}}
.sbe-rich{line-height:1.75;font-size:15px}
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
    hint.textContent = "✎ אפשר לערוך את הטקסט כאן.";
    const wrap = document.createElement("div"); wrap.append(hint, node);
    return wrap;
  }

  // הלוגו מוטמע במסמך (data URL) — חלון הדפסה ריק לא תמיד טוען תמונות מכתובת.
  // הלוגו נטען מראש כ-data URL כשהקובץ נטען, כדי שיופיע בכל PDF גם כשבדף אין תמונת לוגו (12/10/2026, בדיקת הלקוחה)
  // לוגו לפי המרחב (28/10/2026): "Be good בחינוך" במרחב החינוכי, "Be good בארגונים" במרחב הארגוני.
  const LOGO_FILE = { edu: "assets/begood-edu.webp", org: "assets/begood-together.webp" };
  const LOGO_DATA = { edu: "", org: "" };
  const assetBase = () => document.baseURI.replace(/\/(products|lib)\/[^/]*$/, "/");
  function spaceNow() { try { return typeof window.sbeSpace === "function" && window.sbeSpace() === "org" ? "org" : "edu"; } catch (e) { return "edu"; } }
  try {
    Object.keys(LOGO_FILE).forEach((k) => {
      fetch(new URL(LOGO_FILE[k], assetBase()).href).then((r) => r.ok ? r.blob() : null).then((b) => { if (!b) return; const fr = new FileReader(); fr.onload = () => { LOGO_DATA[k] = String(fr.result || ""); }; fr.readAsDataURL(b); }).catch(() => {});
    });
  } catch (e) {}
  function logoSrc() {
    const k = spaceNow();
    return LOGO_DATA[k] || new URL(LOGO_FILE[k], assetBase()).href;
  }

  function esc(s) { return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // מעבר דף במקום הנכון (08/10/2026): כותרת לא נשארת לבד בתחתית עמוד, ורשימה או טבלה קצרה לא נחתכות.
  // כותרת + התוכן הקצר שאחריה עוטפים יחד ב-.keep (break-inside:avoid). תוכן ארוך — נשאר עם כותרתו לפחות בשורה הראשונה.
  function keepWithHeadings(root) {
    root.querySelectorAll("h2,h3,h4,.kit-h").forEach((h) => {
      let nx = h.nextElementSibling; if (!nx || h.parentNode.classList.contains("keep")) return;
      // הסבר קצר בין הכותרת לטבלה נשאר איתן (12/10/2026, בדיקת הלקוחה: שורה יתומה בראש עמוד)
      const note = nx.matches("p") && (nx.textContent || "").length < 200 && nx.nextElementSibling && nx.nextElementSibling.matches("table,ul,ol,div") ? nx : null;
      if (note) nx = note.nextElementSibling;
      const rows = nx.matches("table") ? nx.querySelectorAll("tr").length : 0;
      const items = nx.matches("ul,ol") ? nx.children.length : 0;
      const short = (nx.matches("table") && rows <= 7) || (nx.matches("ul,ol") && items <= 14) || (nx.matches("p,div") && (nx.textContent || "").length < 900);
      const wrap = document.createElement("div"); wrap.className = short ? "keep" : "keep-start";
      h.parentNode.insertBefore(wrap, h); wrap.append(h); if (note) wrap.append(note); if (short) wrap.append(nx);
    });
  }

  // בלי עמוד ריק (09/10/2026: "אין להשאיר עמוד ריק"): בלוק שמסומן "לא לחתוך" (break-inside:avoid) ושגבוה
  // מרוב העמוד נדחף כולו לעמוד הבא ומשאיר אחריו עמוד ריק או כמעט ריק. לפני ההדפסה מודדים ברוחב של הדף המודפס,
  // ובלוק כזה מקבל .sbe-brk, שמתיר לו להיחתך. כותרות וטבלאות קצרות ממשיכים להישמר יחד.
  const BRK_CSS = "@media print{.sbe-brk{break-inside:auto!important;page-break-inside:auto!important}}";
  function relaxTall(doc, { widthMm = 170, heightMm = 261 } = {}) {
    const root = doc.documentElement, body = doc.body; if (!body) return;
    const px = (mm) => mm * 96 / 25.4, limit = px(heightMm) * 0.6;
    const prev = [root.style.width, body.style.maxWidth];
    root.style.width = widthMm + "mm"; body.style.maxWidth = "none";
    try {
      body.querySelectorAll(".sbe-brk").forEach((el) => el.classList.remove("sbe-brk"));
      body.querySelectorAll("*").forEach((el) => { if (el.getBoundingClientRect().height > limit) el.classList.add("sbe-brk"); });
    } finally { root.style.width = prev[0]; body.style.maxWidth = prev[1]; }
    if (!doc.getElementById("sbe-brk-css")) { const st = doc.createElement("style"); st.id = "sbe-brk-css"; st.textContent = BRK_CSS; doc.head.appendChild(st); }
  }

  // כותרת שחוזרת בכל עמוד (12/10/2026: "במקרים שטבלאות נחתכות - הכותרת צריכה לחזור על עצמה בדף הבא"):
  // טבלה עם כותרות עמודה (thead) חוזרת עליהן בכל עמוד. טבלה בלי thead (כותרת | תוכן) שמעליה כותרת מקבלת
  // את הכותרת הזאת כשורת כותרת שחוזרת, והכותרת המקורית לא מודפסת פעמיים. שורה לא נחתכת באמצע.
  const RH_CSS = "@media screen{thead.sbe-rh,tr.sbe-rh-row{display:none}}@media print{thead{display:table-header-group}tfoot{display:table-footer-group}tr{break-inside:avoid;page-break-inside:avoid}" +
    "tr.sbe-rh-row th{background:none!important;color:#1E3F5A!important;border:0!important;text-align:start!important;font-weight:700!important;font-size:15.5px!important;padding:6px 10px 8px 0!important;width:auto!important;box-shadow:inset -4px 0 0 #2BA39C;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sbe-rh-src{display:none!important}}";
  function repeatHeads(doc) {
    const body = doc && doc.body; if (!body) return;
    body.querySelectorAll("table").forEach((t) => {
      if (t.querySelector("tr.sbe-rh-row")) return;
      const rows = [...t.rows]; if (rows.length < 3) return; // טבלה קצרה לא נחתכת ממילא
      let node = t, h = t.previousElementSibling;
      while (!h && node.parentElement && node.parentElement !== body && node.parentElement.children.length === 1) { node = node.parentElement; h = node.previousElementSibling; }
      // כותרת שנעטפה לפני ההדפסה (keepWithHeadings: .keep-start) נמצאת בסוף העטיפה שלפני הטבלה
      if (h && h.classList && h.classList.contains("keep-start") && h.lastElementChild) h = h.lastElementChild;
      const isHead = (x) => x && (/^H[2-6]$/.test(x.tagName) || (x.classList && (x.classList.contains("kit-h") || x.classList.contains("dt-cap"))));
      if (!isHead(h) || !h.textContent.trim()) return; // בלי כותרת מעל: כותרות העמודה (thead) חוזרות לבד
      const cols = Math.max(1, ...rows.map((r) => [...r.cells].reduce((n, c) => n + (c.colSpan || 1), 0)));
      // שם הטבלה חוזר בראש כל עמוד (12/10/2026: "כותרת טבלה חוזרת בראש כל עמוד"), מעל כותרות העמודה אם יש
      const tr = doc.createElement("tr"), th = doc.createElement("th"); tr.className = "sbe-rh-row";
      th.colSpan = cols; th.textContent = h.textContent.replace(/\s+/g, " ").trim(); tr.appendChild(th);
      let thead = t.tHead;
      if (!thead) { thead = doc.createElement("thead"); thead.className = "sbe-rh"; t.insertBefore(thead, t.firstChild); }
      thead.insertBefore(tr, thead.firstChild);
      h.classList.add("sbe-rh-src");
    });
    if (!doc.getElementById("sbe-rh-css")) { const st = doc.createElement("style"); st.id = "sbe-rh-css"; st.textContent = RH_CSS; (doc.head || body).appendChild(st); }
  }
  // הכנה להדפסה של כל מסמך (גם מסמך בתוך מסגרת): כותרות שחוזרות ובלי עמוד ריק
  function preparePrint(doc, landscape) {
    doc = doc || document;
    try { repeatHeads(doc); } catch (e) {}
    try { relaxTall(doc, landscape ? { widthMm: 249, heightMm: 162 } : { widthMm: 162, heightMm: 249 }); } catch (e) {}
  }

  // כרטיס כיס (08/10/2026): תוצר נפרד, אותיות גדולות שקל לקרוא בזמן המפגש
  const POCKET_CSS = `
body{font-size:20px;line-height:1.55;max-width:760px}
h1{font-size:26px}.hd img{height:56px}
.pk-sec{border:2px solid #2E5A7D;border-radius:12px;padding:12px 18px;margin:0 0 14px;break-inside:avoid}
.pk-sec h4{font-size:22px;color:#2E5A7D;margin:0 0 6px}
.pk-sec ul{margin:0;padding-inline-start:24px}.pk-sec li{margin-bottom:6px}
.pk-stance{background:#EEF4F8;font-weight:700;font-size:22px}
.pk-moment b{color:#8C3A34}
`;

  // node: אלמנט (או כמה) עם התוכן. העותק מנוקה מכפתורים, מהסברים ומ-contenteditable.
  // הכלי ומטרתו בראש כל תוצר, ושם קובץ ברור (08/10/2026: "בכותרת של כל כלי יופיע הכלי ומטרתו. חייב להיות הקשר")
  const TOOLS = {
    "resilience-studio.html": ["סטודיו חוסן", "מהשראה לפעילות שמחזקת את החוסן החברתי בקבוצה"],
    "resilience-advisor.html": ["פרקטי", "יועצת לחוסן חברתי בכיתה: תמונת מצב והמלצות מעשיות למחנכים"],
    "leadership-advisor.html": ["נוגי", "יועצת למנהיגות שמקדמת חוסן: תמונת מצב והמלצות להנהלה ולצוותים"],
    "facilitation-advisor.html": ["ננה", "מהוראה להנחיה: הנחיית קבוצה שמקדמת חוסן חברתי"],
    "message-writer.html": ["תקשורת שמקדמת חוסן חברתי", "ניסוח חד־פעמי וניהול תקשורת לאורך זמן לפי 18 עקרונות Begood"],
    "communication-continuity.html": ["תקשורת שמקדמת חוסן חברתי", "ניהול תקשורת לאורך זמן מתוך מרחב התקשורת המשותף"],
    "continuity-kit.html": ["תיק רציפות", "רציפות בכיתה: תיק הפעלה למורה המחליפה, ומסלול הצטרפות וחזרה לתלמידים"],
    "routines-hub.html": ["מרכז שגרות ויוזמות חברתיות", "קבוצה מפעילה מנגנון חברתי קבוע: בוחרת פעולה, מאשרת אחריות, מנסה פעמיים ופותחת את ההסכם לשינוי"],
    "shared-dialogue-lab.html": ["מעבדת שיח וחקר משותף", "קבוצה חוקרת שאלה בתחום הדעת: בונה טענות, בודקת ראיות ומתקנת יחד, והמורה מאשרת"],
    "team-thinking.html": ["חשיבת צוות", "צוות חושב יחד על אתגר: כל הקולות, נימוקים בעד ונגד, פרגון, ומה הרווחנו מהחשיבה ביחד"],
    "family-bridge.html": ["גשר בין הבית לכיתה", "המשפחה והצוות בונים יחד שגרת קשר: כל משפחה בוחרת את הדרך שנוחה לה, ויחד מחליטים על הצעד הבא, בכיתה ובבית"],
    "resilience-team.html": ["מיפוי חוסן חברתי", "שאלון לכיתה, תמונת מצב והמלצות"],
    "conversation-planner.html": ["תכנון שיחה", "הכנה לשיחה מאתגרת: איך פותחים, מה שואלים ואיך מסיימים"],
    "activity-planner.html": ["תכנון פעילות", "מערך למפגש או לרצף מפגשים: מטרות, מהלך וזמנים"],
    "academic-review.html": ["משוב לעבודות", "משוב לעבודה לפני הגשה, לפי קריטריונים"],
    "journey.html": ["מסע אל החוסן", "מיפוי, החלטות, פעולה ולמידה לפיתוח חוסן"],
    "practice.html": ["תרגול לפי תרחיש", "שיחה מול דמות, ומשוב על מה שעבד ומה אפשר לנסות אחרת"],
    "feedback-results.html": ["משוב הסדנה", "מה המשתתפות כתבו על הסדנה"],
    "practice-crossings.html": ["תרגול לפי תרחיש", "רגעים שבהם השיחה חצתה קו אדום"],
    // מעבדת האופק (28/10/2026): חוסן מול עתיד לא ידוע. הדפים נטענים בלי הקובץ הזה; מעבדת הדמו טוענת אותו כדי להפיק את התוצר.
    "hl-voice.html": ["מעבדת האופק: קול הקהילה", "ראיונות עם הקהילה על העתיד, מסמך סוגיות וסבבי דירוג"],
    "hl-radar.html": ["מעבדת האופק: רדאר החוסן החברתי", "אותות ומניעי שינוי שישפיעו על החוסן החברתי, ומה עושים עם כל אחד"],
    "hl-futures.html": ["מעבדת האופק: מחולל העתידים", "ארבעה עולמות אפשריים, ומה כדאי לעשות כבר היום"],
    "hl-circles.html": ["מעבדת האופק: מעגלי העתיד", "השלכות של אירוע אחד, מעגל אחרי מעגל, ומה עושים איתן"],
    "hl-horizons.html": ["מעבדת האופק: שלושה אופקים", "מה דועך, מה לשמור ואילו זרעים של העתיד כבר כאן"],
    "hl-collage.html": ["מעבדת האופק: תמונת עתיד קבוצתית", "כל אחד ואחת תורמים פריט, וביחד נבנית תמונת עתיד אחת"],
    "hl-roadmap.html": ["מעבדת האופק: מהחזון להיום", "חזון, דרך אחורה מהעתיד, והצעדים הראשונים"],
    "hl-game.html": ["מעבדת האופק: רואים את האופק", "משחק החלטות בעולם עתידי, ותחקיר עם לקחים וצעדים"],
    "hl-stress.html": ["מעבדת האופק: בדיקת עמידות", "בדיקה של תוכנית קיימת מול עולמות עתידיים ואירועי לחץ"]
  };
  function toolInfo(page) {
    const here = typeof location !== "undefined" && location.pathname ? location.pathname.split("/").pop() : "";
    const f = String(page || here || "").split("?")[0];
    const t = TOOLS[f]; return t ? { name: t[0], purpose: t[1] } : null;
  }
  function today() { return new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
  // שם הקובץ כשנשמר כ-PDF (הדפדפן לוקח אותו מכותרת המסמך): הכלי · התוצר · התאריך, בלי תווים שאסורים בשם קובץ
  function fileTitle(title, tool, kind) {
    const t = tool === undefined ? toolInfo() : tool;
    const clean = (x) => String(x || "").replace(/\s*:\s*/g, " · ").replace(/[\\/*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    const parts = [];
    if (t && !clean(title).startsWith(t.name)) parts.push(t.name);
    if (kind) parts.push(clean(kind));
    parts.push(clean(title) || "תוצר");
    parts.push(today().replace(/\./g, "-"));
    return parts.join(" · ") + " · Begood";
  }
  function ctxHTML(tool) {
    const t = tool === undefined ? toolInfo() : tool;
    return t ? `<div class="ctx"><b>${esc(t.name)}</b> · ${esc(t.purpose)}</div>` : "";
  }
  // דפים שמדפיסים את עצמם (פרקטי, נוגי, מיפוי חוסן חברתי): כותרת הקשר שמופיעה רק בהדפסה, ושם קובץ ברור
  // node (12/10/2026: "מעוצבים כמוצר למכירה בחנות"): התוצר מודפס במסמך ההדפסה המעוצב (לוגו, גופני המותג, מספרי עמודים),
  // עם עיצוב הכלי, כמו כל שאר התוצרים. בלי node: הדפסת הדף עצמו, כמו קודם.
  function printPage({ title, node }) {
    if (node) {
      const css = [...document.querySelectorAll("style")].map((x) => x.textContent).join("\n") +
        "\nhtml,body{height:auto!important;overflow:visible!important}.no-print,.sbe-sysonly{display:none!important}" +
        // בלי קופסאות אפורות בהדפסה (12/10/2026, בדיקת הלקוחה)
        "\n.lens,.layers,.intro,.sum-intro,.rw-new,.act-r{background:none!important;border:0!important;padding:0!important;box-shadow:none!important}";
      return print({ title, node, extraCss: css });
    }
    const t = toolInfo();
    let head = document.getElementById("sbe-print-ctx");
    if (!head) {
      const st = document.createElement("style");
      st.textContent = "#sbe-print-ctx{display:none}@media print{#sbe-print-ctx{display:block;border-bottom:2px solid #2E5A7D;padding-bottom:8px;margin-bottom:14px;font-family:Assistant,Arial,sans-serif;color:#141C24}#sbe-print-ctx .ctx{font-size:13px;color:#2E5A7D}#sbe-print-ctx .ttl{font-size:20px;font-weight:700;margin:2px 0}#sbe-print-ctx .dt{font-size:12px;color:#5C6771}}";
      document.head.appendChild(st);
      head = document.createElement("div"); head.id = "sbe-print-ctx"; document.body.prepend(head);
    }
    head.innerHTML = ctxHTML(t) + `<div class="ttl">${esc(title || "")}</div><div class="dt">${esc(today())}</div>`;
    preparePrint(document);
    const old = document.title; document.title = fileTitle(title, t);
    const back = () => { document.title = old; window.removeEventListener("afterprint", back); };
    window.addEventListener("afterprint", back);
    window.print();
    setTimeout(back, 60000);
  }

  // toHtml (12/10/2026: "ל PDF תגיע רק עריכה עם לוגו"): מחזיר את מסמך ההדפסה כטקסט במקום לפתוח חלון,
  // כדי שמעבדת הדמו תשמור בדיוק את מה שהכלי מדפיס (לוגו, כותרת, תאריך ורק התוצר). extraCss: עיצוב הכלי, לפני עיצוב ההדפסה.
  function print({ title, subtitle, kind, node, nodes, inline = false, landscape = false, pocket = false, toHtml = false, extraCss = "" }) {
    const parts = (nodes || [node]).filter(Boolean).map((n) => {
      const c = n.cloneNode(true);
      if (window.SBE_REFS && SBE_REFS.forPrint) SBE_REFS.forPrint(c); // מקורות: רק כשבחרו "צירוף המקורות לקובץ"
      else c.querySelectorAll(".sbe-refs:not(.attach)").forEach((x) => x.remove());
      c.querySelectorAll("button,.sbe-edit-hint,.no-print,style,script,.banner-mini,.savenote,.mock-note,.sbe-sysonly,[data-status-line],.sbe-peek").forEach((x) => x.remove());
      c.querySelectorAll("table.rtable").forEach((t) => t.classList.add("kit-table")); // טבלאות SBE_TABLE — אותו עיצוב בהדפסה
      [c, ...c.querySelectorAll("[contenteditable]")].forEach((x) => { x.removeAttribute("contenteditable"); x.removeAttribute("spellcheck"); x.classList.remove("sbe-edit"); });
      keepWithHeadings(c);
      return c.outerHTML;
    }).join("");
    const logo = logoSrc();
    const date = new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
    let w, out = null;
    if (toHtml) {
      out = ""; w = { document: { write: (x) => { out += x; }, close() {} } };
    } else if (inline) {
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
    if (!w) { alert("הדפדפן חסם את חלון ההדפסה. אפשר לאפשר חלונות קופצים לאתר ולנסות שוב."); return; }
    w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(fileTitle(title, undefined, kind))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Frank+Ruhl+Libre:wght@700&display=swap">
${extraCss ? "<style>" + extraCss + "</style>" : ""}<style>
/* עיצוב של מוצר מוגמר (12/10/2026: "התוצרים ב PDF יהיו מעוצבים כמוצר למכירה בחנות"): גופני המותג, כותרת עם לוגו, מספרי עמודים */
@page{size:A4${landscape ? " landscape" : ""};margin:24mm 24mm;
  @bottom-center{content:"עמוד " counter(page) " מתוך " counter(pages);font:600 9pt Assistant,Arial,sans-serif;color:#5C6771}
  @bottom-right{content:"Begood · be-good.co.il";font:9pt Assistant,Arial,sans-serif;color:#8A949C}}
body{font-family:"Assistant","Segoe UI",Arial,sans-serif;color:#141C24;max-width:${landscape ? 1040 : 720}px;margin:24px auto;padding:0 16px;line-height:1.7;font-size:14.5px}
.hd{display:flex;justify-content:space-between;align-items:center;border-top:5px solid #2E5A7D;border-bottom:1px solid #CDD3D8;padding:14px 0 12px;margin-bottom:22px;gap:16px;position:relative}
.hd::after{content:"";position:absolute;top:-5px;left:0;width:22%;height:5px;background:#2BA39C;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hd img{height:74px}
.hd .dt{font-size:12.5px;color:#5C6771;margin-top:2px}
.hd .ctx{font-size:12.5px;color:#2E5A7D;margin:0 0 4px;letter-spacing:.01em}.hd .ctx b{font-weight:700}
h1{font-family:"Frank Ruhl Libre",Georgia,serif;font-size:26px;line-height:1.25;color:#1E3F5A;margin:0 0 4px;break-after:avoid}
.sub{color:#5C6771;margin:0 0 4px;font-size:13.5px}
h4,h3,h2{break-after:avoid;break-inside:avoid;font-size:15.5px;margin:22px 0 8px;color:#1E3F5A}
h2,h3,h4{padding-inline-start:10px;border-inline-start:4px solid #2BA39C}
.keep{break-inside:avoid;page-break-inside:avoid}
.keep-start+*{break-before:avoid;page-break-before:avoid}
h2+table tr:first-child,h3+table tr:first-child{break-before:avoid}
ul,ol{orphans:3;widows:3}
p,li{orphans:3;widows:3}
.draftbox,.rcard,.act,.session-card,.step-card,.claims-box,li{break-inside:avoid}
/* כרטיסי המסך (רקע, מסגרת, ריפוד) לא עוברים להדפסה: מסמך אחד נקי */
.card{background:none!important;border:0!important;box-shadow:none!important;padding:0!important;margin:0 0 6px!important;border-radius:0!important;break-inside:auto!important}
.draftbox{white-space:pre-line;border:1px solid #CDD3D8;border-radius:6px;padding:12px 14px;margin-bottom:12px}
.rcard{border:1px solid #CDD3D8;border-radius:8px;padding:12px 14px;background:none}
.rcard-row{margin-bottom:8px}.rcard-row b{display:block;font-size:12px;color:#5C6771}
.rcard-meta{font-size:12px;color:#5C6771;margin-bottom:8px}
.sbe-rich h4{font-size:15px}
.tree2-root,.tree2-row,.tree2-end{border:1px solid #CDD3D8;border-radius:6px;padding:8px 10px;margin-bottom:6px;break-inside:avoid}
.tree2-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.kit-table{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:13px;line-height:1.5}
.kit-table th,.kit-table td{border:1px solid #D5DCE2;padding:7px 9px;text-align:right;vertical-align:top}
.kit-table thead th{background:#2E5A7D;color:#fff;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kit-table tbody th{background:#EEF3F7;width:18%;font-weight:700;color:#1E3F5A;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kit-table tbody tr:nth-child(even) td{background:#FAFBFC;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kit-table tr{break-inside:avoid}.kit-table thead{display:table-header-group}
.kit-table p{margin:0 0 4px}.kit-table ul,.kit-table ol{margin:0;padding-inline-start:18px}
.kit-facts tbody th{width:12%}.kit-facts td{width:38%}
.kit-steps td:nth-child(1){width:13%}.kit-steps td:nth-child(2){width:27%}.kit-steps td:nth-child(3){width:27%}.kit-steps td:nth-child(4){width:15%}.kit-steps td:nth-child(5){width:18%}
.kit-steps tbody tr:nth-child(even) td{background:#FAFBFC}
.kit-close td{width:33%}.kit-close thead th{background:#4A6B5A}
.kit-flow td{width:33%}.kit-flow tr.ph th{background:#DCE7EF;color:#1E3F5A;text-align:right;font-size:14px;width:auto}.kit-flow tr.ph{break-after:avoid;page-break-after:avoid}
.kit-h{font-size:16px;color:#2E5A7D;margin:20px 0 4px}.kit-sub{margin:0 0 6px;font-size:13.5px}
.kit-min,.kit-muted{color:#5C6771;font-size:12px}.kit-session{break-before:auto}
.ft{margin-top:28px;border-top:1px solid #CDD3D8;padding-top:8px;font-size:11.5px;color:#5C6771}@media print{.ft{display:none}}
.bar{position:sticky;top:0;background:#fff;padding:8px 0;margin-bottom:10px;text-align:left}
p,li,dd,blockquote,td:not(.n):not(.ck){text-align:justify;text-justify:inter-word}
table tr>:first-child:nth-last-child(n+3)~td:not(.n):not(.ck),table tr>:first-child:nth-last-child(n+3)~td:not(.n):not(.ck) p,table tr>:first-child:nth-last-child(n+3)~td:not(.n):not(.ck) li,table tr>td:first-child:nth-last-child(n+3),table tr>td:first-child:nth-last-child(n+3) p,table tr>td:first-child:nth-last-child(n+3) li{text-align:start}table tr>td:first-child:nth-last-child(2),table tr>td:first-child:nth-last-child(2) p{text-align:start}
.bar button{font:inherit;font-weight:700;padding:7px 16px;border-radius:6px;border:1px solid #2E5A7D;background:#2E5A7D;color:#fff;cursor:pointer}
@media print{.bar{display:none}body{margin:0;max-width:none}}
${pocket ? POCKET_CSS : ""}</style></head><body>
${toHtml ? "" : '<div class="bar"><button onclick="window.print()">הדפסה / שמירה כ-PDF</button></div>'}
<div class="hd"><div>${ctxHTML()}<h1>${esc(title)}</h1>${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ""}<div class="dt">${esc(date)}</div></div><img src="${logo}" alt="Begood"></div>
${parts}
<div class="ft">הופק ב-Begood · be-good.co.il</div>
<script>var relaxTall=${relaxTall.toString()};var BRK_CSS=${JSON.stringify(BRK_CSS)};var repeatHeads=${repeatHeads.toString()};var RH_CSS=${JSON.stringify(RH_CSS)};function sbeRelax(){try{repeatHeads(document)}catch(e){}relaxTall(document,{widthMm:${landscape ? 249 : 162},heightMm:${landscape ? 162 : 249}})}
window.addEventListener("beforeprint",sbeRelax);${inline || toHtml ? "window.addEventListener('load',sbeRelax);" : "window.onload=function(){sbeRelax();setTimeout(function(){window.print()},300)}"}<\/script>
</body></html>`);
    w.document.close();
    if (toHtml) return out;
  }

  // גם בהדפסה ישירה מהדפדפן (Ctrl+P) בכל דף שטוען את הקובץ הזה
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("beforeprint", () => preparePrint(document));
  window.SBE_DOC = { rich, editable, print, ensureStyle, sections, table, flowTable, PHASES, toolInfo, fileTitle, ctxHTML, printPage, preparePrint, repeatHeads };
})();
