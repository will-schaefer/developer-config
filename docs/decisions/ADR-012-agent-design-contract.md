---
id: ADR-012
title: "Agent design contract — agents, skills, and the orchestrator/specialist boundary"
status: Draft
date: 2026-06-28
---

# ADR-012: Agent design contract — agents, skills, and the orchestrator/specialist boundary

## Context

nxtlvl needs a clear model for what an agent is, what a skill is, and how the main
session should delegate to specialist agents. The build strategy is set by [ADR-003](ADR-003-compose-not-reconstruct.md).
The production bar is the standard: a contract that is tight enough to make agents
predictable and loose enough to let them adapt.

Agents and skills are both primitives in the harness, but the boundary between them
is not yet defined. Agents carry execution authority; skills hold reusable knowledge.
Where exactly that line falls — whether a specialist should embed domain rules or
point to them, whether a skill should ever invoke an agent, how the orchestrator
selects a specialist — is open. A weak boundary creates duplication and drift. An
overly rigid boundary makes the harness brittle.

### The questions

**1. What is the agent/skill boundary?**

Agents and skills are distinct CC primitives. The right boundary between them — what
belongs in an agent vs. a skill, how knowledge is held vs. executed, whether an agent
should carry domain rules or point to them — is open. The wrong boundary creates
duplication and drift.

**2. What does the agent contract look like?**

When the orchestrator delegates to a specialist, what is the contract? What does the
agent receive (input shape), what does it return (output shape), what are its stop
conditions, and what is its error-recovery contract? A weak contract means agents are
unpredictable; an overly rigid contract means they can't adapt.

**3. What is the operating model — orchestrator + specialists, or something else?**

The main session could be a lean orchestrator that delegates specialized work to
subagents, or it could do most work inline and only delegate when isolation is
required, or something in between. The right model depends on the workload and the
cost of delegation overhead.

**4. How does the roster grow and stay bounded?**

A specialist roster that grows without a brake re-explodes to breadth that exceeds the
workload. The right scoping mechanism — what makes a specialist worth building, what
keeps the roster bounded — is part of the design contract.

### What agents-wiki is being queried on

- How do production agent harnesses define the agent/skill boundary — what belongs in an
  agent vs. a skill, and how is domain knowledge held vs. executed?
- What agent contracts do production harnesses use — input shape, output shape, stop
  conditions, error-recovery — and how rigid vs. flexible are they?
- What operating models appear in production harnesses — lean orchestrator +
  specialists, inline with selective delegation, or something else — and what drives the
  choice?
- Any anti-patterns in agent design: agents that carry too much knowledge, contracts
  that are too rigid or too loose, rosters that grow uncontrolled?

## Decision

> **Pending** — querying agents-wiki on production agent design contract patterns.
> Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
