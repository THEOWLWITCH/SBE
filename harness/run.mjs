// Provider-free contract runner. Fixture success is not a model or human quality score.
import { readFileSync, writeFileSync } from 'node:fs';
import { digest as hash } from './lib/agent-contract.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runGates, OutputContractError } from './lib/gates.mjs';
import { runPipeline } from './lib/pipeline.mjs';
import { handleAccess } from './lib/access.mjs';
import { ACTIVITY_SCHEMA, CONSULTATION_SCHEMA, handleStudio, studioRequest } from './lib/studio.mjs';

const studio = createRequire(import.meta.url)('../app/lib/resilience-studio.js');
const load = name => JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const opaque = value => value == null ? null : hash(String(value));
const finite = value => Number.isFinite(value) && value >= 0 ? value : null;
const enumValue = (value, choices) => choices.includes(value) ? value : 'unknown';

// This report trace intentionally contains no prompts, replies, gate reasons or free text.
// Identity links are hashes even when a caller accidentally uses a name or phone as an ID.
export function redactTrace(raw) {
  return {
    runId: opaque(raw.runId), jobId: opaque(raw.jobId), artifactId: opaque(raw.artifactId),
    artifactVersion: Number.isInteger(raw.artifactVersion) && raw.artifactVersion > 0 ? raw.artifactVersion : null,
    agent: enumValue(raw.agent, ['single', 'pedagogy', 'resilience_facilitation', 'safety_sources', 'synthesis']),
    model: raw.model === 'synthetic-no-model' ? raw.model : opaque(raw.model),
    promptVersion: opaque(raw.promptVersion), schemaVersion: opaque(raw.schemaVersion), sourceVersion: opaque(raw.sourceVersion),
    stage: enumValue(raw.stage, ['stage1', 'stage2', 'stage3', 'trainee', 'generate', 'adapt', 'consult', 'status', 'gates']),
    outcome: enumValue(raw.outcome, ['passed', 'rejected', 'error', 'unknown', 'not_exercised']),
    ms: finite(raw.ms),
    usage: raw.usage ? {inputTokens:finite(raw.usage.inputTokens), outputTokens:finite(raw.usage.outputTokens)} : null,
    gates: (Array.isArray(raw.gates) ? raw.gates : []).map(g => ({
      id: /^(?:\d{1,2}[a-z]?|schema|privacy|source_provenance|http_status|provider_call_count|no_automatic_approval|public_view_redaction|bank_source_provenance|truncation_rejected)$/.test(String(g.id)) ? String(g.id) : opaque(g.id),
      pass: g.pass === true, kind: g.kind === 'heuristic' ? 'heuristic' : 'exact',
    })),
  };
}

function safeGates(result) {
  return (result.gates || []).map(g => ({id:g.id,pass:g.pass === true,kind:g.kind || 'exact'}));
}

export async function runBaseline(dataset = load('baseline-cases.json'), {gatesOnly = false} = {}) {
  const results = [];
  for (const row of dataset.cases) {
    const started = performance.now();
    let scenario = clone(row.scenario), observed, rejectionStage = null, gates = [], fixtureProviderCalls = 0;
    try {
      if (!gatesOnly) {
        let lowCalls = 0;
        const provider = {async complete({variation}) {
          fixtureProviderCalls++;
          let stage;
          if (variation === 'high') stage = 'stage1';
          else if (variation === 'medium') stage = 'stage2';
          else stage = ++lowCalls === 1 ? 'trainee' : 'stage3';
          const response = row.pipelineResponses[stage];
          return {status:'completed',text:typeof response === 'string' ? response : JSON.stringify(response), usage:null};
        }};
        scenario = await runPipeline(clone(row.input), provider, {sourceLibrary:clone(row.sourceLibrary || [])});
      }
      const result = runGates(scenario, row.input, {sourceLibrary:row.sourceLibrary || []});
      gates = safeGates(result);
      observed = result.passed ? 'passed' : 'rejected';
    } catch (error) {
      // A programming/provider fixture error must not masquerade as a passing safety rejection.
      observed = error instanceof OutputContractError ? 'rejected' : 'error';
      rejectionStage = ['input','stage1','stage2','trainee','stage3','final'].includes(error.stage) ? error.stage : null;
    }
    const {_trace, _ms, ...artifact} = scenario;
    results.push({id:row.id, expected:row.expected, observed, matched:observed === row.expected,
      findingIds:row.findingIds, fixtureProviderCalls, rejectionStage, responseHash:hash(artifact), gates,
      trace:redactTrace({runId:'baseline:' + row.id, artifactId:row.id, artifactVersion:1, agent:'single', model:'synthetic-no-model',
        promptVersion:dataset.version, schemaVersion:'narrative', sourceVersion:hash(row.sourceLibrary || []), stage:gatesOnly?'gates':'stage3',
        outcome:observed, ms:performance.now()-started, gates})});
  }
  return {reportVersion:'baseline-report/v1', datasetVersion:dataset.version, datasetHash:hash(dataset),
    mode:gatesOnly?'gates-only':'synthetic-pipeline', modelCalls:0, humanQuality:{status:'not_measured',scoredArtifacts:0}, results,
    summary:{cases:results.length,expectedRejections:results.filter(r=>r.expected==='rejected').length,
      unexpectedOutcomes:results.filter(r=>!r.matched).length}};
}

function memoryStore(seed) {
  const data = new Map(Object.entries(seed));
  return {async get(k) {return data.get(k) ?? null;}, async set(k,v) {data.set(k,v);}, async del(k) {data.delete(k);},
    async list(prefix, options = {}) {return [...data].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>options.keysOnly?{key}:{key,value});},
    async delPrefix(prefix) {for (const k of data.keys()) if(k.startsWith(prefix)) data.delete(k);}};
}

async function fixturePrincipal(dataset, principalId) {
  const principal = dataset.principals.find(p=>p.id===principalId);
  if (!principal) throw new Error('Unknown fixture principal');
  const seed = {institutions:dataset.principals.map((p,i)=>({name:p.institutionId,code:'12345'+i,active:true}))};
  for (const [i,p] of dataset.principals.entries()) {
    seed['modules:'+p.institutionId] = Object.fromEntries(p.perms.map(permission=>[permission,true]));
    const secret = 'EVAL000' + String.fromCharCode(65+i);
    seed['code:'+secret] = {code:secret,kind:'staff',inst:p.institutionId,perms:p.perms,revoked:false};
  }
  const store = memoryStore(seed);
  const secret = 'EVAL000' + String.fromCharCode(65+dataset.principals.indexOf(principal));
  const [status,out] = await handleAccess(store, {action:'login',kind:'code',secret});
  if (status !== 200) throw new Error('Fixture principal login failed');
  return {store,token:out.token};
}

function fixtureResponse(fixture) {
  if (fixture.behavior === 'timeout') throw Object.assign(new Error('Synthetic timeout'), {name:'TimeoutError'});
  const body = fixture.behavior === 'truncated' ? {status:'incomplete',output:[]} : fixture.behavior === 'refusal'
    ? {status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'Synthetic refusal'}]}]}
    : {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(fixture.response)}]}]};
  return {ok:true,async json() {return body;}};
}

export async function runEvaluation(dataset = load('agent-evaluation-cases.json')) {
  if (dataset.synthetic !== true || dataset.applicationSchema !== 'begood-studio/' + studio.VERSION) {
    throw new Error('Only synthetic fixtures matching the current Studio contract are supported');
  }
  const schemaVersion = hash({activity:ACTIVITY_SCHEMA,consultation:CONSULTATION_SCHEMA});
  const sourceVersion = hash(readFileSync(new URL('../app/lib/resilience-advisor-sources.js', import.meta.url), 'utf8'));
  const promptVersion = hash(readFileSync(new URL('./lib/studio.mjs', import.meta.url), 'utf8'));
  const results = [];
  // Every provider access is intercepted. These placeholders never leave this process.
  const previousEnv = Object.fromEntries(['OPENAI_API_KEY','STUDIO_MODEL','STUDIO_REASONING_EFFORT'].map(k=>[k,process.env[k]]));
  process.env.OPENAI_API_KEY = 'synthetic-fixture-no-network';
  process.env.STUDIO_MODEL = 'synthetic-no-model';
  process.env.STUDIO_REASONING_EFFORT = 'medium';
  try {
    for (const row of dataset.cases) {
      const started = performance.now();
      const {store,token} = await fixturePrincipal(dataset,row.principalId);
      let fixtureProviderCalls = 0, auxiliaryProviderCalls = 0;
      const fetchImpl = async () => {fixtureProviderCalls++; return fixtureResponse(row.providerFixture);};
      const request = {...clone(row.request),token};
      const boundary = request.action === 'status' ? studioRequest : handleStudio;
      const [status,out] = await boundary(store,request,{fetchImpl});
      const checks = [
        {id:'http_status',pass:status === row.expectedHttpStatus},
        {id:'provider_call_count',pass:fixtureProviderCalls === row.expectedProviderCalls},
        {id:'no_automatic_approval',pass:out.approved !== true && out.activity?.evidenceStatus !== 'approved'},
      ];
      if (row.automatedChecks.includes('public_view_redaction')) {
        const publicView = studio.publicActivity({...out.activity,coach:clone(row.privacyProbe)});
        const serialized = JSON.stringify(publicView);
        checks.push({id:'public_view_redaction',pass:!serialized.includes(row.privacyProbe.concerns)
          && !serialized.includes(row.privacyProbe.messages[0].text) && !Object.hasOwn(publicView,'coach')});
      }
      if (row.automatedChecks.includes('bank_source_provenance')) checks.push({id:'bank_source_provenance',
        pass:out.activity?.professionalBasis.every(s=>s.sourceId && /^sha256:/.test(s.version) && s.status==='existing-bank') === true});
      if (row.automatedChecks.includes('truncation_rejected')) {
        const [truncatedStatus,truncatedOut] = await boundary(store,request,{fetchImpl:async()=>{auxiliaryProviderCalls++;return fixtureResponse({behavior:'truncated'});}});
        checks.push({id:'truncation_rejected',pass:truncatedStatus===422 && !truncatedOut.activity});
      }
      const matched = checks.every(c=>c.pass);
      results.push({id:row.id,focus:row.focus,httpStatus:status,fixtureProviderCalls:fixtureProviderCalls+auxiliaryProviderCalls,
        primaryProviderCalls:fixtureProviderCalls,auxiliaryProviderCalls,responseHash:hash(out),
        checks,matched,humanQuality:'pending',unexercisedChecks:row.unexercisedChecks,
        expectedSafetyOutcome:row.expectedSafetyOutcome,
        trace:redactTrace({runId:dataset.version+':'+row.id,jobId:request.jobId,artifactId:row.id,artifactVersion:1,
          agent:'single',model:'synthetic-no-model',promptVersion,schemaVersion,sourceVersion,stage:request.action,
          outcome:status===200?'passed':'rejected',ms:performance.now()-started,gates:checks})});
    }
  } finally {
    for (const [key,value] of Object.entries(previousEnv)) if(value===undefined) delete process.env[key]; else process.env[key]=value;
  }
  return {reportVersion:'agent-quality-report/v1',datasetVersion:dataset.version,datasetHash:hash(dataset),
    applicationSchema:dataset.applicationSchema,promptVersion,schemaVersion,sourceVersion,model:'synthetic-no-model',
    mode:'synthetic-studio-contracts',modelCalls:0,usage:null,cost:null,
    comparison:{single:{status:'fixture_contracts_only',caseIds:results.map(r=>r.id)},
      team:{status:'not_exercised',reason:'Three reviewers and synthesis are not implemented in this runner; no team quality or cost comparison was performed.',caseIds:results.map(r=>r.id)}},
    humanQuality:{status:'not_measured',scoredArtifacts:0,rubricVersion:dataset.humanRubric.version,
      requiredArtifacts:dataset.humanRubric.minimumArtifacts,thresholds:dataset.humanRubric.thresholds},
    results,summary:{cases:results.length,unexpectedContractOutcomes:results.filter(r=>!r.matched).length,
      humanReviewsPending:results.length,casesWithUnexercisedChecks:results.filter(r=>r.unexercisedChecks.length).length}};
}

export async function main(args = process.argv.slice(2)) {
  let gatesOnly = false, json = false, output;
  for (let i=0; i<args.length; i++) {
    const arg = args[i];
    if (arg==='--gates-only') gatesOnly=true;
    else if (arg==='--json') json=true;
    else if (arg==='--synthetic' || arg==='--eval') { /* Default mode is provider-free evaluation. */ }
    else if (arg==='--output' && args[i+1] && !args[i+1].startsWith('--')) output=resolve(args[++i]);
    else if (arg==='--help') {console.log('Usage: node run.mjs [--gates-only | --synthetic | --eval] [--json] [--output report.json]\nAll modes use synthetic fixtures; no model/network calls. Exit 1 means an unexpected contract outcome; human quality remains unmeasured.');return 0;}
    else {console.error('Unsupported option: '+arg);return 2;}
  }
  const baseline = await runBaseline(undefined,{gatesOnly});
  const report = gatesOnly ? baseline : {reportVersion:'harness-report/v1',mode:'synthetic',modelCalls:0,
    baseline,evaluation:await runEvaluation(),legacyNarrativeInputs:{datasetVersion:load('narrative-evaluation-inputs.json').version,
      cases:11,status:'inputs_preserved_no_generated_outputs'}};
  if (output) writeFileSync(output,JSON.stringify(report,null,2)+'\n','utf8');
  if (json) console.log(JSON.stringify(report,null,2));
  else {
    console.log(`${baseline.mode}: ${baseline.results.length} cases, ${baseline.summary.unexpectedOutcomes} unexpected outcomes; model calls: 0.`);
    if(report.evaluation) console.log(`Studio: ${report.evaluation.results.length} contract cases, ${report.evaluation.summary.unexpectedContractOutcomes} unexpected outcomes. Human quality: not measured; team comparison: not exercised.`);
    if(output) console.log('Report saved: '+output);
  }
  return baseline.summary.unexpectedOutcomes || report.evaluation?.summary.unexpectedContractOutcomes ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().then(code=>{process.exitCode=code;}).catch(()=>{console.error('Harness execution failed; no model calls were made.');process.exitCode=2;});
}
