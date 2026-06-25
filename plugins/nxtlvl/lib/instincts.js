// instincts — the instinct store: one Markdown file per instinct (ecc shape),
// holding observer-inferred learned habits. Project-scoped instincts live under
// layout(projectId).projectInstinctsDir; global ones under layout().globalInstinctsDir.
// Filename = `<id>.md`. Every write is atomic (atomic.js: tmp + rename).
//
// File format (spec §5): YAML-ish frontmatter delimited by `---` lines, then a
// `## Action` section and a `## Evidence` section. Frontmatter values are simple
// scalars only (string/number) — we parse each line as `key: <rest of line>` and
// coerce `confidence` / `reinforcements` to Number. We DELIBERATELY do NOT pull in
// a yaml dependency (lib/* is dependency-free): a tiny line parser/serializer is
// sufficient and faithful for this flat, scalar-only schema.
//
// ── Confidence + decay model (Phase-1 implementation choice) ─────────────────
// STORED confidence is the RAW frequency-based value. We NEVER mutate it on a
// decay pass — there is no cron and no rewrite-on-read. Instead:
//
//   • effectiveConfidence(instinct, now?) applies time decay at READ time:
//         raw * Math.pow(0.5, ageDays / HALF_LIFE_DAYS)
//     where ageDays = (now − updated) / 86400000 and
//     HALF_LIFE_DAYS = Number(process.env.NXTLVL_INSTINCT_HALFLIFE_DAYS) || 30.
//     This makes spec §6 "staleness handled automatically by decay drifting
//     below the 0.7 bar" fall out for free: a stale instinct's EFFECTIVE
//     confidence sinks under any minConfidence filter with no mutation.
//
//   • reinforce(instinct, opts?) is the FREQUENCY bump (a real observation):
//         confidence' = confidence + (1 − confidence) * RATE   (RATE default 0.2)
//     capped STRICTLY below 1.0 (asymptotic — repeated reinforcement approaches
//     but never reaches certainty); reinforcements += 1; updated = nowISO.
//
// Decay is a read-time lens; reinforcement is the only thing that writes confidence.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { atomicWrite } = require('./atomic.js');
const { layout } = require('./paths.ts');

const DAY_MS = 86400000;
const REINFORCE_RATE = 0.2;
// Strict ceiling: confidence may approach but never reach 1.0.
const MAX_CONFIDENCE = 0.999999;

function halfLifeDays() {
  return Number(process.env.NXTLVL_INSTINCT_HALFLIFE_DAYS) || 30;
}

function nowISO() {
  return new Date().toISOString();
}

// --- Frontmatter scalar (de)serialization ----------------------------------
// Numeric fields are coerced to Number on read and emitted bare on write; all
// other fields are plain strings. Field ORDER is fixed for deterministic output.
const NUMERIC_FIELDS = new Set(['confidence', 'reinforcements']);
const FRONTMATTER_ORDER = [
  'id',
  'trigger',
  'confidence',
  'domain',
  'scope',
  'project_id',
  'source',
  'created',
  'updated',
  'reinforcements',
];

// --- Parse one instinct file ------------------------------------------------
// Returns the instinct object shape (see module-doc). Tolerates missing optional
// fields: reinforcements defaults 0; project_id absent when global; both body
// sections default to '' if not present.
function parse(text) {
  const lines = text.split('\n');
  const frontmatter = {};
  let i = 0;

  // Frontmatter block: opening `---`, key: value lines, closing `---`.
  if (lines[0] !== undefined && lines[0].trim() === '---') {
    i = 1;
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '---') {
        i++;
        break;
      }
      const sep = line.indexOf(':');
      if (sep === -1) continue; // skip a malformed frontmatter line
      const key = line.slice(0, sep).trim();
      const rawVal = line.slice(sep + 1).trim();
      if (NUMERIC_FIELDS.has(key)) {
        frontmatter[key] = Number(rawVal);
      } else {
        frontmatter[key] = rawVal;
      }
    }
  }

  // Body: split into `## Action` and `## Evidence` sections, preserving the
  // text under each heading verbatim (trimmed of surrounding blank lines).
  const body = lines.slice(i).join('\n');
  const action = extractSection(body, 'Action');
  const evidence = extractSection(body, 'Evidence');

  return buildInstinct(frontmatter, action, evidence);
}

// Pull the text under `## <name>` up to the next `## ` heading (or EOF).
function extractSection(body, name) {
  const lines = body.split('\n');
  const heading = `## ${name}`;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return '';
  const collected = [];
  for (let i = start; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) break;
    collected.push(lines[i]);
  }
  return collected.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
}

// Normalize a raw frontmatter map + body sections into the instinct object shape.
function buildInstinct(fm, action, evidence) {
  const instinct = {
    id: fm.id,
    trigger: fm.trigger,
    confidence: Number.isFinite(fm.confidence) ? fm.confidence : 0,
    domain: fm.domain,
    scope: fm.scope,
    source: fm.source,
    created: fm.created,
    updated: fm.updated,
    reinforcements: Number.isFinite(fm.reinforcements) ? fm.reinforcements : 0,
    action: action || '',
    evidence: evidence || '',
  };
  // project_id is present ONLY for project-scoped instincts.
  if (fm.project_id !== undefined && fm.project_id !== '') {
    instinct.project_id = fm.project_id;
  }
  return instinct;
}

// --- Serialize one instinct to file text ------------------------------------
function serialize(instinct) {
  const out = ['---'];
  for (const key of FRONTMATTER_ORDER) {
    const val = frontmatterValueFor(instinct, key);
    if (val === undefined || val === null || val === '') {
      // Skip absent optionals (e.g. project_id on a global instinct).
      if (key === 'project_id') continue;
    }
    if (val === undefined || val === null) continue;
    out.push(`${key}: ${val}`);
  }
  out.push('---');
  out.push('');
  out.push('## Action');
  out.push(instinct.action || '');
  out.push('');
  out.push('## Evidence');
  out.push(instinct.evidence || '');
  out.push('');
  return out.join('\n');
}

function frontmatterValueFor(instinct, key) {
  switch (key) {
    case 'project_id':
      return instinct.project_id;
    case 'confidence':
      return instinct.confidence;
    case 'reinforcements':
      return instinct.reinforcements ?? 0;
    default:
      return instinct[key];
  }
}

// --- Id trust boundary (SECURITY) -------------------------------------------
// An instinct id becomes a filename (`<id>.md`). The observer feeds ids straight
// from UNTRUSTED model output, so a hostile id like "../../../../ESCAPED" would
// otherwise let atomicWrite's recursive mkdir place a file OUTSIDE the store.
// This is THE trust boundary: every id-derived path (write AND read) flows
// through here. Surface checks reject the obvious shapes; the caller then ALSO
// asserts the resolved final path stays within the resolved instinct dir
// (defense that holds even if a surface check is ever missed).
function assertSafeId(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`instinct id must be a non-empty string (got ${JSON.stringify(id)})`);
  }
  if (id.includes('/') || id.includes('\\')) {
    throw new Error(`instinct id must not contain a path separator: ${JSON.stringify(id)}`);
  }
  if (id.includes('..')) {
    throw new Error(`instinct id must not contain "..": ${JSON.stringify(id)}`);
  }
  if (id.startsWith('.')) {
    throw new Error(`instinct id must not start with ".": ${JSON.stringify(id)}`);
  }
  return id;
}

// Build the `<id>.md` path under `dir`, validate the id, then enforce the
// resolved-path-within-dir invariant explicitly (resolve both and require the
// file path to start with the resolved dir + separator). Throws on any breach.
function safeFileIn(dir, id) {
  assertSafeId(id);
  const filepath = path.join(dir, `${id}.md`);
  const resolvedDir = path.resolve(dir) + path.sep;
  const resolvedFile = path.resolve(filepath);
  if (!resolvedFile.startsWith(resolvedDir)) {
    throw new Error(`instinct id escapes its directory: ${JSON.stringify(id)}`);
  }
  return filepath;
}

// --- Directory routing ------------------------------------------------------
// scope=project → layout(projectId).projectInstinctsDir; scope=global → globalInstinctsDir.
function dirFor(instinct, env, home) {
  if (instinct.scope === 'global') {
    return layout('_global_', env, home).globalInstinctsDir;
  }
  if (!instinct.project_id) {
    throw new Error(`project-scoped instinct "${instinct.id}" requires project_id`);
  }
  return layout(instinct.project_id, env, home).projectInstinctsDir;
}

function fileFor(instinct, env, home) {
  return safeFileIn(dirFor(instinct, env, home), instinct.id);
}

// --- Public API -------------------------------------------------------------

// write(instinct, env?, home?) -> filepath.
// Routes by scope, stamps `created` (only if new) + `updated`, atomically writes
// the serialized form. Does NOT mutate the caller's object.
function write(instinct, env, home) {
  const ts = nowISO();
  const filepath = fileFor(instinct, env, home);
  const record = { ...instinct };
  record.created = record.created || ts;
  record.updated = ts;
  if (record.reinforcements === undefined || record.reinforcements === null) {
    record.reinforcements = 0;
  }
  atomicWrite(filepath, serialize(record));
  return filepath;
}

// read(filepath) -> instinct.
function read(filepath) {
  return parse(fs.readFileSync(filepath, 'utf8'));
}

// readById(id, { scope, projectId }, env?, home?) -> instinct | null.
// Throws on a hostile id (same trust boundary as write) — a malicious id must
// not even probe for existence OUTSIDE the intended instinct dir.
function readById(id, { scope, projectId } = {}, env, home) {
  const l = layout(projectId || '_global_', env, home);
  const dir = scope === 'global' ? l.globalInstinctsDir : l.projectInstinctsDir;
  const filepath = safeFileIn(dir, id);
  if (!fs.existsSync(filepath)) return null;
  return read(filepath);
}

// Parse every `*.md` in a directory; missing dir => [].
function readDir(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    out.push(read(path.join(dir, name)));
  }
  return out;
}

// list({ projectId, scope?, minConfidence?, now? }, env?, home?) -> instinct[].
// scope: 'project' | 'global' | undefined (both). If minConfidence is set, filter
// by EFFECTIVE (decayed) confidence at `now`.
function list({ projectId, scope, minConfidence, now } = {}, env, home) {
  const l = layout(projectId || '_global_', env, home);
  let instincts = [];
  if (scope === 'global') {
    instincts = readDir(l.globalInstinctsDir);
  } else if (scope === 'project') {
    instincts = readDir(l.projectInstinctsDir);
  } else {
    instincts = readDir(l.projectInstinctsDir).concat(readDir(l.globalInstinctsDir));
  }
  if (minConfidence !== undefined && minConfidence !== null) {
    const at = now ?? Date.now();
    instincts = instincts.filter(
      (inst) => effectiveConfidence(inst, at) >= minConfidence,
    );
  }
  return instincts;
}

// forProject(projectId, { minConfidence?, now? } = {}, env?, home?) -> instinct[].
// THIS project's project-scoped instincts + ALL global ones, sorted best-first by
// effective confidence. A different project's instincts are never included
// (they live under a different projectInstinctsDir).
function forProject(projectId, { minConfidence, now } = {}, env, home) {
  const at = now ?? Date.now();
  const instincts = list({ projectId, minConfidence, now: at }, env, home);
  instincts.sort(
    (a, b) => effectiveConfidence(b, at) - effectiveConfidence(a, at),
  );
  return instincts;
}

// reinforce(instinct, opts?) -> instinct (new object; does not mutate input).
// Frequency bump toward (but never reaching) 1.0; reinforcements += 1; updated = now.
function reinforce(instinct, opts = {}) {
  const rate = opts.rate ?? REINFORCE_RATE;
  const current = Number.isFinite(instinct.confidence) ? instinct.confidence : 0;
  let next = current + (1 - current) * rate;
  if (next > MAX_CONFIDENCE) next = MAX_CONFIDENCE;
  return {
    ...instinct,
    confidence: next,
    reinforcements: (instinct.reinforcements ?? 0) + 1,
    updated: nowISO(),
  };
}

// effectiveConfidence(instinct, now = Date.now()) -> number.
// Read-time exponential decay; raw confidence is never mutated.
function effectiveConfidence(instinct, now = Date.now()) {
  const raw = Number.isFinite(instinct.confidence) ? instinct.confidence : 0;
  const updatedMs = Date.parse(instinct.updated);
  if (!Number.isFinite(updatedMs)) return raw; // no/invalid timestamp → no decay
  const ageDays = (now - updatedMs) / DAY_MS;
  if (ageDays <= 0) return raw; // freshly updated (or clock skew) → full value
  return raw * Math.pow(0.5, ageDays / halfLifeDays());
}

// remove(instinct, env?, home?) -> boolean.
// Deletes the instinct file. Returns true if the file existed and was deleted,
// false if it did not exist (idempotent). Throws on a hostile id — the delete
// MUST NOT escape the instinct directory (same trust boundary as write).
function remove(instinct, env, home) {
  const filepath = fileFor(instinct, env, home); // throws on hostile id via safeFileIn
  const existed = fs.existsSync(filepath);
  fs.rmSync(filepath, { force: true });
  return existed;
}

// promote(instinct, env?, home?) -> { promoted, from, to }.
// Re-scopes a project-scoped instinct to global. Pure mechanic — no confidence-bar
// policy (the /promote command enforces ≥0.8 before calling this).
//
// If the instinct is already global, returns { promoted: false, from, to } with
// both pointing to the (single) global file path — no-op, no throw, no duplicate.
//
// Order of operations: write the global copy FIRST, then remove the project file.
// A crash between the two leaves a duplicate (recoverable: same id → write overwrites)
// rather than data loss. If a global instinct with the same id already exists,
// write overwrites it — acceptable, as same id = same instinct identity.
function promote(instinct, env, home) {
  if (instinct.scope === 'global') {
    // Already global — nothing to do. Compute the path for the caller's reference.
    const filepath = fileFor(instinct, env, home);
    return { promoted: false, from: filepath, to: filepath };
  }

  // Build the global copy: drop project_id, set scope=global, preserve everything else.
  // write will stamp `updated`; `created` is preserved from the original.
  const globalCopy = { ...instinct, scope: 'global', project_id: undefined };

  // Step 1: write the global copy (safe even if the global already exists — overwrites).
  const to = write(globalCopy, env, home);

  // Step 2: remove the project-scoped original.
  const from = fileFor(instinct, env, home);
  remove(instinct, env, home);

  return { promoted: true, from, to };
}

module.exports = {
  write,
  read,
  readById,
  list,
  forProject,
  reinforce,
  effectiveConfidence,
  remove,
  promote,
};
