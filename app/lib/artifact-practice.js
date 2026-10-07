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
  async function request(body) {
    var response = await fetch(window.sbeAIOrigin() + "/api/artifacts", {method:"POST", headers:window.sbeAIHeaders(), body:JSON.stringify(body)});
    var out = await response.json();
    if (!response.ok) throw Object.assign(new Error(out.code || "request_failed"), {status:response.status});
    return out;
  }
  function render(out) {
    current = out; root.replaceChildren(status);
    status.textContent = "גרסה " + out.version + " שאישרת · נשמרת בנפרד מטיוטות ושינויים חדשים";
    var content = out.content, scenario = content.scenario;
    root.append(node("h1", scenario.name));
    section("מטרת הפעילות", content.purpose);
    section("רכיבי החוסן", content.resilienceComponents);
    section("מיומנויות אישיות", content.individualSkills);
    section("מיומנויות משותפות", content.sharedSkills);
    section("איך להנחות", content.facilitatorGuide);
    section("המנגנון החברתי שנבחר", content.socialMechanism);
    section("מהלך הפעילות", content.steps.map(function (step) { return step.title + " · " + (step.minutes === 1 ? "דקה אחת" : step.minutes + " דקות") + "\n" + step.instructions; }));
    var rehearsal = section("תרגול ההנחיה", "אפשר לתרגל עם עמיתה: אחת מנחה ואחת מגלמת משתתפת. בחרו שלב, קראו את ההוראות, נסו פתיחה ושאלת המשך, ואז החליפו תפקידים. מותר לעצור או לבחור דרך השתתפות אחרת. התרגול הזה משתמש בתוצר שאישרת.");
    var stepSelect = node("select"); stepSelect.setAttribute("aria-label", "שלב לתרגול");
    content.steps.forEach(function (step) { var option = node("option", step.title); option.value = step.id; stepSelect.append(option); });
    var prompt = node("p"); prompt.style.whiteSpace = "pre-wrap";
    function showStep() { var step = content.steps.find(function (item) { return item.id === stepSelect.value; }); prompt.textContent = step ? step.instructions : ""; }
    stepSelect.addEventListener("change", showStep); rehearsal.append(stepSelect, prompt); showStep();
    var print = node("button", "הדפסת הגרסה שאושרה"); print.type = "button";
    print.addEventListener("click", function () {
      var printable = root.cloneNode(true); printable.querySelectorAll("button,form,select,[data-observations]").forEach(function (item) { item.remove(); });
      window.SBE_DOC.print({title:scenario.name, subtitle:"גרסה מאושרת " + out.version, node:printable});
    }); root.append(print);
    var observationBox = section("אחרי התרגול", "תעדי מה ראית ובחרי את הצעד הבא. זו תצפית שלך; היא אינה מדידה של שיפור חוסן.");
    var form = node("form"), observation = field("מה ראית או שמעת?", "observation"), next = field("מה בחרת לעשות במפגש הבא?", "chosenNextStep"), submissionId = crypto.randomUUID();
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
