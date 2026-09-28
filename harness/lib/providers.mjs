// מתאם ספקים. הלוגיקה למעלה לא יודעת מול מי היא מדברת.
// עוצמת הווריאציה מופשטת: כל ספק ממפה אותה אחרת.

const VARIATION = {
  high:   { anthropic: { effort: 'xhigh' }, openai: { temperature: 1.0 } },
  medium: { anthropic: { effort: 'high'  }, openai: { temperature: 0.7 } },
  low:    { anthropic: { effort: 'high'  }, openai: { temperature: 0.3 } },
};

class ProviderError extends Error {
  constructor(msg, { status, retryable } = {}) {
    super(msg); this.name = 'ProviderError'; this.status = status; this.retryable = !!retryable;
  }
}

// timeoutMs גדול בכוונה (10 דקות) — נמדד חי (19/09/2026): שלב 3 של הצינור
// (כתיבת שני מסמכים מלאים, 17 סעיפי פרוזה) חצה בפועל את ברירת המחדל
// הקודמת (300000, 5 דקות) והוחזר כ-502 "This operation was aborted" —
// לא כשל מודל, כשל תשתית. שלושת השלבים האחרים (1/2/trainee) הצליחו כולם
// בתוך 5 דקות, אבל אין סיבה שהתשתית המשותפת תגביל אותם ליותר משהמודל בפועל
// צריך — הלקוח (practice-server.mjs / קוד הדפדפן) הוא זה שקובע timeout
// לפי הצורך שלו, לא ה-post הפנימי הזה.
//
// תיקון נוסף, נתפס באותה בדיקה (19/09/2026): הבעיה לא הייתה רק ה-timeoutMs
// שהועבר ל-AbortController. `fetch` המובנה של Node (undici) אוכף ברירת מחדל
// גלובלית משלו לזמן תגובה (~5 דקות) שאינה נשלטת בכלל על ידי AbortSignal —
// שלב 2 עדיין נכשל ב-fetch failed בסביבות 300 שניות גם אחרי שה-timeoutMs
// הועלה ל-600000. הוחלף ל-node:https ישירות, שבו ה-timeout שמוגדר על
// הבקשה עצמה הוא היחיד שקובע.
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';

const ANTHROPIC_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '') + '/v1/messages';

function post(url, headers, body, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = httpsRequest({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers },
      timeout: timeoutMs,
    }, res => {
      // setEncoding ולא raw += c: חיבור Buffer למחרוזת מפענח כל מנה בנפרד, ואות
      // עברית (2 בתים) שנחתכת בגבול בין מנות הופכת ל-"��". זה היה שורש התווים
      // המשובשים שהופיעו מדי פעם בטקסטים של המודל (אובחן 23/09/2026).
      res.setEncoding('utf8');
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const retryable = res.statusCode === 429 || res.statusCode >= 500;
          return reject(new ProviderError(`${res.statusCode}: ${raw.slice(0, 500)}`, { status: res.statusCode, retryable }));
        }
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new ProviderError('תשובה לא תקינה מהספק: ' + raw.slice(0, 200))); }
      });
    });
    req.on('timeout', () => req.destroy(new ProviderError(`timeout אחרי ${timeoutMs}ms`, { retryable: true })));
    req.on('error', e => reject(e instanceof ProviderError ? e : new ProviderError(e.message, { retryable: true })));
    req.write(data);
    req.end();
  });
}

// גרסת streaming (SSE) של post: תשובה ארוכה (עשרות אלפי טוקנים) לוקחת יותר
// מ-10 דקות, ובלי streaming החיבור שותק כל הזמן הזה ונחתך. timeout כאן הוא
// זמן שקט על ה-socket, לא זמן כולל. מחזירה אובייקט באותה צורה כמו תשובה
// רגילה: { content, stop_reason, usage }.
function postStream(url, headers, body, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify({ ...body, stream: true });
    const request = u.protocol === 'http:' ? httpRequest : httpsRequest;
    const req = request({
      hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers },
      timeout: timeoutMs,
    }, res => {
      res.setEncoding('utf8');
      if (res.statusCode < 200 || res.statusCode >= 300) {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          const retryable = res.statusCode === 429 || res.statusCode >= 500;
          reject(new ProviderError(`${res.statusCode}: ${raw.slice(0, 500)}`, { status: res.statusCode, retryable }));
        });
        return;
      }
      const blocks = [];
      const msg = { content: blocks, stop_reason: null, usage: {} };
      let buf = '', failed = false;
      const handle = (ev) => {
        switch (ev.type) {
          case 'message_start':
            Object.assign(msg.usage, ev.message?.usage || {});
            break;
          case 'content_block_start': {
            const b = { ...ev.content_block };
            if (b.type === 'text') b.text = '';
            if (b.type === 'tool_use') { b._json = ''; b.input = {}; }
            blocks[ev.index] = b;
            break;
          }
          case 'content_block_delta': {
            const b = blocks[ev.index];
            if (!b) break;
            if (ev.delta.type === 'text_delta') b.text += ev.delta.text;
            else if (ev.delta.type === 'input_json_delta') b._json += ev.delta.partial_json;
            break;
          }
          case 'content_block_stop': {
            const b = blocks[ev.index];
            if (b && b.type === 'tool_use') { b.input = b._json ? JSON.parse(b._json) : {}; delete b._json; }
            break;
          }
          case 'message_delta':
            if (ev.delta?.stop_reason) msg.stop_reason = ev.delta.stop_reason;
            Object.assign(msg.usage, ev.usage || {});
            break;
          case 'error': {
            const t = ev.error?.type || 'error';
            failed = true;
            req.destroy(new ProviderError(`${t}: ${ev.error?.message || ''}`, { retryable: t === 'overloaded_error' || t === 'api_error' }));
            break;
          }
        }
      };
      res.on('data', chunk => {
        buf += chunk.replace(/\r/g, '');
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const line = block.split('\n').find(l => l.startsWith('data:'));
          if (!line) continue;
          try { handle(JSON.parse(line.slice(5).trim())); }
          catch (e) { failed = true; req.destroy(new ProviderError('תשובה לא תקינה מהספק: ' + e.message, { retryable: true })); return; }
        }
      });
      res.on('end', () => {
        if (failed) return;
        if (!msg.stop_reason) return reject(new ProviderError('החיבור לספק נסגר לפני סוף התשובה', { retryable: true }));
        resolve(msg);
      });
      res.on('error', e => reject(e instanceof ProviderError ? e : new ProviderError(e.message, { retryable: true })));
    });
    req.on('timeout', () => req.destroy(new ProviderError(`אין נתונים מהספק ${timeoutMs / 1000} שניות`, { retryable: true })));
    req.on('error', e => reject(e instanceof ProviderError ? e : new ProviderError(e.message, { retryable: true })));
    req.write(data);
    req.end();
  });
}

const anthropic = {
  id: 'anthropic',
  defaultModel: 'claude-opus-5',
  envKey: 'ANTHROPIC_API_KEY',
  // messages/tools/toolChoice הן תוספות עבור מנוע התרגול (תמיכה בשיחה
  // רב-תורית אמיתית ובדיווח מובנה על תפניות שהופעלו) — לא נגעו בהתנהגות
  // הקיימת של שלבי ההפקה 1-3, שממשיכים לשלוח prompt יחיד בלי tools.
  //
  // **לא מאומת מול ה-API האמיתי**: האם `tool_choice` שכופה כלי ספציפי
  // מתפקד נכון יחד עם `thinking:{type:'adaptive'}` (למשל, האם המודל עדיין
  // מפיק גם בלוק טקסט לצד ה-tool_use הכפוי, או רק את הכלי). זו בדיוק
  // הסיבה שבדיקת הסף (`harness/practice-adversarial-test.mjs`) חייבת
  // לרוץ נגד מודל אמיתי לפני שסומכים על העיצוב הזה במלואו.
  async complete({ model, system, prompt, messages, tools, toolChoice, variation, maxTokens, apiKey }) {
    const body = {
      model, max_tokens: maxTokens,
      // אין temperature במודלים העדכניים. הוא הוסר ומחזיר 400.
      output_config: VARIATION[variation].anthropic,
      thinking: { type: 'adaptive' },
      messages: messages || [{ role: 'user', content: prompt }],
    };
    if (system) body.system = system;
    if (tools) body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;
    // חלק ממפתחות ה-API אינם משויכים ל-workspace ספציפי בחשבון — Anthropic
    // דורשת אז את הכותרת הזאת במפורש (19/09/2026, נתפס בבדיקה חיה: "This
    // API key is not scoped to a workspace"). אופציונלי — לא נשלח כלל אם
    // המשתנה לא מוגדר, כי רוב המפתחות לא צריכים את זה.
    const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    const workspaceId = (process.env.ANTHROPIC_WORKSPACE_ID || '').trim();
    if (workspaceId) headers['anthropic-workspace-id'] = workspaceId;
    const r = await postStream(ANTHROPIC_URL, headers, body);
    if (r.stop_reason === 'max_tokens') throw new ProviderError(`התוצר נקטע. max_tokens נמוך מדי (${maxTokens}, נוצרו ${r.usage?.output_tokens ?? '?'})`);
    if (r.stop_reason === 'refusal') throw new ProviderError('הבקשה נדחתה על ידי המודל');
    const blocks = r.content || [];
    const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('');
    const toolCalls = blocks.filter(b => b.type === 'tool_use').map(b => ({ name: b.name, input: b.input }));
    return { text, toolCalls, usage: r.usage, raw: r };
  },
};

const openai = {
  id: 'openai',
  defaultModel: 'gpt-4.1',
  envKey: 'OPENAI_API_KEY',
  async complete({ model, system, prompt, variation, maxTokens, apiKey }) {
    const input = system ? `${system}\n\n${prompt}` : prompt;
    const r = await post('https://api.openai.com/v1/responses', {
      authorization: `Bearer ${apiKey}`,
    }, { model, input, max_output_tokens: maxTokens, ...VARIATION[variation].openai });
    if (r.status === 'incomplete') throw new ProviderError('התוצר נקטע. max_output_tokens נמוך מדי');
    let text = r.output_text || '';
    if (!text && Array.isArray(r.output)) {
      text = r.output.flatMap(i => (i.content || [])).map(c => c.text || '').join('');
    }
    return { text, usage: r.usage, raw: r };
  },
};

const REGISTRY = { anthropic, openai };

export function getProvider(name) {
  const p = REGISTRY[name];
  if (!p) throw new Error(`ספק לא מוכר: ${name}. אפשרויות: ${Object.keys(REGISTRY).join(', ')}`);
  const apiKey = process.env[p.envKey];
  if (!apiKey) throw new Error(`חסר מפתח. הגדירי ${p.envKey}`);
  return {
    id: p.id,
    model: process.env.MODEL || p.defaultModel,
    async complete(opts) {
      let lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return await p.complete({ ...opts, apiKey, model: opts.model || this.model }); }
        catch (e) {
          lastErr = e;
          if (!(e instanceof ProviderError) || !e.retryable) throw e;
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
      throw lastErr;
    },
  };
}
