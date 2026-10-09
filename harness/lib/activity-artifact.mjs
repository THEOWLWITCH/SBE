import { randomUUID } from 'node:crypto';
import { runGates,assertGenerationInput,approvedSources } from './gates.mjs';
import { toScenario } from './to-scenario.mjs';
import { applyProposal,contractError,digest,AGENT_LIMITS,REVIEWERS,agentEnvelope } from './agent-contract.mjs';
import { runAgentReview } from './agent-orchestrator.mjs';
import { PLANNER_KINDS,PRACTICE_MODES,validatePlannerContent,plannerContentFromDraft } from './planner-artifact.mjs';

const PERMISSIONS=['fac_trainee','fac_parent','fac_youth','activity','conv','studio','resilience','leadership','practi'];
// Each kind is opened only by the tools that produce it. A conversation draft needs the conversation planner.
const KIND_PERMISSIONS=Object.freeze({narrative:['fac_trainee','fac_parent','fac_youth','activity','studio','resilience','leadership','practi'],
  activity:['activity','studio','resilience','leadership','practi'],conversation:['conv']});
const VERSION='activity-artifact/v1';
const now=()=>new Date().toISOString();
const clone=value=>structuredClone(value);
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.trim().length>0;
const key=id=>'artifact:'+id;
const snapshot=a=>({version:a.version,status:a.status,content:clone(a.content),savedAt:now()});
const allowedContent=['kind','pipelineOutput','scenario','context','purpose','resilienceComponents','individualSkills','sharedSkills','facilitatorGuide','socialMechanism','steps'];
export const artifactReviewRunId=(id,version,idempotencyKey)=>'run-'+digest(id+'\0'+version+'\0'+idempotencyKey).slice(7,39);
function authorized(principal){return text(principal?.ownerId)&&text(principal?.tenantId)&&Array.isArray(principal.permissions)&&principal.permissions.some(p=>PERMISSIONS.includes(p));}
function own(record,p){return record&&record.ownerId===p.ownerId&&record.tenantId===p.tenantId&&kindAllowed(p,record.content?.kind);}
function kindAllowed(p,kind){return (KIND_PERMISSIONS[kind]||[]).some(x=>p.permissions.includes(x));}
function privateLeaks(value,concerns) {
  if(!text(concerns))return false;
  const serialized=JSON.stringify(value),markers=[concerns.trim(),...(concerns.match(/\+?\d[\d\s()-]{6,}\d/g)||[]).map(s=>s.trim())];
  return markers.some(marker=>marker.length>=8&&serialized.includes(marker));
}

export function validateArtifactContent(input,{sourceLibrary=[],complete=false}={}) {
  if(object(input)&&PLANNER_KINDS.includes(input.kind)) {
    const content=validatePlannerContent(input,{complete});
    if(Buffer.byteLength(JSON.stringify(content))>500000)throw contractError('artifact_too_large');
    return content;
  }
  if(!object(input)||input.kind!=='narrative')throw contractError('unsupported_artifact_kind');
  const content=Object.fromEntries(allowedContent.filter(k=>Object.hasOwn(input,k)).map(k=>[k,clone(input[k])]));
  const output=input.pipelineOutput||(input.scenario?.characters?input.scenario:null);
  if(!object(output)||!object(input.context))throw contractError('missing_pipeline_context');
  try {
    assertGenerationInput(input.context);
    const gate=runGates(output,input.context,{sourceLibrary});
    if(!gate.passed)throw contractError('invalid_artifact');
    // Keep the original pipeline contract and derive the renderer contract once.
    const {_trace,_gates,_ms,usage,...cleanOutput}=output;
    content.pipelineOutput=clone(cleanOutput);
    const meta=Object.fromEntries(['id','institution','creator','date','duration','age','audience']
      .filter(field=>typeof input.scenario?.[field]==='string').map(field=>[field,input.scenario[field]]));
    content.scenario=toScenario(cleanOutput,{input:input.context,sourceLibrary,meta});
  }catch{throw contractError('invalid_artifact');}
  content.steps=Array.isArray(input.steps)?clone(input.steps):[];
  const ids=new Set();
  for(const step of content.steps) {
    if(!object(step)||!text(step.id)||!/^[a-zA-Z0-9_-]{1,80}$/.test(step.id)||ids.has(step.id)||!text(step.title)||!text(step.instructions)
      ||!Number.isFinite(step.minutes)||step.minutes<=0||Object.keys(step).some(k=>!['id','title','instructions','minutes'].includes(k)))throw contractError('invalid_steps');
    ids.add(step.id);
  }
  for(const field of ['purpose','facilitatorGuide','socialMechanism']) {
    if(content[field]!==undefined&&typeof content[field]!=='string')throw contractError('invalid_explanation');
    if(complete&&!text(content[field]))throw contractError('missing_explanation');
  }
  for(const field of ['resilienceComponents','individualSkills','sharedSkills']) {
    if(content[field]!==undefined&&(!Array.isArray(content[field])||content[field].some(x=>!text(x))))throw contractError('invalid_explanation');
    if(complete&&!content[field]?.length)throw contractError('missing_explanation');
  }
  if(complete&&!content.steps.length)throw contractError('missing_steps');
  if(Buffer.byteLength(JSON.stringify(content))>500000)throw contractError('artifact_too_large');
  return content;
}

async function atomicWrite(store,record,next) {
  const result=await store.compareAndSet({key:key(record.id),expected:record,value:next});
  if(!result.updated)throw contractError('version_conflict',409);
  return result.value;
}
async function reconcileReviews(store,principal,record,clock) {
  for(let attempt=0;attempt<12;attempt++) {
    const next=clone(record);let changed=false;
    for(const run of Object.values(next.reviewRuns)) {
      if(run.status!=='running')continue;
      const job=run.jobKey?await store.get(run.jobKey):null;
      const terminal=run.jobKey&&(!job||job.status!=='running'||job.expiresAt<=clock());
      if(terminal||!Number.isFinite(run.leaseUntil)||run.leaseUntil<=clock()) {
        run.status=job?.status==='cancelled'?'cancelled':'lost';run.endedAt=now();changed=true;
      }
    }
    if(!changed)return record;
    next.updatedAt=now();const saved=await store.compareAndSet({key:key(record.id),expected:record,value:next});
    if(saved.updated)return saved.value;
    record=await store.get(key(record.id));if(!own(record,principal))throw contractError('artifact_not_found',404);
  }
  throw contractError('version_conflict',409);
}
async function appendReviewResult(store,principal,id,runId,attemptId,result,trace,clock,assertCurrent) {
  for(let attempt=0;attempt<12;attempt++) {
    const current=await store.get(key(id));if(!own(current,principal))throw contractError('artifact_not_found',404);
    const next=clone(current),run=next.reviewRuns[runId];if(!run)throw contractError('review_not_found',409);
    if(run.attemptId!==attemptId||run.status!=='running'||run.leaseUntil<=clock())throw contractError('review_lost',409);
    run.results[result.agent]=clone(result);
    if(result.proposal&&!next.proposals.some(p=>p.id===result.proposal.id))next.proposals.push({...clone(result.proposal),privacy:'private',decision:'pending'});
    next.traces.push(trace);next.updatedAt=now();
    await assertCurrent();const saved=await store.compareAndSet({key:key(id),expected:current,value:next});if(saved.updated)return;
  }
  throw contractError('version_conflict',409);
}

export async function handleArtifacts(store,principal,body,{provider,sourceLibrary=[],teamEnabled=false,signal,limits,clock=Date.now,jobKey,assertCurrent=async()=>{}}={}) {
  try {
    if(!authorized(principal))throw contractError('artifact_forbidden',403);
    if(!object(body)||!text(body.action))throw contractError('invalid_request',400);
    if(typeof store?.get!=='function'||typeof store?.putIfAbsent!=='function'||typeof store?.compareAndSet!=='function')throw contractError('atomic_storage_required',503);
    const sources=approvedSources(sourceLibrary).map(s=>({...s,approved:true}));
    if(body.action==='create') {
      // A planner draft goes through its explicit adapter; it is never sent as narrative content.
      if(body.draft!==undefined&&body.content!==undefined)throw contractError('invalid_request',400);
      const input=body.draft!==undefined?plannerContentFromDraft(body.kind,body.draft,body.planning):body.content;
      if(!object(input)||!kindAllowed(principal,input.kind))throw contractError(object(input)&&KIND_PERMISSIONS[input.kind]?'artifact_forbidden':'unsupported_artifact_kind',object(input)&&KIND_PERMISSIONS[input.kind]?403:422);
      const content=validateArtifactContent(input,{sourceLibrary:sources});
      if(body.privateConcerns!==undefined&&typeof body.privateConcerns!=='string')throw contractError('invalid_concern',400);
      const artifact={schemaVersion:VERSION,id:'art-'+randomUUID(),ownerId:principal.ownerId,tenantId:principal.tenantId,
        version:1,status:'draft',privacy:'private',content,privateConcerns:(body.privateConcerns||'').slice(0,12000),
        locks:text(content.purpose)?{purpose:content.purpose}:{},history:[],proposals:[],decisions:[],approvedVersions:[],observations:[],reviewRuns:{},traces:[],
        createdAt:now(),updatedAt:now(),sourceVersion:digest(sources)};
      const stored=await store.putIfAbsent({key:key(artifact.id),value:artifact});
      if(!stored.created)throw contractError('artifact_conflict',409);
      return [201,{artifact:stored.value}];
    }
    if(!text(body.artifactId)||!/^art-[a-f0-9-]{36}$/.test(body.artifactId))throw contractError('artifact_not_found',404);
    let record=await store.get(key(body.artifactId));if(!own(record,principal))throw contractError('artifact_not_found',404);
    record=await reconcileReviews(store,principal,record,clock);
    if(body.action==='get')return [200,{artifact:record}];
    if(body.action==='practice'||body.action==='observe') {
      if(!Number.isInteger(body.version))throw contractError('approved_version_required',400);
      const approved=record.approvedVersions.find(a=>a.version===body.version);if(!approved)throw contractError('unapproved_version',409);
      if(body.action==='practice')return [200,{artifactId:record.id,version:approved.version,kind:approved.content.kind,
        practiceMode:PRACTICE_MODES[approved.content.kind],content:clone(approved.content),
        observations:record.observations.filter(o=>o.version===approved.version).map(clone),evidenceStatus:'human-approved-for-use'}];
      if(!text(body.observation)||!text(body.chosenNextStep)||body.observation.length>12000||body.chosenNextStep.length>12000)throw contractError('observation_and_decision_required',422);
      if(body.submissionId!==undefined&&(!text(body.submissionId)||!/^[a-zA-Z0-9_-]{8,100}$/.test(body.submissionId)))throw contractError('invalid_submission',400);
      const previous=body.submissionId&&record.observations.find(o=>o.id===body.submissionId);
      if(previous) {
        if(previous.version!==body.version||previous.observation!==body.observation||previous.chosenNextStep!==body.chosenNextStep)throw contractError('submission_conflict',409);
        return [200,{observation:previous,artifactId:record.id,version:approved.version,duplicate:true}];
      }
      const next=clone(record),entry={id:body.submissionId||'obs-'+randomUUID(),version:approved.version,observation:body.observation,chosenNextStep:body.chosenNextStep,
        chosenBy:principal.ownerId,createdAt:now()};
      next.observations.push(entry);next.updatedAt=now();
      await atomicWrite(store,record,next);return [200,{observation:entry,artifactId:record.id,version:approved.version}];
    }
    if(body.expectedVersion!==record.version)throw contractError('version_conflict',409);
    if(body.action==='update') {
      const content=validateArtifactContent(body.content,{sourceLibrary:sources});
      if(content.kind!==record.content.kind)throw contractError('kind_mismatch');
      if(body.privateConcerns!==undefined&&typeof body.privateConcerns!=='string')throw contractError('invalid_concern',400);
      const next=clone(record);next.history.push(snapshot(record));next.content=content;next.version++;next.status='draft';next.updatedAt=now();
      next.locks=text(content.purpose)?{purpose:content.purpose}:{};
      if(body.privateConcerns!==undefined)next.privateConcerns=body.privateConcerns.slice(0,12000);
      return [200,{artifact:await atomicWrite(store,record,next)}];
    }
    if(body.action==='review') {
      if(!provider?.complete)throw contractError('provider_unavailable',503);
      for(const field of ['question','stepId','requestType','idempotencyKey'])if(body[field]!==undefined&&(typeof body[field]!=='string'||body[field].length>12000))throw contractError('invalid_review_request',400);
      if(body.requestType!==undefined&&!['question','refine','concern'].includes(body.requestType))throw contractError('invalid_review_request',400);
      if(body.stepId&&!record.content.steps.some(s=>s.id===body.stepId))throw contractError('missing_step',422);
      const request={question:body.question||'',stepId:body.stepId||'',requestType:body.requestType||'refine'};
      const runId=artifactReviewRunId(record.id,record.version,body.idempotencyKey||randomUUID());
      const prior=record.reviewRuns[runId],requestHash=digest(request);
      if(prior&&prior.requestHash!==requestHash)throw contractError('idempotency_conflict',409);
      if(prior?.status==='running')throw contractError('review_running',409);
      if(prior&&!body.retry)return [200,{artifact:record,review:prior,duplicate:true}];
      if(signal?.aborted)throw contractError('review_cancelled',409);
      const cap={...AGENT_LIMITS,...limits};
      for(const agent of teamEnabled?REVIEWERS:['single']) {
        if(Buffer.byteLength(JSON.stringify(agentEnvelope(record,agent,{runId,sourceLibrary:sources,...request})))>cap.maxInputBytes)
          throw contractError('review_input_too_large',413);
      }
      const attemptId=randomUUID();
      const claimed=clone(record);
      claimed.reviewRuns[runId]={...(prior||{}),runId,baseVersion:record.version,status:'running',requestHash,attemptId,
        leaseUntil:clock()+Math.min(cap.timeoutMs,AGENT_LIMITS.timeoutMs)+10000,jobKey:jobKey||null,
        results:prior?.results||{},mode:teamEnabled?'team':'single'};
      claimed.status='review_required';claimed.updatedAt=now();await assertCurrent();await atomicWrite(store,record,claimed);
      const validateCandidate=async proposal=>{
        if(privateLeaks({changes:proposal.changes,unknowns:proposal.unknowns,riskFlags:proposal.riskFlags},record.privateConcerns))throw contractError('private_leak');
        try{validateArtifactContent(applyProposal(record.content,proposal),{sourceLibrary:sources,complete:true});}
        catch(error){throw contractError(error.code==='missing_step'?'missing_step':'invalid_artifact');}
      };
      let review;
      try {
        review=await runAgentReview({artifact:record,runId,provider,sourceLibrary:sources,teamEnabled,signal,limits,...request,
          priorResults:prior?.results||{},validateCandidate,assertCurrent,
          onResult:(result,trace)=>appendReviewResult(store,principal,record.id,runId,attemptId,result,trace,clock,assertCurrent)});
      }catch(error) {
        // A persistence error must not leave an unbounded running lock. If storage
        // is still unavailable, the durable lease reconciles on the next request.
        const current=await store.get(key(record.id)).catch(()=>null);
        if(own(current,principal)&&current.reviewRuns[runId]?.attemptId===attemptId&&current.reviewRuns[runId].status==='running') {
          const next=clone(current);next.reviewRuns[runId].status='failed';next.reviewRuns[runId].endedAt=now();
          await store.compareAndSet({key:key(record.id),expected:current,value:next}).catch(()=>{});
        }
        throw error;
      }
      let saved;
      for(let attempt=0;attempt<12;attempt++) {
        const current=await store.get(key(record.id));if(!own(current,principal))throw contractError('artifact_not_found',404);
        if(current.reviewRuns[runId]?.attemptId!==attemptId||current.reviewRuns[runId]?.status!=='running'
          ||current.reviewRuns[runId].leaseUntil<=clock())throw contractError('review_lost',409);
        const next=clone(current);
        next.reviewRuns[runId]={...next.reviewRuns[runId],...clone(review),requestHash,stale:current.version!==record.version};
        next.updatedAt=now();await assertCurrent();const result=await store.compareAndSet({key:key(record.id),expected:current,value:next});
        if(result.updated){saved=result.value;break;}
      }
      if(!saved)throw contractError('version_conflict',409);
      return [200,{artifact:saved,review:saved.reviewRuns[runId]}];
    }
    if(body.action==='decide') {
      if(!['accept','reject'].includes(body.decision))throw contractError('invalid_decision',400);
      const proposal=record.proposals.find(p=>p.id===body.proposalId);
      if(!proposal)throw contractError('proposal_not_found',404);
      if(proposal.baseVersion!==record.version||proposal.decision!=='pending')throw contractError('version_conflict',409);
      const next=clone(record),decision={proposalId:proposal.id,decision:body.decision,baseVersion:record.version,by:principal.ownerId,at:now()};
      next.proposals.find(p=>p.id===proposal.id).decision=body.decision==='accept'?'accepted':'rejected';
      if(body.decision==='accept') {
        const candidate=applyProposal(record.content,proposal);
        if(privateLeaks(proposal.changes,record.privateConcerns))throw contractError('private_leak');
        next.content=validateArtifactContent(candidate,{sourceLibrary:sources,complete:true});next.history.push(snapshot(record));
        next.version++;next.status='review_required';decision.resultVersion=next.version;
      }
      next.decisions.push(decision);next.updatedAt=now();return [200,{artifact:await atomicWrite(store,record,next)}];
    }
    if(body.action==='approve') {
      validateArtifactContent(record.content,{sourceLibrary:sources,complete:true});
      const accepted=record.proposals.filter(p=>p.decision==='accepted');
      const currentRuns=Object.values(record.reviewRuns).filter(r=>r.baseVersion===record.version || accepted.some(p=>Object.values(r.results||{}).some(result=>result.proposal?.id===p.id)));
      if(currentRuns.some(r=>r.status==='running'))throw contractError('review_running',409);
      const risks=[...new Set([...accepted.flatMap(p=>[...p.unknowns,...p.riskFlags]),
        ...currentRuns.flatMap(r=>[...(r.proposal?.unknowns||[]),...(r.proposal?.riskFlags||[]),...(['partial','failed','fallback','cancelled','lost'].includes(r.status)?['review_status:'+r.status]:[])])])];
      if(risks.length&&body.acknowledgeRisks!==true)throw contractError('risk_acknowledgement_required',422);
      const next=clone(record);
      if(!next.approvedVersions.some(s=>s.version===record.version))next.approvedVersions.push({...snapshot(record),approvedBy:principal.ownerId,approvedAt:now(),sourceVersion:digest(sources),acknowledgedRisks:risks});
      next.status='approved';next.updatedAt=now();return [200,{artifact:await atomicWrite(store,record,next)}];
    }
    throw contractError('unknown_action',400);
  }catch(error){return [error.status||503,{code:error.code||'artifact_error',error:error.code||'Artifact operation failed.'}];}
}
