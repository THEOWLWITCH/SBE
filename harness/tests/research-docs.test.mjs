import test from 'node:test';
import assert from 'node:assert/strict';
import { handleResearchDocs } from '../lib/research-docs.mjs';

const SID = '11111111-2222-4333-8444-555555555555';
function mem() { const m = new Map(); return { get: async (k) => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async (k) => { m.delete(k); } }; }
const owner = async () => ({ owner: true, canRead: true, canEdit: true });
const reader = async () => ({ owner: false, canRead: true, canEdit: false });
const lister = async () => ({ owner: false, canRead: false, canEdit: false });
const none = async () => null;
const pdf = Buffer.from('%PDF-1.4 hello').toString('base64');
const docx = Buffer.from([0x50, 0x4b, 3, 4, 1, 2]).toString('base64');

test('owner uploads, team member lists and downloads, cannot delete', async () => {
  const s = mem();
  let [st, out] = await handleResearchDocs(s, null, { op: 'put', input: { studyId: SID, filename: 'הצעת המחקר.docx', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', title: 'הצעת המחקר', contentBase64: docx } }, { access: owner });
  assert.equal(st, 200); const id = out.doc.id;
  [st, out] = await handleResearchDocs(s, null, { op: 'list', input: { studyId: SID } }, { access: reader });
  assert.equal(st, 200); assert.equal(out.docs.length, 1); assert.equal(out.canEdit, false);
  [st, out] = await handleResearchDocs(s, null, { op: 'get', input: { studyId: SID, id } }, { access: reader });
  assert.equal(st, 200); assert.equal(out.contentBase64, docx);
  [st] = await handleResearchDocs(s, null, { op: 'del', input: { studyId: SID, id } }, { access: reader });
  assert.equal(st, 403);
  [st] = await handleResearchDocs(s, null, { op: 'get', input: { studyId: SID, id } }, { access: lister });
  assert.equal(st, 403);
  [st] = await handleResearchDocs(s, null, { op: 'del', input: { studyId: SID, id } }, { access: owner });
  assert.equal(st, 200);
  assert.equal(await s.get('rsd:' + SID + ':' + id), undefined);
});

test('no study access, bad type and bad content are refused', async () => {
  const s = mem();
  assert.equal((await handleResearchDocs(s, null, { op: 'list', input: { studyId: SID } }, { access: none }))[0], 403);
  assert.equal((await handleResearchDocs(s, null, { op: 'list', input: { studyId: 'x' } }, { access: owner }))[0], 400);
  assert.equal((await handleResearchDocs(s, null, { op: 'put', input: { studyId: SID, filename: 'a.exe', mediaType: 'application/pdf', contentBase64: pdf } }, { access: owner }))[0], 400);
  assert.equal((await handleResearchDocs(s, null, { op: 'put', input: { studyId: SID, filename: 'a.pdf', mediaType: 'application/pdf', contentBase64: docx } }, { access: owner }))[0], 400);
  assert.equal((await handleResearchDocs(s, null, { op: 'put', input: { studyId: SID, filename: 'a.pdf', mediaType: 'application/pdf', contentBase64: pdf } }, { access: owner }))[0], 200);
});
