import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { runBaseline } from '../run.mjs';

const harness = fileURLToPath(new URL('..', import.meta.url));
function cli(args) {
  return spawnSync(process.execPath, ['--preserve-symlinks', '--preserve-symlinks-main', 'run.mjs', ...args], {
    cwd: harness, encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' },
  });
}

test('the documented gates entry point executes real valid and adversarial fixtures without a provider', () => {
  const result = cli(['--gates-only', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'gates-only');
  assert.ok(report.results.some(r => r.id === 'baseline-valid' && r.observed === 'passed'));
  for (const id of ['baseline-empty', 'baseline-missing-stage', 'baseline-unapproved-source', 'baseline-locked-field']) {
    const row = report.results.find(r => r.id === id);
    assert.ok(row, id);
    assert.equal(row.observed, 'rejected', id);
  }
  assert.equal(report.summary.unexpectedOutcomes, 0);
  assert.equal(report.modelCalls, 0);
});

test('unknown or live provider CLI options fail explicitly instead of silently running fixtures', () => {
  for (const args of [['--provider', 'openai'], ['--typo']]) {
    const result = cli(args);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Unsupported option/);
  }
});

test('the pipeline baseline is repeatable and exercises provider fixtures before final gates', async () => {
  const first = await runBaseline();
  const second = await runBaseline();
  assert.equal(first.summary.unexpectedOutcomes, 0);
  assert.deepEqual(first.results.map(r=>r.responseHash), second.results.map(r=>r.responseHash));
  assert.equal(first.results.find(r=>r.id==='baseline-valid').fixtureProviderCalls, 4);
  for (const row of first.results) assert.ok(row.fixtureProviderCalls > 0, row.id);
  assert.equal(first.humanQuality.status, 'not_measured');
});

test('a broken fixture/provider adapter is an unexpected error, not a successful schema rejection', async () => {
  const dataset = JSON.parse(readFileSync(new URL('../fixtures/baseline-cases.json', import.meta.url), 'utf8'));
  const row = dataset.cases[0];
  delete row.pipelineResponses.stage1;
  row.expected = 'rejected';
  const report = await runBaseline({...dataset,cases:[row]});
  assert.equal(report.results[0].observed, 'error');
  assert.equal(report.summary.unexpectedOutcomes, 1);
});
