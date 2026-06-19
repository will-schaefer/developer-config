---
id: ADR-004
title: "Extend native Claude Code file-memory; build no new memory system"
status: Accepted
date: 2026-06-16
amended: 2026-06-19
---

# ADR-004: Extend native Claude Code file-memory; build no new memory system

## Context
The harness needs durable, evolving memory across sessions. Claude Code **already provides**
a file-based memory: `~/.claude/projects/<proj>/memory/` with a `MEMORY.md` index plus
per-fact files carrying frontmatter. ecc additionally ships a heavier continuous-learning /
observation-capture memory.

The temptation in a "reconstruct the plumbing" project is to build memory from scratch as a
showcase. That would create a **fourth memory system** (native CC + ecc's + a new one + the
context layer) — overlapping stores, unclear ownership, and rot.

## Decision
**Extend the native CC file-memory; introduce no new store** — *with one amendment (2026-06-19):
a separate `nxtlvl` instinct store, located outside `~/.claude`, is adopted for
observer-learned instincts. Native file-memory is still extended for human-saved ("remember
this") lessons.*

- Memory continues to live in the native `MEMORY.md` index + per-fact files.
- The Phase-0 delta is purely additive and small:
  1. a **global-vs-project layering convention** (what scope of fact lives where), and
  2. **surfacing** recent/relevant memory via the context-injection pointer
     ([ADR-007](ADR-007-context-budgeted-injection.md)).
- **Zero new storage code for human-saved lessons.** Cross-session recall of `MEMORY.md`-backed
  facts uses the native mechanism unchanged.
- **Amendment:** the context-and-memory spec (2026-06-19) adopts ecc's continuous-learning model
  ([ADR-013](ADR-013-floor-on-demand-backbone.md)). Observer-learned instincts live in a
  **separate `nxtlvl` instinct store outside `~/.claude`** — required because a background
  subprocess writes to it and Claude Code's sensitive-path guard blocks writes inside `~/.claude`
  from background processes. Exact paths are a `/plan` detail; the only binding constraint is
  *outside `~/.claude`* for anything a background process writes.

**Two "lesson" homes coexist:**
- **Native memory** — things *you* explicitly save ("remember this"). Governed as before.
- **Instinct store** — things the observer *learns* automatically (confidence-scored, project +
  global scope). New, from this amendment.

Coherent for now; an explicit ownership rule is needed only if the two stores begin to overlap.
That is tracked, not built.

This remains the memory-specific application of the compose-don't-reconstruct rule
([ADR-003](ADR-003-compose-not-reconstruct.md)): the native store *is* the platform for
human-saved lessons; the instinct store extends the platform for observer-learned ones rather
than replacing it.

## Alternatives Considered

### Build a custom memory store (DB / bespoke files / embeddings index)
- Pros: full control; a satisfying "reconstruction."
- Cons: a fourth overlapping system; duplicates native capability; ongoing maintenance;
  recall plumbing competes with native skill routing.
- Rejected: explicitly out of scope — "build a fourth memory system" is a stated Never.

### Vendor ecc's continuous-learning / observation-capture memory
- Pros: richer capture out of the box.
- Cons: heavyweight; pulls ecc machinery into the primary harness; the need is unproven.
- Rejected at original decision date: deferred to backstop-only until the fallback log shows a
  repeat need ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).
- *Amendment note:* continuous-learning is now un-deferred and adopted (see
  [ADR-013](ADR-013-floor-on-demand-backbone.md), which supersedes ADR-008's deferral). The
  instinct store is the adopted form of ecc's observation-capture memory, simplified
  (one-shot Haiku observer, no PID/lock/daemon machinery).

### Keep everything inside `~/.claude`
- Pros: single tree; simpler path management.
- Cons: Claude Code's sensitive-path guard blocks background subprocess writes inside
  `~/.claude`; the one-shot observer would fail silently on every run.
- Rejected: outside `~/.claude` is the only viable location for background-written files.

## Consequences
- Human-saved lessons remain near-zero-build: a convention note + a recall proof, no new
  storage code.
- A fact saved in one session is recalled in a fresh session via the native mechanism.
- Observer-learned instincts accumulate in the separate instinct store and are quality-gated
  into context per [ADR-007](ADR-007-context-budgeted-injection.md) (amended).
- **Two lesson homes coexist** — this is the standing consequence to monitor. If the two stores
  begin to serve overlapping content, the next decision is an ownership rule; until then,
  separation by provenance (human-saved vs observer-learned) is clear enough.
- The "learning artifact" for memory is the **layering + surfacing policy**, not a storage
  engine — mirroring the context-assembly stance ([ADR-007](ADR-007-context-budgeted-injection.md)).
