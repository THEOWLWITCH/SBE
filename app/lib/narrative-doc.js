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
.red{border:1px solid #E0C4C1;background:#FAF0EF;border-radius:4px;
  padding:12px 15px;font-size:14px;color:#7A322D;}
.foot{border-top:1px solid var(--hair);padding:11px 36px;font-size:11.5px;
  color:var(--muted);display:flex;flex-direction:column;gap:3px;background:var(--sub);}
.foot-row{display:flex;justify-content:space-between;}
.foot-by{font-size:10px;}
@media(max-width:640px){
  .two{grid-template-columns:1fr;} .row,.tp-b,.br{grid-template-columns:1fr;gap:3px;}
  .head,.body,.foot{padding-inline:20px;}
}
@page{size:A4;margin:14mm;}
@media print{
  body{background:#fff;padding:0;}
  .sheet{box-shadow:none;max-width:none;border-radius:0;font-size:11pt;}
  .head,.body,.foot{padding-inline:0;}
  .sec{break-inside:avoid;}
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

// ── יצירת המרנדר עם התלויות הסביבתיות ────────────────────────────
//   config.MARK           data-URI של הלוגו
//   config.REPORT_WIDGET  HTML של כפתור הדיווח (או "" בדפדפן/בתצוגה מקדימה)
function createRenderer(config) {
  const MARK = config.MARK || '';
  // שני הרכיבים הגלובליים של app/ — תפריט הניווט ("→ חזרה / ☰ תפריט") וכפתור
  // הדיווח — מוצמדים לכל תוצר מודפס בבנייה. עד 21/09/2026 הם נדרסו בכל הרצה
  // של build-docs.mjs והוחזרו ידנית (הדיווח) או נשכחו (התפריט — נעלם מארבעת
  // המסמכים בלי שאיש שם לב). מ-print CSS הם מוסתרים, כך שה-PDF נקי.
  const WIDGET = (config.NAV_WIDGET || '') + (config.REPORT_WIDGET || '');

  function page(scn, { badge, meta, body }) {
    const byline = [scn.creator, scn.date, scn.institution].filter(Boolean).map(esc).join(' · ');
    return `<meta charset="UTF-8">
<title>${esc(scn.name)} · ${esc(badge)}</title>
${FONTS}
<style>${CSS}</style>
<div class="sheet">
  <div class="head">
    <img class="lg" src="${MARK}" alt="S.B.E">
    <p class="badge">${esc(badge)}</p>
    <p class="ttl">${esc(scn.name)}</p>
    <p class="sub">${esc(scn.subtitle)}</p>
    <div class="meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>
  </div>
  <div class="hr"></div>
  <div class="body">${body}</div>
  <div class="foot">
    <div class="foot-row"><span>S.B.E · חינוך מבוסס סימולציה · ${esc(scn.id)}</span><span>${esc(badge)}</span></div>
    ${byline ? `<div class="foot-by">${byline}</div>` : ''}
  </div>
</div>
${WIDGET}`;
  }

  function card(scn, badge, title, inner) {
    return `<meta charset="UTF-8">
<title>${esc(scn.name)} · ${esc(badge)}</title>
${FONTS}
<style>${CARD_CSS}</style>
<div class="card"><div class="ch"><b>${esc(title)}</b><span style="display:flex;align-items:center;gap:10px"><img class="lg" src="${MARK}" alt="S.B.E">${esc(badge)} · ${esc(scn.duration)} דק׳</span></div>
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
        sec('מי את היום', paras(a.portrait)) +
        sec('מה קרה, מנקודת מבטך', paras(a.story)) +
        sec('מה את מבקשת, ומה את לא אומרת', paras(a.askAndBeneath)) +
        sec('מי יושבת מולך', paras(tr.portraitForActor), 'לדעת מי היא — לא כדי לרחם עליה, כדי להוביל') +
        sec('מה פותח אותך, ומה סוגר', `<p>${esc(a.opens)}</p>
      <p>מה שאת יודעת והיא לא: ${esc(a.knows)} ומה שהיא יודעת ואת לא: ${esc(a.doesntKnow)}</p>
      <p>${esc(a.contradiction)}</p>`) +
        sec('איך חמש הדקות יכולות להתגלגל', paras(a.arc)) +
        sec('חמש נקודות התפנית', (s.turningPoints || []).map((t) => tpCard(t, 'את', tr.role, { ask: 'מבקש ממנה' })).join(''),
          'מלאי, לא רצף. בחמש דקות יקרו שתיים') +
        sec('איך זה יכול להיגמר', `<p>${esc(a.endingsProse)}</p>`) +
        sec('אם היא עושה משהו שאינו כאן',
          `<p>שאלי את עצמך מה ${esc(actorFirstName)} תעשה לנוכח החשש שלה, ולכי לשם. חמש התפניות הן מלאי ולא כלוב.</p>`) +
        redLine(),
    });

    const facilitator = page(s, {
      badge: 'גרסת המנחה',
      meta: [`<b>${esc(s.creator)}</b>`, esc(s.date), esc(s.audience), esc(s.experience), ...baseMeta],
      body:
        sec('רקע מלא', `<p>${esc(f.background)}</p>`) +
        sec('שתי הדמויות', paras(f.charactersProse)) +
        sec('מה הגישה החינוכית אומרת בתרחיש הזה', `<p>${esc(f.approachInScenario)}</p>`, esc(s.approach)) +
        sec('הדינמיקה הצפויה', paras(f.dynamics), 'מה מכריע את חמש הדקות') +
        sec('מיומנויות לאימון',
          `<div class="marks">${(f.skills || []).map((k, i) => `<div><b>${i + 1}.</b> ${esc(k)}</div><div>נצפה · לא נצפה</div>`).join('')}</div>`,
          'מיומנויות מהטקסונומיה. אלה שיופיעו בדף הצפייה') +
        sec('נקודות לצפייה', list(f.watchFor)) +
        sec('שתי שאלות לשיחה המקדימה', list(f.preQuestions, true), 'לפני הצפייה, לא אחריה') +
        sec('שתי תפניות הליבה',
          `<ul class="list">${(s.turningPoints || []).filter((t) => t.core).map((t) => `<li><b>${t.n} · ${esc(t.name)}</b> — ${esc(t.demands)}</li>`).join('')}</ul>`,
          'בחמש דקות יקרו שתיים, אולי שלוש') +
        sec('שאלות לתחקיר', list((f.debrief || []).concat(['מה קידם את המפגש?', 'מה גרע מהמפגש?']), true)) +
        sec('שאלות לרפלקציה', list(f.reflection, true)) +
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
    const tpFor = (x) => (t) => {
      const who = byKey[t.who], other = otherOf(t.who);
      return tpCard(t, who.key === x.key ? x.pronoun : who.name, other.key === x.key ? x.pronoun : other.name);
    };

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
        sec('נקודות לצפייה', list(s.watch)) +
        sec('שאלות לתחקיר', list(s.debrief, true)) +
        red(s.redLine),
    });
    const files = [[`${s.outputs.scenario}.html`, scenario, s.scenarioBadge]];

    for (const c of s.characters) {
      const html = page(s, {
        badge: c.badge,
        meta,
        body:
          sec(c.pronoun === 'אתה' ? 'מי אתה היום' : 'מי את היום', paras(c.portrait)) +
          (c.extra ? sec(c.extra.title, paras(c.extra.paras)) : '') +
          (c.facing ? sec('מי מולך', paras(c.facing)) : '') +
          sec(isParents ? 'איך הערב יכול להתגלגל' : 'איך השיחה יכולה להתגלגל', paras(s.arc)) +
          sec('חמש נקודות התפנית', (s.turningPoints || []).map(tpFor(c)).join(''), 'מלאי, לא רצף') +
          sec('איך זה יכול להיגמר', `<p>${esc(s.endingsProse)}</p>`) +
          red(s.redLine),
      });
      files.push([`${s.outputs.cards[c.key]}.html`, html, c.badge]);
    }
    return { files };
  }

  return { page, card, renderEduDocs, renderRoleDocs, esc, sec, paras, list, rows, red, blk, tpCard, CSS, CARD_CSS, FONTS };
}

var R = createRenderer({ MARK: "data:image/png;base64,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", REPORT_WIDGET: '' });
R.MARK = "data:image/png;base64,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";
window.SBE_DOC = R;
})();
