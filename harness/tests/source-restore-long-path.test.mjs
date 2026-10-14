import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createBackup,restoreArchive} from '../lib/backup-archive.mjs';
const exec=promisify(execFile);
test('actual Git source verification works with Windows paths beyond MAX_PATH without global config changes',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'be-good-long-path-'));
  try {
    const repo=path.join(root,'original');await mkdir(path.join(repo,'app'),{recursive:true});
    await exec('git',['init',repo]);await exec('git',['-C',repo,'config','user.name','Synthetic recovery']);
    await exec('git',['-C',repo,'config','user.email','synthetic@example.invalid']);
    await writeFile(path.join(repo,'app/entry.html'),'גרסה קודמת');
    await exec('git',['-C',repo,'add','app/entry.html']);await exec('git',['-C',repo,'commit','-m','Synthetic prior']);
    await writeFile(path.join(repo,'app/entry.html'),'גרסה נוכחית');
    await exec('git',['-C',repo,'add','app/entry.html']);await exec('git',['-C',repo,'commit','-m','Synthetic current']);
    await writeFile(path.join(repo,'untracked.txt'),'קובץ מקומי');
    const archive=path.join(root,'copy.begood'),secret=randomBytes(32);
    await createBackup({destination:archive,secret,config:{profile:'source-preservation',scope:'synthetic',sources:[{id:'continuity',repository:repo},{id:'security',repository:repo}]}});
    const parent=path.join(root,'long-parent-'.repeat(15),'nested-parent-'.repeat(6));await mkdir(parent,{recursive:true});
    const restored=path.join(parent,'restored');assert.ok(path.join(restored,'source/continuity/git-restored.git/objects/pack').length>260);
    await restoreArchive({archive,secret,destination:restored});secret.fill(0);
    const report=path.join(root,'report.json'),script=fileURLToPath(new URL('../../scripts/verify-source-restore.mjs',import.meta.url));
    await exec(process.execPath,[script,'--restored',restored,'--original',repo,'--report',report],{maxBuffer:1024*1024});
    const result=JSON.parse(await readFile(report,'utf8'));assert.equal(result.ok,true);
    assert.equal(result.details[0].currentOriginalUnchanged,true);assert.equal(result.details[0].filesVerified,2);
    assert.equal((await exec('git',['-C',repo,'config','--local','--get','core.longpaths']).catch(error=>({stdout:'',code:error.code}))).stdout,'');
  } finally {await rm(root,{recursive:true,force:true});}
});
