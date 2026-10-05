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
import { getProvider } from './lib/providers.mjs';
import { runPipeline } from './lib/pipeline.mjs';
import { toScenario } from './lib/to-scenario.mjs';
import { handleAccess, supabaseStore } from './lib/access.mjs';

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
    institution_id: meta.institutionId || 'unknown',
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
    const body = await r.text().catch(() => '');
    throw new Error(`Supabase ${r.status}: ${body}`);
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    // setEncoding: אותו תיקון כמו ב-providers.mjs — בלעדיו אות עברית שנחתכת בין
    // מנות של גוף הבקשה (תכנון ארוך) מגיעה למודל כ-"??".
    req.setEncoding('utf8');
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 2_000_000) req.destroy(); });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

// עבודות צינור שרצות ברקע (בזיכרון; נמחקות אחרי 3 שעות)
const PIPE_JOBS = new Map();
// גם במאגר (05/10/2026): אם השרת מופעל מחדש באמצע בנייה (Deploy, עומס), מצב העבודה לא הולך לאיבוד —
// עבודה שהסתיימה נשמרת, ועבודה שנקטעה מסומנת "lost" כדי שהדפדפן יתחיל אותה מחדש לבד.
const BOOT_ID = randomUUID();
const jobStore = () => (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) ? supabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY) : null;
const jobSave = (id, rec) => { const st = jobStore(); return st ? st.set('pj:' + id, rec).catch(e => console.error(`pipeline: שמירת מצב נכשלה — ${e.message}`)) : Promise.resolve(); };
(async () => { // ניקוי עבודות ישנות (יותר מיממה)
  const st = jobStore(); if (!st) return;
  try { for (const r of await st.list('pj:')) if (r.value && Date.now() - (r.value.t0 || 0) > 864e5) await st.del(r.key); } catch {}
})();

const server = createServer(async (req, res) => {
  res._origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  if (req.method === 'GET' && req.url === '/health') {
    const hasKey = !!process.env[getProviderEnvKeyName()];
    const hasWorkspace = !!(process.env.ANTHROPIC_WORKSPACE_ID || '').trim();
    const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
    return sendJson(res, 200, { ok: true, hasKey, hasWorkspace, hasSupabase });
  }

  // POST /api/access — סיסמאות הניהול וקוד "משוב לעבודות" (lib/access.mjs).
  if (req.method === 'POST' && req.url === '/api/access') {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return sendJson(res, 503, { error: 'storage unavailable' });
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return sendJson(res, 400, { error: 'invalid JSON' }); }
    try {
      const [status, out] = await handleAccess(supabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY), body);
      return sendJson(res, status, out);
    } catch (e) {
      console.error(`access: ${e.message}`);
      return sendJson(res, 503, { error: 'storage unavailable' });
    }
  }

  const validPaths = ['/api/complete', '/api/character-turn', '/api/pipeline', '/api/pipeline-status'];
  if (req.method !== 'POST' || !validPaths.includes(req.url)) {
    return sendJson(res, 404, { error: 'נתיב לא נמצא. יש POST /api/complete ו-POST /api/pipeline' });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: 'גוף הבקשה חייב להיות JSON תקין' });
  }

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
    if (!job && /^[0-9a-f-]{36}$/.test(id) && jobStore()) {
      try {
        const rec = await jobStore().get('pj:' + id);
        if (rec && rec.status === 'running' && rec.boot !== BOOT_ID) return sendJson(res, 200, { status: 'lost' });
        if (rec) job = rec;
      } catch {}
    }
    if (!job) return sendJson(res, 200, { status: 'unknown' });
    return sendJson(res, 200, { status: job.status, stages: job.stages, elapsed: Math.round((Date.now() - job.t0) / 1000),
      ...(job.status === 'done' ? { scenario: job.scenario, text: job.text } : {}), ...(job.status === 'error' ? { error: job.error } : {}) });
  }

  if (req.url === '/api/pipeline') {
    if (!payload.input || !payload.input.given) {
      return sendJson(res, 400, { error: 'חסר input.given (who / whatHappened / goals)' });
    }
    let provider;
    try { provider = getProvider(process.env.PROVIDER || 'anthropic'); }
    catch (e) { return sendJson(res, 500, { error: e.message }); }
    // מצב רקע (04/10/2026): מחזירים מיד מזהה עבודה, והדפדפן שואל על ההתקדמות כל כמה שניות.
    // בקשה אחת של 10–20 דקות נקטעה (טלפון שנכנס להמתנה, ניתוק רגעי, פרוקסי) — והמשתמשת ראתה "נתקע".
    if (payload.async) {
      const jobId = randomUUID();
      const meta = { ...(payload.meta || {}) };
      if (!meta.id) { const d = new Date(), p = (n) => String(n).padStart(2, '0'); meta.id = `TR-${p(d.getMonth() + 1)}${p(d.getDate())}-${randomUUID().slice(0, 8)}`; }
      const job = { status: 'running', stages: {}, t0: Date.now() };
      PIPE_JOBS.set(jobId, job);
      jobSave(jobId, { status: 'running', t0: job.t0, boot: BOOT_ID, stages: {} });
      setTimeout(() => PIPE_JOBS.delete(jobId), 3 * 3600 * 1000).unref?.();
      sendJson(res, 200, { jobId });
      runPipeline(payload.input, provider, { sourceLibrary: payload.sourceLibrary || [], onStage: (s, st) => { job.stages[s] = st; } })
        .then((out) => {
          const scenario = toScenario(out, { input: payload.input, meta });
          job.scenario = scenario; job.status = 'done';
          jobSave(jobId, { status: 'done', t0: job.t0, boot: BOOT_ID, stages: job.stages, scenario });
          console.log(`pipeline(async): הצליח אחרי ${Math.round((Date.now() - job.t0) / 1000)} שניות`);
          saveScenario(scenario, meta).catch(e => console.error(`supabase: השמירה נכשלה — ${e.message}`));
        })
        .catch((e) => { job.status = 'error'; job.error = `שגיאת ספק: ${e.message}`; console.error(`pipeline(async): נכשל — ${e.message}`);
          jobSave(jobId, { status: 'error', t0: job.t0, boot: BOOT_ID, error: job.error }); });
      return;
    }
    const finish = startKeepAlive(res);
    const t0 = Date.now();
    // בלי מזהה ייחודי, to-scenario נותן לכל תרחיש של אותו יום את TR-MMDD-01,
    // וכל שמירה במאגר הייתה מתנגשת בקודמת.
    const meta = { ...(payload.meta || {}) };
    if (!meta.id) {
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      meta.id = `TR-${p(d.getMonth() + 1)}${p(d.getDate())}-${randomUUID().slice(0, 8)}`;
    }
    try {
      const out = await runPipeline(payload.input, provider, { sourceLibrary: payload.sourceLibrary || [] });
      const scenario = toScenario(out, { input: payload.input, meta });
      console.log(`pipeline: הצליח אחרי ${Math.round((Date.now() - t0) / 1000)} שניות`);
      saveScenario(scenario, meta)
        .then(() => console.log(`supabase: נשמר ${scenario.id}`))
        .catch(e => console.error(`supabase: השמירה נכשלה — ${e.message}`));
      finish({ scenario, _ms: out._ms });
    } catch (e) {
      console.error(`pipeline: נכשל אחרי ${Math.round((Date.now() - t0) / 1000)} שניות — ${e.message}`);
      finish({ error: `שגיאת ספק: ${e.message}` });
    }
    return;
  }

  const { system, messages, tools, toolChoice, maxTokens } = payload;
  if (!system && !messages) {
    return sendJson(res, 400, { error: 'חסר system או messages בבקשה' });
  }
  if (messages && !Array.isArray(messages)) {
    return sendJson(res, 400, { error: 'messages חייב להיות מערך' });
  }

  let provider;
  try {
    provider = getProvider(process.env.PROVIDER || 'anthropic');
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }

  // מצב רקע גם כאן (05/10/2026): תוצרי ההורים והנוער נכתבים בקריאה אחת ארוכה (עד ~9 דקות),
  // והחיבור נקטע באמצע ("Unexpected end of JSON input"). מחזירים מזהה עבודה, והדפדפן שואל ב-/api/pipeline-status.
  if (payload.async) {
    const jobId = randomUUID();
    const job = { status: 'running', stages: {}, t0: Date.now() };
    PIPE_JOBS.set(jobId, job);
    jobSave(jobId, { status: 'running', t0: job.t0, boot: BOOT_ID, stages: {} });
    setTimeout(() => PIPE_JOBS.delete(jobId), 3 * 3600 * 1000).unref?.();
    sendJson(res, 200, { jobId });
    provider.complete({ system, messages: messages || [{ role: 'user', content: '' }], tools, toolChoice, variation: 'medium', maxTokens: maxTokens || 220 })
      .then((result) => {
        job.text = result.text; job.status = 'done';
        jobSave(jobId, { status: 'done', t0: job.t0, boot: BOOT_ID, stages: {}, text: result.text });
        console.log(`complete(async): הצליח אחרי ${Math.round((Date.now() - job.t0) / 1000)} שניות (maxTokens ${maxTokens || 220})`);
      })
      .catch((e) => { job.status = 'error'; job.error = `שגיאת ספק: ${e.message}`; console.error(`complete(async): נכשל — ${e.message}`);
        jobSave(jobId, { status: 'error', t0: job.t0, boot: BOOT_ID, error: job.error }); });
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
    console.log(`complete: הצליח אחרי ${Math.round((Date.now() - t0) / 1000)} שניות (maxTokens ${maxTokens || 220})`);
    finish({ text: result.text, toolCalls: result.toolCalls || [] });
  } catch (e) {
    console.error(`complete: נכשל אחרי ${Math.round((Date.now() - t0) / 1000)} שניות — ${e.message}`);
    finish({ error: `שגיאת ספק: ${e.message}` });
  }
});

function getProviderEnvKeyName() {
  return (process.env.PROVIDER || 'anthropic') === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
}

// Node 18+ מגדיר ברירת מחדל של http.Server.requestTimeout ל-300000ms (5
// דקות) — עצמאי לגמרי מה-timeout הפנימי של post() ב-providers.mjs, וחוסם
// את כל הבקשה גם אחרי שתוקן שם. נתפס חי (19/09/2026): שלב 3 של הצינור
// (כתיבת מסמכים ארוכה) חצה את זה ונחתך. מוגדר ל-0 (בלי הגבלה) — הלקוח
// קובע timeout לפי הצורך שלו.
server.requestTimeout = 0;
server.headersTimeout = 0;

server.listen(PORT, '0.0.0.0', () => {
  const keyName = getProviderEnvKeyName();
  console.log(`שרת מנוע התרגול פועל · http://0.0.0.0:${PORT}`);
  console.log(`CORS מוגדר ל: ${CORS_LIST.join(', ')}`);
  console.log(process.env[keyName]
    ? `מפתח ${keyName} נמצא.`
    : `אזהרה: אין ${keyName} מוגדר — כל בקשה תיכשל עם שגיאה ברורה.`);
});
