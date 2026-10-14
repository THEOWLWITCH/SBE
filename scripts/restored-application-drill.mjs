// Run the recovered application with a local synthetic database and AI provider.
// This exercises the recovered source, not a modified production installation.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { scryptSync } from 'node:crypto';
import path from 'node:path';
const option = key => { const index=process.argv.indexOf(key); return index<0?null:process.argv[index+1]; };
const restored=option('--restored'), pgliteModule=option('--pglite-module'), playwrightModule=option('--playwright-module'), reportPath=option('--report'), screenshotDirectory=option('--screenshots');
if (!restored||!pgliteModule||!playwrightModule||!reportPath||!screenshotDirectory) throw Error('Required local restore/runtime/report paths are missing');
for (const key of ['SUPABASE_URL','SUPABASE_SERVICE_KEY','ANTHROPIC_API_KEY','OPENAI_API_KEY','ANTHROPIC_BASE_URL','BE_GOOD_BACKUP_STATUS_FILE']) delete process.env[key];
const tree=path.resolve(restored,'source/security/working-tree');
const {PGlite}=await import(pathToFileURL(path.resolve(pgliteModule)).href);
const require=createRequire(import.meta.url), {chromium}=require(path.resolve(playwrightModule));
const {createPracticeServer}=await import(pathToFileURL(path.join(tree,'harness/practice-server.mjs')).href);
const db=new PGlite();
await db.exec('CREATE TABLE scenarios (id text PRIMARY KEY,institution_id text NOT NULL,name text,scenario_json jsonb,runs integer DEFAULT 0);');
const data=new Map(Object.entries({institutions:[{name:'Synthetic school A',active:true},{name:'Synthetic school B',active:true}],
  'modules:Synthetic school A':{writer:true,fac_trainee:true},'modules:Synthetic school B':{writer:true,fac_trainee:true},
  'code:SYNTHAAA':{kind:'staff',inst:'Synthetic school A',perms:['writer','fac_trainee'],revoked:false},
  'code:SYNTHBBB':{kind:'staff',inst:'Synthetic school B',perms:['writer','fac_trainee'],revoked:false}}));
const salt='isolated-synthetic-salt', password='isolated-synthetic-owner-password';
data.set('pw-sys',{salt,hash:scryptSync(password,salt,32).toString('hex')});
const store={async get(k){return structuredClone(data.get(k)||null);},async set(k,v){data.set(k,structuredClone(v));},async del(k){data.delete(k);},
  async list(prefix){return [...data].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>({key,value:structuredClone(value)}));}};
const startedAt=new Date().toISOString(), started=performance.now(), checks=[];
let browser, api, staticServer, restServer;
const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;};
const stop=server=>server?new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}):Promise.resolve();
try {
  // A loopback REST facade lets the recovered server use its unchanged real
  // Supabase adapter against synthetic PostgreSQL. No provider network is used.
  restServer=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname!=='/rest/v1/scenarios') {res.writeHead(404);return res.end('{}');}
      const filters=[],args=[];
      for(const column of ['id','institution_id']) if(url.searchParams.has(column)) {
        const raw=url.searchParams.get(column);assert.ok(raw.startsWith('eq.'));
        let value=raw.slice(3);if(value.startsWith('"')) value=JSON.parse(value);
        args.push(value);filters.push(column+'=$'+args.length);
      }
      const rows=(await db.query('SELECT * FROM scenarios'+(filters.length?' WHERE '+filters.join(' AND '):'')+' ORDER BY id',args)).rows;
      res.writeHead(200,{'content-type':'application/json','content-range':'0-0/'+rows.length});res.end(JSON.stringify(rows));
    }catch{res.writeHead(500);res.end('{}');}
  });
  const restUrl=await listen(restServer);process.env.SUPABASE_URL=restUrl;process.env.SUPABASE_SERVICE_KEY='synthetic-local-key';
  const syntheticScenario={scenarioName:'תוצר שחזור סינתטי',scenarioSubtitle:'בדיקת רציפות בלבד',characters:{actor:{role:'הורה',nameAndAge:'דמות בדיקה'},trainee:{role:'מורה'}},
    turningPoints:[],endings:['סיום סינתטי'],documents:{actor:{story:['דוגמה סינתטית']},facilitator:{}},sources:[]};
  let providerCalls=0;
  api=createPracticeServer({authStore:store,providerFactory:()=>({async complete(request){providerCalls++;
    return {text:request.prompt?JSON.stringify(syntheticScenario):JSON.stringify({message:'הודעת שחזור סינתטית — אפשר לתאם יחד את הצעד הבא.',used:[],tips:[]}),toolCalls:[]};}}),
    async saveScenarioImpl(scenario,meta){await db.query('INSERT INTO scenarios(id,institution_id,name,scenario_json) VALUES ($1,$2,$3,$4)',[scenario.id,meta.institutionId,scenario.name,JSON.stringify(scenario)]);}});
  const apiUrl=await listen(api);
  const post=async(route,body)=>{const response=await fetch(apiUrl+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  const loginA=await post('/api/access',{action:'login',kind:'code',secret:'SYNTH-AAA'});
  const loginB=await post('/api/access',{action:'login',kind:'code',secret:'SYNTH-BBB'});
  const owner=await post('/api/access',{action:'login',kind:'sys',secret:password});
  assert.equal(loginA.status,200);assert.equal(loginB.status,200);assert.equal(owner.status,200);
  checks.push({name:'login through recovered server with synthetic configured identities',passed:true});
  const created=await post('/api/pipeline',{input:{given:{whatHappened:'בדיקת תרגול סינתטית בלבד'},skills:[],language:'עברית'},async:true,meta:{institutionId:'Synthetic school B'},
    _auth:{token:loginA.body.token,page:'input-screen.html'}});
  assert.equal(created.status,200);assert.ok(created.body.jobId);
  for(let attempt=0;attempt<100;attempt++) {
    if((await db.query('SELECT count(*)::int AS n FROM scenarios')).rows[0].n===1) break;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  const saved=(await db.query('SELECT * FROM scenarios')).rows[0];assert.ok(saved);assert.equal(saved.institution_id,'Synthetic school A');
  const poll=await post('/api/pipeline-status',{jobId:created.body.jobId,_auth:{token:loginA.body.token,page:'input-screen.html'}});
  assert.equal(poll.body.status,'done');assert.equal(poll.body.scenario.name,'תוצר שחזור סינתטי');
  assert.equal((await post('/api/scenarios',{action:'get',id:saved.id,token:loginB.body.token})).status,404);
  assert.equal((await post('/api/scenarios',{action:'get',id:saved.id,token:loginA.body.token})).body.scenario.name,'תוצר שחזור סינתטי');
  checks.push({name:'pipeline product saved into synthetic SQL, then read through recovered API with cross-school denial',passed:true});
  const practice=await post('/api/character-turn',{system:'תרגול סינתטי',messages:[{role:'user',content:'בדיקת שיחה'}],_auth:{token:loginA.body.token,page:'practice.html'}});
  assert.equal(practice.status,200);assert.ok(practice.body.text);
  checks.push({name:'authorized practice request through recovered AI engine using synthetic provider',passed:true});
  staticServer=createServer(async(req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(tree,'app','.'+name);
    if(!file.startsWith(path.join(tree,'app')+path.sep)){res.writeHead(403);return res.end();}
    try {const bytes=await readFile(file);res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html;charset=utf-8'});res.end(bytes);}
    catch{res.writeHead(404);res.end();}
  });
  const uiUrl=await listen(staticServer);browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1366,height:900}});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname.startsWith('/api/')){
      const response=await fetch(apiUrl+url.pathname,{method:request.method(),headers:{'content-type':'application/json'},body:request.postData()||undefined});
      return route.fulfill({status:response.status,headers:{'content-type':'application/json'},body:await response.text()});
    }
    if(url.origin===uiUrl)return route.continue();return route.abort();
  });
  await context.addInitScript(({token,perms})=>{if(!sessionStorage.getItem('sbe.session.token')){sessionStorage.setItem('sbe.session.token',token);sessionStorage.setItem('sbe.session.homeUrl','home.html');sessionStorage.setItem('sbe.session.perms',JSON.stringify(perms));}},
    {token:loginA.body.token,perms:['writer','fac_trainee']});
  const page=await context.newPage();await page.goto(uiUrl+'/message-writer.html');
  await page.locator('#rw-text').fill('להזמין את הצוות לתכנון משותף של הפעילות בשבוע הבא, עם זמן לשאלות.');await page.locator('#rw-go').click();
  await page.locator('#rw-out').getByText('הודעת שחזור סינתטית',{exact:false}).waitFor({timeout:15000});
  assert.ok(await page.locator('#rw-out').innerText());
  await mkdir(screenshotDirectory,{recursive:true});await page.screenshot({path:path.join(screenshotDirectory,'restored-writer-desktop.png'),fullPage:true});
  checks.push({name:'recovered Hebrew writing interface generates and displays synthetic product',passed:true});
  await page.goto(uiUrl+'/search.html');await page.locator('.row').first().waitFor({timeout:10000});
  assert.ok((await page.locator('body').innerText()).includes('תוצר שחזור סינתטי'));
  checks.push({name:'saved synthetic product displayed in recovered institution library',passed:true});
  await page.evaluate(token=>{sessionStorage.setItem('sbe.session.token',token);sessionStorage.setItem('sbe.session.homeUrl','admin.html?role=sys');},owner.body.token);
  await page.goto(uiUrl+'/admin.html?role=sys');await page.getByRole('button',{name:'גיבוי, שחזור ורציפות פעילות',exact:true}).first().click();
  await page.getByText('מערך הגיבוי טרם חובר',{exact:true}).waitFor({timeout:10000});
  assert.equal(await page.locator('#panels section').evaluate(el=>getComputedStyle(el).direction),'rtl');
  await page.screenshot({path:path.join(screenshotDirectory,'backup-monitor-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(screenshotDirectory,'backup-monitor-mobile.png'),fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
  checks.push({name:'recovered owner-only backup dashboard renders truthful not-configured status in RTL desktop/mobile without horizontal overflow',passed:true});
  await context.close();
  const report={ok:true,exercise:'recovered-application-synthetic-drill',startedAt,completedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-started),
    source:'decrypted-recovered-security-working-tree',providerCalls,realUserDataAccessed:false,liveServicesUsed:false,checks,
    limitations:['Synthetic provider proves workflow, not AI quality.','Local SQL/facade is not a hosted Supabase restoration.','External independent destination/key escrow not activated.']};
  await writeFile(reportPath,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify(report,null,2));
} finally {await browser?.close();await stop(staticServer);await stop(api);await stop(restServer);await db.close();delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_KEY;}
