#!/usr/bin/env node
/**
 * nxtlvl context-alert hook  —  PostToolUse matcher: *
 *
 * Alerts the agent once its live context crosses a token threshold
 * (default 200,000). Self-contained: the live context size is read
 * straight from the session transcript that Claude Code passes in
 * `transcript_path`, so there is no dependency on a statusline, a
 * metrics bridge, or a cost tracker.
 *
 * Live context = the input side the model read on its most recent
 * MAIN-THREAD assistant turn:
 *   input_tokens + cache_read_input_tokens + cache_creation_input_tokens
 * Output tokens are excluded — they are the reply, not context.
 * Sidechain (subagent / Task) turns are skipped so the number tracks
 * the main conversation, not a subagent's transient context.
 *
 * FAIL-OPEN IS ABSOLUTE (same contract as fallback-log.sh): every path
 * exits 0, and on any error the hook emits NOTHING (a true no-op). It
 * never blocks or alters a tool call.
 *
 * Two-stage cadence: a PRIMARY awareness ping when context first crosses
 * the threshold (default 200K), then a single blunter BACKSTOP at ~325K
 * if the session keeps climbing. Each stage arms and fires independently,
 * once per crossing, and re-arms when context falls back below
 * REARM_FRACTION * its OWN threshold (e.g. after /compact). The primary
 * injects a one-line "FYI, don't stop" instruction the agent surfaces at
 * its next report; the backstop is notification-only (osascript, wired in T4).
 *
 * Tunable via env:
 *   NXTLVL_CONTEXT_ALERT_TOKENS            primary threshold (default 200000)
 *   NXTLVL_CONTEXT_ALERT_BACKSTOP_TOKENS   backstop threshold (default 325000;
 *                                          ignored if <= primary)
 *   NXTLVL_CONTEXT_ALERT_NOTIFY            set to off/0/false to suppress the macOS
 *                                          notification (the in-context line stays)
 *   NXTLVL_CONTEXT_ALERT                   set to off/0/false to disable entirely
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_THRESHOLD = 200000; // primary awareness ping
const DEFAULT_BACKSTOP = 325000; // blunter escalation if the session keeps climbing
const REARM_FRACTION = 0.9; // re-arm once context drops below 90% of a stage's threshold
const TAIL_BYTES = 4 * 1024 * 1024; // bound the per-call transcript read
const MAX_SESSION_ID_LENGTH = 64;
const MAX_STDIN = 4 * 1024 * 1024;

function isDisabled(env) {
  const v = String(env.NXTLVL_CONTEXT_ALERT || '').trim().toLowerCase();
  return ['0', 'false', 'no', 'off', 'disabled'].includes(v);
}

function resolveThreshold(env) {
  const n = parseInt(env.NXTLVL_CONTEXT_ALERT_TOKENS, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD;
}

/** Backstop threshold, or null when it would not sit above the primary. */
function resolveBackstop(env, primary) {
  const n = parseInt(env.NXTLVL_CONTEXT_ALERT_BACKSTOP_TOKENS, 10);
  const v = Number.isFinite(n) && n > 0 ? n : DEFAULT_BACKSTOP;
  return v > primary ? v : null;
}

/** Reject path traversal, strip unsafe chars, bound length. */
function sanitizeSessionId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (/[/\\]|\.\./.test(raw)) return null;
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, MAX_SESSION_ID_LENGTH);
  return safe || null;
}

/** Read up to the last `maxBytes` of a file. partial=true means the first line may be truncated. */
function readTail(filePath, maxBytes) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    const start = size > maxBytes ? size - maxBytes : 0;
    const len = size - start;
    if (len <= 0) return { text: '', partial: false };
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    return { text: buf.toString('utf8'), partial: start > 0, full: start === 0 };
  } finally {
    fs.closeSync(fd);
  }
}

/** Scan lines newest-first for the last main-thread assistant usage block. */
function lastUsageFromText(text, dropFirst) {
  const lines = text.split('\n');
  const floor = dropFirst ? 1 : 0; // first line may be a partial record from the tail cut
  for (let i = lines.length - 1; i >= floor; i--) {
    const line = lines[i];
    if (!line) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o && o.type === 'assistant' && o.isSidechain !== true && o.message && o.message.usage) {
      return o.message.usage;
    }
  }
  return null;
}

/** Live context token count from the transcript, or null if unavailable. */
function liveContextTokens(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null;
  let stat;
  try {
    stat = fs.statSync(transcriptPath);
  } catch {
    return null;
  }

  let usage = null;
  try {
    const { text, partial, full } = readTail(transcriptPath, TAIL_BYTES);
    usage = lastUsageFromText(text, partial);
    // Tail missed it (assistant turn sits beyond the window, e.g. behind a huge
    // tool result). Only a non-full tail can miss; fall back to a full read.
    if (!usage && !full) {
      const whole = fs.readFileSync(transcriptPath, 'utf8');
      usage = lastUsageFromText(whole, false);
    }
  } catch {
    return null;
  }
  if (!usage) return null;

  return (
    (usage.input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0)
  );
}

function statePath(sessionId) {
  return path.join(os.tmpdir(), `nxtlvl-ctx-alert-${sessionId}.json`);
}

function readState(sessionId) {
  try {
    const s = JSON.parse(fs.readFileSync(statePath(sessionId), 'utf8'));
    if (!s || typeof s !== 'object') return { primary: false, backstop: false };
    return { primary: !!s.primary, backstop: !!s.backstop };
  } catch {
    return { primary: false, backstop: false };
  }
}

function writeState(sessionId, state) {
  const target = statePath(sessionId);
  const tmp = `${target}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
    fs.renameSync(tmp, target);
  } catch {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* best effort */
    }
  }
}

function buildPrimaryMessage(ctx) {
  const k = Math.round(ctx / 1000);
  return (
    `CONTEXT FYI — do not stop or change course. Live context is ~${k}K tokens, ` +
    'entering the range where output quality can start to soften. Finish the current ' +
    'step normally. At your next message to the user, append exactly one plain line ' +
    `noting this — e.g. "Context ~${k}K — a good moment to /compact at the next natural ` +
    'break." Do not dramatize it, do not repeat it on later turns, and do not act on it ' +
    'beyond that single line.'
  );
}

function notifyDisabled(env) {
  const v = String(env.NXTLVL_CONTEXT_ALERT_NOTIFY || '').trim().toLowerCase();
  return ['0', 'false', 'no', 'off', 'disabled'].includes(v);
}

/**
 * Fire-and-forget macOS notification. Spawns osascript detached, swallows every
 * error, and never blocks — it must never break or stall the hook (fail-open by
 * design). Darwin-only (D-portable); a no-op everywhere else.
 */
function notify(title, body, env = process.env) {
  try {
    if (notifyDisabled(env)) return;
    if (process.platform !== 'darwin') return;
    const esc = s => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `display notification "${esc(body)}" with title "${esc(title)}"`;
    const cp = require('child_process');
    const child = cp.spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' });
    if (child && typeof child.on === 'function') child.on('error', () => {});
    if (child && typeof child.unref === 'function') child.unref();
  } catch {
    /* fail-open: a notification must never break the hook */
  }
}

/**
 * @param {string} rawInput - PostToolUse event JSON on stdin
 * @param {object} env
 * @returns {string} JSON hook output to emit, or '' for a no-op
 */
function run(rawInput, env = process.env) {
  try {
    if (isDisabled(env)) return '';

    const input = rawInput && rawInput.trim() ? JSON.parse(rawInput) : {};
    const sessionId = sanitizeSessionId(input.session_id) || sanitizeSessionId(env.CLAUDE_SESSION_ID);
    if (!sessionId) return '';

    const ctx = liveContextTokens(input.transcript_path);
    if (ctx === null) return '';

    const primary = resolveThreshold(env);
    const backstop = resolveBackstop(env, primary);
    const primaryRearm = Math.floor(primary * REARM_FRACTION);
    const backstopRearm = backstop ? Math.floor(backstop * REARM_FRACTION) : Infinity;

    const state = readState(sessionId);
    const next = { primary: state.primary, backstop: state.backstop };
    let fired = null; // 'primary' | 'backstop'

    // Fire the highest stage crossed that has not yet fired this crossing.
    // Jumping straight past the primary into the backstop range marks BOTH
    // fired, so the gentle primary line never lands after you are already past it.
    if (backstop && ctx >= backstop && !state.backstop) {
      next.backstop = true;
      next.primary = true;
      fired = 'backstop';
    } else if (ctx >= primary && !state.primary) {
      next.primary = true;
      fired = 'primary';
    }

    // Re-arm each stage once context drops below its own hysteresis floor
    // (e.g. after /compact), so the next climb past the line fires again.
    if (ctx < primaryRearm && next.primary) next.primary = false;
    if (ctx < backstopRearm && next.backstop) next.backstop = false;

    if (next.primary !== state.primary || next.backstop !== state.backstop) {
      writeState(sessionId, next);
    }

    if (!fired) return '';

    // Fire-and-forget desktop notification (darwin-only; never blocks or throws).
    const k = Math.round(ctx / 1000);
    if (fired === 'backstop') {
      // Backstop is notification-only (D-backstop) — no in-context line.
      notify(`nxtlvl · context ~${k}K`, 'Past the quality zone — a good time to /compact soon.', env);
      return '';
    }
    notify(`nxtlvl · context ~${k}K`, 'A good moment to /compact at your next natural break.', env);
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: buildPrimaryMessage(ctx)
      }
    });
  } catch {
    return ''; // fail-open: never alter the session
  }
}

if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
  });
  process.stdin.on('end', () => {
    const out = run(data);
    if (out) process.stdout.write(out);
    process.exit(0);
  });
}

module.exports = {
  run,
  liveContextTokens,
  lastUsageFromText,
  sanitizeSessionId,
  resolveThreshold,
  resolveBackstop,
  buildPrimaryMessage,
  notify
};
