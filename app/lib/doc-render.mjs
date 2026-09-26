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

export const esc = (t) => String(t ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@700;900&family=Assistant:wght@300;400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">`;

export const CSS = `
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
  color:var(--muted);display:flex;justify-content:space-between;background:var(--sub);}
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

export const CARD_CSS = `
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
export const paras = (arr) => (Array.isArray(arr) ? arr : [arr]).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
export const sec = (title, inner, hint = '') =>
  `<div class="sec"><div class="h"><span>${esc(title)}</span>${hint ? `<em>${esc(hint)}</em>` : ''}</div>${inner}</div>`;
export const list = (items, ordered = false) => {
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag} class="list">${(items || []).map((x) => `<li>${esc(x)}</li>`).join('')}</${tag}>`;
};
export const rows = (pairs) =>
  `<div class="rows">${pairs.map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span>${v}</span></div>`).join('')}</div>`;
export const red = (text) => sec('קו אדום', `<div class="red">${esc(text)}</div>`);
export const blk = (l, html) => `<div class="blk"><div class="lbl">${esc(l)}</div>${html}</div>`;

// כרטיס נקודת תפנית, עם ענפי אם/אז מפורשים בשמות הדוברות.
//   t: { n, name, type, core, trigger, does, demands, missed,
//        branches: [{ move, says, effect, quality }] }
//   who:   מי עושה את "does" ומגיבה ב-"says" ("את" / "אתה" / שם)
//   other: מי עושה את "move" ("את" / "אתה" / שם)
export function tpCard(t, who, other, opts = {}) {
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
export function createRenderer(config) {
  const MARK = config.MARK || '';
  // שני הרכיבים הגלובליים של app/ — תפריט הניווט ("→ חזרה / ☰ תפריט") וכפתור
  // הדיווח — מוצמדים לכל תוצר מודפס בבנייה. עד 21/09/2026 הם נדרסו בכל הרצה
  // של build-docs.mjs והוחזרו ידנית (הדיווח) או נשכחו (התפריט — נעלם מארבעת
  // המסמכים בלי שאיש שם לב). מ-print CSS הם מוסתרים, כך שה-PDF נקי.
  const WIDGET = (config.NAV_WIDGET || '') + (config.REPORT_WIDGET || '');

  function page(scn, { badge, meta, body }) {
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
  <div class="foot"><span>S.B.E · חינוך מבוסס סימולציה · ${esc(scn.id)}</span><span>${esc(badge)}</span></div>
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
