---
id: ADR-007
title: "nxtlvl-harness memory architecture — stores, ownership, and provenance"
status: Draft
date: 2026-07-28
---

# ADR-007: nxtlvl-harness memory architecture — stores, ownership, and provenance

## Context

The harness needs durable, evolving memory across sessions. What "memory" means, how
many stores there should be, who owns each, and what rules govern writes are all open
questions. ADR-003 establishes that everything is built from scratch and that the
production bar is the standard — not convenience, not what was built in prior
exploration.

Claude Code natively provides a file-based memory (`MEMORY.md` + per-fact files under
`~/.claude/projects/`). That is one option. Other options exist — a purpose-built
instinct store for observer-learned patterns, embeddings-based retrieval, a database,
or some combination. The right answer is not obvious and depends on what the harness
actually needs memory to do.

### The questions

**1. What does the harness need memory for?**

Memory serves different purposes: recalling explicit facts the user has saved,
persisting patterns the observer has inferred across sessions, surfacing relevant
context at session start. These may or may not warrant separate stores. The right
decomposition starts from the use cases, not from the available storage mechanisms.

**2. How many stores, and what owns each?**

One store with clear provenance rules, two stores split by write source, or something
else? The ownership boundary — what writes to what, and when — determines whether
stores can stay coherent over time without active maintenance. A wrong boundary
creates overlapping stores, unclear ownership, and rot.

**3. What are the physical constraints?**

CC's sensitive-path guard blocks background subprocess writes inside `~/.claude`.
Any store written by a background process must live outside that path. Whether that
constraint argues for one store or two, and where each lives, is part of the decision.

**4. What does production-quality memory look like?**

The archived decision (ADR-004) was made before the build strategy was fully
articulated. The current standard — ADR-003's production-quality bar, informed by
agents-wiki — may point to a different answer. This is what agents-wiki is being
queried on.

### What agents-wiki is being queried on

- What memory architectures do production agent harnesses use — native platform
  memory, purpose-built stores, embeddings, or combinations?
- How do production harnesses handle the distinction between explicitly-saved facts
  and observer-inferred patterns — separate stores, separate fields, or no distinction?
- What ownership and provenance rules govern memory writes in production harnesses?
- Any anti-patterns: stores that drift, ownership boundaries that collapse, memory
  that degrades quality rather than improving it?

## Decision

> **Pending** — querying agents-wiki on production memory architecture patterns.
> Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
