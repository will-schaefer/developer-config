// metrics — §8 readout aggregations for /instinct-status.
//
// Two readouts (ADR-005, amended 2026-06-19):
//   1. fallback-rate  — north-star reliability metric: share of sessions that reached
//      for `ecc`, trending down to a low plateau. Powered by the global fallback log
//      (~/.claude/nxtlvl/fallback-log.jsonl) written by fallback-log.sh.
//   2. instinct-confidence distribution — learning quality, expressed as a histogram
//      of EFFECTIVE (decayed) confidence across this project's + global instincts.
//
// Both roots are injectable via env/home for hermetic testing.
// Note: the fallback log lives under ~/.claude/nxtlvl/ (ADR-005 fixed path), deliberately
// NOT the XDG store — it is global and must survive reinstall and non-repo sessions.

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const { storageRoot }        = require('./paths.ts');
const { list, effectiveConfidence } = require('./instincts.js');

// ---------------------------------------------------------------------------
// fallbackRate
// ---------------------------------------------------------------------------

/**
 * fallbackRate(env?, home?) -> { fallbackEvents, sessionsWithFallback, totalSessions, rate }
 *
 * fallbackEvents        — count of well-formed lines in the global fallback log.
 * sessionsWithFallback  — distinct non-null session values in those lines.
 *                         A line with null/missing session counts toward fallbackEvents
 *                         but cannot be attributed to a session, so it is excluded from
 *                         this Set.
 * totalSessions         — count of lines with event === "session_close" across every
 *                         <storageRoot>/projects/<id>/metrics.jsonl.
 * rate                  — sessionsWithFallback / totalSessions, clamped to [0, 1], or null
 *                         when totalSessions === 0. The clamp guards the display from
 *                         exceeding 100% if a fallback session crashed before its
 *                         SessionEnd metrics line; raw counts are preserved unclamped.
 */
function fallbackRate(env = process.env, home = os.homedir()) {
  let fallbackEvents       = 0;
  const sessionSet         = new Set();
  let totalSessions        = 0;

  // --- Global fallback log (ADR-005 fixed path: ~/.claude/nxtlvl/fallback-log.jsonl) ---
  const logPath = path.join(home, '.claude', 'nxtlvl', 'fallback-log.jsonl');
  try {
    const text = fs.readFileSync(logPath, 'utf8');
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      if (!obj || typeof obj !== 'object') continue;
      fallbackEvents++;
      const sid = obj.session;
      if (sid !== null && sid !== undefined) {
        sessionSet.add(sid);
      }
    }
  } catch {
    // Missing log → contribute 0 (fail-open).
  }

  // --- Per-project metrics.jsonl files ---
  const root = storageRoot(env, home);
  const projectsDir = path.join(root, 'projects');
  try {
    const projectEntries = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of projectEntries) {
      if (!entry.isDirectory()) continue;
      const metricsPath = path.join(projectsDir, entry.name, 'metrics.jsonl');
      try {
        const text = fs.readFileSync(metricsPath, 'utf8');
        for (const raw of text.split('\n')) {
          const line = raw.trim();
          if (!line) continue;
          let obj;
          try { obj = JSON.parse(line); } catch { continue; }
          if (!obj || typeof obj !== 'object') continue;
          if (obj.event === 'session_close') {
            totalSessions++;
          }
        }
      } catch {
        // Missing metrics.jsonl → contribute 0.
      }
    }
  } catch {
    // Missing projects dir → totalSessions stays 0.
  }

  const sessionsWithFallback = sessionSet.size;
  const rate = totalSessions > 0
    ? Math.min(1, sessionsWithFallback / totalSessions)
    : null;

  return { fallbackEvents, sessionsWithFallback, totalSessions, rate };
}

// ---------------------------------------------------------------------------
// bucketEffective
// ---------------------------------------------------------------------------

/**
 * bucketEffective(effValues) -> { n, mean, bins }
 *
 * Pure histogram helper — no store reads; export for direct unit testing.
 *
 * 5 even bins with edges [0, .2, .4, .6, .8, 1.0].
 * Bin index for value v: v >= 1 ? 4 : Math.floor(v / 0.2), clamped [0,4].
 * So 0.8 -> bin 4 (top), 0.6 -> bin 3, 0.2 -> bin 1, 0.0 -> bin 0.
 * Top bin [0.8, 1.0] is inclusive of 1.0; the rest are [lo, hi).
 *
 * Returns bins ordered high→low (top bin first) to match /instinct-status's
 * best-first convention.
 */
const BIN_DEFS = [
  { label: '0.8–1.0', lo: 0.8, hi: 1.0 },
  { label: '0.6–0.8', lo: 0.6, hi: 0.8 },
  { label: '0.4–0.6', lo: 0.4, hi: 0.6 },
  { label: '0.2–0.4', lo: 0.2, hi: 0.4 },
  { label: '0.0–0.2', lo: 0.0, hi: 0.2 },
];

function bucketEffective(effValues) {
  const n = effValues.length;
  const counts = [0, 0, 0, 0, 0]; // index 0 = top bin [0.8–1.0]

  let sum = 0;
  for (const v of effValues) {
    sum += v;
    // Raw bin index 0–4 where 0 = [0.0, 0.2), 4 = [0.8, 1.0].
    // Round the quotient to 10 decimal places before flooring to avoid floating-point
    // under-counts at exact bin edges (e.g. 0.6/0.2 → 2.9999... → floor 2, not 3).
    let rawIdx = v >= 1 ? 4 : Math.floor(Math.round(v / 0.2 * 1e10) / 1e10);
    if (rawIdx < 0) rawIdx = 0;
    if (rawIdx > 4) rawIdx = 4;
    // Invert so index 0 in counts = top bin (rawIdx 4).
    counts[4 - rawIdx]++;
  }

  const mean = n ? sum / n : null;
  const bins = BIN_DEFS.map((def, i) => ({ ...def, count: counts[i] }));

  return { n, mean, bins };
}

// ---------------------------------------------------------------------------
// confidenceDistribution
// ---------------------------------------------------------------------------

/**
 * confidenceDistribution({ projectId, now? }?, env?, home?) -> { n, mean, bins }
 *
 * Loads instincts for the given project (project-scoped + global), computes each
 * instinct's EFFECTIVE confidence at `now`, then delegates histogram math to
 * bucketEffective. Never mutates instinct objects.
 */
function confidenceDistribution({ projectId, now = Date.now() } = {}, env = process.env, home = os.homedir()) {
  const instincts = list({ projectId }, env, home);
  const effValues = instincts.map((inst) => effectiveConfidence(inst, now));
  return bucketEffective(effValues);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { fallbackRate, confidenceDistribution, bucketEffective };
