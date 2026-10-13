// Development QA only: real route handler and UI, isolated in-memory storage,
// synthetic model responses. Never imports production credentials or data.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { once } from 'node:events';
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
const provider={id:'synthetic-qa',model:'synthetic-qa',async complete({system,messages}){
  calls++;
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
  await page.reload();
  await page.locator('#cc-list button').first().click();
  await page.waitForFunction(()=>document.querySelectorAll('#cc-timeline .cc-entry.draft').length===2);
  results.push('multi-turn continuation + reopening after reload');
  await page.screenshot({path:resolve(out,'communication-desktop.png'),fullPage:true});
  await page.screenshot({path:resolve(out,'communication-desktop-viewport.png')});
  await page.locator('#cc-conversation details').first().evaluate(n=>n.open=true);
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
  await page.locator('#cc-principles').evaluate(n=>n.parentElement.open=true);
  assert.equal(await page.locator('#cc-principles li').count(),18);
  await page.setViewportSize({width:390,height:844});
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
  await writeFile(resolve(out,'browser-results.json'),JSON.stringify({passed:true,model:'synthetic-qa (not live AI)',storage:'isolated memory (not live Supabase)',results,calls,pageErrors:errors},null,2));
  console.log(JSON.stringify({passed:true,results,calls,output:out}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
