'use strict';
/**
 * nxtlvl open-files lib
 *
 * Extracts the recently-touched file paths from a session transcript (JSONL).
 * Used by the SessionStart briefing on the post-compaction path (source ===
 * 'compact') to re-surface the "key open files" that the compaction summary
 * would otherwise lose.
 *
 * History: this logic originally lived in the PreCompact hook (precompact.js),
 * which was retired — Claude Code's hook output schema has no `PreCompact`
 * branch, so a PreCompact hook cannot inject `additionalContext` at all. The
 * only supported post-compaction injection channel is SessionStart with
 * `source: 'compact'`, so the open-files extraction moved here.
 *
 * Read-only: never writes. Every entry point is total — it returns empty
 * rather than throwing, so the briefing's fail-open contract is preserved.
 */

const fs = require('node:fs');

/** Max bytes to read from the transcript per invocation. */
const TAIL_BYTES = 4 * 1024 * 1024;

/** Max open-file entries to surface. */
const MAX_OPEN_FILES = 8;

/**
 * Tool names whose `file_path` / `path` / `notebook_path` input we track as
 * "recently opened / touched" files.
 */
const FILE_TOOLS = new Set(['Read', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit']);

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
 * Returns { text, dropFirst } — text is tail-bounded (never full-file),
 * dropFirst=true when the tail was cut so extractOpenFiles can skip the
 * potentially-truncated first line. Never throws — returns
 * { text: '', dropFirst: false } on any error.
 */
function readTranscriptDefault(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return { text: '', dropFirst: false };
  try {
    fs.statSync(transcriptPath);
  } catch {
    return { text: '', dropFirst: false };
  }
  try {
    const { text, partial } = readTail(transcriptPath, TAIL_BYTES);
    // When partial, the first line may be truncated — signal extractOpenFiles to skip it.
    return { text, dropFirst: partial };
  } catch {
    return { text: '', dropFirst: false };
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
  if (!text || typeof text !== 'string') return [];
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
        // Move the file to the most-recent position on every touch.
        // A file touched early and re-touched later must rank as most-recent.
        if (seen.has(filePath)) {
          const idx = ordered.indexOf(filePath);
          if (idx !== -1) ordered.splice(idx, 1);
        } else {
          seen.add(filePath);
        }
        ordered.push(filePath);
      }
    }
  }

  // Most-recent-first, capped.
  return ordered.reverse().slice(0, MAX_OPEN_FILES);
}

module.exports = {
  TAIL_BYTES,
  MAX_OPEN_FILES,
  FILE_TOOLS,
  readTail,
  readTranscriptDefault,
  extractOpenFiles,
};
