#!/usr/bin/env node
// Offline key/configuration recovery only. Never restores or connects to a database.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { openRecoveryKit } from '../harness/lib/recovery-key-kit.mjs';

const exec = promisify(execFile);
async function main() {
  if (process.argv.length !== 5) throw new Error('Expected kit, private passphrase file and new recovery directory');
  const [kitPath, passphrasePath, destination] = process.argv.slice(2);
  const value = await openRecoveryKit(JSON.parse(await readFile(kitPath, 'utf8')), (await readFile(passphrasePath, 'utf8')).replace(/\r?\n$/, ''));
  let owned = false;
  try {
    await mkdir(destination, { mode: 0o700 }); owned = true;
    if (process.platform === 'win32') {
      const identity = (await exec('whoami.exe')).stdout.trim();
      await exec('icacls.exe', [path.resolve(destination), '/inheritance:r', '/grant:r', identity + ':(OI)(CI)F']);
    }
    for (const item of value.archiveKeys) {
      const bytes = Buffer.from(item.keyBase64, 'base64');
      try { await writeFile(path.join(destination, item.id + '.key'), bytes, { flag: 'wx', mode: 0o600 }); }
      finally { bytes.fill(0); }
    }
    for (const item of value.providerConfigurations) await writeFile(path.join(destination, item.name + '.private.json'), JSON.stringify(item.document, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ recoveredKeys: value.archiveKeys.length, recoveredConfigurations: value.providerConfigurations.length, liveDatabaseRestorePerformed: false }));
  } catch (error) { if (owned) await rm(destination, { recursive: true, force: true }); throw error; }
}
main().catch(() => { console.error('Offline key recovery failed; confidential details omitted'); process.exitCode = 1; });
