// Development QA only: real route handler and UI, isolated in-memory storage,
// synthetic model responses. Never imports production credentials or data.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createHmac,randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { handleAccess } from './lib/access.mjs';
import { handleCommunication } from './lib/communication-continuity.mjs';

const app = fileURLToPath(new URL('../app/', import.meta.url));
const out = resolve(process.argv[2] || 'work/communication-browser-check');
await mkdir(out, {recursive:true});
const data = new Map(Object.entries({ institutions:[{name:'QA School',active:true}],
  'modules:QA School':{writer:true}, 'code:QAONE':{code:'QA-ONE',kind:'staff',inst:'QA School',perms:['writer']},
  'code:QATWO':{code:'QA-TWO',kind:'staff',inst:'QA School',perms:['writer']} }));
const copy = value => value == null ? null : structuredClone(value);
const store = { async get(k){return copy(data.get(k));},async set(k,v){data.set(k,copy(v));},
  async list(prefix){return [...data].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>({key,value:copy(value)}));},
  async compareSet(k,expected,value){const v=data.get(k);if(expected===null?!!v:!v||v.revision!==expected)return false;data.set(k,copy(value));return true;} };
const [,one] = await handleAccess(store,{action:'login',kind:'code',secret:'QA-ONE'});
const [,two] = await handleAccess(store,{action:'login',kind:'code',secret:'QA-TWO'});
assert.ok(one.token && two.token);
const fields=['facts','interpretations','control','influence','outsideControl','responsibility','resources','barriers','agreements','openQuestions','followUp'];
let calls = 0;
const providerInputs=[];
const provider={id:'synthetic-qa',model:'synthetic-qa',async complete({system,messages}){
  calls++;
  providerInputs.push(JSON.parse(messages[0].content));
  const analysis=Object.fromEntries(fields.map(k=>[k,[]]));
  analysis.facts=['התקבלה פנייה.'];analysis.openQuestions=['איזה מועד מתאים לשיחה?'];
  return {text:JSON.stringify({message:'תודה על הפנייה. אפשר לברר יחד מה קרה ולתאם שיחה בזמן שנוח לכם.',why:'הכרה בפנייה ושאלה שמקדמת בירור.',next:'לבחור זמן מתאים לשיחה.',clarification:'',analysis}),raw:{model:'synthetic-qa'}};
}};
const server=createServer(async(req,res)=>{
  try{
    if(req.method==='POST'&&req.url==='/api/communication-continuity'){
      let raw='';for await(const part of req)raw+=part;
      const [status,body]=await handleCommunication(store,JSON.parse(raw),{providerFactory:()=>provider});
      res.writeHead(status,{'content-type':'application/json','cache-control':'private,no-store'});return res.end(JSON.stringify(body));
    }
    if(req.url==='/qa-demo.html') {
      res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
      return res.end('<!doctype html><script>window.demoMessages=[];addEventListener("message",event=>demoMessages.push(event.data));</script><iframe src="/communication-continuity.html?demolab=1"></iframe>');
    }
    const path=resolve(app,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!path.startsWith(app)) {res.writeHead(403);return res.end();}
    const content=await readFile(path);
    const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});res.end(content);
  }catch{res.writeHead(500);res.end('QA fixture failure');}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const url='http://127.0.0.1:'+server.address().port;
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
let browser;
const results=[];
try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'he-IL'});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await context.addInitScript(token=>{
    sessionStorage.setItem('sbe.session.homeUrl','home.html');sessionStorage.setItem('sbe.session.token',token);
    sessionStorage.setItem('sbe.session.perms','["writer"]');sessionStorage.setItem('sbe.session.info','{"kind":"staff"}');
  },one.token);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(url+'/communication-continuity.html');
  await page.locator('#cc-text').fill('זו הודעה שקיבלתי מהורה: אשמח להבין מה קרה בכיתה. אפשר לשוחח?');
  const instruction='המטרה שלי היא לברר עובדות לפני החלטה.';
  await page.locator('#cc-instruction').evaluate(n=>n.closest('details').open=true);
  await page.locator('#cc-instruction').fill(instruction);
  await page.locator('#cc-main-actions button[data-mode="suggest"]').click();
  await page.locator('#cc-timeline .cc-entry.draft').waitFor({timeout:20000});
  results.push('create + received input + generated draft');
  const editor=page.locator('#cc-timeline textarea').first();
  await editor.fill('תודה על הפנייה. נוכל לברר יחד מה קרה ולתאם שיחה.');
  await page.getByRole('button',{name:'שמירת העריכה',exact:true}).first().click();
  await page.getByRole('button',{name:'שלחתי את ההודעה',exact:true}).first().click();
  await page.locator('#cc-timeline .cc-entry.sent').waitFor();
  results.push('draft edit + explicit sent snapshot');
  await page.locator('#cc-text').fill('תודה, אפשר לדבר מחר.');
  await page.locator('#cc-main-actions button[data-mode="continue"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#cc-timeline .cc-entry.draft').length===2);
  assert.ok(providerInputs.at(-1).history.some(e=>e.kind==='received'&&e.text==='תודה, אפשר לדבר מחר.'));
  await page.reload();
  await page.locator('#cc-list button').first().click();
  await page.waitForFunction(()=>document.querySelectorAll('#cc-timeline .cc-entry.draft').length===2);
  assert.ok((await page.locator('#cc-timeline').innerText()).includes('תודה, אפשר לדבר מחר.'));
  assert.equal(await page.locator('#cc-instruction').inputValue(),instruction);
  assert.ok(providerInputs.at(-1).history.some(e=>e.kind==='note'&&e.notePurpose==='instruction'&&e.text===instruction));
  results.push('multi-turn continuation + reopening after reload');
  results.push('educator instruction persists separately and restores after reload');
  const shorten=page.locator('button[data-revision-style="shorter"]').first();
  await shorten.evaluate(b=>b.closest('details').open=true);
  await shorten.click();
  await page.waitForFunction(()=>document.querySelectorAll('#cc-timeline .cc-entry.draft').length===3);
  assert.equal(await page.locator('#cc-timeline .cc-entry.sent').count(),1);
  results.push('AI revision keeps prior drafts and sent snapshot');
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:resolve(out,'communication-desktop.png'),fullPage:true});
  await page.screenshot({path:resolve(out,'communication-desktop-viewport.png')});
  await page.locator('#cc-conversation details').first().evaluate(n=>n.open=true);
  await page.locator('#cc-rename').fill('שם שטרם נשמר');
  const saved=[...data.values()].find(v=>Array.isArray(v?.entries)&&v.entries.some(e=>e.kind==='received'));
  const remote=await handleCommunication(store,{token:one.token,action:'update',id:saved.id,requestId:randomUUID(),expectedRevision:saved.revision,status:'awaiting_response',audience:'תלמידים'});
  assert.equal(remote[0],200);
  await page.locator('#cc-update').click();
  await page.locator('#cc-conflict-refresh').waitFor();
  await page.locator('#cc-conflict-refresh').click();
  await page.waitForFunction(()=>document.querySelector('#cc-status').value==='awaiting_response');
  assert.equal(await page.locator('#cc-rename').inputValue(),'שם שטרם נשמר');
  assert.equal(await page.locator('#cc-audience').inputValue(),'תלמידים');
  results.push('conflict refresh retains local title and follows clean remote metadata');
  await page.locator('#cc-rename').fill('שיחה עם הורה לבדיקה');
  await page.locator('#cc-update').click();
  await page.waitForFunction(()=>document.querySelector('#cc-title').textContent==='שיחה עם הורה לבדיקה');
  await page.locator('#cc-archive').click();
  await page.waitForFunction(()=>document.querySelector('#cc-status-badge').textContent==='בארכיון');
  await page.locator('#cc-reopen').click();
  await page.waitForFunction(()=>document.querySelector('#cc-status-badge').textContent==='פעיל');
  results.push('rename + archive + reopen');
  const download=page.waitForEvent('download');await page.locator('#cc-export-json').click();
  const exportFile=await download;await exportFile.saveAs(resolve(out,'synthetic-conversation-export.json'));
  const json=JSON.parse(await readFile(resolve(out,'synthetic-conversation-export.json'),'utf8'));
  assert.ok(json.entries?.length||json.conversation?.entries?.length);
  results.push('JSON export includes raw history');
  const textDownload=page.waitForEvent('download');await page.locator('#cc-export-text').click();
  await (await textDownload).saveAs(resolve(out,'synthetic-conversation-export.txt'));
  assert.ok((await readFile(resolve(out,'synthetic-conversation-export.txt'),'utf8')).includes('תודה, אפשר לדבר מחר.'));
  results.push('text export preserves received reply');
  await page.locator('#cc-export-pdf').click();
  const preview=page.getByRole('dialog',{name:'תצוגה מקדימה להדפסה'});
  await preview.waitFor();
  const printFrame=preview.frameLocator('iframe');
  await printFrame.locator('body').waitFor();
  assert.ok((await printFrame.locator('body').innerText()).includes('שיחה עם הורה לבדיקה'));
  assert.equal(await printFrame.locator('textarea,[contenteditable]').count(),0);
  assert.equal(await printFrame.getByRole('button',{name:'הדפסה / שמירה כ-PDF',exact:true}).count(),1);
  const frame=await (await preview.locator('iframe').elementHandle()).contentFrame();
  const printPage=await context.newPage();
  await printPage.setContent(await frame.content());
  await printPage.screenshot({path:resolve(out,'communication-print-preview.png'),fullPage:true});
  await printPage.close();
  await page.getByRole('button',{name:'סגירת התצוגה',exact:true}).click();
  results.push('styled print preview contains conversation and no edit controls');
  let drop=true;
  await page.route('**/api/communication-continuity',async route=>{
    if(drop&&route.request().postDataJSON().action==='append') {drop=false;await route.fetch();await route.abort('failed');}
    else await route.continue();
  });
  await page.locator('#cc-text').fill('הודעת בדיקה לתגובה שאבדה בדרך');
  await page.locator('#cc-save-input').click();
  await page.locator('#cc-retry').waitFor();
  await page.locator('#cc-retry').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.cc-entry.received .cc-entry-text')].filter(n=>n.textContent==='הודעת בדיקה לתגובה שאבדה בדרך').length===1);
  results.push('dropped commit response retries without duplicate received message');
  await page.locator('#cc-file').evaluate(n=>n.closest('details').open=true);
  await page.locator('#cc-file').setInputFiles({name:'בדיקה.txt',mimeType:'text/plain',buffer:Buffer.from('טקסט מלא מקובץ בדיקה בעברית')});
  await page.waitForFunction(()=>document.querySelector('#cc-file-status').textContent.includes('חולץ ונשמר'));
  assert.ok((await page.locator('#cc-timeline').innerText()).includes('טקסט מלא מקובץ בדיקה בעברית'));
  const docx=await page.evaluate(async()=>{
    const zip=new JSZip();zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>טקסט מלא ממסמך Word לבדיקה</w:t></w:r></w:p></w:body></w:document>');
    return [...await zip.generateAsync({type:'uint8array'})];
  });
  await page.locator('#cc-file').setInputFiles({name:'בדיקה.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(docx)});
  await page.waitForFunction(()=>[...document.querySelectorAll('.cc-entry.received .cc-entry-text')].some(n=>n.textContent==='טקסט מלא ממסמך Word לבדיקה'));
  results.push('full Hebrew TXT and DOCX uploads persist received text');
  await page.locator('#cc-principles').evaluate(n=>n.parentElement.open=true);
  assert.equal(await page.locator('#cc-principles li').count(),18);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:resolve(out,'communication-mobile.png'),fullPage:true});
  await page.screenshot({path:resolve(out,'communication-mobile-viewport.png')});
  results.push('18 principles + mobile without overflow');
  const denied=await context.request.post(url+'/api/communication-continuity',{data:{action:'get',token:two.token,id:json.id||json.conversation.id}});
  assert.equal(denied.status(),404);results.push('second user cannot access first user conversation');
  await page.locator('#cc-delete').click();
  await page.waitForFunction(()=>document.querySelector('#cc-conversation').hidden);
  const [,list]=await handleCommunication(store,{action:'list',token:one.token});assert.equal(list.conversations.length,0);
  results.push('explicit delete removes private content');
  assert.deepEqual(errors,[]);
  const secret=data.get('token-secret').secret;
  const actor=Buffer.from(JSON.stringify({k:'sys',exp:Date.now()+3600000})).toString('base64url');
  const sysToken=actor+'.'+createHmac('sha256',secret).update(actor).digest('base64url');
  const [,privateSys]=await handleCommunication(store,{token:sysToken,action:'create',id:randomUUID(),requestId:randomUUID(),expectedRevision:null,title:'existing private sentinel'});
  await handleCommunication(store,{token:sysToken,action:'append',id:privateSys.conversation.id,requestId:randomUUID(),expectedRevision:privateSys.conversation.revision,kind:'received',text:'private-existing-sentinel'});
  const demoContext=await browser.newContext();
  await demoContext.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await demoContext.addInitScript(token=>{
    sessionStorage.setItem('sbe.session.homeUrl','admin.html?role=sys');sessionStorage.setItem('sbe.session.token',token);
    sessionStorage.setItem('sbe.session.perms','["*"]');sessionStorage.setItem('sbe.session.info','{"kind":"sys"}');
  },sysToken);
  const demoPage=await demoContext.newPage();await demoPage.goto(url+'/qa-demo.html');
  await demoPage.waitForFunction(()=>window.demoMessages.some(m=>m.status==='done'||m.status==='error'),{},{timeout:25000});
  const demo=await demoPage.evaluate(()=>window.demoMessages.find(m=>m.status==='done'||m.status==='error'));
  assert.equal(demo.status,'done',JSON.stringify(demo));
  assert.equal(demo.items[0].tool,'communication-continuity');
  assert.ok(demo.items[0].html.includes('דוגמה בדויה'));
  assert.ok(demo.items[0].html.includes('תודה על הפנייה'));
  assert.ok(!demo.items[0].html.includes('private-existing-sentinel'));
  assert.ok(!demo.items[0].html.includes('existing private sentinel'));
  await demoContext.close();
  results.push('administrator demo captures only new synthetic conversation, never existing private history');
  await writeFile(resolve(out,'browser-results.json'),JSON.stringify({passed:true,model:'synthetic-qa (not live AI)',storage:'isolated memory (not live Supabase)',results,calls,pageErrors:errors},null,2));
  console.log(JSON.stringify({passed:true,results,calls,output:out}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
