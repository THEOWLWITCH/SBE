// Activity and conversation artifacts: explicit kinds, adapters and gates (9 Oct 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAtomicMemoryStore } from '../lib/principal.mjs';
import { handleArtifacts } from '../lib/activity-artifact.mjs';
import { agentEnvelope, validateProposal } from '../lib/agent-contract.mjs';
import { validatePlannerDocument, documentText, activityFromDraft, conversationFromDraft, PRACTICE_MODES } from '../lib/planner-artifact.mjs';

const baseline = JSON.parse(readFileSync(new URL('../fixtures/baseline-cases.json', import.meta.url), 'utf8')).cases[0];
const options = extra => ({sourceLibrary:baseline.sourceLibrary,...extra});
const teacher = {ownerId:'fixture-teacher',tenantId:'fixture-tenant-a',permissions:['activity']};
const talker = {ownerId:'fixture-talker',tenantId:'fixture-tenant-a',permissions:['conv']};

// A saved planner draft, as SBE_PLANNER.createArchive stores it (planner-document/v1).
const doc = () => ({schemaVersion:'planner-document/v1',nodes:[{tag:'div',attrs:{class:'docview'},children:[
  {tag:'h2',attrs:{},children:[{text:'פינת עזרה בכיתה'}]},
  {tag:'table',attrs:{class:'kit-table kit-flow',onclick:'alert(1)',style:'color:red'},children:[
    {tag:'thead',attrs:{},children:[{tag:'tr',attrs:{},children:[{tag:'th',attrs:{},children:[{text:'תיאור הפעילות'}]},{tag:'th',attrs:{},children:[{text:'הנחיה למנחה'}]}]}]},
    {tag:'tbody',attrs:{},children:[
      {tag:'tr',attrs:{class:'ph'},children:[{tag:'th',attrs:{colspan:'2'},children:[{text:'פתיחה'}]}]},
      {tag:'tr',attrs:{},children:[{tag:'td',attrs:{},children:[{text:'כל אחד אומר מילה.'}]},{tag:'td',attrs:{},children:[{text:'המורה שואלת: מי מתחיל?'}]}]}]}]},
  {tag:'p',attrs:{},children:[{tag:'a',attrs:{href:'javascript:alert(1)'},children:[{text:'קישור'}]},{tag:'a',attrs:{href:'https://example.org/x'},children:[{text:'מקור'}]}]}]}]});
const activityDraft = () => ({id:'local-1',version:3,title:'פינת עזרה',fields:{goal:'לבנות פינת עזרה הדדית בכיתה',age:'כיתה ה',opening:'סבב מילה אחת',openingMin:'5 דקות',
  mainActivity:'בקבוצות מתכננים את הפינה',mainMin:'25',closing:'כל קבוצה מציגה',secretField:'not kept'},document:doc()});
const conversationDraft = () => ({id:'local-2',version:1,title:'שיחה עם הורה',fields:{productType:'שיחה בעל פה',goal:'להסכים על צעד אחד לשבוע הקרוב',
  openingLine:'תודה שבאת. איך את רואה את השבועיים האחרונים?',riskBranches:'אם השיחה מתחממת, עוצרים ומשקפים.',desiredAftermath:'נקבע מועד לשיחה הבאה',
  myTraits:[{axis:'קצב',note:'מהירה'}]},document:doc()});
const professional = {resilienceComponents:['שייכות'],individualSkills:['בקשת עזרה'],sharedSkills:['חלוקת תפקידים'],
  facilitatorGuide:'המורה מזמינה כל אחד לבחור תפקיד, ושואלת בסיכום מה עזר לעבוד יחד.',socialMechanism:'פעם בשבוע שני תלמידים מתחלפים מתחזקים את הפינה.'};
async function create(store,principal,body) { return handleArtifacts(store,principal,{action:'create',...body},options()); }

test('the planner document is checked again on the server: allowed tags, classes and links only',()=>{
  const clean=validatePlannerDocument(doc());
  const table=clean.nodes[0].children[1];
  assert.deepEqual(table.attrs,{class:'kit-table kit-flow'},'event handlers and styles are dropped');
  assert.equal(table.children[1].children[0].attrs.class,'ph','flow phase rows keep their class');
  const links=clean.nodes[0].children[2].children;
  assert.deepEqual(links[0].attrs,{},'javascript: links are dropped');assert.equal(links[1].attrs.href,'https://example.org/x');
  for(const bad of [{schemaVersion:'other',nodes:[]},{schemaVersion:'planner-document/v1',nodes:[{tag:'script',attrs:{},children:[]}]},
    {schemaVersion:'planner-document/v1',nodes:[{tag:'p',children:[],extra:1}]}]) assert.throws(()=>validatePlannerDocument(bad),{code:'invalid_document'});
  assert.match(documentText(clean),/\[הנחיה למנחה\] המורה שואלת/);
});

test('adapters map only what the planner holds; minutes not given are editable estimates',()=>{
  const a=activityFromDraft(activityDraft());
  assert.equal(a.kind,'activity');assert.equal(a.purpose,'לבנות פינת עזרה הדדית בכיתה');
  assert.deepEqual(a.steps.map(s=>[s.id,s.phase,s.minutes]),[['opening','פתיחה',5],['main','פעילות מרכזית',25],['closing','סיכום',10]]);
  assert.deepEqual(a.estimates,['closing']);assert.ok(!('secretField' in a.fields));
  for(const field of ['resilienceComponents','individualSkills','sharedSkills','facilitatorGuide','socialMechanism'])assert.ok(!(field in a),field+' stays missing until the planner adds it');
  const c=conversationFromDraft(conversationDraft());
  assert.equal(c.kind,'conversation');assert.equal(c.route,'oral');assert.deepEqual(c.steps.map(s=>s.id),['opening','core','branches','closing']);
  assert.throws(()=>conversationFromDraft({...conversationDraft(),fields:{...conversationDraft().fields,productType:'משהו אחר'}}),{code:'unsupported_conversation_route'});
  assert.throws(()=>activityFromDraft({fields:{sessions:[{}]},document:doc()}),{code:'unsupported_planner_shape'},'a sequence is not a single activity');
});

test('a planner draft is never stored as narrative, and each kind needs its own tool permission',async()=>{
  const store=createAtomicMemoryStore();
  const disguised=activityFromDraft(activityDraft());
  assert.equal((await create(store,teacher,{content:{...disguised,kind:'narrative'}}))[1].code,'missing_pipeline_context','a planner draft fails the narrative gate');
  assert.equal((await create(store,teacher,{content:{...disguised,pipelineOutput:{},context:{}}}))[1].code,'kind_mismatch');
  assert.equal((await create(store,teacher,{kind:'conversation',draft:conversationDraft()}))[0],403,'activity permission does not open conversations');
  assert.equal((await create(store,talker,{kind:'activity',draft:activityDraft()}))[0],403);
  assert.equal((await create(store,teacher,{kind:'narrative',draft:activityDraft()}))[1].code,'unsupported_artifact_kind');
  assert.equal((await create(store,teacher,{kind:'activity',draft:activityDraft(),content:disguised}))[0],400);
  const [status,out]=await create(store,talker,{kind:'conversation',draft:conversationDraft()});
  assert.equal(status,201);assert.equal(out.artifact.content.kind,'conversation');assert.equal(out.artifact.status,'draft');assert.equal(out.artifact.privacy,'private');
  assert.equal((await handleArtifacts(store,teacher,{action:'get',artifactId:out.artifact.id},options()))[0],404,'another owner never sees it');
});

test('activity: save, review, decide and approve the same version, then practice that exact version',async()=>{
  const store=createAtomicMemoryStore();
  const [,created]=await create(store,teacher,{kind:'activity',draft:activityDraft(),planning:professional,privateConcerns:'חוששת מהקבוצה 0501234567'});
  const a=created.artifact;assert.equal(a.locks.purpose,'לבנות פינת עזרה הדדית בכיתה');
  const seen=[];
  const provider={async complete(request){const input=JSON.parse(request.messages[0].content);seen.push(input);
    return {status:'completed',usage:{inputTokens:10,outputTokens:10,totalTokens:20},text:JSON.stringify({artifactId:input.artifactId,baseVersion:input.baseVersion,
      changes:[{path:'steps/closing/instructions',value:'בסיכום המורה שואלת את הכיתה: מה עזר לנו לעבוד יחד? כדי לבחור צעד לשבוע.'}],
      rationale:'שאלת סיכום ברורה.',sourceIds:['fixture-approved-source'],unknowns:[],riskFlags:[]})};}};
  const [rs,reviewed]=await handleArtifacts(store,teacher,{action:'review',artifactId:a.id,expectedVersion:1,idempotencyKey:'review-activity-1'},options({provider}));
  assert.equal(rs,200);assert.equal(reviewed.review.status,'complete');
  const envelope=seen[0];
  assert.equal(envelope.content.kind,'activity');assert.ok(!('document' in envelope.content),'reviewers get text, not the document tree');
  assert.match(envelope.content.documentText,/המורה שואלת/);assert.ok(!envelope.allowedPaths.includes('pipelineOutput'));
  const proposal=reviewed.artifact.proposals[0];
  const [ds,decided]=await handleArtifacts(store,teacher,{action:'decide',artifactId:a.id,expectedVersion:1,proposalId:proposal.id,decision:'accept'},options());
  assert.equal(ds,200);assert.equal(decided.artifact.version,2);
  assert.match(decided.artifact.content.steps.find(s=>s.id==='closing').instructions,/מה עזר לנו/);
  assert.deepEqual(decided.artifact.content.document,validatePlannerDocument(doc()),'the planner document itself is unchanged by a proposal');
  const [as,approved]=await handleArtifacts(store,teacher,{action:'approve',artifactId:a.id,expectedVersion:2},options());
  assert.equal(as,200);assert.equal(approved.artifact.status,'approved');
  const [ps,practice]=await handleArtifacts(store,teacher,{action:'practice',artifactId:a.id,version:2},options());
  assert.equal(ps,200);assert.equal(practice.kind,'activity');assert.equal(practice.practiceMode,PRACTICE_MODES.activity);assert.equal(practice.version,2);
  assert.equal((await handleArtifacts(store,teacher,{action:'practice',artifactId:a.id,version:1},options()))[1].code,'unapproved_version');
});

test('approval gates per kind: an activity needs every professional field, a conversation needs goal, guidance and stages',async()=>{
  const store=createAtomicMemoryStore();
  const [,bare]=await create(store,teacher,{kind:'activity',draft:activityDraft()});
  assert.equal((await handleArtifacts(store,teacher,{action:'approve',artifactId:bare.artifact.id,expectedVersion:1},options()))[1].code,'missing_explanation');
  const [,conv]=await create(store,talker,{kind:'conversation',draft:conversationDraft()});
  assert.equal((await handleArtifacts(store,talker,{action:'approve',artifactId:conv.artifact.id,expectedVersion:1},options()))[1].code,'missing_explanation','guidance for the conversation is still missing');
  const update={...conv.artifact.content,facilitatorGuide:'שיחה ביחידות, במקום שקט. פותחים בשאלה פתוחה ומסיימים בהצעה: אני מציעה ש... מה דעתך?'};
  const [us,updated]=await handleArtifacts(store,talker,{action:'update',artifactId:conv.artifact.id,expectedVersion:1,content:update},options());
  assert.equal(us,200);
  const [as,approved]=await handleArtifacts(store,talker,{action:'approve',artifactId:conv.artifact.id,expectedVersion:2},options());
  assert.equal(as,200,'a conversation can be approved without a group mechanism');
  const [,practice]=await handleArtifacts(store,talker,{action:'practice',artifactId:conv.artifact.id,version:2},options());
  assert.equal(practice.practiceMode,'conversation-rehearsal');
  const [ks,kind]=await handleArtifacts(store,talker,{action:'update',artifactId:conv.artifact.id,expectedVersion:2,
    content:{...activityFromDraft(activityDraft()),...professional}},options());
  assert.equal(ks,422);assert.equal(kind.code,'kind_mismatch','a conversation stays a conversation');
});

test('reviewers stay in scope for planner kinds: no pipeline output, conversation guidance, locked goal',async()=>{
  const store=createAtomicMemoryStore();
  const [,out]=await create(store,talker,{kind:'conversation',draft:conversationDraft()});const artifact=out.artifact;
  const single=agentEnvelope(artifact,'single',{runId:'r1'}),compact=agentEnvelope(artifact,'pedagogy',{runId:'r1'});
  assert.match(single.kindGuidance,/one personal conversation/);assert.ok(single.content.documentText);assert.ok(!('documentText' in compact.content));
  const proposal=changes=>({artifactId:artifact.id,baseVersion:artifact.version,changes,rationale:'r',sourceIds:[],unknowns:[],riskFlags:[]});
  assert.throws(()=>validateProposal(proposal([{path:'pipelineOutput',value:{}}]),{artifact,agent:'single'}),{code:'proposal_patch'});
  assert.throws(()=>validateProposal(proposal([{path:'document',value:{}}]),{artifact,agent:'single'}),{code:'proposal_patch'});
  assert.throws(()=>validateProposal(proposal([{path:'purpose',value:'מטרה אחרת'}]),{artifact,agent:'single'}),{code:'locked_field'});
  assert.ok(validateProposal(proposal([{path:'steps/opening/instructions',value:'פותחים בשאלה: מה היה לך קשה השבוע?'}]),{artifact,agent:'single'}));
});

test('an activity may be approved without a social mechanism or facilitator guide only by an explicit choice, kept with the version',async()=>{
  const store=createAtomicMemoryStore();
  const {facilitatorGuide,socialMechanism,...rest}=professional;
  const [,out]=await create(store,teacher,{kind:'activity',draft:activityDraft(),planning:rest});const id=out.artifact.id;
  assert.equal((await handleArtifacts(store,teacher,{action:'approve',artifactId:id,expectedVersion:1},options()))[1].code,'missing_explanation','no silent skipping');
  assert.equal((await handleArtifacts(store,teacher,{action:'approve',artifactId:id,expectedVersion:1,proceedWithout:['socialMechanism']},options()))[1].code,'missing_explanation','each field is its own choice');
  assert.equal((await handleArtifacts(store,teacher,{action:'approve',artifactId:id,expectedVersion:1,proceedWithout:['purpose']},options()))[0],400,'goal and resilience fields cannot be skipped');
  const [as,approved]=await handleArtifacts(store,teacher,{action:'approve',artifactId:id,expectedVersion:1,proceedWithout:['socialMechanism','facilitatorGuide']},options());
  assert.equal(as,200);assert.deepEqual(approved.artifact.approvedVersions[0].proceedWithout,['socialMechanism','facilitatorGuide']);
  const [,practice]=await handleArtifacts(store,teacher,{action:'practice',artifactId:id,version:1},options());
  assert.deepEqual(practice.proceedWithout,['socialMechanism','facilitatorGuide']);
  // When the field is filled, the choice is not recorded: there is nothing to skip.
  const [,full]=await create(store,teacher,{kind:'activity',draft:activityDraft(),planning:professional});
  const [,approvedFull]=await handleArtifacts(store,teacher,{action:'approve',artifactId:full.artifact.id,expectedVersion:1,proceedWithout:['socialMechanism']},options());
  assert.ok(!('proceedWithout' in approvedFull.artifact.approvedVersions[0]));
  // A conversation has no such choice.
  const [,conv]=await create(store,talker,{kind:'conversation',draft:conversationDraft()});
  assert.equal((await handleArtifacts(store,talker,{action:'approve',artifactId:conv.artifact.id,expectedVersion:1,proceedWithout:['facilitatorGuide']},options()))[0],400);
});
