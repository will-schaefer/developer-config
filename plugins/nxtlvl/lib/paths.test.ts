// paths tests — verification = `node --test` green.
// Acceptance criteria (C&M Phase 1, Task 1.1):
//  - storageRoot returns ${XDG_STATE_HOME:-~/.local/state}/nxtlvl
//  - resolveStorageRoot throws on a path under a sync root / ~/.claude
//  - ensureDir is idempotent and never throws on the happy path
//  - layout() returns every path, correctly composed, for a given projectId
//
// Hermetic: only writes under os.tmpdir() via fs.mkdtempSync; cleaned up in after().

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  storageRoot,
  isSafeRoot,
  resolveStorageRoot,
  ensureDir,
  layout,
} from './paths.ts';

// Track temp dirs created during the run so the suite leaves no residue.
const _tmpDirs: string[] = [];
function mkTmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-paths-'));
  _tmpDirs.push(d);
  return d;
}

after(() => {
  for (const d of _tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

// --- storageRoot ------------------------------------------------------------

test('storageRoot honors XDG_STATE_HOME', () => {
  assert.equal(
    storageRoot({ XDG_STATE_HOME: '/tmp/xdg' }, '/home/u'),
    path.join('/tmp/xdg', 'nxtlvl'),
  );
});

test('storageRoot defaults to ~/.local/state/nxtlvl when XDG unset', () => {
  assert.equal(
    storageRoot({}, '/home/u'),
    path.join('/home/u', '.local', 'state', 'nxtlvl'),
  );
});

test('storageRoot ignores a blank/whitespace XDG_STATE_HOME', () => {
  assert.equal(
    storageRoot({ XDG_STATE_HOME: '   ' }, '/home/u'),
    path.join('/home/u', '.local', 'state', 'nxtlvl'),
  );
});

// --- isSafeRoot -------------------------------------------------------------

test('isSafeRoot is true for the XDG state root', () => {
  assert.equal(isSafeRoot(storageRoot({}, '/home/u')), true);
});

test('isSafeRoot is false under ~/.claude', () => {
  assert.equal(isSafeRoot('/home/u/.claude/nxtlvl'), false);
});

test('isSafeRoot is false under Dropbox', () => {
  assert.equal(isSafeRoot('/home/u/Dropbox/nxtlvl'), false);
});

test('isSafeRoot is false under iCloud (Library/Mobile Documents)', () => {
  assert.equal(isSafeRoot('/Users/u/Library/Mobile Documents/nxtlvl'), false);
});

test('isSafeRoot is false under CloudStorage (OneDrive/Drive/etc.)', () => {
  assert.equal(isSafeRoot('/Users/u/Library/CloudStorage/OneDrive/nxtlvl'), false);
});

// --- resolveStorageRoot -----------------------------------------------------

test('resolveStorageRoot returns the root when it is safe', () => {
  const root = resolveStorageRoot({ XDG_STATE_HOME: '/tmp/xdg' }, '/home/u');
  assert.equal(root, path.join('/tmp/xdg', 'nxtlvl'));
});

test('resolveStorageRoot throws when XDG_STATE_HOME points into Dropbox', () => {
  assert.throws(
    () => resolveStorageRoot({ XDG_STATE_HOME: '/home/u/Dropbox/state' }, '/home/u'),
    /unsafe storage root: /,
  );
});

test('resolveStorageRoot throws when the default root falls under ~/.claude', () => {
  // home itself is ~/.claude → default base ~/.local/state lands under it.
  assert.throws(
    () => resolveStorageRoot({}, '/home/u/.claude'),
    /unsafe storage root: /,
  );
});

// --- ensureDir --------------------------------------------------------------

test('ensureDir creates nested dirs and returns the dir', () => {
  const base = mkTmp();
  const nested = path.join(base, 'a', 'b', 'c');
  const out = ensureDir(nested);
  assert.equal(out, nested);
  assert.equal(fs.existsSync(nested), true);
  assert.equal(fs.statSync(nested).isDirectory(), true);
});

test('ensureDir is idempotent (callable twice, no throw)', () => {
  const base = mkTmp();
  const nested = path.join(base, 'x', 'y');
  ensureDir(nested);
  assert.doesNotThrow(() => ensureDir(nested));
  assert.equal(fs.existsSync(nested), true);
});

// --- layout -----------------------------------------------------------------

test('layout() returns every key, correctly composed', () => {
  const env = { XDG_STATE_HOME: '/tmp/xdg' };
  const home = '/home/u';
  const root = path.join('/tmp/xdg', 'nxtlvl');
  const projectDir = path.join(root, 'projects', 'abc123');

  const l = layout('abc123', env, home);

  assert.deepEqual(l, {
    root,
    globalInstinctsDir: path.join(root, 'instincts'),
    projectDir,
    observationsLog: path.join(projectDir, 'observations.jsonl'),
    obsCursor: path.join(projectDir, 'obs-cursor.json'),
    obsArchiveDir: path.join(projectDir, 'archive'),
    projectInstinctsDir: path.join(projectDir, 'instincts'),
    bookmarksDir: path.join(projectDir, 'bookmarks'),
    livenessLog: path.join(projectDir, 'liveness.jsonl'),
  });
});

test('layout() composes the documented relative path tails', () => {
  const l = layout('abc123', { XDG_STATE_HOME: '/tmp/xdg' }, '/home/u');
  assert.ok(l.observationsLog.endsWith(path.join('projects', 'abc123', 'observations.jsonl')));
  assert.ok(l.bookmarksDir.endsWith(path.join('projects', 'abc123', 'bookmarks')));
  assert.ok(l.projectInstinctsDir.endsWith(path.join('projects', 'abc123', 'instincts')));
  assert.ok(l.globalInstinctsDir.endsWith(path.join('nxtlvl', 'instincts')));
  assert.ok(l.livenessLog.endsWith(path.join('projects', 'abc123', 'liveness.jsonl')));
});

test('layout() is pure — it creates no directories on disk', () => {
  const base = mkTmp();
  const env = { XDG_STATE_HOME: path.join(base, 'state') };
  layout('abc123', env, '/home/u');
  // The store root must NOT have been materialized by a pure path computation.
  assert.equal(fs.existsSync(path.join(base, 'state')), false);
});

test('layout() defaults env/home from process/os when omitted', () => {
  const l = layout('abc123');
  assert.equal(l.root, storageRoot());
  assert.ok(l.projectDir.endsWith(path.join('projects', 'abc123')));
});
