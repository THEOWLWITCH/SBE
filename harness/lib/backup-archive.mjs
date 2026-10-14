// Local, encrypted backup archives. No network adapter and no production restoration.
import { createReadStream, createWriteStream, constants } from 'node:fs';
import { open, lstat, mkdir, mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, createCipheriv, createDecipheriv, randomBytes, randomUUID, scrypt, hkdfSync } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const exec = promisify(execFile), derivePassword = promisify(scrypt);
const MAGIC = Buffer.from('BEGOODB1');
const HEADER_SIZE = 8 + 1 + 32 + 12, TAG_SIZE = 16;
const MAX_MANIFEST = 16 * 1024 * 1024, MAX_ARCHIVE = 8 * 1024 ** 3;
export const BACKUP_COMPONENTS = Object.freeze(['source-history', 'source-working-tree', 'database-schema', 'database-data', 'database-roles', 'database-rls', 'storage-objects', 'configuration-references']);
const SOURCE_COMPONENTS = BACKUP_COMPONENTS.slice(0, 2);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function validateArchivePath(name) {
  if (typeof name !== 'string' || !name || name.length > 1024 || /[\\\x00-\x1f\x7f:]/.test(name) || name.startsWith('/') || name.endsWith('/')) throw new Error('Unsafe archive path');
  const parts = name.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Unsafe archive path');
  if (name.normalize('NFC').toLowerCase() === 'be_good_restored_manifest.json') throw new Error('Unsafe archive path: reserved restore metadata name');
  return name;
}

async function noSymlinkAncestors(target, { leafMayBeMissing = false } = {}) {
  const absolute = path.resolve(target), root = path.parse(absolute).root;
  const parts = absolute.slice(root.length).split(path.sep).filter(Boolean);
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    let details;
    try { details = await lstat(current); }
    catch (error) { if (leafMayBeMissing && index === parts.length - 1 && error.code === 'ENOENT') return; throw error; }
    if (details.isSymbolicLink()) throw new Error('Symbolic links are not permitted in backup paths');
  }
}

async function digestFile(filename) {
  await noSymlinkAncestors(filename);
  const details = await lstat(filename);
  if (!details.isFile()) throw new Error('Backup input must be a regular file');
  const hash = createHash('sha256');
  let size = 0;
  for await (const bytes of createReadStream(filename, { flags: constants.O_RDONLY | (constants.O_NOFOLLOW || 0) })) { size += bytes.length; hash.update(bytes); }
  if (size !== details.size) throw new Error('Backup input changed during collection');
  return { size, sha256: hash.digest('hex') };
}

function coverageFor(entries) { return BACKUP_COMPONENTS.map((component) => ({ component, covered: entries.some((entry) => entry.component === component) })); }

function validateManifest(manifest) {
  if (manifest?.format !== 'be-good-backup' || manifest.version !== 1 || !['full', 'source-preservation'].includes(manifest.profile) || !['synthetic', 'local-source', 'owner-approved-exports'].includes(manifest.scope)) throw new Error('Invalid backup manifest');
  if (typeof manifest.backupId !== 'string' || !/^[0-9a-f-]{36}$/i.test(manifest.backupId) || !Number.isFinite(Date.parse(manifest.createdAt)) || !Array.isArray(manifest.entries) || !manifest.entries.length || manifest.entries.length > 100000) throw new Error('Invalid backup manifest');
  const names = new Set();
  let total = 0;
  for (const entry of manifest.entries) {
    validateArchivePath(entry.path);
    const name = entry.path.normalize('NFC').toLowerCase();
    if (names.has(name)) throw new Error('Duplicate archive path or cross-platform collision');
    names.add(name);
    if (!BACKUP_COMPONENTS.includes(entry.component) || !Number.isSafeInteger(entry.size) || entry.size < 0 || !/^[0-9a-f]{64}$/.test(entry.sha256)) throw new Error('Invalid backup entry');
    total += entry.size;
    if (total > MAX_ARCHIVE) throw new Error('Archive exceeds local backup size limit');
  }
  for (const name of names) { const parts = name.split('/'); for (let index = 1; index < parts.length; index++) if (names.has(parts.slice(0, index).join('/'))) throw new Error('Archive file/directory path collision'); }
  const coverage = coverageFor(manifest.entries), required = manifest.profile === 'full' ? BACKUP_COMPONENTS : SOURCE_COMPONENTS;
  const missing = required.filter((component) => !coverage.find((item) => item.component === component).covered);
  if (missing.length) throw new Error(`Missing required backup components: ${missing.join(', ')}`);
  if (JSON.stringify(manifest.coverage) !== JSON.stringify(coverage)) throw new Error('Invalid manifest component coverage');
  if (manifest.profile === 'full' && manifest.scope === 'local-source') throw new Error('A source snapshot cannot be labeled a full dataset backup');
  return total;
}

async function cryptoKey(secret, salt, mode) {
  if (mode === 2 && Buffer.isBuffer(secret) && secret.length === 32) return Buffer.from(hkdfSync('sha256', secret, salt, 'BE GOOD backup archive v1', 32));
  if (mode === 1 && typeof secret === 'string' && secret.length >= 20) return derivePassword(secret, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  throw new Error('Invalid archive authentication key: use a separate random 32-byte key or a passphrase of at least 20 characters');
}

function safeSummary(manifest, archiveSha256) {
  const fullCoverage = manifest.profile === 'full' && manifest.coverage.every((item) => item.covered);
  return { formatVersion: 1, backupId: manifest.backupId, createdAt: manifest.createdAt, profile: manifest.profile, scope: manifest.scope, status: fullCoverage ? 'verified_local' : 'verified_local_source_only', fullCoverage, coverageMeaning: 'present-and-checksummed-artifacts', coverage: manifest.coverage, entries: manifest.entries.length, bytes: manifest.entries.reduce((sum, entry) => sum + entry.size, 0), archiveSha256, independentDestinationVerified: false, liveProviderRestoreVerified: false };
}

export async function createArchive({ destination, secret, profile = 'full', scope = 'synthetic', entries, metadata = {} }) {
  if (!Array.isArray(entries)) throw new Error('Backup entries are required');
  await noSymlinkAncestors(destination, { leafMayBeMissing: true });
  const archiveEntries = [];
  for (const entry of entries) {
    validateArchivePath(entry.path);
    const digest = await digestFile(entry.sourcePath);
    if (entry.expectedDigest && (digest.sha256 !== entry.expectedDigest.sha256 || digest.size !== entry.expectedDigest.size)) throw new Error('Backup input changed during source collection');
    archiveEntries.push({ path: entry.path, component: entry.component, ...digest });
  }
  const manifest = { format: 'be-good-backup', version: 1, backupId: randomUUID(), createdAt: new Date().toISOString(), profile, scope, coverage: coverageFor(archiveEntries), metadata, entries: archiveEntries };
  validateManifest(manifest);
  const encoded = Buffer.from(JSON.stringify(manifest));
  if (encoded.length > MAX_MANIFEST) throw new Error('Backup manifest exceeds size limit');
  const sizePrefix = Buffer.alloc(8); sizePrefix.writeBigUInt64BE(BigInt(encoded.length));
  const mode = Buffer.isBuffer(secret) ? 2 : 1, salt = randomBytes(32), iv = randomBytes(12);
  const header = Buffer.concat([MAGIC, Buffer.from([mode]), salt, iv]), key = await cryptoKey(secret, salt, mode);
  const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(header);
  let handle, ownsOutput = false;
  try {
    handle = await open(destination, 'wx', 0o600); ownsOutput = true;
    await handle.write(header, 0, header.length, 0);
    async function* plaintext() {
      yield sizePrefix; yield encoded;
      for (let index = 0; index < entries.length; index++) {
        await noSymlinkAncestors(entries[index].sourcePath);
        const hash = createHash('sha256'); let size = 0;
        for await (const bytes of createReadStream(entries[index].sourcePath, { flags: constants.O_RDONLY | (constants.O_NOFOLLOW || 0) })) { size += bytes.length; hash.update(bytes); yield bytes; }
        if (size !== archiveEntries[index].size || hash.digest('hex') !== archiveEntries[index].sha256) throw new Error('Backup input changed while encryption was running');
      }
    }
    await pipeline(Readable.from(plaintext()), cipher, createWriteStream(destination, { fd: handle.fd, autoClose: false, start: header.length }));
    const plaintextSize = 8 + encoded.length + archiveEntries.reduce((sum, entry) => sum + entry.size, 0);
    const tag = cipher.getAuthTag(); await handle.write(tag, 0, tag.length, header.length + plaintextSize);
    await handle.sync(); await handle.close(); handle = null;
    const summary = await verifyArchive({ archive: destination, secret });
    return summary;
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    if (ownsOutput) await rm(destination, { force: true }).catch(() => {});
    throw error;
  } finally { key.fill(0); }
}

async function authenticatedPlaintext(archive, secret) {
  await noSymlinkAncestors(archive);
  const info = await lstat(archive);
  if (!info.isFile() || info.size < HEADER_SIZE + TAG_SIZE + 8 || info.size > MAX_ARCHIVE + MAX_MANIFEST + HEADER_SIZE + TAG_SIZE + 8) throw new Error('Invalid or truncated backup archive');
  const archiveSha256 = (await digestFile(archive)).sha256;
  const directory = await mkdtemp(path.join(tmpdir(), 'be-good-authenticated-'));
  const plaintext = path.join(directory, 'authenticated.payload');
  let handle, key;
  try {
    handle = await open(archive, 'r');
    const header = Buffer.alloc(HEADER_SIZE), tag = Buffer.alloc(TAG_SIZE);
    await handle.read(header, 0, header.length, 0); await handle.read(tag, 0, tag.length, info.size - TAG_SIZE);
    await handle.close(); handle = null;
    if (!header.subarray(0, 8).equals(MAGIC)) throw new Error('Invalid backup archive format');
    key = await cryptoKey(secret, header.subarray(9, 41), header[8]);
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(41, 53)); decipher.setAAD(header); decipher.setAuthTag(tag);
    try { await pipeline(createReadStream(archive, { start: HEADER_SIZE, end: info.size - TAG_SIZE - 1 }), decipher, createWriteStream(plaintext, { flags: 'wx', mode: 0o600 })); }
    catch { throw new Error('Backup integrity/authentication verification failed'); }
    if ((await digestFile(archive)).sha256 !== archiveSha256) throw new Error('Backup archive changed during integrity verification');
    return { directory, plaintext, archiveSha256 };
  } catch (error) { if (handle) await handle.close().catch(() => {}); await rm(directory, { recursive: true, force: true }); throw error; }
  finally { key?.fill(0); }
}

async function inspectPlaintext(plaintext) {
  const handle = await open(plaintext, 'r');
  try {
    const prefix = Buffer.alloc(8); const prefixRead = await handle.read(prefix, 0, 8, 0);
    if (prefixRead.bytesRead !== 8) throw new Error('Invalid backup manifest length');
    const bigLength = prefix.readBigUInt64BE();
    if (bigLength < 2n || bigLength > BigInt(MAX_MANIFEST)) throw new Error('Invalid backup manifest length');
    const length = Number(bigLength), encoded = Buffer.alloc(length);
    if ((await handle.read(encoded, 0, length, 8)).bytesRead !== length) throw new Error('Truncated backup manifest');
    let manifest; try { manifest = JSON.parse(encoded.toString('utf8')); } catch { throw new Error('Invalid backup manifest JSON'); }
    const total = validateManifest(manifest), offset = 8 + length;
    if ((await handle.stat()).size !== offset + total) throw new Error('Backup payload size/integrity mismatch');
    let position = offset;
    for (const entry of manifest.entries) {
      const hash = createHash('sha256');
      if (entry.size) {
        const chunk = Buffer.alloc(Math.min(1024 * 1024, entry.size));
        let remaining = entry.size, cursor = position;
        while (remaining) {
          const { bytesRead } = await handle.read(chunk, 0, Math.min(chunk.length, remaining), cursor);
          if (!bytesRead) throw new Error('Backup entry integrity verification failed');
          hash.update(chunk.subarray(0, bytesRead)); remaining -= bytesRead; cursor += bytesRead;
        }
      }
      if (hash.digest('hex') !== entry.sha256) throw new Error('Backup entry integrity verification failed');
      position += entry.size;
    }
    return { manifest, offset };
  } finally { await handle.close(); }
}

export async function verifyArchive({ archive, secret }) {
  const authenticated = await authenticatedPlaintext(archive, secret);
  try { const { manifest } = await inspectPlaintext(authenticated.plaintext); return safeSummary(manifest, authenticated.archiveSha256); }
  finally { await rm(authenticated.directory, { recursive: true, force: true }); }
}

export async function restoreArchive({ archive, secret, destination }) {
  await noSymlinkAncestors(destination, { leafMayBeMissing: true });
  try { await lstat(destination); throw new Error('Restore destination already exists; choose a new isolated directory'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const authenticated = await authenticatedPlaintext(archive, secret);
  let ownsDestination = false;
  try {
    const { manifest, offset } = await inspectPlaintext(authenticated.plaintext);
    await mkdir(destination, { mode: 0o700 }); ownsDestination = true;
    let position = offset;
    for (const entry of manifest.entries) {
      const filename = path.join(destination, ...entry.path.split('/'));
      await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
      await noSymlinkAncestors(filename, { leafMayBeMissing: true });
      if (entry.size) await pipeline(createReadStream(authenticated.plaintext, { start: position, end: position + entry.size - 1 }), createWriteStream(filename, { flags: 'wx', mode: 0o600 }));
      else await writeFile(filename, Buffer.alloc(0), { flag: 'wx', mode: 0o600 });
      position += entry.size;
    }
    await writeFile(path.join(destination, 'BE_GOOD_RESTORED_MANIFEST.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
    return safeSummary(manifest, authenticated.archiveSha256);
  } catch (error) { if (ownsDestination) await rm(destination, { recursive: true, force: true }); throw error; }
  finally { await rm(authenticated.directory, { recursive: true, force: true }); }
}

async function regularFiles(directory, prefix = '') {
  await noSymlinkAncestors(directory);
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    validateArchivePath(relative);
    if (item.isSymbolicLink()) throw new Error('Symbolic links are not permitted in storage snapshots');
    if (item.isDirectory()) files.push(...await regularFiles(path.join(directory, item.name), relative));
    else if (item.isFile()) files.push({ path: relative, sourcePath: path.join(directory, item.name) });
    else throw new Error('Storage snapshot contains a non-regular object');
  }
  return files;
}

async function gitOutput(repository, args, options = {}) {
  try { return (await exec('git', ['-C', repository, ...args], { encoding: 'buffer', maxBuffer: 128 * 1024 * 1024, ...options })).stdout; }
  catch { throw new Error('Local Git collection failed; source backup was not completed'); }
}

async function collectSource(source, scratch, entries) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(source.id || '')) throw new Error('Each source needs a safe unique id');
  const repository = path.resolve(source.repository); await noSymlinkAncestors(repository);
  const top = (await gitOutput(repository, ['rev-parse', '--show-toplevel'])).toString('utf8').trim();
  if (path.resolve(top).toLowerCase() !== repository.toLowerCase()) throw new Error('Source must identify the Git repository root');
  const tracked = (await gitOutput(repository, ['ls-files', '--stage', '-z'])).toString('utf8').split('\0').filter(Boolean);
  if (tracked.some((item) => item.startsWith('160000 '))) throw new Error('Git submodules require an explicit separate source snapshot');
  const before = await gitOutput(repository, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const refs = await gitOutput(repository, ['show-ref']);
  const head = (await gitOutput(repository, ['rev-parse', 'HEAD'])).toString('utf8').trim();
  const stagedBefore = await gitOutput(repository, ['diff', '--cached', '--binary', 'HEAD']);
  const workingBefore = await gitOutput(repository, ['diff', '--binary']);
  const bundle = path.join(scratch, `${source.id}.bundle`);
  await gitOutput(repository, ['bundle', 'create', bundle, '--all']);
  await gitOutput(repository, ['bundle', 'verify', bundle]);
  entries.push({ path: `source/${source.id}/history.bundle`, sourcePath: bundle, component: 'source-history' });
  const listed = (await gitOutput(repository, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])).toString('utf8').split('\0').filter(Boolean);
  const included = [], deleted = [];
  for (const name of [...new Set(listed)].sort()) {
    validateArchivePath(name);
    const filename = path.join(repository, ...name.split('/'));
    let info; try { info = await lstat(filename); } catch (error) { if (error.code === 'ENOENT') { deleted.push(name); continue; } throw error; }
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Git working tree contains a non-regular file or symlink');
    included.push(name); entries.push({ path: `source/${source.id}/working-tree/${name}`, sourcePath: filename, component: 'source-working-tree', expectedDigest: await digestFile(filename) });
  }
  const stateFile = path.join(scratch, `${source.id}.state.json`);
  await writeFile(stateFile, JSON.stringify({ head, refs: refs.toString('utf8').trim().split('\n'), statusPorcelainBase64: before.toString('base64'), trackedEntries: tracked, includedFiles: included, deletedFiles: deleted, ignoredFilesIncluded: false }, null, 2), { mode: 0o600 });
  entries.push({ path: `source/${source.id}/source-state.json`, sourcePath: stateFile, component: 'source-working-tree' });
  for (const [name, content] of [['staged.patch', stagedBefore], ['working.patch', workingBefore]]) {
    const patch = path.join(scratch, `${source.id}.${name}`); await writeFile(patch, content, { mode: 0o600 });
    entries.push({ path: `source/${source.id}/${name}`, sourcePath: patch, component: 'source-working-tree' });
  }
  const after = await gitOutput(repository, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const refsAfter = await gitOutput(repository, ['show-ref']);
  const stagedAfter = await gitOutput(repository, ['diff', '--cached', '--binary', 'HEAD']);
  const workingAfter = await gitOutput(repository, ['diff', '--binary']);
  const headAfter = (await gitOutput(repository, ['rev-parse', 'HEAD'])).toString('utf8').trim();
  if (!before.equals(after) || !refs.equals(refsAfter) || !stagedBefore.equals(stagedAfter) || !workingBefore.equals(workingAfter) || head !== headAfter) throw new Error('Git source changed while collection was running; retry a stable snapshot');
}

function validateConfigurationReferences(value) {
  if (!value || Object.keys(value).some((key) => key !== 'references') || !Array.isArray(value.references)) throw new Error('Configuration export must contain references only, never secret values');
  for (const entry of value.references) if (!entry || Object.keys(entry).some((key) => !['name', 'reference', 'required'].includes(key)) || !/^[A-Z][A-Z0-9_]{0,127}$/.test(entry.name || '') || typeof entry.reference !== 'string' || !/^(env|secret-manager|key-vault):\/\/[A-Za-z0-9_./-]+$/.test(entry.reference) || typeof entry.required !== 'boolean') throw new Error('Configuration export must use named secret references without values');
}

export async function createBackup({ destination, secret, config }) {
  if (!config || !['full', 'source-preservation'].includes(config.profile) || !['synthetic', 'local-source', 'owner-approved-exports'].includes(config.scope)) throw new Error('Explicit backup profile and scope are required');
  if (config.scope === 'owner-approved-exports' && (typeof config.approvalReference !== 'string' || !config.approvalReference.trim())) throw new Error('Owner-approved exports require a recorded approval reference');
  if (!Array.isArray(config.sources) || !config.sources.length || new Set(config.sources.map((source) => source.id)).size !== config.sources.length) throw new Error('At least one source with unique ids is required');
  for (const source of config.sources) {
    const relative = path.relative(path.resolve(source.repository), path.resolve(destination));
    if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Backup output must be outside every source working tree');
  }
  const scratch = await mkdtemp(path.join(tmpdir(), 'be-good-collect-'));
  const entries = [];
  try {
    for (const source of config.sources) await collectSource(source, scratch, entries);
    for (const [key, component] of [['schema', 'database-schema'], ['data', 'database-data'], ['roles', 'database-roles'], ['rls', 'database-rls']]) if (config.database?.[key]) entries.push({ path: `database/${key}.sql`, sourcePath: config.database[key], component });
    if (config.storageDirectory) {
      const files = await regularFiles(config.storageDirectory);
      entries.push(...files.map((file) => ({ ...file, path: `storage/objects/${file.path}`, component: 'storage-objects' })));
      const inventory = path.join(scratch, 'storage-inventory.json');
      await writeFile(inventory, JSON.stringify({ objects: files.map((file) => file.path), empty: files.length === 0 }), { mode: 0o600 });
      entries.push({ path: 'storage/inventory.json', sourcePath: inventory, component: 'storage-objects' });
    }
    if (config.configurationReferences) {
      await noSymlinkAncestors(config.configurationReferences);
      const referencesBytes = await readFile(config.configurationReferences);
      validateConfigurationReferences(JSON.parse(referencesBytes.toString('utf8')));
      const referencesSnapshot = path.join(scratch, 'validated-references.json');
      await writeFile(referencesSnapshot, referencesBytes, { flag: 'wx', mode: 0o600 });
      entries.push({ path: 'configuration/references.json', sourcePath: referencesSnapshot, component: 'configuration-references',
        expectedDigest: { size: referencesBytes.length, sha256: sha256(referencesBytes) } });
    }
    return await createArchive({ destination, secret, profile: config.profile, scope: config.scope, entries, metadata: { sourceCount: config.sources.length, approvalReference: config.approvalReference || null, liveAdaptersUsed: false, ignoredWorkingTreeFilesIncluded: false } });
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
