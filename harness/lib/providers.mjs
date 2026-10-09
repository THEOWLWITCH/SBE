// מתאם ספקים. הלוגיקה למעלה לא יודעת מול מי היא מדברת.
import { createRequire } from 'node:module';
// שפה של הזמנה, לא של חובה — כלל של Begood לכל קריאה למודל (מקור אמת: app/lib/invite-language.js)
const INVITE = createRequire(import.meta.url)('../../app/lib/invite-language.js');
export const applyProductPolicy = system => INVITE.apply(system);
// עוצמת הווריאציה מופשטת: כל ספק ממפה אותה אחרת.

const VARIATION = {
  high:   { anthropic: { effort: 'xhigh' }, openai: { temperature: 1.0 } },
  medium: { anthropic: { effort: 'high'  }, openai: { temperature: 0.7 } },
  low:    { anthropic: { effort: 'high'  }, openai: { temperature: 0.3 } },
};

export class ProviderError extends Error {
  constructor(msg, { status, retryable, code = 'provider', result } = {}) {
    super(msg); this.name = 'ProviderError'; this.status = status; this.retryable = !!retryable; this.code = code;
    this.usage = usageOf(); this.completionStatus = 'failed'; this.refusal = null; this.truncation = null;
    if (result) {
      this.result = result; this.usage = result.usage; this.completionStatus = result.status;
      this.refusal = result.refusal; this.truncation = result.truncation;
    }
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

function post(url, headers, body, timeoutMs = 600000, signal) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const request = u.protocol === 'http:' ? httpRequest : httpsRequest;
    const req = request({
      hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method: 'POST', signal,
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
          return reject(new ProviderError(`ספק החזיר HTTP ${res.statusCode}`, { status: res.statusCode, retryable, code: 'http' }));
        }
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new ProviderError('תשובה לא תקינה מהספק', { code: 'malformed_response' })); }
      });
    });
    req.on('timeout', () => req.destroy(new ProviderError(`timeout אחרי ${timeoutMs}ms`, { retryable: true, code: 'timeout' })));
    req.on('error', e => reject(e instanceof ProviderError ? e : new ProviderError(signal?.aborted ? 'הבקשה בוטלה' : 'חיבור הספק נכשל', { retryable: !signal?.aborted, code: signal?.aborted ? 'aborted' : 'transport' })));
    req.write(data);
    req.end();
  });
}

// גרסת streaming (SSE) של post: תשובה ארוכה (עשרות אלפי טוקנים) לוקחת יותר
// מ-10 דקות, ובלי streaming החיבור שותק כל הזמן הזה ונחתך. timeout כאן הוא
// זמן שקט על ה-socket, לא זמן כולל. מחזירה אובייקט באותה צורה כמו תשובה
// רגילה: { content, stop_reason, usage }.
function postStream(url, headers, body, timeoutMs = 600000, signal) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify({ ...body, stream: true });
    const streamedUsage = {};
    const partial = () => ({text:'',toolCalls:[],usage:usageOf(streamedUsage),status:'failed',refusal:null,truncation:null});
    const streamError = e => new ProviderError(e instanceof ProviderError ? e.message : signal?.aborted ? 'הבקשה בוטלה' : 'חיבור הספק נכשל', {
      status:e.status,retryable:e instanceof ProviderError ? e.retryable : !signal?.aborted,
      code:e instanceof ProviderError ? e.code : signal?.aborted ? 'aborted' : 'transport',result:e.result || partial()});
    const request = u.protocol === 'http:' ? httpRequest : httpsRequest;
    const req = request({
      hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers },
      timeout: timeoutMs,
    }, res => {
      res.setEncoding('utf8');
      if (res.statusCode < 200 || res.statusCode >= 300) {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          const retryable = res.statusCode === 429 || res.statusCode >= 500;
          reject(new ProviderError(`ספק החזיר HTTP ${res.statusCode}`, { status: res.statusCode, retryable, code: 'http' }));
        });
        return;
      }
      const blocks = [];
      const msg = { content: blocks, stop_reason: null, usage: streamedUsage };
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
            else if (ev.delta.type === 'thinking_delta') b.thinking = (b.thinking || '') + ev.delta.thinking;
            else if (ev.delta.type === 'signature_delta') b.signature = (b.signature || '') + ev.delta.signature;
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
            req.destroy(new ProviderError(`שגיאת ספק: ${t}`, { retryable: t === 'overloaded_error' || t === 'api_error', code: 'provider' }));
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
          catch (e) { failed = true; req.destroy(new ProviderError('תשובה לא תקינה מהספק', { code: 'malformed_response' })); return; }
        }
      });
      res.on('end', () => {
        if (failed) return;
        if (!msg.stop_reason) return reject(new ProviderError('החיבור לספק נסגר לפני סוף התשובה', { retryable: true, code: 'transport', result: normalizeResult('anthropic', msg) }));
        resolve(msg);
      });
      res.on('error', e => reject(streamError(e)));
    });
    req.on('timeout', () => req.destroy(new ProviderError(`אין נתונים מהספק ${timeoutMs / 1000} שניות`, { retryable: true, code: 'timeout', result: partial() })));
    req.on('error', e => reject(streamError(e)));
    req.write(data);
    req.end();
  });
}

const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const configurationError = message => new ProviderError(message, { code: 'unsupported_configuration' });
const asJson = value => typeof value === 'string' ? value : JSON.stringify(value);
function jsonInput(value) {
  try { const parsed = typeof value === 'string' ? JSON.parse(value) : value; if (!isObject(parsed)) throw new Error(); return parsed; }
  catch { throw new ProviderError('ארגומנטים של כלי אינם אובייקט JSON', { code: 'malformed_response' }); }
}

function fileBlock(file) {
  if (!isObject(file)) throw configurationError('files חייב להכיל אובייקטים');
  const name = file.name || file.filename;
  const mediaType = file.mediaType || file.media_type;
  const data = file.data;
  if (typeof name !== 'string' || !name || typeof mediaType !== 'string' || typeof data !== 'string' || !data)
    throw configurationError('קובץ דורש name, mediaType ו-data בקידוד base64');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) throw configurationError('data של קובץ אינו base64 תקין');
  if (mediaType.startsWith('image/')) return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
  if (mediaType === 'application/pdf') return { type: 'document', title: name, source: { type: 'base64', media_type: mediaType, data } };
  if (mediaType.startsWith('text/')) return { type: 'document', title: name, source: { type: 'text', media_type: 'text/plain', data: Buffer.from(data, 'base64').toString('utf8') } };
  throw configurationError(`סוג קובץ אינו נתמך בחוזה המשותף: ${mediaType}`);
}

function contentBlock(b) {
  if (!isObject(b)) throw configurationError('content חייב להכיל בלוקים');
  if (b.type === 'text' && typeof b.text === 'string') return { type: 'text', text: b.text };
  if (b.type === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string' && isObject(b.input))
    return { type: 'tool_use', id: b.id, name: b.name, input: structuredClone(b.input) };
  if (b.type === 'tool_result' && typeof b.tool_use_id === 'string') {
    if (typeof b.content !== 'string' && !Array.isArray(b.content)) throw configurationError('tool_result דורש content');
    return { type: 'tool_result', tool_use_id: b.tool_use_id, content: typeof b.content === 'string' ? b.content : b.content.map(contentBlock), ...(b.is_error ? { is_error: true } : {}) };
  }
  if (['image','document'].includes(b.type) && isObject(b.source)) {
    const s = b.source;
    if (s.type === 'base64') {
      const out = fileBlock({ name: b.title || 'attachment', mediaType: s.media_type, data: s.data });
      if (out.type !== b.type) throw configurationError('סוג הבלוק אינו תואם לקובץ');
      return out;
    }
    if (s.type === 'text' && b.type === 'document' && typeof s.data === 'string') return { type: 'document', title: b.title || 'attachment.txt', source: { type: 'text', media_type: 'text/plain', data: s.data } };
    if (s.type === 'url' && typeof s.url === 'string' && /^https:\/\//.test(s.url)) return { type: b.type, source: { type: 'url', url: s.url }, ...(b.title ? { title: b.title } : {}) };
  }
  // Provider thinking signatures must stay unchanged in an Anthropic tool loop.
  if (b.type === 'thinking' && typeof b.thinking === 'string' && typeof b.signature === 'string') return { type: 'thinking', thinking: b.thinking, signature: b.signature };
  if (b.type === 'redacted_thinking' && typeof b.data === 'string') return { type: 'redacted_thinking', data: b.data };
  throw configurationError(`content block אינו נתמך: ${b.type || 'unknown'}`);
}

export function normalizeRequest(opts = {}) {
  if (!isObject(opts)) throw configurationError('בקשת ספק חייבת להיות אובייקט');
  const { prompt, messages, system, files = [], tools = [], toolChoice } = opts;
  if (messages !== undefined && prompt !== undefined) throw configurationError('בחרי prompt או messages; אין להשמיט אחד מהם בשקט');
  if (system !== undefined && typeof system !== 'string' && !(Array.isArray(system) && system.every(b => b.type === 'text' && typeof b.text === 'string')))
    throw configurationError('system חייב להיות טקסט או מערך בלוקי טקסט');
  const history = messages === undefined ? [{ role: 'user', content: prompt }] : messages;
  if (!Array.isArray(history) || !history.length) throw configurationError('נדרשים messages או prompt');
  const normalized = history.map(m => {
    if (!isObject(m) || !['user','assistant'].includes(m.role)) throw configurationError('message role חייב להיות user או assistant; system מועבר בנפרד');
    const content = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : Array.isArray(m.content) ? m.content.map(contentBlock) : null;
    if (!content?.length) throw configurationError('message content חסר');
    if (content.some(b => b.type === 'tool_use' && m.role !== 'assistant' || b.type === 'tool_result' && m.role !== 'user')) throw configurationError('כלי בהיסטוריה נמצא בתפקיד לא תקין');
    return { role: m.role, content };
  });
  if (!Array.isArray(files)) throw configurationError('files חייב להיות מערך');
  if (files.length) {
    const last = normalized.at(-1);
    if (last.role !== 'user') throw configurationError('files דורש הודעת user אחרונה');
    last.content.push(...files.map(fileBlock));
  }
  if (!Array.isArray(tools)) throw configurationError('tools חייב להיות מערך');
  const normalizedTools = tools.map(t => {
    if (!isObject(t) || t.type && t.type !== 'function') throw configurationError('החוזה המשותף תומך בכלי function בלבד');
    const f = t.function || t;
    const schema = f.input_schema || f.parameters;
    if (typeof f.name !== 'string' || !f.name || !isObject(schema)) throw configurationError('כלי דורש name וסכמת input_schema/parameters');
    return { name: f.name, input_schema: structuredClone(schema), ...(typeof f.description === 'string' ? { description: f.description } : {}), ...(typeof f.strict === 'boolean' ? { strict: f.strict } : {}) };
  });
  if (new Set(normalizedTools.map(t => t.name)).size !== normalizedTools.length) throw configurationError('שמות כלים כפולים');
  let choice;
  if (toolChoice !== undefined) {
    const c = typeof toolChoice === 'string' ? { type: toolChoice } : toolChoice;
    const type = c?.type === 'required' ? 'any' : c?.type === 'function' ? 'tool' : c?.type;
    if (!['auto','none','any','tool'].includes(type)) throw configurationError('toolChoice אינו נתמך');
    const name = c?.name || c?.function?.name;
    if (type === 'tool' && !normalizedTools.some(t => t.name === name)) throw configurationError('toolChoice מצביע על כלי שאינו מורשה בבקשה');
    if (type === 'any' && !normalizedTools.length) throw configurationError('toolChoice any דורש tools');
    choice = { type, ...(type === 'tool' ? { name } : {}), ...(c?.disable_parallel_tool_use === true ? { disable_parallel_tool_use: true } : {}) };
  }
  const variation = opts.variation || 'medium', maxTokens = opts.maxTokens ?? 220;
  if (!VARIATION[variation]) throw configurationError('variation אינו נתמך');
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 64000) throw configurationError('maxTokens חייב להיות מספר שלם בין 1 ל-64000');
  return { messages: normalized, system: typeof system === 'string' ? system : system?.map(b => b.text).join('\n'), tools: normalizedTools, toolChoice: choice, variation, maxTokens };
}

function openaiContent(b) {
  if (b.type === 'text') return { type: 'input_text', text: b.text };
  if (b.type === 'image') return { type: 'input_image', image_url: b.source.type === 'url' ? b.source.url : `data:${b.source.media_type};base64,${b.source.data}` };
  if (b.type === 'document') {
    if (b.source.type === 'text') return { type: 'input_text', text: `[${b.title}]\n${b.source.data}` };
    return { type: 'input_file', ...(b.source.type === 'url' ? { file_url: b.source.url } : { filename: b.title || 'attachment.pdf', file_data: `data:${b.source.media_type};base64,${b.source.data}` }) };
  }
  throw configurationError(`בלוק ${b.type} אינו ניתן להמרה ל-OpenAI; התחילי היסטוריה ללא thinking של ספק אחר`);
}
function openaiHistory(messages) {
  return messages.flatMap(m => {
    const items = []; let content = [];
    const flush = () => { if (content.length) { items.push({ role: m.role, content }); content = []; } };
    for (const b of m.content) {
      if (b.type === 'tool_use') { flush(); items.push({ type: 'function_call', call_id: b.id, name: b.name, arguments: asJson(b.input) }); }
      else if (b.type === 'tool_result') { flush(); items.push({ type: 'function_call_output', call_id: b.tool_use_id, output: typeof b.content === 'string' ? b.content : b.content.map(openaiContent) }); }
      else content.push(openaiContent(b));
    }
    flush(); return items;
  });
}
function usageOf(usage = {}) {
  usage = isObject(usage) ? usage : {};
  const count = n => Number.isFinite(n) && n >= 0 ? n : null;
  const inputTokens = count(usage.input_tokens), outputTokens = count(usage.output_tokens);
  return { ...usage, inputTokens, outputTokens, totalTokens: count(usage.total_tokens) ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null) };
}
function normalizeResult(provider, raw) {
  if (!isObject(raw)) throw new ProviderError('תשובה לא תקינה מהספק', { code: 'malformed_response' });
  let text = '', toolCalls = [], refusal = null, truncation = null, status;
  try {
  if (provider === 'anthropic') {
    const blocks = raw.content || [];
    text = blocks.filter(b => b.type === 'text').map(b => b.text || '').join('');
    toolCalls = blocks.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, input: jsonInput(b.input) }));
    if (raw.stop_reason === 'refusal') refusal = text || 'הבקשה נדחתה על ידי המודל';
    if (raw.stop_reason === 'max_tokens') truncation = { reason: 'max_tokens' };
    status = refusal ? 'refused' : truncation ? 'incomplete' : ['end_turn','tool_use','stop_sequence'].includes(raw.stop_reason) ? 'completed' : 'failed';
  } else {
    for (const item of raw.output || []) {
      if (item.type === 'function_call') toolCalls.push({ id: item.call_id, name: item.name, input: jsonInput(item.arguments) });
      for (const c of item.content || []) {
        if (c.type === 'output_text') text += c.text || '';
        if (c.type === 'refusal') refusal = c.refusal || 'הבקשה נדחתה על ידי המודל';
      }
    }
    if (!text && typeof raw.output_text === 'string') text = raw.output_text;
    if (raw.status === 'incomplete') truncation = { reason: raw.incomplete_details?.reason || 'incomplete' };
    status = refusal ? 'refused' : truncation ? 'incomplete' : raw.status === 'completed' ? 'completed' : 'failed';
  }
  } catch (error) {
    if (error instanceof ProviderError) {
      const result = { text, toolCalls, usage: usageOf(raw.usage), status: 'failed', refusal, truncation, raw };
      throw new ProviderError(error.message, { code: error.code, result });
    }
    throw new ProviderError('תשובה לא תקינה מהספק', { code: 'malformed_response', result: { text, toolCalls, usage: usageOf(raw.usage), status: 'failed', refusal, truncation, raw } });
  }
  return { text, toolCalls, usage: usageOf(raw.usage), status, refusal, truncation, raw };
}

export function assertCompletionResult(result) {
  if (!isObject(result) || typeof result.text !== 'string' || result.toolCalls !== undefined && !Array.isArray(result.toolCalls))
    throw new ProviderError('פלט הספק אינו תואם לחוזה', { code: 'malformed_response' });
  // Older local mock providers can omit status; actual adapters always include it.
  const status = result.status || 'completed';
  if (status !== 'completed' || result.refusal || result.truncation) throw new ProviderError(
    status === 'refused' ? 'הבקשה נדחתה על ידי המודל' : status === 'incomplete' ? 'התוצר נקטע' : 'הספק לא השלים את הבקשה',
    { code: status, result: { ...result, status } });
  if (!result.text.trim() && !result.toolCalls?.length) throw new ProviderError('הספק החזיר תוצר ריק', { code: 'empty_output', result: { ...result, status: 'failed' } });
  if (result.toolCalls?.some(t => !isObject(t) || typeof t.name !== 'string' || !t.name || !isObject(t.input)))
    throw new ProviderError('פלט כלי אינו תואם לחוזה', { code: 'malformed_response', result: { ...result, status: 'failed' } });
  return result;
}

const defaultTransport = ({ url, headers, body, stream, timeoutMs, signal }) => (stream ? postStream : post)(url, headers, body, timeoutMs, signal);

const anthropic = {
  id: 'anthropic',
  defaultModel: 'claude-opus-5',
  envKey: 'ANTHROPIC_API_KEY',
  // messages/tools/toolChoice הן תוספות עבור מנוע התרגול (תמיכה בשיחה
  // רב-תורית אמיתית ובדיווח מובנה על תפניות שהופעלו) — לא נגעו בהתנהגות
  // הקיימת של שלבי ההפקה 1-3, שממשיכים לשלוח prompt יחיד בלי tools.
  //
  // Adaptive thinking + forced tools is supported by Opus 5. Newer models
  // that disallow forced tools fail explicitly below; no model is substituted.
  // Payload contract tests use synthetic transports, not paid API calls.
  async complete({ model, request, apiKey, transport, signal, timeoutMs }) {
    const { system, messages, tools, toolChoice, variation, maxTokens } = request;
    if (['any','tool'].includes(toolChoice?.type) && /claude-(?:opus-5-5|sonnet-5-5|fable-5-1|mythos-5-1)/.test(model)) throw configurationError(`המודל ${model} אינו תומך בבחירת כלי כפויה`);
    const body = {
      model, max_tokens: maxTokens,
      // אין temperature במודלים העדכניים. הוא הוסר ומחזיר 400.
      output_config: VARIATION[variation].anthropic,
      thinking: { type: 'adaptive' },
      messages,
    };
    if (system) body.system = system;
    if (tools.length) body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;
    // חלק ממפתחות ה-API אינם משויכים ל-workspace ספציפי בחשבון — Anthropic
    // דורשת אז את הכותרת הזאת במפורש (19/09/2026, נתפס בבדיקה חיה: "This
    // API key is not scoped to a workspace"). אופציונלי — לא נשלח כלל אם
    // המשתנה לא מוגדר, כי רוב המפתחות לא צריכים את זה.
    const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    const workspaceId = (process.env.ANTHROPIC_WORKSPACE_ID || '').trim();
    if (workspaceId) headers['anthropic-workspace-id'] = workspaceId;
    return normalizeResult('anthropic', await transport({ url: ANTHROPIC_URL, headers, body, stream: true, signal, timeoutMs }));
  },
};

const openai = {
  id: 'openai',
  defaultModel: 'gpt-4.1',
  envKey: 'OPENAI_API_KEY',
  async complete({ model, request, apiKey, transport, signal, timeoutMs }) {
    const { system, messages, tools, toolChoice, variation, maxTokens } = request;
    if (/^gpt-4\.1(?:-|$)/.test(model) && maxTokens > 32768) throw configurationError(`${model} תומך עד 32768 טוקני פלט; הקטיני maxTokens`);
    const body = { model, input: openaiHistory(messages), max_output_tokens: maxTokens, store: false };
    if (system) body.instructions = system;
    // Preserve current gpt-4.1 sampling behavior; unknown models receive no assumed sampling parameter.
    if (/^gpt-4\.1(?:-|$)/.test(model)) Object.assign(body, VARIATION[variation].openai);
    if (tools.length) body.tools = tools.map(t => ({ type: 'function', name: t.name, parameters: t.input_schema, strict: t.strict ?? false, ...(t.description ? { description: t.description } : {}) }));
    if (toolChoice) {
      body.tool_choice = toolChoice.type === 'tool' ? { type: 'function', name: toolChoice.name } : toolChoice.type === 'any' ? 'required' : toolChoice.type;
      if (toolChoice.disable_parallel_tool_use) body.parallel_tool_calls = false;
    }
    const r = await transport({ url: 'https://api.openai.com/v1/responses', headers: {
      authorization: `Bearer ${apiKey}`,
    }, body, stream: false, signal, timeoutMs });
    return normalizeResult('openai', r);
  },
};

const REGISTRY = { anthropic, openai };

export function getProvider(name, { apiKey: injectedKey, model: configuredModel, transport = defaultTransport, retryDelayMs = 2000 } = {}) {
  const p = REGISTRY[name];
  if (!p) throw new Error(`ספק לא מוכר: ${name}. אפשרויות: ${Object.keys(REGISTRY).join(', ')}`);
  const apiKey = injectedKey || process.env[p.envKey];
  if (!apiKey) throw new Error(`חסר מפתח. הגדירי ${p.envKey}`);
  return {
    id: p.id,
    model: configuredModel || process.env.MODEL || p.defaultModel,
    get maxOutputTokens() { return p.id === 'openai' && /^gpt-4\.1(?:-|$)/.test(this.model) ? 32768 : 64000; },
    async complete(opts = {}) {
      const request = normalizeRequest({...opts,system:applyProductPolicy(opts.system)}), signal = opts.signal;
      const model = opts.model || this.model;
      if (typeof model !== 'string' || !model.trim()) throw configurationError('model חסר');
      if (signal?.aborted) throw new ProviderError('הבקשה בוטלה', { code: 'aborted' });
      const maxAttempts = opts.maxAttempts ?? 2;
      if (![1, 2].includes(maxAttempts)) throw configurationError('maxAttempts צריך להיות 1 או 2');
      let lastErr;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await opts.beforeAttempt?.();
        try { return assertCompletionResult(await p.complete({ request, apiKey, model, transport, signal, timeoutMs: opts.timeoutMs || 600000 })); }
        catch (e) {
          lastErr = e;
          if (!(e instanceof ProviderError) || !e.retryable) throw e;
          if (signal?.aborted || attempt + 1 >= maxAttempts) break;
          await new Promise((resolve, reject) => {
            const timer = setTimeout(done, retryDelayMs);
            const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new ProviderError('הבקשה בוטלה', { code: 'aborted' })); };
            function done() { signal?.removeEventListener('abort', abort); resolve(); }
            signal?.addEventListener('abort', abort, { once: true });
          });
        }
      }
      throw lastErr;
    },
  };
}
