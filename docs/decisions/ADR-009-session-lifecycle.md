---
id: ADR-009
title: "nxtlvl-harness session lifecycle — automatic actions, human-invoked commands, and the open/close boundary"
status: Draft
date: 2026-06-28
---

# ADR-009: nxtlvl-harness session lifecycle — automatic actions, human-invoked commands, and the open/close boundary

## Context

A session has a shape: it opens, something happens during it, and it ends. The question
is what the harness does at each of those moments — automatically, without prompting,
versus what a human must explicitly invoke. ADR-003 establishes the production-quality
bar. ADR-007 (memory) and ADR-008 (context assembly) are upstream: session lifecycle
consumes their outputs at open and may write back to them at close. ADR-010 (the hook
layer) is downstream — whatever is decided here becomes the spec the hook layer
implements.

The right lifecycle is not obvious. Too much automation erodes agency and creates noise.
Too little means the harness adds no value at session boundaries. The right decomposition
starts from what the lifecycle actually needs to accomplish, not from what is technically
possible to automate.

### The questions

**1. What is the right boundary between automatic and human-invoked?**

Some actions clearly belong at session open — loading context assembled by ADR-008,
surfacing relevant memory from ADR-007. Others are clearly on-demand — pruning a store,
regenerating an index. But the middle is contested: should the harness automatically
summarize what happened? Automatically persist inferred patterns? Automatically prompt
the user to close the session cleanly? The boundary between the floor (what always
happens) and the ceiling (what can be invoked) is the central design question.

**2. Is there a "floor" — a set of always-on automatic actions — and what does it do?**

A floor would fire unconditionally at session open and/or close: load context, write a
summary, update a memory store. The case for a floor is consistency — sessions that end
cleanly without a human remembering to invoke anything. The case against is that
unconditional automation accumulates noise over time: low-signal summaries, redundant
writes, memory pollution. Whether a floor is warranted, and if so what it does, is open.

**3. Is there a "close ritual" — a human-invoked ceiling — or do sessions just end?**

A close ritual would be an explicit human-invoked command that runs a defined sequence
at session end: commit a summary, extract learnings, write back to memory, update a log.
The case for it is intentionality — the human signals that the session was meaningful and
worth preserving. The case against is friction: sessions often end abruptly, and a ritual
that requires human action will be skipped. Whether the harness should have a close
ritual, make it optional, or rely entirely on automatic actions is open.

**4. How does continuous learning fit into the lifecycle?**

ADR-007 opens the question of observer-inferred patterns — things the harness learns
across sessions without explicit human instruction. If that store exists, the lifecycle
must decide when and how it is written: automatically at session close (unconditional
floor), on-demand when the human judges a session worth learning from, or not at the
session level at all (written incrementally during the session instead). The wrong answer
here either floods the learning store with noise or fails to capture signal that
disappears when the session ends.

### What agents-wiki is being queried on

- What session lifecycle patterns do production agent harnesses use — do they define
  explicit open/close hooks, rely on platform-native session events, or leave lifecycle
  management to the human?
- How do production harnesses handle the automatic vs. human-invoked boundary — is there
  a standard split, or does it vary significantly by harness design?
- Do production harnesses have close rituals or session-end ceilings, and if so, what do
  they do — summarize, persist, both, neither?
- What does continuous learning look like in production harness lifecycles — is it wired
  into the session boundary, decoupled from it, or handled as a separate concern
  entirely?

## Decision

> **Pending** — querying agents-wiki on production session lifecycle patterns and the
> automatic vs. human-invoked boundary. Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
