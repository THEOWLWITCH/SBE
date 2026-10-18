param(
  [Parameter(Mandatory=$true)][string]$NodePath,
  [Parameter(Mandatory=$true)][string]$OriginalRepository,
  [Parameter(Mandatory=$true)][string]$DevelopmentRepository,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [Parameter(Mandatory=$true)][string]$PrivateStage,
  [Parameter(Mandatory=$true)][string]$SourcePayloadSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$')][string]$ApprovalReference
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$liveRoot=[IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\')
$liveStage=[IO.Path]::GetFullPath($PrivateStage)
if(-not $liveStage.StartsWith($liveRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $liveStage -Leaf) -notmatch '^\.private-staging-[a-f0-9]{32}$'){throw 'Unexpected private export stage'}
foreach($liveRepository in @($OriginalRepository,$DevelopmentRepository)) {
  $liveRepositoryRoot=[IO.Path]::GetFullPath($liveRepository).TrimEnd('\')
  if($liveRoot.Equals($liveRepositoryRoot,[StringComparison]::OrdinalIgnoreCase) -or $liveRoot.StartsWith($liveRepositoryRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Archive must remain outside source repositories'}
}
if((Get-Item -LiteralPath $liveStage).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Private stage must not be a link'}
$liveSnapshot=Join-Path $liveStage 'verified-snapshot.json'
if((Get-FileHash -LiteralPath $liveSnapshot -Algorithm SHA256).Hash.ToLowerInvariant() -ne $SourcePayloadSha256){throw 'Source export hash changed'}
$liveId=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$livePrefix=Join-Path $liveRoot $liveId
$liveKeyRoot=Join-Path (Split-Path $liveRoot -Parent) 'live-preservation-keys'
New-Item -ItemType Directory -Path $liveKeyRoot -Force | Out-Null
if((Get-Item -LiteralPath $liveKeyRoot).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Key directory must not be a link'}
$liveIdentity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $liveKeyRoot /inheritance:r /grant:r ($liveIdentity+':(OI)(CI)F') | Out-Null
if($LASTEXITCODE -ne 0){throw 'Could not protect local key directory'}
$liveKeyPath=Join-Path $liveKeyRoot ($liveId+'.key.tmp')
$liveProtectedPath=Join-Path $liveKeyRoot ($liveId+'.key.dpapi')
$liveKey=[Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
try {
  [IO.File]::WriteAllBytes($liveKeyPath,$liveKey)
  [IO.File]::WriteAllBytes($liveProtectedPath,[Security.Cryptography.ProtectedData]::Protect($liveKey,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
  $liveStorage=Join-Path $liveStage 'storage'
  New-Item -ItemType Directory -Path $liveStorage | Out-Null
  $liveReferences=Join-Path $liveStage 'configuration-references.json'
  $liveReferencesValue=@{references=@(
    @{name='SUPABASE_URL';reference='env://render/SUPABASE_URL';required=$true},
    @{name='SUPABASE_SERVICE_KEY';reference='env://render/SUPABASE_SERVICE_KEY';required=$true},
    @{name='OPENAI_API_KEY';reference='env://render/OPENAI_API_KEY';required=$false},
    @{name='ANTHROPIC_API_KEY';reference='env://render/ANTHROPIC_API_KEY';required=$false},
    @{name='SBE_ADMIN_TOKEN';reference='env://netlify/SBE_ADMIN_TOKEN';required=$false}
  )}
  [IO.File]::WriteAllText($liveReferences,($liveReferencesValue|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
  $liveDatabase=@{}
  foreach($liveSection in @('schema','data','roles','rls')){$liveDatabase[$liveSection]=Join-Path $liveStage ('database\'+$liveSection+'.json')}
  $liveConfig=@{profile='full';scope='owner-approved-exports';approvalReference=$ApprovalReference;sources=@(@{id='continuity';repository=[IO.Path]::GetFullPath($OriginalRepository)},@{id='security';repository=[IO.Path]::GetFullPath($DevelopmentRepository)});databaseFormat='supabase-readonly-json';database=$liveDatabase;storageDirectory=$liveStorage;configurationReferences=$liveReferences}
  $liveConfigPath=$livePrefix+'.config.json'
  [IO.File]::WriteAllText($liveConfigPath,($liveConfig|ConvertTo-Json -Depth 7),[Text.UTF8Encoding]::new($false))
  $liveCli=Join-Path $DevelopmentRepository 'scripts\backup.mjs'
  $liveArchive=$livePrefix+'.begood'
  & $NodePath $liveCli create --config $liveConfigPath --output $liveArchive --key-file $liveKeyPath --report ($livePrefix+'.created.json') | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Encrypted archive creation failed'}
  & $NodePath $liveCli verify --archive $liveArchive --key-file $liveKeyPath --report ($livePrefix+'.verified.json') | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Encrypted archive integrity verification failed'}
  $liveRecoveredKey=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($liveProtectedPath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
  try {if(-not [Security.Cryptography.CryptographicOperations]::FixedTimeEquals($liveKey,$liveRecoveredKey)){throw 'Protected key recovery failed'}} finally {[Array]::Clear($liveRecoveredKey,0,$liveRecoveredKey.Length)}
  $liveVerification=Get-Content -LiteralPath ($livePrefix+'.verified.json') -Raw | ConvertFrom-Json
  # Keep the owner-supplied plaintext stage until an independent encrypted copy
  # has been downloaded and verified. This script cannot attest to that step.
  $liveSummary=@{id=$liveId;archive=$liveArchive;archiveBytes=(Get-Item -LiteralPath $liveArchive).Length;archiveSha256=$liveVerification.archiveSha256;entries=$liveVerification.entries;contentBytes=$liveVerification.bytes;artifactCoverageVerified=$liveVerification.fullCoverage;coverageMeaning='present-and-checksummed-artifacts';databaseExportFormat='supabase-readonly-json';sourcePayloadSha256=$SourcePayloadSha256;approvalReference=$ApprovalReference;localProtectedKeyRecovered=$true;providerRestoreVerified=$false;portableKeyVerified=$false;independentDestinationVerified=$false;plaintextStageRetained=$true;plaintextCleanupRequiredAfterIndependentVerification=$true}
  $liveSummary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath ($livePrefix+'.summary.json') -Encoding utf8
} catch {
  # Retain ciphertext and its protected key together for diagnosis/recovery.
  # Never label an interrupted run successful or delete the supplied data stage.
  $liveFailure=@{id=$liveId;ok=$false;operation='local-live-export-preservation';failedAt=[DateTime]::UtcNow.ToString('o');independentDestinationVerified=$false;plaintextStageRetained=$true;reviewRequired=$true}
  try { [IO.File]::WriteAllText($livePrefix+'.failed.json',($liveFailure|ConvertTo-Json),[Text.UTF8Encoding]::new($false)) } catch {}
  throw 'Live export preservation did not complete; confidential details omitted; inspect per-run failure metadata'
} finally {
  [Array]::Clear($liveKey,0,$liveKey.Length)
  if(Test-Path -LiteralPath $liveKeyPath){Remove-Item -LiteralPath $liveKeyPath -Force}
}
$liveSummary | ConvertTo-Json -Depth 4
