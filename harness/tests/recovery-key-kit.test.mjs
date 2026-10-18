import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { sealRecoveryKit, openRecoveryKit } from '../lib/recovery-key-kit.mjs';
import { startRecoveryCapture } from '../../scripts/recovery-key-capture.mjs';

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
