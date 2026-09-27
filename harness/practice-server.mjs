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
import { getProvider } from './lib/providers.mjs';
import { runPipeline } from './lib/pipeline.mjs';
import { toScenario } from './lib/to-scenario.mjs';

const args = process.argv.slice(2);
const portArgIdx = args.indexOf('--port');
const PORT = Number(portArgIdx >= 0 ? args[portArgIdx + 1] : (process.env.PORT || 8790));

// CORS: ברירת מחדל לדומיין Netlify הידוע. ניתן לדריסה דרך CORS_ORIGIN.
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://s-b-e.netlify.app';

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': CORS_ORIGIN,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
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

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  if (req.method === 'GET' && req.url === '/health') {
    const hasKey = !!process.env[getProviderEnvKeyName()];
    return sendJson(res, 200, { ok: true, hasKey });
  }

  const validPaths = ['/api/complete', '/api/character-turn', '/api/pipeline'];
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
  if (req.url === '/api/pipeline') {
    if (!payload.input || !payload.input.given) {
      return sendJson(res, 400, { error: 'חסר input.given (who / whatHappened / goals)' });
    }
    let provider;
    try { provider = getProvider(process.env.PROVIDER || 'anthropic'); }
    catch (e) { return sendJson(res, 500, { error: e.message }); }
    try {
      const out = await runPipeline(payload.input, provider, { sourceLibrary: payload.sourceLibrary || [] });
      const scenario = toScenario(out, { input: payload.input, meta: payload.meta || {} });
      return sendJson(res, 200, { scenario, _ms: out._ms });
    } catch (e) {
      return sendJson(res, 502, { error: `שגיאת ספק: ${e.message}` });
    }
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

  try {
    const result = await provider.complete({
      system,
      messages: messages || [{ role: 'user', content: '' }],
      tools,
      toolChoice,
      variation: 'medium',
      maxTokens: maxTokens || 220,
    });
    sendJson(res, 200, { text: result.text, toolCalls: result.toolCalls || [] });
  } catch (e) {
    sendJson(res, 502, { error: `שגיאת ספק: ${e.message}` });
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
  console.log(`CORS מוגדר ל: ${CORS_ORIGIN}`);
  console.log(process.env[keyName]
    ? `מפתח ${keyName} נמצא.`
    : `אזהרה: אין ${keyName} מוגדר — כל בקשה תיכשל עם שגיאה ברורה.`);
});
