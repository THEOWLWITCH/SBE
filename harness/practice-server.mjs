#!/usr/bin/env node
// Shared authenticated model boundary. Importing this module never opens a port.
import {createServer} from 'node:http';
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {getProvider, assertCompletionResult,applyProductPolicy} from './lib/providers.mjs';
import {runPipeline} from './lib/pipeline.mjs';
import {toScenario} from './lib/to-scenario.mjs';
import {handleAccess, supabaseStore, resolvePrincipal, reserveAIUsage, settleAIUsage} from './lib/access.mjs';
import {handleStudio} from './lib/studio.mjs';
import {handleArtifacts,artifactReviewRunId} from './lib/activity-artifact.mjs';
import {completionUsageCharge} from './lib/token-budget.mjs';

const AI_PERMS = ['fac_trainee','fac_parent','fac_youth','practice','conv','activity','academic','resilience','leadership','practi','writer','studio','nana'];
const STUDIO_PERMS = ['studio'];
const CORS = [...new Set([...(process.env.CORS_ORIGIN || '').split(',').map(s=>s.trim().replace(/\/$/, '')).filter(Boolean),
  'https://be-good.co.il','https://www.be-good.co.il','https://s-b-e.netlify.app'])];
const BOOT = randomUUID(), TTL = 3 * 3600000;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const failure = (message,status=400) => Object.assign(new Error(message),{status});

export function approvedSources() {
  const sandbox = {window:{}};
  runInNewContext(readFileSync(new URL('../app/lib/resilience-advisor-sources.js',import.meta.url),'utf8'),sandbox,{timeout:1000});
  return sandbox.window.SBE_ADVISOR_SOURCES.list.filter(s=>!s.hidden && s.url?.startsWith('https://'))
    .map(s=>({sourceId:s.k,title:s.apa,citation:s.apa,url:s.url,version:s.version || 'unversioned',approved:true,hidden:false}));
}

function requestBudget(request,attempts=2) {
  request={...request,system:applyProductPolicy(request.system || request.instructions)};
  const maxTokens=request.maxTokens ?? request.max_output_tokens ?? 220;
  const {signal,...input}=request;
  return attempts*(Buffer.byteLength(JSON.stringify(input))+maxTokens+2048);
}

function boundedProvider(provider,budget,maxAttempts,assertCurrent) {
  let reserved=0;
  return {...provider,async complete(request) {
    await assertCurrent();
    if(maxAttempts)request={...request,maxAttempts};
    const attempts=request.maxAttempts ?? 2;
    const amount=requestBudget(request,attempts);
    if(reserved+amount>budget) throw failure('generation budget exceeded',413);
    reserved+=amount;
    const result=await provider.complete({...request,beforeAttempt:assertCurrent});
    await assertCurrent();
    // Failed attempts retain their reservation. Multi-attempt adapters report
    // final-attempt usage only, so they cannot safely discount earlier attempts.
    if(result?.status==='completed') {
      const charge=completionUsageCharge(result.usage,{reservation:amount,
        maxOutputTokens:request.maxTokens ?? request.max_output_tokens ?? 220,attempts});
      if(charge===null)throw failure('invalid generation usage',413);
      reserved+=charge-amount;
      if(reserved>budget)throw failure('generation budget exceeded',413);
    }
    return result;
  }};
}

async function persistScenario(scenario,principal,store) {
  // A generated candidate has no publication approval. Keep it out of the
  // legacy shared scenarios table and its separately managed RLS policies.
  const key='sd:'+hash(principal.ownerId)+':'+scenario.id;
  const row={ownerId:principal.ownerId,tenantId:principal.tenantId,status:'draft',scenario};
  const result=await store.putIfAbsent({key,value:row});
  if(!result.created && hash(result.value)!==hash(row)) throw failure('scenario conflict',409);
}

function send(req,res,status,body) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8',
    'access-control-allow-origin':CORS.includes(req.headers.origin)?req.headers.origin:CORS[0],vary:'origin',
    'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, authorization, x-sbe-permission',
    'cache-control':'no-store'});
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw='',length=0;
  req.setEncoding('utf8');
  for await (const chunk of req) { length+=Buffer.byteLength(chunk); if(length>2000000) throw failure('request too large',413); raw+=chunk; }
  try {const value=JSON.parse(raw);if(!value || typeof value!=='object' || Array.isArray(value)) throw Error();return value;}
  catch {throw failure('invalid JSON');}
}

function allowed(actor,path,permission) {
  if (actor.k==='sys') return true;
  const wanted=path==='/api/pipeline'?AI_PERMS.filter(p=>p.startsWith('fac_'))
    : path==='/api/character-turn'?['practice','fac_trainee','fac_parent','fac_youth']
    : path==='/api/studio'?STUDIO_PERMS:AI_PERMS;
  return permission?wanted.includes(permission) && actor.permissions.includes(permission):wanted.some(p=>actor.permissions.includes(p));
}

export function createPracticeServer({store,providerFactory=()=>getProvider(process.env.PROVIDER || 'anthropic'),
  saveScenario=persistScenario,clock=Date.now,jobTtlMs=TTL,sourceLibrary=approvedSources(),studioHandler=handleStudio,
  teamEnabled=process.env.AGENT_TEAM_ENABLED==='true'}={}) {
  const getStore=()=>store || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY?supabaseStore(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY):null);
  const controllers=new Map(),running=new Set();
  async function transition(st,key,next) {
    const prior=await st.get(key);
    if (!prior || prior.status!=='running' || prior.expiresAt<=clock()) return false;
    return (await st.compareAndSet({key,expected:prior,value:{...prior,...next}})).updated;
  }
  async function finishJob(st,key,actor,next,outcome) {
    let lastError;
    for(let attempt=0;attempt<3;attempt++) {
      try {
        const prior=await st.get(key);
        if(!prior || prior.status!=='running') return false;
        const result=await st.finalizeAIJob({key,expected:prior,value:{...prior,...next},
          principal:{ownerId:actor.ownerId,tenantId:actor.tenantId},requestId:prior.requestId,outcome});
        if(result.updated) return true;
      } catch(error) {lastError=error;}
    }
    throw lastError || failure('job conflict',409);
  }
  async function execute(st,key,job,actor,payload,path,token) {
    const controller=new AbortController();controllers.set(key,controller);
    const timer=setTimeout(()=>controller.abort(),Math.min(jobTtlMs,45*60000));timer.unref?.();
    const heartbeat=setInterval(()=>transition(st,key,{leaseUntil:clock()+90000}).catch(()=>controller.abort()),30000);
    heartbeat.unref?.();
    let committed=false;
    const assertCurrent=async()=>{
      const [live,current]=await Promise.all([resolvePrincipal(st,token),st.get(key)]);
      if(controller.signal.aborted||!live||live.ownerId!==actor.ownerId||live.tenantId!==actor.tenantId
        ||!allowed(live,path,payload.permission)||current?.status!=='running'||current.expiresAt<=clock())
        throw Object.assign(failure('access ended or job stopped',403),{code:'access_denied'});
    };
    try {
      let output;
      const provider=path==='/api/studio'?null:boundedProvider(providerFactory(),job.tokenBudget,path==='/api/pipeline'?1:undefined,assertCurrent);
      if(path==='/api/artifacts') {
        const [status,result]=await handleArtifacts(st,actor,payload,{provider,sourceLibrary,teamEnabled,signal:controller.signal,clock,jobKey:key,assertCurrent});
        if(status!==200) throw Object.assign(failure(result.error || 'artifact review failed',status),{code:result.code});
        if(!['complete','partial','fallback'].includes(result.review?.status) || !result.review.proposal) throw failure('artifact review failed',422);
        output=result;
      } else if(path==='/api/studio') {
        let spent=0;
        const fetchImpl=async(url,options)=>{
          await assertCurrent();
          const request=JSON.parse(options.body),amount=requestBudget(request,1);
          if(spent+amount>job.tokenBudget)throw failure('generation budget exceeded',413);
          spent+=amount;const response=await fetch(url,options),readJson=response.json.bind(response);
          response.json=async()=>{const value=await readJson();await assertCurrent();return value;};return response;
        };
        const [status,result]=await studioHandler(st,{...payload,token,async:false},{signal:controller.signal,fetchImpl});
        if(status!==200) throw Object.assign(failure(result.error || 'studio failed',status),{result});
        output=result;
      } else if(path==='/api/pipeline') {
        const meta={...payload.meta,id:randomUUID(),institutionId:actor.tenantId};
        const out=await runPipeline(payload.input,provider,{sourceLibrary,maxTokens:32000,signal:controller.signal,
          onStage:async(stage,state)=>{try {const prior=await st.get(key);if(prior?.status==='running') await transition(st,key,{stages:{...prior.stages,[stage]:state}});} catch {controller.abort();}}});
        const scenario=toScenario(out,{input:payload.input,meta,sourceLibrary});
        scenario._generation={pipelineOutput:out,context:payload.input};
        output={scenario,usage:out.usage,_ms:out._ms};
      } else {
        const result=assertCompletionResult(await provider.complete({...payload,variation:'medium',signal:controller.signal}));
        output={text:result.text || '',toolCalls:result.toolCalls || [],usage:result.usage};
      }
      const live=await resolvePrincipal(st,token),current=await st.get(key);
      if(controller.signal.aborted || !live || live.ownerId!==actor.ownerId || !allowed(live,path,payload.permission)
        || current?.status!=='running' || current.expiresAt<=clock()) throw failure('request cancelled or access ended',403);
      if(output.scenario) await saveScenario(output.scenario,actor,st);
      committed=await finishJob(st,key,actor,{status:'done',output},'commit');
    } catch(error) {
      controller.abort();
      await finishJob(st,key,actor,{status:'error',error:'לא ניתן להשלים את הבקשה. העבודה הקודמת נשמרה.',errorCode:error.code || 'generation_failed',
        httpStatus:error.status || 503,...(path==='/api/studio' && error.result?{failureOutput:error.result}:{})},'release').catch(()=>{});
      if(!committed) await settleAIUsage(st,actor,{requestId:job.requestId,outcome:'release'}).catch(()=>{});
    } finally {clearTimeout(timer);clearInterval(heartbeat);controllers.delete(key);}
  }
  const server=createServer(async(req,res)=>{
    try {
      if(req.method==='OPTIONS') return send(req,res,204,{});
      if(req.method==='GET' && req.url==='/health') return send(req,res,200,{ok:true,hasSupabase:!!getStore(),
        hasKey:!!process.env[(process.env.PROVIDER || 'anthropic')==='openai'?'OPENAI_API_KEY':'ANTHROPIC_API_KEY'],agentTeamEnabled:teamEnabled});
      const paths=['/api/access','/api/artifacts','/api/studio','/api/complete','/api/character-turn','/api/pipeline','/api/pipeline-status','/api/pipeline-cancel'];
      if(req.method!=='POST' || !paths.includes(req.url)) return send(req,res,404,{error:'נתיב לא נמצא.'});
      const payload=await readBody(req),st=getStore();
      if(!st) return send(req,res,503,{error:'storage unavailable'});
      if(req.url==='/api/access') {const [status,out]=await handleAccess(st,payload);return send(req,res,status,out);}
      const token=String(req.headers.authorization || '').replace(/^Bearer\s+/i,'') || payload.token;
      const actor=await resolvePrincipal(st,token),permission=req.headers['x-sbe-permission'] || payload.permission;
      if(!actor || !allowed(actor,req.url,permission)) return send(req,res,403,{error:'נדרשת כניסה עם הרשאה פעילה.',code:'access_denied'});
      if(req.url==='/api/pipeline-status' || req.url==='/api/pipeline-cancel' || (req.url==='/api/studio' && payload.action==='status')) {
        const key='pj:'+String(payload.jobId || ''),job=await st.get(key);
        if(!job || job.ownerId!==actor.ownerId || job.tenantId!==actor.tenantId) return send(req,res,404,{status:'unknown'});
        if(!allowed(actor,job.path,job.permission)) return send(req,res,403,{error:'אין הרשאה פעילה לעבודה.'});
        if(job.expiresAt<=clock()) {await finishJob(st,key,actor,{status:'expired'},'release');return send(req,res,410,{status:'expired'});}
        if(req.url==='/api/pipeline-cancel') {
          const cancelled=await finishJob(st,key,actor,{status:'cancelled'},'release');controllers.get(key)?.abort();
          return send(req,res,200,{status:cancelled?'cancelled':job.status});
        }
        if(job.status==='running' && (job.boot!==BOOT || !controllers.has(key)) && job.leaseUntil<=clock()) {
          await finishJob(st,key,actor,{status:'lost'},'release');
          return send(req,res,200,{status:'lost'});
        }
        if(job.path==='/api/studio' && ['done','error'].includes(job.status)) return send(req,res,200,{status:'done',
          httpStatus:job.status==='done'?200:(job.httpStatus || 503),result:job.status==='done'?job.output:
            (job.failureOutput || {error:job.error,code:job.errorCode})});
        return send(req,res,200,{status:job.status,stages:job.stages,elapsed:Math.round((clock()-job.t0)/1000),
          ...(job.status==='done'?job.output:{}),...(job.status==='error'?{error:job.error,code:job.errorCode}:{})});
      }
      if(req.url==='/api/studio' && ['authorize','mapping'].includes(payload.action)) {
        const [status,out]=await studioHandler(st,{...payload,token});return send(req,res,status,out);
      }
      if(req.url==='/api/artifacts' && payload.action!=='review') {
        const [status,out]=await handleArtifacts(st,actor,payload,{sourceLibrary,teamEnabled,clock});
        return send(req,res,status,out);
      }
      if(req.url==='/api/pipeline' && !payload.input?.given) return send(req,res,400,{error:'חסר input.given.'});
      if(!['/api/pipeline','/api/studio','/api/artifacts'].includes(req.url) && (!Array.isArray(payload.messages) || !payload.messages.length))
        return send(req,res,400,{error:'נדרשות הודעות למודל.'});
      const maxTokens=payload.maxTokens ?? 220;
      if(!Number.isInteger(maxTokens) || maxTokens<1 || maxTokens>32000) return send(req,res,400,{error:'תקרת הפלט צריכה להיות בין 1 ל־32000.'});
      const requestId=payload.requestId || randomUUID();
      if(typeof requestId!=='string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) return send(req,res,400,{error:'מזהה בקשה לא תקין.'});
      const input={...payload,maxTokens,permission};
      for(const field of ['token','async','requestId','sourceLibrary']) delete input[field];
      if(req.url==='/api/artifacts')input.idempotencyKey ||= requestId;
      const requestHash=hash({path:req.url,input}),jobId=hash([actor.ownerId,actor.tenantId,req.url,requestId]).slice(0,32),key='pj:'+jobId;
      if(!st.putIfAbsent || !st.compareAndSet || !st.finalizeAIJob) return send(req,res,503,{error:'נדרשת תשתית אחסון אטומית.'});
      const tokenBudget=req.url==='/api/pipeline'?256000:req.url==='/api/studio'?128000:req.url==='/api/artifacts'?100000:requestBudget({...input,variation:'medium'});
      if(tokenBudget>512000)return send(req,res,413,{error:'הקלט גדול מדי לתקציב הבקשה.'});
      const usage=await reserveAIUsage(st,actor,{requestId,requestHash,maxTokens,tokenBudget});
      if(usage.state!=='reserved') {
        const existing=await st.get(key);
        if(!existing || existing.requestHash!==requestHash)return send(req,res,409,{error:'הבקשה הקודמת הסתיימה. נסי בקשה חדשה.',code:'reservation_closed'});
        if(payload.async)return send(req,res,200,{jobId});
        return send(req,res,existing.status==='done'?200:409,existing.status==='done'?existing.output:{error:existing.error || 'הבקשה הקודמת הסתיימה.'});
      }
      const record={ownerId:actor.ownerId,tenantId:actor.tenantId,permission,path:req.url,requestId,requestHash,
        ...(req.url==='/api/artifacts'?{artifactId:input.artifactId,baseVersion:input.expectedVersion,
          reviewRunId:artifactReviewRunId(input.artifactId,input.expectedVersion,input.idempotencyKey)}:{}),
        tokenBudget,status:'running',stages:{},t0:clock(),expiresAt:clock()+jobTtlMs,leaseUntil:clock()+90000,boot:BOOT};
      const claim=await st.putIfAbsent({key,value:record});
      if(!claim.created && claim.value.requestHash!==requestHash) return send(req,res,409,{error:'מזהה הבקשה כבר שימש לתוכן אחר.'});
      if(claim.created) {const task=execute(st,key,record,actor,input,req.url,token);running.add(task);task.finally(()=>running.delete(task));}
      if(payload.async) return send(req,res,200,{jobId});
      while(!res.destroyed) {
        const job=await st.get(key);
        if(job.status!=='running') return send(req,res,job.status==='done'?200:422,job.status==='done'?job.output:{error:job.error || 'הבקשה נעצרה.'});
        await new Promise(resolve=>setTimeout(resolve,100));
      }
    } catch(error) {if(!res.headersSent && !res.destroyed) send(req,res,error.status || 503,{error:error.status===400?error.message:'לא ניתן להשלים את הבקשה.',code:error.code || 'request_failed'});}
  });
  server.requestTimeout=60000;server.headersTimeout=30000;
  server.on('close',()=>{for(const controller of controllers.values()) controller.abort();});
  server.waitForJobs=()=>Promise.allSettled([...running]);
  return server;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const index=process.argv.indexOf('--port'),port=Number(index>=0?process.argv[index+1]:process.env.PORT || 8790);
  createPracticeServer().listen(port,'0.0.0.0',()=>console.log(`Begood server listening on ${port}`));
}
