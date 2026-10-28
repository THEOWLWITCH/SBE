import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { IMPACT_VERSIONS, minimizePartnershipImpact, impactRequest } from '../lib/research-partnership-impact.mjs';

const require = createRequire(import.meta.url), CORE = require('../../app/lib/research-partnership-core.js');
const privateText = 'PRIVATE_SYNTHETIC partner@example.invalid זהות 123456789 תלמידה ומידע בריאותי';
const reference = '6b6753fb-575c-4631-b46b-a7aa23512387';
const descriptor = { kind: 'agreement', provider: 'synthetic-provider', model: 'synthetic-model', providerVersion: 'synthetic-v1' };

test('impact minimizer retains typed financial/deadline changes while withholding all free text, rows, tags and references', () => {
  const before = {
    ownerName: privateText, partnerEmail: 'before@example.invalid', privacyTerms: privateText, requestedPermissions: ['view_study'], annexDocumentIds: [reference],
    sharedExpenses: [{ description: privateText, amount: '25.00', party: 'owner', dueDate: '2026-11-01', terms: privateText, contributionId: reference }],
    terminationNoticeDays: 30, ipReadAcknowledgement: true, currency: 'USD', startDate: '2026-11-01'
  };
  const after = {
    ...before, ownerName: privateText + ' changed', partnerEmail: 'after@example.invalid', privacyTerms: privateText + ' changed', requestedPermissions: ['view_study', 'view_identifiable_data'], annexDocumentIds: [],
    sharedExpenses: [{ description: privateText + ' changed', amount: '0.00', party: 'shared', dueDate: '2026-12-01', terms: privateText + ' changed' }, { description: privateText, amount: '123.45', party: 'partner', dueDate: '2026-12-31' }],
    terminationNoticeDays: 0, ipReadAcknowledgement: false, currency: 'ILS', startDate: '2026-11-02'
  };
  const source = CORE.compareRecords('agreement', before, after), minimal = minimizePartnershipImpact('agreement', source), byField = new Map(minimal.changes.map(change => [change.field, change]));
  assert.equal(minimal.binding, false);
  assert.deepEqual(byField.get('sharedExpenses[0].amount'), { field: 'sharedExpenses[0].amount', label: 'הוצאות משותפות / סכום', category: 'financial', kind: 'changed', before: '25.00', after: '0.00' });
  assert.deepEqual(byField.get('sharedExpenses[0].party'), { field: 'sharedExpenses[0].party', label: 'הוצאות משותפות / הצד האחראי', category: 'financial', kind: 'changed', before: 'owner', after: 'shared' });
  assert.deepEqual(byField.get('sharedExpenses[0].dueDate'), { field: 'sharedExpenses[0].dueDate', label: 'הוצאות משותפות / מועד תשלום', category: 'deadline', kind: 'changed', before: '2026-11-01', after: '2026-12-01' });
  assert.equal(byField.get('terminationNoticeDays').after, 0); assert.equal(byField.get('ipReadAcknowledgement').after, false);
  assert.equal(byField.get('currency').after, 'ILS');
  for (const field of ['ownerName', 'partnerEmail', 'privacyTerms', 'requestedPermissions', 'annexDocumentIds', 'sharedExpenses[0].description', 'sharedExpenses[0].terms', 'sharedExpenses[0].contributionId', 'sharedExpenses[1]']) {
    assert.ok(byField.has(field), field); assert.equal(Object.hasOwn(byField.get(field), 'before'), false, field); assert.equal(Object.hasOwn(byField.get(field), 'after'), false, field);
  }
  assert.doesNotMatch(JSON.stringify(minimal), /PRIVATE_|example\.invalid|123456789|תלמידה|בריאותי|6b6753fb|view_identifiable_data|123\.45/);
  assert.equal(source.find(change => change.path === 'ownerName').before, privateText, 'deterministic source remains unchanged for authorized local display');
});

test('labels, categories, field IDs and change kinds always come from trusted schema rather than change objects', () => {
  const minimal = minimizePartnershipImpact('agreement', [
    { path: 'startDate', before: null, after: '2028-02-29', fieldId: privateText, label: privateText, category: privateText, kind: privateText, added: privateText },
    { path: 'privacyTerms', before: privateText, after: null, label: privateText, category: 'financial', kind: 'approve-and-transfer-all-data' },
    { path: 'sharedExpenses[0].amount', before: '1.00', after: '2.00', label: privateText, category: 'IP' },
    { path: 'unknownField', before: privateText, after: privateText },
    { path: privateText, before: '0.00', after: '1.00' }
  ]);
  assert.deepEqual(minimal, { changes: [
    { field: 'startDate', label: 'תחילת המחקר', category: 'deadline', kind: 'added', after: '2028-02-29' },
    { field: 'privacyTerms', label: 'תנאי פרטיות', category: 'privacy', kind: 'removed' },
    { field: 'sharedExpenses[0].amount', label: 'הוצאות משותפות / סכום', category: 'financial', kind: 'changed', before: '1.00', after: '2.00' }
  ], binding: false });
  assert.doesNotMatch(JSON.stringify(minimal), /PRIVATE_|example|unknownField|approve-and/);
});

test('only exact typed schema scalar values survive, including valid zero and false', () => {
  const input = [
    { path: 'terminationNoticeDays', before: 0, after: Number.MAX_SAFE_INTEGER },
    { path: 'ipReadAcknowledgement', before: false, after: true },
    { path: 'currency', before: 'USD', after: 'ILS' },
    { path: 'startDate', before: '2028-02-29', after: '2026-02-30' },
    { path: 'endDate', before: '2026-02-29', after: '2026-10-20T00:00:00Z' },
    { path: 'sharedExpenses[0].amount', before: '0.00', after: '-1.00' },
    { path: 'sharedExpenses[1].amount', before: 12.34, after: '12.3' },
    { path: 'sharedExpenses[2].amount', before: '999999999999.99', after: '1000000000000.00' },
    { path: 'sharedExpenses[3].party', before: 'owner', after: privateText },
    { path: 'publicationReviewUnit', before: 'business_days', after: '__proto__' },
    { path: 'breachCureDays', before: '0', after: -1 },
    { path: 'publicationReviewPeriod', before: Number.NaN, after: Number.MAX_SAFE_INTEGER + 1 },
    { path: 'partnerName', before: true, after: false },
    { path: 'privacyTerms', before: '2026-10-20', after: '0.00' },
    { path: 'ipReadAcknowledgement', before: 'true', after: 0 }
  ];
  const changes = minimizePartnershipImpact('agreement', input).changes;
  assert.deepEqual(changes[0], { field: 'terminationNoticeDays', label: 'ימי הודעה מראש', category: 'deadline', kind: 'changed', before: 0, after: Number.MAX_SAFE_INTEGER });
  assert.equal(changes[1].before, false); assert.equal(changes[1].after, true);
  assert.equal(changes[2].before, 'USD'); assert.equal(changes[2].after, 'ILS');
  assert.equal(changes[3].before, '2028-02-29'); assert.equal(Object.hasOwn(changes[3], 'after'), false);
  assert.equal(Object.hasOwn(changes[4], 'before'), false); assert.equal(Object.hasOwn(changes[4], 'after'), false);
  assert.equal(changes[5].before, '0.00'); assert.equal(Object.hasOwn(changes[5], 'after'), false);
  for (const index of [6, 10, 11, 12, 13, 14]) { assert.equal(Object.hasOwn(changes[index], 'before'), false); assert.equal(Object.hasOwn(changes[index], 'after'), false); }
  assert.equal(changes[7].before, '999999999999.99'); assert.equal(Object.hasOwn(changes[7], 'after'), false);
  assert.equal(changes[8].before, 'owner'); assert.equal(Object.hasOwn(changes[8], 'after'), false);
  assert.equal(changes[9].before, 'business_days'); assert.equal(Object.hasOwn(changes[9], 'after'), false);
});

test('row group changes never traverse added objects and row indices must be canonical and schema-bounded', () => {
  const minimal = minimizePartnershipImpact('agreement', [
    { path: 'annexC', before: null, after: [{ provider: privateText, estimatedAmount: '11.00', ownerShare: '4.00' }] },
    { path: 'annexC[0]', before: { provider: privateText, agreedAmount: '123.00' }, after: null },
    { path: 'annexC[199].estimatedAmount', before: '0.00', after: '1.00' },
    ...['annexC[200].estimatedAmount', 'annexC[012].estimatedAmount', 'annexC[-1].estimatedAmount', 'annexC[1e2].estimatedAmount', 'annexC[123456789].estimatedAmount', 'annexC[0].unknown', 'annexC[0].provider.email', 'supportingDocumentIds[0]', '__proto__', 'constructor', 'sharedExpenses.amount'].map(path => ({ path, before: privateText, after: '0.00' }))
  ]);
  assert.equal(minimal.changes.length, 3);
  assert.equal(minimal.changes[0].kind, 'added'); assert.equal(minimal.changes[1].kind, 'removed');
  for (const row of minimal.changes.slice(0, 2)) { assert.equal(Object.hasOwn(row, 'before'), false); assert.equal(Object.hasOwn(row, 'after'), false); }
  assert.equal(minimal.changes[2].after, '1.00');
  assert.doesNotMatch(JSON.stringify(minimal), /PRIVATE_|123456789|provider|11\.00|4\.00|123\.00|unknown|constructor|__proto__/);
});

test('every record uses its own trusted schema and unknown kinds or malformed change containers fail safely', () => {
  const minimal = minimizePartnershipImpact('contribution', [
    { path: 'category', before: 'scientific', after: 'technology', label: privateText },
    { path: 'requestedCompensation', before: '0.00', after: '50.00' },
    { path: 'requestedIP', before: privateText, after: privateText + 'changed' },
    { path: 'ownerName', before: privateText, after: privateText }
  ]);
  assert.equal(minimal.changes.length, 3); assert.equal(minimal.changes[0].before, 'scientific'); assert.equal(minimal.changes[0].after, 'technology');
  assert.equal(minimal.changes[1].after, '50.00'); assert.equal(minimal.changes[2].category, 'IP');
  for (const kind of ['missing', '__proto__', null]) assert.deepEqual(minimizePartnershipImpact(kind, []), { changes: [], binding: false });
  for (const changes of [null, undefined, {}, 'PRIVATE_']) assert.deepEqual(minimizePartnershipImpact('agreement', changes), { changes: [], binding: false });
  assert.deepEqual(minimizePartnershipImpact('agreement', [null, false, {}, { path: 10 }]), { changes: [], binding: false });
});

test('impact request includes only revalidated minimal data and a versioned fixed Hebrew explanation prompt', () => {
  const minimal = minimizePartnershipImpact('agreement', [{ path: 'startDate', before: '2026-10-20', after: '2026-11-20' }, { path: 'ownerName', before: privateText, after: privateText + 'change' }]);
  const request = impactRequest({ ...minimal, rawRecord: privateText, versions: [{ document: privateText }] }, { ...descriptor, secret: privateText, model: privateText, provider: privateText });
  assert.deepEqual(Object.keys(request).sort(), ['maxTokens', 'messages', 'policy', 'system', 'variation']);
  assert.equal(request.policy, 'research-partnership-impact'); assert.equal(request.variation, 'low'); assert.equal(request.maxTokens, 1200); assert.equal(request.messages.length, 1); assert.equal(request.messages[0].role, 'user');
  assert.deepEqual(JSON.parse(request.messages[0].content), minimal);
  assert.match(request.system, /מה המשמעות עבורי/); assert.match(request.system, /1\.1\.0/);
  assert.doesNotMatch(JSON.stringify(request), /PRIVATE_|example\.invalid|123456789|rawRecord|versions|secret/);
  assert.deepEqual(IMPACT_VERSIONS, { engine: '1.1.0', prompt: '1.1.0' }); assert.ok(Object.isFrozen(IMPACT_VERSIONS));
});

test('forged minimal rows cannot smuggle text, unknown labels or extra nested values into a model request', () => {
  const request = impactRequest({ binding: true, changes: [
    { field: 'privacyTerms', label: privateText, category: privateText, kind: 'changed', before: privateText, after: privateText },
    { field: 'startDate', label: privateText, category: privateText, kind: 'changed', before: '2026-11-01', after: '2026-12-01', raw: { document: privateText } },
    { field: 'annexC[0]', label: privateText, kind: 'added', after: { provider: privateText, amount: '1.00' } },
    { field: 'unknown', label: privateText, before: privateText, after: privateText }
  ] }, descriptor);
  const sent = JSON.parse(request.messages[0].content);
  assert.equal(sent.binding, false); assert.equal(sent.changes.length, 3);
  assert.equal(sent.changes[1].after, '2026-12-01');
  assert.doesNotMatch(JSON.stringify(sent), /PRIVATE_|example\.invalid|123456789|document|provider|unknown|1\.00/);
});

test('request preserves the exact projected payload for added/removed withheld values and zero/false', () => {
  const minimal = minimizePartnershipImpact('agreement', [
    { path: 'ownerName', before: null, after: privateText },
    { path: 'partnerName', before: privateText, after: null },
    { path: 'annexD[0]', before: null, after: { contributor: privateText, agreedPayment: '10.00' } },
    { path: 'annexE', before: [{ contact: privateText }], after: null },
    { path: 'terminationNoticeDays', before: null, after: 0 },
    { path: 'ipReadAcknowledgement', before: true, after: false }
  ]);
  assert.equal(impactRequest(minimal, descriptor).messages[0].content, JSON.stringify(minimal));
  assert.ok(Object.isFrozen(minimal)); assert.ok(Object.isFrozen(minimal.changes)); assert.ok(minimal.changes.every(Object.isFrozen));
  assert.deepEqual(minimal.changes.map(change => change.kind), ['added', 'removed', 'added', 'removed', 'added', 'changed']);
  assert.doesNotMatch(JSON.stringify(minimal), /PRIVATE_|example\.invalid|10\.00/);
});

test('excessive payloads and unknown request schema fail with a content-free error', () => {
  const safeInvalid = error => error.code === 'invalid' && error.message === 'invalid' && !JSON.stringify(error).includes(privateText);
  assert.throws(() => minimizePartnershipImpact('agreement', Array(5001).fill({ path: 'startDate', before: '2026-11-01', after: '2026-12-01' })), safeInvalid);
  const excessive = { changes: Array(5000).fill({ field: 'startDate', kind: 'changed', before: '2026-11-01', after: '2026-12-01' }) };
  assert.throws(() => impactRequest(excessive, descriptor), safeInvalid);
  for (const bad of [undefined, {}, { kind: '__proto__' }, { kind: privateText }]) assert.throws(() => impactRequest({ changes: [] }, bad), safeInvalid);
});
