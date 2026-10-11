import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../../app/practice.html',import.meta.url),'utf8');
const main=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>',html.indexOf('<script>')));
const pcSource=readFileSync(new URL('../../app/lib/practice-custom.js',import.meta.url),'utf8');
const tableSource=readFileSync(new URL('../../app/lib/report-table.js',import.meta.url),'utf8');
const demoSource=readFileSync(new URL('../../app/lib/demo-hook.js',import.meta.url),'utf8');
const owner='sbe.practice.custom.v1:synthetic-owner';
const plain=value=>JSON.parse(JSON.stringify(value));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// A minimal DOM executes the entire real practice script, its events and the
// real demo recipe. Providers and timers are synthetic; no browser or network.
class TextNode {
  constructor(text){this.nodeType=3;this.textContent=String(text);this.parentNode=null;}
  remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(n=>n!==this);this.parentNode=null;}
  cloneNode(){return new TextNode(this.textContent);}
  get outerHTML(){return escape(this.textContent);}
}
class Element {
  constructor(tag){this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attrs=new Map();this.listeners=new Map();this.parentNode=null;this.style={};this.disabled=false;this.value='';this.dataset={};
    let classes='';Object.defineProperty(this,'className',{get:()=>classes,set:v=>classes=String(v)});
    this.classList={contains:n=>classes.split(/\s+/).includes(n),add:(...ns)=>{classes=[...new Set(classes.split(/\s+/).filter(Boolean).concat(ns))].join(' ');},toggle:(n,on)=>{const current=this.classList.contains(n);if(on??!current)this.classList.add(n);else classes=classes.split(/\s+/).filter(x=>x!==n).join(' ');}};
  }
  append(...nodes){for(const value of nodes.flat()){const n=typeof value==='object'?value:new TextNode(value);n.remove();n.parentNode=this;this.childNodes.push(n);}}
  appendChild(n){this.append(n);return n;}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
  set textContent(v){this.childNodes.forEach(n=>n.parentNode=null);this.childNodes=[];if(v)this.append(new TextNode(v));}
  get innerText(){return this.textContent;}
  get hidden(){return this.attrs.has('hidden');}set hidden(v){if(v)this.attrs.set('hidden','');else this.attrs.delete('hidden');}
  setAttribute(k,v){if(k==='class')this.className=v;else if(k==='id')this.id=String(v);else{this.attrs.set(k,String(v));if(k.startsWith('data-'))this.dataset[k.slice(5)]=String(v);if(k==='value')this.value=String(v);}}
  getAttribute(k){return k==='class'?this.className||null:k==='id'?this.id||null:k==='type'?this.type??this.attrs.get(k)??null:this.attrs.get(k)??null;}
  removeAttribute(k){if(k==='class')this.className='';else this.attrs.delete(k);}
  get options(){return this.children.filter(n=>n.tagName==='OPTION');}
  addEventListener(type,fn){const ls=this.listeners.get(type)||[];ls.push(fn);this.listeners.set(type,ls);}
  async fire(type,extra={}){for(const fn of this.listeners.get(type)||[])await fn({target:this,stopPropagation(){},preventDefault(){},...extra});}
  dispatchEvent(e){return this.fire(e.type,e);}
  async click(){if(!this.disabled)await this.fire('click');}
  focus(){}scrollIntoView(){}
  querySelectorAll(s){return all(this).filter(n=>matches(n,s));}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  closest(s){for(let n=this;n;n=n.parentNode)if(matches(n,s))return n;return null;}
  remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(n=>n!==this);this.parentNode=null;}
  cloneNode(deep=false){const n=new Element(this.tagName);n.className=this.className;n.id=this.id;n.value=this.value;n.type=this.type;for(const[k,v]of this.attrs)n.setAttribute(k,v);if(deep)n.append(...this.childNodes.map(c=>c.cloneNode(true)));return n;}
  get outerHTML(){const as=new Map(this.attrs);if(this.className)as.set('class',this.className);if(this.id)as.set('id',this.id);return '<'+this.tagName.toLowerCase()+[...as].map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+this.childNodes.map(n=>n.outerHTML).join('')+'</'+this.tagName.toLowerCase()+'>';}
}
const all=root=>root.childNodes.flatMap(n=>n.nodeType===1?[n,...all(n)]:[]);
function simple(n,s){if(n.nodeType!==1)return false;const not=/:not\(([^)]+)\)/.exec(s);if(not){if(simple(n,not[1]))return false;s=s.replace(not[0],'');}for(const[,k,v]of s.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/g))if(v!==undefined?n.getAttribute(k)!==v:n.getAttribute(k)===null)return false;const rest=s.replace(/\[[^\]]+\]/g,''),tag=/^[a-z][\w-]*/i.exec(rest)?.[0],id=/#([\w-]+)/.exec(rest)?.[1];return(!tag||n.tagName===tag.toUpperCase())&&(!id||n.id===id)&&[...rest.matchAll(/\.([\w-]+)/g)].every(([,c])=>n.classList.contains(c));}
function matches(n,s){return s.split(',').some(part=>{const tokens=part.trim().split(/\s+(?![^\[]*\])/);if(!simple(n,tokens.pop()))return false;let p=n.parentNode;while(tokens.length){const want=tokens.pop();while(p&&!simple(p,want))p=p.parentNode;if(!p)return false;p=p.parentNode;}return true;});}
function scenario(name='תרחיש סינתטי חדש'){return {name,subtitle:'שיחה משותפת',trainee:{role:'מחנכת',roleLabel:'מחנכת',opening:['נקשיב יחד','נחשוב על צעד']},actor:{name:'תמר',roleLabel:'הורה',entrance:{firstLine:'רציתי לדבר'},valve:'אני מודאגת'},turningPoints:[0,1,2,3,4].map(i=>({name:'תפנית '+i,trigger:'מקשיבים',does:{line:'נחשוב יחד'},keywords:['יחד']})),endings:['א','ב','ג','ד'],endingNotes:['א','ב','ג','ד'],skills:[{text:'הקשבה',keywords:['יחד']}]};}
function records(){return new Map([[owner,JSON.stringify(Array.from({length:12},(_,i)=>({id:'private-'+i,sc:scenario('SYNTHETIC_PRIVATE_CASE_'+i)})))],[owner+'.draft',JSON.stringify({form:{story:'SYNTHETIC_PRIVATE_STORY',hard:'SYNTHETIC_PRIVATE_CONTACT'},questions:[{q:'SYNTHETIC_PRIVATE_QUESTION'}],answers:{0:'SYNTHETIC_PRIVATE_ANSWER'},scenario:scenario('SYNTHETIC_PRIVATE_OLD_PREVIEW')})]]);}
function held(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
async function flush(){for(let i=0;i<20;i++)await Promise.resolve();}
function fixture({demo=false,embedded=true,admin=true,search=demo?'?demolab=1&part=own&minTurns=3':'',fail='',questions=false,data=records()}={}){
  const root=new Element('html'),head=new Element('head'),body=new Element('body');root.append(head,body);
  const nodes={};for(const m of html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){if(nodes[m[2]])continue;const n=new Element(m[1]);n.id=m[2];if(/\bhidden\b/.test(m[0]))n.hidden=true;const type=/\btype="([^"]+)"/.exec(m[0]);if(type)n.type=type[1];nodes[n.id]=n;body.append(n);}
  for(const id of ['own1','own2','own3','ownSteps','ownWait','ownErr','ownCancel'])nodes['screen-custom'].append(nodes[id]);
  for(const id of ['ownStory','ownRole','ownOther','ownGoal','ownHard','ownNext'])nodes.own1.append(nodes[id]);
  for(const id of ['ownQs','ownBuild','ownBack1'])nodes.own2.append(nodes[id]);
  for(const id of ['ownPreview','ownChange','ownRevise','ownApprove','ownBack2'])nodes.own3.append(nodes[id]);
  for(let i=1;i<4;i++){const li=new Element('li');li.dataset.s=String(i);nodes.ownSteps.append(li);}
  nodes['screen-select'].append(nodes.myCases,nodes.scenarioList);nodes['screen-chat'].append(nodes.transcript);
  for(const id of ['fbTurningPoints','fbSkills','fbAlmost','fbEnding','fbLog'])nodes['screen-feedback'].append(nodes[id]);
  const document={body,head,documentElement:root,readyState:'loading',getElementById:id=>nodes[id]||null,createElement:tag=>new Element(tag),createTextNode:v=>new TextNode(v),querySelector:s=>root.querySelector(s),querySelectorAll:s=>root.querySelectorAll(s)};
  let reads=0,writes=0,clock=0;const calls=[],chatCalls=[];
  const storage={getItem:k=>{reads++;return data.get(k)??null;},setItem:(k,v)=>{writes++;data.set(k,v);}};
  const window={scrollTo(){},addEventListener(){},sbeUserKey:k=>k+':synthetic-owner',sbeAIHeaders:()=>({}),
    sbeCallAIJson:async(_origin,request,_timeout,check)=>{calls.push(plain(request));const clarify=request.maxTokens===900;if(fail===(clarify?'clarify':'build'))throw new Error('synthetic provider failure');const reply=clarify?{questions:questions?[{q:'איפה נדבר?',options:['בחדר צוות','בשיחת טלפון']}]:[]}:scenario();assert.equal(check(reply),true);return plain(reply);}};
  window.parent=embedded?{postMessage(){}}:window;
  class FixtureDate extends Date{static now(){return clock+=10000;}}
  const context=vm.createContext({window,self:window,document,localStorage:storage,sessionStorage:{getItem:k=>k==='sbe.session.homeUrl'?(admin?'admin.html?role=sys':'home.html'):null},location:{search,pathname:'/practice.html',href:'https://example.test/practice.html'+search,origin:'https://example.test'},URLSearchParams,Map,Date:FixtureDate,AbortController,console:{warn(){},log(){}},confirm:()=>true,Event:class{constructor(type){this.type=type;}},sbeUserKey:window.sbeUserKey,sbeCallAIJson:(...args)=>window.sbeCallAIJson(...args),requestAnimationFrame:fn=>queueMicrotask(fn),fetch:async(url,request)=>{assert.equal(url,'https://sbe-server.onrender.com/api/character-turn');chatCalls.push(JSON.parse(request.body));if(fail==='chat')throw new Error('synthetic character failure');return {ok:true,json:async()=>({toolCalls:[{name:'report_turn',input:{spokenLine:'נחשוב על זה יחד',firedTurningPoint:null,trustConditionMet:false,pressedHiddenTopic:false}}]})};},setTimeout:(fn,ms)=>{if(ms<10000)queueMicrotask(fn);return 1;},clearTimeout(){},setInterval:()=>1,clearInterval(){}});
  context.Node=Element;vm.runInContext(pcSource,context,{filename:'practice-custom.js'});
  vm.runInContext(tableSource,context,{filename:'report-table.js'});context.SBE_TABLE=window.SBE_TABLE;
  vm.runInContext(main,context,{filename:'practice.html'});
  const at=demoSource.lastIndexOf('\n})();');vm.runInContext(demoSource.slice(0,at)+'\nwindow.__practiceDemo={recipe:RECIPES[page],inputSummary,standalone};\n'+demoSource.slice(at),context,{filename:'demo-hook.js'});
  return {window,document,nodes,data,calls,chatCalls,context,reads:()=>reads,writes:()=>writes,set:async(id,value)=>{nodes[id].value=value;await nodes[id].fire('input');},select:id=>vm.runInContext('selectScenario('+JSON.stringify(id)+')',context),stored:()=>JSON.parse(data.get(owner+'.draft'))};
}

for(const fail of ['','clarify','build'])test('actual own-case demo '+(fail||'success')+' isolates twelve cases and an old private preview',async()=>{
  const f=fixture({demo:true,fail}),before=new Map(f.data);
  if(fail)await assert.rejects(f.window.__practiceDemo.recipe(),/אין כרגע חיבור|הזמן עבר/);
  else{const items=await f.window.__practiceDemo.recipe();assert.equal(items[0].tool,'practice-own');assert.match(items[0].html,/תרחיש סינתטי חדש/);assert.doesNotMatch(JSON.stringify(items),/SYNTHETIC_PRIVATE/);}
  assert.equal(f.reads(),0);assert.equal(f.writes(),0);assert.deepEqual(f.data,before);
  assert.doesNotMatch(JSON.stringify(f.calls),/SYNTHETIC_PRIVATE/);assert.doesNotMatch(f.window.__practiceDemo.inputSummary(),/SYNTHETIC_PRIVATE/);
});
for(const fail of ['', 'chat'])test('actual catalogue demo '+(fail||'success')+' selects a bank card and preserves all private state',async()=>{
  const f=fixture({demo:true,search:'?demolab=1&minTurns=3',fail}),before=new Map(f.data),items=await f.window.__practiceDemo.recipe();
  assert.equal(items[0].tool,'practice');assert.doesNotMatch(JSON.stringify(items),/SYNTHETIC_PRIVATE/);assert.doesNotMatch(JSON.stringify(f.chatCalls),/SYNTHETIC_PRIVATE/);
  assert.equal(f.chatCalls.length,4);assert.equal(f.reads(),0);assert.equal(f.writes(),0);assert.deepEqual(f.data,before);
});
test('actual own-case recipe answers the generated questions before creating a fresh story',async()=>{
  const f=fixture({demo:true,questions:true}),before=new Map(f.data),items=await f.window.__practiceDemo.recipe();
  assert.equal(f.calls.length,2);assert.match(f.calls[1].messages[0].content,/איפה נדבר\? בחדר צוות/);assert.match(items[0].input,/איפה נדבר\? בחדר צוות/);
  assert.match(items[0].html,/תרחיש סינתטי חדש/);assert.doesNotMatch(JSON.stringify(items),/SYNTHETIC_PRIVATE/);assert.deepEqual(f.data,before);assert.equal(f.reads(),0);assert.equal(f.writes(),0);
});
test('catalogue recipe ignores a visible unrelated personal card even in front of the bank',async()=>{
  const f=fixture({demo:true,search:'?demolab=1&minTurns=3'}),outside=new Element('div'),name=new Element('div');outside.className='scenario-card';name.className='sc-name';name.textContent='SYNTHETIC_PRIVATE_UNRELATED_CARD';outside.append(name);f.nodes.myCases.append(outside);
  outside.addEventListener('click',()=>assert.fail('the catalogue recipe selected an unrelated card'));
  const items=await f.window.__practiceDemo.recipe();assert.doesNotMatch(JSON.stringify(items),/SYNTHETIC_PRIVATE/);assert.equal(f.chatCalls.length,4);
});
for(const [name,options]of [['standalone',{demo:true,embedded:false}],['non-admin',{demo:true,admin:false}],['ordinary embedded',{}],['near-match marker',{search:'?demolab=10'}]])test(name+' keeps ordinary personal case and draft persistence',async()=>{
  const f=fixture(options);assert.equal(f.reads(),2);assert.equal(f.nodes.myCases.querySelectorAll('.scenario-card').length,12);
  await f.nodes.bOwnCase.click();assert.match(f.nodes.ownPreview.textContent,/SYNTHETIC_PRIVATE_OLD_PREVIEW/);
  await f.set('ownStory','שינוי אישי רגיל');assert.equal(f.stored().form.story,'שינוי אישי רגיל');assert.equal(f.writes(),1);
  const reloaded=fixture({...options,data:f.data});assert.equal(reloaded.nodes.ownStory.value,'שינוי אישי רגיל');
});
for(const leave of ['cancel','select','approve'])test('late custom clarification cannot reopen the editor after '+leave,async()=>{
  const f=fixture(),late=held();await f.nodes.bOwnCase.click();f.window.sbeCallAIJson=async()=>late.promise;
  const pending=f.nodes.ownNext.click();
  if(leave==='cancel')await f.nodes.ownCancel.click();else if(leave==='select')f.select('gan-tov');else await f.nodes.ownApprove.click();
  if(leave!=='cancel')await f.nodes.bStart.click();const before=new Map(f.data);
  late.resolve({questions:[{q:'תשובה ישנה',options:['א']} ]});await pending;
  assert.equal(f.nodes['screen-custom'].hidden,true);assert.deepEqual(f.data,before);if(leave!=='cancel'){assert.equal(f.nodes['screen-chat'].hidden,false);assert.equal(f.nodes.composerBar.hidden,false);}
});
for(const revise of [false,true])test('late custom '+(revise?'revision':'build')+' cannot replace edited context',async()=>{
  const f=fixture(),late=held();await f.nodes.bOwnCase.click();f.window.sbeCallAIJson=async()=>late.promise;
  if(revise)await f.set('ownChange','שינוי לתרחיש');const pending=(revise?f.nodes.ownRevise:f.nodes.ownBuild).click();await flush();
  await f.set('ownStory','המקרה השתנה בזמן ההמתנה');const before=new Map(f.data);late.resolve(scenario('תשובה ישנה'));await pending;await flush();
  assert.deepEqual(f.data,before);assert.doesNotMatch(f.nodes.ownPreview.textContent,/תשובה ישנה/);
});
for(const revise of [false,true])for(const leave of ['cancel','select','approve'])test('late '+(revise?'revision':'build')+' is discarded after '+leave,async()=>{
  const f=fixture(),late=held();await f.nodes.bOwnCase.click();if(revise)await f.set('ownChange','בקשה לשיפור');let signal;
  f.window.sbeCallAIJson=async(_origin,_request,_timeout,_check,options)=>{signal=options?.signal;return late.promise;};
  const pending=(revise?f.nodes.ownRevise:f.nodes.ownBuild).click();await flush();
  if(leave==='cancel')await f.nodes.ownCancel.click();else if(leave==='select')f.select('gan-tov');else await f.nodes.ownApprove.click();
  if(leave!=='cancel')await f.nodes.bStart.click();const before=new Map(f.data);assert.equal(signal.aborted,true);
  late.resolve(scenario('תשובה שאיבדה את ההקשר'));await pending;assert.deepEqual(f.data,before);assert.equal(f.nodes['screen-custom'].hidden,true);
  if(leave!=='cancel'){assert.equal(f.nodes['screen-chat'].hidden,false);assert.equal(f.nodes.composerBar.hidden,false);}
});
test('an invalidated operation cannot unlock or stop the newer request',async()=>{
  const f=fixture(),old=held(),current=held();let count=0;await f.nodes.bOwnCase.click();f.window.sbeCallAIJson=async()=>++count===1?old.promise:current.promise;
  const first=f.nodes.ownNext.click();await f.nodes.ownCancel.click();await f.nodes.bOwnCase.click();const second=f.nodes.ownNext.click();assert.equal(count,2);
  old.resolve({questions:[{q:'ישן'}]});await first;assert.equal(f.nodes.ownNext.disabled,true);assert.equal(f.nodes.ownWait.hidden,false);
  current.resolve({questions:[{q:'חדש'}]});await second;assert.equal(f.nodes.ownNext.disabled,false);assert.equal(f.nodes.ownWait.hidden,true);assert.match(f.nodes.ownQs.textContent,/חדש/);assert.doesNotMatch(f.nodes.ownQs.textContent,/ישן/);
});
test('duplicate custom operations are ignored while the editor owns a pending request',async t=>{
  const f=fixture(),late=held();let count=0;await f.nodes.bOwnCase.click();f.window.sbeCallAIJson=async()=>{count++;return late.promise;};
  t.after(()=>late.resolve({questions:[{q:'ממשיכים'}]}));const pending=f.nodes.ownNext.click(),duplicate=f.nodes.ownBuild.click();assert.equal(count,1);late.resolve({questions:[{q:'ממשיכים'}]});await Promise.all([pending,duplicate]);
});
