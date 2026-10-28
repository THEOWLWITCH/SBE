import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createPartnershipIntegration } from './fixtures/research-partnership-integrated.mjs';

const app = fileURLToPath(new URL('../app/', import.meta.url));
const fixture = await createPartnershipIntegration();
const { tokens, request } = fixture;
const checked = (action, payload = {}) => fixture.checked(tokens.owner, action, payload);
const studyA = (await fixture.seedStudy('מוכנות משותפת | נתוני בדיקה')).study;
const studyB = (await fixture.seedStudy('תקשורת חינוכית | נתוני בדיקה')).study;
for (const [study, code] of [[studyA, fixture.codes.a], [studyA, fixture.codes.b], [studyB, fixture.codes.b]]) {
  const current = (await checked('studyGet', { studyId: study.id })).study;
  await checked('memberSet', request({ studyId: study.id, expectedRevision: current.revision, code, role: 'researcher', permissions: ['view_study', 'view_approved_findings', 'propose_analysis', 'view_analysis_results', 'comment_on_findings'] }));
}
const partners = [];
for (const [code, name] of [[fixture.codes.a, 'שושי | נתוני בדיקה'], [fixture.codes.b, 'עינת | נתוני בדיקה']]) {
  partners.push((await checked('partnerSave', request({ expectedRevision: null, individualCode: code, profile: { fullName: name, email: code.toLowerCase() + '@example.invalid', institution: 'מוסד בדוי', position: 'חוקרת' } }))).partner);
}
for (const [study, partner, title] of [[studyA, partners[0], 'בקשת שותפות ראשונה'], [studyA, partners[1], 'בקשה פרטית לחוקרת השנייה'], [studyB, partners[1], 'בקשת מחקר נוסף']]) {
  await checked('recordSave', request({ studyId: study.id, partnerId: partner.id, expectedRevision: null, kind: 'application', data: { title, applicationType: 'partnership', ...partner.profile, objectives: 'בחינת תקשורת ומוכנות משותפת', researchQuestions: ['כיצד מתפתח שיתוף פעולה?'], method: 'שאלונים ורפלקציה', population: 'צוות חינוך בדוי', requestedTools: ['communication'], startDate: '2026-11-01', endDate: '2027-05-31', ethicsStatus: 'pending', ethicsDetails: 'תיעוד בדיקה סינתטי', consentPlan: 'הסכמה נפרדת לכל סוג מידע', requestedPermissions: ['view_approved_findings'] } }));
}

// Public conditions and incoming requests are synthetic fixtures, never approved legal text.
let termsState = (await checked('intakeOwnerBootstrap')).termsState;
termsState = (await checked('intakeTermsSave', request({ expectedRevision: termsState.revision,
  title: 'תנאי פנייה לשותפות | בדיקת פיתוח',
  text: 'נתוני בדיקה בלבד. אפשר להציע שותפות בשם מוסד או כאדם פרטי.\nהגשת פנייה אינה יוצרת הרשאות, התחייבות או הסכם. בעלת המערכת בוחנת כל בקשה.\nפרטי מחקר ומסמכים חסויים יושלמו בתיק המוגן. אישור קריאה אינו חתימה.' }))).termsState;
termsState = (await checked('intakeTermsPublish', request({ expectedRevision: termsState.revision, versionId: termsState.draftVersion.versionId }))).termsState;
const publicInfo = (await fixture.publicCall({ action: 'intakePublicInfo' }))[1];
for (const [applicantType, name, institution] of [['individual', 'נועה | נתוני בדיקה', ''], ['institution', 'נציגת מוסד | נתוני בדיקה', 'מוסד שותף בדוי']]) {
  const [status] = await fixture.publicCall({ action: 'intakeSubmit', ...request(), termsVersionId: publicInfo.terms.versionId,
    termsHash: publicInfo.terms.hash, acknowledged: true, application: { applicantType, fullName: name,
      email: applicantType + '@example.invalid', ...(institution ? { institution } : {}), title: 'פנייה של ' + name,
      applicationType: 'partnership', objectives: 'שיתוף פעולה בבדיקת מוכנות ותקשורת. נתונים בדויים בלבד.', requestedTools: ['communication'] } });
  if (status !== 200) throw new Error('Synthetic intake seed failed');
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const banner = '<div role="note" style="background:#fff1bd;color:#332b00;padding:10px;text-align:center;font-family:Arial" dir="rtl">סביבת פיתוח מקומית · כל המחקרים והזהויות כאן בדויים · לא נשלחות הזמנות ולא מתבצעת חתימה</div>';
function json(res, status, data) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'vary': 'Origin' }); res.end(JSON.stringify(data)); }
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/qa') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>בדיקת מחקר מקומית</title>' + banner + '<h1>בחירת מסלול לבדיקה</h1><p><a href="/research-partnership.html">טופס הפנייה הציבורי</a></p><p><a href="/qa/actor/owner">בעלת המערכת</a></p><p><a href="/qa/actor/a">שושי</a></p><p><a href="/qa/actor/b">עינת</a></p><p><a href="/qa/actor/ordinary">חשבון ללא הרשאה</a></p></html>');
    }
    if (req.method === 'GET' && /^\/qa\/actor\/(owner|a|b|ordinary)$/.test(url.pathname)) {
      const actor = url.pathname.split('/').pop();
      const data = JSON.stringify({ token: tokens[actor], home: actor === 'owner' ? 'admin.html?role=sys' : 'home.html', kind: actor === 'owner' ? 'sys' : 'staff' }).replace(/</g, '\\u003c');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end('<!doctype html><meta charset="utf-8"><script>const data=' + data + ';sessionStorage.clear();localStorage.clear();sessionStorage.setItem("sbe.session.token",data.token);sessionStorage.setItem("sbe.session.homeUrl",data.home);sessionStorage.setItem("sbe.session.info",JSON.stringify({kind:data.kind,inst:"Synthetic School"}));sessionStorage.setItem("sbe.session.perms","[\\"writer\\"]");location.replace("/research-management.html")</script>');
    }
    if (req.method === 'POST' && ['/api/research', '/api/research-intake'].includes(url.pathname)) {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 16 * 1024 * 1024) return json(res, 413, { ok: false, error: 'invalid' }); }
      let body; try { body = JSON.parse(raw); } catch { return json(res, 400, { ok: false, error: 'invalid' }); }
      const [status, data] = url.pathname === '/api/research-intake' ? await fixture.publicCall(body) : await fixture.callResearch(body);
      return json(res, status, { ...data, ok: status < 400, status });
    }
    if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'invalid' });
    const path = resolve(app, '.' + decodeURIComponent(url.pathname));
    const inside = relative(app, path);
    if (inside.startsWith('..') || isAbsolute(inside)) return json(res, 404, { ok: false, error: 'not_found' });
    let content = await readFile(path);
    if (extname(path) === '.html') content = content.toString('utf8').replace(/<body([^>]*)>/i, '<body$1>' + banner);
    res.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(content);
  } catch { json(res, 500, { ok: false, error: 'synthetic_fixture_failure' }); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
console.log(JSON.stringify({ url: 'http://127.0.0.1:' + server.address().port + '/qa', synthetic: true }));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await fixture.close(); process.exit(0); }));
