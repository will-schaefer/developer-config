---
id: ADR-005
title: "Measure success with a hook-written fallback log and a dual fallback-rate × quality metric"
status: Accepted
date: 2026-06-16
amended: 2026-06-19
---

# ADR-005: Measure success with a hook-written fallback log and a dual fallback-rate × quality metric

## Context
`nxtlvl` needs a success metric that answers one question: **is the harness actually covering
my work, or am I still leaning on `ecc`?** Whatever the metric is, it must be:
- **Measurable without willpower** — manual logging rots within a week.
- **Resistant to gaming** — a single number invites optimizing the number, not the work.
- **Honest about the goal** — zero ecc usage would mean either rebuilding all of ecc (a
  non-goal) or white-knuckling past real gaps.

ecc being dormant ([ADR-002](ADR-002-ecc-dormant-reference-backstop.md)) makes every reach
for it a discrete, detectable event — the raw material for the metric.

## Decision
**North star = fallback-rate by session** — the share of sessions where I reached for ecc,
**trending down and plateauing low**. Not "audit-delta."

Mechanism — a **hook-written log**, the first piece of self-built machinery:
- A `PreToolUse` hook matching `Skill|Task|Agent` inspects the invoked name and appends
  **one JSONL line** (`{timestamp, ecc_thing, task}`) to a **global**
  `~/.claude/nxtlvl/fallback-log.jsonl` whenever an `ecc:`-prefixed thing fires. Non-ecc
  invocations append nothing.
- The log is **global**, not project-local: the north star spans *all* work and must survive
  reinstall and capture non-repo sessions.

**Dual metric (anti-gaming):** pair fallback-rate with a lightweight **session-end quality
check** (1–5 / "did I have to redo this"). Falling fallback-rate *while quality holds* = real
progress; quality dropping = white-knuckling a real gap. The rot-prone fields are auto-written
by a fail-open `SessionEnd` hook (`{timestamp, session_id, ecc_fallback_count}` →
`~/.claude/nxtlvl/sessions.jsonl`); **only the single `quality` field is appended by hand.**

**Target a low plateau, not 0%** — a small steady fallback-rate means ecc still earns its
shelf space for genuine edge cases.

**Amendment (2026-06-19):** The session-level quality score is retired. The dual metric
becomes **two separate, fully-automatic readouts**:

1. **fallback-rate** — reliability (share of sessions reaching for ecc), counted from the
   fallback log as before.
2. **instinct-confidence distribution** — learning quality, carried per-instinct by the
   observer-written instinct store ([ADR-013](ADR-013-floor-on-demand-backbone.md)).

**No whole-session quality score** — not human-rated, not inferred. The grounding: ecc has no
session quality rating. Its `Stop`-hook `evaluate-session.js` counts user messages only as a
size gate (≥10 messages), never a score. Where ecc does attach quality, it does so
per-artifact at save time (per-instinct confidence; the `learn-eval` / `agent-evaluator` /
`agent-self-evaluation` skills). A session-level quality number would be novel instrumentation
ecc doesn't have and the spec doesn't need; quality attaches to the saved instincts, not to
sessions.

The anti-gaming intent of the original dual metric is preserved: falling fallback-rate *while
instinct confidence is healthy* still distinguishes "real progress" from "white-knuckling."

## Alternatives Considered

### Manual fallback log
- Pros: zero hook code.
- Cons: rots within a week; unreliable signal.
- Rejected: defeats the metric. Only *one* number (quality) is allowed to be manual.
  *(Amendment: the manual quality field is now retired entirely, so this rejected alternative
  is no longer a partial temptation.)*

### "Audit-delta" as the north star
- Pros: ties to the audit gate.
- Cons: measures the harness against itself, not against my actual reliance on ecc.
- Rejected: the question is coverage-of-my-work, which fallback-rate answers directly.

### Single metric (fallback-rate alone)
- Pros: simplest.
- Cons: gameable — I could suppress ecc usage while quality silently drops.
- Rejected originally: the dual metric is the anti-gaming guard.
  *(Amendment: the second readout is now instinct-confidence distribution, not session quality,
  preserving the anti-gaming structure while removing the session-scoring burden.)*

### Project-local log
- Pros: scoped per repo.
- Cons: fragments the signal; misses non-repo sessions; lost on reinstall.
- Rejected: a global log captures every session and survives reinstall.

### Whole-session quality score (human-rated or auto-inferred) — amendment-era rejection
- Pros: single comparable number per session.
- Cons: ecc has no session quality rating and never auto-infers one; the `evaluate-session.js`
  Stop hook is a size gate, not a scorer. Attaching a score to the session rather than to saved
  artifacts contradicts the ecc model the spec adopts. A human-rated field requires willpower
  (rots); an inferred score adds a model call with no grounding from ecc or the spec.
- Rejected: quality attaches per-artifact (per-instinct confidence), at save time.

## Consequences
- The fallback log is **load-bearing three ways**: it powers the metric, it *is* the reactive
  catalog backlog, and it is the un-defer trigger ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).
- The hook must be absolutely fail-open ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)).
- The exact stdin field carrying the invoked name was a gated risk, resolved by the M0 spike
  (2026-06-17): `Skill` → `tool_input.skill`; `Agent`/subagent → `tool_input.subagent_type`;
  branch on which field is present, not on `tool_name`; append iff the value starts with `ecc:`.
- The dual metric is computable from the very first session.
- **Amendment consequence:** the `sessions.jsonl` schema no longer needs a `quality` field; the
  `SessionEnd` hook is fully automatic with no hand-entry step. The instinct-confidence
  distribution is already written per-instinct by the observer — no additional instrumentation
  required.
