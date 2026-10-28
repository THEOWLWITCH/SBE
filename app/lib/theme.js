// עיצוב אחיד לכל המערכת (28/10/2026: "תעצב את כל כפתורי המערכת בסגנון הזה ותכחיד את הצבעים האיומים של הרקעים").
// הסגנון: כרטיסי המרחבים בדף הבית. כפתורים: גלולה (פינות עגולות), פעולה ראשית בכחול כהה של המותג וטקסט לבן,
// פעולה משנית לבנה עם מסגרת כחולה. רקעים: קופסה ברקע פסטל (צהוב, ורוד, ירוק, תכלת) הופכת לכרטיס לבן
// עם מסגרת דקה ופס צבע עליון בגוון שלה. רק על המסך; ההדפסה וה-PDF לא משתנים.
// לא נוגעים: משחקי החוסן, יש מה לעשות, מסמכי הסימולציה, טבלאות, שדות טופס, ותגיות קטנות.
// הכפתורים והקופסאות מסווגים פעם אחת לפי הצבע שלהם (data-sbe-b, data-sbe-s), גם כשנוספים לדף אחר כך.
(function () {
  'use strict';
  if (window.SBE_THEME) return;
  var path = (location.pathname.split('/').pop() || '').toLowerCase();
  var SKIP = /^(games|memory-game|board-game|no-panic|story-maker|statement-sort|riddles|bingo|twenty-q|truth-dare|trail-signs|readiness-train|idea-garden|yesh-ma-laasot|doc-[a-z-]+|card-[a-z-]+|journey-cert)\.html$/;
  if (SKIP.test(path) || /\/products\//.test(location.pathname) || document.documentElement.hasAttribute('data-no-theme')) { window.SBE_THEME = { off: true }; return; }

  var CSS = [
    '@media screen{',
    ':root{--sbe-ink:#1d3f63;--sbe-ink2:#16324a;--sbe-line:#c9d7e7;--sbe-glow:rgba(22,50,74,.13)}',
    // כפתורים
    'html .sbe-b{border-radius:999px!important;font-weight:700!important;transition:transform .16s ease,box-shadow .16s ease,background-color .16s ease,border-color .16s ease!important}',
    'html .sbe-b:not(:disabled):hover{transform:translateY(-1px)}',
    'html .sbe-b.sbe-b-tall{border-radius:16px!important}',
    'html .sbe-b:focus-visible{outline:3px solid #1b9aaa!important;outline-offset:2px!important}',
    'html .sbe-b-p{background:var(--sbe-ink)!important;background-image:none!important;color:#fff!important;border:1.5px solid var(--sbe-ink)!important;box-shadow:0 2px 8px rgba(22,50,74,.16)!important}',
    'html .sbe-b-p:not(:disabled):hover{background:var(--sbe-ink2)!important;box-shadow:0 6px 16px var(--sbe-glow)!important}',
    'html .sbe-b-s{background:#fff!important;background-image:none!important;color:var(--sbe-ink)!important;border:1.5px solid var(--sbe-line)!important;box-shadow:0 1px 4px rgba(22,50,74,.06)!important}',
    'html .sbe-b-s:not(:disabled):hover{border-color:var(--sbe-ink)!important;box-shadow:0 4px 12px var(--sbe-glow)!important}',
    'html .sbe-b:disabled{opacity:.5!important;cursor:not-allowed!important;transform:none!important;box-shadow:none!important}',
    // קופסאות שהיו ברקע צבעוני
    'html .sbe-s{background:#fff!important;background-image:none!important;border:1.5px solid var(--sbe-sl,#d6e0ea)!important;box-shadow:inset 0 4px 0 var(--sbe-sa,#1b9aaa),0 2px 10px rgba(22,50,74,.06)!important;border-radius:max(var(--sbe-r,0px),14px)!important}',
    'html .sbe-s.sbe-s-thin{box-shadow:inset 0 3px 0 var(--sbe-sa,#1b9aaa)!important}',
    // מצב כהה
    '@media (prefers-color-scheme:dark){html:not([data-theme=light]) .sbe-b-s{background:transparent!important;color:#dbe8f5!important;border-color:#4a6684!important}',
    'html:not([data-theme=light]) .sbe-b-p{background:#2f6fa3!important;border-color:#2f6fa3!important}}',
    'html[data-theme=dark] .sbe-b-s{background:transparent!important;color:#dbe8f5!important;border-color:#4a6684!important}',
    'html[data-theme=dark] .sbe-b-p{background:#2f6fa3!important;border-color:#2f6fa3!important}',
    'html .sbe-s-dk{background:#18222d!important;background-image:none!important;border:1.5px solid #2e4256!important;box-shadow:inset 0 4px 0 #1b9aaa!important;border-radius:14px!important}',
    '@media (prefers-reduced-motion:reduce){html .sbe-b{transition:none!important}html .sbe-b:hover{transform:none!important}}',
    '}'
  ].join('\n');

  function parse(c) { var m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  function hsl(c) { var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = 0, h = 0, d = mx - mn;
    if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return { h: h, s: s, l: l }; }
  function lum(c) { return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255; }
  var dark = false;
  function pageDark() { var c = parse(getComputedStyle(document.body).backgroundColor); if (!c || c.a < .5) c = parse(getComputedStyle(document.documentElement).backgroundColor); return !!(c && c.a >= .5 && lum(c) < .35); }

  // כפתורים שלא נוגעים בהם: לשוניות, מתגים, בוררים, תפריטים נפתחים, כפתורים שנראים כקישור או כאייקון
  var B_SKIP = '.chip,.tile,.tab-btn,.step-tab,.j-step,.linkbtn,.linkish,.switchlink,.iconbtn,.closebtn,.customsel-opt,.customsel-trigger,.combo-trigger,.traits-trigger,.sbe-no-theme,[role=tab],[role=switch],[role=option],[aria-pressed],[aria-selected],.choose button,.sw button,.space,.sbe-i,.sbe-info,summary';
  function classifyButton(el) {
    if (el.hasAttribute('data-sbe-b')) return;
    el.setAttribute('data-sbe-b', '');
    if (el.matches(B_SKIP) || el.closest('svg,table,.sbe-no-theme,[contenteditable=true],.customsel,.combo')) return;
    var cs = getComputedStyle(el); if (cs.display === 'none' && !el.isConnected) return;
    var txt = (el.textContent || '').trim();
    if (txt.length <= 2 && !el.querySelector('img')) return; // ✕, ?, ⓘ
    var bg = parse(cs.backgroundColor), bw = parseFloat(cs.borderTopWidth) || 0, bc = parse(cs.borderTopColor);
    var hasBg = bg && bg.a > .15, hasBorder = bw > 0 && bc && bc.a > .15;
    if (!hasBg && !hasBorder && cs.backgroundImage === 'none') return; // נראה כקישור
    var c = hasBg ? bg : null, k;
    if (c) { var h = hsl(c); if (h.s > .45 && (h.h < 18 || h.h > 340) && h.l < .6) { el.classList.add('sbe-b'); return; } } // אדום: מחיקה, נשאר אדום
    if ((c && lum(c) < .5) || cs.backgroundImage !== 'none' && /gradient/.test(cs.backgroundImage) && lum(parse(cs.color) || { r: 255, g: 255, b: 255 }) > .7) k = 'sbe-b-p';
    else k = 'sbe-b-s';
    el.classList.add('sbe-b', k);
    if (el.offsetHeight > 54 || el.querySelector('div,p,b+span,small+span,br')) el.classList.add('sbe-b-tall'); // כפתור גדול (כרטיס בחירה): פינות עגולות ולא גלולה
  }

  var S_SKIP = 'table,thead,tbody,tr,td,th,input,select,textarea,option,button,label,svg,canvas,img,video,iframe,dialog::backdrop,.sbe-no-theme,.sbe-s,.space,[contenteditable=true],.customsel,.combo,.sbe-tagline,pre,code,mark,progress,meter,.bar,.bar *';
  var BLOCK = /^(block|flex|grid|list-item|flow-root|table|inline-block|inline-flex|inline-grid)$/;
  function classifySurface(el) {
    if (el.hasAttribute('data-sbe-s')) return;
    if (!el.offsetWidth && !el.offsetHeight) return; // נסתר כרגע: ייבדק כשיופיע
    el.setAttribute('data-sbe-s', '');
    if (el.matches(S_SKIP) || el.closest('table,svg,.sbe-no-theme,[contenteditable=true]')) return;
    var cs = getComputedStyle(el);
    if (!BLOCK.test(cs.display) || cs.position === 'fixed' || cs.position === 'sticky') return; // סרגלים קבועים נשארים
    if (cs.backgroundImage !== 'none') return; // שיפוע או תמונה: עיצוב מכוון
    var c = parse(cs.backgroundColor); if (!c || c.a < .5) return;
    var h = hsl(c);
    if (dark) { // מצב כהה: קופסה בהירה עם טקסט בהיר לא נקראת. רקע כהה במקומה
      var tc = parse(cs.color);
      if (h.l > .82 && tc && lum(tc) > .55 && el.offsetWidth >= 140) el.classList.add('sbe-s-dk');
      return;
    }
    if (h.l < .8 || h.s < .18) return; // לבן, אפור או כהה: נשאר
    var w = el.offsetWidth, ht = el.offsetHeight;
    if (w < 140 || ht < 26) return; // תגיות קטנות נשארות
    // פס עליון רק בצבעי המותג, לפי הגוון שהיה לקופסה
    var hh = h.h, a = hh < 20 || hh >= 330 ? '#c8553d' : hh < 50 ? '#e08a2e' : hh < 70 ? '#f2c14e' : hh < 165 ? '#3d9a5f' : hh < 200 ? '#1b9aaa' : hh < 235 ? '#2a6f97' : '#1b9aaa';
    var line = hh < 20 || hh >= 330 ? '#f0d3cc' : hh < 70 ? '#f1e2c0' : hh < 165 ? '#cfe5d6' : '#d6e0ea';
    el.style.setProperty('--sbe-sa', a); el.style.setProperty('--sbe-sl', line);
    el.style.setProperty('--sbe-r', cs.borderTopLeftRadius);
    el.classList.add('sbe-s'); if (ht < 60) el.classList.add('sbe-s-thin');
  }

  var pend = [], queued = false;
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    var bs = root.matches('button,.btn,a.btn,input[type=submit],input[type=button]') ? [root] : [];
    bs = bs.concat([].slice.call(root.querySelectorAll('button,.btn,a.btn,input[type=submit],input[type=button]')));
    bs.forEach(classifyButton);
    var ss = [root].concat([].slice.call(root.querySelectorAll('div,section,aside,article,details,p,header,footer,nav,fieldset,form,ul,ol,li,blockquote')));
    ss.forEach(classifySurface);
  }
  function flush() { queued = false; var list = pend; pend = []; list.forEach(scan); }
  function queue(n) { pend.push(n); if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(flush, 16); } }
  function start() {
    var st = document.createElement('style'); st.id = 'sbe-theme'; st.textContent = CSS; document.head.appendChild(st);
    dark = pageDark();
    scan(document.body);
    new MutationObserver(function (ms) { ms.forEach(function (m) {
      if (m.type === 'childList') m.addedNodes.forEach(function (n) { if (n.nodeType === 1) queue(n); });
      else if (m.target.nodeType === 1 && !(m.attributeName === 'class' && /\bsbe-/.test(m.target.className))) queue(m.target);
    }); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open', 'class', 'style'] });
    setTimeout(function () { scan(document.body); }, 1200);
  }
  window.SBE_THEME = { scan: scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
