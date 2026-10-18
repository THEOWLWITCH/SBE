import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { splitSnapshot } from '../../scripts/prepare-supabase-snapshot.mjs';

const projectRef = 'synthetic-project';
const hash = (text) => createHash('sha256').update(text).digest('hex');
function fixture() {
  return JSON.stringify({ format: 'be-good-supabase-readonly-export', format_version: 1, project_ref: projectRef, captured_at: '2026-10-15T12:00:00Z', schema: { relations: [] }, roles: { roles: [] }, rls: [], inaccessible_tables: [], inaccessible_sequences: [], storage_inventory: { objects: 0, buckets: 0 }, recovery_limits: ['Synthetic fixture; no provider restore'], data: [{ schema: 'public', table: 'records', readable: true, count: 1, rows: [{ hebrew: 'שלום, עולם', large: '__BIG__', decimal: '__DECIMAL__' }] }, { schema: 'storage', table: 'objects', readable: true, count: 0, rows: [] }, { schema: 'storage', table: 'buckets', readable: true, count: 0, rows: [] }] }).replace('"__BIG__"', '900719925474099312345').replace('"__DECIMAL__"', '0.1234567890123456789012345');
}
test('snapshot partitioning preserves exact PostgreSQL numbers and Hebrew through JSON bytes', () => {
  const text = fixture(), result = splitSnapshot(text, { projectRef, sha256: hash(text) });
  assert.match(result.files['data.json'], /900719925474099312345/);
  assert.match(result.files['data.json'], /0\.1234567890123456789012345/);
  assert.match(result.files['data.json'], /שלום, עולם/);
  assert.equal(result.summary.rowCount, 1);
  assert.equal(result.summary.providerRestoreVerified, false);
});
test('altered payload and wrong project fail before a backup can be marked complete', () => {
  const text = fixture();
  assert.throws(() => splitSnapshot(text + ' ', { projectRef, sha256: hash(text) }), /integrity/);
  assert.throws(() => splitSnapshot(text, { projectRef: 'another-study', sha256: hash(text) }), /identity/);
});
test('unreadable tables, incorrect counts and missing Storage bytes are refused', () => {
  for (const change of [value => value.inaccessible_tables.push('private.records'), value => value.data[0].count++, value => value.data[0].readable = false, value => value.storage_inventory.objects++, value => value.data.find(table => table.table === 'objects').count++]) {
    const value = JSON.parse(fixture()); change(value); const text = JSON.stringify(value);
    assert.throws(() => splitSnapshot(text, { projectRef, sha256: hash(text) }), /Incomplete|count|Storage/);
  }
});
