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
- **Learned / evolving facts → native memory**
  ([ADR-004](ADR-004-extend-native-memory.md)).
- **Per-session dynamic context → a lean `SessionStart` hook** — git branch + dirty flag, a
  current-task **pointer**, and the last *N* fallback-log entries.
- **Per-prompt relevance → native skill routing.** No hand-built retriever — that is the
  orchestration anti-goal ([ADR-003](ADR-003-compose-not-reconstruct.md)).

**Hard rules:**
- Every auto-injected block **justifies its tokens or it is cut** (the cut targets non-earners —
  noise/stale/low-confidence — not proven value; [ADR-014](ADR-014-quality-first-over-leanness.md)).
- **Prefer pointers over content** — `"task X in progress → read docs/intent/…"`, never the
  file's contents.
- Concrete Phase-0 budget: **≤ ~300 tokens (~20 lines)** — a **soft attention-dilution backstop, not
  a hard cap** ([ADR-014](ADR-014-quality-first-over-leanness.md)). When a payload exceeds it,
  **densify/consolidate first** (tighter pointers, fewer-but-higher-value entries); drop a block only
  when it isn't earning its tokens. Cut order **fallback-digest → task-pointer → git-line** names
  which *low-value* block sheds first — it never sheds a proven-valuable block just to hit the number.

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

## Consequences
- The `SessionStart` hook (`session-context.sh`, M4) emits a **bounded pointer block** and is
  fail-open ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)) — never halts a session.
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
