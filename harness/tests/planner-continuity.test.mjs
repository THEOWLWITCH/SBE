import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';

const path=new URL('../../app/lib/planner-continuity.js',import.meta.url);
class Element {
  constructor(tag,text='') {this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attributes=new Map();this.listeners=new Map();this.style={};this.classList={add(){}};if(text)this.append(new TextNode(text));}
  get textContent(){return this.childNodes.map(x=>x.textContent).join('');}
  set textContent(value){this.childNodes=[];if(value)this.append(new TextNode(value));}
  get className(){return this.getAttribute('class')||'';}
  set className(value){this.setAttribute('class',value);}
  append(...nodes){this.childNodes.push(...nodes.map(x=>typeof x==='string'?new TextNode(x):x));}
  setAttribute(k,v){this.attributes.set(k,String(v));}
  getAttribute(k){return this.attributes.get(k)??null;}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  fire(name){return this.listeners.get(name)?.({target:this});}
  showModal(){this.open=true;}
  close(){this.open=false;this.fire('close');}
  remove(){this.removed=true;}
}
class TextNode {constructor(text){this.nodeType=3;this.textContent=text;}}
function environment(storage=new Map()){
  let owner='A',serial=0,failWrite=false;
  const prints=[];
  const window={sbeUserKey:base=>base+':'+owner,crypto:{randomUUID:()=> 'id-'+(++serial)},
    SBE_DOC:{editable:node=>node,ensureStyle(){},print:product=>prints.push(product)}};
  const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(failWrite)throw Error('quota');storage.set(key,value);}};
  const document={createElement:tag=>new Element(tag),createTextNode:text=>new TextNode(text),body:new Element('body')};
  if(existsSync(path))vm.runInNewContext(readFileSync(path,'utf8'),{window,document,localStorage,AbortController,DOMException,structuredClone,Date,setTimeout});
  return {window,api:window.SBE_PLANNER,storage,prints,setOwner:value=>owner=value,setFailWrite:value=>failWrite=value};
}
function table(text){const t=new Element('table');t.className='kit-table kit-two';const row=new Element('tr');const cell=new Element('td',text);cell.setAttribute('colspan','2');row.append(cell);t.append(row);return t;}

test('Private product saves actual edited tables, reopens without AI and versions later edits',()=>{
  const env=environment();assert.equal(typeof env.api?.createArchive,'function');
  const archive=env.api.createArchive('planner.saved.v2'),node=table('הנוסח שערכתי\nבחירה משותפת');
  const record=archive.save({title:'התוצר שלי',subtitle:'טיוטה',fields:{goal:'הקלט המקורי'},nodes:[node]});
  assert.equal(record.version,1);assert.equal(record.privacy,'private');assert.equal(record.status,'draft');
  const reloaded=environment(env.storage).api.createArchive('planner.saved.v2');
  const restored=reloaded.restore(reloaded.get(record.id));
  assert.equal(restored[0].textContent,node.textContent);assert.equal(restored[0].tagName,'TABLE');
  assert.equal(restored[0].childNodes[0].childNodes[0].getAttribute('colspan'),'2');
  restored[0].childNodes[0].childNodes[0].textContent='נוסח חדש';
  const next=reloaded.save({id:record.id,expectedVersion:1,title:'התוצר שלי',fields:record.fields,nodes:restored});
  assert.equal(next.version,2);assert.equal(next.history.length,1);
  assert.equal(reloaded.restore(next.history[0])[0].textContent,node.textContent);
  assert.throws(()=>reloaded.save({id:record.id,expectedVersion:1,title:'ישן',nodes:restored}),/גרסה|version/);
});

test('Scoped products isolate A/B/A, refuse an old open editor after identity changes and preserve ambiguous legacy data',()=>{
  const env=environment();assert.equal(typeof env.api?.createArchive,'function');
  env.storage.set('planner.saved.v1',JSON.stringify([{text:'legacy private'}]));
  const a=env.api.createArchive('planner.saved.v2');a.save({title:'A',nodes:[table('A private')]});
  env.setOwner('B');assert.throws(()=>a.list(),/כניסה|identity/);
  assert.throws(()=>a.save({title:'bad',nodes:[table('A private')]}),/כניסה|identity/);
  const b=env.api.createArchive('planner.saved.v2');assert.equal(b.list().length,0);
  b.save({title:'B',nodes:[table('B private')]});env.setOwner('A');
  assert.equal(a.list().length,1);assert.equal(a.restore(a.list()[0])[0].textContent,'A private');
  assert.equal(JSON.parse(env.storage.get('planner.saved.v1'))[0].text,'legacy private');
});

test('Save errors keep the product and never report success; reopened and printed snapshots discard active markup',()=>{
  const env=environment();assert.equal(typeof env.api?.createArchive,'function');
  const archive=env.api.createArchive('planner.saved.v2');const node=table('עריכה שנשארת');
  const cell=node.childNodes[0].childNodes[0];cell.setAttribute('onclick','evil()');cell.append(new Element('script','evil()'),new Element('img'));
  const button=archive.saveButton({title:'כותרת',nodes:()=>[node]});env.setFailWrite(true);button.fire('click');
  assert.doesNotMatch(button.textContent,/נשמר ✓/);assert.match(button.textContent,/לא נשמר/);assert.equal(cell.textContent,'עריכה שנשארתevil()');
  env.setFailWrite(false);button.fire('click');assert.match(button.textContent,/נשמר.*✓/);
  const record=archive.list()[0],restored=archive.restore(record);assert.equal(restored[0].textContent,'עריכה שנשארת');
  assert.equal(restored[0].childNodes[0].childNodes[0].getAttribute('onclick'),null);
  assert.equal(archive.copy([node])[0].textContent,'עריכה שנשארת');
  archive.print({title:'כותרת',nodes:[node]});assert.equal(env.prints[0].nodes[0].textContent,'עריכה שנשארת');
});

test('A late request cannot apply after source edits, reset, replacement or changed owner; own incremental changes can checkpoint',()=>{
  const env=environment();assert.equal(typeof env.api?.createWork,'function');let state={sessions:['one','two']};
  const work=env.api.createWork(()=>state);const first=work.start();assert.equal(first.current(),true);
  state.sessions.shift();assert.equal(first.current(),false);assert.throws(()=>first.assertCurrent(),/השתנה|בוטלה/);
  const second=work.start();assert.equal(first.signal.aborted,true);assert.equal(first.owns(),false);
  assert.equal(second.current(),true);state.sessions.push('own AI merge');second.checkpoint();assert.equal(second.current(),true);
  work.invalidate();assert.equal(second.signal.aborted,true);assert.equal(second.current(),false);
  const third=work.start();env.setOwner('B');assert.equal(third.current(),false);assert.throws(()=>third.checkpoint(),/כניסה|בוטלה/);
});
