// recall — quality-gated instinct recall for session start (spec §6).
//
// Selects which instincts are strong enough to inject at session start by
// delegating the relevance + bar filter + best-first sort to `forProject`,
// then applying a soft ceiling that never silently truncates.
//
// API:
//   recall({ projectId, now?, bar?, ceiling? } = {}, env?, home?)
//     -> { injected: instinct[], truncatedNames: string[], total: number }
//
// Rule (spec §6 — quality-gated, NOT size-gated):
//   - Inject EVERY instinct that is relevant (this project + globals) AND at/above
//     the confidence bar (default 0.7). Staleness falls out automatically: a stale
//     instinct's effective confidence drifts below the bar via decay, so it is
//     excluded in the same step — no separate staleness check needed.
//   - If the strong set exceeds the ceiling, inject best-first up to the ceiling AND
//     return the names (ids) of the instincts that were left out (truncatedNames),
//     so the caller can emit a visible nudge to the user.
//
// Parameter resolution:
//   bar     : explicit arg → NXTLVL_CM_RECALL_BAR env var (finite float in (0,1]) → 0.7
//   ceiling : explicit arg → NXTLVL_CM_RECALL_CEILING env var (finite int >= 1) → 10

'use strict';

const { forProject } = require('./instincts.js');

const DEFAULT_BAR = 0.7;
const DEFAULT_CEILING = 10;

// resolveBar({ bar, env }) -> number
// Explicit arg wins; falls back to NXTLVL_CM_RECALL_BAR from env; then 0.7.
function resolveBar({ bar, env } = {}) {
  if (bar !== undefined && bar !== null) {
    const v = Number(bar);
    if (Number.isFinite(v) && v > 0 && v <= 1) return v;
  }
  const e = (env || process.env).NXTLVL_CM_RECALL_BAR;
  if (e !== undefined && e !== null && e !== '') {
    const v = parseFloat(e);
    if (Number.isFinite(v) && v > 0 && v <= 1) return v;
  }
  return DEFAULT_BAR;
}

// resolveCeiling({ ceiling, env }) -> number
// Explicit arg wins; falls back to NXTLVL_CM_RECALL_CEILING from env; then 10.
function resolveCeiling({ ceiling, env } = {}) {
  if (ceiling !== undefined && ceiling !== null) {
    const v = Number(ceiling);
    if (Number.isFinite(v) && Number.isInteger(v) && v >= 1) return v;
  }
  const e = (env || process.env).NXTLVL_CM_RECALL_CEILING;
  if (e !== undefined && e !== null && e !== '') {
    // Only accept a string that represents a pure integer (no decimal point).
    // parseInt('2.5') would return 2, which passes isInteger — guard against that.
    const v = parseInt(e, 10);
    if (Number.isFinite(v) && Number.isInteger(v) && v >= 1 && String(v) === String(e).trim()) return v;
  }
  return DEFAULT_CEILING;
}

// recall({ projectId, now?, bar?, ceiling? } = {}, env?, home?)
//   -> { injected: instinct[], truncatedNames: string[], total: number }
//
// `forProject` already performs relevance filtering (this project + globals),
// applies minConfidence, and sorts best-first. recall applies the soft ceiling.
function recall({ projectId, now, bar, ceiling } = {}, env, home) {
  const resolvedBar = resolveBar({ bar, env });
  const resolvedCeiling = resolveCeiling({ ceiling, env });
  const at = now !== undefined && now !== null ? now : Date.now();

  const strong = forProject(
    projectId,
    { minConfidence: resolvedBar, now: at },
    env,
    home,
  );

  const total = strong.length;

  if (total <= resolvedCeiling) {
    return { injected: strong, truncatedNames: [], total };
  }

  const injected = strong.slice(0, resolvedCeiling);
  const truncatedNames = strong.slice(resolvedCeiling).map((i) => i.id);
  return { injected, truncatedNames, total };
}

module.exports = { recall, resolveBar, resolveCeiling };
