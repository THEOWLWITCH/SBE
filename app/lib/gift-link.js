// "יש מה לעשות" במתנה (19/10/2026: "ניתן יהיה לשייך אותו לאנשים, שירגישו שהם מקבלים מתנה").
// המדריכון פתוח לכולם, ולכן המתנה היא קישור אישי: yesh-ma-laasot.html?to=<שם>&from=<שולח/ת>&msg=<הקדשה>&lang=he|ar.
// בפתיחה המדריכון מציג "מתנה בשבילך, <שם>", ממי ואת ההקדשה (כטקסט בלבד). שום דבר לא נשמר בשרת ולא נשלח ממנו:
// מי שמכין/ה את המתנה מעתיק/ה את הקישור או שולח/ת אותו בוואטסאפ.
// בשימוש: המרחב שלי (home.html) ומסך הניהול (admin.html, "קישור פתוח"). SBE_GIFT.mount(node, { from }).
(function (root) {
  'use strict';
  const PAGE = 'yesh-ma-laasot.html';
  const clip = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  function base() {
    try { const u = new URL(PAGE, location.href); if (/^https?:$/.test(u.protocol)) return u.origin + u.pathname.replace(/\/[^/]*$/, '/') + PAGE; } catch (e) {}
    return 'https://be-good.co.il/' + PAGE;
  }
  function link(o) {
    const q = new URLSearchParams();
    if (clip(o.to, 60)) q.set('to', clip(o.to, 60));
    if (clip(o.from, 60)) q.set('from', clip(o.from, 60));
    const msg = String(o.msg || '').trim().slice(0, 400); if (msg) q.set('msg', msg);
    if (o.lang === 'ar') q.set('lang', 'ar');
    if (![...q.keys()].length) q.set('gift', '1');
    return base() + '?' + q.toString();
  }
  function shareText(o, url) {
    return o.lang === 'ar'
      ? '🎁 ' + (clip(o.to, 60) ? clip(o.to, 60) + '، ' : '') + 'عندي هدية إلك: «في إشي نعمله»، دليل صغير للحظات الطوارئ مع الولاد. ' + url
      : '🎁 ' + (clip(o.to, 60) ? clip(o.to, 60) + ', ' : '') + 'יש לי מתנה בשבילך: "יש מה לעשות", מדריכון קטן לרגעי חירום עם ילדים. ' + url;
  }
  const CSS = '.sbe-gift{background:linear-gradient(180deg,#FFF6E2,#FFFDF8);border:1px solid #F1D9A6;border-radius:12px;padding:14px 16px;margin:14px 0;color:#0F2B45}' +
    '.sbe-gift h3{margin:0 0 4px;font-size:16px}.sbe-gift p{margin:0 0 8px;font-size:13.5px;line-height:1.55;color:#4a5a70}' +
    '.sbe-gift label{display:block;font-size:12.5px;font-weight:600;margin:8px 0 3px;color:#4a5a70}' +
    '.sbe-gift input,.sbe-gift textarea,.sbe-gift select{font:inherit;font-size:14px;width:100%;box-sizing:border-box;border:1px solid #E3CFA2;border-radius:6px;padding:7px 10px;background:#fff;color:#141C24}' +
    '.sbe-gift textarea{min-height:64px;resize:vertical}' +
    '.sbe-gift .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:0 12px}' +
    '.sbe-gift .go{margin-top:10px;font:inherit;font-weight:700;font-size:14px;border:0;border-radius:8px;padding:9px 16px;background:#FDD78C;color:#0F2B45;cursor:pointer}' +
    '.sbe-gift .gl-out{display:grid;gap:8px;margin-top:10px}' +
    '.sbe-gift .row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;background:#fff;border:1px solid #F1D9A6;border-radius:8px;padding:8px 10px}' +
    '.sbe-gift .row b{flex:1;min-width:120px}' +
    '.sbe-gift .row a,.sbe-gift .row button{font:inherit;font-size:12.5px;font-weight:600;border:1px solid #E3CFA2;border-radius:6px;padding:4px 10px;background:#FFF6E2;color:#0F2B45;cursor:pointer;text-decoration:none}' +
    '.sbe-gift .url{flex-basis:100%;direction:ltr;text-align:left;font-size:12px;color:#4a5a70;word-break:break-all}';
  function el(t, a, ...k) { const n = document.createElement(t); for (const x in a || {}) { if (x === 'class') n.className = a[x]; else n.setAttribute(x, a[x]); } k.forEach((c) => c != null && n.append(c)); return n; }
  function copy(text, b) {
    const done = () => { const o = b.textContent; b.textContent = 'הועתק ✓'; setTimeout(() => { b.textContent = o; }, 1800); };
    try { navigator.clipboard.writeText(text).then(done, () => prompt('להעתקה:', text)); } catch (e) { prompt('להעתקה:', text); }
  }
  function mount(node, opt) {
    opt = opt || {};
    if (!document.getElementById('sbe-gift-css')) { const s = el('style', { id: 'sbe-gift-css' }); s.textContent = CSS; document.head.append(s); }
    const box = el('section', { class: 'sbe-gift', 'aria-label': 'יש מה לעשות במתנה' });
    const to = el('textarea', { placeholder: 'שם אחד בכל שורה, למשל:\nנועה\nצוות שכבה ז׳', maxlength: '2000' });
    const from = el('input', { type: 'text', maxlength: '60', value: clip(opt.from, 60) });
    const msg = el('textarea', { maxlength: '400', placeholder: 'למשל: שיהיה לך בטלפון, לכל רגע. תודה על כל מה שאת עושה.' });
    const lang = el('select', { 'data-closed': '' }, el('option', { value: 'he' }, 'עברית'), el('option', { value: 'ar' }, 'ערבית'));
    const go = el('button', { type: 'button', class: 'go' }, '🎁 הכנת קישורי המתנה');
    const out = el('div', { class: 'gl-out', 'aria-live': 'polite' });
    go.addEventListener('click', () => {
      out.textContent = '';
      const names = to.value.split(/\n|,/).map((x) => clip(x, 60)).filter(Boolean).slice(0, 60);
      (names.length ? names : ['']).forEach((n) => {
        const o = { to: n, from: from.value, msg: msg.value, lang: lang.value }, url = link(o);
        const cp = el('button', { type: 'button' }, 'העתקת הקישור'); cp.addEventListener('click', () => copy(url, cp));
        const cpt = el('button', { type: 'button' }, 'העתקת הודעה עם הקישור'); cpt.addEventListener('click', () => copy(shareText(o, url), cpt));
        const wa = el('a', { href: 'https://wa.me/?text=' + encodeURIComponent(shareText(o, url)), target: '_blank', rel: 'noopener' }, 'וואטסאפ');
        const pv = el('a', { href: url, target: '_blank', rel: 'noopener' }, 'תצוגה');
        out.append(el('div', { class: 'row' }, el('b', null, '🎁 ' + (n || 'בלי שם')), cp, cpt, wa, pv, el('span', { class: 'url' }, (() => { try { return decodeURI(url); } catch (e) { return url; } })())));
      });
    });
    box.append(el('h3', null, '🎁 "יש מה לעשות" במתנה'),
      el('p', null, 'המדריכון לחירום פתוח לכולם. אפשר לשלוח אותו כמתנה אישית: מי שפותח/ת את הקישור רואה "מתנה בשבילך", ממי, ואת ההקדשה. Begood לא שולחת דבר: מעתיקים את הקישור או שולחים בוואטסאפ.'),
      el('div', { class: 'grid' },
        el('div', null, el('label', null, 'למי (שם אחד בכל שורה, רשות)'), to),
        el('div', null, el('label', null, 'ממי (רשות)'), from, el('label', null, 'שפת המדריכון'), lang)),
      el('label', null, 'הקדשה (רשות)'), msg, go, out);
    node.append(box);
    return box;
  }
  const api = { mount, link, shareText, PAGE };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SBE_GIFT = api;
})(typeof self !== 'undefined' ? self : this);
