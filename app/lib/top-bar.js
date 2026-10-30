// סרגל עליון אחיד בכל המסכים (29/10/2026: "האזור הזה חייב להיות זהה עיצובית בכל המסכים כולל כפתור חזרה / המרחב שלי / הנתיב של הכלי - איך הגענו לכאן").
// מימין: הלוגו והנתיב ("המרחב שלי › מעבדת האופק › מחולל העתידים"), לפי הדרך שבה הגיעו בפועל (sessionStorage sbe.trail).
// משמאל: כפתורים נוספים שהיו בסרגל הישן של הדף, "→ חזרה", "⌂ המרחב שלי" ו-☰ למנהלת המערכת.
// הסרגלים הישנים (#navBar, nav.topnav, nav.r-topnav, nav.studies-topnav, .suite-return) מוסתרים; כפתור חזרה ישן נשאר בדף
// ומופעל מהכפתור החדש, כדי לשמור על ההתנהגות שלו (למשל חזרה צעד בתוך הכלי). רק על המסך.
// לא חל על: דף הבית (entry), יש מה לעשות, מסמכי הסימולציה, התעודה, products/, דף בתוך מסגרת, משתתפים בחדר בלי קוד, ודף עם data-no-topbar.
(function () {
  'use strict';
  if (window.SBE_TOPBAR) return;
  var file = (location.pathname.split('/').pop() || '').toLowerCase();
  var params = new URLSearchParams(location.search);
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  var token = ss('sbe.session.token'), homeUrl = ss('sbe.session.homeUrl') || '';
  if (!file || /^(entry|index|yesh-ma-laasot|journey-cert)\.html$/.test(file) || /^(doc|card)-/.test(file) || /\/products\//.test(location.pathname)) return;
  if (window.self !== window.top) return;
  if (document.documentElement.hasAttribute('data-no-topbar')) return;
  if (!token && (params.has('room') || params.has('join') || params.has('share'))) return; // משתתפים בקישור: בלי מעבר לכלים אחרים
  window.SBE_TOPBAR = {};

  var HOME = /admin\.html\?role=sys/.test(homeUrl) || !homeUrl ? 'home.html' : homeUrl;
  var GAMES = /^(memory-game|board-game|no-panic|story-maker|statement-sort|riddles|bingo|twenty-q|truth-dare|trail-signs|readiness-train|idea-garden)\.html$/;
  function parentOf(f) {
    if (/^hl-[a-z]+\.html$/.test(f)) return { p: 'horizon-lab.html', n: 'מעבדת האופק' };
    if (GAMES.test(f)) return { p: 'games.html', n: 'משחקי חוסן' };
    return null;
  }
  var ROOTS = /^(home|admin|entry|index|system-select)\.html$/;

  var CSS = '@media screen{'
    + '#sbeTop{display:flex;align-items:center;gap:12px;min-height:50px;padding:7px 16px;box-sizing:border-box;direction:rtl;background:#fff;border-bottom:1px solid #e3e9ef;'
    + 'font:500 13.5px/1.4 Assistant,"Segoe UI",system-ui,sans-serif;color:#5b6b7a;position:relative;z-index:60;text-align:right}'
    + '#sbeTop *{box-sizing:border-box}'
    + '#sbeTop .t-logo{flex:none;line-height:0;text-decoration:none;border:0;background:none;padding:0}#sbeTop .t-logo img{height:30px;width:auto;display:block}#sbeTop .t-logo.t-space img{height:52px;margin:-8px 0}'
    + '#sbeTop .t-path{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden}'
    + '#sbeTop .t-path a{color:#1d3f63;text-decoration:none;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:2.5em}#sbeTop .t-path a:hover{text-decoration:underline;text-underline-offset:3px}'
    + '#sbeTop .t-path .sep{color:#a9b6c3;flex:none}#sbeTop .t-path b{color:#1f2f3d;font-weight:700;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}'
    + '#sbeTop .t-act{flex:none;display:flex;align-items:center;gap:6px;margin-inline-start:auto}'
    + '#sbeTop .t-act>a,#sbeTop .t-act>button,#sbeTop .t-act>details>summary,#sbeTop #sbeAutoMenu>button,#sbeTop .t-extra>a,#sbeTop .t-extra>button{font-family:inherit!important;font-size:13px!important;font-weight:600!important;line-height:1.3!important;color:#1d3f63!important;background:#fff!important;border:1px solid #c9d7e7!important;border-radius:999px!important;'
    + 'padding:6px 13px!important;text-decoration:none!important;cursor:pointer;white-space:nowrap;box-shadow:none!important;min-height:32px;display:inline-flex;align-items:center;gap:4px;margin:0!important;height:auto!important}'
    + '#sbeTop .t-act>a:hover,#sbeTop .t-act>button:hover,#sbeTop .t-extra>a:hover,#sbeTop .t-extra>button:hover{background:#f2f7fa!important;border-color:#1d3f63!important}'
    + '#sbeTop .t-extra{display:flex;align-items:center;gap:6px}#sbeTop .t-extra:empty{display:none}'
    + '#sbeTop #sbeAutoMenu{position:relative!important;top:auto!important;inset:auto!important}#sbeTop #sbeAutoMenu>button{box-shadow:none}'
    + '#sbeTop details{position:relative;margin:0!important}#sbeTop details>summary{list-style:none}#sbeTop details>summary::-webkit-details-marker{display:none}'
    + '.sbe-top-old,.crumb,.brandrow,img[data-brand],.sbe-tagline,.cc-brand,.sbe-markbar{display:none!important}'
    + 'body.sbe-hasnav{padding-top:0!important}'
    + ':root[data-theme="dark"] #sbeTop{background:#141c24;border-color:#2b3a46;color:#9aabb8}:root[data-theme="dark"] #sbeTop .t-path b{color:#e4ecf1}:root[data-theme="dark"] #sbeTop .t-path a{color:#8cc3e0}'
    + ':root[data-theme="dark"] #sbeTop .t-logo img{background:#fff;border-radius:8px;padding:2px 6px}'
    + '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #sbeTop{background:#141c24;border-color:#2b3a46;color:#9aabb8}:root:not([data-theme="light"]) #sbeTop .t-path b{color:#e4ecf1}:root:not([data-theme="light"]) #sbeTop .t-path a{color:#8cc3e0}:root:not([data-theme="light"]) #sbeTop .t-logo img{background:#fff;border-radius:8px;padding:2px 6px}}'
    + '}'
    + '#sbeTop .t-ic{font-style:normal}'
    // 30/10/2026: "כל הסרגל העליון בנייד נראה מאוד צפוף ולא אלגנטי": בטלפון כפתורים עגולים קטנים עם סמל בלבד, לוגו קטן יותר, והנתיב בשורה דקה מתחת
    + '@media screen and (max-width:640px){#sbeTop{flex-wrap:wrap;gap:4px 6px;padding:6px 12px 7px;min-height:0}'
    + '#sbeTop .t-logo.t-space img{height:40px;margin:-4px 0}#sbeTop .t-logo img{height:26px}'
    + '#sbeTop .t-path{order:3;flex-basis:100%;font-size:12px;color:#7a8a98;padding-top:5px;border-top:1px solid #eef2f5}#sbeTop .t-path b{font-weight:600}'
    + '#sbeTop .t-act{gap:6px}#sbeTop .t-extra{display:none}'
    + '#sbeTop .t-act>a,#sbeTop .t-act>button,#sbeTop #sbeAutoMenu>button{width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;justify-content:center;border-radius:50%!important;border-color:#dfe7ef!important;font-size:0!important;gap:0!important}'
    + '#sbeTop .t-act .t-tx{display:none}#sbeTop .t-act .t-ic{font-size:16px;line-height:1}'
    + '#sbeTop #sbeAutoMenu>button::before{content:"☰";font-size:15px;line-height:1}}'
    + '@media print{#sbeTop{display:none!important}}';

  function clean(t) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    t = t.replace(/\s*[·|]\s*Be ?good\s*$/i, '').replace(/^Be ?good\s*[·|›]\s*/i, '');
    t = t.split('›').pop().split(/\s[·|]\s/)[0].split(':')[0].trim();
    return t.length > 42 ? t.slice(0, 42) + '…' : t;
  }
  function pageName(oldCrumb) {
    if (file === 'home.html') return 'המרחב שלי';
    if (file === 'admin.html') return 'ניהול';
    var b = document.body.getAttribute('data-crumb') || document.documentElement.getAttribute('data-crumb'); if (b) return clean(b);
    if (oldCrumb) { var c = clean(oldCrumb); if (c && !/^be ?good$/i.test(c)) return c; }
    var h = document.querySelector('h1'), im = h && h.querySelector('img[alt]');
    var t = (im && im.alt) || (h && h.textContent) || '';
    t = clean(t);
    if (!t || t.length < 2) t = clean(document.title);
    return t || 'Begood';
  }

  // הדרך שבה הגענו: נשמרת בלשונית
  function trail(name) {
    var me = file + (location.search || '');
    var list = []; try { list = JSON.parse(ss('sbe.trail') || '[]') || []; } catch (e) {}
    var sameSite = false; try { sameSite = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
    if (!sameSite) list = [];
    // 29/10/2026 ("המרחב שלי › תכנון שיחה › נוגי › תרגול צוותים"): הנתיב לא מצטבר בין כלים שלא קשורים.
    // דף בסיס (המרחב שלי, ניהול) או מעבר דרך תפריט ☰ מתחילים נתיב חדש; וכלי נוסף לנתיב רק כשהגענו אליו מהדף האחרון שבנתיב.
    if (ROOTS.test(file) || ss('sbe.trail.reset')) list = [];
    try { sessionStorage.removeItem('sbe.trail.reset'); } catch (e) {}
    var ref = ''; try { ref = sameSite ? (new URL(document.referrer).pathname.split('/').pop() || '') : ''; } catch (e) {}
    var at = -1; list.forEach(function (x, i) { if (x.f === file) at = i; });
    if (at >= 0) list = list.slice(0, at);
    else if (list.length && list[list.length - 1].f !== ref) list = [];
    list = list.filter(function (x) { return !ROOTS.test(x.f); });
    list.push({ f: file, p: me, n: name });
    list = list.slice(-4);
    ss('sbe.trail', JSON.stringify(list));
    return list;
  }

  // מעבר דרך תפריט ☰: נתיב חדש
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a && a.closest('#sbeAutoPanel, #navPanel, .sbe-menu-grp')) { try { sessionStorage.setItem('sbe.trail.reset', '1'); } catch (er) {} }
  }, true);

  function build() {
    if (document.getElementById('sbeTop')) return;
    var st = document.createElement('style'); st.id = 'sbe-top-css'; st.textContent = CSS; document.head.appendChild(st);

    // הסרגלים הישנים
    var OLD = '#navBar, nav.topnav, nav.r-topnav, nav.studies-topnav, .suite-return';
    var olds = Array.prototype.filter.call(document.querySelectorAll(OLD), function (n) { return !n.closest('header') || n.closest('header') === n; });
    var oldBack = null, oldHome = null, oldCrumb = '', extras = [], menus = [];
    olds.forEach(function (nav) {
      Array.prototype.slice.call(nav.children).forEach(function (el) {
        var tx = (el.textContent || '').trim();
        if (el.classList.contains('sbe-mark')) return;
        if (el.matches('.crumb, .nav-title, .sbe-crumb') || (el.tagName === 'SPAN' && /be ?good/i.test(tx))) { oldCrumb = oldCrumb || tx; return; }
        if (/חזרה/.test(tx) && !oldBack) { oldBack = el; return; }
        if (/המרחב שלי|המסך שלי/.test(tx)) { oldHome = oldHome || el; return; }
        if (el.id === 'navPanel') return;
        if (el.id === 'navMenuBtn' || /☰/.test(tx)) { menus.push(el); return; }
        extras.push(el);
      });
      nav.classList.add('sbe-top-old');
    });
    var loose = document.querySelector('.crumb'); if (!oldCrumb && loose) oldCrumb = loose.textContent;

    var name = pageName(oldCrumb);
    var list = trail(name);

    var bar = document.createElement('div'); bar.id = 'sbeTop'; bar.className = 'no-print sbe-no-theme'; bar.setAttribute('role', 'navigation'); bar.setAttribute('aria-label', 'איפה אני ואיך חוזרים');
    var logo = document.createElement('a'); logo.className = 't-logo sbe-no-theme'; logo.href = token ? HOME : 'entry.html';
    logo.setAttribute('aria-label', token ? 'Begood: המרחב שלי' : 'Begood: דף הבית');
    // הלוגו של המרחב (29/10/2026: "אני לא רואה את הלוגו המתאים לכל מרחב בפינה הימנית העליונה"): Begood בחינוך או Begood together; בלי כניסה הלוגו הכללי
    var SPACE = null; try { SPACE = token && typeof window.sbeSpace === 'function' ? window.sbeSpace() : null; } catch (e) {}
    var LG = SPACE === 'org' ? ['assets/begood-org.webp', 'Be good בארגונים', 1306, 988] : SPACE === 'edu' ? ['assets/begood-edu.webp', 'Be good בחינוך', 1306, 988] : ['assets/begood-logo-mark.webp', 'Begood', 1248, 756];
    var img = document.createElement('img'); img.src = LG[0]; img.alt = LG[1]; img.width = LG[2]; img.height = LG[3]; if (SPACE) logo.classList.add('t-space'); logo.appendChild(img);
    bar.appendChild(logo);

    var path = document.createElement('div'); path.className = 't-path';
    function sep() { var s = document.createElement('span'); s.className = 'sep'; s.textContent = '›'; s.setAttribute('aria-hidden', 'true'); path.appendChild(s); }
    function link(href, text) { var a = document.createElement('a'); a.href = href; a.textContent = text; a.className = 'sbe-no-theme'; path.appendChild(a); }
    var steps = [];
    if (file !== 'home.html' && file !== 'admin.html') steps.push(token ? { p: HOME, n: 'המרחב שלי' } : { p: 'entry.html', n: 'Begood' });
    var before = list.slice(0, -1);
    var par = parentOf(file);
    if (par && !before.some(function (x) { return x.f === par.p; })) before.push({ f: par.p, p: par.p, n: par.n });
    before.slice(-2).forEach(function (x) { steps.push({ p: x.p, n: x.n }); });
    steps.forEach(function (s) { link(s.p, s.n); sep(); });
    var cur = document.createElement('b'); cur.textContent = name; cur.setAttribute('aria-current', 'page'); path.appendChild(cur);
    bar.appendChild(path);

    var act = document.createElement('div'); act.className = 't-act';
    var ex = document.createElement('div'); ex.className = 't-extra'; extras.forEach(function (el) { ex.appendChild(el); }); act.appendChild(ex);
    var back = document.createElement('button'); back.type = 'button'; back.innerHTML = '<i class="t-ic" aria-hidden="true">→</i><span class="t-tx">חזרה</span>'; back.title = 'חזרה למסך הקודם'; back.setAttribute('aria-label', 'חזרה'); back.className = 'sbe-no-theme';
    back.addEventListener('click', function () {
      if (oldBack && oldBack.tagName === 'BUTTON') { oldBack.click(); return; }
      if (oldBack && oldBack.href) { location.href = oldBack.href; return; }
      var prev = list.length > 1 ? list[list.length - 2] : (par || null);
      var sameSite = false; try { sameSite = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
      if (sameSite && history.length > 1) history.back(); else location.href = prev ? prev.p : (token ? HOME : 'entry.html');
    });
    act.appendChild(back);
    if (file !== 'home.html') {
      var home = document.createElement('a'); home.className = 'sbe-no-theme';
      home.setAttribute('aria-label', token ? 'המרחב שלי' : 'דף הבית'); home.title = home.getAttribute('aria-label');
      if (token) { home.innerHTML = '<i class="t-ic" aria-hidden="true">⌂</i><span class="t-tx">המרחב שלי</span>'; home.href = HOME; home.addEventListener('click', function () { if (oldHome && oldHome.getAttribute('href')) home.href = oldHome.getAttribute('href'); }); }
      else { home.innerHTML = '<i class="t-ic" aria-hidden="true">⌂</i><span class="t-tx">דף הבית</span>'; home.href = 'entry.html'; }
      act.appendChild(home);
    }
    menus.forEach(function (el) { act.appendChild(el); }); // ☰ תמיד אחרון, בקצה השמאלי
    bar.appendChild(act);

    document.body.insertBefore(bar, document.body.firstChild);
    fit(bar);
    window.addEventListener('resize', function () { fit(bar); });
    // תפריט המסכים של מנהלת המערכת נכנס לסרגל
    var tries = 0, iv = setInterval(function () {
      var m = document.getElementById('sbeAutoMenu'); if (m && m.parentNode !== act) act.appendChild(m);
      if (++tries > 12) clearInterval(iv);
    }, 250);
    // שם הכלי כשהכותרת נבנית אחרי הטעינה
    setTimeout(function () { var n2 = pageName(oldCrumb); if (n2 && n2 !== cur.textContent && cur.textContent === 'Begood') cur.textContent = n2; }, 900);
  }

  // לרוחב כל המסך, צמוד למעלה, גם כשלגוף הדף יש שוליים או רוחב מוגבל
  function fit(bar) {
    bar.style.marginLeft = bar.style.marginRight = bar.style.marginTop = '0px';
    var r = bar.getBoundingClientRect(), W = document.documentElement.clientWidth;
    bar.style.marginLeft = (-r.left) + 'px';
    bar.style.marginRight = (-(W - r.right)) + 'px';
    var top = r.top + (window.scrollY || 0);
    if (top > 0) bar.style.marginTop = (-top) + 'px';
    var mb = parseFloat(getComputedStyle(bar).marginBottom) || 0;
    if (top > 0 && mb < 12) bar.style.marginBottom = Math.max(12, top) + 'px';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
