import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const domain=createRequire(import.meta.url)('../../app/lib/resilience-studio.js');
const ui=readFileSync(new URL('../../app/lib/resilience-studio-ui.js',import.meta.url),'utf8');
function section(start,end){return ui.slice(ui.indexOf(start),ui.indexOf(end,ui.indexOf(start)));}

test('Quota failure cannot announce a saved activity or discard the in-memory draft; retry can succeed',async()=>{
  const errors=[],notices=[],runs=[],previousSaved=[{id:'existing'}];
  const state={activity:{title:'טיוטה'},currentId:null};
  const ctx={authorized:true,persistenceFailed:false,STORE:'owner-work',state,saved:previousSaved,
    localStorage:{setItem(){throw new Error('QuotaExceededError');}},snapshot:()=>structuredClone(state),
    error:m=>errors.push(m),notice:m=>notices.push(m),ensureAuthorized:async()=>true,
    operation:(message,fn)=>runs.push(fn()),renderSaved(){},uid:()=> 'new-work'};
  const api=vm.runInNewContext(section('  function persist()','  function readWork(')+section('  function saveActivity()','  function downloadWork()')+'({persist,saveActivity})',ctx);
  api.saveActivity();await runs[0];
  assert.equal(ctx.saved,previousSaved);assert.equal(state.currentId,null);assert.equal(state.activity.title,'טיוטה');
  assert.equal(notices.length,0);assert.equal(ctx.persistenceFailed,true);assert.match(errors[0],/קובץ עבודה אישי/);
  ctx.localStorage.setItem=()=>{};
  api.saveActivity();await runs[1];
  assert.equal(ctx.saved[0].id,'new-work');assert.equal(ctx.persistenceFailed,false);
  assert.equal(notices.length,1);assert.match(notices[0],/נשמרו במכשיר/);assert.equal(errors.at(-1),'');
});

test('Social mechanisms preserve roles and cadence in public kits, while coaching fears stay private',()=>{
  const brief=domain.newBrief({goal:'עזרה הדדית',focus:'support',participants:'צוות',participantAge:'מבוגרים',count:8,duration:30,sessions:1});
  const activity=domain.exampleActivity(brief);
  activity.coach={concerns:'חשש פרטי',messages:[{text:'שיחה פרטית'}]};
  const publicKit=domain.publicActivity(activity);
  assert.equal(publicKit.socialMechanism.type,'routine');assert.ok(publicKit.socialMechanism.roles);
  assert.ok(publicKit.facilitationPlan.opening);assert.ok(!Object.hasOwn(publicKit,'coach'));assert.ok(!JSON.stringify(publicKit).includes('חשש פרטי'));
  activity.socialMechanism.review='';
  assert.ok(domain.validateActivity(activity,brief).some(x=>x.includes('המנגנון החברתי')));
  delete activity.socialMechanism;delete activity.facilitationPlan;
  assert.deepEqual(domain.validateActivity(activity,brief),[],'earlier1.0kits remain editable');
});

test('AI step suggestions require explicit acceptance and reject a stale step',()=>{
  const notices=[],errors=[];let archives=0,saves=0;
  const step={id:'one',instructions:'נוסח קודם'};
  const ctx={busy:false,coachProposal:{stepId:'one',isCandidate:false,baseInstructions:'נוסח קודם',instructions:'נוסח משופר'},
    state:{activity:{sessions:[{steps:[step]}]}},candidate:null,prepareActivityEdit:()=>archives++,persist:()=>saves++,
    renderActivity(){},renderCandidate(){},renderCoach(){},updateControls(){},notice:x=>notices.push(x),error:x=>errors.push(x)};
  const accept=vm.runInNewContext('('+section('  function acceptCoachProposal()','  function renderFacilitationGuide()').trim()+')',ctx);
  assert.equal(step.instructions,'נוסח קודם');accept();
  assert.equal(step.instructions,'נוסח משופר');assert.equal(step.requiresReview,true);assert.equal(archives,1);assert.equal(saves,1);
  ctx.coachProposal={stepId:'one',isCandidate:false,baseInstructions:'נוסח קודם',instructions:'הצעה ישנה'};accept();
  assert.equal(step.instructions,'נוסח משופר');assert.equal(archives,1);assert.match(errors[0],/השלב השתנה/);
});

test('Consulting a linked variant uses its profile and private conversation, without main mapping or sources',async()=>{
  const calls=[],runs=[];
  const step={id:'family-step',instructions:'פעולה משפחתית'};
  const candidate={kind:'variant',coachScope:'coach-family',brief:{participants:'משפחה',participantAge:'6–8',count:4,duration:15,sources:[]},activity:{sessions:[{steps:[step]}]}};
  const state={brief:{participants:'צוות עבודה',participantAge:'מבוגרים',count:28,duration:40,sources:[{content:'private-main-source'}]},coach:{stage:'step',concerns:'private-main-fear',variantConcerns:{},messages:[{role:'user',text:'private-main-history',scope:'general',stage:'activity'}]}};
  const controls={'coach-question':{value:'איך להתאים את ההוראה למשפחה?'},'coach-concerns':{value:'חשש חדש למשפחה'},'coach-stage':{selectedOptions:[{textContent:'שלב'}]}};
  const ctx={candidate,state,coachTarget:{stepId:step.id,isCandidate:true},coachProposal:null,busy:false,
    $:id=>controls[id],collectBrief(){},selectedCoachStep:()=>step,selectedCoachActivity:()=>candidate.activity,
    cleanBrief:v=>structuredClone(v),cleanActivity:v=>structuredClone(v),copy:v=>structuredClone(v),
    requestBody:()=>assert.fail('linked consultation must not use the main mapping request'),
    renderCoach(){},persist:()=>true,operation:(message,fn)=>runs.push(fn()),notice(){},error:x=>assert.fail(x),
    api:async body=>{calls.push(body);return {consultation:{answer:'נחשוב על הוראה קצרה למשפחה',encouragement:'',nextSteps:[],questions:[],suggestedInstructions:'',professionalBasis:[]}};}};
  const ask=vm.runInNewContext(section('  function cleanReply(','  function cleanCoach(')+section('  function linkedCoach()','  function openCoach(')+section('  function askCoach()','  function acceptCoachProposal()')+'askCoach',ctx);
  ask();await runs[0];
  assert.equal(calls[0].brief.participantAge,'6–8');assert.equal(calls[0].brief.count,4);assert.equal(calls[0].brief.duration,15);
  assert.equal(calls[0].concerns,'חשש חדש למשפחה');assert.ok(!Object.hasOwn(calls[0],'mapping'));
  assert.ok(!JSON.stringify(calls[0]).includes('private-main'));assert.equal(state.coach.concerns,'private-main-fear');
  controls['coach-question'].value='ומה כדאי לעשות בהמשך?';ask();await runs[1];
  assert.equal(calls[1].history.length,2);assert.ok(!JSON.stringify(calls[1].history).includes('private-main'));
});

test('Reopening a conversation renders the saved suggested wording as historical text',()=>{
  const paragraphs=[],controls={};
  const node=()=>({append(){},replaceChildren(){},value:'',hidden:false});
  const ctx={state:{coach:{stage:'step',messages:[{role:'assistant',text:'תשובה',reply:{encouragement:'',nextSteps:[],questions:[],professionalBasis:[],suggestedInstructions:'נוסח מוצע שמור'}}]}},coachTarget:null,coachProposal:null,busy:false,authorized:true,
    $:id=>controls[id]||=node(),coachConcerns:()=>'',selectedCoachStep:()=>null,linkedCoach:()=>false,
    clear:n=>n,el:()=>node(),paragraph:(parent,title,text)=>paragraphs.push({title,text}),list:()=>node(),button:()=>node()};
  const render=vm.runInNewContext('('+section('  function renderCoach()','  function askCoach()').trim()+')',ctx);
  render();assert.ok(paragraphs.some(x=>x.text==='נוסח מוצע שמור'&&x.title.includes('ללא שינוי אוטומטי')));
  assert.equal(controls['coach-proposal'].hidden,true);
});

test('Accepting or rejecting a linked candidate clears its coach context and allows the next question',async()=>{
  for(const close of ['accept','reject']){
    const calls=[],runs=[],errors=[];
    const ctx={candidate:{kind:'variant',coachScope:'coach-family',activity:{title:'משפחה'},brief:{}},coachTarget:{isCandidate:true,stepId:'one'},coachProposal:{isCandidate:true},busy:false,
      state:{activity:{title:'צוות'},brief:{participants:'צוות'},variants:[],coach:{stage:'step',concerns:'',variantConcerns:{},messages:[]}},
      D:{validateActivity:()=>[],publicActivity:v=>v},cleanBrief:v=>v,uid:()=> 'variant',renderCoach(){},renderVariants(){},renderCandidate(){},persist:()=>true,notice(){},error:m=>errors.push(m),
      $:id=>id==='coach-question'?{value:'איך ממשיכים?'}:id==='coach-concerns'?{value:''}:{selectedOptions:[{textContent:'פעילות'}]},
      collectBrief(){},selectedCoachStep:()=>null,selectedCoachActivity:()=>ctx.state.activity,
      requestBody:(action,brief,previous)=>({action,brief,previous}),operation:(message,fn)=>runs.push(fn()),
      api:async body=>{calls.push(body);return {consultation:{answer:'צעד הבא',nextSteps:[],questions:[],professionalBasis:[]}};}};
    const reject=ui.match(/\$\('reject-candidate'\)\.addEventListener\('click',(\(\)=>\{[^\n]+?\})\);/)[1];
    const handlers=vm.runInNewContext(section('  function cleanReply(','  function cleanCoach(')+section('  function setCandidate(','  function selectedCoachStep(')+section('  function linkedCoach()','  function openCoach(')+section('  function askCoach()','  function acceptCoachProposal()')+section('  function acceptCandidate()','  function checkExport(')+`({acceptCandidate,askCoach,reject:${reject}})`,ctx);
    close==='accept'?handlers.acceptCandidate():handlers.reject();
    assert.equal(ctx.candidate,null);assert.equal(ctx.coachTarget,null);assert.equal(ctx.coachProposal,null);assert.equal(ctx.state.coach.stage,'activity');
    handlers.askCoach();await runs[0];assert.equal(calls[0].previous.title,'צוות');assert.equal(errors.length,0);
    ctx.coachTarget={isCandidate:true};handlers.askCoach();assert.match(errors[0],/כבר נסגרה/);assert.equal(calls.length,1);
  }
});

test('A step proposal cannot modify a replacement candidate with identical step wording',()=>{
  const original={activity:{sessions:[{steps:[{id:'one',instructions:'נוסח קודם'}]}]}},replacement={activity:{sessions:[{steps:[{id:'one',instructions:'נוסח קודם'}]}]}};
  const errors=[];let renders=0;
  const ctx={candidate:original,coachTarget:{isCandidate:true},coachProposal:{isCandidate:true,candidateRef:original,stepId:'one',baseInstructions:'נוסח קודם',instructions:'הצעה ישנה'},state:{coach:{stage:'step'}},busy:false,
    renderCoach:()=>renders++,error:m=>errors.push(m),prepareActivityEdit:()=>assert.fail('stale proposal must not archive'),persist:()=>assert.fail('stale proposal must not persist')};
  const handlers=vm.runInNewContext(section('  function setCandidate(','  function selectedCoachStep(')+section('  function acceptCoachProposal()','  function renderFacilitationGuide()')+'({setCandidate,acceptCoachProposal})',ctx);
  handlers.setCandidate(replacement);assert.equal(ctx.coachTarget,null);assert.equal(ctx.coachProposal,null);assert.equal(renders,1);
  ctx.coachProposal={isCandidate:true,candidateRef:original,stepId:'one',baseInstructions:'נוסח קודם',instructions:'הצעה ישנה'};
  handlers.acceptCoachProposal();assert.equal(replacement.activity.sessions[0].steps[0].instructions,'נוסח קודם');assert.match(errors[0],/השתנתה/);
});

test('Reading a source file discards it after work, brief or authorization changes; normal import succeeds',async()=>{
  for(const change of ['work','brief','authorization','none']){
    const origin={brief:{sources:[]}},errors=[],notices=[],controls={'source-file':{value:'file'},'source-details':{open:false}};let finish;
    const file={name:'private-source.md',text:()=>new Promise(resolve=>{finish=resolve;})};
    const ctx={state:origin,authorized:true,$:id=>controls[id],uid:()=> 'source',markBriefChanged(){},renderSources(){},notice:m=>notices.push(m),error:m=>errors.push(m)};
    const importFile=vm.runInNewContext('('+section('  async function importSource(','  function bind()').trim()+')',ctx);
    const pending=importFile(file);
    if(change==='work')ctx.state={brief:{sources:[]}};
    if(change==='brief')ctx.state.brief={sources:[]};
    if(change==='authorization')ctx.authorized=false;
    finish('תוכן פרטי');await pending;
    assert.equal(controls['source-file'].value,'');
    if(change==='none'){assert.equal(origin.brief.sources[0].content,'תוכן פרטי');assert.equal(notices.length,1);assert.equal(errors.length,0);}
    else{assert.equal(ctx.state.brief.sources.length,0);assert.equal(origin.brief.sources.length,0);assert.equal(notices.length,0);assert.match(errors[0],/לא צורף/);}
  }
});
