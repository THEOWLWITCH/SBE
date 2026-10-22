// מסע אל החוסן: משחק לוח (22/10/2026), על המסך ולהדפסה. מקור אמת אחד ללוח, למשימות, לאירועים ולהוראות.
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
    title: 'מסע אל החוסן',
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
  function pos(k) {
    if (k <= 0) return { x: 1112, y: 690 };
    if (k >= END) return { x: 1108, y: 136 };
    const r = Math.floor((k - 1) / 6); let c = (k - 1) % 6;
    if (r % 2) c = 5 - c;
    return { x: 990 - c * 128, y: 690 - r * 100 };
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
  // svg של הלוח
  function board() {
    let pts = [];
    for (let k = 0; k <= END; k++) { const p = pos(k); pts.push(p.x + ',' + p.y); }
    let sq = '';
    for (let k = 1; k <= N; k++) {
      const s = square(k), p = pos(k), [f, st, dk] = COL[s.type];
      sq += `<g class="bg-sq" data-k="${k}"><rect x="${p.x - 48}" y="${p.y - 37}" width="96" height="78" rx="18" fill="#fff" filter="url(#bgSh)"/><rect x="${p.x - 48}" y="${p.y - 37}" width="96" height="78" rx="18" fill="${f}" stroke="${st}" stroke-opacity=".35" stroke-width="1.2"/>` +
        T(p.x + 34, p.y - 22, 12, 700, '#7C8C95', k) +
        icon(s.type, p.x, p.y - 9, 1) +
        T(p.x, p.y + 28, 15, 800, dk, label(s)) + `</g>`;
    }
    const sp = pos(0), ep = pos(END);
    const clouds = [[300, 70], [560, 52], [820, 92]].map(([x, y]) => `<g fill="#fff" opacity=".85"><circle cx="${x}" cy="${y}" r="14"/><circle cx="${x + 16}" cy="${y - 7}" r="18"/><circle cx="${x + 34}" cy="${y}" r="13"/><rect x="${x}" y="${y}" width="36" height="12" rx="6"/></g>`).join('');
    const legend = `<g><rect x="34" y="402" width="212" height="226" rx="18" fill="#fff" fill-opacity=".92" stroke="#D7E6EA"/>${T(140, 432, 17, 800, '#1B4F7A', 'מקרא')}` +
      [['task', 'משימה: מרימים קלף'], ['together', 'כולם יחד'], ['boost', 'גשר: מתקדמים'], ['setback', 'מכשול: חוזרים']].map(([t, l], i) =>
        `${icon(t, 216, 468 + i * 44, .95)}<text x="190" y="${474 + i * 44}" text-anchor="start" direction="rtl" font-family="Assistant,Arial,sans-serif" font-weight="700" font-size="15" fill="#1d2b36">${l}</text>`).join('') + `</g>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="לוח המשחק מסע אל החוסן" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs><linearGradient id="bgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6F4FA"/><stop offset="1" stop-color="#F6FBF4"/></linearGradient>
<filter id="bgSh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#1B4F7A" flood-opacity=".14"/></filter></defs>
<rect width="${W}" height="${H}" rx="28" fill="url(#bgSky)"/>${clouds}
<path d="M0 724 Q200 664 420 708 T840 698 T1200 688 V800 H0 Z" fill="#D7EFE0"/><path d="M0 764 Q260 726 520 762 T1200 754 V800 H0 Z" fill="#C2E6CF"/>
<polyline points="${pts.join(' ')}" fill="none" stroke="#EADCBC" stroke-width="26" stroke-linejoin="round" stroke-linecap="round"/>
<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="1 10" stroke-linecap="round" opacity=".9"/>
<rect x="44" y="22" width="192" height="96" rx="18" fill="#fff" filter="url(#bgSh)"/><image href="${LOGO}" xlink:href="${LOGO}" x="56" y="28" width="168" height="84" preserveAspectRatio="xMidYMid meet"/>
${T(140, 178, 40, 900, '#1B4F7A', 'מסע', "'Frank Ruhl Libre',Georgia,serif")}${T(140, 222, 40, 900, '#1B4F7A', 'אל החוסן', "'Frank Ruhl Libre',Georgia,serif")}
${T(140, 252, 16, 700, '#2b6a7d', 'משחק לוח')}
<g transform="translate(14 270) scale(.6)">${MG.parade(5, 440, 120).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
${legend}
<g><rect x="${sp.x - 60}" y="${sp.y - 42}" width="120" height="84" rx="20" fill="#1B4F7A" filter="url(#bgSh)"/>${T(sp.x, sp.y - 20, 15, 800, '#fff', 'יוצאים לדרך')}</g>
<g transform="translate(${ep.x} ${ep.y - 4}) scale(.98) translate(${-ep.x} ${-ep.y})">${island(ep.x, ep.y)}</g>
${sq}
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
