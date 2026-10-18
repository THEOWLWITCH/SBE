import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const communication = require('../../app/lib/communication-core.js');

test('visible principle groups preserve all eighteen existing engine principles and their order', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(communication.PRINCIPLES)).digest('hex'), '922bffd8b77727eeb51bf72a20cd3397a2a5530e068590736798336db9191e8e');
  const groups = communication.PRINCIPLE_GROUPS;
  assert.equal(groups.length, 2);
  assert.equal(groups[0].title, 'עשרת עקרונות התקשורת');
  assert.equal(groups[1].title, 'שמונה עקרונות לתקשורת מקדמת חוסן');
  assert.deepEqual(groups.map(group => group.items.length), [10, 8]);
  assert.deepEqual(groups.flatMap(group => group.items.map(item => item.number)), Array.from({ length: 18 }, (_, index) => index + 1));
  assert.equal(groups[1].items[0].title, 'מרחב השפעה ואחריות');
  assert.equal(groups[1].items[7].title, 'למידה, מיומנויות משותפות ושיפור מתמשך');
  assert.ok(groups.every(group => group.items.every(item => item.explanation.trim())));
});

test('research role defaults never grant identities, contacts, document content, exports or collaborator management', () => {
  const research = require('../../app/lib/research-core.js');
  assert.equal(Object.keys(research.PERMISSIONS).length, 22);
  assert.deepEqual(research.ROLE_PRESETS.researcher, ['view_study', 'view_approved_findings']);
  for (const role of ['pi', 'researcher', 'assistant']) {
    const preset = research.ROLE_PRESETS[role];
    assert.ok(preset.includes('view_study'));
    for (const sensitive of ['view_identifiable_data', 'contact_participants', 'view_document_content', 'export_data', 'manage_researchers']) assert.equal(preset.includes(sensitive), false, role + ': ' + sensitive);
  }
  assert.equal(research.hasPermission({ permissions: ['view_study'] }, 'export_data'), false);
  assert.equal(research.hasPermission({ permissions: ['export_data'] }, 'view_document_content'), false);
  assert.equal(research.hasPermission(null, 'view_study'), false);
});

test('research declares versioned draft instruments without a validated combined score or ordinary-user enrollment', () => {
  const research = require('../../app/lib/research-core.js');
  assert.equal(research.VERSIONS.application, '1.2.0');
  assert.equal(research.VERSIONS.schema, 1);
  assert.deepEqual(Object.keys(research.STUDY_STATUSES), ['draft', 'pending_approval', 'active', 'paused', 'completed', 'archived']);
  for (const id of ['PLSE', 'WIFP']) assert.equal(research.CONSTRUCTS.find(item => item.id === id).status, 'under-development');
  assert.equal('combinedScore' in research, false);
  assert.ok(research.INTERNAL_ACTIONS.includes('recordUsage'));
  assert.ok(research.INTERNAL_ACTIONS.includes('mailClaim'));
  assert.equal(research.CLIENT_ACTIONS.includes('recordUsage'), false);
  assert.equal(research.CLIENT_ACTIONS.includes('mailClaim'), false);
  assert.ok(Object.isFrozen(research.PERMISSIONS));
  assert.ok(Object.isFrozen(research.ROLE_PRESETS.pi));
});
