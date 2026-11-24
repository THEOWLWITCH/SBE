// מסמכי המחקר (24/11/2026: "העלה גם את הצעת המחקר"; "עינת צריכה לראותם גם").
// מסמכים של מחקר במרכז המחקר: מי שרואה את המחקר (בעלת המערכת וחברות צוות המחקר) רואה ומוריד;
// בעלת המערכת וחברות צוות עם הרשאת עריכה מעלות ומוחקות. ההרשאה נבדקת מול מרכז המחקר עצמו (studyGet).
// אחסון: rsdi:<מחקר> (רשימה) ו־rsd:<מחקר>:<מסמך> (התוכן).
import { randomBytes } from 'node:crypto';
import { handleResearch, verifyResearchIdentity } from './research.mjs';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DOCS = 60;
const TYPES = {
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/plain': ['txt'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg']
};
const ZIP = ['docx', 'pptx', 'xlsx'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const fail = (status, error) => [status, { error }];

function bytesOf(d) {
  const name = clip(d.filename, 200), ext = name.split('.').pop().toLowerCase();
  if (!name || /[\x00-\x1f/\\]/.test(name) || !(TYPES[d.mediaType] || []).includes(ext)) return null;
  if (typeof d.contentBase64 !== 'string' || !d.contentBase64 || d.contentBase64.length > Math.ceil(MAX_BYTES / 3) * 4) return null;
  const b = Buffer.from(d.contentBase64, 'base64');
  if (!b.length || b.length > MAX_BYTES || b.toString('base64') !== d.contentBase64) return null;
  if (ext === 'pdf' && b.subarray(0, 5).toString() !== '%PDF-') return null;
  if (ZIP.includes(ext) && !(b[0] === 0x50 && b[1] === 0x4b)) return null;
  if (ext === 'png' && b[0] !== 0x89) return null;
  if ((ext === 'jpg' || ext === 'jpeg') && !(b[0] === 0xff && b[1] === 0xd8)) return null;
  return { name, ext, b };
}

// הרשאה: מי שמרכז המחקר מחזיר לו את המחקר. קריאת תוכן: בעלת המערכת או view_document_content.
// כתיבה: בעלת המערכת, או edit_study.
async function access(accessStore, researchStore, token, studyId) {
  let actor;
  try { actor = await verifyResearchIdentity(accessStore, token); } catch { return null; }
  const [status, out] = await handleResearch(accessStore, researchStore, { action: 'studyGet', token, studyId });
  if (status !== 200 || !out?.study) return null;
  const perms = Array.isArray(out.study.permissions) ? out.study.permissions : [];
  const owner = actor?.owner === true;
  return { owner, canRead: owner || perms.includes('view_document_content'), canEdit: owner || perms.includes('edit_study') };
}

export async function handleResearchDocs(store, researchStore, body, options = {}) {
  try {
    const op = String(body?.op || ''), d = body?.input && typeof body.input === 'object' ? body.input : {};
    const studyId = String(d.studyId || '');
    if (!UUID.test(studyId)) return fail(400, 'invalid');
    const who = await (options.access || access)(store, researchStore, String(body.token || ''), studyId);
    if (!who) return fail(403, 'unauthorized');
    const IK = 'rsdi:' + studyId;
    const index = async () => (await store.get(IK)) || [];
    if (op === 'list') return [200, { docs: await index(), canEdit: who.canEdit }];
    if (op === 'get') {
      if (!who.canRead) return fail(403, 'unauthorized');
      const id = clip(d.id, 40), meta = (await index()).find((x) => x.id === id);
      const rec = meta ? await store.get('rsd:' + studyId + ':' + id) : null;
      if (!rec) return fail(404, 'not_found');
      return [200, { doc: meta, contentBase64: rec.b64 }];
    }
    if (!who.canEdit) return fail(403, 'unauthorized');
    if (op === 'put') {
      const f = bytesOf(d); if (!f) return fail(400, 'invalid');
      const list = await index(); if (list.length >= MAX_DOCS) return fail(429, 'too_many');
      const id = randomBytes(9).toString('base64url');
      const meta = { id, name: f.name, title: clip(d.title, 200) || f.name.replace(/\.[^.]+$/, ''), note: clip(d.note, 600), mediaType: d.mediaType, size: f.b.length, addedAt: new Date().toISOString() };
      await store.set('rsd:' + studyId + ':' + id, { b64: f.b.toString('base64') });
      list.unshift(meta); await store.set(IK, list);
      return [200, { doc: meta }];
    }
    if (op === 'del') {
      const id = clip(d.id, 40), list = await index(), next = list.filter((x) => x.id !== id);
      if (next.length === list.length) return fail(404, 'not_found');
      await store.del('rsd:' + studyId + ':' + id); await store.set(IK, next);
      return [200, { ok: true }];
    }
    return fail(405, 'invalid');
  } catch (e) {
    return fail(503, 'unavailable');
  }
}
