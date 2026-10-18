// Opt-in evaluation against the actual configured provider. Only the synthetic
// scenarios in this repository are used; this runner never reads user records.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getProvider } from './lib/providers.mjs';
import { generateCommunication } from './lib/communication-ai.mjs';

const args=process.argv.slice(2);
const help=`Communication for Social Resilience live quality evaluation
Usage: node harness/communication-eval.mjs --live [--mode single|continuity|both] [--output work/communication-eval.json] [--scenario ID]
Uses PROVIDER and MODEL, plus that provider's API credentials, already configured
for BE GOOD. COMMUNICATION_CONTEXT_TOKENS optionally sets the provider window.
Without --live, no model request occurs. The ten scenarios are synthetic.
Both modes are evaluated by default using the same engine. In single mode,
each scenario's full supplied exchange is an explicit one-time source material;
no saved conversation or cross-request memory is read or written.
This is not a factuality guarantee. A human reviewer checks every generated
answer against mustPreserve, mustAvoid and quality criteria in the report.
Schema checks only prove output structure, provenance and specific guards.
Live generative quality remains unverified until that review is completed.
`;
function option(name) { const i=args.indexOf(name);if(i<0)return undefined;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`${name} requires a value`);return args[i+1]; }

async function main() {
  if(args.includes('--help')||!args.includes('--live')){process.stdout.write(help);return;}
  const allowed=['--live','--help','--output','--scenario','--mode'];
  for(let i=0;i<args.length;i++){if(!allowed.includes(args[i]))throw new Error(`Unknown argument ${args[i]}`);if(['--output','--scenario','--mode'].includes(args[i]))i++;}
  const outputPath=option('--output'),selected=option('--scenario'),mode=option('--mode')||'both';
  if(!['single','continuity','both'].includes(mode))throw new Error('Invalid communication mode');
  const modes=mode==='both'?['single','continuity']:[mode];
  const providerName=process.env.PROVIDER||'anthropic';
  const key=providerName==='openai'?'OPENAI_API_KEY':providerName==='anthropic'?'ANTHROPIC_API_KEY':null;
  if(!key||!process.env[key]?.trim()){
    process.stderr.write('Live provider credentials are absent; live generative quality is unverified. No model calls made.\n');process.exitCode=2;return;
  }
  const scenarios=JSON.parse(await readFile(new URL('./fixtures/communication-scenarios.json',import.meta.url),'utf8')).filter(s=>!selected||s.id===selected);
  if(!scenarios.length)throw new Error('No synthetic scenario matches the selected ID');
  const provider=getProvider(providerName);
  const report={createdAt:new Date().toISOString(),kind:'synthetic-live-quality-review',factualityGuarantee:false,humanReviewStatus:'pending',notice:'Valid schema does not establish factuality or suitability. Review every answer against its supplied facts, forbidden inventions and quality criteria.',results:[]};
  for(const scenario of scenarios)for(const communicationMode of modes){
    try{
      const result=await generateCommunication({conversation:scenario.conversation,action:communicationMode==='single'?'suggest':scenario.action,instruction:scenario.instruction,communicationMode,composition:communicationMode==='single'?{format:'הודעה מקצועית'}:undefined,provider});
      report.results.push({id:scenario.id,title:scenario.title,communicationMode,schemaStatus:'valid',model:result.model,source:scenario.conversation,review:scenario.review,output:result.output,summaries:result.summaries,humanReview:{factsPreserved:null,noInventions:null,draftSentDistinction:null,uncertaintyRespected:null,usefulAndAppropriate:null,notes:''}});
      process.stdout.write(`${scenario.id} (${communicationMode}): structured output received; human quality review pending.\n`);
    }catch(error){
      // No provider payloads, response bodies or private content in console.
      report.results.push({id:scenario.id,communicationMode,schemaStatus:'failed',code:error.code||'PROVIDER_ERROR',humanReviewStatus:'not-generated'});
      process.stdout.write(`${scenario.id} (${communicationMode}): generation failed (${error.code||'PROVIDER_ERROR'}).\n`);process.exitCode=1;
    }
  }
  if(outputPath){await writeFile(resolve(outputPath),JSON.stringify(report,null,2),'utf8');process.stdout.write(`Review report saved to ${resolve(outputPath)}\n`);}
  else process.stdout.write('Use --output to save outputs and the human review checklist.\n');
  process.stdout.write('This evaluation is not a factuality guarantee. Live quality review is pending.\n');
}
main().catch(()=>{process.stderr.write('Evaluation could not run. Check arguments, fixture files and configured provider.\n');process.exitCode=1;});
