import json, pathlib, subprocess, os, copy
RUN=pathlib.Path(__file__).parent
REPO=pathlib.Path('C:/Users/yaels/Documents/Codex/2026-10-06/openai-docs-make-me-a-plan/work/begood')
SKILL=pathlib.Path('C:/Users/yaels/.codex/plugins/cache/compound-engineering-plugin/compound-engineering/3.30.4/skills/ce-code-review')
mechanical=json.loads((RUN/'mechanical-findings.json').read_text(encoding='utf-8'))
detail=json.loads((RUN/'source-detail-map.json').read_text(encoding='utf-8'))
by_number={f['#']:f for f in mechanical['findings']}
def union(xs): return list(dict.fromkeys(xs))
def quote(file,line): return file+':'+str(line)+' -- '+(REPO/file).read_text(encoding='utf-8').splitlines()[line-1].strip()
def originals(nums):
    out=[]
    for num in nums:
        f=by_number[num]
        for reviewer in f['reviewers']:
            for key,value in detail.items():
                parsed=json.loads(key)
                if parsed[:3]==[reviewer,f['file'],str(f['line'])] and value['title']==f['title']: out.append((key,value))
    return out
hydration={}
source_keys={}
def candidate(nums,title=None,file=None,line=None,why=None,fix=None):
    sources=originals(nums)
    first=copy.deepcopy(by_number[nums[0]])
    first.pop('#',None)
    if title: first['title']=title
    if file: first['file']=file
    if line: first['line']=line
    first['first_evidence']=quote(first['file'],first['line'])
    first['reviewers']=union(r for n in nums for r in by_number[n]['reviewers'])
    first['independent_reviewers']=union(r for n in nums for r in by_number[n]['independent_reviewers'])
    first['confidence']=max(by_number[n]['confidence'] for n in nums)
    first['severity']=min((by_number[n]['severity'] for n in nums),key=lambda x:int(x[1]))
    first['autofix_class']='manual' if any(by_number[n]['autofix_class']=='manual' for n in nums) else first['autofix_class']
    first['evidence']=union([first['first_evidence']]+[e for key,value in sources for e in value['evidence']])
    first['why_it_matters']=why or max((value['why_it_matters'] for key,value in sources),key=len)
    if fix: first['suggested_fix']=fix
    key=json.dumps([first['file'],first['line'],first['title']],ensure_ascii=False)
    hydration[key]=copy.deepcopy(first)
    source_keys[key]=[key for key,value in sources]
    return first
demo=candidate([5,7,8,1],
 title='Isolate new demos before reading private workspaces',file='app/lib/routines-ui.js',line=32,
 why="The new routines, family bridge and custom-practice flows restore and save ordinary owner workspaces even under the administrator's embedded demo gates. Demo examples can overwrite private drafts; successful routines generation clears people/history, and own-case approval can evict the oldest of twelve saved cases and clear the private draft. Restored private names/contact fields can enter demo input metadata. The ordinary practice recipe also queries the first scenario-card across both saved personal cases and the catalogue, so it can send a private case into a demonstration. Fresh demo memory before all reads prevents this shared boundary failure and prevents an old custom preview from satisfying the new demonstration.",
 fix="Before any workspace read in routines-ui.js, family-bridge-ui.js and practice.html's custom-case IIFE, select fresh memory storage only when demolab=1, the page is embedded and the session homeUrl is admin.html?role=sys. Route all normal workspace/draft reads and writes, including routines' Studio import, through that selected storage. Scope the ordinary practice recipe to #scenarioList .scenario-card. Preserve ordinary owner persistence when any gate is absent. Exercise the actual routines/family/practice recipes on success and provider failure, with seeded private fields, history, twelve personal cases and an old preview: assert zero ordinary storage access, byte-identical records, no private request/capture markers and no old preview accepted as success.")
race=candidate([2,3,4,6,12],
 title='Bind routine completions to their initiating mechanism',file='app/lib/routines-ui.js',line=229,
 why="Selecting mechanism B or deleting A while A's options, initial plan or revision is pending changes the shared I variable. The completion then writes A's response into whichever mechanism is now selected; initial generation clears that mechanism's participants, trial runs, decisions and version history. The active hub makes the sequence reachable in ordinary navigation, and reviewers reproduced options and build corruption with deferred synthetic requests. Capture and validate the initiating item/revision before settlement so navigation cannot corrupt a different mechanism.",
 fix="Capture the originating item and a per-item request/revision identifier before options, build and revise. Apply data only while that item still exists and the captured revision is current; persist its result and redraw/navigate only when it remains selected. Invalidate pending work on deletion or replacement, prevent duplicate work for the same revision, and let only the current operation clear its request state. Add deferred-provider VM tests for A-to-B switching, deletion of A, overlapping/newer operations and preservation of B's plan, people and history.")
keep=[demo,race]+[candidate([n]) for n in [9,10,11,13,14,15]]
reconciled=[{'reviewer':'synthesis','findings':keep,'residual_risks':mechanical.get('residual_risks',[]),'testing_gaps':mechanical.get('testing_gaps',[])}]
(RUN/'reconciled-returns.json').write_text(json.dumps(reconciled,ensure_ascii=False,indent=2),encoding='utf-8')
(RUN/'reconciled-source-keys.json').write_text(json.dumps(source_keys,ensure_ascii=False,indent=2),encoding='utf-8')
with (RUN/'reconciled-returns.json').open('rb') as inp,(RUN/'mechanical-findings-final.json').open('wb') as out:
    subprocess.run(['python',str(SKILL/'scripts/findings-mechanics.py')],stdin=inp,stdout=out,check=True,env={**os.environ,'PYTHONUTF8':'1'})
final=json.loads((RUN/'mechanical-findings-final.json').read_text(encoding='utf-8'))
for partition in ['findings','pre_existing_findings','suppressed_findings']:
    for f in final[partition]:
        key=json.dumps([f['file'],f['line'],f['title']],ensure_ascii=False)
        h=hydration[key]
        for attr in ['why_it_matters','evidence','reviewers','independent_reviewers']: f[attr]=h[attr]
        assert f['why_it_matters'] and f['evidence']
final['first_evidence_backfilled']=mechanical['first_evidence_backfilled']+final['first_evidence_backfilled']
final['rejected_candidates']=[{'reviewer':'api-contract','title':by_number[16]['title'],'file':by_number[16]['file'],'line':263,
 'reason':"The invocation explicitly requires rejection of historical generic jobs without page/permission and forbids a broad fallback. The base record at 570c354:harness/practice-server.mjs:254-257 has owner/tenant/path/hash but no factual originating page when permission is absent; a hash cannot reconstruct that attribution. Current :93 and :263 intentionally enforce the declared security boundary. Reinstating the old any-facilitator endpoint policy merely prefers the rejected contract, so this compatibility claim is discarded rather than retained as an unresolved risk."}]
final['semantic_reconciliation']=[{'title':demo['title'],'original_numbers':[5,7,8,1],'rationale':'One new-demo owner-storage boundary failure across routines, family bridge and custom practice, resolved by the same gated fresh-memory storage path plus explicit catalogue scoping.'},{'title':race['title'],'original_numbers':[2,3,4,6,12],'rationale':'Same mutable I target corruption and the same item/revision-bound settlement fix across options, build and revise.'}]
(RUN/'hydrated-findings-working.json').write_text(json.dumps(final,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'findings':[{'#':f['#'],'severity':f['severity'],'title':f['title'],'reviewers':f['reviewers'],'independent_reviewers':f['independent_reviewers'],'autofix_class':f['autofix_class'],'confidence':f['confidence']} for f in final['findings']], 'malformed_findings':final['malformed_findings'],'malformed_returns':final['malformed_returns'],'suppressed_by_confidence':final['suppressed_by_confidence']},ensure_ascii=True))
