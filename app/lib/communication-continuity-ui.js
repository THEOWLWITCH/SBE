(function () {
  'use strict';
  const C = window.SBE_COMMUNICATION;
  const F = id => document.getElementById(id);
  const ENDPOINT = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
    ? '/api/communication-continuity' : 'https://sbe-server.onrender.com/api/communication-continuity';
  const MAX_TEXT = 120000;
  const analysisLabels = {
    facts: 'מה ידוע מהשיחה', interpretations: 'פרשנויות אפשריות, לא עובדות', control: 'מה בשליטתך',
    influence: 'על מה אפשר להשפיע', outsideControl: 'מה מחוץ לשליטתך', responsibility: 'אחריות מקצועית',
    resources: 'משאבים', barriers: 'חסמים', agreements: 'הסכמות שנמסרו', openQuestions: 'שאלות פתוחות', followUp: 'מעקב והמשך'
  };
  const state = { conversations: [], selected: null, busy: false, retry: null, edits: new Map(), buffers: new Map() };
  let ticker = null;
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; }
  function button(text, action, cls) { const b = el('button', 'btn ' + (cls == null ? 'ghost' : cls), text); b.type = 'button'; b.disabled = state.busy; b.addEventListener('click', action); return b; }
  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)); }
  function token() { try { return sessionStorage.getItem('sbe.session.token') || ''; } catch (_) { return ''; } }
  function date(iso) { if (!iso) return ''; const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' }) : String(iso); }
  function rich(text) { if (window.SBE_DOC) return SBE_DOC.rich(text); return el('div', 'cc-entry-text', text); }
  function bufferKey() { return state.selected ? state.selected.id : 'new'; }
  function latestInstruction(c) { return (c && c.entries || []).findLast(e => e.kind === 'note' && e.notePurpose === 'instruction'); }
  function rememberComposer() {
    const c = state.selected;
    const b = { text: F('cc-text').value, kind: F('cc-input-kind').value, instruction: F('cc-instruction').value, savedInstruction: latestInstruction(c)?.text || '' };
    for (const [field, id] of [['title', 'cc-rename'], ['status', 'cc-status'], ['audience', 'cc-audience']]) {
      b[field] = F(id).value;
      b[field + 'Dirty'] = !!c && b[field] !== (c[field] || '');
    }
    state.buffers.set(bufferKey(), b);
  }
  function metadataValue(field, c) {
    const b = state.buffers.get(c.id);
    return b && b[field + 'Dirty'] ? b[field] : c[field] || '';
  }
  function acknowledgeMetadata(c, patch) {
    const b = state.buffers.get(c.id);
    if (!b) return;
    for (const field of ['title', 'status', 'audience']) {
      if (!Object.prototype.hasOwnProperty.call(patch, field) || b[field] !== patch[field]) continue;
      const expected = field === 'status' ? patch[field] : patch[field].trim();
      if (c[field] === expected) { b[field] = c[field]; b[field + 'Dirty'] = false; }
    }
  }
  function loadComposer() {
    const b = state.buffers.get(bufferKey());
    F('cc-text').value = b ? b.text : '';
    F('cc-input-kind').value = b ? b.kind : 'received';
    F('cc-audience').value = state.selected ? metadataValue('audience', state.selected) : b ? b.audience : '';
    F('cc-instruction').value = b ? b.instruction : latestInstruction(state.selected)?.text || '';
  }
  function feedback(text, error) { F('cc-feedback').hidden = false; F('cc-feedback').classList.toggle('error', !!error); F('cc-feedback-text').textContent = text; }
  function setBusy(on, text) {
    state.busy = on;
    document.querySelectorAll('button').forEach(b => { if (!b.hasAttribute('data-permanent-disabled')) b.disabled = on; });
    F('cc-file').disabled = on;
    F('cc-filter').disabled = on;
    F('cc-progress').hidden = !on;
    document.querySelector('.cc-workspace').setAttribute('aria-busy', String(on));
    if (ticker) { clearInterval(ticker); ticker = null; }
    if (on) {
      const start = Date.now();
      const update = () => feedback(text + ' עברו ' + Math.floor((Date.now() - start) / 1000) + ' שניות. עיבוד BE GOOD עשוי להימשך עד כשתי דקות; בשיחה ארוכה גם יותר.');
      update(); ticker = setInterval(update, 1000);
    }
  }
  function validateText(text) {
    if (String(text).length > MAX_TEXT) throw new Error('הטקסט ארוך מ־120,000 תווים. אפשר לחלק אותו להודעות; שום טקסט לא קוצר.');
  }
  class ApiError extends Error {
    constructor(text, code, status) { super(text); this.code = code; this.status = status; }
  }
  async function request(op, step, action, data, mutation) {
    if (op.results.has(step)) return op.results.get(step);
    if (!op.bodies.has(step)) op.bodies.set(step, { token: op.token, action, ...data, ...(mutation ? { requestId: uuid() } : {}) });
    const body = op.bodies.get(step);
    if (!body.token || token() !== op.token) throw new ApiError('הכניסה השתנתה או הסתיימה. אפשר להיכנס שוב; הטקסט עדיין כאן בלשונית.', 'unauthorized', 401);
    let response;
    try {
      response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit' });
    } catch (_) { throw new ApiError('החיבור לשרת נקטע. הטקסט נשמר כאן בלשונית כל עוד היא פתוחה. אפשר לנסות שוב את אותה בקשה.', 'network', 0); }
    let result;
    try { result = await response.json(); } catch (_) { throw new ApiError('לא התקבלה תשובה קריאה מהשרת. אפשר לנסות שוב את אותה בקשה.', 'response', response.status); }
    if (!response.ok || result.ok === false || result.error) throw new ApiError(result.error || 'הבקשה לא הושלמה. אפשר לנסות שוב.', result.code || 'server', Number.isInteger(result.status) ? result.status : response.status);
    if (token() !== op.token) throw new ApiError('הכניסה השתנתה בזמן הפעולה. אפשר לטעון מחדש את השיחות בחשבון הנוכחי.', 'unauthorized', 401);
    op.results.set(step, result);
    return result;
  }
  async function execute(op) {
    state.retry = null;
    F('cc-retry').hidden = true; F('cc-conflict-refresh').hidden = true;
    setBusy(true, op.label);
    try {
      await op.work(op);
      feedback(op.success || 'הפעולה הושלמה בשרת.');
      return true;
    } catch (error) {
      feedback(error.message || 'הפעולה לא הושלמה. הטקסט עדיין כאן.', true);
      if (['conflict', 'REVISION_CONFLICT', 'REQUEST_REUSED'].includes(error.code) || error.status === 409) {
        F('cc-conflict-refresh').hidden = false;
        feedback('השיחה עודכנה ממקום אחר. אפשר לטעון את הגרסה העדכנית ואז לשמור שוב. הטקסט והעריכות כאן נשארים זמינים.', true);
      } else if (error instanceof ApiError && (error.status >= 500 || error.status === 0 || ['response', 'SERVICE_UNAVAILABLE', 'AI_UNAVAILABLE'].includes(error.code))) {
        state.retry = op; F('cc-retry').hidden = false;
      }
      return false;
    } finally { setBusy(false); }
  }
  function run(label, work, success) {
    if (state.busy) return Promise.resolve(false);
    return execute({ label, work, success, token: token(), bodies: new Map(), results: new Map() });
  }
  function upsert(conversation) {
    const index = state.conversations.findIndex(c => c.id === conversation.id);
    if (index < 0) state.conversations.unshift(conversation); else state.conversations[index] = conversation;
    state.conversations.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  function apply(conversation, select) {
    if (!conversation || !conversation.id) throw new ApiError('השרת לא החזיר שיחה תקינה. אפשר לטעון מחדש.', 'response', 502);
    upsert(conversation);
    if (select !== false) { state.selected = conversation; renderConversation(); }
    renderList();
    return conversation;
  }
  function renderList() {
    const box = F('cc-list'); box.replaceChildren();
    const filter = F('cc-filter').value;
    const list = state.conversations.filter(c => filter === 'all' || (filter === 'archived' ? c.status === 'archived' : !['archived', 'resolved'].includes(c.status)));
    F('cc-list-status').textContent = list.length ? list.length + ' שיחות' : 'אין שיחות בתצוגה הזו.';
    list.forEach(c => {
      const b = button('', () => selectConversation(c.id)); b.className = 'cc-list-item'; b.dataset.id = c.id;
      b.setAttribute('aria-current', String(!!state.selected && c.id === state.selected.id));
      b.append(el('strong', '', c.title || 'שיחה ללא שם'), el('span', 'cc-badge', C.STATUSES[c.status] || c.status),
        el('span', 'muted', 'קהל: ' + (c.audience || 'לא צוין') + ' · ' + (c.rounds || 0) + ' סבבי שיח'),
        el('span', 'muted', 'נוצרה: ' + date(c.createdAt)), el('span', 'muted', 'עודכנה: ' + date(c.updatedAt)), el('span', 'cc-id', c.id));
      b.disabled = state.busy; box.append(b);
    });
  }
  async function refreshList() {
    F('cc-list-status').textContent = 'טעינת השיחות מהשרת...';
    return run('טעינת השיחות.', async op => {
      const result = await request(op, 'list', 'list', {}, false);
      state.conversations = Array.isArray(result.conversations) ? result.conversations : [];
      renderList();
    }, 'רשימת השיחות נטענה מהשרת.');
  }
  async function selectConversation(id) {
    if (state.busy) return;
    rememberComposer();
    await run('פתיחת השיחה.', async op => {
      apply((await request(op, 'get', 'get', { id }, false)).conversation);
      loadComposer();
    }, 'השיחה נטענה. טקסט שעדיין לא נשמר נשאר בשיחה שלו כל עוד הלשונית פתוחה.');
  }
  function beginNew() {
    if (state.busy) return;
    rememberComposer(); state.selected = null; state.retry = null;
    F('cc-file').value = ''; F('cc-file-status').textContent = ''; F('cc-file-clear').hidden = true;
    F('cc-feedback').hidden = true; F('cc-retry').hidden = true; F('cc-conflict-refresh').hidden = true;
    renderConversation(); renderList(); loadComposer(); F('cc-text').focus();
  }
  async function ensureConversation(op, initialText) {
    if (op.conversation) return op.conversation;
    if (op.existing) { op.conversation = op.existing; return op.conversation; }
    const created = (await request(op, 'create', 'create', { id: op.newId, title: initialText.trim().split('\n')[0].slice(0, 100) || 'שיחה חדשה', audience: op.audience, expectedRevision: null }, true)).conversation;
    const b = state.buffers.get('new');
    if (b && created?.id) state.buffers.set(created.id, { ...b, title: created.title, status: created.status, titleDirty: false, statusDirty: false, audienceDirty: b.audience !== created.audience });
    op.conversation = apply(created);
    state.buffers.delete('new'); rememberComposer();
    return op.conversation;
  }
  function contextOperation(label, work, success) {
    const text = F('cc-text').value; const audience = F('cc-audience').value;
    const kind = F('cc-input-kind').value; const instruction = F('cc-instruction').value;
    const existing = state.selected; const newId = uuid();
    return run(label, async op => {
      if (!op.initialized) { Object.assign(op, { initialized: true, text, audience, kind, instruction, existing, newId }); }
      validateText(op.text);
      if (op.instruction.length > 12000) throw new Error('ההנחיה ארוכה מ־12,000 תווים. אפשר לקצר את ההנחיה או לשמור את הפרטים כהערה בשיחה.');
      if (!op.existing && !op.text.trim() && !op.attachment) throw new Error('אפשר להוסיף הודעה, תיאור מצב או קובץ כדי להתחיל שיחה.');
      await work(op);
    }, success);
  }
  async function saveContext(op) {
    await ensureConversation(op, op.text);
    if (op.text.trim() && !op.contextSaved) {
      op.conversation = apply((await request(op, 'append', 'append', { id: op.conversation.id, expectedRevision: op.conversation.revision, kind: op.kind, text: op.text }, true)).conversation);
      op.contextSaved = true;
      if (F('cc-text').value === op.text) F('cc-text').value = '';
      rememberComposer();
    }
    if (op.audience !== op.conversation.audience && !op.audienceSaved) {
      const conversation = (await request(op, 'audience', 'update', { id: op.conversation.id, expectedRevision: op.conversation.revision, audience: op.audience }, true)).conversation;
      acknowledgeMetadata(conversation, { audience: op.audience });
      op.conversation = apply(conversation);
      op.audienceSaved = true;
    }
  }
  async function saveInstruction(op) {
    if (!op.instruction.trim() || op.instructionSaved) return;
    if (latestInstruction(op.conversation)?.text !== op.instruction) {
      op.conversation = apply((await request(op, 'instruction', 'append', { id: op.conversation.id, expectedRevision: op.conversation.revision, kind: 'note', text: op.instruction, notePurpose: 'instruction' }, true)).conversation);
    }
    op.instructionSaved = true;
  }
  function saveInput() {
    return contextOperation('שמירת הטקסט בשיחה.', async op => {
      if (!op.text.trim()) throw new Error('אפשר לכתוב או להדביק טקסט לשמירה.');
      await saveContext(op);
    }, 'הטקסט המלא נשמר בשיחה בשרת.');
  }
  function generate(mode, entryId, revisionStyle) {
    const editedDraft = entryId ? state.edits.get(entryId) : null;
    return contextOperation('BE GOOD מעבדת את רצף השיחה.', async op => {
      await saveContext(op);
      if (entryId && editedDraft && !op.draftSaved) {
        validateText(editedDraft);
        op.conversation = apply((await request(op, 'edit-before-revision', 'editDraft', { id: op.conversation.id, expectedRevision: op.conversation.revision, entryId, text: editedDraft }, true)).conversation);
        if (state.edits.get(entryId) === editedDraft) state.edits.delete(entryId);
        op.draftSaved = true;
      }
      await saveInstruction(op);
      op.conversation = apply((await request(op, 'generate', 'generate', { id: op.conversation.id, expectedRevision: op.conversation.revision, mode, instruction: op.instruction, ...(entryId ? { entryId } : {}), ...(revisionStyle ? { revisionStyle } : {}) }, true)).conversation);
      op.success = op.conversation.latestAI && op.conversation.latestAI.clarification
        ? 'נשמרה שאלה להשלמת פרט מרכזי. אפשר להוסיף תשובה בטקסט ולבקש ניסוח שוב.'
        : mode === 'close' ? 'טיוטת סיום השיחה נשמרה. אפשר לעדכן את המצב ל"הסתיים" בפרטי השיחה.' : 'הצעת BE GOOD נשמרה. אפשר לבדוק ולערוך אותה.';
      F('cc-timeline-title').scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
  }
  function details(title, children) { const d = el('details', 'cc-fold'); d.append(el('summary', '', title)); children.forEach(n => d.append(n)); return d; }
  function analysisBlock(analysis) {
    const parts = [el('p', 'muted', 'הפרשנויות הן אפשרויות לבדיקה. מה שלא נמסר בשיחה עשוי להיות לא ידוע.')];
    Object.entries(analysisLabels).forEach(([key, label]) => {
      const items = analysis && analysis[key];
      if (!Array.isArray(items) || !items.length) return;
      parts.push(el('h3', '', label)); const list = el('ul', 'cc-analysis-list'); items.forEach(item => list.append(el('li', '', item))); parts.push(list);
    });
    return parts.length > 1 ? details('ניתוח השיח בהרחבה', parts) : null;
  }
  function appendAiDetails(node, output) {
    if (output.why) node.append(details('מדוע דווקא כך?', [rich(output.why)]));
    if (output.next) { const next = el('div', 'cc-ai-next'); next.append(el('h3', '', 'מה כדאי לעשות בהמשך?'), rich(output.next)); node.append(next); }
    const a = analysisBlock(output.analysis); if (a) node.append(a);
    const relevant = ['agreements', 'openQuestions', 'followUp'];
    const parts = [];
    relevant.forEach(key => {
      const items = output.analysis && output.analysis[key];
      if (!Array.isArray(items) || !items.length) return;
      parts.push(el('h3', '', analysisLabels[key])); const list = el('ul', 'cc-analysis-list'); items.forEach(item => list.append(el('li', '', item))); parts.push(list);
    });
    if (parts.length) node.append(details('הסכמות, שאלות ומעקב', parts));
  }
  function sourceText(entry) {
    if (!entry.source) return '';
    if (typeof entry.source === 'string') return entry.source;
    const source = entry.source;
    const ids = source.entryIds || source.sourceEntryIds || source.ids;
    return [source.name ? 'קובץ: ' + source.name : '', source.kind ? 'סוג: ' + source.kind : '', source.method ? 'חילוץ: ' + source.method : '', Array.isArray(ids) ? 'מבוסס על רשומות: ' + ids.join(', ') : ''].filter(Boolean).join(' · ') || JSON.stringify(source);
  }
  function summaryContent(entry) {
    let context = entry.context;
    if (!context) { try { context = JSON.parse(entry.text); } catch (_) {} }
    if (!context || typeof context !== 'object') return rich(entry.text);
    const labels = { facts: 'עובדות שנמסרו', commitments: 'התחייבויות והסכמות שנמסרו', disagreements: 'מחלוקות', openQuestions: 'שאלות פתוחות', uncertainty: 'מה לא ידוע ופרשנויות אפשריות', drafts: 'טיוטות והצעות שטרם נשלחו' };
    const node = el('div');
    Object.entries(labels).forEach(([key, label]) => {
      if (!Array.isArray(context[key]) || !context[key].length) return;
      node.append(el('h3', '', label)); const list = el('ul', 'cc-analysis-list'); context[key].forEach(text => list.append(el('li', '', text))); node.append(list);
    });
    return node.childNodes.length ? node : rich(entry.text);
  }
  function renderEntry(entry, index) {
    const item = el('li', 'card cc-entry ' + entry.kind); item.dataset.entryId = entry.id;
    const heading = el('div', 'cc-entry-heading');
    heading.append(el('h3', '', (index + 1) + '. ' + (C.KINDS[entry.kind] || entry.kind)), el('span', 'muted', date(entry.at))); item.append(heading);
    if (entry.kind === 'draft') {
      const label = el('label', 'sr-only', 'עריכת טיוטה ' + (index + 1)); const editor = el('textarea', 'cc-draft-editor');
      editor.id = 'cc-draft-' + entry.id; label.htmlFor = editor.id; editor.value = state.edits.has(entry.id) ? state.edits.get(entry.id) : entry.text || ''; editor.rows = 6;
      const dirty = el('p', 'cc-unsaved', 'יש עריכה שעדיין לא נשמרה בשרת.'); dirty.hidden = !state.edits.has(entry.id);
      editor.addEventListener('input', () => { if (editor.value === entry.text) state.edits.delete(entry.id); else state.edits.set(entry.id, editor.value); dirty.hidden = !state.edits.has(entry.id); });
      const controls = el('div', 'cc-buttons');
      controls.append(button('שמירת העריכה', () => editDraft(entry.id, editor.value)), button('העתקת הטיוטה', () => copy(editor.value)));
      const sent = button('שלחתי את ההודעה', () => markSent(entry.id, editor.value), '');
      sent.dataset.action = 'markSent';
      controls.append(sent); item.append(label, editor, dirty, controls);
      if (entry.sentEntryId) item.append(el('p', 'muted', 'נוסח שנשלח כבר שמור בנפרד. סימון נוסף אחרי שינוי ישמור את הנוסח החדש שנשלח.'));
      const rev = el('div', 'cc-revisions'); rev.setAttribute('aria-label', 'שינוי סגנון הטיוטה');
      Object.entries(C.REVISIONS).forEach(([key, text]) => { const b = button(text, () => generate('suggest', entry.id, key)); b.dataset.revisionStyle = key; rev.append(b); });
      item.append(details('גרסה נוספת של הטיוטה', [rev]));
    } else if (entry.kind === 'received' || entry.kind === 'sent' || entry.kind === 'note') item.append(el('div', 'cc-entry-text', entry.text));
    else {
      item.append(entry.kind === 'summary' ? summaryContent(entry) : rich(entry.text));
      if (entry.kind === 'summary') item.append(el('p', 'muted', 'סיכום הקשר שנוצר ב־BE GOOD. ההודעות המקוריות נשמרות במלואן ברצף השיחה.'));
      if (entry.clarification) item.append(el('p', 'cc-clarification', entry.clarification));
    }
    if (entry.draftId) item.append(el('p', 'cc-entry-id', (entry.kind === 'sent' ? 'הנוסח שנשלח מתוך טיוטה: ' : 'גרסה של טיוטה: ') + entry.draftId));
    if (entry.sentEntryId) item.append(el('p', 'cc-entry-id', 'קישור לרשומה שנשלחה: ' + entry.sentEntryId));
    const source = sourceText(entry); if (source) item.append(el('p', 'cc-source', source));
    appendAiDetails(item, entry);
    const snapshots = Array.isArray(entry.revisions) ? entry.revisions : [];
    const provenance = [el('p', 'cc-entry-id', 'מזהה רשומה: ' + entry.id)];
    if (entry.versions) provenance.push(el('p', 'muted', 'גרסאות המערכת: ' + JSON.stringify(entry.versions)));
    if (entry.model) provenance.push(el('p', 'muted', 'מודל: ' + (entry.model.provider || '') + ' / ' + (entry.model.id || '')));
    snapshots.forEach((s, i) => {
      const v = el('div', 'cc-version'); v.append(el('h3', '', 'גרסה קודמת ' + (i + 1)), el('p', 'muted', date(s.at)), el('div', 'cc-version-text', s.text));
      if (entry.kind === 'draft') v.append(button('שימוש בנוסח הזה לעריכה', () => { state.edits.set(entry.id, s.text || ''); renderTimeline(); }));
      provenance.push(v);
    });
    item.append(details('היסטוריית גרסאות ופרטי מקור' + (snapshots.length ? ' (' + snapshots.length + ')' : ''), provenance));
    return item;
  }
  function renderTimeline() {
    const entries = state.selected && Array.isArray(state.selected.entries) ? state.selected.entries : [];
    F('cc-timeline').replaceChildren(...entries.map(renderEntry)); F('cc-empty').hidden = !!entries.length;
  }
  function renderConversation() {
    const c = state.selected;
    const oldNotice = F('cc-conversation').querySelector('[data-context-notice]'); if (oldNotice) oldNotice.remove();
    F('cc-conversation').hidden = !c;
    F('cc-composer-title').textContent = c ? 'הוספת הודעה או עדכון לשיחה' : 'מה קורה בשיחה?';
    if (c) {
      F('cc-title').textContent = c.title || 'שיחה ללא שם'; F('cc-status-badge').textContent = C.STATUSES[c.status] || c.status;
      F('cc-meta').textContent = 'נוצרה: ' + date(c.createdAt) + ' · עודכנה: ' + date(c.updatedAt) + ' · ' + (c.rounds || 0) + ' סבבי שיח · מזהה: ' + c.id;
      F('cc-rename').value = metadataValue('title', c); F('cc-status').value = metadataValue('status', c); F('cc-audience').value = metadataValue('audience', c);
      const summaries = (c.entries || []).filter(e => e.kind === 'summary');
      if (summaries.length) {
        const notice = details('סיכומי ההקשר בשיחה (' + summaries.length + ')', [el('p', 'muted', 'BE GOOD יצרה סיכומים כדי להתחשב ברצף של שיחה ארוכה. כל ההודעות המקוריות נשמרות במלואן. כל סיכום מזוהה בנפרד ומציג את מזהי הרשומות שעליהן הוא מבוסס.')]);
        notice.dataset.contextNotice = 'true'; F('cc-conversation').append(notice);
      }
    }
    renderTimeline();
    const result = F('cc-current-result'); result.replaceChildren();
    const latest = c && c.latestAI;
    // Draft text lives in the timeline. Empty-message analyses and clarification are shown distinctly here.
    result.hidden = !latest || (!!latest.message && !latest.clarification);
    if (!result.hidden) {
      result.append(el('h2', '', latest.clarification ? 'פרט נוסף לפני הניסוח' : 'הצעת BE GOOD'));
      if (latest.clarification) result.append(el('p', 'cc-clarification', latest.clarification), el('p', 'muted', 'אפשר להוסיף את הפרט בטקסט למעלה ולבקש שוב. לא נוצרה הודעה לשליחה.'));
      appendAiDetails(result, latest);
    }
  }
  function editDraft(entryId, text) {
    if (!state.selected) return;
    const c = state.selected;
    return run('שמירת עריכת הטיוטה.', async op => {
      validateText(text); if (!text.trim()) throw new Error('אפשר להוסיף נוסח לטיוטה לפני השמירה.');
      const result = await request(op, 'edit', 'editDraft', { id: c.id, expectedRevision: c.revision, entryId, text }, true);
      if (state.edits.get(entryId) === text) state.edits.delete(entryId);
      apply(result.conversation);
    }, 'הטיוטה נשמרה, והנוסח הקודם נשמר בהיסטוריית הגרסאות.');
  }
  function markSent(entryId, text) {
    if (!state.selected) return;
    const c = state.selected;
    return run('שמירת הנוסח שנשלח.', async op => {
      validateText(text); if (!text.trim()) throw new Error('אפשר להוסיף את הנוסח שנשלח.');
      apply((await request(op, 'sent', 'markSent', { id: c.id, expectedRevision: c.revision, entryId, text }, true)).conversation);
    }, 'נשמרה הודעה שנשלחה כרשומה נפרדת. עריכה נוספת של הטיוטה אינה משנה אותה.');
  }
  function updateConversation(patch, success) {
    if (!state.selected) return;
    const c = state.selected;
    return run('שמירת פרטי השיחה.', async op => {
      const result = await request(op, 'update', 'update', { id: c.id, expectedRevision: c.revision, ...patch }, true);
      acknowledgeMetadata(result.conversation, patch); apply(result.conversation);
    }, success || 'פרטי השיחה נשמרו.');
  }
  function deleteConversation() {
    if (!state.selected || state.busy) return;
    const c = state.selected;
    if (!window.confirm('מחיקת "' + (c.title || 'השיחה') + '" מסירה את ההודעות והטיוטות מהשרת. אפשר לייצא קודם. למחוק?')) return;
    return run('מחיקת השיחה.', async op => {
      const result = await request(op, 'delete', 'delete', { id: c.id, expectedRevision: c.revision }, true);
      if (!result.deleted) throw new ApiError('השרת לא אישר את המחיקה. אפשר לנסות שוב.', 'response', 502);
      state.conversations = state.conversations.filter(x => x.id !== c.id);
      state.buffers.delete(c.id); (c.entries || []).forEach(e => state.edits.delete(e.id)); state.selected = null;
      renderConversation(); renderList(); loadComposer();
    }, 'השיחה נמחקה מהשרת.');
  }
  async function upload() {
    const file = F('cc-file').files[0]; if (!file || state.busy) return;
    F('cc-file-clear').hidden = false;
    F('cc-file-status').textContent = 'קריאת הקובץ. טרם נשמר טקסט בשיחה.';
    // Read and release bytes within this operation only. No storage API ever receives a binary file.
    const existing = state.selected; const text = F('cc-text').value; const audience = F('cc-audience').value; const newId = uuid();
    const success = await run('קריאת הקובץ וחילוץ טקסט.', async op => {
      if (!op.initialized) {
        Object.assign(op, { initialized: true, existing, text, audience, newId });
        op.attachment = await SBE_COMMUNICATION_ATTACHMENTS.prepare(file);
      }
      await ensureConversation(op, op.text || file.name);
      F('cc-file-status').textContent = op.attachment.kind === 'text' ? 'הטקסט נקרא במלואו. המתנה לאישור השמירה בשרת.' : 'הקובץ נשלח לקריאת תמונה או PDF. עדיין אין אישור לחילוץ טקסט.';
      const previousIds = new Set((op.conversation.entries || []).map(e => e.id));
      const extracted = (await request(op, 'extract', 'extract', { id: op.conversation.id, expectedRevision: op.conversation.revision, attachment: op.attachment }, true)).conversation;
      if (!extracted || !extracted.entries.some(e => !previousIds.has(e.id) && e.kind === 'received' && e.text.trim())) throw new ApiError('השרת לא אישר שמירת טקסט שחולץ. אפשר לפתוח שוב את השיחה ולבדוק.', 'response', 502);
      apply(extracted);
      op.attachment = null;
      F('cc-file-status').textContent = 'טקסט קריא חולץ ונשמר בשיחה. אפשר לבדוק אותו ברצף השיחה.';
      F('cc-file').value = ''; F('cc-file-clear').hidden = true;
    }, 'הטקסט שחולץ נשמר בשיחה. הקובץ המקורי לא נשמר בשרת.');
    if (!success) {
      F('cc-file-status').textContent = 'אין אישור לחילוץ ולשמירת הטקסט. אפשר לבדוק את ההודעה ולנסות קובץ אחר.';
      if (!state.retry) F('cc-file').value = '';
    }
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); feedback('הנוסח הועתק.'); }
    catch (_) { feedback('ההעתקה לא זמינה בדפדפן הזה. אפשר לסמן ולהעתיק את הנוסח בשדה הטיוטה.', true); }
  }
  function saveFile(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type })); const a = el('a'); a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function exportData(c) {
    const out = JSON.parse(JSON.stringify(c));
    const overrides = {};
    (c.entries || []).filter(e => e.kind === 'draft' && state.edits.has(e.id)).forEach(e => { overrides[e.id] = state.edits.get(e.id); });
    if (Object.keys(overrides).length) out.exportUnsavedDrafts = overrides;
    return out;
  }
  function entryExportText(entry, c) { return c.exportUnsavedDrafts && Object.prototype.hasOwnProperty.call(c.exportUnsavedDrafts, entry.id) ? c.exportUnsavedDrafts[entry.id] : entry.text || ''; }
  function textExport(c) {
    const lines = ['ניהול שיח מתמשך · BE GOOD', c.title, 'מזהה: ' + c.id, 'מצב: ' + (C.STATUSES[c.status] || c.status), 'קהל: ' + (c.audience || 'לא צוין'), 'נוצרה: ' + date(c.createdAt), 'עודכנה: ' + date(c.updatedAt), 'סבבי שיח: ' + c.rounds, ''];
    (c.entries || []).forEach((entry, i) => {
      lines.push((i + 1) + '. ' + (C.KINDS[entry.kind] || entry.kind) + ' · ' + date(entry.at), 'מזהה רשומה: ' + entry.id, entryExportText(entry, c));
      if (c.exportUnsavedDrafts && Object.prototype.hasOwnProperty.call(c.exportUnsavedDrafts, entry.id)) lines.push('הנוסח לעיל כולל עריכה שטרם נשמרה בשרת. הנוסח השמור:', entry.text || '');
      if (entry.why) lines.push('מדוע דווקא כך?', entry.why);
      if (entry.next) lines.push('מה כדאי לעשות בהמשך?', entry.next);
      if (entry.clarification) lines.push('פרט נוסף לפני הניסוח:', entry.clarification);
      Object.entries(analysisLabels).forEach(([key, label]) => { if (Array.isArray(entry.analysis && entry.analysis[key]) && entry.analysis[key].length) lines.push(label, ...entry.analysis[key]); });
      if (entry.source) lines.push('מקור: ' + sourceText(entry));
      if (entry.draftId) lines.push('טיוטת מקור: ' + entry.draftId);
      if (entry.sentEntryId) lines.push('רשומה שנשלחה: ' + entry.sentEntryId);
      (entry.revisions || []).forEach((r, v) => lines.push('גרסה קודמת ' + (v + 1) + ' · ' + date(r.at), r.text || ''));
      lines.push('');
    });
    if (c.latestAI && c.latestAI.clarification) lines.push('פרט נוסף לפני הניסוח:', c.latestAI.clarification);
    return lines.join('\n');
  }
  function printExport(c) {
    if (!window.SBE_DOC) throw new Error('רכיב ההדפסה לא נטען. אפשר לרענן או לייצא טקסט.');
    const node = el('article');
    node.append(SBE_DOC.table([['מצב', C.STATUSES[c.status] || c.status], ['קהל', c.audience || 'לא צוין'], ['נוצרה', date(c.createdAt)], ['עודכנה', date(c.updatedAt)], ['סבבי שיח', c.rounds || 0], ['מזהה שיחה', c.id]]));
    (c.entries || []).forEach((entry, i) => {
      node.append(el('h2', '', (i + 1) + '. ' + (C.KINDS[entry.kind] || entry.kind)), el('p', '', date(entry.at)), entry.kind === 'summary' ? summaryContent(entry) : el('div', 'cc-entry-text', entryExportText(entry, c)));
      if (c.exportUnsavedDrafts && Object.prototype.hasOwnProperty.call(c.exportUnsavedDrafts, entry.id)) node.append(el('p', '', 'הנוסח לעיל כולל עריכה שטרם נשמרה בשרת.'), el('h3', '', 'הנוסח השמור קודם לעריכה'), el('div', 'cc-entry-text', entry.text));
      if (entry.why) node.append(el('h3', '', 'מדוע דווקא כך?'), rich(entry.why));
      if (entry.next) node.append(el('h3', '', 'מה כדאי לעשות בהמשך?'), rich(entry.next));
      if (entry.clarification) node.append(el('h3', '', 'פרט נוסף לפני הניסוח'), el('p', '', entry.clarification));
      Object.entries(analysisLabels).forEach(([key, label]) => {
        const values = entry.analysis && entry.analysis[key]; if (!Array.isArray(values) || !values.length) return;
        node.append(el('h3', '', label)); const list = el('ul'); values.forEach(t => list.append(el('li', '', t))); node.append(list);
      });
      const source = sourceText(entry); if (source) node.append(el('p', '', source));
      if (entry.draftId) node.append(el('p', '', 'טיוטת מקור: ' + entry.draftId));
      (entry.revisions || []).forEach((v, j) => node.append(el('h3', '', 'גרסה קודמת ' + (j + 1)), el('p', '', date(v.at)), el('div', 'cc-entry-text', v.text)));
    });
    if (c.latestAI && c.latestAI.clarification) node.append(el('h2', '', 'פרט נוסף לפני הניסוח'), el('p', '', c.latestAI.clarification));
    SBE_DOC.print({ title: c.title, kind: 'רצף שיחה', subtitle: 'הודעות, טיוטות והחלטות · ניהול שיח מתמשך', node, inline: true, extraCss: '.cc-entry-text{white-space:pre-wrap;overflow-wrap:anywhere;text-align:justify}h2,h3{break-after:avoid}li{break-inside:avoid}' });
  }
  function exportConversation(format) {
    if (!state.selected) return;
    const id = state.selected.id;
    return run('הכנת ייצוא השיחה.', async op => {
      const c = exportData((await request(op, 'export', 'export', { id }, false)).conversation);
      const name = 'BE GOOD · ניהול שיח מתמשך · ' + (c.title || 'שיחה').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '') + ' · ' + new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }).replace(/\//g, '.');
      if (format === 'pdf') printExport(c);
      else if (format === 'json') saveFile(name + '.json', JSON.stringify(c, null, 2), 'application/json;charset=utf-8');
      else saveFile(name + '.txt', '\uFEFF' + textExport(c), 'text/plain;charset=utf-8');
    }, format === 'pdf' ? 'נפתחה תצוגת הדפסה. אפשר לשמור בה כ־PDF. הנוסח הערוך נכלל במסמך.' : 'הייצוא הוכן במלואו. עריכות שטרם נשמרו בשרת מסומנות בקובץ.');
  }
  function init() {
    if (!C) { feedback('רכיב הכלי לא נטען. אפשר לרענן את הדף.', true); return; }
    try { const home = sessionStorage.getItem('sbe.session.homeUrl'); if (home) F('nav-home').href = home; } catch (_) {}
    Object.entries(C.STATUSES).forEach(([value, text]) => { const o = el('option', '', text); o.value = value; F('cc-status').append(o); });
    C.PRINCIPLES.forEach(p => F('cc-principles').append(el('li', '', p)));
    Object.entries(C.ACTIONS).forEach(([mode, text]) => { const b = button(text, () => generate(mode), ''); b.dataset.mode = mode; F('cc-main-actions').append(b); });
    F('cc-new').addEventListener('click', beginNew); F('cc-refresh').addEventListener('click', refreshList); F('cc-filter').addEventListener('change', renderList);
    F('cc-save-input').addEventListener('click', saveInput); F('cc-file').addEventListener('change', upload);
    F('cc-file-clear').addEventListener('click', () => { F('cc-file').value = ''; F('cc-file-status').textContent = ''; F('cc-file-clear').hidden = true; state.retry = null; F('cc-retry').hidden = true; });
    ['cc-text', 'cc-input-kind', 'cc-audience', 'cc-instruction', 'cc-rename', 'cc-status'].forEach(id => F(id).addEventListener('input', rememberComposer));
    F('cc-update').addEventListener('click', () => updateConversation({ title: F('cc-rename').value, status: F('cc-status').value, audience: F('cc-audience').value }));
    F('cc-reopen').addEventListener('click', () => updateConversation({ status: 'active' }, 'השיחה נפתחה מחדש.'));
    F('cc-archive').addEventListener('click', () => updateConversation({ status: 'archived' }, 'השיחה הועברה לארכיון. אפשר לפתוח אותה מחדש.'));
    F('cc-delete').addEventListener('click', deleteConversation);
    ['json', 'text', 'pdf'].forEach(format => F('cc-export-' + format).addEventListener('click', () => exportConversation(format)));
    F('cc-retry').addEventListener('click', () => { if (state.retry) execute(state.retry); });
    F('cc-conflict-refresh').addEventListener('click', () => { if (state.selected) selectConversation(state.selected.id); });
    window.addEventListener('beforeunload', e => {
      rememberComposer();
      const unsaved = [...state.buffers.entries()].some(([id, b]) => {
        const c = state.selected?.id === id ? state.selected : state.conversations.find(item => item.id === id);
        const savedInstruction = state.selected?.id === id ? latestInstruction(c)?.text || '' : b.savedInstruction;
        return b.text.trim() || (b.instruction.trim() && b.instruction !== savedInstruction)
          || ['title', 'status', 'audience'].some(field => b[field + 'Dirty'] && b[field] !== (c?.[field] || ''));
      });
      if (state.busy || state.edits.size || unsaved) { e.preventDefault(); e.returnValue = ''; }
    });
    renderConversation(); refreshList();
  }
  init();
})();
