/* Approved activity rehearsal. Uses the saved version; never regenerates it. */
(function () {
  "use strict";
  var params = new URLSearchParams(location.search);
  if (!params.has("artifactId")) return;
  var id = params.get("artifactId"), version = Number(params.get("version"));
  var wrap = document.querySelector(".wrap"), current, saving = false;
  if (!wrap) return;
  wrap.querySelectorAll("section,.bar-wrap,.banner").forEach(function (node) { node.hidden = true; });
  document.getElementById("scenarioName").textContent = "תרגול הפעילות שאישרת";
  document.getElementById("scenarioSubtitle").textContent = "תרגול ההנחיה עם עמיתה ותיעוד הצעד הבא";
  document.getElementById("composerBar").hidden = true;
  var root = document.createElement("section");
  root.id = "approved-activity-practice";
  root.setAttribute("aria-label", "תרגול הפעילות שאושרה");
  wrap.append(root);
  var status = node("p", "טוענת את הגרסה שאושרה…");
  status.setAttribute("role", "status"); root.append(status);

  function node(tag, text) { var element = document.createElement(tag); if (text !== undefined) element.textContent = text; return element; }
  function section(title, value) {
    var box = node("div"); box.className = "card"; box.style.marginBottom = "16px"; box.append(node("h2", title));
    if (Array.isArray(value)) { var list = node("ul"); value.forEach(function (item) { var entry = node("li", item); entry.style.whiteSpace = "pre-wrap"; list.append(entry); }); box.append(list); }
    else { var paragraph = node("p", value || ""); paragraph.style.whiteSpace = "pre-wrap"; box.append(paragraph); }
    root.append(box); return box;
  }
  function field(label, name) {
    var box = node("label", label), input = node("textarea"); input.name = name; input.rows = 4; input.maxLength = 12000;
    input.style.cssText = "display:block;width:100%;font:inherit;margin:8px 0 16px"; box.append(input); return {box:box,input:input};
  }
  function printTable(headers, rows) {
    var table = node("table"), head = node("thead"), body = node("tbody"), heading = node("tr");
    table.className = "kit-table";
    headers.forEach(function (label) { var cell = node("th", label); cell.setAttribute("scope", "col"); heading.append(cell); });
    head.append(heading);
    rows.forEach(function (values) {
      var row = node("tr");
      values.forEach(function (value, index) { var cell = node("td", value); cell.style.whiteSpace = "pre-wrap"; cell.setAttribute("data-label", headers[index]); row.append(cell); });
      body.append(row);
    });
    table.append(head, body); return table;
  }
  // כותרות לפי סוג התוצר (9 באוקטובר 2026): פעילות, שיחה או תרחיש סימולציה
  var LABELS = {
    narrative: {purpose:"מטרת הפעילות", guide:"איך להנחות", mechanism:"המנגנון החברתי שנבחר", steps:"מהלך הפעילות", summary:"תמצית הפעילות",
      rehearsal:"אפשר לתרגל עם עמיתה: אחת מנחה ואחת מגלמת משתתפת. בחרו שלב, קראו את ההוראות, נסו פתיחה ושאלת המשך, ואז החליפו תפקידים."},
    activity: {purpose:"מטרת הפעילות", guide:"הנחיה למנחה", mechanism:"המנגנון החברתי שנבחר", steps:"מהלך המפגש", summary:"תמצית הפעילות",
      rehearsal:"תרגול המפגש עם עמיתה: אחת מנחה ואחת משחקת משתתפת. בוחרים שלב, קוראים מה עושים בו, מנסים את הפתיחה ואת השאלות, ואז מחליפים תפקידים."},
    conversation: {purpose:"מטרת השיחה", guide:"הנחיה לשיחה", mechanism:"מה ממשיך אחרי השיחה", steps:"שלבי השיחה", summary:"תמצית השיחה",
      rehearsal:"תרגול השיחה עם עמיתה: את אומרת את דברי הפתיחה, והעמיתה משחקת את הצד השני. בוחרים שלב, מנסים אותו, ואז שואלות זו את זו מה עבד ומה אפשר לנסות אחרת."}
  };
  var SKIPPED = {socialMechanism:"מנגנון חברתי", facilitatorGuide:"הנחיה למנחה"};
  function labelsFor(out) { return LABELS[out.kind] || LABELS.narrative; }
  function present(value) { return Array.isArray(value) ? value.length > 0 : !!(value && String(value).trim()); }
  function printableActivity(content, L) {
    var printable = node("div"), labels = [L.purpose, "רכיבי החוסן", "מיומנויות אישיות", "מיומנויות משותפות", L.guide, L.mechanism];
    var values = [content.purpose, content.resilienceComponents, content.individualSkills, content.sharedSkills, content.facilitatorGuide, content.socialMechanism];
    printable.append(node("h2", L.summary), printTable(["התחום", "הנוסח שאושר"], labels.map(function (label, index) {
      return [label, Array.isArray(values[index]) ? values[index].join("\n") : values[index]];
    }).filter(function (row, index) { return present(values[index]); })));
    printable.append(node("h2", L.steps), printTable(["שלב", "זמן", "מה עושים"], content.steps.map(function (step) {
      return [(step.phase && step.phase !== step.title ? step.phase + " · " : "") + step.title, step.minutes === 1 ? "דקה אחת" : step.minutes + " דקות", step.instructions];
    })));
    return printable;
  }
  async function request(body) {
    var response = await fetch(window.sbeAIOrigin() + "/api/artifacts", {method:"POST", headers:window.sbeAIHeaders(), body:JSON.stringify(body)});
    var out = await response.json();
    if (!response.ok) throw Object.assign(new Error(out.code || "request_failed"), {status:response.status});
    return out;
  }
  function render(out) {
    current = out; root.replaceChildren(status);
    status.textContent = "גרסה " + out.version + " שאישרת · נשמרת בנפרד מטיוטות ושינויים חדשים";
    var content = out.content, L = labelsFor(out);
    if (out.kind === "conversation") { document.getElementById("scenarioName").textContent = "תרגול השיחה שאישרת"; document.getElementById("scenarioSubtitle").textContent = "תרגול עם עמיתה או מול המודל, ותיעוד הצעד הבא"; }
    else if (out.kind === "activity") document.getElementById("scenarioSubtitle").textContent = "תרגול עם עמיתה או מול המודל, ותיעוד הצעד הבא";
    var title = content.scenario && content.scenario.name || content.purpose || "התוצר שאישרת";
    root.append(node("h1", title));
    section(L.purpose, content.purpose);
    [["רכיבי החוסן", content.resilienceComponents], ["מיומנויות אישיות", content.individualSkills], ["מיומנויות משותפות", content.sharedSkills],
      [L.guide, content.facilitatorGuide], [L.mechanism, content.socialMechanism]].forEach(function (pair) { if (present(pair[1])) section(pair[0], pair[1]); });
    if ((out.proceedWithout || []).length) section("בחרת להמשיך בלי", out.proceedWithout.map(function (k) { return SKIPPED[k] || k; }));
    section(L.steps, content.steps.map(function (step) { return (step.phase && step.phase !== step.title ? step.phase + " · " : "") + step.title + " · " + (step.minutes === 1 ? "דקה אחת" : step.minutes + " דקות") + "\n" + step.instructions; }));
    var rehearsal = section(out.kind === "conversation" ? "תרגול השיחה" : "תרגול ההנחיה", L.rehearsal || "אפשר לתרגל עם עמיתה: אחת מנחה ואחת מגלמת משתתפת. בחרו שלב, קראו את ההוראות, נסו פתיחה ושאלת המשך, ואז החליפו תפקידים. מותר לעצור או לבחור דרך השתתפות אחרת. התרגול הזה משתמש בתוצר שאישרת.");
    var stepSelect = node("select"); stepSelect.setAttribute("aria-label", "שלב לתרגול");
    content.steps.forEach(function (step) { var option = node("option", step.title); option.value = step.id; stepSelect.append(option); });
    var prompt = node("p"); prompt.style.whiteSpace = "pre-wrap";
    function showStep() { var step = content.steps.find(function (item) { return item.id === stepSelect.value; }); prompt.textContent = step ? step.instructions : ""; }
    stepSelect.addEventListener("change", showStep); rehearsal.append(stepSelect, prompt); showStep();
    if (out.kind === "activity" || out.kind === "conversation") liveRehearsal(rehearsal, out, stepSelect, title);
    var print = node("button", "הדפסת הגרסה שאושרה"); print.type = "button";
    print.addEventListener("click", function () {
      window.SBE_DOC.print({title:title, subtitle:"גרסה מאושרת " + out.version, node:printableActivity(content, L), inline:true});
    }); root.append(print);
    var observationBox = section("אחרי התרגול", "תעדי מה ראית ובחרי את הצעד הבא. זו תצפית שלך; היא אינה מדידה של שיפור חוסן.");
    var form = node("form"), observation = field("מה ראית או שמעת?", "observation"), next = field(out.kind === "conversation" ? "מה בחרת לעשות אחרי השיחה?" : "מה בחרת לעשות במפגש הבא?", "chosenNextStep"), submissionId = crypto.randomUUID();
    form.addEventListener("input", function () { submissionId = crypto.randomUUID(); });
    observation.input.required = true; next.input.required = true;
    var submit = node("button", "שמירת התצפית והצעד שבחרתי"); submit.type = "submit";
    form.append(observation.box, next.box, submit); observationBox.append(form);
    var history = node("div"); history.setAttribute("data-observations", ""); observationBox.append(history);
    function drawHistory() {
      history.replaceChildren(); (current.observations || []).forEach(function (entry) {
        var item = node("div"); item.append(node("h3", "תצפית על גרסה " + out.version), node("p", entry.observation), node("p", "הצעד שנבחר: " + entry.chosenNextStep)); history.append(item);
      });
    }
    drawHistory();
    form.addEventListener("submit", async function (event) {
      event.preventDefault(); if (saving || !observation.input.value.trim() || !next.input.value.trim()) return;
      saving = true; submit.disabled = true; observation.input.disabled = true; next.input.disabled = true; status.textContent = "שומרת…";
      try {
        var saved = await request({action:"observe",artifactId:id,version:out.version,submissionId:submissionId,observation:observation.input.value,chosenNextStep:next.input.value});
        if (!current.observations.some(function (item) { return item.id === saved.observation.id; })) current.observations.push(saved.observation);
        drawHistory(); observation.input.value = ""; next.input.value = ""; submissionId = crypto.randomUUID();
        status.textContent = "התצפית והצעד הבא נשמרו בגרסה " + out.version;
      } catch (error) { status.textContent = "השמירה לא הושלמה. הטקסט שלך נשאר כאן; נסי שוב אחרי בדיקת החיבור והכניסה."; }
      finally { saving = false; submit.disabled = false; observation.input.disabled = false; next.input.disabled = false; }
    });
  }
  // תרגול חי מול המודל (9 באוקטובר 2026): בפעילות המודל משחק את הקבוצה, ובשיחה את הצד השני.
  // ההנחיות ב-lib/rehearsal-model.js. התרגול נשמר רק במכשיר, לפי משתמש/ת ולפי הגרסה.
  function liveRehearsal(box, out, stepSelect, title) {
    var M = window.SBE_REHEARSAL;
    if (!M || typeof window.sbeCallAI !== "function") return;
    var conv = out.kind === "conversation", content = out.content;
    var storeKey = (window.sbeUserKey ? window.sbeUserKey("sbe.rehearsal.v1") : "sbe.rehearsal.v1") + "." + id + "." + out.version;
    var state = load() || {stepId: stepSelect.value, turns: [], feedback: ""}, busy = null;
    function load() { try { var v = JSON.parse(localStorage.getItem(storeKey) || "null"); return v && Array.isArray(v.turns) ? v : null; } catch (e) { return null; } }
    function save() { try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch (e) {} }
    var live = node("div"); live.className = "card"; live.style.cssText = "margin:16px 0;border-color:var(--spoken)";
    live.setAttribute("data-live-rehearsal", "");
    live.append(node("h3", "תרגול חי מול המודל"));
    live.append(node("p", conv ? "המודל משחק את הצד השני בשיחה. את כותבת מה היית אומרת, והוא עונה. אחרי כמה תורות לוחצים \"סיום ומשוב\"." :
      "המודל משחק את הקבוצה. את כותבת מה היית אומרת או עושה כמנחה, והקבוצה מגיבה. אחרי כמה תורות לוחצים \"סיום ומשוב\"."));
    var log = node("div"); log.setAttribute("aria-live", "polite"); log.style.cssText = "display:flex;flex-direction:column;gap:8px;margin:10px 0";
    var wait = node("p"); wait.setAttribute("role", "status"); wait.style.color = "var(--muted)";
    var say = node("textarea"); say.rows = 3; say.maxLength = 2000; say.setAttribute("aria-label", conv ? "מה את אומרת?" : "מה את אומרת או עושה?");
    say.placeholder = conv ? "מה את אומרת?" : "מה את אומרת או עושה?"; say.style.cssText = "display:block;width:100%;margin:6px 0";
    var start = node("button", "מתחילים לתרגל"), send = node("button", "שליחה"), finish = node("button", "סיום ומשוב"), restart = node("button", "תרגול חדש"), printBtn = node("button", "🖨 הדפסה / שמירה כ-PDF");
    [start, send, finish, restart, printBtn].forEach(function (b) { b.type = "button"; b.style.marginInlineEnd = "8px"; });
    [finish, restart, printBtn].forEach(function (b) { b.style.background = "transparent"; b.style.color = "var(--spoken)"; });
    var fb = node("div"); fb.setAttribute("data-live-feedback", "");
    var controls = node("div"); controls.append(say, send, finish);
    live.append(log, wait, start, controls, fb, restart, printBtn); box.append(live);
    function bubble(t) {
      var mine = t.role === "user", item = node("div");
      item.style.cssText = "padding:8px 12px;border-radius:8px;white-space:pre-wrap;max-width:90%;" + (mine ? "align-self:flex-start;background:var(--ground)" : "align-self:flex-end;border:1px solid var(--hair)");
      var who = node("b", (mine ? (conv ? "אני" : "המנחה") : (conv ? "הצד השני" : "הקבוצה")) + ": ");
      item.append(who); item.append(window.SBE_DOC && !mine ? window.SBE_DOC.rich(t.content) : document.createTextNode(t.content)); return item;
    }
    function mine() { return state.turns.filter(function (t) { return t.role === "user"; }).length; }
    function draw() {
      log.replaceChildren(); state.turns.slice(1).forEach(function (t) { log.append(bubble(t)); });
      var started = state.turns.length > 0, done = !!state.feedback;
      start.hidden = started; controls.hidden = !started || done; restart.hidden = !started; printBtn.hidden = !done;
      say.disabled = send.disabled = finish.disabled = start.disabled = restart.disabled = !!busy;
      stepSelect.disabled = started;
      finish.textContent = mine() - 1 >= M.MAX_TURNS ? "סיום ומשוב (מומלץ עכשיו)" : "סיום ומשוב";
      fb.replaceChildren();
      if (done) { fb.append(node("h3", "משוב על התרגול")); var t = window.SBE_DOC && (window.SBE_DOC.sections(state.feedback) || window.SBE_DOC.rich(state.feedback)); fb.append(t || node("p", state.feedback)); }
    }
    function waiting(text, expect) {
      var t0 = Date.now(); wait.textContent = text + " בדרך כלל " + expect + ".";
      var timer = setInterval(function () { wait.textContent = text + " בדרך כלל " + expect + ". עברו " + Math.round((Date.now() - t0) / 1000) + " שניות."; }, 1000);
      return function () { clearInterval(timer); wait.textContent = ""; };
    }
    async function ask(system, messages, maxTokens, text, expect) {
      var ctrl = new AbortController(); busy = ctrl; draw(); var stop = waiting(text, expect);
      try { return String(await window.sbeCallAI(window.sbeAIOrigin(), {system: system, messages: messages, maxTokens: maxTokens}, 120000, {signal: ctrl.signal}) || "").trim(); }
      finally { stop(); busy = null; }
    }
    function noModel() { wait.textContent = "אין כרגע חיבור למודל. מה שכתבת נשמר כאן, ואפשר לנסות שוב בעוד דקה או שתיים."; }
    async function turn() {
      try {
        var reply = await ask(M.turnSystem(out.kind, content, state.stepId), state.turns.slice(-16), 900, conv ? "הצד השני עונה." : "הקבוצה מגיבה.", "כ-20 שניות");
        if (!reply) throw new Error("empty");
        state.turns.push({role: "assistant", content: reply}); save(); draw(); say.focus();
      } catch (e) { draw(); noModel(); }
    }
    start.addEventListener("click", function () {
      state = {stepId: stepSelect.value, turns: [{role: "user", content: "מתחילים לתרגל."}], feedback: ""}; save(); draw(); turn();
    });
    send.addEventListener("click", function () {
      var t = say.value.trim(); if (!t || busy) return;
      // אם התשובה הקודמת לא הגיעה, שולחים שוב את אותו תור בלי להכפיל
      if (state.turns.length && state.turns[state.turns.length - 1].role === "user") state.turns[state.turns.length - 1].content += "\n" + t;
      else state.turns.push({role: "user", content: t});
      say.value = ""; save(); draw(); turn();
    });
    say.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send.click(); });
    finish.addEventListener("click", async function () {
      if (busy || mine() < 2) { if (!busy) wait.textContent = "כדאי לכתוב לפחות תור אחד לפני המשוב."; return; }
      try {
        var text = await ask(M.feedbackSystem(out.kind, content, state.stepId),
          [{role: "user", content: "התרגול:\n" + M.transcript(state.turns.slice(1), out.kind) + "\n\nכתבי את המשוב."}], 1500, "כותבת משוב.", "כ-30 שניות");
        if (!text) throw new Error("empty");
        state.feedback = text; save(); draw();
      } catch (e) { draw(); noModel(); }
    });
    restart.addEventListener("click", function () { if (busy) return; state = {stepId: stepSelect.value, turns: [], feedback: ""}; save(); draw(); });
    printBtn.addEventListener("click", function () {
      var doc = node("div");
      doc.append(node("h2", "התרגול"), printTable(["מי", "מה נאמר"], state.turns.slice(1).map(function (t) {
        return [t.role === "user" ? (conv ? "אני" : "המנחה") : (conv ? "הצד השני" : "הקבוצה"), t.content.replace(/\*\*/g, "")];
      })));
      doc.append(node("h2", "משוב על התרגול"), window.SBE_DOC.sections(state.feedback) || window.SBE_DOC.rich(state.feedback));
      var step = (content.steps || []).find(function (s) { return s.id === state.stepId; });
      window.SBE_DOC.print({title: title, subtitle: "תרגול חי" + (step ? " · " + step.title : "") + " · גרסה " + out.version, kind: "תרגול ומשוב", node: doc, inline: true});
    });
    if (state.stepId) stepSelect.value = state.stepId;
    stepSelect.dispatchEvent(new Event("change"));
    draw();
  }
  if (!/^art-[a-f0-9-]{36}$/.test(id || "") || !Number.isInteger(version) || version < 1) {
    status.textContent = "יש לפתוח קישור לגרסה שאושרה מתוך מסך ההכנה."; return;
  }
  request({action:"practice",artifactId:id,version:version}).then(render).catch(function (error) {
    status.textContent = error.status === 409 ? "הגרסה הזו טרם אושרה לתרגול. חזרי למסך ההכנה ואשרי את הגרסה הרצויה." : "לא ניתן לפתוח את התוצר. בדקי את החיבור ואת ההרשאה שלך; טיוטות אחרות נשמרו.";
  });
})();
