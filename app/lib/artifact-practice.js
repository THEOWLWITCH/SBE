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
    if (out.kind === "conversation") { document.getElementById("scenarioName").textContent = "תרגול השיחה שאישרת"; document.getElementById("scenarioSubtitle").textContent = "תרגול השיחה עם עמיתה ותיעוד הצעד הבא"; }
    else if (out.kind === "activity") document.getElementById("scenarioSubtitle").textContent = "תרגול המפגש עם עמיתה ותיעוד הצעד הבא";
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
  if (!/^art-[a-f0-9-]{36}$/.test(id || "") || !Number.isInteger(version) || version < 1) {
    status.textContent = "יש לפתוח קישור לגרסה שאושרה מתוך מסך ההכנה."; return;
  }
  request({action:"practice",artifactId:id,version:version}).then(render).catch(function (error) {
    status.textContent = error.status === 409 ? "הגרסה הזו טרם אושרה לתרגול. חזרי למסך ההכנה ואשרי את הגרסה הרצויה." : "לא ניתן לפתוח את התוצר. בדקי את החיבור ואת ההרשאה שלך; טיוטות אחרות נשמרו.";
  });
})();
