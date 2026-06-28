---
id: ADR-008
title: "nxtlvl-harness context assembly — injection policy, organization, and budget"
status: Draft
date: 2026-06-28
---

# ADR-008: nxtlvl-harness context assembly — injection policy, organization, and budget

## Context

Context assembly is what the harness actually does at the moment of highest leverage: deciding
what gets surfaced into the model's attention window at session start and as a session unfolds.
ADR-007 decides what memory holds; this ADR decides what gets promoted from memory into context,
when, and how. ADR-003 establishes the production-quality bar — the design here starts from what
production harnesses do, not from what is convenient or obvious.

The core tension is that the model's attention window is finite and degradable. Injecting too
much dilutes signal and can actively harm response quality. Injecting too little leaves leverage
on the table — the harness's reason for existing. The right injection policy is the harness's
primary job, and it is not yet defined.

### The questions

**1. What earns a slot in the model's attention window?**

Not everything in memory belongs in context. The injection policy needs a theory of relevance:
what criteria determine whether a piece of memory gets surfaced for a given session or prompt?
Recency, explicit user priority, inferred salience, task-type match — these are candidates, but
the right policy may be a combination, or something else entirely. The question is what the
policy should optimize for, and whether that optimization differs at session start versus during
a session.

**2. How should injected context be organized by information lifetime?**

Memory spans a wide range of lifetimes: durable facts the user has explicitly saved, patterns
the observer has learned across many sessions, working context accumulated within the current
session, and highly local relevance that applies only to the current prompt. These may warrant
different injection strategies — some injected once at session start, some refreshed
periodically, some retrieved on demand. Whether to organize injection around these lifetime
tiers, and how to draw the boundaries, is open.

**3. What is the right budget, and what happens when it is exceeded?**

A ceiling on injected context may be necessary to protect response quality. Whether that ceiling
is a fixed token count, a fraction of the model's context window, a ranked list with a hard
cutoff, or something else is undecided. Equally important: the eviction or ranking policy that
determines what gets dropped when the budget is exceeded. A bad eviction policy can silently
discard exactly the context that would have mattered.

**4. What does production-quality context assembly look like?**

ADR-003's production bar, informed by agents-wiki and the reference harnesses, points to
patterns and constraints that are not obvious from first principles. This is what agents-wiki is
being queried on.

### What agents-wiki is being queried on

- What injection policies do production agent harnesses use — what criteria determine what gets
  surfaced into the attention window, and does the policy differ at session start versus
  mid-session?
- How do production harnesses handle the over-injection problem — is there an explicit budget,
  a ranking and eviction strategy, or a quality-based gate?
- How do production harnesses organize context by information lifetime or relevance tier —
  durable facts, learned patterns, session-accumulated context, per-prompt retrieval?
- Any anti-patterns: injection policies that degrade quality, budgets that are set wrong,
  lifetime-tier boundaries that collapse, or retrieval strategies that miss the most relevant
  material?

## Decision

> **Pending** — querying agents-wiki on production context assembly and injection policy patterns.
> Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
