// evolve tests — verification = `node --test "plugins/nxtlvl/lib/evolve.test.js"` green.
// Acceptance criteria (C&M Phase 5, Task 5.4a):
//  - deterministic: two calls same args → deepStrictEqual
//  - skill: ≥2 strong same-trigger → type:"skill"
//  - agent: ≥3 strong same-trigger (avg eff ≥0.75) → type:"agent", NOT also a skill
//  - command: singleton strong domain:"workflow" → type:"command"
//  - strong bar honored: eff confidence < 0.8 excluded from clustering
//  - normalization: "when writing tests" and "tests" land in same cluster
//  - non-candidate: singleton non-workflow strong instinct → no candidate emitted
//  - total order: agents→skills→commands, then size, conf, triggerKey
//  - empty/insufficient store → { candidates: [], considered, total } no crash
//
// Hermetic: all writes under os.tmpdir() via XDG_STATE_HOME injection.
// Uses effectiveConfidence-transparent decay via old `updated` + fixed `now`.

'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const { evolve, normalizeTrigger } = require('./evolve.js');
const { write } = require('./instincts.js');
const { layout } = require('./paths.js');
const { atomicWrite } = require('./atomic.js');

// --- Hermetic tmp store -------------------------------------------------------
const _tmpDirs = [];
function mkTmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-evolve-'));
  _tmpDirs.push(d);
  return d;
}
function freshEnv() {
  return { XDG_STATE_HOME: mkTmp() };
}
const HOME = '/home/u';

after(() => {
  for (const d of _tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

// Fixed clock: a known timestamp so decay math is deterministic.
const T0 = Date.parse('2026-06-20T10:00:00.000Z');
const DAY = 86400000;

// Helpers to build instinct objects. `updated` defaults to T0 (fresh = no decay).
function inst(id, trigger, confidence, domain, overrides = {}) {
  return {
    id,
    trigger,
    confidence,
    domain,
    scope: 'project',
    project_id: 'test-proj',
    source: 'observer',
    reinforcements: 1,
    action: 'do the thing',
    evidence: '- evidence',
    updated: new Date(T0).toISOString(),
    ...overrides,
  };
}

// Write a batch of instinct objects into env store.
function seedAll(instincts, env) {
  for (const i of instincts) {
    write(i, env, HOME);
  }
}

// Write an instinct with an EXACT `updated` timestamp, bypassing write()'s restamping.
// Used to seed intentionally stale instincts for decay tests.
// Computes the filepath via layout, then writes a raw Markdown file.
function writeWithTimestamp(inst, updatedISO, env) {
  const { projectInstinctsDir, globalInstinctsDir } = layout(inst.project_id || '_global_', env, HOME);
  const dir = inst.scope === 'global' ? globalInstinctsDir : projectInstinctsDir;
  fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, `${inst.id}.md`);
  const created = inst.created || updatedISO;
  const content = [
    '---',
    `id: ${inst.id}`,
    `trigger: ${inst.trigger}`,
    `confidence: ${inst.confidence}`,
    `domain: ${inst.domain}`,
    `scope: ${inst.scope}`,
    inst.scope !== 'global' ? `project_id: ${inst.project_id}` : null,
    `source: ${inst.source || 'observer'}`,
    `created: ${created}`,
    `updated: ${updatedISO}`,
    `reinforcements: ${inst.reinforcements || 0}`,
    '---',
    '',
    '## Action',
    inst.action || 'do the thing',
    '',
    '## Evidence',
    inst.evidence || '- evidence',
    '',
  ].filter((line) => line !== null).join('\n');
  atomicWrite(filepath, content);
}

// =============================================================================
// normalizeTrigger unit tests
// =============================================================================

test('normalizeTrigger: empty/null/undefined → ""', () => {
  assert.equal(normalizeTrigger(''), '');
  assert.equal(normalizeTrigger(null), '');
  assert.equal(normalizeTrigger(undefined), '');
});

test('normalizeTrigger: strips "when" prefix', () => {
  assert.equal(normalizeTrigger('when searching files'), 'searching files');
});

test('normalizeTrigger: strips "writing" keyword', () => {
  assert.equal(normalizeTrigger('writing tests'), 'tests');
});

test('normalizeTrigger: "when writing tests" → "tests"', () => {
  assert.equal(normalizeTrigger('when writing tests'), 'tests');
});

test('normalizeTrigger: "tests" → "tests"', () => {
  assert.equal(normalizeTrigger('tests'), 'tests');
});

test('normalizeTrigger: collapses internal whitespace', () => {
  // "  writing    unit  tests  "
  //   step 1: lowercase → same
  //   step 2: split("writing").join("") → "       unit  tests  " → trim → "unit  tests"
  //   step 3: collapse whitespace runs → "unit tests"
  assert.equal(normalizeTrigger('  writing    unit  tests  '), 'unit tests');
});

test('normalizeTrigger: all keywords stripped in order', () => {
  const result = normalizeTrigger('when creating adding implementing testing');
  // "when" → " creating adding implementing testing" → trim
  // "creating" → "  adding implementing testing" → trim
  // etc.
  // Final result should be empty or nearly empty after all strips.
  assert.equal(typeof result, 'string');
  // All keywords removed means empty string or just spaces (collapsed to '').
  // Verify it doesn't contain any of the stripped keywords as standalone words.
  assert.ok(!result.includes('when'));
  assert.ok(!result.includes('creating'));
  assert.ok(!result.includes('implementing'));
  assert.ok(!result.includes('testing'));
});

test('normalizeTrigger: lowercases the input', () => {
  assert.equal(normalizeTrigger('WHEN Writing Tests'), normalizeTrigger('when writing tests'));
});

// =============================================================================
// evolve — empty / insufficient store
// =============================================================================

test('evolve: empty store → { candidates: [], considered: 0, total: 0 }', () => {
  const env = freshEnv();
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.deepStrictEqual(result, { candidates: [], considered: 0, total: 0 });
});

test('evolve: all instincts below strong bar → candidates: [], considered: 0', () => {
  const env = freshEnv();
  // confidence 0.5 at T0 → effective = 0.5 (fresh) < 0.8
  seedAll([
    inst('a', 'same trigger', 0.5),
    inst('b', 'same trigger', 0.5),
    inst('c', 'same trigger', 0.5),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.considered, 0);
  assert.equal(result.total, 3);
});

// =============================================================================
// evolve — strong bar honored (including decay)
// =============================================================================

test('strong bar: two same-trigger instincts where one is below bar → not a skill', () => {
  const env = freshEnv();
  seedAll([
    inst('strong-one', 'run tests', 0.9),
    inst('weak-one', 'run tests', 0.5), // below 0.8
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  // Only one strong instinct in the cluster → singleton non-workflow → no candidate.
  assert.equal(result.candidates.length, 0);
  assert.equal(result.considered, 1);
  assert.equal(result.total, 2);
});

test('strong bar: decay drives an instinct below bar (old updated + advanced now)', () => {
  const env = freshEnv();
  // raw 0.9, but written 60 days before T0 → eff ≈ 0.225 (two half-lives) < 0.8
  // write() always restamps updated to wall-time, so use writeWithTimestamp for the stale one.
  const oldUpdated = new Date(T0 - 60 * DAY).toISOString();
  writeWithTimestamp(inst('decayed', 'run tests', 0.9, 'shell'), oldUpdated, env);
  // Fresh strong instinct (written at T0 via writeWithTimestamp to avoid wall-clock drift).
  writeWithTimestamp(inst('fresh-strong', 'run tests', 0.9, 'shell'), new Date(T0).toISOString(), env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  // Only one strong instinct (the fresh one); the decayed one is excluded.
  assert.equal(result.candidates.length, 0); // singleton non-workflow → no candidate
  assert.equal(result.considered, 1);
  assert.equal(result.total, 2);
});

// =============================================================================
// evolve — skill candidate
// =============================================================================

test('skill: ≥2 strong same-trigger → type:"skill"', () => {
  const env = freshEnv();
  seedAll([
    inst('sk-a', 'run tests', 0.9),
    inst('sk-b', 'run tests', 0.85),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(result.candidates.length, 1);
  const cand = result.candidates[0];
  assert.equal(cand.type, 'skill');
  assert.equal(cand.size, 2);
  assert.deepStrictEqual(cand.instinctIds, ['sk-a', 'sk-b']);
  assert.equal(result.considered, 2);
});

// =============================================================================
// evolve — agent candidate (NOT also a skill — partition)
// =============================================================================

test('agent: ≥3 strong same-trigger (avg eff ≥0.75) → type:"agent", not also a skill', () => {
  const env = freshEnv();
  seedAll([
    inst('ag-a', 'deploy service', 0.9),
    inst('ag-b', 'deploy service', 0.85),
    inst('ag-c', 'deploy service', 0.88),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(result.candidates.length, 1);
  const cand = result.candidates[0];
  assert.equal(cand.type, 'agent');
  assert.equal(cand.size, 3);
  assert.deepStrictEqual(cand.instinctIds, ['ag-a', 'ag-b', 'ag-c']);
});

// =============================================================================
// evolve — command candidate
// =============================================================================

test('command: singleton strong domain:"workflow" → type:"command"', () => {
  const env = freshEnv();
  seedAll([
    inst('cmd-a', 'review pr', 0.9, 'workflow'),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(result.candidates.length, 1);
  const cand = result.candidates[0];
  assert.equal(cand.type, 'command');
  assert.equal(cand.size, 1);
  assert.deepStrictEqual(cand.instinctIds, ['cmd-a']);
});

// =============================================================================
// evolve — non-candidate (singleton non-workflow)
// =============================================================================

test('non-candidate: singleton strong non-workflow instinct → no candidate emitted', () => {
  const env = freshEnv();
  seedAll([
    inst('lone-a', 'unique trigger', 0.95, 'shell'),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.considered, 1);
  assert.equal(result.total, 1);
});

// =============================================================================
// evolve — trigger normalization clustering
// =============================================================================

test('normalization: "when writing tests" and "tests" land in the same cluster', () => {
  const env = freshEnv();
  // Both normalize to "tests" after stripping "when" and "writing".
  seedAll([
    inst('norm-a', 'when writing tests', 0.9),
    inst('norm-b', 'tests', 0.85),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(result.candidates.length, 1);
  const cand = result.candidates[0];
  assert.equal(cand.type, 'skill');
  assert.equal(cand.size, 2);
  assert.deepStrictEqual(cand.instinctIds, ['norm-a', 'norm-b']);
  assert.equal(cand.triggerKey, 'tests');
});

test('normalization: "when creating a service" clusters with "a service"', () => {
  const env = freshEnv();
  seedAll([
    inst('nc-a', 'when creating a service', 0.9),
    inst('nc-b', 'a service', 0.88),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].size, 2);
});

// =============================================================================
// evolve — domains field
// =============================================================================

test('domains: distinct sorted ascending from member instincts', () => {
  const env = freshEnv();
  seedAll([
    inst('dom-a', 'deploy service', 0.9, 'shell'),
    inst('dom-b', 'deploy service', 0.85, 'workflow'),
    inst('dom-c', 'deploy service', 0.88, 'shell'), // duplicate domain
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  const cand = result.candidates[0];
  assert.deepStrictEqual(cand.domains, ['shell', 'workflow']);
});

// =============================================================================
// evolve — total ordering
// =============================================================================

test('total order: agents before skills before commands', () => {
  const env = freshEnv();
  seedAll([
    // skill cluster (2 instincts)
    inst('sk-x', 'skill topic', 0.9),
    inst('sk-y', 'skill topic', 0.85),
    // agent cluster (3 instincts)
    inst('ag-x', 'agent topic', 0.9),
    inst('ag-y', 'agent topic', 0.88),
    inst('ag-z', 'agent topic', 0.87),
    // command
    inst('cmd-x', 'command topic', 0.9, 'workflow'),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  const types = result.candidates.map((c) => c.type);
  assert.deepStrictEqual(types, ['agent', 'skill', 'command']);
});

test('total order: within same type, larger clusters first', () => {
  const env = freshEnv();
  seedAll([
    // Two skill clusters: one size-2, one size-3 (but avg < 0.75, so treated as skill? no, avg ≥ 0.75 → agent)
    // Let's use size-2 and size-3 but force avg < 0.75 by lowering strongBar to 0.5
    inst('big-a', 'bigger topic', 0.72),
    inst('big-b', 'bigger topic', 0.71),
    inst('big-c', 'bigger topic', 0.70),
    inst('small-a', 'smaller topic', 0.72),
    inst('small-b', 'smaller topic', 0.71),
  ], env);
  // Use strongBar 0.65 so these pass; avg for big cluster ≈ 0.71 < 0.75 → skill
  const result = evolve({ projectId: 'test-proj', now: T0, strongBar: 0.65 }, env, HOME);
  // big cluster (size 3, avg < 0.75 → skill) should come before small cluster (size 2 → skill)
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].size, 3);
  assert.equal(result.candidates[1].size, 2);
});

test('total order: same type+size, higher avgConfidence first', () => {
  const env = freshEnv();
  seedAll([
    inst('lo-a', 'low conf topic', 0.82),
    inst('lo-b', 'low conf topic', 0.80),
    inst('hi-a', 'high conf topic', 0.95),
    inst('hi-b', 'high conf topic', 0.93),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(result.candidates.length, 2);
  // Both are skill (size 2); higher avg first.
  assert.ok(result.candidates[0].avgConfidence > result.candidates[1].avgConfidence);
  assert.deepStrictEqual(result.candidates[0].instinctIds, ['hi-a', 'hi-b']);
});

test('total order: same type+size+conf, triggerKey ascending as final tiebreak', () => {
  const env = freshEnv();
  // Two skill clusters with same avg confidence (both 0.9 raw, same size 2).
  seedAll([
    inst('zz-a', 'zzz topic', 0.9),
    inst('zz-b', 'zzz topic', 0.9),
    inst('aa-a', 'aaa topic', 0.9),
    inst('aa-b', 'aaa topic', 0.9),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].triggerKey, 'aaa topic');
  assert.equal(result.candidates[1].triggerKey, 'zzz topic');
});

// =============================================================================
// evolve — determinism
// =============================================================================

test('deterministic: two calls same args → deepStrictEqual', () => {
  const env = freshEnv();
  seedAll([
    inst('det-a', 'deploy service', 0.9),
    inst('det-b', 'deploy service', 0.85),
    inst('det-c', 'deploy service', 0.88),
    inst('det-d', 'run tests', 0.9),
    inst('det-e', 'run tests', 0.82),
    inst('det-f', 'audit log', 0.9, 'workflow'),
  ], env);
  const r1 = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  const r2 = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.deepStrictEqual(r1, r2);
});

test('deterministic: tie scenario resolves identically across runs', () => {
  const env = freshEnv();
  // Two skill clusters with identical sizes and average confidence.
  seedAll([
    inst('tie-aa', 'alpha topic', 0.9),
    inst('tie-ab', 'alpha topic', 0.9),
    inst('tie-ba', 'beta topic', 0.9),
    inst('tie-bb', 'beta topic', 0.9),
  ], env);
  const r1 = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  const r2 = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.deepStrictEqual(r1, r2);
  // Tiebreak = triggerKey ascending: "alpha topic" < "beta topic"
  assert.equal(r1.candidates[0].triggerKey, 'alpha topic');
  assert.equal(r1.candidates[1].triggerKey, 'beta topic');
});

// =============================================================================
// evolve — strongBar param override
// =============================================================================

test('strongBar override: lower bar admits more instincts', () => {
  const env = freshEnv();
  seedAll([
    inst('bar-a', 'check logs', 0.75), // below default 0.8 but above 0.7
    inst('bar-b', 'check logs', 0.72),
  ], env);
  // Default bar 0.8: both excluded.
  const r_default = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(r_default.candidates.length, 0);
  assert.equal(r_default.considered, 0);

  // Override bar to 0.65: both pass (avg ~0.735 < 0.75 → skill, not agent).
  const r_lower = evolve({ projectId: 'test-proj', now: T0, strongBar: 0.65 }, env, HOME);
  assert.equal(r_lower.candidates.length, 1);
  assert.equal(r_lower.candidates[0].type, 'skill');
  assert.equal(r_lower.considered, 2);
});

// =============================================================================
// evolve — avgConfidence guard (explicit 0.75 check matters if strongBar lowered)
// =============================================================================

test('agent avgConfidence guard: ≥3 members but avg < 0.75 → skill, not agent', () => {
  const env = freshEnv();
  // strongBar 0.65 so these pass; 3 members, avg = ~0.71 < 0.75 → skill
  seedAll([
    inst('g-a', 'same topic', 0.72),
    inst('g-b', 'same topic', 0.71),
    inst('g-c', 'same topic', 0.70),
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0, strongBar: 0.65 }, env, HOME);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].type, 'skill');
  assert.equal(result.candidates[0].size, 3);
});

// =============================================================================
// evolve — considered / total counts
// =============================================================================

test('considered and total counts are correct', () => {
  const env = freshEnv();
  seedAll([
    inst('cnt-a', 'topic one', 0.9),   // strong
    inst('cnt-b', 'topic one', 0.85),  // strong
    inst('cnt-c', 'topic two', 0.5),   // weak → excluded
    inst('cnt-d', 'topic three', 0.6), // weak → excluded
  ], env);
  const result = evolve({ projectId: 'test-proj', now: T0 }, env, HOME);
  assert.equal(result.total, 4);
  assert.equal(result.considered, 2);
  assert.equal(result.candidates.length, 1); // one skill cluster
});
