// bookmarks — the per-session "where I left off" trail for the C&M subsystem.
//
// One dated note per session, GROUPED BY branch (folder fallback off-git), stored
// as append-only JSONL: one file per group key at `bookmarksDir/<groupKey>.jsonl`.
// The SessionEnd close hook writes a note; the SessionStart briefing reads the
// NEWEST note for the current group and compares it against observation-log
// activity to decide whether the saved note is stale.
//
// This module is path-aware (it composes ./paths.layout to find bookmarksDir) but
// otherwise thin: it leans on ./atomic.appendLine for the §7-b atomic JSONL append
// and on ./project-identity.branchOrFolderKey for branch-keyed grouping. It owns no
// new invariants — it sequences the Wave-1 primitives into the bookmark contract.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { layout, ensureDir } = require('./paths.ts');
const { appendLine } = require('./atomic.js');
const { branchOrFolderKey } = require('./project-identity.js');

// Absolute path to a group's JSONL file: bookmarksDir/<groupKey>.jsonl.
function groupFile(projectId, groupKey) {
  return path.join(layout(projectId).bookmarksDir, `${groupKey}.jsonl`);
}

// --- Grouping key -----------------------------------------------------------
// Thin wrapper: the bookmark trail is branch-keyed with a folder fallback off-git
// or on a detached HEAD. Returns the bare key string (callers want the group, not
// the source/raw triple — branchOrFolderKey owns that detail).
function groupKeyFor(cwd) {
  return branchOrFolderKey(cwd).key;
}

// --- Append a note ----------------------------------------------------------
// Build the bookmark record and atomically append it as one JSONL line. `ts`
// defaults to now (ISO); `branch` is always the groupKey (the grouping axis the
// record is filed under). `opts` may carry { session, ts }. Returns the stored
// record so the caller (the close hook) can echo exactly what was persisted.
function append(projectId, groupKey, note, opts = {}) {
  const record = {
    ts: opts.ts || new Date().toISOString(),
    note,
    branch: groupKey,
  };
  // Only carry `session` when given, so the returned record matches exactly what
  // round-trips through JSONL (JSON.stringify drops undefined-valued keys anyway).
  if (opts.session !== undefined) record.session = opts.session;
  const target = groupFile(projectId, groupKey);
  ensureDir(layout(projectId).bookmarksDir);
  appendLine(target, JSON.stringify(record));
  return record;
}

// --- Read all records for a group (append order) ----------------------------
// Returns every parseable record for the group in append order; [] if the file
// is missing or empty. A torn/unparseable line (e.g. a crash mid-write on a
// non-atomic FS) is SKIPPED, never thrown — a reader must survive a bad line.
function readTrail(projectId, groupKey) {
  const target = groupFile(projectId, groupKey);
  let raw;
  try {
    raw = fs.readFileSync(target, 'utf8');
  } catch {
    return []; // missing file -> empty trail, never throw.
  }
  const out = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // skip the torn line; keep reading the rest of the trail.
    }
  }
  return out;
}

// --- Read the newest record for a group -------------------------------------
// The last parseable record in append order, or null if the group has none.
function readNewest(projectId, groupKey) {
  const trail = readTrail(projectId, groupKey);
  return trail.length ? trail[trail.length - 1] : null;
}

// --- Staleness compare ------------------------------------------------------
// "Is there observation-log activity NEWER than the newest saved bookmark?"
// `compareTs` is the newest observation's ts (ISO string or epoch ms), supplied
// by the caller (the briefing). Truth table:
//   - compareTs null/undefined            -> false (no known activity -> not stale)
//   - no newest bookmark, compareTs set    -> true  (activity exists, nothing saved)
//   - compareTs strictly newer than newest -> true
//   - compareTs older than or equal        -> false
// Never throws on a missing file (readNewest already returns null).
function isStale(projectId, groupKey, compareTs) {
  if (compareTs === null || compareTs === undefined) return false;
  const newest = readNewest(projectId, groupKey);
  if (!newest) return true; // activity but nothing saved yet.
  const compareMs = new Date(compareTs).getTime();
  const newestMs = new Date(newest.ts).getTime();
  // A non-parseable compareTs/newest.ts yields NaN; NaN comparisons are false,
  // so an unreadable timestamp fails toward "not stale" rather than throwing.
  return compareMs > newestMs;
}

module.exports = {
  groupKeyFor,
  append,
  readNewest,
  readTrail,
  isStale,
};
