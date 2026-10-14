import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('preservation removes plaintext drill and temporary key when restore succeeds but report writing fails', {skip:process.platform!=='win32'}, async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'be-good-preservation-failure-'));
  try {
    const original=path.join(root,'original'), development=path.join(root,'development'), output=path.join(root,'backups');
    await mkdir(original);await mkdir(development);
    // The boundary stub models a CLI that has extracted a source tree and then
    // failed while writing its report. Encryption itself is tested separately.
    const fakeNode=path.join(root,'synthetic-node.ps1');
    await writeFile(fakeNode,`$ErrorActionPreference='Stop'
$command=$args[1]
function ValueAfter($name) { for($i=0;$i -lt $argsForNode.Length;$i++){if($argsForNode[$i] -eq $name){return $argsForNode[$i+1]}} }
$argsForNode=$args
if($command -eq 'create') { [IO.File]::WriteAllText((ValueAfter '--output'),'synthetic archive stub'); [IO.File]::WriteAllText((ValueAfter '--report'),'{}'); $global:LASTEXITCODE=0; return }
if($command -eq 'verify') { [IO.File]::WriteAllText((ValueAfter '--report'),'{}'); $global:LASTEXITCODE=0; return }
if($command -eq 'restore') { $target=ValueAfter '--destination'; New-Item -ItemType Directory -Path $target | Out-Null; [IO.File]::WriteAllText((Join-Path $target 'plaintext.txt'),'synthetic plaintext'); $global:LASTEXITCODE=1; return }
throw 'Unexpected synthetic boundary call'
`);
    const script=fileURLToPath(new URL('../../scripts/preserve-source.ps1',import.meta.url));
    const run=spawnSync('pwsh',['-NoLogo','-NoProfile','-NonInteractive','-File',script,'-NodePath',fakeNode,
      '-OriginalRepository',original,'-DevelopmentRepository',development,'-OutputDirectory',output],{encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(run.error,undefined);
    assert.notEqual(run.status,0);
    assert.match(run.stderr,/Isolated source restore failed/);
    const files=await readdir(output);
    assert.ok(files.some(name=>name.endsWith('.begood')),'the encrypted artifact/stub remains; cleanup is limited to the owned drill');
    assert.equal(files.some(name=>name.startsWith('.drill-')),false,'failed report must not leave plaintext restore');
    assert.equal((await readdir(path.join(root,'source-preservation-keys'))).some(name=>name.endsWith('.tmp')),false,'temporary raw key must be removed');
    assert.equal((await readdir(original)).length,0);
    assert.equal((await readdir(development)).length,0);
  } finally {await rm(root,{recursive:true,force:true});}
});
