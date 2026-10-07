// נוצר אוטומטית מ-lib/doc-render.mjs על ידי lib/build-browser-lib.mjs — לא לערוך ידנית.
// window.SBE_DOC: { renderEduDocs(s), renderRoleDocs(s), page, card, tpCard, CSS, ... , MARK }
(function(){
// מנוע הרינדור של התוצרים — טהור, בלי תלות ב-Node או בדפדפן.
//
// אותו קובץ משמש בשלושה מקומות: build-docs.mjs (אנשי חינוך), build-role-docs.mjs
// (הורים/נוער), ו-narrative-doc.js (הגרסה לדפדפן, שנוצרת ממנו אוטומטית
// ב-build-browser-lib.mjs). לכן: אין כאן import, אין fs, אין document.
// כל מה שתלוי בסביבה (לוגו, כפתור הדיווח) מגיע דרך createRenderer(config).
//
// שני עקרונות שהוכרעו וממומשים כאן:
//   1. "התבנית נקבעת בקוד, לא בניסוח של המודל" (02/09/2026).
//   2. "הלקוחות אינם צריכים לראות את הרשימות... התוצר חייב להיות תחת הלוגו
//      ועם פרטים מזהים" (21/09/2026) — כל מסמך: לוגו מימין, תג סוג-המסמך,
//      שם התרחיש, כותרת משנה, שורת פרטים מזהים, קו, ואז פרוזה בגוף שני.
//      רשימות נשארות רק היכן שהן כלי תפעולי (מלאי התפניות, מיומנויות
//      לצפייה, שאלות לתחקיר). עקרונות הכתיבה: prompts/narrative-products.md.

const esc = (t) => String(t ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@700;900&family=Assistant:wght@300;400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">`;

const CSS = `
:root{
  --paper:#FFFFFF; --ink:#1A2129; --muted:#5E6872; --hair:#D8DCE0; --sub:#F4F5F6;
  --spoken:#2E5A7D; --spoken-bg:#F2F6F9;
  --hidden:#8F5F2E; --hidden-bg:#FAF5EE;
  --open:#3F6B52; --open-bg:#E7EFE9;
  --close:#8C3A34; --close-bg:#F7EAE8;
  --ground:#E9ECEE;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){ --ground:#12171B; }
}
:root[data-theme="dark"]{ --ground:#12171B; }
*{box-sizing:border-box;}
body{direction:rtl;background:var(--ground);margin:0;padding:26px 16px 60px;
  font-family:"Assistant","Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
.sheet{max-width:820px;margin:0 auto;background:var(--paper);color:var(--ink);
  border-radius:3px;box-shadow:0 8px 30px rgba(16,22,28,.16);overflow:hidden;
  font-size:15px;line-height:1.66;}
.lg{height:26px;width:auto;display:inline-block;}
@media print{.lg{height:22px;}}
.head{padding:24px 36px 18px;text-align:right;}
.badge{display:block;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--muted);margin:10px 0 14px;}
.ttl{font-family:"Frank Ruhl Libre",Georgia,serif;font-weight:900;font-size:27px;
  line-height:1.16;margin:0 0 5px;}
.sub{font-size:14.5px;color:var(--muted);margin:0 0 12px;}
.meta{font-size:12.5px;color:var(--muted);}
.meta b{color:var(--ink);font-weight:600;}
.meta span+span::before{content:" · ";}
.hr{border-top:2px solid var(--ink);margin:0 36px;}
@media print{.hr{margin-inline:0;}}
.body{padding:24px 36px 30px;}
.sec{margin-bottom:26px;}
.sec:last-child{margin-bottom:0;}
.h{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--muted);padding-bottom:6px;margin-bottom:12px;
  border-bottom:1px solid var(--hair);display:flex;justify-content:space-between;
  gap:12px;align-items:baseline;}
.h em{font-style:normal;font-family:inherit;font-size:12px;letter-spacing:0;text-transform:none;}
p{margin:0 0 11px;}
p:last-child{margin:0;}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;break-inside:avoid;}
.two>div{border:1px solid var(--hair);border-radius:4px;padding:13px 15px;}
.two .lh{font-size:12px;font-weight:700;margin-bottom:8px;padding-bottom:6px;
  border-bottom:1px solid var(--hair);}
.two .v{background:var(--spoken-bg);} .two .v .lh{color:var(--spoken);}
.two .x{background:var(--hidden-bg);} .two .x .lh{color:var(--hidden);}
.two ul{margin:0;padding-inline-start:17px;font-size:14px;}
.two li{margin-bottom:5px;}
.note{font-size:13px;color:var(--muted);margin-top:11px;}
.rows{display:flex;flex-direction:column;break-inside:avoid;}
.row{display:grid;grid-template-columns:124px 1fr;gap:0 15px;padding:10px 0;
  font-size:14.5px;line-height:1.62;break-inside:avoid;}
.row+.row{border-top:1px solid var(--hair);}
.row .k{font-size:12.5px;font-weight:600;color:var(--muted);padding-top:2px;}
.said{font-weight:600;color:var(--spoken);}
.tp{border:1px solid var(--hair);border-radius:4px;margin-bottom:11px;overflow:hidden;
  break-inside:avoid;}
.tp-h{display:flex;gap:9px;align-items:baseline;padding:9px 15px;background:var(--sub);
  border-bottom:1px solid var(--hair);flex-wrap:wrap;}
.tp-h b{font-size:14.5px;flex:1;min-width:150px;}
.tag{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.07em;
  padding:2px 8px;border-radius:3px;text-transform:uppercase;white-space:nowrap;}
.t-open{background:var(--open-bg);color:var(--open);}
.t-close{background:var(--close-bg);color:var(--close);}
.t-core{background:var(--spoken-bg);color:var(--spoken);}
.tp-b{padding:11px 15px;display:grid;grid-template-columns:80px 1fr;gap:5px 13px;
  font-size:14px;line-height:1.6;}
.tp-b .k{font-size:12.5px;color:var(--muted);font-weight:600;}
.br{margin-top:10px;padding-top:10px;border-top:1px dashed var(--hair);
  font-size:13.5px;line-height:1.55;break-inside:avoid;}
.br+.br{margin-top:8px;padding-top:8px;}
.br-if,.br-then{margin-bottom:3px;}
.br-then{margin-bottom:0;}
.br-who{font-weight:700;}
.br-if .br-who{color:var(--muted);}
.br-then .br-who{color:var(--spoken);}
.eff{font-family:"IBM Plex Mono",monospace;font-size:9.5px;padding:1px 7px;
  border-radius:3px;margin-inline-start:6px;}
.e-o{background:var(--open-bg);color:var(--open);}
.e-h{background:var(--sub);color:var(--muted);}
.e-c{background:var(--close-bg);color:var(--close);}
ol.list,ul.list{margin:0;padding-inline-start:19px;}
ol.list li,ul.list li{margin-bottom:7px;}
.marks{display:grid;grid-template-columns:1fr auto;gap:0;border:1px solid var(--hair);
  border-radius:4px;overflow:hidden;break-inside:avoid;}
.marks>div{padding:9px 14px;font-size:14px;border-bottom:1px solid var(--hair);}
.marks>div:nth-child(2n){text-align:center;color:var(--muted);font-size:12.5px;
  border-inline-start:1px solid var(--hair);white-space:nowrap;}
.marks>div:nth-last-child(-n+2){border-bottom:none;}
.dt{width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;margin:0 0 4px;}
.dt th,.dt td{border:1px solid var(--hair);padding:8px 11px;text-align:right;vertical-align:top;}
.dt thead th{background:#2E5A7D;color:#fff;font-weight:700;font-size:13px;}
.dt tbody th{background:var(--sub);width:22%;font-weight:700;font-size:13px;}
.dt p{margin:0 0 6px;} .dt p:last-child{margin:0;}
.dt ol,.dt ul{margin:0;padding-inline-start:17px;} .dt li{margin-bottom:4px;}
.dt td.n{width:32px;text-align:center;font-weight:700;}
.dt td.ck{width:64px;text-align:center;color:var(--muted);font-size:16px;}
.dt td.w{width:38%;}
.dt .tag{margin-inline-start:6px;}
.sec:has(.dt){break-inside:auto;}
.dt-sub{font-size:13px;color:var(--muted);margin-top:4px;}
.dt-cap{font-size:12.5px;font-weight:700;color:var(--muted);margin:14px 0 6px;}
.dt .eff{margin-inline-start:0;}
.red{border:1px solid #E0C4C1;background:#FAF0EF;border-radius:4px;
  padding:12px 15px;font-size:14px;color:#7A322D;}
.foot{border-top:1px solid var(--hair);padding:11px 36px;font-size:11.5px;
  color:var(--muted);display:flex;flex-direction:column;gap:3px;background:var(--sub);}
.foot-row{display:flex;justify-content:space-between;}
.foot-by{font-size:10px;}
@media(max-width:640px){
  .dt thead{display:none;}
  .dt,.dt tbody,.dt tr,.dt td,.dt tbody th{display:block;width:auto!important;}
  .dt tr{border:1px solid var(--hair);border-radius:6px;margin:0 0 8px;overflow:hidden;}
  .dt td,.dt tbody th{border:0;border-bottom:1px solid var(--hair);text-align:right!important;}
  .dt td.w{display:none;}
  .dt td.n{display:inline-block;border:0;padding-bottom:0;} .dt td.n::before{display:none!important;}
  .dt td.ck{display:inline-block;width:49%!important;border:0;} .dt td.ck::before{display:inline!important;margin-inline-end:8px;}
  .dt td[data-label]::before{content:attr(data-label);display:block;font-weight:700;font-size:12px;color:var(--muted);}
  .two{grid-template-columns:1fr;} .row,.tp-b,.br{grid-template-columns:1fr;gap:3px;}
  .head,.body,.foot{padding-inline:20px;}
}
@page{size:A4;margin:18mm 20mm;}
@media print{
  body{background:#fff;padding:0;}
  .sheet{box-shadow:none;max-width:none;border-radius:0;font-size:11pt;}
  .head,.body,.foot{padding-inline:0;}
  .sec{break-inside:avoid;}
  .dt{font-size:10pt;} .dt tr{break-inside:avoid;page-break-inside:avoid;} .dt thead{display:table-header-group;}
  .dt thead th,.dt tbody th{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .dt td.w{height:3.2em;}
  .no-print,#rptFab,#rptDlg,#navBar,#navPanel{display:none!important;}
  body.sbe-hasnav{padding-top:0;}
}
`;

const CARD_CSS = `
:root{--paper:#FFF;--ink:#151C24;--muted:#5E6872;--hair:#D3D8DC;--sub:#F3F5F6;
 --spoken:#2E5A7D;--hidden:#8F5F2E;--close:#8C3A34;--open:#3F6B52;--ground:#E9ECEE;}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#12171B;}}
:root[data-theme="dark"]{--ground:#12171B;}
*{box-sizing:border-box;}
body{direction:rtl;background:var(--ground);margin:0;padding:22px 14px 50px;
 font-family:"Assistant","Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
.card{max-width:560px;margin:0 auto;background:var(--paper);color:var(--ink);
 border-radius:4px;box-shadow:0 8px 26px rgba(16,22,28,.16);overflow:hidden;
 font-size:14.5px;line-height:1.5;}
.lg{height:20px;width:auto;display:block;flex:0 0 auto;}
.ch{padding:14px 20px 12px;border-bottom:2px solid var(--ink);display:flex;
 justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;}
.ch b{font-family:"Frank Ruhl Libre",Georgia,serif;font-size:19px;font-weight:900;}
.ch span{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.1em;
 text-transform:uppercase;color:var(--muted);}
.cb{padding:14px 20px 18px;}
.blk{margin-bottom:13px;}
.blk:last-child{margin-bottom:0;}
.lbl{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.12em;
 text-transform:uppercase;color:var(--muted);margin-bottom:4px;}
.big{font-size:16px;font-weight:700;color:var(--spoken);line-height:1.4;}
.stop{font-size:15px;font-weight:700;color:var(--close);line-height:1.4;}
.warm{font-size:15px;color:var(--hidden);line-height:1.45;}
.tl{display:flex;flex-direction:column;gap:0;border:1px solid var(--hair);border-radius:4px;overflow:hidden;}
.tl div{display:grid;grid-template-columns:20px 1fr auto;gap:0 10px;padding:7px 11px;
 font-size:13.5px;line-height:1.42;align-items:baseline;}
.tl div+div{border-top:1px solid var(--hair);}
.tl .n{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--muted);}
.tl .t{font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:.06em;
 padding:1px 6px;border-radius:3px;text-transform:uppercase;white-space:nowrap;}
.core{background:#E3EBF1;color:var(--spoken);} .cl{background:#F7EAE8;color:var(--close);}
.op{background:#E7EFE9;color:var(--open);}
ol.q,ul.q{margin:0;padding-inline-start:18px;font-size:13.5px;line-height:1.5;}
ol.q li,ul.q li{margin-bottom:5px;}
.free{border-top:1px solid var(--hair);margin-top:12px;padding-top:10px;
 font-size:12.5px;color:var(--muted);line-height:1.5;}
@page{size:A5;margin:10mm;}
@media print{body{background:#fff;padding:0;}.card{box-shadow:none;max-width:none;border-radius:0;font-size:10.5pt;}
 #rptFab,#rptDlg,#navBar,#navPanel{display:none!important;} body.sbe-hasnav{padding-top:0;}}
`;

// ── אבני הבניין של גוף המסמך ─────────────────────────────────────
const paras = (arr) => (Array.isArray(arr) ? arr : [arr]).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
const sec = (title, inner, hint = '') =>
  `<div class="sec"><div class="h"><span>${esc(title)}</span>${hint ? `<em>${esc(hint)}</em>` : ''}</div>${inner}</div>`;
const list = (items, ordered = false) => {
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag} class="list">${(items || []).map((x) => `<li>${esc(x)}</li>`).join('')}</${tag}>`;
};
const rows = (pairs) =>
  `<div class="rows">${pairs.map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span>${v}</span></div>`).join('')}</div>`;
// טבלה במסמך (07/10/2026, "קו אחיד"): head — כותרות (ולכל תא data-label, כדי שבטלפון שורה
// תיערם לכרטיס), או null — אז העמודה הראשונה היא תווית. התאים הם HTML מוכן (כבר עבר esc).
const dtable = (head, trs) =>
  `<table class="dt">${head ? `<thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${trs.map((r) =>
    `<tr>${r.map((v, i) => (!head && i === 0 ? `<th>${v}</th>` :
      `<td${head ? ` data-label="${esc(head[i])}"` : ''}${v === '' ? ' class="w"' : ''}>${v}</td>`)).join('')}</tr>`).join('')}</tbody></table>`;
const ol = (items) => list(items, true);
const red = (text) => sec('קו אדום', `<div class="red">${esc(text)}</div>`);
const blk = (l, html) => `<div class="blk"><div class="lbl">${esc(l)}</div>${html}</div>`;

// כרטיס נקודת תפנית, עם ענפי אם/אז מפורשים בשמות הדוברות.
//   t: { n, name, type, core, trigger, does, demands, missed,
//        branches: [{ move, says, effect, quality }] }
//   who:   מי עושה את "does" ומגיבה ב-"says" ("את" / "אתה" / שם)
//   other: מי עושה את "move" ("את" / "אתה" / שם)
function tpCard(t, who, other, opts = {}) {
  const effCls = (e) => (e === 'פותח' ? 'e-o' : e === 'סוגר' ? 'e-c' : 'e-h');
  const isPronoun = (x) => x === 'את' || x === 'אתה';
  const thenLabel = who === 'את' ? 'אז את מגיבה:' : who === 'אתה' ? 'אז אתה מגיב:' : `אז ${who}`;
  const askLabel = opts.ask || (isPronoun(other) ? 'מבקש ממך' : `מבקש מ${other}`);
  return `
<div class="tp">
  <div class="tp-h"><b>${t.n} · ${esc(t.name)}</b>
    ${t.core ? '<span class="tag t-core">ליבה</span>' : ''}
    <span class="tag ${/סגירה|ניתוק/.test(t.type || '') ? 't-close' : 't-open'}">${esc(t.type)}</span>
  </div>
  <div class="tp-b">
    <span class="k">הרגע</span><span>${esc(t.trigger)}</span>
    <span class="k">${esc(who)}</span><span class="said">${esc(t.does)}</span>
    <span class="k">${esc(askLabel)}</span><span>${esc(t.demands)}</span>
    <span class="k">אם זה לא קורה</span><span>${esc(t.missed)}</span>
    ${(t.branches || []).map((b) => `
    <div class="br" style="grid-column:1/-1">
      <div class="br-if"><span class="br-who">אם ${esc(other)}</span> ${esc(b.move)}</div>
      <div class="br-then"><span class="br-who">${esc(thenLabel)}</span> ${esc(b.says)}<span class="eff ${effCls(b.effect)}">${esc(b.effect)}</span> · <em>${esc(b.quality)}</em></div>
    </div>`).join('')}
  </div>
</div>`;
}

// נקודות התפנית בטבלאות (07/10/2026, "קו אחיד") — לגרסת השחקנית ולכרטיסי הדמות.
//   טבלה 1: # · התפנית והרגע · מה עושה · מה זה מבקש · אם זה לא קורה.
//   טבלה 2 (הענפים): # · אם… · אז… · לאן זה מוביל.
//   whoOf(t) / otherOf(t): מי עושה את "does" ומגיבה, ומי עושה את "move" ("את" / "אתה" / שם).
function tpTables(tps, { whoOf, otherOf, doLabel = 'מה את עושה', askLabel = 'מה זה מבקש ממנה' }) {
  const isPronoun = (x) => x === 'את' || x === 'אתה';
  const tag = (t) => (t.core ? '<span class="tag t-core">ליבה</span>' : '') +
    `<span class="tag ${/סגירה|ניתוק/.test(t.type || '') ? 't-close' : 't-open'}">${esc(t.type)}</span>`;
  const effCls = (e) => (e === 'פותח' ? 'e-o' : e === 'סוגר' ? 'e-c' : 'e-h');
  const num = (h) => h.replace(/<td data-label="#">/g, '<td class="n" data-label="#">');
  const main = dtable(['#', 'התפנית והרגע', doLabel, askLabel, 'אם זה לא קורה'], (tps || []).map((t) => {
    const who = whoOf(t);
    return [esc(t.n), `<b>${esc(t.name)}</b> ${tag(t)}<div class="dt-sub">${esc(t.trigger)}</div>`,
      `${isPronoun(who) ? '' : `<b>${esc(who)}:</b> `}<span class="said">${esc(t.does)}</span>`, esc(t.demands), esc(t.missed)];
  }));
  const br = [];
  (tps || []).forEach((t) => (t.branches || []).forEach((b) => {
    const who = whoOf(t), other = otherOf(t);
    const then = who === 'את' ? 'את מגיבה:' : who === 'אתה' ? 'אתה מגיב:' : `${who}:`;
    br.push([esc(t.n), `<b>אם ${esc(other)}</b> ${esc(b.move)}`, `<b>${esc(then)}</b> <span class="said">${esc(b.says)}</span>`,
      `<span class="eff ${effCls(b.effect)}">${esc(b.effect)}</span> ${b.quality ? `<em>${esc(b.quality)}</em>` : ''}`]);
  }));
  return num(main) + (br.length ? `<div class="dt-cap">אם… אז… — איך כל תפנית יכולה להתגלגל</div>` +
    num(dtable(['#', 'אם…', 'אז…', 'לאן זה מוביל'], br)) : '');
}

// ── יצירת המרנדר עם התלויות הסביבתיות ────────────────────────────
//   config.MARK           data-URI של הלוגו
//   config.REPORT_WIDGET  HTML של כפתור הדיווח (או "" בדפדפן/בתצוגה מקדימה)
//   config.GUARD          סקריפט שמירת ההרשאות (או "" בדפדפן/בתצוגה מקדימה)
function createRenderer(config) {
  const MARK = config.MARK || '';
  // שני הרכיבים הגלובליים של app/ — תפריט הניווט ("→ חזרה / ☰ תפריט") וכפתור
  // הדיווח — מוצמדים לכל תוצר מודפס בבנייה. עד 21/09/2026 הם נדרסו בכל הרצה
  // של build-docs.mjs והוחזרו ידנית (הדיווח) או נשכחו (התפריט — נעלם מארבעת
  // המסמכים בלי שאיש שם לב). מ-print CSS הם מוסתרים, כך שה-PDF נקי.
  const WIDGET = (config.NAV_WIDGET || '') + (config.REPORT_WIDGET || '');
  const GUARD = config.GUARD || '';

  function page(scn, { badge, meta, body }) {
    const byline = [scn.creator, scn.date, scn.institution].filter(Boolean).map(esc).join(' · ');
    return `<meta charset="UTF-8">
<title>${esc(scn.name)} · ${esc(badge)}</title>
${GUARD}
${FONTS}
<style>${CSS}</style>
<div class="sheet">
  <div class="head">
    <img class="lg" src="${MARK}" alt="Begood">
    <p class="badge">${esc(badge)}</p>
    <p class="ttl">${esc(scn.name)}</p>
    <p class="sub">${esc(scn.subtitle)}</p>
    <div class="meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>
  </div>
  <div class="hr"></div>
  <div class="body">${body}</div>
  <div class="foot">
    <div class="foot-row"><span>Begood · חינוך מבוסס סימולציה · ${esc(scn.id)}</span><span>${esc(badge)}</span></div>
    ${byline ? `<div class="foot-by">${byline}</div>` : ''}
  </div>
</div>
${WIDGET}`;
  }

  function card(scn, badge, title, inner) {
    return `<meta charset="UTF-8">
<title>${esc(scn.name)} · ${esc(badge)}</title>
${GUARD}
${FONTS}
<style>${CARD_CSS}</style>
<div class="card"><div class="ch"><b>${esc(title)}</b><span style="display:flex;align-items:center;gap:10px"><img class="lg" src="${MARK}" alt="Begood">${esc(badge)} · ${esc(scn.duration)} דק׳</span></div>
<div class="cb">${inner}</div></div>
${WIDGET}`;
  }

  // ── מסלול אנשי חינוך: ארבעה מסמכים מ-scenario.json ──
  function renderEduDocs(s) {
    const baseMeta = [`<b>${esc(s.duration)}</b> דקות`, esc(s.age), `גישה חינוכית: ${esc(s.approach)}`, esc(s.id)];
    const redLine = () => red(s.redLine);
    const tr = s.trainee, a = s.actor, f = s.facilitator;
    const actorFirstName = String(a.nameAndAge || '').split(',')[0];

    // גרסת המתנסה — אך ורק מה שגלוי לה. אין רובד סמוי, אין תפניות, אין תחקיר.
    const trainee = page(s, {
      badge: 'גרסת המתנסה',
      meta: [`<b>${esc(tr.role)}</b>`, ...baseMeta],
      body:
        sec('סיפור המקרה ונתוני פתיחה', paras(tr.opening)) +
        (tr.stakesForTrainee ? sec('מה על הפרק בשבילך', `<p>${esc(tr.stakesForTrainee)}</p>`) : '') +
        redLine(),
    });

    const actor = page(s, {
      badge: 'גרסת השחקנית',
      meta: [`<b>${esc(a.nameAndAge)}</b>`, esc(a.role), `קונפליקט ${esc(s.conflictType)}`, ...baseMeta],
      body:
        sec('מי את', dtable(null, [
          ['מי את היום', paras(a.portrait)],
          ['מה קרה, מנקודת מבטך', paras(a.story)],
          ['מה את מבקשת, ומה את לא אומרת', paras(a.askAndBeneath)],
          ['מי יושבת מולך', paras(tr.portraitForActor)],
        ]), 'לדעת מי היא — לא כדי לרחם עליה, כדי להוביל') +
        sec('מה פותח אותך, ומה סוגר', dtable(null, [
          ['מה פותח אותך', paras(a.opens)],
          ['מה שאת יודעת והיא לא', paras(a.knows)],
          ['מה שהיא יודעת ואת לא', paras(a.doesntKnow)],
          ['הסתירה שבך', paras(a.contradiction)],
        ].filter((r) => r[1]))) +
        sec('חמש נקודות התפנית', tpTables(s.turningPoints, { whoOf: () => 'את', otherOf: () => tr.role }),
          'מלאי, לא רצף. בחמש דקות יקרו שתיים') +
        sec('איך זה מתגלגל ואיך זה נגמר', dtable(null, [
          ['איך חמש הדקות יכולות להתגלגל', paras(a.arc)],
          ['איך זה יכול להיגמר', paras(a.endingsProse)],
          ['אם היא עושה משהו שאינו כאן', `<p>שאלי את עצמך מה ${esc(actorFirstName)} תעשה לנוכח החשש שלה, ולכי לשם. חמש התפניות הן מלאי ולא כלוב.</p>`],
        ].filter((r) => r[1]))) +
        redLine(),
    });

    const facilitator = page(s, {
      badge: 'גרסת המנחה',
      meta: [`<b>${esc(s.creator)}</b>`, esc(s.date), esc(s.audience), esc(s.experience), ...baseMeta],
      body:
        sec('תמצית התרחיש', dtable(null, [
          ['רקע מלא', paras(f.background)],
          ['שתי הדמויות', paras(f.charactersProse)],
          ['מה הגישה החינוכית אומרת', paras(f.approachInScenario)],
          ['הדינמיקה הצפויה', paras(f.dynamics)],
        ]), s.approach) +
        sec('נקודות התפנית',
          dtable(['#', 'התפנית', 'הרגע', 'מה זה מבקש מהמתנסה', 'אם זה לא קורה'], (s.turningPoints || []).map((t) => [
            esc(t.n), `<b>${esc(t.name)}</b>${t.core ? '<span class="tag t-core">ליבה</span>' : ''}`, esc(t.trigger), esc(t.demands), esc(t.missed),
          ])).replace(/<td data-label="#">/g, '<td class="n" data-label="#">'),
          'תפניות הליבה מסומנות. בחמש דקות יקרו שתיים, אולי שלוש') +
        sec('מה לראות בצפייה',
          dtable(['#', 'מיומנות לאימון', 'נצפה', 'לא נצפה'], (f.skills || []).map((k, i) => [String(i + 1), esc(k), '☐', '☐']))
            .replace(/<td data-label="#">/g, '<td class="n" data-label="#">').replace(/<td data-label="(נצפה|לא נצפה)">/g, '<td class="ck" data-label="$1">') +
          ((f.watchFor || []).length ? dtable(['נקודה לצפייה', 'מה ראיתי'], f.watchFor.map((w) => [esc(w), ''])) : ''),
          'המיומנויות מהטקסונומיה — אלה שיופיעו בדף הצפייה') +
        sec('שאלות לשיחה', dtable(['מתי', 'השאלות'], [
          ['לפני הצפייה — שיחה מקדימה', ol(f.preQuestions)],
          ['תחקיר — אחרי הצפייה', ol((f.debrief || []).concat(['מה קידם את המפגש?', 'מה גרע מהמפגש?']))],
          ['רפלקציה', ol(f.reflection)],
        ].filter((r) => /<li>/.test(r[1])).map(([k, v]) => [`<b>${esc(k)}</b>`, v]))) +
        sec('מקורות להרחבה',
          (f.sources || []).length
            ? list(f.sources)
            : `<p class="note">לא נבחרו מקורות מהספרייה לתרחיש זה. <b>המערכת אינה כותבת מקורות</b>, ולכן סעיף ריק עדיף על מקור שאינו קיים.</p>`) +
        redLine(),
    });

    const tline = (t) => `<div><span class="n">${t.n}</span><span>${esc(t.name)} — ${esc(t.demands)}</span>` +
      `<span class="t ${t.core ? 'core' : /סגירה|ניתוק/.test(t.type || '') ? 'cl' : 'op'}">${t.core ? 'ליבה' : esc(t.type)}</span></div>`;
    const tic = (a.visible || []).find((v) => String(v).includes('"')) || '';
    const wontSay = ((a.hidden || []).find((h) => String(h).startsWith('לא תגידי')) || '').replace(/^לא תגידי:\s*/, '');
    const entrance = a.entrance || {};
    const cardActor = card(s, 'כרטיס שחקנית', a.nameAndAge,
      blk('פתיחה', `<p style="margin:0">${esc(entrance.posture)} · ${esc(entrance.doing)}</p>
    <p style="margin:5px 0 0" class="big">${esc(entrance.firstLine)}</p>`) +
      blk('הביטוי החוזר שלך', `<div class="big">${esc(tic)}</div>`) +
      blk('לא תגידי בשום מצב', `<div class="stop">${esc(wontSay)}</div>`) +
      blk('בלחץ שלישי יוצא רק זה', `<div class="warm">${esc(a.valve)}</div>`) +
      blk('נפתחת כש', `<p style="margin:0">${esc(a.opens)}</p>`) +
      blk('מולך', `<p style="margin:0">${esc(tr.role)}${tr.seniority ? ', ' + esc(tr.seniority) : ''}. ${esc((tr.traits || [])[1] || (tr.traits || [])[0] || '')}</p>
    <ul class="q" style="margin-top:5px">${(tr.likelyMoves || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`) +
      blk('חמש התפניות', `<div class="tl">${(s.turningPoints || []).map(tline).join('')}</div>`) +
      blk('סיומים', `<ul class="q">${(s.endings || []).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`) +
      `<div class="free">אם היא עושה משהו שאינו כאן: שאלי מה ${esc(actorFirstName)} תעשה לנוכח החשש שלה, ולכי לשם. <b>המפה היא מלאי ולא כלוב.</b></div>`);

    // בדיקת דלף על גרסת המתנסה — אותה בדיקה שרצה ברתמה.
    const secrets = [
      a.knows, a.valve, a.contradiction, a.opens,
      ...(a.hidden || []), ...(s.turningPoints || []).map((t) => t.does),
      ...(tr.hiddenEmotions || []), ...(tr.hiddenNeeds || []), ...(tr.likelyMoves || []),
    ];
    const norm = (t) => String(t).replace(/\s+/g, ' ').trim();
    const flat = norm(trainee.replace(/<[^>]+>/g, ' '));
    const leaked = secrets.filter((x) => x && norm(x).length > 12 && flat.includes(norm(x)));

    return {
      files: [
        ['doc-trainee.html', trainee, 'גרסת המתנסה'],
        ['doc-actor.html', actor, 'גרסת השחקנית'],
        ['doc-facilitator.html', facilitator, 'גרסת המנחה'],
        ['card-actor.html', cardActor, 'כרטיס שחקנית'],
      ],
      leaked,
    };
  }

  // ── מסלולי הורים / נוער: תסריט + כרטיס דמות לכל אחת מהשתיים ──
  function renderRoleDocs(s) {
    const byKey = Object.fromEntries(s.characters.map((c) => [c.key, c]));
    const meta = [`<b>${esc(s.creator)}</b>`, esc(s.institution), esc(s.date), `<b>${esc(s.duration)}</b> דקות`,
      esc(s.age), esc(s.approach), esc(s.id)];
    const approachShort = String(s.approach || '').replace(/\s*\(.*\)\s*$/, '');
    const isParents = s.track === 'parents';
    const otherOf = (key) => s.characters.find((c) => c.key !== key);

    const tpThird = (t) => tpCard(t, byKey[t.who].name, otherOf(t.who).name);

    const scenario = page(s, {
      badge: s.scenarioBadge,
      meta,
      body:
        sec('מה קורה כאן', paras(s.background)) +
        s.characters.map((c) => sec(c.name, paras(c.summary))).join('') +
        sec(isParents ? 'מה הגישה אומרת בערב הזה' : 'מה הגישה אומרת בשיחה הזאת', paras(s.approachText), approachShort) +
        sec('איך חמש הדקות יכולות להתגלגל', paras(s.arc)) +
        sec('חמש נקודות התפנית', (s.turningPoints || []).map(tpThird).join(''), 'מלאי, לא רצף') +
        sec('איך זה יכול להיגמר', `<p>${esc(s.endingsProse)}</p>`) +
        sec('מה לראות ומה לשאול', dtable(['נקודה לצפייה', 'מה ראיתי'], (s.watch || []).map((w) => [esc(w), ''])) +
          ((s.debrief || []).length ? dtable(['מתי', 'השאלות'], [['<b>תחקיר — אחרי הצפייה</b>', ol(s.debrief)]]) : '')) +
        red(s.redLine),
    });
    const files = [[`${s.outputs.scenario}.html`, scenario, s.scenarioBadge]];

    for (const c of s.characters) {
      const html = page(s, {
        badge: c.badge,
        meta,
        body:
          sec(c.pronoun === 'אתה' ? 'מי אתה' : 'מי את', dtable(null, [
            [c.pronoun === 'אתה' ? 'מי אתה היום' : 'מי את היום', paras(c.portrait)],
            ...(c.extra ? [[esc(c.extra.title), paras(c.extra.paras)]] : []),
            ...(c.facing ? [['מי מולך', paras(c.facing)]] : []),
          ])) +
          sec('חמש נקודות התפנית', tpTables(s.turningPoints, {
            whoOf: (t) => (t.who === c.key ? c.pronoun : byKey[t.who].name),
            otherOf: (t) => (otherOf(t.who).key === c.key ? c.pronoun : otherOf(t.who).name),
            doLabel: 'מה קורה מצד הדמות', askLabel: 'מה זה מבקש',
          }), 'מלאי, לא רצף') +
          sec('איך זה מתגלגל ואיך זה נגמר', dtable(null, [
            [isParents ? 'איך הערב יכול להתגלגל' : 'איך השיחה יכולה להתגלגל', paras(s.arc)],
            ['איך זה יכול להיגמר', paras(s.endingsProse)],
          ])) +
          red(s.redLine),
      });
      files.push([`${s.outputs.cards[c.key]}.html`, html, c.badge]);
    }
    return { files };
  }

  return { page, card, renderEduDocs, renderRoleDocs, esc, sec, paras, list, rows, dtable, tpTables, red, blk, tpCard, CSS, CARD_CSS, FONTS };
}

var R = createRenderer({ MARK: "data:image/webp;base64,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", REPORT_WIDGET: '' });
R.MARK = "data:image/webp;base64,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";
window.SBE_DOC = R;
})();
