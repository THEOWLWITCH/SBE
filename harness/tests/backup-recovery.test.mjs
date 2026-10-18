import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm, symlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes, createDecipheriv, createCipheriv, hkdfSync } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createArchive, createBackup, restoreArchive, verifyArchive, validateArchivePath } from '../lib/backup-archive.mjs';

const exec = promisify(execFile);
const componentNames = ['source-history', 'source-working-tree', 'database-schema', 'database-data', 'database-roles', 'database-rls', 'storage-objects', 'configuration-references'];
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'be-good-backup-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const secret = randomBytes(32), entries = [];
  for (const component of componentNames) {
    const sourcePath = path.join(root, `${component}.txt`);
    await writeFile(sourcePath, component === 'storage-objects' ? Buffer.from([0, 255, 128, 13, 10]) : `נתוני בדיקה ${component}`);
    entries.push({ path: `${component}/בדיקה.txt`, sourcePath, component });
  }
  return { root, secret, entries, destination: path.join(root, 'copy.begood') };
}

test('encrypted full archive restores exact Hebrew/binary files into a new destination', async (t) => {
  const f = await fixture(t);
  const out = await createArchive({ ...f, profile: 'full', scope: 'synthetic' });
  assert.equal(out.fullCoverage, true);
  assert.equal(out.status, 'verified_local');
  const ciphertext = await readFile(f.destination);
  assert.equal(ciphertext.includes(Buffer.from('נתוני בדיקה')), false);
  const restored = path.join(f.root, 'isolated');
  await restoreArchive({ archive: f.destination, secret: f.secret, destination: restored });
  for (const entry of f.entries) assert.deepEqual(await readFile(path.join(restored, entry.path)), await readFile(entry.sourcePath));
  assert.equal((await verifyArchive({ archive: f.destination, secret: f.secret })).archiveSha256, out.archiveSha256);
});

test('wrong key, altered ciphertext and truncated archive fail before creating a destination', async (t) => {
  const f = await fixture(t);
  await createArchive({ ...f, profile: 'full', scope: 'synthetic' });
  const original = await readFile(f.destination);
  for (const kind of ['wrong-key', 'corrupt', 'truncated']) {
    const target = path.join(f.root, kind);
    const changed = Buffer.from(original);
    changed[Math.floor(changed.length / 2)] ^= 1;
    const archive = path.join(f.root, `${kind}.begood`);
    await writeFile(archive, kind === 'corrupt' ? changed : kind === 'truncated' ? original.subarray(0, original.length - 10) : original);
    await assert.rejects(restoreArchive({ archive, secret: kind === 'wrong-key' ? randomBytes(32) : f.secret, destination: target }), /integrity|authentication|invalid|truncated/i);
    await assert.rejects(access(target));
  }
});

test('archive creation and restoration never overwrite existing targets', async (t) => {
  const f = await fixture(t);
  await createArchive({ ...f, profile: 'full', scope: 'synthetic' });
  const before = await readFile(f.destination);
  await assert.rejects(createArchive({ ...f, profile: 'full', scope: 'synthetic' }), /exist/i);
  assert.deepEqual(await readFile(f.destination), before);
  const destination = path.join(f.root, 'existing');
  await mkdir(destination);
  await writeFile(path.join(destination, 'keep.txt'), 'keep');
  await assert.rejects(restoreArchive({ archive: f.destination, secret: f.secret, destination }), /exist/i);
  assert.equal(await readFile(path.join(destination, 'keep.txt'), 'utf8'), 'keep');
});

test('missing full components fail and source-only preservation is explicitly incomplete', async (t) => {
  const f = await fixture(t);
  await assert.rejects(createArchive({ ...f, entries: f.entries.slice(0, 2), profile: 'full', scope: 'synthetic' }), /missing.*component/i);
  await assert.rejects(access(f.destination));
  const result = await createArchive({ ...f, entries: f.entries.slice(0, 2), profile: 'source-preservation', scope: 'local-source' });
  assert.equal(result.fullCoverage, false);
  assert.equal(result.status, 'verified_local_source_only');
  assert.equal(result.coverage.filter((item) => item.covered).length, 2);
});

test('unsafe paths and cross-platform collisions are rejected before writing archives', async (t) => {
  const f = await fixture(t);
  for (const name of ['../escape', '/absolute', 'C:/absolute', 'a\\escape', 'a/../escape', 'a//b', 'a:stream', 'CON', 'folder/NUL.txt', 'trailing.'])
    assert.throws(() => validateArchivePath(name), /unsafe/i, name);
  await assert.rejects(createArchive({ ...f, profile: 'full', scope: 'synthetic', entries: [...f.entries, { ...f.entries[0], path: f.entries[0].path.toUpperCase() }] }), /duplicate|collision/i);
});

test('reader rejects unsafe paths and entry hashes even inside authenticated archives', async (t) => {
  const f = await fixture(t);
  await createArchive({ ...f, profile: 'full', scope: 'synthetic' });
  const original = await readFile(f.destination), header = original.subarray(0, 53);
  const key = Buffer.from(hkdfSync('sha256', f.secret, header.subarray(9, 41), 'BE GOOD backup archive v1', 32));
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(41, 53));
  decipher.setAAD(header); decipher.setAuthTag(original.subarray(original.length - 16));
  const plaintext = Buffer.concat([decipher.update(original.subarray(53, original.length - 16)), decipher.final()]);
  const length = Number(plaintext.readBigUInt64BE()), manifest = JSON.parse(plaintext.subarray(8, 8 + length));
  for (const kind of ['traversal', 'entry-hash']) {
    const changed = structuredClone(manifest);
    if (kind === 'traversal') changed.entries[0].path = '../escape.txt';
    else changed.entries[0].sha256 = '0'.repeat(64);
    const encoded = Buffer.from(JSON.stringify(changed)), prefix = Buffer.alloc(8);
    prefix.writeBigUInt64BE(BigInt(encoded.length));
    const cipher = createCipheriv('aes-256-gcm', key, header.subarray(41, 53));
    cipher.setAAD(header);
    const ciphertext = Buffer.concat([cipher.update(Buffer.concat([prefix, encoded, plaintext.subarray(8 + length)])), cipher.final()]);
    const archive = path.join(f.root, `${kind}.begood`), destination = path.join(f.root, `${kind}-restore`);
    await writeFile(archive, Buffer.concat([header, ciphertext, cipher.getAuthTag()]));
    await assert.rejects(restoreArchive({ archive, secret: f.secret, destination }), /unsafe|integrity/i);
    await assert.rejects(access(destination));
  }
  key.fill(0);
});

test('a separate passphrase works without being saved in the archive or report', async (t) => {
  const f = await fixture(t), secret = 'synthetic-test-only-long-passphrase';
  const report = await createArchive({ ...f, secret, profile: 'full', scope: 'synthetic' });
  assert.equal((await readFile(f.destination)).includes(Buffer.from(secret)), false);
  assert.equal(JSON.stringify(report).includes(secret), false);
  assert.equal((await verifyArchive({ archive: f.destination, secret })).fullCoverage, true);
  await assert.rejects(verifyArchive({ archive: f.destination, secret: 'a-wrong-synthetic-long-passphrase' }), /authentication/i);
});

test('source backup cannot write inside its source', async (t) => {
  const f = await fixture(t);
  await assert.rejects(createBackup({ secret: f.secret, destination: path.join(f.root, 'nested.begood'), config: { profile: 'source-preservation', scope: 'local-source', sources: [{ id: 'original', repository: f.root }] } }), /outside.*source/i);
});

test('source collection preserves every local Git ref and dirty/untracked content', async (t) => {
  const f = await fixture(t), repo = path.join(f.root, 'repo');
  await mkdir(repo);
  await exec('git', ['init', repo]);
  await exec('git', ['-C', repo, 'config', 'user.email', 'synthetic@example.invalid']);
  await exec('git', ['-C', repo, 'config', 'user.name', 'Synthetic test']);
  await writeFile(path.join(repo, 'tracked.txt'), 'before');
  await exec('git', ['-C', repo, 'add', 'tracked.txt']);
  await exec('git', ['-C', repo, 'commit', '-m', 'Synthetic baseline']);
  await exec('git', ['-C', repo, 'branch', 'another-local-branch']);
  await exec('git', ['-C', repo, 'tag', 'synthetic-v1']);
  await writeFile(path.join(repo, 'tracked.txt'), 'שינוי מקומי');
  await writeFile(path.join(repo, 'new.txt'), 'קובץ חדש');
  await writeFile(path.join(repo, '.gitignore'), 'ignored-secret.txt\n');
  await writeFile(path.join(repo, 'ignored-secret.txt'), 'DO NOT COLLECT');
  const head = (await exec('git', ['-C', repo, 'rev-parse', 'HEAD'])).stdout.trim();
  const result = await createBackup({ destination: f.destination, secret: f.secret, config: { profile: 'source-preservation', scope: 'local-source', sources: [{ id: 'development', repository: repo }] } });
  assert.equal(result.fullCoverage, false);
  const destination = path.join(f.root, 'restored-source');
  await restoreArchive({ archive: f.destination, secret: f.secret, destination });
  assert.equal(await readFile(path.join(destination, 'source/development/working-tree/tracked.txt'), 'utf8'), 'שינוי מקומי');
  assert.equal(await readFile(path.join(destination, 'source/development/working-tree/new.txt'), 'utf8'), 'קובץ חדש');
  await assert.rejects(access(path.join(destination, 'source/development/working-tree/ignored-secret.txt')));
  const clone = path.join(f.root, 'bundle-clone');
  await exec('git', ['clone', '--no-checkout', path.join(destination, 'source/development/history.bundle'), clone]);
  assert.equal((await exec('git', ['-C', clone, 'rev-parse', 'HEAD'])).stdout.trim(), head);
  assert.equal((await exec('git', ['-C', clone, 'show-ref', '--tags'])).stdout.includes('refs/tags/synthetic-v1'), true);
  assert.equal((await exec('git', ['-C', clone, 'branch', '-r'])).stdout.includes('another-local-branch'), true);
  assert.equal((await exec('git', ['-C', repo, 'rev-parse', 'HEAD'])).stdout.trim(), head);
  const badReferences = path.join(f.root, 'bad-references.json'), badOutput = path.join(f.root, 'bad-references.begood');
  await writeFile(badReferences, JSON.stringify({ references: [{ name: 'SYNTHETIC_KEY', value: 'synthetic-inline-secret' }] }));
  await assert.rejects(createBackup({ secret: f.secret, destination: badOutput, config: { profile: 'source-preservation', scope: 'local-source', sources: [{ id: 'development', repository: repo }], configurationReferences: badReferences } }), /references.*values/i);
  await assert.rejects(access(badOutput));
  const jsonExports = {}, jsonArchive = path.join(f.root, 'json-exports.begood');
  for (const section of ['schema', 'data', 'roles', 'rls']) {
    jsonExports[section] = path.join(f.root, `${section}.json`);
    await writeFile(jsonExports[section], JSON.stringify({ section, synthetic: true }));
  }
  const emptyStorage = path.join(f.root, 'empty-storage'), references = path.join(f.root, 'references.json');
  await mkdir(emptyStorage); await writeFile(references, '{"references":[]}');
  await createBackup({ destination: jsonArchive, secret: f.secret, config: { profile: 'full', scope: 'synthetic', sources: [{ id: 'development', repository: repo }], databaseFormat: 'supabase-readonly-json', database: jsonExports, storageDirectory: emptyStorage, configurationReferences: references } });
  const jsonRestore = path.join(f.root, 'restored-json');
  await restoreArchive({ archive: jsonArchive, secret: f.secret, destination: jsonRestore });
  for (const section of Object.keys(jsonExports)) {
    assert.deepEqual(await readFile(path.join(jsonRestore, 'database', `${section}.json`)), await readFile(jsonExports[section]));
    await assert.rejects(access(path.join(jsonRestore, 'database', `${section}.sql`)));
  }
  const jsonManifest = JSON.parse(await readFile(path.join(jsonRestore, 'BE_GOOD_RESTORED_MANIFEST.json'), 'utf8'));
  assert.equal(jsonManifest.metadata.databaseExportFormat, 'supabase-readonly-json');
  await assert.rejects(createBackup({ destination: path.join(f.root, 'invalid-format.begood'), secret: f.secret, config: { profile: 'full', scope: 'synthetic', databaseFormat: 'unknown' } }), /format/);
});

test('symlinked input or destination ancestors are refused', async (t) => {
  const f = await fixture(t), linked = path.join(f.root, 'linked');
  try { await symlink(f.root, linked, 'junction'); } catch (error) { if (error.code === 'EPERM') return t.skip('Creating symlinks requires OS permission'); throw error; }
  await assert.rejects(createArchive({ ...f, profile: 'full', scope: 'synthetic', entries: [{ ...f.entries[0], sourcePath: path.join(linked, path.basename(f.entries[0].sourcePath)) }, ...f.entries.slice(1)] }), /symbolic|symlink/i);
  await createArchive({ ...f, profile: 'full', scope: 'synthetic' });
  await assert.rejects(restoreArchive({ archive: f.destination, secret: f.secret, destination: path.join(linked, 'restore') }), /symbolic|symlink/i);
});

test('actual PGlite SQL restore preserves relational data and linked Hebrew/binary files', async (t) => {
  const supplied = process.env.BE_GOOD_PGLITE_MODULE;
  let PGlite;
  try { ({ PGlite } = supplied ? await import(pathToFileURL(path.resolve(supplied)).href) : await import('@electric-sql/pglite')); }
  catch (error) { if (!supplied && error.code === 'ERR_MODULE_NOT_FOUND') return t.skip('Set BE_GOOD_PGLITE_MODULE to the external test-only PGlite dist/index.js'); throw error; }
  const f = await fixture(t), db = new PGlite();
  t.after(() => db.close());
  const schema = 'CREATE TABLE studies (id text PRIMARY KEY, title text NOT NULL); CREATE TABLE materials (id text PRIMARY KEY, study_id text REFERENCES studies(id), object_path text NOT NULL);';
  await db.exec(schema);
  await db.query('INSERT INTO studies VALUES ($1,$2)', ['study-a', 'מחקר סינתטי']);
  await db.query('INSERT INTO materials VALUES ($1,$2,$3)', ['material-a', 'study-a', 'חומר.bin']);
  const studies = (await db.query('SELECT * FROM studies ORDER BY id')).rows;
  const materials = (await db.query('SELECT * FROM materials ORDER BY id')).rows;
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const data = studies.map((row) => `INSERT INTO studies VALUES (${quote(row.id)},${quote(row.title)});`).concat(materials.map((row) => `INSERT INTO materials VALUES (${quote(row.id)},${quote(row.study_id)},${quote(row.object_path)});`)).join('\n');
  await writeFile(f.entries.find((e) => e.component === 'database-schema').sourcePath, schema);
  await writeFile(f.entries.find((e) => e.component === 'database-data').sourcePath, data);
  const binary = Buffer.from([0, 5, 255, 128, 10, 13]);
  const storage = f.entries.find((e) => e.component === 'storage-objects');
  storage.path = 'storage/objects/חומר.bin';
  await writeFile(storage.sourcePath, binary);
  await createArchive({ ...f, profile: 'full', scope: 'synthetic' });
  const destination = path.join(f.root, 'isolated-database');
  await restoreArchive({ archive: f.destination, secret: f.secret, destination });
  const restored = new PGlite();
  t.after(() => restored.close());
  await restored.exec(await readFile(path.join(destination, f.entries.find((e) => e.component === 'database-schema').path), 'utf8'));
  await restored.exec(await readFile(path.join(destination, f.entries.find((e) => e.component === 'database-data').path), 'utf8'));
  assert.deepEqual((await restored.query('SELECT * FROM studies ORDER BY id')).rows, studies);
  const linked = (await restored.query('SELECT s.title,m.object_path FROM materials m JOIN studies s ON s.id=m.study_id')).rows[0];
  assert.equal(linked.title, 'מחקר סינתטי');
  assert.deepEqual(await readFile(path.join(destination, 'storage/objects', linked.object_path)), binary);
  assert.equal((await stat(path.join(destination, 'storage/objects', linked.object_path))).size, binary.length);
});
