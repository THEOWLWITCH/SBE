// תפריט כל המסכים — למנהלת המערכת בלבד. מקור אמת יחיד לתפריט הצד ב-admin.html ולתפריט "☰" בכל המסכים.
// שני חלקים: מה שרק היא רואה (מסכי עבודה), ומה שאחרים רואים — ולכל מסך: מי רואה אותו (לפי access-guard.js).
// מסך חדש? מוסיפים כאן, ובודקים את ההרשאה ב-access-guard.js.
(function(){
'use strict';
window.SBE_SCREENS = [
  { part:'mine', title:'🔒 רק את רואה: מסכי העבודה שלך', groups:[
    { title:'ניהול ובקרה', items:[
      { file:'admin.html', label:'מסך הניהול' },
      { file:'journeys.html', label:'🧭 לוח המסעות: אישורים ומשוב' },
      { file:'eval-set.html', label:'בקרת איכות' },
      { file:'demo-lab.html', label:'🧪 מעבדת הדמו: תוצר מכל כלי' },
    ]},
  ]},
  { part:'others', title:'👥 מה שאחרים רואים', groups:[
    { title:'🌅 השער: מתחילים כאן', items:[
      { file:'entry.html', label:'מסך כניסה', who:'כולם' },
      { file:'map.html', label:'🗺 מפת הכלים', who:'כולם, גם בלי כניסה' },
      { file:'examples.html', label:'🗂 ספריית תוצרים לדוגמה', who:'כולם, גם בלי כניסה (רק מה שסומן במעבדת הדמו)' },
      { file:'sources-library.html', label:'ספריית המקורות', who:'כל מי שנכנס/ה' },
      { file:'system-select.html', label:'בחירת מערכת', who:'כניסה בקוד מוסד (הדרך הישנה)' },
    ]},
    { title:'🔍 1. לראות: איפה אנחנו היום?', items:[
      { file:'resilience-team.html', label:'מיפוי חוסן חברתי: מסך מחנך/ת', who:'הרשאת מיפוי חוסן חברתי' },
      { file:'resilience-fill.html', label:'שאלון חוסן: מסך תלמיד/ה', who:'תלמידים, בקישור מהמחנך/ת' },
      { file:'resilience-advisor.html', label:'פרקטי: יועצת לפיתוח חוסן חברתי', who:'הרשאת חוסן חברתי או פרקטי' },
      { file:'leadership-advisor.html', label:'נוגי: יועצת למנהיגות תומכת חוסן', who:'הרשאת נוגי' },
    ]},
    { title:'🎭 2. להתאמן: מוכנים לרגע המאתגר?', items:[
      { file:'input-screen.html', label:'יצירת תרחיש: סטודנטיות.ים', who:'מנחות סטודנטים' },
      { file:'parent-input-screen.html', label:'יצירת תרחיש: הורים', who:'מנחות הורים' },
      { file:'student-input-screen.html', label:'יצירת תרחיש: נוער', who:'מנחות נוער' },
      { file:'search.html', label:'חיפוש במאגר התרחישים', who:'מנחות' },
      { file:'facilitator-screen.html', label:'מסך הסדנה', who:'מנחות' },
      { file:'observation-sheet.html', label:'דף צפייה (טלפון)', who:'מתנסות בסדנה' },
      { file:'practice.html', label:'תרגול עצמי', who:'משתתפות בסדנה' },
      { file:'conversation-planner.html', label:'תכנון שיחה', who:'הרשאת תכנון שיחה' },
      { file:'facilitation-advisor.html', label:'ננה: מהוראה להנחיה', who:'הרשאת ננה' },
      { file:'family-bridge.html', label:'גשר בין הבית לכיתה', who:'מנהלת המערכת בלבד, עד לאישור (אחר כך: הרשאה bridge)' },
      { file:'shared-dialogue-lab.html', label:'מעבדת שיח וחקר משותף', who:'הרשאת מעבדת שיח וחקר משותף (dialogue)' },
      { file:'team-thinking.html', label:'חשיבת צוות', who:'הרשאת חשיבת צוות (teamthink)' },
    ]},
    { title:'🎭 2. להתאמן: תוצרי הסימולציה', items:[
      { file:'doc-facilitator.html', label:'גרסת המנחה', who:'רק את ומנחות הסימולציה' },
      { file:'doc-trainee.html', label:'גרסת המתנסה', who:'רק את ומנחות הסימולציה' },
      { file:'doc-actor.html', label:'גרסת השחקנית', who:'רק את ומנחות הסימולציה' },
      { file:'card-actor.html', label:'כרטיס שחקנית', who:'רק את ומנחות הסימולציה' },
    ]},
    { title:'🛠 3. לתכנן ולפעול: מה עושים מחר בבוקר?', items:[
      { file:'activity-planner.html', label:'תכנון פעילות', who:'הרשאת תכנון פעילות' },
      { file:'resilience-studio.html', label:'סטודיו חוסן: השראה ופעולה', who:'הרשאת סטודיו בלבד (עד לאישור המקצועי)' },
      { file:'message-writer.html', label:'כתיבה מקדמת חוסן', who:'הרשאת כתיבה מקדמת חוסן בלבד' },
    ]},
    { title:'📖 4. ללמוד מהעשייה: מה למדנו?', items:[
      { file:'social-resilience-studies.html', label:'לימודי חוסן חברתי', who:'הרשאת לימודי חוסן חברתי (studies)' },
      { file:'academic-review.html', label:'משוב לעבודות: להתכונן להגשה', who:'הרשאת משוב לעבודות' },
      { file:'feedback.html', label:'משוב', who:'משתתפות ומנחות' },
      { file:'feedback-results.html', label:'תוצאות המשוב', who:'מנחות' },
    ]},
    { title:'🔁 5. לעגן בשגרה: מה ימשיך לפעול גם כשמשהו משתבש?', items:[
      { file:'routines-hub.html', label:'מרכז שגרות ויוזמות חברתיות', who:'מנהלת המערכת בלבד, עד לאישור (אחר כך: הרשאה routines)' },
      { file:'continuity-kit.html', label:'תיק רציפות', who:'מנהלת המערכת בלבד, עד לאישור (אחר כך: הרשאה continuity)' },
      { file:'journey.html', label:'מסע אל החוסן: מסך המשתתפים', who:'הרשאת מסע אל החוסן' },
    ]},
  ]},
  // דפי עזר מתהליך הבנייה — מקופלים בסוף התפריט, כדי שלא יפריעו (04/10/2026)
  { part:'archive', collapsed:true, title:'🗄 ארכיון: דפי עזר מתהליך הבנייה', groups:[
    { title:'הצגה והדגמה', items:[
      { file:'system-toc.html', label:'תוכן עניינים: כל המערכת' },
      { file:'products/index.html', label:'תוצרים לדוגמה' },
      { file:'demo-hub.html', label:'מסך הדגמה כולל' },
    ]},
    { title:'סימולציה', items:[
      { file:'creative-assessment.html', label:'הערכה יצירתית' },
      { file:'practice-crossings.html', label:'חציות קווים אדומים' },
    ]},
  ]},
];
// בונה את התפריט בתוך host. opts: base ("../" מתוך products/), here (הקובץ הנוכחי), linkClass, skip (קבצים שלא מציגים),
// afterTitle(part, host) — תוספת מיד אחרי כותרת החלק (ב-admin.html: לשוניות הניהול בתוך "רק את רואה").
window.SBE_SCREENS_RENDER = function(host, opts){
  opts = opts || {};
  var base = opts.base || '', here = (opts.here || '').toLowerCase();
  window.SBE_SCREENS.forEach(function(part){
    var ph = document.createElement('div'); ph.textContent = part.title;
    ph.style.cssText = 'font-weight:800;font-size:.86rem;margin:.6rem 0 .15rem;padding:.35rem .6rem;border-radius:6px;' +
      (part.part === 'mine' ? 'background:rgba(184,137,59,.16);color:#7A5A22' : 'background:rgba(47,125,122,.14);color:#1F5E5B');
    var box = host;
    if (part.collapsed) {
      // חלק מקופל: נפתח בלחיצה (ופתוח מראש אם המסך הנוכחי בתוכו)
      box = document.createElement('details');
      var inside = part.groups.some(function(g){ return g.items.some(function(it){ return it.file.toLowerCase() === here; }); });
      if (inside) box.open = true;
      var sm = document.createElement('summary'); sm.textContent = part.title; sm.style.cssText = ph.style.cssText + 'cursor:pointer;background:rgba(91,104,115,.12);color:#5B6873';
      box.appendChild(sm); host.appendChild(box);
    } else host.appendChild(ph);
    if (opts.afterTitle) opts.afterTitle(part.part, host);
    // תפריט מצומצם (07/10/2026): כל קבוצה מקופלת, ונפתחת בלחיצה (פתוחה מראש רק כשהמסך הנוכחי בתוכה).
    // "מי רואה" (who) לא מוצג בתפריט — הוא תיעוד בלבד, לבדיקה מול access-guard.js.
    part.groups.forEach(function(g){
      var items = g.items.filter(function(it){ return (opts.skip || []).indexOf(it.file) === -1; });
      if (!items.length) return;
      var d = document.createElement('details'); d.className = 'sbe-menu-grp';
      if (items.some(function(it){ return it.file.toLowerCase() === here; })) d.open = true;
      var sm = document.createElement('summary'); sm.style.cssText = 'cursor:pointer;list-style:none';
      var h = document.createElement('h5'); h.style.display = 'inline';
      var mark = function(){ h.textContent = (d.open ? '▾ ' : '▸ ') + g.title; };
      mark(); d.addEventListener('toggle', mark);
      sm.appendChild(h); d.appendChild(sm); box.appendChild(d);
      items.forEach(function(it){
        var a = document.createElement('a'); a.href = base + it.file;
        if (opts.linkClass) a.className = opts.linkClass;
        if (it.file.toLowerCase() === here) a.className = (a.className ? a.className + ' ' : '') + 'current';
        a.appendChild(document.createTextNode(it.label));
        d.appendChild(a);
      });
    });
  });
};
// כפתור ☰ צף (11/10/2026: "לא רואה בתפריט את עבודת הצוות"): בדפים שטוענים את הקובץ ואין להם תפריט משלהם
// (הכלים החדשים: חשיבת צוות, מעבדת שיח, מרכז השגרות, תיק הרציפות, הגשר). רק למנהלת המערכת, לא בתוך iframe.
function autoMount(){
  var sys = false;
  try { sys = sessionStorage.getItem('sbe.session.homeUrl') === 'admin.html?role=sys'; } catch(e){}
  if (!sys || window.self !== window.top) return;
  if (document.getElementById('navMenuBtn') || document.getElementById('studio-screens') || document.getElementById('sbeAutoMenu')) return;
  var here = (location.pathname.split('/').pop() || '').toLowerCase();
  if (here === 'admin.html') return;
  var st = document.createElement('style');
  st.textContent = '#sbeAutoMenu{position:fixed;top:10px;inset-inline-end:10px;z-index:9997;direction:rtl;font-family:"Assistant","Segoe UI",system-ui,sans-serif}' +
    '#sbeAutoMenu>button{font:600 12.5px/1.4 inherit;padding:5px 11px;border-radius:14px;border:1px solid #CDD3D8;background:#FCFCFD;color:#141C24;cursor:pointer;box-shadow:0 2px 8px rgba(20,28,36,.12)}' +
    '#sbeAutoPanel{position:absolute;top:34px;inset-inline-end:0;width:270px;max-height:75vh;overflow-y:auto;background:#FCFCFD;border:1px solid #CDD3D8;border-radius:10px;box-shadow:0 14px 40px rgba(20,28,36,.22);padding:8px 0}' +
    '#sbeAutoPanel[hidden]{display:none}#sbeAutoPanel h5{font-size:12px;color:#5C6771;margin:8px 14px 4px;font-weight:700}' +
    '#sbeAutoPanel a{display:block;padding:7px 14px;color:#141C24;text-decoration:none;font-size:14.5px;border-inline-start:3px solid transparent}' +
    '#sbeAutoPanel a:hover{background:#EDEFF1}#sbeAutoPanel a.current{color:#2E5A7D;font-weight:700;background:#DCE7EF;border-inline-start-color:#2E5A7D}' +
    '@media print{#sbeAutoMenu{display:none}}';
  document.head.appendChild(st);
  var box = document.createElement('div'); box.id = 'sbeAutoMenu'; box.className = 'no-print';
  var b = document.createElement('button'); b.type = 'button'; b.textContent = '☰ תפריט'; b.title = 'כל המסכים';
  var panel = document.createElement('div'); panel.id = 'sbeAutoPanel'; panel.hidden = true;
  box.appendChild(b); box.appendChild(panel); document.body.appendChild(box);
  window.SBE_SCREENS_RENDER(panel, { here: here });
  b.addEventListener('click', function(){ panel.hidden = !panel.hidden; });
  document.addEventListener('click', function(e){ if (!panel.hidden && !box.contains(e.target)) panel.hidden = true; });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') panel.hidden = true; });
}
if (typeof document !== 'undefined' && typeof sessionStorage !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount); else autoMount(); }
})();
