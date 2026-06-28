---
id: ADR-016
title: "nxtlvl orchestration model — composition layer, delegation contract, and human gates"
status: Draft
date: 2026-06-28
---

# ADR-016: nxtlvl orchestration model — composition layer, delegation contract, and human gates

## Context

The harness needs a clear model for how the main session coordinates work across agents.
That means deciding what lives in the composition layer that nxtlvl owns, what is delegated
to specialists, and what stays native to Claude Code's dispatch runtime. The shape of the
orchestrator, the delegation contract, and the placement of human gates are all open.

[ADR-003](ADR-003-compose-not-reconstruct.md) makes the dispatch runtime native and forbids
reconstructing it. [ADR-012](ADR-012-agent-design-contract.md) defines the agent/skill
boundary, which affects how a specialist is briefed and what it loads.

### The questions

**1. What is the composition layer?**

The composition layer is what nxtlvl owns above the native dispatch runtime: which specialists
exist, when to delegate, how to brief a delegate, how to synthesize results. What that layer
concretely looks like — a pipeline, a set of patterns, a skill, a command — is open. The wrong
answer either reconstructs the runtime (forbidden by ADR-003) or leaves the composition so thin
it adds no value.

**2. What is the delegation contract?**

When the orchestrator delegates to a specialist, what does the brief look like? How are
acceptance criteria passed, how is scope bounded, how is context shared without polluting the
orchestrator's window? The delegation contract is the load-bearing interface between
orchestrator and specialist.

**3. How are human gates placed?**

Some phases of a pipeline warrant a human stop-and-ask before proceeding — after a plan is
drafted, before a commit is made. Where those gates sit, what triggers them, and how many is
too many is open. Too few gates means unreviewed work lands; too many means the orchestration
adds friction without trust.

**4. What is the boundary between composition and reconstruction?**

Building a tag-to-chain lookup table, a sequential chain-runner, or a Kanban control pane
would be reconstructing the dispatch runtime — forbidden by ADR-003. Building a pipeline that
delegates each phase to a specialist using native CC tools is composition. Where exactly the
line sits between these is not always obvious and needs a clear articulation.

### What agents-wiki is being queried on

- What composition layer patterns do production agent harnesses use above native dispatch —
  pipelines, delegation patterns, briefing conventions — and how are they structured?
- How do production harnesses design delegation contracts between orchestrators and specialists —
  what is passed, how is scope bounded, how is context shared?
- Where do production harnesses place human gates in orchestration pipelines, and what is the
  typical gate count and placement?
- Any anti-patterns in orchestration: composition that slides into runtime reconstruction,
  delegation briefs that are too thin or too heavy, pipelines with too many or too few human
  gates?

## Decision

> **Pending** — querying agents-wiki on production orchestration patterns.
> Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
