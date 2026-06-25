// Tests for lib/observer-runner.js — the detached observer's logic. Every test
// injects deps.runModel (canned ops; never spawns claude) and isolates the store
// under a fresh tmp XDG_STATE_HOME (mirrors obs-log.test.js). node:test +
// node:assert/strict; run with `node --test`.

'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const runner = require('./observer-runner.js');
const obsLog = require('./obs-log.js');
const instincts = require('./instincts.js');
const { layout } = require('./paths.ts');

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxtlvl-runner-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
});

function env() {
  return { XDG_STATE_HOME: tmpDir };
}

let counter = 0;
function freshProject() {
  counter += 1;
  return `proj-${counter}-${Date.now()}`;
}

function seed(projectId, n) {
  for (let i = 0; i < n; i++) {
    obsLog.append(projectId, { event: 'tool_complete', tool: 'Bash', output: `run ${i}` }, { env: env() });
  }
}

// A lock file the runner should unlink in its finally.
function makeLock(projectId) {
  const paths = layout(projectId, env());
  fs.mkdirSync(paths.projectDir, { recursive: true });
  const lockPath = path.join(paths.projectDir, 'observer.s1.lock');
  fs.writeFileSync(lockPath, 'held');
  return lockPath;
}

function livenessLines(projectId) {
  const paths = layout(projectId, env());
  try {
    return fs.readFileSync(paths.livenessLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

// --- apply: create + reinforce ------------------------------------------------

test('create + reinforce ops produce/update instinct files under the tmp store', () => {
  const p = freshProject();
  seed(p, 5);

  // Pre-create an instinct that a "reinforce" op will bump.
  instincts.write(
    {
      id: 'use-rg',
      trigger: 'searching code',
      confidence: 0.7,
      domain: 'search',
      scope: 'project',
      project_id: p,
      source: 'seed',
      action: 'prefer ripgrep',
      evidence: 'seed',
      reinforcements: 0,
    },
    env(),
  );

  const ops = JSON.stringify({
    operations: [
      {
        kind: 'create',
        trigger: 'after a failing test',
        action: 'run the focused test first',
        domain: 'testing',
        evidence: 'observed error->fix twice',
        confidence: 0.8,
      },
      { kind: 'reinforce', id: 'use-rg', evidence: 'used rg again' },
    ],
  });

  const res = runner.runObserver(
    { projectId: p, session: 's1', lockPath: null },
    { runModel: () => ops, env: env() },
  );

  assert.equal(res.outcome, 'ok');
  assert.equal(res.counts.created, 1, 'one instinct created');
  assert.equal(res.counts.reinforced, 1, 'one instinct reinforced');

  // The created instinct exists with the model's fields.
  const list = instincts.list({ projectId: p, scope: 'project' }, env());
  const created = list.find((i) => i.trigger === 'after a failing test');
  assert.ok(created, 'created instinct is on disk');
  assert.equal(created.domain, 'testing');
  assert.equal(created.action, 'run the focused test first');
  assert.equal(created.scope, 'project', 'scope round-trips through the frontmatter');
  assert.equal(created.project_id, p, 'created instinct is project-scoped to this project');

  // The reinforced instinct bumped confidence + reinforcements.
  const bumped = instincts.readById('use-rg', { scope: 'project', projectId: p }, env());
  assert.ok(bumped.confidence > 0.7, 'confidence bumped above the seed');
  assert.equal(bumped.reinforcements, 1, 'reinforcements incremented');
  assert.equal(bumped.project_id, p, 'project_id preserved on reinforce');
});

// --- liveness: success --------------------------------------------------------

test('liveness line written + lock released after a successful pass', () => {
  const p = freshProject();
  seed(p, 3);
  const lockPath = makeLock(p);

  const ops = JSON.stringify({ operations: [] });
  runner.runObserver(
    { projectId: p, session: 's1', lockPath },
    { runModel: () => ops, env: env() },
  );

  const lines = livenessLines(p);
  assert.equal(lines.length, 1, 'exactly one liveness line');
  assert.equal(lines[0].outcome, 'ok');
  assert.equal(lines[0].component, 'observer');
  assert.equal(lines[0].counts.read, 3, 'liveness records the batch size');
  assert.equal(fs.existsSync(lockPath), false, 'lock released on completion');
});

// --- liveness: forced error in runModel --------------------------------------

test('runModel throwing → no instincts, liveness records error, lock released', () => {
  const p = freshProject();
  seed(p, 4);
  const lockPath = makeLock(p);

  const res = runner.runObserver(
    { projectId: p, session: 's1', lockPath },
    {
      runModel: () => {
        throw new Error('model boom');
      },
      env: env(),
    },
  );

  assert.equal(res.outcome, 'error');
  assert.equal(instincts.list({ projectId: p, scope: 'project' }, env()).length, 0, 'no instincts written');

  const lines = livenessLines(p);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].outcome, 'error', 'liveness marks the failure');
  assert.equal(fs.existsSync(lockPath), false, 'lock released even on error');
});

// --- parse failure ------------------------------------------------------------

test('unparseable model output → no instincts written, outcome error, no throw', () => {
  const p = freshProject();
  seed(p, 3);

  let res;
  assert.doesNotThrow(() => {
    res = runner.runObserver(
      { projectId: p, session: 's1', lockPath: null },
      { runModel: () => 'this is prose, not json at all', env: env() },
    );
  });
  assert.equal(instincts.list({ projectId: p, scope: 'project' }, env()).length, 0);
  assert.equal(res.outcome, 'error', 'parse failure is surfaced as error');
});

test('model returns explicit empty ops → ok outcome, no instincts', () => {
  const p = freshProject();
  seed(p, 3);
  const res = runner.runObserver(
    { projectId: p, session: 's1', lockPath: null },
    { runModel: () => '{"operations":[]}', env: env() },
  );
  assert.equal(res.outcome, 'ok', 'empty ops is a clean pass, not an error');
  assert.equal(instincts.list({ projectId: p, scope: 'project' }, env()).length, 0);
});

// --- zero new observations ----------------------------------------------------

test('zero new observations → no instincts, clean exit, lock released, model not called', () => {
  const p = freshProject();
  const lockPath = makeLock(p);
  let modelCalled = false;

  const res = runner.runObserver(
    { projectId: p, session: 's1', lockPath },
    {
      runModel: () => {
        modelCalled = true;
        return '{"operations":[]}';
      },
      env: env(),
    },
  );

  assert.equal(modelCalled, false, 'model not invoked with nothing to distil');
  assert.equal(res.counts.read, 0);
  assert.equal(instincts.list({ projectId: p, scope: 'project' }, env()).length, 0);
  const lines = livenessLines(p);
  assert.equal(lines.length, 1, 'liveness still written on the empty pass');
  assert.equal(lines[0].outcome, 'ok');
  assert.equal(fs.existsSync(lockPath), false, 'lock released on the empty pass');
});

// --- cursor advance -----------------------------------------------------------

test('cursor advances: a second runObserver sees no new observations', () => {
  const p = freshProject();
  seed(p, 5);
  const ops = '{"operations":[]}';

  const first = runner.runObserver(
    { projectId: p, session: 's1', lockPath: null },
    { runModel: () => ops, env: env() },
  );
  assert.equal(first.counts.read, 5, 'first pass reads the batch');

  const second = runner.runObserver(
    { projectId: p, session: 's1', lockPath: null },
    { runModel: () => ops, env: env() },
  );
  assert.equal(second.counts.read, 0, 'cursor advanced — nothing re-read');
});

// --- malformed ops are skipped, good ones applied -----------------------------

test('malformed ops are skipped while valid ones apply', () => {
  const p = freshProject();
  seed(p, 3);
  const ops = JSON.stringify({
    operations: [
      { kind: 'create' }, // missing trigger/action → skip
      { kind: 'bogus', foo: 1 }, // unknown kind → skip
      null, // junk → skip
      { kind: 'reinforce' }, // missing id → skip
      {
        kind: 'create',
        trigger: 'committing',
        action: 'run lint first',
        domain: 'git',
        evidence: 'pattern',
        confidence: 0.9,
      },
    ],
  });

  const res = runner.runObserver(
    { projectId: p, session: 's1', lockPath: null },
    { runModel: () => ops, env: env() },
  );
  assert.equal(res.counts.created, 1, 'only the valid create applied');
  assert.equal(res.counts.skipped, 4, 'four malformed ops skipped');
});

// --- SECURITY: hostile op.id never escapes the store -------------------------

test('hostile create op.id is slugified (never written verbatim outside the store)', () => {
  const p = freshProject();
  seed(p, 3);
  const root = path.join(tmpDir, 'nxtlvl'); // storageRoot under XDG_STATE_HOME
  const ops = JSON.stringify({
    operations: [
      {
        kind: 'create',
        id: '../../../../ESCAPED_EVIL',
        trigger: 'malicious',
        action: 'pwn',
        domain: 'evil',
        evidence: 'x',
        confidence: 0.8,
      },
    ],
  });

  const res = runner.runObserver(
    { projectId: p, session: 's1', lockPath: null },
    { runModel: () => ops, env: env() },
  );

  // The op is still applied (defense-in-depth slugifies, not drops) but lands inside.
  assert.equal(res.outcome, 'ok');
  // Nothing escaped: no ESCAPED_EVIL.md anywhere up the tree from the store root.
  let probe = path.resolve(root);
  for (let i = 0; i < 8; i++) {
    assert.equal(fs.existsSync(path.join(probe, 'ESCAPED_EVIL.md')), false, `no escaped file at ${probe}`);
    probe = path.dirname(probe);
  }
  // The created instinct exists, with a safe slugged id (no slashes / dots).
  const list = instincts.list({ projectId: p, scope: 'project' }, env());
  assert.equal(list.length, 1, 'op applied with a safe id');
  assert.ok(!/[\\/]/.test(list[0].id), 'slugged id has no path separators');
  assert.ok(!list[0].id.startsWith('.'), 'slugged id does not start with a dot');
});

test('hostile reinforce op.id is dropped (skipped), batch proceeds', () => {
  const p = freshProject();
  seed(p, 3);
  const ops = JSON.stringify({
    operations: [
      { kind: 'reinforce', id: '../../../../ESCAPED_EVIL', evidence: 'x' },
      {
        kind: 'create',
        trigger: 'good op after a hostile one',
        action: 'do the right thing',
        domain: 'testing',
        evidence: 'y',
        confidence: 0.8,
      },
    ],
  });

  const res = runner.runObserver(
    { projectId: p, session: 's1', lockPath: null },
    { runModel: () => ops, env: env() },
  );

  assert.equal(res.outcome, 'ok');
  assert.equal(res.counts.created, 1, 'the good op after the hostile one still applies');
  assert.ok(res.counts.skipped >= 1, 'hostile reinforce op was dropped');
});

// --- BOUNDS: cap ops per batch + clamp field lengths -------------------------

test('thousands of ops → only MAX_OPS_PER_BATCH applied, rest dropped', () => {
  const p = freshProject();
  seed(p, 3);
  const operations = [];
  for (let i = 0; i < 5000; i++) {
    operations.push({
      kind: 'create',
      trigger: `trigger ${i}`,
      action: `action ${i}`,
      domain: 'bulk',
      evidence: 'e',
      confidence: 0.8,
    });
  }
  const res = runner.runObserver(
    { projectId: p, session: 's1', lockPath: null },
    { runModel: () => JSON.stringify({ operations }), env: env() },
  );
  const list = instincts.list({ projectId: p, scope: 'project' }, env());
  assert.equal(list.length, runner.MAX_OPS_PER_BATCH, 'only the capped number written');
  assert.ok(res.counts.created <= runner.MAX_OPS_PER_BATCH);
});

test('huge field values are clamped before writing', () => {
  const p = freshProject();
  seed(p, 3);
  const huge = 'x'.repeat(100000);
  const ops = JSON.stringify({
    operations: [
      {
        kind: 'create',
        trigger: huge,
        action: huge,
        domain: huge,
        evidence: huge,
        confidence: 0.8,
      },
    ],
  });
  runner.runObserver(
    { projectId: p, session: 's1', lockPath: null },
    { runModel: () => ops, env: env() },
  );
  const list = instincts.list({ projectId: p, scope: 'project' }, env());
  assert.equal(list.length, 1);
  const inst = list[0];
  assert.ok(inst.trigger.length <= runner.MAX_FIELD_LEN, `trigger clamped (${inst.trigger.length})`);
  assert.ok(inst.action.length <= runner.MAX_FIELD_LEN, `action clamped (${inst.action.length})`);
  assert.ok(inst.domain.length <= runner.MAX_FIELD_LEN, `domain clamped (${inst.domain.length})`);
  assert.ok(inst.evidence.length <= runner.MAX_FIELD_LEN, `evidence clamped (${inst.evidence.length})`);
});

// --- MINOR: confidence accepts the documented inclusive 0..1 -----------------

test('confidence 0 and 1 (inclusive) are accepted as-is', () => {
  const p = freshProject();
  seed(p, 3);
  const ops = JSON.stringify({
    operations: [
      { kind: 'create', trigger: 't0', action: 'a0', domain: 'd', evidence: 'e', confidence: 0 },
      { kind: 'create', trigger: 't1', action: 'a1', domain: 'd', evidence: 'e', confidence: 1 },
    ],
  });
  runner.runObserver(
    { projectId: p, session: 's1', lockPath: null },
    { runModel: () => ops, env: env() },
  );
  const list = instincts.list({ projectId: p, scope: 'project' }, env());
  const byTrigger = Object.fromEntries(list.map((i) => [i.trigger, i.confidence]));
  assert.equal(byTrigger.t0, 0, 'confidence 0 accepted');
  assert.equal(byTrigger.t1, 1, 'confidence 1 accepted');
});

// --- parseOps unit ------------------------------------------------------------

test('parseOps tolerates array, wrapped object, embedded json, and junk', () => {
  assert.deepEqual(runner.parseOps('[]'), []);
  assert.deepEqual(runner.parseOps('{"operations":[{"kind":"create"}]}'), [{ kind: 'create' }]);
  assert.deepEqual(runner.parseOps([{ kind: 'reinforce' }]), [{ kind: 'reinforce' }]);
  assert.deepEqual(
    runner.parseOps('here are your ops: {"operations":[{"kind":"create"}]} thanks'),
    [{ kind: 'create' }],
  );
  assert.deepEqual(runner.parseOps('totally not json'), []);
});

// --- buildPrompt unit ---------------------------------------------------------

test('buildPrompt names the four patterns and renders observations', () => {
  const prompt = runner.buildPrompt(
    [{ event: 'tool_complete', tool: 'Bash', output: 'npm test' }],
    [{ id: 'x', trigger: 't', domain: 'd' }],
  );
  assert.match(prompt, /corrections/);
  assert.match(prompt, /error->fix/);
  assert.match(prompt, /repeated workflows/);
  assert.match(prompt, /tool preferences/);
  assert.match(prompt, /npm test/, 'observation payload rendered');
  assert.match(prompt, /id=x/, 'existing instinct surfaced for reinforce');
});
