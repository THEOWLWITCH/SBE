(function () {
  'use strict';
  const M = window.SBE_JOURNEY_WORKSPACE;
  const clone = value => JSON.parse(JSON.stringify(value));
  function node(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function button(text, fn, secondary) {
    const b = node('button', 'btn' + (secondary ? ' btn-ghost' : ''), text);
    b.type = 'button'; b.addEventListener('click', fn); return b;
  }
  function uid() {
    const bytes = new Uint8Array(10); crypto.getRandomValues(bytes);
    return 'r_' + Array.from(bytes, v => v.toString(16).padStart(2, '0')).join('');
  }
  function download(value, name) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:'application/json;charset=utf-8'}));
    const a = node('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function mount(host, options) {
    if (!M) throw new Error('מודל מרחב העבודה לא נטען');
    let journey = clone(options.journey), data = M.clean(journey.workspace || M.empty());
    const unit = window.SBE_JOURNEY && SBE_JOURNEY.UNITS.find(u => u.k === journey.unit);
    const unitLabel = unit ? unit.t : 'מסגרת אחרת';
    const guidance = {
      school: {
        context:'בבית הספר אפשר להקים צוות חוסן בית ספרי, לעגן את המנדט מול ההנהלה ולברר כיצד צוותי החינוך, תלמידים והורים שותפים. אפשר לתחום יחד סמכות, זמן עבודה וקשרים לרשות. אחריות המבוגרים נשארת בידיהם.',
        roles:'אפשר למפות הנהלה, מורים וצוותי חינוך, תלמידים והורים, לצד מי שמרכזים ראיות, קשרים ולמידה. כדאי לברר ייצוג, זמן שהוקצה וגיבוי, ולשמור על אחריות המבוגרים גם כשיש הובלת תלמידים.',
        mechanisms:'אפשר לבחון מנגנונים שקיימים אצלכם, כמו צוותי למידה, מועצת תלמידים, חניכת מורים ושיח עם הורים. בודקים כיצד כל מנגנון מופעל ועבור מי הוא נגיש.',
        infrastructures:'אפשר למפות מרחבי מפגש ולמידה, מערכות תקשורת ותיעוד וערוצים נגישים לתלמידים, לצוות ולהורים, אם הם זמינים במסגרת.',
        resources:'אפשר לתעד ידע פדגוגי וארגוני, זמן עבודה ותקציב שהוקצו, ומיומנויות וקשרים של הצוות והשותפים. כדאי להבחין בין משאב מובטח למשאב שטרם הועמד לרשותכם.',
        evidence:'אפשר לשלב תצפיות ומשוב מהצוות, מתלמידים ומהורים, ולברר מי עוד לא נשמעו. אפשר לתעד תמצית ללא פרטים מזהים.',
        links:'אפשר לבחון קשרים אופקיים בין מורים, צוותים, תלמידים והורים, וקשרים אנכיים להנהלה ולרשות. קשר מתועד אינו מעיד כשלעצמו על סמכות או על העברת משאבים.',
        decisions:'אפשר להבהיר מה מוסמך צוות החוסן להחליט, מה מצריך החלטת הנהלה, ואיך נשמעים תלמידים והורים. השיח וההשתתפות נבדלים מהסמכות להחלטה.',
        actions:'אפשר להגדיר זמן עבודה למורים ולצוות, תיאום עם מערכת השעות, גיבוי וסמכות, ומה מצמצמים כדי לפנות מקום. הפעולה יכולה לשפר את איכות החיים בהווה ואת המוכנות לעתיד.',
        reviews:'אפשר לבחון את השינוי עבור הצוות, התלמידים וההורים, את העומס על המורים ואת השפעת הקשרים לרשות. שומרים גם עדויות שלא תואמות את הציפייה.'
      },
      community: {
        context:'בקהילה אפשר להקים צוות חוסן קהילתי ולברר מי נתנו לו מנדט, את מי הוא מייצג ואיך מצטרפים אליו. כדאי להגדיר גבולות קהילה, שפות ונגישות, קשרים לרשות ולשותפים, ודרך לשמיעת קבוצות שאינן מיוצגות.',
        roles:'אפשר למפות תושבים ומתנדבים, הנהגה קהילתית, עובדים בשכר ושותפים מקומיים. כדאי לברר ייצוג ולגיטימיות, קבוצות שאינן נשמעות, זמן שהוקצה וגיבוי גם בתחלופת מתנדבים.',
        mechanisms:'אפשר לבחון מנגנונים שקיימים אצלכם, כמו אספת תושבים, תיאום התנדבות, עזרה הדדית ותיווך בין קבוצות. בודקים מי יכולים להשתתף ומי נשארים מחוץ למענה.',
        infrastructures:'אפשר למפות מרחבים ציבוריים, ערוצי תקשורת ותיעוד, נגישות פיזית ושפתית וחלופות למי שאינם משתמשים בערוצים דיגיטליים, לפי הקיים בקהילה.',
        resources:'אפשר לתעד זמן התנדבות וזמן עבודה בשכר בנפרד, ידע מקומי, תקציב וקשרים עם ארגונים ועסקים. התחייבות שטרם אושרה נשארת מסומנת ככזו.',
        evidence:'אפשר לשלב תצפיות ומשוב מתושבים, מתנדבים וקבוצות שונות, ולברר מי לא נגישים למיפוי ובאילו שפות וערוצים אפשר לשמוע אותם.',
        links:'אפשר לבחון קשרים אופקיים בין תושבים, קבוצות וארגונים, וקשרים אנכיים לרשות ולשירותים. כדאי לברר תלות בשותף יחיד וגיבוי כשערוץ או אדם אינם זמינים.',
        decisions:'אפשר להגדיר איך מתקבלת החלטה קהילתית, מי מיוצגים ומי מוסמכים להתחייב בשם כל שותף. השתתפות תושבים והתנדבות אינן מחליפות את אחריות הרשות והשירותים.',
        actions:'אפשר להגדיר גבולות לזמן התנדבות, לצד זמן עבודה בשכר, גיבוי, נגישות ושפות, והתחייבויות שאושרו עם הרשות והשותפים. כדאי לתעד מה מצמצמים כדי למנוע עומס על אותם אנשים.',
        reviews:'אפשר לבחון את השינוי עבור קבוצות שונות, עומס ושחיקה של מתנדבים, נגישות והמשכיות בתחלופת הנהגה, ומה השתנה בקשרים לרשות ולשותפים.'
      }
    }[journey.unit] || {};
    let saved = clone(data), revision = journey.revision || 0, metadataRevision = 0, dirty = false, busy = false, conflict = false;
    let conflictRevision = null, deferredMetadata = null;
    let section = 'overview', selected = Object.create(null), serial = 0, alive = true;
    let aiInput = null, suggestions = [], status, saveButton, conflictBox, content;
    let aiSelection = [], aiReviewed = false, aiChosen = new Set(), aiResultInput = null, aiPending = null, aiGeneration = 0, aiError = '', reloadGeneration = 0;
    const shell = node('div', 'jws'); host.appendChild(shell);
    const sections = M.SECTIONS;
    function message(text, error) { status.textContent = text; status.className = 'jws-status' + (error ? ' jws-error' : ''); }
    function changed() {
      serial++; dirty = true; cancelAiRequest(); saveButton.disabled = busy || conflict;
      message('יש שינויים שעדיין לא נשמרו בשרת');
    }
    function hasUnsaved() { return dirty || suggestions.length > 0 || !!aiPending; }
    function canLeave() { return !hasUnsaved() || window.confirm('יש שינויים או טיוטות שעדיין לא נשמרו. להמשיך בלי לשמור? אפשר להישאר ולבחון את הטיוטות או לשמור את העבודה.'); }
    function beforeUnload(event) { if (hasUnsaved()) { event.preventDefault(); event.returnValue = ''; } }
    function cancelAiRequest() {
      aiGeneration++;
      if (aiPending && aiPending.timer) clearInterval(aiPending.timer);
      aiPending = null;
    }
    function resetAiInput() {
      cancelAiRequest(); aiInput = null; aiReviewed = false; suggestions = []; aiResultInput = null; aiChosen = new Set(); aiError = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    function exportData() {
      download({format:'begood-resilience-workspace', version:2, journeyId:journey.id, unit:journey.unit || 'other', unitName:journey.unitName || '', revision, exportedAt:new Date().toISOString(), unsaved:dirty, workspace:data}, 'begood-workspace-' + journey.id + '.json');
    }
    function labelFor(target, id) {
      const record = (data[target] || []).find(r => r.id === id);
      return record ? (record.title || 'רשומה ללא שם') + ' (' + id + ')' : id;
    }
    function fieldValue(field, value) {
      if (Array.isArray(value)) {
        if (field.type === 'refs') return value.map(id => labelFor(field.target, id)).join('; ');
        return value.map(v => ((field.options || []).find(o => o.value === v) || {}).label || v).join('; ');
      }
      if (field.type === 'select') return ((field.options || []).find(o => o.value === value) || {}).label || value || '';
      return value || '';
    }
    function report() {
      const root = node('div', 'jws-report');
      root.appendChild(node('h1', '', journey.unitName || 'מרחב העבודה לחוסן'));
      root.appendChild(node('p', '', 'סוג המסגרת: ' + unitLabel));
      root.appendChild(node('p', '', 'גרסה ' + revision + (dirty ? '. כולל שינויים מקומיים שטרם נשמרו.' : '. הנתונים שנשמרו בשרת.')));
      root.appendChild(node('p', '', 'קיום, מימוש והתחדשות הן שלוש זוויות בחינה מקבילות. התיעוד אינו ציון חוסן או החלטת הסמכה.'));
      function table(fields, record) {
        const t = node('table'); const body = node('tbody'); t.appendChild(body);
        fields.forEach(f => {
          const value = fieldValue(f, record[f.key]); if (!value) return;
          const row = node('tr'); row.appendChild(node('th', '', f.label)); row.appendChild(node('td', '', value)); body.appendChild(row);
        }); return t;
      }
      root.appendChild(node('h2', '', 'מסגרת התהליך')); root.appendChild(table(M.CONTEXT_FIELDS, data.context));
      sections.forEach(s => {
        root.appendChild(node('h2', '', s.label));
        if (!data[s.key].length) root.appendChild(node('p', '', 'טרם תועדו רשומות. היעדר תיעוד אינו מעיד על חולשה.'));
        data[s.key].forEach(r => {
          root.appendChild(node('h3', '', (r.title || 'רשומה ללא שם') + ' (' + r.id + ')'));
          root.appendChild(table(s.fields, r));
        });
      }); return root;
    }
    function print() {
      if (!window.SBE_DOC || !SBE_DOC.print) return message('כלי ההדפסה לא נטען. אפשר לייצא עותק ולנסות שוב.', true);
      SBE_DOC.print({title:'מסע אל החוסן: ' + journey.unitName, node:report(), extraCss:'.jws-report h1,.jws-report h2,.jws-report h3{border:0!important;border-bottom:0!important}.jws-report table{width:100%;border-collapse:collapse;margin:8px 0 18px}.jws-report th,.jws-report td{border:1px solid #CDD3D8;padding:7px;white-space:pre-wrap;overflow-wrap:anywhere}.jws-report th{width:30%;text-align:right;background:#eef3f6}.jws-report tr{break-inside:avoid}.jws-report p,.jws-report td{text-align:justify}'});
    }
    function acceptMetadataRevision(result) {
      return applyMetadataRevision(result, true);
    }
    function applyMetadataRevision(result, deferWhileSaving) {
      if (!alive || !result || result.ok !== true || !Number.isSafeInteger(result.revision) || result.revision <= revision) return false;
      let base;
      try { base = M.clean(result.workspace); } catch (e) { return false; }
      if (JSON.stringify(base) !== JSON.stringify(saved)) {
        if (deferWhileSaving && busy && (!deferredMetadata || result.revision > deferredMetadata.revision)) {
          deferredMetadata = {ok:true,revision:result.revision,workspace:base};
        }
        message('ההודעה נשמרה, ובשרת יש גם שינויי תוכן אחרים. השינויים המקומיים נשארו פתוחים והגרסאות ייבחנו לפני שמירה.', true);
        return false;
      }
      revision = result.revision; metadataRevision = revision;
      if (conflict && conflictRevision === revision) {
        conflict = false; conflictRevision = null; conflictBox.hidden = true; saveButton.disabled = busy || !dirty;
      }
      message(conflict ? 'ההודעה נשמרה, ופער הגרסאות עדיין פתוח לבחינה. השינויים המקומיים נשארו פתוחים.' : dirty ? 'ההודעה נשמרה. יש שינויים מקומיים שעדיין לא נשמרו.' : 'ההודעה נשמרה. גרסה ' + revision, conflict);
      return true;
    }
    async function save() {
      if (busy || conflict || !dirty) return;
      let snapshot; try { snapshot = M.clean(data); } catch (e) { message('השמירה ממתינה לתיקון: ' + e.message, true); return; }
      const captured = serial, requestRevision = revision, requestBase = JSON.stringify(saved);
      busy = true; saveButton.disabled = true; message('שמירה בשרת...');
      try {
        const result = await options.api('jrSaveWorkspace', {id:journey.id, revision:requestRevision, workspace:snapshot});
        if (!alive) return;
        if (result._status === 409 || result.error === 'conflict') {
          if (result.revision === revision && revision > requestRevision && metadataRevision === revision && JSON.stringify(saved) === requestBase) {
            message('ההודעה נשמרה במהלך ההמתנה. השינויים המקומיים עדיין לא נשמרו. אפשר ללחוץ שוב על שמירת השינויים.', true);
            return;
          }
          conflict = true; conflictRevision = Number.isSafeInteger(result.revision) ? result.revision : null; conflictBox.hidden = false;
          message('נשמרה גרסה חדשה יותר בשרת. השינויים המקומיים נשארו פתוחים. אפשר לייצא עותק לפני טעינת הגרסה האחרונה.', true); return;
        }
        if (!result.ok) {
          message(result._status === 413 ? 'המרחב גדול ממגבלת השמירה. אפשר לקצר תיאורים ולשמור הפניות למסמכים במאגר המורשה.' : 'השינויים לא נשמרו. אפשר לנסות שוב. ' + (result.message || ''), true); return;
        }
        revision = Math.max(revision, result.revision); saved = clone(result.workspace || snapshot);
        if (captured === serial) { data = clone(saved); dirty = false; renderContent(); }
        message(dirty ? 'הגרסה נכתבה בשרת. יש שינויים נוספים שעדיין לא נשמרו.' : 'נשמר בשרת. גרסה ' + revision);
        const pendingMetadata = deferredMetadata; deferredMetadata = null;
        if (pendingMetadata) applyMetadataRevision(pendingMetadata, false);
      } catch (e) { if (alive) message('החיבור לשרת לא הושלם. השינויים נשארו פתוחים ואפשר לנסות שוב.', true); }
      finally { busy = false; deferredMetadata = null; if (alive) saveButton.disabled = !dirty || conflict; }
    }
    async function reload() {
      if (!window.confirm('טעינת הגרסה מהשרת תחליף את השינויים המקומיים. אפשר לבטל ולייצא עותק קודם. להמשיך?')) return;
      const captured = serial, capturedRevision = revision, load = ++reloadGeneration;
      try {
        const result = await options.api('jrGet', {id:journey.id});
        if (!alive || load !== reloadGeneration) return;
        if (serial !== captured || revision !== capturedRevision || busy) return message('נוספו שינויים במהלך הטעינה. העבודה המקומית נשארה פתוחה. אפשר לייצא עותק ולבקש שוב את הגרסה האחרונה.', true);
        if (!result.journey || result.journey.mode !== 'workspace' && result.journey.version !== 2 && result.journey.status !== 'workspace') return message('הגרסה האחרונה לא נטענה. אפשר לנסות שוב.', true);
        data = M.clean(result.journey.workspace); saved = clone(data); revision = result.journey.revision || 0;
        dirty = false; conflict = false; conflictRevision = null; resetAiInput(); aiSelection = []; conflictBox.hidden = true; saveButton.disabled = true;
        message('נטענה הגרסה האחרונה מהשרת. גרסה ' + revision); renderContent();
      } catch (e) { if (alive && load === reloadGeneration) message('הגרסה האחרונה לא נטענה. השינויים המקומיים נשארו פתוחים.', true); }
    }
    const head = node('header', 'card'); shell.appendChild(head);
    head.appendChild(node('h1', '', journey.unitName || 'מרחב עבודה לחוסן'));
    head.appendChild(node('p', 'muted', unitLabel));
    head.appendChild(node('p', '', 'מסע אל החוסן. מרחב משותף למיפוי, לבחירת שינוי, לפעולה וללמידה לאורך זמן.'));
    head.appendChild(node('p', 'muted', 'הנתונים נשמרים בשרת במסגרת המסע. הגישה היא לבעלי קוד המסע ולמנהלי המערכת, לפי ההרשאות הקיימות. קוד משותף אינו הרשאה אישית לכל בעל תפקיד.'));
    const privacy = node('details', 'jws-explain'); privacy.appendChild(node('summary', '', 'פרטיות, תיעוד והסמכה'));
    privacy.appendChild(node('p', '', 'אפשר לתעד תפקידים במקום שמות תלמידים, תושבים, מתנדבים ופרטים אישיים רגישים. מומלץ לשמור מסמכים מזהים במאגר המאושר של המסגרת, ולתעד כאן תמצית והפניה שאינה חושפת מידע אישי. קובץ ייצוא מכיל את המידע שבמרחב, ולכן מתאים לשמירה במקום מאושר בלבד.'));
    privacy.appendChild(node('p', '', 'הערכה עצמית ולמידה מופרדות מהסמכה חיצונית. תו חוסן ייבחן בהליך נפרד של גוף אקדמי מקצועי וצוות הסמכה ייעודי, לפי קריטריונים שקופים, ראיות ומשוב מעודד גם ללא תו, עם אפשרות לשיפור ולהגשה חוזרת. המרחב אינו מעניק תו באופן אוטומטי ואינו מדד שתוקף במחקר.'));
    head.appendChild(privacy);
    const toolbar = node('div', 'jws-toolbar no-print'); head.appendChild(toolbar);
    saveButton = button('שמירת השינויים', save); saveButton.disabled = true; toolbar.appendChild(saveButton);
    toolbar.appendChild(button('ייצוא עותק של המרחב', exportData, true)); toolbar.appendChild(button('הדפסת תמונת המצב', print, true));
    toolbar.appendChild(button('לרשימת המסעות', () => { if (options.onBack) options.onBack(); else location.hash = ''; }, true));
    status = node('p', 'jws-status', 'נטען מהשרת. גרסה ' + revision); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); head.appendChild(status);
    conflictBox = node('div', 'jws-conflict'); conflictBox.hidden = true; conflictBox.appendChild(node('p', '', 'אפשר לשמור עותק של העבודה המקומית ולבחון את ההבדלים עם הצוות לפני המשך.'));
    conflictBox.appendChild(button('ייצוא השינויים המקומיים', exportData, true)); conflictBox.appendChild(button('טעינת הגרסה האחרונה', reload, true)); head.appendChild(conflictBox);
    const nav = node('nav', 'jws-tabs no-print'); nav.setAttribute('aria-label', 'חלקי מרחב העבודה'); shell.appendChild(nav);
    const tabs = [{key:'overview', label:'מבט על המסע'}, {key:'context',label:'מסגרת התהליך'}, ...sections, {key:'ai',label:'פרשנות בעזרת AI'}];
    tabs.forEach(s => { const b = button(s.label, () => { section = s.key; renderContent(); if (!dirty && !conflict) message('המידע שנשמר בשרת. גרסה ' + revision); }, true); b.dataset.section = s.key; nav.appendChild(b); });
    content = node('section', 'card jws-content'); shell.appendChild(content);
    function fieldControl(field, record, prefix) {
      const wrap = node('div', 'jws-field'); const id = 'jws-' + prefix + '-' + field.key;
      const label = node('label', '', field.label); label.htmlFor = id; wrap.appendChild(label);
      let input;
      if (field.type === 'refs' || field.type === 'multi') {
        const choices = field.type === 'refs' ? (data[field.target] || []).map(r => ({value:r.id,label:(r.title || 'רשומה ללא שם') + ' (' + r.id + ')'})) : field.options || [];
        const group = node('fieldset', 'jws-checks'); group.id = id;
        const legend = node('legend', 'jws-sr-only', field.label); group.appendChild(legend); label.remove();
        wrap.prepend(node('div', 'jws-field-label', field.label));
        if (!choices.length) group.appendChild(node('p', 'muted', 'אפשר להוסיף רשומות בחלק המתאים ואז לקשר אותן כאן.'));
        choices.forEach(choice => {
          const l = node('label', 'jws-check'); const checkbox = node('input'); checkbox.type = 'checkbox';
          checkbox.checked = (record[field.key] || []).includes(choice.value);
          checkbox.addEventListener('change', () => {
            const current = (record[field.key] || []).filter(v => v !== choice.value);
            if (checkbox.checked && current.length >= (field.max || 40)) { checkbox.checked = false; return message('אפשר לקשר עד ' + (field.max || 40) + ' רשומות בשדה זה.', true); }
            if (checkbox.checked) current.push(choice.value); record[field.key] = current; changed();
          }); l.appendChild(checkbox); l.appendChild(node('span', '', choice.label)); group.appendChild(l);
        }); wrap.appendChild(group); return wrap;
      }
      if (field.type === 'select') {
        input = node('select'); const blank = node('option', '', 'טרם הוגדר'); blank.value = ''; input.appendChild(blank);
        (field.options || []).forEach(o => { const opt = node('option', '', o.label); opt.value = o.value; input.appendChild(opt); });
      } else { input = node(field.type === 'long' ? 'textarea' : 'input'); if (input.tagName === 'INPUT') input.type = field.type === 'date' ? 'date' : 'text'; input.maxLength = 4000; }
      input.id = id; input.value = record[field.key] || ''; input.addEventListener(field.type === 'select' || field.type === 'date' ? 'change' : 'input', () => { record[field.key] = input.value; changed(); });
      wrap.appendChild(input); return wrap;
    }
    function overview() {
      content.appendChild(node('h2', '', 'מה עושים עם המיפוי'));
      content.appendChild(node('p', '', 'אפשר להתחיל בהגדרת המטרה וצוות החוסן, להצליב את ארבעת המאגרים עם ראיות, ולבחון את רשת המנגנונים. לאחר בירור משותף מתעדים החלטה, בוחרים שינוי אחד או שניים, מגדירים אחריות ומשאבים, וחוזרים ללמוד מן התוצאות.'));
      if (guidance.context) content.appendChild(node('p', '', guidance.context));
      const grid = node('div', 'jws-counts'); content.appendChild(grid);
      sections.slice(0,4).forEach(s => { const item = node('div'); item.appendChild(node('strong', '', data[s.key].length)); item.appendChild(node('span', '', s.label)); grid.appendChild(item); });
      content.appendChild(node('h3', '', 'שלוש זוויות בחינה מקבילות'));
      content.appendChild(node('p', '', 'קיום: מה זמין ומוסכם. מימוש: מה מופעל בפועל, עבור מי ובאילו תנאים. התחדשות: מה נלמד, נשמר ומשתנה. אלה אינן מדרגות או רמות דירוג.'));
      content.appendChild(node('h3', '', 'מה שומר על איכות ההחלטה'));
      const list = node('ul'); ['הבחנה בין תצפית, פרשנות, אי ודאות והחלטה. חוסר במידע נותר שאלה לבירור.', 'בחינה של איכות החיים בהווה לצד מוכנות לעתיד, סולידריות, אתוס והעצמת השותפים. בבית הספר נבחנת גם העצמת מורים; בקהילה נבחנת גם השפעת תושבים ומתנדבים.', 'בחירת סדר עדיפות לפי חשיבות, הוגנות, השפעה על הרשת, ישימות, זמן ומשאבים, תוך תיעוד מחלוקת והנמקה.', 'מעקב אחר תוצאות, עומס, השלכות לא צפויות והחלטה מה לשמר, לשנות או להפסיק.'].forEach(t => list.appendChild(node('li', '', t))); content.appendChild(list);
    }
    function sectionIntro(key) {
      return {
        roles:'אפשר לתעד את צוות החוסן, בעלי הסמכות, מי שמובילים את התהליך, מי שמרכזים ראיות וקשרים, ואת הגיבוי והזמן שהוקצו לכל תפקיד. מינוי לבדו אינו מוכיח מימוש.',
        mechanisms:'מנגנון חברתי הוא רכיב או הסדר בעל תפקיד מארגן במערכת החברתית. הוא עשוי לייצר משאבים, לשנות קשרים, לשמר יכולות ולתמוך בהתארגנות מחודשת. עקרונות הפעולה ואיכויות המנגנון מתועדים בנפרד משלוש זוויות הבחינה.',
        infrastructures:'כאן מתועדים מרחבים, ערוצים, מתקנים ומערכות שמאפשרים פעולה, עם זמינות, נגישות ואחריות לתחזוקה.',
        resources:'כאן מתועדים ידע, מיומנויות, זמן, תקציב ומשאבים נוספים. הזמינות אינה מבטיחה שימוש, ואפשר לתעד גם משאב שנוצר באמצעות מנגנון חברתי.',
        evidence:'אפשר לרשום תצפית, פרוטוקול או תמצית משוב, לצד מקור, תאריך, מי אספו את המידע ומגבלותיו. אפשר לתעד כאן תמצית ללא פרטים מזהים על משתתפים, ולהפנות לחומר המקור במאגר המאושר של המסגרת.',
        links:'כל קשר מכוון ממנגנון מוצא למנגנון יעד. סוג הקשר מבחין במידע, סמכות, משאבים, תיאום, גיבוי והשפעה נורמטיבית. מתעדים בנפרד קשר פורמלי, קשר שנצפה וקשר מוצע. קשר מוצע או גיבוי מוצהר אינם ראיה לתפקוד.',
        findings:'אפשר להבחין בין חוזקה, פער שנמצא ושאלה שעדיין פתוחה. טיוטת AI מצריכה בחינה אנושית, ואישור מתועד בשם או בתפקיד. שינוי הטיוטה לנדחתה משמר את עקבות הבירור.',
        decisions:'אפשר להשוות חלופות לפי חשיבות, הוגנות, השפעה על הרשת, ישימות, זמן ומשאבים. מתעדים גם אי ודאות, מחלוקת, הסמכות להחלטה ומועד לבחינה מחדש. אישור אנושי נכתב במפורש.',
        actions:'תכנית העבודה מקשרת כל פעולה להחלטה. אפשר להגדיר מי מובילים, גיבוי, סמכות, שותפים ומשאבים, ומה מפסיקים לעשות כדי לפנות זמן. ראיות לביצוע מתועדות בנפרד מראיות לתוצאה בהווה ולמוכנות לעתיד.',
        reviews:'מעגל הלמידה היוזם חוזר לבחון מה השתנה בפועל, עבור מי, מה לא צפוי ומה משתנה בהמשך. אפשר לעדכן מנגנונים וקשרים וליצור משאבים חדשים גם בלי אירוע משבר.'
      }[key] || '';
    }
    function records(s) {
      content.appendChild(node('h2', '', s.label)); content.appendChild(node('p', '', sectionIntro(s.key)));
      if (guidance[s.key]) content.appendChild(node('p', '', guidance[s.key]));
      if (s.key === 'links') {
        const d = node('details', 'jws-explain'); d.appendChild(node('summary', '', 'כיצד בוחנים את רשת המנגנונים'));
        d.appendChild(node('p', '', 'אפשר לעקוב אחרי מסלול של צורך ממשי בין מנגנונים: היכן המידע עובר, מי מוסמכים להחליט, והאם משאבים מגיעים למי שמפעילים את המענה. בוחנים קשרים אופקיים בין עמיתים וקבוצות, וקשרים אנכיים להנהלה ולרשות.'));
        d.appendChild(node('p', '', 'כדאי לברר צווארי בקבוק, קבוצות שאינן נשמעות, תלות באותו אדם או באותה תשתית, ומשמעותן של נורמות ואתוס משותף. גיבוי נבחן גם בתנאי הפרעה: שתי חלופות שתלויות באותו ערוץ אינן בהכרח גיבוי עצמאי. נשמר מקום למחלוקת ולתפקודים חברתיים שקשה למדוד.'));
        content.appendChild(d);
        if (data.links.length) {
          const list = node('ul', 'jws-network');
          data.links.forEach(link => {
            const li = node('li');
            li.appendChild(node('strong', '', link.title || 'קשר שטרם קיבל שם'));
            li.appendChild(node('div', '', 'ממנגנון מקור: ' + (link.from || []).map(id => labelFor('mechanisms', id)).join(', ')));
            li.appendChild(node('div', '', 'אל מנגנון יעד: ' + (link.to || []).map(id => labelFor('mechanisms', id)).join(', ')));
            li.appendChild(node('div', 'muted', fieldValue(s.fields.find(f => f.key === 'type'), link.type) + ' · ' + fieldValue(s.fields.find(f => f.key === 'status'), link.status)));
            list.appendChild(li);
          }); content.appendChild(list);
        }
      }
      const bar = node('div', 'jws-record-bar'); content.appendChild(bar);
      const chooser = node('select'); chooser.setAttribute('aria-label', 'בחירת רשומה ב' + s.label); bar.appendChild(chooser);
      const list = data[s.key]; if (!list.some(r => r.id === selected[s.key])) selected[s.key] = list[0] && list[0].id;
      list.forEach(r => { const o = node('option', '', (r.title || 'רשומה ללא שם') + ' (' + r.id + ')'); o.value = r.id; chooser.appendChild(o); }); chooser.value = selected[s.key] || '';
      chooser.addEventListener('change', () => { selected[s.key] = chooser.value; renderContent(); });
      bar.appendChild(button('הוספת רשומה', () => {
        if (list.length >= 80) return message('בכל חלק אפשר לתעד עד 80 רשומות. אפשר לבחון עם הצוות מה מתאים להמשך תיעוד.', true);
        const record = {id:uid(),title:''}; if (s.key === 'findings') { record.origin = 'team'; record.state = 'draft'; } if (s.key === 'actions') record.status = 'planned';
        list.push(record); selected[s.key] = record.id; changed(); renderContent();
      }));
      if (!list.length) { content.appendChild(node('p', 'muted', 'טרם תועדו רשומות בחלק זה. אפשר להוסיף רשומה ראשונה.')); return; }
      const record = list.find(r => r.id === selected[s.key]);
      content.appendChild(node('p', 'muted', 'מזהה קבוע: ' + record.id));
      const form = node('div', 'jws-fields'); content.appendChild(form);
      s.fields.forEach(f => { if (f.key !== 'id') form.appendChild(fieldControl(f.key === 'title' ? {...f,label:'שם הרשומה'} : f, record, record.id)); });
      content.appendChild(button('מחיקת הרשומה', () => {
        const uses = [];
        sections.forEach(other => other.fields.filter(f => f.type === 'refs' && f.target === s.key).forEach(f => {
          data[other.key].filter(r => (r[f.key] || []).includes(record.id)).forEach(r => uses.push(other.label + ': ' + (r.title || r.id)));
        }));
        if (uses.length) return message('הרשומה נשארה במרחב משום שהיא מקושרת לרשומות אחרות. אפשר לעדכן את הקישורים לפני מחיקה: ' + uses.join('; '), true);
        const candidate = clone(data); candidate[s.key] = candidate[s.key].filter(r => r.id !== record.id);
        if (!window.confirm('למחוק את הרשומה "' + (record.title || record.id) + '"? השינוי ייכנס לשרת לאחר שמירה.')) return;
        data = candidate; changed(); renderContent();
      }, true));
    }
    function aiPayload(ids) {
      const related = name => saved[name].filter(r => (r.evidenceIds || []).some(id => ids.includes(id)));
      return {unit:{kind:unit ? unit.k : 'other',label:unitLabel},context:{goal:saved.context.goal,scope:saved.context.scope,preserve:saved.context.preserve,mandate:saved.context.mandate,delegation:saved.context.delegation},evidence:saved.evidence.filter(e => ids.includes(e.id)),roles:related('roles').map(r => { const copy = {...r}; delete copy.person; return copy; }),mechanisms:related('mechanisms'),infrastructures:related('infrastructures'),resources:related('resources'),links:related('links')};
    }
    function validateSuggestions(raw, allowed) {
      const result = typeof raw === 'string' ? JSON.parse(raw.trim().replace(/^\x60{3}(?:json)?\s*/i, '').replace(/\s*\x60{3}$/, '')) : raw;
      if (!result || !Array.isArray(result.suggestions) || result.suggestions.length > 20 || Object.keys(result).some(k => k !== 'suggestions')) throw new Error('תשובה שאינה מתאימה למבנה הפרשנות');
      return result.suggestions.map(s => {
        const keys = ['title','kind','evidenceIds','interpretation','uncertainty'];
        if (!s || typeof s !== 'object' || Object.keys(s).some(k => !keys.includes(k)) || !['strength','gap','question'].includes(s.kind)) throw new Error('סוג פרשנות לא תקין');
        for (const key of ['title','interpretation','uncertainty']) if (typeof s[key] !== 'string' || !s[key].trim() || s[key].length > 4000) throw new Error('חסרים נימוק או אי ודאות');
        if (!Array.isArray(s.evidenceIds) || !s.evidenceIds.length || s.evidenceIds.length > 40 || s.evidenceIds.some(id => typeof id !== 'string' || !allowed.includes(id))) throw new Error('הטיוטה מפנה לראיה שלא נבחרה');
        return {title:s.title,kind:s.kind,evidenceIds:[...new Set(s.evidenceIds)],interpretation:s.interpretation,uncertainty:s.uncertainty};
      });
    }
    function previewFacts(payload) {
      const box = node('div', 'jws-input-review');
      box.appendChild(node('h3', '', 'המידע לעיון לפני שליחה'));
      box.appendChild(node('p', '', 'סוג המסגרת: ' + payload.unit.label));
      const intro = node('dl');
      M.CONTEXT_FIELDS.filter(f => Object.hasOwn(payload.context, f.key)).forEach(f => {
        if (!payload.context[f.key]) return;
        intro.appendChild(node('dt', '', f.label)); intro.appendChild(node('dd', '', payload.context[f.key]));
      }); box.appendChild(intro);
      for (const key of ['evidence','roles','mechanisms','infrastructures','resources','links']) {
        const s = sections.find(s => s.key === key); if (!payload[key].length) continue;
        box.appendChild(node('h4', '', s.label));
        payload[key].forEach(r => {
          const record = node('article', 'jws-suggestion'); record.appendChild(node('strong', '', (r.title || 'רשומה ללא שם') + ' (' + r.id + ')'));
          const dl = node('dl');
          s.fields.filter(f => f.key !== 'title' && Object.hasOwn(r,f.key)).forEach(f => {
            const v = fieldValue(f,r[f.key]); if (!v) return; dl.appendChild(node('dt','',f.label)); dl.appendChild(node('dd','',v));
          }); record.appendChild(dl); box.appendChild(record);
        });
      }
      return box;
    }
    function currentAiInput(input) {
      return !!input && !!aiInput && !dirty && !conflict && input.serial === serial && input.revision === revision &&
        input.generation === aiInput.generation && JSON.stringify(input.ids) === JSON.stringify(aiSelection) &&
        JSON.stringify(input.payload) === JSON.stringify(aiInput.payload);
    }
    function currentAiRequest(request) {
      return alive && aiPending === request && request.generation === aiGeneration && aiReviewed && currentAiInput(request.input);
    }
    function renderAiIfVisible() { if (alive && section === 'ai') renderContent(); }
    async function generateAi() {
      if (aiPending) return;
      if (!aiReviewed) return message('כדי לשלוח למודל, אפשר לעיין במידע ולאשר שהוא מתאים לשליחה.', true);
      if (!currentAiInput(aiInput)) return message('הנתונים השתנו. אפשר לשמור ולבחון שוב את המידע לשליחה.', true);
      const request = {input:clone(aiInput),generation:++aiGeneration,started:Date.now()};
      aiPending = request; aiError = ''; suggestions = []; aiResultInput = null; aiChosen = new Set();
      renderAiIfVisible();
      request.timer = setInterval(() => {
        if (!alive || aiPending !== request || section !== 'ai') return;
        const wait = content.querySelector('[data-ai-wait]');
        if (wait) wait.textContent = 'כתיבת הטיוטה נמשכת כשתי דקות. חלפו ' + Math.floor((Date.now() - request.started)/1000) + ' שניות.';
      }, 1000);
      try {
        const check = value => { try { validateSuggestions(value, request.input.ids); return true; } catch (e) { return false; } };
        const result = await options.completeJson(M.AI_SYSTEM || M.aiSystem(), [{role:'user',content:JSON.stringify(request.input.payload)}], 6000, true, check);
        if (!currentAiRequest(request)) return;
        suggestions = validateSuggestions(result, request.input.ids).map(s => ({...s,id:uid(),origin:'ai',state:'draft',approvedBy:'',note:''}));
        aiResultInput = request.input; aiChosen = new Set(suggestions.map(s => s.id));
        message(suggestions.length ? 'התקבלו טיוטות לעיון. הן עדיין לא נוספו לממצאי הצוות.' : 'המודל לא הציע ממצאים חדשים. אפשר להמשיך בבירור הצוות.');
      } catch (e) {
        if (currentAiRequest(request)) {
          aiError = 'לא התקבלה טיוטה תקינה. ' + e.message + '. אפשר לנסות שוב. לא נוסף ממצא למרחב.';
          message(aiError, true);
        }
      } finally {
        clearInterval(request.timer);
        if (aiPending === request) { aiPending = null; renderAiIfVisible(); }
      }
    }
    function ai() {
      content.appendChild(node('h2', '', 'פרשנות בעזרת AI'));
      content.appendChild(node('p', '', 'המודל יכול להציע חוזקות, פערים ושאלות על סמך ראיות שנבחרו ונשמרו. הוא מציג טיוטה עם הפניות ואי ודאות. הצוות בוחן את ההצעה ומקבל את ההחלטות. לא מחושבים ציונים ולא מתקבלת החלטת הסמכה.'));
      if (dirty || conflict) {
        content.appendChild(node('p', 'jws-error', 'כדי לעיין במידע העדכני לשליחה, אפשר לשמור את השינויים תחילה. במקרה של גרסאות שונות, אפשר לייצא עותק ולטעון את הגרסה האחרונה.'));
        if (suggestions.length) showSuggestions(content);
        return;
      }
      if (!saved.evidence.length) { content.appendChild(node('p', 'muted', 'אפשר לתעד ראיות לפני פנייה למודל. בלי ראיות לא מופקת טיוטת פרשנות.')); return; }
      const picks = node('fieldset', 'jws-checks'); picks.appendChild(node('legend', '', 'בחירת הראיות לשליחה')); content.appendChild(picks);
      saved.evidence.forEach(e => {
        const l = node('label', 'jws-check'), check = node('input'); check.type = 'checkbox'; check.value = e.id; check.checked = aiSelection.includes(e.id);
        check.addEventListener('change', () => {
          const ids = new Set(aiSelection); if (check.checked) ids.add(e.id); else ids.delete(e.id);
          aiSelection = saved.evidence.filter(e => ids.has(e.id)).map(e => e.id); resetAiInput(); renderAiIfVisible();
        });
        l.appendChild(check); l.appendChild(node('span', '', (e.title || 'ראיה ללא שם') + ' (' + e.id + ')')); picks.appendChild(l);
      });
      content.appendChild(button('הצגת המידע לשליחה', () => {
        const ids = aiSelection.slice();
        if (!ids.length || !saved.evidence.some(e => ids.includes(e.id) && e.details.trim())) return message('אפשר לבחור לפחות ראיה אחת שיש בה תיאור של מה שנצפה.', true);
        resetAiInput(); aiInput = {ids,payload:aiPayload(ids),serial,revision,generation:aiGeneration}; renderAiIfVisible();
      }, true));
      if (aiInput) {
        const previewArea = node('div'); previewArea.appendChild(previewFacts(aiInput.payload));
        previewArea.appendChild(node('p', 'muted', 'זה המידע שיישלח, ללא שדה שם האדם במאגר התפקידים. אפשר לבדוק שגם תיאורים חופשיים והפניות אינם חושפים מידע אישי רגיש, ולחזור לעריכה לפני השליחה. המידע ישמש גם לבקרת התוצר הקיימת במערכת.'));
        const l = node('label', 'jws-check'), reviewed = node('input'); reviewed.type = 'checkbox'; reviewed.checked = aiReviewed;
        reviewed.addEventListener('change', () => { aiReviewed = reviewed.checked; if (!aiReviewed) cancelAiRequest(); renderAiIfVisible(); });
        l.appendChild(reviewed); l.appendChild(node('span', '', 'המידע נבדק ומתאים לשליחה למודל')); previewArea.appendChild(l);
        const generate = button('בקשת טיוטת פרשנות', generateAi); generate.disabled = !!aiPending || !currentAiInput(aiInput); previewArea.appendChild(generate);
        if (aiPending) {
          const wait = node('p', 'muted', 'כתיבת הטיוטה נמשכת כשתי דקות. חלפו ' + Math.floor((Date.now()-aiPending.started)/1000) + ' שניות.');
          wait.dataset.aiWait = '1'; previewArea.appendChild(wait);
        }
        if (!currentAiInput(aiInput)) previewArea.appendChild(node('p', 'jws-error', 'המידע השתנה מאז התצוגה הזאת. אפשר להציג ולבדוק שוב את המידע לשליחה.'));
        content.appendChild(previewArea);
      }
      if (aiError) content.appendChild(node('p', 'jws-error', aiError));
      if (suggestions.length) showSuggestions(content);
    }
    function showSuggestions(parent) {
      const old = parent.querySelector('.jws-suggestions'); if (old) old.remove();
      const resultInput = aiResultInput, resultSuggestions = suggestions;
      const box = node('div', 'jws-suggestions'); box.appendChild(node('h3', '', 'טיוטות לעיון'));
      const current = currentAiInput(resultInput);
      if (!current) box.appendChild(node('p', 'jws-error', 'הטיוטות נשמרו לעיון, אך המידע השתנה מאז שנכתבו. אפשר לבחון את המידע העדכני ולבקש טיוטה חדשה לפני הוספה.'));
      suggestions.forEach(s => {
        const article = node('article', 'jws-suggestion'); const l = node('label', 'jws-check'); const check = node('input'); check.type = 'checkbox'; check.checked = aiChosen.has(s.id);
        check.addEventListener('change', () => { if (check.checked) aiChosen.add(s.id); else aiChosen.delete(s.id); });
        l.appendChild(check); l.appendChild(node('strong', '', s.title)); article.appendChild(l);
        article.appendChild(node('p', '', s.interpretation)); article.appendChild(node('p', '', 'אי ודאות: ' + s.uncertainty)); article.appendChild(node('p', 'muted', 'ראיות: ' + s.evidenceIds.map(id => labelFor('evidence', id)).join('; '))); box.appendChild(article);
      });
      const add = button('הוספת הטיוטות שנבחרו', () => {
        if (resultInput !== aiResultInput || resultSuggestions !== suggestions || !currentAiInput(resultInput)) return message('הנתונים השתנו. אפשר לבחון שוב את המידע העדכני לפני הוספת טיוטות.', true);
        const chosen = suggestions.filter(s => aiChosen.has(s.id));
        if (data.findings.length + chosen.length > 80) return message('מספר הממצאים חורג ממגבלת 80 הרשומות. אפשר לבחור פחות טיוטות.', true);
        if (!chosen.length) return message('אפשר לבחור טיוטה אחת או יותר להוספה.');
        data.findings.push(...clone(chosen)); suggestions = []; aiResultInput = null; aiChosen = new Set(); changed(); section = 'findings'; selected.findings = chosen[0].id; renderContent();
        message('הטיוטות נוספו במצב טיוטה. אפשר לערוך, לאשר במפורש או לדחות, ואז לשמור את השינויים.');
      }); add.disabled = !current; box.appendChild(add); parent.appendChild(box);
    }
    function renderContent() {
      content.textContent = ''; nav.querySelectorAll('button').forEach(b => { if (b.dataset.section === section) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
      if (section === 'overview') overview();
      else if (section === 'context') { content.appendChild(node('h2', '', 'מסגרת התהליך')); content.appendChild(node('p', '', 'אפשר לקבוע יחד גבולות, מטרה, מה רוצים לשמר, סמכות הצוות, מפגשי העבודה וכללי התיעוד.')); if (guidance.context) content.appendChild(node('p', '', guidance.context)); M.CONTEXT_FIELDS.forEach(f => content.appendChild(fieldControl(f, data.context, 'context'))); }
      else if (section === 'ai') ai();
      else { const s = sections.find(s => s.key === section); if (s) records(s); }
    }
    renderContent();
    return {canLeave,acceptMetadataRevision,destroy() { alive = false; cancelAiRequest(); window.removeEventListener('beforeunload', beforeUnload); shell.remove(); },isDirty:() => dirty};
  }
  window.SBE_WORKSPACE_UI = {mount};
})();
