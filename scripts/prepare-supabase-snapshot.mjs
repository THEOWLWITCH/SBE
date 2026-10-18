#!/usr/bin/env node
// Local preservation only. Never imports data into a database or contacts a provider.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function splitSnapshot(text, { projectRef, sha256 }) {
  if (typeof JSON.rawJSON !== 'function') throw new Error('Snapshot preparation requires Node.js 24 or later with lossless JSON APIs');
  if (Buffer.byteLength(text, 'utf8') > 64 * 1024 * 1024) throw new Error('Snapshot exceeds the supported local preparation size');
  if (createHash('sha256').update(text, 'utf8').digest('hex') !== sha256) throw new Error('Snapshot integrity mismatch');
  const checked = JSON.parse(text);
  if (checked.format !== 'be-good-supabase-readonly-export' || checked.format_version !== 1 || checked.project_ref !== projectRef || !Number.isFinite(Date.parse(checked.captured_at))) throw new Error('Unexpected snapshot identity');
  if (!Array.isArray(checked.data) || !Array.isArray(checked.rls) || !checked.roles || !checked.schema || !Array.isArray(checked.inaccessible_tables) || !Array.isArray(checked.inaccessible_sequences) || checked.inaccessible_tables.length || checked.inaccessible_sequences.length) throw new Error('Incomplete snapshot');
  const seen = new Set();
  for (const table of checked.data) {
    const id = JSON.stringify([table.schema, table.table]);
    if (seen.has(id) || typeof table.schema !== 'string' || typeof table.table !== 'string' || table.readable !== true || !Array.isArray(table.rows) || table.count !== table.rows.length) throw new Error('Snapshot table count mismatch');
    seen.add(id);
  }
  // This workflow has no live Storage adapter. Never label missing object bytes complete.
  if (checked.storage_inventory?.objects !== 0 || checked.storage_inventory?.buckets !== 0) throw new Error('Storage objects require a separate authorized export');
  for (const name of ['objects', 'buckets']) {
    const table = checked.data.find((entry) => entry.schema === 'storage' && entry.table === name);
    if (!table || table.count !== 0) throw new Error('Storage inventory does not match table contents');
  }
  // Preserve arbitrary-precision PostgreSQL numbers, including bigint and decimal values.
  // Parsing and stringifying through ordinary JS numbers would silently corrupt them.
  const exact = JSON.parse(text, (_key, value, context) => typeof value === 'number' ? JSON.rawJSON(context.source) : value);
  const { data, roles, rls, ...catalog } = exact;
  const common = { format: checked.format, project_ref: projectRef, captured_at: checked.captured_at, source_payload_sha256: sha256 };
  const encode = (value) => JSON.stringify(value) + '\n';
  return {
    files: { 'schema.json': encode(catalog), 'data.json': encode({ ...common, tables: data }), 'roles.json': encode({ ...common, ...roles }), 'rls.json': encode({ ...common, policies: rls }) },
    summary: { project: projectRef, capturedAt: checked.captured_at, payloadSha256: sha256, tableCount: checked.data.length, rowCount: checked.data.reduce((sum, table) => sum + table.count, 0), storageObjects: 0, storageBuckets: 0, format: 'supabase-readonly-json', providerRestoreVerified: false, limits: checked.recovery_limits }
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4) throw new Error('Expected snapshot, new directory, project reference and server SHA256');
  const [snapshot, destination, projectRef, sha256] = args;
  const result = splitSnapshot(await readFile(snapshot, 'utf8'), { projectRef, sha256 });
  let owned = false;
  try {
    await mkdir(destination, { mode: 0o700 }); owned = true;
    for (const [name, contents] of Object.entries(result.files)) await writeFile(path.join(destination, name), contents, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(result.summary));
  } catch (error) { if (owned) await rm(destination, { recursive: true, force: true }); throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => { console.error('Snapshot preparation failed; confidential payload omitted'); process.exitCode = 1; });
