// metrics tests — verification = `node --test` green.
// Covers:
//   - fallbackRate empty store
//   - fallbackRate happy path (3 events / 2 sessions / 5 total → rate 0.4)
//   - malformed + blank lines are skipped in BOTH files
//   - null-session fallback line: counts in fallbackEvents, excluded from sessionsWithFallback
//   - clamp: more fallback sessions than session_close lines → rate === 1, raw counts unclamped
//   - non-session_close metrics lines are NOT counted in totalSessions
//   - bucketEffective: empty, spread (boundary + above + below), boundary values
//   - confidenceDistribution uses EFFECTIVE (decayed) confidence, not raw

'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const os   = require('node:os');
const fs   = require('node:fs');
const path = require('node:path');

const { fallbackRate, confidenceDistribution, bucketEffective } = require('./metrics.js');
const { write: writeInstinct } = require('./instincts.js');

// ---------------------------------------------------------------------------
// Hermetic temp store helpers
// ---------------------------------------------------------------------------

const _tmpDirs = [];

function mkTmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-metrics-'));
  _tmpDirs.push(d);
  return d;
}

after(() => {
  for (const d of _tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

/**
 * Create a fresh pair of roots:
 *   tmpA  — used as XDG_STATE_HOME (storage root = tmpA/nxtlvl)
 *   tmpB  — used as HOME (fallback log = tmpB/.claude/nxtlvl/fallback-log.jsonl)
 */
function freshRoots() {
  const tmpA = mkTmp();
  const tmpB = mkTmp();
  return {
    env: { XDG_STATE_HOME: tmpA },
    home: tmpB,
    storageRoot: path.join(tmpA, 'nxtlvl'),
    fallbackLogPath: path.join(tmpB, '.claude', 'nxtlvl', 'fallback-log.jsonl'),
  };
}

function seedFallbackLog(logPath, lines) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, lines.join('\n') + '\n', 'utf8');
}

function seedMetrics(storageRoot, projectId, lines) {
  const dir = path.join(storageRoot, 'projects', projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'metrics.jsonl'), lines.join('\n') + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// fallbackRate — empty store
// ---------------------------------------------------------------------------

test('fallbackRate empty: nothing seeded → all zeros, rate null', () => {
  const { env, home } = freshRoots();
  const r = fallbackRate(env, home);
  assert.deepEqual(r, {
    fallbackEvents: 0,
    sessionsWithFallback: 0,
    totalSessions: 0,
    rate: null,
  });
});

// ---------------------------------------------------------------------------
// fallbackRate — happy path
// ---------------------------------------------------------------------------

test('fallbackRate happy: 3 events (sessions A, A, B) / 5 session_close across 2 projects → rate 0.4', () => {
  const { env, home, storageRoot: root, fallbackLogPath } = freshRoots();

  // Fallback log: A fires twice, B fires once → 3 events, {A,B}=2 distinct.
  seedFallbackLog(fallbackLogPath, [
    JSON.stringify({ ts: '2026-01-01T00:00:00Z', session: 'A', ecc_thing: 'ecc:learn', task: null }),
    JSON.stringify({ ts: '2026-01-01T01:00:00Z', session: 'A', ecc_thing: 'ecc:search', task: null }),
    JSON.stringify({ ts: '2026-01-01T02:00:00Z', session: 'B', ecc_thing: 'ecc:review', task: null }),
  ]);

  // Two project dirs with session_close lines totalling 5.
  seedMetrics(root, 'proj1', [
    JSON.stringify({ ts: '1', session: 'A', event: 'session_close', toolCalls: 5 }),
    JSON.stringify({ ts: '2', session: 'B', event: 'session_close', toolCalls: 3 }),
    JSON.stringify({ ts: '3', session: 'C', event: 'session_close', toolCalls: 2 }),
  ]);
  seedMetrics(root, 'proj2', [
    JSON.stringify({ ts: '4', session: 'D', event: 'session_close', toolCalls: 1 }),
    JSON.stringify({ ts: '5', session: 'E', event: 'session_close', toolCalls: 0 }),
  ]);

  const r = fallbackRate(env, home);
  assert.equal(r.fallbackEvents, 3);
  assert.equal(r.sessionsWithFallback, 2);
  assert.equal(r.totalSessions, 5);
  assert.ok(Math.abs(r.rate - 0.4) < 1e-9, `expected 0.4, got ${r.rate}`);
});

// ---------------------------------------------------------------------------
// Malformed + blank lines are skipped
// ---------------------------------------------------------------------------

test('malformed/blank lines in both files are skipped', () => {
  const { env, home, storageRoot: root, fallbackLogPath } = freshRoots();

  seedFallbackLog(fallbackLogPath, [
    '',                           // blank
    'not-json',                   // malformed
    '   ',                        // whitespace only
    JSON.stringify({ ts: '1', session: 'X', ecc_thing: 'ecc:ok', task: null }),
  ]);

  seedMetrics(root, 'proj1', [
    '',
    'bad json',
    JSON.stringify({ ts: '1', session: 'X', event: 'session_close', toolCalls: 1 }),
  ]);

  const r = fallbackRate(env, home);
  assert.equal(r.fallbackEvents, 1);
  assert.equal(r.sessionsWithFallback, 1);
  assert.equal(r.totalSessions, 1);
  assert.ok(Math.abs(r.rate - 1) < 1e-9);
});

// ---------------------------------------------------------------------------
// null-session fallback line
// ---------------------------------------------------------------------------

test('null-session fallback line counts in fallbackEvents but not in sessionsWithFallback', () => {
  const { env, home, storageRoot: root, fallbackLogPath } = freshRoots();

  seedFallbackLog(fallbackLogPath, [
    JSON.stringify({ ts: '1', session: null, ecc_thing: 'ecc:something', task: null }),
    JSON.stringify({ ts: '2', session: 'Z', ecc_thing: 'ecc:other', task: null }),
  ]);
  seedMetrics(root, 'proj1', [
    JSON.stringify({ ts: '1', session: 'Z', event: 'session_close', toolCalls: 1 }),
    JSON.stringify({ ts: '2', session: 'W', event: 'session_close', toolCalls: 1 }),
  ]);

  const r = fallbackRate(env, home);
  assert.equal(r.fallbackEvents, 2);
  assert.equal(r.sessionsWithFallback, 1); // only 'Z', null excluded
  assert.equal(r.totalSessions, 2);
  assert.ok(Math.abs(r.rate - 0.5) < 1e-9);
});

// ---------------------------------------------------------------------------
// Clamp: more fallback sessions than session_close lines
// ---------------------------------------------------------------------------

test('clamp: sessionsWithFallback > totalSessions → rate === 1; raw counts unclamped', () => {
  const { env, home, storageRoot: root, fallbackLogPath } = freshRoots();

  // 3 distinct fallback sessions, only 2 session_close lines.
  seedFallbackLog(fallbackLogPath, [
    JSON.stringify({ ts: '1', session: 'A', ecc_thing: 'ecc:x', task: null }),
    JSON.stringify({ ts: '2', session: 'B', ecc_thing: 'ecc:y', task: null }),
    JSON.stringify({ ts: '3', session: 'C', ecc_thing: 'ecc:z', task: null }),
  ]);
  seedMetrics(root, 'proj1', [
    JSON.stringify({ ts: '1', session: 'A', event: 'session_close', toolCalls: 1 }),
    JSON.stringify({ ts: '2', session: 'B', event: 'session_close', toolCalls: 1 }),
  ]);

  const r = fallbackRate(env, home);
  assert.equal(r.fallbackEvents, 3);
  assert.equal(r.sessionsWithFallback, 3);  // unclamped
  assert.equal(r.totalSessions, 2);          // unclamped
  assert.equal(r.rate, 1);                   // clamped
});

// ---------------------------------------------------------------------------
// non-session_close metrics lines are NOT counted
// ---------------------------------------------------------------------------

test('non-session_close event types in metrics.jsonl are not counted in totalSessions', () => {
  const { env, home, storageRoot: root, fallbackLogPath } = freshRoots();

  seedFallbackLog(fallbackLogPath, []);
  seedMetrics(root, 'proj1', [
    JSON.stringify({ ts: '1', session: 'A', event: 'observation', toolCalls: 1 }),
    JSON.stringify({ ts: '2', session: 'B', event: 'session_start', toolCalls: 0 }),
    JSON.stringify({ ts: '3', session: 'C', event: 'session_close', toolCalls: 5 }),
  ]);

  const r = fallbackRate(env, home);
  assert.equal(r.totalSessions, 1); // only the session_close line
});

// ---------------------------------------------------------------------------
// bucketEffective — pure unit tests
// ---------------------------------------------------------------------------

test('bucketEffective empty array → n:0, mean:null, all bins count 0', () => {
  const { n, mean, bins } = bucketEffective([]);
  assert.equal(n, 0);
  assert.equal(mean, null);
  assert.equal(bins.length, 5);
  for (const b of bins) {
    assert.equal(b.count, 0, `expected 0 for bin ${b.label}`);
  }
  // Labels are high→low
  assert.equal(bins[0].label, '0.8–1.0');
  assert.equal(bins[4].label, '0.0–0.2');
});

test('bucketEffective [0.05, 0.25, 0.45, 0.65, 0.85, 0.95, 1.0] → top bin count 3, each lower bin 1', () => {
  const vals = [0.05, 0.25, 0.45, 0.65, 0.85, 0.95, 1.0];
  const { n, mean, bins } = bucketEffective(vals);
  assert.equal(n, 7);
  // mean = sum / 7
  const expectedMean = vals.reduce((a, b) => a + b, 0) / 7;
  assert.ok(Math.abs(mean - expectedMean) < 1e-9, `mean mismatch: ${mean} vs ${expectedMean}`);
  // high→low: [0.8–1.0], [0.6–0.8], [0.4–0.6], [0.2–0.4], [0.0–0.2]
  // 0.85 → bin4, 0.95 → bin4, 1.0 → bin4  → top bin count 3
  assert.equal(bins[0].label, '0.8–1.0');
  assert.equal(bins[0].count, 3, `top bin should be 3, got ${bins[0].count}`);
  // 0.65 → bin3
  assert.equal(bins[1].label, '0.6–0.8');
  assert.equal(bins[1].count, 1);
  // 0.45 → bin2
  assert.equal(bins[2].label, '0.4–0.6');
  assert.equal(bins[2].count, 1);
  // 0.25 → bin1
  assert.equal(bins[3].label, '0.2–0.4');
  assert.equal(bins[3].count, 1);
  // 0.05 → bin0
  assert.equal(bins[4].label, '0.0–0.2');
  assert.equal(bins[4].count, 1);
});

test('bucketEffective boundary values: 0.8→bin4(top), 0.6→bin3, 0.2→bin1, 0.0→bin0', () => {
  const { bins } = bucketEffective([0.8, 0.6, 0.2, 0.0]);
  // 0.8 >= 1 is false; floor(0.8/0.2) = floor(4) = 4 → top bin
  assert.equal(bins[0].count, 1, '0.8 should land in top bin [0.8–1.0]');
  // 0.6: floor(0.6/0.2) = floor(3) = 3 → bin3 (second from top)
  assert.equal(bins[1].count, 1, '0.6 should land in [0.6–0.8]');
  // 0.2: floor(0.2/0.2) = floor(1) = 1 → bin1 (second from bottom)
  assert.equal(bins[3].count, 1, '0.2 should land in [0.2–0.4]');
  // 0.0: floor(0.0/0.2) = floor(0) = 0 → bin0 (bottom)
  assert.equal(bins[4].count, 1, '0.0 should land in [0.0–0.2]');
});

// ---------------------------------------------------------------------------
// confidenceDistribution uses EFFECTIVE, not raw, confidence
// ---------------------------------------------------------------------------

test('confidenceDistribution uses effective (decayed) confidence, not raw', () => {
  const tmpA = mkTmp();
  const tmpB = mkTmp();
  const env  = { XDG_STATE_HOME: tmpA };
  const home = tmpB;
  const projectId = 'test-proj';

  const DAY = 86400000;
  // "now" for this test: an arbitrary fixed timestamp.
  const now = Date.parse('2026-06-21T00:00:00.000Z');
  // "fresh updated" = at now (no decay)
  const freshUpdated = new Date(now).toISOString();
  // "old updated" = 60 days before now (two half-lives → raw * 0.25)
  const oldUpdated   = new Date(now - 60 * DAY).toISOString();

  // Instinct 1: raw 0.9, fresh → effective 0.9 → top bin [0.8–1.0]
  writeInstinct({
    id: 'fresh-high',
    trigger: 't1',
    confidence: 0.9,
    domain: 'test',
    scope: 'project',
    project_id: projectId,
    source: 'observer',
    reinforcements: 0,
    action: 'a',
    evidence: 'e',
    updated: freshUpdated,
    created: freshUpdated,
  }, env, home);

  // Instinct 2: raw 0.9, old updated (2 half-lives) → effective ≈ 0.225 → bottom bin [0.0–0.2]
  // Write it fresh first (write() stamps updated), then patch the file to backdate updated.
  const { layout } = require('./paths.ts');
  const instPath = writeInstinct({
    id: 'stale-would-be-high',
    trigger: 't2',
    confidence: 0.9,
    domain: 'test',
    scope: 'project',
    project_id: projectId,
    source: 'observer',
    reinforcements: 0,
    action: 'a',
    evidence: 'e',
    updated: oldUpdated,
    created: oldUpdated,
  }, env, home);
  // Patch the file to ensure the stored updated is the old date (write() restamps it).
  const { read: readInstinct } = require('./instincts.js');
  const raw = fs.readFileSync(instPath, 'utf8');
  // Replace the updated: line with the old date.
  const patched = raw.replace(/^updated: .+$/m, `updated: ${oldUpdated}`);
  fs.writeFileSync(instPath, patched, 'utf8');

  // Verify the patched file decays properly.
  const { effectiveConfidence: eff } = require('./instincts.js');
  const patchedInst = readInstinct(instPath);
  const effVal = eff(patchedInst, now);
  // raw 0.9 × 0.5^2 = 0.225
  assert.ok(Math.abs(effVal - 0.225) < 0.01, `expected ~0.225, got ${effVal}`);

  const dist = confidenceDistribution({ projectId, now }, env, home);
  assert.equal(dist.n, 2);

  // fresh-high should be in top bin [0.8–1.0]
  assert.equal(dist.bins[0].count, 1, 'fresh-high should be in top bin');
  // stale-would-be-high effective ≈ 0.225 → [0.2–0.4] (bins[3])
  // BUT wait: 0.225 / 0.2 = 1.125, floor = 1 → rawIdx=1 → invert to bins[3] ([0.2–0.4])
  assert.equal(dist.bins[3].count, 1, 'stale instinct should land in [0.2–0.4] by effective confidence');
  // If we used RAW confidence (0.9), both would be in top bin — this assertion would fail.
  assert.equal(dist.bins[0].count, 1, 'should NOT have 2 in top bin (would fail if using raw confidence)');
});
