---
id: ADR-007
title: "Context assembly as a budgeted injection policy — pointers over content, organized by lifetime"
status: Accepted
date: 2026-06-16
amended-by: ADR-014
---

# ADR-007: Context assembly as a budgeted injection policy — pointers over content, organized by lifetime

> **Amended by [ADR-014](ADR-014-quality-first-over-leanness.md) (2026-06-19):** the token budget is
> a **soft attention-dilution backstop, not a hard cap**. Over budget → densify/consolidate first;
> drop a block only when it isn't earning its tokens (noise/stale), never a proven-valuable block to
> hit the number. The lifetime tiers and pointers-over-content stand unchanged.

## Context
Context assembly is named in the intent as the harness's **highest daily leverage** content —
"*is* the harness's job." It is also the easiest thing to get wrong: **over-injection
degrades quality.** Dumping a stale prior-session summary, or firehosing every durable fact
into every prompt, spends the model's attention on noise.

So the real artifact is not the plumbing that injects context — it is the **policy** that
decides what earns a slot in the model's attention.

## Decision
Treat context assembly as a **budgeted injection policy**, organized **by lifetime of the
information** rather than by a single dumping mechanism:

- **Durable facts / conventions → `CLAUDE.md`** (global vs project layers).
- **Learned / evolving facts → native memory** ([ADR-004](ADR-004-extend-native-memory.md))
  and the instinct store ([ADR-013](ADR-013-floor-on-demand-backbone.md)).
- **Per-session dynamic context → a lean `SessionStart` hook** — git branch + dirty flag, the
  current bookmark, and quality-gated instincts.
- **Per-prompt relevance → native skill routing.** No hand-built retriever — that is the
  orchestration anti-goal ([ADR-003](ADR-003-compose-not-reconstruct.md)).

**Hard rules:**
- Every auto-injected block **justifies its tokens or it is cut** (the cut targets non-earners —
  noise/stale/low-confidence — not proven value; [ADR-014](ADR-014-quality-first-over-leanness.md)).
- **Prefer pointers over content** — `"task X in progress → read docs/intent/…"`, never the
  file's contents. *Exception: the bookmark is injected as actual words* (it is already a tiny
  summary; a pointer would be as long as the note itself).
- Concrete Phase-0 budget: **≤ ~300 tokens (~20 lines)** — a **soft attention-dilution backstop, not
  a hard cap** ([ADR-014](ADR-014-quality-first-over-leanness.md)). When a payload exceeds it,
  **densify/consolidate first** (tighter pointers, fewer-but-higher-value entries); drop a block only
  when it isn't earning its tokens. Cut order **fallback-digest → task-pointer → git-line** names
  which *low-value* block sheds first — it never sheds a proven-valuable block just to hit the number.

**Amendment (2026-06-19) — recall is quality-gated, not size-gated:**

The original decision used a size budget as the primary gate. The context-and-memory spec
(2026-06-19) refines this to a **quality-first** recall rule for the instinct block:

- Inject **every** instinct that is (a) **relevant** — this project's instincts plus global —
  and (b) at/above the **confidence bar** (default ≥0.7 "strong", tunable; distinct from the
  ≥0.8 global-promotion bar), ordered **best-first**.
- Cut low-confidence / off-project / stale instincts as noise. Staleness is handled
  automatically by confidence decay drifting below the bar — no explicit staleness field needed.
- The **size ceiling is a soft backstop only, never silent truncation.** When strong instincts
  exceed the ceiling, inject best-first up to the ceiling *and* emit a visible nudge:
  *"N more above the bar — `/evolve` to consolidate."* Repeated breaches are the signal to
  consolidate accumulated instincts into a skill via `/evolve`.

The pointers-over-content rule is unchanged for all content except the bookmark. The size
budget remains the backstop for the total briefing block.

## Alternatives Considered

### Firehose (inject everything that might be relevant)
- Pros: nothing is ever missing.
- Cons: over-injection measurably degrades quality; stale summaries actively mislead.
- Rejected: the explicit failure mode this policy exists to prevent.

### Hand-built per-prompt retriever
- Pros: precise per-prompt relevance.
- Cons: reconstructs orchestration (context-window assembly / routing) — a stated Never.
- Rejected: native skill routing already does this below the plugin boundary.

### No structured policy (ad hoc injection per hook)
- Pros: less up-front design.
- Cons: no token discipline; blocks accrete and never get cut; the leverage is lost.
- Rejected: the lifetime tiers + budget *are* the deliverable.

### Size-first truncation for instincts — amendment-era rejection
- Pros: simple; budget never exceeded.
- Cons: silently drops high-confidence instincts that earned their slot; no signal to the user
  that relevant learnings were cut. Contradicts the goal of recall being the harness's highest
  daily leverage.
- Rejected: quality gates, with a nudge when the ceiling is breached, preserves the token
  discipline without silently discarding signal.

### Pointer to bookmark (instead of actual words) — amendment-era rejection
- Pros: consistent with pointers-over-content everywhere else.
- Cons: a bookmark note is already a tiny distillation (a few lines). A pointer to the file
  would be roughly as long as the note itself, adding a read step with no token savings.
- Rejected: the exception is narrow and justified by the note's size. The rule stands for all
  other content.

## Consequences
- The `SessionStart` hook (briefing) emits a **bounded pointer block** and is fail-open
  ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)) — never halts a session.
- Memory layering ([ADR-004](ADR-004-extend-native-memory.md)) is *surfaced through* this
  policy's per-session pointer, not duplicated.
- The fallback-log digest keeps the reactive backlog visible at session start, linking this
  policy to the metric ([ADR-005](ADR-005-fallback-log-dual-metric.md)) and the growth gate
  ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).
- The learning artifact is the **policy**, evaluated by whether each block earns its tokens —
  not the injection plumbing.
- The budget is a quality backstop, not a target: when good content exceeds it, the move is
  consolidation into a denser form, never truncation of proven value
  ([ADR-014](ADR-014-quality-first-over-leanness.md)).
- **Amendment consequence:** the instinct block's slot in the briefing is earned by quality
  (confidence ≥0.7), not by position. The ceiling is a soft backstop that *triggers a nudge*
  rather than silently truncating. This makes the briefing reactive to how much has been learned:
  a sparse instinct store injects nothing; a rich one injects all strong instincts up to the
  ceiling and nudges toward `/evolve` when it overflows.
