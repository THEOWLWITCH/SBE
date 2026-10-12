/* product-view.js — הצגת תוצר שמור בתוך מסגרת סגורה (SBE_VIEW, 11/10/2026).
 * "כלי ריק... כאילו יש כרטיס מעל ומתחת שמוסתר": התוצר מוצג ממסמך נקי, ולא כמו שנשמר.
 *   - בלי סקריפטים, בלי מאזיני אירועים ובלי autofocus (שלא יגלול את המסגרת לאמצע).
 *   - סגנון שמבטל הסתרה ותנועה: הדף נפתח מלמעלה ותמיד גלוי, בלי גובה קבוע ובלי גלילה פנימית.
 *   - מסמך בלי טקסט: הודעה ברורה במקום מסגרת ריקה.
 *   - viewOnly (ספריית הדוגמאות ו"איך נראה התוצר?"): רק צפייה. אין הדפסה ושמירה.
 * שימוש: SBE_VIEW.show(iframe, html, { viewOnly: true }) */
(function (root) {
  'use strict';
  var FIX = 'html,body{display:block!important;visibility:visible!important;opacity:1!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;position:static!important;transform:none!important}' +
    'main,main *{max-height:none!important;opacity:1!important}main{display:block!important;visibility:visible!important}' +
    '*,*::before,*::after{animation:none!important;transition:none!important}' +
    'p,li,dd,blockquote,td:not(.n):not(.ck){text-align:justify;text-justify:inter-word}' +
    'table tr>:first-child:nth-last-child(n+3)~td:not(.n):not(.ck),table tr>:first-child:nth-last-child(n+3)~td:not(.n):not(.ck) p,table tr>:first-child:nth-last-child(n+3)~td:not(.n):not(.ck) li,table tr>td:first-child:nth-last-child(n+3),table tr>td:first-child:nth-last-child(n+3) p,table tr>td:first-child:nth-last-child(n+3) li{text-align:start}' +
    '.bar,.sbe-sysonly,.no-print,button,dialog:not([open]),.banner-mini,.savenote,.mock-note,.sbe-edit-hint{display:none!important}';
  var NOPRINT = '@media print{html,body{background:#fff!important}body>*{display:none!important}body::after{content:"התוצר לדוגמה מוצג לצפייה בלבד.";display:block;font:16px Assistant,Arial,sans-serif;padding:40px;text-align:center}}';
  var lastUrl = null;

  function msg(t) {
    return '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><body style="font-family:Assistant,Arial,sans-serif;padding:40px;text-align:center;color:#3C4650;background:#fff">' + t + '</body></html>';
  }
  function textLen(d) {
    var b = d.body ? d.body.cloneNode(true) : null; if (!b) return 0;
    b.querySelectorAll('style,script,noscript,template').forEach(function (n) { n.remove(); });
    return String(b.textContent || '').replace(/\s+/g, '').length;
  }
  // מסמך נקי מהתוצר השמור
  function clean(html, opts) {
    opts = opts || {};
    var d = new DOMParser().parseFromString(String(html || ''), 'text/html');
    d.querySelectorAll('script,noscript,iframe,object,embed,meta[http-equiv]').forEach(function (n) { n.remove(); });
    d.querySelectorAll('*').forEach(function (n) {
      [].slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value) || a.name === 'autofocus' || a.name === 'contenteditable') n.removeAttribute(a.name);
      });
    });
    // סגנון שהודבק על html או body (למשל display:none מבדיקת כניסה) לא עובר לתצוגה
    [d.documentElement, d.body].forEach(function (n) { if (n) { n.removeAttribute('style'); n.removeAttribute('hidden'); } });
    d.querySelectorAll('details').forEach(function (n) { n.setAttribute('open', ''); });
    if (!d.documentElement.getAttribute('dir')) d.documentElement.setAttribute('dir', 'rtl');
    var st = d.createElement('style'); st.textContent = FIX + (opts.viewOnly ? NOPRINT : '');
    (d.head || d.documentElement).appendChild(st);
    return { html: '<!doctype html>\n' + d.documentElement.outerHTML, text: textLen(d) };
  }
  function put(frame, out) {
    if (lastUrl) { try { URL.revokeObjectURL(lastUrl); } catch (e) {} lastUrl = null; }
    frame.removeAttribute('srcdoc');
    if (root.Blob && root.URL && URL.createObjectURL) {
      lastUrl = URL.createObjectURL(new Blob([out], { type: 'text/html;charset=utf-8' }));
      frame.src = lastUrl;
    } else frame.srcdoc = out;
  }
  function show(frame, html, opts) {
    opts = opts || {};
    var c;
    try { c = clean(html, opts); } catch (e) { c = { html: String(html || ''), text: 1e3 }; }
    var ok = c.text > 20;
    put(frame, ok ? c.html : msg(opts.empty || 'התוצר הזה נשמר בלי תוכן שאפשר להציג. אפשר לבחור תוצר אחר.'));
    return ok;
  }
  function message(frame, t) { put(frame, msg(t)); }
  root.SBE_VIEW = { show: show, message: message, clean: clean };
})(typeof self !== 'undefined' ? self : this);
