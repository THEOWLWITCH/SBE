import copy
import json
import os
import subprocess
import sys
from pathlib import Path

RUN = Path(__file__).parent
def read(name):
    return json.loads((RUN / name).read_text(encoding='utf-8-sig'))
def write(name, value):
    (RUN / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
finish = read('finish-input.json')
mechanical = read('mechanical-findings.json')
detail_entries = read('source-detail-map.json')
repo = Path(finish['scope']['repo_root'])
detail_by_key = {(e['reviewer'], *e['fingerprint']): e['source'] for e in detail_entries}

def fingerprint(f):
    return (f['file'].replace('\\', '/').lstrip('./'), str(f['line']), ' '.join(f['title'].lower().split()))

def keys_for(f):
    return [k for k in detail_by_key if k[0] in f['reviewers'] and k[1:] == fingerprint(f)]

def evidence_union(findings):
    out = []
    for finding in findings:
        for evidence in finding['evidence']:
            if evidence not in out:
                out.append(evidence)
    return out

def merge(candidates, title, why, fix):
    candidate = copy.deepcopy(max(candidates, key=lambda f: f['confidence']))
    candidate.pop('#', None)
    candidate.update({
        'title': title,
        'severity': min((f['severity'] for f in candidates), key=lambda s: int(s[1])),
        'reviewers': sorted({r for f in candidates for r in f['reviewers']}),
        'independent_reviewers': sorted({r for f in candidates for r in f['independent_reviewers']}),
        'autofix_class': 'manual' if any(f['autofix_class'] == 'manual' for f in candidates) else 'gated_auto',
        'owner': 'downstream-resolver',
        'evidence': evidence_union(candidates),
        'why_it_matters': why,
        'suggested_fix': fix,
    })
    return candidate, [k for f in candidates for k in keys_for(f)]

source_keys = {}
details = {}
reconciled = []
cancel_candidates = [f for f in mechanical['findings'] if f['file'] == 'harness/lib/studio.mjs' and f['line'] == 379]
cancel, cancel_keys = merge(cancel_candidates,
    'Cancelling a Studio repair leaves provider work running',
    'Cancelling, expiring or revoking a job during the new validation repair aborts the job controller and can release its usage reservation, but the repair fetch listens only to a separate 180-second timeout. Paid provider work can continue after cancellation. The server checks current access before another request and before committing a result, so this claim concerns the already in-flight request, not stale output publication or starting a repair after cancellation. The direct repair regression does not exercise this lifecycle boundary.',
    'Link every ask request to the incoming job signal and its timeout, check cancellation before submission, and propagate cancellation instead of swallowing it as null. Through createPracticeServer, pause an invalid-first/valid-repair request, cancel the job while the repair is pending, and assert its provider signal aborts, no continuation starts and no activity is committed; retain the live permission checks.')
reconciled.append(cancel)
source_keys[fingerprint(cancel)] = cancel_keys
details[fingerprint(cancel)] = cancel

export = next(f for f in mechanical['findings'] if f['file'] == 'app/lib/team-learning-lab-ui.js')
rejections = [{
    'reviewer': 'api-contract', 'title': export['title'], 'file': export['file'], 'line': export['line'],
    'disposition': 'rejected-during-synthesis',
    'reason': 'The claim assumes a consumer that imports the sharing JSON as a complete activity. The inspected publicPack and UI consumers do not advertise that import/validation contract. The explicit plan requires source opt-out from JSON while keeping the frozen approval complete; the export mutates only a freshly validated clone. No current consumer breakage or significant maintenance consequence was established, so the proposed new version/discriminator is an unsupported contract expansion.',
    'evidence': [
        'app/lib/team-learning-lab-ui.js:413-417: pack() returns T.publicPack; only its local p.sources and p.activity.sources are emptied for the explicitly selected JSON sharing export.',
        'app/lib/team-learning-lab.js:233-237: publicPack constructs a new validated context/activity object from the frozen approval; it is not an import API.',
        'docs/team-learning-lab-plan.md:44,54 explicitly requires PDF/JSON source attachment to be opt-in and the frozen approval to remain complete when JSON omits sources.',
        'Text reference inspection found validateActivity used for draft generation, approvals, evidence reconstruction, proposals and demo rendering, with no public-pack JSON ingestion consumer in the reviewed repository. This is a repository-bounded consumer inspection, not an assertion about unknown external integrations.',
        'Discriminating tests on HEAD 4452201 plus the frozen local integration, Node v20.19.1, synthetic in-memory browser fixture: approved sources controls plus switching frozen approval tests passed (2 pass, 29 skipped). Actual JSON Blob export omits sources by default and leaves serialized approvals identical; this verifies the specified sharing behavior, not an external import contract.',
    ]
}]

for f in mechanical['findings']:
    if f in cancel_candidates or f is export:
        continue
    clean = copy.deepcopy(f)
    clean.pop('#', None)
    original_keys = keys_for(f)
    assert original_keys
    original = detail_by_key[original_keys[0]]
    clean['why_it_matters'] = original['why_it_matters']
    clean['suggested_fix'] = original.get('suggested_fix', clean.get('suggested_fix'))
    if clean['line'] == 389:
        actual = (repo / clean['file']).read_text(encoding='utf-8-sig').splitlines()[388]
        clean['first_evidence'] = f"{clean['file']}:389: {actual}"
        clean['evidence'][0] = clean['first_evidence']
        clean['evidence'].append('Scope evidence: b7c85b1 permits at most initial generation plus customer review/revision; the added validation repair creates a fourth sequential 180-second request, while the browser still polls for nine minutes. Incidence of four slow successful responses was not measured.')
    reconciled.append(clean)
    source_keys[fingerprint(clean)] = original_keys
    details[fingerprint(clean)] = clean

continuity_candidates = [f for f in mechanical['pre_existing_findings'] if f['file'] == 'app/lib/demo-hook.js']
continuity, continuity_keys = merge(continuity_candidates,
    'Continuity demos read, replace and upload private kit data',
    'An authorized embedded continuity demo opens the ordinary owner-scoped store, replaces only the sample form and generated folders, and retains private local data. The generic input summary can capture rendered sensitive rows before the kit is cleared, while whole-kit HTML capture retains roster links and letter/contact text. demoSave receives that captured input and HTML; the sample also writes to the regular private draft. The identical continuity UI and recipe are already in c187604 and unrelated to the local reconciliation, so this remains an upstream-only finding outside the primary integration verdict.',
    'Under the existing administrator/embed/demolab gate, initialize continuity with a fresh in-memory state/store before any ordinary private read. Scope demo summaries to the sample form, exclude sensitive nodes, and capture an explicitly shareable output node. Verify successful and failed demos leave seeded regular storage byte-identical with zero regular reads/writes and send no roster, contact or medical sentinels to demoSave.')
continuity['evidence'].append('Independent merge-leaf repro: HEAD 4452201 plus the frozen integration; Node v20.19.1; synthetic private marker; node --preserve-symlinks --preserve-symlinks-main --test harness/tests/continuity-demo-isolation.test.mjs. Authorized embedded demo expected zero ordinary private reads and observed one (1 failed); standalone, non-admin and ordinary embedded controls passed (3 passed). This untracked deliberate red test is evidence only, excluded from reviewed source; it does not replace or invalidate the reported 296/296 tracked-suite baseline.')
continuity['evidence'].append('Merge-leaf provenance check: git diff --exit-code c187604 -- app/lib/continuity-kit-ui.js returned no diff; c187604:app/lib/demo-hook.js has the identical continuity recipe at line 131, attributed by blame to c46203a7 (Claude, 2026-10-09). The reviewed recipe is at line 140 because the team-lab recipe changed neighboring lines.')
reconciled.append(continuity)
source_keys[fingerprint(continuity)] = continuity_keys
details[fingerprint(continuity)] = continuity
for f in mechanical['pre_existing_findings']:
    if f in continuity_candidates:
        continue
    clean = copy.deepcopy(f)
    original_keys = keys_for(f)
    original = detail_by_key[original_keys[0]]
    clean['why_it_matters'] = original['why_it_matters']
    clean['suggested_fix'] = original.get('suggested_fix', clean.get('suggested_fix'))
    reconciled.append(clean)
    source_keys[fingerprint(clean)] = original_keys
    details[fingerprint(clean)] = clean

assert not mechanical['suppressed_findings']
synthetic = [{'reviewer': 'synthesis', 'independence_verified': False, 'findings': reconciled, 'residual_risks': [], 'testing_gaps': []}]
write('reconciled-returns.json', synthetic)
with (RUN / 'reconciled-returns.json').open('rb') as stdin, (RUN / 'mechanical-findings-final.json').open('wb') as stdout:
    subprocess.run([sys.executable, str(Path(finish['skill_dir']) / 'scripts' / 'findings-mechanics.py')], stdin=stdin, stdout=stdout, check=True, env={**os.environ, 'PYTHONUTF8': '1'})
final = read('mechanical-findings-final.json')
assert final['malformed_findings'] == 0 and final['malformed_returns'] == 0
for f in final['findings'] + final['pre_existing_findings']:
    key = fingerprint(f)
    source = details[key]
    f['why_it_matters'] = source['why_it_matters']
    f['evidence'] = source['evidence']
    f['source_detail_keys'] = [list(k) for k in source_keys[key]]
    # Do not treat the synthetic reconciliation identity as a reviewer.
    f['reviewers'] = [r for r in f['reviewers'] if r != 'synthesis']
    f['independent_reviewers'] = [r for r in f['independent_reviewers'] if r != 'synthesis']
    assert f['why_it_matters'] and f['evidence'] and f['reviewers']
    assert not any(0xD800 <= ord(ch) <= 0xDFFF for e in f['evidence'] for ch in e)

write('merge-judgments.json', {'rejected_claims': rejections, 'semantic_duplicate_merges': 4, 'settlement_discards': 0, 'source_detail_keys_preserved': True})
write('synthesis-working-findings.json', final)
print(json.dumps({'primary': len(final['findings']), 'pre_existing': len(final['pre_existing_findings']), 'summary': [{'number': f['#'], 'severity': f['severity'], 'reviewers': f['reviewers'], 'confidence': f['confidence'], 'line': f['line']} for f in final['findings']]}))
