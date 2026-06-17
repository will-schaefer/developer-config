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
 * Cadence: fires once when context crosses the threshold upward, then
 * re-arms when context falls back below REARM_FRACTION * threshold
 * (e.g. after auto-compaction), so each climb past the line alerts once.
 *
 * Tunable via env:
 *   NXTLVL_CONTEXT_ALERT_TOKENS   threshold in tokens (default 200000)
 *   NXTLVL_CONTEXT_ALERT          set to off/0/false to disable entirely
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_THRESHOLD = 200000;
const REARM_FRACTION = 0.9; // re-arm once context drops below 90% of threshold
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
    return s && typeof s === 'object' ? s : { alerted: false };
  } catch {
    return { alerted: false };
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

function buildMessage(ctx, threshold) {
  const k = Math.round(ctx / 1000);
  const mark = Math.round(threshold / 1000);
  return (
    `CONTEXT NOTICE: ~${k}K tokens now in context (crossed the ${mark}K mark). ` +
    'Begin winding down to a clean stopping point rather than starting new work: ' +
    'finish or checkpoint the step in progress, commit or save anything uncommitted, ' +
    'and write a short summary of what remains. Then run /compact to reclaim context ' +
    'before continuing — and if you cannot invoke it yourself, tell the user it is a ' +
    'good moment to run /compact.'
  );
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

    const threshold = resolveThreshold(env);
    const rearm = Math.floor(threshold * REARM_FRACTION);
    const state = readState(sessionId);

    if (ctx >= threshold) {
      if (state.alerted) return ''; // already alerted on this crossing
      writeState(sessionId, { alerted: true });
      return JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: buildMessage(ctx, threshold)
        }
      });
    }

    // Below threshold: re-arm once we drop under the hysteresis floor.
    if (ctx < rearm && state.alerted) {
      writeState(sessionId, { alerted: false });
    }
    return '';
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
  buildMessage
};
