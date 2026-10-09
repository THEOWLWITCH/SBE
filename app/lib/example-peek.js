/* example-peek.js — "👀 איך נראה התוצר?" בראש כל כלי (SBE_PEEK, 08/10/2026).
 * מציג תוצר אמיתי של הכלי מספריית התוצרים לדוגמה (examples.html), רק מה שמנהלת המערכת סימנה
 * "מוצג בספרייה" במעבדת הדמו. לא ממלא את הטופס, רק מראה מה מקבלים. אין תוצר מאושר — אין קישור.
 * שימוש: <script src="lib/example-peek.js" data-tool="nana" defer></script>
 *   data-tool — מזהה הכלי במעבדת הדמו (אפשר כמה, בפסיקים: "act-single,act-seq").
 *   הקישור נכנס אחרי .article-link, או אחרי ה-h1 הראשון. מסך שנבנה ב-JS קורא ל-SBE_PEEK.mount(parent).
 * המסמך מוצג במסגרת סגורה, בלי סקריפטים (כמו בספרייה). */
(function () {
  'use strict';
  var me = document.currentScript;
  var TOOLS = String((me && me.getAttribute('data-tool')) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var ACCESS = 'https://sbe-server.onrender.com/api/access';
  var CACHE = 'sbe.peek.v1', TTL = 10 * 60 * 1000;
  var items = null, pending = null;

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  function api(body) {
    return fetch(ACCESS, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  }
  function load() {
    if (items) return Promise.resolve(items);
    if (pending) return pending;
    try { var c = JSON.parse(sessionStorage.getItem(CACHE) || 'null'); if (c && Date.now() - c.t < TTL) { items = c.items; return Promise.resolve(items); } } catch (e) {}
    pending = api({ action: 'demoPublicList' }).then(function (d) {
      items = d.items || [];
      try { sessionStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), items: items })); } catch (e) {}
      return items;
    }).catch(function () { items = []; return items; });
    return pending;
  }
  function mine(all) {
    return all.filter(function (d) { return TOOLS.indexOf(d.tool) >= 0; })
      .sort(function (a, b) { return TOOLS.indexOf(a.tool) - TOOLS.indexOf(b.tool) || String(a.title).localeCompare(String(b.title), 'he'); });
  }

  function css() {
    if (document.getElementById('sbe-peek-css')) return;
    var s = el('style'); s.id = 'sbe-peek-css';
    s.textContent =
      '.sbe-peek{font-size:.9rem;margin:.45rem 0 0}' +
      '.sbe-peek button{font:inherit;font-weight:700;background:none;border:0;padding:0;cursor:pointer;color:var(--spoken,var(--accent,#2E5A7D));text-decoration:underline;text-underline-offset:3px}' +
      '.sbe-peek-d{width:min(980px,96vw);height:92vh;border:1px solid #CDD3D8;border-radius:12px;padding:0;background:#FCFCFD;color:#141C24;direction:rtl}' +
      '.sbe-peek-d::backdrop{background:rgba(10,14,18,.55)}' +
      '.sbe-peek-w{display:flex;flex-direction:column;height:100%;font-family:"Assistant","Segoe UI",system-ui,sans-serif}' +
      '.sbe-peek-h{display:flex;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid #CDD3D8;flex-wrap:wrap}' +
      '.sbe-peek-h b{flex:1;font-size:16px}' +
      '.sbe-peek-h select{width:auto!important;max-width:45%;flex:0 1 auto;margin:0!important;min-height:0!important}' +
      '.sbe-peek-h select,.sbe-peek-h a,.sbe-peek-h button{font:inherit;font-size:13.5px;font-weight:600;padding:5px 12px;border-radius:6px;border:1px solid #CDD3D8;background:transparent;color:#141C24;cursor:pointer;text-decoration:none}' +
      '.sbe-peek-n{padding:6px 14px;font-size:13.5px;color:#5C6771;border-bottom:1px solid #CDD3D8;margin:0}' +
      '.sbe-peek-w iframe{flex:1;width:100%;border:0;background:#fff}';
    document.head.appendChild(s);
  }

  var dlg = null;
  function open(list) {
    css();
    if (!dlg) {
      dlg = el('dialog', 'sbe-peek-d'); dlg.setAttribute('aria-label', 'תוצר לדוגמה');
      var w = el('div', 'sbe-peek-w'), h = el('div', 'sbe-peek-h');
      h.appendChild(el('b', null, 'כך נראה התוצר'));
      var sel = el('select'); sel.setAttribute('data-closed', ''); sel.setAttribute('aria-label', 'בחירת תוצר לדוגמה'); h.appendChild(sel);
      var lib = el('a', null, '📚 לכל הדוגמאות'); lib.target = '_blank'; lib.rel = 'noopener'; h.appendChild(lib);
      var x = el('button', null, 'סגירה'); x.type = 'button'; x.onclick = function () { dlg.close(); }; h.appendChild(x);
      w.appendChild(h);
      w.appendChild(el('p', 'sbe-peek-n', 'תוצר אמיתי של הכלי, על מקרה בדוי. התוצר שלכם ייבנה מהפרטים שתמלאו, ואפשר יהיה לערוך אותו על המסך ולשמור כ-PDF.'));
      var fr = el('iframe'); fr.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox'); fr.title = 'התוצר לדוגמה'; w.appendChild(fr);
      dlg.appendChild(w); document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      dlg._sel = sel; dlg._fr = fr; dlg._lib = lib;
      sel.onchange = function () { show(dlg._list[+sel.value]); };
    }
    dlg._list = list;
    dlg._sel.textContent = '';
    list.forEach(function (d, i) { var o = el('option', null, d.title); o.value = i; dlg._sel.appendChild(o); });
    dlg._sel.hidden = list.length < 2;
    dlg._lib.href = 'examples.html?tool=' + encodeURIComponent(TOOLS.join(','));
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    show(list[0]);
  }
  function msg(t) { return '<p style="font-family:sans-serif;padding:40px;text-align:center" dir="rtl">' + t + '</p>'; }
  function show(d) {
    var fr = dlg._fr; fr.srcdoc = msg('טוען את התוצר... בפעם הראשונה זה יכול לקחת עד דקה.');
    api({ action: 'demoGet', id: d.id }).then(function (full) { fr.srcdoc = String(full.html||'').replace(/<\/head>/i,'<style>.bar{display:none!important}</style></head>'); })
      .catch(function () { fr.srcdoc = msg('לא הצלחנו לטעון את התוצר. אפשר לנסות שוב בעוד רגע.'); });
  }

  // מוסיף את הקישור לתוך parent (בסוף), או אחרי after. רק כשיש תוצר מאושר לכלי.
  function mount(parent, after) {
    if (!TOOLS.length) return;
    load().then(function (all) {
      var list = mine(all); if (!list.length) return;
      var host = parent || (after && after.parentNode); if (!host || host.querySelector(':scope > .sbe-peek')) return;
      css();
      var p = el('p', 'sbe-peek'); p.appendChild(document.createTextNode('👀 '));
      var b = el('button', null, 'איך נראה התוצר?'); b.type = 'button'; b.onclick = function () { open(list); }; p.appendChild(b);
      p.appendChild(document.createTextNode(' תוצר אמיתי לדוגמה, כדי לראות מה מקבלים.'));
      if (parent) parent.appendChild(p); else after.insertAdjacentElement('afterend', p);
    });
  }
  function auto() {
    var a = document.querySelector('.article-link') || document.querySelector('h1');
    if (a) mount(null, a);
  }
  window.SBE_PEEK = { mount: mount, open: function () { load().then(function (all) { var l = mine(all); if (l.length) open(l); }); } };
  if (me && me.hasAttribute('data-manual')) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
