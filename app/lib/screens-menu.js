// תפריט כל המסכים — למנהלת המערכת בלבד. מקור אמת יחיד לתפריט הצד ב-admin.html ולתפריט "☰" בכל המסכים.
// שני חלקים: מה שרק היא רואה (מסכי עבודה), ומה שאחרים רואים — ולכל מסך: מי רואה אותו (לפי access-guard.js).
// מסך חדש? מוסיפים כאן, ובודקים את ההרשאה ב-access-guard.js.
(function(){
'use strict';
window.SBE_SCREENS = [
  { part:'mine', title:'🔒 רק את רואה — מסכי העבודה שלך', groups:[
    { title:'ניהול ובקרה', items:[
      { file:'admin.html', label:'מסך הניהול' },
      { file:'journeys.html', label:'🧭 לוח המסעות — אישורים ומשוב' },
      { file:'eval-set.html', label:'בקרת איכות' },
    ]},
  ]},
  { part:'others', title:'👥 מה שאחרים רואים', groups:[
    { title:'כניסה ומקורות', items:[
      { file:'entry.html', label:'מסך כניסה', who:'כולם' },
      { file:'system-select.html', label:'בחירת מערכת', who:'כניסה בקוד מוסד (הדרך הישנה)' },
      { file:'sources-library.html', label:'ספריית המקורות', who:'כל מי שנכנס/ה' },
    ]},
    { title:'סימולציה — שיחות מאתגרות', items:[
      { file:'input-screen.html', label:'יצירת תרחיש — סטודנטיות.ים', who:'מנחות סטודנטים' },
      { file:'parent-input-screen.html', label:'יצירת תרחיש — הורים', who:'מנחות הורים' },
      { file:'student-input-screen.html', label:'יצירת תרחיש — נוער', who:'מנחות נוער' },
      { file:'search.html', label:'חיפוש במאגר התרחישים', who:'מנחות' },
      { file:'facilitator-screen.html', label:'מסך הסדנה', who:'מנחות' },
      { file:'observation-sheet.html', label:'דף צפייה (טלפון)', who:'מתנסות בסדנה' },
      { file:'practice.html', label:'תרגול עצמי', who:'משתתפות בסדנה' },
      { file:'feedback.html', label:'משוב', who:'משתתפות ומנחות' },
      { file:'feedback-results.html', label:'תוצאות המשוב', who:'מנחות' },
    ]},
    { title:'תוצרי הסימולציה', items:[
      { file:'doc-facilitator.html', label:'גרסת המנחה', who:'רק את ומנחות הסימולציה' },
      { file:'doc-trainee.html', label:'גרסת המתנסה', who:'רק את ומנחות הסימולציה' },
      { file:'doc-actor.html', label:'גרסת השחקנית', who:'רק את ומנחות הסימולציה' },
      { file:'card-actor.html', label:'כרטיס שחקנית', who:'רק את ומנחות הסימולציה' },
    ]},
    { title:'כלים לאנשי חינוך', items:[
      { file:'conversation-planner.html', label:'תכנון שיחה', who:'הרשאת תכנון שיחה' },
      { file:'activity-planner.html', label:'תכנון פעילות', who:'הרשאת תכנון פעילות' },
      { file:'academic-review.html', label:'משוב לעבודה אקדמית או פרויקט', who:'הרשאת משוב לעבודות' },
    ]},
    { title:'חוסן חברתי', items:[
      { file:'resilience-studio.html', label:'סטודיו חוסן — השראה ופעולה', who:'הרשאת סטודיו בלבד (עד לאישור המקצועי)' },
      { file:'resilience-team.html', label:'מיפוי חוסן — מסך מחנך/ת', who:'הרשאת חוסן חברתי' },
      { file:'resilience-fill.html', label:'שאלון חוסן — מסך תלמיד/ה', who:'תלמידים, בקישור מהמחנך/ת' },
      { file:'resilience-advisor.html', label:'פרקטי — יועצת לפיתוח חוסן חברתי', who:'הרשאת חוסן חברתי או פרקטי' },
      { file:'leadership-advisor.html', label:'נוגי — יועצת למנהיגות תומכת חוסן', who:'הרשאת נוגי' },
      { file:'message-writer.html', label:'כתיבה מקדמת חוסן', who:'הרשאת כתיבה מקדמת חוסן בלבד' },
      { file:'facilitation-advisor.html', label:'ננה — מהוראה להנחיה', who:'הרשאת ננה' },
      { file:'journey.html', label:'מסע אל החוסן — מסך המשתתפים', who:'הרשאת מסע אל החוסן' },
    ]},
  ]},
  // דפי עזר מתהליך הבנייה — מקופלים בסוף התפריט, כדי שלא יפריעו (04/10/2026)
  { part:'archive', collapsed:true, title:'🗄 ארכיון — דפי עזר מתהליך הבנייה', groups:[
    { title:'הצגה והדגמה', items:[
      { file:'system-toc.html', label:'תוכן עניינים — כל המערכת' },
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
})();
