// צועדים אל החוסן: משחק לוח (22/10/2026), על המסך ולהדפסה. מקור אמת אחד ללוח, למשימות, לאירועים ולהוראות.
// "יש 4 משתתפים, מטילים קובייה ומתקדמים על לוח... בכל צעד יש משימה... בסוף המסלול מגיעים אל החוסן.
//  אפשר לשחק בקבוצות. אפשר לשחק קבוצה אחת עם 5 כלי משחק והמטרה שיתופית: להביא את כל הכלים לסוף בזמן מסוים."
(function (root, factory) {
  const MG = (typeof module !== 'undefined' && module.exports) ? require('./memory-game.js') : root.SBE_MEMORY;
  const B = factory(MG);
  if (typeof module !== 'undefined' && module.exports) module.exports = B;
  else root.SBE_BOARD = B;
})(typeof self !== 'undefined' ? self : this, function (MG) {
  'use strict';
  const cr = MG.creature;
  const esc = MG.esc;
  const N = 36; // צעדים בין "יוצאים לדרך" (0) לבין "חוסן" (37)
  const END = N + 1;

  // ---------- תוכן ----------
  const TASKS = [
    'לומר שני משפטים מחזקים למי שיושב/ת לידך.',
    'לומר שתי יכולות של מישהו אחר במשחק.',
    'לספר על פעם שמישהו עזר לך.',
    'להציע דרך אחת לעזור למישהו שמרגיש לבד.',
    'לומר תודה למישהו בקבוצה, ולהסביר על מה.',
    'לתאר במשפט אחד מקום שבו מרגישים שייכות.',
    'להציע כלל אחד שיעזור לקבוצה לעבוד יחד.',
    'לתכנן: מה עושים אם החשמל נופל בערב? שלושה דברים.',
    'לשאול מישהו "מה שלומך היום?", ולהקשיב לתשובה עד הסוף.',
    'להשלים את המשפט: "ביחד אנחנו יכולים...".',
    'לספר על שגרה קטנה שעוזרת ביום עמוס.',
    'לחזור במילים שלך על מה שאמר/ה המשתתף/ת הקודם/ת.',
    'להמציא תפקיד חדש בכיתה או בצוות, שיעזור לכולם.',
    'לומר מה מאחלים לקבוצה בעוד שנה.',
    'לתת מחמאה למישהו בקבוצה על משהו שעשה.',
    'לבקש עזרה ממישהו במשחק במשהו קטן, למשל להטיל בשבילך את הקובייה.',
    'לספר על הבדל בינך לבין חבר או חברה, שעוזר לכם להיות צוות.',
    'להציע דרך להשלים אחרי ריב.',
    'לבחור מילה אחת שמתארת את הקבוצה שלנו, ולהסביר.',
    'להציע טקס קטן שאפשר לעשות יחד כל שבוע.',
    'לומר משהו שלמדת ממישהו אחר.',
    'לתאר רגע שבו הקבוצה הצליחה יחד.',
    'לשאול שאלה פתוחה את מי שיושב/ת לידך, ולהקשיב.',
    'לספר מה אפשר לעשות כשמישהו חדש מצטרף לקבוצה.'
  ];
  const SETBACKS = {
    s1: { text: 'סופה ניתקה את החשמל, ואין נרות בבית.', back: 4 },
    s2: { text: 'עברתי לבית ספר חדש, ולא הכרתי אף אחד.', back: 3 },
    s3: { text: 'רבתי עם חבר טוב, ולא דיברנו כל היום.', back: 3 },
    s4: { text: 'הטיול שחיכינו לו בוטל ברגע האחרון.', back: 2 },
    s5: { text: 'המחשב קרס, ועבודת הקבוצה נמחקה.', back: 3 },
    s6: { text: 'חליתי ונשארתי בבית שבוע שלם.', back: 3 }
  };
  const BOOSTS = {
    b1: { text: 'ביקשתי עזרה, וקיבלתי.', fwd: 2 },
    b2: { text: 'הכיתה הקימה לוח עזרה: מי מבקש עזרה ומי יכול לעזור.', fwd: 2 },
    b3: { text: 'חגגנו יחד הצלחה של כל הקבוצה.', fwd: 2 },
    b4: { text: 'מישהו חדש הצטרף, וכולם קיבלו אותו בשמחה.', fwd: 3 },
    b5: { text: 'תכננו מראש מה עושים כשאין חשמל: פנסים, נרות, ומי בודק מה שלום מי.', fwd: 4 },
    b6: { text: 'השכנים בנו שרשרת קשר, וכל אחד יודע למי לפנות.', fwd: 3 }
  };
  const TOGETHER = {
    t1: 'כל אחד ואחת אומרים מילה אחת שנותנת להם כוח.',
    t2: 'מסכימים יחד על כלל אחד לקבוצה שלנו.',
    t3: 'כל אחד ואחת אומרים תודה למישהו במשחק, ומסבירים על מה.',
    t4: 'מחליטים יחד: מה עושים בפעם הבאה שמישהו חוזר אחורה במשחק?'
  };
  // הגשר: כשמשתתף/ת אחר/ת אומר/ת איך היה/תה עוזר/ת במצב הזה, חוזרים רק חצי (לפחות צעד אחד)
  const bridgeBack = (n) => Math.max(1, Math.floor(n / 2));

  const SPECIAL = { 3: 'b1', 5: 's4', 6: 't1', 9: 'b2', 11: 's2', 13: 't2', 15: 'b4', 17: 's1', 20: 'b5', 22: 's3', 23: 't3', 26: 'b3', 28: 's5', 30: 'b6', 32: 's6', 34: 't4' };
  function square(k) {
    if (k === 0) return { k, type: 'start' };
    if (k === END) return { k, type: 'end' };
    const id = SPECIAL[k];
    if (!id) return { k, type: 'task' };
    if (id[0] === 's') return Object.assign({ k, type: 'setback', id }, SETBACKS[id]);
    if (id[0] === 'b') return Object.assign({ k, type: 'boost', id }, BOOSTS[id]);
    return { k, type: 'together', id, text: TOGETHER[id] };
  }

  const RULES = {
    title: 'צועדים אל החוסן',
    sub: 'משחק לוח · 2 עד 4 משתתפים או קבוצות, או משחק שיתופי עם 5 כלים',
    ready: ['כל משתתף/ת או קבוצה בוחר/ת כלי משחק ומניח/ה אותו ב"יוצאים לדרך".', 'מערבבים את קלפי המשימה ומניחים אותם הפוכים ליד הלוח.', 'צריכים קובייה אחת. אפשר להטיל קובייה רגילה, או להשתמש בקובייה שעל המסך.'],
    play: [
      'בתור, מטילים את הקובייה ומתקדמים מספר צעדים כמו שיצא.',
      'כוכב (משימה): מרימים קלף משימה, קוראים בקול ומבצעים.',
      'שלושה יצורונים (כולם יחד): כל המשתתפים מבצעים יחד את מה שכתוב על המשבצת.',
      'גשר (קדימה): קוראים את מה שקרה ומתקדמים.',
      'ענן (מכשול): קוראים את מה שקרה וחוזרים אחורה.'
    ],
    bridge: 'מכשול ועזרה: כשמישהו נוחת על ענן, כל משתתף/ת אחר/ת יכול/ה לומר איך היה/תה עוזר/ת במצב הזה. מי שקיבל/ה עזרה חוזר/ת רק חצי מהצעדים (לפחות צעד אחד).',
    modes: [
      ['בתורות', 'כל משתתף/ת או קבוצה עם כלי משלו. המשחק נגמר כשכולם מגיעים אל החוסן: מגיעים יחד, וכל מי שכבר הגיע/ה ממשיך/ה לעזור לאחרים במכשולים.'],
      ['שיתופי, מול השעון', 'כל הקבוצה משחקת יחד עם 5 כלים. מסכימים מראש על זמן (למשל 20 דקות). בכל תור מישהו מטיל/ה, והקבוצה בוחרת איזה כלי להזיז. המטרה: להביא את כל חמשת הכלים אל החוסן לפני שהזמן נגמר.']
    ],
    closing: ['איזו משימה הייתה משמעותית בשבילך, ולמה?', 'מה עזר לנו להתקדם כשמישהו חזר אחורה?', 'מה מהמשחק אפשר לקחת לכיתה, לצוות או לבית השבוע?'],
    closingWho: 'בסוף המשחק המנחה שואל/ת את הקבוצה, כדי לקשר בין המסע במשחק לחיים בכיתה, בצוות או בבית:'
  };

  // ---------- הלוח ----------
  const W = 1200, H = 800;
  // דרך מתפתלת (22/10/2026: "לוח מעוצב באופן מקורי ויצירתי, אלגנטי ומיוחד... אוירה של משחק ולא של משרד עורכי דין"):
  // עקומה חלקה דרך נקודות ציון, והמשבצות בפיזור שווה לאורכה
  const WAY = [[1096, 724], [930, 742], [720, 728], [520, 744], [380, 712], [334, 640], [384, 568], [560, 552], [760, 578], [960, 552], [1108, 506], [1142, 428], [1078, 362], [900, 372], [700, 344], [500, 374], [364, 338], [330, 262], [380, 196], [450, 180], [600, 196], [760, 160], [910, 176], [1016, 160]];
  let PATH = null;
  function curve() {
    if (PATH) return PATH;
    const P = WAY, pts = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
      for (let t = 0; t < 1; t += 0.02) {
        const t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    pts.push(P[P.length - 1]);
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const at = (d) => { let i = 1; while (i < len.length - 1 && len[i] < d) i++; const r = (d - len[i - 1]) / ((len[i] - len[i - 1]) || 1); return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * r, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * r }; };
    const total = len[len.length - 1], spots = [];
    for (let k = 0; k <= END; k++) spots.push(at(total * k / END));
    const d = 'M' + pts.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L');
    PATH = { spots, d };
    return PATH;
  }
  function pos(k) {
    if (k >= END) return { x: 1108, y: 136 };
    return curve().spots[Math.max(0, k)];
  }
  // צבעים: [רקע עדין, צבע הסוג, טקסט כהה]
  const COL = {
    task: ['#EEF8FA', '#1A9BB5', '#14708A'], setback: ['#FFF1EC', '#E0603F', '#B23A26'], boost: ['#EEF8F1', '#2E9C61', '#21704A'], together: ['#FFF8E2', '#E0A800', '#8F5A00']
  };
  const LOGO = 'assets/begood-logo-sm.webp';
  // סמל בתוך עיגול צבעוני (תג), כדי שיהיה ברור גם בקטן ובהדפסה
  function icon(type, x, y, s) {
    s = s || 1;
    const c = (COL[type] || COL.task)[1];
    const g = (inner) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="17" fill="${c}"/><circle r="17" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>${inner}</g>`;
    if (type === 'task') return g(MG.star(0, 0.5, 10.5, '#fff').replace('stroke="#E0A800"', 'stroke="#fff"'));
    if (type === 'setback') return g(`<g fill="#fff"><circle cx="-5" cy="-1" r="5.4"/><circle cx="2" cy="-4.5" r="6.4"/><circle cx="7.5" cy="0" r="4.6"/><rect x="-10" y="-1" width="22" height="6" rx="3"/></g><path d="M1.5 5.5 L-2 11 L1.5 10.5 L-0.5 15.5 L5.5 8.5 L2 9 L4 5.5 Z" fill="#FFD34F"/>`);
    if (type === 'boost') return g(`<path d="M-11 5 Q0 -9 11 5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M-7 5 V0 M-2.5 5 V-3 M2.5 5 V-3 M7 5 V0" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M-13 6 H13" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`);
    if (type === 'together') return g(`<g fill="#fff"><circle cx="-7.5" cy="-3" r="3.6"/><circle cx="7.5" cy="-3" r="3.6"/><circle cx="0" cy="-6" r="4.2"/><path d="M-13 8 Q-7.5 -1 -2 8 Z M2 8 Q7.5 -1 13 8 Z M-6 9 Q0 -3 6 9 Z"/></g>`);
    return '';
  }
  function label(sq) {
    if (sq.type === 'task') return 'משימה';
    if (sq.type === 'together') return 'כולם יחד';
    if (sq.type === 'setback') return sq.back + ' אחורה';
    if (sq.type === 'boost') return sq.fwd + ' קדימה';
    return '';
  }
  const T = (x, y, size, w, fill, txt, fam) => `<text x="${x}" y="${y}" text-anchor="middle" direction="rtl" font-family="${fam || 'Assistant,Arial,sans-serif'}" font-weight="${w}" font-size="${size}" fill="${fill}">${txt}</text>`;
  // האי של החוסן: חוף, דשא, עצים, בית וקהילה, ושלט
  function island(x, y) {
    const tree = (tx, ty, s) => `<g transform="translate(${tx} ${ty}) scale(${s})"><rect x="-2" y="0" width="4" height="12" rx="2" fill="#8A6A45"/><circle cx="0" cy="-6" r="10" fill="#3A9E6B"/><circle cx="-6" cy="-1" r="7" fill="#4FB27C"/><circle cx="6" cy="-2" r="7" fill="#4FB27C"/></g>`;
    return `<g>
<ellipse cx="${x}" cy="${y + 8}" rx="88" ry="66" fill="#BFE6F0" opacity=".7"/>
<path d="M${x - 80} ${y + 12} C${x - 82} ${y - 40} ${x - 40} ${y - 62} ${x} ${y - 60} C${x + 46} ${y - 60} ${x + 84} ${y - 34} ${x + 80} ${y + 14} C${x + 76} ${y + 52} ${x + 34} ${y + 64} ${x} ${y + 62} C${x - 38} ${y + 62} ${x - 78} ${y + 50} ${x - 80} ${y + 12} Z" fill="#F2E2B6"/>
<path d="M${x - 70} ${y + 8} C${x - 70} ${y - 34} ${x - 36} ${y - 52} ${x} ${y - 51} C${x + 40} ${y - 51} ${x + 72} ${y - 30} ${x + 70} ${y + 10} C${x + 66} ${y + 40} ${x + 30} ${y + 50} ${x} ${y + 49} C${x - 32} ${y + 49} ${x - 68} ${y + 38} ${x - 70} ${y + 8} Z" fill="#9FDAB2"/>
<path d="M${x - 62} ${y + 18} C${x - 30} ${y - 4} ${x + 24} ${y - 6} ${x + 62} ${y + 16} C${x + 50} ${y + 40} ${x + 20} ${y + 46} ${x} ${y + 46} C${x - 26} ${y + 46} ${x - 52} ${y + 38} ${x - 62} ${y + 18} Z" fill="#7CCB97"/>
${tree(x - 50, y - 22, .9)}${tree(x + 52, y - 18, .8)}${tree(x - 34, y - 34, .7)}
<path d="M${x - 20} ${y - 18} L${x} ${y - 38} L${x + 20} ${y - 18} Z" fill="#FF8F70"/><rect x="${x - 15}" y="${y - 19}" width="30" height="22" rx="2" fill="#fff"/><rect x="${x - 4}" y="${y - 9}" width="8" height="12" rx="1.5" fill="#FFC929"/><rect x="${x + 6}" y="${y - 15}" width="6" height="6" fill="#BFE6F0"/>
${cr(x - 34, y + 14, .24, 'teal', { arms: { l: 'up', r: 'up' }, eyes: 'happy' })}${cr(x - 12, y + 22, .24, 'sun', { arms: { l: 'up', r: 'up' }, eyes: 'happy' })}${cr(x + 12, y + 22, .24, 'coral', { arms: { l: 'up', r: 'up' }, eyes: 'happy', bow: true })}${cr(x + 34, y + 14, .24, 'lilac', { arms: { l: 'up', r: 'up' }, eyes: 'happy', antenna: true })}${cr(x, y + 34, .22, 'green', { arms: { l: 'up', r: 'up' }, eyes: 'happy', tuft: true })}
<g transform="translate(${x} ${y + 64})"><path d="M-56 -15 H56 L48 0 L56 15 H-56 L-48 0 Z" fill="#1B4F7A"/>${T(0, 8, 23, 900, '#fff', 'חוסן', "'Frank Ruhl Libre',Georgia,serif")}</g>
</g>`;
  }
  // איור קטן לכל משבצת מיוחדת (22/10/2026: "תוסיף למסע דברים מעניינים ולא איקונים גנריים"), במרחב של עיגול ברדיוס 44
  const house0 = (x, y, s, roof, body) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-13" y="-10" width="26" height="20" rx="2" fill="${body || '#FFFDF7'}"/><path d="M-17 -9L0 -24L17 -9Z" fill="${roof}"/><rect x="-4" y="1" width="8" height="9" rx="1.5" fill="#FFC929"/><rect x="5" y="-5" width="5" height="5" rx="1" fill="#BFE6F0"/></g>`;
  const VIG = {
    s1: ['#33465E', `<g fill="#9FB3C4"><ellipse cx="-8" cy="-24" rx="16" ry="9"/><circle cx="4" cy="-28" r="11"/><ellipse cx="14" cy="-22" rx="12" ry="8"/></g><path d="M6 -16l-6 11h6l-4 10l11-14h-6l4-7z" fill="#FFD34F"/><g stroke="#8FD3E0" stroke-width="2.2" stroke-linecap="round"><path d="M-24 -10l-3 6M-14 -6l-3 6M22 -8l-3 6M30 -2l-3 6"/></g>${house0(-6, 22, 1.15, '#7C8C95', '#5D7186')}<rect x="-11" y="20" width="9" height="12" fill="#22303F"/>`],
    s2: ['#FFE6DD', `<rect x="-38" y="-10" width="44" height="40" fill="#fff"/><path d="M-42 -9L-16 -26L10 -9Z" fill="#E0603F"/><path d="M-16 -26v-12" stroke="#1B4F7A" stroke-width="2"/><path d="M-16 -38l10 4l-10 4z" fill="#FFC929"/><g fill="#BFE6F0"><rect x="-32" y="0" width="9" height="8"/><rect x="-10" y="0" width="9" height="8"/></g><rect x="-21" y="14" width="10" height="16" fill="#1A9BB5"/>${cr(24, 16, .3, 'lilac', { mouth: 'sad', look: [-3, 0], arms: { l: 'down', r: 'down' } })}`],
    s3: ['#FFE6DD', `${cr(-17, 12, .32, 'teal', { flip: true, mouth: 'sad', look: [3, 0] })}${cr(18, 12, .32, 'coral', { mouth: 'sad', look: [3, 0], bow: true })}<g transform="translate(0 -26)"><g fill="#9FB3C4"><ellipse cx="-6" cy="0" rx="11" ry="7"/><circle cx="3" cy="-4" r="8"/><ellipse cx="10" cy="1" rx="8" ry="6"/></g><path d="M2 4l-4 7h4l-3 6l8-9h-4l3-4z" fill="#FFD34F"/></g>`],
    s4: ['#FFE6DD', `<rect x="-34" y="-12" width="66" height="30" rx="7" fill="#FFC929"/><g fill="#fff"><rect x="-28" y="-6" width="11" height="10" rx="2"/><rect x="-13" y="-6" width="11" height="10" rx="2"/><rect x="2" y="-6" width="11" height="10" rx="2"/></g><rect x="18" y="-6" width="10" height="20" rx="2" fill="#E8EEF2"/><circle cx="-20" cy="19" r="6" fill="#1F2A36"/><circle cx="18" cy="19" r="6" fill="#1F2A36"/><circle r="31" fill="none" stroke="#E0603F" stroke-width="5"/><path d="M-22 22L22 -22" stroke="#E0603F" stroke-width="5" stroke-linecap="round"/>`],
    s5: ['#FFE6DD', `<rect x="-28" y="-26" width="52" height="36" rx="4" fill="#1B4F7A"/><rect x="-24" y="-22" width="44" height="28" rx="2" fill="#E3F4F8"/><path d="M-10 -14l6 6M-4 -14l-6 6M8 -14l6 6M14 -14l-6 6" stroke="#E0603F" stroke-width="2.4" stroke-linecap="round"/><path d="M-8 2q6-5 12 0" fill="none" stroke="#1F2A36" stroke-width="2.2" stroke-linecap="round"/><path d="M-34 12h64l-6 8h-52z" fill="#B9C6CF"/>${cr(22, 20, .2, 'green', { mouth: 'o', arms: { l: 'up', r: 'up' } })}`],
    s6: ['#FFE6DD', `<rect x="-36" y="4" width="70" height="14" rx="4" fill="#1A9BB5"/><rect x="-36" y="-12" width="6" height="34" rx="3" fill="#1B4F7A"/><ellipse cx="-20" cy="2" rx="11" ry="6" fill="#fff"/>${cr(-18, -4, .2, 'sun', { eyes: 'closed', mouth: 'sad' })}<path d="M-12 4h44v12h-44z" fill="#9FD8E6"/><g transform="translate(22 -22) rotate(30)"><rect x="-3" y="-14" width="6" height="22" rx="3" fill="#fff" stroke="#1B4F7A" stroke-width="1.4"/><circle cy="10" r="5" fill="#E0603F"/></g>`],
    b1: ['#E2F5EA', `${cr(-15, 12, .34, 'teal', { arms: { l: 'down', r: ['reach', 28] }, eyes: 'happy' })}${cr(18, 18, .28, 'sun', { flip: true, arms: { l: 'down', r: ['reach', 28] }, look: [3, -2] })}${MG.spark(0, -28, 1)}${MG.spark(22, -20, .6)}`],
    b2: ['#E2F5EA', `<rect x="-32" y="-28" width="64" height="48" rx="4" fill="#C99A62" stroke="#8C6B4A" stroke-width="3"/><rect x="-26" y="-22" width="22" height="18" fill="#FFE07A" transform="rotate(-5 -15 -13)"/><rect x="4" y="-22" width="22" height="18" fill="#FFB3C4" transform="rotate(4 15 -13)"/><rect x="-24" y="0" width="22" height="16" fill="#9FE0C0"/><rect x="4" y="0" width="22" height="16" fill="#A8DDF0" transform="rotate(-3 15 8)"/><g fill="#E0603F"><circle cx="-15" cy="-22" r="2.2"/><circle cx="15" cy="-22" r="2.2"/><circle cx="-13" cy="0" r="2.2"/><circle cx="15" cy="0" r="2.2"/></g><path d="M-22 -14h12M-20 -9h8M8 -14h12M-20 8h12M8 8h12" stroke="#1F2A36" stroke-width="1.6" opacity=".5"/>${cr(0, 30, .16, 'green', { eyes: 'happy', arms: { l: 'up', r: 'up' } })}`],
    b3: ['#E2F5EA', `<g stroke="#7C8C95" stroke-width="1.4" fill="none"><path d="M-18 -8q4 14 6 28M2 -14q-2 16 0 34M20 -6q-4 14-6 26"/></g><ellipse cx="-18" cy="-20" rx="10" ry="12" fill="#FF8F70"/><ellipse cx="2" cy="-26" rx="10" ry="12" fill="#FFC929"/><ellipse cx="20" cy="-18" rx="10" ry="12" fill="#1A9BB5"/>${cr(0, 26, .24, 'green', { arms: { l: 'up', r: 'up' }, eyes: 'happy', mouth: 'open', tuft: true })}<g><rect x="-34" y="0" width="4" height="7" fill="#F06A9B" transform="rotate(30 -32 3)"/><rect x="30" y="4" width="4" height="7" fill="#FFC929" transform="rotate(-25 32 7)"/><rect x="-26" y="18" width="4" height="7" fill="#1A9BB5"/><rect x="24" y="22" width="4" height="7" fill="#7A5CC0" transform="rotate(40 26 25)"/></g>`],
    b4: ['#E2F5EA', `${cr(-24, 10, .24, 'teal', { arms: { l: 'down', r: 'wave' }, eyes: 'happy' })}${cr(-4, 18, .24, 'coral', { arms: { l: 'down', r: 'wave' }, eyes: 'happy', bow: true })}${cr(24, 8, .26, 'lilac', { flip: true, arms: { l: 'down', r: 'wave' }, look: [-2, -1], antenna: true })}${MG.spark(24, -26, .8)}${MG.spark(36, -14, .5)}`],
    b5: ['#2E4157', `<path d="M-10 4L34 -26V30Z" fill="#FFE07A" opacity=".55"/><rect x="-24" y="-2" width="18" height="12" rx="3" fill="#1A9BB5" transform="rotate(-20 -15 4)"/>${cr(-17, 14, .24, 'green', { arms: { l: 'down', r: 'up' }, eyes: 'happy', tuft: true })}<g fill="#FFE07A">${MG.spark(24, -2, .6)}</g><circle cx="22" cy="-30" r="1.6" fill="#fff"/><circle cx="-26" cy="-26" r="1.4" fill="#fff"/>`],
    b6: ['#E2F5EA', `<path d="M-26 12Q-14 -26 0 -10Q14 -26 26 12" fill="none" stroke="#1B4F7A" stroke-width="2.4" stroke-dasharray="4 4"/>${house0(-26, 14, .9, '#E0603F')}${house0(0, -8, .9, '#1A9BB5')}${house0(26, 14, .9, '#3A9E6B')}<g fill="#FFC929"><circle cx="-13" cy="-4" r="3.5"/><circle cx="13" cy="-4" r="3.5"/></g>`],
    t1: ['#FFF4D2', `<path d="M-26 -34h52a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8h-20l-8 8v-8h-24a8 8 0 0 1-8-8v-16a8 8 0 0 1 8-8z" fill="#fff" stroke="#E0A800" stroke-width="2"/>${MG.star(0, -18, 10)}${cr(-14, 24, .24, 'teal', { arms: { l: 'up', r: 'up' }, eyes: 'happy' })}${cr(16, 24, .24, 'coral', { arms: { l: 'up', r: 'up' }, eyes: 'happy' })}`],
    t2: ['#FFF4D2', `<rect x="-24" y="-32" width="48" height="50" rx="4" fill="#fff" stroke="#E0A800" stroke-width="2"/><path d="M-16 -22h32M-16 -14h26M-16 -6h30" stroke="#7C8C95" stroke-width="2.4" stroke-linecap="round"/><path d="M-8 6l6 6l12 -12" fill="none" stroke="#3A9E6B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${cr(-24, 18, .2, 'sun', { arms: { l: 'up', r: 'down' }, eyes: 'happy' })}${cr(24, 18, .2, 'lilac', { flip: true, arms: { l: 'up', r: 'down' }, eyes: 'happy' })}`],
    t3: ['#FFF4D2', `<rect x="-16" y="-24" width="32" height="26" rx="3" fill="#F06A9B"/><rect x="-19" y="-30" width="38" height="9" rx="2" fill="#F48FB5"/><rect x="-3" y="-30" width="6" height="32" fill="#FFC929"/><path d="M0 -30c-10-12-18-4-8 0M0 -30c10-12 18-4 8 0" fill="none" stroke="#FFC929" stroke-width="3"/>${cr(-19, 17, .22, 'green', { arms: { l: 'down', r: ['reach', 30] }, eyes: 'happy' })}${cr(19, 17, .22, 'navy', { flip: true, arms: { l: 'down', r: ['reach', 30] }, eyes: 'happy' })}`],
    t4: ['#FFF4D2', `${cr(-22, 12, .24, 'teal', { arms: { l: 'up', r: 'down' }, eyes: 'happy' })}${cr(0, 4, .26, 'sun', { arms: { l: 'up', r: 'up' }, eyes: 'happy', mouth: 'open' })}${cr(22, 12, .24, 'lilac', { flip: true, arms: { l: 'up', r: 'down' }, eyes: 'happy' })}${MG.spark(-28, -24, .6)}${MG.spark(28, -26, .7)}`]
  };
  function vignette(id, x, y, r, uid) {
    const v = VIG[id]; if (!v) return '';
    const s = r / 38;
    return `<g transform="translate(${x} ${y}) scale(${s})"><clipPath id="vc${uid}"><circle r="38"/></clipPath><g clip-path="url(#vc${uid})"><circle r="38" fill="${v[0]}"/>${v[1]}</g></g>`;
  }
  // תפאורה בין לולאות הדרך
  const LAND = {
    balloon: (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 -34C22 -34 30 -16 24 0C20 10 8 16 6 22H-6C-8 16 -20 10 -24 0C-30 -16 -22 -34 0 -34Z" fill="#1A9BB5"/><path d="M0 -34C10 -34 12 -16 10 0C9 10 4 16 3 22H-3C-4 16 -9 10 -10 0C-12 -16 -10 -34 0 -34Z" fill="#FFC929"/><path d="M-24 -6H24" stroke="#fff" stroke-width="2" opacity=".6"/><path d="M-5 22L-6 30M5 22L6 30" stroke="#8C6B4A" stroke-width="1.4"/><rect x="-8" y="30" width="16" height="11" rx="2" fill="#B07A4A"/>${cr(0, 28, .13, 'coral', { arms: { l: 'wave', r: 'down' }, eyes: 'happy' })}</g>`,
    kite: (x, y) => `<g transform="translate(${x} ${y}) rotate(-12)"><path d="M0 -24L16 0L0 24L-16 0Z" fill="#E0603F"/><path d="M0 -24L16 0L0 0Z" fill="#FF8F70"/><path d="M-16 0L0 24L0 0Z" fill="#FFC929"/><path d="M0 24c-6 10 6 16 0 26s6 16 0 26" fill="none" stroke="#1B4F7A" stroke-width="1.6"/><path d="M-4 40l8 0M-4 58l8 0" stroke="#3A9E6B" stroke-width="3"/></g>`,
    camp: (x, y) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="18" rx="62" ry="10" fill="#1B4F7A" opacity=".08"/><path d="M-10 14l10-6l10 6z" fill="#8C6B4A"/><path d="M0 12c-8-6-4-14 0-22c2 8 10 10 0 22z" fill="#FF8F70"/><path d="M0 12c-4-4-2-8 0-12c2 4 5 6 0 12z" fill="#FFC929"/>${cr(-34, 8, .24, 'teal', { eyes: 'happy', arms: { l: 'down', r: 'out' } })}${cr(34, 8, .24, 'sun', { flip: true, eyes: 'happy', arms: { l: 'down', r: 'out' } })}${cr(-14, -16, .2, 'lilac', { eyes: 'happy', arms: { l: 'up', r: 'up' }, antenna: true })}${cr(16, -16, .2, 'green', { eyes: 'happy', tuft: true, mouth: 'open' })}</g>`,
    pond: (x, y) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="0" rx="58" ry="20" fill="#8FD3E0"/><ellipse cx="-10" cy="-4" rx="40" ry="10" fill="#BFE6F0"/><g transform="translate(-14 -2)"><ellipse rx="10" ry="6" fill="#fff"/><circle cx="8" cy="-6" r="5" fill="#fff"/><path d="M12 -6l5 1.5l-5 1.5z" fill="#FFC929"/></g><g transform="translate(16 4) scale(.75)"><ellipse rx="10" ry="6" fill="#FFE07A"/><circle cx="8" cy="-6" r="5" fill="#FFE07A"/><path d="M12 -6l5 1.5l-5 1.5z" fill="#E0A800"/></g><path d="M48 4v-22M52 6v-18M44 6v-14" stroke="#3A9E6B" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="48" cy="-20" rx="2.6" ry="6" fill="#8C6B4A"/></g>`,
    swing: (x, y) => `<g transform="translate(${x} ${y})"><rect x="-3" y="-30" width="6" height="46" rx="3" fill="#8C6B4A"/><ellipse cx="0" cy="-40" rx="30" ry="24" fill="#3A9E6B"/><ellipse cx="10" cy="-46" rx="16" ry="12" fill="#7CCB97" opacity=".7"/><path d="M14 -26v30M30 -26v30" stroke="#5D4A36" stroke-width="1.4"/><rect x="11" y="4" width="22" height="4" rx="2" fill="#E0603F"/>${cr(22, -6, .16, 'coral', { arms: { l: 'up', r: 'up' }, eyes: 'happy', bow: true })}</g>`,
    garden: (x, y) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="8" rx="46" ry="9" fill="#8C6B4A" opacity=".35"/>${[-32, -16, 0, 16, 32].map((dx, i) => `<path d="M${dx} 8v-16" stroke="#3A9E6B" stroke-width="2.4"/><circle cx="${dx}" cy="-12" r="6" fill="${['#FF8F70', '#FFC929', '#F06A9B', '#1A9BB5', '#FFC929'][i]}"/><circle cx="${dx}" cy="-12" r="2.2" fill="#fff"/>`).join('')}${cr(48, 2, .18, 'navy', { eyes: 'happy', arms: { l: 'down', r: 'cup' } })}</g>`,
    tent: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-28 16L0 -24L28 16Z" fill="#FFC929"/><path d="M0 -24L28 16H8Z" fill="#E0A800"/><path d="M0 -24L-8 16H8Z" fill="#7A4E12" opacity=".5"/><path d="M0 -24v-10l10 4l-10 4" fill="#E0603F"/></g>`,
    eagle: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-30 0Q-16 -16 0 -2Q16 -16 30 0Q16 -6 0 6Q-16 -6 -30 0Z" fill="#5D7186"/>${cr(0, -2, .14, 'sun', { arms: { l: 'up', r: 'up' }, eyes: 'happy', mouth: 'open' })}</g>`,
    cave: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-46 22C-46 -18 -24 -34 0 -34C24 -34 46 -18 46 22Z" fill="#7F93A3"/><path d="M-26 22C-26 -2 -14 -14 0 -14C14 -14 26 -2 26 22Z" fill="#2B3A4D"/><circle cx="6" cy="6" r="16" fill="#FFE07A" opacity=".35"/>${cr(2, 12, .16, 'lilac', { arms: { l: 'down', r: 'up' }, look: [2, -1], antenna: true })}<rect x="9" y="-4" width="6" height="8" rx="1.5" fill="#FFC929"/><path d="M12 -4v-3" stroke="#5D4A36" stroke-width="1.4"/></g>`,
    climb: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-30 26L-18 -30L6 -40L24 -20L30 26Z" fill="#8FA3B0"/><path d="M-18 -30L6 -40L0 -10Z" fill="#A9BAC5"/><path d="M4 -38v-12l14 5l-14 5" fill="#E0603F"/><path d="M4 -36C-4 -20 6 -6 -2 10C-6 18 -10 22 -12 26" fill="none" stroke="#E0A800" stroke-width="2"/>${cr(-1, -6, .16, 'coral', { arms: { l: 'up', r: 'up' }, look: [0, -3], bow: true })}${cr(-12, 16, .15, 'teal', { arms: { l: 'up', r: 'down' }, look: [0, -3] })}</g>`,
    sign: (x, y) => `<g transform="translate(${x} ${y})"><rect x="-2.5" y="-24" width="5" height="44" fill="#8C6B4A"/><path d="M-2 -22h28l8 7l-8 7h-28z" fill="#FFC929"/><path d="M2 -6h-28l-8 7l8 7h28z" fill="#1A9BB5"/>${cr(-22, 16, .16, 'navy', { arms: { l: 'down', r: 'up' }, look: [3, -2] })}</g>`,
    boat: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-40 -2H40L30 14H-30Z" fill="#B07A4A"/><path d="M-40 -2H40" stroke="#8C5A30" stroke-width="3"/>${cr(-14, -12, .17, 'sun', { arms: { l: 'out', r: 'out' }, eyes: 'happy', mouth: 'open' })}${cr(16, -12, .17, 'green', { flip: true, arms: { l: 'out', r: 'out' }, eyes: 'happy', tuft: true })}<path d="M-30 -8L-48 16M30 -8L48 16" stroke="#8C5A30" stroke-width="3" stroke-linecap="round"/><path d="M-60 12q8 -4 16 0M44 14q8 -4 16 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`,
    fish: (x, y) => `<g transform="translate(${x} ${y}) rotate(-30)"><path d="M-10 0C-4 -8 8 -8 12 0C8 8 -4 8 -10 0Z" fill="#FF8F70"/><path d="M-10 0L-18 -6V6Z" fill="#FF8F70"/><circle cx="6" cy="-1" r="1.6" fill="#1F2A36"/><path d="M-16 12q6 6 14 0" fill="none" stroke="#fff" stroke-width="2"/></g>`,
    fisher: (x, y) => `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="-6" rx="34" ry="8" fill="#B3DFC3"/>${cr(-8, -16, .17, 'teal', { arms: { l: 'down', r: 'out' }, eyes: 'happy' })}<path d="M0 -18L30 -40" stroke="#8C6B4A" stroke-width="2"/><path d="M30 -40Q36 -20 34 12" fill="none" stroke="#5D7186" stroke-width="1"/><circle cx="34" cy="12" r="3" fill="#E0603F"/></g>`,
    village: (x, y) => `<g transform="translate(${x} ${y})">${['#E0603F', '#1A9BB5', '#FFC929', '#3A9E6B'].map((c, i) => `<g transform="translate(${-48 + i * 32} ${i % 2 ? 4 : -6}) scale(1.05)"><rect x="-13" y="-10" width="26" height="20" rx="2" fill="#FFFDF7"/><path d="M-17 -9L0 -24L17 -9Z" fill="${c}"/><rect x="-4" y="1" width="8" height="9" rx="1.5" fill="#FFC929"/><rect x="5" y="-5" width="5" height="5" rx="1" fill="#BFE6F0"/></g>`).join('')}${cr(64, 6, .17, 'coral', { arms: { l: 'wave', r: 'down' }, eyes: 'happy' })}</g>`,
    picnic: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-40 10L-30 -8H34L44 10Z" fill="#F06A7A"/><path d="M-26 -8L-36 10M-12 -8L-16 10M4 -8L6 10M20 -8L26 10M-36 1H39" stroke="#fff" stroke-width="2" opacity=".7"/><rect x="-6" y="-14" width="16" height="10" rx="2" fill="#B07A4A"/>${cr(-30, -12, .16, 'lilac', { arms: { l: 'down', r: 'cup' }, eyes: 'happy' })}${cr(32, -12, .16, 'sun', { flip: true, arms: { l: 'down', r: 'cup' }, eyes: 'happy' })}</g>`,
    sheep: (x, y) => `<g transform="translate(${x} ${y})">${[[-16, 0, 1], [16, 6, .85]].map(([dx, dy, k]) => `<g transform="translate(${dx} ${dy}) scale(${k})"><g fill="#fff"><circle cx="-8" cy="0" r="8"/><circle cx="0" cy="-4" r="9"/><circle cx="8" cy="0" r="8"/><circle cx="0" cy="4" r="8"/></g><ellipse cx="13" cy="-4" rx="5" ry="6" fill="#1F2A36"/><path d="M-6 10v6M6 10v6" stroke="#1F2A36" stroke-width="2.4"/></g>`).join('')}</g>`,
    bridge: (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})">${[-30, -20, -10, 0, 10, 20, 30].map((d) => `<rect x="${d - 3.5}" y="-27" width="7" height="54" rx="1.5" fill="#C99A62" stroke="#8C6B4A" stroke-width="1"/>`).join('')}<path d="M-38 -29H38M-38 29H38" stroke="#8C6B4A" stroke-width="4" stroke-linecap="round"/>${[-36, 0, 36].map((d) => `<circle cx="${d}" cy="-29" r="3.5" fill="#6E4F33"/><circle cx="${d}" cy="29" r="3.5" fill="#6E4F33"/>`).join('')}</g>`,
    goal: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-34 14V-18H34V14" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><g stroke="#fff" stroke-width="1" opacity=".8"><path d="M-26 -18v32M-18 -18v32M-10 -18v32M-2 -18v32M6 -18v32M14 -18v32M22 -18v32M30 -18v32M-34 -10h68M-34 -2h68M-34 6h68"/></g><circle cx="-6" cy="22" r="7" fill="#fff" stroke="#1F2A36" stroke-width="1.4"/><path d="M-6 17l3 3l-1.5 4h-3l-1.5-4z" fill="#1F2A36"/>${cr(-38, 12, .2, 'sun', { arms: { l: 'up', r: 'up' }, eyes: 'happy', mouth: 'open' })}${cr(26, 22, .18, 'teal', { flip: true, arms: { l: 'out', r: 'out' }, look: [-3, 0] })}</g>`,
    bench: (x, y) => `<g transform="translate(${x} ${y})"><rect x="-30" y="0" width="60" height="6" rx="2" fill="#B07A4A"/><rect x="-30" y="-12" width="60" height="5" rx="2" fill="#B07A4A"/><path d="M-24 6v10M24 6v10" stroke="#5D4A36" stroke-width="3"/>${cr(-12, -6, .18, 'sun', { eyes: 'happy', arms: { l: 'down', r: ['reach', 20] } })}${cr(12, -6, .18, 'teal', { flip: true, eyes: 'happy', arms: { l: 'down', r: ['reach', 20] } })}</g>`
  };
  // svg של הלוח: נוף רך בצבעי הלוגו, דרך מתפתלת, אבני דרך ואיורים
  function board() {
    const { d } = curve();
    const tree = (x, y, s, c1, c2) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2.5" y="0" width="5" height="16" rx="2.5" fill="#8C6B4A"/><ellipse cx="0" cy="-10" rx="13" ry="16" fill="${c1}"/><ellipse cx="4" cy="-14" rx="6" ry="8" fill="${c2}" opacity=".7"/></g>`;
    const pine = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="4" width="4" height="10" fill="#8C6B4A"/><path d="M0 -26L13 6H-13Z" fill="${c}"/><path d="M0 -26L13 6H0Z" fill="#000" opacity=".08"/></g>`;
    const birds = [[520, 70], [548, 84], [880, 60]].map(([x, y]) => `<path d="M${x} ${y}q6 -6 12 0q6 -6 12 0" fill="none" stroke="#1B4F7A" stroke-width="2" stroke-linecap="round" opacity=".45"/>`).join('');
    const clouds = [[320, 70, .9], [760, 40, .8], [1000, 96, .7]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff"><ellipse cx="0" cy="0" rx="34" ry="13"/><circle cx="-10" cy="-8" r="14"/><circle cx="12" cy="-10" r="17"/></g>`).join('');
    // נוף של מסע (22/10/2026: "הרקע עדיין נראה עלוב ולא כמו נופים שרואים במסע - הלוח צריך להסעיר את הדמיון עם סיפורים על הרפתקאות של היצורונים"):
    // הרים מושלגים, יער, מפל ונהר עם גשר, ועמק עם כפר. בכל מקום יצורונים בהרפתקה.
    const snow = (x, y, w) => `<path d="M${x} ${y}L${x - w} ${y + w * 1.3}L${x - w * .45} ${y + w * 1.05}L${x} ${y + w * 1.45}L${x + w * .5} ${y + w * 1.05}L${x + w} ${y + w * 1.3}Z" fill="#fff"/>`;
    const forest = [[300, 372, .7], [330, 380, .9], [372, 368, .75], [600, 362, .7], [640, 372, .85], [880, 352, .8], [915, 362, .65], [1010, 356, .9], [1050, 364, .7], [455, 380, .6]].map(([x, y, k], i) => pine(x, y, k, ['#2E8A63', '#3A9E6B', '#1A8A9B'][i % 3])).join('');
    let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const hatch = [[455, 150, 65], [720, 118, 70], [985, 138, 68], [585, 178, 50], [850, 166, 50], [350, 205, 45], [500, 262, 40], [680, 270, 40], [860, 282, 40], [1040, 268, 40]].map(([x, y, h]) => Array.from({ length: 5 }, (_, i) => `<path d="M${x + 6 + i * 7} ${y + 18 + i * 9}l${10 + i * 2} ${h * .45}" />`).join('')).join('');
    const tufts = [[[280, 560, 1200, 600], 34], [[262, 640, 1200, 700], 30], [[262, 410, 1150, 440], 22]].map(([[x0, y0, x1, y1], n]) => Array.from({ length: n }, () => { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); return `<path d="M${x.toFixed(0)} ${y.toFixed(0)}l-3 -7M${x.toFixed(0)} ${y.toFixed(0)}l0 -9M${x.toFixed(0)} ${y.toFixed(0)}l3 -7"/>`; }).join('')).join('');
    const BIG = (str, x, y, k) => `<g transform="translate(${x} ${y}) scale(${k || 1.22}) translate(${-x} ${-y})">${str}</g>`;
    const sun = `<g transform="translate(512 66)"><circle r="40" fill="#FFE9A8" opacity=".6"/><circle r="24" fill="#FFC929" stroke="#E0A800" stroke-width="2"/>${Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<path d="M${(Math.cos(a) * 31).toFixed(1)} ${(Math.sin(a) * 31).toFixed(1)}L${(Math.cos(a) * 42).toFixed(1)} ${(Math.sin(a) * 42).toFixed(1)}" stroke="#E0A800" stroke-width="3" stroke-linecap="round"/>`; }).join('')}<path d="M-8 2q8 8 16 0" fill="none" stroke="#9A6A00" stroke-width="2.4" stroke-linecap="round"/><circle cx="-8" cy="-6" r="2.4" fill="#9A6A00"/><circle cx="8" cy="-6" r="2.4" fill="#9A6A00"/></g>`;
    const rainbow = `<g fill="none" stroke-width="9" opacity=".55" transform="translate(1108 168)">${['#FF8F70', '#FFC929', '#7CCB97', '#43BED4', '#9C7AD6'].map((c, i) => `<path d="M${-118 + i * 9} 0A${118 - i * 9} ${118 - i * 9} 0 0 1 ${118 - i * 9} 0" stroke="${c}"/>`).join('')}</g>`;
    const scene = `
${sun}${rainbow}
<path d="M0 300L60 230L120 260L190 190L262 250L300 250L350 205L400 240L455 150L520 228L585 178L650 236L720 118L790 214L850 166L915 230L985 138L1050 214L1110 176L1200 236V440H0Z" fill="url(#gFar)" stroke="#3E4A5C" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"/>
${snow(455, 150, 18)}${snow(720, 118, 22)}${snow(985, 138, 20)}${snow(585, 178, 12)}${snow(850, 166, 13)}${snow(350, 205, 11)}
<g fill="none" stroke="#5D7186" stroke-width="1.6" stroke-linecap="round" opacity=".45">${hatch}</g>
<path d="M0 340L80 290L170 330L262 300L330 284L410 332L500 262L590 322L680 270L770 330L860 282L950 322L1040 268L1120 322L1200 290V470H0Z" fill="url(#gMid)" stroke="#3E4A5C" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"/>
<path d="M0 380C120 350 200 390 262 400C380 334 520 384 640 352C780 316 900 372 1040 340C1110 326 1160 330 1200 318V560H0Z" fill="url(#gForest)" stroke="#3E4A5C" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"/>
${forest}
<path d="M1138 262C1156 236 1200 236 1200 246V450H1150C1132 400 1126 310 1138 262Z" fill="#8FA3B0" stroke="#3E4A5C" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"/><path d="M1150 300l14 -10l10 8z" fill="#A9BAC5"/>
<rect x="1164" y="250" width="22" height="196" fill="#D8F2FA"/><path d="M1170 262v40M1178 290v50M1172 350v40M1180 390v40" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
<path d="M1200 456C1120 470 1060 494 960 478C840 458 760 494 640 476C520 458 420 494 262 470C160 456 80 480 0 470" fill="none" stroke="#7FC6E0" stroke-width="38" stroke-linecap="round"/>
<path d="M1150 462C1100 476 1050 486 960 474M820 470C760 482 700 480 640 470M520 466C460 474 380 480 300 470" fill="none" stroke="#C9EEF8" stroke-width="3" stroke-linecap="round" stroke-dasharray="14 18"/>
<ellipse cx="1176" cy="452" rx="26" ry="8" fill="#fff" opacity=".7"/>
<path d="M0 620C120 590 200 610 262 600C460 572 640 640 820 608C980 582 1080 630 1200 604V800H0Z" fill="url(#gVal)" stroke="#3E4A5C" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"/>
<path d="M0 762C240 724 520 782 800 754C1000 734 1100 772 1200 752V800H0Z" fill="#96D0A4"/>
<g fill="none" stroke="#2E7D4F" stroke-width="1.6" stroke-linecap="round" opacity=".5">${tufts}</g>
${BIG(LAND.balloon(640, 74), 640, 74)}${BIG(LAND.eagle(880, 64), 880, 64)}${LAND.kite(392, 62)}
${BIG(LAND.cave(672, 292), 672, 300, 1.15)}${BIG(LAND.climb(455, 282), 455, 300, 1.2)}${BIG(LAND.camp(1000, 292), 1000, 300, 1.15)}
${BIG(LAND.boat(562, 478), 562, 478, 1.2)}${LAND.fish(752, 468)}${BIG(LAND.fisher(950, 452), 950, 452, 1.15)}
${BIG(LAND.village(430, 650), 430, 660, 1.15)}${BIG(LAND.sheep(730, 652), 730, 660, 1.2)}${BIG(LAND.picnic(900, 650), 900, 660, 1.2)}${LAND.pond(1000, 668)}`;
    // אבני דרך מצוירות ביד (22/10/2026: "צא מהריבוע ותהיה יצירתי! האיקונים האלה לא מתאימים ללוח. חפש סגנון איור אחר"):
    // אבן לא סדורה עם קו דיו, המספר בכתב יד, ובמשבצת מיוחדת אבן צבועה וסיפור קטן שעומד מעליה בנוף
    const TINT = { task: ['#F6EEDF', '#E4D6BE'], setback: ['#F7B9A6', '#E79A84'], boost: ['#B4E2C3', '#93CFA8'], together: ['#F9DE8E', '#EBC664'] };
    let st = '', tales = '';
    for (let k = 1; k <= N; k++) {
      const s0 = square(k), p = pos(k), [f1, f2] = TINT[s0.type];
      let ss = k * 9301 + 49297; const r1 = () => { ss = (ss * 16807) % 2147483647; return ss / 2147483647; };
      const R = s0.type === 'task' ? 25 : 28, pts = [];
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = R * (0.86 + r1() * 0.22); pts.push([p.x + Math.cos(a) * rr * 1.12, p.y + Math.sin(a) * rr * .9]); }
      const mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
      let dd = 'M' + mid(pts[8], pts[0]).map((q) => q.toFixed(1)).join(' ');
      for (let i = 0; i < 9; i++) { const m = mid(pts[i], pts[(i + 1) % 9]); dd += `Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`; }
      st += `<g class="bg-sq" data-k="${k}"><path d="${dd}" transform="translate(0 5)" fill="#5D4A36" opacity=".22"/><path d="${dd}" fill="${f1}" stroke="#3E4A5C" stroke-width="2.2"/><path d="${dd}" fill="${f2}" opacity=".7" clip-path="inset(55% 0 0 0)" style="clip-path:inset(55% 0 0 0)"/><path d="M${p.x - R * .55} ${p.y - R * .45}q${R * .3} -${R * .22} ${R * .7} -${R * .1}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>` +
        `<text x="${p.x}" y="${p.y + 10}" text-anchor="middle" font-family="'Amatic SC',Assistant,sans-serif" font-weight="700" font-size="30" fill="#3E4A5C">${k}</text></g>`;
      if (s0.type !== 'task') tales += `<g transform="translate(${p.x} ${p.y - 64}) scale(.92)">${VIG[s0.id][1]}</g>`;
    }
    const sp = pos(0), ep = pos(END);
    // המקרא: רק כאן ההסברים
    const ring = (t, x, y) => `<ellipse cx="${x}" cy="${y + 3}" rx="17" ry="13" fill="#5D4A36" opacity=".2"/><ellipse cx="${x}" cy="${y}" rx="17" ry="13" fill="${TINT[t][0]}" stroke="#3E4A5C" stroke-width="2"/>${t === 'task' ? `<text x="${x}" y="${y + 7}" text-anchor="middle" font-family="'Amatic SC',Assistant,sans-serif" font-weight="700" font-size="20" fill="#3E4A5C">7</text>` : `<g transform="translate(${x} ${y - 4}) scale(.3)">${VIG[{ together: 't4', boost: 'b3', setback: 's1' }[t]][1]}</g>`}`;
    const legend = `<g transform="translate(30 430) rotate(-1.5 111 122)"><g filter="url(#bgWob2)"><path d="M0 8L14 0H210L222 10V236L206 244H12L0 232Z" transform="translate(3 5)" fill="#5D4A36" opacity=".2"/><path d="M0 8L14 0H210L222 10V236L206 244H12L0 232Z" fill="#FBF3DF" stroke="#3E4A5C" stroke-width="2.2"/></g><circle cx="111" cy="10" r="6" fill="#E0603F" stroke="#3E4A5C" stroke-width="1.6"/><text x="111" y="44" text-anchor="middle" direction="rtl" font-family="'Amatic SC',Assistant,sans-serif" font-weight="700" font-size="30" fill="#3E4A5C">מה קורה במשבצת?</text>` +
      [['task', 'משימה', 'לוקחים קלף ומבצעים'], ['together', 'כולם יחד', 'כל המשתתפים עושים'], ['boost', 'גשר', 'מתקדמים קדימה'], ['setback', 'מכשול', 'חוזרים אחורה']].map(([t, n, l], i) =>
        `${ring(t, 192, 74 + i * 46)}<text x="166" y="${70 + i * 46}" text-anchor="start" direction="rtl" font-family="Assistant,Arial,sans-serif" font-weight="800" font-size="15" fill="${COL[t][2]}">${n}</text><text x="166" y="${88 + i * 46}" text-anchor="start" direction="rtl" font-family="Assistant,Arial,sans-serif" font-weight="700" font-size="13" fill="#4a5a64">${l}</text>`).join('') + `</g>`;
    const pc = `<ellipse cx="131" cy="414" rx="118" ry="18" fill="#5D4A36" opacity=".15"/>` + [[62, 338], [131, 330], [200, 338], [96, 394], [166, 394]].map(([x, y], i) => piece(i, x, y, .5)).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="לוח המשחק צועדים אל החוסן" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs><linearGradient id="bgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE4F4"/><stop offset=".3" stop-color="#E4F3F6"/><stop offset=".45" stop-color="#FDF4DE"/></linearGradient>
<linearGradient id="gFar" x1="0" y1="0" x2="0" y2="1"><stop offset=".2" stop-color="#D9E2F2"/><stop offset="1" stop-color="#AFC4DE"/></linearGradient>
<linearGradient id="gMid" x1="0" y1="0" x2="0" y2="1"><stop offset=".1" stop-color="#9FC9DB"/><stop offset="1" stop-color="#7DAFC6"/></linearGradient>
<linearGradient id="gForest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9DEB9"/><stop offset=".6" stop-color="#86CB9E"/></linearGradient>
<linearGradient id="gVal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CDEFD4"/><stop offset=".7" stop-color="#A7DBB3"/></linearGradient>
<radialGradient id="bgSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFC929" stop-opacity=".55"/><stop offset="1" stop-color="#FFC929" stop-opacity="0"/></radialGradient>
<pattern id="bgDots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.3" fill="#3A9E6B" opacity=".18"/><circle cx="15" cy="15" r="1" fill="#1A9BB5" opacity=".16"/></pattern>
<filter id="bgWob" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="bgWob2" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="9"/><feDisplacementMap in="SourceGraphic" scale="3.2" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="bgPaper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="2"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .24  0 0 0 0 .16  0 0 0 -1.6 1.05"/></filter>
<filter id="bgWash" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .012" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .3  0 0 0 0 .5  0 0 0 -2.2 1.25"/></filter>
<linearGradient id="bgSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B4F7A"/><stop offset="1" stop-color="#1A9BB5"/></linearGradient></defs>
<rect width="${W}" height="${H}" rx="28" fill="url(#bgSky)"/>
<circle cx="1040" cy="110" r="150" fill="url(#bgSun)"/>
<g filter="url(#bgWob)">${clouds}${birds}
${scene}
<path d="${d}" fill="none" stroke="#3E4A5C" stroke-opacity=".45" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${d}" fill="none" stroke="#E9CF9A" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${d}" fill="none" stroke="#F5E4BE" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
<path d="${d}" fill="none" stroke="#C9A66B" stroke-width="3" stroke-dasharray="1 23" stroke-linecap="round"/>
${LAND.bridge(1128, 462, -66)}</g>
<rect x="262" width="${W - 262}" height="${H}" filter="url(#bgWash)" opacity=".16" style="mix-blend-mode:multiply"/>
<g filter="url(#bgWob2)"><path d="M34 22H200L212 30V96L200 104H34L22 96V30Z" fill="#fff" stroke="#3E4A5C" stroke-width="2.2"/></g><image href="${LOGO}" xlink:href="${LOGO}" x="40" y="30" width="154" height="66" preserveAspectRatio="xMidYMid meet"/>
<g filter="url(#bgWob2)"><path d="M6 150L28 138L28 218L6 206L18 178Z" fill="#E0A800" stroke="#3E4A5C" stroke-width="2"/><path d="M256 150L234 138L234 218L256 206L244 178Z" fill="#E0A800" stroke="#3E4A5C" stroke-width="2"/><path d="M24 128Q131 112 238 128V224Q131 208 24 224Z" fill="#FFC929" stroke="#3E4A5C" stroke-width="2.4"/></g>
${T(131, 166, 40, 900, '#1B4F7A', 'צועדים', "'Frank Ruhl Libre',Georgia,serif")}${T(131, 208, 40, 900, '#1B4F7A', 'אל החוסן', "'Frank Ruhl Libre',Georgia,serif")}
<text x="131" y="252" text-anchor="middle" font-family="'Amatic SC',Assistant,sans-serif" font-weight="700" font-size="26" fill="#3E4A5C">משחק לוח</text>
${pc}
${legend}
<g transform="translate(${ep.x} ${ep.y - 4}) scale(.98) translate(${-ep.x} ${-ep.y})">${island(ep.x, ep.y)}</g>
<g filter="url(#bgWob2)">${st}</g>${tales}
<g transform="translate(${sp.x} ${sp.y})" filter="url(#bgWob2)"><rect x="-4" y="-6" width="8" height="46" fill="#8C6B4A" stroke="#3E4A5C" stroke-width="2"/><path d="M50 -40H-40L-54 -24L-40 -8H50Z" fill="#FFC929" stroke="#3E4A5C" stroke-width="2.2"/><text x="4" y="-14" text-anchor="middle" direction="rtl" font-family="'Amatic SC',Assistant,sans-serif" font-weight="700" font-size="27" fill="#3E4A5C">יוצאים לדרך</text></g>
<rect width="${W}" height="${H}" rx="28" filter="url(#bgPaper)" opacity=".22" style="mix-blend-mode:multiply" pointer-events="none"/>
<g class="bg-pieces"></g>
</svg>`;
  }

  const PIECES = [{ c: 'teal', hex: '#1A9BB5' }, { c: 'coral', hex: '#E0603F' }, { c: 'sun', hex: '#C98E00' }, { c: 'lilac', hex: '#7A5CC0' }, { c: 'green', hex: '#2E7D4F' }];
  const PIECE_OPTS = [{ tuft: false }, { bow: true }, { ears: 'bunny', body: 'tall' }, { antenna: true }, { tuft: true }];
  const piece = (i, x, y, s) => cr(x, y, s || .36, PIECES[i].c, Object.assign({ eyes: 'happy', arms: { l: 'wave', r: 'wave' } }, PIECE_OPTS[i]));
  // מיקום כלי על משבצת: עד חמישה כלים באותה משבצת לא מסתירים זה את זה
  const OFF = [[0, 0], [-26, 10], [26, 10], [-14, -14], [14, -14]];
  function piecePos(k, slot) { const p = pos(k), o = OFF[slot % OFF.length]; return { x: p.x + o[0], y: p.y + o[1] + (k <= 0 ? 16 : -6) }; }

  const ART = 'assets/board-journey-art.jpg';
  return { W, H, ART, N, END, TASKS, SETBACKS, BOOSTS, TOGETHER, SPECIAL, RULES, square, pos, board, piece, piecePos, PIECES, bridgeBack, label, icon, COL, esc };
});
