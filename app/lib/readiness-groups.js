// חמש שאלות של מוכנות יומיומית (10/10/2026): החלוקה של כל הכלים בכל המערכת.
// "את החוסן אפשר למדוד רק מול משבר, אבל את המוכנות אפשר לבדוק כל יום, והיא הרובד של החוסן כאן ועכשיו."
// מקור אמת יחיד: תפריט ☰ (screens-menu.js), המרחב שלי (home.html), מפת הכלים (map.html), ספריית התוצרים (examples.html) ודף האודות.
// כלי חדש: מוסיפים את הדף ל-PAGES, ובודקים שהוא מופיע באותה קבוצה בכל המקומות.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_READY = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const GROUPS = [
    { id: 'see', i: '🔍', n: 'לראות', q: 'איפה אנחנו היום?' },
    { id: 'practice', i: '🎭', n: 'להתאמן', q: 'מוכנים לרגע המאתגר?' },
    { id: 'act', i: '🛠', n: 'לתכנן ולפעול', q: 'מה עושים מחר בבוקר?' },
    { id: 'learn', i: '📖', n: 'ללמוד מהעשייה', q: 'מה למדנו?' },
    { id: 'anchor', i: '🔁', n: 'לעגן בשגרה', q: 'מה ימשיך לפעול גם כשמשהו משתבש?' }
  ];
  const PAGES = {
    see: ['resilience-team.html', 'resilience-fill.html', 'resilience-advisor.html', 'leadership-advisor.html'],
    practice: ['input-screen.html', 'parent-input-screen.html', 'student-input-screen.html', 'search.html', 'facilitator-screen.html', 'observation-sheet.html',
      'practice.html', 'conversation-planner.html', 'facilitation-advisor.html', 'family-bridge.html',
      'doc-facilitator.html', 'doc-trainee.html', 'doc-actor.html', 'card-actor.html'],
    act: ['activity-planner.html', 'resilience-studio.html', 'message-writer.html'],
    learn: ['academic-review.html', 'feedback.html', 'feedback-results.html'],
    anchor: ['routines-hub.html', 'continuity-kit.html', 'journey.html']
  };
  const title = (g) => g.i + ' ' + (GROUPS.indexOf(g) + 1) + '. ' + g.n + ': ' + g.q;
  function groupOf(page) {
    const f = String(page || '').split('?')[0].split('/').pop();
    const id = Object.keys(PAGES).find((k) => PAGES[k].includes(f));
    return id ? GROUPS.find((g) => g.id === id) : null;
  }
  return { GROUPS, PAGES, title, groupOf };
});
