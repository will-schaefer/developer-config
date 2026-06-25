// instincts tests — verification = `node --test` green.
// Acceptance criteria (C&M Phase 1, Task 1.5):
//  - write→read round-trips frontmatter + Action + Evidence faithfully.
//  - write routes scope=project under projectInstinctsDir, scope=global under
//    globalInstinctsDir (asserted on the returned file path).
//  - reinforce bumps confidence toward (never reaching) 1.0; bumps reinforcements
//    + updated; effectiveConfidence decays the effective value over time.
//  - forProject returns THIS project's project-scoped + ALL global instincts,
//    excludes a different project's instincts, sorted best-first by eff. confidence.
//  - list({ minConfidence }) drops an instinct decayed below the bar.
//
// Hermetic: only writes under os.tmpdir() via fs.mkdtempSync; cleaned up in after().

'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const {
  write,
  read,
  readById,
  list,
  forProject,
  reinforce,
  effectiveConfidence,
  remove,
  promote,
} = require('./instincts.js');
const { layout } = require('./paths.ts');

// --- Hermetic tmp store -----------------------------------------------------
const _tmpDirs = [];
function mkTmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-instincts-'));
  _tmpDirs.push(d);
  return d;
}
// Every test gets a fresh XDG_STATE_HOME so files land under our tmp dir.
function freshEnv() {
  return { XDG_STATE_HOME: mkTmp() };
}
const HOME = '/home/u'; // never read from disk in these tests

after(() => {
  for (const d of _tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

// Fixed clock helpers for deterministic decay math.
const T0 = Date.parse('2026-06-20T10:00:00.000Z');
const DAY = 86400000;

function projectInstinct(overrides = {}) {
  return {
    id: 'prefer-ripgrep',
    trigger: 'searching file contents',
    confidence: 0.82,
    domain: 'shell',
    scope: 'project',
    project_id: 'a1b2c3d4e5f6',
    source: 'observer',
    reinforcements: 4,
    action: 'Use `rg` instead of `grep -r` for content searches.',
    evidence: '- 2026-06-19 corrected `grep -r` → `rg` twice',
    ...overrides,
  };
}

// --- write → read round-trip ------------------------------------------------

test('write→read preserves every frontmatter field + both body sections', () => {
  const env = freshEnv();
  const inst = projectInstinct();
  const filepath = write(inst, env, HOME);

  const got = read(filepath);
  assert.equal(got.id, 'prefer-ripgrep');
  assert.equal(got.trigger, 'searching file contents');
  assert.equal(got.confidence, 0.82);
  assert.equal(got.domain, 'shell');
  assert.equal(got.scope, 'project');
  assert.equal(got.project_id, 'a1b2c3d4e5f6');
  assert.equal(got.source, 'observer');
  assert.equal(got.reinforcements, 4);
  assert.equal(got.action, 'Use `rg` instead of `grep -r` for content searches.');
  assert.equal(got.evidence, '- 2026-06-19 corrected `grep -r` → `rg` twice');
  // created/updated stamped on write.
  assert.ok(got.created, 'created stamped');
  assert.ok(got.updated, 'updated stamped');
});

test('write preserves an existing created timestamp, restamps updated', () => {
  const env = freshEnv();
  const created = '2026-01-01T00:00:00.000Z';
  const filepath = write(projectInstinct({ created }), env, HOME);
  const got = read(filepath);
  assert.equal(got.created, created);
  assert.notEqual(got.updated, created); // updated is "now", not the old created
});

test('multi-line body sections round-trip faithfully', () => {
  const env = freshEnv();
  const action = 'Line one.\nLine two with `code`.';
  const evidence = '- first item\n- second item\n- third item';
  const filepath = write(projectInstinct({ action, evidence }), env, HOME);
  const got = read(filepath);
  assert.equal(got.action, action);
  assert.equal(got.evidence, evidence);
});

// --- scope routing ----------------------------------------------------------

test('write routes scope=project under projectInstinctsDir', () => {
  const env = freshEnv();
  const filepath = write(projectInstinct(), env, HOME);
  const { projectInstinctsDir } = layout('a1b2c3d4e5f6', env, HOME);
  assert.equal(path.dirname(filepath), projectInstinctsDir);
  assert.equal(path.basename(filepath), 'prefer-ripgrep.md');
  assert.equal(fs.existsSync(filepath), true);
});

test('write routes scope=global under globalInstinctsDir (no project_id)', () => {
  const env = freshEnv();
  const inst = projectInstinct({ scope: 'global', project_id: undefined, id: 'global-habit' });
  const filepath = write(inst, env, HOME);
  const { globalInstinctsDir } = layout('whatever', env, HOME);
  assert.equal(path.dirname(filepath), globalInstinctsDir);
  // A global instinct emits no project_id line.
  const got = read(filepath);
  assert.equal(got.scope, 'global');
  assert.equal('project_id' in got, false);
});

// --- readById ---------------------------------------------------------------

test('readById finds a written instinct and returns null when missing', () => {
  const env = freshEnv();
  write(projectInstinct(), env, HOME);
  const got = readById(
    'prefer-ripgrep',
    { scope: 'project', projectId: 'a1b2c3d4e5f6' },
    env,
    HOME,
  );
  assert.equal(got.id, 'prefer-ripgrep');
  const missing = readById(
    'nope',
    { scope: 'project', projectId: 'a1b2c3d4e5f6' },
    env,
    HOME,
  );
  assert.equal(missing, null);
});

// --- SECURITY: id trust boundary (path traversal / arbitrary file write) -----
// op.id flows from UNTRUSTED model output into the instinct filename. A hostile
// id like "../../../../ESCAPED" must NOT write outside the instinct dir. The
// guard lives at the lib/instincts trust boundary so EVERY caller is covered.

const HOSTILE_IDS = [
  '../../../../ESCAPED_EVIL',
  '..',
  '../sibling',
  'a/b',           // contains a slash
  'a\\b',          // contains a backslash
  '.hidden',       // starts with a dot
  '.',             // bare dot
  '',              // empty
];

test('write THROWS on a hostile id and writes NOTHING outside the dir', () => {
  const env = freshEnv();
  const root = env.XDG_STATE_HOME; // the tmp store root
  for (const badId of HOSTILE_IDS) {
    const inst = projectInstinct({ id: badId });
    assert.throws(
      () => write(inst, env, HOME),
      /id/i,
      `write should throw for hostile id ${JSON.stringify(badId)}`,
    );
  }
  // Empirically: nothing landed anywhere outside the tmp store root. The classic
  // "../../../../ESCAPED_EVIL" target would resolve well above `root`; assert no
  // such file exists anywhere up the tree from root.
  let probe = path.resolve(root);
  for (let i = 0; i < 8; i++) {
    assert.equal(
      fs.existsSync(path.join(probe, 'ESCAPED_EVIL.md')),
      false,
      `no escaped file at ${probe}`,
    );
    probe = path.dirname(probe);
  }
});

test('write with a normal id still round-trips after the guard', () => {
  const env = freshEnv();
  const filepath = write(projectInstinct({ id: 'normal-id_123' }), env, HOME);
  assert.equal(path.basename(filepath), 'normal-id_123.md');
  assert.equal(read(filepath).id, 'normal-id_123');
});

test('readById THROWS on a hostile id (no existence probe outside the dir)', () => {
  const env = freshEnv();
  for (const badId of HOSTILE_IDS) {
    assert.throws(
      () => readById(badId, { scope: 'project', projectId: 'a1b2c3d4e5f6' }, env, HOME),
      /id/i,
      `readById should throw for hostile id ${JSON.stringify(badId)}`,
    );
  }
});

test('readById with a normal missing id returns null (not throw)', () => {
  const env = freshEnv();
  const got = readById('totally-absent', { scope: 'project', projectId: 'a1b2c3d4e5f6' }, env, HOME);
  assert.equal(got, null);
});

// --- reinforce --------------------------------------------------------------

test('reinforce: 0.5 → 0.6 (RATE 0.2), bumps reinforcements + updated', () => {
  const before = projectInstinct({ confidence: 0.5, reinforcements: 2, updated: '2026-01-01T00:00:00.000Z' });
  const after = reinforce(before);
  // 0.5 + (1 - 0.5) * 0.2 = 0.6
  assert.ok(Math.abs(after.confidence - 0.6) < 1e-9, `expected ~0.6, got ${after.confidence}`);
  assert.equal(after.reinforcements, 3);
  assert.notEqual(after.updated, before.updated);
  // does not mutate the input
  assert.equal(before.confidence, 0.5);
  assert.equal(before.reinforcements, 2);
});

test('repeated reinforce approaches but never reaches 1.0', () => {
  let inst = projectInstinct({ confidence: 0.5 });
  for (let i = 0; i < 200; i++) {
    inst = reinforce(inst);
    assert.ok(inst.confidence < 1.0, `confidence reached/exceeded 1.0 at iter ${i}`);
  }
  // After many bumps it should be very close to 1.0.
  assert.ok(inst.confidence > 0.99, `expected >0.99 after 200 reinforces, got ${inst.confidence}`);
});

test('reinforce honors a custom rate', () => {
  const after = reinforce(projectInstinct({ confidence: 0.5 }), { rate: 0.5 });
  // 0.5 + (1 - 0.5) * 0.5 = 0.75
  assert.ok(Math.abs(after.confidence - 0.75) < 1e-9, `expected ~0.75, got ${after.confidence}`);
});

// --- effectiveConfidence (decay) --------------------------------------------

test('effectiveConfidence: fresh 0.9 ≈ 0.9', () => {
  const inst = projectInstinct({ confidence: 0.9, updated: new Date(T0).toISOString() });
  const eff = effectiveConfidence(inst, T0);
  assert.ok(Math.abs(eff - 0.9) < 1e-9, `expected ~0.9, got ${eff}`);
});

test('effectiveConfidence: 30 days old (one half-life) ≈ 0.45', () => {
  const inst = projectInstinct({ confidence: 0.9, updated: new Date(T0).toISOString() });
  const eff = effectiveConfidence(inst, T0 + 30 * DAY);
  assert.ok(Math.abs(eff - 0.45) < 1e-6, `expected ~0.45, got ${eff}`);
});

test('effectiveConfidence: 60 days old (two half-lives) ≈ 0.225', () => {
  const inst = projectInstinct({ confidence: 0.9, updated: new Date(T0).toISOString() });
  const eff = effectiveConfidence(inst, T0 + 60 * DAY);
  assert.ok(Math.abs(eff - 0.225) < 1e-6, `expected ~0.225, got ${eff}`);
});

test('effectiveConfidence: missing/invalid updated → no decay (raw value)', () => {
  const inst = projectInstinct({ confidence: 0.8, updated: undefined });
  assert.equal(effectiveConfidence(inst, T0), 0.8);
});

// --- forProject -------------------------------------------------------------

test('forProject returns this project + global, excludes another project, sorted best-first', () => {
  const env = freshEnv();
  const now = T0;
  const freshUpdated = new Date(now).toISOString();

  // projA project-scoped instincts (raw confidences 0.6 and 0.9, fresh).
  write(projectInstinct({ id: 'pa-low', project_id: 'projA', confidence: 0.6, updated: freshUpdated }), env, HOME);
  write(projectInstinct({ id: 'pa-high', project_id: 'projA', confidence: 0.9, updated: freshUpdated }), env, HOME);
  // A global instinct (raw 0.75, fresh).
  write(projectInstinct({ id: 'g-mid', scope: 'global', project_id: undefined, confidence: 0.75, updated: freshUpdated }), env, HOME);
  // A DIFFERENT project's instinct — must NOT appear.
  write(projectInstinct({ id: 'pb-secret', project_id: 'projB', confidence: 0.95, updated: freshUpdated }), env, HOME);

  const got = forProject('projA', { now }, env, HOME);
  const ids = got.map((i) => i.id);

  assert.deepEqual(ids, ['pa-high', 'g-mid', 'pa-low'], 'sorted best-first by effective confidence');
  assert.ok(!ids.includes('pb-secret'), 'must exclude another project\'s instinct');
});

// --- list minConfidence filter (decay drops a stale instinct) ----------------

test('list({ minConfidence: 0.7 }) drops an instinct decayed below 0.7', () => {
  const env = freshEnv();

  // write() restamps `updated` to "now"; capture each real stamp so we can advance
  // the evaluation clock relative to it (decay is measured from the stored `updated`).
  const freshPath = write(projectInstinct({ id: 'fresh', project_id: 'projX', confidence: 0.9 }), env, HOME);
  const stalePath = write(projectInstinct({ id: 'stale', project_id: 'projX', confidence: 0.9 }), env, HOME);
  const writtenAt = Date.parse(read(freshPath).updated);
  assert.equal(Date.parse(read(stalePath).updated) >= writtenAt - 5, true);

  // Evaluate 60 days (two half-lives) after the write: raw 0.9 → eff ≈ 0.225 < 0.7.
  const now = writtenAt + 60 * DAY;
  const kept = list({ projectId: 'projX', scope: 'project', minConfidence: 0.7, now }, env, HOME).map((i) => i.id);
  // Both were written "now", so both decay equally — both fall below 0.7 at +60d.
  assert.deepEqual(kept, [], 'instincts decayed below 0.7 are all dropped at +60d');

  // And at the moment of writing, both are above the bar (no decay yet).
  const keptFresh = list({ projectId: 'projX', scope: 'project', minConfidence: 0.7, now: writtenAt }, env, HOME).map((i) => i.id);
  assert.deepEqual(keptFresh.sort(), ['fresh', 'stale'], 'fresh instincts kept');
});

test('list({ minConfidence }) keeps a fresh evaluation but drops the same instinct after a half-life', () => {
  const env = freshEnv();

  // Decay is a pure function of the stored `updated` and the evaluation `now`.
  // Write once (capturing the real `updated` stamp), then move the evaluation clock
  // forward and watch the same instinct cross the minConfidence bar.
  const aPath = write(projectInstinct({ id: 'a', project_id: 'projZ', confidence: 0.9 }), env, HOME);
  const writtenAt = Date.parse(read(aPath).updated);

  // Fresh evaluation: a (0.9) is kept at minConfidence 0.7.
  assert.deepEqual(
    list({ projectId: 'projZ', scope: 'project', minConfidence: 0.7, now: writtenAt }, env, HOME).map((i) => i.id),
    ['a'],
  );
  // One half-life later: a decays to ~0.45 < 0.7 and is dropped.
  assert.deepEqual(
    list({ projectId: 'projZ', scope: 'project', minConfidence: 0.7, now: writtenAt + 30 * DAY }, env, HOME).map((i) => i.id),
    [],
  );
});

test('list without minConfidence returns everything regardless of decay', () => {
  const env = freshEnv();
  write(projectInstinct({ id: 'a', project_id: 'projY' }), env, HOME);
  write(projectInstinct({ id: 'b', project_id: 'projY' }), env, HOME);
  // Even a far-future evaluation clock returns all files when no minConfidence is set.
  const farFuture = Date.now() + 3650 * DAY;
  const ids = list({ projectId: 'projY', scope: 'project', now: farFuture }, env, HOME).map((i) => i.id).sort();
  assert.deepEqual(ids, ['a', 'b']);
});

// =============================================================================
// --- remove -----------------------------------------------------------------
// =============================================================================

test('remove: deletes the correct project-scoped file; returns true', () => {
  const env = freshEnv();
  const inst = projectInstinct({ id: 'rm-target', project_id: 'projRm' });
  const filepath = write(inst, env, HOME);
  assert.equal(fs.existsSync(filepath), true, 'file should exist before remove');
  const result = remove(inst, env, HOME);
  assert.equal(result, true, 'remove returns true when file existed');
  assert.equal(fs.existsSync(filepath), false, 'file should be gone after remove');
});

test('remove: returns false for an absent instinct (idempotent)', () => {
  const env = freshEnv();
  const inst = projectInstinct({ id: 'not-written', project_id: 'projRm2' });
  const result = remove(inst, env, HOME);
  assert.equal(result, false, 'remove returns false when file did not exist');
});

test('remove: works for a global-scoped instinct', () => {
  const env = freshEnv();
  const inst = projectInstinct({ id: 'global-rm', scope: 'global', project_id: undefined });
  const filepath = write(inst, env, HOME);
  assert.equal(fs.existsSync(filepath), true, 'global file should exist before remove');
  const result = remove(inst, env, HOME);
  assert.equal(result, true, 'remove returns true for global instinct');
  assert.equal(fs.existsSync(filepath), false, 'global file should be gone after remove');
});

test('remove: throws on a hostile id (path traversal blocked)', () => {
  const env = freshEnv();
  for (const badId of HOSTILE_IDS) {
    const inst = projectInstinct({ id: badId });
    assert.throws(
      () => remove(inst, env, HOME),
      /id/i,
      `remove should throw for hostile id ${JSON.stringify(badId)}`,
    );
  }
});

// =============================================================================
// --- promote -----------------------------------------------------------------
// =============================================================================

test('promote: project→global moves the file (global readById succeeds; project readById → null)', () => {
  const env = freshEnv();
  const inst = projectInstinct({ id: 'promote-me', project_id: 'projPr1' });
  write(inst, env, HOME);

  const { promoted, from, to } = promote(inst, env, HOME);
  assert.equal(promoted, true, 'promoted should be true');

  // Old project file is gone.
  assert.equal(fs.existsSync(from), false, 'original project file should be removed');
  // New global file exists.
  assert.equal(fs.existsSync(to), true, 'global file should exist');

  // readById confirms the move.
  const globalGot = readById('promote-me', { scope: 'global' }, env, HOME);
  assert.ok(globalGot, 'global readById should find the promoted instinct');
  assert.equal(globalGot.scope, 'global', 'promoted instinct should be global-scoped');
  assert.equal('project_id' in globalGot, false, 'promoted instinct should have no project_id');

  const projectGot = readById('promote-me', { scope: 'project', projectId: 'projPr1' }, env, HOME);
  assert.equal(projectGot, null, 'project readById should return null after promotion');
});

test('promote: preserves confidence, reinforcements, and created on the promoted copy', () => {
  const env = freshEnv();
  const created = '2026-05-01T12:00:00.000Z';
  const inst = projectInstinct({
    id: 'preserve-fields',
    project_id: 'projPr2',
    confidence: 0.91,
    reinforcements: 7,
    created,
  });
  write(inst, env, HOME);

  promote(inst, env, HOME);

  const globalGot = readById('preserve-fields', { scope: 'global' }, env, HOME);
  assert.ok(globalGot, 'should find promoted instinct');
  assert.equal(globalGot.confidence, 0.91, 'confidence preserved');
  assert.equal(globalGot.reinforcements, 7, 'reinforcements preserved');
  assert.equal(globalGot.created, created, 'created preserved');
});

test('promote: scope=global input is a no-op (promoted:false, original file untouched)', () => {
  const env = freshEnv();
  const inst = projectInstinct({ id: 'already-global', scope: 'global', project_id: undefined });
  const filepath = write(inst, env, HOME);

  const { promoted, from, to } = promote(inst, env, HOME);
  assert.equal(promoted, false, 'promoted should be false for already-global input');
  assert.equal(from, to, 'from and to should be the same path');
  // File still intact.
  assert.equal(fs.existsSync(filepath), true, 'global file should still exist after no-op promote');
  const got = readById('already-global', { scope: 'global' }, env, HOME);
  assert.ok(got, 'global instinct should still be readable');
});

test('promote: list({scope:"global"}) includes it; list({scope:"project"}) no longer does', () => {
  const env = freshEnv();
  const inst = projectInstinct({ id: 'list-move', project_id: 'projPr3' });
  write(inst, env, HOME);

  // Before: appears in project list, not global.
  const beforeProject = list({ projectId: 'projPr3', scope: 'project' }, env, HOME).map((i) => i.id);
  assert.ok(beforeProject.includes('list-move'), 'should be in project list before promote');
  const beforeGlobal = list({ scope: 'global' }, env, HOME).map((i) => i.id);
  assert.ok(!beforeGlobal.includes('list-move'), 'should NOT be in global list before promote');

  promote(inst, env, HOME);

  // After: appears in global list, not project.
  const afterGlobal = list({ scope: 'global' }, env, HOME).map((i) => i.id);
  assert.ok(afterGlobal.includes('list-move'), 'should appear in global list after promote');
  const afterProject = list({ projectId: 'projPr3', scope: 'project' }, env, HOME).map((i) => i.id);
  assert.ok(!afterProject.includes('list-move'), 'should NOT appear in project list after promote');
});
