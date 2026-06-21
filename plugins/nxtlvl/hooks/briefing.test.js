// Tests for hooks/briefing.js — the C&M SessionStart briefing hook.
//
// Strategy: all acceptance criteria are tested via the run() injectable-deps seam.
// For tests that seed the real store (instincts + obs-log), we point process.env
// XDG_STATE_HOME at a fresh tmp dir (same pattern as bookmarks.test.js / capture.test.js).
// For targeted unit tests (staleness flag, truncation nudge, guards, fail-open), we
// inject lightweight fakes via deps so no real I/O is required.
//
// Run with: node --test "plugins/nxtlvl/hooks/briefing.test.js"

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const os     = require('node:os');
const path   = require('node:path');

const { run, isOffLike, isBriefingDisabled, isObserverRun, renderInstinctsBlock } = require('./briefing.js');
const obsLog     = require('../lib/obs-log.js');
const bookmarks  = require('../lib/bookmarks.js');
const instincts  = require('../lib/instincts.js');
const { projectIdentity } = require('../lib/project-identity.js');

// ---------------------------------------------------------------------------
// Shared tmp root — each test that needs real store I/O gets a sub-dir.
// ---------------------------------------------------------------------------

let sharedTmp;
let counter = 0;

before(() => {
  sharedTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nxtlvl-briefing-test-'));
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
// Helpers: build a minimal SessionStart event payload.
// ---------------------------------------------------------------------------

function sessionEvent(extras = {}) {
  return JSON.stringify({
    hook_event_name: 'SessionStart',
    cwd: process.cwd(),
    session_id: 'test-session-briefing',
    ...extras,
  });
}

// Parse the additionalContext from the hook's JSON output.
function parseContext(out) {
  assert.ok(out && out.trim(), 'output must be non-empty');
  const parsed = JSON.parse(out);
  assert.ok(parsed.hookSpecificOutput, 'must have hookSpecificOutput');
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  return parsed.hookSpecificOutput.additionalContext;
}

// ---------------------------------------------------------------------------
// Minimal fake deps factories.
// ---------------------------------------------------------------------------

function fakeDeps(overrides = {}) {
  return {
    gitLine: () => 'Branch `main` · clean',
    recall: () => ({ injected: [], truncatedNames: [], total: 0 }),
    bookmarks: {
      groupKeyFor: () => 'main',
      readNewest: () => null,
      isStale: () => false,
    },
    obsLog: {
      readAll: () => [],
    },
    projectIdentity: () => ({ key: 'fake-proj-key', source: 'folder', raw: '/fake' }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Acceptance tests — all three blocks present when data exists
// ---------------------------------------------------------------------------

test('all three blocks are present when git line, bookmark and instincts all exist', () => {
  const deps = fakeDeps({
    gitLine: () => 'Branch `feat/x` · 3 uncommitted changes',
    recall: () => ({
      injected: [
        { id: 'prefer-ripgrep', trigger: 'use ripgrep', action: 'Prefer rg over grep.', confidence: 0.9 },
      ],
      truncatedNames: [],
      total: 1,
    }),
    bookmarks: {
      groupKeyFor: () => 'feat-x',
      readNewest: () => ({ ts: '2026-01-15T10:00:00.000Z', note: 'Implementing the widget', branch: 'feat-x' }),
      isStale: () => false,
    },
    obsLog: { readAll: () => [] },
  });

  const out = run(sessionEvent(), mkEnv(freshTmp()), deps);
  const ctx = parseContext(out);

  // Git block
  assert.ok(ctx.includes('feat/x'), 'git line includes branch name');
  assert.ok(ctx.includes('3 uncommitted changes'), 'git line includes change count');

  // Bookmark block
  assert.ok(ctx.includes('Implementing the widget'), 'bookmark note text present');

  // Instincts block
  assert.ok(ctx.includes('prefer-ripgrep'), 'instinct id present');
  assert.ok(ctx.includes('Prefer rg over grep'), 'instinct action gist present');
});

test('no-bookmark case renders gracefully (no crash)', () => {
  const deps = fakeDeps(); // readNewest returns null, no obs → "No saved bookmark..."

  const out = run(sessionEvent(), mkEnv(freshTmp()), deps);
  const ctx = parseContext(out);
  assert.ok(ctx.includes('No saved bookmark'), 'no-bookmark message present');
});

test('no-instincts case renders gracefully (no crash)', () => {
  const deps = fakeDeps(); // recall returns injected: [] total: 0

  const out = run(sessionEvent(), mkEnv(freshTmp()), deps);
  const ctx = parseContext(out);
  assert.ok(ctx.includes('No instincts loaded'), 'no-instincts message present');
});

// ---------------------------------------------------------------------------
// Staleness flag: present only when obs log is newer than bookmark
// ---------------------------------------------------------------------------

test('staleness flag is shown when observation log is newer than the bookmark', () => {
  const bookmarkTs = '2026-01-10T08:00:00.000Z';
  const obsTs      = '2026-01-11T08:00:00.000Z'; // obs is NEWER

  const deps = fakeDeps({
    bookmarks: {
      groupKeyFor: () => 'main',
      readNewest: () => ({ ts: bookmarkTs, note: 'saved note', branch: 'main' }),
      isStale: (projectId, groupKey, compareTs) => {
        // Real staleness logic: compareTs newer than bookmarkTs → true
        if (!compareTs) return false;
        return new Date(compareTs).getTime() > new Date(bookmarkTs).getTime();
      },
    },
    obsLog: {
      readAll: () => [{ id: '1', seq: 0, ts: obsTs, event: 'tool_start', tool: 'Read' }],
    },
  });

  const out = run(sessionEvent(), mkEnv(freshTmp()), deps);
  const ctx = parseContext(out);
  assert.ok(ctx.includes('newer activity') || ctx.includes('incomplete'), 'staleness flag present when obs newer');
  assert.ok(ctx.includes('saved note'), 'bookmark note still shown');
});

test('staleness flag is absent when bookmark is newer than (or equal to) observation log', () => {
  const obsTs      = '2026-01-09T08:00:00.000Z';
  const bookmarkTs = '2026-01-10T08:00:00.000Z'; // bookmark is NEWER

  const deps = fakeDeps({
    bookmarks: {
      groupKeyFor: () => 'main',
      readNewest: () => ({ ts: bookmarkTs, note: 'up-to-date note', branch: 'main' }),
      isStale: (projectId, groupKey, compareTs) => {
        if (!compareTs) return false;
        return new Date(compareTs).getTime() > new Date(bookmarkTs).getTime();
      },
    },
    obsLog: {
      readAll: () => [{ id: '1', seq: 0, ts: obsTs, event: 'tool_start', tool: 'Read' }],
    },
  });

  const out = run(sessionEvent(), mkEnv(freshTmp()), deps);
  const ctx = parseContext(out);
  assert.ok(!ctx.includes('newer activity') && !ctx.includes('incomplete'), 'no staleness flag when bookmark is current');
  assert.ok(ctx.includes('up-to-date note'), 'bookmark note shown');
});

test('staleness flag is absent when no observations exist', () => {
  const deps = fakeDeps({
    bookmarks: {
      groupKeyFor: () => 'main',
      readNewest: () => ({ ts: '2026-01-10T08:00:00.000Z', note: 'note with no obs', branch: 'main' }),
      isStale: () => false, // null compareTs → false
    },
    obsLog: { readAll: () => [] },
  });

  const out = run(sessionEvent(), mkEnv(freshTmp()), deps);
  const ctx = parseContext(out);
  assert.ok(!ctx.includes('newer activity') && !ctx.includes('incomplete'), 'no staleness flag when no obs');
});

// ---------------------------------------------------------------------------
// Over-ceiling nudge: NAMES the truncated instincts, not just a count
// ---------------------------------------------------------------------------

test('over-ceiling emits a nudge that NAMES the truncated instincts', () => {
  const deps = fakeDeps({
    recall: () => ({
      injected: [
        { id: 'inst-1', trigger: 'trigger-one', action: 'Do thing one.', confidence: 0.95 },
        { id: 'inst-2', trigger: 'trigger-two', action: 'Do thing two.', confidence: 0.90 },
      ],
      truncatedNames: ['prefer-ripgrep', 'branch-before-commit'],
      total: 4,
    }),
  });

  const out = run(sessionEvent(), mkEnv(freshTmp()), deps);
  const ctx = parseContext(out);

  // Loaded instincts present
  assert.ok(ctx.includes('inst-1'), 'loaded instinct id present');
  assert.ok(ctx.includes('inst-2'), 'loaded instinct id present');

  // Truncated names named explicitly (not just a count)
  assert.ok(ctx.includes('prefer-ripgrep'), 'truncated instinct name 1 in nudge');
  assert.ok(ctx.includes('branch-before-commit'), 'truncated instinct name 2 in nudge');
  assert.ok(ctx.includes('/evolve'), 'evolve nudge present');
});

test('over-ceiling: specific truncated ids appear in output', () => {
  // Directly test renderInstinctsBlock for precision.
  const result = renderInstinctsBlock({
    injected: [{ id: 'top', trigger: 'top-trigger', action: 'Top action.', confidence: 0.95 }],
    truncatedNames: ['alpha-id', 'beta-id', 'gamma-id'],
    total: 4,
  });

  assert.ok(result.includes('alpha-id'), 'alpha-id in nudge');
  assert.ok(result.includes('beta-id'), 'beta-id in nudge');
  assert.ok(result.includes('gamma-id'), 'gamma-id in nudge');
  assert.ok(result.includes('/evolve'), '/evolve present in nudge');
});

// ---------------------------------------------------------------------------
// Kill switch: NXTLVL_CM_BRIEFING=off → ''
// ---------------------------------------------------------------------------

test('kill switch NXTLVL_CM_BRIEFING=off returns ""', () => {
  const out = run(sessionEvent(), mkEnv(freshTmp(), { NXTLVL_CM_BRIEFING: 'off' }), fakeDeps());
  assert.equal(out, '', 'kill switch off returns ""');
});

test('kill switch NXTLVL_CM_BRIEFING=0 returns ""', () => {
  const out = run(sessionEvent(), mkEnv(freshTmp(), { NXTLVL_CM_BRIEFING: '0' }), fakeDeps());
  assert.equal(out, '');
});

test('kill switch NXTLVL_CM_BRIEFING=false returns ""', () => {
  const out = run(sessionEvent(), mkEnv(freshTmp(), { NXTLVL_CM_BRIEFING: 'false' }), fakeDeps());
  assert.equal(out, '');
});

test('kill switch NXTLVL_CM_BRIEFING=disabled returns ""', () => {
  const out = run(sessionEvent(), mkEnv(freshTmp(), { NXTLVL_CM_BRIEFING: 'disabled' }), fakeDeps());
  assert.equal(out, '');
});

// ---------------------------------------------------------------------------
// Observer guard: NXTLVL_CM_OBSERVER set → ''
// ---------------------------------------------------------------------------

test('observer guard NXTLVL_CM_OBSERVER=1 returns ""', () => {
  const out = run(sessionEvent(), mkEnv(freshTmp(), { NXTLVL_CM_OBSERVER: '1' }), fakeDeps());
  assert.equal(out, '', 'observer flag suppresses briefing');
});

test('observer guard NXTLVL_CM_OBSERVER=true returns ""', () => {
  const out = run(sessionEvent(), mkEnv(freshTmp(), { NXTLVL_CM_OBSERVER: 'true' }), fakeDeps());
  assert.equal(out, '');
});

// ---------------------------------------------------------------------------
// Sidechain guard: isSidechain=true → ''
// ---------------------------------------------------------------------------

test('isSidechain=true returns ""', () => {
  const out = run(sessionEvent({ isSidechain: true }), mkEnv(freshTmp()), fakeDeps());
  assert.equal(out, '', 'sidechain event suppressed');
});

// ---------------------------------------------------------------------------
// Fail-open: throwing dep returns '', never throws
// ---------------------------------------------------------------------------

test('fail-open: throwing recall returns "", never throws', () => {
  const deps = fakeDeps({
    recall: () => { throw new Error('recall exploded'); },
  });
  let out;
  assert.doesNotThrow(() => {
    out = run(sessionEvent(), mkEnv(freshTmp()), deps);
  });
  assert.equal(out, '', 'returns "" when recall throws');
});

test('fail-open: throwing bookmarks returns "", never throws', () => {
  const deps = fakeDeps({
    bookmarks: {
      groupKeyFor: () => { throw new Error('bookmarks exploded'); },
      readNewest: () => null,
      isStale: () => false,
    },
  });
  let out;
  assert.doesNotThrow(() => {
    out = run(sessionEvent(), mkEnv(freshTmp()), deps);
  });
  assert.equal(out, '', 'returns "" when bookmarks throws');
});

test('fail-open: throwing obsLog returns "", never throws', () => {
  const deps = fakeDeps({
    obsLog: { readAll: () => { throw new Error('obslog exploded'); } },
  });
  let out;
  assert.doesNotThrow(() => {
    out = run(sessionEvent(), mkEnv(freshTmp()), deps);
  });
  assert.equal(out, '', 'returns "" when obsLog throws');
});

test('fail-open: malformed stdin JSON returns "", never throws', () => {
  let out;
  assert.doesNotThrow(() => {
    out = run('{ this is not json {{{}', mkEnv(freshTmp()), fakeDeps());
  });
  assert.equal(out, '', 'returns "" on bad JSON');
});

test('fail-open: empty stdin returns valid briefing (empty = {})', () => {
  // Empty input parses as {} — cwd falls back to process.cwd(), deps handle the rest.
  const out = run('', mkEnv(freshTmp()), fakeDeps());
  // Should produce a valid briefing (process.cwd() is valid), not throw.
  assert.doesNotThrow(() => JSON.parse(out));
});

// ---------------------------------------------------------------------------
// Output shape: JSON with hookSpecificOutput.hookEventName = 'SessionStart'
// ---------------------------------------------------------------------------

test('output has correct hookSpecificOutput.hookEventName = SessionStart', () => {
  const out = run(sessionEvent(), mkEnv(freshTmp()), fakeDeps());
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.ok(typeof parsed.hookSpecificOutput.additionalContext === 'string', 'additionalContext is a string');
  assert.ok(parsed.hookSpecificOutput.additionalContext.length > 0, 'additionalContext is non-empty');
});

test('output heading includes project label', () => {
  const out = run(sessionEvent(), mkEnv(freshTmp()), fakeDeps());
  const ctx = parseContext(out);
  assert.ok(ctx.includes('nxtlvl') || ctx.includes('where you left off'), 'heading includes project label');
});

// ---------------------------------------------------------------------------
// Integration: real store seeded via instincts.write + bookmarks.append + obs-log.append
// ---------------------------------------------------------------------------

test('integration: real instinct from store appears in briefing', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const projKey = projectIdentity(process.cwd()).key;

    // Seed one strong project-scoped instinct.
    instincts.write({
      id: 'use-absolute-paths',
      trigger: 'path construction',
      confidence: 0.85,
      domain: 'shell',
      scope: 'project',
      project_id: projKey,
      source: 'observer',
      reinforcements: 2,
      action: 'Always use absolute paths to avoid cwd ambiguity.',
      evidence: '- observed twice',
    }, { XDG_STATE_HOME: tmp }, '/home/u');

    // Run with real recall but fake git line and bookmarks (to isolate).
    const deps = fakeDeps({
      recall: (args, envArg) => {
        // Use the real recall, passing our tmp store.
        const recallReal = require('../lib/recall.js').recall;
        return recallReal({ projectId: args.projectId }, { XDG_STATE_HOME: tmp }, '/home/u');
      },
      projectIdentity: () => ({ key: projKey, source: 'git-common-dir', raw: '/repo/.git' }),
    });

    const out = run(sessionEvent(), mkEnv(tmp), deps);
    const ctx = parseContext(out);
    assert.ok(ctx.includes('use-absolute-paths'), 'real instinct id appears in briefing');
    assert.ok(ctx.includes('absolute paths') || ctx.includes('ambiguity'), 'real instinct action gist present');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('integration: real bookmark from store appears in briefing', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const projKey = projectIdentity(process.cwd()).key;
    // groupKeyFor uses branchOrFolderKey(cwd) — use real module on process.cwd().
    const groupKey = bookmarks.groupKeyFor(process.cwd());

    // Seed a bookmark.
    bookmarks.append(projKey, groupKey, 'Working on the integration test suite');

    // Inject bookmarks dep that reads from the tmp store.
    // bookmarks.js doesn't accept env, so we wrap the real module while process.env
    // is temporarily pointing at our store (already set above).
    const deps = fakeDeps({
      bookmarks: {
        groupKeyFor: bookmarks.groupKeyFor,
        readNewest: bookmarks.readNewest,
        isStale: bookmarks.isStale,
      },
      obsLog: { readAll: () => [] },
      projectIdentity: () => ({ key: projKey, source: 'git-common-dir', raw: '/repo/.git' }),
    });

    const out = run(sessionEvent(), mkEnv(tmp), deps);
    const ctx = parseContext(out);
    assert.ok(ctx.includes('integration test suite'), 'real bookmark note appears in briefing');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('integration: staleness flag via real obs-log activity newer than bookmark', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const projKey = projectIdentity(process.cwd()).key;
    const groupKey = bookmarks.groupKeyFor(process.cwd());

    // Write a bookmark first.
    bookmarks.append(projKey, groupKey, 'Saved checkpoint', { ts: '2026-01-10T08:00:00.000Z' });

    // Append an observation NEWER than the bookmark.
    obsLog.append(projKey, { event: 'tool_start', tool: 'Read', ts: '2026-01-11T09:00:00.000Z' },
      { env: { XDG_STATE_HOME: tmp } });

    // Use real bookmarks (reads from process.env.XDG_STATE_HOME) and real obsLog.
    const deps = fakeDeps({
      bookmarks: {
        groupKeyFor: bookmarks.groupKeyFor,
        readNewest: bookmarks.readNewest,
        isStale: bookmarks.isStale,
      },
      obsLog: {
        readAll: (projId, opts) => obsLog.readAll(projId, opts),
      },
      projectIdentity: () => ({ key: projKey, source: 'git-common-dir', raw: '/repo/.git' }),
    });

    const out = run(sessionEvent(), mkEnv(tmp), deps);
    const ctx = parseContext(out);
    assert.ok(ctx.includes('newer activity') || ctx.includes('incomplete'), 'staleness flag present for newer obs');
    assert.ok(ctx.includes('Saved checkpoint'), 'bookmark note still shown');
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

test('isBriefingDisabled: checks NXTLVL_CM_BRIEFING', () => {
  assert.equal(isBriefingDisabled({ NXTLVL_CM_BRIEFING: 'off' }), true);
  assert.equal(isBriefingDisabled({ NXTLVL_CM_BRIEFING: '1' }), false);
  assert.equal(isBriefingDisabled({}), false);
});

test('isObserverRun: truthy non-off values trigger guard', () => {
  assert.equal(isObserverRun({ NXTLVL_CM_OBSERVER: '1' }), true);
  assert.equal(isObserverRun({ NXTLVL_CM_OBSERVER: 'true' }), true);
  assert.equal(isObserverRun({ NXTLVL_CM_OBSERVER: 'off' }), false);
  assert.equal(isObserverRun({}), false);
});

test('renderInstinctsBlock: empty result renders gracefully', () => {
  const result = renderInstinctsBlock({ injected: [], truncatedNames: [], total: 0 });
  assert.ok(result.includes('No instincts loaded'), 'graceful empty message');
});

test('renderInstinctsBlock: single instinct with trigger', () => {
  const result = renderInstinctsBlock({
    injected: [{ id: 'my-id', trigger: 'my-trigger', action: 'Do the thing.\nSecond line.', confidence: 0.8 }],
    truncatedNames: [],
    total: 1,
  });
  assert.ok(result.includes('my-trigger'), 'trigger present');
  assert.ok(result.includes('my-id'), 'id present');
  assert.ok(result.includes('Do the thing.'), 'first line of action as gist');
  assert.ok(!result.includes('Second line.'), 'second action line NOT shown (one-line gist)');
});

test('renderInstinctsBlock: instinct without trigger falls back to id only', () => {
  const result = renderInstinctsBlock({
    injected: [{ id: 'bare-id', trigger: '', action: 'Some action.', confidence: 0.8 }],
    truncatedNames: [],
    total: 1,
  });
  assert.ok(result.includes('bare-id'), 'id fallback present');
});
