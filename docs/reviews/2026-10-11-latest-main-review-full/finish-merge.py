import json, pathlib, subprocess, os
RUN=pathlib.Path(__file__).parent
SKILL=pathlib.Path('C:/Users/yaels/.codex/plugins/cache/compound-engineering-plugin/compound-engineering/3.30.4/skills/ce-code-review')
finish=json.loads((RUN/'finish-input.json').read_text(encoding='utf-8-sig'))
data=json.loads((RUN/'hydrated-findings-working.json').read_text(encoding='utf-8'))
findings=data['findings']
assert len(findings)==8
assert all(f['why_it_matters'] and f['evidence'] and f['first_evidence'] for f in findings)
assert all(f['owner']=='downstream-resolver' and f['autofix_class'] in ['gated_auto','manual'] for f in findings)
assert [f['#'] for f in findings]==list(range(1,9))
coverage_notes=finish['coverage_notes']+[
 finish['peer']['coverage'],
 'Stage 5 loaded all nine full structured reviewer artifacts and the agent-native prose before mechanical synthesis, retaining evidence and impact details. The agent-native context finding was serialized with its supplied confidence/routing and its quote corrected to canonical line 422.',
 'Stage 5 semantic reconciliation: 16 input candidates became 8 primary findings after 7 same-defect duplicates were merged and one intent-incompatible legacy-job exemption claim was discarded. All retained findings are hydrated and directly grounded in the canonical source; no pre-existing findings, soft-bucket demotions or malformed detail drops remain.',
 'The discarded legacy-job claim proposed an old endpoint-wide permission fallback. The explicit invocation forbids that exemption, and old records at 570c354:harness/practice-server.mjs:254-257 do not establish an originating page when permission is absent. The intentional denial at current lines 93 and 263 is retained; the discarded claim is not recycled into residual risks or testing gaps.',
 'First-evidence backfilled: 0 across initial and restored mechanics; quote-gate demotions: 0; malformed findings: 0; malformed returns: 0; confidence suppressions: 0. There are no session-settled annotations in the explicit plan; settlement preference suppressions: 0.',
 'Agreement is recorded across local reviewers only. The independent_reviewers lists are unions of the helper-produced persona identities and do not attest different-provider/model independence. No confidence anchor was raised by same-model agreement.',
 'Stage 5b steps 1-3 prepared one deterministic batch of all 8 remaining actionable findings (2 P1, 6 P2), ordered by severity and stable number. Validator shortcuts skipped: 0, because no verified adversarial-provider peer corroboration exists. Validator execution and outcomes belong to the dispatch context and report leaf.',
 'The testing reviewer sandbox transport restriction is execution coverage, not a remaining product defect: 22 pure model/VM tests passed, while 31 loopback HTTP tests immediately failed fetch under that reviewer sandbox; no assertion about the root passing transport suite is withdrawn.',
 'One consequential narrower test gap is retained: optional Studio customer-child reservation denied by the daily 429 limit. Existing tests cover root 429 and workflow 413 retention, but not that child admission branch.'
]
data['triage_groups']=[
 {'title':'Keep pending AI work in its originating workspace','findings':[1,5,6,8],
  'context':'Apply-queue: mutable workspace identity or recreated controls allow a late request to alter another item, a new round or the active screen.',
  'preferred_resolution':'Fix the mechanism target binding in #1 first, then give family rounds (#5), participation mounts (#6) and custom editor sessions (#8) their own identity and request-generation guards; verify each with deferred results.',
  'why':'The same settlement discipline applies across these interfaces, while each owns separate state and needs its own regression trigger.'},
 {'title':'Separate private entrant state from shared and new-entry material','findings':[3,4],
  'context':'Apply-queue: the joining pane includes raw input in shared output and retains an old entrant kit when a new route starts.',
  'preferred_resolution':'Remove private input wrappers from shared output (#3), then reset all entrant-specific state while retaining the group directory (#4); cover both with the existing actual DOM fixture.',
  'why':'Both failures cross the same join-state boundary, but export filtering and route reset are distinct fixes.'}
]
data['residual_risks']=[]
data['testing_gaps']=[
 {'file':'harness/lib/studio.mjs','line':433,'reviewer':'testing',
  'gap':'No actual-listener test reaches a 429 daily reservation denial at the optional customer-review child while the root generation fits.',
  'response':'Seed remaining allowance sufficient for the initial generation but insufficient for the review. Assert one provider fetch, a valid retained activity, customerReview.ready=false, no replacement fetch, committed root and no occupied child reservation.',
  'evidence':'Current studio.mjs:433 handles 413 and 429 together. studio-quota-flow.test.mjs:56-80 covers daily denial at a new root; existing repair tests cover workflow 413; none of the inspected test names/bodies reaches the optional child daily 429 branch.'}
]
data['coverage_notes']=coverage_notes
data['coverage']={'depth':'full','notes':coverage_notes,'peer':finish['peer'],
 'raw_candidates':16,'semantic_duplicates_merged':7,'intent_incompatible_discarded':1,
 'mode_aware_demotions':0,'first_evidence_backfilled':data['first_evidence_backfilled'],'quote_gate_demotions':0,
 'malformed_findings':data['malformed_findings'],'malformed_returns':data['malformed_returns'],
 'suppressed_by_confidence':data['suppressed_by_confidence'],'validator_shortcut_skipped':0,
 'validator_batch_prepared':8,'validator_status':'awaiting-dispatch','settlement_preference_suppressions':0,
 'failed_reviewers':finish['collection']['failed_reviewers'],'compound_packs':finish['roster']['packs']}
data['peer_fold_in']={'outcome':finish['peer']['outcome'],'artifact':finish['peer']['artifact'],'coverage':finish['peer']['coverage']}
data['learnings']=[]
data['agent_native_gaps']=[{'finding':7,'title':findings[6]['title'],'source':str(RUN/'agent-native.md'),
 'note':'The revised routines request has an AI interface but omits recorded human decisions and their notes; the bounded context gap is included in the primary and validator sets.'}]
data['deployment_notes']=[]
data['requirements_completeness']={
 'plan_path':finish['plan']['path'],'plan_source':'explicit',
 'requirements':[
  {'id':'שילוב הממשק','status':'partially addressed','findings':[3,4],'evidence':'Readiness/navigation integration and joining/source preservation are implemented; raw join input in shared export and previous-entrant kit retention remain defects.'},
  {'id':'הרשאות מודל','status':'met','findings':[],'evidence':'New generic admission requires page/permission, stored polling rechecks the bound permission, and current live guards preserve ownership and token boundaries. Historical undeclared jobs are intentionally denied by the invocation constraint.'},
  {'id':'בידוד הדגמות','status':'partially addressed','findings':[2],'evidence':'Participation mounts use fresh gated storage; newly integrated routines, family bridge and custom practice still read/write ordinary owner state.'},
  {'id':'תקציב סטודיו','status':'met','findings':[],'evidence':'Native wire preparation and per-physical-call reservation under unchanged limits are implemented; root reported actual full-bank chain and denial, with the narrower optional-child 429 test gap retained separately.'},
  {'id':'כשל וביטול','status':'met','findings':[],'evidence':'Durable child IDs, retained daily charge, live guards and finalization cleanup appear in the canonical implementation and root synthetic tests.'}
 ],
 'implementation_units':[{'id':u['id'],'status':'implemented with defects' if u['id'] in ['שילוב הממשק','בידוד הדגמות'] else 'implemented'} for u in finish['plan']['implementation_units']],
 'unrequested_behavior_rules':[],
 'reverse_check_note':'Output caps, the daily/workflow/concurrency limits, gated demo persistence, navigation groups and article withdrawal are explicitly requested in the plan or invocation. No additional product-owner behavior rule was established by this synthesis. The two partial acceptance conditions correspond to retained code findings rather than wholly omitted implementation units.'
}
data['actionable_findings']=findings
data['advisory_assets']={'agent_native':str(RUN/'agent-native.md')}
selected=[f for f in findings if f['severity'] in ['P0','P1'] or (f['autofix_class'] in ['gated_auto','manual'] and f['owner']=='downstream-resolver')]
validator={
 'run_id':finish['run_id'],'run_dir':str(RUN),'selected_findings':selected,
 'skip_count':0,'skip_evidence_basis':'No verified different-provider adversarial peer with a quoted motivating line exists; same-model persona agreement never grants this shortcut.',
 'normal_cap':8,'selected_count':len(selected),'selection_rule':'Every remaining P0/P1 and every remaining actionable finding, ordered by severity and stable number.',
 'scope_context':{'mode':finish['scope']['mode'],'base':finish['scope']['base'],'head_sha':finish['scope']['head_sha'],
  'tree_is_reviewed_head':True,'reviewed_tree':'Canonical staged working tree in repo; HEAD alone is not the reviewed source. MERGE_HEAD is daaa5c419b237a309c9124fb6656b1fb79863229.',
  'repo':'C:/Users/yaels/Documents/Codex/2026-10-06/openai-docs-make-me-a-plan/work/begood',
  'diff_path':finish['scope']['diff'],'files_path':finish['scope']['files'],'constraints':finish['invocation']['constraints']},
 'template_path':str(SKILL/'references/validator-batch-template.md'),'verdicts_path':str(RUN/'validator-verdicts.json')
}
assert len(selected)==8
for name,obj in [('synthesized-findings.json',data),('validator-input.json',validator)]:
 (RUN/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
subprocess.run(['python',str(SKILL/'scripts/run-log.py'),'event','--run-dir',str(RUN),'--end','merge','--candidates',str(len(findings))],check=True,env={**os.environ,'PYTHONUTF8':'1'})
print(json.dumps({'paths':{'synthesized_findings':str(RUN/'synthesized-findings.json'),'validator_input':str(RUN/'validator-input.json')},'primary_count':len(findings),'selected_count':len(selected)},ensure_ascii=True))
