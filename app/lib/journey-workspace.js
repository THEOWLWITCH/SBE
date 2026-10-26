(function () {
  'use strict';
  const M = window.SBE_JOURNEY_WORKSPACE;
  const A = window.SBE_JOURNEY_ANALYSIS;
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
    if (!M || !A) throw new Error('מודל מרחב העבודה לא נטען');
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
    let section = 'context', selected = Object.create(null), serial = 0, alive = true;
    let aiInput = null, analysisDraft = null, status, saveButton, conflictBox, content;
    let aiSelection = [], aiReviewed = false, aiPending = null, aiGeneration = 0, aiError = '', reloadGeneration = 0;
    let activeAnalysisId = '', baselineId = '';
    const removedAnalysisIds = new Set();
    const shell = node('div', 'jws'); host.appendChild(shell);
    const sections = M.SECTIONS;
    function message(text, error) { status.textContent = text; status.className = 'jws-status' + (error ? ' jws-error' : ''); }
    function changed() {
      serial++; dirty = true; cancelAiRequest(); saveButton.disabled = busy || conflict;
      message('יש שינויים שעדיין לא נשמרו בשרת');
    }
    function hasUnsaved() { return dirty || !!analysisDraft || !!aiPending; }
    function canLeave() { return !hasUnsaved() || window.confirm('יש שינויים או טיוטות שעדיין לא נשמרו. להמשיך בלי לשמור? אפשר להישאר ולבחון את הטיוטות או לשמור את העבודה.'); }
    function beforeUnload(event) { if (hasUnsaved()) { event.preventDefault(); event.returnValue = ''; } }
    function cancelAiRequest() {
      aiGeneration++;
      if (aiPending && aiPending.timer) clearInterval(aiPending.timer);
      if (aiPending && content) {
        const wait = content.querySelector('[data-ai-wait]');
        if (wait) wait.textContent = 'הבקשה הקודמת הופסקה בעקבות שינוי. אפשר לשמור ולבחון שוב את המידע.';
      }
      aiPending = null;
    }
    function resetAiInput() {
      cancelAiRequest(); aiInput = null; aiReviewed = false; aiError = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    function exportData() {
      download({format:'begood-resilience-workspace', version:2, journeyId:journey.id, unit:journey.unit || 'other', unitName:journey.unitName || '', revision, exportedAt:new Date().toISOString(), unsaved:hasUnsaved(), workspace:data, unsavedAnalysis:analysisDraft}, 'begood-workspace-' + journey.id + '.json');
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
      });
      const analysis = data.analyses.find(a => a.id === activeAnalysisId) || data.analyses[data.analyses.length - 1];
      if (analysis && window.SBE_JOURNEY_FEEDBACK) root.appendChild(SBE_JOURNEY_FEEDBACK.render(analysis,{readOnly:true,print:true,historical:isHistorical(analysis),currentInput:currentInputFor(analysis),baselineInput:baselineFor(analysis)}));
      return root;
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
      const removals = [...removedAnalysisIds].filter(id => saved.analyses.some(a => a.id === id) && !snapshot.analyses.some(a => a.id === id));
      busy = true; saveButton.disabled = true; message('שמירה בשרת...');
      try {
        const result = await options.api('jrSaveWorkspace', {id:journey.id, revision:requestRevision, workspace:snapshot, removedAnalysisIds:removals});
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
        removals.forEach(id => removedAnalysisIds.delete(id));
        [...removedAnalysisIds].filter(id => !saved.analyses.some(a => a.id === id)).forEach(id => removedAnalysisIds.delete(id));
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
        dirty = false; conflict = false; conflictRevision = null; resetAiInput(); aiSelection = []; analysisDraft = null; activeAnalysisId = ''; baselineId = ''; removedAnalysisIds.clear(); conflictBox.hidden = true; saveButton.disabled = true;
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
    const steps = [
      {key:'context',label:'מסגרת ושותפים',sections:['context']},
      {key:'inventories',label:'ארבעת המיפויים',sections:['roles','mechanisms','infrastructures','resources']},
      {key:'depth',label:'מנגנון ומקרה ממשי',sections:['mechanisms','evidence']},
      {key:'network',label:'רשת המנגנונים',sections:['links']},
      {key:'analysis',label:'ניתוח ושיחת צוות',sections:['ai','findings']},
      {key:'learning',label:'פעולה ולמידה',sections:['decisions','actions','reviews']}
    ];
    let activeStep = 'context';
    function navigate(key, step) {
      section = key; activeStep = step || (steps.find(s => s.sections.includes(key)) || {}).key || '';
      renderContent();
      if (!dirty && !conflict) message('המידע שנשמר בשרת. גרסה ' + revision);
    }
    const nav = node('nav', 'jws-tabs jws-steps no-print'); nav.setAttribute('aria-label', 'שלבי המסע'); shell.appendChild(nav);
    steps.forEach((s,index) => {
      const b = button((index + 1) + '. ' + s.label, () => navigate(s.sections[0],s.key), true);
      b.dataset.step = s.key; nav.appendChild(b);
    });
    const direct = node('details','jws-all-sections no-print'); direct.appendChild(node('summary','','גישה ישירה לתיעוד'));
    const directNav = node('nav','jws-tabs'); directNav.setAttribute('aria-label','גישה ישירה לכל הרשומות'); direct.appendChild(directNav); shell.appendChild(direct);
    const tabs = [{key:'overview', label:'מבט על המסע'}, {key:'context',label:'מסגרת התהליך'}, ...sections, {key:'ai',label:'ניתוח ומשוב'}];
    tabs.forEach(s => { const b = button(s.label, () => navigate(s.key), true); b.dataset.section = s.key; directNav.appendChild(b); });
    content = node('section', 'card jws-content'); shell.appendChild(content);
    const essential = {
      context:['goal','preserve','scope','population','groups','periodStart','periodEnd','participants','missingVoices','baseline','baselineAt','mandate','delegation'],
      roles:['title','authority','time','backup','knowledgeState','updatedBy','updatedAt','evidenceIds'],
      mechanisms:['title','purpose','participants','activation','knowledgeState','updatedBy','updatedAt','evidenceIds'],
      infrastructures:['title','availability','access','owner','knowledgeState','updatedBy','updatedAt','evidenceIds'],
      resources:['title','availability','access','owner','knowledgeState','updatedBy','updatedAt','evidenceIds'],
      evidence:['title','kind','source','observedAt','details','limits'],
      links:['title','from','to','type','status','operators','conditions','actualFlow','evidenceIds'],
      findings:['title','kind','evidenceIds','interpretation','uncertainty','state','approvedBy'],
      decisions:['title','alternatives','reason','criteria','evidenceIds','authority','owner','approvedBy','reviewAt'],
      actions:['title','decisionId','owner','backup','partners','authority','resources','stopDoing','presentOutcome','futureOutcome','processEvidence','outcomeEvidence','reviewAt','status'],
      reviews:['title','actionId','observedAt','evidenceIds','learned','presentChange','futureChange','unintended','next']
    };
    function fields(parent, key, schema, record, prefix) {
      const first = node('div','jws-fields'); parent.appendChild(first);
      const extra = node('details','jws-depth'); extra.appendChild(node('summary','','הרחבה ופרטים נוספים'));
      const deeper = node('div','jws-fields'); extra.appendChild(deeper);
      const sourceFields = ['analysisId','priorityId','optionId'];
      schema.filter(f => !sourceFields.includes(f.key)).forEach(f => {
        const main = essential[key].includes(f.key) || key === 'mechanisms' && activeStep === 'depth' && ['existence','realization','renewal'].includes(f.key);
        (main ? first : deeper).appendChild(fieldControl(f.key === 'title' ? {...f,label:'שם הרשומה'} : f,record,prefix));
      });
      if (deeper.children.length) parent.appendChild(extra);
      if (record.analysisId) {
        const source = data.analyses.find(a => a.id === record.analysisId);
        if (source) parent.appendChild(button('פתיחת ניתוח המקור והחלופות',() => { activeAnalysisId = source.id; navigate('ai','analysis'); },true));
        else parent.appendChild(node('p','muted','ניתוח המקור ' + record.analysisId + ' אינו זמין. ייתכן שהוסר במפורש. הטיוטה נשארת לאישור אנושי.'));
      }
    }
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
    function overview(parent) {
      parent.appendChild(node('h2', '', 'מה עושים עם המיפוי'));
      parent.appendChild(node('p', '', 'אפשר להתחיל בהגדרת המטרה וצוות החוסן, להצליב את ארבעת המאגרים עם ראיות, ולבחון את רשת המנגנונים. לאחר בירור משותף מתעדים החלטה, בוחרים שינוי אחד או שניים, מגדירים אחריות ומשאבים, וחוזרים ללמוד מן התוצאות.'));
      if (guidance.context) parent.appendChild(node('p', '', guidance.context));
      const grid = node('div', 'jws-counts'); parent.appendChild(grid);
      sections.slice(0,4).forEach(s => { const item = node('div'); item.appendChild(node('strong', '', data[s.key].length)); item.appendChild(node('span', '', s.label)); grid.appendChild(item); });
      parent.appendChild(node('h3', '', 'שלוש זוויות בחינה מקבילות'));
      parent.appendChild(node('p', '', 'קיום: מה זמין ומוסכם. מימוש: מה מופעל בפועל, עבור מי ובאילו תנאים. התחדשות: מה נלמד, נשמר ומשתנה. אלה אינן מדרגות או רמות דירוג.'));
      parent.appendChild(node('p','','מחויבות משותפת, אחריות מבוזרת, שימוש במנגנונים תוך בחינה ושיפור, ולמידה מתמשכת מכוונים את ההתבוננות. אלה אינם סולמות מדידה מתוקפים.'));
      parent.appendChild(node('p','','תודעת חוסן רב ערוצית נוגעת לזירות הפרט, המשפחה, העמיתים, בית הספר, הקהילה והרשות. היא עשויה לארגן ציפיות ופעולה כמנגנון בפני עצמו. גם מעגל למידה יוזם עשוי להיות מנגנון. הצעת מדדים מפורטים תפותח בהמשך.'));
      parent.appendChild(node('h3', '', 'מה שומר על איכות ההחלטה'));
      const list = node('ul'); ['הבחנה בין תצפית, פרשנות, אי ודאות והחלטה. חוסר במידע נותר שאלה לבירור.', 'בחינה של איכות החיים בהווה לצד מוכנות לעתיד, סולידריות, אתוס והעצמת השותפים. בבית הספר נבחנת גם העצמת מורים; בקהילה נבחנת גם השפעת תושבים ומתנדבים.', 'בחירת סדר עדיפות לפי חשיבות, הוגנות, השפעה על הרשת, ישימות, זמן ומשאבים, תוך תיעוד מחלוקת והנמקה.', 'מעקב אחר תוצאות, עומס, השלכות לא צפויות והחלטה מה לשמר, לשנות או להפסיק.'].forEach(t => list.appendChild(node('li', '', t))); parent.appendChild(list);
    }
    function sectionIntro(key) {
      return {
        roles:'אפשר לתעד את צוות החוסן, בעלי הסמכות, מי שמובילים את התהליך, מי שמרכזים ראיות וקשרים, ואת הגיבוי והזמן שהוקצו לכל תפקיד. מינוי לבדו אינו מוכיח מימוש.',
        mechanisms:'מנגנון חברתי הוא רכיב או הסדר בעל תפקיד מארגן במערכת חברתית, חומרי או בלתי חומרי, יציב או דינמי, שביכולתו להסדיר, לאפשר, לכוון או לחולל יחסים ופעולות בין בני אדם. באמצעות תפקידו במערכת הוא עשוי להשפיע על תפקודה, על עיצוב האתוס והתרבות המשותפת, ועל המשכיותה והתפתחותה לאורך זמן.',
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
      if (s.key === 'mechanisms') {
        content.appendChild(node('p','','מנגנונים עשויים ליצור משאבים חדשים, לשנות קשרים, לשמר יכולות ולארגן מחדש את החברה כשהתנאים משתנים. אפשר להתחיל במנגנון אחד ולהעמיק בהדרגה.'));
        content.appendChild(node('p','muted','שבעת עקרונות הפעולה מתארים כיצד המנגנון מארגן פעולה. שבע האיכויות מתארות את תנאי פעולתו בנפרד. קיום, מימוש והתחדשות הן זוויות בחינה מקבילות. אין צורך למלא הכול, ומידע שלא נבדק אינו חולשה.'));
      }
      if (s.key === 'evidence') content.appendChild(node('p','','אפשר להעמיק במקרה ממשי: באיזה הקשר, מה עורר פעולה, מה נעשה ומה קרה לאחריה. בהרחבה נשמרים גם אופן האיסוף, קולות חסרים ועדויות שאינן תואמות.'));
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
      fields(content,s.key,s.fields,record,record.id);
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
    function inputUnit() { return {kind:journey.unit || 'other',label:journey.unitName || unitLabel}; }
    function factValue(input, field, value) {
      if (Array.isArray(value)) {
        if (!value.length) return 'לא נבחרו פריטים';
        if (field.type === 'refs') return value.map(id => {
          const record = input[field.target].find(r => r.id === id);
          return (record && record.title || 'רשומה ללא שם') + ' (' + id + ')';
        }).join('; ');
        const choices = field.options || (field.key === 'principles' ? M.PRINCIPLES : []);
        return value.map(v => (choices.find(o => o.value === v) || {}).label || v).join('; ');
      }
      if (field.type === 'select') return ((field.options || []).find(o => o.value === value) || {}).label || value || 'לא תועד';
      return value || 'לא תועד';
    }
    function previewFacts(input) {
      const box = node('div','jws-input-review');
      box.appendChild(node('h3','','כל המידע לעיון לפני שליחה'));
      box.appendChild(node('p','','גרסת מבנה המידע: ' + input.version + '. סוג המסגרת: ' + input.unit.label + ' (' + input.unit.kind + ').'));
      const context = node('dl');
      A.INPUT_FIELDS.context.forEach(f => { context.appendChild(node('dt','',f.label)); context.appendChild(node('dd','',factValue(input,f,input.context[f.key]))); });
      box.appendChild(context);
      box.appendChild(node('p','','מזהי הראיות שנבחרו: ' + input.selectedEvidenceIds.join(', ')));
      box.appendChild(node('p','','כיסוי הראיות: ' + input.coverage.selectedEvidence + ' שנבחרו מתוך ' + input.coverage.totalEvidence + ' מתועדות. אלה מספרי תיעוד, ולא ציון חוסן.'));
      A.INPUT_SECTIONS.forEach(s => {
        box.appendChild(node('h4','',s.label));
        box.appendChild(node('p','','נכללים במידע: ' + input.coverage.selectedRecords[s.key] + ' מתוך ' + input.coverage.totalRecords[s.key] + ' במרחב.'));
        box.appendChild(node('p','muted','פריטים שנוספו להבנת ההקשר: ' + (input.contextualClosure[s.key].join(', ') || 'אין') + '. עצם ההכללה אינה ראיה לפעולה.'));
        input[s.key].forEach(r => {
          const article = node('article','jws-suggestion');
          article.appendChild(node('strong','',(r.title || 'רשומה ללא שם') + ' (' + r.id + ')'));
          const dl = node('dl');
          A.INPUT_FIELDS[s.key].forEach(f => { dl.appendChild(node('dt','',f.label)); dl.appendChild(node('dd','',factValue(input,f,r[f.key]))); });
          article.appendChild(dl); box.appendChild(article);
        });
      });
      return box;
    }
    function currentInputFor(analysis) {
      try {
        const ids = analysis.input.selectedEvidenceIds.filter(id => data.evidence.some(e => e.id === id));
        return A.buildInput(data,inputUnit(),ids);
      } catch (e) { return null; }
    }
    function isHistorical(analysis) {
      const current = currentInputFor(analysis);
      return !current || JSON.stringify(current) !== JSON.stringify(analysis.input);
    }
    function baselineFor(analysis) {
      const baseline = data.analyses.find(a => a.id === analysis.baselineId);
      return baseline ? baseline.input : null;
    }
    function comparison(parent, previous, current) {
      const diff = A.compareInputs(previous,current);
      const box = node('details','jws-comparison'); box.appendChild(node('summary','','השוואת המידע שנבדק בין שתי תמונות המצב'));
      box.appendChild(node('p','',diff.membershipMeaning));
      const change = value => value ? 'השתנה' : 'ללא שינוי';
      box.appendChild(node('p','','בחירת הראיות: ' + change(diff.selection.changed) + '. הראיות קודם: ' + (diff.selection.previous.join(', ') || 'אין') + '; כעת: ' + (diff.selection.current.join(', ') || 'אין') + '.'));
      box.appendChild(node('p','','כיסוי המידע: ' + change(diff.coverage.changed) + '. סוג המסגרת: ' + change(diff.unit.changed) + '. תקופת המיפוי: ' + change(diff.period.changed) + '.'));
      if (diff.unit.changed) box.appendChild(node('p','','מסגרת קודמת: ' + diff.unit.previous.label + ' (' + diff.unit.previous.kind + '). מסגרת נוכחית: ' + diff.unit.current.label + ' (' + diff.unit.current.kind + ').'));
      const counts = node('ul');
      A.INPUT_SECTIONS.forEach(s => counts.appendChild(node('li','',s.label + ': קודם ' + diff.coverage.previous.selectedRecords[s.key] + ' מתוך ' + diff.coverage.previous.totalRecords[s.key] + '; כעת ' + diff.coverage.current.selectedRecords[s.key] + ' מתוך ' + diff.coverage.current.totalRecords[s.key] + '.')));
      box.appendChild(counts);
      diff.context.changedFields.forEach(key => {
        box.appendChild(node('h4','',A.FIELD_LABELS.context[key]));
        box.appendChild(node('p','','קודם: ' + (diff.context.previous[key] || 'לא תועד')));
        box.appendChild(node('p','','כעת: ' + (diff.context.current[key] || 'לא תועד')));
      });
      A.INPUT_SECTIONS.forEach(s => {
        const changes = diff.sections[s.key];
        if (!changes.included.length && !changes.excluded.length && !changes.changed.length) return;
        box.appendChild(node('h4','',s.label));
        const list = node('ul');
        changes.included.forEach(r => list.appendChild(node('li','','נכלל כעת בתמונת המצב: ' + (r.title || r.id) + ' (' + r.id + ')')));
        changes.excluded.forEach(r => list.appendChild(node('li','','אינו נכלל כעת בתמונת המצב: ' + (r.title || r.id) + ' (' + r.id + ')')));
        changes.changed.forEach(r => {
          const li = node('li','',(r.title || r.id) + ' (' + r.id + '): ' + r.fields.map(k => A.FIELD_LABELS[s.key][k] || k).join(', '));
          const values = node('dl');
          r.fields.forEach(key => {
            const f = A.INPUT_FIELDS[s.key].find(f => f.key === key) || {key,label:'מזהה'};
            const before = previous[s.key].find(x => x.id === r.id), after = current[s.key].find(x => x.id === r.id);
            values.appendChild(node('dt','',f.label));
            values.appendChild(node('dd','','קודם: ' + factValue(previous,f,before[key]) + '. כעת: ' + factValue(current,f,after[key])));
          }); li.appendChild(values); list.appendChild(li);
        }); box.appendChild(list);
      });
      parent.appendChild(box);
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
    function progress(request) {
      return (request.stage === 'audit' ? 'בחינת הטיוטה מול אותו מידע שנבדק.' : 'הכנת ניתוח על בסיס המידע שנבדק.') + ' חלפו ' + Math.floor((Date.now() - request.started)/1000) + ' שניות מתחילת הבקשה.';
    }
    async function generateAi() {
      if (aiPending) return;
      if (!aiReviewed) return message('כדי לשלוח למודל, אפשר לעיין במידע ולאשר שהוא מתאים לשליחה.',true);
      if (!currentAiInput(aiInput)) return message('הנתונים השתנו. אפשר לשמור ולבחון שוב את המידע לשליחה.',true);
      if (analysisDraft) return message('טיוטת ניתוח עדיין פתוחה. אפשר לשמור אותה בניתוחי הצוות או להסיר אותה במפורש לפני בקשה חדשה.',true);
      const request = {input:clone(aiInput),baselineId,generation:++aiGeneration,started:Date.now(),stage:'draft'};
      aiPending = request; aiError = ''; renderAiIfVisible();
      request.timer = setInterval(() => {
        if (!alive || aiPending !== request || section !== 'ai') return;
        const wait = content.querySelector('[data-ai-wait]'); if (wait) wait.textContent = progress(request);
      },1000);
      try {
        const check = value => { try { A.validateReport(value,request.input.payload); return true; } catch (e) { return false; } };
        const first = await options.completeJson(A.AI_SYSTEM,[{role:'user',content:JSON.stringify(request.input.payload)}],16000,true,check);
        if (!currentAiRequest(request)) return;
        const draft = A.validateReport(first,request.input.payload);
        request.stage = 'audit'; renderAiIfVisible();
        const audited = await options.completeJson(A.AUDIT_SYSTEM,[{role:'user',content:JSON.stringify({reviewedInput:request.input.payload,draft})}],16000,true,check);
        if (!currentAiRequest(request)) return;
        const output = A.validateReport(audited,request.input.payload);
        analysisDraft = A.cleanAnalysis({id:uid(),createdAt:new Date().toISOString(),sourceRevision:request.input.revision,baselineId:request.baselineId,input:request.input.payload,output,responses:[]});
        message('התקבלה טיוטת ניתוח לאחר בחינה מול המידע. אפשר לעיין בה ולשמור אותה בניתוחי הצוות. הפרשנות וההצעות נשארות לבחינה אנושית.');
      } catch (e) {
        if (currentAiRequest(request)) {
          aiError = 'לא התקבל ניתוח תקין בשני שלבי הבדיקה. ' + e.message + '. המידע נשאר במרחב ואפשר לנסות שוב. לא נשמר דוח ולא נוספו החלטות.';
          message(aiError,true);
        }
      } finally {
        clearInterval(request.timer);
        if (aiPending === request) { aiPending = null; renderAiIfVisible(); }
      }
    }
    function requestDraft(analysis,priorityId,optionId,kind,reason) {
      try {
        const decision = A.draftFromPriority(analysis,priorityId,optionId,'decision',reason);
        if (decision.evidenceIds.some(id => !data.evidence.some(e => e.id === id))) throw Error('חלק מראיות ניתוח המקור אינן קיימות עוד במיפוי. אפשר לעיין בניתוח ההיסטורי ולעדכן את המיפוי לפני יצירת טיוטה מקושרת.');
        if (!['decision','action'].includes(kind)) throw Error('סוג טיוטה לא נתמך');
        if (data.decisions.length >= 80 || kind === 'action' && data.actions.length >= 80) throw Error('מספר הרשומות בחלק זה הגיע למגבלת השמירה. אפשר לבחון עם הצוות את התיעוד לפני הוספת טיוטה.');
        const candidate = clone(data); decision.id = uid(); candidate.decisions.push(decision);
        let action;
        if (kind === 'action') {
          action = {...A.draftFromPriority(analysis,priorityId,optionId,'action',reason),id:uid(),decisionId:[decision.id]};
          candidate.actions.push(action);
        }
        data = M.clean(candidate); changed();
        selected[kind === 'action' ? 'actions' : 'decisions'] = action ? action.id : decision.id;
        navigate(kind === 'action' ? 'actions' : 'decisions','learning');
        message('נוספה טיוטה לפי בקשת הצוות. אחריות, סמכות ומשאבים נשארו פתוחים להחלטה אנושית. אפשר לערוך ולשמור את השינויים.');
      } catch (e) { message('הטיוטה לא נוספה: ' + e.message,true); throw e; }
    }
    function renderAnalysis(parent, analysis, pending) {
      if (!window.SBE_JOURNEY_FEEDBACK) { parent.appendChild(node('p','jws-error','תצוגת הניתוח לא נטענה. המידע נשאר במרחב ואפשר לייצא עותק.')); return; }
      const settings = {historical:isHistorical(analysis),currentInput:currentInputFor(analysis),baselineInput:baselineFor(analysis),readOnly:!!pending};
      if (!pending) {
        settings.onResponse = (findingId,response) => {
          if (!alive) return;
          const current = data.analyses.find(a => a.id === analysis.id); if (!current) return;
          try {
            const responses = current.responses.filter(r => r.findingId !== findingId).concat({...response,findingId});
            current.responses = A.cleanAnalysis({...current,responses}).responses; changed();
          } catch (e) { message('התגובה עדיין לא נשמרה: ' + e.message,true); throw e; }
        };
        settings.onDraft = (priorityId,optionId,kind,reason) => requestDraft(analysis,priorityId,optionId,kind,reason);
        settings.onDelete = () => {
          if (!window.confirm('להסיר את הניתוח ואת תמונת המידע ההיסטורית שלו? ההסרה תישמר בשרת לאחר שמירת השינויים. אפשר לבטל.')) return;
          removedAnalysisIds.add(analysis.id); data.analyses = data.analyses.filter(a => a.id !== analysis.id);
          activeAnalysisId = ''; changed(); renderAiIfVisible(); message('הניתוח הוסר מקומית. אפשר לשמור את השינויים כדי להסיר אותו גם מהשרת.');
        };
      }
      parent.appendChild(SBE_JOURNEY_FEEDBACK.render(analysis,settings));
    }
    function savedAnalyses() {
      const box = node('section','jws-analysis-history'); content.appendChild(box);
      box.appendChild(node('h3','','ניתוחים ושיחת צוות'));
      box.appendChild(node('p','muted','כל ניתוח שומר את המידע המדויק שנבחן באותו מועד. אפשר לפתוח ניתוח קודם גם כשהמיפוי השתנה, לתעד תגובה או להסיר ניתוח במפורש.'));
      if (!data.analyses.length) { box.appendChild(node('p','muted','טרם נשמרו ניתוחים. אפשר לפתוח מחזור ניתוח חדש בהמשך המסך.')); return; }
      const chooser = node('select'); chooser.setAttribute('aria-label','בחירת ניתוח לעיון');
      data.analyses.forEach(a => {
        const o = node('option','',a.createdAt.slice(0,10) + ' · גרסה ' + a.sourceRevision + ' · ' + (a.input.context.periodStart || 'תחילה לא תועדה') + ' עד ' + (a.input.context.periodEnd || 'סיום לא תועד'));
        o.value = a.id; chooser.appendChild(o);
      });
      const analysis = data.analyses.find(a => a.id === activeAnalysisId) || data.analyses[data.analyses.length - 1];
      activeAnalysisId = analysis.id; chooser.value = analysis.id;
      chooser.addEventListener('change',() => { activeAnalysisId = chooser.value; renderAiIfVisible(); }); box.appendChild(chooser);
      if (!saved.analyses.some(a => a.id === analysis.id)) box.appendChild(node('p','jws-notice','הניתוח נוסף לעבודה המקומית. שמירת השינויים בראש המסך תשמור אותו בשרת.'));
      if (analysis.baselineId && !baselineFor(analysis)) box.appendChild(node('p','jws-notice','תמונת המצב שנבחרה כבסיס השוואה אינה זמינה. ייתכן שהניתוח הקודם הוסר.'));
      renderAnalysis(box,analysis,false);
    }
    function ai() {
      content.appendChild(node('h2','','ניתוח הממצאים ושיחת צוות'));
      content.appendChild(node('p','','תמצית ברורה תחילה, עם אפשרות לפתוח את הראיות, ההסברים החלופיים, המחלוקות ואי הוודאות. ההצעות עוברות בחינה נוספת מול אותו מידע, ואז הצוות דן ומחליט. אין כאן ציון חוסן, הוכחת סיבתיות או הסמכה.'));
      savedAnalyses();
      if (analysisDraft) {
        const draft = node('section','jws-analysis-draft'); content.appendChild(draft);
        draft.appendChild(node('h3','','טיוטת ניתוח שעדיין לא נשמרה'));
        renderAnalysis(draft,analysisDraft,true);
        draft.appendChild(button('שמירת הניתוח בניתוחי הצוות',() => {
          if (data.analyses.length >= A.MAX_ANALYSES) return message('אפשר לשמור עד ' + A.MAX_ANALYSES + ' ניתוחים. אפשר לייצא עותק ולבחור במפורש ניתוח להסרה לפני שמירה נוספת.',true);
          data.analyses.push(clone(analysisDraft)); activeAnalysisId = analysisDraft.id; analysisDraft = null; changed(); renderAiIfVisible();
          message('הניתוח נוסף לעבודה המקומית. אפשר לתעד תגובות ולשמור את השינויים בראש המסך כדי לשמרו בשרת.');
        }));
        draft.appendChild(button('הסרת הטיוטה שלא נשמרה',() => {
          if (!window.confirm('להסיר את טיוטת הניתוח שלא נשמרה? אפשר לבטל ולעיין בה או לשמור אותה קודם.')) return;
          analysisDraft = null; renderAiIfVisible();
        },true));
      }
      content.appendChild(node('h3','','מחזור ניתוח חדש'));
      if (guidance.context) content.appendChild(node('p','',guidance.context));
      content.appendChild(node('p','muted','אפשר לבחור מעט ראיות רלוונטיות ולהרחיב בהמשך. מידע שלא נבחר אינו משמש בסיס לניתוח, ופרשנויות קודמות אינן ראיות.'));
      if (dirty || conflict) {
        content.appendChild(node('p','jws-error','כדי לבחון את המידע העדכני לשליחה, אפשר לשמור את השינויים תחילה. ניתוחים קיימים נשארים פתוחים לעיון. במקרה של פער גרסאות אפשר לייצא עותק ולטעון את הגרסה האחרונה.'));
        return;
      }
      if (!saved.evidence.length) { content.appendChild(node('p','muted','אפשר לתעד ראיות לפני פנייה למודל. בלי ראיות לא מופק ניתוח.')); return; }
      const baselineLabel = node('label','','תמונת מצב קודמת להשוואה, לפי בחירת הצוות'); baselineLabel.htmlFor = 'jws-baseline'; content.appendChild(baselineLabel);
      const baseline = node('select'); baseline.id = 'jws-baseline';
      const noBaseline = node('option','','ללא תמונת מצב קודמת'); noBaseline.value = ''; baseline.appendChild(noBaseline);
      data.analyses.forEach(a => { const o = node('option','',a.createdAt.slice(0,10) + ' · גרסה ' + a.sourceRevision + ' (' + a.id + ')'); o.value = a.id; baseline.appendChild(o); });
      if (!data.analyses.some(a => a.id === baselineId)) baselineId = '';
      baseline.value = baselineId; baseline.addEventListener('change',() => { baselineId = baseline.value; cancelAiRequest(); renderAiIfVisible(); }); content.appendChild(baseline);
      const picks = node('fieldset','jws-checks'); picks.appendChild(node('legend','','בחירת הראיות לשליחה')); content.appendChild(picks);
      saved.evidence.forEach(e => {
        const l = node('label','jws-check'), check = node('input'); check.type = 'checkbox'; check.value = e.id; check.checked = aiSelection.includes(e.id);
        check.addEventListener('change',() => {
          const ids = new Set(aiSelection); if (check.checked) ids.add(e.id); else ids.delete(e.id);
          aiSelection = saved.evidence.filter(e => ids.has(e.id)).map(e => e.id); resetAiInput(); renderAiIfVisible();
        }); l.appendChild(check); l.appendChild(node('span','',(e.title || 'ראיה ללא שם') + ' (' + e.id + ')')); picks.appendChild(l);
      });
      content.appendChild(button('הצגת המידע לשליחה',() => {
        const ids = aiSelection.slice();
        if (!ids.length || !saved.evidence.some(e => ids.includes(e.id) && e.details.trim())) return message('אפשר לבחור לפחות ראיה אחת שיש בה תיאור של מה שנצפה.',true);
        try { resetAiInput(); aiInput = {ids,payload:A.buildInput(saved,inputUnit(),ids),serial,revision,generation:aiGeneration}; renderAiIfVisible(); }
        catch (e) { message('המידע עדיין לא מוכן לשליחה: ' + e.message,true); }
      },true));
      if (aiInput) {
        const preview = node('details','jws-exact-preview'); preview.open = true;
        preview.appendChild(node('summary','','עיון במידע המדויק שיישלח')); preview.appendChild(previewFacts(aiInput.payload)); content.appendChild(preview);
        const before = data.analyses.find(a => a.id === baselineId); if (before) comparison(content,before.input,aiInput.payload);
        content.appendChild(node('p','muted','שדה שם האדם במאגר התפקידים אינו נשלח. גם תיאורים חופשיים והפניות עשויים להכיל מידע אישי. אפשר לעיין בכל המידע ולחזור לעריכה לפני שליחה. אותו מידע נשלח גם בשלב בחינת הטיוטה.'));
        const l = node('label','jws-check'), reviewed = node('input'); reviewed.type = 'checkbox'; reviewed.checked = aiReviewed; reviewed.dataset.aiReviewed = '1';
        reviewed.addEventListener('change',() => { aiReviewed = reviewed.checked; if (!aiReviewed) cancelAiRequest(); renderAiIfVisible(); });
        l.appendChild(reviewed); l.appendChild(node('span','','המידע נבדק ומתאים לשליחה למודל')); content.appendChild(l);
        const generate = button('בקשת ניתוח ומשוב',generateAi); generate.dataset.aiGenerate = '1'; generate.disabled = !!aiPending || !aiReviewed || !currentAiInput(aiInput) || !!analysisDraft; content.appendChild(generate);
        if (aiPending) { const wait = node('p','jws-ai-progress',progress(aiPending)); wait.dataset.aiWait = '1'; wait.setAttribute('role','status'); content.appendChild(wait); }
        if (!currentAiInput(aiInput)) content.appendChild(node('p','jws-error','המידע השתנה מאז התצוגה הזאת. אפשר להציג ולבדוק שוב את המידע לשליחה.'));
      }
      if (aiError) content.appendChild(node('p','jws-error',aiError));
    }
    function renderContent() {
      content.textContent = '';
      nav.querySelectorAll('button').forEach(b => { if (b.dataset.step === activeStep) b.setAttribute('aria-current','step'); else b.removeAttribute('aria-current'); });
      directNav.querySelectorAll('button').forEach(b => { if (b.dataset.section === section) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
      const currentStep = steps.find(s => s.key === activeStep);
      if (currentStep) {
        content.appendChild(node('p','jws-step-label','שלב ' + (steps.indexOf(currentStep) + 1) + ' מתוך ' + steps.length + ': ' + currentStep.label));
        if (currentStep.sections.length > 1) {
          const subnav = node('nav','jws-subnav no-print'); subnav.setAttribute('aria-label','חלקים בשלב ' + currentStep.label);
          currentStep.sections.forEach(key => {
            const label = key === 'ai' ? 'ניתוח ומשוב' : sections.find(s => s.key === key).label;
            const b = button(label,() => navigate(key,currentStep.key),true); b.dataset.subsection = key;
            if (key === section) b.setAttribute('aria-current','page'); subnav.appendChild(b);
          }); content.appendChild(subnav);
        }
      }
      if (section === 'overview') overview(content);
      else if (section === 'context') {
        content.appendChild(node('h2','','מסגרת התהליך ושותפים'));
        content.appendChild(node('p','','אפשר לקבוע יחד מטרה, גבולות, תקופה, קבוצות וקולות שעדיין לא נשמעו. המנדט וחלוקת האחריות מסבירים מה אפשר להציע ומי מוסמכים להחליט. אפשר להתחיל במה שידוע ולהשאיר סימן שאלה במה שטרם נבדק.'));
        if (guidance.context) content.appendChild(node('p','',guidance.context));
        fields(content,'context',M.CONTEXT_FIELDS,data.context,'context');
        const intro = node('details','jws-explain'); intro.appendChild(node('summary','','כיווני ההתבוננות לאורך המסע'));
        overview(intro);
        content.appendChild(intro);
      } else if (section === 'ai') ai();
      else { const s = sections.find(s => s.key === section); if (s) records(s); }
      if (currentStep) {
        const footer = node('div','jws-step-navigation no-print'), index = steps.indexOf(currentStep);
        if (index) footer.appendChild(button('לשלב הקודם: ' + steps[index - 1].label,() => navigate(steps[index - 1].sections[0],steps[index - 1].key),true));
        if (index < steps.length - 1) footer.appendChild(button('לשלב הבא: ' + steps[index + 1].label,() => navigate(steps[index + 1].sections[0],steps[index + 1].key),true));
        content.appendChild(footer);
      }
    }
    renderContent();
    return {canLeave,acceptMetadataRevision,destroy() { alive = false; cancelAiRequest(); window.removeEventListener('beforeunload', beforeUnload); shell.remove(); },isDirty:() => dirty};
  }
  window.SBE_WORKSPACE_UI = {mount};
})();
