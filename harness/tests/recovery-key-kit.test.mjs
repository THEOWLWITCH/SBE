import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { sealRecoveryKit, openRecoveryKit } from '../lib/recovery-key-kit.mjs';
import { startRecoveryCapture, loadWindowsRecoveryMaterial, decodeWindowsRecoveryMaterial } from '../../scripts/recovery-key-capture.mjs';

const exec = promisify(execFile), passphrase = 'synthetic-only-recovery-passphrase';
function fixture() { return { format: 'be-good-recovery-material/v1', archiveKeys: [{ id: '20261018T010203Z-a1b2c3d4', keyBase64: randomBytes(32).toString('base64') }], providerConfigurations: [{ name: 'synthetic-provider', document: { token: 'SYNTHETIC-PRIVATE-TOKEN', title: 'גיבוי בדיקה' } }] }; }

test('portable kit authenticates encrypted key/configuration material without DPAPI', async () => {
  const value = fixture(), kit = await sealRecoveryKit(value, passphrase);
  assert.deepEqual(await openRecoveryKit(kit, passphrase), value);
  const serialized = JSON.stringify(kit);
  assert.equal(serialized.includes(value.archiveKeys[0].keyBase64), false);
  assert.equal(serialized.includes('SYNTHETIC-PRIVATE-TOKEN'), false);
  assert.equal(serialized.includes(passphrase), false);
});
test('wrong passphrase, changed header/ciphertext and excessive KDF parameters fail', async () => {
  const kit = await sealRecoveryKit(fixture(), passphrase);
  await assert.rejects(openRecoveryKit(kit, 'different-synthetic-recovery-passphrase'), /authentication/);
  const changed = { ...kit, ciphertext: (kit.ciphertext[0] === 'A' ? 'B' : 'A') + kit.ciphertext.slice(1) };
  await assert.rejects(openRecoveryKit(changed, passphrase), /authentication/);
  const header = JSON.parse(Buffer.from(kit.protected, 'base64url'));
  header.N = 2 ** 30;
  await assert.rejects(openRecoveryKit({ ...kit, protected: Buffer.from(JSON.stringify(header)).toString('base64url') }, passphrase), /parameters/);
  header.N = 32768; header.createdAt = '2020-01-01T00:00:00Z';
  await assert.rejects(openRecoveryKit({ ...kit, protected: Buffer.from(JSON.stringify(header)).toString('base64url') }, passphrase), /authentication/);
  await assert.rejects(openRecoveryKit({ ...kit, tag: 'A'.repeat(1000000) }, passphrase), /Invalid recovery kit/);
  const oversized = fixture(); oversized.providerConfigurations[0].document.large = 'x'.repeat(13 * 1024 * 1024);
  await assert.rejects(sealRecoveryKit(oversized, passphrase), /too large/);
});
test('a separate offline process recovers exact keys and refuses to overwrite existing files', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'be-good-kit-test-')); t.after(() => rm(root, { recursive: true, force: true }));
  const value = fixture(), kit = path.join(root, 'kit.json'), password = path.join(root, 'private-password.txt'), out = path.join(root, 'recovered');
  await writeFile(kit, JSON.stringify(await sealRecoveryKit(value, passphrase))); await writeFile(password, passphrase + '\n', { mode: 0o600 });
  const cli = fileURLToPath(new URL('../../scripts/recover-backup-keys.mjs', import.meta.url));
  const result = await exec(process.execPath, [cli, kit, password, out]);
  assert.equal(result.stdout.includes('SYNTHETIC-PRIVATE-TOKEN'), false);
  assert.deepEqual(await readFile(path.join(out, value.archiveKeys[0].id + '.key')), Buffer.from(value.archiveKeys[0].keyBase64, 'base64'));
  assert.deepEqual(JSON.parse(await readFile(path.join(out, 'synthetic-provider.private.json'), 'utf8')), value.providerConfigurations[0].document);
  await assert.rejects(exec(process.execPath, [cli, kit, password, out]));
  assert.equal((await readFile(path.join(out, value.archiveKeys[0].id + '.key'))).length, 32);
});
test('loopback capture rejects foreign origins and invalid passwords before loading any secrets', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'be-good-capture-test-')); t.after(() => rm(root, { recursive: true, force: true }));
  const output = path.join(root, 'kit.json'), reportPath = path.join(root, 'report.json'); let loads = 0;
  const value = fixture();
  const session = await startRecoveryCapture({ output, reportPath, loadMaterial: async () => { loads++; return value; }, lifetimeMs: 30000 });
  t.after(() => new Promise(resolve => session.server.close(resolve)));
  const origin = new URL(session.url).origin;
  const initial = await fetch(session.url); assert.equal(initial.status, 200); assert.equal((await initial.text()).includes('SYNTHETIC-PRIVATE-TOKEN'), false);
  assert.equal(initial.headers.get('referrer-policy'), 'same-origin', 'native form navigation must preserve its Origin while blocking cross-origin referrers');
  const body = new URLSearchParams({ passphrase, confirmation: passphrase, stored: 'on' });
  assert.equal((await fetch(session.url, { method: 'POST', headers: { Origin: 'https://foreign.invalid' }, body })).status, 403);
  assert.equal((await fetch(session.url, { method: 'POST', headers: { Origin: origin }, body: new URLSearchParams({ passphrase: 'short', confirmation: 'short', stored: 'on' }) })).status, 400);
  assert.equal((await fetch(session.url, { method: 'POST', headers: { Origin: origin }, body: new URLSearchParams({ stored: 'on' }) })).status, 400);
  assert.equal(loads, 0); await assert.rejects(access(output));
  const completed = await fetch(session.url, { method: 'POST', headers: { Origin: origin }, body });
  assert.equal(completed.status, 200); assert.equal((await completed.text()).includes(passphrase), false);
  assert.deepEqual(await openRecoveryKit(JSON.parse(await readFile(output, 'utf8')), passphrase), value);
  assert.equal(JSON.parse(await readFile(reportPath, 'utf8')).passwordRecoveryVerified, true);
  assert.equal(loads, 1);
});

test('recovery material transport rejects corrupt JSON and byte encodings without exposing input in errors', () => {
  const marker = 'SYNTHETIC-CONFIDENTIAL-PARSE-MARKER';
  const inputs = [
    Buffer.from(Buffer.from(`{"value":"${marker}\nraw-control"}`).toString('base64')),
    Buffer.from(Buffer.from(`{"value":"${marker}`).toString('base64')),
    Buffer.from(Buffer.from([0xc3, 0x28]).toString('base64')),
    Buffer.from('\u001b[32m' + marker),
    Buffer.from('YR=='),
    Buffer.alloc(0),
    Buffer.alloc(16 * 1024 * 1024 + 1, 65)
  ];
  for (const input of inputs) {
    assert.throws(() => decodeWindowsRecoveryMaterial(input), error => error.name === 'Error' && error.message === 'Local protected material unavailable' && !error.stack.includes(marker) && !error.stack.includes('raw-control'));
    assert.ok(input.every(byte => byte === 0));
  }
  const value = fixture();
  const transported = { ...value, providerConfigurations: value.providerConfigurations.map(provider => ({ name: provider.name, documentBase64: Buffer.from(JSON.stringify(provider.document), 'utf8').toString('base64') })) };
  const encoded = Buffer.from(Buffer.from(JSON.stringify(transported), 'utf8').toString('base64'));
  assert.deepEqual(decodeWindowsRecoveryMaterial(encoded), value);
  assert.ok(encoded.every(byte => byte === 0));
  const malformedProvider = { ...transported, providerConfigurations: [{ name: 'synthetic-provider', documentBase64: Buffer.from(`{"value":"${marker}\nraw-control"}`).toString('base64') }] };
  assert.throws(() => decodeWindowsRecoveryMaterial(Buffer.from(Buffer.from(JSON.stringify(malformedProvider), 'utf8').toString('base64'))), error => error.name === 'Error' && error.message === 'Local protected material unavailable' && !error.stack.includes(marker));
});

test('Windows material collection preserves long Hebrew, newlines, and every JSON control character through private base64 stdout', { skip: process.platform !== 'win32', timeout: 30_000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'be-good-material-transport-test-'));
  t.after(async () => {
    assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep + 'be-good-material-transport-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const providerDirectory = path.join(root, 'provider-preservation'), keyDirectory = path.join(root, 'source-preservation-keys');
  await mkdir(providerDirectory); await mkdir(keyDirectory);
  const controls = Array.from({ length: 32 }, (_, index) => String.fromCharCode(index)).join('');
  const document = { provider: 'render', identity: 'srv-synthetic1234', capturedAtISO: '2026-10-18T01:02:03.000Z', payload: { original: { envText: ('בדיקת גיבוי בעברית\nSYNTHETIC_VALUE="quoted"\r\n' + controls + '\u001b[31m\t😀\n').repeat(1200) }, secretFiles: [{ name: 'synthetic.txt', contents: controls + '\nשלום\n' }] } };
  const escaped = value => "'" + value.replaceAll("'", "''") + "'";
  const script = `$ErrorActionPreference='Stop';$plain=$null;$cipher=$null;$key=$null;$memory=[IO.MemoryStream]::new();$segment=[ArraySegment[byte]]::new([byte[]]::new(0));try{Add-Type -AssemblyName System.Security;[Console]::OpenStandardInput().CopyTo($memory);$plain=$memory.ToArray();$cipher=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[IO.File]::WriteAllBytes(${escaped(path.join(providerDirectory, 'synthetic-provider.dpapi'))},$cipher);$key=[byte[]](0..31);$cipher=[Security.Cryptography.ProtectedData]::Protect($key,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[IO.File]::WriteAllBytes(${escaped(path.join(keyDirectory, '20261018T010203Z-a1b2c3d4.key.dpapi'))},$cipher)}catch{exit 1}finally{if($memory.TryGetBuffer([ref]$segment)){[Array]::Clear($segment.Array,0,$segment.Array.Length)};$memory.Dispose();foreach($bytes in @($plain,$cipher,$key)){if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}}}`;
  const child = spawn('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
  child.stderr.on('data', bytes => bytes.fill(0)); child.stdin.on('error', () => {});
  const plaintext = Buffer.from(JSON.stringify(document), 'utf8');
  try {
    child.stdin.end(plaintext);
    const code = await new Promise((resolve, reject) => { child.once('error', () => reject(new Error('Synthetic protected fixture unavailable'))); child.once('close', resolve); });
    assert.equal(code, 0, 'Synthetic fixture encryption must succeed');
  } finally { plaintext.fill(0); }
  const material = await loadWindowsRecoveryMaterial(root);
  assert.equal(material.format, 'be-good-recovery-material/v1');
  assert.equal(material.archiveKeys.length, 1);
  assert.equal(material.archiveKeys[0].id, '20261018T010203Z-a1b2c3d4');
  assert.deepEqual(Buffer.from(material.archiveKeys[0].keyBase64, 'base64'), Buffer.from(Array.from({ length: 32 }, (_, index) => index)));
  assert.equal(material.providerConfigurations.length, 1);
  assert.deepEqual(material.providerConfigurations[0].document, document);
});
