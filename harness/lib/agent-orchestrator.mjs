import { assertCompletionResult } from './providers.mjs';
import { AGENT_LIMITS,AGENT_SCHEMA_VERSION,AGENT_SYSTEMS,REVIEWERS,agentEnvelope,validateProposal,digest,contractError } from './agent-contract.mjs';
import { agentTrace } from './trace.mjs';
import { completionUsageCharge } from './token-budget.mjs';
const SYSTEM_BYTES=Object.fromEntries(Object.entries(AGENT_SYSTEMS).map(([agent,system])=>[agent,Buffer.byteLength(system)]));

export async function runAgentReview({artifact,runId,provider,sourceLibrary=[],teamEnabled=false,signal,limits={},priorResults={},question='',stepId='',requestType='refine',validateCandidate,onResult=async()=>{},assertCurrent=async()=>{}}) {
  const cap={...AGENT_LIMITS,...limits};
  if(!provider?.complete)throw contractError('provider_unavailable',503);
  for(const key of ['maxCalls','maxTokensPerCall','totalTokens','timeoutMs','maxInputBytes'])if(!Number.isInteger(cap[key])||cap[key]<1||cap[key]>AGENT_LIMITS[key])throw contractError('invalid_limits',400);
  const deadline=Date.now()+cap.timeoutMs;
  let calls=0,totalTokens=0,reservedTokens=0,pendingCalls=0,notifyBudget;
  let budgetChanged=new Promise(resolve=>notifyBudget=resolve);
  const results=structuredClone(priorResults),traces=[];
  const mode=teamEnabled?'team':'single';
  const call=async(agent,extra={})=>{
    const started=performance.now();let timer,abort,reservationStarted=false;
    const controller=new AbortController();
    const finish=(status,result={})=>({agent,status,...result});
    let result,completion;
    try {
      if(signal?.aborted)throw contractError('aborted');
      await assertCurrent();
      if(signal?.aborted||controller.signal.aborted)throw contractError('aborted');
      if(calls>=cap.maxCalls||totalTokens>=cap.totalTokens||Date.now()>=deadline)throw contractError('budget_exceeded');
      const envelope=agentEnvelope(artifact,agent,{runId,sourceLibrary,question,stepId,requestType,...extra});
      const input=JSON.stringify(envelope);
      const inputBytes=Buffer.byteLength(input);
      if(inputBytes>cap.maxInputBytes)throw contractError('budget_exceeded');
      // Reserve input as UTF-8 bytes (a conservative token estimate), output,
      // and protocol overhead before starting parallel requests. No hidden retry.
      const reservation=inputBytes+SYSTEM_BYTES[agent]+cap.maxTokensPerCall+2048;
      const waiting=new Promise((_,reject)=>{
        timer=setTimeout(()=>{controller.abort();reject(contractError('timeout'));},Math.max(1,deadline-Date.now()));
        abort=()=>{controller.abort();reject(contractError('aborted'));};
        signal?.addEventListener('abort',abort,{once:true});
      });
      // A pending call may settle below its conservative reservation. Wait for
      // that accounting before declining another reviewer; retain every cap.
      while(totalTokens+reservedTokens+reservation>cap.totalTokens) {
        if(signal?.aborted||controller.signal.aborted)throw contractError('aborted');
        if(Date.now()>=deadline)throw contractError('timeout');
        if(!pendingCalls||totalTokens+reservation>cap.totalTokens)throw contractError('budget_exceeded');
        await Promise.race([budgetChanged,waiting]);
        await assertCurrent();
        if(signal?.aborted||controller.signal.aborted)throw contractError('aborted');
        if(Date.now()>=deadline)throw contractError('timeout');
        if(calls>=cap.maxCalls||totalTokens>=cap.totalTokens)throw contractError('budget_exceeded');
      }
      if(signal?.aborted||controller.signal.aborted)throw contractError('aborted');
      calls++;reservedTokens+=reservation;pendingCalls++;reservationStarted=true;
      completion=assertCompletionResult(await Promise.race([provider.complete({system:AGENT_SYSTEMS[agent],messages:[{role:'user',content:input}],
        maxTokens:cap.maxTokensPerCall,maxAttempts:1,variation:'low',signal:controller.signal,tools:[],toolChoice:'none'}),waiting]));
      if(signal?.aborted||controller.signal.aborted)throw contractError('aborted');
      if(completion.toolCalls?.length)throw contractError('proposal_patch');
      const used=completionUsageCharge(completion.usage,{reservation,maxOutputTokens:cap.maxTokensPerCall});
      if(used===null)throw contractError('budget_exceeded');
      // Incomplete usage keeps the full reservation; a partial count is not a total.
      reservedTokens-=reservation;totalTokens+=used;
      if(totalTokens>cap.totalTokens)throw contractError('budget_exceeded');
      let value;try{value=JSON.parse(completion.text);}catch{throw contractError('proposal_schema');}
      const proposal=validateProposal(value,{artifact,sourceLibrary,agent});
      await assertCurrent();
      await validateCandidate(proposal);
      proposal.id=runId+':'+agent+(agent==='synthesis'?':'+extra.proposals.length:'');proposal.agent=agent;proposal.schemaVersion=AGENT_SCHEMA_VERSION;
      if(agent==='synthesis'&&extra.missing.length)proposal.riskFlags=[...new Set([...proposal.riskFlags,'missing_reviewers:'+extra.missing.join(',')])];
      result=finish('valid',{proposal,usage:completion.usage||null});
    } catch(error) {
      const code=['proposal_schema','proposal_sources','proposal_patch','agent_scope','missing_step','locked_field','timeout','aborted','budget_exceeded','invalid_artifact','private_leak'].includes(error.code)?error.code:'provider_error';
      result=finish(code==='timeout'?'timeout':code==='aborted'?'cancelled':code==='budget_exceeded'?'budget_exceeded':'failed',{errorCode:code,usage:completion?.usage||error.usage||null});
    } finally {
      clearTimeout(timer);signal?.removeEventListener('abort',abort);
      if(reservationStarted) {
        pendingCalls--;
        const notify=notifyBudget;
        budgetChanged=new Promise(resolve=>notifyBudget=resolve);
        notify();
      }
    }
    const trace=agentTrace({runId,artifactId:artifact.id,baseVersion:artifact.version,agent,model:provider.model,promptVersion:digest(AGENT_SYSTEMS[agent]),
      schemaVersion:AGENT_SCHEMA_VERSION,sourceVersion:digest(sourceLibrary),ms:performance.now()-started,usage:result.usage,status:result.status,errorCode:result.errorCode||'none'});
    traces.push(trace);results[agent]=result;
    await onResult(result,trace);
    return result;
  };
  if(!teamEnabled) {
    const result=results.single?.status==='valid'?results.single:await call('single');
    return {runId,mode,fallback:false,status:result.status==='valid'?'complete':'failed',proposal:result.proposal||null,results,traces,calls,totalTokens};
  }
  await Promise.all(REVIEWERS.filter(role=>results[role]?.status!=='valid').map(role=>call(role)));
  const valid=REVIEWERS.map(role=>results[role]).filter(r=>r?.status==='valid').map(r=>r.proposal);
  const missing=REVIEWERS.filter(role=>results[role]?.status!=='valid');
  if(signal?.aborted)return {runId,mode,fallback:false,status:'cancelled',proposal:null,results,traces,calls,totalTokens};
  if(valid.length) {
    const synthesis=await call('synthesis',{proposals:valid,missing});
    return {runId,mode,fallback:missing.length>0,status:synthesis.status==='valid'?(missing.length?'partial':'complete'):'failed',
      proposal:synthesis.proposal||null,results,traces,calls,totalTokens};
  }
  // A fourth, single-agent attempt is allowed only inside the same time/call/token budget.
  const fallback=await call('single');
  return {runId,mode,fallback:true,status:fallback.status==='valid'?'fallback':'failed',proposal:fallback.proposal||null,results,traces,calls,totalTokens};
}
