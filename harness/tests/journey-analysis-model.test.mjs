import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { workspaceFixture, reportFixture } from '../fixtures/journey-analysis.mjs';
const require = createRequire(import.meta.url);
const A = require('../../app/lib/journey-analysis-model.js');
const W = require('../../app/lib/journey-workspace-model.js');
const copy = x => structuredClone(x);
const input = (kind = 'school', ids = ['e1']) => A.buildInput(W.clean(workspaceFixture(kind)), { kind, label: kind === 'school' ? 'בית ספר' : 'קהילה' }, ids);
const snapshot = () => ({ id: 'a1', createdAt: '2026-10-26T12:00:00.000Z', sourceRevision: 4, baselineId: '', input: input(), output: reportFixture(), responses: [] });

test('pure contract is shared by browser and CommonJS without importing the workspace model', () => {
  const ctx = { window: {} };
  const source = readFileSync(new URL('../../app/lib/journey-analysis-model.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, ctx);
  assert.equal(typeof ctx.window.SBE_JOURNEY_ANALYSIS.buildInput, 'function');
  vm.runInNewContext(readFileSync(new URL('../../app/lib/journey-network-model.js', import.meta.url), 'utf8'), ctx);
  vm.runInNewContext(readFileSync(new URL('../../app/lib/journey-workspace-model.js', import.meta.url), 'utf8'), ctx);
  assert.equal(ctx.window.SBE_JOURNEY_WORKSPACE.AI_SYSTEM, ctx.window.SBE_JOURNEY_ANALYSIS.AI_SYSTEM);
  assert.equal(W.AI_SYSTEM, A.AI_SYSTEM);
});

test('selected link closes endpoints and their resources without importing other evidence or private names', () => {
  const i = input();
  assert.deepEqual(i.mechanisms.map(x => x.id), ['m1', 'm2']);
  assert.deepEqual(i.roles.map(x => x.id), ['r1']);
  assert.deepEqual(i.infrastructures.map(x => x.id), ['i1']);
  assert.deepEqual(i.resources.map(x => x.id), ['s1']);
  assert.deepEqual(i.links[0].from, ['m1']); assert.deepEqual(i.links[0].to, ['m2']);
  assert.deepEqual(i.roles[0].evidenceIds, []);
  assert.deepEqual(i.mechanisms[0].evidenceIds, []);
  assert.deepEqual(i.evidence.map(x => x.id), ['e1']);
  assert.equal(i.coverage.selectedEvidence, 1); assert.equal(i.coverage.totalEvidence, 2);
  assert.deepEqual(i.contextualClosure.mechanisms, ['m1', 'm2']);
  assert.equal(i.context.missingVoices, 'קבוצה ב טרם נשמעה');
  assert.equal(i.mechanisms[0].knowledgeState, 'unexamined');
  assert.equal(i.mechanisms[1].knowledgeState, 'conflicting');
  assert.equal(i.links[0].sharedDependency, 'אותו רכז');
  const json = JSON.stringify(i);
  for (const excluded of ['שם פרטי אסור להעברה', 'אין להעביר פירוש קודם', 'מידע שלא נבחר', 'analyses', 'f_old']) assert.ok(!json.includes(excluded), excluded);
  assert.ok(A.FIELD_LABELS.links.sharedDependency); assert.equal(A.INPUT_SECTIONS.length, 6);
  assert.deepEqual(A.cleanInput(i), i);
});

test('selection and unit contracts reject unknown, duplicate or malformed selections without mutation', () => {
  const w = W.clean(workspaceFixture()); const before = copy(w);
  for (const ids of [['missing'], ['e1', 'e1'], 'e1']) assert.throws(() => A.buildInput(w, { kind: 'school', label: 'בית ספר' }, ids));
  assert.throws(() => A.buildInput(w, { kind: 'bogus', label: 'שם' }, ['e1']));
  assert.throws(() => A.buildInput(w, { kind: 'school', label: 'שם', secret: 'x' }, ['e1']));
  assert.deepEqual(w, before);
  assert.equal(input('community').unit.kind, 'community');
});

test('full report accepts evidence-aware tension, uncertainty, missing voices and untested backup', () => {
  const i = input(), r = A.validateReport(reportFixture(), i);
  assert.deepEqual(r, reportFixture());
  assert.equal(r.findings[0].kind, 'tension');
  assert.equal(r.missingInformation[0].evidenceIds.length, 0);
  assert.match(r.network[0].uncertainty, /חלקי/);
  assert.match(A.AI_SYSTEM, /מחויבות משותפת/);
  assert.match(A.AI_SYSTEM, /תודעת חוסן/);
  assert.match(A.AI_SYSTEM, /לא מדרגות/);
  assert.match(A.AUDIT_SYSTEM, /טיוטה/);
  assert.match(A.AUDIT_SYSTEM, /אינה ראיה/);
});

test('report reference integrity is relative to reviewed input with no unknown or unselected references', () => {
  const mutations = [r => r.findings[0].evidenceIds = ['e2'], r => r.findings[0].evidenceIds = [], r => r.findings[0].contradictingEvidenceIds = ['e2'], r => r.findings[0].entityRefs = [{ section: 'mechanisms', id: 'm_unused' }], r => r.findings[0].entityRefs = [{ section: 'findings', id: 'f1' }], r => r.network[0].evidenceIds = [], r => r.priorities[0].evidenceIds = [], r => r.priorities[0].findingIds = ['missing'], r => r.summary.keyFindingIds = ['missing']];
  for (const mutate of mutations) { const r = reportFixture(); mutate(r); assert.throws(() => A.validateReport(r, input())); }
  const r = reportFixture(); r.findings[0].kind = 'question'; r.findings[0].evidenceIds = []; assert.doesNotThrow(() => A.validateReport(r, input()));
});

test('strict nested report structures, array limits, text limits and actionable alternatives', () => {
  const mutations = [r => r.secret = 'x', r => r.summary.extra = true, r => r.findings[0].entityRefs[0].extra = 'x', r => r.priorities[0].options[0].approvedBy = 'model', r => r.findings[0].alternativeExplanations = ['a', 'b', 'c', 'd'], r => r.priorities[0].options[0].suggestedRoles = Array(7).fill('x'), r => r.network = Array(9).fill(r.network[0]), r => r.findings[0].observation = 'א'.repeat(4001), r => r.findings[0].uncertainty = 4, r => r.findings[0].lenses = ['score'], r => r.priorities[0].options = [r.priorities[0].options[1]], r => r.findings.push(copy(r.findings[0]))];
  for (const mutate of mutations) { const r = reportFixture(); mutate(r); assert.throws(() => A.validateReport(r, input())); }
  const r = reportFixture(); r.priorities[0].options = [r.priorities[0].options[0]]; assert.doesNotThrow(() => A.validateReport(r, input()));
  const empty = { summary: { overview: 'מידע חסר', keyFindingIds: [], limits: '' }, findings: [], network: [], missingInformation: [], priorities: [] };
  assert.doesNotThrow(() => A.validateReport(empty, input()));
  assert.throws(() => A.validateReport(JSON.parse('{"__proto__":{}}'), input()));
});

test('input validates complete factual projection, dates, coverage and closure with no recursive history', () => {
  const mutations = [i => i.analyses = [], i => i.roles[0].person = 'private', i => i.evidence[0].observedAt = '2026-02-30', i => i.context.periodStart = 'tomorrow', i => i.coverage.selectedEvidence = 2, i => i.contextualClosure.mechanisms = ['missing'], i => i.links[0].from = ['missing'], i => i.roles[0].evidenceIds = ['e2'], i => i.evidence[0].extra = 'x', i => i.mechanisms[0].knowledgeState = 'effective'];
  for (const mutate of mutations) { const i = input(); mutate(i); assert.throws(() => A.cleanInput(i)); }
});

test('historical analysis survives current record deletion, validates its own evidence and bounds response history', () => {
  const a = snapshot();
  a.responses = [{ findingId: 'f1', state: 'edited', comment: 'פירוש אחר', priorityReason: 'נבחר לבירור', disagreement: 'עמדה שונה', reviewedBy: 'הצוות', reviewedAt: '2026-10-26' }];
  assert.deepEqual(A.cleanAnalysis(a), a);
  assert.doesNotThrow(() => W.clean({ analyses: [a] }));
  const w = W.clean({ analyses: [a] }); assert.deepEqual(w.analyses[0].input, a.input);
  for (const mutate of [x => x.createdAt = '2026-02-30T12:00:00.000Z', x => x.sourceRevision = -1, x => x.sourceRevision = '4', x => x.responses[0].findingId = 'missing', x => x.responses[0].state = 'approved', x => x.responses[0].reviewedAt = 'tomorrow', x => x.responses = Array(21).fill(x.responses[0])]) { const invalid = copy(a); mutate(invalid); assert.throws(() => A.cleanAnalysis(invalid)); }
  const list = Array.from({ length: 21 }, (_, n) => ({ ...snapshot(), id: 'a' + n })); assert.throws(() => W.clean({ analyses: list }), /20/);
  const dangling = snapshot(); dangling.baselineId = 'deleted_for_privacy'; assert.doesNotThrow(() => A.cleanAnalysis(dangling));
  dangling.baselineId = false; assert.throws(() => A.cleanAnalysis(dangling));
});

test('snapshot evolution keeps facts immutable, allows responses and requires exact explicit removed ids', () => {
  const a = snapshot(), edited = copy(a); edited.responses = [{ findingId: 'f1', state: 'rejected', comment: 'לא התקבל' }];
  assert.doesNotThrow(() => A.validateEvolution([a], [edited], []));
  for (const mutate of [x => x.sourceRevision++, x => x.input.context.scope = 'changed', x => x.output.summary.overview = 'changed', x => x.baselineId = 'new', x => x.createdAt = '2026-10-26T13:00:00.000Z']) { const b = copy(a); mutate(b); assert.throws(() => A.validateEvolution([a], [b], [])); }
  assert.throws(() => A.validateEvolution([a], [], []));
  assert.throws(() => A.validateEvolution([a], [a], ['a1']));
  assert.throws(() => A.validateEvolution([a], [], ['a1', 'unknown']));
  assert.doesNotThrow(() => A.validateEvolution([a], [], ['a1']));
});

test('comparison describes snapshot inclusion, selection, context and period rather than factual creation', () => {
  const first = input();
  const nextWorkspace = W.clean(workspaceFixture()); nextWorkspace.context.periodEnd = '2026-11-01'; nextWorkspace.context.missingVoices = 'קבוצה ב השתתפה'; nextWorkspace.mechanisms[0].activation = 'תיאור חדש';
  const second = A.buildInput(nextWorkspace, { kind: 'school', label: 'בית ספר' }, ['e1', 'e2']);
  const c = A.compareInputs(first, second);
  assert.equal(c.selection.changed, true); assert.equal(c.period.changed, true);
  assert.ok(c.context.changedFields.includes('missingVoices'));
  assert.ok(c.sections.mechanisms.included.some(x => x.id === 'm_unused'));
  assert.ok(c.sections.mechanisms.changed.some(x => x.id === 'm1'));
  assert.match(c.membershipMeaning, /תמונת המצב/);
  assert.ok(!('created' in c.sections.mechanisms)); assert.ok(!('removed' in c.sections.mechanisms));
  assert.deepEqual(A.compareInputs(first, first).sections.mechanisms.changed, []);
});

test('explicit requested drafts carry provenance and human reason but no approved assignments or resources', () => {
  const a = snapshot();
  for (const kind of ['decision', 'action']) {
    const d = A.draftFromPriority(a, 'p1', 'o2', kind, 'הצוות בחר לבדוק רציפות');
    assert.equal(d.analysisId, 'a1'); assert.equal(d.priorityId, 'p1'); assert.equal(d.optionId, 'o2');
    assert.equal(d.owner, ''); assert.equal(d.authority, '');
    assert.equal(d.approvedBy || '', '');
    assert.match(d.note, /הפרטים המלאים בדוח המקור/); assert.match(d.note, /הצעות בלבד/);
    if (kind === 'action') { assert.equal(d.resources, ''); assert.equal(d.status, 'planned'); }
    const section = kind === 'decision' ? 'decisions' : 'actions';
    assert.doesNotThrow(() => W.clean({ evidence: [{ id: 'e1' }], [section]: [{ id: 'draft1', ...d }] }));
  }
  assert.throws(() => A.draftFromPriority(a, 'p1', 'missing', 'decision', 'סיבה'));
  assert.throws(() => A.draftFromPriority(a, 'p1', 'o1', 'decision', ''));
});

test('draft references preserve full report proposals without overflow or silent truncation', () => {
  const a = snapshot(), long = 'א'.repeat(4000);
  for (const option of a.output.priorities[0].options) { option.title = long; option.conditions = long; option.resources = long; option.costs = long; option.suggestedRoles = Array(6).fill(long); }
  const normalized = A.cleanAnalysis(a);
  for (const kind of ['decision','action']) {
    const draft = A.draftFromPriority(normalized,'p1','o2',kind,long);
    const section = kind === 'decision' ? 'decisions' : 'actions';
    assert.doesNotThrow(() => W.clean({evidence:[{id:'e1'}],[section]:[{id:'draft1',...draft}]}));
    assert.ok(draft.note.length < 4000);
    assert.equal(normalized.output.priorities[0].options[0].conditions,long);
    if (kind === 'decision') assert.equal(draft.reason,long);
  }
});
