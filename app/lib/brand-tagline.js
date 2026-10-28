// הלוגו והכיתוב (28/10/2026): "לשים לוגו בלי שורות הכיתוב. מתחת לתמונה לכתוב: להיות מוכנים לאתגרי החיים - בשלוש שפות".
// כל תמונה עם data-brand מקבלת מתחתיה את הכיתוב בעברית, באנגלית ובערבית, כטקסט אמיתי (חד בכל גודל).
// הכיתוב עצמו: TAGLINE ב-lib/spaces.js (כאן עותק, כדי שהקובץ יעבוד גם בדף שלא טוען את spaces.js).
(function () {
  'use strict';
  var T = (window.SBE_SPACES && window.SBE_SPACES.TAGLINE) || { he: 'להיות מוכנים לאתגרי החיים', en: "Ready for Life's Challenges", ar: 'أن نكون مستعدين لتحديات الحياة' };
  var CSS = '.sbe-tagline{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2px 10px;border-top:1.5px solid #c9d7e3;padding-top:6px;margin:4px auto 0;max-width:520px;text-align:center}'
    + '.sbe-tagline span{font-weight:700;color:#1d3f63;font-size:13px;white-space:nowrap;line-height:1.5}'
    + '.sbe-tagline span[lang=he]{font-size:14px}'
    + '.sbe-tagline i{width:1.5px;height:14px;background:#c9d7e3}'
    + '@media screen and (max-width:480px){.sbe-tagline i{display:none}.sbe-tagline{flex-direction:column}}'
    + ':root[data-theme="dark"] .sbe-tagline span{color:#cfe3f5}'
    + '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .sbe-tagline span{color:#cfe3f5}}';
  function mount() {
    var imgs = document.querySelectorAll('img[data-brand]');
    if (!imgs.length) return;
    if (!document.getElementById('sbe-tagline-css')) { var st = document.createElement('style'); st.id = 'sbe-tagline-css'; st.textContent = CSS; document.head.appendChild(st); }
    imgs.forEach(function (img) {
      if (img.nextElementSibling && img.nextElementSibling.classList.contains('sbe-tagline')) return;
      var d = document.createElement('div'); d.className = 'sbe-tagline'; d.setAttribute('aria-label', T.he);
      [['he', T.he], ['en', T.en], ['ar', T.ar]].forEach(function (x, i) {
        if (i) { var sep = document.createElement('i'); sep.setAttribute('aria-hidden', 'true'); d.appendChild(sep); }
        var s = document.createElement('span'); s.lang = x[0]; s.dir = x[0] === 'en' ? 'ltr' : 'rtl'; s.textContent = x[1]; d.appendChild(s);
      });
      var w = img.getAttribute('data-brand-width'); if (w) d.style.maxWidth = w;
      img.insertAdjacentElement('afterend', d);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
