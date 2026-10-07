// Private narrative preparation. Model replies are proposals; only explicit human actions change a saved version.
(function () {
  'use strict';
  const clone = value => structuredClone(value);
  const uuid = () => window.crypto.randomUUID();
  const FIELDS = {
    purpose: 'מטרת הפעילות', resilienceComponents: 'רכיבי החוסן שהפעילות מפתחת',
    individualSkills: 'מיומנויות אישיות', sharedSkills: 'מיומנויות משותפות',
    facilitatorGuide: 'הנחיות למנחה', socialMechanism: 'המנגנון החברתי: איך המשתתפים פועלים יחד'
  };
  const LISTS = new Set(['resilienceComponents', 'individualSkills', 'sharedSkills']);
  const activeSessions = new Map();
  const error = (message, code, status) => Object.assign(new Error(message), {code, status});
  const cancelled = () => error('הבקשה בוטלה. העריכה נשמרת בטיוטה.', 'cancelled');
  const assertActive = signal => { if (signal?.aborted) throw cancelled(); };
  const wait = (ms, signal) => new Promise((resolve, reject) => {
    assertActive(signal);
    const stop = () => { clearTimeout(timer); reject(cancelled()); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
    signal?.addEventListener('abort', stop, {once: true});
  });
  function createClient({server, pollMs = 1800, timeoutMs = 12 * 60000} = {}) {
    const origin = String(server || window.sbeAIOrigin()).replace(/\/$/, '');
    async function post(path, body, signal, onReceived) {
      assertActive(signal);
      const ctrl = new AbortController();
      const stop = () => ctrl.abort();
      signal?.addEventListener('abort', stop, {once: true});
      const timer = setTimeout(stop, 60000);
      try {
        const res = await fetch(origin + path, {method: 'POST', headers: window.sbeAIHeaders(), body: JSON.stringify(body), signal: ctrl.signal});
        const data = await res.json();
        if (!res.ok || data.error) throw error(data.error || 'הבקשה לא הושלמה', data.code, res.status);
        onReceived?.(data);
        assertActive(signal);
        return data;
      } catch (e) {
        if (signal?.aborted) throw cancelled();
        if (e.name === 'AbortError') throw error('השרת לא ענה בזמן. אפשר לנסות שוב; הטיוטה נשמרת.', 'timeout');
        throw e;
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
    }
    return async function request(body, {signal, onProgress} = {}) {
      const payload = {...body};
      if (payload.action !== 'review') return post('/api/artifacts', payload, signal);
      payload.async = true;
      payload.requestId ||= uuid();
      payload.idempotencyKey ||= uuid();
      let jobId;
      try {
        assertActive(signal);
        // Retain the bounded acknowledgment so an early cancellation can still
        // cancel the authenticated server job as soon as its ID arrives.
        const start = await post('/api/artifacts', payload, undefined, data => { jobId = data.jobId; });
        assertActive(signal);
        if (!start.jobId) return start.output || start;
        jobId = start.jobId;
        const until = Date.now() + timeoutMs;
        while (Date.now() < until) {
          await wait(pollMs, signal);
          const data = await post('/api/pipeline-status', {jobId}, signal);
          onProgress?.(data);
          if (data.status === 'done') return data.output || data;
          if (['error', 'cancelled', 'unknown', 'lost'].includes(data.status))
            throw error(data.error || 'הסקירה לא הושלמה. הטיוטה נשמרת.', data.code || data.status);
        }
        throw error('הסקירה לא הושלמה בזמן. הטיוטה נשמרת.', 'timeout');
      } catch (e) {
        if (jobId && (signal?.aborted || e.code === 'timeout')) {
          // Cancellation is authenticated too, and never changes the artifact content.
          try { await post('/api/pipeline-cancel', {jobId}); } catch (_) {}
        }
        throw e;
      }
    };
  }
  function draftFromScenario(scenario) {
    const generation = scenario?._generation;
    if (!generation?.pipelineOutput || !generation.context) throw error('חסר מקור pipeline מאומת. אי אפשר לשמור את התרחיש הזה כפעילות.', 'missing_pipeline_context');
    const points = generation.pipelineOutput.turningPoints || [];
    const duration = Number(scenario.duration) || 0;
    return {
      kind: 'narrative', pipelineOutput: clone(generation.pipelineOutput), context: clone(generation.context),
      scenario: clone(Object.fromEntries(Object.entries(scenario).filter(([k]) => k !== '_generation'))),
      purpose: generation.context.given?.goals || scenario.given?.goals || '',
      resilienceComponents: [], individualSkills: (generation.context.skills || []).filter(s => typeof s === 'string' && s.trim()),
      sharedSkills: [], facilitatorGuide: '', socialMechanism: '',
      steps: points.map((p, i) => ({id: 'tp-' + (i + 1), title: p.name || '',
        instructions: [p.trigger, p.characterDoes?.line || (typeof p.does === 'string' ? p.does : p.does?.line),
          p.characterDoes?.action || p.does?.action, p.demands, p.ifMissed || p.missed].filter(Boolean).join('\n'),
        minutes: duration > 0 && points.length ? Math.max(1, Math.round(duration / points.length)) : 1}))
    };
  }
  function missingFields(content) {
    const missing = Object.keys(FIELDS).filter(k => LISTS.has(k)
      ? !Array.isArray(content?.[k]) || !content[k].length || content[k].some(x => typeof x !== 'string' || !x.trim())
      : typeof content?.[k] !== 'string' || !content[k].trim());
    if (!content?.steps?.length || content.steps.some(s => !s.title?.trim() || !s.instructions?.trim() || !Number.isFinite(s.minutes) || s.minutes <= 0)) missing.push('steps');
    return missing;
  }
  function valueAt(content, path) {
    const parts = path.split('/');
    if (parts[0] === 'steps' && parts.length === 3) return content.steps?.find(s => s.id === parts[1])?.[parts[2]];
    return content[parts[0]];
  }
  function proposalBase(artifact, proposal) {
    return artifact?.version === proposal.baseVersion ? artifact.content
      : artifact?.history?.find(entry => entry.version === proposal.baseVersion)?.content;
  }
  function fieldName(content, path) {
    if (FIELDS[path]) return FIELDS[path];
    if (path === 'steps') return 'שלבי הפעילות';
    if (path === 'pipelineOutput') return 'תוכן התרחיש';
    const [, id, field] = path.split('/');
    return (content?.steps?.find(step => step.id === id)?.title || 'שלב מהגרסה הקודמת') + ' — '
      + ({title: 'שם השלב', instructions: 'הנחיות השלב', minutes: 'משך בדקות'}[field] || 'תוכן');
  }
  function readable(value) {
    if (value === undefined || value === null || value === '') return 'חסר';
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }
  function savedArtifacts() {
    try { return JSON.parse(localStorage.getItem(window.sbeUserKey('sbe.narrative.artifacts.v1')) || '[]'); }
    catch (_) { return []; }
  }
  function createSession({scenario, artifactId, server, request = createClient({server}), onChange = () => {}} = {}) {
    const state = {artifact: null, draft: scenario ? draftFromScenario(scenario) : null, concerns: '', dirty: !!scenario,
      revision: 0, busy: false, conflict: false, conflictBaseVersion: null, forbidden: false, review: null, reviewBase: null, message: '', recovery: null, lastReview: null};
    let ctrl = null;
    let disposed = false;
    let localId = artifactId || 'new-' + (scenario?.id || uuid());
    const localKey = () => window.sbeUserKey('sbe.narrative.artifact.draft.v1.' + localId);
    const sessionOwner = {};
    function claim(key) { activeSessions.get(key)?.dispose(); activeSessions.set(key, sessionOwner); }
    function dispose() { disposed = true; ctrl?.abort(); if (activeSessions.get(localKey()) === sessionOwner) activeSessions.delete(localKey()); }
    sessionOwner.dispose = dispose; claim(localKey());
    const emit = type => { if (!disposed) onChange(state, type); };
    function persist() {
      if (disposed || activeSessions.get(localKey()) !== sessionOwner) return;
      try {
        localStorage.setItem(localKey(), JSON.stringify({artifactId: state.artifact?.id, baseVersion: state.conflict ? state.conflictBaseVersion : state.artifact?.version,
          draft: state.draft, concerns: state.concerns, dirty: state.dirty, recovery: state.recovery, at: Date.now()}));
        if (state.artifact) {
          const list = savedArtifacts().filter(a => a.id !== state.artifact.id);
          list.unshift({id: state.artifact.id, name: state.draft?.scenario?.name || 'תרחיש', version: state.artifact.version, status: state.artifact.status});
          localStorage.setItem(window.sbeUserKey('sbe.narrative.artifacts.v1'), JSON.stringify(list.slice(0, 30)));
        }
      } catch (_) { state.message = 'הטיוטה לא נשמרה במכשיר. אפשר לשמור בשרת או להוריד גיבוי פרטי.'; }
    }
    function readLocal() { try { return JSON.parse(localStorage.getItem(localKey()) || 'null'); } catch (_) { return null; } }
    const initialLocal = scenario ? readLocal() : null;
    if (initialLocal?.dirty && initialLocal.draft && JSON.stringify(initialLocal.draft.context) === JSON.stringify(state.draft.context)) {
      state.draft = initialLocal.draft; state.concerns = initialLocal.concerns || ''; state.recovery = initialLocal.recovery || null;
      state.message = 'שוחזרה הטיוטה המקומית הפרטית.';
    }
    function edited() {
      state.revision++; state.dirty = true; state.message = 'עריכה מקומית — כדי לאמץ הצעה או לאשר גרסה, אפשר לשמור את העריכה בשרת.';
      persist(); emit('edited');
    }
    function adopt(artifact, revision, type = 'saved', preserveDraft = false) {
      if (disposed) throw cancelled();
      if (!artifact?.id || !Number.isInteger(artifact.version) || !artifact.content) throw error('השרת החזיר גרסה חסרה', 'invalid_artifact_response');
      const previousKey = localKey();
      state.artifact = artifact; localId = artifact.id; state.conflict = false; state.conflictBaseVersion = null;
      if (previousKey !== localKey()) { if (activeSessions.get(previousKey) === sessionOwner) activeSessions.delete(previousKey); claim(localKey()); }
      if (state.revision === revision && !preserveDraft) {
        state.draft = clone(artifact.content); state.concerns = artifact.privateConcerns || ''; state.dirty = false;
        state.message = artifact.status === 'approved' ? 'הגרסה אושרה על ידך לשימוש.' : 'נשמרה גרסה פרטית ' + artifact.version + ' בשרת.';
      } else state.message = 'הגרסה נשמרה בשרת; העריכה החדשה נשארה במכשיר וטרם נשמרה בשרת.';
      persist();
      if (previousKey !== localKey()) { try { localStorage.removeItem(previousKey); } catch (_) {} }
      emit(type);
      if (window.dispatchEvent && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('sbe-artifact-saved'));
      return artifact;
    }
    async function operation(fn) {
      if (disposed) throw cancelled();
      if (state.busy) throw error('בקשה כבר פועלת. אפשר לבטל אותה.', 'busy');
      if (state.forbidden) throw error('אין הרשאה לפתיחת הפעילות.', 'artifact_forbidden', 403);
      state.busy = true; state.message = 'הבקשה פועלת…'; ctrl = new AbortController(); emit('status');
      try { return await fn(ctrl.signal); }
      catch (e) {
        if (disposed) throw e;
        if (e.code === 'version_conflict') { state.conflict = true; state.conflictBaseVersion = state.artifact?.version; }
        if ([401, 403, 404].includes(e.status)) state.forbidden = true;
        const messages={version_conflict:'הגרסה בשרת השתנתה. העריכה המקומית נשמרה; פתחי את גרסת השרת לפני המשך.',
          review_input_too_large:'התוכן גדול מדי לסקירה אחת. קצּרי את תוכן הטיוטה או את חומר הרקע לפני ניסיון נוסף; אפשר להוריד גיבוי פרטי.',
          review_running:'סקירה של הבקשה הזאת עדיין פועלת. המתיני לסיום או בטלי את הבקשה.',
          review_lost:'הסקירה נקטעה. העריכה נשמרה; אפשר לבקש ניסיון נוסף.',
          access_denied:'ההרשאה הסתיימה. היכנסי שוב לפני המשך; העריכה המקומית נשמרה.'};
        state.message = messages[e.code] || (e.code === 'cancelled' ? e.message : 'הבקשה לא הושלמה: ' + e.message);
        persist(); emit('status'); throw e;
      } finally { state.busy = false; ctrl = null; emit('status'); }
    }
    async function save() {
      if (!state.draft) throw error('אין טיוטה לשמירה', 'missing_draft');
      if (state.conflict) throw error('יש לפתוח את גרסת השרת לפני שמירה נוספת', 'version_conflict', 409);
      if (!state.dirty && state.artifact) return state.artifact;
      return operation(async signal => {
        const revision = state.revision;
        const body = {action: state.artifact ? 'update' : 'create', content: clone(state.draft), privateConcerns: state.concerns};
        if (state.artifact) Object.assign(body, {artifactId: state.artifact.id, expectedVersion: state.artifact.version});
        const result = await request(body, {signal}); assertActive(signal);
        return adopt(result.artifact, revision);
      });
    }
    async function load({discardLocal = false} = {}) {
      return operation(async signal => {
        const revision = state.revision, local = readLocal();
        const result = await request({action: 'get', artifactId: state.artifact?.id || artifactId}, {signal}); assertActive(signal);
        if (state.revision !== revision) { state.conflictBaseVersion = state.artifact?.version; state.artifact = result.artifact; state.conflict = true; persist(); emit('status'); return result.artifact; }
        if (discardLocal) {
          if (state.dirty) state.recovery = {draft: clone(state.draft), concerns: state.concerns};
          adopt(result.artifact, revision, 'loaded');
        } else {
          adopt(result.artifact, revision, 'loaded');
          state.recovery = local?.recovery || null;
          if (local?.dirty && local.draft) {
            state.draft = local.draft; state.concerns = local.concerns || ''; state.dirty = true;
            state.conflict = local.baseVersion !== result.artifact.version;
            state.conflictBaseVersion = state.conflict ? local.baseVersion : null;
            state.message = state.conflict ? 'הטיוטה המקומית נשמרה, אך גרסת השרת השתנתה. פתחי את גרסת השרת כדי להשוות.' : 'שוחזרה העריכה המקומית שטרם נשמרה בשרת.';
            persist(); emit('loaded');
          }
        }
        persist(); emit('loaded');
        return result.artifact;
      });
    }
    function pendingProposals() {
      const list = state.artifact?.proposals?.filter(p => p.decision === 'pending') || [];
      const proposal = state.review?.proposal;
      return proposal ? [proposal, ...list.filter(p => p.id !== proposal.id)] : list;
    }
    function canAccept(proposal) {
      return !!state.artifact && !state.dirty && !state.conflict && !state.busy && proposal.baseVersion === state.artifact.version
        && !proposal.stale && !['accepted', 'rejected'].includes(proposal.decision);
    }
    async function review({question = '', stepId = '', requestType = 'refine', retry = false} = {}) {
      if (state.dirty || !state.artifact) await save();
      // Saving may finish after a new edit. Never review the wrong visible draft.
      if (state.dirty) throw error('העריכה השתנתה במהלך השמירה. שמרי שוב לפני סקירה.', 'unsaved_changes');
      return operation(async signal => {
        const version = state.artifact.version;
        const prior = state.lastReview;
        const body = retry && prior?.expectedVersion === version ? {...prior, requestId: uuid(), retry: true}
          : {action: 'review', artifactId: state.artifact.id, expectedVersion: version, question, stepId, requestType, idempotencyKey: uuid(), requestId: uuid()};
        state.lastReview = body; state.reviewBase = clone(state.draft);
        const result = await request(body, {signal, onProgress: () => { state.message = 'הסקירה פועלת…'; emit('status'); }});
        assertActive(signal);
        state.review = result.review;
        if (result.artifact?.version === state.artifact.version) state.artifact = result.artifact;
        state.message = state.dirty || state.artifact.version !== version ? 'הגיעה הצעה לגרסה קודמת. העריכה שלך נשארה; ההצעה לא אומצה.'
          : state.review?.proposal ? 'הגיעה הצעה פרטית. קראי את ההבדלים ובחרי אם לאמץ או לדחות.'
          : 'הסקירה לא הפיקה הצעה תקינה. אפשר לנסות שוב; התוכן נשאר כפי ששמרת.';
        persist(); emit('review'); return state.review;
      });
    }
    async function decide(proposal, decision) {
      if (decision === 'accept' && !canAccept(proposal)) throw error('ההצעה מיושנת או שיש עריכה שלא נשמרה. לא ניתן לאמץ אותה.', 'stale_proposal');
      if (!state.artifact || state.conflict || proposal.baseVersion !== state.artifact.version) throw error('ההצעה שייכת לגרסה קודמת.', 'stale_proposal');
      return operation(async signal => {
        const revision = state.revision;
        const result = await request({action: 'decide', artifactId: state.artifact.id, expectedVersion: state.artifact.version, proposalId: proposal.id, decision}, {signal});
        assertActive(signal);
        proposal.decision = decision === 'accept' ? 'accepted' : 'rejected';
        return adopt(result.artifact, revision, 'decision', decision === 'reject' && state.dirty);
      });
    }
    function acceptedRisks() {
      return (state.artifact?.proposals || []).filter(p => p.decision === 'accepted').flatMap(p => [...(p.unknowns || []), ...(p.riskFlags || [])]);
    }
    async function approve(acknowledgeRisks) {
      if (state.dirty || !state.artifact) throw error('שמרי את העריכה לפני אישור', 'unsaved_changes');
      if (missingFields(state.draft).length) throw error('חסרים הסברים או שלבים. מלאי אותם לפני אישור.', 'missing_explanation');
      const recentRisk = state.review?.proposal?.decision === 'accepted' && ((state.review.proposal.unknowns || []).length || (state.review.proposal.riskFlags || []).length);
      if ((acceptedRisks().length || recentRisk) && !acknowledgeRisks) throw error('נדרש אישור שקראת את הסיכונים והמידע החסר.', 'risk_acknowledgment_required');
      return operation(async signal => {
        const revision = state.revision;
        const result = await request({action: 'approve', artifactId: state.artifact.id, expectedVersion: state.artifact.version, acknowledgeRisks: acknowledgeRisks === true}, {signal});
        assertActive(signal); return adopt(result.artifact, revision, 'approved');
      });
    }
    function practiceURL() {
      if (!state.artifact || state.dirty || state.artifact.status !== 'approved') return '';
      const approved = state.artifact.approvedVersions?.find(a => a.version === state.artifact.version);
      return approved ? 'practice.html?artifactId=' + encodeURIComponent(state.artifact.id) + '&version=' + approved.version : '';
    }
    return {state, save, load, review, decide, approve, acceptedRisks, pendingProposals, canAccept, practiceURL,
      cancel() { ctrl?.abort(); }, dispose,
      edit(field, value) { if (!Object.hasOwn(FIELDS, field)) throw error('שדה לא נתמך', 'invalid_field'); state.draft[field] = clone(value); edited(); },
      setConcerns(value) { state.concerns = String(value); edited(); },
      editStep(id, field, value) { const step = state.draft.steps.find(s => s.id === id); if (!step || !['title', 'instructions', 'minutes'].includes(field)) return; step[field] = value; edited(); },
      addStep() { const id = 'step-' + uuid(); state.draft.steps.push({id, title: '', instructions: '', minutes: 1}); edited(); emit('steps'); return id; },
      removeStep(id) { state.draft.steps = state.draft.steps.filter(s => s.id !== id); edited(); emit('steps'); },
      restoreRecovery() { if (!state.recovery) return; state.draft = clone(state.recovery.draft); state.concerns = state.recovery.concerns; state.recovery = null; edited(); emit('loaded'); },
      backup() { return JSON.stringify({privacy: 'private', artifactId: state.artifact?.id, baseVersion: state.artifact?.version, content: state.draft, privateConcerns: state.concerns}, null, 2); }
    };
  }

  const node = (tag, text, attrs = {}) => {
    const n = document.createElement(tag); if (text !== undefined) n.textContent = text;
    for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, String(value));
    return n;
  };
  const button = (text, fn) => { const b = node('button', text, {type: 'button'}); b.addEventListener('click', fn); return b; };
  function mount(container, {scenario, artifactId, server, onApproved} = {}) {
    const root = node('section', undefined, {class: 'sbe-artifact-editor', dir: 'rtl', 'aria-label': 'הכנה פרטית של פעילות'});
    root.append(node('style', `.sbe-artifact-editor{margin-block:16px;padding:16px;border:1px solid #b9c7d0;border-radius:10px;background:#f7f9fa;color:#172b3a;font:16px/1.55 Assistant,Arial,sans-serif}.sbe-artifact-editor h3{margin:0 0 10px}.sbe-artifact-editor label{display:block;margin-top:10px;font-weight:600}.sbe-artifact-editor textarea,.sbe-artifact-editor input[type=text],.sbe-artifact-editor input[type=number]{display:block;width:100%;box-sizing:border-box;border:1px solid #a5b5c0;border-radius:5px;padding:8px;font:inherit;background:#fff;color:#172b3a}.sbe-artifact-editor textarea{min-height:80px;resize:vertical}.sbe-artifact-editor button,.sbe-artifact-editor a{font:inherit;margin:6px 4px;padding:7px 12px;border:1px solid #a5b5c0;border-radius:5px;background:#e4edf4;color:#173d5b;cursor:pointer}.sbe-artifact-editor button:disabled{opacity:.5;cursor:default}.sbe-artifact-editor :focus-visible{outline:3px solid #b66d20;outline-offset:3px}.sbe-artifact-editor .ar-status{padding:8px;background:#edf2f5}.sbe-artifact-editor .ar-step,.sbe-artifact-editor .ar-proposal{border:1px solid #c5d0d7;border-radius:6px;margin:12px 0;padding:12px}.sbe-artifact-editor .ar-missing{color:#8e3f1d}.sbe-artifact-editor pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;max-height:280px;overflow:auto}.sbe-artifact-editor table{width:100%;border-collapse:collapse;table-layout:fixed}.sbe-artifact-editor th,.sbe-artifact-editor td{text-align:start;vertical-align:top;border:1px solid #c5d0d7;padding:8px;overflow-wrap:anywhere}@media(max-width:600px){.sbe-artifact-editor{padding:10px}.sbe-artifact-editor table,.sbe-artifact-editor tbody,.sbe-artifact-editor tr,.sbe-artifact-editor td{display:block}.sbe-artifact-editor th{display:none}}`));
    root.append(node('h3', 'הכנה, סקירה ואישור של הפעילות'));
    root.append(node('p', 'טיוטה פרטית. מטרת הפעילות מגיעה מהקלט שלך; הסברים שלא נמסרו מסומנים כחסרים. זמני השלבים הם אומדן לעריכה. הסקירה מסייעת בתכנון ואינה הוכחה ליעילות חינוכית.'));
    const status = node('p', '', {class: 'ar-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true'});
    const form = node('div'), proposals = node('div', undefined, {'aria-label': 'הצעות פרטיות לבדיקה'}), actions = node('div');
    const session = createSession({scenario, artifactId, server, onChange: (_, type) => {
      if (['edited', 'loaded', 'decision', 'saved'].includes(type)) ack.checked = false;
      if (['loaded', 'steps', 'decision', 'approved'].includes(type) || (type === 'saved' && !session.state.dirty)) renderForm();
      renderStatus(); if (['review', 'loaded', 'decision', 'saved', 'edited'].includes(type)) renderProposals();
      if (type === 'approved' && !session.state.dirty) onApproved?.(session.state.artifact);
    }});
    root.sbeDisposeActivity = session.dispose;
    const run = async fn => { try { await fn(); } catch (_) { renderStatus(); } };
    const save = button('שמירת טיוטה פרטית בשרת', () => run(() => session.save()));
    const review = button('סקירת איכות והצעת שיפור', () => run(() => session.review({requestType: 'refine'})));
    const retry = button('ניסיון נוסף לסקירה', () => run(() => session.review({retry: true})));
    const cancel = button('ביטול הבקשה', () => session.cancel());
    const load = button('פתיחת גרסת השרת ושמירת העריכה המקומית לגיבוי', () => run(() => session.load({discardLocal: true})));
    const restore = button('החזרת העריכה המקומית להשוואה', () => session.restoreRecovery());
    const backup = button('הורדת גיבוי אישי פרטי', () => {
      const a = node('a'); const url = URL.createObjectURL(new Blob([session.backup()], {type: 'application/json;charset=utf-8'}));
      a.href = url; a.download = 'private-preparation.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const ack = node('input', undefined, {type: 'checkbox'});
    const ackLabel = node('label'); ackLabel.append(ack, document.createTextNode(' קראתי את הפעילות, המידע החסר והסיכונים, ואני מאשר/ת את הגרסה לשימוש בהנחייתי.'));
    ack.addEventListener('change', renderStatus);
    const approve = button('אישור אנושי של הגרסה השמורה', () => run(() => session.approve(ack.checked)));
    const practice = node('a', 'פתיחת הגרסה המאושרת בתרגול');
    actions.append(save, review, retry, cancel, load, restore, backup, ackLabel, approve, practice);
    root.append(status, form, proposals, actions); container.append(root);
    function field(parent, labelText, value, handler, {type = 'textarea', min} = {}) {
      const label = node('label', labelText), input = node(type === 'textarea' ? 'textarea' : 'input', undefined, {'aria-label': labelText});
      if (type !== 'textarea') input.type = type; if (min !== undefined) input.min = min;
      input.value = value ?? ''; input.addEventListener('input', () => handler(input.value)); label.append(input); parent.append(label); return input;
    }
    function renderForm() {
      form.replaceChildren(); const {draft} = session.state; if (!draft) return;
      for (const [key, title] of Object.entries(FIELDS)) {
        const label = title + (LISTS.has(key) ? ' — פריט אחד בכל שורה' : '');
        field(form, label, LISTS.has(key) ? (draft[key] || []).join('\n') : draft[key] || '', value => session.edit(key, LISTS.has(key) ? value.split('\n').map(s => s.trim()).filter(Boolean) : value));
      }
      form.append(node('h4', 'שלבי הפעילות'));
      for (const step of draft.steps || []) {
        const box = node('section', undefined, {class: 'ar-step', 'aria-label': 'שלב ' + (step.title || step.id)});
        field(box, 'שם השלב', step.title, v => session.editStep(step.id, 'title', v), {type: 'text'});
        field(box, 'הנחיות השלב', step.instructions, v => session.editStep(step.id, 'instructions', v));
        field(box, 'משך השלב בדקות — אומדן לעריכה', step.minutes, v => session.editStep(step.id, 'minutes', Number(v)), {type: 'number', min: '0.1'});
        let question = '';
        field(box, 'שאלה או בקשת שינוי לגבי השלב', '', v => { question = v; });
        box.append(button('שאלה על השלב', () => run(() => session.review({requestType: 'question', stepId: step.id, question}))),
          button('בקשת שיפור לשלב', () => run(() => session.review({requestType: 'refine', stepId: step.id, question}))),
          button('הסרת השלב', () => session.removeStep(step.id)));
        form.append(box);
      }
      form.append(button('הוספת שלב', () => session.addStep()));
      field(form, 'חשש פרטי למנחה — משמש לשיחה תומכת, אינו חלק מהפעילות למשתתפים', session.state.concerns, v => session.setConcerns(v));
      form.append(button('שאלה ועידוד בנוגע לחשש הפרטי', () => run(() => session.review({requestType: 'concern', question: 'עזרי לי לבחור איך להתמודד עם החשש הפרטי, במילים מעודדות ובלי לכלול אותו בנוסח הפעילות.'}))));
    }
    function renderStatus() {
      const s = session.state, missing = missingFields(s.draft);
      status.textContent = [s.artifact ? 'גרסה ' + s.artifact.version + ' · ' + ({draft: 'טיוטה פרטית', review_required: 'דורשת בדיקה', approved: 'מאושרת'}[s.artifact.status] || s.artifact.status) : 'טיוטה מקומית פרטית', s.message,
        missing.length ? 'חסר: ' + missing.map(k => FIELDS[k] || 'שלבים תקינים').join(' · ') : 'כל שדות ההסבר מולאו.'].filter(Boolean).join(' — ');
      const blocked = s.busy || s.forbidden || !s.draft;
      save.disabled = blocked || s.conflict || (!s.dirty && !!s.artifact);
      review.disabled = blocked || s.conflict; retry.disabled = blocked || s.conflict || !s.lastReview;
      cancel.hidden = !s.busy; load.hidden = !s.conflict; load.disabled = s.busy || s.forbidden;
      restore.hidden = !s.recovery; restore.disabled = s.busy;
      approve.disabled = blocked || s.dirty || s.conflict || !s.artifact || missing.length > 0 || !ack.checked;
      practice.hidden = !session.practiceURL(); practice.href = session.practiceURL();
      // Edits remain available during a review, but a revoked session cannot submit any new action.
      form.querySelectorAll('button').forEach(b => { if (!['הסרת השלב', 'הוספת שלב'].includes(b.textContent)) b.disabled = blocked || s.conflict; });
      proposals.querySelectorAll('button[data-accept]').forEach(b => { const p = session.pendingProposals().find(x => x.id === b.getAttribute('data-accept')); b.disabled = !p || !session.canAccept(p); });
      proposals.querySelectorAll('button[data-reject]').forEach(b => { const p = session.pendingProposals().find(x => x.id === b.getAttribute('data-reject')); b.disabled = !p || s.busy || s.forbidden || p.baseVersion !== s.artifact?.version; });
    }
    function renderProposals() {
      proposals.replaceChildren();
      if (!session.state.review) {
        for (const r of Object.values(session.state.artifact?.reviewRuns || {})) {
          if (r.baseVersion === session.state.artifact.version) proposals.append(node('p', 'סקירה שמורה של הגרסה: ' + ({complete: 'הושלמה', partial: 'חלקית', fallback: 'מסלול חלופי', failed: 'נכשלה', cancelled: 'בוטלה', running: 'פועלת'}[r.status] || r.status) + (r.fallback ? ' · חלק מהבודקים לא השלימו' : '')));
        }
      }
      if (session.state.review) {
        const r = session.state.review;
        proposals.append(node('p', 'מצב הסקירה: ' + ({complete: 'הושלמה', partial: 'חלקית — חלק מהבודקים לא השלימו', fallback: 'מסלול חלופי', failed: 'נכשלה', cancelled: 'בוטלה'}[r.status] || r.status) + ' · ' + (r.mode === 'team' ? 'צוות בודקים' : 'בודק יחיד') + (r.fallback ? ' · הופעל מסלול חלופי' : '')));
      }
      for (const proposal of session.pendingProposals()) {
        if (['accepted', 'rejected'].includes(proposal.decision)) continue;
        const box = node('section', undefined, {class: 'ar-proposal', 'aria-label': 'הצעה פרטית לגרסה ' + proposal.baseVersion});
        box.append(node('h4', 'הצעה פרטית · גרסת בסיס ' + proposal.baseVersion), node('p', proposal.rationale));
        const table = node('table'), head = node('tr');
        for (const title of ['שדה', 'לפני', 'הצעה']) head.append(node('th', title)); table.append(head);
        const base = proposalBase(session.state.artifact, proposal);
        for (const change of proposal.changes || []) {
          const row = node('tr'); row.append(node('td', fieldName(base, change.path)));
          const before = node('td'), after = node('td'); before.append(node('pre', base ? readable(valueAt(base, change.path)) : 'גרסת הבסיס אינה זמינה להשוואה'));
          after.append(node('pre', readable(change.value))); row.append(before, after); table.append(row);
        }
        box.append(table, node('p', 'מקורות מאושרים (מזהים): ' + ((proposal.sourceIds || []).join(' · ') || 'לא צוינו')),
          node('p', 'מידע חסר: ' + ((proposal.unknowns || []).join(' · ') || 'לא צוין')),
          node('p', 'סיכונים לבדיקה: ' + ((proposal.riskFlags || []).join(' · ') || 'לא צוינו')));
        if (session.state.dirty || session.state.conflict || proposal.baseVersion !== session.state.artifact?.version)
          box.append(node('p', 'ההצעה לא תשנה עריכה חדשה או גרסה אחרת. אפשר לשמור ולבקש סקירה חדשה.', {class: 'ar-missing'}));
        const accept = button('אימוץ ההצעה לגרסה חדשה', () => run(() => session.decide(proposal, 'accept'))); accept.setAttribute('data-accept', proposal.id); accept.disabled = !session.canAccept(proposal);
        const reject = button('דחיית ההצעה', () => run(() => session.decide(proposal, 'reject')));
        reject.setAttribute('data-reject', proposal.id);
        reject.disabled = session.state.busy || session.state.forbidden || session.state.conflict || proposal.baseVersion !== session.state.artifact?.version;
        box.append(accept, reject); proposals.append(box);
      }
      const risks = session.acceptedRisks(); if (risks.length) proposals.append(node('p', 'מידע חסר וסיכונים בהצעות שאומצו: ' + risks.join(' · ')));
    }
    renderForm(); renderStatus();
    if (artifactId) run(() => session.load());
    return session;
  }
  function mountSaved(container, {server, show} = {}) {
    const box = node('div', undefined, {dir: 'rtl'});
    container.append(box);
    function render() {
      box.replaceChildren(); const list = savedArtifacts(); if (!list.length) return;
      box.append(node('p', 'פעילויות פרטיות שנשמרו בשרת — פתיחה מחדש דורשת את הרשאת המשתמש/ת הנוכחי/ת.'));
      for (const item of list) box.append(button(item.name + ' · פתיחה מחדש', () => {
        const panel = node('div'); mount(panel, {artifactId: item.id, server}); show('הכנה פרטית — ' + item.name, panel);
      }));
    }
    window.addEventListener?.('sbe-artifact-saved', render); render();
  }
  window.SBE_ACTIVITY_REVIEW = {draftFromScenario, missingFields, valueAt, createClient, createSession, mount, mountSaved};
})();
