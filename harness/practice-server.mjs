#!/usr/bin/env node
// שרת proxy מינימלי משותף — כל מסכי app/ שצריכים קריאה אמיתית למודל
// (practice.html, input-screen.html, parent-input-screen.html,
// conversation-planner.html, activity-planner.html) קוראים לשרת הזה,
// לא כל אחד בונה משהו משלו. (הורחב 19/09/2026 — היה ספציפי ל-practice.html
// בלבד תחת השם /api/character-turn; השם נשאר לתאימות לאחור, אבל הלוגיקה
// עצמה תמיד הייתה גנרית לחלוטין — לא ידעה שהיא "מדברת עם דמות".)
//
// למה זה קיים: כל קבצי app/ הם צד-לקוח טהור בלי שרת. מפתח API לא יכול
// לשבת בבטחה בקוד JS שרץ בדפדפן — כל אחת יכולה לראות אותו ב-view-source
// ולגנוב אותו. השרת הזה הוא השכבה הדקה היחידה שמחזיקה את המפתח, מקבלת
// בקשה מהדפדפן, קוראת למודל בצד השרת, ומחזירה רק את התשובה. שום דבר
// אחר לא עובר דרכו — לוגיקת התפניות/הצעות/משוב וכו' נשארת בקוד הלקוח
// של כל מסך, בדיוק כמו היום.
//
// הרצה מקומית:
//   ANTHROPIC_API_KEY=... node harness/practice-server.mjs [--port 8790]
//
// פריסה ב-Render: CORS נעול לדומיין CORS_ORIGIN (ברירת מחדל: s-b-e.netlify.app).
// השרת מאזין על 0.0.0.0 כדי לקבל חיבורים מרשת.
//
// חוזה הבקשה, POST /api/complete (וגם /api/character-turn — כינוי זהה
// לתאימות לאחור עם practice-engine.md):
//   { system: "<פרומפט המערכת>",
//     messages: [{role:"user"|"assistant", content:"..."}, ...],
//     tools: [...],           // אופציונלי, function calling
//     toolChoice: {...},      // אופציונלי, כופה קריאה לכלי
//     maxTokens: 800 }        // אופציונלי, ברירת מחדל 220 (טורים קצרים
//                             // בתרגול) — מסכים אחרים ששולחים מסמך שלם
//                             // חייבים לציין maxTokens גבוה יותר במפורש.
// חוזה התשובה: { text: "...", toolCalls: [{name, input}] }

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { getProvider } from './lib/providers.mjs';
import { runPipeline } from './lib/pipeline.mjs';
import { toScenario } from './lib/to-scenario.mjs';
import { handleAccess, supabaseStore, authorizeModel } from './lib/access.mjs';
import { studioRequest } from './lib/studio.mjs';
import { customerPass, reviewEnabled } from './lib/customer-pass.mjs';
import { handleStudies, supabaseStudyFiles } from './lib/studies.mjs';
import { createModelLimits } from './lib/model-limits.mjs';
import { handleBackupStatus } from './lib/backup-monitor.mjs';
import { handleScenarios, supabaseScenarios } from './lib/scenarios.mjs';
import { handleCommunication } from './lib/communication-continuity.mjs';
import { handleResearch } from './lib/research.mjs';
import { supabaseResearchStore } from './lib/research-store.mjs';
import { resolveResearchGeneratedSample } from './lib/research-usage.mjs';

// שמירת תרחיש ב-Supabase. נקראת רק כשיש SUPABASE_SERVICE_KEY בסביבה.
// scenario הוא הפלט של toScenario(); meta הוא payload.meta מהלקוח.
async function saveScenario(scenario, meta) {
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supaUrl || !supaKey) return;

  const roles = [scenario.trainee?.role, scenario.actor?.role].filter(Boolean);
  const skills = scenario.facilitator?.skills || [];

  const row = {
    id:             scenario.id,
    institution_id: meta.institutionId || null,
    name:           scenario.name,
    subtitle:       scenario.subtitle || '',
    roles,
    event_desc:     meta.eventDesc || '',
    broad_topic:    meta.broadTopic || '',
    domain:         meta.domain || '',
    content_type:   scenario.conflictType || '',
    approach:       scenario.approach || '',
    age_group:      scenario.age || '',
    product_type:   meta.productType || 'תרחיש',
    skills:         Array.isArray(skills) ? skills : [],
    language:       scenario.language || 'עברית',
    duration_min:   parseInt(scenario.duration) || 5,
    creator:        scenario.creator || meta.creator || '',
    scenario_json:  scenario,
  };
  const r = await fetch(`${supaUrl}/rest/v1/scenarios`, {
    method: 'POST',
    headers: {
      apikey:         supaKey,
      Authorization:  `Bearer ${supaKey}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) {
    throw new Error('scenario storage unavailable');
  }
}

const args = process.argv.slice(2);
const portArgIdx = args.indexOf('--port');
const PORT = Number(portArgIdx >= 0 ? args[portArgIdx + 1] : (process.env.PORT || 8790));

// CORS: הדומיין be-good.co.il (עם www ובלי) וכתובת Netlify. CORS_ORIGIN יכול להכיל כמה כתובות מופרדות בפסיק;
// הראשונה היא הכתובת הראשית (לקישורים במיילים). התשובה מחזירה את המקור של הבקשה אם הוא ברשימה.
const CORS_LIST = [...new Set([...(process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
  'https://be-good.co.il', 'https://www.be-good.co.il', 'https://s-b-e.netlify.app'])];
const CORS_ORIGIN = CORS_LIST[0];
const corsFor = (res) => (res && res._origin && CORS_LIST.includes(res._origin) ? res._origin : CORS_ORIGIN);

function sendJson(res, status, body) {
  res.writeHead(status, {
    'cache-control': 'private, no-store',
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': corsFor(res),
    'vary': 'origin',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
}

// ה-proxy של Render סוגר חיבור שלא עוברים בו נתונים ~30 שניות, וקריאה ארוכה
// למודל שותקת דקות. שולחים כותרות 200 מיד ורווח כל 25 שניות (JSON.parse
// מתעלם מרווחים מובילים); שגיאה מאוחרת חוזרת כ-{error} בגוף עם 200.
function startKeepAlive(res) {
  res.writeHead(200, {
    'cache-control': 'private, no-store',
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': corsFor(res),
    'vary': 'origin',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  const timer = setInterval(() => {
    try { if (!res.writableEnded) res.write(' '); } catch {}
  }, 25000);
  return (body) => { clearInterval(timer); if (!res.writableEnded) res.end(JSON.stringify(body)); };
}

function readBody(req, maxChars = 2_000_000) {
  return new Promise((resolve, reject) => {
    // setEncoding: אותו תיקון כמו ב-providers.mjs — בלעדיו אות עברית שנחתכת בין
    // מנות של גוף הבקשה (תכנון ארוך) מגיעה למודל כ-"??".
    req.setEncoding('utf8');
    let raw = ''; let exceeded = false;
    req.on('data', chunk => {
      if (exceeded) return;
      raw += chunk;
      if (raw.length > maxChars) {
        exceeded = true; raw = '';
        reject(Object.assign(new Error('request body too large'), { status: 413 }));
        // Preserve the existing small-request connection behavior. The file
        // route drains an oversized body so it can return a useful JSON error.
        if (maxChars === 2_000_000) req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

// Dependencies are injected only by importing this factory for isolated tests.
// HTTP input and environment flags cannot replace authentication or providers.
export function createPracticeServer({ authStore, providerFactory = getProvider, saveScenarioImpl = saveScenario,
  limits = createModelLimits() } = {}) {
// עבודות צינור שרצות ברקע (בזיכרון; נמחקות אחרי 3 שעות)
const PIPE_JOBS = new Map();
// גם במאגר (05/10/2026): אם השרת מופעל מחדש באמצע בנייה (Deploy, עומס), מצב העבודה לא הולך לאיבוד —
// עבודה שהסתיימה נשמרת, ועבודה שנקטעה מסומנת "lost" כדי שהדפדפן יתחיל אותה מחדש לבד.
const BOOT_ID = randomUUID();
const jobStore = () => authStore || ((process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) ? supabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY) : null);
const jobSave = (id, rec) => { const st = jobStore(); return st ? st.set('pj:' + id, rec).catch(() => console.error('pipeline: state storage failed')) : Promise.resolve(); };
(async () => { // ניקוי עבודות ישנות (יותר מיממה)
  const st = jobStore(); if (!st) return;
  try { for (const r of await st.list('pj:')) if (r.value && Date.now() - (r.value.t0 || 0) > 864e5) await st.del(r.key); } catch {}
})();

const server = createServer(async (req, res) => {
  res._origin = req.headers.origin || '';
  const researchPath = (req.url || '').split('?')[0] === '/api/research';
  if (researchPath) res.setHeader('cache-control', 'private, no-store');
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  if (req.method === 'GET' && req.url === '/health') {
    const hasKey = !!process.env[getProviderEnvKeyName()];
    const hasWorkspace = !!(process.env.ANTHROPIC_WORKSPACE_ID || '').trim();
    const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
    return sendJson(res, 200, { ok: true, hasKey, hasWorkspace, hasSupabase });
  }

  if (researchPath) {
    if (req.method !== 'POST') { res.setHeader('allow', 'POST, OPTIONS'); return sendJson(res, 405, {ok:false,status:405,error:'invalid',code:'invalid'}); }
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return sendJson(res, 503, {ok:false,status:503,error:'not_configured',code:'not_configured'});
    let body;
    try { body = JSON.parse(await readBody(req, 16 * 1024 * 1024)); }
    catch (error) { const status = error.status === 413 ? 413 : 400; return sendJson(res,status,{ok:false,status,error:'invalid',code:'invalid'}); }
    try {
      const access = jobStore();
      const [status,out] = await handleResearch(access,supabaseResearchStore(url,key),body,{
        siteOrigin:CORS_ORIGIN, resolveGeneratedSample:request=>resolveResearchGeneratedSample(access,request)
      });
      return sendJson(res,status,{...out,ok:status>=200&&status<300,status});
    } catch { return sendJson(res,503,{ok:false,status:503,error:'storage_unavailable',code:'storage_unavailable'}); }
  }

  // לימודי חוסן חברתי: every read rechecks live access. 75 MiB accommodates
  // a 50 MiB base64 attachment plus three previews, only on this endpoint.
  if (req.method === 'POST' && req.url === '/api/studies') {
    res.setHeader('cache-control', 'private, no-store');
    const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return sendJson(res, 503, { code: 'studies_storage', error: 'החומרים אינם זמינים כרגע. אפשר לנסות שוב בעוד מעט.' });
    let body;
    try { body = JSON.parse(await readBody(req, 75 * 1024 * 1024)); }
    catch (error) { return sendJson(res, error.status === 413 ? 413 : 400, { code: 'studies_invalid',
      error: error.status === 413 ? 'הבקשה גדולה מדי. אפשר לצרף קובץ עד 50 MiB ושלוש תמונות תצוגה עד 1 MiB כל אחת.' : 'הבקשה אינה תקינה. אפשר לרענן ולנסות שוב.' }); }
    try {
      const [status, out] = await handleStudies(supabaseStore(url, key, { timeoutMs: 120000 }), body, { files: supabaseStudyFiles(url, key) });
      if (status === 200 && Buffer.isBuffer(out.bytes)) {
        const fallback = out.name.replace(/[^\x20-\x7e]|["\\]/g, '_');
        const encoded = encodeURIComponent(out.name).replace(/['()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase());
        res.writeHead(200, {
          'content-type': out.mime, 'content-length': out.bytes.length,
          'content-disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
          'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
          'access-control-allow-origin': corsFor(res), 'vary': 'origin',
          'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type',
        });
        return res.end(out.bytes);
      }
      return sendJson(res, status, out);
    } catch {
      console.error('studies: request failed');
      return sendJson(res, 503, { code: 'studies_storage', error: 'החומרים אינם זמינים כרגע. אפשר לנסות שוב בעוד מעט.' });
    }
  }

  // Sensitive conversations use their own authenticated boundary. They never
  // enter the generic pipeline jobs or its public status endpoint.
  if (req.method === 'POST' && req.url === '/api/communication-continuity') {
    res.setHeader('cache-control', 'private, no-store');
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
    const access = jobStore();
    if (!access) return sendJson(res, 503, { ok: false, status: 503, code: 'storage', error: 'שירות התקשורת אינו זמין כרגע. אפשר להשאיר את הטקסט על המסך ולנסות שוב.' });
    let body;
    try { body = JSON.parse(await readBody(req, 16 * 1024 * 1024)); }
    catch (error) { const status = error.status === 413 ? 413 : 400; return sendJson(res, status, { ok: false, status, code: 'invalid', error: status === 413 ? 'הקובץ גדול מדי. אפשר לצרף עמוד רלוונטי או טקסט קצר יותר.' : 'הבקשה אינה תקינה. אפשר לרענן ולנסות שוב.' }); }
    let finish, lease;
    try {
      if (['singleGenerate','singleExtract','generate','extract'].includes(body?.action)) {
        const page = body.action.startsWith('single') ? 'message-writer.html' : 'communication-continuity.html';
        const gate = await authorizeModel(access,{token:body.token,page});
        if (!gate.ok) return sendJson(res,403,{ok:false,status:403,code:'ACCESS_DENIED',error:'כדי להמשיך, היכנסו שוב עם הקוד שלכם.'});
        lease = limits.acquire(gate);
        if (!lease.ok) {
          if (lease.retryAfter) res.setHeader('retry-after',String(lease.retryAfter));
          return sendJson(res,lease.status,{ok:false,status:lease.status,code:lease.code,error:'שירות התקשורת אינו זמין כרגע. אפשר לנסות שוב בעוד מעט.'});
        }
      }
      const [status, out] = await handleCommunication(access, body, {
        providerFactory: () => providerFactory(process.env.PROVIDER || 'anthropic'),
        onReady: () => { finish = startKeepAlive(res); },
        // Only server observations reach the separately consent-gated SQL RPC.
        onUsage: url && key ? event => supabaseResearchStore(url,key,{timeoutMs:2000}).rpc(body.token,'recordUsage',event) : undefined
      });
      // Long requests must commit transport 200 for Render's keepalive. The
      // flat result envelope preserves the actual operation status for clients.
      const result = { ...out, ok: status >= 200 && status < 300, status };
      if (finish) return finish(result);
      return sendJson(res, status, result);
    } catch {
      console.error('communication: request failed');
      const out = { code: 'unavailable', error: 'שירות התקשורת אינו זמין כרגע. אפשר להשאיר את הטקסט על המסך ולנסות שוב.' };
      const result = { ...out, ok: false, status: 503 };
      if (finish) return finish(result);
      return sendJson(res, 503, result);
    } finally {
      lease?.release?.();
    }
  }

  // POST /api/access — סיסמאות הניהול וקוד "משוב לעבודות" (lib/access.mjs).
  if (req.method === 'POST' && req.url === '/api/access') {
    if (!jobStore()) return sendJson(res, 503, { error: 'storage unavailable' });
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return sendJson(res, 400, { error: 'invalid JSON' }); }
    try {
      const [status, out] = await handleAccess(jobStore(), body);
      return sendJson(res, status, out);
    } catch (e) {
      console.error('access: storage unavailable');
      return sendJson(res, 503, { error: 'storage unavailable' });
    }
  }

  // Studio is a separate authenticated boundary; client prompts never bypass
  // its live permissions, source filtering or server-side mapping aggregation.
  if (req.method === 'POST' && req.url === '/api/studio') {
    if (!jobStore()) return sendJson(res, 503, { error: 'storage unavailable' });
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return sendJson(res, 400, { error: 'invalid JSON' }); }
    let finish;
    try {
      // async:true ← jobId מיד, והדפדפן שואל {action:'status'}; בלעדיו — הבקשה הארוכה הישנה עם רווחי keep-alive
      const [status, out] = await studioRequest(jobStore(), body,
        { limits, onReady: () => { finish = startKeepAlive(res); } });
      if (finish) return finish(out);
      return sendJson(res, status, out);
    } catch (e) {
      console.error('studio: request failed');
      if (finish) return finish({ error: 'הסטודיו אינו זמין כעת.' });
      return sendJson(res, 503, { error: 'הסטודיו אינו זמין כעת.' });
    }
  }

  if (req.method === 'POST' && req.url === '/api/backup-status') {
    if (!jobStore()) return sendJson(res,503,{code:'backup_storage',error:'ניטור הגיבוי אינו זמין כעת.'});
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res,400,{error:'בקשה אינה תקינה.'}); }
    try { const [status,out] = await handleBackupStatus(jobStore(),body,{reportPath:process.env.BE_GOOD_BACKUP_STATUS_FILE});
      return sendJson(res,status,out); }
    catch { return sendJson(res,503,{code:'backup_storage',error:'ניטור הגיבוי אינו זמין כעת.'}); }
  }

  if (req.method === 'POST' && req.url === '/api/scenarios') {
    const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return sendJson(res,503,{code:'scenarios_storage',error:'מאגר התרחישים אינו זמין כעת.'});
    let body;
    try { body=JSON.parse(await readBody(req)); } catch { return sendJson(res,400,{error:'בקשה אינה תקינה.'}); }
    try { const [status,out]=await handleScenarios(jobStore(),body,{repository:supabaseScenarios(url,key)});
      return sendJson(res,status,out); }
    catch { return sendJson(res,503,{code:'scenarios_storage',error:'מאגר התרחישים אינו זמין כעת.'}); }
  }

  const validPaths = ['/api/complete', '/api/character-turn', '/api/pipeline', '/api/pipeline-status'];
  if (req.method !== 'POST' || !validPaths.includes(req.url)) {
    return sendJson(res, 404, { error: 'נתיב לא נמצא. יש POST /api/complete ו-POST /api/pipeline' });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: 'גוף הבקשה אינו JSON תקין' });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return sendJson(res,400,{error:'בקשה אינה תקינה.'});
  const store = jobStore();
  if (!store) return sendJson(res,503,{code:'auth_storage',error:'אין כרגע חיבור לשרת הבדיקה. אפשר לנסות שוב בעוד רגע.'});
  const auth = payload._auth;

  // POST /api/pipeline (21/09/2026) — הצינור התלת-שלבי המלא ממסך הקלט של
  // אנשי החינוך: { input: {given, locked, approach, skills, ...}, meta: {...} }
  // → { scenario } בפורמט scenario.json (דרך to-scenario.mjs), מוכן
  // לרינדור ב-lib/doc-render.mjs. אורך: 10-20 דקות (ארבע קריאות רצופות
  // ב-effort גבוה) — הלקוח חייב timeout ארוך בהתאם. requestTimeout של
  // השרת כבר 0 (ראו למטה).
  //
  // POST /api/pipeline-status (04/10/2026) — מצב עבודה שרצה ברקע: { jobId } → { status, stages, elapsed, scenario?, error? }
  if (req.url === '/api/pipeline-status') {
    const id = String(payload.jobId || '');
    let job = PIPE_JOBS.get(id);
    if (!job && /^[0-9a-f-]{36}$/.test(id)) {
      try {
        const rec = await store.get('pj:' + id);
        if (rec) job = rec;
      } catch { return sendJson(res,503,{code:'auth_storage',error:'בדיקת התוצאה אינה זמינה כעת.'}); }
    }
    let current;
    try { current = await authorizeModel(store,auth,job?.route || '/api/complete'); }
    catch { return sendJson(res,503,{code:'auth_storage',error:'בדיקת התוצאה אינה זמינה כעת.'}); }
    if (!current.ok) return sendJson(res,401,{code:'auth',error:'כדי להמשיך, היכנסו שוב עם הקוד שלכם.'});
    // Older records have no verified ownership; they cannot expose results.
    if (!job || !job.owner || job.owner !== current.owner || job.page !== current.page || Date.now()-job.t0>3*3600e3)
      return sendJson(res,200,{status:'unknown'});
    if (job.status === 'running' && job.boot !== BOOT_ID) return sendJson(res,200,{status:'lost'});
    return sendJson(res, 200, { status: job.status, stages: job.stages, elapsed: Math.round((Date.now() - job.t0) / 1000),
      ...(job.status === 'done' ? { scenario: job.scenario, text: job.text, ...(job.review ? { review: job.review } : {}) } : {}), ...(job.status === 'error' ? { error: job.error } : {}) });
  }

  let gate;
  try { gate = await authorizeModel(store,auth,req.url); }
  catch { return sendJson(res,503,{code:'auth_storage',error:'אין כרגע חיבור לשרת הבדיקה. אפשר לנסות שוב בעוד רגע.'}); }
  if (!gate.ok) return sendJson(res,401,{code:'auth',error:'כדי להמשיך, היכנסו שוב עם הקוד שלכם.'});
  delete payload._auth;
  const lease = limits.acquire(gate);
  if (!lease.ok) {
    if (lease.retryAfter) res.setHeader('retry-after',String(lease.retryAfter));
    return sendJson(res,lease.status,{code:lease.code,error:lease.status===429?'נשלחו כמה בקשות. אפשר לחכות מעט ולנסות שוב.':'הגדרת הגבלת הבקשות אינה תקינה.'});
  }
  let background = false;
  try {

  if (req.url === '/api/pipeline') {
    if (!payload.input || !payload.input.given) {
      return sendJson(res, 400, { error: 'חסר input.given (who / whatHappened / goals)' });
    }
    let provider;
    try { provider = providerFactory(process.env.PROVIDER || 'anthropic'); }
    catch (e) { return sendJson(res,503,{error:'שירות היצירה אינו זמין כעת.'}); }
    // מצב רקע (04/10/2026): מחזירים מיד מזהה עבודה, והדפדפן שואל על ההתקדמות כל כמה שניות.
    // בקשה אחת של 10–20 דקות נקטעה (טלפון שנכנס להמתנה, ניתוק רגעי, פרוקסי) — והמשתמשת ראתה "נתקע".
    if (payload.async) {
      const jobId = randomUUID();
      const meta = { ...(payload.meta || {}), institutionId: gate.institutionId };
      if (!meta.id) { const d = new Date(), p = (n) => String(n).padStart(2, '0'); meta.id = `TR-${p(d.getMonth() + 1)}${p(d.getDate())}-${randomUUID().slice(0, 8)}`; }
      const job = { owner:gate.owner, route:gate.route, page:gate.page, boot:BOOT_ID, status:'running', stages:{}, t0:Date.now() };
      PIPE_JOBS.set(jobId, job);
      jobSave(jobId,job);
      setTimeout(() => PIPE_JOBS.delete(jobId), 3 * 3600 * 1000).unref?.();
      sendJson(res, 200, { jobId });
      background = true;
      runPipeline(payload.input, provider, { sourceLibrary: payload.sourceLibrary || [], onStage: (s, st) => { job.stages[s] = st; } })
        .then((out) => {
          const scenario = toScenario(out, { input: payload.input, meta });
          job.scenario = scenario; job.status = 'done';
          jobSave(jobId,job);
          console.log(`pipeline(async): הצליח אחרי ${Math.round((Date.now() - job.t0) / 1000)} שניות`);
          saveScenarioImpl(scenario, meta).catch(() => console.error('scenario storage failed'));
        })
        .catch(() => { job.status='error'; job.error='שירות היצירה לא השלים את הבקשה.'; console.error('model background request failed');
          jobSave(jobId,job); }).finally(() => lease.release());
      return;
    }
    const finish = startKeepAlive(res);
    const t0 = Date.now();
    // בלי מזהה ייחודי, to-scenario נותן לכל תרחיש של אותו יום את TR-MMDD-01,
    // וכל שמירה במאגר הייתה מתנגשת בקודמת.
    const meta = { ...(payload.meta || {}), institutionId: gate.institutionId };
    if (!meta.id) {
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      meta.id = `TR-${p(d.getMonth() + 1)}${p(d.getDate())}-${randomUUID().slice(0, 8)}`;
    }
    try {
      const out = await runPipeline(payload.input, provider, { sourceLibrary: payload.sourceLibrary || [] });
      const scenario = toScenario(out, { input: payload.input, meta });
      console.log(`pipeline: הצליח אחרי ${Math.round((Date.now() - t0) / 1000)} שניות`);
      saveScenarioImpl(scenario, meta)
        .then(() => console.log(`supabase: נשמר ${scenario.id}`))
        .catch(() => console.error('scenario storage failed'));
      finish({ scenario, _ms: out._ms });
    } catch (e) {
      console.error('model request failed');
      finish({error:'שירות היצירה לא השלים את הבקשה.'});
    }
    return;
  }

  const { system, messages, tools, toolChoice, maxTokens } = payload;
  if (!system && !messages) {
    return sendJson(res, 400, { error: 'חסר system או messages בבקשה' });
  }
  if (messages && !Array.isArray(messages)) {
    return sendJson(res, 400, { error: 'messages אינו מערך' });
  }

  let provider;
  try {
    provider = providerFactory(process.env.PROVIDER || 'anthropic');
  } catch (e) {
    return sendJson(res,503,{error:'שירות היצירה אינו זמין כעת.'});
  }

  // מצב רקע גם כאן (05/10/2026): תוצרי ההורים והנוער נכתבים בקריאה אחת ארוכה (עד ~9 דקות),
  // והחיבור נקטע באמצע ("Unexpected end of JSON input"). מחזירים מזהה עבודה, והדפדפן שואל ב-/api/pipeline-status.
  if (payload.async) {
    const jobId = randomUUID();
    const job = { owner:gate.owner, route:gate.route, page:gate.page, boot:BOOT_ID, status:'running', stages:{}, t0:Date.now() };
    PIPE_JOBS.set(jobId, job);
    jobSave(jobId,job);
    setTimeout(() => PIPE_JOBS.delete(jobId), 3 * 3600 * 1000).unref?.();
    sendJson(res, 200, { jobId });
      background = true;
    provider.complete({ system, messages: messages || [{ role: 'user', content: '' }], tools, toolChoice, variation: 'medium', maxTokens: maxTokens || 220 })
      // הסוכנת-הלקוחה (lib/customer-pass.mjs): רק בקריאות שמפיקות תוצר
      .then((result) => reviewEnabled(payload) ? customerPass(provider, { system, messages, maxTokens, text: result.text }) : { text: result.text, review: null })
      .then((result) => {
        job.text = result.text; job.review = result.review; job.status = 'done';
        jobSave(jobId,job);
        console.log(`complete(async): הצליח אחרי ${Math.round((Date.now() - job.t0) / 1000)} שניות (maxTokens ${maxTokens || 220})`);
      })
      .catch(() => { job.status='error'; job.error='שירות היצירה לא השלים את הבקשה.'; console.error('model background request failed');
          jobSave(jobId,job); }).finally(() => lease.release());
    return;
  }

  const finish = startKeepAlive(res);
  const t0 = Date.now();
  try {
    const result = await provider.complete({
      system,
      messages: messages || [{ role: 'user', content: '' }],
      tools,
      toolChoice,
      variation: 'medium',
      maxTokens: maxTokens || 220,
    });
    const pass = reviewEnabled(payload) ? await customerPass(provider, { system, messages, maxTokens, text: result.text }) : null;
    console.log(`complete: הצליח אחרי ${Math.round((Date.now() - t0) / 1000)} שניות (maxTokens ${maxTokens || 220})`);
    finish({ text: pass ? pass.text : result.text, toolCalls: result.toolCalls || [], ...(pass && pass.review ? { review: pass.review } : {}) });
  } catch (e) {
    console.error('model request failed');
    finish({error:'שירות היצירה לא השלים את הבקשה.'});
  }
  } finally { if (!background) lease.release(); }
});

// Node 18+ מגדיר ברירת מחדל של http.Server.requestTimeout ל-300000ms (5
// דקות) — עצמאי לגמרי מה-timeout הפנימי של post() ב-providers.mjs, וחוסם
// את כל הבקשה גם אחרי שתוקן שם. נתפס חי (19/09/2026): שלב 3 של הצינור
// (כתיבת מסמכים ארוכה) חצה את זה ונחתך. מוגדר ל-0 (בלי הגבלה) — הלקוח
// קובע timeout לפי הצורך שלו.
server.requestTimeout = 0;
server.headersTimeout = 0;

return server;
}

function getProviderEnvKeyName() {
  return (process.env.PROVIDER || 'anthropic') === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
const server = createPracticeServer();
server.listen(PORT, '0.0.0.0', () => {
  const keyName = getProviderEnvKeyName();
  console.log(`שרת מנוע התרגול פועל · http://0.0.0.0:${PORT}`);
  console.log(`CORS מוגדר ל: ${CORS_LIST.join(', ')}`);
  console.log(process.env[keyName]
    ? `מפתח ${keyName} נמצא.`
    : `אזהרה: אין ${keyName} מוגדר — כל בקשה תיכשל עם שגיאה ברורה.`);
});
}
