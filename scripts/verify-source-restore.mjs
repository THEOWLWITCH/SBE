// Verify a decrypted isolated source drill against its authenticated manifest.
import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const exec = promisify(execFile);
const option = key => { const index = process.argv.indexOf(key); return index < 0 ? null : process.argv[index + 1]; };
const restored = option('--restored'), original = option('--original'), reportPath = option('--report');
if (!restored || !original || !reportPath) throw Error('Use --restored ISOLATED_ROOT --original ORIGINAL_REPO --report NEW_REPORT');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const startedAt = new Date().toISOString(), start = performance.now();
const manifest = JSON.parse(await readFile(path.join(restored,'BE_GOOD_RESTORED_MANIFEST.json'),'utf8'));
const details = [];
for (const id of ['continuity','security']) {
  const folder = path.join(restored,'source',id);
  const state = JSON.parse(await readFile(path.join(folder,'source-state.json'),'utf8'));
  const clone = path.join(folder,'git-restored.git');
  await exec('git',['clone','--mirror',path.join(folder,'history.bundle'),clone]);
  const refs = (await exec('git',['-C',clone,'show-ref'])).stdout.trim().split('\n').sort();
  assert.deepEqual(refs,state.refs.map(row=>row.trim()).sort());
  assert.equal((await exec('git',['-C',clone,'rev-parse','HEAD'])).stdout.trim(),state.head);
  let count = 0;
  for (const entry of manifest.entries.filter(row=>row.path.startsWith(`source/${id}/working-tree/`))) {
    const bytes = await readFile(path.join(restored,...entry.path.split('/')));
    assert.equal(sha(bytes),entry.sha256); count++;
    if (id === 'continuity') {
      const relative = entry.path.slice(`source/${id}/working-tree/`.length);
      assert.equal(sha(await readFile(path.join(original,...relative.split('/')))),entry.sha256,relative);
    }
  }
  assert.equal(count,state.includedFiles.length);
  if (id === 'continuity') {
    assert.equal((await exec('git',['-C',original,'rev-parse','HEAD'])).stdout.trim(),state.head);
    for (const relative of state.deletedFiles) await assert.rejects(access(path.join(original,...relative.split('/'))));
  }
  // A previous release can be recovered without changing the current checkout.
  const prior = (await exec('git',['-C',clone,'rev-parse',state.head+'^'])).stdout.trim();
  const priorFile = (await exec('git',['-C',clone,'show',prior+':app/entry.html'],{encoding:'buffer',maxBuffer:8*1024*1024})).stdout;
  assert.ok(priorFile.length);
  details.push({ source:id,head:state.head,restoredRefs:refs.length,filesVerified:count,priorCommitRecovered:prior,priorEntrySha256:sha(priorFile),
    currentOriginalUnchanged:id==='continuity' ? true : null });
}
const report={ok:true,exercise:'actual-source-preservation-restore',startedAt,completedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-start),
  encryptedArchiveOpened:true,sourceOnly:true,liveUserDataAccessed:false,independentDestinationVerified:false,details};
await writeFile(reportPath,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify(report,null,2));
