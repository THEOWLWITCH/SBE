// מעבדת האופק: שיתוף בין מכשירים (28/10/2026: "תפרסם לפי ההמלצה").
// "חדר" הוא עבודה אחת שמי שפתח/ה אותה (בעל/ת הרשאת horizon) פותח/ת לקבוצה: קול הקהילה, מחולל העתידים
// ותמונת עתיד קבוצתית. המשתתפים נכנסים בקישור (?room=), בלי קוד, רק לעבודה הזו ורק עד שהחדר נסגר או פג.
//
// אחסון: במסד הקיים (access_settings), שורה קטנה לחדר (hlr:<id>) ושורה לכל מסמך (hld:<id>:<path>).
// כל כתיבה מעלה את מספר הגרסה של החדר. המכשירים שואלים כל כמה שניות רק "מה הגרסה?" (תשובה של כמה בתים),
// ומקבלים רק את המסמכים שהשתנו מאז הגרסה שכבר יש להם. החדר נמחק אוטומטית אחרי 30 יום.
import { createHash, randomBytes } from 'node:crypto';

export const HL_SHARE_PAGES = ['hl-voice.html', 'hl-futures.html', 'hl-collage.html'];
export const HL_ROOM_DAYS = 30;
const MAX_DOC = 1_500_000;         // מסמך אחד (תמונה מוקטנת בתמונת העתיד)
const MAX_ROOM = 12_000_000;       // כל החדר
const MAX_DOCS = 3000;
const MAX_ROOMS_PER_OWNER = 25;
const MAX_OPS = 400;

const sha = (v) => createHash('sha256').update(String(v)).digest('hex');
const okRoom = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);
const okGuest = (g) => typeof g === 'string' && /^[a-z0-9]{6,24}$/.test(g);
const okPath = (p) => typeof p === 'string' && p.length <= 400 && p.split('/').length % 2 === 0
  && p.split('/').length <= 10 && p.split('/').every((s) => /^[A-Za-z0-9_-]{1,80}$/.test(s));
const live = (rec) => rec && !rec.closed && Date.parse(rec.exp) > Date.now();
const pageOf = (p) => { const f = String(p || '').split('?')[0].split('/').pop().toLowerCase(); return HL_SHARE_PAGES.includes(f) ? f : ''; };

// מטמון בזיכרון: מספר הגרסה של חדר (לשנייה אחת), והמסמכים לפי גרסה. במקרה של כמה שרתים, המטמון רק מתרענן.
const recCache = new Map();   // id → { at, rec }
const docCache = new Map();   // id → { ver, docs: Map(path → {v, d?, del?, by}) }
const locks = new Map();
function withLock(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => {});
  locks.set(id, tail);
  tail.then(() => { if (locks.get(id) === tail) locks.delete(id); });
  return run;
}
async function getRoom(store, id, fresh = false) {
  const c = recCache.get(id);
  if (!fresh && c && Date.now() - c.at < 1000) return c.rec;
  const rec = await store.get('hlr:' + id);
  recCache.set(id, { at: Date.now(), rec });
  if (recCache.size > 500) recCache.delete(recCache.keys().next().value);
  return rec;
}
async function loadDocs(store, id, ver) {
  const c = docCache.get(id);
  if (c && c.ver === ver) return c.docs;
  const rows = await store.list('hld:' + id + ':');
  const docs = new Map();
  for (const r of rows) docs.set(r.key.slice(('hld:' + id + ':').length), r.value);
  docCache.set(id, { ver, docs });
  if (docCache.size > 60) docCache.delete(docCache.keys().next().value);
  return docs;
}
async function dropRoom(store, id) {
  if (typeof store.delPrefix === 'function') await store.delPrefix('hld:' + id + ':');
  else for (const r of await store.list('hld:' + id + ':', { keysOnly: true })) await store.del(r.key);
  await store.del('hlr:' + id);
  recCache.delete(id); docCache.delete(id);
}
// חדרים שפג תוקפם נמחקים כשפותחים חדר חדש.
async function sweep(store) {
  const rows = await store.list('hlr:');
  for (const r of rows) if (!live(r.value)) { try { await dropRoom(store, r.key.slice(4)); } catch {} }
  return rows.filter((r) => live(r.value)).map((r) => r.value);
}
const size = (v) => (v === undefined ? 0 : JSON.stringify(v).length);

// הרשאה למודל לאורחים בחדר (נקרא מ-authorizeModel): רק בדף של החדר, רק כשהחדר פתוח.
export async function roomModelGate(store, a, page) {
  if (!okRoom(a.room) || pageOf(page) === '') return null;
  const rec = await getRoom(store, a.room);
  if (!live(rec) || rec.page !== pageOf(page)) return null;
  const g = okGuest(a.g) ? a.g : 'anon';
  return { k: 'hlroom', principal: 'hlroom:' + a.room + ':' + g, institution: 'hlroom:' + a.room, inst: rec.inst || null };
}

export async function handleHlRooms(store, body, { authorize }) {
  const { action } = body || {};

  if (action === 'hlRoomCreate') {
    const page = pageOf(body.page);
    if (!page) return [400, { error: 'bad page' }];
    const who = await authorize(body.token);
    if (!who) return [403, { error: 'unauthorized' }];
    const mine = (await sweep(store)).filter((r) => r.owner === who.principal);
    if (mine.length >= MAX_ROOMS_PER_OWNER) return [429, { error: 'too many rooms' }];
    const id = randomBytes(12).toString('hex');
    const key = randomBytes(18).toString('hex');
    const exp = new Date(Date.now() + HL_ROOM_DAYS * 86400000).toISOString();
    const rec = { id, page, keyHash: sha(key), owner: who.principal, inst: who.inst || null, at: new Date().toISOString(), exp, ver: 0, revision: 0, size: 0, count: 0 };
    await store.set('hlr:' + id, rec);
    recCache.set(id, { at: Date.now(), rec });
    return [200, { ok: true, room: id, key, exp, page }];
  }

  const id = body.room;
  if (!okRoom(id)) return [400, { error: 'bad room' }];

  if (action === 'hlPoll') {
    const rec = await getRoom(store, id);
    if (!live(rec)) return [404, { error: 'closed' }];
    const since = Number.isSafeInteger(body.since) ? body.since : -1;
    if (since === rec.ver) return [200, { ver: rec.ver }];
    const docs = await loadDocs(store, id, rec.ver);
    const out = [];
    for (const [p, v] of docs) if (since < 0 || v.v > since) out.push(v.del ? { p, del: true } : { p, d: v.d, by: v.by });
    return [200, { ver: rec.ver, full: since < 0, docs: out, page: rec.page, exp: rec.exp,
      owner: typeof body.key === 'string' && sha(body.key) === rec.keyHash }];
  }

  if (action === 'hlWrite') {
    const ops = Array.isArray(body.ops) ? body.ops.slice(0, MAX_OPS + 1) : [];
    if (!ops.length || ops.length > MAX_OPS) return [400, { error: 'bad ops' }];
    return withLock(id, async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const rec = await getRoom(store, id, true);
        if (!live(rec)) return [404, { error: 'closed' }];
        const isOwner = typeof body.key === 'string' && sha(body.key) === rec.keyHash;
        const g = isOwner ? 'owner' : (okGuest(body.g) ? body.g : null);
        if (!g) return [400, { error: 'bad guest' }];
        const docs = await loadDocs(store, id, rec.ver);
        const N = rec.ver + 1;
        let total = rec.size || 0, count = rec.count || 0;
        const writes = [];
        for (const op of ops) {
          if (!op || !okPath(op.p)) return [400, { error: 'bad path' }];
          const cur = docs.get(op.p);
          const has = cur && !cur.del;
          if (!isOwner && /^config\//.test(op.p)) return [403, { error: 'owner only' }];
          if (op.d === null || op.d === undefined) {
            if (!has) continue;
            if (!isOwner && cur.by !== g) return [403, { error: 'not yours' }];
            total -= size(cur.d); count--;
            writes.push([op.p, { v: N, del: true, by: cur.by }]);
          } else {
            if (typeof op.d !== 'object' || Array.isArray(op.d)) return [400, { error: 'bad data' }];
            const d = op.merge && has ? { ...cur.d, ...op.d } : op.d;
            const s = size(d);
            if (s > MAX_DOC) return [413, { error: 'doc too large' }];
            total += s - (has ? size(cur.d) : 0); if (!has) count++;
            writes.push([op.p, { v: N, d, by: has ? cur.by : g }]);
          }
        }
        if (!writes.length) return [200, { ok: true, ver: rec.ver }];
        if (total > MAX_ROOM || count > MAX_DOCS) return [413, { error: 'room full' }];
        for (const [p, v] of writes) await store.set('hld:' + id + ':' + p, v);
        const next = { ...rec, ver: N, revision: (rec.revision || 0) + 1, size: total, count };
        let ok = true;
        if (typeof store.compareSet === 'function') ok = await store.compareSet('hlr:' + id, rec.revision || 0, next);
        else await store.set('hlr:' + id, next);
        if (ok) {
          recCache.set(id, { at: Date.now(), rec: next });
          for (const [p, v] of writes) docs.set(p, v);
          docCache.set(id, { ver: N, docs });
          return [200, { ok: true, ver: N }];
        }
        docCache.delete(id); // מישהו כתב באותו רגע משרת אחר: מנסים שוב עם הגרסה העדכנית
      }
      return [409, { error: 'busy' }];
    });
  }

  if (action === 'hlRoomClose') {
    const rec = await getRoom(store, id, true);
    if (!rec) return [200, { ok: true }];
    if (typeof body.key !== 'string' || sha(body.key) !== rec.keyHash) return [403, { error: 'owner only' }];
    await withLock(id, () => dropRoom(store, id));
    return [200, { ok: true }];
  }

  return [400, { error: 'bad action' }];
}

// לבדיקות
export function _resetHlCaches() { recCache.clear(); docCache.clear(); locks.clear(); }
