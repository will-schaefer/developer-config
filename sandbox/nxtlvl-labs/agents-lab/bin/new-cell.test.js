'use strict';
/**
 * Tests for new-cell.js. Run: node --test bin/new-cell.test.js
 *
 * - one case per --type (correct stub + manifest validates modulo author-owed fields)
 * - clobber-refusal
 * - bad name / bad type rejected
 *
 * Filesystem cases write into a fresh mkdtemp under $TMPDIR (sandbox-writable), never the repo.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const nc = require('./new-cell.js');
const m = require('./lib/manifest.js');

function tmpCellsDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentslab-newcell-'));
}

const STUB_FILES = {
  skill: ['SKILL.md'],
  agent: ['demo-cell.md'],
  command: ['demo-cell.md'],
  hook: ['hooks.json', 'demo-cell.js'],
};

for (const type of m.TYPES) {
  test(`planFiles(${type}) -> manifest validates modulo author-owed fields`, () => {
    const files = nc.planFiles('demo-cell', type);
    const r = m.validateText(files['manifest.yaml']);
    assert.ok(
      m.onlyAuthorOwed(r.errors),
      `expected only author-owed errors, got ${JSON.stringify(r.errors.map((e) => e.code))}`
    );
    // exactly the two author-owed gaps, nothing structural
    const set = new Set(r.errors.map((e) => e.code));
    assert.ok(set.has('E_INTAKE_INCOMPLETE'));
    assert.ok(set.has('E_CRITERIA_EMPTY'));
  });

  test(`planFiles(${type}) -> correct capability stub + evals/ + run.md`, () => {
    const files = nc.planFiles('demo-cell', type);
    assert.ok('run.md' in files);
    assert.ok('evals/.gitkeep' in files);
    for (const stub of STUB_FILES[type]) {
      assert.ok(stub in files, `missing stub ${stub} for type ${type}`);
    }
  });
}

test('manifest target matches the declared type subdir (no mismatch warning)', () => {
  for (const type of m.TYPES) {
    const files = nc.planFiles('demo-cell', type);
    const r = m.validateText(files['manifest.yaml']);
    assert.deepStrictEqual(r.warnings, [], `type ${type} produced a warning: ${JSON.stringify(r.warnings)}`);
  }
});

test('createCell writes the cell to disk, then refuses to clobber', () => {
  const cellsDir = tmpCellsDir();
  try {
    const { dir, files } = nc.createCell('demo-cell', 'skill', cellsDir);
    assert.ok(fs.existsSync(path.join(dir, 'manifest.yaml')));
    assert.ok(fs.existsSync(path.join(dir, 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(dir, 'evals', '.gitkeep')));
    assert.ok(files.length >= 4);
    // second attempt must refuse
    assert.throws(() => nc.createCell('demo-cell', 'skill', cellsDir), /already exists/);
  } finally {
    fs.rmSync(cellsDir, { recursive: true, force: true });
  }
});

test('bad cell name is rejected', () => {
  assert.throws(() => nc.planFiles('Bad Name', 'skill'), /invalid cell name/);
  assert.throws(() => nc.planFiles('../escape', 'skill'), /invalid cell name/);
  assert.throws(() => nc.planFiles('', 'skill'), /invalid cell name/);
});

test('bad type is rejected', () => {
  assert.throws(() => nc.planFiles('ok-name', 'widget'), /invalid --type/);
});

test('parseArgs handles --type= and --type forms', () => {
  assert.deepStrictEqual(nc.parseArgs(['foo', '--type=skill']), { name: 'foo', type: 'skill' });
  assert.deepStrictEqual(nc.parseArgs(['--type', 'agent', 'bar']), { name: 'bar', type: 'agent' });
});
