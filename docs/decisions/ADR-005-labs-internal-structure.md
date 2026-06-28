---
id: ADR-005
title: "nxtlvl-labs internal structure — layers, runtime contracts, and language"
status: Draft
date: 2026-07-28
---

# ADR-005: nxtlvl-labs internal structure — layers, runtime contracts, and language

## Context

ADR-001 establishes `nxtlvl-labs` as an independent plugin — a domain-agnostic multi-agent
team engine that collaborates with the user to design, draft, test, evaluate, and deliver
production-quality agent teams. ADR-003 establishes that everything is built from scratch.
Neither records what the plugin actually contains, how its internal layers should be
structured, what each layer's runtime contract is, or what language and tooling the
executable layers should use.

`nxtlvl-labs` has a distinct identity from the harness: it is not a daily-driver plugin
loaded into every session — it is a purposeful environment the user enters to build and
evaluate agent teams. That difference in identity likely implies a different internal
structure than `nxtlvl-harness`. What that structure should be is an open question.

ADR-001 describes two internal subprojects from prior exploration:
- `harness-lab` — a capability incubation pipeline (cells, stage manifests, graduation gate)
- `evals-lab` — a measurement engine (`eval spec → engine → scorecard`)

These represent prior thinking, not binding structure. The right decomposition — whether
two subprojects, one, or something else entirely — is part of what this ADR decides.

### The questions

**1. What does `nxtlvl-labs` actually contain?**

The plugin's identity — a team engine that takes a request and delivers a production-quality
agent team — implies some combination of: a user-facing interaction layer, an incubation
pipeline for building components, an evaluation engine for measuring quality, and a
CC plugin layer (skills, agents, commands) for the session interface. How these divide
across layers, subprojects, or processes is open.

**2. What are the runtime contracts?**

Unlike the harness, `nxtlvl-labs` is not primarily hook-driven. Its execution model —
CLI tools, long-running processes, CC plugin layer, standalone Node subprojects — needs
to be defined. Each execution model carries different constraints on language, build
tooling, dependencies, and startup cost.

**3. What language and build tooling?**

Language and build tooling follow from the runtime contracts. A CC plugin layer has the
same constraints as `nxtlvl-harness` (ADR-004). A standalone Node subproject with its own
`package.json` can use a build step. The question needs to be answered per layer once
the layers are defined — not globally.

**4. What is the boundary between labs and harness?**

ADR-001 establishes that graduated cells cross-publish into `nxtlvl-harness`. The
mechanics of that boundary — what format, what contract, what tooling — are part of
this ADR's scope.

### What agents-wiki is being queried on

- How do production harnesses structure their incubation and evaluation machinery — as
  CC plugin layers, standalone subprojects, CLI tools, or something else?
- What runtime contracts and language choices appear in evaluation engines and
  capability incubation pipelines?
- Any patterns for the boundary between a labs/experimental environment and a
  daily-driver plugin?

## Decision

> **Pending** — querying agents-wiki on production harness incubation and eval
> structures. Decision to be recorded here once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
