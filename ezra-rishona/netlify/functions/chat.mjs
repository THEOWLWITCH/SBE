// "עזרה ראשונה חינוכית" – פונקציית השיחה של אב-הטיפוס
// מקבלת את היסטוריית השיחה, מוסיפה את הפרומפט ואת מאגר הידע, ושולחת ל-Claude.
// התשובה חוזרת לדפדפן בזרימה (streaming), כדי שהטקסט יופיע תוך כדי כתיבה.

import { SYSTEM_PROMPT, PROTOTYPE_NOTE, KNOWLEDGE_BASE, PROMPT_VERSION } from "./kb.mjs";

const MODEL = process.env.MODEL || "claude-sonnet-5-5";
const MAX_MESSAGES = 60;          // מספר הודעות מרבי בשיחה אחת
const MAX_CHARS = 4000;           // אורך מרבי להודעה אחת
const MAX_TOKENS = 1500;          // אורך מרבי לתשובה

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export default async (req) => {
  if (req.method === "GET") {
    return json(200, { ok: true, model: MODEL, promptVersion: PROMPT_VERSION, needsCode: Boolean(process.env.ACCESS_CODE) });
  }
  if (req.method !== "POST") return json(405, { error: "method" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: "missing_key" });

  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get("x-access-code") !== code) return json(401, { error: "code" });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "bad_json" }); }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length || messages.length > MAX_MESSAGES) return json(400, { error: "length" });

  // ניקוי: רק user/assistant, טקסט בלבד, מתחילים ב-user, לסירוגין
  const clean = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") continue;
    const text = m.content.slice(0, MAX_CHARS).trim();
    if (!text) continue;
    if (!clean.length && m.role !== "user") continue;
    if (clean.length && clean[clean.length - 1].role === m.role) {
      clean[clean.length - 1].content += "\n\n" + text;
    } else {
      clean.push({ role: m.role, content: text });
    }
  }
  if (!clean.length || clean[clean.length - 1].role !== "user") return json(400, { error: "order" });

  const lang = ["he", "ar", "en"].includes(body?.lang) ? body.lang : "he";
  const langNote = { he: "שפת הממשק: עברית.", ar: "لغة الواجهة: العربية. واجهة المستخدم بالعربية.", en: "Interface language: English." }[lang];

  // הפרומפט ומאגר הידע נשמרים בזיכרון מטמון (prompt caching), כדי לחסוך בעלות ובזמן.
  const system = [
    { type: "text", text: SYSTEM_PROMPT + "\n\n" + PROTOTYPE_NOTE },
    { type: "text", text: KNOWLEDGE_BASE, cache_control: { type: "ephemeral" } },
    { type: "text", text: langNote },
  ];

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages: clean, stream: true }),
  });

  if (!upstream.ok || !upstream.body) {
    let detail = "";
    try { detail = (await upstream.text()).slice(0, 500); } catch {}
    return json(502, { error: "upstream", status: upstream.status, detail });
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
};

export const config = { path: "/api/chat" };
