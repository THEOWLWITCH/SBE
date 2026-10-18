#!/usr/bin/env node
// A one-use local form. Confidential configuration never enters process arguments or logs.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, lstat, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const JSON_LIMIT = 2 * 1024 * 1024;
const WIRE_LIMIT = 8 * 1024 * 1024;
let startupStage = 'arguments';
const escapePs = value => "'" + value.replaceAll("'", "''") + "'";
const validServiceId = value => typeof value === 'string' && /^srv-[a-z0-9]{8,80}$/.test(value);
const page = body => `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>גיבוי הגדרות Render</title><style>body{font:18px Arial,sans-serif;max-width:760px;margin:40px auto;padding:20px;line-height:1.6;color:#123}label,textarea,button{display:block;width:100%;box-sizing:border-box}textarea{font:14px monospace;height:320px;padding:12px}button{font:inherit;padding:14px;margin-top:20px;background:#16674c;color:white;border:0;border-radius:8px}</style>${body}</html>`;
const form = page('<h1>גיבוי מקומי מוצפן של הגדרות Render</h1><p>הטופס פועל במחשב הזה בלבד. הפרטים יישמרו מוצפנים לפרופיל Windows הנוכחי. סגרי את הטופס לאחר השמירה.</p><form method="post" autocomplete="off"><label for="configuration">מסמך ההגדרות בפורמט JSON</label><textarea id="configuration" name="configuration" dir="ltr" autocomplete="off" spellcheck="false" required></textarea><button type="submit">שמירת הגדרות מוצפנת</button></form>');
const successPage = page('<h1>ההגדרות נשמרו מוצפנות</h1><p>בדיקת פתיחת ההצפנה המקומית הצליחה. אפשר לסגור את הטופס. שחזור אצל ספק השירות ועותק ענן עצמאי טרם אומתו.</p>');
const errorPage = page('<h1>ההגדרות לא נשמרו</h1><p>לא נרשמה הצלחה. פרטי ההגדרות אינם נכללים בהודעת השגיאה.</p>');

function boundedDepth(value, maximum = 30) {
  const pending = [[value, 0]];
  while (pending.length) {
    const [entry, depth] = pending.pop();
    if (entry && typeof entry === 'object') {
      if (depth > maximum) return false;
      for (const child of Object.values(entry)) if (child && typeof child === 'object') pending.push([child, depth + 1]);
    }
  }
  return true;
}

export async function startProviderCapture({ expectedServiceId, persist, lifetimeMs = 20 * 60 * 1000, maxJsonBytes = JSON_LIMIT, maxWireBytes = WIRE_LIMIT, onComplete = () => {}, onRejected = () => {} }) {
  if (!validServiceId(expectedServiceId) || typeof persist !== 'function' || !Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1 || !Number.isSafeInteger(maxJsonBytes) || maxJsonBytes < 1 || maxJsonBytes > JSON_LIMIT || !Number.isSafeInteger(maxWireBytes) || maxWireBytes < 1 || maxWireBytes > WIRE_LIMIT) throw new Error('Invalid capture options');
  const token = '/' + randomBytes(32).toString('base64url');
  let complete = false, busy = false, expired = false, origin;
  const server = http.createServer(async (req, res) => {
    const respond = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff', 'Connection': 'close', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" });
      res.end(body);
    };
    const originClassification = req.headers.origin === undefined ? 'missing' : req.headers.origin === 'null' ? 'opaque-null' : req.headers.origin === origin ? 'expected-local' : 'other';
    const rejectForbidden = reason => {
      try { onRejected({ rejected: true, reason, originClassification }); } catch { /* Diagnostics must not affect rejection. */ }
      return respond(403, 'Forbidden(' + reason + ')');
    };
    if (req.url !== token || req.headers.host !== new URL(origin).host || req.socket.remoteAddress !== '127.0.0.1') return respond(404, 'Not found');
    if (complete || busy || expired) return respond(409, 'Capture unavailable');
    if (req.method === 'GET') return respond(200, form);
    if (req.method !== 'POST') return rejectForbidden('method');
    if (req.headers.origin !== origin) return rejectForbidden('origin');
    if (!/^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) return rejectForbidden('contenttype');
    if (req.headers['content-encoding']) return rejectForbidden('contentencoding');
    const declaredLength = req.headers['content-length'];
    if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxWireBytes)) return respond(413, 'Request too large');
    busy = true;
    const chunks = []; let wire, plaintext;
    try {
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxWireBytes) { chunk.fill(0); respond(413, 'Request too large'); return; }
        chunks.push(chunk);
      }
      wire = Buffer.concat(chunks);
      const fields = new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(wire));
      if (fields.getAll('configuration').length !== 1 || [...fields.keys()].some(key => key !== 'configuration')) return respond(400, errorPage);
      const configuration = fields.get('configuration');
      if (Buffer.byteLength(configuration, 'utf8') > maxJsonBytes) return respond(413, 'Request too large');
      let document;
      try { document = JSON.parse(configuration); } catch { return respond(400, errorPage); }
      if (!document || Array.isArray(document) || typeof document !== 'object' || document.provider !== 'render' || document.identity !== expectedServiceId || !document.payload || Array.isArray(document.payload) || typeof document.payload !== 'object' || Object.keys(document).some(key => !['provider', 'identity', 'payload'].includes(key)) || !boundedDepth(document.payload)) return respond(400, errorPage);
      if (expired) return respond(410, 'Capture expired');
      const capturedAtISO = new Date().toISOString();
      const metadata = { format: 'provider-configuration-preservation/v1', provider: 'render', identity: expectedServiceId, capturedAtISO, capturedPayloadSectionCount: Object.keys(document.payload).length, independentCopyVerified: false, providerRestorePerformed: false, crossMachineRecoveryVerified: false };
      plaintext = Buffer.from(JSON.stringify({ provider: 'render', identity: expectedServiceId, capturedAtISO, payload: document.payload }), 'utf8');
      const result = await persist({ plaintext, metadata: { ...metadata } });
      const report = { ...metadata, encrypted: true, dpapiCurrentUserRoundTripVerified: true };
      if (result && /^[a-f0-9]{64}$/.test(result.ciphertextSha256) && Number.isSafeInteger(result.ciphertextBytes) && result.ciphertextBytes > 0) { report.ciphertextSha256 = result.ciphertextSha256; report.ciphertextBytes = result.ciphertextBytes; }
      complete = true;
      respond(200, successPage);
      server.close();
      try { onComplete(report); } catch { /* Completion notification must never expose configuration or change persistence. */ }
    } catch { respond(500, errorPage); }
    finally { plaintext?.fill(0); wire?.fill(0); chunks.forEach(chunk => chunk.fill(0)); busy = false; }
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 30_000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  const timer = setTimeout(() => { expired = true; server.close(); server.closeIdleConnections(); }, lifetimeMs);
  timer.unref(); server.on('close', () => clearTimeout(timer));
  return { server, url: origin + token };
}

// Only ciphertext and non-confidential verification metadata leave the PowerShell child.
async function protectWithWindowsDpapi(plaintext, output) {
  // Reserve the new filename exclusively, so cleanup can only remove a file we created.
  const reserved = await open(output, 'wx', 0o600);
  await reserved.close();
  const script = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$plain=$null;$cipher=$null;$stored=$null;$opened=$null;$stream=$null;$output=${escapePs(output)};try{Add-Type -AssemblyName System.Security;$inputStream=[Console]::OpenStandardInput();$memory=[IO.MemoryStream]::new();$segment=[ArraySegment[byte]]::new([byte[]]::new(0));try{$inputStream.CopyTo($memory);$plain=$memory.ToArray()}finally{if($memory.TryGetBuffer([ref]$segment)){[Array]::Clear($segment.Array,0,$segment.Array.Length)};$memory.Dispose()};if($plain.Length -gt ${JSON_LIMIT + 4096}){throw 'Invalid input'};$cipher=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);$stream=[IO.FileStream]::new($output,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::None);$stream.Write($cipher,0,$cipher.Length);$stream.Flush($true);$stream.Dispose();$stream=$null;$stored=[IO.File]::ReadAllBytes($output);$opened=[Security.Cryptography.ProtectedData]::Unprotect($stored,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);if($opened.Length -ne $plain.Length){throw 'Verification failed'};$different=0;for($i=0;$i -lt $plain.Length;$i++){$different=$different -bor ($plain[$i] -bxor $opened[$i])};if($different -ne 0){throw 'Verification failed'};$hash=[Security.Cryptography.SHA256]::Create();try{$digest=[Convert]::ToHexString($hash.ComputeHash($stored)).ToLowerInvariant()}finally{$hash.Dispose()};@{ciphertextSha256=$digest;ciphertextBytes=$stored.Length}|ConvertTo-Json -Compress}catch{if($stream){$stream.Dispose()};exit 1}finally{foreach($bytes in @($plain,$cipher,$stored,$opened)){if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}}}`;
  const child = spawn('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const chunks = []; let size = 0;
  child.stdout.on('data', bytes => { size += bytes.length; if (size > 4096) { bytes.fill(0); child.kill(); } else chunks.push(bytes); });
  child.stderr.on('data', bytes => bytes.fill(0));
  child.stdin.on('error', () => {});
  child.stdin.end(plaintext);
  const timeout = setTimeout(() => child.kill(), 60_000); timeout.unref();
  let outputBytes;
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', () => reject(new Error('Protected configuration unavailable'))); child.once('close', resolve); });
    if (code !== 0 || size > 4096) throw new Error('Protected configuration unavailable');
    outputBytes = Buffer.concat(chunks);
    const result = JSON.parse(outputBytes.toString('utf8'));
    if (!/^[a-f0-9]{64}$/.test(result.ciphertextSha256) || !Number.isSafeInteger(result.ciphertextBytes) || result.ciphertextBytes < 1) throw new Error('Protected configuration unavailable');
    return result;
  } catch { await rm(output, { force: true }); throw new Error('Protected configuration unavailable'); }
  finally { clearTimeout(timeout); outputBytes?.fill(0); chunks.forEach(chunk => chunk.fill(0)); }
}

async function prepareOwnerDirectory(directory) {
  startupStage = 'directory-status';
  let status;
  try { status = await lstat(directory); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Protected directory unavailable');
    startupStage = 'directory-create';
    await mkdir(directory, { recursive: true, mode: 0o700 });
    startupStage = 'directory-status';
    status = await lstat(directory);
  }
  if (!status.isDirectory() || status.isSymbolicLink()) throw new Error('Protected directory unavailable');
  // A restart verifies an already exact owner-only DACL without rewriting it.
  // Otherwise replace and verify the DACL, removing all pre-existing explicit grants.
  startupStage = 'directory-acl-check';
  const script = `$ErrorActionPreference='Stop';$captureStage=1;function Test-OwnerOnlyDirectoryAcl($folder,$expectedSid){$existing=Get-Acl -LiteralPath $folder -ErrorAction Stop;$rules=@($existing.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]));if(-not $existing.AreAccessRulesProtected -or $existing.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $expectedSid.Value -or $rules.Count -ne 1){return $false};$entry=$rules[0];return ($entry.IdentityReference.Value -eq $expectedSid.Value -and $entry.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and $entry.FileSystemRights -eq [Security.AccessControl.FileSystemRights]::FullControl -and $entry.InheritanceFlags -eq ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit) -and $entry.PropagationFlags -eq [Security.AccessControl.PropagationFlags]::None)};try{$folder=${escapePs(directory)};$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;if(Test-OwnerOnlyDirectoryAcl $folder $sid){exit 0};$captureStage=2;$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false);$rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($rule);Set-Acl -LiteralPath $folder -AclObject $acl -ErrorAction Stop;$captureStage=3;if(-not (Test-OwnerOnlyDirectoryAcl $folder $sid)){throw 'Protected directory unavailable'};exit 0}catch{exit $captureStage}`;
  const child = spawn('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore', windowsHide: true });
  const code = await new Promise((resolve, reject) => { child.once('error', () => { startupStage = 'directory-acl-process-unavailable'; reject(new Error('Protected directory unavailable')); }); child.once('close', resolve); });
  if (code !== 0) {
    startupStage = code === 1 ? 'directory-acl-check' : code === 2 ? 'directory-acl-update' : code === 3 ? 'directory-acl-verification' : 'directory-acl-process';
    throw new Error('Protected directory unavailable');
  }
}

async function main() {
  if (process.platform !== 'win32' || Number(process.versions.node.split('.')[0]) !== 24 || !process.argv[2] || !validServiceId(process.argv[3])) throw new Error('Windows, Node 24, audit root, and expected Render service ID required');
  const directory = path.join(path.resolve(process.argv[2]), 'provider-preservation');
  await prepareOwnerDirectory(directory);
  const id = new Date().toISOString().slice(0, 10).replaceAll('-', '') + '-' + randomBytes(8).toString('hex');
  const output = path.join(directory, 'render-configuration-' + id + '.dpapi');
  const reportPath = path.join(directory, 'render-configuration-' + id + '.report.json');
  startupStage = 'loopback-listen';
  const session = await startProviderCapture({ expectedServiceId: process.argv[3], persist: async ({ plaintext, metadata }) => {
    const result = await protectWithWindowsDpapi(plaintext, output);
    let reportOwned = false;
    try {
      const reportFile = await open(reportPath, 'wx', 0o600); reportOwned = true;
      try { await reportFile.writeFile(JSON.stringify({ ...metadata, encrypted: true, dpapiCurrentUserRoundTripVerified: true, ...result }, null, 2) + '\n'); await reportFile.sync(); }
      finally { await reportFile.close(); }
    } catch { await rm(output, { force: true }); if (reportOwned) await rm(reportPath, { force: true }); throw new Error('Protected report unavailable'); }
    return result;
  }, onComplete: report => console.log(JSON.stringify({ saved: true, ...report })), onRejected: diagnostic => console.log(JSON.stringify(diagnostic)) });
  console.log(JSON.stringify({ ready: true, provider: 'render', identity: process.argv[3], url: session.url, output, reportPath, expiresInMinutes: 20 }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => { console.error(JSON.stringify({ ready: false, stage: startupStage, confidentialDetailsOmitted: true })); process.exitCode = 1; });
