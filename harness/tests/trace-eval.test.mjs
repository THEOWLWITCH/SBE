import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runEvaluation, redactTrace } from '../run.mjs';

const dataset = JSON.parse(readFileSync(new URL('../fixtures/agent-evaluation-cases.json', import.meta.url), 'utf8'));

test('20 synthetic cases use the application contract while preserving their acceptance outcomes', () => {
  assert.equal(dataset.applicationSchemaFinalized, true);
  assert.equal(dataset.applicationSchema, 'begood-studio/1.0');
  assert.deepEqual(dataset.cases.map(c => c.id), Array.from({length:20}, (_, i) => 'E' + String(i + 1).padStart(2, '0')));
  assert.equal(new Set(dataset.principals.map(p => p.institutionId)).size, 3);
  for (const c of dataset.cases) {
    assert.equal(typeof c.request.action, 'string', c.id);
    assert.equal(typeof c.request.brief, 'object', c.id);
    assert.ok(c.expectedSafetyOutcome.length, c.id);
    assert.ok(c.humanChecks.length, c.id);
  }
});

test('fixture comparison has stable provenance and never treats schema success as a human quality score', async () => {
  const first = await runEvaluation(dataset);
  const second = await runEvaluation(dataset);
  assert.equal(first.datasetHash, second.datasetHash);
  assert.equal(first.schemaVersion, second.schemaVersion);
  assert.equal(first.sourceVersion, second.sourceVersion);
  assert.equal(first.results.length, 20);
  assert.deepEqual(first.results.map(r => r.responseHash), second.results.map(r => r.responseHash));
  assert.equal(first.modelCalls, 0);
  assert.equal(first.humanQuality.status, 'not_measured');
  assert.equal(first.humanQuality.scoredArtifacts, 0);
  assert.equal(first.comparison.team.status, 'not_exercised');
  assert.ok(first.results.every(r => r.humanQuality === 'pending'));
  assert.ok(first.results.some(r => r.unexercisedChecks.length));
  assert.equal(first.summary.unexpectedContractOutcomes, 0);
});

test('trace uses an explicit allowlist and opaque identity links, including nested gate errors and free text', () => {
  const privateText = 'Private Person 0501234567 personal concern';
  const input = {runId:privateText,jobId:privateText,artifactId:privateText,artifactVersion:2,agent:'single',model:'synthetic-no-model',
    stage:'generate',outcome:'rejected',ms:8,usage:{inputTokens:10,outputTokens:5,secret:privateText},
    promptVersion:privateText,schemaVersion:privateText,sourceVersion:privateText,
    privateConcern:privateText,body:{name:privateText},error:privateText,
    gates:[{id:'schema',pass:false,kind:'exact',detail:privateText,name:privateText},{id:privateText,pass:false}]};
  const trace = redactTrace(input);
  assert.ok(!JSON.stringify(trace).includes('Private Person'));
  assert.ok(!JSON.stringify(trace).includes('0501234567'));
  assert.equal(trace.artifactVersion, 2);
  assert.match(trace.artifactId, /^sha256:/);
  assert.deepEqual(trace.usage, {inputTokens:10,outputTokens:5});
  assert.equal(trace.gates[0].pass, false);
  assert.equal(trace.agent, 'single');
  assert.equal(trace.outcome, 'rejected');
});
