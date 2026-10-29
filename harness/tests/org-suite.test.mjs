// תרגול צוותים בתרחיש (28/10/2026). מנחה עם קוד Begood והרשאת orgsuite; צופים עם קוד המפגש בלבד.
// אותה בדיקה כמו בחבילה (api.test.mjs), מול השרת של Begood ובמסד שלו.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAccess } from '../lib/access.mjs';

function memoryStore(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, async get(k) { return data.has(k) ? structuredClone(data.get(k)) : null; }, async set(k, v) { data.set(k, structuredClone(v)); }, async del(k) { data.delete(k); },
    async list(prefix, o = {}) { return [...data].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => o.keysOnly ? { key } : { key, value: structuredClone(value) }); },
    async delPrefix(prefix) { for (const k of [...data.keys()]) if (k.startsWith(prefix)) data.delete(k); } };
}
async function setup(perms = ['orgsuite']) {
  const store = memoryStore({ institutions: [{ name: 'Inst', code: '123456', active: true, space: 'org' }],
    'modules:Inst': { orgsuite: true, writer: true },
    'code:TEST1234': { code: 'TEST-1234', kind: 'staff', inst: 'Inst', perms, revoked: false },
    'code:OTHR5678': { code: 'OTHR-5678', kind: 'staff', inst: 'Inst', perms: ['orgsuite'], revoked: false } });
  const [, out] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'TEST-1234' });
  const [, other] = await handleAccess(store, { action: 'login', kind: 'code', secret: 'OTHR-5678' });
  return { store, token: out.token, space: out.space, other: other.token };
}
const req = async (store, path, method = 'GET', input, auth = {}) => {
  const [status, value] = await handleAccess(store, { action: 'orsCall', path, method, input, ...auth });
  return { status, value };
};

test('a code without the tool cannot open a session; the org code is in the org space', async () => {
  const { store, token, space } = await setup(['orgsuite']);
  assert.equal(space, 'org');
  const no = await setup(['writer']);
  const r = await req(no.store, '/sessions', 'POST', { title: 'x', scenarioId: 'training-redesign', mode: 'training', teamConfiguration: 'intact_work_teams' }, { token: no.token });
  assert.equal(r.status, 401);
  assert.equal((await req(store, '/sessions', 'POST', { title: 'x', scenarioId: 'training-redesign', mode: 'training', teamConfiguration: 'intact_work_teams' })).status, 401);
  assert.equal((await req(store, '/catalog')).value.domains.length, 7);
  assert.ok(token);
});

test('lifecycle, role isolation, scoring, revisions and export, like the local suite', async () => {
  const { store, token, other } = await setup();
  const F = { token };
  const catalog = await req(store, '/catalog');
  assert.equal(catalog.value.scenarios[0].opportunities.length, 14);
  const created = await req(store, '/sessions', 'POST', { title: 'בדיקת תרגול', scenarioId: catalog.value.scenarios[0].id, teamConfiguration: 'constructed_role_units', accessFactor: 1.5, mode: 'pilot' }, F);
  assert.equal(created.status, 201);
  const { session } = created.value;
  assert.match(session.joinCode, /^\d{6}$/);
  assert.equal('_auth' in session, false);
  assert.equal('owner' in session, false);
  const endpoint = `/sessions/${session.id}`;
  assert.equal((await req(store, endpoint)).status, 401);
  assert.equal((await req(store, endpoint, 'GET', undefined, { token: other })).status, 401, 'another code is not the facilitator');
  const mine = await req(store, '/mine', 'GET', undefined, F);
  assert.equal(mine.value.sessions.length, 1);
  assert.equal((await req(store, '/mine', 'GET', undefined, { token: other })).value.sessions.length, 0);
  assert.equal((await req(store, '/join', 'POST', { code: '000000', coderId: 'OBS-01' })).status, 404);
  const joined = await req(store, '/join', 'POST', { code: session.joinCode, coderId: 'OBS-01' });
  const joined2 = await req(store, '/join', 'POST', { code: session.joinCode, coderId: 'OBS-02' });
  assert.equal(joined.status, 200);
  assert.equal((await req(store, '/join', 'POST', { code: session.joinCode, coderId: 'OBS-01' })).status, 409);
  assert.equal('joinCode' in joined.value.session, false);
  const O = { key: joined.value.observerToken };
  assert.equal((await req(store, endpoint + '/transition', 'POST', { status: 'running' }, O)).status, 403);
  assert.equal((await req(store, endpoint + '/deliver', 'POST', { opportunityId: 'EXP-1' }, F)).status, 409);
  assert.equal((await req(store, endpoint + '/transition', 'POST', { status: 'running' }, F)).status, 200);
  const obs = { opportunityId: 'EXP-1', deliveryStatus: 'DEL', observationStatus: 'OBS', score: 2, evidence: 'נמסר מקרה ונבדקה התאמה בידי צוות שני', evidenceStartSec: 1, evidenceEndSec: 10, lateResponse: false };
  assert.equal((await req(store, endpoint + '/observations', 'PUT', obs, O)).status, 409);
  for (const opportunityId of ['EXP-1', 'EXP-2', 'EMP-1']) assert.equal((await req(store, endpoint + '/deliver', 'POST', { opportunityId }, F)).status, 200);
  assert.equal((await req(store, endpoint + '/deliver', 'POST', { opportunityId: 'EXP-1' }, F)).status, 409);
  assert.equal((await req(store, endpoint + '/observations', 'PUT', obs, O)).status, 200);
  const partial = await req(store, endpoint + '/observations', 'PUT', { ...obs, opportunityId: 'EXP-2', lateResponse: true }, O);
  assert.equal(partial.value.record.score, 1);
  assert.equal(partial.value.session.profiles[0].domains[0].score, 75);
  const revised = await req(store, endpoint + '/observations', 'PUT', { ...obs, score: 0, evidence: 'תיקון: לא נבדקה התאמה' }, O);
  assert.equal(revised.value.record.revision, 2);
  assert.equal(revised.value.session.observations[0].score, 2);
  assert.equal(revised.value.session.profiles[0].domains[0].score, 25);
  assert.equal((await req(store, endpoint + '/observations', 'PUT', { ...obs, opportunityId: 'EMP-1' }, O)).status, 400);
  const ethical = await req(store, endpoint + '/observations', 'PUT', { ...obs, opportunityId: 'EMP-1', observationStatus: 'EO', score: null }, O);
  assert.equal(ethical.value.record.score, null);
  const secondView = await req(store, endpoint, 'GET', undefined, { key: joined2.value.observerToken });
  assert.equal(secondView.value.observations.length, 0);
  const paused = await req(store, endpoint + '/transition', 'POST', { status: 'paused' }, F);
  const elapsed = paused.value.session.clock.elapsedMs;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal((await req(store, endpoint, 'GET', undefined, F)).value.clock.elapsedMs, elapsed);
  await req(store, endpoint + '/transition', 'POST', { status: 'debrief' }, F);
  assert.equal((await req(store, endpoint + '/feedback', 'POST', { strength: 'שיתוף מידע', evidence: 'חלון EXP-1', nextStep: 'בדיקת הבנה בכל העברה', owner: 'T', dueDate: '2026-11-12' }, F)).status, 200);
  assert.equal((await req(store, endpoint + '/pilot', 'POST', { timepoint: 'T0', completed: true, note: 'הרצת הכנה בלבד' }, F)).status, 200);
  const exported = await req(store, endpoint + '/export', 'GET', undefined, F);
  assert.equal(exported.value.session.observations.length, 4);
  assert.equal('joinCode' in exported.value.session, false);
  assert.equal(JSON.stringify(exported.value).includes('tokenHash'), false);
  assert.equal((await req(store, endpoint + '/export', 'GET', undefined, O)).status, 403);
  assert.equal((await req(store, endpoint, 'GET', undefined, O)).value.feedback.length, 0);
  await req(store, endpoint + '/transition', 'POST', { status: 'closed' }, F);
  assert.equal((await req(store, endpoint + '/observations', 'PUT', obs, O)).status, 409);
  assert.equal((await req(store, '/join', 'POST', { code: session.joinCode, coderId: 'OBS-09' })).status, 404, 'a closed session releases its code');
  const stored = JSON.stringify([...store.data.values()]);
  assert.equal(stored.includes(joined.value.observerToken), false);
  // a revoked code stops being the facilitator at once
  store.data.get('code:TEST1234').revoked = true;
  assert.equal((await req(store, endpoint, 'GET', undefined, F)).status, 401);
});

test('the facilitator can delete a session, and an observer cannot', async () => {
  const { store, token } = await setup();
  const { value } = await req(store, '/sessions', 'POST', { title: 'מחיקה', scenarioId: 'training-continuity', mode: 'training', teamConfiguration: 'intact_work_teams' }, { token });
  const id = value.session.id;
  const j = await req(store, '/join', 'POST', { code: value.session.joinCode, coderId: 'OBS-01' });
  assert.equal((await req(store, `/sessions/${id}`, 'DELETE', undefined, { key: j.value.observerToken })).status, 403);
  assert.equal((await req(store, `/sessions/${id}`, 'DELETE', undefined, { token })).status, 200);
  assert.equal(store.data.has('ors:' + id), false);
  assert.equal(store.data.has('orj:' + value.session.joinCode), false);
});
