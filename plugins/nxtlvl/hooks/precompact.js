#!/usr/bin/env node
/**
 * nxtlvl precompact hook  —  PreCompact
 *
 * Fires right before Claude Code compacts the conversation (manual `/compact`
 * or the ~900K auto-compaction). Its ONLY job is to steer the compaction
 * summary so the current task thread survives: emit an `additionalContext`
 * block that tells the summarizer to preserve the task + next step, the active
 * bookmark, and the key open files from the transcript.
 *
 * THIS HOOK PERFORMS NO WRITES: no bookmark, no metrics, no state.
 *
 * Output channel: JSON { hookSpecificOutput: { hookEventName: 'PreCompact',
 *   additionalContext } }, or '' for a no-op.
 *
 * FAIL-OPEN IS ABSOLUTE: the entire body is wrapped in one try/catch; any
 * error → ''. The hook must never block or alter compaction.
 *
 * Kill switch: NXTLVL_CM_PRECOMPACT=off
 * Skip guards:
 *   NXTLVL_CM_OBSERVER set (truthy, non-off) → '' (never steer the observer).
 *   isSidechain=true in event payload         → ''.
 */

'use strict';

const fs = require('node:fs');

const bookmarksLib    = require('../lib/bookmarks.js');
const projIdentLib    = require('../lib/project-identity.js');

// --- Constants ----------------------------------------------------------------

/** Max bytes to read from stdin. */
const MAX_STDIN = 4 * 1024 * 1024;

/** Max bytes to read from the transcript per invocation. */
const TAIL_BYTES = 4 * 1024 * 1024;

/** Max open-file entries to surface. */
const MAX_OPEN_FILES = 8;

/** Values that disable the hook. */
const OFF_VALUES = ['0', 'false', 'no', 'off', 'disabled'];

/**
 * Tool names whose `file_path` / `path` / `notebook_path` input we track as
 * "recently opened / touched" files. Order matters for the display label.
 */
const FILE_TOOLS = new Set(['Read', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit']);

// --- Helpers ------------------------------------------------------------------

/** True when an env value reads as an explicit off/disable switch. */
function isOffLike(raw) {
  return OFF_VALUES.includes(String(raw || '').trim().toLowerCase());
}

function isPrecompactDisabled(env) {
  return isOffLike(env.NXTLVL_CM_PRECOMPACT);
}

function isObserverRun(env) {
  const v = env.NXTLVL_CM_OBSERVER;
  return !!(v && !isOffLike(v));
}

/** Read up to the last maxBytes of a file. Returns { text, partial, full }. */
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
 * Default bounded transcript reader.
 * Returns the full text (may be tail-cut on very long transcripts).
 * Never throws — returns '' on any error.
 */
function readTranscriptDefault(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return '';
  try {
    fs.statSync(transcriptPath);
  } catch {
    return '';
  }
  try {
    const { text, full } = readTail(transcriptPath, TAIL_BYTES);
    if (full) return text;
    // Tail was cut — use the full file to avoid missing early tool calls.
    try {
      return fs.readFileSync(transcriptPath, 'utf8');
    } catch {
      return text; // best effort: return what we have
    }
  } catch {
    return '';
  }
}

/**
 * Extract recently-touched file paths from transcript text.
 * Scans all lines for main-thread (isSidechain !== true) assistant messages
 * with tool_use blocks whose name is in FILE_TOOLS. Returns paths de-duplicated,
 * most-recent-first, capped at MAX_OPEN_FILES.
 *
 * @param {string} text - raw JSONL transcript text
 * @param {boolean} dropFirst - if true, skip the first line (may be a partial tail cut)
 * @returns {string[]}
 */
function extractOpenFiles(text, dropFirst = false) {
  const lines = text.split('\n');
  const floor = dropFirst ? 1 : 0;
  // Collect in scan order (oldest first); we reverse at the end.
  const seen = new Set();
  const ordered = [];

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
    // Main-thread assistant messages only.
    if (o.type !== 'assistant' || o.isSidechain === true) continue;
    const msgContent = o.message && o.message.content;
    if (!Array.isArray(msgContent)) continue;

    for (const item of msgContent) {
      if (!item || item.type !== 'tool_use') continue;
      if (!FILE_TOOLS.has(item.name)) continue;
      const inp = item.input || {};
      const filePath = inp.file_path || inp.path || inp.notebook_path;
      if (filePath && typeof filePath === 'string') {
        if (!seen.has(filePath)) {
          seen.add(filePath);
          ordered.push(filePath);
        }
      }
    }
  }

  // Most-recent-first, capped.
  return ordered.reverse().slice(0, MAX_OPEN_FILES);
}

/**
 * Build the additionalContext steer string.
 *
 * @param {object|null} bookmark - { ts, note, branch } | null
 * @param {string[]}    openFiles
 * @param {string}      trigger  - 'manual' | 'auto'
 * @returns {string}
 */
function buildSteer(bookmark, openFiles, trigger) {
  const lines = [
    '## nxtlvl — preserve across compaction',
    '',
    '**Preserve task/next step:** When summarizing, preserve the current task and its ' +
    'immediate next step as an explicit, actionable line — do not collapse it to a topic.',
    '',
  ];

  // Bookmark block
  lines.push('**Last bookmark:**');
  if (bookmark && bookmark.note) {
    let dateStr = '';
    try {
      const d = new Date(bookmark.ts);
      dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      dateStr = bookmark.ts || '';
    }
    lines.push(`[${dateStr}] ${bookmark.note}`);
  } else {
    lines.push('No saved bookmark for this branch yet.');
  }

  // Open files block
  if (openFiles.length > 0) {
    lines.push('');
    lines.push('**Key open files (most-recent first):**');
    for (const f of openFiles) {
      lines.push(`- ${f}`);
    }
  }

  return lines.join('\n');
}

// --- Core --------------------------------------------------------------------

/**
 * @param {string} rawInput - PreCompact event JSON from stdin
 * @param {object} env      - process.env (or test substitute)
 * @param {object} deps     - injectable dependencies (for testing)
 *   deps.bookmarks        - { groupKeyFor, readNewest } (default: real module)
 *   deps.readTranscript   - (path) => string (default: bounded fs reader)
 *   deps.projectIdentity  - (cwd) => { key, source, raw } (default: real module)
 * @returns {string} JSON hook output to emit, or '' for a no-op
 */
function run(rawInput, env = process.env, deps = {}) {
  try {
    // Kill switch
    if (isPrecompactDisabled(env)) return '';

    // Observer self-watch guard
    if (isObserverRun(env)) return '';

    // Parse event
    const input = rawInput && rawInput.trim() ? JSON.parse(rawInput) : {};

    // Sidechain guard
    if (input.isSidechain === true) return '';

    const cwd = input.cwd || process.cwd();
    const trigger = input.trigger || 'unknown';
    const transcriptPath = input.transcript_path || null;

    // Resolve injectable deps
    const bookmarks      = deps.bookmarks      || bookmarksLib;
    const readTranscript = deps.readTranscript || readTranscriptDefault;
    const projectId_fn   = deps.projectIdentity || projIdentLib.projectIdentity;

    // Resolve project identity and group key
    const identity  = projectId_fn(cwd);
    const projectId = identity.key;
    const groupKey  = bookmarks.groupKeyFor(cwd);

    // Read newest bookmark (read-only — never write)
    const bookmark = bookmarks.readNewest(projectId, groupKey);

    // Extract recently-touched files from the transcript (read-only)
    const transcriptText = readTranscript(transcriptPath);
    const openFiles = extractOpenFiles(transcriptText, false);

    // If there is genuinely nothing to say, emit ''
    if (!bookmark && openFiles.length === 0) {
      // Still emit the preserve-task instruction — it is always useful.
      // Only skip entirely if there is nothing at all (no text will land).
    }

    const additionalContext = buildSteer(bookmark, openFiles, trigger);

    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreCompact',
        additionalContext,
      },
    });
  } catch {
    return ''; // fail-open: never block compaction
  }
}

// --- stdin entrypoint --------------------------------------------------------

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

// --- Exports (for testing) ---------------------------------------------------

module.exports = {
  run,
  isOffLike,
  isPrecompactDisabled,
  isObserverRun,
  extractOpenFiles,
  buildSteer,
};
