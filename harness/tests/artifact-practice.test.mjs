import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../../app/lib/artifact-practice.js',import.meta.url),'utf8');
const id='art-11111111-1111-1111-1111-111111111111';
const approved=()=>({artifactId:id,version:3,observations:[],content:{scenario:{name:'תרחיש סינתטי'},purpose:'בחירה משותפת',resilienceComponents:['שייכות'],individualSkills:['הקשבה'],sharedSkills:['תכנון יחד'],
  facilitatorGuide:'פותחים בהצעה להשתתף.',socialMechanism:'נבחר בירור שבועי.',steps:[{id:'one',title:'פתיחה',instructions:'מציעים בחירה.',minutes:3}]}});
function fixture(fetcher,query='?artifactId='+id+'&version=3') {
  const elements=[],calls=[],prints=[];let serial=0;
  class Element {
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.attrs={};this.style={};this.value='';elements.push(this);}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=items;}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(event,fn){this.listeners[event]=fn;}
    querySelectorAll(){return [];}
    set innerHTML(_){throw Error('Untrusted HTML must not be parsed');}
  }
  const wrap=new Element('div'),composer=new Element('div'),header=new Element('h1'),subtitle=new Element('p'),banner=new Element('div');
  banner.textContent='automatic AI red-line recording';
  wrap.querySelectorAll=()=>[banner];
  const document={querySelector:()=>wrap,getElementById:name=>name==='composerBar'?composer:name==='scenarioName'?header:name==='scenarioSubtitle'?subtitle:null,
    createElement:tag=>new Element(tag)};
  vm.runInNewContext(script,{document,location:{search:query},URLSearchParams,crypto:{randomUUID:()=> 'observation-'+(++serial)},
    window:{sbeAIOrigin:()=> 'http://localhost:fixture',sbeAIHeaders:()=> ({authorization:'Bearer synthetic'}),SBE_DOC:{print:out=>prints.push(out)}},
    fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body,headers:options.headers});return fetcher(body);}});
  return {elements,calls,prints,wrap,header,subtitle,banner};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const response=value=>({ok:true,json:async()=>structuredClone(value)});
const textOf=node=>[node.textContent||'',...node.children.map(textOf)].join(' ');
test('print uses approved tables, treats markup as text and excludes private observations and unsaved form values',async()=>{
  const saved=approved();saved.content.facilitatorGuide='<img src=x onerror=alert(1)>';saved.observations=[{id:'old',observation:'private observation',chosenNextStep:'private choice'}];
  const {elements,prints}=fixture(async()=>response(saved));await tick();
  elements.find(item=>item.tagName==='TEXTAREA').value='unsaved private observation';
  elements.find(item=>item.tagName==='BUTTON'&&item.textContent==='הדפסת הגרסה שאושרה').listeners.click();
  assert.equal(prints.length,1);assert.equal(prints[0].subtitle,'גרסה מאושרת 3');assert.equal(prints[0].inline,true);
  const tables=prints[0].node.children.filter(item=>item.tagName==='TABLE');assert.equal(tables.length,2);
  assert.equal(tables[0].children[1].children.length,6);assert.equal(tables[1].children[1].children.length,1);
  const printed=textOf(prints[0].node);assert.ok(printed.includes('<img src=x onerror=alert(1)>'));assert.ok(printed.includes('מציעים בחירה.'));
  assert.ok(!printed.includes('private'));assert.ok(!elements.some(item=>item.tagName==='IMG'));
});
test('approved rehearsal fetches the exact version, shows its explanations and reopens its observations without generation',async()=>{
  const saved=approved();saved.observations=[{id:'old',version:3,observation:'תצפית קודמת',chosenNextStep:'בחירה קודמת'}];
  const {wrap,calls,header,subtitle,banner}=fixture(async()=>response(saved));await tick();
  assert.deepEqual(calls[0].body,{action:'practice',artifactId:id,version:3});assert.equal(calls.length,1);
  assert.equal(calls[0].headers.authorization,'Bearer synthetic');
  for(const value of ['בחירה משותפת','שייכות','הקשבה','תכנון יחד','פותחים בהצעה להשתתף.','נבחר בירור שבועי.','תצפית קודמת','בחירה קודמת'])assert.ok(textOf(wrap).includes(value));
  assert.ok(textOf(wrap).includes('אינה מדידה של שיפור חוסן'));assert.ok(!calls.some(call=>call.body.action==='review'));
  assert.equal(banner.hidden,true);assert.equal(header.textContent,'תרגול הפעילות שאישרת');assert.match(subtitle.textContent,/עמיתה/);
});
test('a failed observation keeps text and retries the same submission; pending save prevents an edit from being erased',async()=>{
  let release,attempt=0;
  const pending=new Promise(resolve=>release=resolve);
  const {elements,calls}=fixture(async body=>{
    if(body.action==='practice')return response(approved());
    attempt++;if(attempt===1)throw Error('synthetic network failure');
    await pending;return response({observation:{id:body.submissionId,version:3,observation:body.observation,chosenNextStep:body.chosenNextStep}});
  });await tick();
  const form=elements.find(item=>item.tagName==='FORM'),inputs=elements.filter(item=>item.tagName==='TEXTAREA');
  inputs[0].value='מה ראיתי';inputs[1].value='מה בחרתי';
  await form.listeners.submit({preventDefault(){}});
  assert.equal(inputs[0].value,'מה ראיתי');assert.equal(inputs[1].value,'מה בחרתי');
  const saving=form.listeners.submit({preventDefault(){}});await tick();
  assert.equal(inputs[0].disabled,true);assert.equal(inputs[1].disabled,true);
  release();await saving;
  assert.equal(calls[1].body.submissionId,calls[2].body.submissionId);assert.equal(inputs[0].value,'');assert.equal(inputs[0].disabled,false);
});
test('a draft or denied artifact cannot show a practice form or approved content',async()=>{
  for(const status of [403,409]) {
    const {wrap,elements}=fixture(async()=>({ok:false,status,json:async()=>({code:'unapproved_version'})}));await tick();
    assert.ok(!elements.some(item=>item.tagName==='FORM'));assert.ok(!textOf(wrap).includes('בחירה משותפת'));
    assert.ok(textOf(wrap).includes(status===409?'טרם אושרה':'לא ניתן לפתוח'));
  }
});
