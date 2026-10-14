// Local-only secret audit. Reports identifiers/locations, never secret values.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const repo = resolve(option('--repo') || '.'), binary = option('--gitleaks'), output = option('--output');
if (!binary || !output) throw Error('Usage: security-audit.mjs --repo PATH --gitleaks PATH --output NEW_REPORT.json');
function git(argv, input) {
  const r = spawnSync('git', ['-C', repo, ...argv], { input, maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  if (r.status !== 0 || r.error) throw Error('Git audit operation failed: ' + argv[0]);
  return r.stdout;
}
const workspace = await mkdtemp(join(tmpdir(), 'be-good-secret-audit-'));
try {
  const run = async (argv, name, input) => {
    const report = join(workspace, name + '.json');
    const r = spawnSync(binary, [...argv, '--redact=100', '--no-banner', '--exit-code=23', '--report-format=json', '--report-path', report], {
      input, cwd: repo, windowsHide: true, maxBuffer: 4 * 1024 * 1024
    });
    if (![0, 23].includes(r.status) || r.error) throw Error('Secret scanner failed: ' + name);
    let rows;
    try { rows = JSON.parse(await readFile(report, 'utf8')); } catch { throw Error('Secret scanner report unreadable: ' + name); }
    if (!Array.isArray(rows)) throw Error('Secret scanner report invalid');
    return { exitCode: r.status, stderrPresent: !!r.stderr.length,
      findings: rows.map(row => ({ rule: row.RuleID, file: row.File, commit: row.Commit, line: row.StartLine, fingerprint: row.Fingerprint })) };
  };
  const canary = await run(['stdin'], 'canary', 'const token = "ghp_' + 'ABCDefgh1234'.repeat(4).slice(0, 36) + '";');
  if (!canary.findings.length) throw Error('Scanner canary did not detect synthetic secret');
  const history = await run(['git', '--log-opts=--all --full-history --no-textconv', repo], 'history');
  const current = await run(['dir', repo], 'current');
  const objects = git(['rev-list', '--objects', '--all']).toString('utf8').trim().split('\n');
  const paths = new Map(objects.map(line => [line.slice(0, 40), line.slice(41)]));
  const names = [...paths.keys()];
  const types = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], names.join('\n') + '\n').toString('utf8').trim().split('\n');
  const blobs = types.filter(line => line.split(' ')[1] === 'blob').map(line => line.split(' ')[0]);
  const batch = git(['cat-file', '--batch'], blobs.join('\n') + '\n');
  let offset = 0;
  const nativeFindings = [];
  const payloads = [];
  for (const oid of blobs) {
    const end = batch.indexOf(10, offset);
    if (end < 0) throw Error('Incomplete Git blob audit');
    const header = batch.subarray(offset, end).toString('ascii').split(' ');
    const size = Number(header[2]);
    if (header[0] !== oid || header[1] !== 'blob' || !Number.isSafeInteger(size) || size < 0 || end + 1 + size >= batch.length) throw Error('Invalid Git blob audit');
    const bytes = batch.subarray(end + 1, end + 1 + size); offset = end + 2 + size;
    if (bytes.includes(0)) continue;
    const text = bytes.toString('utf8');
    payloads.push('\nAUDIT_BLOB ' + oid + '\n' + text);
    const rules = [
      ['builtin-management-password', /DEFAULT_PASSWORDS\s*=\s*\{[^}]*\b(?:sys|inst)\s*:\s*['"][^'"]+['"]/g],
      ['private-key-material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
      ['provider-secret', /\b(?:sk-ant-[a-zA-Z0-9_-]{20,}|sk-proj-[a-zA-Z0-9_-]{30,})\b/g]
    ];
    for (const [rule, pattern] of rules) for (const match of text.matchAll(pattern)) nativeFindings.push({ rule, file: paths.get(oid), blob: oid,
      line: text.slice(0, match.index).split('\n').length, fingerprint: createHash('sha256').update(oid + ':' + rule + ':' + match.index).digest('hex') });
    for (const match of text.matchAll(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g)) {
      try { if (JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString()).role === 'service_role') nativeFindings.push({ rule: 'supabase-service-role', file: paths.get(oid), blob: oid, line: text.slice(0, match.index).split('\n').length }); } catch { /* not a valid JWT payload */ }
    }
  }
  if (offset !== batch.length) throw Error('Git blob audit coverage mismatch');
  // An independent stdin scan over every reachable text blob protects against
  // history-diff omission and git log/textconv errors silently treated as clean.
  const allBlobs = await run(['stdin'], 'all-blobs', payloads.join('\n'));
  const report = { format: 'be-good-security-audit/v1', generatedAt: new Date().toISOString(),
    scanner: 'gitleaks 8.30.1', canaryPassed: true, refs: git(['for-each-ref', '--format=%(refname) %(objectname)']).toString().trim().split('\n'),
    reachableObjects: objects.length, blobsExamined: blobs.length, history, current, allBlobs,
    nativeFindings, limits: ['Pattern matching cannot prove absence of every secret.', 'Stored findings contain locations only.', 'History includes fetched refs, not inaccessible provider copies.'] };
  await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  process.stdout.write(JSON.stringify({ canaryPassed: true, reachableObjects: objects.length, blobsExamined: blobs.length,
    historyFindings: history.findings.length, currentFindings: current.findings.length, allBlobFindings: allBlobs.findings.length,
    nativeFindings: nativeFindings.length }) + '\n');
} finally { await rm(workspace, { recursive: true, force: true }); }
