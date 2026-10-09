(function () {
  "use strict";
  const T = window.SBE_TEAM, D = window.SBE_DOC;
  const $ = id => document.getElementById(id);
  const BASE = "sbe.team-lab.v1";
  const PHASES = T.PHASES;
  const STAGES = ["התכנון", "הפעילות", "החזרה עם עמיתים", "הלמידה מהמפגש"];
  const clone = value => JSON.parse(JSON.stringify(value));
  const text = value => Array.isArray(value) ? value.join(" · ") : String(value ?? "");
  const lines = value => String(value || "").split(/\n|,/).map(x => x.trim()).filter(Boolean);
  const ownerKey = () => window.sbeUserKey(BASE);
  const identity = () => sessionStorage.getItem("sbe.session.token") || "";
  const initialOwner = ownerKey(), initialIdentity = identity();
  let ws, ready = false, persistedRevision = 0, stage = 0, conflict = false;
  let saveTimer, saving, saveAgain = false, activeRun, waitTimer, generated = false;
  const proposals = new Map(), formValues = {}, selectedMoves = new Set();
  const repository = T.createRepository({storage:localStorage,ownerKey,locks:navigator.locks});
  const work = window.SBE_PLANNER.createWork(() => ({revision:ws?.revision,owner:ownerKey(),token:identity(),context:ws?.context}));

  function node(tag, content, className) {
    const n = document.createElement(tag);
    if (content !== undefined) n.textContent = content;
    if (className) n.className = className;
    return n;
  }
  function button(label, action, primary) {
    const b = node("button",label,primary ? "lab-primary" : ""); b.type = "button";
    b.addEventListener("click",() => attempt(action)); return b;
  }
  function attempt(fn) {
    try { const result = fn(); if (result?.catch) result.catch(showError); return result; }
    catch (error) { showError(error); }
  }
  function message(value, error = false) {
    $("lab-message").textContent = value; $("lab-message").hidden = !value;
    $("lab-message").dataset.error = String(error);
  }
  function showError(error) { message(error?.message || "הפעולה לא הושלמה. אפשר לנסות שוב; הנוסח נשאר כאן.",true); }
  function assertOwner() {
    if (!ready) throw new Error("העבודה הפרטית עדיין לא נפתחה. אפשר לנסות לפתוח אותה שוב.");
    if (ownerKey() !== initialOwner || identity() !== initialIdentity) {
      work.invalidate(); throw new Error("הכניסה למערכת השתנתה. רעננו את הדף כדי להמשיך בחשבון הנוכחי.");
    }
  }
  function invalidate() { work.invalidate(); proposals.clear(); }
  function change(mutator) {
    assertOwner(); invalidate(); ws = T.update(ws,mutator);
    ["safety","privacy","professional"].forEach(k => { $("lab-check-" + k).checked = false; });
    updateDanger();
    queueSave();
  }
  function updateDanger() {
    $("lab-danger").hidden = !ws?.context.immediateDanger;
    ["lab-generate","lab-regenerate","lab-approve"].forEach(id => { $(id).disabled = !!ws?.context.immediateDanger || !!activeRun; });
  }
  function queueSave() {
    $("lab-save-status").textContent = conflict ? "יש שינוי בלשונית אחרת. הטיוטה שלכם נשארת כאן." : "יש שינויים בטיוטה. שומרים במכשיר…";
    clearTimeout(saveTimer); if (!conflict) saveTimer = setTimeout(() => attempt(save),650);
  }
  async function save() {
    assertOwner(); clearTimeout(saveTimer);
    if (conflict) throw new Error("הגרסה השמורה השתנתה. אפשר לפתוח אותה או לשלב בה את הטיוטה שלכם.");
    if (saving) { saveAgain = true; await saving; return; }
    if (ws.revision === persistedRevision && persistedRevision !== 0) return;
    const snapshot = clone(ws), expectedRevision = persistedRevision;
    $("lab-save-status").textContent = "שומרים את הטיוטה במכשיר…";
    saving = repository.save(snapshot,{expectedRevision}).then(saved => {
      assertOwner(); persistedRevision = saved.revision;
      $("lab-save-status").textContent = ws.revision === persistedRevision ? "נשמר במכשיר הזה · גרסה " + persistedRevision : "יש שינוי נוסף בטיוטה. שומרים…";
    }).catch(error => {
      conflict = true; $("lab-reload").hidden = false;
      $("lab-save-status").textContent = "השמירה לא הושלמה. הטיוטה שלכם נשארת כאן.";
      throw error;
    });
    try { await saving; } finally {
      saving = null;
      if (!conflict && (saveAgain || ws.revision !== persistedRevision)) { saveAgain = false; queueSave(); }
    }
  }
  function draft(key) { return ws.private.threads["draft_" + key]?.[0]?.content || ""; }
  function setDraft(key, value) {
    if (draft(key) === value) return;
    change(w => { w.private.threads["draft_" + key] = [{role:"user",content:value}]; });
  }
  function readForm(key) {
    if (!formValues[key]) {
      try { formValues[key] = JSON.parse(draft("form_" + key) || "{}"); }
      catch { formValues[key] = {}; }
    }
    return formValues[key];
  }
  function setForm(key, name, value) {
    const form = readForm(key); form[name] = value; setDraft("form_" + key,JSON.stringify(form));
  }
  function field(label, value, onInput, options = {}) {
    const wrap = node("label",undefined,"lab-field" + (options.wide ? " lab-wide" : ""));
    wrap.append(node("span",label));
    const input = node(options.options ? "select" : options.short ? "input" : "textarea");
    if (options.options) {
      input.dataset.closed = "true";
      options.options.forEach(item => { const o = node("option",item.label); o.value = item.id; input.append(o); });
    } else if (options.short) { input.type = options.number ? "number" : "text"; if (options.number) { input.min = options.min ?? 1; input.max = options.max ?? 1000; } }
    else input.rows = options.rows || 2;
    if (!options.options && !options.number) input.maxLength = 8000;
    input.value = options.array && Array.isArray(value) ? value.join("\n") : text(value); input.setAttribute("aria-label",label);
    if (options.placeholder) input.placeholder = options.placeholder;
    input.addEventListener(options.options ? "change" : "input",() => attempt(() => onInput(options.number ? Number(input.value) : input.value)));
    wrap.append(input); if (options.hint) wrap.append(node("small",options.hint));
    return wrap;
  }
  function contextField(name,label,options) {
    return field(label,ws.context[name],value => {
      change(w => { w.context[name] = value;
        if (name === "audience") w.context.models = w.context.models.filter(id => T.MODELS.find(m => m.id === id)?.audiences.includes(value));
      });
      if (name === "audience") renderModels();
    },options);
  }
  function detail(label,contents) {
    const d = node("details",undefined,"lab-details"); d.append(node("summary",label));
    const box = node("div"); box.append(...contents); d.append(box); return d;
  }
  function check(label,checked,onChange) {
    const l = node("label"), i = node("input"); i.type = "checkbox"; i.checked = !!checked;
    i.addEventListener("change",() => attempt(() => onChange(i.checked))); l.append(i,node("span",label)); return l;
  }
  function renderContext() {
    const box = $("lab-context"); box.replaceChildren();
    const core = node("div",undefined,"lab-grid");
    core.append(contextField("goal","מה נרצה לעשות וליצור יחד? · שדה עיקרי",{wide:true,placeholder:"למשל, לנסח הסכמה לעזרה הדדית ולנסות אותה במשך שבוע."}),
      contextField("audience","למי מיועדת הפעילות?",{options:[{id:"students",label:"תלמידים ותלמידות"},{id:"staff",label:"צוות חינוך"}]}),
      contextField("ageBand","שכבת הגיל",{options:T.AGE_BANDS}),
      contextField("subject","תחום הליבה או התהליך הקיים",{short:true,placeholder:"למשל, מדעים או ישיבת צוות."}),
      contextField("curriculumGoal","מה נרצה ללמוד בתחום הזה?",{short:true}),
      contextField("situation","המצב כעת",{options:[{id:"routine",label:"שגרה"},{id:"emergency",label:"חירום"}]}),
      contextField("mode","איך נפגשים?",{options:T.MODES}));
    const more = node("div",undefined,"lab-grid");
    more.append(contextField("groupSize","מספר המשתתפים",{short:true,number:true,max:2000}),contextField("minutes","זמן המפגש בדקות",{short:true,number:true,max:480}),
      contextField("environment","המרחב והסביבה הזמינים",{placeholder:"מקום, חיבור, תנועה וחומרים."}),contextField("emergencyKind","אם זה חירום, מה ההקשר?",{placeholder:"תיאור קצר בלי פרטים מזהים."}),
      contextField("constraints","תנאים ומגבלות",{}),contextField("accessibility","מה יאפשר השתתפות נגישה?",{}),contextField("adultSupport","אחריות המבוגר והתמיכה הזמינה",{wide:true}));
    const danger = node("div",undefined,"lab-checks"); danger.append(check("יש כרגע סכנה גופנית מיידית",ws.context.immediateDanger,value => change(w => {w.context.immediateDanger = value;})));
    box.append(core,detail("עוד פרטים להתאמה",[more]),danger);
  }
  function sourceLinks(ids) {
    const list = node("ul");
    (ids || []).forEach(id => { const source = typeof id === "object" ? id : T.SOURCES.find(s => s.id === id); if (!source) return;
      const li = node("li"), a = node("a",source.label); a.href = source.url; a.target = "_blank"; a.rel = "noopener noreferrer"; li.append(a); list.append(li);
    }); return list;
  }
  function renderModels() {
    const box = $("lab-models"); box.replaceChildren();
    T.MODELS.filter(m => m.audiences.includes(ws.context.audience)).forEach(model => {
      const card = node("article",undefined,"lab-model");
      if (/udl/i.test(model.id)) card.append(node("span","שכבת תכנון שאפשר לשלב","lab-model-tag"));
      const label = check(model.label,ws.context.models.includes(model.id),selected => change(w => {w.context.models = selected ? [...w.context.models,model.id] : w.context.models.filter(id => id !== model.id);}));
      card.append(label,node("p",text(model.summary)));
      const d = node("details"); d.append(node("summary","התאמה, גבולות ומקורות"),node("p","מתי אפשר להשתמש: " + text(model.use)),node("p","גבולות הידע: " + text(model.limits)),sourceLinks(model.sources));
      card.append(d); box.append(card);
    });
  }
  function activityField(name,label,options) {
    return field(label,ws.activity[name],value => change(w => {w.activity[name] = options?.array ? lines(value) : value;}),options);
  }
  function stepField(id,name,label,options) {
    const step = ws.activity.steps.find(s => s.id === id);
    return field(label,step[name],value => change(w => { const current = w.activity.steps.find(s => s.id === id); if (current) current[name] = options?.array ? lines(value) : value; }),options);
  }
  function questionEditor(key, stepId) {
    const wrap = node("div",undefined,"lab-stepquestion");
    wrap.append(field("שאלה על השלב הזה",draft(key),value => setDraft(key,value),{placeholder:"מה אפשר לשנות בהנחיה או בהשתתפות כאן?"}),
      button("שליחת שאלה על השלב",() => ask(key,stepId)));
    const answer = node("div",undefined,"lab-answer"); answer.dataset.answerKey = key; wrap.append(answer); renderAnswer(key,answer); return wrap;
  }
  function renderEditor() {
    const box = $("lab-editor"); box.replaceChildren(); $("lab-approval").hidden = !ws.activity;
    if (!ws.activity) {
      const empty = node("div",undefined,"lab-empty"); empty.append(node("h3","הטיוטה תופיע כאן"),node("p","ממלאים את התכנון ובוחרים גישות, ואז בונים את הפעילות עם AI."),button("חזרה לתכנון",() => goStage(0),true)); box.append(empty); return;
    }
    const general = node("div",undefined,"lab-card"), grid = node("div",undefined,"lab-grid");
    grid.append(activityField("title","שם הפעילות",{short:true,wide:true}),activityField("purpose","מטרת הפעילות",{wide:true}),activityField("resilienceComponents","רכיבי חוסן",{array:true,hint:"כל רכיב בשורה נפרדת."}),activityField("individualSkills","מיומנויות אישיות",{array:true}),activityField("sharedSkills","מיומנויות משותפות",{array:true}),activityField("facilitationGuide","הנחיה למבוגר שמוביל",{}));
    const additions = node("div",undefined,"lab-grid");
    [["environmentPlan","התאמת הסביבה"],["uncertaintyPlan","איך עובדים כשלא יודעים עדיין"],["creativityPlan","אפשרויות ליצירה"],["conflictPlan","איך מחזיקים מחלוקת"],["participationAlternative","אפשרויות השתתפות ללא חשיפה"]].forEach(([k,l]) => additions.append(activityField(k,l,{})));
    const mechanism = node("div",undefined,"lab-grid");
    [["name","המנגנון החברתי"],["cadence","מתי חוזרים אליו"],["roles","מי אחראי ואיך מתחלפים"],["firstAction","הפעולה הראשונה"],["review","איך בודקים ומעדכנים יחד"]].forEach(([k,l]) => mechanism.append(field(l,ws.activity.socialMechanism[k],value => change(w => {w.activity.socialMechanism[k] = value;}),{short:true})));
    general.append(grid,detail("התאמות נוספות",[additions]),detail("הפעולה שהופכת לשגרה",[mechanism])); box.append(general);
    ws.activity.steps.forEach((step,index) => {
      const card = node("section",undefined,"lab-card lab-step"), head = node("div",undefined,"lab-stephead"), heading = node("div");
      heading.append(node("span","שלב " + (index + 1),"lab-stepnumber"),node("h3",step.title || "שלב לעריכה"));
      head.append(heading,button("הסרת שלב",() => {change(w => {w.activity.steps = w.activity.steps.filter(s => s.id !== step.id);}); renderEditor();}));
      const fields = node("div",undefined,"lab-grid");
      fields.append(stepField(step.id,"title","שם השלב",{short:true}),stepField(step.id,"phase","חלק במפגש",{options:PHASES.map(p => ({id:p,label:p}))}),stepField(step.id,"minutes","זמן בדקות",{short:true,number:true,min:0,max:480}),stepField(step.id,"purpose","מה השלב מאפשר",{}),stepField(step.id,"instructions","מה עושים בפועל",{wide:true,rows:3}),stepField(step.id,"facilitation","הנחיה ושאלות למנחה",{wide:true,rows:3,hint:"אפשר לציין מתי שואלים, מי שואל את מי ובשביל מה."}));
      const skillFields = node("div",undefined,"lab-grid");
      skillFields.append(stepField(step.id,"components","רכיבי החוסן בשלב",{array:true}),stepField(step.id,"individualSkills","מיומנויות אישיות בשלב",{array:true}),stepField(step.id,"sharedSkills","מיומנויות משותפות בשלב",{array:true}),stepField(step.id,"resources","עזרים ומשאבים",{}),stepField(step.id,"environment","סביבה ותנועה",{}));
      card.append(head,fields,detail("מיומנויות, סביבה ומשאבים",[skillFields]),questionEditor("step_" + step.id,step.id)); box.append(card);
    });
    box.append(button("הוספת שלב",() => {
      if (ws.activity.steps.length >= 16) throw new Error("יש כאן 16 שלבים. אפשר לערוך שלב קיים או להסיר שלב לפני הוספה.");
      change(w => {
        const step = {id:crypto.randomUUID(),title:"שלב חדש",phase:"פעילות מרכזית",minutes:5,purpose:"",instructions:"",facilitation:"",resources:"",environment:"",components:[],individualSkills:[],sharedSkills:[]};
        const closing = w.activity.steps.findIndex(s => s.phase === "סיכום" || s.phase === "אחרי המפגש");
        w.activity.steps.splice(closing < 0 ? w.activity.steps.length : closing,0,step);
      }); renderEditor();
    }));
  }
  function threadAnswer(key) { return [...(ws.private.threads[key] || [])].reverse().find(m => m.role === "assistant")?.content || ""; }
  function renderAnswer(key,box) {
    box.replaceChildren(); const answer = threadAnswer(key); if (answer) box.append(D.rich(answer));
    const proposal = proposals.get(key); if (!proposal) return;
    const card = node("div",undefined,"lab-proposal"); card.append(node("h4","הצעת שינוי לשלב אחד"),D.rich(proposal.step.instructions),D.rich(proposal.step.facilitation));
    const apply = button("אימוץ ההצעה לשלב הזה",() => {
      assertOwner();
      if (ws.revision !== proposal.revision) throw new Error("הטיוטה השתנתה מאז ההצעה. אפשר לשאול שוב על הנוסח הנוכחי.");
      const next = T.applyProposal(ws,proposal.step,{revision:proposal.revision,stepId:proposal.stepId});
      invalidate(); ws = next; queueSave(); renderEditor(); renderStageQuestion(); message("ההצעה אומצה לשלב שנבחר. אפשר לקרוא ולערוך את הנוסח.");
    }); apply.disabled = ws.revision !== proposal.revision;
    card.append(apply); box.append(card);
  }
  function renderStageQuestion() {
    const key = "stage_" + stage;
    $("lab-question-title").textContent = "שאלה על " + STAGES[stage];
    $("lab-question-hint").textContent = ["אפשר לחשוב על המטרה, הגישות וההתאמה לקבוצה.","אפשר לשאול על המהלך כולו. הצעה לשינוי שלב מבקשים ליד אותו שלב.","אפשר להכין את ההנחיה, שאלות הצפייה וחלוקת התפקידים.","אפשר לחשוב על מה שנלמד ועל הפעולה הבאה. תצפיות פרטיות אינן נשלחות בשאלה הזאת."][stage];
    $("lab-question-input").value = draft(key); renderAnswer(key,$("lab-question-answer"));
  }
  function busy(run,kind) {
    activeRun = run; const start = Date.now(); $("lab-wait").hidden = false;
    $("lab-wait-title").textContent = kind === "generate" ? "בונים את טיוטת הפעילות" : "חושבים יחד על הבקשה";
    const tick = () => { const seconds = Math.round((Date.now() - start)/1000); $("lab-wait-time").textContent = "לרוב התשובה מגיעה בתוך דקה עד שלוש דקות. עברו " + seconds + " שניות."; $("lab-progress").value = Math.min(95,seconds / 180 * 100); };
    tick(); waitTimer = setInterval(tick,1000); updateDanger();
    ["lab-ask","lab-support"].forEach(id => { $(id).disabled = true; });
  }
  function endBusy(run) {
    if (activeRun !== run) return;
    clearInterval(waitTimer); activeRun = null; $("lab-wait").hidden = true; updateDanger();
    ["lab-ask","lab-support"].forEach(id => { $(id).disabled = false; });
  }
  async function call(kind,options = {}) {
    assertOwner();
    if (ws.context.immediateDanger && kind !== "support") throw new Error("קודם מוודאים שהמצב בטוח. תכנון הפעילות מושהה בזמן סכנה מיידית.");
    if (activeRun) throw new Error("יש בקשה פעילה. אפשר להמתין או לבטל אותה לפני בקשה נוספת.");
    const request = T.buildRequest(ws,kind,options), context = clone(ws.context), run = work.start();
    busy(run,kind); message("");
    try {
      const reply = await window.sbeCallAI(window.sbeAIOrigin(),request,request.timeoutMs,{signal:run.signal});
      run.assertCurrent(); assertOwner(); return {value:T.parseReply(reply,kind,context),run};
    } catch (error) {
      if (error.name === "AbortError") message("הבקשה נעצרה. אפשר להמשיך מהנוסח הנוכחי ולנסות שוב.");
      else {
        try { await save(); } catch {}
        showError(new Error("לא התקבלה תשובה מה-AI. " + error.message + " מה שמילאתם נשאר בטיוטה; אפשר לנסות שוב."));
      }
      throw error;
    } finally { endBusy(run); }
  }
  async function generate() {
    const {value,run} = await call("generate"); run.assertCurrent();
    change(w => {w.activity = value;}); generated = true;
    renderEditor(); renderPractice(); renderLearning(); goStage(1); message("הטיוטה מוכנה לקריאה ולעריכה. האישור לקראת החזרה נמצא בסופה.");
    await save(); return value;
  }
  async function ask(key,stepId) {
    const question = draft(key).trim(); if (!question) throw new Error("כתבו שאלה קצרה כדי שנוכל לחשוב יחד.");
    const {value,run} = await call("question",{question,stepId}); run.assertCurrent();
    change(w => {const history = w.private.threads[key] || []; w.private.threads[key] = [...history,{role:"user",content:question},{role:"assistant",content:value.answer}].slice(-40);});
    if (value.proposedStep && stepId && value.proposedStep.id === stepId) proposals.set(key,{step:value.proposedStep,stepId,revision:ws.revision});
    if (stepId) { const target = [...document.querySelectorAll("[data-answer-key]")].find(n => n.dataset.answerKey === key); if (target) renderAnswer(key,target); }
    else renderStageQuestion();
    await save();
  }
  async function support() {
    if (!ws.private.concerns.trim()) throw new Error("אפשר לכתוב את החשש בתיבה הפרטית לפני בקשת התמיכה.");
    const {value,run} = await call("support"); run.assertCurrent();
    change(w => {w.private.threads.support = [...w.private.threads.support || [],{role:"assistant",content:value.answer}].slice(-40);});
    renderAnswer("support",$("lab-support-answer")); await save();
  }
  function approvalOptions() {
    return [{id:"",label:"בחרו במפורש גרסה מאושרת"},...ws.approvals.map(a => ({id:a.id,label:(a.activity.title || "פעילות") + " · גרסה " + a.revision + " · " + new Date(a.at).toLocaleDateString("he-IL")}))];
  }
  function practiceForm(kind) {
    const real = kind === "meeting", key = real ? "meeting" : "rehearsal", form = readForm(key), box = node("div");
    if (!ws.approvals.length) { box.append(node("p","כדי להתחיל, בחרו ואשרו גרסה בצעד הפעילות."),button("אל הפעילות שלנו",() => goStage(1))); return box; }
    const grid = node("div",undefined,"lab-grid"), stepHost = node("div"), preview = node("div");
    // The approval is selected by the person; there is no default latest-version selection.
    if (!ws.approvals.some(a => a.id === form.approvalId)) form.approvalId = "";
    function showSelection() {
      stepHost.replaceChildren(); preview.replaceChildren();
      const approval = ws.approvals.find(a => a.id === form.approvalId);
      if (!approval) return;
      stepHost.append(field("השלב שבו התנסינו",form.stepId || "",value => setForm(key,"stepId",value),{options:[{id:"",label:"בחרו שלב"},...approval.activity.steps.map(s => ({id:s.id,label:s.title}))]}));
      const d = detail("קריאת הגרסה המאושרת",[publicDocument(T.publicPack(ws,approval.id))]); preview.append(d);
    }
    grid.append(field("הגרסה המאושרת",form.approvalId,value => {setForm(key,"approvalId",value); setForm(key,"stepId",""); showSelection();},{options:approvalOptions()}),stepHost,
      field(real ? "מה ראינו בפועל במפגש?" : "מה ראינו בחזרה?",form.observation || "",value => setForm(key,"observation",value),{wide:true,rows:3,hint:"פעולות ורגעים מסוימים, בלי שמות, ציונים או פרטים מזהים."}),
      field("מה ננסה בפעם הבאה?",form.nextAction || "",value => setForm(key,"nextAction",value),{wide:true}));
    box.append(grid);
    if (real) { const checks = node("div",undefined,"lab-checks"); checks.append(check("זה תיעוד של מפגש אמיתי שהתקיים, ולא של חזרה",form.wasRealMeeting,value => setForm(key,"wasRealMeeting",value))); box.append(checks); }
    else box.append(node("p","אפשר להזמין עמית או עמיתה להנחות, אדם אחר להתנסות ואדם נוסף לצפות. בוחרים יחד מה לצפות ואילו שאלות לשאול בסוף.","lab-muted"));
    box.append(button(real ? "שמירת תצפית ממפגש אמיתי" : "שמירת תיעוד החזרה",async () => {
      assertOwner();
      const next = T.recordPractice(ws,{approvalId:form.approvalId,stepId:form.stepId,kind,at:new Date().toISOString(),observation:form.observation || "",nextAction:form.nextAction || "",wasRealMeeting:real && !!form.wasRealMeeting});
      invalidate(); ws = next; queueSave(); await save(); renderPractice(); renderLearning();
      message(real ? "התצפית נשמרה. אפשר לבחור מהלך לשמירה עם תנאים וגבולות." : "החזרה נשמרה. אחרי מפגש אמיתי אפשר לתעד בנפרד את מה שנצפה בו.");
    },true),preview); showSelection(); return box;
  }
  function history(records,host,label) {
    host.replaceChildren(); if (!records.length) return;
    host.append(node("h3",label)); records.slice().reverse().forEach(record => {
      const a = ws.approvals.find(x => x.id === record.approvalId), s = a?.activity.steps.find(x => x.id === record.stepId), card = node("article",undefined,"lab-record");
      card.append(node("span",record.kind === "meeting" ? "מפגש אמיתי" : "חזרה עם עמיתים","lab-badge"),node("h4",s?.title || "שלב מהגרסה המאושרת"),node("p",record.observation),node("p","בפעם הבאה: " + record.nextAction)); host.append(card);
    });
  }
  function renderPractice() { $("lab-rehearsal").replaceChildren(practiceForm("rehearsal")); history(ws.rehearsals,$("lab-rehearsal-history"),"מה למדנו בחזרות"); }
  function renderLearning() {
    $("lab-meeting").replaceChildren(practiceForm("meeting")); history(ws.observations,$("lab-observation-history"),"תצפיות שנשמרו ממפגשים");
    const box = $("lab-move"); box.replaceChildren(node("h3","שומרים מהלך שאפשר לנסות שוב"));
    const actual = ws.observations.filter(o => o.kind === "meeting");
    if (!actual.length) { box.append(node("p","אחרי שמירת תצפית ממפגש אמיתי יופיע כאן המקום לשמירת המהלך. חזרה עם עמיתים נשארת בתיעוד החזרות.")); }
    else {
      const form = readForm("move"), grid = node("div",undefined,"lab-grid");
      grid.append(field("התצפית שממנה לומדים",form.observationId || "",value => setForm("move","observationId",value),{wide:true,options:[{id:"",label:"בחרו תצפית ממפגש אמיתי"},...actual.map(o => ({id:o.id,label:new Date(o.at).toLocaleDateString("he-IL") + " · " + (ws.approvals.find(a => a.id === o.approvalId)?.activity.steps.find(s => s.id === o.stepId)?.title || "שלב")}))]}),
        field("שם המהלך שנוסה",form.title || "",value => setForm("move","title",value),{short:true,wide:true}),field("באילו תנאים הוא עשוי להתאים?",form.conditions || "",value => setForm("move","conditions",value),{}),field("מה הגבולות ומה עדיין לא ידוע?",form.limits || "",value => setForm("move","limits",value),{}));
      const checks = node("div",undefined,"lab-checks"); checks.append(check("בדקנו שהמהלך לשיתוף אינו כולל פרטים מזהים או תצפיות פרטיות",form.privacyChecked,value => setForm("move","privacyChecked",value)));
      box.append(grid,checks,button("שמירת המהלך בארכיון",async () => {
        assertOwner(); const next = T.saveMove(ws,{observationId:form.observationId,title:form.title || "",conditions:form.conditions || "",limits:form.limits || "",privacyChecked:!!form.privacyChecked});
        invalidate(); ws = next; queueSave(); await save(); renderLearning(); message("המהלך נשמר עם התנאים והגבולות שלו. אפשר לבחור אותו לתיק או למחזור הבא.");
      },true));
    }
    renderMoves(); renderExport();
  }
  function renderMoves() {
    const host = $("lab-moves"); host.replaceChildren();
    if (!ws.moves.length) host.append(node("p","עוד אין מהלכים שנוסו ונשמרו.","lab-muted"));
    ws.moves.forEach(move => {
      const card = node("article",undefined,"lab-record");
      const approved = ws.approvals.find(a => a.id === move.approvalId);
      const originalStep = approved?.activity.steps.find(s => s.id === move.step.id);
      card.append(check("לצרף לתיק: " + move.title,selectedMoves.has(move.id),checked => {if (checked) selectedMoves.add(move.id); else selectedMoves.delete(move.id);}),
        node("p","תנאים: " + move.conditions),node("p","גבולות: " + move.limits),
        detail("המהלך שנוסה וההנחיה שלו",[D.table([["מטרה",originalStep?.purpose || move.step.purpose],["מה עושים",move.step.instructions],["איך מנחים",move.step.facilitation],["סביבה ומשאבים",move.step.environment + " · " + move.step.resources]])]),
        button("תכנון המחזור הבא מהמהלך הזה",() => {
        const observation = ws.observations.find(o => o.id === move.observationId);
        change(w => { w.context.goal = observation?.nextAction || move.title; w.context.constraints = "תנאים מהניסיון הקודם: " + move.conditions + "\nגבולות: " + move.limits; w.activity = null; });
        generated = false; renderContext(); renderEditor(); goStage(0); message("נפתח תכנון למחזור הבא. הגרסאות המאושרות והניסיון הקודם נשמרו, ואפשר לבחור מחדש את הגישות.");
      })); host.append(card);
    });
  }
  function publicDocument(pack) {
    const article = node("article",undefined,"lab-doc"); article.append(node("h2",pack.activity.title));
    const c = pack.context, a = pack.activity;
    article.append(D.table([["מטרה",a.purpose],["קבוצה",(c.audience === "staff" ? "צוות חינוך" : "תלמידים ותלמידות") + " · " + (T.AGE_BANDS.find(x => x.id === c.ageBand)?.label || "")],["הקשר",c.subject + " · " + c.curriculumGoal],["מפגש",text(T.MODES.find(x => x.id === c.mode)?.label) + " · " + c.minutes + " דקות · " + (c.situation === "emergency" ? "חירום" : "שגרה")],["רכיבי חוסן",text(a.resilienceComponents)],["מיומנויות אישיות",text(a.individualSkills)],["מיומנויות משותפות",text(a.sharedSkills)],["הנחיית המבוגר",D.rich(a.facilitationGuide)]]));
    article.append(node("h3","מהלך הפעילות"),D.flowTable(a.steps.map(s => ({phase:s.phase,title:s.title,minutes:s.minutes,
      desc:D.rich(s.instructions + "\n\nמטרת השלב: " + s.purpose + "\nרכיבי חוסן: " + text(s.components) + "\nמיומנויות אישיות: " + text(s.individualSkills) + "\nמיומנויות משותפות: " + text(s.sharedSkills)),guide:D.rich(s.facilitation),res:D.rich(s.resources + "\n\nסביבה: " + s.environment)})),[["desc","תיאור הפעילות"],["guide","הנחיה למנחה והשאלות"],["res","עזרים ומשאבים"]]));
    article.append(node("h3","התאמה ושגרה"),D.table([["סביבה",a.environmentPlan],["השתתפות ללא חשיפה",a.participationAlternative],["אי ודאות",a.uncertaintyPlan],["יצירה",a.creativityPlan],["מחלוקת",a.conflictPlan],["המנגנון החברתי",a.socialMechanism.name],["תדירות",a.socialMechanism.cadence],["תפקידים",a.socialMechanism.roles],["הפעולה הראשונה",a.socialMechanism.firstAction],["בדיקה משותפת",a.socialMechanism.review]]));
    if (pack.moves?.length) {
      article.append(node("h3","מהלכים שנבחרו לשיתוף")); pack.moves.forEach(m => article.append(D.table([["מהלך שנוסה",m.title],["מטרת השלב",m.step.purpose],["מה עושים",m.step.instructions],["הנחיה",m.step.facilitation],["רכיבי חוסן",text(m.step.components)],["מיומנויות אישיות",text(m.step.individualSkills)],["מיומנויות משותפות",text(m.step.sharedSkills)],["סביבה ומשאבים",m.step.environment + " · " + m.step.resources],["תנאי התאמה",m.conditions],["גבולות",m.limits]])));
    }
    article.append(node("h3","גבולות ששומרים על המשתתפים")); const red = node("ul"); (pack.redLines || T.RED_LINES).forEach(r => red.append(node("li",typeof r === "string" ? r : r.label))); article.append(red);
    article.append(node("h3","מקורות"),node("p","המקורות מציעים בסיס לגישות. ההתאמה לפעילות הזאת היא השערת תכנון, שאותה בודקים בניסיון ובשיקול דעת מקצועי."),sourceLinks(pack.sources));
    return article;
  }
  function renderExport() {
    const box = $("lab-export"), form = readForm("export"); box.replaceChildren(); box.className = "lab-export";
    if (!ws.approvals.length) return;
    box.append(node("h3","תיק הצוות לשיתוף"),node("p","בוחרים גרסה מאושרת ומהלכים לשיתוף. החששות, השיחות והתצפיות הגולמיות אינם חלק מהתיק.","lab-muted"),field("הגרסה לתיק",form.approvalId || "",value => setForm("export","approvalId",value),{options:approvalOptions()}));
    function pack() { assertOwner(); if (!form.approvalId) throw new Error("בחרו במפורש גרסה מאושרת לתיק."); return T.publicPack(ws,form.approvalId,{moveIds:[...selectedMoves]}); }
    const actions = node("div",undefined,"lab-footeractions"); actions.append(button("הדפסה / שמירה כ-PDF",() => {const p = pack(); D.print({title:p.activity.title,kind:"תיק צוות",node:publicDocument(p),inline:true,landscape:true});}),button("ייצוא תיק מאושר כ-JSON",() => {
      const p = pack(), blob = new Blob([JSON.stringify(p,null,2)],{type:"application/json;charset=utf-8"}), url = URL.createObjectURL(blob), a = node("a"); a.href = url; a.download = "Begood-team-lab-" + new Date().toISOString().slice(0,10) + ".json"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),10000);
    })); box.append(actions);
  }
  function renderRelated() {
    const perms = JSON.parse(sessionStorage.getItem("sbe.session.perms") || "[]"), sys = sessionStorage.getItem("sbe.session.homeUrl") === "admin.html?role=sys";
    const links = [ [["nana"],"facilitation-advisor.html","ננה: הנחיה מעשית"],[["activity"],"activity-planner.html","תכנון פעילות"],[["studio"],"resilience-studio.html","סטודיו חוסן"],[["resilience","practi"],"resilience-advisor.html","פרקטי: תמיכה בכיתה"],[["leadership"],"leadership-advisor.html","מנהיגות מקדמת חוסן"],[["writer"],"message-writer.html","כתיבה מקדמת חוסן"],[["journey"],"journey.html","מסע אל החוסן"] ];
    const host = $("lab-related-links"); links.filter(([need]) => sys || need.some(p => perms.includes(p))).forEach(([,href,label]) => {const a = node("a",label); a.href = href; host.append(a);}); $("lab-related").hidden = !host.childNodes.length;
  }
  function goStage(value) {
    assertOwner(); stage = value;
    for (let i = 0; i < 4; i++) { $("lab-panel-" + i).hidden = i !== stage; const b = document.querySelector('[data-stage="' + i + '"]'); if (i === stage) b.setAttribute("aria-current","step"); else b.removeAttribute("aria-current"); }
    renderStageQuestion(); $("lab-title-" + value).focus({preventScroll:true});
  }
  function renderAll() {
    renderContext(); renderModels(); renderEditor(); renderPractice(); renderLearning(); renderStageQuestion();
    $("lab-concerns").value = ws.private.concerns; renderAnswer("support",$("lab-support-answer")); updateDanger();
  }
  async function recover() {
    if (!ready) { await init(); return; }
    assertOwner(); const latest = await repository.load();
    if (!latest) throw new Error("לא נמצאה גרסה שמורה. הטיוטה שלכם נשארת כאן.");
    const dialog = node("dialog"); dialog.dir = "rtl"; dialog.className = "lab-card";
    dialog.append(node("h2","הגרסה השמורה והטיוטה שלכם"),node("p","אפשר לשמור את ההקשר והפעילות שערכתם מעל הגרסה האחרונה. האישורים והתיעוד שכבר נשמרו בה יישארו. אפשר גם לפתוח אותה בלי הטיוטה הנוכחית."));
    dialog.append(button("שילוב הטיוטה שלי ושמירה",async () => {
      const mine = clone(ws); persistedRevision = latest.revision; ws = T.update(latest,w => {w.context = mine.context; w.activity = mine.activity; w.private = mine.private;}); conflict = false; $("lab-reload").hidden = true; dialog.close(); await save(); renderAll();
    },true),button("פתיחת הגרסה השמורה במקום הטיוטה",() => {invalidate(); ws = latest; persistedRevision = latest.revision; conflict = false; Object.keys(formValues).forEach(k => delete formValues[k]); $("lab-reload").hidden = true; renderAll(); dialog.close(); $("lab-save-status").textContent = "נפתחה הגרסה השמורה · " + persistedRevision;}),button("המשך עריכה בלי החלפה",() => dialog.close()));
    dialog.addEventListener("close",() => dialog.remove(),{once:true}); document.body.append(dialog); dialog.showModal();
  }
  function demoFill() {
    assertOwner(); if (sessionStorage.getItem("sbe.session.homeUrl") !== "admin.html?role=sys") throw new Error("מילוי לדוגמה זמין למנהלת המערכת.");
    change(w => {Object.assign(w.context,{audience:"staff",ageBand:"d-f",situation:"routine",mode:"in-person",subject:"ישיבת צוות מדעים",curriculumGoal:"לתכנן משימת חקר משותפת",goal:"לבנות דרך קבועה שבה עמיתים משתפים רעיון, מקשיבים ובוחרים ניסוי קטן לשבוע הבא",environment:"חדר צוות, שולחן משותף ולוח",constraints:"אפשר לעבוד בזוגות ולהציע דרך כתובה להשתתף",accessibility:"בחירה בין דיבור, כתיבה והתבוננות",adultSupport:"המנחה מתאמת תפקידים ומאפשרת עצירה",groupSize:8,minutes:45,immediateDanger:false,models:T.MODELS.filter(m => m.audiences.includes("staff")).slice(0,2).map(m => m.id)});}); renderContext(); renderModels(); goStage(0);
  }
  async function init() {
    try {
      const loaded = await repository.load(); ws = loaded || T.newWorkspace(); persistedRevision = loaded?.revision || 0; ready = true; conflict = false;
      renderAll(); $("lab-save-status").textContent = loaded ? "העבודה הפרטית נפתחה · גרסה " + loaded.revision : "טיוטה חדשה במכשיר הזה"; $("lab-reload").hidden = true;
    } catch (error) {ready = false; $("lab-save-status").textContent = "לא הצלחנו לפתוח את העבודה השמורה. הנתונים לא שונו."; $("lab-reload").hidden = false; showError(error);}
  }
  document.querySelectorAll("[data-stage]").forEach(b => b.addEventListener("click",() => attempt(() => goStage(Number(b.dataset.stage)))));
  $("lab-save").addEventListener("click",() => attempt(save)); $("lab-reload").addEventListener("click",() => attempt(recover));
  ["lab-generate","lab-regenerate"].forEach(id => $(id).addEventListener("click",() => attempt(generate)));
  $("lab-demo").addEventListener("click",() => attempt(demoFill));
  $("lab-cancel").addEventListener("click",() => {work.invalidate(); message("הבקשה בוטלה. הטיוטה נשארת כאן.");});
  $("lab-question-input").addEventListener("input",() => attempt(() => setDraft("stage_" + stage,$("lab-question-input").value)));
  $("lab-ask").addEventListener("click",() => attempt(() => ask("stage_" + stage)));
  $("lab-concerns").addEventListener("input",() => attempt(() => change(w => {w.private.concerns = $("lab-concerns").value;})));
  $("lab-support").addEventListener("click",() => attempt(support));
  $("lab-approve").addEventListener("click",() => attempt(async () => {
    assertOwner(); const next = T.approve(ws,{safety:$("lab-check-safety").checked,privacy:$("lab-check-privacy").checked,professional:$("lab-check-professional").checked});
    invalidate(); ws = next; queueSave(); await save(); renderPractice(); renderLearning(); goStage(2); message("הגרסה המאושרת נשמרה. בחרו אותה במפורש לחזרה עם עמיתים.");
  }));
  window.addEventListener("storage",event => {
    if (event.key === initialOwner && ready && !saving) { conflict = true; work.invalidate(); $("lab-reload").hidden = false; $("lab-save-status").textContent = "העבודה השתנתה בלשונית אחרת. הטיוטה שלכם נשארת כאן."; }
    if (event.key === "sbe.session.mirror") work.invalidate();
  });
  window.addEventListener("beforeunload",event => { if (ready && ws.revision !== persistedRevision) {event.preventDefault(); event.returnValue = "";} });
  const home = sessionStorage.getItem("sbe.session.homeUrl") || "home.html";
  if (/^(?:home|admin|system-select|facilitator-screen|trainee-screen|actor-screen|parent-input-screen)\.html(?:\?|$)/.test(home)) ["lab-home","lab-back"].forEach(id => {$(id).href = home;});
  T.RED_LINES.forEach(r => $("lab-redlines").append(node("li",typeof r === "string" ? r : r.label)));
  attempt(renderRelated);
  window.SBE_TEAM_UI = {demoFill,generate,printableNode() {
    assertOwner(); if (!generated || !ws.activity) throw new Error("עוד לא הופקה פעילות אמיתית.");
    const activity = T.validateActivity(ws.activity,ws.context), sources = activity.sources.map(id => T.SOURCES.find(s => s.id === id)).filter(Boolean);
    return publicDocument({context:T.validateContext(ws.context),activity,redLines:T.RED_LINES,sources,moves:[]});
  }};
  attempt(init);
})();
