import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../../app/lib/product-doc.js',import.meta.url),'utf8');
function printEnvironment(){
  const written=[],popups=[],elements=[];
  const printWindow={document:{write:html=>written.push(html),close(){}}};
  function element(tag){
    const listeners=new Map();
    const node={tagName:tag.toUpperCase(),style:{},attributes:{},children:[],classList:{remove(){}},
      append(...items){this.children.push(...items);},setAttribute(k,v){this.attributes[k]=v;},
      addEventListener(k,fn){listeners.set(k,fn);},fire(k){listeners.get(k)?.();},
      showModal(){this.open=true;},close(){this.open=false;this.fire('close');},remove(){this.removed=true;}};
    if(tag==='iframe')node.contentWindow=printWindow;
    elements.push(node);return node;
  }
  const context={window:{open:(...args)=>{popups.push(args);return printWindow;}},
    document:{baseURI:'https://example.test/resilience-studio.html',images:[],body:element('body'),createElement:element},URL,Date,alert:message=>assert.fail(message)};
  vm.runInNewContext(source,context);
  const content={cloneNode:()=>({outerHTML:'<article class="session-card">מטרה ותרגול משותף</article>',querySelectorAll:()=>[],removeAttribute(){},classList:{remove(){}}})};
  return {print:context.window.SBE_DOC.print,content,written,popups,elements};
}

test('Shared print retains existing popup callers and their automatic print behavior',()=>{
  const env=printEnvironment();
  env.print({title:'פעילות',node:env.content});
  assert.equal(env.popups.length,1);
  assert.deepEqual(env.popups[0],['','_blank']);
  assert.match(env.written[0],/window.onload=function\(\).*window.print\(\)/);
  assert.match(env.written[0],/<html lang="he" dir="rtl">/);
  assert.match(env.written[0],/@page\{size:A4;margin:18mm 20mm\}/);
});

test('Inline print escapes headings, requires an explicit print gesture, and removes its dialog on close',()=>{
  const env=printEnvironment();
  env.print({title:'<img src=x onerror=alert(1)>',subtitle:'A & "B"',node:env.content,inline:true});
  assert.equal(env.popups.length,0);
  const html=env.written[0],dialog=env.elements.find(x=>x.tagName==='DIALOG');
  assert.equal(dialog.open,true);
  assert.equal(dialog.attributes['aria-label'],'תצוגה מקדימה להדפסה');
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/A &amp; &quot;B&quot;/);
  assert.doesNotMatch(html,/<img src=x|window.onload=/);
  assert.match(html,/onclick="window.print\(\)"/);
  dialog.children[0].fire('click');
  assert.equal(dialog.removed,true);
});
