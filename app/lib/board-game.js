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
    if (k >= END) return { x: 1114, y: 156 };
    const r = Math.floor((k - 1) / 6); let c = (k - 1) % 6;
    if (r % 2) c = 5 - c;
    return { x: 990 - c * 128, y: 690 - r * 100 };
  }
  const COL = {
    task: ['#E3F5F7', '#1A9BB5'], setback: ['#FFE6DE', '#D9583A'], boost: ['#E3F4EA', '#2E7D4F'], together: ['#FFF3CF', '#C98E00']
  };
  function icon(type, x, y, s) {
    s = s || 1;
    const g = (inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
    if (type === 'task') return g(MG.star(0, 0, 15, '#FFC929'));
    if (type === 'setback') return g(`<g fill="#9FB0B8"><circle cx="-8" cy="-2" r="9"/><circle cx="4" cy="-7" r="11"/><circle cx="13" cy="0" r="8"/><rect x="-16" y="-2" width="36" height="10" rx="5"/></g><path d="M2 8 L-3 18 L3 17 L0 26 L9 13 L3 14 L6 8 Z" fill="#FFC929" stroke="#C98E00" stroke-width="1"/>`);
    if (type === 'boost') return g(`<path d="M-20 10 Q0 -14 20 10" fill="none" stroke="#2E7D4F" stroke-width="5" stroke-linecap="round"/><path d="M-14 10 V2 M-6 10 V-3 M2 10 V-3 M10 10 V2" stroke="#2E7D4F" stroke-width="3" stroke-linecap="round"/><path d="M-22 10 H22" stroke="#6B4A2B" stroke-width="4" stroke-linecap="round"/>`);
    if (type === 'together') return g(`<circle cx="-12" cy="2" r="7" fill="#FF8F70"/><circle cx="12" cy="2" r="7" fill="#43BED4"/><circle cx="0" cy="-4" r="8" fill="#66C592"/><path d="M-20 14 Q-12 6 -4 14 M4 14 Q12 6 20 14 M-8 10 Q0 1 8 10" stroke="#C98E00" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    return '';
  }
  function label(sq) {
    if (sq.type === 'task') return 'משימה';
    if (sq.type === 'together') return 'כולם יחד';
    if (sq.type === 'setback') return sq.back + ' אחורה';
    if (sq.type === 'boost') return sq.fwd + ' קדימה';
    return '';
  }
  // svg של הלוח. opts.print: בלי מזהים לחיצה
  function board(opts) {
    opts = opts || {};
    let pts = [];
    for (let k = 0; k <= END; k++) { const p = pos(k); pts.push(p.x + ',' + p.y); }
    let sq = '';
    for (let k = 1; k <= N; k++) {
      const s = square(k), p = pos(k), [f, st] = COL[s.type];
      sq += `<g class="bg-sq" data-k="${k}"><rect x="${p.x - 48}" y="${p.y - 38}" width="96" height="76" rx="16" fill="${f}" stroke="${st}" stroke-width="3"/>` +
        `<text x="${p.x + 33}" y="${p.y - 20}" text-anchor="middle" font-family="Assistant,Arial,sans-serif" font-weight="800" font-size="15" fill="${st}">${k}</text>` +
        icon(s.type, p.x, p.y - 8, 1) +
        `<text x="${p.x}" y="${p.y + 27}" text-anchor="middle" font-family="Assistant,Arial,sans-serif" font-weight="800" font-size="15" fill="#1d2b36">${label(s)}</text></g>`;
    }
    const sp = pos(0), ep = pos(END);
    const clouds = [[180, 90], [560, 60], [820, 110]].map(([x, y]) => `<g fill="#fff" opacity=".9"><circle cx="${x}" cy="${y}" r="18"/><circle cx="${x + 20}" cy="${y - 8}" r="22"/><circle cx="${x + 42}" cy="${y}" r="16"/><rect x="${x}" y="${y}" width="44" height="14" rx="7"/></g>`).join('');
    const legend = [['task', 'משימה: מרימים קלף'], ['together', 'כולם יחד'], ['boost', 'גשר: קדימה'], ['setback', 'ענן: מכשול, אחורה']].map(([t, l], i) =>
      `<g transform="translate(0 ${i * 52})"><rect x="40" y="430" width="200" height="42" rx="12" fill="#fff" stroke="${COL[t][1]}" stroke-width="2.5"/>${icon(t, 214, 451, .8)}<text x="124" y="457" text-anchor="middle" font-family="Assistant,Arial,sans-serif" font-weight="800" font-size="16" fill="#1d2b36">${l}</text></g>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="לוח המשחק מסע אל החוסן" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="bgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4F3FA"/><stop offset="1" stop-color="#F5FAF2"/></linearGradient></defs>
<rect width="${W}" height="${H}" rx="28" fill="url(#bgSky)"/>${clouds}
<path d="M0 720 Q200 650 420 700 T840 690 T1200 680 V800 H0 Z" fill="#CFEBD9"/><path d="M0 760 Q260 720 520 760 T1200 750 V800 H0 Z" fill="#B5E0C4"/>
<polyline points="${pts.join(' ')}" fill="none" stroke="#E6D3AE" stroke-width="34" stroke-linejoin="round" stroke-linecap="round"/>
<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>
<g font-family="'Frank Ruhl Libre',Georgia,serif" text-anchor="middle"><text x="140" y="96" font-size="44" font-weight="900" fill="#1B4F7A">מסע</text><text x="140" y="146" font-size="44" font-weight="900" fill="#1B4F7A">אל החוסן</text></g>
<text x="140" y="180" text-anchor="middle" font-family="Assistant,Arial,sans-serif" font-size="18" font-weight="700" fill="#2b6a7d">משחק לוח · Begood</text>
<g transform="translate(14 196) scale(.6)">${MG.parade(5, 440, 120).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
${legend}
<g><rect x="${sp.x - 62}" y="${sp.y - 44}" width="124" height="88" rx="20" fill="#1B4F7A"/><text x="${sp.x}" y="${sp.y - 24}" text-anchor="middle" font-family="Assistant,Arial,sans-serif" font-weight="800" font-size="16" fill="#fff">יוצאים לדרך</text></g>
<g><circle cx="${ep.x}" cy="${ep.y}" r="76" fill="#3A9E6B"/><circle cx="${ep.x}" cy="${ep.y}" r="69" fill="#E3F4EA"/>
<path d="M${ep.x - 30} ${ep.y - 6} L${ep.x} ${ep.y - 34} L${ep.x + 30} ${ep.y - 6} Z" fill="#FF8F70"/><rect x="${ep.x - 22}" y="${ep.y - 7}" width="44" height="30" rx="3" fill="#fff" stroke="#BFD6DE" stroke-width="2"/><rect x="${ep.x - 6}" y="${ep.y + 6}" width="12" height="17" fill="#FFC929"/>
${cr(ep.x - 40, ep.y + 28, .28, 'teal', { arms: { l: 'up', r: 'up' }, eyes: 'happy' })}${cr(ep.x + 40, ep.y + 28, .28, 'coral', { arms: { l: 'up', r: 'up' }, eyes: 'happy' })}${cr(ep.x - 22, ep.y + 46, .26, 'sun', { arms: { l: 'up', r: 'up' }, eyes: 'happy' })}${cr(ep.x + 22, ep.y + 46, .26, 'lilac', { arms: { l: 'up', r: 'up' }, eyes: 'happy' })}
<text x="${ep.x}" y="${ep.y - 40}" text-anchor="middle" font-family="'Frank Ruhl Libre',Georgia,serif" font-weight="900" font-size="30" fill="#1B4F7A">חוסן</text></g>
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
