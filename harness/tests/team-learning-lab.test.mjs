import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const TEAM = require('../../app/lib/team-learning-lab.js');
const completeContext = (overrides = {}) => ({
  audience: 'students', ageBand: 'd-f', situation: 'routine', mode: 'in-person',
  emergencyKind: '', subject: 'מתמטיקה', curriculumGoal: 'להסביר שתי דרכים לייצוג שבר',
  goal: 'להקשיב להסבר ולבנות ייצוג משותף', environment: 'זוגות בכיתה', constraints: 'נייר וטושים',
  accessibility: 'אפשר לצייר במקום לדבר', adultSupport: 'המחנכת מדגימה ומלווה',
  groupSize: 24, minutes: 30, models: ['experiential-reflection', 'udl'], immediateDanger: false, ...overrides
});
const step = (id, phase, minutes) => ({
  id, title: 'מנסים ייצוג', phase, minutes, purpose: 'להסביר דרך פתרון',
  instructions: 'כל משתתפת מציירת שבר ואז משווה עם עמיתה.', facilitation: 'אפשר לשאול מה הציור מבהיר.',
  resources: 'נייר וטושים', environment: 'שולחן נגיש', components: ['הדדיות'],
  individualSkills: ['הסבר'], sharedSkills: ['הקשבה']
});
const activity = (overrides = {}) => ({
  title: 'שתי דרכים לשבר', purpose: 'להסביר ולבחור ייצוג משותף',
  facilitationGuide: 'המורה מדגימה ומזמינה כל משתתפת לבחור דרך השתתפות.',
  environmentPlan: 'זוגות במקום וחלופה בישיבה', uncertaintyPlan: 'נשווה שתי השערות ונבדוק נתונים',
  creativityPlan: 'ננסה שני ייצוגים', conflictPlan: 'ננסח את דברי האחרת ונבחן ראיות',
  participationAlternative: 'אפשר לצייר, לעבור או לעצור', resilienceComponents: ['הדדיות'],
  individualSkills: ['הסבר'], sharedSkills: ['הקשבה'], sources: ['CAST2024'],
  socialMechanism: { name: 'בדיקת ייצוג בזוג', cadence: 'פעם בשבוע', roles: 'מסבירה ומקשיבה, מתחלפות', firstAction: 'נבחר שבר', review: 'נבדוק מה כל אחת הבינה' },
  steps: [step('open', 'פתיחה', 5), step('main', 'פעילות מרכזית', 15), step('close', 'סיכום', 10), step('next', 'אחרי המפגש', 0)],
  ...overrides
});
function workspace() { return TEAM.update(TEAM.newWorkspace(), w => { w.context = completeContext(); w.activity = activity(); w.private.concerns = 'PRIVATE_CONCERN'; w.private.threads.plan = [{ role: 'user', content: 'PRIVATE_THREAD' }]; }); }
function approved() { return TEAM.approve(workspace(), { safety: true, privacy: true, professional: true }); }
function memory() { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map }; }
function serialLocks() { let tail = Promise.resolve(); return { request(_name, fn) { const result = tail.then(fn); tail = result.catch(() => {}); return result; } }; }

test('catalogs expose five age bands, six complementary approaches and verified sources in both UMD surfaces', () => {
  assert.equal(TEAM.VERSION, 'team-learning-lab/v1');
  assert.deepEqual(TEAM.AGE_BANDS.map(a => a.id), ['gan', 'a-c', 'd-f', 'g-i', 'j-l']);
  assert.equal(TEAM.MODELS.length, 6);
  for (const model of TEAM.MODELS) {
    for (const field of ['id', 'label', 'summary', 'use', 'limits', 'audiences', 'sources']) assert.ok(model[field]);
    for (const id of model.sources) assert.ok(TEAM.SOURCES.some(s => s.id === id));
  }
  assert.deepEqual(TEAM.MODELS.find(m => m.id === 'community-of-practice').audiences, ['staff']);
  assert.ok(TEAM.SOURCES.some(s => s.url === 'https://udlguidelines.cast.org/'));
  const sandbox = { window: {} }; vm.runInNewContext(readFileSync(new URL('../../app/lib/team-learning-lab.js', import.meta.url), 'utf8'), sandbox);
  assert.equal(sandbox.window.SBE_TEAM.VERSION, TEAM.VERSION);
});

test('context preserves independent axes and one eligible model while rejecting staff approaches for students', () => {
  const clean = TEAM.validateContext(completeContext({ situation: 'emergency', mode: 'online', emergencyKind: 'מלחמה', models: ['udl'], owner: 'ignored' }));
  assert.equal(clean.situation, 'emergency'); assert.equal(clean.mode, 'online'); assert.equal(clean.owner, undefined);
  for (const id of ['lesson-study', 'instructional-coaching', 'community-of-practice']) assert.throws(() => TEAM.validateContext(completeContext({ models: [id] })), /צוות/);
  assert.doesNotThrow(() => TEAM.validateContext(completeContext({ audience: 'staff', models: ['lesson-study'] })));
  assert.throws(() => TEAM.validateContext(completeContext({ mode: 'invented' })), /מפגש/);
  assert.throws(() => TEAM.validateContext(completeContext({ goal: 'x'.repeat(9000) })), /אורך/);
});

test('update is immutable, drafts may be empty, and generation needs real context without fabricated activity', () => {
  const original = TEAM.newWorkspace(); const next = TEAM.update(original, w => { w.context.goal = 'שאלה'; });
  assert.equal(original.context.goal, ''); assert.equal(next.revision, 1); assert.equal(original.activity, null);
  assert.throws(() => TEAM.buildRequest(original, 'generate'), /מטרה|למידה|גיל/);
  const draft = TEAM.update(workspace(), w => { w.activity.steps.splice(1, 1); });
  assert.equal(draft.activity.steps.length, 3);
  assert.throws(() => TEAM.approve(draft, { safety: true, privacy: true, professional: true }), /שלב|פעילות מרכזית/);
});

test('strict activity validation checks phase order, bounded time, unique IDs, sources and social learning fields', () => {
  const clean = TEAM.validateActivity({ ...activity(), approved: true, userId: 'ignored' }, completeContext());
  assert.equal(clean.approved, undefined); assert.equal(clean.userId, undefined);
  assert.throws(() => TEAM.validateActivity(activity({ steps: [step('x', 'פתיחה', 5), step('x', 'פעילות מרכזית', 5), step('c', 'סיכום', 5), step('n', 'אחרי המפגש', 0)] }), completeContext()), /מזהה/);
  assert.throws(() => TEAM.validateActivity(activity({ steps: [step('a', 'פתיחה', 0), ...activity().steps.slice(1)] }), completeContext()), /זמן/);
  assert.throws(() => TEAM.validateActivity(activity(), completeContext({ minutes: 20 })), /זמן/);
  assert.throws(() => TEAM.validateActivity(activity({ sources: ['fabricated-study'] }), completeContext()), /מקור/);
  assert.throws(() => TEAM.validateActivity(activity({ socialMechanism: {} }), completeContext()), /מנגנון/);
  assert.throws(() => TEAM.validateActivity(activity({ steps: [...activity().steps].reverse() }), completeContext()), /סדר/);
});

test('all age bands and staff/student axes inform bounded AI prompts, while concerns only enter explicit support', () => {
  for (const ageBand of ['gan', 'a-c', 'd-f', 'g-i', 'j-l']) {
    const w = TEAM.update(workspace(), next => { next.context.ageBand = ageBand; next.context.situation = 'emergency'; next.context.mode = 'online'; next.context.emergencyKind = 'מלחמה'; });
    const request = TEAM.buildRequest(w, 'generate');
    assert.equal(request.permission, 'nana'); assert.equal(request.customerReview, true);
    const text = JSON.stringify(request); assert.match(text, new RegExp(ageBand)); assert.match(text, /emergency/); assert.match(text, /online/);
    assert.ok(text.includes(TEAM.AGE_BANDS.find(a => a.id === ageBand).adaptation));
    assert.ok(!text.includes('PRIVATE_CONCERN')); assert.ok(!text.includes('PRIVATE_THREAD'));
    assert.match(text, /לא מהימנים/); assert.match(text, /תוכנית הלימודים|לימודי ליבה/);
    assert.match(text, /אין ראיה|לא הוכח|אינה הוכחה/);
  }
  const staff = TEAM.update(workspace(), w => { w.context.audience = 'staff'; w.context.models = ['lesson-study']; });
  assert.match(JSON.stringify(TEAM.buildRequest(staff, 'generate')), /staff/);
  const question = TEAM.buildRequest(workspace(), 'question', { question: 'איך לשאול?', stepId: 'main' });
  assert.ok(!JSON.stringify(question).includes('PRIVATE_CONCERN')); assert.match(JSON.stringify(question), /proposedStep/);
  const support = TEAM.buildRequest(workspace(), 'support');
  assert.ok(JSON.stringify(support).includes('PRIVATE_CONCERN')); assert.ok(!JSON.stringify(support).includes('PRIVATE_THREAD'));
  assert.match(JSON.stringify(support), /אמפת|מובן|צעד קטן/);
});

test('immediate danger gates educational generation and approval', () => {
  const w = TEAM.update(workspace(), w => { w.context.immediateDanger = true; });
  assert.throws(() => TEAM.buildRequest(w, 'generate'), /סכנה מיידית/);
  assert.throws(() => TEAM.approve(w, { safety: true, privacy: true, professional: true }), /סכנה מיידית/);
  assert.doesNotThrow(() => TEAM.buildRequest(w, 'support'));
});

test('AI replies accept JSON fences, strip authority fields and reject malformed/oversized replies', () => {
  const generated = TEAM.parseReply('```json\n' + JSON.stringify({ ...activity(), approval: true }) + '\n```', 'generate', completeContext());
  assert.equal(generated.approval, undefined);
  assert.throws(() => TEAM.parseReply('Here is your activity: ' + JSON.stringify(activity()), 'generate', completeContext()), /JSON/);
  assert.throws(() => TEAM.parseReply('{oops}', 'question', completeContext()), /JSON/);
  assert.throws(() => TEAM.parseReply(JSON.stringify({ answer: 'x'.repeat(20000) }), 'support', completeContext()), /אורך/);
  assert.deepEqual(TEAM.parseReply('{"answer":"אפשר לנסות צעד קטן.","approved":true}', 'support', completeContext()), { answer: 'אפשר לנסות צעד קטן.' });
});

test('questions do not mutate drafts; adopting a proposal requires matching revision and an existing target', () => {
  const w = workspace(); const before = JSON.stringify(w);
  const reply = TEAM.parseReply(JSON.stringify({ answer: 'אפשר להזמין ציור.', proposedStep: { ...step('main', 'פעילות מרכזית', 15), instructions: 'אפשר לצייר שתי דרכים.' } }), 'question', w.context);
  assert.equal(JSON.stringify(w), before);
  const adopted = TEAM.applyProposal(w, reply.proposedStep, { revision: w.revision, stepId: 'main' });
  assert.equal(adopted.activity.steps[1].instructions, 'אפשר לצייר שתי דרכים.');
  assert.equal(w.activity.steps[1].instructions, activity().steps[1].instructions);
  assert.throws(() => TEAM.applyProposal(adopted, reply.proposedStep, { revision: w.revision, stepId: 'main' }), /גרסה|השתנ/);
  const removed = TEAM.update(w, draft => { draft.activity.steps.splice(1, 1); });
  assert.throws(() => TEAM.applyProposal(removed, reply.proposedStep, { revision: removed.revision, stepId: 'main' }), /שלב/);
  assert.throws(() => TEAM.applyProposal(w, { ...reply.proposedStep, minutes: 50 }, { revision: w.revision, stepId: 'main' }), /זמן/);
});

test('human approval requires all checks and remains a frozen snapshot after editing', () => {
  const w = workspace(); assert.throws(() => TEAM.approve(w, { safety: true, privacy: false, professional: true }), /אישור/);
  const a = TEAM.approve(w, { safety: true, privacy: true, professional: true });
  const snapshot = a.approvals[0]; assert.ok(snapshot.id); assert.equal(snapshot.private, undefined);
  assert.equal(snapshot.revision, w.revision); assert.ok(Object.isFrozen(snapshot.activity.steps[0]));
  const edited = TEAM.update(a, draft => { draft.activity.title = 'תכנון חדש'; draft.approvals[0].activity.title = 'attempted overwrite'; });
  assert.equal(edited.approvals[0].activity.title, 'שתי דרכים לשבר');
  assert.equal(a.activity.title, 'שתי דרכים לשבר');
});

test('practice is linked to a chosen approved step and only a real meeting can become a tried move', () => {
  let w = approved(); const approvalId = w.approvals[0].id;
  w = TEAM.recordPractice(w, { approvalId, stepId: 'main', kind: 'rehearsal', observation: 'תרגלנו שאלה', nextAction: 'ננסה בשיעור', wasRealMeeting: false });
  assert.equal(w.rehearsals.length, 1); assert.equal(w.observations.length, 0);
  assert.throws(() => TEAM.saveMove(w, { observationId: w.rehearsals[0].id, title: 'מהלך', conditions: 'תנאים', limits: 'מגבלות', privacyChecked: true }), /מפגש|תצפית/);
  assert.throws(() => TEAM.recordPractice(w, { approvalId, stepId: 'main', kind: 'meeting', observation: 'ראינו הסבר', nextAction: 'ננסה', wasRealMeeting: false }), /מפגש/);
  assert.throws(() => TEAM.recordPractice(w, { approvalId, stepId: 'missing', kind: 'meeting', observation: 'ראינו', nextAction: 'ננסה', wasRealMeeting: true }), /שלב/);
  w = TEAM.update(w, next => { next.activity.steps[1].title = 'טיוטה מאוחרת'; });
  w = TEAM.recordPractice(w, { approvalId, stepId: 'main', kind: 'meeting', observation: 'כל משתתפת הציגה ייצוג', nextAction: 'ננסה שאלה אחרת', wasRealMeeting: true });
  const observation = w.observations[0]; assert.equal(observation.approvalId, approvalId); assert.equal(observation.stepId, 'main');
  assert.throws(() => TEAM.saveMove(w, { observationId: observation.id, title: 'מהלך', conditions: '', limits: 'עוד לא בדקנו בכיתה אחרת', privacyChecked: true }), /תנאים/);
  assert.throws(() => TEAM.saveMove(w, { observationId: observation.id, title: 'מהלך', conditions: 'זוגות עם תיווך', limits: 'עוד לא בדקנו', privacyChecked: false }), /פרטיות/);
  w = TEAM.saveMove(w, { observationId: observation.id, title: 'הסבר בציור', conditions: 'זוגות עם תיווך', limits: 'עוד לא בדקנו בקבוצה אחרת', privacyChecked: true });
  assert.equal(w.moves.length, 1); assert.equal(w.moves[0].approvalId, approvalId);
});

test('public pack contains only chosen approved material, verified sources and immutable red lines', () => {
  let w = approved(); const approvalId = w.approvals[0].id;
  w = TEAM.recordPractice(w, { approvalId, stepId: 'main', kind: 'meeting', observation: 'RAW_PRIVATE_OBSERVATION', nextAction: 'RAW_PRIVATE_NEXT', wasRealMeeting: true });
  w = TEAM.saveMove(w, { observationId: w.observations[0].id, title: 'הסבר בציור', conditions: 'זוגות', limits: 'הקשר אחד', privacyChecked: true });
  w = TEAM.update(w, draft => { draft.activity.title = 'טיוטה אחרת'; });
  const defaultPack = TEAM.publicPack(w, approvalId); assert.deepEqual(defaultPack.moves, []);
  const pack = TEAM.publicPack(w, approvalId, { moveIds: [w.moves[0].id] });
  assert.deepEqual(Object.keys(pack).sort(), ['schemaVersion', 'context', 'activity', 'redLines', 'sources', 'moves'].sort());
  assert.equal(pack.activity.title, 'שתי דרכים לשבר'); assert.equal(pack.moves.length, 1);
  const text = JSON.stringify(pack); for (const marker of ['PRIVATE_CONCERN', 'PRIVATE_THREAD', 'RAW_PRIVATE_OBSERVATION', 'RAW_PRIVATE_NEXT', 'observationId', 'approvalId']) assert.ok(!text.includes(marker));
  assert.deepEqual(pack.redLines, TEAM.RED_LINES); assert.ok(pack.redLines.length >= 6);
  assert.ok(pack.sources.every(s => TEAM.SOURCES.some(known => known.id === s.id && known.url === s.url)));
  assert.throws(() => TEAM.publicPack(w, approvalId, { moveIds: ['missing'] }), /מהלך/);
});

test('repository isolates owners, bounds workspace fields and preserves corrupt or unavailable storage', async () => {
  const storage = memory(); let owner = 'sbe.team-lab.v1:A'; const repo = TEAM.createRepository({ storage, ownerKey: () => owner, locks: serialLocks() });
  assert.equal(await repo.load(), null);
  const w = workspace(); w.owner = 'never stored'; await repo.save(w, { expectedRevision: 0 });
  assert.equal(JSON.parse(storage.getItem(owner)).workspace.owner, undefined);
  assert.equal(JSON.parse(storage.getItem(owner)).scopeKey, owner);
  const loaded = await repo.load(); assert.equal(loaded.private.concerns, 'PRIVATE_CONCERN'); loaded.context.goal = 'mutation';
  assert.notEqual((await repo.load()).context.goal, 'mutation');
  owner = 'sbe.team-lab.v1:B'; await assert.rejects(repo.load(), /כניסה|בעל/); await assert.rejects(repo.save(w, { expectedRevision: w.revision }), /כניסה|בעל/);
  const other = TEAM.createRepository({ storage, ownerKey: () => owner, locks: serialLocks() }); assert.equal(await other.load(), null);
  storage.setItem(owner, '{broken'); await assert.rejects(other.load(), /JSON|שמירה/); assert.equal(storage.getItem(owner), '{broken');
  const unavailable = TEAM.createRepository({ storage: { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } }, ownerKey: () => 'owner', locks: serialLocks() });
  await assert.rejects(unavailable.load(), /שמירה|אחסון/);
});

test('atomic repository rejects competing stale saves and checks owner again inside the lock', async () => {
  const storage = memory(); const locks = serialLocks(); const options = { storage, ownerKey: () => 'owner-A', locks };
  const first = TEAM.createRepository(options), second = TEAM.createRepository(options);
  const base = workspace(); await first.save(base, { expectedRevision: 0 });
  const a = TEAM.update(base, w => { w.context.goal = 'first'; }), b = TEAM.update(base, w => { w.context.goal = 'second'; });
  const results = await Promise.allSettled([first.save(a, { expectedRevision: base.revision }), second.save(b, { expectedRevision: base.revision })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.match(results.find(r => r.status === 'rejected').reason.message, /גרסה|חלון|התנגש/);
  assert.equal((await first.load()).context.goal, 'first');
  let owner = 'owner-A', callback;
  const delayed = TEAM.createRepository({ storage, ownerKey: () => owner, locks: { request(_name, fn) { callback = fn; return new Promise(resolve => { this.release = () => resolve(fn()); }); } } });
  const pending = delayed.save(a, { expectedRevision: base.revision }); owner = 'owner-B';
  await assert.rejects(async () => { await callback(); }, /כניסה|בעל/);
  assert.equal(storage.getItem('owner-B'), null); void pending;
});

test('follow-up sends only the bounded explicitly chosen conversation', () => {
  const w = workspace();
  w.private.threads.step_main = Array.from({length:20}, (_,i) => ({role:i % 2 ? 'assistant' : 'user',content:'TURN_'+i+' '+ 'x'.repeat(5000)}));
  w.private.threads.support = [{role:'assistant',content:'PRIVATE_SUPPORT'}];
  const input = JSON.parse(TEAM.buildRequest(w,'question',{question:'מה לגבי האפשרות השנייה?',stepId:'main',threadKey:'step_main'}).messages[0].content);
  assert.equal(input.conversation.length,12);
  assert.match(input.conversation[0].content,/TURN_8/);
  assert.ok(input.conversation.every(turn => turn.content.length<=4000));
  for (const marker of ['PRIVATE_CONCERN','PRIVATE_THREAD','PRIVATE_SUPPORT']) assert.ok(!JSON.stringify(input).includes(marker));
  assert.throws(() => TEAM.buildRequest(w,'question',{question:'שאלה',stepId:'main',threadKey:'support'}),/שיחה/);
  assert.throws(() => TEAM.buildRequest(w,'question',{question:'שאלה',stepId:'main',threadKey:'step_open'}),/שיחה/);
});

test('rehearsal and meeting questions use explicitly selected frozen context and step', () => {
  let w = approved(); const a = w.approvals[0];
  w = TEAM.update(w,draft => {draft.activity.title='DRAFT_B'; draft.context.goal='NEW_DRAFT_GOAL';});
  const key='stage_2_approval_'+a.id;
  w.private.threads[key]=[{role:'assistant',content:'PREVIOUS_APPROVED_ANSWER'}];
  const request = TEAM.buildRequest(w,'question',{question:'איך נתרגל?',approvalId:a.id,stepId:'main',threadKey:key});
  const input = JSON.parse(request.messages[0].content);
  assert.equal(input.activity.title,a.activity.title);
  assert.equal(input.context.goal,a.context.goal);
  assert.equal(input.step.instructions,a.activity.steps[1].instructions);
  assert.equal(input.approvedRevision,a.revision);
  assert.match(JSON.stringify(input.conversation),/PREVIOUS_APPROVED_ANSWER/);
  assert.match(request.system,/proposedStep.*null/);
  assert.throws(() => TEAM.buildRequest(w,'question',{question:'שאלה',approvalId:'missing'}),/מאושרת/);
  assert.throws(() => TEAM.buildRequest(w,'question',{question:'שאלה',approvalId:a.id,threadKey:'stage_2_approval_other'}),/שיחה/);
  const danger = TEAM.update(w,draft => {draft.context.immediateDanger=true;});
  assert.throws(() => TEAM.buildRequest(danger,'question',{question:'שאלה',approvalId:a.id}),/סכנה/);
});

test('recovery merges immutable local and latest evidence with complete lineage', () => {
  const base = approved(), approvalId=base.approvals[0].id;
  const latest = TEAM.recordPractice(base,{approvalId,stepId:'main',kind:'rehearsal',observation:'LATEST_REHEARSAL',nextAction:'לנסות'});
  let mine = TEAM.approve(TEAM.update(base,w => {w.activity.title='LOCAL_APPROVED';}),{safety:true,privacy:true,professional:true});
  const localApproval=mine.approvals.at(-1).id;
  mine = TEAM.recordPractice(mine,{approvalId:localApproval,stepId:'main',kind:'meeting',observation:'LOCAL_MEETING',nextAction:'לנסות',wasRealMeeting:true});
  mine = TEAM.saveMove(mine,{observationId:mine.observations[0].id,title:'LOCAL_MOVE',conditions:'זוגות',limits:'הקשר אחד',privacyChecked:true});
  const merged = TEAM.mergeWorkspaces(latest,mine);
  assert.equal(merged.approvals.length,2); assert.equal(merged.rehearsals.length,1); assert.equal(merged.observations.length,1); assert.equal(merged.moves.length,1);
  assert.equal(merged.activity.title,'LOCAL_APPROVED'); assert.ok(merged.revision>Math.max(mine.revision,latest.revision));
  assert.equal(TEAM.publicPack(merged,localApproval,{moveIds:[merged.moves[0].id]}).moves[0].title,'LOCAL_MOVE');
  assert.equal(base.observations.length,0); assert.equal(latest.observations.length,0); assert.ok(Object.isFrozen(merged.observations));
  const collision=JSON.parse(JSON.stringify(latest)); collision.approvals[0].activity.title='COLLISION';
  assert.throws(() => TEAM.mergeWorkspaces(collision,mine),/תיעוד|מזהה/);
});

test('valid JSON with malformed stored evidence is rejected and preserved', async () => {
  let w=approved(); const approvalId=w.approvals[0].id;
  w=TEAM.recordPractice(w,{approvalId,stepId:'main',kind:'meeting',observation:'ראינו',nextAction:'ננסה',wasRealMeeting:true});
  w=TEAM.saveMove(w,{observationId:w.observations[0].id,title:'מהלך',conditions:'זוגות',limits:'הקשר אחד',privacyChecked:true});
  for (const corrupt of [
    value=> {value.moves[0].conditions={private:{concerns:'PRIVATE_CORRUPTION'}};},
    value=> {value.moves[0].observationId='missing';},
    value=> {value.moves[0].step.instructions='FORGED_STEP';},
    value=> {value.observations[0].kind='rehearsal';},
    value=> {value.approvals.push({...value.approvals[0]});},
    value=> {value.approvals[0].at='not a date';}
  ]) {
    const broken=JSON.parse(JSON.stringify(w)); corrupt(broken);
    const storage=memory(), raw=JSON.stringify({scopeKey:'owner',workspace:broken}); storage.setItem('owner',raw);
    const repo=TEAM.createRepository({storage,locks:serialLocks(),ownerKey:()=> 'owner'});
    await assert.rejects(repo.load(),error=>error.code==='storage-invalid');
    assert.equal(storage.getItem('owner'),raw);
    assert.throws(()=>TEAM.publicPack(broken,approvalId,{moveIds:[broken.moves[0].id]}));
  }
});

test('repository storage and unsupported-lock failures remain retryable without losing initial draft', async () => {
  const original=memory(); let unavailable=true;
  const storage={getItem:original.getItem,setItem(key,value){if(unavailable)throw Error('temporarily unavailable');original.setItem(key,value);}};
  const repo=TEAM.createRepository({storage,locks:serialLocks(),ownerKey:()=> 'owner'}),w=workspace();
  await assert.rejects(repo.save(w,{expectedRevision:0}),error=>error.code==='storage-unavailable');
  assert.equal(original.getItem('owner'),null); unavailable=false;
  await repo.save(w,{expectedRevision:0}); assert.equal((await repo.load()).context.goal,w.context.goal);
  const unsupported=TEAM.createRepository({storage:memory(),ownerKey:()=> 'other'});
  await assert.rejects(unsupported.save(w,{expectedRevision:0}),error=>error.code==='storage-unavailable');
  const emptyStorage=memory(),emptyRepo=TEAM.createRepository({storage:emptyStorage,locks:serialLocks(),ownerKey:()=> 'empty'}),empty=TEAM.newWorkspace();
  await emptyRepo.save(empty,{expectedRevision:0}); await emptyRepo.save(empty,{expectedRevision:0});
  assert.equal((await emptyRepo.load()).revision,0);
});
