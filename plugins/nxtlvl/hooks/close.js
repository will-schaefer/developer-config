#!/usr/bin/env node
/**
 * nxtlvl close hook  —  SessionEnd
 *
 * At session end, writes a dated "where I left off" bookmark and records a
 * per-session close telemetry line — but ONLY when the session was non-trivial:
 *
 *   GATE: (toolCalls >= N) OR (a commit or file-mutation occurred this session)
 *
 * N defaults to 10 (NXTLVL_CM_CLOSE_MIN). A "glanced and left" session must NOT
 * bury a substantive prior note; the gate keeps the trail clean.
 *
 * Data source: input.transcript_path (same file context-alert.js reads). All
 * transcript analysis reuses the tail-read + JSON-per-line parsing idiom from
 * context-alert.js. This lets close work even when capture is disabled.
 *
 * SessionEnd output is IGNORED by the harness, so this hook is side-effecting
 * only (writes files). run() RETURNS A RESULT OBJECT for tests; the CLI wrapper
 * exits 0 printing nothing.
 *
 * FAIL-OPEN IS ABSOLUTE: every path exits 0. On any error the hook does nothing
 * and returns. A failed close must never surface an error at session end.
 *
 * Kill switch: NXTLVL_CM_CLOSE=off
 * Skip guards: NXTLVL_CM_OBSERVER set, isSidechain=true in event payload.
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const bookmarksLib    = require('../lib/bookmarks.js');
const { scrubText }   = require('../lib/scrub.js');
const { appendLine }  = require('../lib/atomic.js');
const { layout, ensureDir } = require('../lib/paths.js');
const { projectIdentity } = require('../lib/project-identity.js');

// --- Constants ----------------------------------------------------------------

/** Max bytes to read from the transcript per invocation (mirrors context-alert). */
const TAIL_BYTES = 4 * 1024 * 1024;

/** Max bytes to read from stdin. */
const MAX_STDIN = 4 * 1024 * 1024;

/** Default minimum tool-call count before writing a bookmark. */
const DEFAULT_CLOSE_MIN = 10;

/** Max chars for the firstUserText core of the bookmark note. */
const NOTE_CORE_MAX = 180;

/** Values that disable features. */
const OFF_VALUES = ['0', 'false', 'no', 'off', 'disabled'];

// --- Helpers ------------------------------------------------------------------

/** True when an env value reads as an explicit off/disable switch. */
function isOffLike(raw) {
  return OFF_VALUES.includes(String(raw || '').trim().toLowerCase());
}

function isCloseDisabled(env) {
  return isOffLike(env.NXTLVL_CM_CLOSE);
}

function isObserverRun(env) {
  const v = env.NXTLVL_CM_OBSERVER;
  return !!(v && !isOffLike(v));
}

/** Parse NXTLVL_CM_CLOSE_MIN: positive int, else DEFAULT_CLOSE_MIN. */
function resolveCloseMin(env) {
  const n = parseInt(env.NXTLVL_CM_CLOSE_MIN, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CLOSE_MIN;
}

/** Read up to the last maxBytes of a file. Returns { text, partial }. */
function readTail(filePath, maxBytes) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    const start = size > maxBytes ? size - maxBytes : 0;
    const len = size - start;
    if (len <= 0) return { text: '', partial: false, full: true };
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    return { text: buf.toString('utf8'), partial: start > 0, full: start === 0 };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * File-mutator tool names (Write/Edit/MultiEdit/NotebookEdit).
 * Mutations via these tools mark the session as having changed files.
 */
const MUTATOR_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

/**
 * Bash mutation/commit pattern (conservative, commented):
 *   git commit              — any commit operation
 *   git merge               — merge is also a commit
 *   (^|\s)>>?\s+[a-zA-Z_~\/.$]
 *                           — shell redirection writes (e.g. echo foo > file, cat a >> log).
 *                             Requires the operator to be preceded by start-of-string or
 *                             whitespace, and the redirect target to start with a path-like
 *                             character (alpha, _  ~ / . $).  This avoids matching > embedded
 *                             in argument strings (e.g. grep patterns "x>y", jq filters
 *                             "select(.a > 0)", git format strings "%H > %s").
 *                             Residual limitation: a comparison-inside-quotes whose target
 *                             word starts with a letter (e.g. echo "val > min") may still
 *                             match — this rare false-positive is accepted over a general >
 *                             bomb that would wrongly classify all read-only sessions.
 *   \bmv \b                 — file rename/move
 *   \brm \b                 — file delete
 *   sed -i                  — in-place edit
 *   \btee \b                — writes to a file via tee
 *   \bmkdir \b              — directory creation
 *   \btouch \b              — file creation/timestamp update
 */
const BASH_MUTATION_RE = /git commit|git merge|(^|\s)>>?\s+[a-zA-Z_~\/.$]|\bmv\s|\brm\s|sed\s+-i|\btee\s|\bmkdir\s|\btouch\s/;

/**
 * Analyse all lines of transcript text and extract session stats:
 *   toolCalls     — count of tool_use blocks in main-thread assistant messages
 *   mutation      — any mutating tool_use detected
 *   committed     — any Bash tool_use with git commit in the command
 *   firstUserText — text of the first user message with plain text content
 */
function analyseTranscript(text, dropFirst = false) {
  let toolCalls = 0;
  let mutation = false;
  let committed = false;
  let firstUserText = null;

  const lines = text.split('\n');
  const floor = dropFirst ? 1 : 0;

  for (let i = floor; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (!o || typeof o !== 'object') continue;

    // User message: capture firstUserText from the first plain-text user message.
    if (o.type === 'user' && firstUserText === null) {
      const content = o.message && o.message.content;
      if (typeof content === 'string' && content.trim()) {
        firstUserText = content.trim();
      } else if (Array.isArray(content)) {
        for (const item of content) {
          if (item && (item.type === 'text' || item.type === undefined) && typeof item.text === 'string' && item.text.trim()) {
            firstUserText = item.text.trim();
            break;
          }
        }
      }
    }

    // Main-thread assistant messages only (skip sidechain).
    if (o.type !== 'assistant' || o.isSidechain === true) continue;
    const msgContent = o.message && o.message.content;
    if (!Array.isArray(msgContent)) continue;

    for (const item of msgContent) {
      if (!item || item.type !== 'tool_use') continue;
      toolCalls++;

      const toolName = item.name || '';

      // Mutator tool check (Write/Edit/MultiEdit/NotebookEdit)
      if (MUTATOR_TOOLS.has(toolName)) {
        mutation = true;
      }

      // Bash mutation/commit check
      if (toolName === 'Bash') {
        const cmd = (item.input && typeof item.input.command === 'string')
          ? item.input.command
          : '';
        if (cmd && BASH_MUTATION_RE.test(cmd)) {
          mutation = true;
        }
        if (cmd && /git commit/.test(cmd)) {
          committed = true;
        }
      }
    }
  }

  return { toolCalls, mutation, committed, firstUserText };
}

/**
 * Read and analyse a transcript file (bounded by TAIL_BYTES).
 * Falls back to a full read when a tail cut may have missed data.
 * Returns analyseTranscript result, or null on any error.
 */
function readTranscriptDefault(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null;
  try {
    fs.statSync(transcriptPath);
  } catch {
    return null;
  }
  try {
    const { text, partial, full } = readTail(transcriptPath, TAIL_BYTES);
    let stats = analyseTranscript(text, partial);
    // If toolCalls is suspiciously low and the tail was cut, do a full read.
    if (!full) {
      const whole = fs.readFileSync(transcriptPath, 'utf8');
      stats = analyseTranscript(whole, false);
    }
    return stats;
  } catch {
    return null;
  }
}

/**
 * Build the bookmark note from transcript stats and branch name.
 * @param {object} stats - { toolCalls, mutation, committed, firstUserText }
 * @param {string} branch - the current branch / groupKey
 * @param {Function} scrubFn - injectable scrubText
 * @returns {string} the note
 */
function buildNote(stats, branch, scrubFn) {
  const { toolCalls, mutation, committed, firstUserText } = stats;

  let core;
  if (firstUserText) {
    try {
      const scrubbed = scrubFn(firstUserText);
      core = scrubbed.length > NOTE_CORE_MAX
        ? scrubbed.slice(0, NOTE_CORE_MAX)
        : scrubbed;
    } catch {
      // scrub failed — fail-open: use generic core
      core = null;
    }
  }
  if (!core) {
    core = `Session on ${branch}`;
  }

  // Tail: stats summary
  let effectLabel = '';
  if (committed) {
    effectLabel = '; committed';
  } else if (mutation) {
    effectLabel = '; files changed';
  }
  const tail = ` — [${toolCalls} tool calls${effectLabel}; branch ${branch}]`;

  return core + tail;
}

// --- Core run() ---------------------------------------------------------------

/**
 * @param {string} rawInput - SessionEnd event JSON (from stdin)
 * @param {object} env      - process.env or test substitute
 * @param {object} deps     - injectable deps for testability:
 *   deps.bookmarks          - { groupKeyFor, append } (default: real module)
 *   deps.scrubText          - (text) => string (default: real scrubText)
 *   deps.readTranscript     - (path) => stats|null (default: readTranscriptDefault)
 *
 * @returns {{ processed, bookmarkWritten, note, toolCalls, mutation, committed }}
 *   or null on skip/guard/kill path.
 */
function run(rawInput, env = process.env, deps = {}) {
  try {
    // Kill switch
    if (isCloseDisabled(env)) return null;

    // Observer guard
    if (isObserverRun(env)) return null;

    // Parse event
    const input = rawInput && rawInput.trim() ? JSON.parse(rawInput) : {};

    // Sidechain guard
    if (input.isSidechain === true) return null;

    const cwd = input.cwd || process.cwd();
    const session = input.session_id || null;
    const reason = input.reason || null;
    const transcriptPath = input.transcript_path || null;

    // Resolve injectable deps (default to real implementations)
    const bm         = deps.bookmarks    || bookmarksLib;
    const scrub      = deps.scrubText    || scrubText;
    const readTx     = deps.readTranscript || readTranscriptDefault;

    // Analyse the transcript
    const stats = readTx(transcriptPath);
    const toolCalls  = (stats && stats.toolCalls)  || 0;
    const mutation   = (stats && stats.mutation)   || false;
    const committed  = (stats && stats.committed)  || false;
    const firstUserText = (stats && stats.firstUserText) || null;

    // Resolve project identity + group key
    const identity = projectIdentity(cwd);
    const projectId = identity.key;
    const groupKey  = bm.groupKeyFor(cwd);

    // --- Size gate (LOCKED spec X1 / D2): write bookmark when: ---
    //   toolCalls >= N  OR  mutation/commit occurred
    const closeMin = resolveCloseMin(env);
    const gateOpen = toolCalls >= closeMin || mutation || committed;

    // Always record the metrics line (regardless of bookmark gate).
    // This is the substrate for Task 6.1's metrics readouts.
    let bookmarkWritten = false;
    let note = null;

    // Write bookmark when gate is open
    if (gateOpen) {
      note = buildNote({ toolCalls, mutation, committed, firstUserText }, groupKey, scrub);
      bm.append(projectId, groupKey, note, { session: session || undefined, ts: new Date().toISOString() });
      bookmarkWritten = true;
    }

    // Record session-close telemetry line
    const ts = new Date().toISOString();
    const metricsRecord = {
      ts,
      session,
      event: 'session_close',
      toolCalls,
      mutation,
      committed,
      bookmarkWritten,
      reason,
    };
    const projectDir = layout(projectId).projectDir;
    ensureDir(projectDir);
    appendLine(path.join(projectDir, 'metrics.jsonl'), JSON.stringify(metricsRecord));

    return {
      processed: true,
      bookmarkWritten,
      note,
      toolCalls,
      mutation,
      committed,
    };
  } catch {
    // Absolute fail-open: never surface an error at session end.
    return { processed: false };
  }
}

// --- stdin entrypoint ---------------------------------------------------------

if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
  });
  process.stdin.on('end', () => {
    run(data);
    process.exit(0);
  });
}

// --- Exports (for testing) ----------------------------------------------------

module.exports = {
  run,
  isOffLike,
  isCloseDisabled,
  isObserverRun,
  resolveCloseMin,
  analyseTranscript,
  buildNote,
  DEFAULT_CLOSE_MIN,
  NOTE_CORE_MAX,
};
