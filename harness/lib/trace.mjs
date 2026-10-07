import { digest } from './agent-contract.mjs';

const number=x=>Number.isFinite(x)&&x>=0?x:null;
const tag=(value,allowed)=>allowed.includes(value)?value:'unknown';
export function agentTrace({runId,artifactId,baseVersion,agent,model,promptVersion,schemaVersion,sourceVersion,ms,usage,status,errorCode}) {
  return {runId:digest(String(runId)),artifactId:digest(String(artifactId)),artifactVersion:Number.isInteger(baseVersion)?baseVersion:null,
    agent:tag(agent,['single','pedagogy','resilience_facilitation','safety_sources','synthesis']),
    model:model?digest(String(model)):null,promptVersion:digest(String(promptVersion)),schemaVersion:digest(String(schemaVersion)),sourceVersion:digest(String(sourceVersion)),
    latencyMs:number(ms),usage:usage?{inputTokens:number(usage.inputTokens),outputTokens:number(usage.outputTokens),totalTokens:number(usage.totalTokens)}:null,
    outcome:tag(status,['valid','failed','timeout','cancelled','budget_exceeded']),
    gate:status==='valid'?'passed':'rejected',errorCode:tag(errorCode,['none','output_contract','proposal_schema','proposal_sources','proposal_patch','missing_step','locked_field','timeout','aborted','budget_exceeded','provider_error','invalid_artifact','private_leak'])};
}
