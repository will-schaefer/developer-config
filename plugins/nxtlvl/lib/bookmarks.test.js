// Tests for bookmarks.js — verification = `node --test` green.
//
// Hermetic: writes only under os.tmpdir() (fs.mkdtempSync). The bookmark store
// path resolves through paths.layout(), which defaults to process.env — so we
// point process.env.XDG_STATE_HOME at a tmp dir for the run and restore it in
// after(). Git fixtures use the same hermetic GIT_ENV idiom as
// project-identity.test.js so the suite never reads the user's global git config.
//
// Acceptance criteria (C&M Phase 1, Task 1.6 / lifecycle spec):
//  - append + read-newest by group; two group keys do not cross-contaminate
//  - staleness compare returns the right boolean (newer->true; older/equal/none->false;
//    nothing-saved-yet-but-activity->true; null compareTs->false; missing file safe)
//  - off-git -> groupKeyFor falls back to the folder key (source 'folder')
//  - a torn/unparseable trail line is skipped, not thrown

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { groupKeyFor, append, readNewest, readTrail, isStale } = require('./bookmarks.js');
const { layout } = require('./paths.ts');

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};
const git = (args, cwd) =>
  execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

const PROJECT_ID = 'proj-test-1';

let store, prevXdg, branchRepo, offGit;

before(() => {
  // Redirect the whole store under a tmp XDG state root for the run.
  store = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-bookmarks-'));
  prevXdg = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = store;

  // branchRepo — a repo checked out to a slash-containing branch `feat/x`.
  branchRepo = path.join(store, 'fixtures', 'branchy');
  fs.mkdirSync(branchRepo, { recursive: true });
  git(['init', '-q'], branchRepo);
  fs.writeFileSync(path.join(branchRepo, 'h.txt'), 'ho');
  git(['add', '.'], branchRepo);
  git(['commit', '-q', '-m', 'init'], branchRepo);
  git(['checkout', '-q', '-b', 'feat/x'], branchRepo);

  // off-git — a plain directory, no repo.
  offGit = path.join(store, 'fixtures', 'loose');
  fs.mkdirSync(offGit, { recursive: true });
});

after(() => {
  if (prevXdg === undefined) delete process.env.XDG_STATE_HOME;
  else process.env.XDG_STATE_HOME = prevXdg;
  fs.rmSync(store, { recursive: true, force: true });
});

// Absolute path to a group's JSONL file (mirror of the module-private helper),
// used by the torn-line test to write a deliberately corrupt record.
const groupFile = (groupKey) =>
  path.join(layout(PROJECT_ID).bookmarksDir, `${groupKey}.jsonl`);

// --- append + read by group -------------------------------------------------

test('append two notes to a group: readNewest is the second, readTrail both in order', () => {
  const a = append(PROJECT_ID, 'main', 'first note', { session: 's1', ts: '2026-06-20T10:00:00.000Z' });
  const b = append(PROJECT_ID, 'main', 'second note', { session: 's2', ts: '2026-06-20T11:00:00.000Z' });

  assert.deepEqual(a, { ts: '2026-06-20T10:00:00.000Z', note: 'first note', session: 's1', branch: 'main' });
  assert.deepEqual(b, { ts: '2026-06-20T11:00:00.000Z', note: 'second note', session: 's2', branch: 'main' });

  assert.deepEqual(readNewest(PROJECT_ID, 'main'), b);

  const trail = readTrail(PROJECT_ID, 'main');
  assert.equal(trail.length, 2);
  assert.deepEqual(trail, [a, b]);
});

test('append defaults ts to an ISO string when not supplied', () => {
  const r = append(PROJECT_ID, 'tsdefault', 'note');
  assert.match(r.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(r.branch, 'tsdefault');
  assert.equal(r.note, 'note');
});

test('groups do not cross-contaminate: a note in feat-x is invisible to main', () => {
  append(PROJECT_ID, 'feat-x', 'feature note', { ts: '2026-06-20T12:00:00.000Z' });

  // main still ends at its own second note, not the feat-x one.
  assert.equal(readNewest(PROJECT_ID, 'main').note, 'second note');
  for (const r of readTrail(PROJECT_ID, 'main')) {
    assert.notEqual(r.note, 'feature note');
  }

  // feat-x sees only its own note.
  const featTrail = readTrail(PROJECT_ID, 'feat-x');
  assert.equal(featTrail.length, 1);
  assert.equal(featTrail[0].note, 'feature note');
});

// --- unknown group ----------------------------------------------------------

test('unknown group: readNewest is null, readTrail is [], isStale is safe', () => {
  assert.equal(readNewest(PROJECT_ID, 'never-written'), null);
  assert.deepEqual(readTrail(PROJECT_ID, 'never-written'), []);
  // missing file + non-null compareTs -> stale; + null compareTs -> not stale.
  assert.equal(isStale(PROJECT_ID, 'never-written', '2026-06-20T00:00:00.000Z'), true);
  assert.equal(isStale(PROJECT_ID, 'never-written', null), false);
});

// --- staleness compare ------------------------------------------------------

test('isStale: compareTs newer than the newest bookmark -> true', () => {
  append(PROJECT_ID, 'stale-grp', 'note', { ts: '2026-06-20T10:00:00.000Z' });
  // T + 1s
  assert.equal(isStale(PROJECT_ID, 'stale-grp', '2026-06-20T10:00:01.000Z'), true);
});

test('isStale: compareTs older than the newest bookmark -> false', () => {
  // group already has a bookmark at T = 10:00:00 from the previous test.
  assert.equal(isStale(PROJECT_ID, 'stale-grp', '2026-06-20T09:59:59.000Z'), false);
});

test('isStale: compareTs equal to the newest bookmark -> false (strictly-newer only)', () => {
  assert.equal(isStale(PROJECT_ID, 'stale-grp', '2026-06-20T10:00:00.000Z'), false);
});

test('isStale: null/undefined compareTs -> false even with a saved bookmark', () => {
  assert.equal(isStale(PROJECT_ID, 'stale-grp', null), false);
  assert.equal(isStale(PROJECT_ID, 'stale-grp', undefined), false);
});

test('isStale: accepts an epoch-ms compareTs', () => {
  const newerMs = new Date('2026-06-20T10:00:05.000Z').getTime();
  const olderMs = new Date('2026-06-20T09:59:55.000Z').getTime();
  assert.equal(isStale(PROJECT_ID, 'stale-grp', newerMs), true);
  assert.equal(isStale(PROJECT_ID, 'stale-grp', olderMs), false);
});

// --- groupKeyFor ------------------------------------------------------------

test('groupKeyFor on branch feat/x returns the sanitized branch key feat-x', () => {
  assert.equal(groupKeyFor(branchRepo), 'feat-x');
});

test('groupKeyFor off-git falls back to the folder-hash key (not a branch-looking string)', () => {
  const key = groupKeyFor(offGit);
  // folder fallback = 16 lowercase hex chars, never a readable branch name.
  assert.match(key, /^[0-9a-f]{16}$/);
  assert.notEqual(key, 'feat-x');
});

// --- torn line resilience ---------------------------------------------------

test('a torn/unparseable trail line is skipped, not thrown', () => {
  // No `session` given -> the stored JSON omits the key (JSON drops undefined),
  // so the read-back records are compared on the fields that actually persist.
  append(PROJECT_ID, 'torn-grp', 'good one', { ts: '2026-06-20T10:00:00.000Z' });
  // Inject a corrupt half-written line between two valid records.
  fs.appendFileSync(groupFile('torn-grp'), '{"ts":"2026-06-20T10:30:00.000Z","not valid json\n');
  append(PROJECT_ID, 'torn-grp', 'good two', { ts: '2026-06-20T11:00:00.000Z' });

  const good1 = { ts: '2026-06-20T10:00:00.000Z', note: 'good one', branch: 'torn-grp' };
  const good2 = { ts: '2026-06-20T11:00:00.000Z', note: 'good two', branch: 'torn-grp' };

  let trail;
  assert.doesNotThrow(() => { trail = readTrail(PROJECT_ID, 'torn-grp'); });
  assert.deepEqual(trail, [good1, good2], 'the torn line is skipped, both valid records survive in order');

  // readNewest sees the last valid record, not the torn one.
  assert.deepEqual(readNewest(PROJECT_ID, 'torn-grp'), good2);
});
