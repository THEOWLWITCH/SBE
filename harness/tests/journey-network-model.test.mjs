import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const N = require('../../app/lib/journey-network-model.js');
const W = require('../../app/lib/journey-workspace-model.js');
const cleanMap = value => N.mapOf(W.clean(value));
const fixture = () => W.clean({mechanisms:[{id:'m1',title:'תקשורת',infrastructureIds:['i1']},{id:'m2',title:'למידה',infrastructureIds:['i1']}],infrastructures:[{id:'i1',title:'מרחב'}],links:[{id:'l1',from:['m1'],to:['m2'],type:'info',status:'observed'}]});
const alternative = () => N.createAlternative(fixture(),'a1',2,'2026-10-27T10:00:00.000Z');
const futures = [{id:'f1',title:'התרחבות',conditions:'משתתפים נוספים'},{id:'f2',title:'פחות זמן',conditions:'זמן משותף מצטמצם'}];

test('hypothetical additions, pause and removal preserve captured and live maps', () => {
  const original = fixture(), a = N.createAlternative(original,'a1',2,'2026-10-27T10:00:00.000Z');
  a.proposal.mechanisms.push({id:'m3',title:'מעגל חדש'});
  a.inactiveIds = ['m1'];
  let changes = N.inspect(a);
  assert.ok(changes.some(x => x.kind === 'added' && x.refs.includes('m3')));
  assert.ok(changes.some(x => x.kind === 'inactive-link' && x.refs.includes('l1')));
  assert.ok(changes.some(x => x.kind === 'shared-support' && x.refs.includes('i1')));
  const removed = N.remove(a,'mechanisms','m1');
  assert.equal(removed.proposal.links.length,0);
  assert.equal(a.proposal.links.length,1);
  assert.equal(removed.baseline.links.length,1);
  assert.equal(original.mechanisms.length,2);
  assert.deepEqual(removed.inactiveIds,[]);
  assert.ok(N.inspect(removed).some(x => x.kind === 'removed' && x.refs.includes('l1')));
  assert.deepEqual(N.clean({futures,alternatives:[removed]},cleanMap).alternatives[0].baseline,N.mapOf(original));
});

test('support removal exposes edited dependencies and snapshots survive live evidence deletion', () => {
  const a = alternative(), removed = N.remove(a,'infrastructures','i1');
  assert.deepEqual(removed.proposal.mechanisms[0].infrastructureIds,[]);
  assert.ok(N.inspect(removed).some(x => x.kind === 'changed' && x.refs.includes('m1')));
  const lab = N.clean({futures,alternatives:[removed]},cleanMap);
  assert.equal(lab.alternatives[0].baseline.infrastructures[0].id,'i1');
  assert.equal(N.isHistorical(lab.alternatives[0],{...fixture(),infrastructures:[]}),true);
  assert.throws(() => N.clean({alternatives:[{...a,inactiveIds:['missing']}]},cleanMap));
  assert.throws(() => N.clean({futures:[...futures,futures[0]]},cleanMap));
});

test('separate reviewed input retains hypothetical records and all future assumptions', () => {
  const a=alternative(); a.title='הוספת מעגל'; a.proposal.mechanisms.push({id:'m3',title:'חדש ללא ראיות'});
  a.proposal.roles.push({id:'r1',title:'תפקיד',person:'שם אישי שלא נשלח'});
  a.proposal.evidence.push({id:'e1',title:'מקור מאושר',details:'תצפית'});
  const input=N.buildInput(a,futures,{kind:'school',label:'מסגרת בדויה'},cleanMap);
  assert.equal(input.kind,'scenario'); assert.equal(input.proposal.mechanisms[2].id,'m3');
  assert.equal(input.baseline.mechanisms.length,2); assert.equal(input.futures.length,2);
  assert.equal(input.assessments.length,0);
  assert.equal(input.proposal.roles[0].person,'');
  assert.deepEqual(N.cleanInput(input,cleanMap),input);
  const report={summary:'טיוטה לשיחה',direct:[],conditional:[{title:'תלות אפשרית',explanation:'יש לברר זמינות',refs:['m3'],assumptions:'אם יוקצה זמן',inquiry:'מי פנויים?'}],hypotheses:[],comparisons:futures.map(f=>({futureId:f.id,present:'לבדיקה',future:'לבדיקה',tensions:'',needs:'',preparation:'',signals:'',unknown:''})),supportSuggestions:[{mechanismId:'m3',infrastructureId:'i1',reason:'אפשר לבחון מרחב למידה',gaps:'קיבולת טרם ידועה'}]};
  assert.equal(N.validateReport(report,input).conditional[0].refs[0],'m3');
  assert.doesNotThrow(()=>N.validateReport({...report,conditional:[{...report.conditional[0],refs:['e1']}]},input));
  assert.throws(()=>N.validateReport({...report,summary:''},input));
  assert.throws(()=>N.validateReport({...report,conditional:[{...report.conditional[0],refs:['invented']}]},input));
  assert.throws(()=>N.validateReport({...report,comparisons:[]},input));
  a.feedback={createdAt:'2026-10-27T11:00:00.000Z',input,output:report};
  a.proposal.mechanisms[0].title='שם שהשתנה';
  const saved=N.clean({futures,alternatives:[a]},cleanMap);
  assert.equal(saved.alternatives[0].feedback.input.proposal.mechanisms[0].title,'תקשורת');
});

test('matrix uses stable future identities; decision is an unapproved editable draft', () => {
  const a=alternative(); a.title='חלופה'; a.assessments=[{futureId:'f1',present:'פעולה יחד',future:'גמישות',unknown:'מי חסרים',reviewAt:'2026-11-10'}];
  const lab=N.clean({futures,alternatives:[a]},cleanMap);
  assert.equal(lab.alternatives[0].assessments[0].futureId,'f1');
  assert.throws(()=>N.clean({futures:[futures[1]],alternatives:[a]},cleanMap));
  const draft=N.decisionDraft(lab.alternatives[0]);
  assert.equal(draft.approvedBy,''); assert.match(draft.uncertainty,/מי חסרים/);
  assert.match(draft.note,/a1/); assert.equal(draft.reviewAt,'2026-11-10');
  assert.throws(()=>N.clean({futures:[{id:'f1',reviewAt:'2026-02-30'}]},cleanMap));
});
