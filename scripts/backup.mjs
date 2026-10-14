#!/usr/bin/env node
// Local operations only. Supply previously authorized exports; no live service is queried.
import { readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createBackup, verifyArchive, restoreArchive } from '../harness/lib/backup-archive.mjs';

const HELP = `BE GOOD local encrypted backup
  node scripts/backup.mjs create --config CONFIG.json --output NEW.begood --key-file SEPARATE-32-BYTE-KEY [--report NEW-report.json]
  node scripts/backup.mjs verify --archive COPY.begood --key-file SEPARATE-32-BYTE-KEY [--report NEW-report.json]
  node scripts/backup.mjs restore --archive COPY.begood --destination NEW-ISOLATED-DIRECTORY --key-file SEPARATE-32-BYTE-KEY [--report NEW-report.json]
Use --passphrase-file instead of --key-file for a separate UTF-8 passphrase (20+ characters).
Never store the key in the archive, a source working tree, or the report. This CLI does not configure off-site backups or restore a live database.`;

function argumentsFrom(args) {
  const command = args.shift();
  if (!command || command === '--help' || command === 'help') return { command: 'help' };
  const allowed = { create: ['config', 'output', 'key-file', 'passphrase-file', 'report'], verify: ['archive', 'key-file', 'passphrase-file', 'report'], restore: ['archive', 'destination', 'key-file', 'passphrase-file', 'report'] }[command];
  if (!allowed) throw new Error('Invalid command; use --help');
  const result = { command };
  while (args.length) {
    const name = args.shift();
    if (!name?.startsWith('--') || !allowed.includes(name.slice(2)) || result[name.slice(2)] || !args.length || args[0].startsWith('--')) throw new Error('Invalid or repeated command option; use --help');
    result[name.slice(2)] = args.shift();
  }
  const required = command === 'create' ? ['config', 'output'] : command === 'verify' ? ['archive'] : ['archive', 'destination'];
  if (required.some((name) => !result[name]) || Boolean(result['key-file']) === Boolean(result['passphrase-file'])) throw new Error('Missing command option or ambiguous key; use --help');
  return result;
}

function inside(candidate, root) { const relative = path.relative(path.resolve(root), path.resolve(candidate)); return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }

function safeError(error) {
  if (error.code === 'EEXIST') return 'Output or restore destination already exists; nothing was overwritten';
  if (error.code === 'ENOENT') return 'Required local input or parent directory is missing';
  if (error.code === 'EACCES' || error.code === 'EPERM') return 'Operating-system access denied for a local backup input or destination';
  const message = String(error.message || '');
  if (/^(Invalid|Missing required backup components|Unsafe archive path|Duplicate archive|Archive |Backup |Restore destination|Symbolic links|Git |Local Git|Source must|Each source|At least one source|Explicit backup|Owner-approved exports|Configuration export|Storage snapshot|Output |Key file|Passphrase file|Missing command|Required local)/.test(message) && !/[\r\n]/.test(message)) return message;
  return 'Local backup operation failed; no successful result was recorded';
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  if (options.command === 'help') return console.log(HELP);
  const keyPath = path.resolve(options['key-file'] || options['passphrase-file']);
  if (!(await lstat(keyPath)).isFile()) throw new Error('Key file must be a separate regular file');
  let secret = await readFile(keyPath);
  if (options['key-file'] && secret.length !== 32) throw new Error('Key file must contain exactly 32 random bytes');
  if (options['passphrase-file']) { secret = secret.toString('utf8').replace(/\r?\n$/, ''); if (secret.length < 20) throw new Error('Passphrase file must contain at least 20 characters'); }
  const startedAt = new Date().toISOString(), start = performance.now();
  let result;
  try {
    if (options.command === 'create') {
      let config; try { config = JSON.parse(await readFile(options.config, 'utf8')); } catch { throw new Error('Invalid backup configuration JSON or unreadable configuration'); }
      const base = path.dirname(path.resolve(options.config));
      config.sources = config.sources?.map((source) => ({ ...source, repository: path.resolve(base, source.repository) }));
      if (config.database) config.database = Object.fromEntries(Object.entries(config.database).map(([key, value]) => [key, path.resolve(base, value)]));
      for (const name of ['storageDirectory', 'configurationReferences']) if (config[name]) config[name] = path.resolve(base, config[name]);
      if (config.sources?.some((source) => inside(keyPath, source.repository)) || (config.storageDirectory && inside(keyPath, config.storageDirectory))) throw new Error('Key file must be outside source working trees and storage exports');
      if (path.resolve(options.output) === keyPath || (options.report && path.resolve(options.report) === keyPath)) throw new Error('Output must not replace the separate key');
      result = await createBackup({ config, destination: path.resolve(options.output), secret });
    } else {
      if (options.command === 'restore' && inside(keyPath, options.destination)) throw new Error('Key file must remain outside the isolated restore directory');
      result = await (options.command === 'verify' ? verifyArchive({ archive: path.resolve(options.archive), secret }) : restoreArchive({ archive: path.resolve(options.archive), secret, destination: path.resolve(options.destination) }));
    }
    const report = { ok: true, operation: options.command, startedAt, completedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - start), ...result };
    if (options.report) await writeFile(options.report, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(report, null, 2));
  } finally { if (Buffer.isBuffer(secret)) secret.fill(0); }
}

main().catch((error) => { console.error(JSON.stringify({ ok: false, error: safeError(error) })); process.exitCode = 1; });
