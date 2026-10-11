import copy
import datetime
import hashlib
import json
import pathlib
import subprocess
import sys

run_dir = pathlib.Path(__file__).resolve().parent
load = lambda name: json.loads((run_dir / name).read_text(encoding='utf-8'))
finish = load('finish-input.json')
synthesis = load('synthesized-findings.json')
outcome = load('validator-outcome.json')
verdicts = load('validator-verdicts.json')['verdicts']
batch = load('validator-input.json')
assert finish['mode'] == {'agent': True, 'apply_local': False, 'grouping': 'auto', 'depth': 'full'}
assert outcome['outcome'] == 'verdicts'
assert len(verdicts) == 8 and {v['#'] for v in verdicts} == set(range(1, 9))
assert all(set(v) == {'#', 'status', 'protected_subject', 'reason'} for v in verdicts)
assert all(v['status'] == 'confirmed' and isinstance(v['reason'], str) and v['reason'] for v in verdicts)
subjects = {'memory-safety', 'concurrency', 'data-loss', 'authorization-authentication', 'injection', 'public-contract', 'secrets-exposure', 'cryptography'}
assert all(v['protected_subject'] is None or v['protected_subject'] in subjects for v in verdicts)
by_number = {v['#']: v for v in verdicts}

# Retain hydrated impact and proposed responses. Present the quoted anchor and
# discriminating proof instead of repeating equivalent source excerpts from
# every contributing lens. Full merged evidence remains in synthesis.
selected_evidence = {
    1: [0, 2, 6, 12, 14],
}
findings = copy.deepcopy(synthesis['findings'])
assert len(findings) == 8
for finding in findings:
    number = finding['#']
    source_evidence = finding['evidence']
    if number == 2:
        prefixes = [
            'app/lib/routines-ui.js:32 --',
            'app/lib/family-bridge-ui.js:30 --',
            'Read-only synthetic in-memory VM:',
            'app/practice.html:1945 --',
            'app/lib/demo-hook.js:327-342:',
            'app/lib/demo-hook.js:324 --',
        ]
        finding['evidence'] = [next(e for e in source_evidence if e.startswith(prefix)) for prefix in prefixes]
    elif number in selected_evidence:
        finding['evidence'] = [source_evidence[i] for i in selected_evidence[number]]
    else:
        seen = set()
        finding['evidence'] = []
        for evidence in source_evidence:
            normalized = ' '.join(evidence.split())
            if normalized not in seen:
                seen.add(normalized)
                finding['evidence'].append(evidence)
    verdict = by_number[number]
    finding['validation_status'] = verdict['status']
    finding['validation_reason'] = verdict['reason']
    finding['protected_subject'] = verdict['protected_subject']
    assert finding['first_evidence'] in finding['evidence']
    assert finding['why_it_matters'] and finding['evidence']
    assert finding['owner'] == 'downstream-resolver'
    assert finding['autofix_class'] in {'gated_auto', 'manual'}

coverage = copy.deepcopy(synthesis['coverage'])
coverage['validator_status'] = 'verdicts'
coverage['validator_outcome'] = {
    'batch_count': 1,
    'selected': 8,
    'confirmed': 8,
    'rejected': 0,
    'unresolved': 0,
    'malformed': 0,
    'failed': 0,
    'shortcut_skipped': 0,
    'bound_exceeded': False,
    'verdicts_artifact': str(run_dir / 'validator-verdicts.json').replace('\\', '/'),
    'unmeasured_outcome': [7],
    'note': 'All eight verdicts landed in one bounded batch and matched their stable numbers. The validator independently executed the staged UI/functions with deferred synthetic requests or existing synthetic DOM fixtures on Node v20.19.1. For #7 the missing decision context was captured; resulting provider advice was not measured.',
}
coverage['protected_subject_reclassifications'] = []
coverage['degraded_blockers'] = []
coverage['report_leaf_classification'] = {
    '1': 'concurrency',
    '2': 'secrets-exposure',
    '3': 'secrets-exposure',
    '4': 'secrets-exposure',
    '5': 'concurrency',
    '6': 'concurrency',
    '7': None,
    '8': 'concurrency',
    'note': 'The report leaf classified every input before reading verdicts. The validator additionally classified #1 and #2 as data-loss; both forms of protection remain applicable. Every verdict is confirmed, so classification caused no routing change or rejected-claim override.',
}
coverage['mode'] = 'agent report-only'
coverage['roster_justifications'] = finish['roster']['selected']
coverage['notes'] = copy.deepcopy(finish['coverage_notes']) + [finish['peer']['coverage']]
coverage['notes'].append('Stage 5b step 5 retained all eight confirmed findings at their original severity, confidence and action route. No rejected, unresolved, malformed or infrastructure-failed entry occurred; no validator shortcut was used. Stage 5c was skipped because mode:agent is report-only and apply_local is false. No source or Git mutation occurred.')
coverage['notes'].append('Per-finding report evidence preserves the quoted anchor and discriminating source/probe evidence; the complete contributing evidence union remains in synthesized-findings.json. All primary findings remain hydrated, and actionable_findings reuses those same report objects.')
coverage['notes'].append('The report leaf read the explicit plan and canonical surrounding source. Two acceptance conditions remain partial and are already represented by #2, #3 and #4; all five implementation units appear in the diff. No new unrequested behavior rule was identified. The verdict does not approve merge or deployment.')

report = {
    'status': 'complete',
    'verdict': 'Not ready',
    'verdict_reasoning': 'The staged integration still permits private workspace corruption and private data entering demonstrations (#1, #2). Shared continuity exports and new-entrant reset also fail explicit acceptance conditions (#3, #4). All five implementation units are present, but the interface and demo requirements are only partially satisfied. Resolve the two P1 findings first, then the remaining confirmed P2 findings, and rerun the affected synthetic checks. Passing root tests do not establish browser, live-model, production or educational readiness.',
    'fix_order': [2, 1, 3, 4, 5, 6, 8, 7],
    'scope': {
        'base': finish['scope']['base'],
        'branch': finish['scope']['branch'],
        'head_sha': finish['scope']['head_sha'],
        'pr_url': None,
        'files_changed': len(pathlib.Path(finish['scope']['files']).read_text(encoding='utf-8').splitlines()),
        'mode': finish['scope']['mode'],
        'reviewed_snapshot': {
            'kind': 'canonical staged working tree',
            'base_head': finish['scope']['head_sha'],
            'merge_head': 'daaa5c419b237a309c9124fb6656b1fb79863229',
            'description': 'Staged main integration plus root-owned local fixes and tests; HEAD alone is not the reviewed source.',
            'full_diff_sha256': hashlib.sha256(pathlib.Path(finish['scope']['diff']).read_bytes()).hexdigest(),
        },
        'untracked_excluded': finish['scope']['untracked_excluded'],
    },
    'intent': finish['intent']['summary'],
    'intent_confidence': finish['intent']['confidence'],
    'reviewers': [r['reviewer'] for r in finish['roster']['selected']],
    'triage_groups': synthesis['triage_groups'],
    'findings': findings,
    'requirements_completeness': synthesis['requirements_completeness'],
    'actionable_findings': findings,
    'pre_existing_findings': synthesis['pre_existing_findings'],
    'learnings': synthesis['learnings'],
    'agent_native_gaps': synthesis['agent_native_gaps'],
    'deployment_notes': synthesis['deployment_notes'],
    'residual_risks': synthesis['residual_risks'],
    'testing_gaps': synthesis['testing_gaps'],
    'coverage': coverage,
    'artifact_path': str(run_dir).replace('\\', '/'),
    'run_id': finish['run_id'],
}
assert report['scope']['files_changed'] == 59
assert {f['#'] for f in findings} == set(range(1, 9))
assert all(set(g['findings']).issubset(set(range(1, 9))) for g in report['triage_groups'])
assert report['actionable_findings'] == report['findings']
payload = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
assert all(char not in payload for char in ['\u2192', '\u00b7', '\u2500', '\u2502'])

if '--dry-run' in sys.argv:
    print(payload, end='')
else:
    # Only scratch review artifacts are written. summarize is the last write.
    (run_dir / 'review.json').write_text(payload, encoding='utf-8', newline='\n')
    metadata = {
        'run_id': finish['run_id'],
        'branch': finish['scope']['branch'],
        'head_sha': finish['scope']['head_sha'],
        'verdict': report['verdict'],
        'completed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'reviewed_snapshot': report['scope']['reviewed_snapshot'],
        'review_sha256': hashlib.sha256(payload.encode('utf-8')).hexdigest(),
    }
    (run_dir / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    logger = pathlib.Path(finish['skill_dir']) / 'scripts' / 'run-log.py'
    subprocess.run([sys.executable, str(logger), 'event', '--run-dir', str(run_dir), '--end', 'report', '--candidates', '8'], check=True, stdout=subprocess.DEVNULL)
    subprocess.run([sys.executable, str(logger), 'summarize', '--run-dir', str(run_dir)], check=True, stdout=subprocess.DEVNULL)
    print(payload, end='')
