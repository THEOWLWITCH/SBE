/* כותרת אחידה לכל הכלים (30/10/2026: "אני רוצה לשנות את כל הכותרות שהחלפתי אתמול. הן לא אחידות והן גסות מדי בתצוגה בנייד";
   נבחר: האיור בצד, שם הכלי וקו דק בצבעי המותג ושורת הסבר, בגופן Fredoka; "fredoka for pdf as well").
   כל h1 שיש בו תמונת באנר (assets/<שם>-banner.webp) הופך לכותרת: סמל הכלי בעיגול (assets/icons/<שם>.webp), שם הכלי כטקסט,
   קו דק ושורת הסבר. ה-h1 עצמו נשאר (מזהים וקוד שנשענים עליו ממשיכים לעבוד). כותרת שנבנית אחרי הטעינה מקבלת את העיצוב לבד. */
(function () {
  'use strict';
  if (window.SBE_TH) return;
  var MAP = {
    'home': ['המרחב שלי', 'הכלים שלכם, במקום אחד'],
    'nana': ['ננה', 'מהוראה להנחיה שמקדמת חוסן חברתי'],
    'practi': ['פרקטי', 'חוסן חברתי בכיתה: ניתוח, פעולות ושיחות'],
    'nugi': ['נוגי', 'יועצת למנהיגות שמקדמת חוסן'],
    'continuity': ['תיק רציפות', 'מה ממשיך לפעול כשמישהו חסר'],
    'library': ['ספריית המחקר המשותפת', 'ידע משותף לחינוך ולארגונים'],
    'message-writer': ['תקשורת שמקדמת חוסן חברתי', 'הודעות, מכתבים ועדכונים בשפה מחזקת'],
    'scenario-parents': ['יצירת תרחיש: הורים', 'משחק תפקידים לקבוצת הורים'],
    'scenario-students': ['יצירת תרחיש: סטודנטיות.ים', 'סימולציה של שיחה מאתגרת'],
    'scenario-youth': ['יצירת תרחיש: נוער', 'משחק תפקידים לבני ובנות נוער'],
    'team-thinking': ['חשיבת צוות', 'חושבים יחד: כל הקולות, בעד ונגד, ומה הרווחנו'],
    'examples-edu': ['תוצרים לדוגמה', 'מהשדה החינוכי'],
    'examples-org': ['תוצרים לדוגמה', 'מהשדה הארגוני'],
    'academic-review': ['משוב לעבודות', 'משוב לפי קריטריונים, לפני ההגשה'],
    'studio': ['סטודיו חוסן', 'מהשראה לערכת פעולה'],
    'sources': ['ספריית המקורות', 'המקורות שעליהם נשענים הכלים'],
    'dialogue': ['מעבדת שיח וחקר משותף', 'שאלה, טענות, ראיות ותיקון יחד'],
    'studies': ['לימודי חוסן חברתי', 'חומרי לימוד, קבצים וקישורים'],
    'bridge': ['גשר בין הבית לכיתה', 'שגרת קשר שכל משפחה בוחרת'],
    'practice': ['תרגול לפי תרחיש', 'מתאמנים מול דמות ומקבלים משוב'],
    'mapping': ['מיפוי חוסן חברתי', 'תמונת מצב של הקבוצה והמלצות'],
    'conversation-planner': ['תכנון שיחה', 'מתכוננים לשיחה חשובה'],
    'activity-planner': ['תכנון פעילות', 'מרעיון לפעילות מוכנה או לרצף מפגשים'],
    'games': ['משחקי חוסן', 'להורדה ולמשחק על המסך'],
    'routines': ['מרכז שגרות ויוזמות חברתיות', 'מנגנון קבוע שהקבוצה בוחרת ומחזיקה'],
    'teams-practice': ['תרגול צוותים', 'צוותים מתרגלים יחד תרחיש מאתגר'],
    'network': ['מסע אל החוסן החברתי', 'דרך מלווה עם אבני דרך, עד תו חוסן'],
    'horizon': ['מעבדת האופק', 'תשעה כלים לחשוב יחד על העתיד'],
    'hl-roadmap': ['מהחזון להיום', 'כלי במעבדת האופק'],
    'hl-voice': ['קול הקהילה', 'כלי במעבדת האופק'],
    'hl-radar': ['רדאר החוסן החברתי', 'כלי במעבדת האופק'],
    'hl-horizons': ['שלושה אופקים', 'כלי במעבדת האופק'],
    'hl-stress': ['בדיקת עמידות', 'כלי במעבדת האופק'],
    'hl-futures': ['מחולל העתידים', 'כלי במעבדת האופק'],
    'hl-collage': ['תמונת עתיד קבוצתית', 'כלי במעבדת האופק'],
    'hl-circles': ['מעגלי העתיד', 'כלי במעבדת האופק'],
    'hl-game': ['רואים את האופק', 'כלי במעבדת האופק']
  };
  var base = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/lib\/tool-header\.js(\?.*)?$/, '') : ''; })();
  var CSS = '@media screen{'
    + 'h1.sbe-th{display:flex!important;align-items:center;gap:16px;margin:6px 0 18px!important;padding:0!important;line-height:1.15!important;background:none!important;border:0!important;max-width:none!important;text-align:right}'
    + 'h1.sbe-th .sbe-th-ic{flex:none;width:68px;height:68px;border-radius:50%;background:#fff;border:1px solid #d6e6ec;display:grid;place-items:center;box-shadow:0 1px 3px rgba(22,50,74,.06)}'
    + 'h1.sbe-th .sbe-th-ic img{max-width:48px!important;max-height:44px!important;width:auto!important;height:auto!important;display:block;margin:0!important;padding:0!important;background:none!important;border-radius:0!important}'
    + 'h1.sbe-th .sbe-th-tx{display:flex;flex-direction:column;align-items:flex-start;min-width:0}'
    + 'h1.sbe-th .sbe-th-n{font-family:"Fredoka","Assistant",sans-serif;font-weight:600;font-size:32px;line-height:1.12;color:#1d3f63;letter-spacing:.005em}'
    + 'h1.sbe-th .sbe-th-ln{display:block;width:44px;height:2px;border-radius:2px;margin:8px 0 6px;background:linear-gradient(90deg,#1d3f63,#1b9aaa,#3d9a5f)}'
    + 'h1.sbe-th .sbe-th-s{font-family:"Assistant",sans-serif;font-weight:400;font-size:16px;line-height:1.45;color:#5b6b7a}'
    + '.hero h1.sbe-th,.hl-hero h1.sbe-th{justify-content:flex-start}.sbe-th-absorbed{display:none!important}'
    + ':root[data-theme="dark"] h1.sbe-th .sbe-th-n{color:#e4ecf1}:root[data-theme="dark"] h1.sbe-th .sbe-th-s{color:#9aabb8}'
    + '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) h1.sbe-th .sbe-th-n{color:#e4ecf1}:root:not([data-theme="light"]) h1.sbe-th .sbe-th-s{color:#9aabb8}}'
    + '}'
    + '@media screen and (max-width:640px){h1.sbe-th{gap:11px;margin:4px 0 14px!important}h1.sbe-th .sbe-th-ic{width:48px;height:48px}h1.sbe-th .sbe-th-ic img{max-width:34px!important;max-height:30px!important}'
    + 'h1.sbe-th .sbe-th-n{font-size:22px!important}h1.sbe-th .sbe-th-ln{width:32px;margin:6px 0 5px}h1.sbe-th .sbe-th-s{font-size:13.5px}}'
    + '@media print{h1.sbe-th .sbe-th-ic,h1.sbe-th .sbe-th-ln{display:none}h1.sbe-th .sbe-th-s{display:block;font-size:13px;font-weight:400;color:#5C6771}}';
  // כל הכותרות בגופן הכותרות, גם בלי איור (30/10/2026: "תשנה את כל הכותרות לגופן הכותרות החדש גם אם אין איור").
  // לא בדפי המשחקים, ביש מה לעשות, במסמכי הסימולציה ובתעודה (יש להם גופנים משלהם).
  var FONT_SKIP = /^(games|memory-game|board-game|no-panic|story-maker|statement-sort|riddles|bingo|twenty-q|truth-dare|trail-signs|readiness-train|idea-garden|yesh-ma-laasot|doc-[a-z-]+|card-[a-z-]+|journey-cert)\.html$/;
  var page = (location.pathname.split('/').pop() || 'index.html');
  if (!FONT_SKIP.test(page) && !/\/products\//.test(location.pathname) && !document.documentElement.hasAttribute('data-no-theme')) {
    CSS += '@media screen{:is(h1,h2,h3,h4):not(.sbe-no-theme):not(.sbe-no-theme *){font-family:"Fredoka","Assistant",sans-serif!important;letter-spacing:.005em}'
      + 'h1:not(.sbe-th):not(.sbe-no-theme *){font-weight:600!important}:is(h2,h3,h4):not(.sbe-no-theme *){font-weight:500!important}}';
  }
  function css() {
    if (document.getElementById('sbe-th-css')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap'; document.head.appendChild(l);
    var s = document.createElement('style'); s.id = 'sbe-th-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function key(src) { var m = /assets\/([a-z0-9-]+)-banner\.webp/.exec(src || ''); return m ? m[1] : null; }
  function build(img) {
    var h = img.closest('h1'); if (!h) return;
    var k = key(img.getAttribute('src')); if (!k || !MAP[k]) return;
    if (h.getAttribute('data-th') === k) return;
    var alt = img.getAttribute('alt') || MAP[k][0];
    var ic = document.createElement('span'); ic.className = 'sbe-th-ic'; ic.setAttribute('aria-hidden', 'true');
    var im = document.createElement('img'); im.src = base + 'assets/icons/' + k + '.webp'; im.alt = alt; im.decoding = 'async'; ic.appendChild(im);
    var tx = document.createElement('span'); tx.className = 'sbe-th-tx';
    var n = document.createElement('span'); n.className = 'sbe-th-n'; n.textContent = MAP[k][0];
    var ln = document.createElement('span'); ln.className = 'sbe-th-ln';
    var sb = document.createElement('span'); sb.className = 'sbe-th-s'; sb.textContent = MAP[k][1];
    tx.appendChild(n); tx.appendChild(ln); tx.appendChild(sb);
    h.textContent = ''; h.appendChild(ic); h.appendChild(tx);
    h.classList.remove('hero-banner'); h.classList.add('sbe-th'); h.setAttribute('data-th', k);
    absorb(h, sb);
  }
  // תת-כותרת שכבר יש בדף (30/10/2026: "במקומות כמו מעבדת האופק שיש תת-כותרת - מה תעשה?"):
  // משפט קצר אחד מיד אחרי הכותרת נכנס לשורת ההסבר של הכותרת, ולא חוזר פעמיים. פסקת פתיחה ארוכה נשארת במקומה.
  function absorb(h, sb) {
    var n = h.nextElementSibling;
    if (!n || n.tagName !== 'P' || n.classList.contains('sbe-th-absorbed') || n.querySelector('a,button,input,img')) return;
    var t = (n.textContent || '').replace(/\s+/g, ' ').trim();
    if (t.length < 8 || t.length > 60 || /[.!?]\s+\S/.test(t)) return;
    sb.textContent = t.replace(/\.$/, '');
    n.classList.add('sbe-th-absorbed');
  }
  function scan(root) {
    (root.querySelectorAll ? root : document).querySelectorAll('h1 img[src*="-banner.webp"]').forEach(build);
  }
  function start() {
    css(); scan(document);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'attributes') { if (m.target.tagName === 'IMG' && /-banner\.webp/.test(m.target.getAttribute('src') || '')) { var h = m.target.closest('h1'); if (h) h.removeAttribute('data-th'); build(m.target); } return; }
        m.addedNodes.forEach(function (x) { if (x.nodeType === 1) { if (x.matches && x.matches('img[src*="-banner.webp"]')) build(x); else if (x.querySelector) scan(x); } });
      });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }
  window.SBE_TH = { MAP: MAP, build: build, scan: scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
