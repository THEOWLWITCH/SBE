import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleBackupStatus } from '../lib/backup-monitor.mjs';
import { handleAccess } from '../lib/access.mjs';
import { syntheticOwnerRecord, SYNTHETIC_OWNER_PASSWORD } from './synthetic-access.mjs';

const secret = 'synthetic-monitor-secret';
const ownerRecord = syntheticOwnerRecord();
const store = { async get(k) { return k === 'token-secret' ? { secret } : k === 'pw-sys' ? ownerRecord : null; } };
async function token(kind) {
  if (kind === 'sys') return (await handleAccess(store, { action:'login', kind:'sys', secret:SYNTHETIC_OWNER_PASSWORD }))[1].token;
  const body = Buffer.from(JSON.stringify({ k: kind, exp: Date.now() + 60000 })).toString('base64url');
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}
test('backup status is owner-only even through direct API; not configured is honest', async () => {
  for (const t of ['', await token('code'), await token('inst'), 'forged']) {
    const [status] = await handleBackupStatus(store, { token: t });
    assert.equal(status, 403);
  }
  const [status, out] = await handleBackupStatus(store, { token: await token('sys') });
  assert.equal(status, 200);
  assert.equal(out.state, 'not_configured');
  assert.equal(out.productionProtected, false);
});
test('synthetic/source-only report is never promoted to live protection; details are allowlisted', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'be-good-monitor-'));
  try {
    const reportPath = join(dir, 'status.json');
    await writeFile(reportPath, JSON.stringify({ format: 'be-good-backup-status/v1', environment: 'synthetic',
      generatedAt: new Date().toISOString(), components: { source: 'verified', database: 'verified', storage: 'verified', configuration: 'verified' },
      encrypted: true, integrity: 'verified', independentCopy: 'verified', restore: { status: 'passed', scope: 'synthetic', at: new Date().toISOString() },
      secret: 'NEVER-EXPOSE', path: 'PRIVATE-PATH', alerts: ['unrecognized', 'backup_failed'] }));
    const [status, out] = await handleBackupStatus(store, { token: await token('sys') }, { reportPath });
    assert.equal(status, 200);
    assert.equal(out.productionProtected, false);
    assert.equal(out.environment, 'synthetic');
    assert.equal(JSON.stringify(out).includes('NEVER-EXPOSE'), false);
    assert.equal(JSON.stringify(out).includes('PRIVATE-PATH'), false);
    assert.deepEqual(out.alerts, ['backup_failed','recovery_key_missing']);
    await writeFile(reportPath, '{broken');
    const [badStatus, bad] = await handleBackupStatus(store, { token: await token('sys') }, { reportPath });
    assert.equal(badStatus, 200);
    assert.equal(bad.state, 'invalid_report');
    assert.equal(bad.productionProtected, false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('missing coverage and stale reports cannot display healthy production', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'be-good-monitor-'));
  try {
    const reportPath = join(dir, 'status.json');
    for (const report of [
      { format: 'be-good-backup-status/v1', environment: 'production', generatedAt: new Date().toISOString(), components: { source: 'verified' }, encrypted: true, integrity: 'verified', independentCopy: 'verified' },
      { format: 'be-good-backup-status/v1', environment: 'production', generatedAt: '2020-01-01T00:00:00Z', components: { source: 'verified', database: 'verified', storage: 'verified', configuration: 'verified' }, encrypted: true, integrity: 'verified', independentCopy: 'verified' }
    ]) {
      await writeFile(reportPath, JSON.stringify(report));
      const [, out] = await handleBackupStatus(store, { token: await token('sys') }, { reportPath });
      assert.equal(out.productionProtected, false);
      assert.notEqual(out.state, 'healthy');
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
