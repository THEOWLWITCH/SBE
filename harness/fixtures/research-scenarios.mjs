// Synthetic identities/providers only; this fixture does not prove PostgreSQL rights.
import { createHash, createHmac, randomUUID } from 'node:crypto';

export const IDS = Object.freeze({ studyA: '11111111-1111-4111-8111-111111111111', studyB: '22222222-2222-4222-8222-222222222222', participant: '33333333-3333-4333-8333-333333333333', instrument: '44444444-4444-4444-8444-444444444444', consent: '55555555-5555-4555-8555-555555555555', sample: '66666666-6666-4666-8666-666666666666', message: '77777777-7777-4777-8777-777777777777' });
export const CONTACT_KEY = Buffer.alloc(32, 7).toString('base64');
export const EMAIL = 'educator@example.invalid';
export const requestId = () => randomUUID();

export function accessFixture() {
  const rows = new Map([
    ['token-secret', { secret: 'synthetic-research-test-secret-only' }],
    ['pw-sys', {salt:'synthetic-research-owner-salt',hash:'synthetic-research-owner-hash'}],
    ['institutions', [{ name: 'Synthetic Institution', active: true }]],
    ['code:RESEARCHA', { kind: 'staff', inst: 'Synthetic Institution', revoked: false, perms: [] }],
    ['code:RESEARCHB', { kind: 'staff', inst: 'Synthetic Institution', revoked: false, perms: [] }],
    ['code:PARTICIPANT', { kind: 'staff', inst: 'Synthetic Institution', revoked: false, perms: ['writer'] }],
    ['code:ORDINARY', { kind: 'staff', inst: 'Synthetic Institution', revoked: false, perms: ['writer'] }]
  ]);
  const store = { get: async key => rows.get(key) ?? null, set: async (key, value) => rows.set(key, value), rows };
  function token(payload = {}) {
    const encoded = Buffer.from(JSON.stringify({ k: 'code', c: 'PARTICIPANT', kind: 'staff', inst: 'Synthetic Institution', exp: Date.now() + 3600000, ...payload })).toString('base64url');
    return encoded + '.' + createHmac('sha256', rows.get('token-secret').secret).update(encoded).digest('base64url');
  }
  return { store, token, owner: token({ k: 'sys', authVersion: createHash('sha256').update(rows.get('pw-sys').salt+':'+rows.get('pw-sys').hash).digest('hex') }), a: token({ c: 'RESEARCHA' }), b: token({ c: 'RESEARCHB' }), participant: token(), ordinary: token({ c: 'ORDINARY' }) };
}

export function rpcFixture(resolver = () => ({})) {
  const calls = [];
  return { calls, async rpc(token, action, payload) { calls.push({ token, action, payload }); return resolver(action, payload, token); } };
}

export const consentDefinition = () => ({ title: 'Synthetic consent', text: 'Synthetic disclosure only', categories: ['surveys', 'usage', 'historical', 'generated'], contactKinds: ['followup', 'feedback', 'update'], retentionDays: 90, withdrawalPolicy: 'erase', expectations: 'Optional synthetic research activities' });
export const instrumentDefinition = () => ({ title: 'Synthetic instrument', construct: 'PLSE', validationStatus: 'under-development', description: 'Illustrative test items, not a validated scale', items: [
  { id: 'confidence', type: 'likert', label: 'Synthetic numeric response', required: true, min: 1, max: 5 },
  { id: 'reflection', type: 'text', label: 'Synthetic reflection', required: false },
  { id: 'choice', type: 'choice', label: 'Synthetic choice', required: false, options: ['A', 'B'] },
  { id: 'multiple', type: 'multiple', label: 'Synthetic multiple', required: false, options: ['A', 'B'] },
  { id: 'date', type: 'date', label: 'Synthetic date', required: false },
  { id: 'number', type: 'number', label: 'Synthetic number', required: false, min: 0, max: 12 }
] });

export function participantResult() {
  return { participation: { id: IDS.participant, studyId: IDS.studyA, status: 'enrolled', verified: true, consentVersionId: IDS.consent, consents: { participate: true, surveys: true, usage: true, historical: true, generated: true }, preferences: { followup: true, feedback: false, update: false } }, study: { id: IDS.studyA, title: 'Synthetic Study A', status: 'active', config: { consentVersionId: IDS.consent, dataCategories: ['surveys', 'usage', 'historical', 'generated'], schedule: [{ waveId: 'baseline', instrumentVersionId: IDS.instrument, offsetDays: 0, reminderDays: [] }] } }, consent: { id: IDS.consent, definition: consentDefinition() }, instruments: [{ id: IDS.instrument, published: true, definition: instrumentDefinition() }], responses: [] };
}
