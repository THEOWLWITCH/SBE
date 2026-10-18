#!/usr/bin/env node
// One-use loopback form. Passphrases stay in this local process and are never logged.
import http from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { sealRecoveryKit, openRecoveryKit, validateRecoveryPassphrase } from '../harness/lib/recovery-key-kit.mjs';

const exec = promisify(execFile);
const escapePs = value => "'" + value.replaceAll("'", "''") + "'";
const MATERIAL_LIMIT = 12 * 1024 * 1024;
const MATERIAL_WIRE_LIMIT = 4 * Math.ceil(MATERIAL_LIMIT / 3);

// This boundary must never propagate SyntaxError text containing confidential JSON.
function decodePrivateJson(encoded) {
  let decoded;
  try {
    if (!Buffer.isBuffer(encoded) || encoded.length === 0 || encoded.length > MATERIAL_WIRE_LIMIT) throw new Error();
    const base64 = encoded.toString('utf8');
    if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error();
    decoded = Buffer.from(base64, 'base64');
    if (decoded.length > MATERIAL_LIMIT || decoded.toString('base64') !== base64) throw new Error();
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded));
  } catch { throw new Error('Local protected material unavailable'); }
  finally { decoded?.fill(0); if (Buffer.isBuffer(encoded)) encoded.fill(0); }
}

export function decodeWindowsRecoveryMaterial(encoded) {
  try {
    const material = decodePrivateJson(encoded);
    if (!material || material.format !== 'be-good-recovery-material/v1' || !Array.isArray(material.archiveKeys) || !Array.isArray(material.providerConfigurations)) throw new Error();
    const providerConfigurations = material.providerConfigurations.map(provider => {
      if (!provider || !/^[a-z0-9-]{1,120}$/.test(provider.name) || typeof provider.documentBase64 !== 'string') throw new Error();
      return { name: provider.name, document: decodePrivateJson(Buffer.from(provider.documentBase64, 'utf8')) };
    });
    return { format: material.format, archiveKeys: material.archiveKeys, providerConfigurations };
  } catch { throw new Error('Local protected material unavailable'); }
}

export async function loadWindowsRecoveryMaterial(auditRoot) {
  if (process.platform !== 'win32') throw new Error('DPAPI collection requires the original Windows profile');
  const script = `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';$WarningPreference='Stop';$jsonBytes=$null;try{Add-Type -AssemblyName System.Security;$root=${escapePs(path.resolve(auditRoot))};$keys=@();foreach($folder in @('source-preservation-keys','live-preservation-keys')){ $dir=Join-Path $root $folder;if(Test-Path -LiteralPath $dir){foreach($file in Get-ChildItem -LiteralPath $dir -Filter '*.key.dpapi'){if($file.Name -notmatch '^([0-9]{8}T[0-9]{6}Z-[a-f0-9]{8})\\.key\\.dpapi$'){continue};$id=$Matches[1];$bytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($file.FullName),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);try{if($bytes.Length -ne 32){throw 'Invalid local key'};$keys+=@{id=$id;keyBase64=[Convert]::ToBase64String($bytes)}}finally{[Array]::Clear($bytes,0,$bytes.Length)}}}};$providers=@();$providerDir=Join-Path $root 'provider-preservation';if(Test-Path -LiteralPath $providerDir){foreach($file in Get-ChildItem -LiteralPath $providerDir -Filter '*.dpapi'){if($file.BaseName -notmatch '^[a-z0-9-]{1,120}$'){continue};$bytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($file.FullName),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);try{$providers+=@{name=$file.BaseName;documentBase64=[Convert]::ToBase64String($bytes)}}finally{[Array]::Clear($bytes,0,$bytes.Length)}}};$json=@{format='be-good-recovery-material/v1';archiveKeys=@($keys);providerConfigurations=@($providers)}|ConvertTo-Json -Depth 40 -Compress;$jsonBytes=[Text.Encoding]::UTF8.GetBytes($json);if($jsonBytes.Length -gt ${MATERIAL_LIMIT}){throw 'Material too large'};[Console]::Out.Write([Convert]::ToBase64String($jsonBytes))}catch{exit 1}finally{if($null -ne $jsonBytes){[Array]::Clear($jsonBytes,0,$jsonBytes.Length)}}`;
  const child = spawn('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const chunks = []; let size = 0;
  child.stdout.on('data', bytes => { size += bytes.length; if (size > MATERIAL_WIRE_LIMIT) { bytes.fill(0); child.kill(); } else chunks.push(bytes); });
  child.stderr.on('data', bytes => bytes.fill(0));
  const timeout = setTimeout(() => child.kill(), 60_000); timeout.unref();
  let bytes;
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', () => reject(new Error('Local protected material unavailable'))); child.once('close', resolve); });
    if (code !== 0 || size > MATERIAL_WIRE_LIMIT) throw new Error('Local protected material unavailable');
    bytes = Buffer.concat(chunks);
    return decodeWindowsRecoveryMaterial(bytes);
  } catch { throw new Error('Local protected material unavailable'); }
  finally { clearTimeout(timeout); bytes?.fill(0); chunks.forEach(chunk => chunk.fill(0)); }
}

const page = (body) => `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>מפתח שחזור לגיבוי BE GOOD</title><style>body{font:18px Arial,sans-serif;max-width:620px;margin:40px auto;padding:20px;line-height:1.6;color:#123}label,input,button{display:block;width:100%;box-sizing:border-box}input,button{font:inherit;padding:12px;margin:8px 0 22px}button{background:#16674c;color:white;border:0;border-radius:8px}small{display:block}</style>${body}</html>`;
const form = page(`<h1>סיסמת שחזור לגיבוי BE GOOD</h1><p>זהו טופס מקומי במחשב שלך. בחרי סיסמת שחזור חדשה של 20 תווים לפחות. הסיסמה אינה נשלחת לצ׳אט או לשירות ענן.</p><p>שמרי אותה במקום פרטי ונפרד שתוכלי להגיע אליו גם אם המחשב יתקלקל. בלעדיה לא ניתן יהיה לפתוח את ערכת השחזור הניידת.</p><form method="post"><label for="passphrase">סיסמת שחזור חדשה</label><input id="passphrase" name="passphrase" dir="rtl" type="password" autocomplete="new-password" minlength="20" maxlength="256" required><label for="confirmation">אותה סיסמה שוב</label><input id="confirmation" name="confirmation" dir="rtl" type="password" autocomplete="new-password" minlength="20" maxlength="256" required><label><input name="stored" type="checkbox" required style="display:inline;width:auto">שמרתי את הסיסמה במקום פרטי ונפרד</label><button type="submit">יצירת ערכת שחזור מוצפנת</button></form><small>הפעולה שומרת מפתחות שחזור מוצפנים בלבד. היא אינה משנה את סיסמאות GitHub, Supabase או Render.</small>`);

export async function startRecoveryCapture({ output, reportPath, loadMaterial, lifetimeMs = 60 * 60 * 1000 }) {
  const token = '/' + randomBytes(32).toString('base64url');
  let complete = false, busy = false, origin;
  const server = http.createServer(async (req, res) => {
    // Native form POSTs use Origin:null under no-referrer. Keep the exact
    // Origin check below and suppress referrers only for other origins.
    const respond = (status, body) => { res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" }); res.end(body); };
    if (req.url !== token || req.headers.host !== new URL(origin).host) return respond(404, 'Not found');
    if (req.method === 'GET') return respond(200, complete ? page('<h1>ערכת השחזור נשמרה</h1><p>אפשר לחזור לצ׳אט. הסיסמה לא נשמרה בטופס.</p>') : form);
    if (req.method !== 'POST' || req.headers.origin !== origin || !/^application\/x-www-form-urlencoded(?:;|$)/.test(req.headers['content-type'] || '')) return respond(403, 'Forbidden');
    if (complete || busy) return respond(409, 'Already processing');
    busy = true;
    let owned = false;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 8192) { respond(413, 'Request too large'); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks); let fields;
      try { fields = new URLSearchParams(body.toString('utf8')); } finally { body.fill(0); chunks.forEach(chunk => chunk.fill(0)); }
      const passphrase = fields.get('passphrase'), confirmation = fields.get('confirmation');
      let validPassphrase = true;
      try { validateRecoveryPassphrase(passphrase); } catch { validPassphrase = false; }
      if (!validPassphrase || passphrase !== confirmation || fields.get('stored') !== 'on') return respond(400, page('<h1>יש לבדוק את הסיסמה</h1><p>נדרשות שתי סיסמאות זהות של 20 תווים לפחות, ואישור שהסיסמה נשמרה בנפרד. חזרי למסך הקודם כדי לנסות שוב.</p>'));
      const value = await loadMaterial();
      const kit = await sealRecoveryKit(value, passphrase);
      await writeFile(output, JSON.stringify(kit, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); owned = true;
      const stored = JSON.parse(await readFile(output, 'utf8'));
      const recovered = await openRecoveryKit(stored, passphrase);
      if (JSON.stringify(recovered) !== JSON.stringify(value)) throw new Error('Recovery check failed');
      const report = { createdAt: new Date().toISOString(), format: kit.format, keyCount: value.archiveKeys.length, providerConfigurationCount: value.providerConfigurations.length, archiveKeyIds: value.archiveKeys.map(item => item.id), encrypted: true, passwordRecoveryVerified: true, independentCopyVerified: false, liveDatabaseRestorePerformed: false, kitSha256: createHash('sha256').update(await readFile(output)).digest('hex') };
      await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      complete = true; respond(200, page('<h1>ערכת השחזור נשמרה</h1><p>ההצפנה ופתיחת הבדיקה עברו בהצלחה. אפשר לחזור לצ׳אט. שמרי את סיסמת השחזור במקום הפרטי שבחרת.</p>'));
      console.log(JSON.stringify({ recoveryKitCreated: true, keyCount: report.keyCount, providerConfigurationCount: report.providerConfigurationCount }));
      setTimeout(() => server.close(), 2000).unref();
    } catch { if (owned) await rm(output, { force: true }); respond(500, page('<h1>הערכה לא נוצרה</h1><p>לא נרשמה הצלחה. אפשר לחזור לצ׳אט; פרטי הסיסמה אינם נכללים בדוח.</p>')); }
    finally { busy = false; }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  const timer = setTimeout(() => server.close(), lifetimeMs); timer.unref(); server.on('close', () => clearTimeout(timer));
  return { server, url: origin + token };
}

async function main() {
  const auditRoot = path.resolve(process.argv[2] || '');
  if (!process.argv[2]) throw new Error('Audit root required');
  const outputDirectory = path.join(auditRoot, 'portable-recovery');
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    const identity = (await exec('whoami.exe')).stdout.trim();
    await exec('icacls.exe', [outputDirectory, '/inheritance:r', '/grant:r', identity + ':(OI)(CI)F']);
  }
  const id = new Date().toISOString().replace(/[-:.]/g, '') + '-' + randomBytes(4).toString('hex');
  const output = path.join(outputDirectory, id + '.recovery.json'), reportPath = path.join(outputDirectory, id + '.report.json');
  const session = await startRecoveryCapture({ output, reportPath, loadMaterial: () => loadWindowsRecoveryMaterial(auditRoot) });
  console.log(JSON.stringify({ ready: true, url: session.url, output, reportPath, expiresInMinutes: 60 }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => { console.error('Local recovery capture unavailable; confidential details omitted'); process.exitCode = 1; });
