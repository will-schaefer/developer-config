#!/usr/bin/env node
/**
 * nxtlvl observer-runner  —  the DETACHED process's logic (Task 2.3, File 2).
 *
 * The observe hook (hooks/observe.js) spawns THIS file as a detached `node`
 * child once enough observations accumulate. It reads the new observations for
 * the project, asks claude-sonnet-4-6 to distil them into INSTINCT operations,
 * applies those operations through lib/instincts, advances the obs-log cursor,
 * and — in a `finally` that covers BOTH clean completion AND any error/death —
 * writes ONE liveness line and releases the single-flight lock.
 *
 * ── Pattern targets (ecc's four) ─────────────────────────────────────────────
 * The model is asked to detect, across the new observations:
 *   (a) corrections        — the user/agent reversed or fixed a prior action
 *   (b) error → fix        — a tool error followed by the action that resolved it
 *   (c) repeated workflows — a recurring sequence of tool calls
 *   (d) tool preferences   — a consistent choice of one tool/approach over another
 * and to return STRICT JSON operations (see OPERATION SCHEMA below).
 *
 * ── OPERATION SCHEMA (the model's contract) ──────────────────────────────────
 *   { "operations": [
 *       { "kind": "create",
 *         "trigger": "<when this instinct applies>",
 *         "action":  "<what to do>",
 *         "domain":  "<short domain tag, e.g. git, testing, editing>",
 *         "evidence":"<why — cite the observed pattern>",
 *         "confidence": <0..1 number> },
 *       { "kind": "reinforce",
 *         "id": "<existing instinct id to bump>",
 *         "evidence": "<optional: the fresh observation that reinforces it>" }
 *   ] }
 * Unknown kinds and malformed entries are skipped; a whole-payload parse failure
 * writes no instincts and is recorded in the liveness line (fail-open).
 *
 * ── Cursor / durability decision ─────────────────────────────────────────────
 * obs-log.readNew ADVANCES the cursor at READ time (it is the consume point — it
 * cannot be deferred without re-implementing the module). So this runner reads
 * the batch up front, then applies. A crash AFTER readNew but BEFORE/DURING apply
 * loses that one batch (the cursor already moved past it). This is the accepted
 * "best-effort distillation tolerating one lost batch" trade-off (Task 2.3) — the
 * obs-log substrate is crash-safe; the distillation layer is best-effort. The
 * liveness line records the batch size so a lost batch is at least visible.
 *
 * ── Injection (testability) ──────────────────────────────────────────────────
 * runObserver(args, deps) takes deps.runModel(prompt) => opsJsonString and
 * deps.now/deps.env so tests never spawn a real `claude` and isolate the store
 * under a tmp XDG_STATE_HOME. The real runModel shells out to:
 *   claude -p <prompt> --model claude-sonnet-4-6 --output-format json
 * with NXTLVL_CM_OBSERVER=1 in the child env (so the child's own capture/observe
 * hooks skip ITS tool calls — no observer-spawns-observer regress).
 *
 * FAIL-OPEN: any error is swallowed; the finally always runs (except SIGKILL).
 */

'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');

const obsLog = require('./obs-log.js');
const instincts = require('./instincts.js');
const atomic = require('./atomic.js');
const { layout } = require('./paths.ts');

const MODEL = 'claude-sonnet-4-6';

// --- Untrusted-output bounds -------------------------------------------------
// The model output is untrusted. Cap how much of it we apply per batch, and clamp
// each stored field, so one batch can never write thousands of files nor a single
// arbitrarily-large file. Both env-tunable but defaulted to sane ceilings.
const MAX_OPS_PER_BATCH = boundedInt(process.env.NXTLVL_CM_MAX_OPS, 50, 1, 10000);
const MAX_FIELD_LEN = boundedInt(process.env.NXTLVL_CM_MAX_FIELD_LEN, 4000, 16, 1 << 20);

// --- Model-call timeout vs lock TTL (concurrency invariant) ------------------
// The real `claude` call MUST be bounded: an unbounded call that outlives the
// single-flight lock's staleness window would let a second hook falsely reclaim
// the lock and spawn a SECOND concurrent observer. So the model timeout is the
// HARD ceiling on one observer's lifetime, and the lock TTL (hooks/observe.js,
// DEFAULT_LOCK_TTL_MS) MUST sit safely ABOVE it. Relationship (both env-tunable):
//     NXTLVL_CM_OBSERVE_LOCK_TTL_MS  (lock TTL)   >   NXTLVL_CM_MODEL_TIMEOUT_MS  (model timeout)
// Defaults honour it: model timeout 120000ms (2 min) < lock TTL 300000ms (5 min).
const MODEL_TIMEOUT_MS = boundedInt(process.env.NXTLVL_CM_MODEL_TIMEOUT_MS, 120000, 1000, 3600000);

function boundedInt(raw, dflt, lo, hi) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

// Clamp a value to a bounded string for storage.
function clampField(v, max = MAX_FIELD_LEN) {
  return String(v).slice(0, max);
}

// --- the real model call (injectable; never reached in tests) ----------------
// Shells out to `claude -p` and returns the model's RESULT TEXT, which is
// expected to be the operations JSON. The `--output-format json` envelope is
// unwrapped to its `.result` field; if that is absent we hand back the raw
// stdout and let the parser deal with it. Carries NXTLVL_CM_OBSERVER=1 so the
// child's own hooks self-skip.
function realRunModel(prompt, env = process.env) {
  const out = cp.execFileSync(
    'claude',
    ['-p', prompt, '--model', MODEL, '--output-format', 'json'],
    {
      encoding: 'utf8',
      env: { ...env, NXTLVL_CM_OBSERVER: '1' },
      maxBuffer: 8 * 1024 * 1024,
      // Bounded ceiling: a model call exceeding this is killed and surfaces as a
      // throw (caught by runObserver → outcome 'error', fail-open). This timeout
      // is what keeps the lock TTL > observer-lifetime invariant true.
      timeout: MODEL_TIMEOUT_MS,
    },
  );
  try {
    const env_ = JSON.parse(out);
    if (env_ && typeof env_.result === 'string') return env_.result;
  } catch {
    /* not the json envelope — fall through to raw stdout */
  }
  return out;
}

// --- prompt construction -----------------------------------------------------
// Render the new observations compactly and ask for the four-pattern distillation
// as strict JSON ops. Kept deterministic so the prompt is testable/inspectable.
function buildPrompt(entries, existing) {
  const obsLines = entries
    .map((e) => {
      const field = e.event === 'tool_complete' ? e.output : e.input;
      let payload = '';
      try {
        payload = typeof field === 'string' ? field : JSON.stringify(field);
      } catch {
        payload = String(field);
      }
      if (payload && payload.length > 800) payload = payload.slice(0, 800);
      return `- [${e.event}] ${e.tool || '?'}: ${payload || ''}`;
    })
    .join('\n');

  const existingLines = existing.length
    ? existing
        .map((i) => `- id=${i.id} trigger="${i.trigger}" domain=${i.domain}`)
        .join('\n')
    : '(none yet)';

  return [
    'You are the nxtlvl instinct observer. Distil the recent tool-call',
    'observations below into LEARNED HABITS ("instincts"). Detect these four',
    'patterns: (a) corrections, (b) error->fix, (c) repeated workflows,',
    '(d) tool preferences. Only emit an instinct when the evidence is real.',
    '',
    'Existing instincts (reinforce one by id instead of duplicating it):',
    existingLines,
    '',
    'New observations:',
    obsLines,
    '',
    'Return STRICT JSON only, no prose, matching exactly:',
    '{"operations":[{"kind":"create","trigger":"...","action":"...",',
    '"domain":"...","evidence":"...","confidence":0.8},',
    '{"kind":"reinforce","id":"...","evidence":"..."}]}',
    'If nothing rises to an instinct, return {"operations":[]}.',
  ].join('\n');
}

// --- ops parsing -------------------------------------------------------------
// Tolerant: accept either a bare ops array, a wrapped {operations:[...]}, or a
// blob with surrounding text (extract the first {...} JSON object). Returns [].
function parseOps(opsJson) {
  if (Array.isArray(opsJson)) return opsJson;
  let obj = null;
  if (typeof opsJson === 'object' && opsJson !== null) {
    obj = opsJson;
  } else if (typeof opsJson === 'string') {
    const text = opsJson.trim();
    try {
      obj = JSON.parse(text);
    } catch {
      // Try to salvage the first JSON object embedded in surrounding text.
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          obj = JSON.parse(text.slice(start, end + 1));
        } catch {
          obj = null;
        }
      }
    }
  }
  if (Array.isArray(obj)) return obj;
  if (obj && Array.isArray(obj.operations)) return obj.operations;
  return [];
}

// --- id helper ---------------------------------------------------------------
// Reduce an arbitrary string to a filesystem-safe slug: lowercase, only [a-z0-9-],
// trimmed, length-bounded. This is the SAME rule applied to BOTH a model-supplied
// id and the no-id fallback, so a hostile id ("../../../../evil") can never reach
// the filename verbatim — it collapses to harmless characters.
function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// Deterministic-ish slug for a fresh instinct id. Prefers a sanitized model id;
// otherwise derives from domain/trigger. Always suffixed with a unique-enough seed
// so distinct ops in one batch (which may share a domain) don't collide on the
// same filename. NEVER trusts op.id verbatim.
function slugId(op, fallbackSeed) {
  const base = op.id ? slugify(op.id) : slugify(op.domain || op.trigger || 'instinct');
  const seed = slugify(String(fallbackSeed)).slice(0, 24);
  return `${base || 'instinct'}-${seed}`;
}

// Is an id safe to hand to instincts.readById without it throwing? Mirrors the
// lib/instincts trust-boundary rules so a hostile reinforce id is DROPPED here
// (skipped) rather than throwing the per-op try/catch.
function isSafeReinforceId(id) {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    !id.includes('/') &&
    !id.includes('\\') &&
    !id.includes('..') &&
    !id.startsWith('.')
  );
}

// --- apply one batch of ops --------------------------------------------------
// Returns { created, reinforced, skipped }. The model output is UNTRUSTED:
//   - at most MAX_OPS_PER_BATCH ops are applied (the rest are dropped + counted);
//   - every stored field is clamped to MAX_FIELD_LEN;
//   - a create id is ALWAYS slugified (op.id is never trusted verbatim — defense
//     in depth behind the lib/instincts trust boundary);
//   - a reinforce id is validated and the single op DROPPED if hostile.
// Each op is independently guarded so one bad/hostile op never aborts the rest.
function applyOps(ops, { projectId, env, home }) {
  let created = 0;
  let reinforced = 0;
  let skipped = 0;

  for (let idx = 0; idx < ops.length; idx++) {
    // Cap the batch: ops beyond the cap are dropped (counted as skipped).
    if (idx >= MAX_OPS_PER_BATCH) {
      skipped++;
      continue;
    }
    const op = ops[idx];
    if (!op || typeof op !== 'object') {
      skipped++;
      continue;
    }
    try {
      if (op.kind === 'create') {
        if (!op.trigger || !op.action) {
          skipped++;
          continue;
        }
        // Never trust op.id verbatim — always derive a safe slug.
        const id = slugId(op, `${Date.now()}${idx}`);
        // Confidence: accept the documented inclusive 0..1; else default 0.7.
        const conf =
          Number.isFinite(op.confidence) && op.confidence >= 0 && op.confidence <= 1
            ? op.confidence
            : 0.7;
        const inst = {
          id,
          trigger: clampField(op.trigger),
          confidence: conf,
          domain: op.domain ? clampField(op.domain) : 'general',
          scope: 'project',
          project_id: projectId,
          source: 'observer',
          action: clampField(op.action),
          evidence: op.evidence ? clampField(op.evidence) : '',
          reinforcements: 0,
        };
        instincts.write(inst, env, home);
        created++;
      } else if (op.kind === 'reinforce') {
        // Validate the id BEFORE lookup; a hostile id drops just this op.
        if (!isSafeReinforceId(op.id)) {
          skipped++;
          continue;
        }
        const existing = instincts.readById(
          String(op.id),
          { scope: 'project', projectId },
          env,
          home,
        );
        if (!existing) {
          skipped++;
          continue;
        }
        const bumped = instincts.reinforce(existing);
        // reinforce() drops project_id if the parsed instinct lacked it; ensure it.
        if (!bumped.project_id) bumped.project_id = projectId;
        if (!bumped.scope) bumped.scope = 'project';
        if (op.evidence) bumped.evidence = clampField(op.evidence);
        instincts.write(bumped, env, home);
        reinforced++;
      } else {
        skipped++;
      }
    } catch {
      // One bad/hostile op never aborts the batch (fail-open per-op).
      skipped++;
    }
  }
  return { created, reinforced, skipped };
}

// --- the runner --------------------------------------------------------------
/**
 * runObserver({ projectId, cwd, session, lockPath }, deps) -> outcome object.
 *
 * deps:
 *   runModel(prompt) => opsJson   REQUIRED for the real call; tests inject a fake.
 *   env                           env object threaded to obs-log/instincts/paths
 *                                 (carries XDG_STATE_HOME in tests). Default process.env.
 *   home                          homedir override (tests rarely need it).
 *   now()                         clock (default Date.now) for the liveness ts seam.
 *
 * Always runs the liveness+unlock finally (except SIGKILL). Never throws.
 */
function runObserver(args = {}, deps = {}) {
  const { projectId, session = null, lockPath = null } = args;
  const env = deps.env || process.env;
  const home = deps.home;
  const runModel = deps.runModel || ((p) => realRunModel(p, env));

  // opts shape that obs-log wants ({ env, home }); undefined home is fine.
  const obsOpts = { env, home };

  let outcome = 'ok';
  let counts = { read: 0, created: 0, reinforced: 0, skipped: 0 };
  let parseFailed = false;

  try {
    // 1. Read the new observations (this ADVANCES the cursor — see module doc).
    const { entries } = obsLog.readNew(projectId, obsOpts);
    counts.read = entries.length;

    // Zero new observations → nothing to do; finally still records liveness+unlock.
    if (entries.length === 0) {
      return finishWith();
    }

    // 2. Build the prompt + invoke the model (injectable).
    const existing = safeList(projectId, env, home);
    const prompt = buildPrompt(entries, existing);

    let opsJson;
    try {
      opsJson = runModel(prompt);
    } catch {
      // Model invocation failed — no instincts; liveness records the error.
      outcome = 'error';
      return finishWith();
    }

    const ops = parseOps(opsJson);
    if (ops.length === 0 && opsJson !== '' && opsJson != null) {
      // Distinguish "parsed but empty" from "could not parse at all": if the
      // payload was a non-empty string we could not turn into ops, flag it.
      if (typeof opsJson === 'string' && opsJson.trim() && !looksLikeEmptyOps(opsJson)) {
        parseFailed = true;
      }
    }

    // 3. Apply ops through lib/instincts (each op independently guarded).
    const applied = applyOps(ops, { projectId, env, home });
    counts.created = applied.created;
    counts.reinforced = applied.reinforced;
    counts.skipped = applied.skipped;

    if (parseFailed) outcome = 'error';
    return finishWith();
  } catch {
    outcome = 'error';
    return finishWith();
  }

  // --- liveness + lock release (the §7-a invariant) -------------------------
  // Defined as a closure so EVERY return path above flows through it. Covers
  // clean completion AND any thrown error: one liveness line, then unlink lock.
  function finishWith() {
    const ts = deps.now ? new Date(deps.now()).toISOString() : new Date().toISOString();
    try {
      const paths = layout(projectId, env, home);
      atomic.writeLiveness(paths.livenessLog, {
        ts,
        component: 'observer',
        session,
        outcome,
        counts,
      });
    } catch {
      /* writeLiveness never throws, but guard the layout() call too */
    }
    if (lockPath) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        /* best-effort unlink — a stale-reclaim or missing lock is fine */
      }
    }
    return { outcome, counts };
  }
}

// list() can throw if the store dir is weird; never let it sink the run.
function safeList(projectId, env, home) {
  try {
    return instincts.list({ projectId, scope: 'project' }, env, home);
  } catch {
    return [];
  }
}

// Heuristic: did the model explicitly return an empty operations set?
function looksLikeEmptyOps(s) {
  const t = s.replace(/\s+/g, '');
  return t === '{"operations":[]}' || t === '[]' || t === '{}';
}

// --- detached entrypoint -----------------------------------------------------
// Parses argv/env and runs. argv: node observer-runner.js <projectId> <session> <lockPath>
// (cwd is informational only — identity is already resolved to projectId by the hook).
if (require.main === module) {
  const [, , projectId, session, lockPath] = process.argv;
  // The real model call is the default (deps omitted). NXTLVL_CM_OBSERVER=1 is set
  // by the parent hook in this process's env, so the child's hooks self-skip.
  try {
    runObserver({
      projectId,
      cwd: process.env.NXTLVL_CM_OBSERVER_CWD || process.cwd(),
      session: session || process.env.NXTLVL_CM_OBSERVER_SESSION || null,
      lockPath: lockPath || process.env.NXTLVL_CM_OBSERVER_LOCK || null,
    });
  } catch {
    /* fail-open: a detached observer must never surface a non-zero exit usefully */
  }
  process.exit(0);
}

module.exports = {
  runObserver,
  buildPrompt,
  parseOps,
  applyOps,
  slugId,
  slugify,
  realRunModel,
  MODEL,
  MAX_OPS_PER_BATCH,
  MAX_FIELD_LEN,
  MODEL_TIMEOUT_MS,
};
