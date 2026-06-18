'use strict';
/**
 * Unit tests for the two-stage context-alert state machine (T3).
 * Run: node --test plugins/nxtlvl/hooks/context-alert.test.js
 * Zero-dependency — uses Node's built-in test runner (node:test, Node 18+).
 *
 * Realistic-scale thresholds keep the K-rounded messages meaningful:
 * primary 100K, backstop 200K, so the hysteresis floors are
 * floor(0.9*t) = 90K and 180K.
 */

const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const hook = require('./context-alert.js');

// NOTIFY off in the state-machine tests so they never fire a real macOS popup;
// the notification path has its own stubbed-spawn tests below.
const ENV = {
  NXTLVL_CONTEXT_ALERT_TOKENS: '100000',
  NXTLVL_CONTEXT_ALERT_BACKSTOP_TOKENS: '200000',
  NXTLVL_CONTEXT_ALERT_NOTIFY: 'off'
};

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${process.pid}-${Date.now()}-${counter}`;
}

const tmpFiles = [];
const sessions = [];

function newSession() {
  const id = `test-${uniqueSuffix()}`;
  sessions.push(id);
  return id;
}

function transcriptWith(tokens) {
  const p = path.join(os.tmpdir(), `nxtlvl-ctxtest-${uniqueSuffix()}.jsonl`);
  const rec = {
    type: 'assistant',
    isSidechain: false,
    message: {
      usage: { input_tokens: tokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    }
  };
  fs.writeFileSync(p, JSON.stringify(rec) + '\n');
  tmpFiles.push(p);
  return p;
}

/** Drive run() at a given context size for a fixed session. */
function callAt(sessionId, tokens, env = ENV) {
  const input = JSON.stringify({ session_id: sessionId, transcript_path: transcriptWith(tokens) });
  return hook.run(input, env);
}

function additionalContext(out) {
  if (!out) return null;
  return JSON.parse(out).hookSpecificOutput.additionalContext;
}

function readStateFile(sessionId) {
  const p = path.join(os.tmpdir(), `nxtlvl-ctx-alert-${sessionId}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

after(() => {
  for (const f of tmpFiles) { try { fs.unlinkSync(f); } catch { /* best effort */ } }
  for (const id of sessions) {
    try { fs.unlinkSync(path.join(os.tmpdir(), `nxtlvl-ctx-alert-${id}.json`)); } catch { /* best effort */ }
  }
});

// --- primary stage --------------------------------------------------------

test('below primary: no fire', () => {
  assert.strictEqual(callAt(newSession(), 50000), '');
});

test('crossing primary injects a non-stop, non-dramatized FYI', () => {
  const msg = additionalContext(callAt(newSession(), 150000));
  assert.ok(msg, 'expected additionalContext on the primary crossing');
  assert.match(msg, /do not stop/i);
  assert.match(msg, /\/compact/);
  assert.match(msg, /~150K/);
  assert.doesNotMatch(msg, /wind down|winding down|checkpoint/i);
});

test('primary fires once per crossing', () => {
  const sid = newSession();
  assert.ok(additionalContext(callAt(sid, 150000)), 'first crossing fires');
  assert.strictEqual(callAt(sid, 160000), '', 'still above → no re-fire');
});

// --- backstop stage -------------------------------------------------------

test('backstop is notification-only and marks both stages fired', () => {
  const sid = newSession();
  assert.strictEqual(callAt(sid, 250000), '', 'backstop surfaces nothing in-context');
  assert.deepStrictEqual(readStateFile(sid), { primary: true, backstop: true });
});

test('backstop fires once per crossing', () => {
  const sid = newSession();
  assert.strictEqual(callAt(sid, 250000), '');
  assert.strictEqual(callAt(sid, 260000), '', 'still above backstop → no re-fire');
});

// --- re-arm / hysteresis --------------------------------------------------

test('primary re-arms after a drop (compaction) then fires again', () => {
  const sid = newSession();
  assert.ok(additionalContext(callAt(sid, 150000)), 'fires');
  assert.strictEqual(callAt(sid, 30000), '', 'drop below 90K → re-arm, nothing');
  assert.ok(additionalContext(callAt(sid, 150000)), 'fires again on the next climb');
});

test('both stages re-arm after a deep drop', () => {
  const sid = newSession();
  assert.strictEqual(callAt(sid, 250000), '', 'backstop fires (notify-only)');
  assert.strictEqual(callAt(sid, 30000), '', 'deep drop → re-arm both');
  assert.deepStrictEqual(readStateFile(sid), { primary: false, backstop: false });
  assert.ok(additionalContext(callAt(sid, 150000)), 'primary fires again — proves re-arm');
});

test('a partial drop below the backstop floor but above the primary floor re-arms only the backstop', () => {
  const sid = newSession();
  callAt(sid, 250000); // both fired
  callAt(sid, 150000); // 150K < backstopRearm(180K) but > primaryRearm(90K)
  assert.deepStrictEqual(readStateFile(sid), { primary: true, backstop: false });
});

// --- backstop disable guard ----------------------------------------------

test('backstop disabled when it would not exceed primary → primary still fires', () => {
  const env = { NXTLVL_CONTEXT_ALERT_TOKENS: '100000', NXTLVL_CONTEXT_ALERT_BACKSTOP_TOKENS: '80000', NXTLVL_CONTEXT_ALERT_NOTIFY: 'off' };
  const msg = additionalContext(callAt(newSession(), 250000, env));
  assert.ok(msg, 'with backstop disabled, a high context fires the primary line');
  assert.match(msg, /do not stop/i);
});

test('resolveBackstop returns null when <= primary, else the value, else default', () => {
  assert.strictEqual(hook.resolveBackstop({ NXTLVL_CONTEXT_ALERT_BACKSTOP_TOKENS: '100' }, 100), null);
  assert.strictEqual(hook.resolveBackstop({ NXTLVL_CONTEXT_ALERT_BACKSTOP_TOKENS: '500' }, 100), 500);
  assert.strictEqual(hook.resolveBackstop({}, 200000), 325000);
});

// --- fail-open (absolute) -------------------------------------------------

test('fail-open: malformed stdin', () => {
  assert.strictEqual(hook.run('{ not json', ENV), '');
});

test('fail-open: missing transcript path', () => {
  assert.strictEqual(hook.run(JSON.stringify({ session_id: newSession() }), ENV), '');
});

test('fail-open: nonexistent transcript file', () => {
  const input = JSON.stringify({ session_id: newSession(), transcript_path: '/no/such/file.jsonl' });
  assert.strictEqual(hook.run(input, ENV), '');
});

test('fail-open: empty stdin', () => {
  assert.strictEqual(hook.run('', ENV), '');
});

test('disabled via env emits nothing even above threshold', () => {
  const input = JSON.stringify({ session_id: newSession(), transcript_path: transcriptWith(150000) });
  assert.strictEqual(hook.run(input, { ...ENV, NXTLVL_CONTEXT_ALERT: 'off' }), '');
});

// --- message builder ------------------------------------------------------

test('buildPrimaryMessage rounds to K and carries the right semantics', () => {
  const m = hook.buildPrimaryMessage(207000);
  assert.match(m, /~207K/);
  assert.match(m, /do not stop/i);
  assert.match(m, /one plain line/i);
  assert.doesNotMatch(m, /wind down|winding down|checkpoint/i);
});

// --- notification, fire-and-forget (T4) -----------------------------------
// Stub child_process.spawn so no real macOS notification fires during tests.

const cp = require('child_process');

function withStubbedSpawn(stub, fn) {
  const orig = cp.spawn;
  cp.spawn = stub;
  try { return fn(); } finally { cp.spawn = orig; }
}

// Same thresholds, notifications ENABLED (the stub intercepts the real spawn).
const NOTIFY_ENV = { NXTLVL_CONTEXT_ALERT_TOKENS: '100000', NXTLVL_CONTEXT_ALERT_BACKSTOP_TOKENS: '200000' };

test('primary crossing fires a detached notification AND still returns the in-context line', () => {
  const calls = [];
  const stub = (...args) => { calls.push(args); return { on() {}, unref() {} }; };
  const out = withStubbedSpawn(stub, () => callAt(newSession(), 150000, NOTIFY_ENV));
  assert.ok(additionalContext(out), 'primary still returns its in-context line');
  if (process.platform === 'darwin') {
    assert.strictEqual(calls.length, 1, 'exactly one osascript spawn');
    assert.strictEqual(calls[0][0], 'osascript');
    assert.strictEqual(calls[0][2].detached, true, 'detached');
    assert.strictEqual(calls[0][2].stdio, 'ignore', 'stdio ignored → non-blocking');
  }
});

test('backstop crossing fires a notification (its only signal) and returns nothing in-context', () => {
  const calls = [];
  const stub = (...args) => { calls.push(args); return { on() {}, unref() {} }; };
  const out = withStubbedSpawn(stub, () => callAt(newSession(), 250000, NOTIFY_ENV));
  assert.strictEqual(out, '', 'backstop is notification-only');
  if (process.platform === 'darwin') assert.strictEqual(calls.length, 1, 'backstop still notifies');
});

test('a spawn that throws cannot break the hook (fail-open)', () => {
  const out = withStubbedSpawn(() => { throw new Error('boom'); },
    () => callAt(newSession(), 150000, NOTIFY_ENV));
  assert.ok(additionalContext(out), 'hook still returns the line despite a throwing spawn');
});

test('notifications can be suppressed independently of the in-context line', () => {
  const calls = [];
  const stub = (...args) => { calls.push(args); return { on() {}, unref() {} }; };
  const env = { ...NOTIFY_ENV, NXTLVL_CONTEXT_ALERT_NOTIFY: 'off' };
  const out = withStubbedSpawn(stub, () => callAt(newSession(), 150000, env));
  assert.ok(additionalContext(out), 'in-context line still fires');
  assert.strictEqual(calls.length, 0, 'no spawn when notifications are off');
});
