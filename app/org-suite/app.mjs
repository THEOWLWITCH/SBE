const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stages = [
  ['see','לראות','איפה אנחנו היום?'],['practice','להתאמן','מוכנים לרגע המאתגר?'],
  ['act','לתכנן ולפעול','מה עושים מחר בבוקר?'],['learn','ללמוד מהעשייה','מה למדנו?'],
  ['anchor','לעגן בשגרה','מה ימשיך לפעול גם כשמשהו משתבש?']
];
const statusNames = {draft:'בהכנה',running:'בתרגול',paused:'בהפסקה',debrief:'בתחקיר',closed:'נעול'};
const kindNames = {training:'מפגש תרגול',pilot:'הפעלה בצוות לאורך זמן'};
const drafts = new Map();
const draftKey = form => `${session?.id}:${active?.role}:${active?.coderId || 'facilitator'}:${form.dataset.id}`;
function rememberDraft(form) { drafts.set(draftKey(form), Object.fromEntries([...form.elements].filter(e=>e.name).map(e=>[e.name,e.type==='checkbox'?e.checked:e.value]))); }
function restoreDrafts() { document.querySelectorAll('[data-form="observation"]').forEach(form=>{ const values=drafts.get(draftKey(form)); if(!values)return; for(const [name,value] of Object.entries(values)){const e=form.elements[name];if(e){if(e.type==='checkbox')e.checked=value;else e.value=value;}}form.elements.score.disabled=session.status==='closed'||form.elements.deliveryStatus.value!=='DEL'||form.elements.observationStatus.value!=='OBS';}); }
let catalog, siteMap, session = null, active = null, entries = [], route = 'overview', toastTimer;
// Begood (28/10/2026): השרת של Begood במקום השרת המקומי. המנחה מזוהה לפי הקוד שנכנס/ה איתו; צופים לפי מפתח המפגש.
const SERVER = (typeof window.sbeAIOrigin === 'function' && window.sbeAIOrigin()) || 'https://sbe-server.onrender.com';
const ss = k => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
const TOKEN = ss('sbe.session.token');
const IS_SYS = ss('sbe.session.homeUrl') === 'admin.html?role=sys';
let PERMS = []; try { PERMS = JSON.parse(ss('sbe.session.perms') || '[]') || []; } catch {}
const CAN_LEAD = !!TOKEN && (IS_SYS || PERMS.includes('orgsuite'));
const ENTRY_KEY = (window.sbeUserKey && TOKEN) ? window.sbeUserKey('sbe.ors.sessions') : 'sbe.ors.sessions';
const JOIN_PARAM = (location.search.match(/[?&]join=(\d{6})(?:&|$)/) || [])[1] || '';
try { entries = JSON.parse(localStorage.getItem(ENTRY_KEY) || '[]'); if (!Array.isArray(entries)) entries = []; } catch {}
function saveEntries() { try { localStorage.setItem(ENTRY_KEY, JSON.stringify(entries.filter(e => e.role === 'observer' || CAN_LEAD))); } catch { toast('המפגש פועל, אבל הדפדפן חסם שמירת קיצורי דרך. כדאי לשמור את הייצוא לפני יציאה.'); } }
const joinLink = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}org-suite.html?join=${session?.joinCode || ''}`;
function loadQR(cb) { if (window.QRCode) return cb(); const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; sc.onload = cb; sc.onerror = cb; document.head.appendChild(sc); }
document.body.classList.toggle('guest', !CAN_LEAD);
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4800); }
// 30/10/2026: השרת ב-Render נרדם; ניסיון חוזר עם המתנה. תשובה "unknown action" = השרת עוד לא עודכן.
async function api(path, body, method = 'POST', tries = 4) {
  let response;
  for (let i = 0; ; i++) {
    try {
      response = await fetch(`${SERVER}/api/access`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'orsCall', path, method, input:body || undefined, token:TOKEN || undefined, key:active?.role === 'observer' ? active.token : undefined})});
      if (response.status < 500 || i >= tries - 1) break;
    } catch (e) { if (i >= tries - 1) throw new Error('השרת לא עונה כרגע. אפשר לנסות שוב בעוד דקה.'); }
    if ($('app') && !session) $('app').innerHTML = '<div class="empty"><h2>מתחברים לשרת…</h2><p>החיבור הראשון ביום נמשך עד כדקה.</p></div>';
    await new Promise(r => setTimeout(r, 8000));
  }
  const data = await response.json().catch(() => ({error:'לא התקבלה תשובה תקינה מהשרת'}));
  if (/unknown action/i.test(data.error || '')) throw new Error('השרת עוד לא עודכן לכלי הזה. אחרי עדכון השרת הכלי יעבוד.');
  if (!response.ok) throw new Error(data.error || 'הפעולה לא הושלמה');
  return data;
}
async function loadCatalog() {
  try { return await api('/catalog', null, 'GET'); }
  catch (e) {
    const [domains, scenarios] = await Promise.all(['domains','scenarios'].map(n => fetch(`org-suite/data/${n}.json`).then(r => r.json())));
    window.__orsServerErr = e.message;
    return {domains: domains.domains || domains, scenarios: scenarios.scenarios || scenarios};
  }
}
function setActive(entry) { active=entry;try{sessionStorage.setItem('bg-suite-active',JSON.stringify({id:entry.id,role:entry.role}));}catch{} }
const facilitator = () => active?.role === 'facilitator';
const scenario = () => catalog.scenarios.find(s => s.id === session?.scenarioId);
const badge = s => `<span class="badge ${esc(s.status)}">${esc(statusNames[s.status] || s.status)}</span>`;
const date = v => v ? new Date(v).toLocaleDateString('he-IL') : 'טרם נקבע';
const time = seconds => `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${Math.floor(seconds % 60).toString().padStart(2,'0')}`;
function elapsed() { const c = session?.clock; return c ? ((c.activeMs || 0) + (c.startedAt ? Date.now() - new Date(c.startedAt).getTime() : 0)) / 1000 : 0; }
const btn = (text, action, extra = '', cls = '') => `<button class="button ${cls}" data-action="${action}" ${extra}>${text}</button>`;
function heading(title, text, action = '') { return `<div class="page-heading"><div><h1>${title}</h1><p>${text}</p></div>${action}</div>`; }
function sessionBanner() {
  if (!session) return '';
  return `<div class="session-banner"><div><strong>${esc(session.title)}</strong><small>${esc(scenario()?.title)} · ${esc(kindNames[session.mode])}</small></div>${badge(session)}${facilitator() ? `<span class="tiny muted">קוד להצטרפות</span><b class="code">${esc(session.joinCode)}</b>` : `<span class="tiny muted">תצפית עצמאית · ${esc(active.coderId)}</span>`}<button class="text-button" data-action="refresh">רענון המפגש ↻</button></div>`;
}
function tabs() {
  return `<nav class="tabs" aria-label="מסכי המפגש">${[['practice','תדריך והנחיה'],['observe','דף תצפית'],['see','תמונת התחומים'],['learn','תחקיר ומשוב'],['act','פעולות המשך'],['anchor','מעקב ושגרה']].filter(([id]) => facilitator() || ['observe','practice'].includes(id)).map(([id,label]) => `<a href="#${id}" class="${route === id ? 'active' : ''}" ${route === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
}
function quickCards() {
  return `<div class="grid">
    <button class="card quick-card" data-action="new"><span class="quick-icon">↔</span><h3>מפגש, מההתחלה</h3><p>בוחרים תרחיש, מחלקים תפקידים ופותחים מרחב משותף להתנסות.</p><span>יצירת מפגש <b>←</b></span></button>
    <button class="card quick-card" data-action="join"><span class="quick-icon">⌕</span><h3>אני כאן לצפות</h3><p>מצטרפים עם קוד המפגש ומתעדים ראיות לפי שבעת התחומים.</p><span>הצטרפות לתצפית <b>←</b></span></button>
    <a class="card quick-card" href="org-library.html"><span class="quick-icon">↗</span><h3>מה אפשר ללמוד מזה?</h3><p>מחברים בין התרגול למקורות בספרייה משותפת לחינוך ולארגונים.</p><span>חיפוש בספרייה <b>←</b></span></a>
  </div>`;
}
function sessionList() {
  return entries.length ? `<div class="session-list">${entries.map(e => `<div class="session-row"><span class="quick-icon" style="margin:0">${e.role === 'facilitator' ? '↔' : '⌕'}</span><div><strong>${esc(e.title)}</strong><small>${e.role === 'facilitator' ? 'מנחה' : 'צופה'} · ${date(e.createdAt)}</small></div><span class="badge">${esc(statusNames[e.status] || 'נשמר')}</span><button class="button small secondary" data-action="open" data-id="${esc(e.id)}" data-role="${e.role}">פתיחת המפגש ←</button></div>`).join('')}</div>` : `<div class="empty"><h3>כאן תתחיל העבודה המשותפת</h3><p>מפגשים שתיצרו או תצטרפו אליהם יופיעו כאן. לא נוספו נתוני משתתפים לדוגמה.</p>${btn('יצירת המפגש הראשון ←','new','','secondary')}</div>`;
}
function overview() {
  return `<div class="crumb">המרחב הארגוני <span>/</span> המרחב שלי</div>
    <section class="hero"><div class="hero-copy"><h1 class="hero-banner"><img src="assets/teams-practice-banner.webp" alt="תרגול צוותים" width="1200" height="283"></h1><p>מוכנות מתחילה במה שעושים יחד. מרחב אחד לתרחישים, התנסות ולמידה משותפת.<br>מהרגע המאתגר, דרך התבוננות, אל פעולה שנשארת בשגרה.</p>${btn('מתחילים מפגש חדש <span>←</span>','new','','light')}</div><div class="hero-art" aria-hidden="true"><div class="ring"></div><div class="ring two"></div><div class="ring three"></div><span class="ring-center">be<br>together.</span><i class="orbit-dot"></i><span class="art-label">OBSERVE · PRACTICE · CONNECT</span></div></section>
    <div class="section-heading"><h2>מה תרצו לעשות היום?</h2><span>נקודת התחלה, לפי התפקיד שלכם</span></div>${quickCards()}
    <div class="section-heading"><h2>המפגשים שלי</h2><span>${entries.length} קיצורי דרך בדפדפן הזה</span></div>${sessionList()}
    <p class="section-footer">המפגשים נשמרים בשרת של Begood. המנחה פותח/ת אותם מכל מכשיר עם אותו קוד, וצופים וצופות חוזרים מהדפדפן שבו הצטרפו. תרחישי האימון והמחוונים הם הצעה של Begood שטרם תוקפה.</p>`;
}
function scenarioCards() {
  return `<div class="grid two">${catalog.scenarios.map((s,i) => `<article class="card"><span class="card-tag">מעבדה ותרגול · תרחיש ${i+1}</span><h2>${esc(s.title)}</h2><p>${esc(s.context)}</p><div class="card-meta"><span>${s.roles.length} יחידות תפקיד</span><span>${s.durationMinutes} דקות משימה</span><span>14 הזדמנויות</span></div><div class="card-tail"><button data-action="scenario" data-id="${esc(s.id)}">עיון בתדריך</button>${btn('פתיחת מפגש ←','new',`data-scenario="${esc(s.id)}"`,'small')}</div></article>`).join('')}</div>`;
}
function practice() {
  if (!session) return `${heading('מוכנים לרגע המאתגר?','תרחישי אימון לצוותים בוגרים. את המרחב להפעלה פותחים עם המנחה.',btn('הצטרפות לתצפית','join','','secondary'))}${scenarioCards()}${resourceStrip()}`;
  const s = scenario();
  if (!facilitator()) return `${heading('התדריך המשותף','מתבוננים בתהליך. לכל צופה נשמרות תצפיות עצמאיות.')}
    <div class="card"><span class="card-tag">${esc(statusNames[session.status])}</span><h2>${esc(s.title)}</h2><p>${esc(s.context)}</p>${btn('מעבר לדף התצפית ←','observe')}</div><div class="notice">דפי התפקיד והאירועים נמצאים אצל המנחה. מתעדים רק מה שנצפה, בלי להשלים מידע חסר. אפשר לרענן כדי לקבל אירועים שנמסרו.</div>`;
  const running = session.status === 'running', paused = session.status === 'paused', locked = session.status === 'closed';
  let controls = session.status === 'draft' ? btn('התחלת התרגול ←','transition','data-status="running"') : running ? btn('הפסקה נגישה Ⅱ','transition','data-status="paused"','secondary') : paused ? btn('המשך התרגול ▷','transition','data-status="running"') : '';
  if (running || paused) controls += btn('סיום ומעבר לתחקיר','transition','data-status="debrief"','secondary');
  if (session.status === 'debrief') controls += btn('נעילת המפגש','close','','secondary');
  return `${heading('חדר ההנחיה',esc(s.title),btn('ייצוא המפגש ↓','export','','secondary')+btn('מחיקה','delete','','secondary'))}
    <div class="session-layout"><div><div class="card"><span class="card-tag">לפני שמתחילים</span><p>${esc(s.context)}</p><div class="row"><span class="badge">${session.teamConfiguration === 'intact_work_teams' ? 'צוותי עבודה קיימים' : 'יחידות תפקיד זמניות'}</span><span class="badge">מקדם נגישות ×${session.accessFactor}</span></div><div class="notice">משתמשים בכרטיסי תפקיד בדויים; אפשר להשיב בדיבור או בכתב ולעצור בכל עת. בעת הפסקה כל הצוותים עוצרים, ולא מוסרים מידע חדש. אין הקלטה במערכת זו.</div></div>
    <div class="section-heading"><h2>כרטיסי התפקיד</h2><span>לחלוקה לפני התרגול</span></div><div class="grid">${s.roles.map(r => `<div class="role"><strong>${esc(r.title)}</strong><p>${esc(r.brief)}</p></div>`).join('')}</div>
    <div class="section-heading"><h2>כרטיסי מידע לאימון</h2><span>נוהלים בדויים לתרחיש בלבד</span></div><div class="grid two">${(s.sourceCards||[]).map(c=>`<article class="card"><span class="card-tag">כרטיס ${esc(c.id)} · ${esc(c.date)}</span><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></article>`).join('')}</div>
    <div class="section-heading"><h2>אירועים למסירה</h2><span>מסמנים רק לאחר מסירה נגישה ואישור קבלה</span></div><div class="timeline">${s.opportunities.map(o => { const d=session.delivered?.[o.id]; return `<article class="trigger ${d?'sent':''}"><div class="trigger-head"><span class="trigger-time">${time((o.minute||0)*60*session.accessFactor)}</span><strong>${esc(o.id)} · ${esc(domainLabel(o.domain))}</strong><span class="badge">${d?'נמסר':'מתוכנן'}</span></div><p>${esc(o.trigger)}</p><div class="row between"><span class="tiny muted">${d?`נמסר בזמן משימה ${time(d.activeMs/1000)}`:'הזמן הוא הצעה; התזמון בפועל מתועד בלחיצה.'}</span>${btn(d?'נמסר ✓':'נמסר ואושר','deliver',`data-id="${esc(o.id)}" ${d||!running?'disabled':''}`,'small secondary')}</div></article>`; }).join('')}</div></div>
    <aside class="session-side"><div class="card"><span class="tiny muted">זמן משימה פעיל</span><div class="clock" id="clock">${time(elapsed())}</div><p class="tiny">יעד: ${s.durationMinutes*session.accessFactor} דקות עם התאמות הגישה</p>${badge(session)}<div class="session-toolbar">${controls}</div></div><div class="card"><h3>הצטרפות לתצפית</h3><div class="code">${esc(session.joinCode)}</div><p>מכל טלפון או מחשב, בלי קוד Begood. הרשומות נפרדות לכל קוד צופה.</p><div class="join-share"><button class="button small secondary" data-action="copyjoin">העתקת קישור ההצטרפות</button><a class="button small secondary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('מצטרפים לתצפית במפגש: ' + joinLink())}">שליחה בוואטסאפ</a><button class="button small secondary" data-action="qr">הצגת QR</button></div><div class="join-qr" id="join-qr" hidden></div>${btn('פתיחת הצטרפות','join','','secondary small')}</div><div class="card roles-panel"><h3>תחקיר קצר</h3><p>מה ראינו? איזו ראיה תומכת בכך? מה ננסה אחרת בפעם הבאה?</p><p class="tiny">${locked?'המפגש נעול. התיעוד והייצוא זמינים לצפייה.':'התצפיות נשמרות כגרסאות; תיקון אינו מוחק את הקידוד המקורי.'}</p></div></aside></div>`;
}
function domainLabel(code) { return catalog.domains.find(d => d.code === code)?.label || code; }
function currentObservations() {
  const mine = facilitator() ? 'facilitator' : active?.coderId;
  const map = new Map();
  for (const o of session?.observations || []) if (o.coderId === mine) map.set(o.opportunityId,o);
  return map;
}
function observe() {
  if (!session) return `${heading('תצפית שמתחילה בראיה','מצטרפים למפגש עם קוד ומזהה צופה בדוי.')}${btn('הצטרפות עם קוד ←','join')}`;
  const obs = currentObservations(), s = scenario(), locked=session.status==='closed';
  return `${heading('דף תצפית','שתי הזדמנויות בכל תחום. שומרים כל תצפית בנפרד; ניתן לתקן עד הנעילה.')}
    <div class="notice">ציון ניתן רק לאירוע שנמסר ונצפה: 0 = לא הודגמה ההתנהגות, 1 = חלקית או מאוחרת, 2 = כל רכיבי העוגן הושלמו בזמן. מידע חסר או סירוב אתי נשארים ללא ציון. קידודים מקוריים נשמרים גם לאחר תיקון.</div>
    ${locked?'<div class="notice amber">המפגש נעול. ניתן לעיין בתיעוד, ואי אפשר לשנותו.</div>':''}
    ${s.opportunities.map(o => { const prev=obs.get(o.id), delivered=!!session.delivered?.[o.id]; const ds=prev?.deliveryStatus || (delivered?'DEL':'ND'), os=prev?.observationStatus || 'OBS'; return `<form class="card observation-card" data-form="observation" data-id="${esc(o.id)}"><h3><span>${esc(o.id)} · ${esc(domainLabel(o.domain))}</span><span class="saved-label">${prev?`נשמרה גרסה ${prev.revision}`:'טרם נשמר'}</span></h3><details><summary>מה מחפשים בתצפית?</summary><div class="rubric"><p><strong>התחלה בחלון המיידי:</strong> ${esc(o.immediate)}</p><p><strong>השלמה בחלון השילוב:</strong> ${esc(o.integration)}</p><p>החלון המיידי: לפחות 60 שניות או שני תורים רלוונטיים, לפי המאוחר ועד 120 שניות משימה, עם מקדם הנגישות. חלון השילוב מסתיים בסיכום המשימה. השלמה מאוחרת מוגבלת ל־1.</p></div></details>
      <div class="observation-grid"><div class="field"><label for="ds-${o.id}">מסירת האירוע</label><select id="ds-${o.id}" name="deliveryStatus" ${locked?'disabled':''}><option value="ND" ${ds==='ND'?'selected':''}>ND · לא נמסר / לא נגיש</option><option value="DEL" ${ds==='DEL'?'selected':''} ${!delivered?'disabled':''}>DEL · נמסר ואושר</option></select></div><div class="field"><label for="os-${o.id}">מצב התצפית</label><select id="os-${o.id}" name="observationStatus" ${locked?'disabled':''}><option value="OBS" ${os==='OBS'?'selected':''}>OBS · נצפה</option><option value="MD" ${os==='MD'?'selected':''}>MD · תיעוד חסר</option><option value="EO" ${os==='EO'?'selected':''}>EO · סירוב אתי</option></select></div><div class="field"><label for="sc-${o.id}">ציון ההתנהגות</label><select id="sc-${o.id}" name="score" ${locked||ds!=='DEL'||os!=='OBS'?'disabled':''}><option value="">ללא ציון</option>${[0,1,2].map(n=>`<option value="${n}" ${prev?.score===n?'selected':''}>${n} · ${['לא הודגמה','חלקית / מאוחרת','העוגן הושלם בזמן'][n]}</option>`).join('')}</select></div></div>
      <div class="field"><label for="ev-${o.id}">ראיה קצרה, ללא פרטים מזהים</label><textarea id="ev-${o.id}" name="evidence" maxlength="2000" placeholder="מה נעשה או נאמר? מה עדיין חסר?" ${locked?'disabled':''}>${esc(prev?.evidence || '')}</textarea></div>
      <div class="form-grid"><div class="field"><label for="tm-${o.id}">תחילת הראיה בשניות משימה (רשות)</label><input id="tm-${o.id}" name="evidenceStartSec" type="number" min="0" step="1" value="${prev?.evidenceStartSec??''}" ${locked?'disabled':''}></div><div class="field"><label for="te-${o.id}">סוף הראיה בשניות משימה (רשות)</label><input id="te-${o.id}" name="evidenceEndSec" type="number" min="0" step="1" value="${prev?.evidenceEndSec??''}" ${locked?'disabled':''}></div></div>
      <label class="check"><input name="lateResponse" type="checkbox" ${prev?.lateResponse?'checked':''} ${locked?'disabled':''}>ההשלמה הייתה מאוחרת: הציון מוגבל ל־1</label><label class="check"><input name="anticipatoryCredit" type="checkbox" ${prev?.anticipatoryCredit?'checked':''} ${locked?'disabled':''}>יוזמה מוקדמת: כל הרכיבים נצפו לפני האירוע והמידע לא השתנה</label>${o.domain==='EMP'?`<label class="check"><input name="reciprocalChainObserved" type="checkbox" ${prev?.reciprocalChainObserved?'checked':''} ${locked?'disabled':''}>נצפתה שרשרת בירור לשני הכיוונים, כולל אישור או תיקון</label>`:''}
      <div class="row between"><span class="status-note">${delivered?'האירוע נמסר במפגש.':'המנחה עוד לא סימן/ה מסירה. אפשר לשמור ND בלבד.'}</span><button class="button small" type="submit" ${locked?'disabled':''}>${prev?'שמירת תיקון מתועד':'שמירת התצפית'} ✓</button></div><div class="inline-error" role="alert"></div></form>`; }).join('')}`;
}
function profiles() {
  const items=session?.profiles || [];
  if (!items.length) return `<div class="empty"><h3>התמונה תיבנה מהתצפיות</h3><p>לא מחושבים ציונים מנתונים שלא נאספו. לאחר שמירת תצפיות יופיע פרופיל נפרד לכל צופה.</p>${btn('מעבר לדף תצפית','observe','','secondary')}</div>`;
  return items.map(p => `<div class="section-heading"><h2>קידוד ${esc(p.coderId)}</h2><span>כל צופה בנפרד · ללא ציון משוקלל</span></div><div class="profile-grid">${catalog.domains.map(d => { const v=p.domains.find(x=>x.code===d.code); return `<article class="domain-box"><code>${d.code}</code><span>${esc(d.label)}</span>${v?.score!=null?`<strong>${Math.round(v.score)}%</strong>`:'<strong class="no-score">עוד אין ציון</strong>'}<small>${v?.validCount||0}/2 תצפיות תקפות</small><div class="progress"><i style="width:${v?.score||0}%"></i></div></article>`; }).join('')}</div>`).join('');
}
function see() {
  return `${heading('לראות את התהליך','שבעה תחומים ארגוניים, פרופילים נפרדים, וראיות שאפשר לחזור אליהן.',session&&facilitator()?btn('ייצוא נתונים ↓','export','','secondary'):'')}${session?profiles():`<div class="grid">${catalog.domains.map(d=>`<article class="card"><span class="card-tag">${d.code}</span><h3>${esc(d.label)}</h3><p>${esc(d.description)}</p><a class="text-button" href="org-library.html?domain=${d.code}">מקורות ותרגולים ←</a></article>`).join('')}</div><div class="notice">פותחים מפגש בשלב "להתאמן" כדי להתחיל לאסוף תצפיות. התחומים הארגוניים אינם זהים לקבוצות המיומנויות החינוכיות באתר.</div>`}<div class="notice">ציון תחום מוצג באחוזים רק כששתי ההזדמנויות שלו תקפות: 100 × סכום הציונים ÷ 4. ND, MD ו־EO נשארים חסר. זהו מחוון התנהגות מוצע לתרגול מתוסרט, ואינו מדד חוסן מאומת.</div>`;
}
function resourceStrip() { return `<div class="resource-strip"><div><h3>מהתרגול אל הידע המשותף</h3><p>מקורות, תקצירים והיקף קריאה גלוי. אותם מקורות, מבט חינוכי ומבט ארגוני.</p></div><a class="button secondary" href="org-library.html">לספרייה <span>↗</span></a></div>`; }
function feedbackForm() {
  return `<form class="card" data-form="feedback"><h2>משוב שמוביל לפעולה</h2><p>מתארים התנהגות והקשר, ואז בוחרים ניסוי קטן לעבודה האמיתית.</p><div class="form-grid"><div class="field"><label for="strength">התנהגות שכדאי לשמר</label><input id="strength" name="strength" required maxlength="1000" placeholder="לדוגמה: הוזמנה עמדה חלופית"></div><div class="field"><label for="feedback-evidence">הראיה מהמפגש</label><input id="feedback-evidence" name="evidence" required maxlength="2000" placeholder="האירוע, התגובה והמועד"></div><div class="field full"><label for="nextStep">מה ננסה בפעם הבאה?</label><textarea id="nextStep" name="nextStep" required maxlength="1000" placeholder="פעולה אחת שאפשר לבצע ולבדוק"></textarea></div><div class="field"><label for="owner">תפקיד אחראי / קוד צוות</label><input id="owner" name="owner" required maxlength="60" placeholder="למשל: יחידה T, ללא שם אישי"></div><div class="field"><label for="dueDate">מועד בדיקה</label><input id="dueDate" name="dueDate" type="date" required></div></div><button class="button" type="submit">שמירת המשוב ופעולת ההמשך ←</button><div class="inline-error" role="alert"></div></form>`;
}
function actions() {
  return session?.feedback?.length ? session.feedback.map(f=>`<article class="action"><span>↗</span><div><strong>${esc(f.nextStep)}</strong><p>לשמר: ${esc(f.strength)}<br>ראיה: ${esc(f.evidence)}</p><small>אחריות: ${esc(f.owner)} · בדיקה: ${date(f.dueDate)} · נשמר ${date(f.createdAt)}</small></div></article>`).join('') : `<div class="empty"><h3>איזו פעולה ניקח לעבודה?</h3><p>המשוב שיישמר בתחקיר יופיע כאן עם אחריות ומועד בדיקה.</p>${btn('לכתיבת המשוב ←','learn','','secondary')}</div>`;
}
function learn() {
  return `${heading('ללמוד מהעשייה','מה הודגם, איזו ראיה יש לנו, ומה נרצה לתרגל שוב?')}${session&&facilitator()?`${session.status==='closed'?'<div class="notice">המפגש נעול; המשוב נשמר לצפייה ולייצוא.</div>':['paused','debrief'].includes(session.status)?feedbackForm():'<div class="notice">כדי לכתוב משוב, אפשר להשהות את התרגול או לסיים אותו בחדר ההנחיה.</div>'}<div class="section-heading"><h2>משוב שנשמר</h2><span>תהליך והתנהגות, בלי דירוג אנשים</span></div><div class="card">${actions()}</div><div class="divider"></div>`:'<div class="notice">כדי לתעד משוב למפגש, פותחים אותו מהמרחב שלי. הספרייה המשותפת זמינה גם ללא מפגש.</div>'}${resourceStrip()}<div class="section-heading"><h2>שאלות לפתיחת התחקיר</h2></div><div class="grid">${['איפה מידע עבר בין הצוותים, ואיפה הוא נעצר?','איזו עמדה נשמעה והובילה לבדיקה או לתיקון?','איזה שינוי קטן יישאר גם אחרי המפגש?'].map((t,i)=>`<article class="card"><span class="card-tag">0${i+1}</span><h3>${t}</h3><p>חוזרים לדוגמה קונקרטית מהתצפית, ושואלים את המשתתפים כיצד הבינו אותה.</p></article>`).join('')}</div>`;
}
function act() { return `${heading('מתרגול לפעולה','אחריות ברורה, פעולה שאפשר לנסות, ומועד לחזרה משותפת.')}${session?`<div class="card">${actions()}</div><div class="divider"></div>${['paused','debrief'].includes(session.status)&&facilitator()?feedbackForm():''}`:`<div class="empty"><h3>פותחים מפגש, מסיימים עם צעד הבא</h3><p>כל משוב יכול להפוך לפעולת המשך עם אחריות ותאריך.</p>${btn('בחירת תרחיש ←','practice','','secondary')}</div>`}`; }
function anchor() {
  const points=[['T0','לפני ההתנסות','תדריך, תוכנית נגישות, הגדרת הצוותים ובדיקת תהליך התיעוד.'],['T1','אחרי ההתנסות','תחקיר, בדיקת שלמות התיעוד וניסוי פעולה אחת בשגרה.'],['T2','מעקב והעברה לעבודה','חוזרים לפעולה, בודקים מה נעשה ומה כדאי להתאים.']];
  return `${heading('לעגן בשגרה','עוקבים אחרי הדרך ומה שנלקח מההתנסות לעבודה.')}
    <div class="card">${points.map(([id,title,description])=>{const prev=(session?.pilot||[]).filter(p=>p.timepoint===id).at(-1); return `<article class="pilot-step"><span>${({T0:"1",T1:"2",T2:"3"})[id]||id}</span><div><h3>${title}</h3><p>${description}</p><small>${prev?`${prev.completed?'סומן כהושלם':'תועד להמשך'} · ${esc(prev.note)} · ${date(prev.recordedAt)}`:'טרם תועד'}</small></div>${session&&session.mode==='pilot'&&facilitator()&&session.status!=='closed'?btn('תיעוד השלב','pilot',`data-id="${id}"`,'secondary small'):''}</article>`;}).join('')}</div><div class="section-heading"><h2>הפעולות שנבדוק במעקב</h2></div>${session?`<div class="card">${actions()}</div>`:'<div class="notice">לא נבחר מפגש. אפשר לפתוח מפגש קודם או ליצור מפגש חדש כדי לשמור מעקב.</div>'}`;
}
function architecture() {
  return `${heading('חיבור למבנה שכבר קיים','מיפוי האתר החי ב־28.10.2026. היישום הזה מוסיף מרחב ארגוני לצד כלי החינוך.')}
    <div class="notice">המבנה אומת מול מפת הכלים וקובצי הניווט החיים. הנתיב /organizational/ הוא הצעת חיבור שטרם נפרסה. קישורי כלי החינוך להלן מובילים לכתובות המקוריות.</div>
    <div class="table-wrap"><table><thead><tr><th>השלב הקיים</th><th>הכלים החיים</th><th>מה מוסיף Begood together</th></tr></thead><tbody>${stages.map(([id,label])=>`<tr><th>${label}</th><td>${(siteMap?.tools||[]).filter(t=>t.readinessGroup===id).map(t=>`<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.label)}</a>`).join('<br>')}</td><td>${({see:'פרופיל תצפית בשבעה תחומים, לכל צופה בנפרד',practice:'תרחיש, תפקידים, חדר מנחה, מסירת אירועים ודף תצפית',act:'פעולות המשך, תפקיד אחראי ומועד בדיקה',learn:'תחקיר, משוב וספריית מחקר משותפת',anchor:'מעקב לאורך זמן ושמירת קובץ'})[id]}</td></tr>`).join('')}</tbody></table></div>
    <div class="section-heading"><h2>שתי שפות תצפית, עם הקשרים שונים</h2></div><div class="grid two"><div class="card"><h3>בכלי החינוך החיים</h3><p>תקשורת; יצירת קשר ואמון; דיבור והתנסחות; שפת גוף והבעות; חוסן חברתי · פעולה משותפת; יחסים ותמיכה; חשיבה וקבלת החלטות יחד.</p></div><div class="card"><h3>במערך הארגוני</h3><p>${catalog.domains.map(d=>`${esc(d.code)} · ${esc(d.label)}`).join('<br>')}</p></div></div><div class="notice">הקישור בין השפות הוא החלטת פיתוח עתידית, ולא שקילות מדעית שהוגדרה כאן. נשמרו כלי החינוך, שער הכניסה, ההרשאות וניווט המקור.</div>${resourceStrip()}`;
}
function render() {
  $('stage-nav').innerHTML=stages.map(([id,label,q],i)=>`<a class="stage-link ${route===id?'active':''}" href="#${id}" ${route===id?'aria-current="page"':''}><span class="step-num">0${i+1}</span><span><strong>${label}</strong><small>${q}</small></span></a>`).join('');
  const views={overview,see,practice,observe,learn,act,anchor,architecture};
  const protectedView=session&&!facilitator()&&!['overview','practice','observe','architecture'].includes(route);
  $('app').innerHTML=`${route!=='overview'&&route!=='architecture'?sessionBanner()+ (session?tabs():''):''}${protectedView?'<div class="notice">התצפית נשמרת בתפקיד צופה. פרופילים ומשוב זמינים למנחה.</div>':(views[route]||overview)()}`;
  restoreDrafts();
  document.title=`Begood together · ${stages.find(s=>s[0]===route)?.[1]||({observe:'דף תצפית',architecture:'המבנה הקיים'})[route]||'המרחב הארגוני'}`;
}
function go(to) { if(location.hash===`#${to}`){route=to;render();} else location.hash=to; }
function showModal(html) { $('modal-body').innerHTML=html; $('modal').showModal(); }
function newModal(scenarioId) {
  showModal(`<h2 id="modal-title">מפגש חדש, דרך משותפת</h2><p>מגדירים את המסגרת. אפשר להכין את התפקידים לפני שמפעילים את שעון המשימה.</p><form data-form="new"><div class="field"><label for="title">שם המפגש</label><input id="title" name="title" maxlength="120" required placeholder="למשל: תרגול צוותי שירות · מפגש ראשון"></div><div class="field"><label for="scenario">תרחיש האימון</label><select id="scenario" name="scenarioId">${catalog.scenarios.map(s=>`<option value="${s.id}" ${s.id===scenarioId?'selected':''}>${esc(s.title)}</option>`).join('')}</select></div><div class="form-grid"><div class="field"><label for="teams">מבנה הצוותים</label><select id="teams" name="teamConfiguration"><option value="constructed_role_units">יחידות תפקיד זמניות</option><option value="intact_work_teams">צוותי עבודה קיימים</option></select></div><div class="field"><label for="access">מקדם זמן ונגישות</label><select id="access" name="accessFactor"><option value="1">×1 · רגיל</option><option value="1.5">×1.5 · זמן מורחב</option><option value="2">×2 · זמן מורחב</option></select></div></div><div class="field"><label for="mode">סוג המפגש</label><select id="mode" name="mode"><option value="training">מפגש תרגול</option><option value="pilot">הפעלה בצוות לאורך זמן</option></select></div><label class="check"><input type="checkbox" name="prepared" required>הובהרו מטרת התרגול, הבחירה להשתתף, אפשרות למענה בכתב ולעצירה. לא יוזנו שמות או מידע רגיש.</label><button class="button" type="submit">יצירת חדר ההנחיה ←</button><div class="inline-error" role="alert"></div></form>`);
}
function joinModal() { showModal(`<h2 id="modal-title">מצטרפים לתצפית</h2><p>את קוד המפגש מקבלים מהמנחה. לכל צופה תיעוד עצמאי, בלי חשיפה לקידודים של הצופים האחרים.</p><form data-form="join"><div class="field"><label for="join-code">קוד המפגש</label><input id="join-code" name="code" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" dir="ltr" placeholder="6 ספרות"></div><div class="field"><label for="coder">קוד צופה בדוי</label><input id="coder" name="coderId" required minlength="2" maxlength="40" pattern="[A-Za-z0-9_-]+" dir="ltr" placeholder="למשל OBS-01"><small>אותיות באנגלית, ספרות ומקף. ללא שם או כתובת דוא״ל.</small></div><button class="button" type="submit">הצטרפות ←</button><div class="inline-error" role="alert"></div></form>`); }
function updateSession(s) { session=s; const e=entries.find(x=>x.id===s.id&&x.role===active?.role); if(e){e.status=s.status;e.title=s.title;saveEntries();} }
async function openEntry(e) { setActive(e); updateSession(await api(`/sessions/${e.id}`,null,'GET')); go(e.role==='facilitator'?'practice':'observe'); }
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]'); if(!el)return;
  const a=el.dataset.action; if(a==='new'){if(!CAN_LEAD){showModal(`<h2 id="modal-title">פתיחת מפגש</h2><p>פתיחת מפגש אפשרית עם קוד Begood שיש בו את הכלי. לצפייה במפגש, אפשר להצטרף עם קוד המפגש שהמנחה מסר/ה.</p>${btn('הצטרפות לתצפית','join')}`);return;}newModal(el.dataset.scenario);return;} if(a==='join'){joinModal();return;}
  if(['practice','observe','learn','act','anchor','see'].includes(a)){go(a);return;}
  if(a==='scenario'){const s=catalog.scenarios.find(x=>x.id===el.dataset.id);showModal(`<h2 id="modal-title">${esc(s.title)}</h2><p>${esc(s.context)}</p>${s.roles.map(r=>`<div class="role"><strong>${esc(r.title)}</strong><p>${esc(r.brief)}</p></div>`).join('')}<div class="notice">תרחיש אימון חדש, שטרם תוקף. ${s.durationMinutes} דקות משימה לפני התאמת נגישות.</div>${btn('בחירת התרחיש ←','new',`data-scenario="${s.id}"`)}`);return;}
  if(a==='pilot'){showModal(`<h2 id="modal-title">תיעוד שלב ${esc(el.dataset.id)}</h2><p>מתעדים את התקדמות ההרצה. אין כאן הערכת יעילות מחקרית.</p><form data-form="pilot" data-point="${esc(el.dataset.id)}"><label class="check"><input name="completed" type="checkbox" checked>הבדיקה התפעולית לשלב הושלמה</label><div class="field"><label for="pilot-note">מה בוצע ומה נשאר להמשך?</label><textarea id="pilot-note" name="note" required maxlength="2000"></textarea></div><button class="button" type="submit">שמירת התיעוד</button><div class="inline-error" role="alert"></div></form>`);return;}
  if(a==='copyjoin'){try{await navigator.clipboard.writeText(joinLink());toast('הקישור הועתק');}catch{toast(joinLink());}return;}
  if(a==='qr'){const box=$('join-qr');if(!box)return;box.hidden=!box.hidden;if(!box.hidden&&!box.firstChild)loadQR(()=>{if(window.QRCode)new window.QRCode(box,{text:joinLink(),width:180,height:180});else box.textContent=joinLink();});return;}
  if(a==='delete'){showModal(`<h2 id="modal-title">מחיקת המפגש</h2><p>המפגש, התצפיות והמשוב יימחקו מהשרת, ואי אפשר יהיה לשחזר אותם. כדאי לשמור קודם ייצוא.</p>${btn('מחיקה','delete-yes','','secondary')}`);return;}
  if(a==='close'){showModal(`<h2 id="modal-title">נעילת המפגש</h2><p>לאחר הנעילה התצפיות והמשוב יישמרו לקריאה ולייצוא, ולא יהיה אפשר להוסיף תיקונים. כדאי לוודא שכל הצופים והצופות שמרו את התיעוד.</p>${btn('השלמנו את התיעוד: נעילה','transition','data-status="closed"')}`);return;}
  try{
    el.disabled=true;
    if(a==='open'){const e=entries.find(x=>x.id===el.dataset.id&&x.role===el.dataset.role);if(e)await openEntry(e);}
    else if(a==='refresh'){updateSession(await api(`/sessions/${session.id}`,null,'GET'));render();toast('המפגש עודכן');}
    else if(a==='transition'){const result=await api(`/sessions/${session.id}/transition`,{status:el.dataset.status});updateSession(result.session);$('modal').close();render();toast('מצב המפגש עודכן');}
    else if(a==='deliver'){const result=await api(`/sessions/${session.id}/deliver`,{opportunityId:el.dataset.id});updateSession(result.session);render();toast('מסירת האירוע תועדה עם זמן המשימה');}
    else if(a==='delete-yes'){await api(`/sessions/${session.id}`,null,'DELETE');entries=entries.filter(x=>x.id!==session.id);saveEntries();session=null;active=null;$('modal').close();go('overview');toast('המפגש נמחק');}
    else if(a==='export'){const data=await api(`/sessions/${session.id}/export`,null,'GET');download(data,`BE_GOOD_${session.id}.json`);toast('קובץ המפגש יוצא ללא מפתחות גישה');}
  }catch(error){toast(error.message);}finally{el.disabled=false;}
});
document.addEventListener('input',event=>{const form=event.target.closest('[data-form="observation"]');if(form)rememberDraft(form);});
document.addEventListener('change',event=>{
  const form=event.target.closest('[data-form="observation"]');
  if(form&&['deliveryStatus','observationStatus'].includes(event.target.name)){const valid=form.elements.deliveryStatus.value==='DEL'&&form.elements.observationStatus.value==='OBS';form.elements.score.disabled=!valid;if(!valid)form.elements.score.value='';}
  if(form)rememberDraft(form);
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();
  const values=Object.fromEntries(new FormData(form));const submit=form.querySelector('[type="submit"]');const errors=form.querySelector('.inline-error');errors.innerHTML='';submit.disabled=true;
  try{
    if(form.dataset.form==='new'){
      const data=await api('/sessions',{...values,accessFactor:Number(values.accessFactor)});const e={id:data.session.id,title:data.session.title,token:data.facilitatorToken,role:'facilitator',createdAt:new Date().toISOString(),status:data.session.status};entries.push(e);setActive(e);saveEntries();updateSession(data.session);$('modal').close();go('practice');toast('חדר ההנחיה מוכן');
    }else if(form.dataset.form==='join'){
      const data=await api('/join',values);const e={id:data.sessionId,title:data.session.title,token:data.observerToken,role:'observer',coderId:values.coderId,createdAt:new Date().toISOString(),status:data.session.status};entries=entries.filter(x=>!(x.id===e.id&&x.role==='observer'));entries.push(e);setActive(e);saveEntries();updateSession(data.session);$('modal').close();go('observe');toast('הצטרפת לתצפית עצמאית');
    }else if(form.dataset.form==='observation'){
      const num=v=>v===''||v==null?null:Number(v);
      const data=await api(`/sessions/${session.id}/observations`,{...values,opportunityId:form.dataset.id,score:num(values.score),evidenceStartSec:num(values.evidenceStartSec),evidenceEndSec:num(values.evidenceEndSec),lateResponse:values.lateResponse==='on',anticipatoryCredit:values.anticipatoryCredit==='on',reciprocalChainObserved:values.reciprocalChainObserved==='on'},'PUT');
      updateSession(data.session);drafts.delete(draftKey(form));const y=window.scrollY;render();window.scrollTo(0,y);toast('התצפית נשמרה. המקור נשמר גם בעת תיקון.');
    }else if(form.dataset.form==='feedback'){
      const data=await api(`/sessions/${session.id}/feedback`,values);updateSession(data.session);render();toast('המשוב ופעולת ההמשך נשמרו');
    }else if(form.dataset.form==='pilot'){
      const data=await api(`/sessions/${session.id}/pilot`,{...values,timepoint:form.dataset.point,completed:values.completed==='on'});updateSession(data.session);$('modal').close();render();toast('שלב המעקב נשמר');
    }
  }catch(error){errors.innerHTML=`<div class="form-error">${esc(error.message)}</div>`;}finally{submit.disabled=false;}
});
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
window.addEventListener('beforeunload',event=>{if(drafts.size){event.preventDefault();event.returnValue='';}});
$('modal').querySelector('.modal-close').addEventListener('click',()=>$('modal').close());
window.addEventListener('hashchange',()=>{route=location.hash.slice(1)||'overview';if(route==='architecture'&&!IS_SYS)route='overview';render();window.scrollTo(0,0);});
setInterval(()=>{if($('clock'))$('clock').textContent=time(elapsed());},1000);
try{
  [catalog,siteMap]=await Promise.all([loadCatalog(),fetch('org-suite/data/site-map.json').then(r=>r.json()).catch(()=>null)]);
  if(CAN_LEAD){try{const mine=await api('/mine',null,'GET');for(const m of mine.sessions||[]){const e=entries.find(x=>x.id===m.id&&x.role==='facilitator');if(e){e.title=m.title;e.status=m.status;}else entries.push({id:m.id,title:m.title,role:'facilitator',createdAt:m.createdAt,status:m.status});}const ids=new Set((mine.sessions||[]).map(m=>m.id));entries=entries.filter(e=>e.role!=='facilitator'||ids.has(e.id));saveEntries();}catch{}}
  route=location.hash.slice(1)||'overview';
  if(route==='architecture'&&!IS_SYS)route='overview';
  if(!['overview','architecture'].includes(route)){let last;try{last=JSON.parse(sessionStorage.getItem('bg-suite-active')||'null');}catch{}const e=entries.find(x=>x.id===last?.id&&x.role===last?.role);if(e){setActive(e);try{updateSession(await api(`/sessions/${e.id}`,null,'GET'));}catch{active=null;session=null;toast('לא ניתן לשחזר את המפגש. אפשר לפתוח מפגש אחר מהמרחב שלי.');}}}
  render();
  if(window.__orsServerErr)toast(window.__orsServerErr);
  if(JOIN_PARAM&&!session){joinModal();const f=$('join-code');if(f)f.value=JOIN_PARAM;const c=$('coder');if(c)c.focus();}
}catch(error){$('app').innerHTML=`<div class="empty"><h2>אין כרגע חיבור לשרת</h2><p>מה שנשמר במפגשים לא נמחק. אפשר לנסות שוב בעוד רגע.</p><p>${esc(error.message)}</p><a class="button" href="org-suite.html">ניסיון נוסף</a></div>`;}
