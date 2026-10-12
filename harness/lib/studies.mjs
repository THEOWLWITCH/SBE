// לימודי חוסן חברתי: metadata in access_settings; attachment bytes remain private.
import { randomUUID } from 'node:crypto';
import { authorizePermission, verifyToken } from './access.mjs';

const LIBRARY_KEY = 'studies:library';
const BUCKET = 'study-materials';
const MAX_FILE = 50 * 1024 * 1024;
const MAX_PREVIEW = 1024 * 1024;
const MIME_BY_EXT = {
  pdf: 'application/pdf', ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain', csv: 'text/csv', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};
const fail = (status, code, error) => Object.assign(new Error(error), { status, code });
const invalid = error => fail(400, 'studies_invalid', error);
const missing = () => fail(404, 'studies_missing', 'החומר או הקבוצה אינם זמינים. אפשר לרענן את הרשימה.');
const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);

function todayIsrael() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function text(value, max, label, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw invalid(`אפשר להוסיף ${label} באורך של עד ${max} תווים.`);
  return value.trim();
}

function base64(data, max, label) {
  if (typeof data !== 'string' || !data || data.length > Math.ceil(max / 3) * 4 || data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw invalid(`${label} אינו תקין או גדול מדי.`);
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > max || bytes.toString('base64') !== data) throw invalid(`${label} אינו תקין או גדול מדי.`);
  return bytes;
}

function previews(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 3) throw invalid('אפשר לצרף עד שלוש תמונות תצוגה.');
  return value.map(data => {
    const match = typeof data === 'string' && /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data);
    if (!match) throw invalid('אפשר לצרף תמונות תצוגה מסוג JPEG, PNG או WebP.');
    base64(match[2], MAX_PREVIEW, 'תמונת התצוגה');
    return data;
  });
}

function upload(file) {
  if (!file || typeof file !== 'object' || Array.isArray(file)) throw invalid('אפשר לבחור קובץ לצירוף.');
  const name = text(file.name, 240, 'שם קובץ', true);
  if (/[\x00-\x1f\x7f/\\]/.test(name)) throw invalid('אפשר לבחור קובץ עם שם תקין.');
  const extension = name.split('.').pop().toLowerCase();
  const mime = MIME_BY_EXT[extension];
  const givenMime = file.mime == null ? '' : text(file.mime, 150, 'סוג קובץ').toLowerCase();
  const generic = !givenMime || givenMime === 'application/octet-stream';
  const csvAlias = extension === 'csv' && ['text/plain', 'application/vnd.ms-excel'].includes(givenMime);
  if (!mime || (!generic && givenMime !== mime && !csvAlias)) throw invalid('אפשר לצרף PDF, מסמכי Office, טקסט, CSV או תמונות JPEG, PNG ו־WebP.');
  return { name, mime, bytes: base64(file.data, MAX_FILE, 'הקובץ (עד 50 MiB)') };
}

function publicItem(item) {
  return { id: item.id, groupId: item.groupId, title: item.title, description: item.description,
    date: item.date, url: item.url, file: item.file ? { name: item.file.name, mime: item.file.mime, size: item.file.size } : null,
    previews: item.previews };
}

async function library(store) {
  return (await store.get(LIBRARY_KEY)) || { groups: [], items: [] };
}

// Server store clients are recreated per request, so a process-wide chain is
// intentional: group deletion and item save use one metadata snapshot at a time.
let mutationChain = Promise.resolve();
const MUTATIONS = new Set(['groupSave', 'groupDelete', 'save', 'delete']);

export async function handleStudies(store, body, { files } = {}) {
  try {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('אפשר לשלוח בקשה תקינה.');
    if (MUTATIONS.has(body.action)) {
      const run = mutationChain.then(() => mutate(store, body, files));
      mutationChain = run.catch(() => {});
      return await run;
    }
    const authorized = await authorizePermission(store, body.token, ['studies']);
    if (!authorized) throw fail(403, 'studies_forbidden', 'לימודי חוסן חברתי אינם פתוחים בכניסה הזו. אפשר לבדוק את הקוד או לפנות למנהלת המערכת.');
    const saved = await library(store);
    if (body.action === 'list') return [200, { groups: saved.groups.map(g => ({ id: g.id, title: g.title })),
      items: [...saved.items].sort((a, b) => b.date.localeCompare(a.date)).map(publicItem) }];
    if (body.action === 'file') {
      const item = validId(body.id) && saved.items.find(x => x.id === body.id);
      if (!item?.file) throw missing();
      if (!files) throw Error('attachment storage unavailable');
      return [200, { bytes: await files.get(item.file.path), name: item.file.name, mime: item.file.mime }];
    }
    throw invalid('הפעולה אינה מוכרת. אפשר לרענן ולנסות שוב.');
  } catch (error) {
    if (!error.status) console.error('studies: storage request failed');
    return [error.status || 503, { code: error.code || 'studies_storage', error: error.status ? error.message : 'החומרים אינם זמינים כרגע. אפשר לנסות שוב בעוד מעט.' }];
  }
}

async function cleanup(files, path) {
  if (!path) return;
  try { await files.del(path); }
  catch { console.error('studies: private attachment cleanup failed'); }
}

async function mutate(store, body, files) {
  const token = await verifyToken(store, body.token);
  if (token?.k !== 'sys') throw fail(403, 'studies_forbidden', 'ניהול החומרים פתוח למנהלת המערכת.');
  const saved = await library(store);
  if (body.action === 'groupSave') {
    const group = body.group;
    if (!group || typeof group !== 'object' || Array.isArray(group)) throw invalid('אפשר להוסיף שם לקבוצה.');
    const title = text(group.title, 120, 'שם לקבוצה', true);
    const old = group.id == null ? null : validId(group.id) && saved.groups.find(g => g.id === group.id);
    if (group.id != null && !old) throw missing();
    const updated = { id: old?.id || randomUUID(), title };
    saved.groups = old ? saved.groups.map(g => g.id === old.id ? updated : g) : [...saved.groups, updated];
    await store.set(LIBRARY_KEY, saved);
    return [200, { group: updated }];
  }
  if (body.action === 'groupDelete') {
    if (!validId(body.id) || !saved.groups.some(g => g.id === body.id)) throw missing();
    if (saved.items.some(item => item.groupId === body.id)) throw fail(409, 'studies_group_not_empty', 'בקבוצה יש חומרים. אפשר להעביר אותם לקבוצה אחרת לפני המחיקה.');
    saved.groups = saved.groups.filter(g => g.id !== body.id);
    await store.set(LIBRARY_KEY, saved);
    return [200, { ok: true }];
  }
  if (body.action === 'delete') {
    const old = validId(body.id) && saved.items.find(item => item.id === body.id);
    if (!old) throw missing();
    if (old.file && !files) throw Error('attachment storage unavailable');
    saved.items = saved.items.filter(item => item.id !== old.id);
    await store.set(LIBRARY_KEY, saved);
    await cleanup(files, old.file?.path);
    return [200, { ok: true }];
  }

  const input = body.item;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('אפשר להוסיף את פרטי החומר.');
  const old = input.id == null ? null : validId(input.id) && saved.items.find(item => item.id === input.id);
  if (input.id != null && !old) throw missing();
  const groupId = text(input.groupId, 64, 'מזהה קבוצה');
  if (groupId && !saved.groups.some(group => group.id === groupId)) throw invalid('הקבוצה אינה זמינה. אפשר לבחור קבוצה מהרשימה.');
  const title = text(input.title, 200, 'כותרת', true);
  const description = text(input.description, 10000, 'הסבר');
  const date = input.date === undefined ? todayIsrael() : input.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) throw invalid('אפשר לבחור תאריך תקין.');
  const url = text(input.url, 2048, 'קישור');
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw invalid('אפשר לצרף קישור מלא שמתחיל ב־https:// או http://.'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw invalid('אפשר לצרף קישור מלא שמתחיל ב־https:// או http://.');
  }
  const slides = previews(input.previews);
  const added = body.file === undefined || body.file === null ? null : upload(body.file);
  let file = body.file === undefined ? old?.file || null : null;
  if (!url && !file && !added) throw invalid('אפשר לצרף קובץ או קישור לחומר.');
  if ((added || (old?.file && body.file !== undefined)) && !files) throw Error('attachment storage unavailable');
  const id = old?.id || randomUUID();
  let uploadedPath;
  try {
    if (added) {
      uploadedPath = `${id}/${randomUUID()}`;
      await files.put(uploadedPath, added.bytes, added.mime);
      file = { path: uploadedPath, name: added.name, mime: added.mime, size: added.bytes.length };
    }
    const updated = { id, groupId, title, description, date, url, file, previews: slides };
    saved.items = old ? saved.items.map(item => item.id === id ? updated : item) : [...saved.items, updated];
    await store.set(LIBRARY_KEY, saved);
    if (old?.file && old.file.path !== file?.path) await cleanup(files, old.file.path);
    return [200, { item: publicItem(updated) }];
  } catch (error) {
    if (uploadedPath) {
      // A failed response can follow a committed metadata write. Keep the object
      // whenever it is referenced, or when that write cannot be checked safely.
      try {
        const current = await library(store);
        if (!current.items.some(item => item.file?.path === uploadedPath)) await cleanup(files, uploadedPath);
      } catch { console.error('studies: private attachment cleanup deferred after uncertain save'); }
    }
    throw error;
  }
}

// REST endpoints follow the official Supabase Storage API/SDK. Credentials are
// supplied only by practice-server.mjs and never appear in metadata or responses.
export function supabaseStudyFiles(url, key, { fetchImpl = fetch, timeoutMs = 120000 } = {}) {
  const base = `${url.replace(/\/+$/, '')}/storage/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const object = path => path.split('/').map(encodeURIComponent).join('/');
  const request = (target, options = {}) => fetchImpl(target, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  const check = response => {
    if (!response.ok) throw Error('private storage unavailable');
    return response;
  };
  async function ensurePrivate(create) {
    let response = await request(`${base}/bucket/${BUCKET}`, { headers });
    if (!response.ok && create) {
      const detail = await response.json().catch(() => ({}));
      const absent = response.status === 404 || String(detail.statusCode) === '404' || detail.code === 'NoSuchBucket' || detail.message === 'Bucket not found' || detail.error === 'Bucket not found';
      if (!absent) check(response);
      check(await request(`${base}/bucket`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_FILE }) }));
      response = await request(`${base}/bucket/${BUCKET}`, { headers });
    }
    const bucket = await check(response).json();
    if (bucket.public !== false) throw Error('private storage bucket required');
  }
  return {
    async put(path, bytes, mime) {
      await ensurePrivate(true);
      check(await request(`${base}/object/${BUCKET}/${object(path)}`, { method: 'POST',
        headers: { ...headers, 'Content-Type': mime, 'x-upsert': 'false' }, body: bytes }));
    },
    async get(path) {
      await ensurePrivate(false);
      const response = check(await request(`${base}/object/authenticated/${BUCKET}/${object(path)}`, { headers }));
      return Buffer.from(await response.arrayBuffer());
    },
    async del(path) {
      check(await request(`${base}/object/${BUCKET}/${object(path)}`, { method: 'DELETE', headers }));
    },
  };
}
