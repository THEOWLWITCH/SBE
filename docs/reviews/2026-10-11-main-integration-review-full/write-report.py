import json
import hashlib
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone

RUN = Path('C:/Users/yaels/Documents/Codex/2026-10-06/openai-docs-make-me-a-plan/work/review-artifacts/ce-code-review/20261010-111543-e72b7705')
def read(name):
    return json.loads((RUN / name).read_text(encoding='utf-8-sig'))
def write(name, value):
    (RUN / name).write_text(json.dumps(value, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')

finish = read('finish-input.json')
synth = read('synthesized-findings.json')
outcome = read('validator-outcome.json')
verdicts = json.loads(Path(outcome['verdicts']).read_text(encoding='utf-8-sig'))['verdicts']
selection = read('validator-input.json')
source = read('report-source-evidence.json')
classification = read('report-protected-classification.json')
test_evidence = read('test-evidence.json')
assert finish['mode']['agent'] and not finish['mode']['apply_local']
assert source['head_sha'] == finish['scope']['head_sha']
assert source['verified_hash_count'] == 53 and not source['hash_mismatches']
assert source['mandatory_source_double_encoded_bytes'] == 154870
assert source['minimal_request_json_bytes'] > source['studio_job_budget']
assert outcome['outcome'] == 'verdicts'
assert [v['#'] for v in verdicts] == selection['selected_numbers'] == [1, 2, 3]
assert all(v['status'] == 'rejected' for v in verdicts)
assert all(v['protected_subject'] in (None, 'concurrency') for v in verdicts)

# Verify the frozen overlay once more immediately before writing the receipt.
repo = Path(finish['scope']['repo_root'])
scope = json.loads(Path(finish['scope']['context']).read_text(encoding='utf-8-sig'))
for path, expected in scope['snapshot_hashes'].items():
    assert hashlib.sha256((repo / path).read_bytes()).hexdigest() == expected, path
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip() == finish['scope']['head_sha']
for reviewer in finish['roster']['selected']:
    suffix = '.md' if reviewer['reviewer'] == 'agent-native' else '.json'
    assert (RUN / (reviewer['reviewer'] + suffix)).is_file()

validation_results = []
own_subjects = {v['#']: v['protected_subject'] for v in classification['classifications']}
for verdict in verdicts:
    finding = next(f for f in synth['findings'] if f['#'] == verdict['#'])
    validation_results.append({**verdict, 'title': finding['title'], 'severity': finding['severity'],
        'consumer_protected_subject': own_subjects[verdict['#']], 'citation_verified': True,
        'disposition': 'dropped', 'verification_evidence': 'report-source-evidence.json'})

requirements = [
    {'id':'R1','requirement':'Offer at least two approaches, permit one choice, restrict staff approaches, and retain all five age bands, both audiences and emergency/online combinations.','status':'met','evidence':['The existing domain/catalogue remains in place; the reviewed UI integration and domain/UI baseline tests retain these constraints.']},
    {'id':'R2','requirement':'Include core learning, an accessible environment, uncertainty and creativity; use only catalogue sources and qualify their evidence.','status':'met','evidence':['app/lib/team-learning-lab-ui.js:388-406 retains the qualified catalogue-based public document; complete-domain reply validation remains in the generation path.']},
    {'id':'R3','requirement':'Edit/add/remove steps, ask at every step, cancel on changed draft/identity, reject late results and adopt proposals only explicitly.','status':'met','evidence':['app/lib/team-learning-lab-ui.js:281 passes the active signal and beforeAttempt check to the shared repair helper; new UI tests exercise invalid replies and stale identity/draft behavior.','harness/tests/ai-json-repair.test.mjs:92,106,115,122,136 covers abort, identity change, late job acknowledgment and validator cancellation.']},
    {'id':'R4','requirement':'Keep approval as a separate frozen version; distinguish rehearsal from a real meeting and save tried moves only from real observations.','status':'met','evidence':['app/lib/team-learning-lab-ui.js:324-341 retains explicit frozen approval/step selection and recordPractice; actual meeting observations remain the source of saved moves.']},
    {'id':'R5','requirement':'Keep concerns/conversations out of sharing, preserve owner-scoped local storage, avoid cross-device sync claims and prevent concurrent overwrite.','status':'met','evidence':['app/lib/team-learning-lab-ui.js:412-416 exports only T.publicPack; the existing repository conflict/ownership guards and the 296-test baseline remain intact.','harness/tests/team-learning-lab-ui.test.mjs:302,318,336,349 exercises recovery, failed persistence and waiting for the newest revision.']},
    {'id':'R6','requirement':'Stop educational planning at immediate danger and include safety, participation alternatives, no forced disclosure, privacy and adult responsibility in the pack.','status':'met','evidence':['The retained domain danger check and RED_LINES remain enforced; app/lib/team-learning-lab-ui.js:480 includes those red lines in the printable pack.']},
    {'id':'R7','requirement':'Collapse sources and attach only explicitly per selected pack without changing frozen approval; repair an incomplete AI reply once and retain the draft on second failure, cancellation or identity change.','status':'met','evidence':['app/lib/team-learning-lab-ui.js:388-416 folds sources, resets attachment when approval changes and redacts only a new sharing copy.','harness/tests/team-learning-lab-ui.test.mjs:436,450,462,481,503,521 covers complete-domain repair, two invalid replies, source controls, persistence, approval switching and demo sanitization.','The merge leaf reran two source-selection checks on the frozen tree: both passed.']},
    {'id':'R8','requirement':'Use the session token, nana permission and existing async jobs; produce no substitute without AI and preserve the draft on failure.','status':'met','evidence':['The Team Learning Lab uses sbeCallAIJson over the authenticated sbeCallAI job transport and its existing nana request contract.','harness/tests/ai-json-repair.test.mjs:62 exercises malformed JSON through authenticated jobs without changing the original request.']},
    {'id':'R9','requirement':'Pass the existing/new tests, check wide/narrow screens, document independent review and give Claude files, test status and remaining live AI/professional checks.','status':'partially addressed','intentional_deferral':True,'evidence':['The saved frozen baseline passed 296/296; all ten selected local lenses and the validator completed. This receipt completes the current integration review.','Four changed handoff/verification documents received an independent standards supplement. Wide/narrow browser checks documented in docs/team-learning-lab-verification.md predate the final changes.','The user forbids further inspection of the blocked localhost UI; current download/print/wide/narrow browser validation is explicitly deferred until before publication. Live AI and professional evaluation were not authorized for this review.']}
]
units = [
    {'id':'U1','unit':'Domain contract and source/approach catalogue with behavior tests.','status':'met','evidence':'Existing implementation and domain baseline retained; new integration tests verify the complete reply contract.'},
    {'id':'U2','unit':'Accessible four-step RTL screen, questions on every activity step and explicit adoption.','status':'met','evidence':'Existing screen retained; actual UI listeners, planner/AI libraries and source controls are exercised by the expanded synthetic suite.'},
    {'id':'U3','unit':'Permissions, navigation, output metadata, article, continuation tools, examples and a real demo recipe without paid calls.','status':'met','evidence':'The reviewed delta preserves Team Learning Lab navigation/permission wiring and updates its demo sharing behavior. The isolated continuity defects remain upstream-only.'},
    {'id':'U4','unit':'Automated checks, browser checks, simplification, independent review and Claude continuation docs.','status':'partially addressed','intentional_deferral':True,'evidence':'Automated baseline, independent full review and handoff docs are present. Final browser verification is deferred under the explicit blocked-UI restriction; no unimplemented code unit was established.'}
]
completeness = {'plan_path':finish['plan']['path'],'plan_source':'explicit',
    'comparison':'New delta since b7c85b1; existing Team Learning Lab work is checked for preservation, not re-reported as missing from this integration diff.',
    'requirements':requirements,'implementation_units':units,'unaddressed_requirements':[],
    'unrequested_behavior_rules':[],
    'reverse_check':'The actual plan and reviewed diff agree on explicit source attachment, a single complete-JSON repair, private local work, frozen approval and human adoption. Upstream planner/continuity changes are part of the authorized c187604 integration. No additional unrequested Team Learning Lab behavior rule was established.'}

notes = list(dict.fromkeys(finish['coverage_notes'] + synth['coverage_notes']))
notes += [
    'Report leaf independently classified protected subjects before reading verdicts. Findings #1 and #3 are concurrency claims; #2 is output-budget enforcement. The validator agreed, and all cited guards were verified against the frozen source.',
    'The single validator batch landed within the bound: 0 confirmed, 3 rejected, 0 unresolved, 0 malformed, 0 failed, 0 shortcut-skipped. All three rejected repair claims were dropped, and their triage group was pruned.',
    'Protected rejections for #1 and #3 passed the citation check: the report leaf verified the actual server/browser wiring and independently reproduced 180 mandatory public sources contributing 154870 double-encoded bytes, already above the 128000 job budget before the initial fetch. All 53 frozen changed-path hashes and HEAD matched again immediately before the receipt.',
    'These rejections establish unreachable repair preconditions in this frozen production wrapper. They do not establish a successful Studio generation: the validator observed an error job and zero provider calls. The original successful-admission testing gap remains separately identified.',
    'Stage 5c was skipped because apply_local is false and mode:agent is report-only. Only run artifacts were written; project source, tests, staging and Git history were not changed.',
    'The scoped verdict covers integrated main through c187604 only. Newer main daaa5c4 is outside the receipt and must be integrated and reviewed before any main merge or deployment. No merge, push, PR creation or deployment authority is granted by this receipt.'
]
coverage = {**synth['coverage'],'depth':'full','mode':'agent report-only','primary_findings':0,
    'actionable_findings':0,'pre_existing_findings':3,'reviewer_roster':finish['roster']['selected'],
    'standards':finish['roster']['standards'],
    'compound_packs':{'roots':[],'warnings':finish['roster']['packs']['warnings'],'errors':finish['roster']['packs']['errors']},
    'cross_model':finish['peer'],
    'validator':{'outcome':'verdicts','selected':3,'shortcut_skipped':0,'shortcut_evidence_basis':selection['skip_evidence_basis'],
        'confirmed':0,'rejected':3,'unresolved':0,'malformed':0,'failed':0,'within_bound':True,
        'results':validation_results,'protected_subject_reclassifications':[],
        'degraded_blockers':[],'source_verification_artifact':str(RUN/'report-source-evidence.json').replace('\\','/')},
    'tracked_suite_baseline':test_evidence['frozen_baseline'],
    'baseline_scope':'Frozen tracked source before any fix; the report leaf did not rerun the full suite.',
    'deliberate_red_diagnostic':'Excluded continuity isolation test: 1 expected zero-read assertion failed with one private read; 3 normal-mode controls passed. It is upstream-only evidence, separate from the 296/296 baseline.',
    'browser':'Prior wide/narrow checks exist; final changed-tree browser/download/print validation remains deferred under the explicit blocked-UI restriction. No browser or HTTP UI inspection was performed.',
    'untracked_excluded':finish['scope']['untracked_excluded'],
    'synthesis_rejection_details':synth['synthesis_rejections'],
    'notes':notes}

pre_existing = [{k:v for k,v in f.items() if k != 'source_detail_keys'} for f in synth['pre_existing_findings']]
report = {'status':'complete','verdict':'Ready to merge',
    'verdict_reason':'No primary integration findings survive independent validation in this frozen c187604 snapshot. The three Studio continuation claims are unreachable because the production budget guard rejects the mandatory catalogue before the first fetch; successful Studio admission remains unverified. Three unchanged upstream continuity findings remain separate. Final browser verification is intentionally deferred under the user restriction. Newer main daaa5c4 still requires integration/review before main merge or deployment.',
    'scope':{'mode':'standalone','base':finish['scope']['base'],'branch':finish['scope']['branch'],
        'head_sha':finish['scope']['head_sha'],'pr_url':None,'files_changed':53,'changed_lines':2123,
        'executable_lines':1479,'executable_non_test_lines':1012,
        'reviewed_tree':'HEAD 44522014186a731d2ebab0825d54a2f803168aca plus the frozen tracked local integration; HEAD alone is not the reviewed source.',
        'main_included_through':'c187604','main_excluded':'daaa5c4'},
    'intent':finish['intent']['summary'],'intent_confidence':finish['intent']['confidence'],
    'reviewers':[r['reviewer'] for r in finish['roster']['selected']],
    'findings':[],'actionable_findings':[],'triage_groups':[],
    'pre_existing_findings':pre_existing,'requirements_completeness':completeness,
    'learnings':synth['learnings'],'agent_native_gaps':synth['agent_native_gaps'],
    'deployment_notes':synth['deployment_notes'],'residual_risks':[],
    'testing_gaps':['Successful authenticated Studio admission with actual handleStudio remains unverified. The server transport tests inject a studioHandler result, while backend repair tests bypass the job wrapper; the validator production-listener fixture hit the mandatory-source budget guard and made zero provider calls. Establish a synthetic valid-first and invalid-first/valid-repair success case through that boundary before claiming Studio generation works.'],
    'coverage':coverage,'artifact_path':str(RUN).replace('\\','/'),'run_id':finish['run_id']}

assert not report['findings'] and not report['actionable_findings'] and not report['triage_groups']
assert all(f['pre_existing'] and f['why_it_matters'] and f['evidence'] for f in pre_existing)
assert [f['severity'] for f in pre_existing] == ['P1','P2','P2']
write('validation-applied.json',{'classification':classification,'results':validation_results,'retained_numbers':[],
    'rejected_numbers':[1,2,3],'protected_subject_reclassifications':[],'removed_triage_groups':['Bound Studio repair work']})
write('final-findings.json',{'findings':[],'pre_existing_findings':pre_existing})
write('actionable-findings.json',[])
write('advisory-outputs.json',{key:report[key] for key in ['learnings','agent_native_gaps','deployment_notes','residual_risks','testing_gaps']})
write('requirements-completeness.json',completeness)
write('report-summary.json',{'status':'complete','verdict':report['verdict'],'primary':0,'actionable':0,'pre_existing':3,
    'validator':{'confirmed':0,'rejected':3,'unresolved':0,'malformed':0,'failed':0,'shortcut_skipped':0},
    'run_id':finish['run_id'],'scope':report['scope']})
payload=json.dumps(report,indent=2,ensure_ascii=True)+'\n'
(RUN/'review.json').write_text(payload,encoding='utf-8')
write('metadata.json',{'run_id':finish['run_id'],'branch':finish['scope']['branch'],'head_sha':finish['scope']['head_sha'],
    'verdict':report['verdict'],'completed_at':datetime.now(timezone.utc).isoformat()})
logger=Path(finish['skill_dir'])/'scripts/run-log.py'
subprocess.run([sys.executable,str(logger),'event','--run-dir',str(RUN),'--end','report','--candidates','0'],check=True,capture_output=True)
subprocess.run([sys.executable,str(logger),'summarize','--run-dir',str(RUN)],check=True,capture_output=True)
sys.stdout.write(payload)
