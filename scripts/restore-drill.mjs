#!/usr/bin/env node
// Synthetic, isolated restore exercise. It cannot access Supabase, Netlify, or Render.
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const exec = promisify(execFile), hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  if (!['--pglite-module', '--report'].includes(name) || options[name] || !process.argv[index + 1]) throw new Error('Use --pglite-module EXTERNAL-dist/index.js [--report NEW-report.json]');
  options[name] = process.argv[index + 1];
}

async function run() {
  const startedAt = new Date().toISOString(), start = performance.now();
  const { PGlite } = options['--pglite-module'] ? await import(pathToFileURL(path.resolve(options['--pglite-module'])).href) : await import('@electric-sql/pglite');
  const root = await mkdtemp(path.join(tmpdir(), 'be-good-isolated-drill-'));
  const source = new PGlite(), restored = new PGlite();
  const cli = fileURLToPath(new URL('./backup.mjs', import.meta.url));
  const checks = [];
  try {
    const repository = path.join(root, 'synthetic-source'), exports = path.join(root, 'synthetic-exports'), storage = path.join(exports, 'objects');
    await mkdir(repository); await mkdir(storage, { recursive: true });
    await exec('git', ['init', repository]);
    await exec('git', ['-C', repository, 'config', 'user.name', 'Synthetic restore drill']);
    await exec('git', ['-C', repository, 'config', 'user.email', 'synthetic@example.invalid']);
    await writeFile(path.join(repository, 'app.txt'), 'Synthetic source baseline');
    await exec('git', ['-C', repository, 'add', 'app.txt']);
    await exec('git', ['-C', repository, 'commit', '-m', 'Synthetic baseline']);
    await exec('git', ['-C', repository, 'branch', 'preserved-development']);
    await exec('git', ['-C', repository, 'tag', 'drill-v1']);
    const sourceHead = (await exec('git', ['-C', repository, 'rev-parse', 'HEAD'])).stdout.trim();
    await writeFile(path.join(repository, 'app.txt'), 'שינוי בדיקה מקומי');
    await writeFile(path.join(repository, 'new.txt'), 'קובץ בדיקה שטרם הוכנס ל־Git');
    const schema = 'CREATE TABLE studies (id text PRIMARY KEY, institution_id text NOT NULL, title text NOT NULL); CREATE TABLE materials (id text PRIMARY KEY, study_id text NOT NULL REFERENCES studies(id), object_path text NOT NULL);';
    const roles = 'CREATE ROLE synthetic_reader NOLOGIN;';
    const rls = "ALTER TABLE studies ENABLE ROW LEVEL SECURITY; CREATE POLICY synthetic_institution ON studies USING (institution_id = current_setting('drill.institution', true));";
    await source.exec(roles + schema + rls);
    await source.query('INSERT INTO studies VALUES ($1,$2,$3)', ['study-a', 'school-a', 'מחקר סינתטי א׳']);
    await source.query('INSERT INTO studies VALUES ($1,$2,$3)', ['study-b', 'school-b', 'מחקר סינתטי ב׳']);
    await source.query('INSERT INTO materials VALUES ($1,$2,$3)', ['material-a', 'study-a', 'חומר/תוצר.bin']);
    const studies = (await source.query('SELECT * FROM studies ORDER BY id')).rows;
    const materials = (await source.query('SELECT * FROM materials ORDER BY id')).rows;
    const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
    const data = studies.map((row) => `INSERT INTO studies VALUES (${q(row.id)},${q(row.institution_id)},${q(row.title)});`).concat(materials.map((row) => `INSERT INTO materials VALUES (${q(row.id)},${q(row.study_id)},${q(row.object_path)});`)).join('\n');
    for (const [name, value] of Object.entries({ schema, data, roles, rls })) await writeFile(path.join(exports, `${name}.sql`), value);
    await mkdir(path.join(storage, 'חומר'));
    const binary = Buffer.from([0, 255, 128, 13, 10, 1, 42]);
    await writeFile(path.join(storage, 'חומר', 'תוצר.bin'), binary);
    await writeFile(path.join(storage, 'הסבר.txt'), 'קובץ עברי סינתטי 123 — Hebrew-English');
    const references = path.join(exports, 'configuration-references.json');
    await writeFile(references, JSON.stringify({ references: [{ name: 'SYNTHETIC_DB_KEY', reference: 'env://SYNTHETIC_DB_KEY', required: true }] }));
    const config = path.join(root, 'config.json'), key = path.join(root, 'separate-key.bin'), archive = path.join(root, 'synthetic.begood'), destination = path.join(root, 'isolated-restored');
    await writeFile(config, JSON.stringify({ profile: 'full', scope: 'synthetic', sources: [{ id: 'development', repository }], database: Object.fromEntries(['schema', 'data', 'roles', 'rls'].map((name) => [name, path.join(exports, `${name}.sql`)])), storageDirectory: storage, configurationReferences: references }));
    await writeFile(key, randomBytes(32), { mode: 0o600 });
    const created = JSON.parse((await exec(process.execPath, [cli, 'create', '--config', config, '--output', archive, '--key-file', key])).stdout);
    const verified = JSON.parse((await exec(process.execPath, [cli, 'verify', '--archive', archive, '--key-file', key])).stdout);
    const copy = JSON.parse((await exec(process.execPath, [cli, 'restore', '--archive', archive, '--destination', destination, '--key-file', key])).stdout);
    assert.equal(created.fullCoverage, true); assert.equal(copy.archiveSha256, verified.archiveSha256);
    checks.push({ name: 'encrypted archive/CLI integrity and isolated extraction', passed: true });
    await restored.exec(await readFile(path.join(destination, 'database/roles.sql'), 'utf8'));
    await restored.exec(await readFile(path.join(destination, 'database/schema.sql'), 'utf8'));
    await restored.exec(await readFile(path.join(destination, 'database/rls.sql'), 'utf8'));
    await restored.exec(await readFile(path.join(destination, 'database/data.sql'), 'utf8'));
    assert.deepEqual((await restored.query('SELECT * FROM studies ORDER BY id')).rows, studies);
    assert.deepEqual((await restored.query('SELECT * FROM materials ORDER BY id')).rows, materials);
    await assert.rejects(restored.query("INSERT INTO materials VALUES ('orphan','unknown','orphan.bin')"));
    const policies = (await restored.query("SELECT policyname FROM pg_policies WHERE tablename='studies'")).rows;
    assert.equal(policies[0].policyname, 'synthetic_institution');
    checks.push({ name: 'actual PGlite SQL/data/foreign-key/policy catalog round-trip', passed: true });
    const object = (await restored.query('SELECT object_path FROM materials WHERE id=$1', ['material-a'])).rows[0].object_path;
    assert.equal(hash(await readFile(path.join(destination, 'storage/objects', object))), hash(binary));
    assert.equal(await readFile(path.join(destination, 'storage/objects/הסבר.txt'), 'utf8'), 'קובץ עברי סינתטי 123 — Hebrew-English');
    checks.push({ name: 'relational links to actual binary and Hebrew storage objects', passed: true });
    const clone = path.join(root, 'bundle-restored');
    await exec('git', ['clone', '--no-checkout', path.join(destination, 'source/development/history.bundle'), clone]);
    assert.equal((await exec('git', ['-C', clone, 'rev-parse', 'HEAD'])).stdout.trim(), sourceHead);
    assert.equal((await exec('git', ['-C', clone, 'show-ref', '--tags'])).stdout.includes('drill-v1'), true);
    assert.equal(await readFile(path.join(destination, 'source/development/working-tree/app.txt'), 'utf8'), 'שינוי בדיקה מקומי');
    assert.equal(await readFile(path.join(destination, 'source/development/working-tree/new.txt'), 'utf8'), 'קובץ בדיקה שטרם הוכנס ל־Git');
    checks.push({ name: 'actual Git bundle restore plus dirty/untracked source files', passed: true });
    const wrongKey = path.join(root, 'wrong-key.bin'); await writeFile(wrongKey, randomBytes(32), { mode: 0o600 });
    await assert.rejects(exec(process.execPath, [cli, 'restore', '--archive', archive, '--destination', path.join(root, 'wrong-key-result'), '--key-file', wrongKey]));
    await assert.rejects(access(path.join(root, 'wrong-key-result')));
    await assert.rejects(exec(process.execPath, [cli, 'restore', '--archive', archive, '--destination', destination, '--key-file', key]));
    checks.push({ name: 'wrong-key refusal and existing-destination preservation', passed: true });
    const report = { ok: true, exercise: 'synthetic-isolated-restore', startedAt, completedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - start), archiveSha256: created.archiveSha256, fullArtifactCoverage: created.fullCoverage, scope: 'synthetic', realUserDataAccessed: false, liveServicesUsed: false, independentDestinationVerified: false, liveProviderRestoreVerified: false, checks, limitations: ['PGlite exercise does not prove pg_dump/pg_restore compatibility, Supabase roles, production RLS or hosted concurrency', 'No external destination, retention schedule or production recovery was activated', 'All synthetic plaintext, keys and temporary repositories are removed after the exercise'] };
    if (options['--report']) await writeFile(options['--report'], JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(report, null, 2));
  } finally { await source.close(); await restored.close(); await rm(root, { recursive: true, force: true }); }
}

run().catch(() => { console.error(JSON.stringify({ ok: false, exercise: 'synthetic-isolated-restore', error: 'Synthetic restore drill failed; no production service or records were accessed' })); process.exitCode = 1; });
