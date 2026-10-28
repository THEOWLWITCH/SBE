// ערכה משותפת למשחקי החוסן החדשים (22/10/2026): כלים קטנים שחוזרים בכל משחק, בלי עיצוב משותף
// (לכל משחק עיצוב משלו). לוגו בכל קלף ובכל לוח, הדפסה A4 עם שוליים של 24 מ"מ ומספרי עמודים.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SBE_GK = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const LOGO = 'assets/begood-logo-sm.webp', LOGO_BIG = 'assets/begood-logo.webp';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // ערבוב עם זרע קבוע: אותו לוח בינגו בכל הדפסה
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function shuffle(a, r) { const f = r || Math.random; const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  const logo = (cls) => `<img class="${cls || 'gk-logo'}" src="${LOGO}" alt="Begood">`;
  // כותרת לעמוד מודפס
  const head = (title, sub, color) => `<div class="gk-head" style="--gc:${color || '#1A9BB5'}"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><img src="${LOGO_BIG}" alt="Begood"></div>`;
  // עיצוב ההדפסה המשותף: שוליים, תחתית עמוד, כותרות וטבלה
  const printCss = (name) => `
#print{display:none}
@media print{
  @page{size:A4;margin:24mm 24mm}
  @page{@bottom-center{content:"${name} · Begood · be-good.co.il · עמוד " counter(page) " מתוך " counter(pages);font:600 9pt Assistant,Arial,sans-serif;color:#4a5a64}}
  body{background:#fff!important}
  body>*:not(#print){display:none!important}
  #print{display:block}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
.pr-page{break-after:page;color:#1d2b36;direction:rtl;font-family:Assistant,Arial,sans-serif}
.pr-page:last-child{break-after:auto}
.gk-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;border-bottom:3px solid var(--gc);padding-bottom:4mm;margin-bottom:5mm}
.gk-head h1{margin:0;font:900 24pt/1.05 'Frank Ruhl Libre',Georgia,serif;color:#1B4F7A}
.gk-head p{margin:1.5mm 0 0;font:600 10.5pt Assistant,Arial,sans-serif;color:#2b6a7d}
.gk-head img{width:30mm;height:auto}
.pr-page h2{margin:3.5mm 0 1.5mm;font:800 13pt Assistant,Arial,sans-serif;color:#1B4F7A;border-inline-start:4px solid #1A9BB5;padding-inline-start:3mm;break-after:avoid}
.pr-page p,.pr-page li{font:400 10.2pt/1.45 Assistant,Arial,sans-serif;text-align:justify;margin:0 0 1mm}
.pr-page ol,.pr-page ul{margin:0;padding-inline-start:6mm}
.pr-box{background:#F2F8F9;border-radius:3mm;padding:3mm 4mm;margin:2mm 0;break-inside:avoid}
.pr-cap{font:700 10pt Assistant,Arial,sans-serif;color:#4a5a64;margin:0 0 3mm}
.pr-tb{width:100%;border-collapse:collapse;font:400 9.8pt/1.4 Assistant,Arial,sans-serif}
.pr-tb th{background:#1B4F7A;color:#fff;text-align:right;padding:1.6mm 2.5mm;font-weight:800}
.pr-tb td{padding:1.5mm 2.5mm;border-bottom:1px solid #dbe7ea;vertical-align:top;text-align:right}
.pr-tb tr:nth-child(even) td{background:#F5F9FA}
.pr-tb tr{break-inside:avoid}
.pr-grid{display:grid;grid-template-columns:repeat(3,52mm);grid-auto-rows:74.75mm;gap:3mm;justify-content:center}
.pr-grid>*{break-inside:avoid}
`;
  // לפני הדפסה: מחכים שכל התמונות בדף ההדפסה נטענו, ורק אז מדפיסים
  // גופנים שמופיעים רק בדף ההדפסה לא נטענים מעצמם, והטקסט יוצא ריק. טוענים אותם מראש.
  const FONTS = ['700 16px "Amatic SC"', '800 16px Rubik', '700 16px Rubik', '900 16px "Frank Ruhl Libre"', '700 16px "Frank Ruhl Libre"', '400 16px Assistant', '700 16px Assistant', '800 16px Assistant'];
  const loadFonts = () => (typeof document !== 'undefined' && document.fonts ? Promise.all(FONTS.map((f) => document.fonts.load(f, 'אבג 123').catch(() => {}))) : Promise.resolve());
  async function printWhenReady(el) {
    await loadFonts();
    const imgs = [...el.querySelectorAll('img')];
    await Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r; }))));
    setTimeout(() => window.print(), 150);
  }
  // החלפת התוכן רק כשמשהו השתנה, כדי שבנייה מחדש בזמן ההדפסה לא תעלים תמונות שעוד לא נטענו
  function setPrint(el, html) { loadFonts(); const key = html.replace(/id="[a-z]+\d+"|url\(#[a-z]+\d+\)/g, ''); if (el.dataset.k !== key) { el.innerHTML = html; el.dataset.k = key; } }
  let AC = null;
  function chime(kind) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
      const notes = kind === 'win' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'up' ? [659.25, 880] : kind === 'tick' ? [880] : [392, 330];
      notes.forEach((f, k) => { const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + k * 0.1; o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(kind === 'tick' ? 0.04 : 0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 0.32); });
    } catch (e) {}
  }
  return { LOGO, LOGO_BIG, esc, rng, shuffle, logo, head, printCss, printWhenReady, setPrint, chime };
});
