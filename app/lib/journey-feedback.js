(function (root) {
  'use strict';
  const A = root.SBE_JOURNEY_ANALYSIS;
  const PRINT_CSS = '.jrf{direction:rtl;line-height:1.65}.jrf h2,.jrf h3,.jrf h4{border:0!important;padding-inline-start:0}.jrf p,.jrf li,.jrf td,.jrf th,.jrf summary{white-space:pre-wrap;overflow-wrap:anywhere}.jrf table{width:100%;table-layout:fixed;border-collapse:collapse;margin:8px 0 16px}.jrf th,.jrf td{border:1px solid #CDD3D8;padding:7px;vertical-align:top;text-align:right}.jrf th{width:30%;background:#eef3f6}.jrf td{width:70%}.jrf-card,.jrf-option,.jrf-source{margin:12px 0}.jrf summary{font-weight:700;list-style:none}.jrf summary::marker{display:none}.jrf-note{font-size:.92em}.jrf-details{margin:10px 0}';
  const labels = {
    strength:'חוזקה', gap:'פער במידע שנבדק', question:'שאלה לבירור', tension:'מתח או סתירה',
    existence:'קיום', realization:'מימוש', renewal:'התחדשות',
    preserve:'שימור', verify:'בירור', trial:'התנסות מוגבלת', change:'שינוי', defer:'דחייה מנומקת',
    draft:'טרם הושלמה התייחסות', accepted:'הצוות מקבל את הממצא', edited:'הצוות מתקן את הממצא', rejected:'הצוות דוחה את הממצא',
    enable:'אפשור', regulate:'הסדרה', coordinate:'תיאום', mediate:'תיווך', meaning:'יצירת משמעות', preservePrinciple:'שימור והעברה', renew:'שינוי והתארגנות מחדש'
  };
  let nextId = 0;
  function dateText(value) {
    if (!value) return '';
    const iso = value.slice(0,10);
    return root.sbeDateIL ? root.sbeDateIL(iso) : iso.replace(/^(\d{4})-(\d{2})-(\d{2})$/,(_,year,month,date)=>date + '.' + month + '.' + year.slice(2));
  }
  function el(tag, text, cls) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function append(parent, ...nodes) { nodes.filter(Boolean).forEach(n => parent.appendChild(n)); return parent; }
  function line(parent, title, value) {
    if (value === '' || value === undefined || value === null) return;
    const block = el('div', undefined, 'jrf-line');
    append(block, el('dt', title), el('dd', String(value))); parent.appendChild(block);
  }
  function fields(parent, values) {
    const dl = el('dl', undefined, 'jrf-fields');
    values.forEach(([title, value]) => line(dl, title, value));
    if (dl.children.length) parent.appendChild(dl);
  }
  function details(title, print) {
    const node = el('details', undefined, 'jrf-details'); node.open = !!print;
    node.appendChild(el('summary', title)); return node;
  }
  function list(parent, title, values) {
    if (!values.length) return;
    const box = el('div', undefined, 'jrf-list'); box.appendChild(el('h4', title));
    const ul = el('ul'); values.forEach(v => ul.appendChild(el('li', v))); append(parent, append(box, ul));
  }
  function day() {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const p = Object.fromEntries(parts.map(x => [x.type,x.value])); return p.year + '-' + p.month + '-' + p.day;
  }
  function control(parent, title, type, value, options) {
    const id = 'jrf-' + (++nextId);
    const box = el('div', undefined, 'jrf-control'), label = el('label', title); label.htmlFor = id;
    const node = el(type === 'select' ? 'select' : type === 'textarea' ? 'textarea' : 'input'); node.id = id;
    if (node.tagName === 'INPUT') node.type = type;
    if (options) options.forEach(([key,text]) => { const option = el('option', text); option.value = key; node.appendChild(option); });
    node.value = value || ''; if (type !== 'select' && type !== 'date') node.maxLength = 4000;
    append(parent, append(box, label, node)); return node;
  }
  function button(parent, title, action) {
    const node = el('button', title, 'btn-secondary'); node.type = 'button'; node.addEventListener('click', action); parent.appendChild(node); return node;
  }
  function readable(input, section, field, value) {
    if (field.type === 'date') return dateText(value);
    if (field.type === 'refs') return value.map(id => input[field.target].find(x => x.id === id)?.title || id).join(' · ');
    if (field.type === 'select') return field.options.find(x => x.value === value)?.label || value;
    if (field.type === 'multi') return value.map(x => x === 'preserve' ? labels.preservePrinciple : labels[x] || x).join(' · ');
    return value;
  }
  function sources(parent, input, ids, title, print) {
    if (!ids.length) return;
    const box = details(title, print);
    ids.forEach(id => {
      const evidence = input.evidence.find(x => x.id === id);
      const card = el('section', undefined, 'jrf-source'); card.appendChild(el('h4', evidence.title || 'ראיה ללא כותרת'));
      fields(card, A.INPUT_FIELDS.evidence.map(f => [f.label,readable(input,'evidence',f,evidence[f.key])]));
      box.appendChild(card);
    }); parent.appendChild(box);
  }
  function references(parent, input, refs) {
    list(parent, 'פריטים במיפוי שנבדק', refs.map(ref => {
      const title = input[ref.section].find(x => x.id === ref.id)?.title || ref.id;
      return A.INPUT_SECTIONS.find(x => x.key === ref.section).label + ': ' + title;
    }));
  }
  function responseForm(parent, snapshot, finding, opts) {
    const previous = snapshot.responses.find(x => x.findingId === finding.id) || {};
    const box = details('התייחסות הצוות', opts.print);
    if (opts.readOnly) {
      fields(box, [['עמדת הצוות',labels[previous.state] || 'טרם תועדה התייחסות'],['תגובת הצוות',previous.comment],['נימוק לקדימות',previous.priorityReason],['הסתייגויות',previous.disagreement],['מי בחנו בצוות',previous.reviewedBy],['מועד הבחינה',dateText(previous.reviewedAt)]]);
    } else {
      const state = control(box,'עמדת הצוות','select',previous.state || 'draft',['draft','accepted','edited','rejected'].map(x => [x,labels[x]]));
      const comment = control(box,'תגובת הצוות','textarea',previous.comment);
      const reason = control(box,'נימוק לקדימות','textarea',previous.priorityReason);
      const dissent = control(box,'הסתייגויות','textarea',previous.disagreement);
      const reviewer = control(box,'מי בחנו בצוות','text',previous.reviewedBy);
      const date = control(box,'מועד הבחינה','date',previous.reviewedAt?.slice(0,10) || day());
      const status = el('p', '', 'jrf-status'); status.setAttribute('role','status');
      const value = desired => ({findingId:finding.id,state:desired,comment:comment.value.trim(),priorityReason:reason.value.trim(),disagreement:dissent.value.trim(),reviewedBy:reviewer.value.trim(),reviewedAt:date.value});
      function record(desired, explicit) {
        if (explicit && desired !== 'draft' && !reviewer.value.trim()) { status.textContent = 'יש לציין מי בחנו בצוות לפני תיעוד עמדה.'; return; }
        if (explicit && ['edited','rejected'].includes(desired) && !comment.value.trim()) { status.textContent = 'יש לתעד את התיקון או את נימוק הדחייה בתגובת הצוות.'; return; }
        try { opts.onResponse?.(finding.id,value(desired)); status.textContent = explicit ? 'ההתייחסות תועדה במרחב. שמירת המרחב תשמור אותה במערכת.' : 'טיוטת ההתייחסות עודכנה; העמדה דורשת תיעוד מפורש.'; }
        catch (error) { status.textContent = error.message || 'ההתייחסות לא תועדה.'; }
      }
      [comment,reason,dissent,reviewer].forEach(node => node.addEventListener('input', () => record('draft',false)));
      date.addEventListener('change', () => record('draft',false));
      state.addEventListener('change', () => record('draft',false));
      button(box,'תיעוד ההתייחסות',() => record(state.value,true)); box.appendChild(status);
      box.appendChild(el('p','קבלת ממצא אינה אישור החלטה או פעולה.','jrf-note'));
    }
    parent.appendChild(box);
  }
  function findingView(snapshot, finding, opts) {
    const card = el('section', undefined, 'jrf-card');
    append(card, el('p',labels[finding.kind],'jrf-kind'),el('h3',finding.title));
    const detail = details('הראיות והניתוח',opts.print);
    fields(detail,[['מה תועד',finding.observation],['פירוש אפשרי',finding.interpretation],['מה עדיין לא ודאי',finding.uncertainty],['משמעות אפשרית לאיכות החיים בהווה',finding.presentImplication],['משמעות אפשרית למוכנות לעתיד',finding.futureImplication],['זוויות בחינה מקבילות',finding.lenses.map(x => labels[x]).join(' · ')]]);
    list(detail,'הסברים חלופיים',finding.alternativeExplanations);
    references(detail,snapshot.input,finding.entityRefs);
    sources(detail,snapshot.input,finding.evidenceIds,'ראיות שעליהן נשען הממצא',opts.print);
    sources(detail,snapshot.input,finding.contradictingEvidenceIds,'ראיות שמאתגרות את הפירוש',opts.print);
    append(card,detail); responseForm(card,snapshot,finding,opts); return card;
  }
  function priorityView(snapshot, priority, opts) {
    const card = el('section',undefined,'jrf-card'); card.appendChild(el('h3',priority.title));
    const detail = details('החלופות ושיקולי הבחירה',opts.print);
    fields(detail,[['מדוע לשקול כעת',priority.whyNow],['שיקולי קדימות',priority.criteria],['אי ודאות',priority.uncertainty]]);
    list(detail,'ממצאים קשורים',priority.findingIds.map(id => snapshot.output.findings.find(f => f.id === id).title));
    references(detail,snapshot.input,priority.entityRefs);
    sources(detail,snapshot.input,priority.evidenceIds,'ראיות לשיקולי הקדימות',opts.print);
    priority.options.forEach(option => {
      const block = el('section',undefined,'jrf-option'); block.appendChild(el('h4',option.title));
      fields(block,[['סוג החלופה',labels[option.kind]],['ההיגיון בבחירה',option.rationale],['תנאים לבדיקה',option.conditions],['עלות, עומס או ויתור אפשרי',option.costs],['צעד ראשון מוצע',option.firstStep],['תפקידים מוצעים לדיון',option.suggestedRoles.join(' · ')],['משאבים מוצעים לבדיקה',option.resources]]); detail.appendChild(block);
    });
    if (!opts.readOnly && opts.onDraft) {
      const choice=opts.choiceDrafts?.[priority.id] || {};
      const select = control(detail,'החלופה שנבחרה לדיון','select',choice.optionId,[['','יש לבחור חלופה'],...priority.options.map(x => [x.id,x.title])]);
      const reason = control(detail,'נימוק הצוות לבחירה','textarea',choice.reason);
      select.addEventListener('change',()=>opts.onChoice?.(priority.id,{optionId:select.value,reason:reason.value}));
      reason.addEventListener('input',()=>opts.onChoice?.(priority.id,{optionId:select.value,reason:reason.value}));
      const status = el('p','','jrf-status'); status.setAttribute('role','status');
      function draft(kind) {
        if (!select.value || !reason.value.trim()) { status.textContent = 'יש לבחור חלופה ולתעד את נימוק הצוות.'; return; }
        try { opts.onDraft(priority.id,select.value,kind,reason.value.trim()); status.textContent = 'נוצרה טיוטה לעיון הצוות. נדרשים דיון, סמכות ואישור מפורשים.'; }
        catch (error) { status.textContent = error.message || 'הטיוטה לא נוצרה.'; }
      }
      const bar = el('div',undefined,'jrf-buttons'); button(bar,'יצירת טיוטת החלטה',()=>draft('decision')); button(bar,'יצירת טיוטת פעולה',()=>draft('action')); append(detail,bar,status);
      if (opts.onDiscardChoice) button(bar,'הסרת טיוטת הבחירה',()=>{
        if (!opts.onDiscardChoice(priority.id)) return;
        select.value=''; reason.value=''; status.textContent='טיוטת הבחירה הוסרה.';
      });
      if (opts.onChoice) detail.appendChild(el('p','הבחירה והנימוק נשמרים זמנית כל עוד המסע פתוח, ונכללים בייצוא. לשמירה בשרת יש ליצור טיוטת החלטה או פעולה ולשמור את השינויים.','jrf-note'));
      detail.appendChild(el('p','התפקידים והמשאבים הם הצעות לדיון. החלטת הצוות המוסמך היא הבסיס למינוי בעלי אחריות, להקצאת משאבים ולאישור התכנית.','jrf-note'));
    }
    card.appendChild(detail); return card;
  }
  function comparison(parent, previous, current, title, print) {
    const change = A.compareInputs(previous,current), box = details(title,print);
    box.appendChild(el('p',change.membershipMeaning,'jrf-note'));
    fields(box,[['בחירת הראיות',change.selection.changed ? 'השתנתה' : 'ללא שינוי'],['ראיות קודם',change.selection.previous.join(' · ') || 'ללא ראיות'],['ראיות כעת',change.selection.current.join(' · ') || 'ללא ראיות'],['כיסוי המידע',change.coverage.changed ? 'השתנה' : 'ללא שינוי'],['המסגרת',change.unit.changed ? 'השתנתה' : 'ללא שינוי'],['תקופת המיפוי',change.period.changed ? 'השתנתה' : 'ללא שינוי']]);
    change.context.changedFields.forEach(key=>{
      const field = A.INPUT_FIELDS.context.find(f=>f.key===key);
      const block=el('section'); block.appendChild(el('h4',field.label));
      fields(block,[['קודם',readable(previous,'context',field,change.context.previous[key]) || 'לא תועד'],['כעת',readable(current,'context',field,change.context.current[key]) || 'לא תועד']]); box.appendChild(block);
    });
    A.INPUT_SECTIONS.forEach(section => {
      const s = change.sections[section.key];
      list(box,section.label + ' שנכללו כעת בתמונה הנבחרת',s.included.map(x=>x.title || x.id));
      list(box,section.label + ' שאינם כלולים כעת בתמונה הנבחרת',s.excluded.map(x=>x.title || x.id));
      if (change.coverage.changed) fields(box,[[section.label + ' בתמונה הקודמת',change.coverage.previous.selectedRecords[section.key] + ' מתוך ' + change.coverage.previous.totalRecords[section.key]],[section.label + ' בתמונה הנוכחית',change.coverage.current.selectedRecords[section.key] + ' מתוך ' + change.coverage.current.totalRecords[section.key]]]);
      s.changed.forEach(item=>{
        const block=el('section'); block.appendChild(el('h4',(item.title || item.id) + ': שדות שהשתנו'));
        const before=previous[section.key].find(x=>x.id===item.id), after=current[section.key].find(x=>x.id===item.id);
        item.fields.forEach(key=>{
          const field=A.INPUT_FIELDS[section.key].find(f=>f.key===key);
          if (!field) return;
          fields(block,[[field.label + ' קודם',readable(previous,section.key,field,before[key]) || 'לא תועד'],[field.label + ' כעת',readable(current,section.key,field,after[key]) || 'לא תועד']]);
        }); box.appendChild(block);
      });
    }); parent.appendChild(box);
  }
  function render(value, options) {
    const snapshot = A.cleanAnalysis(value), opts = options || {}, report = snapshot.output;
    const host = el('article',undefined,'jrf'); host.dir = 'rtl';
    append(host,el('h2','משוב לצוות'),el('p',snapshot.input.unit.label + ' · ' + (A.UNIT_KINDS.find(x=>x.value===snapshot.input.unit.kind)?.label || '') + ' · ' + dateText(snapshot.createdAt),'jrf-note'));
    if (opts.historical) host.appendChild(el('p','זהו דוח המבוסס על תמונת מידע קודמת. הראיות וההפניות מוצגות כפי שנשמרו בעת הניתוח.','jrf-notice'));
    const summary = el('section',undefined,'jrf-summary'); append(summary,el('h3','תמצית לצוות'),el('p',report.summary.overview),el('p',report.summary.limits,'jrf-notice'));
    fields(summary,[['הראיות שנבחרו',snapshot.input.coverage.selectedEvidence + ' מתוך ' + snapshot.input.coverage.totalEvidence],['תחילת תקופת המיפוי',dateText(snapshot.input.context.periodStart)],['סיום תקופת המיפוי',dateText(snapshot.input.context.periodEnd)],['קולות שטרם נשמעו',snapshot.input.context.missingVoices]]); host.appendChild(summary);
    host.appendChild(el('p','המשוב מציע פירושים ושאלות לדיון על בסיס המידע שנבחר. אין בו הוכחה סיבתית, מדד חוסן מאומת או החלטת הסמכה.','jrf-note'));
    const key = new Set(report.summary.keyFindingIds);
    report.summary.keyFindingIds.forEach(id=>host.appendChild(findingView(snapshot,report.findings.find(x=>x.id===id),opts)));
    const extra = report.findings.filter(x=>!key.has(x.id));
    if (extra.length) { const box=details('ממצאים נוספים',opts.print); extra.forEach(x=>box.appendChild(findingView(snapshot,x,opts))); host.appendChild(box); }
    if (report.network.length) {
      const box=details('בחינת רשת המנגנונים',opts.print);
      report.network.forEach(item=>{ const card=el('section',undefined,'jrf-card'); append(card,el('h3',item.title)); fields(card,[['סוגיה לבחינה',item.concern],['אי ודאות',item.uncertainty]]); references(card,snapshot.input,item.entityRefs); sources(card,snapshot.input,item.evidenceIds,'ראיות לרשת המנגנונים',opts.print); box.appendChild(card); }); host.appendChild(box);
    }
    if (report.missingInformation.length) {
      const box=details('מידע שכדאי להשלים',opts.print);
      report.missingInformation.forEach(item=>{ const card=el('section',undefined,'jrf-card'); append(card,el('h3',item.question),el('p',item.why)); references(card,snapshot.input,item.entityRefs); sources(card,snapshot.input,item.evidenceIds,'מקורות לשאלה',opts.print); box.appendChild(card); }); host.appendChild(box);
    }
    if (report.priorities.length) { host.appendChild(el('h3','במה לשקול להתחיל')); report.priorities.forEach(x=>host.appendChild(priorityView(snapshot,x,opts))); }
    if (opts.baselineInput) comparison(host,opts.baselineInput,snapshot.input,'השוואה לנקודת המוצא שנבחרה',opts.print);
    else if (snapshot.baselineId) host.appendChild(el('p','דוח נקודת המוצא אינו זמין כעת; ייתכן שנמחק במפורש.','jrf-note'));
    if (opts.currentInput && opts.historical) comparison(host,snapshot.input,opts.currentInput,'מה השתנה בתמונת המידע הנוכחית',opts.print);
    const inputBox=details('תמונת המידע שעליה מבוסס הדוח',opts.print);
    fields(inputBox,A.INPUT_FIELDS.context.map(f=>[f.label,readable(snapshot.input,'context',f,snapshot.input.context[f.key])]));
    A.INPUT_SECTIONS.forEach(section=>{
      const box=details(section.label + ' (' + snapshot.input[section.key].length + ')',opts.print);
      snapshot.input[section.key].forEach(record=>{const card=el('section',undefined,'jrf-source'); card.appendChild(el('h4',record.title || record.id)); fields(card,A.INPUT_FIELDS[section.key].map(f=>[f.label,readable(snapshot.input,section.key,f,record[f.key])])); box.appendChild(card);}); inputBox.appendChild(box);
    }); host.appendChild(inputBox);
    if (!opts.readOnly && opts.onDelete) { const box=el('div',undefined,'jrf-buttons'); button(box,'מחיקת הדוח השמור',opts.onDelete); host.appendChild(box); }
    if (opts.print) host.querySelectorAll('dl.jrf-fields').forEach(dl=>{
      const table=el('table'), body=el('tbody'); table.appendChild(body);
      Array.from(dl.children).forEach(line=>{
        const row=el('tr'), title=el('th',line.querySelector('dt').textContent); title.scope='row';
        append(row,title,el('td',line.querySelector('dd').textContent)); body.appendChild(row);
      }); dl.replaceWith(table);
    });
    return host;
  }
  root.SBE_JOURNEY_FEEDBACK = {render,PRINT_CSS};
})(typeof window !== 'undefined' ? window : this);
