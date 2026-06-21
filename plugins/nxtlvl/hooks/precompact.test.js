// Tests for hooks/precompact.js — the C&M PreCompact steer hook.
//
// Strategy: all acceptance criteria tested via run(rawInput, env, deps).
// For tests that need a real bookmark store, we point process.env.XDG_STATE_HOME
// at a fresh tmp dir (same pattern as briefing.test.js / close.test.js).
// The hook performs NO writes, so every test asserts the store is untouched.
//
// Run with: node --test "plugins/nxtlvl/hooks/precompact.test.js"

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');

const { run, isOffLike, isPrecompactDisabled, isObserverRun, extractOpenFiles, buildSteer } =
  require('./precompact.js');
const bookmarks = require('../lib/bookmarks.js');
const { projectIdentity } = require('../lib/project-identity.js');

// ---------------------------------------------------------------------------
// Shared tmp root — each test that writes to the store gets its own sub-dir.
// ---------------------------------------------------------------------------

let sharedTmp;
let counter = 0;

before(() => {
  sharedTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nxtlvl-precompact-test-'));
});

after(() => {
  fs.rmSync(sharedTmp, { recursive: true, force: true });
});

function freshTmp() {
  counter += 1;
  const dir = path.join(sharedTmp, `t${counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function mkEnv(tmpDir, extra = {}) {
  return { XDG_STATE_HOME: tmpDir, ...extra };
}

// ---------------------------------------------------------------------------
// Helpers: build PreCompact event payload + fake transcript string
// ---------------------------------------------------------------------------

function precompactEvent(extras = {}) {
  return JSON.stringify({
    hook_event_name: 'PreCompact',
    cwd: process.cwd(),
    session_id: 'test-session-precompact',
    trigger: 'manual',
    transcript_path: null,
    ...extras,
  });
}

/**
 * Build a fake JSONL transcript string.
 * Each call in `toolCalls` is: { name, filePath, sidechain? }.
 * Wraps them in a synthetic assistant message per call (to mirror the real
 * transcript shape that extractOpenFiles parses).
 */
function fakeTranscript(toolCalls = []) {
  const lines = [];
  for (const tc of toolCalls) {
    const inputKey = tc.name === 'NotebookEdit' ? 'notebook_path' : 'file_path';
    const item = {
      type: 'tool_use',
      name: tc.name,
      input: { [inputKey]: tc.filePath },
    };
    const msg = {
      type: 'assistant',
      isSidechain: tc.sidechain === true ? true : undefined,
      message: { content: [item], usage: { input_tokens: 100 } },
    };
    lines.push(JSON.stringify(msg));
  }
  return lines.join('\n');
}

// Parse the additionalContext from the hook output.
function parseContext(out) {
  assert.ok(out && out.trim(), 'output must be non-empty');
  const parsed = JSON.parse(out);
  assert.ok(parsed.hookSpecificOutput, 'must have hookSpecificOutput');
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreCompact');
  return parsed.hookSpecificOutput.additionalContext;
}

// Minimal fake deps: no real I/O.
function fakeDeps(overrides = {}) {
  return {
    bookmarks: {
      groupKeyFor: () => 'main',
      readNewest: () => null,
    },
    readTranscript: () => '',
    projectIdentity: () => ({ key: 'fake-proj-key', source: 'folder', raw: '/fake' }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Acceptance: emits the steer block with all three required parts
// ---------------------------------------------------------------------------

test('emits steer block with preserve-task instruction when bookmark + open files exist', () => {
  const tx = fakeTranscript([
    { name: 'Read', filePath: '/repo/foo.js' },
    { name: 'Edit', filePath: '/repo/bar.js' },
  ]);

  const deps = fakeDeps({
    bookmarks: {
      groupKeyFor: () => 'feat-x',
      readNewest: () => ({ ts: '2026-06-10T12:00:00.000Z', note: 'Implementing the widget', branch: 'feat-x' }),
    },
    readTranscript: () => tx,
  });

  const out = run(precompactEvent(), mkEnv(freshTmp()), deps);
  const ctx = parseContext(out);

  // Part 1: preserve-task instruction
  assert.ok(ctx.includes('preserve the current task'), 'preserve-task instruction present');
  assert.ok(ctx.includes('immediate next step'), 'next-step instruction present');

  // Part 2: bookmark words
  assert.ok(ctx.includes('Implementing the widget'), 'bookmark note words present');

  // Part 3: open files
  assert.ok(ctx.includes('/repo/foo.js'), 'open file 1 present');
  assert.ok(ctx.includes('/repo/bar.js'), 'open file 2 present');
});

test('output hookEventName is PreCompact', () => {
  const out = run(precompactEvent(), mkEnv(freshTmp()), fakeDeps());
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreCompact');
});

test('heading includes nxtlvl project label', () => {
  const out = run(precompactEvent(), mkEnv(freshTmp()), fakeDeps());
  const ctx = parseContext(out);
  assert.ok(ctx.includes('nxtlvl'), 'heading includes nxtlvl label');
});

// ---------------------------------------------------------------------------
// Open-files extraction: dedup, most-recent-first, cap, sidechain ignored
// ---------------------------------------------------------------------------

test('open-files: de-duplicates and returns most-recent-first', () => {
  const tx = fakeTranscript([
    { name: 'Read',  filePath: '/a.js' },
    { name: 'Read',  filePath: '/b.js' },
    { name: 'Edit',  filePath: '/a.js' }, // /a.js again — duplicate
    { name: 'Write', filePath: '/c.js' },
  ]);
  // extractOpenFiles scan order: /a.js, /b.js (a already seen, skip), /c.js
  // after dedupe ordered = [/a.js, /b.js, /c.js] → reversed = [/c.js, /b.js, /a.js]
  const files = extractOpenFiles(tx);
  assert.equal(files[0], '/c.js', 'most recent first');
  assert.equal(files[1], '/b.js');
  assert.equal(files[2], '/a.js');
  assert.equal(files.length, 3, 'no duplicate /a.js');
});

test('open-files: sidechain tool_use blocks are ignored', () => {
  const tx = fakeTranscript([
    { name: 'Read', filePath: '/main.js', sidechain: false },
    { name: 'Read', filePath: '/side.js', sidechain: true },  // must be ignored
  ]);
  const files = extractOpenFiles(tx);
  assert.ok(files.includes('/main.js'), 'main-thread file present');
  assert.ok(!files.includes('/side.js'), 'sidechain file absent');
});

test('open-files: capped at 8 entries', () => {
  const calls = [];
  for (let i = 0; i < 12; i++) calls.push({ name: 'Read', filePath: `/file${i}.js` });
  const tx = fakeTranscript(calls);
  const files = extractOpenFiles(tx);
  assert.equal(files.length, 8, 'capped at 8');
});

test('open-files: NotebookEdit uses notebook_path key', () => {
  const lines = [JSON.stringify({
    type: 'assistant',
    isSidechain: undefined,
    message: {
      content: [{ type: 'tool_use', name: 'NotebookEdit', input: { notebook_path: '/nb.ipynb' } }],
      usage: { input_tokens: 50 },
    },
  })];
  const tx = lines.join('\n');
  const files = extractOpenFiles(tx);
  assert.ok(files.includes('/nb.ipynb'), 'NotebookEdit notebook_path extracted');
});

test('open-files: MultiEdit uses file_path key', () => {
  const tx = fakeTranscript([{ name: 'MultiEdit', filePath: '/multi.js' }]);
  const files = extractOpenFiles(tx);
  assert.ok(files.includes('/multi.js'), 'MultiEdit file_path extracted');
});

test('open-files: empty transcript yields empty array', () => {
  const files = extractOpenFiles('');
  assert.equal(files.length, 0);
});

test('no-open-files: block is omitted from steer text', () => {
  const deps = fakeDeps({
    bookmarks: {
      groupKeyFor: () => 'main',
      readNewest: () => ({ ts: '2026-06-10T12:00:00.000Z', note: 'A note', branch: 'main' }),
    },
    readTranscript: () => '',
  });
  const out = run(precompactEvent(), mkEnv(freshTmp()), deps);
  const ctx = parseContext(out);
  assert.ok(!ctx.includes('Key open files'), 'open-files block absent when none');
});

// ---------------------------------------------------------------------------
// No-bookmark case: renders gracefully
// ---------------------------------------------------------------------------

test('no-bookmark: renders gracefully with preserve instruction still present', () => {
  const deps = fakeDeps(); // readNewest returns null
  const out = run(precompactEvent(), mkEnv(freshTmp()), deps);
  const ctx = parseContext(out);
  assert.ok(ctx.includes('No saved bookmark'), 'no-bookmark message present');
  assert.ok(ctx.includes('preserve the current task'), 'preserve instruction still present');
});

// ---------------------------------------------------------------------------
// NO WRITES: store is untouched after run()
// ---------------------------------------------------------------------------

test('NO WRITES: bookmark store is untouched after run()', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const projKey = projectIdentity(process.cwd()).key;
    const groupKey = bookmarks.groupKeyFor(process.cwd());

    // Seed a bookmark so we have something to compare before/after.
    bookmarks.append(projKey, groupKey, 'Seeded note before precompact', {
      ts: '2026-06-01T10:00:00.000Z',
    });

    const beforeNewest = bookmarks.readNewest(projKey, groupKey);
    assert.ok(beforeNewest, 'seeded bookmark readable');

    // Run the hook with real bookmarks (reads process.env.XDG_STATE_HOME).
    const deps = {
      bookmarks: {
        groupKeyFor: bookmarks.groupKeyFor,
        readNewest: bookmarks.readNewest,
      },
      readTranscript: () => '',
      projectIdentity: () => ({ key: projKey, source: 'git-common-dir', raw: '/repo/.git' }),
    };

    run(precompactEvent(), mkEnv(tmp), deps);

    // Assert store is unchanged.
    const afterNewest = bookmarks.readNewest(projKey, groupKey);
    assert.deepEqual(afterNewest, beforeNewest, 'bookmark store untouched after precompact run');
    const trail = bookmarks.readTrail(projKey, groupKey);
    assert.equal(trail.length, 1, 'no new bookmark record written');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('NO WRITES: no bookmark file created when store was empty before run()', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const projKey = projectIdentity(process.cwd()).key;
    const groupKey = bookmarks.groupKeyFor(process.cwd());

    // Confirm nothing exists yet.
    assert.equal(bookmarks.readNewest(projKey, groupKey), null, 'store empty before run');

    const deps = {
      bookmarks: {
        groupKeyFor: bookmarks.groupKeyFor,
        readNewest: bookmarks.readNewest,
      },
      readTranscript: () => '',
      projectIdentity: () => ({ key: projKey, source: 'git-common-dir', raw: '/repo/.git' }),
    };

    run(precompactEvent(), mkEnv(tmp), deps);

    assert.equal(bookmarks.readNewest(projKey, groupKey), null, 'store still empty after run');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// ---------------------------------------------------------------------------
// Absolute fail-open: throwing dep → '' and no throw
// ---------------------------------------------------------------------------

test('fail-open: throwing readTranscript returns "", never throws', () => {
  const deps = fakeDeps({
    readTranscript: () => { throw new Error('transcript exploded'); },
  });
  let out;
  assert.doesNotThrow(() => {
    out = run(precompactEvent(), mkEnv(freshTmp()), deps);
  });
  assert.equal(out, '', 'returns "" when readTranscript throws');
});

test('fail-open: throwing bookmarks.readNewest returns "", never throws', () => {
  const deps = fakeDeps({
    bookmarks: {
      groupKeyFor: () => 'main',
      readNewest: () => { throw new Error('bookmarks exploded'); },
    },
  });
  let out;
  assert.doesNotThrow(() => {
    out = run(precompactEvent(), mkEnv(freshTmp()), deps);
  });
  assert.equal(out, '', 'returns "" when readNewest throws');
});

test('fail-open: throwing projectIdentity returns "", never throws', () => {
  const deps = fakeDeps({
    projectIdentity: () => { throw new Error('identity exploded'); },
  });
  let out;
  assert.doesNotThrow(() => {
    out = run(precompactEvent(), mkEnv(freshTmp()), deps);
  });
  assert.equal(out, '', 'returns "" when projectIdentity throws');
});

test('fail-open: malformed stdin JSON returns "", never throws', () => {
  let out;
  assert.doesNotThrow(() => {
    out = run('{ not valid json {{', mkEnv(freshTmp()), fakeDeps());
  });
  assert.equal(out, '', 'returns "" on bad JSON');
});

// ---------------------------------------------------------------------------
// Kill switch: NXTLVL_CM_PRECOMPACT=off → ''
// ---------------------------------------------------------------------------

test('kill switch NXTLVL_CM_PRECOMPACT=off returns ""', () => {
  const out = run(precompactEvent(), mkEnv(freshTmp(), { NXTLVL_CM_PRECOMPACT: 'off' }), fakeDeps());
  assert.equal(out, '');
});

test('kill switch NXTLVL_CM_PRECOMPACT=0 returns ""', () => {
  const out = run(precompactEvent(), mkEnv(freshTmp(), { NXTLVL_CM_PRECOMPACT: '0' }), fakeDeps());
  assert.equal(out, '');
});

test('kill switch NXTLVL_CM_PRECOMPACT=false returns ""', () => {
  const out = run(precompactEvent(), mkEnv(freshTmp(), { NXTLVL_CM_PRECOMPACT: 'false' }), fakeDeps());
  assert.equal(out, '');
});

test('kill switch NXTLVL_CM_PRECOMPACT=disabled returns ""', () => {
  const out = run(precompactEvent(), mkEnv(freshTmp(), { NXTLVL_CM_PRECOMPACT: 'disabled' }), fakeDeps());
  assert.equal(out, '');
});

// ---------------------------------------------------------------------------
// Observer guard: NXTLVL_CM_OBSERVER set → ''
// ---------------------------------------------------------------------------

test('observer guard NXTLVL_CM_OBSERVER=1 returns ""', () => {
  const out = run(precompactEvent(), mkEnv(freshTmp(), { NXTLVL_CM_OBSERVER: '1' }), fakeDeps());
  assert.equal(out, '', 'observer flag suppresses precompact');
});

test('observer guard NXTLVL_CM_OBSERVER=true returns ""', () => {
  const out = run(precompactEvent(), mkEnv(freshTmp(), { NXTLVL_CM_OBSERVER: 'true' }), fakeDeps());
  assert.equal(out, '');
});

// ---------------------------------------------------------------------------
// Sidechain guard: isSidechain=true → ''
// ---------------------------------------------------------------------------

test('isSidechain=true returns ""', () => {
  const out = run(precompactEvent({ isSidechain: true }), mkEnv(freshTmp()), fakeDeps());
  assert.equal(out, '', 'sidechain event suppressed');
});

// ---------------------------------------------------------------------------
// Integration: real bookmark from store appears in steer text
// ---------------------------------------------------------------------------

test('integration: real bookmark from store appears in precompact steer text', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const projKey = projectIdentity(process.cwd()).key;
    const groupKey = bookmarks.groupKeyFor(process.cwd());

    bookmarks.append(projKey, groupKey, 'Working on the precompact feature', {
      ts: '2026-06-20T09:00:00.000Z',
    });

    const deps = {
      bookmarks: {
        groupKeyFor: bookmarks.groupKeyFor,
        readNewest: bookmarks.readNewest,
      },
      readTranscript: () => '',
      projectIdentity: () => ({ key: projKey, source: 'git-common-dir', raw: '/repo/.git' }),
    };

    const out = run(precompactEvent(), mkEnv(tmp), deps);
    const ctx = parseContext(out);
    assert.ok(ctx.includes('precompact feature'), 'real bookmark note appears in steer text');
    assert.ok(ctx.includes('preserve the current task'), 'preserve instruction always present');

    // Store still untouched.
    const trail = bookmarks.readTrail(projKey, groupKey);
    assert.equal(trail.length, 1, 'no extra bookmark written by precompact hook');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// ---------------------------------------------------------------------------
// Unit tests for helper functions
// ---------------------------------------------------------------------------

test('isOffLike recognises all off values', () => {
  for (const v of ['off', 'OFF', '0', 'false', 'FALSE', 'no', 'NO', 'disabled', 'DISABLED']) {
    assert.equal(isOffLike(v), true, `isOffLike("${v}") should be true`);
  }
  for (const v of ['1', 'true', 'yes', 'on', '', undefined, null, 'anything']) {
    assert.equal(isOffLike(v), false, `isOffLike(${JSON.stringify(v)}) should be false`);
  }
});

test('isPrecompactDisabled: checks NXTLVL_CM_PRECOMPACT', () => {
  assert.equal(isPrecompactDisabled({ NXTLVL_CM_PRECOMPACT: 'off' }), true);
  assert.equal(isPrecompactDisabled({ NXTLVL_CM_PRECOMPACT: '1' }), false);
  assert.equal(isPrecompactDisabled({}), false);
});

test('isObserverRun: truthy non-off values trigger guard', () => {
  assert.equal(isObserverRun({ NXTLVL_CM_OBSERVER: '1' }), true);
  assert.equal(isObserverRun({ NXTLVL_CM_OBSERVER: 'true' }), true);
  assert.equal(isObserverRun({ NXTLVL_CM_OBSERVER: 'off' }), false);
  assert.equal(isObserverRun({}), false);
});

test('buildSteer: with bookmark and open files contains all three parts', () => {
  const bookmark = { ts: '2026-06-10T12:00:00.000Z', note: 'Testing the build', branch: 'main' };
  const openFiles = ['/a.js', '/b.js'];
  const result = buildSteer(bookmark, openFiles, 'manual');
  assert.ok(result.includes('preserve the current task'), 'preserve instruction');
  assert.ok(result.includes('Testing the build'), 'bookmark note');
  assert.ok(result.includes('/a.js'), 'open file 1');
  assert.ok(result.includes('/b.js'), 'open file 2');
});

test('buildSteer: no bookmark shows placeholder', () => {
  const result = buildSteer(null, [], 'auto');
  assert.ok(result.includes('No saved bookmark'), 'no-bookmark placeholder');
});

test('buildSteer: empty open files omits the files block', () => {
  const bookmark = { ts: '2026-06-10T12:00:00.000Z', note: 'A note', branch: 'main' };
  const result = buildSteer(bookmark, [], 'manual');
  assert.ok(!result.includes('Key open files'), 'files block absent when empty');
});
