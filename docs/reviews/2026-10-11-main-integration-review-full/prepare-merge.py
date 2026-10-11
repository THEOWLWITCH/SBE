import copy
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

RUN = Path(__file__).parent
finish = json.loads((RUN / 'finish-input.json').read_text(encoding='utf-8-sig'))
repo = Path(finish['scope']['repo_root'])
skill = Path(finish['skill_dir'])
raw_path = RUN / 'raw-returns.json'
original = raw_path.read_bytes()
if not (RUN / 'raw-returns-exact.json').exists():
    (RUN / 'raw-returns-exact.json').write_bytes(original)
returns = json.loads(original.decode('utf-8-sig'))

def fingerprint(f):
    return (f['file'].replace('\\', '/').lstrip('./'), str(f['line']), ' '.join(f['title'].lower().split()))

details = []
artifacts = {}
for entry in returns:
    reviewer = entry['reviewer']
    artifact_path = RUN / (reviewer + '.json')
    artifact = json.loads(artifact_path.read_text(encoding='utf-8-sig'))
    artifacts[reviewer] = artifact
    local = {fingerprint(f): f for f in artifact['findings']}
    for finding in entry['findings']:
        source = local.get(fingerprint(finding))
        assert source is not None, (reviewer, fingerprint(finding))
        assert source.get('why_it_matters') and source.get('evidence')
        finding['evidence'] = source['evidence']
        details.append({'reviewer': reviewer, 'fingerprint': list(fingerprint(finding)), 'source': source})
(RUN / 'source-detail-map.json').write_text(json.dumps(details, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
raw_path.write_text(json.dumps(returns, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
with raw_path.open('rb') as stdin, (RUN / 'mechanical-findings.json').open('wb') as stdout:
    subprocess.run([sys.executable, str(skill / 'scripts' / 'findings-mechanics.py')], stdin=stdin, stdout=stdout, check=True, env={**os.environ, 'PYTHONUTF8': '1'})

ctx = json.loads(Path(finish['scope']['context']).read_text(encoding='utf-8-sig'))
mismatches = []
for rel, expected in ctx['snapshot_hashes'].items():
    observed = hashlib.sha256((repo / rel).read_bytes()).hexdigest()
    if observed != expected:
        mismatches.append({'file': rel, 'expected': expected, 'observed': observed})
assert not mismatches, mismatches
snapshot_evidence = {
    'head_sha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip(),
    'verified_paths': len(ctx['snapshot_hashes']),
    'snapshot_hash_mismatches': mismatches,
    'production_and_tracked_tests_unchanged': True,
    'scope_mode': finish['scope']['mode'],
    'legacy_context_mode': ctx['scope_mode'],
    'scope_mode_resolution': 'finish-input standalone supersedes the older local-aligned label in scope-context.json',
}
assert snapshot_evidence['head_sha'] == finish['scope']['head_sha']
(RUN / 'merge-snapshot-evidence.json').write_text(json.dumps(snapshot_evidence, indent=2) + '\n', encoding='utf-8')
mechanics = json.loads((RUN / 'mechanical-findings.json').read_text(encoding='utf-8'))
print(json.dumps({'primary': len(mechanics['findings']), 'pre_existing': len(mechanics['pre_existing_findings']), 'suppressed': len(mechanics['suppressed_findings']), 'malformed': mechanics['malformed_findings'], 'verified_paths': snapshot_evidence['verified_paths']}))
