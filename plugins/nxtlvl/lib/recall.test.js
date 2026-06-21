// recall tests — verification: `node --test "plugins/nxtlvl/lib/recall.test.js"`
//
// Acceptance criteria (C&M Phase 3, Task 3.1):
//  - Gate + best-first ordering correct.
//  - Over-ceiling: exactly ceiling injected + remainder names (ids), in order.
//  - Exactly-at-ceiling: all injected, truncatedNames empty.
//  - Off-project instincts excluded.
//  - Below-bar (<0.7 default) excluded.
//  - Stale-via-decay excluded (raw ≥0.7 decays below bar at a future `now`).
//  - bar and ceiling overrides honored from explicit arg and env var; explicit wins;
//    invalid env values fall back to defaults.
//  - Empty store → all-empty result.
//
// Hermetic: only writes under os.tmpdir() via fs.mkdtempSync; cleaned up in after().

'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const { recall, resolveBar, resolveCeiling } = require('./recall.js');
const { write, read } = require('./instincts.js');

// --- Hermetic tmp store (mirrors instincts.test.js convention exactly) --------
const _tmpDirs = [];
function mkTmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-recall-'));
  _tmpDirs.push(d);
  return d;
}
function freshEnv(extra = {}) {
  return { XDG_STATE_HOME: mkTmp(), ...extra };
}
const HOME = '/home/u'; // never read from disk in these tests

after(() => {
  for (const d of _tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

// --- Fixed clock helpers -----------------------------------------------------
const DAY = 86400000;

// --- Instinct factory --------------------------------------------------------
function makeInstinct(overrides = {}) {
  return {
    id: 'default-instinct',
    trigger: 'some trigger',
    confidence: 0.8,
    domain: 'shell',
    scope: 'project',
    project_id: 'proj-alpha',
    source: 'observer',
    reinforcements: 1,
    action: 'Do the right thing.',
    evidence: '- observed once',
    ...overrides,
  };
}

// Write an instinct and return the stored record (with real `updated` stamp).
function seed(instinct, env) {
  const fp = write(instinct, env, HOME);
  return read(fp);
}

// ─── resolveBar unit tests ────────────────────────────────────────────────────

test('resolveBar: explicit arg wins over env and default', () => {
  const env = { NXTLVL_CM_RECALL_BAR: '0.5' };
  assert.equal(resolveBar({ bar: 0.9, env }), 0.9);
});

test('resolveBar: env var used when no explicit arg', () => {
  const env = { NXTLVL_CM_RECALL_BAR: '0.5' };
  assert.equal(resolveBar({ env }), 0.5);
});

test('resolveBar: falls back to 0.7 for missing env var', () => {
  assert.equal(resolveBar({ env: {} }), 0.7);
});

test('resolveBar: invalid env var (non-numeric) falls back to 0.7', () => {
  assert.equal(resolveBar({ env: { NXTLVL_CM_RECALL_BAR: 'banana' } }), 0.7);
});

test('resolveBar: invalid env var (out of range: 0) falls back to 0.7', () => {
  assert.equal(resolveBar({ env: { NXTLVL_CM_RECALL_BAR: '0' } }), 0.7);
});

test('resolveBar: invalid env var (>1) falls back to 0.7', () => {
  assert.equal(resolveBar({ env: { NXTLVL_CM_RECALL_BAR: '1.1' } }), 0.7);
});

test('resolveBar: boundary value 1.0 is valid', () => {
  assert.equal(resolveBar({ bar: 1.0 }), 1.0);
});

// ─── resolveCeiling unit tests ────────────────────────────────────────────────

test('resolveCeiling: explicit arg wins over env and default', () => {
  const env = { NXTLVL_CM_RECALL_CEILING: '5' };
  assert.equal(resolveCeiling({ ceiling: 3, env }), 3);
});

test('resolveCeiling: env var used when no explicit arg', () => {
  const env = { NXTLVL_CM_RECALL_CEILING: '7' };
  assert.equal(resolveCeiling({ env }), 7);
});

test('resolveCeiling: falls back to 10 for missing env var', () => {
  assert.equal(resolveCeiling({ env: {} }), 10);
});

test('resolveCeiling: invalid env var (non-numeric) falls back to 10', () => {
  assert.equal(resolveCeiling({ env: { NXTLVL_CM_RECALL_CEILING: 'lots' } }), 10);
});

test('resolveCeiling: invalid env var (0) falls back to 10', () => {
  assert.equal(resolveCeiling({ env: { NXTLVL_CM_RECALL_CEILING: '0' } }), 10);
});

test('resolveCeiling: invalid env var (negative) falls back to 10', () => {
  assert.equal(resolveCeiling({ env: { NXTLVL_CM_RECALL_CEILING: '-3' } }), 10);
});

test('resolveCeiling: invalid env var (float) falls back to 10', () => {
  assert.equal(resolveCeiling({ env: { NXTLVL_CM_RECALL_CEILING: '2.5' } }), 10);
});

// ─── recall integration tests ─────────────────────────────────────────────────

// --- Empty store → all-empty result ------------------------------------------

test('empty store returns { injected: [], truncatedNames: [], total: 0 }', () => {
  const env = freshEnv();
  const result = recall({ projectId: 'no-data', now: Date.now() }, env, HOME);
  assert.deepEqual(result, { injected: [], truncatedNames: [], total: 0 });
});

// --- Gate + best-first ordering correct --------------------------------------

test('gate: returns qualifying instincts sorted best-first', () => {
  const env = freshEnv();

  // Write three instincts with different raw confidences; all fresh → effective ≈ raw.
  const a = seed(makeInstinct({ id: 'low', confidence: 0.72, project_id: 'p1' }), env);
  const b = seed(makeInstinct({ id: 'high', confidence: 0.95, project_id: 'p1' }), env);
  const c = seed(makeInstinct({ id: 'mid', confidence: 0.80, project_id: 'p1' }), env);

  // Evaluate at the write time — no decay yet.
  const now = Date.parse(a.updated);

  const { injected, truncatedNames, total } = recall({ projectId: 'p1', now }, env, HOME);

  const ids = injected.map((i) => i.id);
  assert.deepEqual(ids, ['high', 'mid', 'low'], 'sorted best-first by effective confidence');
  assert.deepEqual(truncatedNames, []);
  assert.equal(total, 3);
});

// --- Below-bar excluded -------------------------------------------------------

test('below-bar instincts excluded', () => {
  const env = freshEnv();

  const a = seed(makeInstinct({ id: 'above-bar', confidence: 0.80, project_id: 'p2' }), env);
  seed(makeInstinct({ id: 'below-bar', confidence: 0.65, project_id: 'p2' }), env);

  const now = Date.parse(a.updated);

  const { injected, total } = recall({ projectId: 'p2', now }, env, HOME);
  const ids = injected.map((i) => i.id);
  assert.ok(ids.includes('above-bar'), 'above-bar should be included');
  assert.ok(!ids.includes('below-bar'), 'below-bar should be excluded');
  assert.equal(total, 1);
});

// --- Off-project instincts excluded ------------------------------------------

test('off-project instinct is excluded; same-project and global are included', () => {
  const env = freshEnv();

  const a = seed(makeInstinct({ id: 'proj-instinct', confidence: 0.80, project_id: 'mine' }), env);
  seed(makeInstinct({ id: 'global-instinct', scope: 'global', project_id: undefined, confidence: 0.80 }), env);
  seed(makeInstinct({ id: 'other-proj', confidence: 0.90, project_id: 'not-mine' }), env);

  const now = Date.parse(a.updated);

  const { injected } = recall({ projectId: 'mine', now }, env, HOME);
  const ids = injected.map((i) => i.id);
  assert.ok(ids.includes('proj-instinct'), 'own project instinct included');
  assert.ok(ids.includes('global-instinct'), 'global instinct included');
  assert.ok(!ids.includes('other-proj'), 'other project instinct excluded');
});

// --- Stale-via-decay excluded -------------------------------------------------
// Seed an instinct with raw confidence ≥ 0.7 (e.g. 0.8), then evaluate with `now`
// set far enough in the future that its effective confidence falls below 0.7.
// Half-life = 30 days. At t+30d: 0.8 * 0.5^(30/30) = 0.4 < 0.7 → excluded.
// We capture the real `updated` stamp from the written file so the math is exact.

test('stale-via-decay: raw ≥0.7 but decayed below bar is excluded', () => {
  const env = freshEnv();

  // Seed one fresh instinct (high confidence, will stay above bar) and one that
  // will decay below bar after 31 days.
  const freshRecord = seed(makeInstinct({ id: 'evergreen', confidence: 0.99, project_id: 'p3' }), env);
  const staleRecord = seed(makeInstinct({ id: 'will-decay', confidence: 0.80, project_id: 'p3' }), env);

  // Both written at approximately the same real wall-clock time; use `will-decay`'s
  // stamp as the decay baseline (same as the pattern in instincts.test.js).
  const writtenAt = Date.parse(staleRecord.updated);

  // Evaluate 31 days later.
  // will-decay: 0.80 * 0.5^(31/30) ≈ 0.80 * 0.487 ≈ 0.390 < 0.7 → dropped.
  // evergreen:  0.99 * 0.5^(31/30) ≈ 0.99 * 0.487 ≈ 0.482 < 0.7 → also dropped.
  // To keep evergreen above bar while will-decay decays below it, we need a raw
  // confidence gap wide enough that at time T, evergreen >= 0.7 but will-decay < 0.7.
  //
  // We want: raw_e * 0.5^(d/30) >= 0.7  AND  raw_s * 0.5^(d/30) < 0.7
  // Let raw_e = 0.99, raw_s = 0.72, d = 5 days:
  //   0.5^(5/30) ≈ 0.891
  //   evergreen: 0.99 * 0.891 ≈ 0.882 >= 0.7  ✓
  //   stale:     0.72 * 0.891 ≈ 0.641 < 0.7   ✓
  //
  // But `write()` already wrote will-decay at 0.80 above; we need fresh seeds.
  // Re-seed in a fresh env to keep the test self-contained.
  const env2 = freshEnv();
  const rec1 = seed(makeInstinct({ id: 'stays-above', confidence: 0.99, project_id: 'p4' }), env2);
  const rec2 = seed(makeInstinct({ id: 'decays-below', confidence: 0.72, project_id: 'p4' }), env2);

  const base = Math.max(Date.parse(rec1.updated), Date.parse(rec2.updated));
  const futureNow = base + 5 * DAY; // 5 days later

  const { injected, total } = recall({ projectId: 'p4', now: futureNow }, env2, HOME);
  const ids = injected.map((i) => i.id);

  assert.ok(ids.includes('stays-above'), 'high-confidence instinct survives 5-day decay');
  assert.ok(!ids.includes('decays-below'), 'stale instinct (raw 0.72, 5 days old) excluded');
  assert.equal(total, 1);
});

// --- Exactly at ceiling -------------------------------------------------------

test('exactly-at-ceiling: all injected, truncatedNames empty', () => {
  const env = freshEnv();

  // Write exactly 3 instincts and set ceiling=3.
  const r1 = seed(makeInstinct({ id: 'a', confidence: 0.90, project_id: 'p5' }), env);
  seed(makeInstinct({ id: 'b', confidence: 0.85, project_id: 'p5' }), env);
  seed(makeInstinct({ id: 'c', confidence: 0.80, project_id: 'p5' }), env);

  const now = Date.parse(r1.updated);

  const { injected, truncatedNames, total } = recall(
    { projectId: 'p5', ceiling: 3, now },
    env,
    HOME,
  );

  assert.equal(injected.length, 3);
  assert.deepEqual(truncatedNames, []);
  assert.equal(total, 3);
});

// --- Over ceiling: correct truncation + names in order -----------------------

test('over-ceiling: returns ceiling injected + remainder names in best-first order', () => {
  const env = freshEnv();

  // 5 instincts with distinct confidences; ceiling=3.
  const r1 = seed(makeInstinct({ id: 'rank1', confidence: 0.95, project_id: 'p6' }), env);
  seed(makeInstinct({ id: 'rank2', confidence: 0.90, project_id: 'p6' }), env);
  seed(makeInstinct({ id: 'rank3', confidence: 0.85, project_id: 'p6' }), env);
  seed(makeInstinct({ id: 'rank4', confidence: 0.80, project_id: 'p6' }), env);
  seed(makeInstinct({ id: 'rank5', confidence: 0.75, project_id: 'p6' }), env);

  const now = Date.parse(r1.updated);

  const { injected, truncatedNames, total } = recall(
    { projectId: 'p6', ceiling: 3, now },
    env,
    HOME,
  );

  assert.equal(total, 5);
  assert.equal(injected.length, 3);
  assert.deepEqual(
    injected.map((i) => i.id),
    ['rank1', 'rank2', 'rank3'],
    'top 3 by confidence injected',
  );
  assert.deepEqual(
    truncatedNames,
    ['rank4', 'rank5'],
    'remainder names in best-first order',
  );
});

// --- bar and ceiling overrides -----------------------------------------------

test('explicit bar arg overrides env var and default', () => {
  const env = freshEnv({ NXTLVL_CM_RECALL_BAR: '0.9' }); // env says 0.9

  // Two instincts: one at 0.80 (above default 0.7, below env 0.9) and one at 0.95.
  const r1 = seed(makeInstinct({ id: 'just-above-default', confidence: 0.80, project_id: 'p7' }), env);
  seed(makeInstinct({ id: 'well-above', confidence: 0.95, project_id: 'p7' }), env);

  const now = Date.parse(r1.updated);

  // Explicit bar=0.7 → both included (overrides env's 0.9).
  const { injected: withExplicit } = recall({ projectId: 'p7', bar: 0.7, now }, env, HOME);
  assert.equal(withExplicit.length, 2, 'explicit bar=0.7 includes both instincts');

  // No explicit bar → env var 0.9 applies → only well-above included.
  const { injected: withEnv } = recall({ projectId: 'p7', now }, env, HOME);
  assert.equal(withEnv.length, 1, 'env bar=0.9 excludes just-above-default');
  assert.equal(withEnv[0].id, 'well-above');
});

test('explicit ceiling arg overrides env var and default', () => {
  const env = freshEnv({ NXTLVL_CM_RECALL_CEILING: '2' }); // env says 2

  const r1 = seed(makeInstinct({ id: 'a1', confidence: 0.95, project_id: 'p8' }), env);
  seed(makeInstinct({ id: 'a2', confidence: 0.90, project_id: 'p8' }), env);
  seed(makeInstinct({ id: 'a3', confidence: 0.85, project_id: 'p8' }), env);

  const now = Date.parse(r1.updated);

  // Explicit ceiling=3 → all 3 injected (overrides env's 2).
  const { injected: withExplicit, truncatedNames: tn1 } = recall(
    { projectId: 'p8', ceiling: 3, now },
    env,
    HOME,
  );
  assert.equal(withExplicit.length, 3, 'explicit ceiling=3 includes all');
  assert.deepEqual(tn1, []);

  // No explicit ceiling → env var 2 applies → only 2 injected, 1 truncated.
  const { injected: withEnv, truncatedNames: tn2 } = recall({ projectId: 'p8', now }, env, HOME);
  assert.equal(withEnv.length, 2, 'env ceiling=2 truncates to 2');
  assert.deepEqual(tn2, ['a3']);
});

test('invalid env var for bar falls back to default 0.7', () => {
  const env = freshEnv({ NXTLVL_CM_RECALL_BAR: 'not-a-number' });

  const r1 = seed(makeInstinct({ id: 'above-default', confidence: 0.75, project_id: 'p9' }), env);
  const now = Date.parse(r1.updated);

  // Invalid env bar → default 0.7 → 0.75 instinct is included.
  const { injected } = recall({ projectId: 'p9', now }, env, HOME);
  assert.equal(injected.length, 1, 'invalid bar env falls back to 0.7');
  assert.equal(injected[0].id, 'above-default');
});

test('invalid env var for ceiling falls back to default 10', () => {
  const env = freshEnv({ NXTLVL_CM_RECALL_CEILING: 'oops' });

  // Write 12 instincts all with high confidence.
  const ids = [];
  let lastRecord;
  for (let n = 0; n < 12; n++) {
    const id = `inst-${n}`;
    ids.push(id);
    lastRecord = seed(makeInstinct({ id, confidence: 0.75 + n * 0.001, project_id: 'p10' }), env);
  }

  const now = Date.parse(lastRecord.updated);

  // Invalid ceiling env → default 10 → max 10 injected, 2 truncated.
  const { injected, truncatedNames, total } = recall({ projectId: 'p10', now }, env, HOME);
  assert.equal(total, 12);
  assert.equal(injected.length, 10, 'invalid ceiling env falls back to 10');
  assert.equal(truncatedNames.length, 2);
});
