import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
const file=new URL('../../app/lib/activity-review-ui.js',import.meta.url);
const source=existsSync(file)?readFileSync(file,'utf8'):'';
function env(request){
  const data=new Map();let serial=0;
  const window={sbeUserKey:k=>k+':owner-a',sbeAIHeaders:()=>({'Content-Type':'application/json',Authorization:'Bearer test'}),
    sbeAIOrigin:()=> 'http://localhost:3456',crypto:{randomUUID:()=>`request-${++serial}`}};
  const context={window,document:{hidden:false},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
    structuredClone,AbortController,URL,URLSearchParams,Date,setTimeout,clearTimeout,fetch:request};
  vm.runInNewContext(source,context);
  assert.ok(window.SBE_ACTIVITY_REVIEW,'private artifact UI module exists');
  return {ui:window.SBE_ACTIVITY_REVIEW,data,context};
}
const scenario=()=>({id:'test',name:'תרחיש',given:{goals:'מטרת האדם'},_generation:{context:{given:{goals:'מטרת האדם'},skills:['הקשבה'],locked:{}},
  pipelineOutput:{turningPoints:[{n:1,name:'פתיחה',trigger:'הזמנה',does:'תגובה',demands:'להקשיב'}]}}});
function artifact(content,version=1){return {id:'art-test',version,status:'draft',content:structuredClone(content),privateConcerns:'',proposals:[],approvedVersions:[]};}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function complete(session){for(const [k,v] of Object.entries({resilienceComponents:['שייכות'],sharedSkills:['הדדיות'],facilitatorGuide:'הזמנה לשיחה',socialMechanism:'זוגות קבועים'}))session.edit(k,v);}

test('Narrative adapter preserves original context and marks missing explanations without fabricating them',()=>{
  const {ui}=env();const scn=scenario(),draft=ui.draftFromScenario(scn);
  assert.equal(draft.purpose,'מטרת האדם');assert.deepEqual(Array.from(draft.individualSkills),['הקשבה']);
  assert.deepEqual(Array.from(draft.resilienceComponents),[]);assert.equal(draft.facilitatorGuide,'');assert.equal(draft.socialMechanism,'');
  assert.deepEqual(draft.context,scn._generation.context);assert.match(draft.steps[0].id,/^[a-zA-Z0-9_-]{1,80}$/);
  assert.ok(ui.missingFields(draft).includes('sharedSkills'));
  assert.throws(()=>ui.draftFromScenario({name:'untrusted'}),/pipeline|מקור/);
});

test('Narrative adapter retains canonical pipeline lines, actions, and missed-turn guidance',()=>{
  const {ui}=env(),scn=scenario();
  scn._generation.pipelineOutput.turningPoints=[{name:'בחירה',trigger:'פותחים שיחה',
    characterDoes:{line:'אפשר לבחור דרך אחרת?',action:'מסתכלת אל הדלת'},demands:'להציע בחירה',ifMissed:'המשתתפת שותקת'}];
  assert.equal(ui.draftFromScenario(scn).steps[0].instructions,
    'פותחים שיחה\nאפשר לבחור דרך אחרת?\nמסתכלת אל הדלת\nלהציע בחירה\nהמשתתפת שותקת');
});

test('A save completing after an edit keeps visible local text and the new server base version',async()=>{
  const {ui,data}=env(),hold=deferred();let body;
  const session=ui.createSession({scenario:scenario(),request:async b=>{body=b;return hold.promise;}});
  const saving=session.save();session.edit('purpose','נוסח חדש בזמן שמירה');
  hold.resolve({artifact:artifact(body.content)});await saving;
  assert.equal(session.state.draft.purpose,'נוסח חדש בזמן שמירה');assert.equal(session.state.artifact.version,1);assert.equal(session.state.dirty,true);
  assert.ok([...data.values()].some(v=>v.includes('נוסח חדש בזמן שמירה')));
});

test('A late review never restores a removed step or accepts a proposal over unsaved edits',async()=>{
  const {ui}=env(),hold=deferred();let saved;
  const session=ui.createSession({scenario:scenario(),request:async b=>{
    if(b.action==='create'){saved=artifact(b.content);return {artifact:saved};}return hold.promise;
  }});complete(session);await session.save();
  const reviewing=session.review({stepId:session.state.draft.steps[0].id,requestType:'question',question:'איך לעזור?'});
  const removed=session.state.draft.steps[0].id;session.removeStep(removed);
  const proposal={id:'p-1',baseVersion:1,changes:[{path:`steps/${removed}/instructions`,value:'תגובה מאוחרת'}],rationale:'עידוד',sourceIds:[],unknowns:[],riskFlags:[]};
  hold.resolve({artifact:saved,review:{status:'complete',mode:'single',proposal}});await reviewing;
  assert.equal(session.state.draft.steps.length,0);assert.equal(session.canAccept(proposal),false);assert.equal(session.state.dirty,true);
});

test('Step IDs remain stable through edits, add/remove, and local reopening',async()=>{
  const {ui}=env();const session=ui.createSession({scenario:scenario(),request:async b=>({artifact:artifact(b.content)})});
  const original=session.state.draft.steps[0].id,added=session.addStep();session.editStep(original,'title','נוסח ערוך');
  assert.notEqual(added,original);assert.equal(session.state.draft.steps[0].id,original);session.removeStep(added);await session.save();
  const reopened=ui.createSession({artifactId:'art-test',request:async()=>({artifact:artifact(session.state.artifact.content)})});await reopened.load();
  assert.equal(reopened.state.draft.steps[0].id,original);assert.equal(reopened.state.draft.steps[0].title,'נוסח ערוך');
});

test('Proposal decisions are explicit and approval sends risk acknowledgment for the exact saved version',async()=>{
  const {ui}=env(),sent=[];let saved;
  const session=ui.createSession({scenario:scenario(),request:async b=>{sent.push(b);
    if(b.action==='create')saved=artifact(b.content);
    if(b.action==='review')return {artifact:saved,review:{status:'partial',mode:'team',proposal:{id:'p-1',baseVersion:1,changes:[],rationale:'אפשר להמשיך',sourceIds:['approved-id'],unknowns:['חסר גיל'],riskFlags:['בדיקה אנושית']}}};
    if(b.action==='decide')saved={...saved,version:2,status:'review_required'};
    if(b.action==='approve')saved={...saved,status:'approved',approvedVersions:[{version:2,content:saved.content}]};return {artifact:saved};
  }});complete(session);await session.save();await session.review({requestType:'refine'});
  assert.equal(sent.filter(b=>b.action==='decide').length,0);await session.decide(session.state.review.proposal,'accept');
  await assert.rejects(session.approve(false),/סיכונ|אישור|risk/);await session.approve(true);
  assert.equal(sent.at(-1).expectedVersion,2);assert.equal(sent.at(-1).acknowledgeRisks,true);assert.match(session.practiceURL(),/artifactId=art-test&version=2/);
});

test('Conflicts preserve a recoverable local draft and a failed save is never reported as saved',async()=>{
  const {ui}=env();const session=ui.createSession({scenario:scenario(),request:async()=>{throw Object.assign(new Error('version_conflict'),{status:409,code:'version_conflict'});}});
  session.edit('purpose','עריכה נשמרת');await assert.rejects(session.save(),/version_conflict/);
  assert.equal(session.state.draft.purpose,'עריכה נשמרת');assert.equal(session.state.dirty,true);assert.equal(session.state.conflict,true);
  assert.equal(session.state.artifact,null);
});

test('Rejecting a proposal preserves edits and private concerns made before or during the decision',async()=>{
  for(const timing of ['before','during']) {
    const {ui,data}=env(),hold=deferred();let saved;
    const session=ui.createSession({scenario:scenario(),request:async b=>{
      if(b.action==='create'){saved=artifact(b.content);return {artifact:saved};}
      return hold.promise;
    }});await session.save();
    const proposal={id:'proposal-reject',baseVersion:1,decision:'pending'};
    const edit=()=>{session.edit('purpose','עריכה אנושית שלא נשמרה');session.setConcerns('חשש פרטי חדש');};
    if(timing==='before')edit();
    const rejecting=session.decide(proposal,'reject');if(timing==='during')edit();
    hold.resolve({artifact:{...saved,proposals:[{...proposal,decision:'rejected'}]}});await rejecting;
    assert.equal(session.state.dirty,true);assert.equal(session.state.draft.purpose,'עריכה אנושית שלא נשמרה');
    assert.equal(session.state.concerns,'חשש פרטי חדש');assert.ok([...data.values()].some(value=>value.includes('עריכה אנושית שלא נשמרה')));
    const reopened=ui.createSession({artifactId:saved.id,request:async()=>({artifact:saved})});await reopened.load();
    assert.equal(reopened.state.draft.purpose,'עריכה אנושית שלא נשמרה');assert.equal(reopened.state.dirty,true);
  }
});

test('A disposed or replaced editor cannot overwrite the active editor local backup',async()=>{
  const {ui,data}=env(),hold=deferred(),server=artifact(ui.draftFromScenario(scenario()));
  const first=ui.createSession({artifactId:server.id,request:async b=>b.action==='get'?{artifact:server}:hold.promise});await first.load();
  first.edit('purpose','עריכה של החלון הראשון');const saving=first.save();
  first.dispose();
  const second=ui.createSession({artifactId:server.id,request:async()=>({artifact:server})});await second.load();
  second.edit('purpose','העריכה החדשה בחלון הפעיל');second.setConcerns('חשש בחלון הפעיל');
  hold.resolve({artifact:{...server,version:2}});await assert.rejects(saving,/בוטלה/);
  const stored=JSON.parse(data.get('sbe.narrative.artifact.draft.v1.'+server.id+':owner-a'));
  assert.equal(stored.draft.purpose,'העריכה החדשה בחלון הפעיל');assert.equal(stored.concerns,'חשש בחלון הפעיל');assert.equal(stored.dirty,true);
  const third=ui.createSession({artifactId:server.id,request:async()=>({artifact:server})});await third.load();
  await assert.rejects(second.save(),/בוטלה/);assert.equal(third.state.draft.purpose,'העריכה החדשה בחלון הפעיל');
});

test('Cancelling before artifact startup acknowledgment cancels the late authenticated job',async()=>{
  const startup=deferred(),sent=[];const {ui}=env(async(url,init)=>{
    sent.push({url,body:JSON.parse(init.body),headers:init.headers});
    if(url.endsWith('/api/artifacts')){await startup.promise;return {ok:true,status:200,json:async()=>({jobId:'late-start-job'})};}
    return {ok:true,status:200,json:async()=>({status:'cancelled'})};
  });
  const ctrl=new AbortController(),reviewing=ui.createClient({pollMs:0})({action:'review',artifactId:'art-test',expectedVersion:1},{signal:ctrl.signal});
  ctrl.abort();startup.resolve();await assert.rejects(reviewing,/בוטלה/);
  assert.equal(sent.length,2);assert.ok(sent[1].url.endsWith('/api/pipeline-cancel'));assert.equal(sent[1].body.jobId,'late-start-job');
  assert.equal(sent[1].headers.Authorization,'Bearer test');
});

test('Async review uses authenticated transport, stable logical request IDs, and cancellation reaches its job',async()=>{
  const sent=[];const {ui}=env(async(url,init)=>{const body=JSON.parse(init.body);sent.push({url,body,headers:init.headers});
    const value=url.endsWith('/api/artifacts')?{jobId:'job-1'}:{status:'done',artifact:{},review:{status:'failed',proposal:null}};
    return {ok:true,status:200,json:async()=>value};
  });
  const client=ui.createClient({pollMs:0});await client({action:'review',artifactId:'art-test',expectedVersion:1,idempotencyKey:'logical-key'});
  assert.equal(sent[0].headers.Authorization,'Bearer test');assert.equal(sent[0].body.async,true);assert.ok(sent[0].body.requestId);assert.equal(sent[0].body.idempotencyKey,'logical-key');
  assert.equal(sent[1].body.jobId,'job-1');assert.equal(sent[0].url,'http://localhost:3456/api/artifacts');
});

test('Cancelling an async review cancels its authenticated server job and preserves the content',async()=>{
  const sent=[],hold=deferred(),polled=deferred();const {ui}=env(async(url,init)=>{
    const body=JSON.parse(init.body);sent.push({url,body,headers:init.headers});
    if(url.endsWith('/api/artifacts'))return {ok:true,status:200,json:async()=>({jobId:'cancel-me'})};
    if(url.endsWith('/api/pipeline-status')){polled.resolve();await hold.promise;return {ok:true,status:200,json:async()=>({status:'done',artifact:{},review:{}})};}
    return {ok:true,status:200,json:async()=>({status:'cancelled'})};
  });
  const client=ui.createClient({pollMs:0}),ctrl=new AbortController();
  const reviewing=client({action:'review',artifactId:'art-test',expectedVersion:1},{signal:ctrl.signal});
  await polled.promise;ctrl.abort();hold.resolve();await assert.rejects(reviewing,/בוטלה/);
  const cancel=sent.find(s=>s.url.endsWith('/api/pipeline-cancel'));assert.equal(cancel.body.jobId,'cancel-me');assert.equal(cancel.headers.Authorization,'Bearer test');
});

test('Loading the server version keeps an explicit recoverable copy of a conflicting local edit',async()=>{
  const {ui}=env();let current;
  const session=ui.createSession({scenario:scenario(),request:async b=>{
    if(b.action==='create')current=artifact(b.content);return {artifact:current};
  }});await session.save();session.edit('purpose','מקומי לשחזור');current={...current,version:2,content:{...current.content,purpose:'שרת עדכני'}};
  await session.load({discardLocal:true});assert.equal(session.state.draft.purpose,'שרת עדכני');assert.equal(session.state.recovery.draft.purpose,'מקומי לשחזור');
  session.restoreRecovery();assert.equal(session.state.draft.purpose,'מקומי לשחזור');assert.equal(session.state.artifact.version,2);assert.equal(session.state.dirty,true);
});

test('Refreshing twice does not silently rebase a conflicting local draft onto a new server version',async()=>{
  const {ui}=env();let current;
  const session=ui.createSession({scenario:scenario(),request:async b=>{if(b.action==='create')current=artifact(b.content);return {artifact:current};}});
  await session.save();session.edit('purpose','מבוסס על גרסה ישנה');current={...current,version:2};
  for(let i=0;i<2;i++){
    const reopened=ui.createSession({artifactId:'art-test',request:async()=>({artifact:current})});await reopened.load();
    assert.equal(reopened.state.draft.purpose,'מבוסס על גרסה ישנה');assert.equal(reopened.state.conflict,true);
    await assert.rejects(reopened.save(),/גרסת השרת/);
  }
});

function domEnvironment(fetcher){
  const {ui,context,data}=env(fetcher);const elements=[];
  class Node {
    constructor(tag){this.tagName=tag.toUpperCase();this.attributes={};this.children=[];this.listeners={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this._text='';elements.push(this);}
    set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent??String(c)).join('');}
    set innerHTML(v){assert.fail('Untrusted preparation text must never use innerHTML: '+v);}
    setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}
    append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this._text='';this.children=[...nodes];}
    addEventListener(k,fn){this.listeners[k]=fn;}fire(k){return this.listeners[k]?.({target:this});}
    click(){if(!this.disabled)this.fire('click');}
    querySelectorAll(selector){const result=[];for(const c of this.children){if(!(c instanceof Node))continue;const m=selector.match(/^button(?:\[([^\]]+)\])?$/);if(m&&c.tagName==='BUTTON'&&(!m[1]||c.attributes[m[1]]!==undefined))result.push(c);result.push(...c.querySelectorAll(selector));}return result;}
  }
  context.document.createElement=t=>new Node(t);context.document.createTextNode=t=>({textContent:t});
  const container=new Node('div');return {ui,context,data,elements,container};
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('proposal comparison uses its historical base after a deleted step and a newer review',async()=>{
  const {ui,container}=domEnvironment();let oldProposal;
  const session=ui.mount(container,{scenario:scenario()});
  // Exercise the rendered history through the authenticated client.
  session.state.artifact=artifact(session.state.draft,2);
  const base=structuredClone(session.state.draft),step=base.steps[0];
  oldProposal={id:'historic',baseVersion:1,decision:'pending',changes:[{path:'steps/'+step.id+'/instructions',value:'הצעה קודמת'}],rationale:'בדיקה היסטורית',sourceIds:[],unknowns:[],riskFlags:[]};
  session.state.artifact.history=[{version:1,content:base}];
  session.state.artifact.proposals=[oldProposal];session.state.reviewBase={...base,steps:[]};
  session.state.draft.steps=[];session.state.artifact.content.steps=[];
  session.edit('socialMechanism','עדכון להצגת ההיסטוריה');
  assert.ok(container.textContent.includes(step.instructions));
  assert.ok(container.textContent.includes(step.title+': הנחיות השלב'));
  assert.ok(!container.textContent.includes('steps/'+step.id+'/instructions'));
  assert.ok(!container.textContent.includes('מזהה קבוע:'));
});

test('Actual editor DOM exposes RTL labels, private concern, steps, and explicit safe proposal controls',async()=>{
  let saved;const {ui,elements,container}=domEnvironment(async(url,init)=>{
    const b=JSON.parse(init.body);let reply;
    if(b.action==='create'){saved=artifact(b.content);reply={artifact:saved};}
    if(b.action==='review')reply={artifact:saved,review:{status:'partial',mode:'team',proposal:{id:'proposal-dom',baseVersion:1,
      changes:[{path:'socialMechanism',value:'<img src=x onerror=alert(1)>'}],rationale:'<script>private</script>',sourceIds:['source-a'],unknowns:['גיל חסר'],riskFlags:['לעבור יחד']}}};
    return {ok:true,status:200,json:async()=>reply};
  });
  const session=ui.mount(container,{scenario:scenario()});complete(session);
  assert.equal(container.children[0].getAttribute('dir'),'rtl');
  assert.ok(elements.some(n=>n.getAttribute('role')==='status'&&n.getAttribute('aria-live')==='polite'));
  for(const label of ['מטרת הפעילות','הנחיות למנחה','שאלה או בקשת שינוי לגבי השלב'])assert.ok(elements.some(n=>n.getAttribute('aria-label')===label));
  assert.ok(elements.some(n=>n.textContent==='הוספת שלב'));assert.ok(elements.some(n=>n.textContent==='הסרת השלב'));
  assert.ok(elements.some(n=>n.getAttribute('aria-label')?.includes('חשש פרטי')));
  await session.save();await session.review({requestType:'refine'});await flush();
  assert.ok(container.textContent.includes('<img src=x onerror=alert(1)>'));assert.ok(container.textContent.includes('גיל חסר'));assert.ok(container.textContent.includes('source-a'));
  const accept=elements.findLast(n=>n.getAttribute('data-accept')==='proposal-dom'),reject=elements.findLast(n=>n.getAttribute('data-reject')==='proposal-dom');
  assert.equal(accept.disabled,false);assert.equal(reject.disabled,false);
  session.edit('socialMechanism','עריכה אנושית');assert.equal(accept.disabled,true);
  assert.equal(session.state.draft.socialMechanism,'עריכה אנושית');assert.equal(session.state.artifact.content.socialMechanism,'זוגות קבועים');
  const ack=elements.findLast(n=>n.tagName==='INPUT'&&n.getAttribute('type')==='checkbox');
  ack.checked=true;ack.fire('change');session.edit('purpose','מטרה של גרסה חדשה');assert.equal(ack.checked,false);
});

test('Private concerns travel separately from participant content and stay out of workshop callbacks',async()=>{
  const {ui}=env();let body;
  const session=ui.createSession({scenario:scenario(),request:async b=>{body=b;return {artifact:{...artifact(b.content),privateConcerns:b.privateConcerns}};}});
  session.setConcerns('חשש פרטי שאין לשתף');await session.save();
  assert.equal(body.privateConcerns,'חשש פרטי שאין לשתף');assert.equal(JSON.stringify(body.content).includes('חשש פרטי שאין לשתף'),false);
  assert.equal(session.state.concerns,'חשש פרטי שאין לשתף');
});

test('Narrative generation cancelled by reset never opens its late result and keeps scoped job transport',async()=>{
  const code=readFileSync(new URL('../../app/lib/narrative-build.js',import.meta.url),'utf8');
  const hold=deferred(),started=deferred(),sent=[],shown=[];
  const button={textContent:'בנייה',disabled:false},cancel={hidden:true};
  const context={window:{sbeUserKey:k=>k+':owner-a',sbeAIHeaders:()=>({Authorization:'Bearer test'}),crypto:{randomUUID:()=> 'generation-request-1'}},
    document:{hidden:false,getElementById:id=>id==='bCancelBuild'?cancel:null},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    AbortController,Date,setTimeout,clearTimeout,console,
    fetch:async(url,init)=>{sent.push({url,body:JSON.parse(init.body),headers:init.headers});if(url.endsWith('/api/pipeline')){started.resolve();await hold.promise;return {ok:true,status:200,text:async()=>JSON.stringify({scenario:{actor:{},trainee:{}}})};}return {ok:true,status:200,text:async()=>JSON.stringify({status:'cancelled'})};}};
  vm.runInNewContext(code,context);
  const building=context.window.SBE_BUILD.buildEdu({fields:{traineeRole:'מורה',actorRole:'הורה',event:'אירוע',skills:'הקשבה'},labels:{},button,server:'http://local.test',show:(...args)=>shown.push(args)});
  await started.promise;context.window.SBE_BUILD.invalidateEdu();hold.resolve();await building;
  assert.equal(shown.length,0);assert.equal(button.disabled,false);assert.equal(cancel.hidden,true);assert.equal(sent[0].headers.Authorization,'Bearer test');
  assert.equal(sent[0].body.requestId,'generation-request-1');assert.equal(sent[0].body.input.locked['characters.trainee.role'],'מורה');assert.equal(sent[0].body.input.locked['given.whatHappened'],'אירוע');
});

test('confirmed lost generations use a fresh request ID for recovery, including reopening a saved job',async()=>{
  const code=readFileSync(new URL('../../app/lib/narrative-build.js',import.meta.url),'utf8')
    .replace('window.SBE_BUILD = {','window.SBE_BUILD = {runCompleteJob, runEduJob,');
  for(const operation of ['runCompleteJob','runEduJob','resumeEdu']) {
    const starts=[];
    const {context,data}=domEnvironment(async(url,options)=>{
      const body=JSON.parse(options.body);let reply;
      if(url.endsWith('/api/pipeline-status'))reply={status:'lost'};
      else {starts.push(body);reply={jobId:'job-'+starts.length};}
      return {ok:true,status:200,text:async()=>JSON.stringify(reply),json:async()=>reply};
    });
    context.document.getElementById=()=>null;
    context.setTimeout=(fn,ms)=>setTimeout(fn,ms>=30000?ms:0);
    vm.runInNewContext(code,context);
    const body={requestId:'original-request',input:{given:{who:'synthetic'}}},button={textContent:'בנייה',disabled:false};
    if(operation==='resumeEdu') {
      data.set('sbe.edu.job.v1:owner-a',JSON.stringify({jobId:'saved-job',body,at:Date.now(),retried:false}));
      await context.window.SBE_BUILD.resumeEdu({server:'http://local.test',button,show(){}});
      assert.equal(starts.length,1);assert.notEqual(starts[0].requestId,'original-request');
    }else {
      await assert.rejects(context.window.SBE_BUILD[operation]('http://local.test',body,button,false),/הופעל מחדש/);
      assert.equal(starts.length,2);assert.equal(starts[0].requestId,'original-request');assert.notEqual(starts[1].requestId,starts[0].requestId);
    }
  }
});

test('Actual narrative input screen loads the editor before the build module and all inline scripts parse',()=>{
  const html=readFileSync(new URL('../../app/input-screen.html',import.meta.url),'utf8');
  assert.ok(html.indexOf('lib/activity-review-ui.js')<html.indexOf('lib/narrative-build.js'));
  assert.match(html,/SBE_ACTIVITY_REVIEW\.mountSaved/);assert.match(html,/id="bCancelBuild" hidden/);
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc=/.test(match[1]))new vm.Script(match[2]);
});
