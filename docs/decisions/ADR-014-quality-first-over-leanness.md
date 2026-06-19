---
id: ADR-014
title: "Quality first — size and leanness are backstops, never the objective"
status: Accepted
date: 2026-06-19
amends: [ADR-007, ADR-008]
---

# ADR-014: Quality first — size and leanness are backstops, never the objective

## Context
Several harness decisions justify a choice by *size* or *leanness*: a token budget
([ADR-007](ADR-007-context-budgeted-injection.md)), a reactive-growth brake against re-expanding to
ecc scale ([ADR-008](ADR-008-reactive-growth-intake-gate.md)), a "lean" hook layer, a condensed
always-on block ([ADR-011](ADR-011-prose-quality-stop-slop.md)), a context-awareness design that
"got smaller." Read carelessly, "lean" reads as *small is the goal*. It is not. Every one of those
is a **quality** choice wearing a size label: over-injection dilutes attention; unproven machinery
adds maintenance and attention cost; firehosed capture buries signal in chaff. The objective was
always outcome quality; size was only ever the proxy.

This ADR makes that explicit and binding — so no future change cuts something *good* merely to hit a
number, and no future change cites "lean" to justify dropping proven value. ADRs are advisory on this
project (memory `adrs-advisory-not-canonical`); this is recorded as a governing principle, not a
binding contract, and the overrides it makes are recorded here rather than treated as breakage.

## Decision
Adopt one governing principle, harness-wide, recorded **verbatim** in the global rule layer
(`~/.claude/rules/quality-first.md`, read on demand) with a thin always-loaded trigger in
`~/.claude/CLAUDE.md` (a plain pointer, not an `@import` — the ADR-010 artifact shape):

> **QUALITY FIRST — never sacrifice quality for size or "leanness."**
>
> - Quality of outcome is the objective everywhere; size/leanness is only ever a backstop.
> - Never shrink or drop something RELEVANT, PROVEN, and QUALITY-IMPROVING to hit a size, token, or
>   "lean" target.
> - Cut only two things, for the right reasons:
>   - **NOISE** — irrelevant, stale, low-confidence, duplicative content. Cut because it HURTS
>     quality.
>   - **UNPROVEN SPECULATION** — machinery/breadth no real task has needed yet. DEFER because it's
>     unproven (and adds maintenance/attention cost), NOT because "small is good." Build it the
>     moment a real need proves out.
> - Size appears only as a soft backstop against attention-dilution; exceeding it triggers
>   **CONSOLIDATION** into a denser/higher-quality form (e.g. evolve instincts into a skill), not
>   truncation of good content.

Two guardrails keep the principle honest — it is **not** a license to inflate:

- **Reactive-growth / anti-bloat stays ([ADR-008](ADR-008-reactive-growth-intake-gate.md)),
  re-justified.** Don't re-expand to ecc-scale breadth — but because the breadth is **UNPROVEN**,
  not because "small is good." Build the moment a real need proves out.
- **No speculation, no firehose.** Quality-first never justifies building speculative breadth or
  firehosing context. Restraint *is* a quality move — over-injection is an observed quality failure
  ([ADR-007](ADR-007-context-budgeted-injection.md)).

Applied to the standing size mechanisms:

- A **token/line budget is a soft backstop**, not a hard cap. When a payload exceeds it, the first
  move is **consolidation/densification** (tighter pointers, fewer-but-higher-value entries); a block
  is dropped only when it is not earning its tokens (noise/stale), **never** a proven-valuable block
  purely to hit the number. "Justify its tokens or it's cut" already encodes this — the cut targets
  non-earners.
- **Cut order = lowest-value-first stays**, but it names *which noise sheds first*, not a mandate to
  shed proven value once the number is hit.

## Alternatives Considered

### Leave the framing as-is ("lean" everywhere)
- Pros: no churn; the authors already meant quality.
- Cons: "lean / minimal / ≤300 tokens" invites a future reader (human or agent) to cut proven value
  to hit a number — the exact failure the harness can't afford in its highest-leverage layer
  (context assembly).
- Rejected: the intent must be explicit, not inferred from tone.

### Drop size budgets entirely (pure quality, no number)
- Pros: removes any size-first temptation.
- Cons: throws away the genuine *attention-dilution* backstop; over-injection is a real, observed
  quality failure ([ADR-007](ADR-007-context-budgeted-injection.md)). A soft backstop is itself a
  quality tool.
- Rejected: keep the backstop; demote it from objective to backstop, and make exceeding it trigger
  consolidation, not truncation.

### Re-expand breadth now that "lean" isn't the goal
- Pros: more capability on the shelf.
- Cons: re-explodes to ecc scale; unproven machinery is pure maintenance/attention cost; this is the
  bloat the rebuild exists to escape.
- Rejected: anti-bloat stays — re-justified as *defer the unproven*, built on proven need
  ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).

## Consequences
- **Amends [ADR-007](ADR-007-context-budgeted-injection.md):** the ~300-token budget is reframed as a
  **soft attention-dilution backstop**; over-budget triggers densify/consolidate first and cuts only
  non-earning blocks. The lifetime-tier policy and pointers-over-content stand unchanged. (ADR-007
  stays Accepted, annotated `amended-by: ADR-014`.) The raise to ~400 in the C&M subsystem spec is
  consistent with this — that raise lifted the *backstop* to keep a proven 5th block, rather than
  dropping the block to fit the old number.
- **Reframes [ADR-008](ADR-008-reactive-growth-intake-gate.md):** the reactive/membership gate stays
  verbatim; its *reason* is restated as **defer the UNPROVEN** (maintenance/attention cost on
  unproven machinery), not "keep things small." Build on proven need. (ADR-008 stays Accepted,
  annotated `amended-by: ADR-014`.)
- **Reframes the [ADR-011](ADR-011-prose-quality-stop-slop.md) Face-B cap:** the condensed block's
  quality bar is **coverage of every core rule** (the floor); the ≤15-line figure is a soft
  densification target, not a license to drop a rule to hit the count.
- **Reads through, not rewrites, the anchor.** `docs/intent/personal-harness.md` is the fixed anchor
  (not edited); its "lean / minimal / budget / firehose" language is to be read through this
  principle. The spots are listed in the Follow-up below for separate confirmation.
- **Specs/plans inherit it.** The budget/cut-order language in `nxtlvl-phase-0-mvh.md`,
  `nxtlvl-phase-0-plan.md`, `nxtlvl-phase-0-handoff.md`, `nxtlvl-context-memory-subsystem.md`, and the
  "lean/smallest" framing in `context-awareness-hooks.md` and `nxtlvl-stop-slop-pipeline.md` carry a
  pointer here; the mechanisms (budgets, cut orders, the condensed block) are unchanged — only the
  *reason* is corrected to quality-first.
- **Audit tie-in** (future `nxtlvl:audit`, [ADR-009](ADR-009-objective-invoked-audit-gate.md)):
  "size within backstop" is at most a **warning**, never a blocker; a gate may never encode "smaller
  is better" — the mirror of ADR-009's rejection of "more is better." Quality/coverage is the bar.
- **Global-layer record.** Like [ADR-010](ADR-010-global-decision-rule.md) and
  [ADR-011](ADR-011-prose-quality-stop-slop.md), the rule lives in the global `~/.claude/` layer (not
  plugin-promoted, not version-controlled by this repo); this ADR is the repo's durable record and
  carries the verbatim text to mirror into the daily driver.

## Follow-up (personal-harness.md read-through — confirm separately)
The anchor is **not** edited. Read these spots through ADR-014 (size = backstop, not goal) and
confirm each reading:

- **L9, L71–80** — "ecc = dormant reference + backstop"; "keeps its 271 skills / 67 agents out of my
  namespace and context" → defer-the-unproven + attention discipline, not "small."
- **L38, L59–60, L133** — "a lean hook layer"; "Hooks … lean" → narrow because broader hooks are
  unproven/unearned (and must stay fail-open), not small-for-small's-sake.
- **L64–69** — "a whitelist, not 'full'"; "Deferred / backstop-only until the fallback log proves
  repeat-need"; "Core machinery first; scale machinery reactively" → defer-the-unproven (already
  aligned; reason confirmed).
- **L152–162** — "a budgeted injection policy (not a firehose)"; "every auto-injected block justifies
  its tokens or it's cut; prefer pointers" → soft backstop + cut-noise + consolidate; over-injection
  is the quality failure the budget guards against.
- **L202** — "what keep `nxtlvl` from re-exploding to ecc scale" → defer-the-unproven.
- **L207** — "The 'lean 3-rule veneer' framing — dropped." → already a rejection of lean-as-aesthetic;
  consistent with this principle.
