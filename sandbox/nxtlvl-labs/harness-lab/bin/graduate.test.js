'use strict';
/**
 * Regression lock for the graduation gate (graduate.js). Run: node --test bin/graduate.test.js
 *
 * Same discipline that locked the dangerous-bash gate: for EACH of the three objective criteria,
 * prove it BLOCKS a bad cell and PASSES a clean one (3 pairs), prove taste only WARNS, and prove a
 * crash FAILS OPEN (exit 0, never a fake block). Fixtures live in __fixtures__/grad/ and each bad
 * cell breaks exactly ONE criterion, so isolation is checkable.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const grad = require('./graduate.js');

const GRAD = path.join(__dirname, '__fixtures__', 'grad');

function evalCell(name) {
  return grad.evaluateCell(path.join(GRAD, name));
}
// criterion tag of each blocker, e.g. "[integrity] ..." -> "integrity"
function criteria(blockers) {
  return blockers.map((b) => (b.match(/^\[([a-z-]+)\]/) || [])[1]);
}
function hasCriterion(blockers, c) {
  return criteria(blockers).includes(c);
}

// --- pass-clean: a sound cell passes all three criteria, exit 0 -----------

test('clean cell: zero blockers, exit 0, no warnings', () => {
  const { blockers, warnings } = evalCell('clean');
  assert.deepStrictEqual(blockers, [], `unexpected blockers: ${JSON.stringify(blockers)}`);
  assert.deepStrictEqual(warnings, []);
  assert.strictEqual(grad.run(path.join(GRAD, 'clean')).code, 0);
});

// --- pair 1: Integrity ----------------------------------------------------

test('Integrity: a committed secret BLOCKS (exit 2), and clean passes integrity', () => {
  const bad = evalCell('bad-integrity');
  assert.ok(hasCriterion(bad.blockers, 'integrity'), `expected integrity blocker, got ${JSON.stringify(bad.blockers)}`);
  // isolation: it does NOT also trip declared-evals or intake
  assert.ok(!hasCriterion(bad.blockers, 'declared-evals'));
  assert.ok(!hasCriterion(bad.blockers, 'intake'));
  assert.strictEqual(grad.run(path.join(GRAD, 'bad-integrity')).code, 2);
  // pair: clean passes the same criterion
  assert.ok(!hasCriterion(evalCell('clean').blockers, 'integrity'));
});

// --- pair 2: Declared evals ----------------------------------------------

test('Declared evals: a failing scorecard BLOCKS (exit 2), and clean passes evals', () => {
  const bad = evalCell('bad-evals');
  assert.ok(hasCriterion(bad.blockers, 'declared-evals'), `got ${JSON.stringify(bad.blockers)}`);
  assert.ok(!hasCriterion(bad.blockers, 'integrity'));
  assert.ok(!hasCriterion(bad.blockers, 'intake'));
  assert.strictEqual(grad.run(path.join(GRAD, 'bad-evals')).code, 2);
  assert.ok(!hasCriterion(evalCell('clean').blockers, 'declared-evals'));
});

test('Declared evals: a MISSING scorecard also blocks', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grad-noscore-'));
  try {
    fs.copyFileSync(path.join(GRAD, 'clean', 'manifest.yaml'), path.join(tmp, 'manifest.yaml'));
    fs.copyFileSync(path.join(GRAD, 'clean', 'SKILL.md'), path.join(tmp, 'SKILL.md'));
    // no scorecard.json copied
    const { blockers } = grad.evaluateCell(tmp);
    assert.ok(hasCriterion(blockers, 'declared-evals'));
    assert.ok(blockers.some((b) => /no scorecard/.test(b)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// --- pair 3: Intake present ----------------------------------------------

test('Intake: an empty intake BLOCKS (exit 2), and clean passes intake', () => {
  const bad = evalCell('bad-intake');
  assert.ok(hasCriterion(bad.blockers, 'intake'), `got ${JSON.stringify(bad.blockers)}`);
  assert.ok(!hasCriterion(bad.blockers, 'integrity'));
  assert.ok(!hasCriterion(bad.blockers, 'declared-evals'));
  assert.strictEqual(grad.run(path.join(GRAD, 'bad-intake')).code, 2);
  assert.ok(!hasCriterion(evalCell('clean').blockers, 'intake'));
});

// --- taste only warns -----------------------------------------------------

test('taste-only: a TODO warns but does NOT block (exit 0)', () => {
  const { blockers, warnings } = evalCell('taste-only');
  assert.deepStrictEqual(blockers, [], `taste must not block: ${JSON.stringify(blockers)}`);
  assert.ok(warnings.length >= 1, 'expected at least one taste warning');
  assert.ok(warnings.some((w) => /TODO/.test(w)));
  assert.strictEqual(grad.run(path.join(GRAD, 'taste-only')).code, 0);
});

// --- crash fails open -----------------------------------------------------

test('crash fails OPEN: an exception in the decision core -> exit 0, never 2', () => {
  const result = grad.run(path.join(GRAD, 'clean'), {
    evaluate: () => { throw new Error('boom'); },
  });
  assert.strictEqual(result.code, 0);
  assert.strictEqual(result.failedOpen, true);
});

test('a missing manifest is an integrity block, not a crash', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grad-nomanifest-'));
  try {
    const result = grad.run(tmp);
    assert.strictEqual(result.code, 2);
    assert.ok(result.blockers.some((b) => /no manifest\.yaml/.test(b)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// --- hook smoke test (a real spawn path) ----------------------------------

function writeHookCell(dir, exitCode) {
  fs.writeFileSync(path.join(dir, 'manifest.yaml'), [
    'name: hooky',
    'type: hook',
    'stage: graduation-ready',
    'intent: A hook fixture exercising the smoke-test integrity path.',
    'intake:',
    '  task: needed a hook smoke fixture',
    '  failed: no fixture exercised spawnSync',
    'graduation_criteria:',
    '  - id: behavioral',
    '    bar: all behavioral eval cases pass',
    'deps: []',
    'target: plugins/nxtlvl/hooks/hooky',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'hooks.json'), JSON.stringify({ hooks: { PreToolUse: [] } }, null, 2));
  fs.writeFileSync(path.join(dir, 'hooky.js'), `process.exit(${exitCode});\n`);
  fs.writeFileSync(path.join(dir, 'scorecard.json'), JSON.stringify({
    cell: 'hooky', engine: 'stub',
    results: [{ id: 'behavioral', passed: true, score: 1, detail: 'ok' }],
    summary: { total: 1, passed: 1, failed: 0, allPassed: true },
  }, null, 2));
}

test('hook that exits 0 on smoke test passes integrity', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grad-hook-ok-'));
  try {
    writeHookCell(tmp, 0);
    const { blockers } = grad.evaluateCell(tmp);
    assert.deepStrictEqual(blockers, [], `unexpected: ${JSON.stringify(blockers)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('hook that exits non-zero on smoke test BLOCKS integrity', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grad-hook-bad-'));
  try {
    writeHookCell(tmp, 1);
    const { blockers } = grad.evaluateCell(tmp);
    assert.ok(hasCriterion(blockers, 'integrity'));
    assert.ok(blockers.some((b) => /exited 1 on smoke test/.test(b)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// --- doubt-review regression locks (F1, F2, F3) ---------------------------

test('F1: an unreadable .md does NOT crash the gate — the secret scan still catches a secret', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grad-unreadable-'));
  try {
    // a sound, passing cell ...
    fs.copyFileSync(path.join(GRAD, 'clean', 'manifest.yaml'), path.join(tmp, 'manifest.yaml'));
    fs.copyFileSync(path.join(GRAD, 'clean', 'scorecard.json'), path.join(tmp, 'scorecard.json'));
    // ... with a readable file carrying a secret ...
    fs.writeFileSync(path.join(tmp, 'SKILL.md'), '---\nname: clean-cell\ndescription: x\n---\nleak: AKIAIOSFODNN7EXAMPLE\n');
    // ... and an UNREADABLE .md that would crash a naive scanner before the secret scan ran.
    const unreadable = path.join(tmp, 'notes.md');
    fs.writeFileSync(unreadable, '# notes\n');
    fs.chmodSync(unreadable, 0o000);
    const { blockers, warnings } = grad.evaluateCell(tmp);
    void warnings;
    // The gate must NOT fail open and miss the secret.
    assert.strictEqual(grad.run(tmp).failedOpen, false);
    assert.ok(blockers.some((b) => /possible AWS access key/.test(b)), `secret not caught: ${JSON.stringify(blockers)}`);
  } finally {
    try { fs.chmodSync(path.join(tmp, 'notes.md'), 0o644); } catch (_e) { /* ignore */ }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('F2: an undeclared failing scorecard result does NOT block a cell whose declared criteria all pass', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grad-undeclared-'));
  try {
    fs.copyFileSync(path.join(GRAD, 'clean', 'manifest.yaml'), path.join(tmp, 'manifest.yaml')); // declares only 'behavioral'
    fs.copyFileSync(path.join(GRAD, 'clean', 'SKILL.md'), path.join(tmp, 'SKILL.md'));
    fs.writeFileSync(path.join(tmp, 'scorecard.json'), JSON.stringify({
      cell: 'clean-cell', engine: 'evals-lab@x',
      results: [
        { id: 'behavioral', passed: true, score: 1, detail: 'ok' },
        { id: 'general-battery-extra', passed: false, score: 0.2, detail: 'undeclared' },
      ],
      summary: { total: 2, passed: 1, failed: 1, allPassed: false },
    }, null, 2));
    const { blockers, warnings } = grad.evaluateCell(tmp);
    assert.ok(!hasCriterion(blockers, 'declared-evals'), `wrongly blocked: ${JSON.stringify(blockers)}`);
    assert.strictEqual(grad.run(tmp).code, 0);
    // the disagreement surfaces as a warning, not a blocker
    assert.ok(warnings.some((w) => /allPassed is not true/.test(w)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('F3: a hook that hangs past the smoke timeout BLOCKS integrity (does not fail open)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grad-hook-hang-'));
  const prev = process.env.NXTLVL_HOOK_SMOKE_TIMEOUT_MS;
  process.env.NXTLVL_HOOK_SMOKE_TIMEOUT_MS = '300';
  try {
    writeHookCell(tmp, 0);
    // overwrite the script with one that hangs well past the 300ms timeout
    fs.writeFileSync(path.join(tmp, 'hooky.js'), 'setTimeout(() => {}, 5000);\n');
    const result = grad.run(tmp);
    assert.strictEqual(result.failedOpen, false, 'timeout must not fail open');
    assert.strictEqual(result.code, 2);
    assert.ok(result.blockers.some((b) => /did not exit within 300ms/.test(b)));
  } finally {
    if (prev === undefined) delete process.env.NXTLVL_HOOK_SMOKE_TIMEOUT_MS;
    else process.env.NXTLVL_HOOK_SMOKE_TIMEOUT_MS = prev;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
