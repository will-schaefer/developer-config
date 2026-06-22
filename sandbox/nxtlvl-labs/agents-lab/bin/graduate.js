#!/usr/bin/env node
'use strict';
/**
 * graduate.js — the objective graduation gate (the lab's keystone; analog of nxtlvl:audit).
 *
 *   npm run graduate -- <cell>
 *
 * Blocks on THREE objective criteria, warns (never blocks) on taste — honoring ADR-009
 * (objective gate) and ADR-033 (three-part contract):
 *
 *   1. Integrity         — manifest structurally sound; capability frontmatter valid; files parse;
 *                          no dead intra-cell refs; hooks exit 0 on a smoke test; no secrets.
 *   2. Declared evals     — the evals-lab scorecard meets the cell's pre-declared graduation_criteria
 *                          (eval-first); a missing scorecard or any unmet criterion blocks.
 *   3. Intake present     — the ADR-008 membership record exists (presence, not quality).
 *
 * EXIT-CODE CONTRACT (two failure paths, two rules — spec Code Style):
 *   - exit 0  = pass (taste warnings allowed on stderr)
 *   - exit 2  = a DELIBERATE block (≥1 blocker)
 *   - a crash / unexpected exception FAILS OPEN (exit 0) — it must NEVER masquerade as a block.
 *
 * Structured so the contract is unit-testable without spawning a process:
 *   evaluateCell(cellDir) -> { blockers, warnings }   reads fs; the decision core
 *   run(cellDir, {evaluate}) -> { code, blockers, warnings, failedOpen }   total; crash -> code 0
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const m = require('./lib/manifest.js');
const evalSeam = require('./eval.js');

const LAB_ROOT = path.join(__dirname, '..');
const CELLS_DIR = path.join(LAB_ROOT, 'cells');

// Which criterion a manifest validation code belongs to. Each code routes to exactly one.
const CRITERION_OF_CODE = {
  // 1 — integrity (manifest structural soundness)
  E_NOT_MAPPING: 'integrity', E_PARSE: 'integrity', E_NAME: 'integrity',
  E_TYPE_MISSING: 'integrity', E_TYPE: 'integrity', E_STAGE_MISSING: 'integrity',
  E_STAGE: 'integrity', E_INTENT: 'integrity', E_TARGET: 'integrity',
  E_TARGET_PATH: 'integrity', E_DEPS: 'integrity',
  // 2 — declared evals (you can't pass evals you never declared)
  E_CRITERIA_MISSING: 'declared-evals', E_CRITERIA_EMPTY: 'declared-evals',
  E_CRITERIA_SHAPE: 'declared-evals', E_CRITERIA_ITEM: 'declared-evals',
  // 3 — intake present
  E_INTAKE_MISSING: 'intake', E_INTAKE_SHAPE: 'intake', E_INTAKE_INCOMPLETE: 'intake',
};

// Specific, low-false-positive secret signatures. Presence is an integrity blocker.
const SECRET_PATTERNS = [
  { name: 'AWS access key id', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'GitHub token', re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: 'Slack token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
];

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

/** Hook smoke-test timeout (ms). Overridable via env so tests can exercise the timeout path fast. */
function hookSmokeTimeoutMs() {
  const v = parseInt(process.env.NXTLVL_HOOK_SMOKE_TIMEOUT_MS || '', 10);
  return Number.isFinite(v) && v > 0 ? v : 5000;
}

/** Parse a leading `---` YAML frontmatter block. Returns { ok, data, reason }. */
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { ok: false, reason: 'no leading frontmatter (--- block)' };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { ok: false, reason: 'unterminated frontmatter block' };
  const body = text.slice(text.indexOf('\n') + 1, end);
  const { manifest, error } = m.parse(body); // reuse the total YAML parse
  if (error) return { ok: false, reason: `frontmatter YAML error: ${error}` };
  if (!manifest || typeof manifest !== 'object') return { ok: false, reason: 'frontmatter is not a mapping' };
  return { ok: true, data: manifest };
}

// ---- Criterion 1: Integrity (capability files) ----------------------------

function checkIntegrity(cellDir, manifest, blockers, warnings) {
  const type = manifest && manifest.type;
  const name = (manifest && manifest.name) || path.basename(cellDir);

  // capability file + frontmatter, per type
  if (type === 'skill') {
    requireFrontmatterFile(cellDir, 'SKILL.md', ['name', 'description'], blockers);
  } else if (type === 'agent') {
    requireFrontmatterFile(cellDir, `${name}.md`, ['name', 'description'], blockers);
  } else if (type === 'command') {
    requireFrontmatterFile(cellDir, `${name}.md`, ['description'], blockers);
  } else if (type === 'hook') {
    checkHook(cellDir, name, blockers);
  }
  // (unknown/missing type is already an integrity blocker via the manifest route.)

  // dead intra-cell refs + TODO placeholders in capability markdown
  scanMarkdownRefs(cellDir, blockers, warnings);

  // secrets across the whole cell (excluding the generated scorecard)
  scanSecrets(cellDir, blockers);
}

function requireFrontmatterFile(cellDir, file, requiredKeys, blockers) {
  const p = path.join(cellDir, file);
  if (!fs.existsSync(p)) {
    blockers.push(`[integrity] missing capability file: ${file}`);
    return;
  }
  const fm = parseFrontmatter(readText(p));
  if (!fm.ok) {
    blockers.push(`[integrity] ${file}: ${fm.reason}`);
    return;
  }
  for (const k of requiredKeys) {
    const v = fm.data[k];
    if (typeof v !== 'string' || !v.trim()) {
      blockers.push(`[integrity] ${file}: frontmatter missing/empty '${k}'`);
    }
  }
}

function checkHook(cellDir, name, blockers) {
  const hooksJson = path.join(cellDir, 'hooks.json');
  if (!fs.existsSync(hooksJson)) {
    blockers.push('[integrity] missing hooks.json');
  } else {
    try {
      JSON.parse(readText(hooksJson));
    } catch (e) {
      blockers.push(`[integrity] hooks.json is not valid JSON: ${e.message}`);
    }
  }
  const script = path.join(cellDir, `${name}.js`);
  if (!fs.existsSync(script)) {
    blockers.push(`[integrity] missing hook script: ${name}.js`);
    return;
  }
  // Smoke-test: a hook must exit 0 on an empty event.
  // - A genuine spawn *infrastructure* failure (couldn't launch node, e.g. ENOENT) throws and
  //   fails the gate OPEN at the top level — that is the gate's own infra, not the hook's fault.
  // - A TIMEOUT is the hook misbehaving (it hung, never exited 0) — that is a deliberate integrity
  //   BLOCK, not a fail-open. (doubt-review F3)
  const res = spawnSync(process.execPath, [script], { input: '', timeout: hookSmokeTimeoutMs() });
  if (res.error) {
    if (res.error.code === 'ETIMEDOUT') {
      blockers.push(`[integrity] hook ${name}.js did not exit within ${hookSmokeTimeoutMs()}ms on smoke test`);
      return;
    }
    throw res.error; // genuine spawn-infra failure -> top-level fail-open
  }
  if (res.status !== 0) {
    const how = res.status === null ? `was killed by ${res.signal}` : `exited ${res.status}`;
    blockers.push(`[integrity] hook ${name}.js ${how} on smoke test (expected exit 0)`);
  }
}

function listCellFiles(cellDir) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return; // unreadable dir -> skip; never crash the gate into a fail-open bypass (doubt-review F4)
    }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(cellDir);
  return out;
}

function scanMarkdownRefs(cellDir, blockers, warnings) {
  for (const file of listCellFiles(cellDir)) {
    if (!file.endsWith('.md')) continue;
    let text;
    try {
      text = readText(file);
    } catch (_e) {
      continue; // unreadable -> skip; the secret scan still runs on every readable file (doubt-review F1)
    }
    if (/\bTODO\b/.test(text)) {
      warnings.push(`${path.relative(cellDir, file)} still contains a TODO placeholder`);
    }
    // intra-cell links only: `](name)` or `](./name)`, no scheme, no '/', no '..'
    const linkRe = /\]\((\.\/)?([^):?#\s]+)\)/g;
    let m1;
    while ((m1 = linkRe.exec(text)) !== null) {
      const target = m1[2];
      if (/^[a-z]+:/i.test(target) || target.includes('/') || target.includes('..')) continue;
      const resolved = path.join(path.dirname(file), target);
      if (!fs.existsSync(resolved)) {
        blockers.push(`[integrity] dead intra-cell ref in ${path.relative(cellDir, file)}: ${target}`);
      }
    }
  }
}

function scanSecrets(cellDir, blockers) {
  for (const file of listCellFiles(cellDir)) {
    if (path.basename(file) === evalSeam.SCORECARD_NAME) continue; // generated artifact
    let text;
    try {
      text = readText(file);
    } catch (_e) {
      continue; // binary/unreadable — skip, not a block
    }
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(text)) {
        blockers.push(`[integrity] possible ${name} committed in ${path.relative(cellDir, file)}`);
      }
    }
  }
}

// ---- Criterion 2: Declared evals pass (scorecard) -------------------------

function checkDeclaredEvals(cellDir, manifest, blockers, warnings) {
  const declared = Array.isArray(manifest && manifest.graduation_criteria)
    ? manifest.graduation_criteria.filter((c) => c && typeof c.id === 'string')
    : [];
  // If no valid criteria were declared, the manifest route already blocked under declared-evals.
  const scPath = evalSeam.scorecardPath(cellDir);
  if (!fs.existsSync(scPath)) {
    blockers.push('[declared-evals] no scorecard — run `npm run eval -- <cell>` first');
    return;
  }
  let sc;
  try {
    sc = JSON.parse(readText(scPath));
  } catch (e) {
    blockers.push(`[declared-evals] scorecard is not valid JSON: ${e.message}`);
    return;
  }
  const results = Array.isArray(sc.results) ? sc.results : [];
  const byId = new Map(results.map((r) => [r.id, r]));
  // The DECLARED criteria are the bar (eval-first). Every declared criterion must have a passed
  // result — this is authoritative, not the summary. (doubt-review F2)
  let anyDeclaredFailed = false;
  for (const crit of declared) {
    const r = byId.get(crit.id);
    if (!r) {
      blockers.push(`[declared-evals] criterion '${crit.id}' has no result in the scorecard`);
      anyDeclaredFailed = true;
    } else if (r.passed !== true) {
      blockers.push(`[declared-evals] criterion '${crit.id}' did not pass (${r.detail || 'no detail'})`);
      anyDeclaredFailed = true;
    }
  }
  // summary.allPassed is a diagnostic, NOT part of the declared bar: extra undeclared failing
  // results (e.g. an evals-lab general battery) must not block a cell whose declared criteria all
  // passed. Surface a disagreement as a WARNING only — never a blocker.
  if (declared.length > 0 && !anyDeclaredFailed && !(sc.summary && sc.summary.allPassed === true)) {
    warnings.push('scorecard summary.allPassed is not true though all declared criteria passed (extra undeclared results or a stale scorecard?)');
  }
}

// ---- the decision core ----------------------------------------------------

/** Reads the cell and returns { blockers, warnings }. The decision core. */
function evaluateCell(cellDir) {
  const blockers = [];
  const warnings = [];

  const manifestPath = path.join(cellDir, 'manifest.yaml');
  if (!fs.existsSync(manifestPath)) {
    blockers.push('[integrity] no manifest.yaml');
    return { blockers, warnings };
  }

  const vt = m.validateText(readText(manifestPath));
  const manifest = vt.manifest;
  vt.warnings.forEach((w) => warnings.push(w));
  for (const e of vt.errors) {
    const crit = CRITERION_OF_CODE[e.code] || 'integrity';
    blockers.push(`[${crit}] manifest: ${e.message}`);
  }

  // File-level checks need a known type; skip if the manifest didn't parse to a mapping.
  if (manifest && typeof manifest === 'object' && !Array.isArray(manifest)) {
    checkIntegrity(cellDir, manifest, blockers, warnings);
    checkDeclaredEvals(cellDir, manifest, blockers, warnings);
  }
  // Criterion 3 (intake present) is satisfied by the absence of E_INTAKE_* errors above.

  return { blockers, warnings };
}

/**
 * run — total. Returns { code, blockers, warnings, failedOpen }.
 * Any exception in the decision core FAILS OPEN (code 0) — never a fake block.
 */
function run(cellDir, opts = {}) {
  const evaluate = opts.evaluate || evaluateCell;
  try {
    const { blockers, warnings } = evaluate(cellDir);
    return { code: blockers.length ? 2 : 0, blockers, warnings, failedOpen: false };
  } catch (e) {
    return { code: 0, blockers: [], warnings: [], failedOpen: true, error: e && e.message };
  }
}

function main(argv) {
  const cell = argv.find((a) => !a.startsWith('-'));
  if (!cell) {
    process.stderr.write('usage: npm run graduate -- <cell>\n');
    process.exit(1); // usage error — not a gate decision
  }
  let cellDir;
  if (path.isAbsolute(cell)) {
    cellDir = cell; // absolute path explicitly allowed (tests, advanced use)
  } else if (!/^[a-z0-9][a-z0-9-]*$/.test(cell)) {
    // reject path traversal / odd names for relative cell args (doubt-review F6)
    process.stderr.write(`error: invalid cell name ${JSON.stringify(cell)} — use a kebab-case cell name or an absolute path\n`);
    process.exit(1);
  } else {
    cellDir = path.join(CELLS_DIR, cell);
  }
  const result = run(cellDir);

  result.warnings.forEach((w) => process.stderr.write(`⚠ ${w}\n`));
  if (result.failedOpen) {
    process.stderr.write(`⚠ graduate gate errored — failing OPEN (exit 0): ${result.error}\n`);
    process.exit(0);
  }
  if (result.code === 2) {
    result.blockers.forEach((b) => process.stderr.write(`✗ ${b}\n`));
    process.stderr.write(`\nBLOCKED: ${result.blockers.length} criterion failure(s). Cell may not graduate.\n`);
    process.exit(2);
  }
  process.stdout.write(`✓ ${path.basename(cellDir)} passes the graduation gate${result.warnings.length ? ` (${result.warnings.length} warning(s))` : ''}.\n`);
  process.exit(0);
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  evaluateCell,
  run,
  parseFrontmatter,
  checkIntegrity,
  checkDeclaredEvals,
  CRITERION_OF_CODE,
  SECRET_PATTERNS,
  CELLS_DIR,
};
