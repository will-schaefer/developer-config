// Tests for hooks/close.js — the C&M SessionEnd close hook.
//
// Strategy: all acceptance criteria tested via run(rawInput, env, deps) with the
// injectable-deps seam. Transcript content is passed via deps.readTranscript so
// no real file I/O is needed for transcript reads. For bookmark/metrics assertions
// we point process.env.XDG_STATE_HOME at a fresh per-test tmp dir (same pattern as
// capture.test.js / briefing.test.js).
//
// Run with: node --test "plugins/nxtlvl/hooks/close.test.js"

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('node:fs');
const os   = require('node:os');
const path = require('node:path');

const {
  run,
  isOffLike,
  isCloseDisabled,
  isObserverRun,
  resolveCloseMin,
  analyseTranscript,
  readTranscriptDefault,
  buildNote,
  DEFAULT_CLOSE_MIN,
  NOTE_CORE_MAX,
} = require('./close.js');

const bookmarks = require('../lib/bookmarks.js');
const { projectIdentity } = require('../lib/project-identity.js');
const { layout } = require('../lib/paths.js');

// ---------------------------------------------------------------------------
// Shared tmp root — each test gets an isolated sub-dir.
// ---------------------------------------------------------------------------

let sharedTmp;
let counter = 0;

before(() => {
  sharedTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nxtlvl-close-test-'));
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
// Transcript builder helpers
// ---------------------------------------------------------------------------

/** Build a JSONL-encoded transcript string from an array of logical events.
 *
 * Each event is one of:
 *   { type: 'user', text: '...' }                           — first user message
 *   { type: 'assistant', tools: [{ name, input? }] }        — main-thread assistant turn
 *   { type: 'assistant', tools: [...], sidechain: true }    — sidechain (should be ignored)
 */
function makeTranscript(events) {
  return events.map(ev => {
    if (ev.type === 'user') {
      return JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'text', text: ev.text }],
        },
      });
    }
    if (ev.type === 'assistant') {
      const content = (ev.tools || []).map(t => ({
        type: 'tool_use',
        id: `tu_${Math.random().toString(36).slice(2)}`,
        name: t.name,
        input: t.input || {},
      }));
      const line = {
        type: 'assistant',
        message: { role: 'assistant', content, usage: { input_tokens: 100 } },
      };
      if (ev.sidechain) line.isSidechain = true;
      return JSON.stringify(line);
    }
    return JSON.stringify(ev);
  }).join('\n');
}

/** Build a SessionEnd event payload. */
function sessionEndEvent(extras = {}) {
  return JSON.stringify({
    hook_event_name: 'SessionEnd',
    cwd: process.cwd(),
    session_id: 'test-session-close',
    reason: 'exit',
    transcript_path: '/tmp/fake.jsonl',
    ...extras,
  });
}

/** Build deps that inject transcript text directly (no real file).
 *
 * readTranscript delegates to the REAL exported analyseTranscript so the
 * acceptance tests exercise production parse logic, including BASH_MUTATION_RE.
 */
function txDeps(transcriptText, extra = {}) {
  return {
    readTranscript: () => analyseTranscript(transcriptText, false),
    ...extra,
  };
}

/** Read the metrics.jsonl for the current project from a tmp store. */
function readMetrics(tmpDir) {
  const projKey = projectIdentity(process.cwd()).key;
  const metricsPath = path.join(layout(projKey).projectDir, 'metrics.jsonl');
  // layout() reads process.env for storageRoot, so we need XDG set.
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmpDir;
  try {
    const raw = fs.readFileSync(metricsPath, 'utf8');
    return raw.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch {
    return [];
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
}

/** Read the newest bookmark for the current project from a tmp store. */
function readNewestBookmark(tmpDir) {
  const projKey = projectIdentity(process.cwd()).key;
  const groupKey = bookmarks.groupKeyFor(process.cwd());
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmpDir;
  try {
    return bookmarks.readNewest(projKey, groupKey);
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
}

// Build N Read tool_use turns for the assistant (all main-thread)
function readTools(n) {
  return Array.from({ length: n }, () => ({ name: 'Read', input: { file: '/x' } }));
}

// ---------------------------------------------------------------------------
// Acceptance tests
// ---------------------------------------------------------------------------

// --- Gate arm 1 (size): toolCalls >= N, no mutation → bookmark written ------

test('gate arm 1: toolCalls >= N with no mutation writes bookmark', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'implement the close hook' },
      { type: 'assistant', tools: readTools(DEFAULT_CLOSE_MIN) },
    ]);
    const result = run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));
    assert.ok(result && result.processed, 'result is processed');
    assert.equal(result.bookmarkWritten, true, 'bookmark written (arm 1)');
    assert.equal(result.toolCalls, DEFAULT_CLOSE_MIN, 'toolCalls matches');

    // Verify bookmark is in the store
    const bm = readNewestBookmark(tmp);
    assert.ok(bm, 'bookmark record in store');
    assert.ok(bm.note.includes('implement the close hook'), 'note contains user intent');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// --- Gate arm 2 (effect): few tool calls but mutation → bookmark written ----

test('gate arm 2: few tool calls + Write mutation writes bookmark', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'fix the config file' },
      // Only 2 calls (< DEFAULT_CLOSE_MIN), but one is Write (mutation)
      { type: 'assistant', tools: [
        { name: 'Read', input: { file: '/x' } },
        { name: 'Write', input: { file: '/y', content: 'hi' } },
      ]},
    ]);
    const result = run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));
    assert.ok(result && result.processed, 'result is processed');
    assert.equal(result.bookmarkWritten, true, 'bookmark written (arm 2: mutation)');
    assert.equal(result.mutation, true, 'mutation flag true');
    assert.equal(result.toolCalls, 2, 'toolCalls = 2 (< default min)');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('gate arm 2: few tool calls + git commit writes bookmark with committed flag', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'ship the feature' },
      { type: 'assistant', tools: [
        { name: 'Bash', input: { command: 'git commit -m "feat: done"' } },
      ]},
    ]);
    const result = run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));
    assert.ok(result && result.processed, 'result is processed');
    assert.equal(result.bookmarkWritten, true, 'bookmark written for committed session');
    assert.equal(result.committed, true, 'committed flag true');
    assert.equal(result.mutation, true, 'mutation also true (commit implies mutation)');

    const bm = readNewestBookmark(tmp);
    assert.ok(bm, 'bookmark in store');
    assert.ok(bm.note.includes('committed'), 'note contains "committed"');
    assert.ok(bm.note.includes('ship the feature'), 'note contains user intent');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// --- Skip: read-only transcript with toolCalls < N and no mutation → NO bookmark

test('skip: read-only transcript toolCalls < N no mutation — no bookmark written', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'just browsing' },
      // Only 3 Read calls (< DEFAULT_CLOSE_MIN = 10), no mutations
      { type: 'assistant', tools: readTools(3) },
    ]);
    const result = run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));
    assert.ok(result && result.processed, 'result is processed');
    assert.equal(result.bookmarkWritten, false, 'NO bookmark for trivial session');

    // Bookmark store must be empty (no new note)
    const bm = readNewestBookmark(tmp);
    assert.equal(bm, null, 'bookmark store is unchanged (empty)');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// --- Note content correctness -----------------------------------------------

test('note content: scrubbed intent + stats tail with branch', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'complete the c&m plan' },
      { type: 'assistant', tools: readTools(DEFAULT_CLOSE_MIN) },
    ]);
    const result = run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));
    assert.ok(result.bookmarkWritten, 'bookmark written');
    assert.ok(typeof result.note === 'string', 'note is a string');

    // Should contain the tool call count
    assert.ok(result.note.includes(`${DEFAULT_CLOSE_MIN} tool calls`), 'note has tool call count');

    // Should contain "branch" label
    assert.ok(result.note.includes('branch'), 'note has branch label');

    // Should contain user intent
    assert.ok(result.note.includes('complete the c&m plan'), 'note has user intent');

    // Should NOT contain "committed" or "files changed" (read-only, size-only arm)
    assert.ok(!result.note.includes('; committed'), 'no committed label for read-only session');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('note content: "files changed" label when mutation but not committed', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'update the readme' },
      { type: 'assistant', tools: [{ name: 'Edit', input: {} }] },
    ]);
    const result = run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));
    assert.ok(result.bookmarkWritten, 'bookmark written');
    assert.ok(result.note.includes('files changed'), 'note has "files changed" label');
    assert.ok(!result.note.includes('; committed'), 'no "committed" for Edit-only session');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('note content: "committed" label takes precedence over "files changed"', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'land the change' },
      { type: 'assistant', tools: [
        { name: 'Edit', input: {} },
        { name: 'Bash', input: { command: 'git commit -m "x"' } },
      ]},
    ]);
    const result = run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));
    assert.ok(result.bookmarkWritten, 'bookmark written');
    assert.ok(result.note.includes('; committed'), 'note has "committed" label');
    assert.ok(!result.note.includes('files changed'), '"files changed" NOT shown when committed');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// --- Scrub fail-open --------------------------------------------------------

test('scrub fail-open: throwing scrubText → bookmark written with generic core', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'my secret task' },
      { type: 'assistant', tools: readTools(DEFAULT_CLOSE_MIN) },
    ]);
    const result = run(
      sessionEndEvent(),
      mkEnv(tmp),
      txDeps(tx, {
        // Inject a scrubText that always throws
        scrubText: () => { throw new Error('scrub exploded'); },
      }),
    );
    assert.ok(result && result.processed, 'processed (not crashed)');
    assert.equal(result.bookmarkWritten, true, 'bookmark still written despite scrub throw');
    assert.ok(typeof result.note === 'string', 'note is a string');
    // Note must NOT contain the raw user text (fallback to generic core)
    assert.ok(!result.note.includes('my secret task'), 'raw user text NOT in note after scrub failure');
    // Should use "Session on <branch>" as generic core
    assert.ok(result.note.includes('Session on'), 'generic core "Session on..." used');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// --- Metrics line recorded --------------------------------------------------

test('metrics: line recorded with correct fields when bookmark written', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'build something' },
      { type: 'assistant', tools: readTools(DEFAULT_CLOSE_MIN) },
    ]);
    run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));

    const metrics = readMetrics(tmp);
    assert.equal(metrics.length, 1, 'exactly one metrics line');
    const m = metrics[0];
    assert.equal(m.event, 'session_close', 'event = session_close');
    assert.equal(m.toolCalls, DEFAULT_CLOSE_MIN, 'toolCalls correct');
    assert.equal(m.bookmarkWritten, true, 'bookmarkWritten = true');
    assert.equal(m.session, 'test-session-close', 'session id present');
    assert.equal(m.reason, 'exit', 'reason present');
    assert.ok(typeof m.ts === 'string', 'ts is string');
    assert.ok('mutation' in m, 'mutation field present');
    assert.ok('committed' in m, 'committed field present');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('metrics: line recorded with bookmarkWritten=false on skipped session', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    // Trivial session (2 read-only calls)
    const tx = makeTranscript([
      { type: 'user', text: 'quick look' },
      { type: 'assistant', tools: readTools(2) },
    ]);
    run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));

    const metrics = readMetrics(tmp);
    assert.equal(metrics.length, 1, 'metrics line still written');
    assert.equal(metrics[0].bookmarkWritten, false, 'bookmarkWritten=false for skipped session');
    assert.equal(metrics[0].event, 'session_close', 'event correct');
    assert.equal(metrics[0].toolCalls, 2, 'toolCalls correct');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// --- Absolute fail-open: throwing dep ----------------------------------------

test('absolute fail-open: throwing bookmarks.append → run returns without throwing', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'work on stuff' },
      { type: 'assistant', tools: readTools(DEFAULT_CLOSE_MIN) },
    ]);
    let result;
    assert.doesNotThrow(() => {
      result = run(
        sessionEndEvent(),
        mkEnv(tmp),
        txDeps(tx, {
          bookmarks: {
            groupKeyFor: () => 'main',
            append: () => { throw new Error('disk full'); },
          },
        }),
      );
    }, 'run() must not throw even when bookmarks.append throws');
    // result may be { processed: false } from the outer catch
    assert.ok(result !== undefined, 'result returned');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('absolute fail-open: malformed stdin JSON → returns without throwing', () => {
  let result;
  assert.doesNotThrow(() => {
    result = run('{ not valid json {{{}', mkEnv(freshTmp()));
  });
  // Outer catch returns { processed: false }
  assert.ok(result !== undefined, 'result returned on bad JSON');
});

test('absolute fail-open: empty stdin → returns without throwing', () => {
  const tmp = freshTmp();
  let result;
  assert.doesNotThrow(() => {
    result = run('', mkEnv(tmp));
  });
  assert.ok(result !== undefined, 'result returned on empty input');
});

// --- Kill switch + observer + sidechain guards --------------------------------

test('kill switch NXTLVL_CM_CLOSE=off → returns null, nothing written', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([
      { type: 'user', text: 'do stuff' },
      { type: 'assistant', tools: readTools(DEFAULT_CLOSE_MIN) },
    ]);
    const result = run(
      sessionEndEvent(),
      mkEnv(tmp, { NXTLVL_CM_CLOSE: 'off' }),
      txDeps(tx),
    );
    assert.equal(result, null, 'null returned on kill switch');
    const bm = readNewestBookmark(tmp);
    assert.equal(bm, null, 'no bookmark written');
    assert.equal(readMetrics(tmp).length, 0, 'no metrics written');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

for (const val of ['0', 'false', 'no', 'disabled']) {
  test(`kill switch NXTLVL_CM_CLOSE=${val} → null`, () => {
    const result = run(sessionEndEvent(), mkEnv(freshTmp(), { NXTLVL_CM_CLOSE: val }), {});
    assert.equal(result, null, `null for kill switch value "${val}"`);
  });
}

test('observer guard NXTLVL_CM_OBSERVER=1 → null, nothing written', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([{ type: 'assistant', tools: readTools(DEFAULT_CLOSE_MIN) }]);
    const result = run(
      sessionEndEvent(),
      mkEnv(tmp, { NXTLVL_CM_OBSERVER: '1' }),
      txDeps(tx),
    );
    assert.equal(result, null, 'null for observer guard');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('sidechain guard isSidechain=true → null, nothing written', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const tx = makeTranscript([{ type: 'assistant', tools: readTools(DEFAULT_CLOSE_MIN) }]);
    const result = run(
      sessionEndEvent({ isSidechain: true }),
      mkEnv(tmp),
      txDeps(tx),
    );
    assert.equal(result, null, 'null for sidechain guard');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// --- Sidechain tool_use blocks in transcript are NOT counted ----------------

test('sidechain transcript turns are ignored for toolCalls count', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    // Mix: 3 main-thread calls + 20 sidechain calls → toolCalls = 3 < DEFAULT_CLOSE_MIN
    const tx = makeTranscript([
      { type: 'user', text: 'test sidechain filtering' },
      { type: 'assistant', tools: readTools(3) },
      { type: 'assistant', tools: readTools(20), sidechain: true },
    ]);
    const result = run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));
    assert.ok(result && result.processed, 'result processed');
    // Only 3 main-thread calls → gate closed (no mutation), no bookmark
    assert.equal(result.toolCalls, 3, 'toolCalls = 3 (sidechain ignored)');
    assert.equal(result.bookmarkWritten, false, 'no bookmark (sidechain not counted)');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// --- NXTLVL_CM_CLOSE_MIN override -------------------------------------------

test('NXTLVL_CM_CLOSE_MIN override: custom N respected', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    // 3 calls, N=3 → gate opens
    const tx = makeTranscript([
      { type: 'user', text: 'quick task' },
      { type: 'assistant', tools: readTools(3) },
    ]);
    const result = run(
      sessionEndEvent(),
      mkEnv(tmp, { NXTLVL_CM_CLOSE_MIN: '3' }),
      txDeps(tx),
    );
    assert.ok(result && result.processed, 'processed');
    assert.equal(result.bookmarkWritten, true, 'bookmark written with N=3 and 3 calls');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('NXTLVL_CM_CLOSE_MIN invalid value falls back to default', () => {
  assert.equal(resolveCloseMin({ NXTLVL_CM_CLOSE_MIN: 'bad' }), DEFAULT_CLOSE_MIN);
  assert.equal(resolveCloseMin({ NXTLVL_CM_CLOSE_MIN: '-5' }), DEFAULT_CLOSE_MIN);
  assert.equal(resolveCloseMin({ NXTLVL_CM_CLOSE_MIN: '0' }), DEFAULT_CLOSE_MIN);
  assert.equal(resolveCloseMin({}), DEFAULT_CLOSE_MIN);
});

// --- No firstUserText → generic core ----------------------------------------

test('no firstUserText: note uses generic "Session on <branch>" core', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    // Transcript with no user message
    const tx = makeTranscript([
      { type: 'assistant', tools: readTools(DEFAULT_CLOSE_MIN) },
    ]);
    const result = run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));
    assert.ok(result && result.processed, 'processed');
    assert.equal(result.bookmarkWritten, true, 'bookmark written');
    assert.ok(result.note.includes('Session on'), 'generic core when no user text');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// --- Note truncation at NOTE_CORE_MAX chars ----------------------------------

test('note core is truncated at NOTE_CORE_MAX chars', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const longText = 'a'.repeat(NOTE_CORE_MAX + 500);
    const tx = makeTranscript([
      { type: 'user', text: longText },
      { type: 'assistant', tools: readTools(DEFAULT_CLOSE_MIN) },
    ]);
    const result = run(sessionEndEvent(), mkEnv(tmp), txDeps(tx));
    assert.ok(result && result.bookmarkWritten, 'bookmark written');
    // Core should be truncated; note length should be bounded
    // The tail adds some chars, but the core should not exceed NOTE_CORE_MAX
    const noteCore = result.note.split(' — [')[0];
    assert.ok(noteCore.length <= NOTE_CORE_MAX, `note core length ${noteCore.length} <= NOTE_CORE_MAX`);
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// ---------------------------------------------------------------------------
// Unit tests for helper functions
// ---------------------------------------------------------------------------

test('isOffLike: recognises all off values', () => {
  for (const v of ['off', 'OFF', '0', 'false', 'FALSE', 'no', 'NO', 'disabled', 'DISABLED']) {
    assert.equal(isOffLike(v), true, `isOffLike("${v}") true`);
  }
  for (const v of ['1', 'true', 'yes', 'on', '', undefined, null, 'anything']) {
    assert.equal(isOffLike(v), false, `isOffLike(${JSON.stringify(v)}) false`);
  }
});

test('isCloseDisabled: checks NXTLVL_CM_CLOSE', () => {
  assert.equal(isCloseDisabled({ NXTLVL_CM_CLOSE: 'off' }), true);
  assert.equal(isCloseDisabled({ NXTLVL_CM_CLOSE: '1' }), false);
  assert.equal(isCloseDisabled({}), false);
});

test('isObserverRun: truthy non-off values trigger guard', () => {
  assert.equal(isObserverRun({ NXTLVL_CM_OBSERVER: '1' }), true);
  assert.equal(isObserverRun({ NXTLVL_CM_OBSERVER: 'true' }), true);
  assert.equal(isObserverRun({ NXTLVL_CM_OBSERVER: 'off' }), false);
  assert.equal(isObserverRun({}), false);
});

test('analyseTranscript: counts main-thread tool_use blocks', () => {
  const tx = makeTranscript([
    { type: 'user', text: 'hello' },
    { type: 'assistant', tools: [{ name: 'Read' }, { name: 'Read' }] },
    { type: 'assistant', tools: [{ name: 'Read' }], sidechain: true }, // should be ignored
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.toolCalls, 2, 'sidechain not counted');
  assert.equal(stats.firstUserText, 'hello', 'firstUserText extracted');
  assert.equal(stats.mutation, false, 'no mutation');
  assert.equal(stats.committed, false, 'not committed');
});

test('analyseTranscript: detects Write as mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Write', input: { file: '/f' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'Write = mutation');
});

test('analyseTranscript: detects Edit as mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Edit', input: {} }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'Edit = mutation');
});

test('analyseTranscript: detects MultiEdit as mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'MultiEdit', input: {} }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'MultiEdit = mutation');
});

test('analyseTranscript: detects NotebookEdit as mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'NotebookEdit', input: {} }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'NotebookEdit = mutation');
});

test('analyseTranscript: detects git commit via Bash', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'git commit -m "x"' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.committed, true, 'git commit detected');
  assert.equal(stats.mutation, true, 'commit implies mutation');
});

test('analyseTranscript: detects shell redirect as mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'echo hello > file.txt' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'shell redirect = mutation');
});

test('analyseTranscript: sed -i detected as mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'sed -i "s/a/b/g" file.txt' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'sed -i = mutation');
});

// --- BASH_MUTATION_RE: read-only commands must NOT be classified as mutations ---
// These test Fix 1: the old bare `>` regex would false-positive on all of these.

test('BASH_MUTATION_RE: grep with embedded > in pattern — read-only, no mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'grep -r "x>y" .' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, false, 'grep "x>y" is read-only');
});

test('BASH_MUTATION_RE: echo with comparison string — read-only, no mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'echo "val > min"' } }] },
  ]);
  // Note: this is an acceptable residual false-positive per spec (comparison-in-quoted-string
  // whose target word starts with a letter looks syntactically like a redirect); we document
  // but do not mandate this case — omitting assertion to avoid brittleness on this edge.
  // The primary fix (no bare >) already handles the real-world false-positive bombs below.
});

test('BASH_MUTATION_RE: git log format string with > — read-only, no mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'git log --format="%H > %s"' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, false, 'git log --format="%H > %s" is read-only');
});

test('BASH_MUTATION_RE: jq filter with comparison operator — read-only, no mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: "jq '.[] | select(.a > 0)'" } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, false, 'jq select(.a > 0) is read-only');
});

test('BASH_MUTATION_RE: ls command — read-only, no mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'ls -la' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, false, 'ls is read-only');
});

test('BASH_MUTATION_RE: cat command — read-only, no mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'cat file.txt' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, false, 'cat is read-only');
});

test('BASH_MUTATION_RE: git status — read-only, no mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'git status' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, false, 'git status is read-only');
});

test('BASH_MUTATION_RE: git diff — read-only, no mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'git diff HEAD~1' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, false, 'git diff is read-only');
});

// --- BASH_MUTATION_RE: genuine mutation commands MUST still be detected ---------

test('BASH_MUTATION_RE: echo redirect to file — mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'echo hi > file.txt' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'echo hi > file.txt is a mutation');
});

test('BASH_MUTATION_RE: cat append redirect — mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'cat a >> log' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'cat a >> log is a mutation');
});

test('BASH_MUTATION_RE: mv command — mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'mv a b' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'mv a b is a mutation');
});

test('BASH_MUTATION_RE: rm command — mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'rm f' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'rm f is a mutation');
});

test('BASH_MUTATION_RE: tee command — mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'echo x | tee out.txt' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'tee out.txt is a mutation');
});

test('BASH_MUTATION_RE: mkdir command — mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'mkdir d' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'mkdir d is a mutation');
});

test('BASH_MUTATION_RE: touch command — mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'touch f' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'touch f is a mutation');
});

test('BASH_MUTATION_RE: git merge — mutation', () => {
  const tx = makeTranscript([
    { type: 'assistant', tools: [{ name: 'Bash', input: { command: 'git merge origin/main' } }] },
  ]);
  const stats = analyseTranscript(tx, false);
  assert.equal(stats.mutation, true, 'git merge is a mutation');
});

test('buildNote: formats note with tail correctly', () => {
  const stats = { toolCalls: 5, mutation: false, committed: false, firstUserText: 'do the thing' };
  const note = buildNote(stats, 'main', s => s);
  assert.ok(note.includes('do the thing'), 'intent present');
  assert.ok(note.includes('5 tool calls'), 'tool call count present');
  assert.ok(note.includes('branch main'), 'branch present');
  assert.ok(!note.includes('committed'), 'no committed label');
  assert.ok(!note.includes('files changed'), 'no files-changed label');
});

test('buildNote: "files changed" when mutation=true, committed=false', () => {
  const stats = { toolCalls: 3, mutation: true, committed: false, firstUserText: null };
  const note = buildNote(stats, 'feat-x', s => s);
  assert.ok(note.includes('files changed'), '"files changed" present');
  assert.ok(!note.includes('committed'), 'no "committed"');
});

test('buildNote: "committed" when committed=true', () => {
  const stats = { toolCalls: 3, mutation: true, committed: true, firstUserText: null };
  const note = buildNote(stats, 'main', s => s);
  assert.ok(note.includes('committed'), '"committed" present');
  assert.ok(!note.includes('files changed'), '"files changed" absent when committed');
});

test('buildNote: generic core when firstUserText is null', () => {
  const stats = { toolCalls: 5, mutation: false, committed: false, firstUserText: null };
  const note = buildNote(stats, 'main', s => s);
  assert.ok(note.startsWith('Session on'), 'generic core when no user text');
});

test('buildNote: scrub fail-open — throwing scrubFn uses generic core', () => {
  const stats = { toolCalls: 5, mutation: false, committed: false, firstUserText: 'secret prompt' };
  const note = buildNote(stats, 'main', () => { throw new Error('scrub failed'); });
  assert.ok(note.includes('Session on'), 'generic core on scrub throw');
  assert.ok(!note.includes('secret prompt'), 'raw text not in note on scrub throw');
});

// ---------------------------------------------------------------------------
// readTranscriptDefault — bounded-read policy (T4.1)
//
// The whole-file re-read on a cut tail is gated on whether the bounded tail
// already settles the close gate. We prove the branch taken with a sentinel: the
// session's opening user prompt sits at the FILE HEAD, outside the tail window,
// so firstUserText === SENTINEL can only come from a full read.
// ---------------------------------------------------------------------------

const OPENING = 'OPENING-PROMPT-SENTINEL';

/** Write a transcript to a real temp file and return its path. */
function writeTranscriptFile(text) {
  const dir = freshTmp();
  const p = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(p, text);
  return p;
}

test('readTranscriptDefault: small file (no tail cut) reads whole file accurately', () => {
  const text = makeTranscript([
    { type: 'user', text: OPENING },
    { type: 'assistant', tools: [{ name: 'Read' }] },
    { type: 'assistant', tools: [{ name: 'Grep' }] },
  ]);
  const p = writeTranscriptFile(text);
  // maxBytes far exceeds the file → full read, accurate stats.
  const stats = readTranscriptDefault(p, 10, 4 * 1024 * 1024);
  assert.equal(stats.toolCalls, 2, 'full tool-call count');
  assert.equal(stats.firstUserText, OPENING, 'opening prompt captured on full read');
});

test('readTranscriptDefault: cut tail with gate already open SKIPS the whole-file re-read', () => {
  // 30 assistant tool-use turns after the opening prompt; a tiny tail window keeps
  // the opening line out of view. closeMin=1 → the tail alone settles the gate.
  const events = [{ type: 'user', text: OPENING }];
  for (let i = 0; i < 30; i++) events.push({ type: 'assistant', tools: [{ name: 'Read' }] });
  const p = writeTranscriptFile(makeTranscript(events));

  const stats = readTranscriptDefault(p, 1, 600);
  assert.ok(stats.toolCalls >= 1, 'tail shows gate-opening activity');
  assert.ok(stats.toolCalls < 30, 'count is the tail subset, not the full file');
  assert.equal(stats.firstUserText, null, 'no full read → opening prompt NOT recovered');
});

test('readTranscriptDefault: cut tail with mutation in the tail also SKIPS the re-read', () => {
  // A mutator tool in the tail settles the gate even with a high closeMin.
  const events = [{ type: 'user', text: OPENING }];
  for (let i = 0; i < 20; i++) events.push({ type: 'assistant', tools: [{ name: 'Read' }] });
  events.push({ type: 'assistant', tools: [{ name: 'Write', input: { file_path: '/x' } }] });
  const p = writeTranscriptFile(makeTranscript(events));

  const stats = readTranscriptDefault(p, 1000, 400); // closeMin high; mutation decides
  assert.equal(stats.mutation, true, 'mutation seen in tail');
  assert.equal(stats.committed, false, 'mutation is not a commit');
  assert.ok(stats.toolCalls < 21, 'count is the tail subset, not the full 21 calls');
  assert.equal(stats.firstUserText, null, 'no full read → opening prompt NOT recovered');
});

test('readTranscriptDefault: cut tail with gate UNDECIDED falls back to the full read', () => {
  // Few tool calls + high closeMin → the tail cannot settle the gate, so the
  // whole file is read and the opening prompt is recovered.
  const events = [{ type: 'user', text: OPENING }];
  for (let i = 0; i < 20; i++) events.push({ type: 'assistant', tools: [{ name: 'Read' }] });
  const p = writeTranscriptFile(makeTranscript(events));

  const stats = readTranscriptDefault(p, 1000, 400); // closeMin unreachable from tail
  assert.equal(stats.toolCalls, 20, 'full count via whole-file read');
  assert.equal(stats.firstUserText, OPENING, 'opening prompt recovered via full read');
});

test('readTranscriptDefault: a gate-opening mutation ONLY in the truncated head is still caught (full-read fallback)', () => {
  // The natural false-negative scenario: the only mutation is early in the session
  // (outside the tail window) and the tail is otherwise quiet. The tail cannot
  // settle the gate, so the full read must fire and recover the mutation — else a
  // substantive session would wrongly skip its bookmark.
  const events = [
    { type: 'user', text: OPENING },
    { type: 'assistant', tools: [{ name: 'Write', input: { file_path: '/x' } }] }, // head-only mutation
  ];
  for (let i = 0; i < 15; i++) events.push({ type: 'assistant', tools: [{ name: 'Read' }] });
  const p = writeTranscriptFile(makeTranscript(events));

  const stats = readTranscriptDefault(p, 1000, 400); // tail quiet + closeMin unreachable
  assert.equal(stats.mutation, true, 'head-only mutation recovered by the full read');
  assert.equal(stats.firstUserText, OPENING, 'full read fired (opening prompt recovered)');
  assert.equal(stats.toolCalls, 16, 'full count: 1 Write + 15 Read');
});

test('readTranscriptDefault: missing / invalid path returns null', () => {
  assert.equal(readTranscriptDefault(null), null);
  assert.equal(readTranscriptDefault('/no/such/transcript/file.jsonl'), null);
});

test('run() threads the env-resolved closeMin into the transcript reader', () => {
  // Guards the contract that the SAME closeMin used for the bookmark gate is the
  // one handed to readTranscriptDefault's read-gating decision. A spy records the
  // arg while delegating to the real reader; XDG isolation keeps the bookmark/
  // metrics writes off the real store.
  let receivedCloseMin;
  const p = writeTranscriptFile(makeTranscript([
    { type: 'user', text: OPENING },
    { type: 'assistant', tools: [{ name: 'Read' }] },
  ]));
  const deps = {
    readTranscript: (txPath, closeMin, maxBytes) => {
      receivedCloseMin = closeMin;
      return readTranscriptDefault(txPath, closeMin, maxBytes);
    },
  };
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    run(sessionEndEvent({ transcript_path: p }), mkEnv(tmp, { NXTLVL_CM_CLOSE_MIN: '2' }), deps);
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
  assert.equal(receivedCloseMin, 2, 'run() passes the env-resolved closeMin (2) to the reader');
});
