// Tests for lib/obs-log.js — the append-only JSONL observation log.
//
// Hermetic: every test points the storage root at a fresh mkdtemp dir under
// os.tmpdir() by passing { env: { XDG_STATE_HOME: <tmp> } } as the opts arg, and
// cleans it up in after(). node:test + node:assert/strict, run with `node --test`.

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const obsLog = require('./obs-log.js');
const { layout } = require('./paths.ts');

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nxtlvl-obslog-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// All paths land under tmpDir via XDG_STATE_HOME. opts threads the same env into
// every obs-log call so reads and writes hit the same isolated store.
function opts() {
  return { env: { XDG_STATE_HOME: tmpDir } };
}

function layoutFor(projectId) {
  return layout(projectId, { XDG_STATE_HOME: tmpDir });
}

// Unique project id per test so tests never share a log.
let counter = 0;
function freshProject() {
  counter += 1;
  return `proj-${counter}-${Date.now()}`;
}

// --- append + record shape --------------------------------------------------

test('append assigns id/seq/ts and normalizes the record shape (tool_start)', () => {
  const p = freshProject();
  const rec = obsLog.append(
    p,
    { event: 'tool_start', tool: 'Read', input: { file: 'x' }, session: 's1', tool_use_id: 'tu1', cwd: '/repo' },
    opts(),
  );
  assert.ok(typeof rec.id === 'string' && rec.id.length > 0, 'id assigned');
  assert.equal(rec.seq, 0, 'first seq is 0');
  assert.ok(typeof rec.ts === 'string' && rec.ts.length > 0, 'ts assigned');
  assert.equal(rec.event, 'tool_start');
  assert.equal(rec.tool, 'Read');
  assert.deepEqual(rec.input, { file: 'x' });
  assert.equal(rec.output, null, 'output is null on tool_start');
  assert.equal(rec.session, 's1');
  assert.equal(rec.tool_use_id, 'tu1');
  assert.equal(rec.cwd, '/repo');
});

test('append on tool_complete keeps output and nulls input', () => {
  const p = freshProject();
  const rec = obsLog.append(p, { event: 'tool_complete', tool: 'Read', output: { ok: true }, input: { ignored: 1 } }, opts());
  assert.equal(rec.event, 'tool_complete');
  assert.equal(rec.input, null, 'input nulled on tool_complete');
  assert.deepEqual(rec.output, { ok: true });
});

test('append seq is monotonic per project', () => {
  const p = freshProject();
  const a = obsLog.append(p, { event: 'tool_start', tool: 'A' }, opts());
  const b = obsLog.append(p, { event: 'tool_start', tool: 'B' }, opts());
  const c = obsLog.append(p, { event: 'tool_start', tool: 'C' }, opts());
  assert.deepEqual([a.seq, b.seq, c.seq], [0, 1, 2]);
});

// --- cursored read ----------------------------------------------------------

test('append 3 -> readNew returns those 3 (seq-ordered) and advances; immediate re-read is []', () => {
  const p = freshProject();
  obsLog.append(p, { event: 'tool_start', tool: 'A' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'B' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'C' }, opts());

  const first = obsLog.readNew(p, opts());
  assert.equal(first.entries.length, 3);
  assert.deepEqual(first.entries.map((e) => e.seq), [0, 1, 2], 'seq-ordered');
  assert.deepEqual(first.entries.map((e) => e.tool), ['A', 'B', 'C']);
  assert.equal(first.cursorSeq, 2, 'cursor advanced to max seq');

  const second = obsLog.readNew(p, opts());
  assert.deepEqual(second.entries, [], 'no new entries on immediate re-read');
  assert.equal(second.cursorSeq, 2, 'cursor unchanged');
});

test('append more after a read -> readNew returns only the new ones', () => {
  const p = freshProject();
  obsLog.append(p, { event: 'tool_start', tool: 'A' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'B' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'C' }, opts());
  obsLog.readNew(p, opts()); // consume first 3

  obsLog.append(p, { event: 'tool_start', tool: 'D' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'E' }, opts());

  const next = obsLog.readNew(p, opts());
  assert.equal(next.entries.length, 2, 'only the 2 new entries');
  assert.deepEqual(next.entries.map((e) => e.tool), ['D', 'E']);
  assert.deepEqual(next.entries.map((e) => e.seq), [3, 4]);
  assert.equal(next.cursorSeq, 4);
});

test('readNew on an untouched project returns [] without throwing', () => {
  const p = freshProject();
  const r = obsLog.readNew(p, opts());
  assert.deepEqual(r.entries, []);
  assert.equal(r.cursorSeq, -1, 'nothing consumed yet');
});

// --- pendingCount -----------------------------------------------------------

test('pendingCount returns N without advancing; a following readNew still returns N', () => {
  const p = freshProject();
  obsLog.append(p, { event: 'tool_start', tool: 'A' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'B' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'C' }, opts());

  assert.equal(obsLog.pendingCount(p, opts()), 3, 'first pendingCount');
  assert.equal(obsLog.pendingCount(p, opts()), 3, 'second pendingCount unchanged (no advance)');

  const r = obsLog.readNew(p, opts());
  assert.equal(r.entries.length, 3, 'readNew still sees all 3 — pendingCount did not consume');

  assert.equal(obsLog.pendingCount(p, opts()), 0, 'after consuming, nothing pending');
});

// --- count / readAll --------------------------------------------------------

test('count and readAll reflect all current entries (independent of the cursor)', () => {
  const p = freshProject();
  obsLog.append(p, { event: 'tool_start', tool: 'A' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'B' }, opts());
  obsLog.readNew(p, opts()); // advance cursor past everything
  obsLog.append(p, { event: 'tool_start', tool: 'C' }, opts());

  assert.equal(obsLog.count(p, opts()), 3, 'count includes consumed + unconsumed');
  const all = obsLog.readAll(p, opts());
  assert.deepEqual(all.map((e) => e.tool), ['A', 'B', 'C'], 'readAll seq-ordered, all entries');
});

// --- purge: age-based drop --------------------------------------------------

test('purge drops a 40-day-old CONSUMED entry but keeps a 40-day-old UNCONSUMED one', () => {
  const p = freshProject();
  const now = Date.now();
  const oldTs = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();

  // seq 0: old + will be consumed -> should be dropped.
  obsLog.append(p, { event: 'tool_start', tool: 'OLD-CONSUMED', ts: oldTs }, opts());
  // Consume seq 0 (cursor -> 0).
  obsLog.readNew(p, opts());

  // seq 1: old but NOT consumed -> must be kept.
  obsLog.append(p, { event: 'tool_start', tool: 'OLD-UNCONSUMED', ts: oldTs }, opts());
  // seq 2: fresh, unconsumed -> kept.
  obsLog.append(p, { event: 'tool_start', tool: 'FRESH' }, opts());

  const res = obsLog.purge(p, { ...opts(), now });
  assert.equal(res.archived, false, 'no archive below the size cap');
  assert.equal(res.droppedOld, 1, 'exactly the old+consumed entry dropped');

  const remaining = obsLog.readAll(p, opts()).map((e) => e.tool);
  assert.deepEqual(remaining, ['OLD-UNCONSUMED', 'FRESH'], 'old-consumed gone; old-unconsumed kept');
});

test('purge tolerates a missing log (returns droppedOld:0, archived:false, no throw)', () => {
  const p = freshProject();
  let res;
  assert.doesNotThrow(() => {
    res = obsLog.purge(p, opts());
  });
  assert.deepEqual(res, { droppedOld: 0, archived: false });
});

// --- purge: size-cap archive ------------------------------------------------

test('purge archive path: archives at the size cap, fresh log keeps unconsumed tail, cursor survives', () => {
  const p = freshProject();

  // Append several records; consume the first two so they are the "old/consumed" head.
  obsLog.append(p, { event: 'tool_start', tool: 'A' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'B' }, opts());
  obsLog.readNew(p, opts()); // cursor -> 1 (A,B consumed)

  // Pending tail: these must survive the archive.
  obsLog.append(p, { event: 'tool_start', tool: 'C' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'D' }, opts());

  const l = layoutFor(p);
  const sizeBefore = fs.statSync(l.observationsLog).size;
  // Force the archive branch by setting maxBytes below the current file size.
  const res = obsLog.purge(p, { ...opts(), maxBytes: Math.max(1, sizeBefore - 1) });

  assert.equal(res.archived, true, 'archive triggered at the size cap');

  // An archive file exists under obsArchiveDir.
  const archives = fs.readdirSync(l.obsArchiveDir).filter((n) => n.startsWith('observations-') && n.endsWith('.jsonl'));
  assert.equal(archives.length, 1, 'exactly one archive file written');

  // Fresh log contains ONLY the unconsumed tail (C, D).
  const fresh = obsLog.readAll(p, opts()).map((e) => e.tool);
  assert.deepEqual(fresh, ['C', 'D'], 'fresh log = unconsumed tail');

  // The cursor survived the archive: a readNew still returns the pending C, D.
  const pending = obsLog.readNew(p, opts());
  assert.deepEqual(pending.entries.map((e) => e.tool), ['C', 'D'], 'cursor survived — pending still readable');
});

// --- corruption tolerance ---------------------------------------------------

test('a torn/invalid final line is skipped by readAll and readNew without throwing', () => {
  const p = freshProject();
  obsLog.append(p, { event: 'tool_start', tool: 'A' }, opts());
  obsLog.append(p, { event: 'tool_start', tool: 'B' }, opts());

  // Simulate a crash mid-append: a torn JSON fragment with no trailing newline.
  const l = layoutFor(p);
  fs.appendFileSync(l.observationsLog, '{"id":"torn","seq":99,"event":"tool_start"');

  let all;
  assert.doesNotThrow(() => {
    all = obsLog.readAll(p, opts());
  });
  assert.deepEqual(all.map((e) => e.tool), ['A', 'B'], 'torn line skipped by readAll');

  let r;
  assert.doesNotThrow(() => {
    r = obsLog.readNew(p, opts());
  });
  assert.deepEqual(r.entries.map((e) => e.tool), ['A', 'B'], 'torn line skipped by readNew');
  assert.equal(obsLog.pendingCount(p, opts()), 0, 'torn line never counts as pending');
});

test('an entry missing a usable integer seq is skipped by readers', () => {
  const p = freshProject();
  obsLog.append(p, { event: 'tool_start', tool: 'A' }, opts());

  const l = layoutFor(p);
  // Valid JSON, but no integer seq — must be skipped, not crash.
  fs.appendFileSync(l.observationsLog, JSON.stringify({ id: 'no-seq', event: 'tool_start' }) + '\n');

  const all = obsLog.readAll(p, opts());
  assert.deepEqual(all.map((e) => e.tool), ['A'], 'seq-less record skipped');
});
