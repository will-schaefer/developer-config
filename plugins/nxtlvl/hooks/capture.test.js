// Tests for hooks/capture.js — the C&M live-capture hook.
//
// Hermetic: each test uses a fresh per-test tmpDir as XDG_STATE_HOME so tests
// never touch the real ~/.local/state store.  Pattern mirrors obs-log.test.js.
//
// Run with: node --test "plugins/nxtlvl/hooks/capture.test.js"

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { run, isOffLike, truncateField, MAX_FIELD_CHARS } = require('./capture.js');
const obsLog = require('../lib/obs-log.js');
const { layout } = require('../lib/paths.ts');
const { projectIdentity } = require('../lib/project-identity.js');

// ---------------------------------------------------------------------------
// Shared tmp root: each test gets a sub-dir so they never share state.
// ---------------------------------------------------------------------------

let sharedTmp;
let counter = 0;

before(() => {
  sharedTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nxtlvl-capture-test-'));
});

after(() => {
  fs.rmSync(sharedTmp, { recursive: true, force: true });
});

/** Create a fresh per-test XDG_STATE_HOME dir. */
function freshTmp() {
  counter += 1;
  const dir = path.join(sharedTmp, `t${counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Build an env object pointing storage at a tmp dir. */
function mkEnv(tmpDir, extra = {}) {
  return { XDG_STATE_HOME: tmpDir, ...extra };
}

/** Get the project key for the current working directory. */
function thisProjectKey() {
  return projectIdentity(process.cwd()).key;
}

/** Read all appended records for this project from a tmp store. */
function readAll(tmpDir) {
  const key = thisProjectKey();
  return obsLog.readAll(key, { env: { XDG_STATE_HOME: tmpDir } });
}

/** Build a minimal PreToolUse event payload. */
function preEvent(toolName, toolInput, extras = {}) {
  return JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    session_id: 'test-session-1',
    transcript_path: '/tmp/fake-transcript.jsonl',
    cwd: process.cwd(),
    ...extras,
  });
}

/** Build a minimal PostToolUse event payload. */
function postEvent(toolName, toolResponse, extras = {}) {
  return JSON.stringify({
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_response: toolResponse,
    session_id: 'test-session-1',
    transcript_path: '/tmp/fake-transcript.jsonl',
    cwd: process.cwd(),
    ...extras,
  });
}

// ---------------------------------------------------------------------------
// Acceptance tests
// ---------------------------------------------------------------------------

test('PreToolUse appends a tool_start record with correct shape', () => {
  const tmp = freshTmp();
  const env = mkEnv(tmp);

  // We need the hook to write to our tmp store; the hook uses process.env for
  // obs-log paths, so we temporarily set XDG_STATE_HOME in process.env and
  // restore it afterwards.
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const out = run(preEvent('Read', { file: '/foo.txt' }), env);
    assert.equal(out, '', 'returns empty string (silent)');

    const records = readAll(tmp);
    assert.equal(records.length, 1, 'exactly one record appended');
    const rec = records[0];
    assert.equal(rec.event, 'tool_start');
    assert.equal(rec.tool, 'Read');
    assert.notEqual(rec.input, null, 'input present on tool_start');
    assert.equal(rec.output, null, 'output null on tool_start');
    assert.equal(rec.session, 'test-session-1');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('PostToolUse appends a tool_complete record with correct shape', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const out = run(postEvent('Bash', 'hello world'), mkEnv(tmp));
    assert.equal(out, '', 'returns empty string (silent)');

    const records = readAll(tmp);
    assert.equal(records.length, 1);
    const rec = records[0];
    assert.equal(rec.event, 'tool_complete');
    assert.equal(rec.tool, 'Bash');
    assert.equal(rec.input, null, 'input null on tool_complete');
    assert.notEqual(rec.output, null, 'output present on tool_complete');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('Pre + Post events compose correctly (two records, distinct events)', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    run(preEvent('Write', { file: '/out.txt', content: 'hello' }), mkEnv(tmp));
    run(postEvent('Write', 'ok'), mkEnv(tmp));

    const records = readAll(tmp);
    assert.equal(records.length, 2);
    assert.equal(records[0].event, 'tool_start');
    assert.equal(records[1].event, 'tool_complete');
    assert.equal(records[0].seq, 0);
    assert.equal(records[1].seq, 1);
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('A planted secret in tool_input is redacted in the stored record', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    // Plant a GitHub token in the input
    run(preEvent('Bash', { command: 'echo ghs_abcdefghijklmnopqrstuvwxyz12345' }), mkEnv(tmp));

    const records = readAll(tmp);
    assert.equal(records.length, 1);
    // The stored input should NOT contain the raw token
    const storedInput = typeof records[0].input === 'string'
      ? records[0].input
      : JSON.stringify(records[0].input);
    assert.ok(!storedInput.includes('ghs_abcdefghijklmnopqrstuvwxyz12345'), 'token redacted in input');
    assert.ok(storedInput.includes('[REDACTED]'), '[REDACTED] placeholder present');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('A planted secret in tool_response is redacted in the stored record', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    run(postEvent('Bash', 'token: sk-abcdefghijklmnopqrstuvwxyz1234567890'), mkEnv(tmp));

    const records = readAll(tmp);
    assert.equal(records.length, 1);
    const storedOutput = String(records[0].output ?? '');
    assert.ok(!storedOutput.includes('sk-abcdefghijklmnopqrstuvwxyz1234567890'), 'sk- token redacted in output');
    assert.ok(storedOutput.includes('[REDACTED]'), '[REDACTED] placeholder present');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('Fail-CLOSED: injected drop-scrubber produces ZERO appended records through capture.run', () => {
  // Drives the fail-CLOSED invariant end-to-end through capture.run() rather than
  // as a scrub unit fact. Uses the optional third-arg scrubFn seam so no module-cache
  // monkeypatching is needed: run() calls scrubFn(preScrubObs) and on { dropped:true }
  // returns '' without calling obsLog.append. This test verifies both parts.
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    // A scrubber that unconditionally drops — simulates any unrecoverable scrub failure.
    const alwaysDrop = () => ({ dropped: true, reason: 'forced-drop-for-test' });

    const out = run(preEvent('Read', { file: '/secret.txt' }), mkEnv(tmp), alwaysDrop);

    // 1. run() must return '' (still silent/fail-open to the agent)
    assert.equal(out, '', 'run() returns "" even when scrubber drops');

    // 2. The observation log for this project must have ZERO records — the drop
    //    halted the write path before obsLog.append was ever called.
    const records = readAll(tmp);
    assert.equal(records.length, 0, 'zero records appended when scrubber drops (fail-CLOSED)');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('Kill switch NXTLVL_CM_CAPTURE=off — nothing appended, returns ""', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const out = run(preEvent('Read', { file: '/x' }), mkEnv(tmp, { NXTLVL_CM_CAPTURE: 'off' }));
    assert.equal(out, '', 'returns ""');
    const records = readAll(tmp);
    assert.equal(records.length, 0, 'nothing appended when kill switch is off');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('Kill switch variants: 0, false, no, disabled all disable capture', () => {
  for (const val of ['0', 'false', 'no', 'disabled']) {
    const tmp = freshTmp();
    const origXdg = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = tmp;
    try {
      const out = run(preEvent('Read', {}), mkEnv(tmp, { NXTLVL_CM_CAPTURE: val }));
      assert.equal(out, '', `kill switch "${val}" returns ""`);
      assert.equal(readAll(tmp).length, 0, `nothing appended for kill switch "${val}"`);
    } finally {
      if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
      else process.env.XDG_STATE_HOME = origXdg;
    }
  }
});

test('Observer marker NXTLVL_CM_OBSERVER=1 — skipped, nothing appended', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const out = run(preEvent('Read', { file: '/x' }), mkEnv(tmp, { NXTLVL_CM_OBSERVER: '1' }));
    assert.equal(out, '', 'returns ""');
    assert.equal(readAll(tmp).length, 0, 'nothing appended when observer flag set');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('Subagent payload (isSidechain=true) — skipped, nothing appended', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const out = run(
      preEvent('Read', { file: '/x' }, { isSidechain: true }),
      mkEnv(tmp),
    );
    assert.equal(out, '', 'returns ""');
    assert.equal(readAll(tmp).length, 0, 'nothing appended for sidechain events');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('Malformed stdin JSON returns "" without throwing', () => {
  const tmp = freshTmp();
  let out;
  assert.doesNotThrow(() => {
    out = run('{ this is not valid json {{{}', mkEnv(tmp));
  });
  assert.equal(out, '', 'returns "" on bad JSON');
});

test('Empty stdin returns "" without throwing', () => {
  let out;
  assert.doesNotThrow(() => {
    out = run('', mkEnv(freshTmp()));
  });
  assert.equal(out, '', 'returns "" on empty input');
});

test('Forced internal error returns "" and does not throw (fail-open)', () => {
  // Pass a rawInput that parses fine but has a bad cwd that will cause
  // projectIdentity to throw (non-existent and non-git dir).
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const badEvent = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file: '/x' },
      session_id: 's1',
      transcript_path: '/tmp/t.json',
      cwd: '/absolutely/nonexistent/path/xyz123',
    });
    let out;
    assert.doesNotThrow(() => {
      out = run(badEvent, mkEnv(tmp));
    });
    assert.equal(out, '', 'returns "" on internal error');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('Hook always emits "" (no additionalContext) — capture is silent', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    // Multiple event types — all must return ''
    const results = [
      run(preEvent('Read', {}), mkEnv(tmp)),
      run(postEvent('Read', 'ok'), mkEnv(tmp)),
      run('', mkEnv(tmp)),
      run('bad json', mkEnv(tmp)),
      run(preEvent('Bash', {}, { isSidechain: true }), mkEnv(tmp, { NXTLVL_CM_CAPTURE: 'off' })),
    ];
    for (const r of results) {
      assert.equal(r, '', `all runs return "" (got: ${JSON.stringify(r)})`);
    }
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

test('Truncation: tool_input longer than MAX_FIELD_CHARS is truncated before storage', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const bigString = 'a'.repeat(MAX_FIELD_CHARS + 1000);
    run(preEvent('Bash', { command: bigString }), mkEnv(tmp));

    const records = readAll(tmp);
    assert.equal(records.length, 1);
    // The stored input field should be a string of at most MAX_FIELD_CHARS
    const stored = records[0].input;
    const storedLen = typeof stored === 'string' ? stored.length : JSON.stringify(stored).length;
    assert.ok(storedLen <= MAX_FIELD_CHARS, `stored input length ${storedLen} <= MAX_FIELD_CHARS ${MAX_FIELD_CHARS}`);
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});

// ---------------------------------------------------------------------------
// Unit tests for helper functions
// ---------------------------------------------------------------------------

test('isOffLike recognises all off values and rejects normal values', () => {
  for (const v of ['off', 'OFF', '0', 'false', 'FALSE', 'no', 'NO', 'disabled', 'DISABLED']) {
    assert.equal(isOffLike(v), true, `isOffLike("${v}") should be true`);
  }
  for (const v of ['1', 'true', 'yes', 'on', '', undefined, null, 'anything']) {
    assert.equal(isOffLike(v), false, `isOffLike(${JSON.stringify(v)}) should be false`);
  }
});

test('truncateField: strings truncated at MAX_FIELD_CHARS, nulls pass through', () => {
  assert.equal(truncateField(null), null);
  assert.equal(truncateField(undefined), null);
  const exact = 'x'.repeat(MAX_FIELD_CHARS);
  assert.equal(truncateField(exact), exact, 'exact length passes through unchanged');
  const over = 'x'.repeat(MAX_FIELD_CHARS + 500);
  const truncated = truncateField(over);
  assert.equal(typeof truncated, 'string');
  assert.equal(truncated.length, MAX_FIELD_CHARS, 'overlong string truncated to MAX_FIELD_CHARS');
});

test('truncateField: objects are serialized and truncated', () => {
  const big = { k: 'v'.repeat(MAX_FIELD_CHARS + 100) };
  const result = truncateField(big);
  assert.equal(typeof result, 'string', 'object becomes a string');
  assert.ok(result.length <= MAX_FIELD_CHARS, `object result length ${result.length} <= ${MAX_FIELD_CHARS}`);
});

test('Non-interactive session (no session_id AND no transcript_path) is skipped', () => {
  const tmp = freshTmp();
  const origXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = tmp;
  try {
    const nonInteractiveEvent = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file: '/x' },
      cwd: process.cwd(),
      // NO session_id, NO transcript_path
    });
    const out = run(nonInteractiveEvent, mkEnv(tmp));
    assert.equal(out, '', 'returns ""');
    assert.equal(readAll(tmp).length, 0, 'non-interactive event not recorded');
  } finally {
    if (origXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = origXdg;
  }
});
