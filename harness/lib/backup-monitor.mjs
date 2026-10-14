import { open } from 'node:fs/promises';
import { verifyToken } from './access.mjs';

const COMPONENTS = ['source', 'database', 'storage', 'configuration'];
const COVERAGE = new Set(['verified', 'missing', 'not_configured', 'failed']);
const ALERTS = new Set(['backup_failed', 'restore_failed', 'missing_components', 'stale_report', 'independent_copy_missing', 'recovery_key_missing']);
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const empty = state => ({ state, productionProtected: false, environment: null, generatedAt: null,
  encrypted: false, integrity: 'not_verified', independentCopy: 'not_configured', portableRecoveryKeyVerified: false,
  components: Object.fromEntries(COMPONENTS.map(k => [k, 'not_configured'])), restore: null, alerts: [] });

// The runner writes only metadata here. No archive paths, raw exceptions, tokens,
// contractual documents, or backup bytes are returned to the browser.
export async function handleBackupStatus(store, payload, { reportPath } = {}) {
  let who;
  try { who = await verifyToken(store, payload?.token); } catch { return [503, { error: 'authorization_unavailable' }]; }
  if (!who || who.k !== 'sys') return [403, { error: 'owner_only' }];
  if (!reportPath) return [200, empty('not_configured')];
  let report;
  try {
    const file = await open(reportPath, 'r');
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 65536) return [200, empty('invalid_report')];
      report = JSON.parse(await file.readFile('utf8'));
    } finally { await file.close(); }
  } catch (error) { return [200, empty(error.code === 'ENOENT' ? 'not_configured' : 'invalid_report')]; }
  if (report?.format !== 'be-good-backup-status/v1' || !['synthetic', 'local-source', 'production'].includes(report.environment)) return [200, empty('invalid_report')];
  const generatedAt = date(report.generatedAt);
  if (!generatedAt || Date.parse(generatedAt) > Date.now() + 60000) return [200, empty('invalid_report')];
  const components = Object.fromEntries(COMPONENTS.map(k => [k, COVERAGE.has(report.components?.[k]) ? report.components[k] : 'missing']));
  const stale = Date.now() - Date.parse(generatedAt) > 48 * 3600e3;
  const encrypted = report.encrypted === true;
  const integrity = report.integrity === 'verified' ? 'verified' : 'not_verified';
  const independentCopy = report.independentCopy === 'verified' ? 'verified' : 'not_configured';
  const portableRecoveryKeyVerified = report.portableRecoveryKeyVerified === true;
  const restoreAt = date(report.restore?.at);
  const restore = restoreAt && ['synthetic', 'isolated-real-data'].includes(report.restore.scope)
    && ['passed', 'failed'].includes(report.restore.status)
    ? { at: restoreAt, scope: report.restore.scope, status: report.restore.status } : null;
  const alerts = (Array.isArray(report.alerts) ? report.alerts : []).filter(x => ALERTS.has(x));
  if (stale) alerts.push('stale_report');
  if (Object.values(components).some(x => x !== 'verified')) alerts.push('missing_components');
  if (independentCopy !== 'verified') alerts.push('independent_copy_missing');
  if (!portableRecoveryKeyVerified) alerts.push('recovery_key_missing');
  // "Healthy" means current reported production coverage, never a synthetic
  // drill. Operational proof of a provider/off-site copy is a separate gate.
  const productionProtected = !stale && report.environment === 'production' && encrypted
    && integrity === 'verified' && independentCopy === 'verified' && portableRecoveryKeyVerified && restore?.status === 'passed'
    && restore.scope === 'isolated-real-data' && !alerts.length && Object.values(components).every(x => x === 'verified');
  return [200, { state: stale ? 'stale' : productionProtected ? 'healthy' : 'attention', productionProtected,
    environment: report.environment, generatedAt, components, encrypted, integrity, independentCopy, portableRecoveryKeyVerified, restore, alerts: [...new Set(alerts)] }];
}
