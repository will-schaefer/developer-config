---
id: ADR-003
title: "Compose on native + agent-skills; reconstruct only the plumbing; never reconstruct orchestration"
status: Accepted
date: 2026-06-16
amended: 2026-06-19
---

# ADR-003: Compose on native + agent-skills; reconstruct only the plumbing; never reconstruct orchestration

## Context
The whole point of `nxtlvl` is to **learn agent-harness architecture by rebuilding it** —
but "rebuild everything" would re-explode the project to ecc scale and re-derive things that
are already done well natively. The learning target must be scoped precisely, or the build
never ends and the result is a slower shim around the real platform.

Three kinds of machinery are in play, and they call for **opposite strategies**:
1. The **plumbing** native CC / agent-skills don't hand me (packaging, context assembly,
   memory, composition, hooks, audit).
2. The **workflow substance** (how to review, how to develop) — already well-covered by
   agent-skills.
3. The **orchestration primitives** (skill routing, agent dispatch, the tool-use loop,
   context-window assembly) — owned by the platform, below the plugin boundary.

## Decision
Adopt a three-tier strategy:

- **Plumbing layer → reconstruct.** This is where the learning lives: layered config +
  plugin packaging, **context assembly** ([ADR-007](ADR-007-context-budgeted-injection.md)),
  **memory** ([ADR-004](ADR-004-extend-native-memory.md)), the composition layer, a lean
  **hook** layer ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md)), and the **audit**
  ([ADR-009](ADR-009-objective-invoked-audit-gate.md)).
- **Workflow layer → compose, don't reconstruct.** Dev and review **wrap and refine
  agent-skills** + my conventions. Skills are **vendored into the repo and refined for fit**
  — not called untouched, not rebuilt from scratch. Research is the one workflow I build
  fresh (agent-skills lacks it; `deep-research` is a *structural reference only*).
- **Orchestration → native, always.** Skill routing, agent dispatch, the tool-use loop, and
  context-window assembly **must not be reconstructed**. Deterministic multi-agent control
  uses the native `Workflow` tool. I learn orchestration by *reading* CC/ecc and *designing
  the composition layer*, not by reimplementing the dispatcher.

The dividing question throughout: **"learn by reconstruction" applies to the harness, not
the SDLC content.**

## Alternatives Considered

### Reconstruct everything (including orchestration)
- Pros: maximal understanding-by-rebuilding.
- Cons: a hand-built router is structurally a slower, capped shim around the real
  dispatcher; re-derives review/dev substance, re-expanding the learning target to ecc
  breadth. ecc itself reimplements none of this.
- Rejected: the cost is enormous and the result is worse than native.

### Compose everything (reconstruct nothing)
- Pros: fastest to a working harness.
- Cons: defeats the learning goal; leaves the plumbing un-owned and un-tailorable.
- Rejected: I want a harness I understand to the metal, not one I merely configure.

### Fork ecc and trim it
- Pros: inherits a working architecture.
- Cons: inherits ecc's complexity and assumptions; trimming is harder than building lean;
  no clean learning path.
- Rejected: ecc stays a dormant reference ([ADR-002](ADR-002-ecc-dormant-reference-backstop.md)),
  not a base to fork.

## Consequences
- A hard, explicit **"never reconstruct"** boundary: router / dispatch / tool-loop / context-
  window assembly are out of scope, permanently.
- The composition layer (when skills fire, how agents chain, how outputs compose) is *mine*;
  the orchestration *primitive* underneath it is native.
- Vendoring individual agent-skills skills stays **reactive**
  ([ADR-008](ADR-008-reactive-growth-intake-gate.md)) — v1 workflows compose, they don't copy.
- The "production quality" bar applies to the plumbing layer, not the envelope.
- **Amended 2026-06-19 by [ADR-027](ADR-027-router-endorses-only-established-items.md):** the
  *router's* exposure of the agent-skills floor is removed — `nxtlvl-router` endorses only
  established nxtlvl items and goes dark at unowned phases (precedence collapses to
  `nxtlvl → native`). This narrows the "compose on agent-skills" conclusion **for the router only**;
  the three-tier strategy (plumbing-reconstruct, orchestration-native, reactive workflow-vendoring)
  otherwise stands. agent-skills remains installed and composable directly — it is simply no longer
  routed to.
