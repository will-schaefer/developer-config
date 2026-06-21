// evolve — deterministic instinct clustering engine for /evolve (Task 5.4a).
// Reads the instinct store via instincts.list, applies the strong-bar filter,
// normalizes triggers, clusters strong instincts, classifies each cluster into
// exactly one type (agent|skill|command) and returns the sorted candidate set.
//
// NO LLM, NO file writes. Pure + deterministic — all confidence math uses
// effectiveConfidence at the caller-supplied `now`.
//
// Adopted from ecc's `instinct-cli.py cmd_evolve` with three deliberate
// adaptations:
//   ADAPTATION 1 — strong-bar filter (ecc computed the set but never filtered).
//   ADAPTATION 2 — partition into exactly one type (ecc overlapped types).
//   ADAPTATION 3 — total sort order (ecc's (-size,-avg) left tie order to dict).

'use strict';

const { list, effectiveConfidence } = require('./instincts.js');

const DEFAULT_STRONG_BAR = 0.8;

// --- normalizeTrigger ---------------------------------------------------------
// Adopt ecc verbatim: lowercase → strip each keyword in order via substring
// removal → collapse internal whitespace runs → trim.
const STRIP_KEYWORDS = [
  'when',
  'creating',
  'writing',
  'adding',
  'implementing',
  'testing',
];

function normalizeTrigger(trigger) {
  if (trigger === undefined || trigger === null) return '';
  let key = String(trigger).toLowerCase();
  for (const kw of STRIP_KEYWORDS) {
    key = key.split(kw).join('').trim();
  }
  // Collapse runs of internal whitespace to a single space, then trim.
  key = key.replace(/\s+/g, ' ').trim();
  return key;
}

// --- evolve -------------------------------------------------------------------
// evolve({ projectId, now?, strongBar? } = {}, env?, home?)
//   -> { candidates: Candidate[], considered: number, total: number }
//
// Candidate = {
//   type: "agent" | "skill" | "command",
//   triggerKey: string,
//   instinctIds: string[],  // sorted ascending
//   size: number,
//   avgConfidence: number,  // mean EFFECTIVE confidence at `now`
//   domains: string[],      // distinct, sorted ascending
// }
function evolve({ projectId, now, strongBar } = {}, env, home) {
  const at = now !== undefined && now !== null ? now : Date.now();
  const bar = strongBar !== undefined && strongBar !== null ? strongBar : DEFAULT_STRONG_BAR;

  // Step 1: load all instincts for the project (project + global).
  const all = list({ projectId }, env, home);
  const total = all.length;

  // Step 2: strong filter (ADAPTATION 1).
  const strong = all.filter((inst) => effectiveConfidence(inst, at) >= bar);
  const considered = strong.length;

  // Step 3: normalize trigger and cluster.
  const clusters = new Map(); // triggerKey -> instinct[]
  for (const inst of strong) {
    const key = normalizeTrigger(inst.trigger);
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(inst);
  }

  // Step 4: classify each cluster into exactly one type (ADAPTATION 2 — partition).
  const candidates = [];
  for (const [triggerKey, members] of clusters) {
    const size = members.length;
    const effConfs = members.map((m) => effectiveConfidence(m, at));
    const avgConfidence = effConfs.reduce((sum, v) => sum + v, 0) / size;

    let type;
    if (size >= 3 && avgConfidence >= 0.75) {
      type = 'agent';
    } else if (size >= 2) {
      type = 'skill';
    } else if (size === 1 && members[0].domain === 'workflow') {
      type = 'command';
    } else {
      // Singleton non-workflow: not a candidate.
      continue;
    }

    // instinctIds sorted ascending for determinism; domains distinct + sorted ascending.
    const instinctIds = members.map((m) => m.id).sort();
    const domains = [...new Set(members.map((m) => m.domain).filter(Boolean))].sort();

    candidates.push({ type, triggerKey, instinctIds, size, avgConfidence, domains });
  }

  // Step 5: deterministic total ordering (ADAPTATION 3).
  // (a) type rank: agent=0 < skill=1 < command=2
  // (b) -size (larger first)
  // (c) -avgConfidence (higher first)
  // (d) triggerKey ascending (final tiebreak)
  const typeRank = { agent: 0, skill: 1, command: 2 };
  candidates.sort((a, b) => {
    const rankDiff = typeRank[a.type] - typeRank[b.type];
    if (rankDiff !== 0) return rankDiff;
    const sizeDiff = b.size - a.size;
    if (sizeDiff !== 0) return sizeDiff;
    const confDiff = b.avgConfidence - a.avgConfidence;
    if (confDiff !== 0) return confDiff;
    return a.triggerKey < b.triggerKey ? -1 : a.triggerKey > b.triggerKey ? 1 : 0;
  });

  return { candidates, considered, total };
}

module.exports = { evolve, normalizeTrigger };
