// obs-log — the append-only JSONL observation log (ecc `observations.jsonl` shape).
//
// This is the durable, crash-safe SUBSTRATE of the C&M subsystem: one record per
// tool call, appended to <projectDir>/observations.jsonl. Everything downstream
// (the observer that distils instincts, the cadence gate, purge/archive) reads
// through this module. It stores exactly what it is given — secret-scrubbing is a
// DIFFERENT module's job; obs-log never inspects or redacts payloads.
//
// Crash-safety rests on three properties:
//
//   1. Appends go through atomic.appendLine (O_APPEND, one physical line). A torn
//      LAST line (a crash mid-append) is the only corruption possible, and every
//      reader SKIPS unparseable lines rather than throwing.
//
//   2. The read cursor is PURGE-SAFE. A line-count or byte-offset cursor breaks the
//      instant purge drops old entries and shifts positions. Instead each record
//      carries a monotonic per-project `seq`, and the cursor stores the last
//      CONSUMED seq. readNew returns `seq > cursor.seq` and advances to the max seq
//      returned — so purge dropping low-seq (old, already-consumed) entries can
//      never cause a skip or a re-read.
//
//   3. The seq counter and cursor are written atomically (tmp+rename), so a crash
//      can never leave a torn counter that hands out a duplicate seq.

'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');

const { layout, ensureDir } = require('./paths.ts');
const { atomicWrite, appendLine } = require('./atomic.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_AGE_DAYS = 30;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

// --- internal helpers -------------------------------------------------------

// Resolve the storage layout for a project. `opts.env`/`opts.home` let tests point
// the storage root at a tmp dir (env = { XDG_STATE_HOME: <tmp> }); production passes
// neither, so layout() falls back to process.env / os.homedir().
function layoutFor(projectId, opts = {}) {
  return layout(projectId, opts.env, opts.home);
}

// Seq counter lives next to the log. It is the single source of monotonicity per
// project; read-modify-write is serialized by the synchronous hook execution model.
function seqPath(paths) {
  return paths.projectDir + '/obs-seq.json';
}

function readSeqCounter(paths) {
  try {
    const raw = fs.readFileSync(seqPath(paths), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Number.isInteger(parsed.next)) return parsed.next;
  } catch {
    // missing/torn counter — start fresh at 0.
  }
  return 0;
}

function writeSeqCounter(paths, next) {
  atomicWrite(seqPath(paths), JSON.stringify({ next }));
}

// Allocate the next monotonic seq for this project and persist counter+1 atomically.
function nextSeq(paths) {
  const seq = readSeqCounter(paths);
  writeSeqCounter(paths, seq + 1);
  return seq;
}

function readCursor(paths) {
  try {
    const raw = fs.readFileSync(paths.obsCursor, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Number.isInteger(parsed.seq)) return parsed.seq;
  } catch {
    // missing/torn cursor — nothing consumed yet.
  }
  return -1;
}

function writeCursor(paths, seq) {
  atomicWrite(paths.obsCursor, JSON.stringify({ seq }));
}

// Parse every full JSONL line in `raw`, SKIPPING any line that does not parse —
// a torn last line from a crash, or a record missing a usable integer seq. This is
// the one tolerance every reader shares: corruption is dropped, never thrown.
function parseLines(raw) {
  const out = [];
  for (const line of raw.split('\n')) {
    if (line.length === 0) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue; // torn/partial/invalid line — skip it
    }
    if (rec && Number.isInteger(rec.seq)) out.push(rec);
  }
  return out;
}

// Read + parse the whole current log. A missing file is an empty log, not an error.
function readLogFile(paths) {
  let raw;
  try {
    raw = fs.readFileSync(paths.observationsLog, 'utf8');
  } catch {
    return [];
  }
  return parseLines(raw);
}

// --- public API -------------------------------------------------------------

// append(projectId, obs, opts?) -> storedRecord
// Fill in id/seq/ts if absent, normalize the record to the observation shape, and
// append it as a single JSON line to observationsLog. Returns the stored record.
function append(projectId, obs = {}, opts = {}) {
  const paths = layoutFor(projectId, opts);
  ensureDir(paths.projectDir);

  const seq = nextSeq(paths);
  const event = obs.event === 'tool_complete' ? 'tool_complete' : 'tool_start';

  const record = {
    id: obs.id || crypto.randomUUID(),
    seq,
    ts: obs.ts || new Date().toISOString(),
    event,
    tool: obs.tool ?? null,
    // input belongs to tool_start, output to tool_complete; the other is null.
    input: event === 'tool_start' ? (obs.input ?? null) : null,
    output: event === 'tool_complete' ? (obs.output ?? null) : null,
    session: obs.session ?? null,
    tool_use_id: obs.tool_use_id ?? null,
    cwd: obs.cwd ?? null,
  };

  // JSON.stringify FIRST so the record is exactly one physical line (appendLine
  // would otherwise collapse any embedded newline to a space, but stringify is the
  // contract every reader relies on).
  appendLine(paths.observationsLog, JSON.stringify(record));
  return record;
}

// readNew(projectId) -> { entries, cursorSeq }
// Return all entries with seq > cursor.seq (seq-ordered), and advance the cursor to
// the max seq returned, atomically. A second call with no new appends returns [].
function readNew(projectId, opts = {}) {
  const paths = layoutFor(projectId, opts);
  const cursorSeq = readCursor(paths);

  const entries = readLogFile(paths)
    .filter((r) => r.seq > cursorSeq)
    .sort((a, b) => a.seq - b.seq);

  if (entries.length > 0) {
    const maxSeq = entries[entries.length - 1].seq;
    writeCursor(paths, maxSeq);
    return { entries, cursorSeq: maxSeq };
  }
  return { entries, cursorSeq };
}

// pendingCount(projectId) -> number
// Count entries with seq > cursor.seq WITHOUT advancing the cursor. The cadence gate
// polls this to decide whether to wake the observer; it must be side-effect free.
function pendingCount(projectId, opts = {}) {
  const paths = layoutFor(projectId, opts);
  const cursorSeq = readCursor(paths);
  return readLogFile(paths).filter((r) => r.seq > cursorSeq).length;
}

// readAll(projectId) -> entries[]   (all current-file entries, parsed, seq-ordered)
function readAll(projectId, opts = {}) {
  const paths = layoutFor(projectId, opts);
  return readLogFile(paths).sort((a, b) => a.seq - b.seq);
}

// count(projectId) -> number   (current-file entry count)
function count(projectId, opts = {}) {
  const paths = layoutFor(projectId, opts);
  return readLogFile(paths).length;
}

// purge(projectId, opts?) -> { droppedOld, archived }
//
//   1. If the current log is >= maxBytes: move the WHOLE file to
//      <obsArchiveDir>/observations-<ISO>.jsonl, start a fresh file, and re-append
//      the UNCONSUMED tail (seq > cursor.seq) so the observer never loses pending
//      work. Sets archived = true.
//   2. Drop entries whose ts is older than maxAgeDays — but NEVER drop an unconsumed
//      entry (seq > cursor.seq) even if old. Rewrite the file atomically.
//   3. Tolerate a missing/empty log: return { droppedOld: 0, archived: false }.
function purge(projectId, opts = {}) {
  const {
    maxAgeDays = DEFAULT_MAX_AGE_DAYS,
    maxBytes = DEFAULT_MAX_BYTES,
    now = Date.now(),
  } = opts;

  const paths = layoutFor(projectId, opts);
  const cursorSeq = readCursor(paths);

  // Current on-disk size (0 if the file is missing).
  let size = 0;
  try {
    size = fs.statSync(paths.observationsLog).size;
  } catch {
    return { droppedOld: 0, archived: false };
  }

  let archived = false;

  // --- Step 1: size-cap archive ---------------------------------------------
  // Move the whole file aside, then keep only the unconsumed tail in a fresh log.
  if (size >= maxBytes) {
    const all = readLogFile(paths);
    ensureDir(paths.obsArchiveDir);
    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
    const archivePath = `${paths.obsArchiveDir}/observations-${stamp}.jsonl`;
    // Preserve the original bytes verbatim (torn lines and all) in the archive.
    fs.renameSync(paths.observationsLog, archivePath);
    archived = true;

    const tail = all.filter((r) => r.seq > cursorSeq).sort((a, b) => a.seq - b.seq);
    // Fresh log = just the unconsumed tail (atomic write, even when empty).
    atomicWrite(
      paths.observationsLog,
      tail.map((r) => JSON.stringify(r)).join('\n') + (tail.length ? '\n' : ''),
    );
  }

  // --- Step 2: age-based drop ------------------------------------------------
  // Drop consumed entries older than maxAgeDays; keep everything unconsumed.
  const cutoff = now - maxAgeDays * DAY_MS;
  const current = readLogFile(paths);

  const kept = [];
  let droppedOld = 0;
  for (const r of current) {
    const unconsumed = r.seq > cursorSeq;
    const t = Date.parse(r.ts);
    const tooOld = Number.isFinite(t) && t < cutoff;
    if (tooOld && !unconsumed) {
      droppedOld += 1;
      continue;
    }
    kept.push(r);
  }

  if (droppedOld > 0) {
    kept.sort((a, b) => a.seq - b.seq);
    atomicWrite(
      paths.observationsLog,
      kept.map((r) => JSON.stringify(r)).join('\n') + (kept.length ? '\n' : ''),
    );
  }

  return { droppedOld, archived };
}

module.exports = {
  append,
  readNew,
  pendingCount,
  readAll,
  count,
  purge,
};
