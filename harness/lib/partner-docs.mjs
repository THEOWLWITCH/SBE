// מסמך שותפות למחקר (15/11/2026: "מסמך שותפות שרק שולחים לשותף או לשותפה לאישור";
// "מסמך ידידותי ומזמין לעבודה משותפת ולא משהו בסגנון משפטי מרתיע").
// pdoc:<id> → { id, studyId, studyTitle, partnerName, partnerEmail, title, sections:[{id,title,text}], closing,
//               status: draft|sent|approved|changes, version, created, updated, sentAt, approval, responses:[] }
// מנהלת המערכת יוצרת, עורכת ושולחת (בעצמה: קישור, וואטסאפ או מייל). השותף/ה פותח/ת את הקישור בלי כניסה,
// קורא/ת, ומאשר/ת בשם מלא, או כותב/ת שאלה או הצעה לשינוי. כל תגובה מגיעה אליה במייל.
import { randomBytes } from 'node:crypto';

const MAX_DOCS = 300, MAX_RESPONSES = 60, MAX_SECTIONS = 14;
const clip = (v, n) => String(v == null ? '' : v).replace(/\u0000/g, '').slice(0, n);
const validId = (id) => /^[a-f0-9]{32}$/.test(String(id || ''));
const pause = () => new Promise((r) => setTimeout(r, 300));
const now = () => new Date().toISOString();

function cleanSections(list) {
  return (Array.isArray(list) ? list : []).slice(0, MAX_SECTIONS)
    .map((s, i) => ({ id: clip(s && s.id, 24) || 's' + i, title: clip(s && s.title, 140).trim(), text: clip(s && s.text, 6000).trim() }))
    .filter((s) => s.title || s.text);
}
function publicView(d) {
  return { id: d.id, title: d.title, studyTitle: d.studyTitle, partnerName: d.partnerName, fromName: d.fromName,
    intro: d.intro, sections: d.sections, closing: d.closing, status: d.status, version: d.version, updated: d.updated,
    approval: d.approval && d.approval.version === d.version ? { name: d.approval.name, at: d.approval.at } : null,
    responses: (d.responses || []).map((r) => ({ at: r.at, kind: r.kind, name: r.name, text: r.text, from: r.from })) };
}

export async function handlePartnerDocs(store, body, { isSys, notifyAdmin, siteUrl }) {
  const { action } = body;
  const link = (id) => (siteUrl || 'https://be-good.co.il') + '/partner-doc.html?d=' + id;

  // השותף/ה: קריאה ותגובה, בלי כניסה. המזהה ארוך ואקראי, ואי אפשר לנחש אותו.
  if (action === 'pdocGet' || action === 'pdocRespond') {
    const id = String(body.id || '');
    const d = validId(id) ? await store.get('pdoc:' + id) : null;
    if (!d || d.status === 'draft') { await pause(); return [404, { error: 'not found' }]; }
    if (action === 'pdocGet') return [200, { doc: publicView(d) }];
    const kind = body.kind === 'approve' ? 'approve' : body.kind === 'question' ? 'question' : '';
    const name = clip(body.name, 120).trim(), text = clip(body.text, 3000).trim();
    if (!kind) return [400, { error: 'bad kind' }];
    if ((d.responses || []).length >= MAX_RESPONSES) return [429, { error: 'full' }];
    if (kind === 'approve') {
      if (name.length < 2 || body.agree !== true) return [400, { error: 'name and agreement' }];
      if (Number(body.version) !== d.version) return [409, { error: 'changed', doc: publicView(d) }];
      d.approval = { name, at: now(), version: d.version };
      d.status = 'approved';
    } else {
      if (text.length < 2) return [400, { error: 'empty' }];
      if (d.status !== 'approved') d.status = 'changes';
    }
    d.responses = (d.responses || []).concat([{ at: now(), kind, name, text, from: 'partner' }]);
    d.updated = now();
    await store.set('pdoc:' + d.id, d);
    if (notifyAdmin) notifyAdmin(kind === 'approve' ? 'מסמך השותפות אושר' : 'שאלה או הצעה על מסמך השותפות',
      (d.partnerName || 'השותף/ה') + ' · ' + (d.title || '') + (text ? '\n' + text : '') + (kind === 'approve' ? '\nאישר/ה בשם: ' + name : ''),
      (siteUrl || 'https://be-good.co.il') + '/research-management.html').catch(() => {});
    return [200, { ok: true, doc: publicView(d) }];
  }

  if (!isSys) { await pause(); return [403, { error: 'unauthorized' }]; }

  if (action === 'pdocList') {
    const rows = await store.list('pdoc:');
    const items = rows.map((r) => r.value).filter((d) => !body.studyId || d.studyId === String(body.studyId))
      .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
      .map((d) => ({ ...d, link: link(d.id) }));
    return [200, { items }];
  }
  if (action === 'pdocSave') {
    const doc = body.doc || {};
    let d = validId(doc.id) ? await store.get('pdoc:' + doc.id) : null;
    if (doc.id && !d) return [404, { error: 'not found' }];
    if (!d) {
      if ((await store.list('pdoc:', { keysOnly: true })).length >= MAX_DOCS) return [429, { error: 'full' }];
      d = { id: randomBytes(16).toString('hex'), created: now(), status: 'draft', version: 0, responses: [] };
    }
    const next = { title: clip(doc.title, 200).trim() || 'מסמך שותפות', studyId: clip(doc.studyId, 64), studyTitle: clip(doc.studyTitle, 300),
      partnerName: clip(doc.partnerName, 160).trim(), partnerEmail: clip(doc.partnerEmail, 200).trim(), fromName: clip(doc.fromName, 160).trim(),
      intro: clip(doc.intro, 4000).trim(), sections: cleanSections(doc.sections), closing: clip(doc.closing, 3000).trim() };
    const changed = ['title', 'studyTitle', 'partnerName', 'fromName', 'intro', 'closing'].some((k) => d[k] !== next[k])
      || JSON.stringify(d.sections || []) !== JSON.stringify(next.sections);
    Object.assign(d, next);
    if (changed) { d.version = (d.version || 0) + 1; if (d.status === 'approved' || d.status === 'changes') d.status = 'sent'; }
    if (body.send === true && d.status === 'draft') { d.status = 'sent'; d.sentAt = now(); }
    d.updated = now();
    await store.set('pdoc:' + d.id, d);
    return [200, { doc: { ...d, link: link(d.id) } }];
  }
  if (action === 'pdocReply') {
    const id = String(body.id || ''), d = validId(id) ? await store.get('pdoc:' + id) : null;
    if (!d) return [404, { error: 'not found' }];
    const text = clip(body.text, 3000).trim();
    if (text.length < 2) return [400, { error: 'empty' }];
    d.responses = (d.responses || []).concat([{ at: now(), kind: 'reply', name: d.fromName || 'Begood', text, from: 'owner' }]).slice(-MAX_RESPONSES);
    d.updated = now();
    await store.set('pdoc:' + id, d);
    return [200, { doc: { ...d, link: link(d.id) } }];
  }
  if (action === 'pdocDelete') {
    const id = String(body.id || '');
    if (!validId(id)) return [404, { error: 'not found' }];
    await store.del('pdoc:' + id);
    return [200, { ok: true }];
  }
  return [400, { error: 'bad action' }];
}

export const _test = { publicView, cleanSections };
