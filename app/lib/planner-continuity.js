// Private local product snapshots and ownership of asynchronous planner work.
(function () {
  "use strict";
  const SCHEMA = "planner-document/v1";
  const TAGS = new Set("article div span p h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr th td ul ol li strong b em i u br blockquote a bdi".split(" "));
  const DROP = new Set("script style iframe object embed svg math img input textarea select button video audio canvas template".split(" "));
  const CLASSES = new Set("kit-table kit-two kit-facts kit-steps kit-close kit-flow flow ph kit-h kit-sub kit-min kit-muted kit-session sbe-rich draftbox rcard rcard-row rcard-meta tree2-root tree2-row tree2-end card act session-card step-card claims-box".split(" "));
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = base => {
    if (typeof window.sbeUserKey !== "function") throw new Error("יש להיכנס למערכת לפני שמירת תוצר פרטי.");
    return window.sbeUserKey(base);
  };
  function safeAttrs(tag, source) {
    const attrs = {};
    const classes = String(source("class") || "").split(/\s+/).filter(c => CLASSES.has(c));
    if (classes.length) attrs.class = classes.join(" ");
    const names = tag === "td" || tag === "th" ? ["colspan", "rowspan"] : tag === "ol" ? ["start"] : [];
    names.forEach(name => {
      const value = String(source(name) || "");
      if (/^\d{1,3}$/.test(value) && +value > 0 && +value <= 100) attrs[name] = value;
    });
    if (tag === "a") {
      try {
        const url = new URL(String(source("href") || ""));
        if (url.protocol === "http:" || url.protocol === "https:") attrs.href = url.href;
      } catch {}
    }
    return attrs;
  }
  function captureNode(node) {
    if (node.nodeType === 3) return [{text: node.textContent || ""}];
    if (node.nodeType !== 1) return [];
    const tag = String(node.tagName).toLowerCase();
    if (DROP.has(tag) || /(?:^|\s)(?:sbe-edit-hint|no-print)(?:\s|$)/.test(node.getAttribute("class") || "")) return [];
    const children = Array.from(node.childNodes || []).flatMap(captureNode);
    if (!TAGS.has(tag)) return children;
    return [{tag, attrs:safeAttrs(tag, name => node.getAttribute(name)), children}];
  }
  function capture(nodes) { return {schemaVersion:SCHEMA, nodes:Array.from(nodes || []).filter(Boolean).flatMap(captureNode)}; }
  function restoreDocument(doc) {
    if (!doc || doc.schemaVersion !== SCHEMA || !Array.isArray(doc.nodes)) throw new Error("התוצר השמור אינו ניתן לפתיחה.");
    let count = 0;
    function restore(tree, depth) {
      if (++count > 30000 || depth > 100 || !tree || typeof tree !== "object") throw new Error("מבנה התוצר השמור אינו תקין.");
      if (typeof tree.text === "string") return document.createTextNode(tree.text);
      if (!TAGS.has(tree.tag) || !Array.isArray(tree.children)) throw new Error("מבנה התוצר השמור אינו תקין.");
      const node = document.createElement(tree.tag);
      const attrs = safeAttrs(tree.tag, name => tree.attrs?.[name]);
      Object.entries(attrs).forEach(([name,value]) => node.setAttribute(name,value));
      node.append(...tree.children.map(child => restore(child,depth + 1)));
      return node;
    }
    return doc.nodes.map(tree => restore(tree,0));
  }
  function createArchive(base) {
    const owner = key(base);
    function assertOwner() {
      if (key(base) !== owner) throw new Error("הכניסה למערכת השתנתה. יש לרענן לפני פתיחה או שמירה של תוצר פרטי.");
    }
    function list() {
      assertOwner();
      const raw = localStorage.getItem(owner);
      if (raw === null) return [];
      const records = JSON.parse(raw);
      if (!Array.isArray(records)) throw new Error("רשימת התוצרים השמורים אינה תקינה; הנתונים לא שונו.");
      return records.filter(r => r && r.scopeKey === owner && r.privacy === "private" && r.status === "draft" && r.document?.schemaVersion === SCHEMA);
    }
    function get(id) { return list().find(r => r.id === id); }
    function save({id, expectedVersion, title, subtitle = "", fields = {}, nodes}) {
      assertOwner();
      const documentSnapshot = capture(nodes);
      restoreDocument(documentSnapshot); // Validate before touching storage.
      const input = {title:String(title || "תוצר"),subtitle:String(subtitle),fields:clone(fields)};
      if (!window.navigator?.locks?.request) throw new Error("שמירה בטוחה אינה זמינה בדפדפן הזה. פתחי את האתר בדפדפן מעודכן; הנוסח נשאר כאן לעריכה.");
      // Re-read and check the version inside an origin-wide exclusive lock.
      return window.navigator.locks.request(owner, () => {
        const records = list(), index = records.findIndex(r => r.id === id), previous = records[index];
        if (id && (!previous || previous.version !== expectedVersion)) throw new Error("הגרסה השמורה השתנתה. פתחי את הגרסה האחרונה לפני שמירה.");
        const record = {id:id || window.crypto.randomUUID(), version:previous ? previous.version + 1 : 1,
          privacy:"private", status:"draft", scopeKey:owner, ...input,
          document:documentSnapshot, savedAt:new Date().toISOString(), history:previous ? [...previous.history || [],
            {version:previous.version,title:previous.title,subtitle:previous.subtitle,fields:previous.fields,document:previous.document,savedAt:previous.savedAt}] : []};
        if (previous) records[index] = record; else records.unshift(record);
        assertOwner(); localStorage.setItem(owner,JSON.stringify(records));
        return clone(record);
      });
    }
    function restore(record) { assertOwner(); return restoreDocument(record.document); }
    function copy(nodes) { assertOwner(); return restoreDocument(capture(nodes)); }
    function print({title,subtitle,nodes}) {
      window.SBE_DOC.print({title,subtitle,nodes:copy(nodes)});
    }
    function saveButton({title, subtitle, fields, nodes, record, onSave}) {
      let saved = record;
      const button = document.createElement("button"); button.type = "button"; button.className = "btn";
      button.textContent = "שמירה פרטית במכשיר"; button.setAttribute("aria-live","polite");
      button.addEventListener("click", async () => {
        if (button.disabled) return;
        button.disabled = true;
        try {
          saved = await save({id:saved?.id,expectedVersion:saved?.version,title,subtitle,fields:typeof fields === "function" ? fields() : fields,
            nodes:typeof nodes === "function" ? nodes() : nodes});
        } catch (error) { button.textContent = "לא נשמר · " + error.message; return; }
        finally { button.disabled = false; }
        button.textContent = "נשמר במכשיר ✓ · גרסה " + saved.version;
        onSave?.(saved);
      });
      return button;
    }
    function open() {
      assertOwner();
      const dialog = document.createElement("dialog"); dialog.dir = "rtl";
      dialog.setAttribute("aria-label","התוצרים הפרטיים שלי");
      dialog.style.cssText = "width:min(900px,94vw);max-height:90vh;box-sizing:border-box;padding:18px;border:1px solid #CDD3D8;border-radius:12px;overflow:auto;font:inherit";
      const close = document.createElement("button"); close.type = "button"; close.textContent = "סגירה";
      close.addEventListener("click", () => dialog.close());
      const heading = document.createElement("h2"); heading.textContent = "התוצרים הפרטיים שלי";
      const notice = document.createElement("p"); notice.textContent = "טיוטות פרטיות שנשמרו במכשיר ובדפדפן הזה. אפשר לפתוח, לערוך ולשמור גרסה נוספת.";
      const body = document.createElement("div"), status = document.createElement("p"); status.setAttribute("role","status");
      const showError = error => { status.textContent = error.message; };
      function showRecord(record, revision = record) {
        try {
          assertOwner(); const nodes = restore(revision); body.textContent = "";
          const editor = nodes.length === 1 && nodes[0].tagName === "DIV" ? nodes[0] : document.createElement("div");
          if (editor !== nodes[0]) editor.append(...nodes);
          const back = document.createElement("button"); back.type = "button"; back.textContent = "חזרה לרשימה"; back.addEventListener("click", showList);
          const title = document.createElement("h3"); title.textContent = revision.title + " · גרסה " + revision.version;
          const tools = document.createElement("div"); tools.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:12px 0";
          const history = document.createElement("div");
          function showHistory() {
            history.textContent = "";
            if (!record.history?.length) return;
            const label = document.createElement("h4"); label.textContent = "גרסאות קודמות"; history.append(label);
            [...record.history].reverse().forEach(old => {
              const button = document.createElement("button"); button.type = "button"; button.textContent = "פתיחת גרסה " + old.version;
              button.addEventListener("click", () => showRecord(record,old)); history.append(button);
            });
          }
          const saveCurrent = saveButton({title:revision.title,subtitle:revision.subtitle,fields:revision.fields,nodes:()=>[editor],record,
            onSave:saved => {record = saved; title.textContent = saved.title + " · גרסה " + saved.version; showHistory();}});
          const printCurrent = document.createElement("button"); printCurrent.type = "button"; printCurrent.textContent = "הדפסה / PDF";
          printCurrent.addEventListener("click", () => {try {print({title:revision.title,subtitle:revision.subtitle,nodes:[editor]});} catch(error) {showError(error);}});
          tools.append(back,saveCurrent,printCurrent); body.append(title,tools);
          body.append(window.SBE_DOC.editable(editor),history); showHistory();
          status.textContent = "";
        } catch (error) {showError(error);}
      }
      function showList() {
        try {
          const records = list(); body.textContent = ""; status.textContent = "";
          if (!records.length) { const empty = document.createElement("p"); empty.textContent = "עדיין אין כאן תוצרים שמורים."; body.append(empty); }
          records.forEach(record => {
            const button = document.createElement("button"); button.type = "button";
            button.textContent = record.title + " · גרסה " + record.version + " · " + new Date(record.savedAt).toLocaleDateString("he-IL");
            button.style.cssText = "display:block;width:100%;text-align:right;margin:8px 0;padding:12px;font:inherit";
            button.addEventListener("click", () => showRecord(record)); body.append(button);
          });
        } catch (error) {showError(error);}
      }
      dialog.append(close,heading,notice,body,status); dialog.addEventListener("close", () => dialog.remove(),{once:true});
      document.body.append(dialog); showList(); dialog.showModal(); return dialog;
    }
    // צילום של הנוסח הערוך שעל המסך, בלי שמירה. משמש לשליחה לבדיקה ולאישור בשרת (planner-artifact).
    function snapshot(nodes) { assertOwner(); const doc = capture(nodes); restoreDocument(doc); return doc; }
    return {list,get,save,restore,copy,saveButton,print,open,snapshot};
  }
  function createWork(readState) {
    let active;
    const state = () => JSON.stringify(readState());
    function invalidate() { active?.controller.abort(); }
    function start() {
      invalidate(); const controller = new AbortController(), owner = key("sbe.planner.work"); let source = state();
      const run = {controller,signal:controller.signal,owns:()=>active === run,
        current:()=>active === run && !controller.signal.aborted && key("sbe.planner.work") === owner && state() === source,
        assertCurrent() { if (!this.current()) throw new DOMException("הבקשה בוטלה או שהתכנון השתנה. אפשר להמשיך מהנוסח הנוכחי.","AbortError"); },
        checkpoint() {
          if (active !== run || controller.signal.aborted || key("sbe.planner.work") !== owner) throw new DOMException("הבקשה בוטלה או שהכניסה השתנתה.","AbortError");
          source = state();
        }};
      active = run; return run;
    }
    return {start,invalidate};
  }
  window.SBE_PLANNER = {createArchive,createWork};
})();
