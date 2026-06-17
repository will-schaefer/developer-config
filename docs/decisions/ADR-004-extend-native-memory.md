---
id: ADR-004
title: "Extend native Claude Code file-memory; build no new memory system"
status: Accepted
date: 2026-06-16
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
**Extend the native CC file-memory; introduce no new store.**
- Memory continues to live in the native `MEMORY.md` index + per-fact files.
- The Phase-0 delta is purely additive and small:
  1. a **global-vs-project layering convention** (what scope of fact lives where), and
  2. **surfacing** recent/relevant memory via the context-injection pointer
     ([ADR-007](ADR-007-context-budgeted-injection.md)).
- **Zero new storage code.** Cross-session recall uses the native mechanism unchanged.

This is the memory-specific application of the compose-don't-reconstruct rule
([ADR-003](ADR-003-compose-not-reconstruct.md)): the native store *is* the platform; I tailor
the policy around it, not the store itself.

## Alternatives Considered

### Build a custom memory store (DB / bespoke files / embeddings index)
- Pros: full control; a satisfying "reconstruction."
- Cons: a fourth overlapping system; duplicates native capability; ongoing maintenance;
  recall plumbing competes with native skill routing.
- Rejected: explicitly out of scope — "build a fourth memory system" is a stated Never.

### Vendor ecc's continuous-learning / observation-capture memory
- Pros: richer capture out of the box.
- Cons: heavyweight; pulls ecc machinery into the primary harness; the need is unproven.
- Rejected: deferred to backstop-only until the fallback log shows a repeat need
  ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).

## Consequences
- M3 is deliberately **near-zero-build**: a convention note + a recall proof, verified by a
  `git diff` showing no new storage code.
- A fact saved in one session is recalled in a fresh session via the native mechanism.
- Continuous-learning capture, governance/secrets capture, and the optimizer loop stay
  **deferred / backstop-only** until logged repeat-need un-defers them.
- The "learning artifact" for memory is the **layering + surfacing policy**, not a storage
  engine — mirroring the context-assembly stance ([ADR-007](ADR-007-context-budgeted-injection.md)).
