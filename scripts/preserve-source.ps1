param(
  [Parameter(Mandatory=$true)][string]$NodePath,
  [Parameter(Mandatory=$true)][string]$OriginalRepository,
  [Parameter(Mandatory=$true)][string]$DevelopmentRepository,
  [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$preserveRoot = [IO.Path]::GetFullPath($OutputDirectory)
foreach ($preserveRepo in @($OriginalRepository,$DevelopmentRepository)) {
  $preserveRepoRoot = [IO.Path]::GetFullPath($preserveRepo).TrimEnd('\')
  if ($preserveRoot.Equals($preserveRepoRoot,[StringComparison]::OrdinalIgnoreCase) -or $preserveRoot.StartsWith($preserveRepoRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Backup destination must be outside both repositories' }
}
New-Item -ItemType Directory -Path $preserveRoot -Force | Out-Null
$preserveKeyRoot = [IO.Path]::GetFullPath((Join-Path (Split-Path $preserveRoot -Parent) 'source-preservation-keys'))
New-Item -ItemType Directory -Path $preserveKeyRoot -Force | Out-Null
if ((Get-Item -LiteralPath $preserveKeyRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Protected key folder must not be a link' }
$preserveId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$preservePrefix = Join-Path $preserveRoot $preserveId
$preserveKeyPath = Join-Path $preserveKeyRoot ($preserveId + '.key.tmp')
$preserveProtectedPath = Join-Path $preserveKeyRoot ($preserveId + '.key.dpapi')
$preserveConfigPath = $preservePrefix + '.config.json'
$preserveArchivePath = $preservePrefix + '.begood'
$preserveDrillRoot = Join-Path $preserveRoot ('.drill-' + $preserveId)
$preserveRestorePath = Join-Path $preserveDrillRoot 'restored'
$preserveOwnsRestore = $false
$preserveKey = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
try {
  [IO.File]::WriteAllBytes($preserveKeyPath,$preserveKey)
  $preserveIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $preserveKeyPath /inheritance:r /grant:r ($preserveIdentity+':F') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not restrict temporary key permissions' }
  $preserveWrapped = [Security.Cryptography.ProtectedData]::Protect($preserveKey,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  [IO.File]::WriteAllBytes($preserveProtectedPath,$preserveWrapped)
  $preserveConfig = @{profile='source-preservation';scope='local-source';sources=@(@{id='continuity';repository=[IO.Path]::GetFullPath($OriginalRepository)},@{id='security';repository=[IO.Path]::GetFullPath($DevelopmentRepository)})}
  [IO.File]::WriteAllText($preserveConfigPath,($preserveConfig|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
  $preserveCli = Join-Path $DevelopmentRepository 'scripts\backup.mjs'
  & $NodePath $preserveCli create --config $preserveConfigPath --output $preserveArchivePath --key-file $preserveKeyPath --report ($preservePrefix+'.created.json') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Encrypted source backup failed' }
  & $NodePath $preserveCli verify --archive $preserveArchivePath --key-file $preserveKeyPath --report ($preservePrefix+'.verified.json') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Archive integrity verification failed' }
  New-Item -ItemType Directory -Path $preserveDrillRoot | Out-Null
  $preserveOwnsRestore = $true
  & $NodePath $preserveCli restore --archive $preserveArchivePath --destination $preserveRestorePath --key-file $preserveKeyPath --report ($preservePrefix+'.restored.json') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Isolated source restore failed' }
  & $NodePath (Join-Path $DevelopmentRepository 'scripts\verify-source-restore.mjs') --restored $preserveRestorePath --original $OriginalRepository --report ($preservePrefix+'.source-check.json') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Restored source verification failed' }
  $preserveCheckKey = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($preserveProtectedPath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  if ([Convert]::ToBase64String($preserveCheckKey) -ne [Convert]::ToBase64String($preserveKey)) { throw 'Local protected key recovery failed' }
  [Array]::Clear($preserveCheckKey,0,$preserveCheckKey.Length)
  $preserveReport = Get-Content -LiteralPath ($preservePrefix+'.restored.json') -Raw | ConvertFrom-Json
  $preserveSummary = @{id=$preserveId;archive=$preserveArchivePath;sourceRestoreVerified=$true;plaintextRestoreRetained=$false;entries=$preserveReport.entries;bytes=$preserveReport.bytes;archiveSha256=$preserveReport.archiveSha256;fullCoverage=$false;independentDestinationVerified=$false;localProtectedKeyRecovered=$true}
} finally {
  [Array]::Clear($preserveKey,0,$preserveKey.Length)
  if (Test-Path -LiteralPath $preserveKeyPath) { Remove-Item -LiteralPath $preserveKeyPath -Force }
  if ($preserveOwnsRestore) {
    $preserveCleanupTarget = [IO.Path]::GetFullPath($preserveDrillRoot)
    if (-not $preserveCleanupTarget.StartsWith($preserveRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $preserveCleanupTarget -Leaf) -ne ('.drill-'+$preserveId)) { throw 'Unexpected restore cleanup target' }
    Remove-Item -LiteralPath $preserveCleanupTarget -Recurse -Force
  }
}
$preserveSummary | ConvertTo-Json -Depth 3
