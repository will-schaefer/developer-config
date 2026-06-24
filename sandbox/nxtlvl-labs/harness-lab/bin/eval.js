#!/usr/bin/env node
'use strict';
/**
 * eval.js — the evals-lab seam (stub engine).
 *
 *   npm run eval -- <cell>
 *
 * Reads the cell's declared evals (manifest.graduation_criteria + evals/cases.yaml), hands them to
 * a DETERMINISTIC STUB engine, and writes a scorecard in the shape fixed by docs/seam-contract.md.
 * graduate.js reads that scorecard without knowing a stub produced it. When the real evals-lab
 * engine lands, only score() is replaced — the spec/scorecard shapes stay put.
 *
 * The stub does not *compute* outcomes; it echoes each case's declared `stub_result`. A criterion
 * with no eval case scores as a FAILURE (a missing eval is never a silent pass).
 *
 * Split for testability:
 *   buildSpec(cellDir)  -> { cell, criteria, cases }   touches the filesystem
 *   score(spec)         -> scorecard                    pure & deterministic (no timestamps)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const m = require('./lib/manifest.js');

const LAB_ROOT = path.join(__dirname, '..');
const CELLS_DIR = path.join(LAB_ROOT, 'cells');
const SCORECARD_NAME = 'scorecard.json';
const ENGINE = 'stub';

/** Build the eval spec for a cell. Never throws on missing/partial cases. */
function buildSpec(cellDir) {
  const manifestPath = path.join(cellDir, 'manifest.yaml');
  const { manifest } = m.validateText(fs.readFileSync(manifestPath, 'utf8'));
  const name = (manifest && typeof manifest.name === 'string' && manifest.name) || path.basename(cellDir);
  const criteria = Array.isArray(manifest && manifest.graduation_criteria)
    ? manifest.graduation_criteria.filter((c) => c && typeof c.id === 'string')
    : [];

  let cases = {};
  const casesPath = path.join(cellDir, 'evals', 'cases.yaml');
  try {
    const loaded = yaml.load(fs.readFileSync(casesPath, 'utf8'));
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) cases = loaded;
  } catch (_e) {
    cases = {}; // no cases file -> every criterion will score as a failure
  }
  return { cell: name, criteria, cases };
}

/** Pure, deterministic stub engine: spec -> scorecard (docs/seam-contract.md shape). */
function score(spec) {
  const results = (spec.criteria || []).map((crit) => {
    const c = spec.cases && spec.cases[crit.id];
    if (!c || typeof c !== 'object') {
      return { id: crit.id, passed: false, score: null, detail: 'no eval case declared' };
    }
    const passed = c.stub_result === 'pass';
    return {
      id: crit.id,
      passed,
      score: typeof c.score === 'number' ? c.score : null,
      detail: typeof c.detail === 'string' ? c.detail : (passed ? 'passed' : 'failed'),
    };
  });
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  return {
    cell: spec.cell,
    engine: ENGINE,
    results,
    summary: { total, passed, failed: total - passed, allPassed: total > 0 && passed === total },
  };
}

function scorecardPath(cellDir) {
  return path.join(cellDir, SCORECARD_NAME);
}

function writeScorecard(cellDir, scorecard) {
  fs.writeFileSync(scorecardPath(cellDir), JSON.stringify(scorecard, null, 2) + '\n');
}

function main(argv) {
  const cell = argv.find((a) => !a.startsWith('-'));
  if (!cell) {
    process.stderr.write('usage: npm run eval -- <cell>\n');
    process.exit(1);
  }
  const cellDir = path.join(CELLS_DIR, cell);
  if (!fs.existsSync(path.join(cellDir, 'manifest.yaml'))) {
    process.stderr.write(`error: no such cell (missing manifest): cells/${cell}\n`);
    process.exit(1);
  }
  const spec = buildSpec(cellDir);
  const scorecard = score(spec);
  writeScorecard(cellDir, scorecard);
  const s = scorecard.summary;
  process.stdout.write(
    `scorecard written to cells/${cell}/${SCORECARD_NAME} — ${s.passed}/${s.total} criteria passed (engine: ${scorecard.engine}).\n`
  );
  process.exit(0);
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { buildSpec, score, writeScorecard, scorecardPath, CELLS_DIR, SCORECARD_NAME, ENGINE };
