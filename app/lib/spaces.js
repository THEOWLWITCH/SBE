// ארבעה מרחבים, בית אחד (28/10/2026): החלוקה של כל הכלים למרחבים.
// "יש עכשיו הרבה מאוד כלים בשני מרחבים - ארגוני וחינוכי. יש כלים נפרדים ויש כלים משותפים. מערכת הניהול והשותפויות גם היא משותפת."
// המרחב הארגוני והמרחב החינוכי הם מרחבי עבודה; "משותף" מופיע בשניהם; ניהול ומחקר ושותפויות הם התשתית של שניהם.
// מי שנכנס/ת למרחב הארגוני רואה את הכלים הארגוניים ואת המשותפים, ולא את החינוכיים (וכך גם להפך).
// מקור אמת יחיד: המרחב שלי (home.html), דף הבית (entry.html), דף האודות, מפת הכלים וספריות התוצרים.
// כלי חדש: מוסיפים את הדף ל-PAGES במרחב שלו. הבדיקה harness/tests/spaces.test.mjs נכשלת אם דף מ-PAGES_BY_PERM חסר כאן.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SBE_SPACES = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SPACES = [
    { id: 'org', i: '🏢', n: 'המרחב הארגוני', who: 'ארגונים, קהילות, רשויות וצוותי הנהלה', color: '#1d3f63', soft: '#e8eef5', work: true },
    { id: 'shared', i: '↔', n: 'משותפים', who: 'כלים שמתאימים לשני העולמות', color: '#0f5f68', soft: '#dff1f3', work: true },
    { id: 'edu', i: '🎒', n: 'המרחב החינוכי', who: 'בתי ספר, גנים, אקדמיה והורים', color: '#245c3a', soft: '#e7f3ec', work: true },
    { id: 'admin', i: '⚙️', n: 'ניהול', who: 'כניסה, קודים, מוסדות, בקשות ובקרת איכות', color: '#3f4b56', soft: '#edf0f2' },
    { id: 'research', i: '🔬', n: 'מחקר ושותפויות', who: 'מחקר, השתתפות במחקר וסיפורים שנשמרו בהסכמה', color: '#5b4386', soft: '#f0ebf7' }
  ];
  const GAMES = ['games.html', 'memory-game.html', 'board-game.html', 'no-panic.html', 'story-maker.html', 'statement-sort.html', 'riddles.html',
    'bingo.html', 'twenty-q.html', 'truth-dare.html', 'trail-signs.html', 'readiness-train.html', 'idea-garden.html'];
  const HORIZON = ['horizon-lab.html', 'hl-voice.html', 'hl-radar.html', 'hl-futures.html', 'hl-circles.html', 'hl-horizons.html', 'hl-collage.html',
    'hl-roadmap.html', 'hl-game.html', 'hl-stress.html'];
  const PAGES = {
    // הכלים של המרחב הארגוני בלבד: התיקייה הארגונית ו-Begood together (28/10/2026); כאן ייכנסו כלים שיוכנו לארגונים
    org: ['examples-org.html', 'org-suite.html'],
    shared: [...HORIZON, 'journey.html', 'journey-cert.html', 'team-thinking.html', 'message-writer.html', 'communication-continuity.html',
      'yesh-ma-laasot.html', 'social-resilience-studies.html', 'sources-library.html', 'org-library.html', 'resilience-advisor-sources.html'],
    edu: ['resilience-team.html', 'resilience-fill.html', 'resilience-advisor.html', 'leadership-advisor.html', 'facilitation-advisor.html',
      'activity-planner.html', 'conversation-planner.html', 'resilience-studio.html',
      'input-screen.html', 'parent-input-screen.html', 'student-input-screen.html', 'search.html', 'facilitator-screen.html',
      'observation-sheet.html', 'practice.html', 'doc-facilitator.html', 'doc-trainee.html', 'doc-actor.html', 'card-actor.html',
      'feedback.html', 'feedback-results.html', 'shared-dialogue-lab.html', ...GAMES, 'academic-review.html',
      'family-bridge.html', 'routines-hub.html', 'continuity-kit.html', 'examples.html'],
    admin: ['entry.html', 'index.html', 'home.html', 'map.html', 'about.html', 'renew.html', 'admin.html', 'demo-lab.html', 'eval-set.html',
      'journeys.html', 'system-select.html'],
    research: ['research-management.html', 'research-participation.html']
  };
  // בדרך למרחב הארגוני (28/10/2026: "בינתיים היא תשאר בחינוכי אבל תכין אותה גם לארגוני. תזכור להזכיר לי")
  const COMING_TO_ORG = [
    { page: 'leadership-advisor.html', n: 'נוגי', why: 'לצוותי הנהלה בארגונים' },
    { page: 'routines-hub.html', n: 'מרכז השגרות', why: 'מנגנונים קבועים בצוות ובארגון' },
    { page: 'continuity-kit.html', n: 'תיק הרציפות', why: 'רציפות כשמישהו חסר בצוות' },
    { page: 'games.html', n: 'משחקי חוסן למבוגרים', why: 'תרגול לצוותים' }
  ];
  const norm = (p) => String(p || '').split('?')[0].split('#')[0].split('/').pop().toLowerCase();
  const spaceOf = (page) => { const f = norm(page); return Object.keys(PAGES).find((k) => PAGES[k].includes(f)) || null; };
  // מה רואים במרחב עבודה: הכלים של המרחב והמשותפים
  const visibleIn = (space, page) => { const s = spaceOf(page); return s === space || s === 'shared'; };
  const meta = (id) => SPACES.find((s) => s.id === id) || null;
  const TAGLINE = { he: 'להיות מוכנים לאתגרי החיים', en: "Ready for Life's Challenges", ar: 'أن نكون مستعدين لتحديات الحياة' };
  return { SPACES, PAGES, COMING_TO_ORG, TAGLINE, spaceOf, visibleIn, meta };
});
