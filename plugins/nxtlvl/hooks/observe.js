#!/usr/bin/env node
/**
 * nxtlvl observe hook  —  PostToolUse matcher: *
 *
 * The cadence + single-flight gate that wakes the background observer. Per tool
 * call it checks whether enough observations have accumulated and, if so, spawns
 * the DETACHED observer runner (lib/observer-runner.js) — at most one per
 * session/project at a time. It emits NOTHING to the agent and is fail-open
 * absolute: every path returns '' and exits 0, even a spawn failure (Spike 0.3
 * acceptance #2).
 *
 * ── Gate sequence (per call) ─────────────────────────────────────────────────
 *   1. Kill switch / self-watch / sidechain skips (see SKIP GUARDS).
 *   2. Cadence: obs-log.pendingCount(projectId) >= CADENCE (default 20).
 *   3. Single-flight: acquire an atomic exclusive-create lock; if a LIVE lock
 *      exists, skip (don't spawn a second observer). A STALE lock (older than the
 *      staleness window) is reclaimed so the subsystem can't wedge forever.
 *   4. Spawn the detached runner via the proven Spike-0.3 idiom, passing
 *      projectId/session/lockPath and NXTLVL_CM_OBSERVER=1 in the CHILD env.
 *
 * ── SKIP GUARDS (never spawn) ────────────────────────────────────────────────
 *   NXTLVL_CM_OBSERVE=off/0/false/no/disabled  — kill switch
 *   NXTLVL_CM_OBSERVER=<truthy>                — already inside an observer run
 *                                                (prevents observer→observer regress)
 *   isSidechain=true in the payload            — subagent/Task turns (as capture.js)
 *
 * ── Single-flight lock ───────────────────────────────────────────────────────
 *   Location: <projectDir>/observer.<session>.lock  (projectDir from paths.layout;
 *             session-scoped so two sessions on one project don't block each other).
 *   Mechanism: fs.openSync(lock, 'wx') — exclusive create. EEXIST => a lock is held.
 *   Staleness window: NXTLVL_CM_OBSERVE_LOCK_TTL_MS (default 300000 = 5 min). If an
 *             existing lock's mtime is older than the window it is a presumed-dead
 *             runner's residue; we unlink + retry the create once. The runner's
 *             finally unlinks the lock on every non-SIGKILL exit, so a stale lock
 *             only persists after a hard kill — exactly what the window reclaims.
 *
 *   ⚠ TTL > model-timeout invariant: the runner bounds the real `claude` call at
 *             NXTLVL_CM_MODEL_TIMEOUT_MS (default 120000 = 2 min — see
 *             observer-runner.js). This TTL MUST stay safely ABOVE that ceiling so
 *             a STILL-RUNNING observer's lock is never considered stale and falsely
 *             reclaimed (which would spawn a SECOND concurrent observer). Default
 *             300000 (5 min) > 120000 (2 min) honours it; keep this margin when
 *             tuning either value.
 *
 * Tunable via env:
 *   NXTLVL_CM_OBSERVE                 off/0/false/no/disabled to disable entirely
 *   NXTLVL_CM_OBSERVE_CADENCE         pending-count threshold (default 20)
 *   NXTLVL_CM_OBSERVE_LOCK_TTL_MS     stale-lock window in ms (default 300000;
 *                                     MUST exceed NXTLVL_CM_MODEL_TIMEOUT_MS)
 */

'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');

const obsLog = require('../lib/obs-log.js');
const { projectIdentity } = require('../lib/project-identity.js');
const { layout } = require('../lib/paths.ts');

// --- Constants ----------------------------------------------------------------

const DEFAULT_CADENCE = 20;
// 5 min — a hard-killed runner's lock reclaim window. MUST stay > the runner's
// model-call timeout (NXTLVL_CM_MODEL_TIMEOUT_MS, default 2 min) so a healthy,
// still-running observer's lock is never falsely reclaimed → no double observer.
const DEFAULT_LOCK_TTL_MS = 300000;
const MAX_STDIN = 4 * 1024 * 1024;
const OFF_VALUES = ['0', 'false', 'no', 'off', 'disabled'];

// Absolute path to the runner this hook detaches.
const RUNNER = path.join(__dirname, '..', 'lib', 'observer-runner.js');

// --- Env helpers --------------------------------------------------------------

function isOffLike(raw) {
  return OFF_VALUES.includes(String(raw || '').trim().toLowerCase());
}

function isObserveDisabled(env) {
  return isOffLike(env.NXTLVL_CM_OBSERVE);
}

function isObserverRun(env) {
  const v = env.NXTLVL_CM_OBSERVER;
  return v && !isOffLike(v);
}

function resolveCadence(env) {
  const n = parseInt(env.NXTLVL_CM_OBSERVE_CADENCE, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CADENCE;
}

function resolveLockTtl(env) {
  const n = parseInt(env.NXTLVL_CM_OBSERVE_LOCK_TTL_MS, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LOCK_TTL_MS;
}

// --- Session-id sanitization (filename-safe lock component) -------------------
// A lock filename embeds the session id; keep it path-safe. Falls back to
// 'nosession' so a session-less call still single-flights per project.
function safeSession(raw) {
  if (!raw || typeof raw !== 'string') return 'nosession';
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return safe || 'nosession';
}

// --- Single-flight lock -------------------------------------------------------
// Atomic exclusive-create. Returns the lock path on success, or null if a LIVE
// lock is already held. A stale lock (mtime older than ttlMs) is reclaimed once.
// Never throws — any unexpected fs error fails toward "don't spawn" (null).
function acquireLock(lockPath, ttlMs, nowMs) {
  try {
    const fd = fs.openSync(lockPath, 'wx');
    try {
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, ts: new Date(nowMs).toISOString() }));
    } catch {
      /* writing the lock body is best-effort; the create is what matters */
    }
    fs.closeSync(fd);
    return lockPath;
  } catch (err) {
    if (!err || err.code !== 'EEXIST') return null; // unexpected error → don't spawn

    // A lock exists. Reclaim only if it is older than the staleness window.
    let mtimeMs;
    try {
      mtimeMs = fs.statSync(lockPath).mtimeMs;
    } catch {
      // Lock vanished between open and stat (a runner just released it): retry once.
      return retryCreate(lockPath, nowMs);
    }
    if (nowMs - mtimeMs <= ttlMs) return null; // live lock — single-flight: skip

    // Stale: presumed-dead runner residue. Unlink + retry the exclusive create.
    try {
      fs.unlinkSync(lockPath);
    } catch {
      /* someone else may have reclaimed it first — fine, the retry will EEXIST */
    }
    return retryCreate(lockPath, nowMs);
  }
}

function retryCreate(lockPath, nowMs) {
  try {
    const fd = fs.openSync(lockPath, 'wx');
    try {
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, ts: new Date(nowMs).toISOString() }));
    } catch {
      /* best-effort body */
    }
    fs.closeSync(fd);
    return lockPath;
  } catch {
    // Lost the race to another concurrent hook — single-flight holds: skip.
    return null;
  }
}

// --- Real detached spawn (the injectable default) -----------------------------
// The proven Spike-0.3 idiom: detached + stdio:'ignore' + on('error') + unref(),
// all inside a fail-open try/catch. NXTLVL_CM_OBSERVER=1 in the CHILD env so the
// child's own capture/observe hooks self-skip. Passes projectId/session/lockPath
// as argv. Returns true if a child handle was produced, false on any failure.
function realSpawnObserver({ projectId, cwd, session, lockPath }, env) {
  try {
    const child = cp.spawn(
      process.execPath,
      [RUNNER, projectId, session || '', lockPath || ''],
      {
        detached: true,
        stdio: 'ignore',
        env: {
          ...env,
          NXTLVL_CM_OBSERVER: '1',
          NXTLVL_CM_OBSERVER_CWD: cwd || '',
          NXTLVL_CM_OBSERVER_SESSION: session || '',
          NXTLVL_CM_OBSERVER_LOCK: lockPath || '',
        },
      },
    );
    if (child && typeof child.on === 'function') child.on('error', () => {});
    if (child && typeof child.unref === 'function') child.unref();
    return true;
  } catch {
    return false; // fail-open: a spawn failure must still let the hook exit 0
  }
}

// --- Core ---------------------------------------------------------------------
/**
 * @param {string} rawInput  Hook event JSON from stdin
 * @param {object} env       process.env (or test substitute)
 * @param {object} deps      Injection seam:
 *   spawnObserver(args, env) => bool   default realSpawnObserver (tests inject a fake)
 *   now()                    => ms      clock for the staleness window (default Date.now)
 * @returns {string}         Always '' (observe is silent).
 */
function run(rawInput, env = process.env, deps = {}) {
  try {
    // 1a. Kill switch.
    if (isObserveDisabled(env)) return '';
    // 1b. Self-watch: never let an observer's own claude run re-trigger an observer.
    if (isObserverRun(env)) return '';

    const input = rawInput && rawInput.trim() ? JSON.parse(rawInput) : {};

    // 1c. Sidechain/subagent guard (same flag capture.js reads).
    if (input.isSidechain === true) return '';

    const cwd = input.cwd || process.cwd();
    const session = safeSession(input.session_id || env.CLAUDE_SESSION_ID);

    // Resolve project identity (deterministic key from cwd).
    const identity = projectIdentity(cwd);
    const projectId = identity.key;

    // 2. Cadence gate — pendingCount is side-effect free (does not advance cursor).
    const cadence = resolveCadence(env);
    const pending = obsLog.pendingCount(projectId, { env });
    if (pending < cadence) return '';

    // 3. Single-flight: acquire the session-scoped lock atomically.
    const paths = layout(projectId, env);
    // The lock lives in projectDir; ensure it exists (paths.layout is pure).
    try {
      fs.mkdirSync(paths.projectDir, { recursive: true });
    } catch {
      return ''; // can't even make the dir → fail-open, don't spawn
    }
    const lockPath = path.join(paths.projectDir, `observer.${session}.lock`);
    const nowMs = deps.now ? deps.now() : Date.now();
    const ttlMs = resolveLockTtl(env);
    const acquired = acquireLock(lockPath, ttlMs, nowMs);
    if (!acquired) return ''; // a live observer is already running for this session

    // 4. Spawn the detached runner (injectable). On spawn failure, release the
    //    lock we just took so the NEXT call can retry rather than wedging on it.
    const spawnObserver = deps.spawnObserver || realSpawnObserver;
    const ok = spawnObserver({ projectId, cwd, session, lockPath: acquired }, env);
    if (!ok) {
      try {
        fs.unlinkSync(acquired);
      } catch {
        /* best-effort */
      }
    }
  } catch {
    // Fail-open absolute: never block or alter a tool call.
  }
  return '';
}

// --- stdin entrypoint ---------------------------------------------------------

if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  // Absolute fail-open: a stdin stream error must not throw past run()'s guard.
  process.stdin.on('error', () => process.exit(0));
  process.stdin.on('data', (chunk) => {
    if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
  });
  process.stdin.on('end', () => {
    run(data);
    process.exit(0);
  });
}

module.exports = {
  run,
  acquireLock,
  realSpawnObserver,
  isOffLike,
  isObserveDisabled,
  isObserverRun,
  resolveCadence,
  resolveLockTtl,
  safeSession,
  DEFAULT_CADENCE,
  DEFAULT_LOCK_TTL_MS,
  RUNNER,
};
