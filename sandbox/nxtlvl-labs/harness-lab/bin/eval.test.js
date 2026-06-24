'use strict';
/**
 * Tests for the evals-lab seam stub (eval.js). Run: node --test bin/eval.test.js
 *
 * Asserts the scorecard conforms to docs/seam-contract.md, is deterministic, and that a missing
 * eval case scores as a failure (never a silent pass).
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { score } = require('./eval.js');

function spec(overrides = {}) {
  return {
    cell: 'demo',
    criteria: [
      { id: 'trigger-accuracy', bar: '>= 0.9' },
      { id: 'behavioral', bar: 'all pass' },
    ],
    cases: {
      'trigger-accuracy': { stub_result: 'pass', score: 0.95, detail: '12/12 matched' },
      behavioral: { stub_result: 'pass', score: 1.0, detail: 'all cases passed' },
    },
    ...overrides,
  };
}

function assertScorecardShape(sc) {
  assert.strictEqual(typeof sc.cell, 'string');
  assert.strictEqual(typeof sc.engine, 'string');
  assert.ok(Array.isArray(sc.results));
  for (const r of sc.results) {
    assert.strictEqual(typeof r.id, 'string');
    assert.strictEqual(typeof r.passed, 'boolean');
    assert.ok(r.score === null || typeof r.score === 'number');
    assert.strictEqual(typeof r.detail, 'string');
  }
  assert.ok(sc.summary && typeof sc.summary === 'object');
  for (const k of ['total', 'passed', 'failed']) assert.strictEqual(typeof sc.summary[k], 'number');
  assert.strictEqual(typeof sc.summary.allPassed, 'boolean');
}

test('all criteria pass -> scorecard conforms, allPassed true', () => {
  const sc = score(spec());
  assertScorecardShape(sc);
  assert.strictEqual(sc.summary.total, 2);
  assert.strictEqual(sc.summary.passed, 2);
  assert.strictEqual(sc.summary.allPassed, true);
});

test('one criterion declares fail -> allPassed false', () => {
  const sc = score(spec({
    cases: {
      'trigger-accuracy': { stub_result: 'fail', score: 0.4, detail: 'only 4/10' },
      behavioral: { stub_result: 'pass' },
    },
  }));
  assert.strictEqual(sc.summary.allPassed, false);
  assert.strictEqual(sc.summary.failed, 1);
  assert.strictEqual(sc.results.find((r) => r.id === 'trigger-accuracy').passed, false);
});

test('a criterion with no eval case scores as failure (never silent pass)', () => {
  const sc = score(spec({ cases: { behavioral: { stub_result: 'pass' } } }));
  const ta = sc.results.find((r) => r.id === 'trigger-accuracy');
  assert.strictEqual(ta.passed, false);
  assert.strictEqual(ta.detail, 'no eval case declared');
  assert.strictEqual(sc.summary.allPassed, false);
});

test('results cover every declared criterion in declaration order', () => {
  const sc = score(spec());
  assert.deepStrictEqual(sc.results.map((r) => r.id), ['trigger-accuracy', 'behavioral']);
});

test('no criteria -> allPassed false (an empty bar is not a pass)', () => {
  const sc = score(spec({ criteria: [], cases: {} }));
  assert.strictEqual(sc.summary.total, 0);
  assert.strictEqual(sc.summary.allPassed, false);
});

test('score() is deterministic — same spec, byte-identical scorecard', () => {
  const a = JSON.stringify(score(spec()));
  const b = JSON.stringify(score(spec()));
  assert.strictEqual(a, b);
  // and stable: no timestamp / nondeterministic field leaked in
  assert.ok(!a.includes('generated_at') && !/\d{4}-\d{2}-\d{2}T/.test(a));
});
