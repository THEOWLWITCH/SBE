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
    'html .sbe-b{border-radius:999px!important;font-weight:600!important;letter-spacing:.01em;transition:transform .16s ease,box-shadow .16s ease,background-color .16s ease,border-color .16s ease!important}',
    'html .sbe-b:not(:disabled):hover{transform:translateY(-.5px)}',
    'html .sbe-b.sbe-b-tall{border-radius:16px!important}',
    'html .sbe-b:focus-visible{outline:3px solid #1b9aaa!important;outline-offset:2px!important}',
    'html .sbe-b-p{background:var(--sbe-ink)!important;background-image:none!important;color:#fff!important;border:1px solid var(--sbe-ink)!important;box-shadow:0 1px 2px rgba(22,50,74,.10)!important}',
    'html .sbe-b-p:not(:disabled):hover{background:var(--sbe-ink2)!important;box-shadow:0 3px 10px rgba(22,50,74,.10)!important}',
    'html .sbe-b-s{background:#fff!important;background-image:none!important;color:var(--sbe-ink)!important;border:1px solid #d3dde8!important;box-shadow:none!important}',
    'html .sbe-b-s:not(:disabled):hover{border-color:#8fa6bd!important;background:#fbfcfe!important}',
    'html .sbe-b:disabled{opacity:.5!important;cursor:not-allowed!important;transform:none!important;box-shadow:none!important}',
    // קופסאות שהיו ברקע צבעוני
    'html .sbe-s{background:#fff!important;background-image:none!important;border:1px solid #e3e9ef!important;border-top:2px solid var(--sbe-sa,#1b9aaa)!important;box-shadow:0 1px 3px rgba(22,50,74,.04)!important;border-radius:12px!important}',
    'html .sbe-s.sbe-s-thin{box-shadow:none!important}',
    // מצב כהה
    '@media (prefers-color-scheme:dark){html:not([data-theme=light]) .sbe-b-s{background:transparent!important;color:#dbe8f5!important;border-color:#4a6684!important}',
    'html:not([data-theme=light]) .sbe-b-p{background:#2f6fa3!important;border-color:#2f6fa3!important}}',
    'html[data-theme=dark] .sbe-b-s{background:transparent!important;color:#dbe8f5!important;border-color:#4a6684!important}',
    'html[data-theme=dark] .sbe-b-p{background:#2f6fa3!important;border-color:#2f6fa3!important}',
    'html .sbe-s-dk{background:#18222d!important;background-image:none!important;border:1.5px solid #2e4256!important;border-top:2px solid #1b9aaa!important;box-shadow:none!important;border-radius:12px!important}',
    // שדות טופס: מסגרת דקה, פינות רכות וטבעת מיקוד עדינה
    'html input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not(.code):not(.sbe-no-theme),html select:not(.sbe-no-theme),html textarea:not(.sbe-no-theme){border-radius:10px!important;border-width:1px!important;border-color:#d7e0ea!important;background-color:#fff!important;transition:border-color .16s ease,box-shadow .16s ease}',
    'html input::placeholder,html textarea::placeholder{color:#8a97a5;letter-spacing:normal;font-family:inherit}',
    'html input:not([type=checkbox]):not([type=radio]):not([type=range]):focus-visible,html select:focus-visible,html textarea:focus-visible{outline:none!important;border-color:#1b9aaa!important;box-shadow:0 0 0 3px rgba(27,154,170,.16)!important}',
    'html :focus-visible{outline-color:#1b9aaa}',
    'html .sbe-vh{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;margin:0!important;padding:0!important;border:0!important}',
    // כפתור הפניות הצף (דיווח, רעיון או תקלה): שם אחד, ובטלפון עיגול קטן בצד שלא מסתיר כפתורים
    'html #rptFab,html #fb-fab{border-radius:999px!important;font-weight:600!important;box-shadow:0 2px 8px rgba(22,50,74,.14)!important}',
    '@media screen and (max-width:640px){html #rptFab,html #fb-fab{font-size:0!important;width:44px!important;height:44px!important;min-width:0!important;padding:0!important;inset-inline-start:10px!important;inset-inline-end:auto!important;bottom:84px!important}html #rptFab::before,html #fb-fab::before{content:"💬";font-size:19px}}',
    // תוויות קטנות בגופן מונו בלי אותיות עבריות: הגופן של הדף, בלי ריווח רחב
    'html .eyebrow,html .sc-tag,html [class*=count],html .kicker{font-family:inherit!important;letter-spacing:0!important}',
    // קו דק במקום קו שחור עבה מתחת לכותרת הדף
    'html body>header,html .wrap>header{border-bottom-color:#e3e9ef!important}',
    // פס אפור בראש קטע מתקפל או כרטיס: שקוף, עם קו דק מתחת
    'html .sbe-band{background:transparent!important;background-image:none!important;border-bottom:1px solid #eef2f6!important}',
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
    if (h.s < .18 && h.l > .86 && h.l < .985 && /^(SUMMARY|H2|H3|H4)$/.test(el.tagName)) { el.classList.add('sbe-band'); return; } // פס כותרת אפור
    if (/^(SUMMARY|H2|H3|H4)$/.test(el.tagName)) { if (h.l > .86) el.classList.add('sbe-band'); return; } // כותרות: רק בלי רקע, לא כרטיס
    if (h.l < .8 || h.s < .18) return; // לבן, אפור או כהה: נשאר
    var w = el.offsetWidth, ht = el.offsetHeight;
    if (w < 140 || ht < 26) return; // תגיות קטנות נשארות
    if (!(el.textContent || '').trim() && !el.querySelector('img,svg,canvas,input,textarea,select,video,iframe')) return; // קופסה ריקה: לא מציירים כרטיס
    // פס עליון רק בצבעי המותג, לפי הגוון שהיה לקופסה
    var hh = h.h, a = hh < 20 || hh >= 330 ? '#c8553d' : hh < 50 ? '#e08a2e' : hh < 70 ? '#f2c14e' : hh < 165 ? '#3d9a5f' : hh < 200 ? '#1b9aaa' : hh < 235 ? '#2a6f97' : '#1b9aaa';
    var line = hh < 20 || hh >= 330 ? '#f0d3cc' : hh < 70 ? '#f1e2c0' : hh < 165 ? '#cfe5d6' : '#d6e0ea';
    el.style.setProperty('--sbe-sa', a); el.style.setProperty('--sbe-sl', line);
    el.style.setProperty('--sbe-r', cs.borderTopLeftRadius);
    el.classList.add('sbe-s'); if (ht < 60) el.classList.add('sbe-s-thin');
  }

  // כיתוב שחוזר על מה שכתוב בתוך שדה הקלט (28/10/2026: "אם משהו כתוב בתוך תיבת הקלט לא צריך לחזור עליו כהסבר"):
  // תווית זהה לטקסט שבתוך השדה מוסתרת מהעין ונשארת לקוראי מסך. תווית עם "(רשות)" או "שדה עיקרי" נשארת.
  var norm = function (s) { return String(s || '').replace(/[ⓘ:.*…"״]/g, '').replace(/\s+/g, ' ').trim(); };
  function dedupeLabel(f) {
    if (f.hasAttribute('data-sbe-l')) return; f.setAttribute('data-sbe-l', '');
    var ph = norm(f.getAttribute('placeholder')); if (!ph) return;
    var l = (f.id && document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(f.id) : f.id) + '"]')) || (f.previousElementSibling && f.previousElementSibling.tagName === 'LABEL' ? f.previousElementSibling : null);
    if (!l || l.contains(f) || /רשות|שדה עיקרי/.test(l.textContent)) return;
    if (norm(l.textContent) === ph) l.classList.add('sbe-vh');
  }
  var pend = [], queued = false;
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    var bs = root.matches('button,.btn,a.btn,a.go,input[type=submit],input[type=button]') ? [root] : [];
    bs = bs.concat([].slice.call(root.querySelectorAll('button,.btn,a.btn,a.go,input[type=submit],input[type=button]')));
    bs.forEach(classifyButton);
    [].slice.call(root.querySelectorAll('input[placeholder],textarea[placeholder]')).forEach(dedupeLabel);
    var ss = [root].concat([].slice.call(root.querySelectorAll('div,section,aside,article,details,summary,h2,h3,h4,p,header,footer,nav,fieldset,form,ul,ol,li,blockquote')));
    ss.forEach(classifySurface);
  }
  function flush() { queued = false; var list = pend; pend = []; list.forEach(scan); }
  function queue(n) { pend.push(n); if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(flush, 16); } }
  function fabLabel() { ['rptFab', 'fb-fab'].forEach(function (id) { var f = document.getElementById(id); if (f && !f.hasAttribute('data-sbe-fab')) { f.setAttribute('data-sbe-fab', ''); f.textContent = '💬 רעיון או תקלה'; f.setAttribute('aria-label', 'רעיון או תקלה'); f.title = 'רעיון, תקלה או שאלה'; } }); }
  // לוגו קבוע בדפים הפנימיים (29/10/2026: "בדפים הפנימיים יהיה לוגו בלי כיתוב והוא יופיע מימין באופן קבוע באותו מקום"):
  // הלוגו בלי הכיתוב, בראש הדף מימין: בתוך הסרגל העליון אם יש, ואחרת בפס דק משלו. הלוגואים הגדולים והכיתוב מוסתרים.
  // דף הבית (entry.html) נשאר עם הלוגו הגדול והכיתוב.
  function brandMark() {
    if (!path || path === 'entry.html' || path === 'index.html' || document.querySelector('.sbe-mark')) return;
    var css = document.createElement('style'); css.id = 'sbe-mark-css';
    css.textContent = '@media screen{.brandrow,img[data-brand],.sbe-tagline,.cc-brand{display:none!important}'
      + '.sbe-mark{display:inline-flex;align-items:center;flex:none;margin-inline-end:10px;line-height:0;text-decoration:none!important;background:none!important;border:0!important;padding:0!important}'
      + '.sbe-mark img{height:32px;width:auto;display:block}#navBar .sbe-mark{margin-inline-end:auto}#navBar .sbe-mark img{height:28px}'
      + '.sbe-markbar{display:flex;justify-content:flex-start;align-items:center;height:38px;padding:0 10px;box-sizing:border-box;direction:rtl;position:relative;width:100vw;left:50%;right:50%;margin:0 -50vw;transform:none}.sbe-markbar .sbe-mark img{height:28px}'
      + ':root[data-theme="dark"] .sbe-mark img{background:#fff;border-radius:8px;padding:2px 6px}'
      + '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .sbe-mark img{background:#fff;border-radius:8px;padding:2px 6px}}}'
      + '@media print{.sbe-mark,.sbe-markbar{display:none!important}}';
    document.head.appendChild(css);
    var home = ''; try { home = sessionStorage.getItem('sbe.session.homeUrl') || ''; } catch (e) {}
    var a = document.createElement('a'); a.className = 'sbe-mark sbe-no-theme'; a.href = home || 'entry.html';
    a.setAttribute('aria-label', home ? 'Begood: המרחב שלי' : 'Begood: דף הבית');
    var img = document.createElement('img'); img.src = 'assets/begood-logo-mark.webp'; img.alt = 'Begood'; img.width = 53; img.height = 32; a.appendChild(img);
    var NAV = '#navBar, nav.topnav, nav.r-topnav, nav.studies-topnav';
    var nav = document.querySelector(NAV);
    if (nav) { nav.insertBefore(a, nav.firstChild); return; }
    var bar = document.createElement('div'); bar.className = 'sbe-markbar no-print'; bar.appendChild(a);
    document.body.insertBefore(bar, document.body.firstChild);
    setTimeout(function () { var n = document.querySelector(NAV); if (n && bar.parentNode) { n.insertBefore(a, n.firstChild); bar.remove(); } }, 700);
  }
  function start() {
    brandMark(); fabLabel(); setTimeout(fabLabel, 800);
    var extra = /^(horizon-lab|hl-[a-z]+)\.html$/.test(path) ? '@media screen{html a:not([class]){color:#1d3f63;text-decoration-color:#c9d7e7;text-underline-offset:3px}}' : ''; // מעבדת האופק: קישורים בכחול המותג
    var st = document.createElement('style'); st.id = 'sbe-theme'; st.textContent = CSS + extra; document.head.appendChild(st);
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
