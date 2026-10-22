// מחולל סיפורי חוסן (22/10/2026): "הילדים מאפיינים דמויות ונותנים ל AI נושא וכמה תפניות בעלילה ומקבלים סיפור.
// כך הם יכולים ליצור את סיפורי החוסן שלהם. הסיפור ילווה באיור ויופק על PDF עם לוגו והקדשה לילד.ה שיצר.ה את הסיפור."
// מקור אמת: הבחירות, הפרומפט, בדיקת התשובה והאיורים (יצורונים מ-memory-game.js בתוך תפאורה).
(function (root, factory) {
  const api = factory(root.SBE_MEMORY || (typeof require === 'function' ? require('./memory-game.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SBE_STORY = api;
})(typeof self !== 'undefined' ? self : this, function (MG) {
  const cr = MG.creature;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- הבחירות ----------
  const COLORS = [['teal', 'טורקיז'], ['coral', 'אלמוג'], ['sun', 'צהוב'], ['lilac', 'סגול'], ['green', 'ירוק'], ['navy', 'כחול'], ['pink', 'ורוד']];
  const BODIES = [['round', 'עגול'], ['tall', 'גבוה'], ['square', 'מרובע'], ['pear', 'אגס'], ['wide', 'רחב'], ['star', 'כוכב']];
  const EXTRAS = [['', 'בלי'], ['bunny', 'אוזני ארנב'], ['cat', 'אוזני חתול'], ['antenna', 'אנטנות'], ['horn', 'קרן'], ['bow', 'פפיון'], ['tuft', 'ציצת עלים'], ['spots', 'נקודות']];
  const GENDERS = [['f', 'היא'], ['m', 'הוא']];
  const TRAITS = ['אמיץ/ה', 'סקרן/ית', 'מצחיק/ה', 'ביישן/ית', 'אוהב/ת לעזור', 'יצירתי/ת', 'שקט/ה', 'מלא/ת אנרגיה', 'חכם/ה', 'רגיש/ה', 'ממציא/ה', 'טוב/ת לב'];
  const THEMES = ['חבר/ה חדש/ה מגיע/ה לכיתה', 'ריב בין חברים, ואיך משלימים', 'הפסקת חשמל בלילה', 'מעבר לבית חדש', 'טיול שלא הלך כמו שתכננו', 'עוזרים לשכן/ה', 'מישהו נשאר לבד בהפסקה', 'סערה גדולה בעיר', 'מחכים למישהו שאנחנו מתגעגעים אליו', 'מכינים יחד מסיבה לכיתה', 'משהו חשוב נשבר', 'קבוצה שמחליטה יחד על משהו חשוב'];
  const PLACES = [['forest', 'יער'], ['school', 'בית ספר'], ['home', 'בבית'], ['street', 'השכונה'], ['park', 'גן שעשועים'], ['beach', 'חוף הים'], ['mountains', 'הרים'], ['camp', 'מחנה בלילה']];
  const MOODS = ['sunny', 'cloudy', 'rain', 'storm', 'night', 'evening', 'snow'];
  const POSES = ['happy', 'wave', 'sad', 'surprised', 'thinking', 'scared', 'hug', 'calm'];
  const PROPS = ['none', 'map', 'flashlight', 'umbrella', 'gift', 'ball', 'book', 'balloon', 'lantern'];
  const TWISTS = ['ואז פתאום כבה האור', 'ואז התחיל גשם חזק', 'ואז מישהו הלך לאיבוד', 'ואז מצאו מפה ישנה', 'ואז הגיעה הודעה מפתיעה', 'ואז משהו נשבר', 'ואז הגיע/ה מישהו/י חדש/ה', 'ואז הדרך נחסמה'];
  const ENDINGS = [['party', 'חוגגים יחד'], ['learn', 'לומדים משהו חדש על עצמנו'], ['new', 'מוצאים דרך חדשה'], ['surprise', 'סוף מפתיע'], ['open', 'סוף פתוח, שממשיכים לדמיין']];
  const AGES = [['k2', 'גן עד ב׳', 5, '35 עד 55'], ['g34', 'ג׳ עד ד׳', 6, '60 עד 85'], ['g56', 'ה׳ עד ו׳', 7, '90 עד 120'], ['teen', 'ז׳ ומעלה', 7, '120 עד 160']];

  // ---------- הפרומפט ----------
  function system(ageId) {
    const a = AGES.find((x) => x[0] === ageId) || AGES[1];
    return `את סופרת ילדים ישראלית. ילד או ילדה בגיל ${a[1]} יצרו דמויות, בחרו נושא ותפניות בעלילה, ואת כותבת מהם סיפור חוסן מלא ומרגש, בעברית חיה, טבעית ופשוטה לגיל.

מה זה סיפור חוסן כאן: הדמויות פוגשות קושי, מרגישות (ואומרות מה הן מרגישות, במילים פשוטות), ומתמודדות יחד: מקשיבות זו לזו, מבקשות עזרה ומציעות עזרה, בוחרות יחד מה לעשות, מתכננות צעד קטן ומנסות, ומרגישות שייכות. מבוגר/ת מוכר/ת (הורה, מורה, סבתא, שכנה) יכול/ה להיות בסיפור ולעזור. בסוף יש תקווה וגאווה במה שעשו יחד.

הכללים:
- הדמויות הן בדיוק מה שהילד/ה יצר/ה: אותם שמות, אותו מין דקדוקי (לפי "היא" או "הוא"), אותן תכונות. כל דמות עושה משהו חשוב בסיפור, ולפחות פעם אחת התכונה שלה עוזרת.
- הנושא הוא לב הסיפור, והתפניות מגיעות לפי הסדר, כל אחת כנקודת מפנה ברורה.
- הסוף לפי מה שנבחר.
- ${a[2]} עמודים, ${a[3]} מילים בכל עמוד. משפטים קצרים, דיאלוג חי במרכאות רגילות, הומור עדין, ותיאורים שקל לדמיין.
- בלי אלימות, בלי פחד מתמשך ובלי סכנה ממשית לחיים. קושי אמיתי, אבל כזה שילדים מכירים.
- בלי מוסר השכל מפורש ובלי הטפה. מה שנלמד מתגלה מתוך מה שהדמויות עושות.
- בלי סימני עיצוב (בלי כוכביות ובלי #), ובלי מקף ארוך.

לכל עמוד בחרי גם איור: המקום (place), מזג האוויר והשעה (mood), מי מהדמויות בתמונה (cast, לפי המספר שלהן ברשימה, עם תנוחה pose), וחפץ אחד אם מתאים (prop).
- place: ${PLACES.map((p) => p[0]).join(' | ')}
- mood: ${MOODS.join(' | ')}
- pose: happy (שמחה) | wave (מנופפת) | sad (עצובה) | surprised (מופתעת) | thinking (חושבת) | scared (מבוהלת) | hug (מחבקת או מושיטה יד) | calm (רגועה)
- prop: ${PROPS.join(' | ')}

בסוף: "resilience": משפט אחד פשוט לילדים, מה עזר לדמויות להתמודד. ו-"questions": שלוש שאלות קצרות לשיחה אחרי הקריאה, שמבוגר/ת שואל/ת את הילד/ה, פתוחות ואישיות ("מה היית עושה...", "מתי גם לך...", "מי עוזר/ת לך כש...").

החזירי רק JSON, בלי שום טקסט אחר:
{"title":"...","pages":[{"text":"...","place":"...","mood":"...","cast":[{"who":0,"pose":"..."}],"prop":"..."}],"resilience":"...","questions":["...","...","..."]}`;
  }
  function input(f) {
    const chars = (f.chars || []).map((c, i) => `${i}. ${c.name || 'בלי שם'} (${c.g === 'm' ? 'הוא' : 'היא'}): ${[].concat(c.traits || []).join(', ')}${c.more ? '. ' + c.more : ''}${c.likes ? '. אוהב/ת: ' + c.likes : ''}`).join('\n');
    const place = (PLACES.find((p) => p[0] === f.place) || [])[1];
    const end = (ENDINGS.find((e) => e[0] === f.ending) || [])[1];
    return `הדמויות:\n${chars}\n\nהנושא: ${f.theme || ''}${place ? '\nאיפה הסיפור מתחיל: ' + place : ''}\n\nהתפניות בעלילה, לפי הסדר:\n${(f.twists || []).filter((t) => t && t.trim()).map((t, i) => (i + 1) + '. ' + t).join('\n') || 'אפשר לבחור תפנית אחת מתאימה'}\n\nאיך הסיפור נגמר: ${end || 'סוף טוב שבו כולם גאים'}${f.extra ? '\n\nעוד משהו מהילד/ה: ' + f.extra : ''}`;
  }
  function normalize(v, f) {
    const n = (f.chars || []).length;
    const pick = (x, list, d) => (list.includes(x) ? x : d);
    const pages = (Array.isArray(v && v.pages) ? v.pages : []).filter((p) => p && typeof p.text === 'string' && p.text.trim()).map((p, k) => ({
      text: p.text.trim(),
      place: pick(p.place, PLACES.map((x) => x[0]), f.place || 'park'),
      mood: pick(p.mood, MOODS, 'sunny'),
      cast: (Array.isArray(p.cast) ? p.cast : []).filter((c) => c && Number.isInteger(+c.who) && +c.who >= 0 && +c.who < n).slice(0, 4).map((c) => ({ who: +c.who, pose: pick(c.pose, POSES, 'happy') })),
      prop: pick(p.prop, PROPS, 'none')
    }));
    pages.forEach((p) => { if (!p.cast.length) p.cast = Array.from({ length: Math.min(n, 3) }, (_, i) => ({ who: i, pose: 'happy' })); });
    return { title: String((v && v.title) || 'הסיפור שלי').trim(), pages, resilience: String((v && v.resilience) || '').trim(), questions: (Array.isArray(v && v.questions) ? v.questions : []).filter((q) => typeof q === 'string' && q.trim()).slice(0, 4) };
  }
  const valid = (v) => !!(v && Array.isArray(v.pages) && v.pages.filter((p) => p && typeof p.text === 'string' && p.text.trim().length > 20).length >= 3 && v.title);

  // ---------- איור: תפאורה + יצורונים ----------
  const W = 400, H = 260, GY = 214;
  const SKY = { sunny: ['#BFE6F5', '#F3FAF6'], cloudy: ['#C9D6E0', '#EEF2F4'], rain: ['#9FB3C4', '#D8E2E8'], storm: ['#5C6E84', '#9EAFBE'], night: ['#1E3352', '#3D5A80'], evening: ['#F6A97A', '#FCE3B6'], snow: ['#D4E2EE', '#F5F8FB'] };
  const tree = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="-4" width="6" height="22" rx="3" fill="#8C6B4A"/><ellipse cx="0" cy="-18" rx="18" ry="22" fill="${c || '#3A9E6B'}"/><ellipse cx="6" cy="-24" rx="8" ry="10" fill="#fff" opacity=".18"/></g>`;
  const pine = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2.5" y="0" width="5" height="12" fill="#8C6B4A"/><path d="M0 -40L17 4H-17Z" fill="${c || '#2E8A63'}"/></g>`;
  const house = (x, y, s, roof, wall) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-20" y="-28" width="40" height="28" fill="${wall || '#FFFDF7'}"/><path d="M-25 -27L0 -46L25 -27Z" fill="${roof}"/><rect x="-5" y="-14" width="10" height="14" fill="#FFC929"/><rect x="8" y="-22" width="8" height="8" fill="#BFE6F0"/><rect x="-16" y="-22" width="8" height="8" fill="#BFE6F0"/></g>`;
  const BACK = {
    forest: (n) => `<path d="M0 ${GY - 30}C80 ${GY - 60} 160 ${GY - 40} 240 ${GY - 56}S360 ${GY - 40} 400 ${GY - 50}V${H}H0Z" fill="${n ? '#2C5B4A' : '#8ED1A4'}"/>${[[30, 1.1], [70, .9], [340, 1.2], [376, .9], [300, .8]].map(([x, s], i) => (i % 2 ? pine(x, GY - 8, s, n ? '#1F4A3A' : '#2E8A63') : tree(x, GY - 6, s, n ? '#2B5D46' : '#3A9E6B'))).join('')}<path d="M150 ${H}C170 ${GY + 10} 230 ${GY + 10} 250 ${H}" fill="${n ? '#6B5A45' : '#E9CF9A'}"/>`,
    school: (n) => `<rect x="120" y="${GY - 110}" width="160" height="110" fill="${n ? '#8090A6' : '#FFF4E0'}"/><path d="M110 ${GY - 108}L200 ${GY - 150}L290 ${GY - 108}Z" fill="#E0603F"/><path d="M200 ${GY - 150}v-24" stroke="#1B4F7A" stroke-width="3"/><path d="M200 ${GY - 174}l18 6l-18 6z" fill="#1A9BB5"/>${[140, 175, 210, 245].map((x) => `<rect x="${x}" y="${GY - 90}" width="22" height="20" fill="#BFE6F0"/>`).join('')}<rect x="186" y="${GY - 48}" width="28" height="48" fill="#1A9BB5"/><text x="200" y="${GY - 115}" text-anchor="middle" font-family="Assistant,Arial" font-weight="800" font-size="13" fill="#1B4F7A">בית הספר</text>${tree(60, GY - 4, 1.1)}${tree(350, GY - 4, 1)}<rect x="0" y="${GY}" width="400" height="${H - GY}" fill="${n ? '#4C5E58' : '#C9E7D1'}"/>`,
    home: (n) => `<rect width="400" height="${GY}" fill="${n ? '#3D4D66' : '#FDF0DC'}"/><rect x="236" y="40" width="110" height="90" rx="4" fill="${n ? '#1E3352' : '#BFE6F5'}" stroke="#B07A4A" stroke-width="6"/><path d="M291 40v90M236 85h110" stroke="#B07A4A" stroke-width="4"/><path d="M226 34h130" stroke="#8C6B4A" stroke-width="5"/><path d="M228 36c10 40 0 70 8 100" fill="none" stroke="#E0603F" stroke-width="10"/><path d="M354 36c-10 40 0 70-8 100" fill="none" stroke="#E0603F" stroke-width="10"/><rect x="34" y="${GY - 60}" width="130" height="44" rx="12" fill="#1A9BB5"/><rect x="26" y="${GY - 74}" width="22" height="58" rx="10" fill="#14879E"/><rect x="150" y="${GY - 74}" width="22" height="58" rx="10" fill="#14879E"/><path d="M60 40v40" stroke="#5D4A36" stroke-width="2"/><path d="M44 80h32l-6 -20h-20z" fill="#FFC929"/><rect y="${GY}" width="400" height="${H - GY}" fill="${n ? '#5D4A36' : '#D9B98A'}"/><ellipse cx="200" cy="${GY + 22}" rx="140" ry="14" fill="#F06A7A" opacity=".55"/>`,
    street: (n) => `${house(50, GY - 6, 1.4, '#E0603F')}${house(130, GY - 6, 1.2, '#1A9BB5')}${house(290, GY - 6, 1.3, '#FFC929')}${house(360, GY - 6, 1.1, '#3A9E6B')}<rect x="206" y="${GY - 120}" width="5" height="114" fill="#5D7186"/><path d="M208 ${GY - 120}q14 -6 22 4" fill="none" stroke="#5D7186" stroke-width="4"/><circle cx="230" cy="${GY - 112}" r="7" fill="${n ? '#FFE07A' : '#E8EEF2'}"/><rect y="${GY - 6}" width="400" height="14" fill="#CBD5DC"/><rect y="${GY + 8}" width="400" height="${H - GY}" fill="${n ? '#3E4A5C' : '#8F9CA8'}"/><path d="M0 ${GY + 28}h400" stroke="#fff" stroke-width="3" stroke-dasharray="20 16"/>`,
    park: (n) => `<rect y="${GY}" width="400" height="${H - GY}" fill="${n ? '#2C5B4A' : '#9BD9B1'}"/><path d="M0 ${GY}C120 ${GY - 30} 280 ${GY - 30} 400 ${GY}" fill="${n ? '#2C5B4A' : '#9BD9B1'}"/>${tree(40, GY - 6, 1.3)}${tree(370, GY - 6, 1.1, '#4FB27C')}<path d="M300 ${GY}l20 -70h14v70" fill="none" stroke="#E0603F" stroke-width="5"/><path d="M334 ${GY - 70}c20 20 26 50 30 70" fill="none" stroke="#FFC929" stroke-width="8"/><path d="M90 ${GY}v-60h70v60" fill="none" stroke="#1B4F7A" stroke-width="5"/><path d="M106 ${GY - 60}v38M144 ${GY - 60}v38" stroke="#5D4A36" stroke-width="2"/><rect x="100" y="${GY - 24}" width="50" height="6" rx="3" fill="#1A9BB5"/>`,
    beach: (n) => `<rect y="${GY - 60}" width="400" height="60" fill="${n ? '#24496B' : '#5BB8E0'}"/><path d="M0 ${GY - 50}q20 -6 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/><rect y="${GY}" width="400" height="${H - GY}" fill="${n ? '#8C7A5A' : '#F3DFAE'}"/><path d="M0 ${GY}q100 -12 200 0t200 0V${GY + 6}H0Z" fill="${n ? '#8C7A5A' : '#F3DFAE'}"/><path d="M330 ${GY + 10}V${GY - 60}" stroke="#5D4A36" stroke-width="4"/><path d="M290 ${GY - 58}Q330 ${GY - 96} 370 ${GY - 58}Z" fill="#E0603F"/><path d="M310 ${GY - 58}Q330 ${GY - 96} 350 ${GY - 58}" fill="#FFC929"/>`,
    mountains: (n) => `<path d="M0 ${GY - 40}L70 ${GY - 140}L130 ${GY - 70}L210 ${GY - 170}L290 ${GY - 80}L350 ${GY - 130}L400 ${GY - 70}V${H}H0Z" fill="${n ? '#3E5470' : '#A9C2DA'}"/><path d="M210 ${GY - 170}l-20 34l12 -6l8 10l8 -10l12 6z M70 ${GY - 140}l-14 24l9 -4l5 7l6 -7l8 4z" fill="#fff"/><path d="M0 ${GY - 10}C120 ${GY - 50} 260 ${GY - 30} 400 ${GY - 40}V${H}H0Z" fill="${n ? '#2C5B4A' : '#8ED1A4'}"/>${pine(40, GY - 4, 1)}${pine(360, GY - 6, 1.2)}`,
    camp: () => `<path d="M0 ${GY - 10}C120 ${GY - 30} 260 ${GY - 20} 400 ${GY - 30}V${H}H0Z" fill="#2C5B4A"/>${pine(30, GY - 4, 1.2, '#1F4A3A')}${pine(370, GY - 4, 1.3, '#1F4A3A')}<path d="M280 ${GY + 6}L320 ${GY - 60}L360 ${GY + 6}Z" fill="#FFC929"/><path d="M320 ${GY - 60}L330 ${GY + 6}H310Z" fill="#7A4E12"/><g transform="translate(200 ${GY + 18})"><circle r="40" fill="#FFC929" opacity=".2"/><path d="M-14 8l14-8l14 8z" fill="#8C6B4A"/><path d="M0 4c-12-10-6-20 0-32c4 12 16 16 0 32z" fill="#FF8F70"/><path d="M0 4c-6-6-3-12 0-18c3 6 8 10 0 18z" fill="#FFC929"/></g>`
  };
  function weather(m) {
    if (m === 'sunny') return `<g transform="translate(60 44)"><circle r="20" fill="#FFC929"/>${Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return `<path d="M${(Math.cos(a) * 26).toFixed(1)} ${(Math.sin(a) * 26).toFixed(1)}L${(Math.cos(a) * 34).toFixed(1)} ${(Math.sin(a) * 34).toFixed(1)}" stroke="#FFC929" stroke-width="3" stroke-linecap="round"/>`; }).join('')}</g>`;
    const cloud = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><ellipse rx="34" ry="13"/><circle cx="-10" cy="-8" r="14"/><circle cx="12" cy="-10" r="17"/></g>`;
    if (m === 'cloudy') return cloud(90, 40, 1, '#fff') + cloud(300, 54, .8, '#fff');
    if (m === 'rain' || m === 'storm') {
      const c = m === 'storm' ? '#6F8196' : '#B9C6D1';
      let r = cloud(110, 34, 1.3, c) + cloud(290, 40, 1.1, c);
      for (let i = 0; i < 26; i++) { const x = (i * 53) % 400, y = 70 + ((i * 37) % 140); r += `<path d="M${x} ${y}l-4 10" stroke="#7CC8EE" stroke-width="2" stroke-linecap="round" opacity=".8"/>`; }
      if (m === 'storm') r += `<path d="M290 52l-14 26h12l-8 22l24 -32h-12l8 -16z" fill="#FFD34F"/>`;
      return r;
    }
    if (m === 'night') { let r = `<path d="M340 30a20 20 0 1 0 14 34a15 15 0 1 1 -14 -34z" fill="#FFE07A"/>`; for (let i = 0; i < 16; i++) r += `<circle cx="${(i * 97) % 380 + 10}" cy="${(i * 41) % 110 + 10}" r="${1 + (i % 3) * .6}" fill="#fff"/>`; return r; }
    if (m === 'evening') return `<circle cx="320" cy="${GY - 70}" r="34" fill="#FF8F70" opacity=".8"/>` + cloud(110, 50, .9, '#FCE3B6');
    if (m === 'snow') { let r = cloud(120, 36, 1.1, '#fff') + cloud(300, 44, 1, '#fff'); for (let i = 0; i < 30; i++) r += `<circle cx="${(i * 61) % 400}" cy="${60 + ((i * 29) % 170)}" r="2.4" fill="#fff"/>`; return r; }
    return '';
  }
  const POSE = {
    happy: { arms: { l: 'up', r: 'up' }, eyes: 'happy', mouth: 'open' },
    wave: { arms: { l: 'down', r: 'wave' }, eyes: 'happy' },
    sad: { arms: { l: 'down', r: 'down' }, mouth: 'sad', tear: true, look: [0, 2] },
    surprised: { arms: { l: 'out', r: 'out' }, mouth: 'o' },
    thinking: { arms: { l: 'down', r: 'cup' }, look: [3, -3] },
    scared: { arms: { l: 'up', r: 'up' }, mouth: 'o', look: [-2, 0] },
    hug: { arms: { l: ['hug', 46], r: ['hug', 46] }, eyes: 'happy' },
    calm: { arms: { l: 'down', r: 'down' }, eyes: 'closed' }
  };
  function charOpts(c, pose) {
    const o = Object.assign({ body: c.body || 'round' }, POSE[pose] || POSE.happy);
    if (c.extra === 'bunny' || c.extra === 'cat') o.ears = c.extra; else if (c.extra) o[c.extra] = true;
    return o;
  }
  function character(c, x, y, s, pose, flip) { return cr(x, y, s, c.color || 'teal', Object.assign(charOpts(c, pose), flip ? { flip: true } : {})); }
  const PROP = {
    map: (x, y) => `<g transform="translate(${x} ${y}) rotate(-8)"><path d="M-16 -12l10 3l12 -3l10 3v24l-10 -3l-12 3l-10 -3z" fill="#F3DFAE" stroke="#8C6B4A" stroke-width="1.6"/><path d="M-10 4q6 -10 14 -2t12 -6" fill="none" stroke="#E0603F" stroke-width="2" stroke-dasharray="3 3"/></g>`,
    flashlight: (x, y) => `<g transform="translate(${x} ${y})"><path d="M10 -6L70 -30V30Z" fill="#FFE07A" opacity=".45"/><rect x="-10" y="-6" width="22" height="12" rx="3" fill="#1A9BB5"/></g>`,
    umbrella: (x, y) => `<g transform="translate(${x} ${y - 30})"><path d="M-30 0Q0 -34 30 0Z" fill="#E0603F"/><path d="M-10 0Q0 -34 10 0" fill="#FFC929"/><path d="M0 0v30q0 6 -6 6" fill="none" stroke="#5D4A36" stroke-width="3"/></g>`,
    gift: (x, y) => `<g transform="translate(${x} ${y})"><rect x="-12" y="-10" width="24" height="20" fill="#F06A9B"/><rect x="-14" y="-14" width="28" height="6" fill="#F48FB5"/><rect x="-2.5" y="-14" width="5" height="24" fill="#FFC929"/></g>`,
    ball: (x, y) => `<g transform="translate(${x} ${y + 18})"><circle r="11" fill="#fff" stroke="#1F2A36" stroke-width="1.6"/><path d="M0 -5l5 3l-2 6h-6l-2 -6z" fill="#1F2A36"/></g>`,
    book: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-16 -10q8 -4 16 0q8 -4 16 0v20q-8 -4 -16 0q-8 -4 -16 0z" fill="#fff" stroke="#1B4F7A" stroke-width="2"/><path d="M0 -10v20" stroke="#1B4F7A" stroke-width="2"/></g>`,
    balloon: (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 0q-4 -20 2 -44" fill="none" stroke="#5D7186" stroke-width="1.4"/><ellipse cx="2" cy="-58" rx="13" ry="16" fill="#FF8F70"/></g>`,
    lantern: (x, y) => `<g transform="translate(${x} ${y})"><circle r="26" fill="#FFE07A" opacity=".3"/><rect x="-8" y="-12" width="16" height="22" rx="3" fill="#FFC929" stroke="#8C6B4A" stroke-width="2"/><path d="M-5 -16h10" stroke="#8C6B4A" stroke-width="3"/></g>`
  };
  let uid = 0;
  function scene(page, chars, opt) {
    const o = opt || {};
    const m = page.mood || 'sunny', [s1, s2] = SKY[m] || SKY.sunny, dark = m === 'night' || page.place === 'camp' && m !== 'sunny';
    const id = 'sk' + (++uid);
    const back = (BACK[page.place] || BACK.park)(dark);
    const ground = page.place === 'home' || page.place === 'school' || page.place === 'street' || page.place === 'beach' || page.place === 'park' ? '' : `<rect y="${GY + 10}" width="400" height="${H - GY}" fill="${dark ? '#24493B' : '#7FC79A'}"/>`;
    const cast = (page.cast && page.cast.length ? page.cast : chars.map((_, i) => ({ who: i, pose: 'happy' }))).filter((c) => chars[c.who]);
    const n = cast.length, gap = Math.min(110, 300 / Math.max(n, 1)), x0 = 200 - gap * (n - 1) / 2, sc = n > 3 ? .64 : n > 2 ? .74 : .86;
    let figs = '';
    cast.forEach((c, i) => { const x = x0 + i * gap, y = GY + 4 - (i % 2) * 6; figs += `<ellipse cx="${x}" cy="${y + 30 * sc}" rx="${30 * sc}" ry="${7 * sc}" fill="#1F2A36" opacity=".15"/>` + character(chars[c.who], x, y, sc, c.pose, i >= n / 2 && n > 1); });
    const p0 = cast.length ? x0 + 38 : 200;
    const prop = page.prop && PROP[page.prop] ? PROP[page.prop](p0, GY - 10) : '';
    const indoor = page.place === 'home';
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.label || 'איור לסיפור')}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#${id})"/>${indoor ? '' : weather(m)}${back}${ground}${indoor && (m === 'storm' || m === 'rain' || m === 'night') ? `<rect x="236" y="40" width="110" height="90" fill="#1E3352" opacity=".5"/>` : ''}${figs}${prop}</svg>`;
  }
  // תמונת שער: כל הדמויות שמחות במקום הראשון
  function cover(story, chars, place) { return scene({ place: (story.pages[0] && story.pages[0].place) || place || 'park', mood: 'sunny', cast: chars.map((_, i) => ({ who: i, pose: i % 2 ? 'wave' : 'happy' })), prop: 'none' }, chars, { label: 'הדמויות של הסיפור' }); }
  function portrait(c, pose) { return `<svg viewBox="-60 -80 120 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${character(c, 0, 0, 1, pose || 'wave')}</svg>`; }

  // הקדשה לילד/ה שיצר/ה את הסיפור
  function dedication(a) {
    const name = (a.name || '').trim();
    const f = a.g !== 'm';
    if (!name) return { head: 'הסיפור הזה נוצר בדמיון שלך', line: 'כל מילה בו התחילה ברעיון שלך.' };
    return { head: `ל${name}, ${f ? 'שיצרה' : 'שיצר'} את הסיפור הזה`, line: 'מהדמויות, מהנושא ומהתפניות שבחרת. איזה דמיון, ואיזו דרך להתמודד יחד!' };
  }

  return { COLORS, BODIES, EXTRAS, GENDERS, TRAITS, THEMES, PLACES, MOODS, POSES, PROPS, TWISTS, ENDINGS, AGES, system, input, normalize, valid, scene, cover, portrait, character, dedication, esc };
});
