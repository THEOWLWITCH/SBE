// Synthetic local browser regression: the real date helper and agreement editor.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base=new URL(process.argv[2]);assert.equal(base.hostname,'127.0.0.1');
const out=resolve(process.argv[3]||'../research-plan/guided-u7-date-browser');await mkdir(out,{recursive:true});
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const report={synthetic:true,results:[],pageErrors:[]},tag=Date.now().toString();
const button=(p,n)=>p.getByRole('button',{name:n,exact:true});
const proxy=(p,n)=>p.locator('input.sbe-date[aria-label="'+n+'"]');
const native=(p,n)=>p.locator('input[type=date][aria-label="'+n+'"]');
async function reveal(control){for(const s of await control.locator('xpath=ancestor::details/summary').all())if(!await s.evaluate(n=>n.parentElement.open))await s.click();return control;}
async function rpc(page,action,payload={}){return page.evaluate(async({action,payload})=>{const r=await fetch('/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:sessionStorage.getItem('sbe.session.token'),requestId:crypto.randomUUID(),...payload})});return {status:r.status,data:await r.json()};},{action,payload});}
function pass(name){report.results.push(name);console.log('PASS '+name);}
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1100},locale:'he-IL'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base.origin?r.continue():r.abort());
  const page=await context.newPage(),mutations=[];page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('request',r=>{if(r.method()==='POST'&&r.postDataJSON()?.action==='recordSave')mutations.push(r.postDataJSON());});
  await page.goto(base.origin+'/qa/actor/a');await page.goto(base.origin+'/research-management.html?workspace=1');
  const ownList=await rpc(page,'workspaceList'),own=ownList.data.workspaces.find(w=>w.studyTitle.startsWith('מוכנות משותפת'));assert.ok(own);
  const openOwnFolder=()=>page.locator('section.r-card').filter({has:page.getByRole('heading',{name:own.partnerName,exact:true})}).last().getByRole('button',{name:'פתיחת התיק',exact:true}).click();
  await page.goto(base.origin+'/qa/actor/owner');await page.goto(base.origin+'/research-management.html?workspace=1');await openOwnFolder();
  const prepareResponse=page.waitForResponse(r=>r.request().postDataJSON()?.action==='agreementPrepare');await button(page,'הסכם חדש').click();
  const prepared=await (await prepareResponse).json(),scope={studyId:prepared.record.studyId,partnerId:prepared.record.partnerId};
  const title='בדיקת תאריכים '+tag+' '+width;
  const seeded=await rpc(page,'recordSave',{...scope,recordId:prepared.record.id,expectedRevision:prepared.record.revision,kind:'agreement',data:{...prepared.version.data,title,startDate:'2026-11-12',endDate:'2027-05-31'}});assert.equal(seeded.status,200);
  await page.reload();await openOwnFolder();await button(page,title).click();
  await reveal(proxy(page,'תחילת המחקר'));await proxy(page,'תחילת המחקר').waitFor();mutations.length=0;
  await proxy(page,'תחילת המחקר').fill('31.02.26');await proxy(page,'תחילת המחקר').press('Tab');
  await button(page,'שמירת טיוטה').click();await page.waitForTimeout(1150);
  assert.equal(await proxy(page,'תחילת המחקר').inputValue(),'31.02.26');
  assert.equal(await native(page,'תחילת המחקר').inputValue(),'2026-11-12');
  assert.equal(await proxy(page,'תחילת המחקר').evaluate(n=>n.validity.valid),false,'Impossible visible dates must invalidate the draft');
  assert.match(await page.locator('[role=status]').last().innerText(),/תאריך/);assert.equal(mutations.length,0);
  await button(page,'חזרה לתיק החוקרת').click();assert.equal(await proxy(page,'תחילת המחקר').count(),1);assert.equal(await proxy(page,'תחילת המחקר').evaluate(n=>n===document.activeElement),true);
  await page.getByLabel('כותרת',{exact:true}).fill(title+' מתוקן');await page.waitForTimeout(1250);assert.equal(mutations.length,0,'Invalid date blocks the entire autosave');
  const refreshed=page.waitForResponse(r=>r.request().postDataJSON()?.action==='workspaceList');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;
  await proxy(page,'תחילת המחקר').waitFor({state:'attached'});assert.equal(await proxy(page,'תחילת המחקר').inputValue(),'31.02.26');assert.equal(await proxy(page,'תחילת המחקר').evaluate(n=>n.validity.valid),false);assert.equal(await page.getByLabel('כותרת',{exact:true}).inputValue(),title+' מתוקן');
  await reveal(proxy(page,'תחילת המחקר'));await proxy(page,'תחילת המחקר').fill('13.11.26');await proxy(page,'תחילת המחקר').press('Tab');
  const savedResponse=page.waitForResponse(r=>r.request().postDataJSON()?.action==='recordSave');await button(page,'שמירת טיוטה').click();const saved=await(await savedResponse).json();assert.equal(saved.version.data.startDate,'2026-11-13');assert.equal(saved.version.data.title,title+' מתוקן');assert.equal(mutations.length,1);
  pass(width+': invalid date blocks manual save, navigation and autosave; same-session reauthorization preserves draft; valid correction saves both edits');
  // Actual shared helper, including controls inserted after the page has loaded.
  await page.evaluate(()=>{const host=document.createElement('div');host.id='date-control-regression';host.dir='rtl';for(const mode of ['disabled','readOnly','dynamic']){const n=document.createElement('input');n.type='date';n.dir='rtl';n.id='qa-date-'+mode;n.value='2026-11-12';if(mode!=='dynamic')n[mode]=true;host.append(n);}document.body.append(host);});
  await page.locator('#date-control-regression input.sbe-date').last().waitFor();
  const states=await page.evaluate(()=>{const read=id=>{const n=document.getElementById('qa-date-'+id),p=n.previousElementSibling,b=n.nextElementSibling;return {disabled:p.disabled,readOnly:p.readOnly,calendarDisabled:b.disabled};};return {disabled:read('disabled'),readOnly:read('readOnly')};});
  assert.deepEqual(states,{disabled:{disabled:true,readOnly:false,calendarDisabled:true},readOnly:{disabled:false,readOnly:true,calendarDisabled:true}});
  await page.evaluate(()=>{document.getElementById('qa-date-dynamic').disabled=true;});await page.waitForTimeout(40);
  assert.equal(await page.locator('#qa-date-dynamic').evaluate(n=>n.previousElementSibling.disabled&&n.nextElementSibling.disabled),true);
  await page.evaluate(()=>{document.getElementById('qa-date-dynamic').disabled=false;document.getElementById('qa-date-dynamic').readOnly=true;});await page.waitForTimeout(40);
  assert.equal(await page.locator('#qa-date-dynamic').evaluate(n=>n.previousElementSibling.readOnly&&n.nextElementSibling.disabled),true);
  await page.evaluate(()=>document.getElementById('date-control-regression').remove());
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:resolve(out,'date-'+width+'.png')});pass(width+': disabled/readOnly and dynamic locks mirror native controls; RTL has no overflow');
  await context.close();
 }
 assert.deepEqual(report.pageErrors,[]);
}catch(e){report.failure=e.stack;throw e;}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
