// בונה את "תוצרי המערכת" (app/products/) — תוצרים שהופקו על ידי המודל מתוך
// המסכים עצמם. נוצר 23/09/2026, אחרי שהמשתמשת ביקשה: "תמחקי את כל התוצרים
// שיצרת לפני החיבור למודל - זה לא רלוונטי וזה היה רעיון רע. צור רשימת תוצרים
// לפי מסכים. צור את מה שניתן וציין מה אני חייבת לעשות ידנית."
// (התוצרים הקודמים — downloads/, all-products.html, scenarios/ — הועברו
// ל-archive/pre-model-products-2026-09-23/.)
//
//   node build-products.mjs
//
// קלט: products/data/manifest.json + הקבצים שהוא מפנה אליהם בתוך products/data/:
//   kind "edu"      — תרחיש בפורמט scenario.json (פלט הצינור) → ארבעה מסמכים
//   kind "role"     — תרחיש הורים/נוער (פלט "בנייה") → תסריט + שני כרטיסים
//   kind "snapshot" — מסמך HTML שלם שנשמר מהמסך (תכנון שיחה/פעילות, משוב) →
//                     מועתק כמו שהוא, עם תפריט הניווט וכפתור הדיווח
//   kind "links"    — תוצרים שכבר קיימים במקום אחר באתר (למשל ארבעת מסמכי
//                     "יש לך גן טוב", שנבנים ב-build-docs.mjs)
//   kind "manual"   — מסך שהתוצר שלו דורש אדם (שיחה, סדנה, משוב) — רק הסבר
// הרינדור עצמו: lib/doc-template.mjs — אותה תבנית בדיוק שמשמשת את המסכים.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderEduDocs, renderRoleDocs, NAV_WIDGET, REPORT_WIDGET, MARK, esc, FONTS } from './lib/doc-template.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'products');
const DATA = join(OUT, 'data');
mkdirSync(OUT, { recursive: true });

const manifest = JSON.parse(readFileSync(join(DATA, 'manifest.json'), 'utf8'));
const PRINT_HIDE = '<style>@media print{#navBar,#navPanel,#rptFab,#rptDlg{display:none!important}body.sbe-hasnav{padding-top:0!important}}</style>';

function withWidgets(html) {
  const inject = PRINT_HIDE + NAV_WIDGET + REPORT_WIDGET;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, inject + '</body>') : html + inject;
}

const built = [];   // לכל פריט במניפסט: [{label, href}]
for (const g of manifest.groups) {
  for (const it of g.items) {
    const links = [];
    if (it.kind === 'edu' || it.kind === 'role') {
      const s = JSON.parse(readFileSync(join(DATA, it.src), 'utf8'));
      const out = it.kind === 'edu' ? renderEduDocs(s) : renderRoleDocs(s);
      if (it.kind === 'edu' && out.leaked && out.leaked.length) console.log('⚠ דלף בגרסת המתנסה:', it.src, out.leaked[0]);
      for (const [file, html, label] of out.files) {
        const name = (it.prefix || '') + file;
        writeFileSync(join(OUT, name), html, 'utf8');
        links.push({ label, href: name });
      }
    } else if (it.kind === 'snapshot') {
      // צילום מתוך מסך ב-app/ — קישורים יחסיים (למשל sources-library.html?q=...) צריכים "../" מתוך products/
      const raw = readFileSync(join(DATA, it.src), 'utf8').replace(/href="(?![a-z]+:|\/|#|\.\.\/)([\w-]+\.html)/g, 'href="../$1');
      writeFileSync(join(OUT, it.out), withWidgets(raw), 'utf8');
      links.push({ label: it.linkLabel || 'פתיחה', href: it.out });
    } else if (it.kind === 'links') {
      for (const l of it.links) links.push({ label: l.label, href: l.href });
    }
    it._links = links;
    built.push(...links.map((l) => l.href));
  }
}

// ── עמוד הרשימה ────────────────────────────────────────────────────
const css = `
:root{--ink:#141C24;--muted:#5C6771;--hair:#CDD3D8;--ground:#EDEFF1;--surface:#FCFCFD;--spoken:#2E5A7D;--auto:#3E6E56;--auto-soft:#DFE9E2;--hidden:#8F5F2E;--hidden-soft:#F5EAD9}
*{box-sizing:border-box}
body{direction:rtl;margin:0;background:var(--ground);color:var(--ink);font-family:"Assistant","Segoe UI",system-ui,sans-serif;font-size:16px;line-height:1.6;padding:0 16px 60px}
.wrap{max-width:820px;margin:0 auto}
header{padding:30px 0 18px;border-bottom:2px solid var(--ink);margin-bottom:20px}
header img{height:44px;display:block;margin-bottom:12px}
h1{font-family:"Frank Ruhl Libre",Georgia,serif;font-weight:900;font-size:clamp(26px,5vw,36px);line-height:1.15;margin:0 0 8px}
.sub{color:var(--muted);margin:0;max-width:64ch}
h2{font-family:"Frank Ruhl Libre",Georgia,serif;font-size:18px;margin:28px 0 10px;padding-bottom:5px;border-bottom:1px solid var(--hair)}
.item{background:var(--surface);border:1px solid var(--hair);border-radius:10px;padding:13px 16px;margin-bottom:10px}
.item h3{font-size:16px;margin:0 0 4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.item p{margin:4px 0;font-size:14.5px}
.item .in{font-size:13.5px;color:var(--muted)}
.chip{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:12px;background:var(--auto-soft);color:var(--auto)}
.chip.man{background:var(--hidden-soft);color:var(--hidden)}
.links{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
.links a{font-size:13.5px;font-weight:600;color:var(--spoken);text-decoration:none;border:1px solid var(--spoken);border-radius:16px;padding:4px 12px}
.links a:hover{background:#DCE7EF}
footer{margin-top:30px;font-size:12.5px;color:var(--muted);border-top:1px solid var(--hair);padding-top:12px}`;

let body = `<header><img src="${MARK}" alt="S.B.E"><h1>תוצרי המערכת</h1>
<p class="sub">${esc(manifest.intro)}</p></header>`;
for (const g of manifest.groups) {
  body += `<h2>${esc(g.title)}</h2>`;
  for (const it of g.items) {
    const manual = it.kind === 'manual';
    body += `<div class="item"><h3>${esc(it.title)}<span class="chip${manual ? ' man' : ''}">${manual ? 'דורש הפעלה אנושית' : 'הופק על ידי המודל'}</span></h3>`;
    if (it.what) body += `<p>${esc(it.what)}</p>`;
    if (it.input) body += `<p class="in">הקלט: ${esc(it.input)}</p>`;
    if (it._links && it._links.length) body += `<div class="links">${it._links.map((l) => `<a href="${esc(l.href)}" target="_blank">${esc(l.label)}</a>`).join('')}</div>`;
    body += `</div>`;
  }
}
body += `<footer>${esc(manifest.footer || '')}</footer>`;

const index = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>תוצרי המערכת — S.B.E</title>${FONTS}<style>${css}</style></head><body><div class="wrap">${body}</div>${PRINT_HIDE}${NAV_WIDGET}${REPORT_WIDGET}</body></html>`;
writeFileSync(join(OUT, 'index.html'), index, 'utf8');
// הקישורים שנבנו, לפי שם התוצר — משמש את מסך הבדיקה (לשונית "תוצרים לפי מסכים")
const linkMap = {};
for (const g of manifest.groups) for (const it of g.items) linkMap[it.title] = it._links || [];
writeFileSync(join(DATA, '_links.json'), JSON.stringify(linkMap, null, 1), 'utf8');
console.log('products/index.html +', built.length, 'files:\n' + built.join('\n'));
