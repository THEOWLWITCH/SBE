import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv, hkdfSync } from 'node:crypto';
import { createArchive, restoreArchive, rekeyArchive } from '../lib/backup-archive.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'be-good-rekey-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const secret = randomBytes(32), newSecret = randomBytes(32);
  const entries = [];
  for (const [component, bytes] of [['source-history', Buffer.alloc(0)], ['source-working-tree', Buffer.from('תוכן סינתטי — Hebrew / English')], ['source-working-tree', randomBytes(256 * 1024 + 13)]]) {
    const sourcePath = path.join(root, 'file-' + entries.length);
    await writeFile(sourcePath, bytes);
    entries.push({ component, sourcePath, path: 'source/' + entries.length + '.bin' });
  }
  const archive = path.join(root, 'old.begood'), destination = path.join(root, 'new.begood');
  await createArchive({ destination: archive, secret, profile: 'source-preservation', scope: 'synthetic', entries });
  return { root, secret, newSecret, entries, archive, destination };
}

test('stream rekey preserves authenticated content and the original archive', async (t) => {
  const f = await fixture(t), before = await readFile(f.archive);
  const result = await rekeyArchive(f);
  assert.equal(result.profile, 'source-preservation');
  assert.equal(result.entries, f.entries.length);
  assert.equal(result.reencrypted, true);
  assert.equal(result.plaintextWrittenToDisk, false);
  assert.deepEqual(await readFile(f.archive), before);
  assert.notDeepEqual(await readFile(f.destination), before);
  assert.equal(JSON.stringify(result).includes(f.newSecret.toString('hex')), false);
  const restored = path.join(f.root, 'restored');
  await restoreArchive({ archive: f.destination, secret: f.newSecret, destination: restored });
  for (const entry of f.entries) assert.deepEqual(await readFile(path.join(restored, entry.path)), await readFile(entry.sourcePath));
  const rejected = path.join(f.root, 'old-key-result');
  await assert.rejects(restoreArchive({ archive: f.destination, secret: f.secret, destination: rejected }), /authentication/i);
  await assert.rejects(access(rejected));
});

test('wrong input key or tampered ciphertext never leaves a rekey output', async (t) => {
  const f = await fixture(t), original = await readFile(f.archive);
  for (const mode of ['wrong-key', 'tampered', 'truncated']) {
    const archive = path.join(f.root, mode + '.begood'), destination = path.join(f.root, mode + '-output.begood');
    const bytes = Buffer.from(original);
    if (mode === 'tampered') bytes[bytes.length - 25] ^= 1;
    await writeFile(archive, mode === 'truncated' ? bytes.subarray(0, bytes.length - 19) : bytes);
    await assert.rejects(rekeyArchive({ ...f, archive, destination, secret: mode === 'wrong-key' ? randomBytes(32) : f.secret }));
    await assert.rejects(access(destination));
  }
});

test('rekey never replaces an existing archive or aliases its input', async (t) => {
  const f = await fixture(t), original = await readFile(f.archive);
  await writeFile(f.destination, 'existing archive');
  await assert.rejects(rekeyArchive(f), /exist/i);
  assert.equal(await readFile(f.destination, 'utf8'), 'existing archive');
  await assert.rejects(rekeyArchive({ ...f, destination: f.archive }), /different|same|input/i);
  assert.deepEqual(await readFile(f.archive), original);
});

test('rekey rejects authenticated malformed manifests and entry hashes', async (t) => {
  const f = await fixture(t), original = await readFile(f.archive), header = original.subarray(0, 53);
  const key = Buffer.from(hkdfSync('sha256', f.secret, header.subarray(9, 41), 'BE GOOD backup archive v1', 32));
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(41, 53));
  decipher.setAAD(header); decipher.setAuthTag(original.subarray(-16));
  const plaintext = Buffer.concat([decipher.update(original.subarray(53, -16)), decipher.final()]);
  const length = Number(plaintext.readBigUInt64BE()), manifest = JSON.parse(plaintext.subarray(8, 8 + length));
  for (const mode of ['traversal', 'bad-hash', 'extra-data']) {
    const changed = structuredClone(manifest);
    if (mode === 'traversal') changed.entries[0].path = '../escape';
    if (mode === 'bad-hash') changed.entries[1].sha256 = '0'.repeat(64);
    const encoded = Buffer.from(JSON.stringify(changed)), prefix = Buffer.alloc(8);
    prefix.writeBigUInt64BE(BigInt(encoded.length));
    const payload = Buffer.concat([prefix, encoded, plaintext.subarray(8 + length), mode === 'extra-data' ? Buffer.from([1]) : Buffer.alloc(0)]);
    const cipher = createCipheriv('aes-256-gcm', key, header.subarray(41, 53)); cipher.setAAD(header);
    const bytes = Buffer.concat([header, cipher.update(payload), cipher.final(), cipher.getAuthTag()]);
    const archive = path.join(f.root, mode + '.begood'), destination = path.join(f.root, mode + '-new.begood');
    await writeFile(archive, bytes);
    await assert.rejects(rekeyArchive({ ...f, archive, destination }), /unsafe|integrity|mismatch/i);
    await assert.rejects(access(destination));
  }
  key.fill(0);
});
