---
id: ADR-004
title: "nxtlvl-harness internal structure — layers, runtime contracts, and language"
status: Draft
date: 2026-07-28
---

# ADR-004: nxtlvl-harness internal structure — layers, runtime contracts, and language

## Context

ADR-001 establishes `nxtlvl-harness` as a Claude Code plugin — the daily-driver harness.
ADR-003 establishes that everything is built from scratch. Neither records what the plugin
should actually contain, how its layers should be structured, what runtime each layer runs
under, or what language the executable layers should be written in.

These are the foundational structural decisions for the harness. They need to be made
explicitly rather than inherited from whatever was built during earlier exploration. The
current state of `plugins/nxtlvl/` is prior exploratory work — useful as a reference
for what problems surfaced during that exploration, but not binding on this decision.

### The questions

**1. What layers does the harness have, and what is each layer's job?**

A Claude Code plugin can contain skills, agents, commands, hooks, and arbitrary
executable code. The right set of layers — and the boundaries between them — is an open
question. Options range from a thin markdown-only plugin that delegates all execution to
native CC, to a richer plugin with significant executable machinery.

**2. What are the runtime contracts for executable layers?**

CC spawns hooks as child processes on every matching event. MCP servers run as long-lived
processes. Scripts run on demand. Each execution model has different constraints on
startup time, dependencies, language, and build tooling. The runtime contract for each
executable layer needs to be defined before language can be decided.

**3. What language and build tooling?**

Language and build tooling are downstream of the runtime contract. A hook spawned on
every tool call has different constraints than a CLI tool run once at promotion. The
question cannot be answered globally — it needs to be answered per layer, once the layers
and their contracts are defined.

### What agents-wiki is being queried on

- What layers do production harnesses have, and how do they divide responsibility?
- What runtime contracts do hooks operate under — language, dependencies, startup cost?
- What language and build tooling patterns appear across production harnesses for
  executable hook and library code?
- Any anti-patterns: layers that shouldn't exist, language choices that caused problems?

## Decision

> **Pending** — scoping the layers and their runtime contracts; querying agents-wiki on
> production harness structure and hook language patterns. Decision to be recorded here
> once the call is made.

## Alternatives Considered

> To be completed alongside the decision.

## Consequences

> To be completed alongside the decision.
