// זיכרון חוסן (21/10/2026): משחק זיכרון במסך ולהדפסה, 20 זוגות.
// שני סטים: "זוגות זהים" (איור ומילה, גם לילדים צעירים) ו"מושג ומצב" (קלף מושג עם איור, וקלף מצב מהחיים).
// גרסה לכל שכבת גיל: גן–ב׳, ג׳–ו׳, ז׳–י״ב, צוות ומבוגרים. מקור אמת אחד למסך ולהדפסה.
(function (root, factory) {
  const M = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else root.SBE_MEMORY = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const AGES = [
    { id: 'young', label: 'גן–ב׳', long: 'גן עד כיתה ב׳' },
    { id: 'mid', label: 'ג׳–ו׳', long: 'כיתות ג׳ עד ו׳' },
    { id: 'teen', label: 'ז׳–י״ב', long: 'כיתות ז׳ עד י״ב' },
    { id: 'staff', label: 'צוות ומבוגרים', long: 'צוותים, הורים ומבוגרים' }
  ];
  const SETS = [
    { id: 'same', label: 'זוגות זהים', hint: 'שני קלפים עם אותו איור ואותה מילה. מתאים במיוחד לגן ולכיתות א׳–ב׳.' },
    { id: 'match', label: 'מושג ומצב', hint: 'קלף מושג עם איור, וקלף מצב מהחיים שמתאים לו. המשפטים לפי שכבת הגיל.' }
  ];

  // ---------- איורים: יצורונים עגולים וחביבים בצבעי המותג ----------
  const C = {
    navy: ['#4F8BC4', '#1B4F7A'], teal: ['#43BED4', '#14879E'], green: ['#66C592', '#2E7D4F'],
    sun: ['#FFD34F', '#C98E00'], coral: ['#FF8F70', '#C94F33'], lilac: ['#B096E8', '#6E52AD'], pink: ['#F7A9C9', '#C75A8A']
  };
  const INK = '#1d2b36';
  const ARM = {
    down: [28, 8, 40, 24], up: [26, -8, 38, -46], wave: [28, -4, 48, -26], out: [30, 2, 52, -4], cup: [28, -2, 36, -26]
  };
  function arm(side, a, m) {
    if (!a) return '';
    const s = side; // 1 = ימין מקומי, -1 = שמאל מקומי
    let d, end;
    if (Array.isArray(a)) {
      const [t, L] = a;
      if (t === 'hug') { d = `M${28 * s} 6 C${50 * s} 22 ${(L - 12) * s} 24 ${L * s} 8`; end = [L * s, 8]; }
      else { d = `M${28 * s} 6 L${L * s} 8`; end = [L * s, 8]; }
    } else {
      const p = ARM[a]; d = `M${p[0] * s} ${p[1]} L${p[2] * s} ${p[3]}`; end = [p[2] * s, p[3]];
    }
    return `<path d="${d}" fill="none" stroke="${m}" stroke-width="10" stroke-linecap="round"/><circle cx="${end[0]}" cy="${end[1]}" r="6" fill="${m}"/>`;
  }
  const onTop = (a) => Array.isArray(a) || a === 'cup';
  // צורות גוף שונות: לא רק צבע, גם צורה (21/10/2026: "שיראו שוני צורני")
  const BODY = {
    round: 'M0 -36 C24 -36 37 -18 37 4 C37 26 21 37 0 37 C-21 37 -37 26 -37 4 C-37 -18 -24 -36 0 -36 Z',
    square: 'M-25 -33 H25 Q37 -33 37 -21 V25 Q37 37 25 37 H-25 Q-37 37 -37 25 V-21 Q-37 -33 -25 -33 Z',
    tall: 'M0 -54 C20 -54 31 -32 31 0 C31 28 19 37 0 37 C-19 37 -31 28 -31 0 C-31 -32 -20 -54 0 -54 Z',
    pear: 'M0 -42 C13 -42 20 -26 27 -8 C36 14 42 37 0 37 C-42 37 -36 14 -27 -8 C-20 -26 -13 -42 0 -42 Z',
    wide: 'M0 -26 C32 -26 46 -12 46 8 C46 28 28 37 0 37 C-28 37 -46 28 -46 8 C-46 -12 -32 -26 0 -26 Z',
    star: 'M0 -44 L10 -22 L34 -24 L22 -2 L36 18 C30 34 18 37 0 37 C-18 37 -30 34 -36 18 L-22 -2 L-34 -24 L-10 -22 Z'
  };
  // יצורון: x,y מרכז, s גודל, c צבע, o: arms {l,r}, eyes, mouth, look [dx,dy], flip, rot, tear, tuft, bow, glasses
  function cr(x, y, s, c, o) {
    o = o || {};
    const [m, d] = C[c] || C.teal;
    const arms = o.arms || { l: 'down', r: 'down' };
    const lx = (o.look || [0, 0])[0], ly = (o.look || [0, 0])[1];
    const sx = o.flip ? -s : s;
    const under = (onTop(arms.l) ? '' : arm(-1, arms.l, m)) + (onTop(arms.r) ? '' : arm(1, arms.r, m));
    const over = (onTop(arms.l) ? arm(-1, arms.l, m) : '') + (onTop(arms.r) ? arm(1, arms.r, m) : '');
    let eyes;
    const e = o.eyes || 'open';
    if (e === 'happy') eyes = `<path d="M-17 -6 Q-11 -14 -5 -6 M5 -6 Q11 -14 17 -6" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
    else if (e === 'closed') eyes = `<path d="M-17 -8 Q-11 -2 -5 -8 M5 -8 Q11 -2 17 -8" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
    else if (e === 'one') eyes = `<ellipse cx="0" cy="-9" rx="12" ry="13" fill="#fff"/><circle cx="${lx}" cy="${-8 + ly}" r="7" fill="${INK}"/><circle cx="${lx + 2.5}" cy="${-11 + ly}" r="2.4" fill="#fff"/>`;
    else eyes = [-11, 11].map((ex) => `<ellipse cx="${ex}" cy="-8" rx="7.5" ry="8.5" fill="#fff"/><circle cx="${ex + lx}" cy="${-7 + ly}" r="4.6" fill="${INK}"/><circle cx="${ex + lx + 1.6}" cy="${-9 + ly}" r="1.7" fill="#fff"/>`).join('');
    const mo = o.mouth || 'smile';
    const mouth = mo === 'open' ? `<path d="M-7 4 Q0 17 7 4 Z" fill="#7A2F3A"/><path d="M-4 10 Q0 13 4 10" fill="none" stroke="#F27C8E" stroke-width="2.4" stroke-linecap="round"/>`
      : mo === 'sad' ? `<path d="M-6 11 Q0 5 6 11" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
      : mo === 'o' ? `<ellipse cx="0" cy="8" rx="3.6" ry="4.4" fill="#7A2F3A"/>`
      : `<path d="M-7 4 Q0 12 7 4" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    const extra =
      (o.tuft ? `<path d="M0 -35 C-3 -45 3 -52 12 -53 C10 -45 6 -39 0 -35 Z" fill="#3A9E6B"/><path d="M0 -35 C-6 -41 -12 -42 -16 -40 C-12 -35 -6 -34 0 -35 Z" fill="#62C38E"/>` : '') +
      (o.bow ? `<path d="M14 -33 L4 -40 L5 -26 Z M14 -33 L24 -40 L23 -26 Z" fill="#F06A9B"/><circle cx="14" cy="-33" r="3.4" fill="#C9437A"/>` : '') +
      (o.glasses ? `<g fill="none" stroke="${INK}" stroke-width="2.4"><circle cx="-11" cy="-8" r="10"/><circle cx="11" cy="-8" r="10"/><path d="M-1 -9 Q0 -11 1 -9"/></g>` : '') +
      (o.tear ? `<path d="M-14 1 C-17 7 -17 11 -14 12 C-11 11 -11 7 -14 1 Z" fill="#7CC8EE"/>` : '');
    const top = o.body === 'tall' ? -54 : o.body === 'pear' ? -42 : o.body === 'wide' ? -26 : -35;
    const feat = { back: '', front: '' };
    if (o.ears === 'bunny') feat.back += `<ellipse cx="-12" cy="${top - 14}" rx="7" ry="17" fill="${m}"/><ellipse cx="12" cy="${top - 14}" rx="7" ry="17" fill="${m}"/><ellipse cx="-12" cy="${top - 13}" rx="3" ry="11" fill="#FF9EBB"/><ellipse cx="12" cy="${top - 13}" rx="3" ry="11" fill="#FF9EBB"/>`;
    if (o.ears === 'cat') feat.back += `<path d="M-28 ${top + 12} L-24 ${top - 12} L-8 ${top + 2} Z M28 ${top + 12} L24 ${top - 12} L8 ${top + 2} Z" fill="${m}" stroke="${m}" stroke-width="4" stroke-linejoin="round"/>`;
    if (o.ears === 'round') feat.back += `<circle cx="-24" cy="${top + 6}" r="10" fill="${d}"/><circle cx="24" cy="${top + 6}" r="10" fill="${d}"/>`;
    if (o.antenna) feat.back += `<path d="M-8 ${top + 4} Q-14 ${top - 14} -20 ${top - 18} M8 ${top + 4} Q14 ${top - 14} 20 ${top - 18}" fill="none" stroke="${d}" stroke-width="3" stroke-linecap="round"/><circle cx="-20" cy="${top - 18}" r="5" fill="#FFC929"/><circle cx="20" cy="${top - 18}" r="5" fill="#FFC929"/>`;
    if (o.spots) feat.front += `<circle cx="-24" cy="-20" r="4" fill="#fff" opacity=".35"/><circle cx="26" cy="-14" r="5" fill="#fff" opacity=".35"/><circle cx="-28" cy="18" r="3.5" fill="#fff" opacity=".35"/><circle cx="24" cy="22" r="3" fill="#fff" opacity=".35"/>`;
    if (o.horn) feat.back += `<path d="M-6 ${top + 4} L0 ${top - 16} L6 ${top + 4} Z" fill="#FFC929" stroke="#C98E00" stroke-width="1.5" stroke-linejoin="round"/>`;
    return `<g transform="translate(${x} ${y}) rotate(${o.rot || 0}) scale(${sx} ${s})">` +
      `<ellipse cx="-15" cy="35" rx="11" ry="6.5" fill="${d}"/><ellipse cx="15" cy="35" rx="11" ry="6.5" fill="${d}"/>` + under +
      feat.back + `<path d="${BODY[o.body] || BODY.round}" fill="${m}"/>` + feat.front +
      `<ellipse cx="0" cy="16" rx="22" ry="16" fill="#fff" opacity=".28"/>` +
      `<ellipse cx="-21" cy="5" rx="5.5" ry="3.5" fill="#FF7FA8" opacity=".55"/><ellipse cx="21" cy="5" rx="5.5" ry="3.5" fill="#FF7FA8" opacity=".55"/>` +
      eyes + mouth + extra + over + `</g>`;
  }
  const heart = (x, y, s, f) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -4 C-6 -14 -22 -10 -18 2 C-15 10 -6 15 0 20 C6 15 15 10 18 2 C22 -10 6 -14 0 -4 Z" fill="${f || '#F06A7A'}"/>`;
  function star(x, y, r, f) {
    let p = '';
    for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * .45 : r; p += (i ? ' ' : '') + (x + rr * Math.cos(a)).toFixed(1) + ',' + (y + rr * Math.sin(a)).toFixed(1); }
    return `<polygon points="${p}" fill="${f || '#FFC929'}" stroke="#E0A800" stroke-width="1.5" stroke-linejoin="round"/>`;
  }
  const spark = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s || 1})" d="M0 -8 Q1.2 -1.2 8 0 Q1.2 1.2 0 8 Q-1.2 1.2 -8 0 Q-1.2 -1.2 0 -8 Z" fill="#FFC929"/>`;
  const bubble = (x, y, w, h, inner, tail) => `<g transform="translate(${x} ${y})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2.2}" fill="#fff" stroke="#BFD6DE" stroke-width="2"/><path d="M${(tail || 0) - 6} ${h / 2 - 1} L${(tail || 0) + 4} ${h / 2 + 12} L${(tail || 0) + 8} ${h / 2 - 1} Z" fill="#fff"/>${inner || ''}</g>`;
  const ground = `<ellipse cx="100" cy="170" rx="74" ry="11" fill="#1B4F7A" opacity=".08"/>`;
  const bg = (t) => `<circle cx="100" cy="100" r="96" fill="${t}"/>`;

  const ART = {
    trust: (t) => bg(t) + ground + cr(140, 100, 0.36, 'lilac', { arms: { l: 'up', r: 'up' }, eyes: 'happy' }) + cr(178, 110, 0.32, 'coral', { flip: true, arms: { l: 'up', r: 'down' } }) +  heart(100, 40, 1.1, '#F06A7A') + spark(56, 46, .9) + spark(146, 40, .7) +
      cr(64, 122, .7, 'navy', { rot: 16, eyes: 'closed', arms: { l: 'out', r: 'out' } }) +
      cr(128, 124, .6, 'teal', { flip: true, look: [3, -1], arms: { l: 'wave', r: 'out' }, mouth: 'open' }) +
      cr(166, 136, .5, 'green', { flip: true, look: [3, -1], arms: { l: 'up', r: 'out' }, tuft: true }) + cr(104, 154, 0.36, 'sun', { look: [-3, -2] }),
    hope: (t) => bg(t) + ground + 
      `<g fill="none" stroke-width="10" stroke-linecap="round"><path d="M28 128 A72 72 0 0 1 172 128" stroke="#FF8F70"/><path d="M40 128 A60 60 0 0 1 160 128" stroke="#FFD34F"/><path d="M52 128 A48 48 0 0 1 148 128" stroke="#66C592"/><path d="M64 128 A36 36 0 0 1 136 128" stroke="#43BED4"/></g>` +
      cr(100, 136, .66, 'sun', { arms: { l: 'up', r: 'up' }, eyes: 'happy', mouth: 'open' }) +
      cr(46, 150, .46, 'teal', { look: [2, -4], arms: { l: 'down', r: 'up' } }) + cr(154, 150, .46, 'coral', { flip: true, look: [2, -4], arms: { l: 'down', r: 'up' }, bow: true }) + spark(30, 52, 1) + spark(170, 60, .8) + cr(24, 142, 0.34, 'green', { arms: { l: 'up', r: 'up' }, tuft: true }) + cr(176, 142, 0.34, 'lilac', { arms: { l: 'up', r: 'up' }, eyes: 'happy' }),
    // שייכות: מעגל שנפתח ומקבל את מי שמצטרף
    belong: (t) => bg(t) + ground + `<ellipse cx="100" cy="140" rx="76" ry="28" fill="#fff" opacity=".6"/>` + spark(100, 44, 1.1) + spark(60, 60, .7) + spark(142, 58, .8) +
      cr(66, 106, .34, 'navy', { arms: { l: 'down', r: ['reach', 44] }, eyes: 'happy' }) + cr(100, 102, .34, 'sun', { arms: { l: ['reach', 44], r: ['reach', 44] }, eyes: 'happy' }) + cr(134, 106, .34, 'green', { flip: true, arms: { l: 'down', r: ['reach', 44] }, eyes: 'happy', tuft: true }) +
      cr(40, 136, .42, 'teal', { arms: { l: 'down', r: 'out' }, look: [3, 1], mouth: 'open' }) + cr(160, 136, .42, 'coral', { flip: true, arms: { l: 'down', r: 'out' }, look: [3, 1], mouth: 'open' }) +
      cr(100, 158, .36, 'lilac', { arms: { l: 'up', r: 'up' }, eyes: 'happy', bow: true }),
    care: (t) => bg(t) + ground + 
      `<g stroke="#7CC8EE" stroke-width="3.5" stroke-linecap="round"><path d="M26 70 l-4 10 M38 96 l-4 10 M22 120 l-4 10 M182 104 l-4 10 M186 132 l-4 10"/></g>` +
      `<path d="M60 70 A58 50 0 0 1 176 70 Q166 62 157 70 Q147 62 137 70 Q127 62 118 70 Q108 62 98 70 Q89 62 79 70 Q70 62 60 70 Z" fill="#43BED4" stroke="#14879E" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M114 70 L114 98 Q114 104 108 104" fill="none" stroke="#6B4A2B" stroke-width="4" stroke-linecap="round"/>` +
      cr(84, 128, .78, 'green', { arms: { l: 'down', r: 'up' }, look: [3, 1] }) + cr(134, 144, .5, 'lilac', { flip: true, eyes: 'happy' }) + cr(164, 146, .46, 'pink', { flip: true, look: [3, -2], bow: true }) + cr(110, 156, 0.34, 'sun', { eyes: 'happy' }) + cr(34, 150, 0.38, 'navy', { arms: { l: 'down', r: 'out' }, look: [3, -1] }),
    listen: (t) => bg(t) + ground +  bubble(52, 52, 64, 36, `<circle cx="-15" cy="0" r="4.5" fill="#43BED4"/><circle cx="0" cy="0" r="4.5" fill="#FFC929"/><circle cx="15" cy="0" r="4.5" fill="#FF8F70"/>`, 6) +
      cr(50, 132, .66, 'coral', { mouth: 'open', arms: { l: 'down', r: 'out' }, look: [3, 0] }) +
      cr(118, 116, .54, 'navy', { flip: true, look: [3, 0], arms: { l: 'down', r: 'cup' } }) +
      cr(162, 124, .5, 'sun', { flip: true, look: [3, 0], arms: { l: 'down', r: 'cup' }, mouth: 'o' }) +
      cr(138, 156, .44, 'green', { flip: true, look: [3, -1], tuft: true }) +
      `<g fill="none" stroke="#14879E" stroke-width="3" stroke-linecap="round"><path d="M88 108 q6 6 0 12"/><path d="M81 104 q10 10 0 20"/></g>` + cr(178, 154, 0.32, 'pink', { flip: true, look: [3, -1] }),
    together: (t) => bg(t) + ground + 
      `<rect x="22" y="58" width="156" height="26" rx="8" fill="#FFD34F" stroke="#C98E00" stroke-width="3"/>` + star(50, 71, 7, '#fff') + star(100, 71, 7, '#fff') + star(150, 71, 7, '#fff') +
      cr(48, 136, .62, 'teal', { arms: { l: 'up', r: 'up' }, eyes: 'happy' }) + cr(100, 140, .6, 'coral', { arms: { l: 'up', r: 'up' }, mouth: 'open', bow: true }) + cr(152, 136, .62, 'green', { arms: { l: 'up', r: 'up' }, mouth: 'open', tuft: true }) + cr(74, 164, 0.32, 'lilac', { arms: { l: 'up', r: 'up' }, eyes: 'happy' }) + cr(126, 164, 0.32, 'sun', { arms: { l: 'up', r: 'up' }, mouth: 'open' }),
    // כולנו שונים: שוני בצורה, בגודל ובמראה, ולא אביזרים
    diverse: (t) => bg(t) + ground + spark(40, 50, .9) + spark(160, 44, 1) + spark(100, 30, .7) +
      cr(30, 140, .46, 'teal', { body: 'tall', ears: 'bunny', arms: { l: 'wave', r: 'down' }, eyes: 'happy' }) +
      cr(68, 138, .5, 'sun', { body: 'square', arms: { l: 'down', r: 'wave' }, mouth: 'open' }) +
      cr(108, 130, .58, 'coral', { body: 'pear', eyes: 'one', horn: true, arms: { l: 'up', r: 'up' } }) +
      cr(148, 140, .5, 'navy', { body: 'wide', ears: 'round', spots: true, arms: { l: 'wave', r: 'down' } }) +
      cr(180, 148, .34, 'lilac', { body: 'star', antenna: true, eyes: 'happy' }) +
      cr(86, 166, .26, 'green', { ears: 'cat', eyes: 'happy', arms: { l: 'wave', r: 'wave' } }),
    empathy: (t) => bg(t) + ground + cr(72, 100, 0.32, 'pink', { look: [2, 3] }) +  heart(100, 46, .9, '#F06A7A') + heart(76, 34, .45, '#F7A9C9') +
      cr(100, 130, .64, 'lilac', { tear: true, mouth: 'sad', look: [0, 2] }) +
      cr(150, 126, .64, 'sun', { flip: true, arms: { l: 'down', r: ['hug', 62] }, look: [3, 1] }) +
      cr(50, 132, .6, 'teal', { arms: { l: 'down', r: ['reach', 44] }, look: [3, 1] }) + cr(26, 156, 0.32, 'green', { look: [3, -1], tuft: true }) + cr(176, 156, 0.32, 'navy', { flip: true, look: [3, -1] }),
    talk: (t) => bg(t) + ground +
      bubble(46, 40, 40, 30, heart(0, -3, .5, '#F06A7A'), 6) + bubble(100, 30, 40, 30, star(0, 0, 8), 0) + bubble(154, 40, 40, 30, `<path d="M-8 -2 Q0 8 8 -2" fill="none" stroke="#1A9BB5" stroke-width="3" stroke-linecap="round"/>`, -6) +
      cr(76, 104, .46, 'lilac', { mouth: 'open', look: [2, 1], arms: { l: 'wave', r: 'down' } }) + cr(124, 104, .46, 'sun', { flip: true, eyes: 'happy', arms: { l: 'down', r: 'wave' } }) +
      cr(44, 142, .54, 'teal', { mouth: 'open', look: [3, -1], arms: { l: 'down', r: 'out' } }) + cr(100, 148, .52, 'green', { tuft: true, look: [0, -2], mouth: 'smile' }) +
      cr(156, 142, .54, 'coral', { flip: true, look: [3, -1], mouth: 'open', arms: { l: 'down', r: 'out' } }),
    cando: (t) => bg(t) + ground +  star(100, 34, 18) + spark(66, 40, .9) + spark(136, 52, .8) +
      cr(100, 140, .72, 'green', { arms: { l: 'up', r: 'up' }, mouth: 'open' }) + cr(100, 95, .5, 'sun', { arms: { l: 'up', r: 'up' }, eyes: 'happy' }) +
      cr(42, 150, .48, 'teal', { arms: { l: 'down', r: 'up' }, look: [3, -2] }) + cr(158, 150, .48, 'coral', { flip: true, arms: { l: 'down', r: 'up' }, look: [3, -2] }) + cr(176, 118, 0.32, 'lilac', { arms: { l: 'up', r: 'up' } }) + cr(24, 118, 0.32, 'pink', { arms: { l: 'up', r: 'up' }, bow: true }),
    // דרך אחרת: הקבוצה מוצאת יחד דרך לעקוף מכשול בלי לוותר על היעד
    flexible: (t) => bg(t) +
      `<path d="M14 154 C60 150 120 146 190 134 L184 152 C120 162 60 168 22 172 Z" fill="#EAD9B8"/>` +
      `<path d="M118 152 C112 120 132 104 150 110 C170 104 180 132 170 152 Z" fill="#9FB0B8" stroke="#6F838C" stroke-width="3" stroke-linejoin="round"/><path d="M136 118 l6 10 l-4 8 M156 126 l-6 8" fill="none" stroke="#6F838C" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="M92 150 C96 84 168 70 186 132" fill="none" stroke="#1A9BB5" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 9"/><path d="M180 124 L188 136 L192 122 Z" fill="#1A9BB5"/>` +
      `<path d="M186 134 L186 96" stroke="#6B4A2B" stroke-width="3.5" stroke-linecap="round"/><path d="M186 96 L166 102 L186 110 Z" fill="#FFC929"/>` +
      cr(122, 86, .34, 'coral', { arms: { l: 'up', r: 'out' }, look: [3, -1], mouth: 'open' }) +
      cr(98, 112, .32, 'lilac', { arms: { l: 'down', r: 'up' }, look: [3, -2] }) +
      cr(38, 148, .42, 'sun', { arms: { l: 'down', r: 'out' }, look: [3, -2] }) +
      cr(66, 156, .4, 'teal', { arms: { l: 'wave', r: 'out' }, look: [3, -2], eyes: 'happy' }) +
      cr(12, 146, .28, 'green', { tuft: true, look: [3, -1] }),
    lead: (t) => bg(t) + ground + cr(82, 118, 0.28, 'teal', { look: [-3, 0] }) + 
      `<path d="M58 64 A46 30 0 1 1 146 72" fill="none" stroke="#43BED4" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 10"/><path d="M146 58 L148 76 L132 70 Z" fill="#43BED4"/>` +
      `<path d="M44 68 L44 118" stroke="#6B4A2B" stroke-width="4" stroke-linecap="round"/><path d="M44 68 L70 75 L44 84 Z" fill="#FF8F70"/>` +
      cr(58, 136, .56, 'navy', { arms: { l: 'up', r: 'down' }, eyes: 'happy' }) + cr(102, 138, .52, 'green', { arms: { l: 'wave', r: 'down' }, look: [-3, 0] }) + cr(144, 140, .48, 'pink', { look: [-3, 0], bow: true }) + cr(180, 150, 0.32, 'sun', { look: [-3, 0] }),
    routine: (t) => bg(t) + ground + cr(73, 122, 0.36, 'coral', { eyes: 'happy' }) + cr(127, 122, 0.36, 'lilac', { arms: { l: 'wave', r: 'down' } }) + 
      `<circle cx="100" cy="70" r="42" fill="#fff" stroke="#1B4F7A" stroke-width="6"/>` +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => { const a = i * Math.PI / 6; return `<circle cx="${(100 + 33 * Math.sin(a)).toFixed(1)}" cy="${(70 - 33 * Math.cos(a)).toFixed(1)}" r="${i % 3 ? 2 : 3.4}" fill="${i % 3 ? '#9FB6C2' : '#1A9BB5'}"/>`; }).join('') +
      `<path d="M100 70 L100 46 M100 70 L117 80" stroke="#1B4F7A" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="70" r="5" fill="#FF8F70"/>` +
      `<path d="M72 30 l-10 -8 M128 30 l10 -8" stroke="#1B4F7A" stroke-width="5" stroke-linecap="round"/>` +
      cr(46, 146, .5, 'sun', { arms: { l: 'down', r: 'wave' }, mouth: 'open' }) + cr(100, 150, .48, 'teal', { arms: { l: 'wave', r: 'wave' }, eyes: 'happy' }) + cr(154, 146, .5, 'green', { arms: { l: 'wave', r: 'down' }, tuft: true }),
    dream: (t) => bg(t) + ground + 
      `<g fill="#fff" stroke="#BFD6DE" stroke-width="2.5"><circle cx="70" cy="62" r="24"/><circle cx="100" cy="48" r="30"/><circle cx="132" cy="60" r="26"/><rect x="62" y="58" width="80" height="26" rx="13" stroke="none"/></g>` +
      `<path d="M78 78 L78 62 L92 52 L106 62 L106 78 Z" fill="#FF8F70"/><rect x="88" y="66" width="8" height="12" fill="#fff"/><circle cx="124" cy="60" r="10" fill="#66C592"/><path d="M124 68 L124 80" stroke="#6B4A2B" stroke-width="4" stroke-linecap="round"/>` + star(104, 36, 6) +
      `<circle cx="96" cy="96" r="5" fill="#fff" stroke="#BFD6DE" stroke-width="2"/><circle cx="100" cy="106" r="3.4" fill="#fff" stroke="#BFD6DE" stroke-width="2"/>` +
      cr(50, 142, .54, 'navy', { look: [2, -4] }) + cr(100, 146, .5, 'lilac', { look: [0, -4], mouth: 'o', tuft: true }) + cr(150, 142, .54, 'pink', { flip: true, look: [2, -4], bow: true }) + cr(24, 154, 0.32, 'teal', { look: [2, -4] }) + cr(176, 154, 0.32, 'sun', { flip: true, look: [2, -4] }),
    rules: (t) => bg(t) + ground + cr(78, 114, 0.3, 'coral', { eyes: 'happy' }) + cr(122, 114, 0.3, 'navy', { eyes: 'happy' }) + 
      `<rect x="52" y="30" width="96" height="66" rx="8" fill="#fff" stroke="#1B4F7A" stroke-width="4"/>` +
      [46, 62, 78].map((y, i) => `<path d="M64 ${y} l4 4 l8 -9" fill="none" stroke="#3A9E6B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="84" y="${y - 3}" width="${[50, 40, 46][i]}" height="6" rx="3" fill="${['#43BED4', '#FFD34F', '#FF8F70'][i]}"/>`).join('') +
      cr(52, 136, .64, 'green', { arms: { l: 'down', r: 'up' }, eyes: 'happy', tuft: true }) + cr(148, 136, .64, 'lilac', { flip: true, arms: { l: 'down', r: 'up' }, mouth: 'open' }) + cr(100, 150, .46, 'sun', { eyes: 'happy', arms: { l: 'wave', r: 'wave' } }) + cr(22, 158, 0.3, 'teal', { arms: { l: 'wave', r: 'down' } }) + cr(178, 158, 0.3, 'pink', { arms: { l: 'down', r: 'wave' } }),
    thanks: (t) => bg(t) + ground + cr(160, 104, 0.3, 'lilac', { arms: { l: 'wave', r: 'wave' } }) +  spark(150, 50, 1) + spark(170, 76, .7) +
      `<path d="M92 132 L90 92" stroke="#3A9E6B" stroke-width="4" stroke-linecap="round"/><path d="M91 112 q-12 -8 -16 2 q10 4 16 -2 Z" fill="#66C592"/>` +
      [0, 72, 144, 216, 288].map((a) => `<circle cx="${(90 + 9 * Math.sin(a * Math.PI / 180)).toFixed(1)}" cy="${(84 - 9 * Math.cos(a * Math.PI / 180)).toFixed(1)}" r="7" fill="#F7A9C9"/>`).join('') + `<circle cx="90" cy="84" r="5" fill="#FFC929"/>` +
      cr(56, 130, .7, 'coral', { arms: { l: 'down', r: ['reach', 44] }, look: [3, -1], eyes: 'happy' }) + cr(128, 130, .64, 'teal', { flip: true, look: [3, -2], mouth: 'open', arms: { l: 'down', r: 'cup' } }) +
      cr(168, 148, .44, 'sun', { flip: true, eyes: 'happy', arms: { l: 'wave', r: 'wave' } }) + cr(100, 160, 0.32, 'pink', { eyes: 'happy' }),
    // טקסים משותפים: הקבוצה חוגגת יחד
    celebrate: (t) => bg(t) + ground +
      `<path d="M14 40 Q100 78 186 40" fill="none" stroke="#6B4A2B" stroke-width="2"/>` +
      [24, 46, 68, 90, 112, 134, 156, 176].map((x, k) => { const y = 40 + 38 * (1 - Math.pow((x - 100) / 86, 2)) * .98; return `<path d="M${x - 8} ${y.toFixed(1)} L${x + 8} ${y.toFixed(1)} L${x} ${(y + 16).toFixed(1)} Z" fill="${['#FF8F70', '#FFD34F', '#43BED4', '#66C592', '#B096E8'][k % 5]}"/>`; }).join('') +
      [[34, 96, '#43BED4'], [62, 84, '#FF8F70'], [140, 86, '#66C592'], [168, 98, '#FFD34F'], [100, 92, '#B096E8'], [118, 104, '#FF8F70'], [80, 106, '#FFD34F']].map(([x, y, c], k) => `<rect x="${x}" y="${y}" width="6" height="3" rx="1" fill="${c}" transform="rotate(${k * 37} ${x} ${y})"/>`).join('') +
      `<rect x="84" y="128" width="32" height="20" rx="4" fill="#fff" stroke="#F7A9C9" stroke-width="2.5"/><path d="M84 136 Q92 132 100 136 Q108 140 116 136" fill="none" stroke="#F7A9C9" stroke-width="2.5"/><path d="M100 128 L100 118" stroke="#43BED4" stroke-width="3"/><path d="M100 108 C104 113 103 117 100 118 C97 117 96 113 100 108 Z" fill="#FFC929"/>` +
      cr(54, 128, .36, 'lilac', { arms: { l: 'up', r: 'up' }, eyes: 'happy' }) + cr(146, 128, .36, 'navy', { arms: { l: 'up', r: 'up' }, mouth: 'open' }) +
      cr(28, 152, .42, 'coral', { arms: { l: 'up', r: 'wave' }, mouth: 'open' }) + cr(68, 160, .4, 'sun', { arms: { l: 'wave', r: 'up' }, eyes: 'happy' }) +
      cr(132, 160, .4, 'teal', { arms: { l: 'up', r: 'wave' }, eyes: 'happy' }) + cr(172, 152, .42, 'green', { arms: { l: 'wave', r: 'up' }, mouth: 'open', tuft: true }),
    help: (t) => bg(t) + ground +  bubble(58, 58, 40, 40, `<text x="0" y="10" text-anchor="middle" font-family="Assistant,Arial,sans-serif" font-weight="800" font-size="28" fill="#1A9BB5">?</text>`, 4) +
      cr(60, 144, .54, 'lilac', { arms: { l: 'down', r: 'up' }, look: [3, -2] }) +
      cr(126, 126, .7, 'sun', { flip: true, look: [3, 2], arms: { l: 'down', r: ['reach', 56] }, eyes: 'happy' }) +
      cr(170, 146, .46, 'green', { flip: true, look: [3, 0], arms: { l: 'down', r: 'out' }, tuft: true }) + cr(26, 154, 0.32, 'pink', { look: [3, -2], bow: true }) + cr(96, 162, 0.3, 'navy', { arms: { l: 'down', r: 'up' } }),
    peace: (t) => bg(t) + ground + cr(100, 108, 0.3, 'lilac', { eyes: 'happy', arms: { l: 'up', r: 'up' } }) + 
      heart(100, 44, 1.2, '#F06A7A') + `<g transform="translate(100 51) rotate(-30)"><rect x="-19" y="-7" width="38" height="14" rx="7" fill="#FFE2B8" stroke="#E0B47A" stroke-width="1.5"/><circle cx="-4" cy="-2" r="1.2" fill="#E0B47A"/><circle cx="4" cy="2" r="1.2" fill="#E0B47A"/><circle cx="4" cy="-2" r="1.2" fill="#E0B47A"/><circle cx="-4" cy="2" r="1.2" fill="#E0B47A"/></g>` +
      cr(56, 128, .66, 'navy', { arms: { l: 'down', r: ['reach', 50] }, eyes: 'happy' }) + cr(144, 128, .66, 'coral', { flip: true, arms: { l: 'down', r: ['reach', 50] }, eyes: 'happy' }) +
      cr(100, 154, .4, 'sun', { eyes: 'happy', arms: { l: 'up', r: 'up' }, mouth: 'open' }) + cr(22, 152, 0.32, 'teal', { eyes: 'happy' }) + cr(178, 152, 0.32, 'green', { eyes: 'happy', tuft: true }),
    // תפקיד לכולם: גלגל תורנות בצבעי היצורונים, וכל אחד מחזיק את כלי התפקיד שלו
    roles: (t) => bg(t) + ground +
      ['#66C592', '#FFD34F', '#43BED4', '#FF8F70', '#B096E8'].map((c, k) => { const a0 = (k * 72 - 90) * Math.PI / 180, a1 = ((k + 1) * 72 - 90) * Math.PI / 180, r = 36, cx = 100, cy = 66;
        return `<path d="M${cx} ${cy} L${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)} Z" fill="${c}" stroke="#fff" stroke-width="2.5"/>`; }).join('') +
      `<circle cx="100" cy="66" r="7" fill="#fff" stroke="#1B4F7A" stroke-width="3"/><path d="M100 22 L94 12 L106 12 Z" fill="#1B4F7A"/>` +
      `<path d="M146 44 A50 50 0 0 1 150 84" fill="none" stroke="#1B4F7A" stroke-width="3.5" stroke-linecap="round"/><path d="M144 82 L151 92 L156 80 Z" fill="#1B4F7A"/>` +
      `<path d="M54 88 A50 50 0 0 1 50 48" fill="none" stroke="#1B4F7A" stroke-width="3.5" stroke-linecap="round"/><path d="M56 50 L49 40 L44 52 Z" fill="#1B4F7A"/>` +
      cr(30, 148, .4, 'green', { arms: { l: 'down', r: 'up' }, eyes: 'happy', tuft: true }) +
      `<g transform="translate(46 124)"><rect x="-8" y="-6" width="14" height="12" rx="3" fill="#43BED4"/><path d="M6 -2 L14 -9" stroke="#43BED4" stroke-width="3.5" stroke-linecap="round"/><path d="M-8 -3 q-6 3 0 7" fill="none" stroke="#43BED4" stroke-width="2.5"/><circle cx="16" cy="-4" r="1.6" fill="#7CC8EE"/><circle cx="18" cy="1" r="1.6" fill="#7CC8EE"/></g>` +
      cr(66, 156, .4, 'sun', { arms: { l: 'up', r: 'up' }, mouth: 'open' }) +
      `<g transform="translate(66 134)"><rect x="-17" y="0" width="34" height="4" rx="2" fill="#6B4A2B"/><rect x="-12" y="-8" width="7" height="8" rx="1.5" fill="#fff" stroke="#BFD6DE"/><rect x="-3" y="-8" width="7" height="8" rx="1.5" fill="#fff" stroke="#BFD6DE"/><rect x="6" y="-8" width="7" height="8" rx="1.5" fill="#fff" stroke="#BFD6DE"/></g>` +
      cr(100, 148, .46, 'teal', { arms: { l: 'up', r: 'up' }, eyes: 'happy' }) +
      `<g transform="translate(100 120)"><path d="M0 2 L-16 -4 L-16 8 L0 14 Z" fill="#fff" stroke="#14879E" stroke-width="2"/><path d="M0 2 L16 -4 L16 8 L0 14 Z" fill="#fff" stroke="#14879E" stroke-width="2"/><path d="M-12 1 l8 3 M-12 5 l8 3 M4 4 l8 -3 M4 8 l8 -3" stroke="#9FB6C2" stroke-width="1.3"/></g>` +
      cr(134, 156, .4, 'coral', { flip: true, arms: { l: 'down', r: 'up' }, look: [3, 0] }) +
      `<path d="M114 168 L128 128" stroke="#6B4A2B" stroke-width="3.5" stroke-linecap="round"/><path d="M110 160 L120 164 L114 176 L104 172 Z" fill="#FFD34F" stroke="#C98E00" stroke-width="1.5"/>` +
      cr(170, 148, .4, 'lilac', { flip: true, arms: { l: 'down', r: 'up' }, mouth: 'open' }) +
      `<g transform="translate(155 126)"><path d="M-7 4 Q-7 -8 0 -8 Q7 -8 7 4 L9 7 L-9 7 Z" fill="#FFC929" stroke="#C98E00" stroke-width="1.5"/><circle cx="0" cy="9" r="2.4" fill="#C98E00"/><path d="M-12 -6 l-4 -3 M12 -6 l4 -3" stroke="#C98E00" stroke-width="2" stroke-linecap="round"/></g>`
  };

  // ---------- 20 המושגים ----------
  // name: young | mid | adult (לז׳–י״ב ולצוות). sit: משפט מצב לכל גיל. info: הסבר קצר למנחה.
  const ITEMS = [
    { id: 'trust', tint: '#E6F0FA', col: '#1B4F7A', name: { young: 'אמון', mid: 'אמון', adult: 'אמון' },
      sit: { young: 'הבטיחו לחכות לי בשער, וחיכו.', mid: 'שכחתי קלמר, וידעתי שאפשר לבקש מכל אחד בכיתה בלי שיצחקו.', teen: 'טעיתי בתשובה מול כל הכיתה, ואף אחד לא צחק.', staff: 'סיפרתי בישיבת צוות על שיעור שלא הצליח, וקיבלתי עזרה ולא ביקורת.' },
      info: 'הביטחון שאפשר לסמוך על האנשים סביבי ועל המסגרת: שיקשיבו, יעמדו במילה ולא יפגעו כשטועים.' },
    { id: 'hope', tint: '#FFF4D6', col: '#8F5A00', name: { young: 'תקווה', mid: 'תקווה', adult: 'אופטימיות ותקווה' },
      sit: { young: 'היום המגדל שלי נפל. מחר אנסה שוב.', mid: 'הפסדנו במשחק, ואמרנו: נתאמן, ובפעם הבאה ילך טוב יותר.', teen: 'קשה לי במתמטיקה, אבל יש לי תוכנית: שיעור עזר פעמיים בשבוע.', staff: 'השנה נפתחה בטלטלה, ובכל זאת בנינו יחד תוכנית לשלושת החודשים הקרובים.' },
      info: 'האמונה שהמצב יכול להשתפר, יחד עם דרכים להגיע לשם. תקווה היא גם מטרה וגם דרך.' },
    { id: 'belong', tint: '#E3F5F7', col: '#137A8C', name: { young: 'שייכות', mid: 'שייכות', adult: 'שייכות' },
      sit: { young: 'כשלא באתי לגן, כולם שאלו איפה אני.', mid: 'ביום הראשון שלי בכיתה הזמינו אותי לשבת איתם בהפסקה.', teen: 'בקבוצה שלנו יש מקום לכל אחד ואחת, גם למי שמדברים מעט.', staff: 'המורה החדשה קיבלה ביום הראשון מפתח, מגירה ושם על הדלת.' },
      info: 'התחושה שיש לי מקום בקבוצה: מחכים לי, שמים לב כשאני לא שם, ושמחים כשאני חוזר/ת.' },
    { id: 'care', tint: '#E6F5EC', col: '#2E7D4F', name: { young: 'ערבות הדדית', mid: 'ערבות הדדית', adult: 'ערבות הדדית' },
      sit: { young: 'חבר נפל. עצרנו את המשחק ועזרנו לו לקום.', mid: 'חברה חלתה, והכיתה שלחה לה כל יום את סיכום השיעורים.', teen: 'ראינו שמישהו אוכל לבד, והזמנו אותו להצטרף אלינו.', staff: 'מורה נעדרה פתאום, והצוות חילק ביניהם את השיעורים שלה.' },
      info: 'כל אחד/ת אחראי/ת גם לאחרים: עוזרים, מחכים ובודקים מה שלום מי, גם בלי שמבקשים.' },
    { id: 'listen', tint: '#FFEDE7', col: '#B23A26', name: { young: 'הקשבה', mid: 'הקשבה', adult: 'הקשבה' },
      sit: { young: 'כשחברה מספרת, אני מסתכל עליה ולא מפריע.', mid: 'לפני שעניתי, אמרתי במילים שלי מה חבר שלי אמר.', teen: 'הנחתי את הטלפון בצד כשחברה סיפרה לי מה קרה לה.', staff: 'בשיחה עם הורה שאלתי: מה הכי חשוב לכם שאדע על הילד?' },
      info: 'נותנים למי שמדבר/ת את מלוא תשומת הלב, ובודקים שהבנו לפני שעונים.' },
    { id: 'together', tint: '#FFF4D6', col: '#8F5A00', name: { young: 'שיתוף פעולה', mid: 'שיתוף פעולה', adult: 'שיתוף פעולה' },
      sit: { young: 'בנינו יחד מגדל: אחד מחזיק ואחת מניחה קוביות.', mid: 'חילקנו תפקידים בעבודה: כותבת, מאייר, מציגה ושומר זמן.', teen: 'כל אחד בקבוצה הביא חלק אחר מהמחקר, ויחד יצאה עבודה שלמה.', staff: 'שלושה מורים מתחומים שונים תכננו יחד יום למידה אחד.' },
      info: 'פועלים יחד למטרה משותפת, וכל אחד/ת תורם/ת חלק אחר.' },
    { id: 'diverse', tint: '#FCE8F1', col: '#B0124F', name: { young: 'הוקרת הריבוי', mid: 'הוקרת הריבוי', adult: 'הוקרת הריבוי' },
      sit: { young: 'אחד אוהב לצייר ואחת אוהבת לשיר. ביחד הכינו הפתעה.', mid: 'לימדתי את הכיתה מילה בשפה שמדברים אצלנו בבית.', teen: 'הייתה לנו מחלוקת בדיון, ובזכותה הגענו לרעיון טוב יותר.', staff: 'בצוות יש מי שאוהבים לתכנן ומי שאוהבים לאלתר, ושני הסגנונות עוזרים לנו.' },
      info: 'ההבנה שההבדלים בינינו, בשפה, בתרבות, בכישרון ובדעה, מחזקים את הקבוצה.' },
    { id: 'empathy', tint: '#F0EAFB', col: '#5E3F9E', name: { young: 'אמפתיה', mid: 'אמפתיה', adult: 'אמפתיה' },
      sit: { young: 'חברה בכתה. ישבתי לידה ושאלתי: מה קרה?', mid: 'חבר הפסיד בתחרות. אמרתי לו: אני מבינה שזה מאכזב.', teen: 'לפני שהגבתי, ניסיתי לדמיין איך היא מרגישה עכשיו.', staff: 'תלמיד התפרץ בשיעור, ושאלתי את עצמי: מה עובר עליו היום?' },
      info: 'מנסים להבין מה האחר/ת מרגיש/ה, ומראים שאכפת לנו.' },
    { id: 'talk', tint: '#E3F1FA', col: '#0A6EA8', name: { young: 'תקשורת', mid: 'תקשורת', adult: 'תקשורת בין־אישית' },
      sit: { young: 'במקום לצעוק, אמרתי: אני רוצה תור.', mid: 'אמרתי: כשלוקחים לי את הכדור בלי לשאול, אני כועס. אפשר לבקש?', teen: 'בקבוצה הכיתתית כתבנו רק מה שהיינו אומרים גם פנים אל פנים.', staff: 'בישיבה כל אחד ואחת דיברו בתורם, ואף אחד לא קטע.' },
      info: 'איך מדברים ומקשיבים: שאלות פתוחות, חזרה במילים שלי, דיבור על רגשות ובקשות ברורות.' },
    { id: 'cando', tint: '#FFEEDD', col: '#A84A00', name: { young: 'מסוגלות קבוצתית', mid: 'מסוגלות קבוצתית', adult: 'מסוגלות קבוצתית' },
      sit: { young: 'לבד לא הצלחנו להרים את השולחן. ביחד הצלחנו.', mid: 'בפעם הקודמת ניקינו את החצר בשעה אחת. נעשה את זה שוב!', teen: 'אמרנו: כבר ארגנו יריד אחד, נוכל לארגן גם את הטקס.', staff: 'הצוות נזכר איך עבר יחד את תקופת החירום, וסמך על עצמו גם הפעם.' },
      info: 'האמונה של הקבוצה שביחד היא יכולה להצליח. היא נבנית מהצלחות קודמות שעשינו יחד.' },
    { id: 'flexible', tint: '#EDF5E3', col: '#4F7A1E', name: { young: 'גמישות', mid: 'גמישות', adult: 'גמישות והסתגלות' },
      sit: { young: 'ירד גשם, אז עשינו את הפיקניק בכיתה.', mid: 'הטיול בוטל, והכיתה תכננה במקומו יום משחקים.', teen: 'המחשב קרס לפני ההצגה, והצגנו בעל פה עם ציורים על הלוח.', staff: 'הלמידה עברה למרחוק, ותוך יום מצאנו דרך לשמור על מפגש הבוקר.' },
      info: 'היכולת לשנות תוכנית כשהמציאות משתנה, ולמצוא דרך אחרת בלי לוותר על המטרה.' },
    { id: 'lead', tint: '#E8EAF7', col: '#2E3A8C', name: { young: 'מנהיגות משותפת', mid: 'מנהיגות משותפת', adult: 'מנהיגות משותפת' },
      sit: { young: 'היום התור שלי להוביל את הטור, ומחר התור של מישהו אחר.', mid: 'כל שבוע מישהו אחר בכיתה מנהל את מועצת הכיתה.', teen: 'את ערב ההתרמה הובילו שלוש קבוצות קטנות, כל אחת בתחום שלה.', staff: 'כל אחד ואחת בצוות מובילים נושא אחד בישיבות השנה.' },
      info: 'ההובלה מתחלקת ועוברת: כל אחד/ת יכול/ה להוביל משהו, והקבוצה מחליטה יחד.' },
    { id: 'routine', tint: '#EDF0F2', col: '#4A5A64', name: { young: 'שגרה', mid: 'שגרה', adult: 'שגרות' },
      sit: { young: 'כל בוקר אומרים שלום במעגל.', mid: 'כל יום ראשון פותחים בשיחה קצרה: מה שלומכם?', teen: 'בכל סוף שבוע כותבים ביומן הכיתה מה הצלחנו לעשות.', staff: 'פעם בשבוע יש מפגש צוות קצר, באותה שעה ובאותו מקום.' },
      info: 'מה שחוזר באופן קבוע ונותן יציבות וביטחון, גם כשהזמנים לא צפויים.' },
    { id: 'dream', tint: '#F0EAFB', col: '#5E3F9E', name: { young: 'תמונת עתיד', mid: 'תמונת עתיד', adult: 'תמונת עתיד משותפת' },
      sit: { young: 'ציירנו יחד איך תיראה החצר שלנו בקיץ.', mid: 'כתבנו יחד: בסוף השנה הכיתה שלנו תהיה מקום ש...', teen: 'החלטנו יחד מה נרצה להשאיר אחרינו לשכבות הבאות.', staff: 'ניסחנו בצוות משפט אחד: איזה בית ספר נרצה להיות בעוד חמש שנים.' },
      info: 'מה שהקבוצה רוצה שיקרה בעתיד, כשכולם שותפים לניסוח. היא נותנת כיוון גם בזמנים מאתגרים.' },
    { id: 'rules', tint: '#F4EDE6', col: '#6B4A2B', name: { young: 'ערכים משותפים', mid: 'ערכים משותפים', adult: 'אתוס וערכים משותפים' },
      sit: { young: 'בגן שלנו לא צוחקים על אף אחד.', mid: 'כתבנו אמנה כיתתית, וכולם חתמו עליה.', teen: 'גם כשהמורה לא בכיתה, אנחנו שומרים על מה שהסכמנו.', staff: 'הצוות בחר שלושה ערכים, ובודק אותם בכל החלטה.' },
      info: 'הערכים והמנהגים שהקבוצה מסכימה עליהם ופועלת לפיהם, גם כשקשה.' },
    { id: 'thanks', tint: '#FFEDE7', col: '#B23A26', name: { young: 'הכרת תודה', mid: 'הכרת תודה', adult: 'הכרת תודה' },
      sit: { young: 'אמרתי תודה לשומר בשער.', mid: 'כתבנו פתק תודה לעובדת הניקיון.', teen: 'בסוף הפרויקט כל אחד ואחת הודו למישהו על תרומה מסוימת.', staff: 'בפתיחת הישיבה הודינו לאב הבית שתיקן את המזגן.' },
      info: 'שמים לב לטוב שאחרים עושים בשבילנו, ואומרים את זה בקול.' },
    { id: 'celebrate', tint: '#FFF4D6', col: '#8F5A00', name: { young: 'טקסים משותפים', mid: 'טקסים משותפים', adult: 'טקסים משותפים' },
      sit: { young: 'כשמישהו בגן חוגג יום הולדת, כולנו שרים לו יחד.', mid: 'בסוף כל חודש הכיתה חוגגת יחד את מה שהצלחנו.', teen: 'בטקס סוף השנה כל קבוצה הציגה רגע שזכרה מהשנה.', staff: 'אחרי תקופה מאתגרת הצוות נפגש לארוחה משותפת, וכל אחד ואחת סיפרו מה למדו.' },
      info: 'רגעים קבועים שבהם הקבוצה נפגשת לחגוג, לזכור ולהודות. הם מחזקים את הקשר ואת תחושת השייכות, גם בזמנים מאתגרים.' },
    { id: 'help', tint: '#FFF4D6', col: '#8F5A00', name: { young: 'בקשת עזרה', mid: 'בקשת עזרה', adult: 'בקשת עזרה' },
      sit: { young: 'לא הצלחתי לפתוח את הקופסה, וביקשתי עזרה.', mid: 'לא הבנתי את התרגיל, והרמתי יד.', teen: 'כתבתי לחבר: יש לי יום קשה, אפשר לדבר?', staff: 'ביקשתי מעמיתה לבוא לשיעור שלי ולתת לי רעיון.' },
      info: 'יודעים לומר מתי קשה ולבקש. בקשת עזרה מחזקת, והיא מזמינה גם אחרים לבקש.' },
    { id: 'peace', tint: '#FCE8EC', col: '#B0124F', name: { young: 'פיוס', mid: 'פיוס', adult: 'פיוס' },
      sit: { young: 'רבנו על הנדנדה, ואחר כך התנדנדנו בתורות.', mid: 'אמרתי: סליחה שלקחתי בלי לשאול. והיא ענתה: בסדר, בואי נשחק.', teen: 'אחרי הריב כתבתי לו: חשוב לי שנדבר על מה שקרה.', staff: 'אחרי ויכוח בישיבה, ישבנו לקפה ודיברנו על מה שקרה.' },
      info: 'אחרי ריב או פגיעה חוזרים לקשר: מקשיבים, מתנצלים ומחליטים יחד איך ממשיכים.' },
    { id: 'roles', tint: '#EDF5E3', col: '#2E7D4F', name: { young: 'תפקידים מתחלפים', mid: 'תפקידים מתחלפים', adult: 'מנגנון חוסן חברתי' },
      sit: { young: 'לכל אחד בגן יש תפקיד: להשקות, לחלק כוסות, לסדר.', mid: 'יש לנו לוח עזרה: מי רוצה עזרה ומי יכול לעזור. מתחלפים כל שבוע.', teen: 'ועדת הכיתה נפגשת כל שבועיים, מתעדת, ומחליפה תפקידים כל חודש.', staff: 'יש לנו שרשרת קשר קבועה, ובודקים אותה יחד פעמיים בשנה.' },
      info: 'הסדר קבוע עם משתתפים, אחריות, מועד קבוע, תיעוד ומועד לבדיקה. הוא ממשיך לפעול גם כשמשהו משתבש.' }
  ];

  const nameFor = (it, age) => age === 'young' ? it.name.young : age === 'mid' ? it.name.mid : it.name.adult;
  function art(it, size) {
    return `<svg viewBox="0 0 200 200" width="${size || '100%'}" height="${size || '100%'}" role="img" aria-hidden="true">${ART[it.id](it.tint)}</svg>`;
  }
  // קלפים למשחק: set 'same' או 'match', גיל, ומספר זוגות. מחזיר [{key, pair, kind, it}]
  function deck(set, age, n, pick) {
    const items = (pick || ITEMS).slice(0, n || 20);
    const out = [];
    items.forEach((it) => {
      if (set === 'same') { out.push({ pair: it.id, kind: 'pic', it }, { pair: it.id, kind: 'pic', it }); }
      else { out.push({ pair: it.id, kind: 'concept', it }, { pair: it.id, kind: 'sit', it }); }
    });
    return out.map((c, i) => Object.assign({ key: i }, c));
  }
  function shuffle(a, rnd) { a = a.slice(); rnd = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // פני הקלף (HTML). אותו מבנה במסך ובהדפסה.
  function face(c, age) {
    const it = c.it;
    if (c.kind === 'sit') {
      return `<div class="mg-face mg-sit"><span class="mg-q" aria-hidden="true">❝</span><p>${esc(it.sit[age] || it.sit.mid)}</p></div>`;
    }
    const label = c.kind === 'pic' ? it.name.young : nameFor(it, age);
    return `<div class="mg-face mg-pic" style="--mg:${it.col};--mgt:${it.tint}"><div class="mg-art">${art(it)}</div><b>${esc(label)}</b></div>`;
  }
  // גב הקלף: יצורון מציץ ושם המשחק
  // גב הקלף: הלוגו של Begood וקבוצת יצורונים (21/10/2026: "שלב את הלוגו של בי גוד. לב הוא לא סימן מתאים - עדיף כמה יצורים")
  const LOGO = 'assets/begood-logo-sm.webp';
  const BACK_ART = `<svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true"><rect x="44" y="6" width="112" height="78" rx="18" fill="#fff"/><image href="${LOGO}" x="49" y="9" width="102" height="70" preserveAspectRatio="xMidYMid meet"/>` +
    cr(22, 154, .4, 'coral', { arms: { l: 'down', r: 'wave' }, eyes: 'happy' }) + cr(178, 154, .4, 'lilac', { arms: { l: 'wave', r: 'down' }, eyes: 'happy' }) +
    cr(60, 148, .48, 'sun', { arms: { l: 'down', r: 'wave' }, eyes: 'happy' }) + cr(140, 148, .48, 'green', { arms: { l: 'wave', r: 'down' }, eyes: 'happy', tuft: true }) +
    cr(100, 140, .56, 'teal', { arms: { l: 'wave', r: 'wave' }, mouth: 'open' }) + `</svg>`;

  const RULES = {
    title: 'זיכרון חוסן',
    ready: ['בוחרים כמה זוגות: לגן אפשר להתחיל ב־6 עד 10 זוגות, ולהוסיף כשמכירים את הקלפים.', 'מערבבים ומניחים את הקלפים הפוכים, בשורות.'],
    play: ['בתור, הופכים שני קלפים.', 'זוגות זהים: אותו איור ואותה מילה. מושג ומצב: קלף מושג עם איור, וקלף מצב שמתאים לו.', 'מי שמוצא/ת זוג לוקח/ת אותו וממשיכ/ה לשחק. אם זה לא זוג, הופכים בחזרה והתור עובר.', 'המשחק נגמר כשכל הזוגות נמצאו.'],
    moment: 'כשנמצא זוג, מי שמצא/ה קורא/ת את הקלפים בקול, ומי שרוצה מספר/ת: איפה ראינו את זה אצלנו? אפשר גם לוותר ולהמשיך לשחק.',
    coop: 'משחק שיתופי: כל הקבוצה משחקת יחד ומנסה למצוא את כל הזוגות בכמה שפחות תורות. בפעם הבאה מנסים לשפר.',
    closing: ['איזה קלף הזכיר לך משהו שקרה אצלנו?', 'איזה זוג היינו רוצים לראות אצלנו יותר? מה צעד קטן אחד שאפשר לעשות השבוע?'],
    closingWho: 'בסוף המשחק המנחה שואל/ת את הקבוצה, כדי לקשר בין הקלפים לחיים בכיתה, בצוות או בבית:'
  };

  return { AGES, SETS, ITEMS, RULES, ART, art, face, deck, shuffle, nameFor, BACK_ART, esc };
});
