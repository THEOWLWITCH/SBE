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
  // svg של הלוח: נוף רך בצבעי הלוגו, דרך מתפתלת ואבני דרך עגולות
  function board() {
    const { d } = curve();
    const tree = (x, y, s, c1, c2) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2.5" y="0" width="5" height="16" rx="2.5" fill="#8C6B4A"/><ellipse cx="0" cy="-10" rx="13" ry="16" fill="${c1}"/><ellipse cx="4" cy="-14" rx="6" ry="8" fill="${c2}" opacity=".7"/></g>`;
    const pine = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="4" width="4" height="10" fill="#8C6B4A"/><path d="M0 -26L13 6H-13Z" fill="${c}"/><path d="M0 -26L13 6H0Z" fill="#000" opacity=".08"/></g>`;
    const house = (x, y, s, roof) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-13" y="-10" width="26" height="20" rx="2" fill="#FFFDF7"/><path d="M-17 -9L0 -24L17 -9Z" fill="${roof}"/><rect x="-4" y="1" width="8" height="9" rx="1.5" fill="#FFC929"/><rect x="5" y="-5" width="5" height="5" rx="1" fill="#BFE6F0"/></g>`;
    const birds = [[520, 70], [548, 84], [880, 60]].map(([x, y]) => `<path d="M${x} ${y}q6 -6 12 0q6 -6 12 0" fill="none" stroke="#1B4F7A" stroke-width="2" stroke-linecap="round" opacity=".45"/>`).join('');
    const clouds = [[300, 78, 1], [660, 46, .8], [1000, 96, .7]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff"><ellipse cx="0" cy="0" rx="34" ry="13"/><circle cx="-10" cy="-8" r="14"/><circle cx="12" cy="-10" r="17"/></g>`).join('');
    // תפאורה: גבעות, עצים ובתים בין לולאות הדרך
    const scene = `
<path d="M260 470 C420 420 560 470 700 448 C860 424 980 470 1200 430 V800 H260 Z" fill="#DDF1E3"/>
<path d="M260 640 C460 600 640 660 820 628 C980 600 1080 650 1200 620 V800 H260 Z" fill="#CBEAD6"/>
<path d="M0 760 C240 720 520 780 800 752 C1000 732 1100 770 1200 750 V800 H0 Z" fill="#B7E0C5"/>
${tree(460, 462, 1, '#3A9E6B', '#7CCB97')}${pine(500, 470, 1, '#1A9BB5')}${tree(840, 462, .9, '#4FB27C', '#9BD9B1')}${house(640, 452, 1, '#E0603F')}${pine(1180, 300, .9, '#3A9E6B')}
${tree(700, 660, 1, '#3A9E6B', '#7CCB97')}${house(540, 656, 1, '#1A9BB5')}${pine(620, 650, .9, '#3A9E6B')}${tree(1000, 650, .85, '#1A9BB5', '#8FD3E0')}
${house(800, 274, .9, '#FFC929')}${tree(560, 276, .9, '#4FB27C', '#9BD9B1')}${pine(1000, 268, .85, '#1A9BB5')}${tree(450, 276, .8, '#3A9E6B', '#7CCB97')}`;
    let st = '', nums = '';
    for (let k = 1; k <= N; k++) {
      const s = square(k), p = pos(k), [f, c, dk] = COL[s.type];
      // התווית מתחת לאבן, ואם היא נוגעת באבן אחרת (בפניות): מעל או בצד
      const hit = (x, y) => curve().spots.some((q, j) => { if (j === k || j > N) return false; const dx = Math.max(Math.abs(q.x - x) - 34, 0), dy = Math.max(Math.abs(q.y - y) - 11, 0); return Math.hypot(dx, dy) < 34; });
      const lp = [[0, 42], [0, -46], [-70, 0], [70, 0]].map(([dx, dy]) => [p.x + dx, p.y + dy]).find(([x, y]) => !hit(x, y) && x > 300) || [p.x, p.y + 42];
      const lab = s.type === 'task' ? '' : `<g transform="translate(${lp[0]} ${lp[1]})"><rect x="-34" y="-11" width="68" height="22" rx="11" fill="${c}"/>${T(0, 5.5, 13.5, 800, '#fff', label(s))}</g>`;
      st += `<g class="bg-sq" data-k="${k}"><circle cx="${p.x}" cy="${p.y + 3}" r="30" fill="#1B4F7A" opacity=".16"/><circle cx="${p.x}" cy="${p.y}" r="30" fill="#fff"/><circle cx="${p.x}" cy="${p.y}" r="26.5" fill="${f}" stroke="${c}" stroke-width="4"/>` +
        icon(s.type, p.x, p.y, .95) + lab + `</g>`;
      nums += `<g transform="translate(${p.x - 22} ${p.y - 22})"><circle r="10.5" fill="#1B4F7A" stroke="#fff" stroke-width="2"/>${T(0, 4.3, 11.5, 800, '#fff', k)}</g>`;
    }
    const sp = pos(0), ep = pos(END);
    const legend = `<g transform="translate(30 404)"><rect width="222" height="244" rx="22" fill="#fff" opacity=".96"/><rect width="222" height="40" rx="20" fill="#1B4F7A"/><rect y="20" width="222" height="20" fill="#1B4F7A"/>${T(111, 27, 16, 800, '#fff', 'מה קורה במשבצת?')}` +
      [['task', 'משימה', 'לוקחים קלף ומבצעים'], ['together', 'כולם יחד', 'כל המשתתפים עושים'], ['boost', 'גשר', 'מתקדמים קדימה'], ['setback', 'מכשול', 'חוזרים אחורה']].map(([t, n, l], i) =>
        `${icon(t, 192, 74 + i * 46, .95)}<text x="166" y="${70 + i * 46}" text-anchor="start" direction="rtl" font-family="Assistant,Arial,sans-serif" font-weight="800" font-size="15" fill="${COL[t][2]}">${n}</text><text x="166" y="${88 + i * 46}" text-anchor="start" direction="rtl" font-family="Assistant,Arial,sans-serif" font-weight="700" font-size="13" fill="#4a5a64">${l}</text>`).join('') + `</g>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="לוח המשחק צועדים אל החוסן" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs><linearGradient id="bgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D3EEF5"/><stop offset=".55" stop-color="#F1F9F3"/><stop offset="1" stop-color="#E6F4EA"/></linearGradient>
<radialGradient id="bgSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFC929" stop-opacity=".55"/><stop offset="1" stop-color="#FFC929" stop-opacity="0"/></radialGradient>
<pattern id="bgDots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.3" fill="#3A9E6B" opacity=".18"/><circle cx="15" cy="15" r="1" fill="#1A9BB5" opacity=".16"/></pattern>
<linearGradient id="bgSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B4F7A"/><stop offset="1" stop-color="#1A9BB5"/></linearGradient></defs>
<rect width="${W}" height="${H}" rx="28" fill="url(#bgSky)"/>
<circle cx="1040" cy="110" r="150" fill="url(#bgSun)"/>${clouds}${birds}
${scene}
<rect x="260" y="0" width="${W - 260}" height="${H}" fill="url(#bgDots)"/>
<path d="${d}" fill="none" stroke="#D9BE86" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${d}" fill="none" stroke="#F7EAC8" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${d}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round" opacity=".95"/>
<path d="M0 28a28 28 0 0 1 28-28H262V${H}H28a28 28 0 0 1-28-28Z" fill="url(#bgSide)"/>
<circle cx="250" cy="120" r="70" fill="#FFC929" opacity=".14"/><circle cx="30" cy="700" r="90" fill="#3A9E6B" opacity=".25"/>
<rect x="34" y="24" width="194" height="96" rx="20" fill="#fff"/><image href="${LOGO}" xlink:href="${LOGO}" x="46" y="30" width="170" height="84" preserveAspectRatio="xMidYMid meet"/>
${T(131, 186, 42, 900, '#fff', 'צועדים', "'Frank Ruhl Libre',Georgia,serif")}${T(131, 232, 42, 900, '#FFC929', 'אל החוסן', "'Frank Ruhl Libre',Georgia,serif")}
${T(131, 262, 15, 700, '#D9F1F6', 'משחק לוח · יחד בדרך')}
<g transform="translate(6 278) scale(.57)">${MG.parade(5, 440, 120).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
${legend}
<text x="131" y="690" text-anchor="middle" font-family="Assistant,Arial,sans-serif" font-weight="700" font-size="13.5" fill="#E7F6FA">עוזרים זה לזה בדרך,</text><text x="131" y="710" text-anchor="middle" font-family="Assistant,Arial,sans-serif" font-weight="700" font-size="13.5" fill="#E7F6FA">ומגיעים יחד.</text>
<g transform="translate(${ep.x} ${ep.y - 4}) scale(.98) translate(${-ep.x} ${-ep.y})">${island(ep.x, ep.y)}</g>
${st}${nums}
<g transform="translate(${sp.x} ${sp.y})"><circle r="38" fill="#1B4F7A" opacity=".16" cy="3"/><circle r="38" fill="#1B4F7A"/><circle r="32" fill="none" stroke="#FFC929" stroke-width="2" stroke-dasharray="4 5"/>${T(0, -4, 14, 800, '#fff', 'יוצאים')}${T(0, 14, 14, 800, '#fff', 'לדרך')}<path d="M24 -50v26" stroke="#1B4F7A" stroke-width="3"/><path d="M24 -50l20 6l-20 6z" fill="#FFC929"/></g>
<g class="bg-pieces"></g>
</svg>`;
  }

  const PIECES = [{ c: 'teal', hex: '#1A9BB5' }, { c: 'coral', hex: '#E0603F' }, { c: 'sun', hex: '#C98E00' }, { c: 'lilac', hex: '#7A5CC0' }, { c: 'green', hex: '#2E7D4F' }];
  const PIECE_OPTS = [{ tuft: false }, { bow: true }, { ears: 'bunny', body: 'tall' }, { antenna: true }, { tuft: true }];
  const piece = (i, x, y, s) => cr(x, y, s || .36, PIECES[i].c, Object.assign({ eyes: 'happy', arms: { l: 'wave', r: 'wave' } }, PIECE_OPTS[i]));
  // מיקום כלי על משבצת: עד חמישה כלים באותה משבצת לא מסתירים זה את זה
  const OFF = [[0, 0], [-26, 10], [26, 10], [-14, -14], [14, -14]];
  function piecePos(k, slot) { const p = pos(k), o = OFF[slot % OFF.length]; return { x: p.x + o[0], y: p.y + o[1] + (k <= 0 ? 16 : -6) }; }

  return { N, END, TASKS, SETBACKS, BOOSTS, TOGETHER, SPECIAL, RULES, square, pos, board, piece, piecePos, PIECES, bridgeBack, label, icon, COL, esc };
});
