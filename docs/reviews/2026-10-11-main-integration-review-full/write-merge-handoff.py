import copy
import hashlib
import json
import subprocess
import sys
from pathlib import Path

RUN = Path(__file__).parent
def read(name):
    return json.loads((RUN / name).read_text(encoding='utf-8-sig'))
def write(name, value):
    (RUN / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

finish = read('finish-input.json')
final = read('synthesis-working-findings.json')
initial = read('mechanical-findings.json')
judgments = read('merge-judgments.json')
snapshot = read('merge-snapshot-evidence.json')
scope = copy.deepcopy(finish['scope'])
scope['scope_mode'] = scope['mode']
scope['reviewed_tree'] = 'HEAD 44522014186a731d2ebab0825d54a2f803168aca plus the frozen tracked local integration, verified against all 53 snapshot hashes; HEAD alone is not the reviewed source.'
scope['remote_head_ref'] = None
scope['integrated_main'] = 'c187604'
scope['excluded_newer_main'] = 'daaa5c4'
scope['snapshot_hashes_path'] = finish['scope']['context']
scope['merge_snapshot_verification_path'] = str(RUN / 'merge-snapshot-evidence.json')
scope['scope_mode_resolution'] = snapshot['scope_mode_resolution']
scope['diff_path'] = finish['scope']['diff']
scope['changed_files_path'] = finish['scope']['files']

# Verify the final batch still addresses the frozen reviewed tree.
repo = Path(scope['repo_root'])
context = read('scope-context.json')
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip() == scope['head_sha']
for rel, expected in context['snapshot_hashes'].items():
    assert hashlib.sha256((repo / rel).read_bytes()).hexdigest() == expected, rel

for finding in final['findings']:
    if finding['line'] == 379:
        finding['evidence'] = [e for e in finding['evidence'] if 'integration adds a cancellable first' not in e and 'local Studio cancellation integration adds the signal contract' not in e]
        finding['evidence'].append('Merge-leaf base inspection: b7c85b1 already has the initial requestController linked to the job signal, and already has a timeout-only ask inside customer review. The material new delta moves ask outward and invokes it for validation repair before customer review, including STUDIO_CUSTOMER_REVIEW=off. The new caller directly depends on the old helper, making this newly exposed repair failure primary without repeating the earlier first-request fix.')
    if finding['line'] == 378:
        finding['evidence'].append('Merge-leaf base inspection: the timeout-only, uncapped ask helper already exists inside the b7c85b1 customer-review block. The newly added validation-repair caller uses that helper even with customer review disabled; the current finding is its newly exposed interaction with the unchanged 128000-token Studio wrapper, not a claim that every uncapped continuation originated in this delta.')

selected = [f for f in final['findings'] if f['severity'] in ['P0', 'P1'] or (f['autofix_class'] in ['gated_auto', 'manual'] and f['owner'] == 'downstream-resolver')]
selected.sort(key=lambda f: (int(f['severity'][1]), f['#']))
assert len(final['findings']) == 3 and len(selected) == 3
assert [f['#'] for f in selected] == [1, 2, 3]
assert all(f['first_evidence'] and f['why_it_matters'] and f['evidence'] for f in final['findings'] + final['pre_existing_findings'])

groups = [{
    'title': 'Bound Studio repair work', 'findings': [1, 2, 3], 'type': 'apply-queue',
    'context': 'The new validation-repair caller adds another paid continuation to the Studio job lifecycle.',
    'preferred_resolution': 'Link continuation cancellation (#1), cap and account provider output (#2), then bound the whole sequence or retain resumable polling (#3); verify each through the authenticated Studio job wrapper.',
    'why': 'These are distinct cancellation, budget and deadline defects in the same new repair path. Sharing the lifecycle helper and integration fixture prevents one fix from bypassing another bound.'
}]
testing_gaps = ['The authenticated /api/studio wrapper still needs a real handleStudio invalid-first/valid-repair success case within its cumulative 128000 allowance. Current server-transport Studio tests inject a studioHandler result, and studio-backend repair tests call handleStudio directly. This is the successful-admission case beyond the cancellation and over-budget failure scenarios already required by #1 and #2.']

coverage = copy.deepcopy(finish['coverage_notes'])
coverage.extend([
    finish['peer']['coverage'],
    'Merge-leaf snapshot verification: HEAD stayed 4452201 and all 53 recorded changed-path SHA-256 hashes matched both before synthesis and before writing the validator handoff. The source overlay is frozen; scope is standalone, superseding the old local-aligned label in scope-context.json.',
    'Mechanics: 11 raw findings became 3 primary and 3 pre-existing findings after four semantic duplicate collapses and one evidence-based synthesis rejection. Suppressed-by-confidence: 0; malformed findings/returns: 0; first_evidence backfilled: 0; 75/100 quote demotions: 0; mode-aware soft-bucket demotions: 0; settled preference discards: 0.',
    'Same-serving-model agreement is attribution only: cancellation has testing, reliability and in-process adversarial corroboration, but no cross-model confidence promotion or validator shortcut was applied.',
    'One source-export contract claim was rejected during synthesis: the explicit plan requires default source omission from sharing JSON, frozen approval stays complete, and no inspected consumer accepts sharing JSON through validateActivity. The unsupported claim is absent from primary findings and soft buckets; the evidence and exact source claim remain in merge-judgments.json and reviewer artifacts.',
    'The merge leaf reran the excluded continuity isolation test using Node v20.19.1: one expected zero-read assertion failed with one ordinary private read, and three non-demo guards passed. This is deliberate red diagnostic evidence for the upstream-only finding, separate from the root-reported 296/296 tracked baseline.',
    'Two focused actual-UI source-selection tests passed on the frozen source with synthetic storage: source omission does not mutate frozen approvals and switching approvals resets attachment. This is a focused discriminating check, not a new full-suite claim.',
    'Three primary findings are selected in one deterministic severity/#-ordered validator batch; no findings qualify for the quote-anchored different-provider corroboration shortcut. Validator launch and outcomes belong to the dispatch context and are not claimed here.',
    'All retained primary/pre-existing findings have hydrated why_it_matters and evidence plus their original source-detail keys. Exact compact dispatch returns are restored byte-for-byte in raw-returns.json; hydrated-returns.json is the initial helper input, and reconciled-returns.json is the final helper input.',
    'The Team Learning Lab agent-native review found no new capability/context gap. Its upstream continuity observation is preserved with the deduplicated pre-existing finding; the exact prose remains in agent-native.md.',
])

counts = {
    'raw_findings': 11, 'primary_findings': 3, 'pre_existing_findings': 3,
    'semantic_duplicates_merged': 4, 'synthesis_rejections': 1,
    'suppressed_by_confidence': initial['suppressed_by_confidence'],
    'suppressed_count': len(initial['suppressed_findings']),
    'malformed_findings': initial['malformed_findings'] + final['malformed_findings'],
    'malformed_returns': initial['malformed_returns'] + final['malformed_returns'],
    'first_evidence_backfilled': initial['first_evidence_backfilled'] + final['first_evidence_backfilled'],
    'missing_first_evidence_demoted': 0, 'mode_aware_demotions': 0,
    'settlement_discards': 0, 'validator_selected': 3, 'validator_shortcut_skipped': 0,
    'failed_reviewers': finish['collection']['failed_reviewers'], 'bound_exceeded': finish['collection']['bound_exceeded'],
}
agent_native = Path(finish['collection']['unstructured_returns'][0]['path']).read_text(encoding='utf-8-sig')
synthesized = {
    'status': 'complete', 'run_id': finish['run_id'],
    'findings': final['findings'], 'pre_existing_findings': final['pre_existing_findings'],
    'actionable_findings': selected, 'residual_risks': [], 'testing_gaps': testing_gaps,
    'triage_groups': groups, 'coverage': counts, 'coverage_notes': coverage,
    'suppressed_by_confidence': initial['suppressed_by_confidence'],
    'first_evidence_backfilled': counts['first_evidence_backfilled'],
    'mode_aware_demotions': 0, 'malformed_findings': counts['malformed_findings'],
    'malformed_returns': counts['malformed_returns'],
    'synthesis_rejections': judgments['rejected_claims'],
    'peer_fold_in': finish['peer'], 'scope_context': scope,
    'plan': finish['plan'], 'intent': finish['intent'], 'roster': finish['roster'],
    'source_detail_map_path': str(RUN / 'source-detail-map.json'),
    'mechanics_path': str(RUN / 'mechanical-findings-final.json'),
    'advisory_assets': [{'reviewer': 'agent-native', 'path': finish['collection']['unstructured_returns'][0]['path'], 'exact_return': agent_native, 'new_gaps': []}],
    'agent_native_gaps': [], 'learnings': [], 'deployment_notes': [],
    'validation_selection': {'selected_numbers': [1, 2, 3], 'selected_count': 3, 'skip_count': 0, 'skip_evidence_basis': 'No attested different-provider peer artifact exists; all local reviewers share one serving family.'},
}

validator = {
    'run_id': finish['run_id'], 'run_dir': str(RUN),
    'selected_findings': selected, 'selected_numbers': [1, 2, 3],
    'primary_count': 3, 'selected_count': 3, 'skip_count': 0, 'shortcut_skipped': [],
    'skip_evidence_basis': 'No finding has both an ordinary reviewer and an adversarial-provider artifact with independence_verified:true. Same-model agreement never licenses a shortcut.',
    'normal_batch_cap': 8, 'cap_expanded_for_blockers': False,
    'ordering': 'severity then stable #',
    'scope_context': scope,
    'scope_mode_and_remote_refs': 'standalone; base b7c85b18011f824a86669c98ced19404e85736f0; reviewed tree is HEAD 44522014186a731d2ebab0825d54a2f803168aca plus frozen tracked local changes, not HEAD alone. Read current workspace source, which matches all 53 saved hashes. No remote-head ref. Integrated main through c187604 only; daaa5c4 is excluded. The old local-aligned label in scope-context.json is superseded by finish-input.json. Review scope excludes the three listed untracked files; the continuity repro is evidence only.',
    'diff': finish['scope']['diff'], 'changed_files': finish['scope']['files'],
    'repository': scope['repo_root'], 'intent': finish['intent'], 'plan': finish['plan'],
    'constraints': finish['invocation']['constraints'],
    'required_scope_evidence': {
        'finish_contract_path': str(RUN / 'finish-input.json'),
        'scope_context_path': finish['scope']['context'],
        'snapshot_verification_path': str(RUN / 'merge-snapshot-evidence.json'),
        'changed_file_count': 53, 'changed_lines': 2123, 'executable_lines': 1479, 'executable_non_test_lines': 1012,
        'verified_hash_count': 53, 'hash_mismatches': [],
        'runtime': 'Node v20.19.1',
        'baseline': 'Root reports tracked suite 296/296 passed before the separate deliberate red continuity repro; the merge leaf does not claim to have rerun that full suite.',
        'upstream_provenance': 'Continuity UI matches c187604 byte-for-byte; its recipe is unchanged at c187604:app/lib/demo-hook.js:131. Its three deduplicated findings remain pre-existing and are absent from this validator batch.',
        'repair_provenance': 'Initial linked requestController and customer-review ask already exist at b7c85b1. The new validation-repair caller directly depends on the timeout-only/uncapped helper even when STUDIO_CUSTOMER_REVIEW=off; validate this new interaction, not the earlier first-request fixes.',
        'cancellation_boundary': 'practice-server.mjs:145-152 checks current job/access before provider submission and after JSON read, passing options unchanged to native fetch. These guards prevent later calls and stale commit, and must be distinguished from aborting the repair fetch already in flight.',
        'newer_main_excluded': 'daaa5c4 advanced after dispatch and requires integration/review before main merge or deployment.',
    },
    'budget': {'wall_clock_minutes': 15, 'approximate_tool_calls_per_finding': 5},
    'validator_verdicts_path': str(RUN / 'validator-verdicts.json'),
    'validator_prompt_template': str(Path(finish['skill_dir']) / 'references' / 'validator-batch-template.md'),
    'mutation_authority': 'Read-only source inspection and non-mutating synthetic reproductions; write only validator-verdicts.json. No fixes, staging, commits, pushes, PR or deploy actions.',
}

# Preserve both helper inputs while restoring the exact dispatch return contract.
(RUN / 'hydrated-returns.json').write_bytes((RUN / 'raw-returns.json').read_bytes())
(RUN / 'raw-returns.json').write_bytes((RUN / 'raw-returns-exact.json').read_bytes())
assert (RUN / 'raw-returns.json').read_bytes() == (RUN / 'raw-returns-exact.json').read_bytes()
write('synthesized-findings.json', synthesized)
write('validator-input.json', validator)
assert read('synthesized-findings.json')['findings'] == read('validator-input.json')['selected_findings']
subprocess.run([sys.executable, str(Path(finish['skill_dir']) / 'scripts' / 'run-log.py'), 'event', '--run-dir', str(RUN), '--end', 'merge', '--candidates', '3'], check=True)
print(json.dumps({'synthesized_findings_path': str(RUN / 'synthesized-findings.json'), 'validator_input_path': str(RUN / 'validator-input.json'), 'primary_count': 3, 'selected_count': 3}))
