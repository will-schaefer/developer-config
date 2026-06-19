---
id: ADR-021
title: "Orchestration — adopt the gated delegate-don't-inline pipeline; own the composition, never the dispatch runtime; scoped roster"
status: Accepted
date: 2026-06-19
---

# ADR-021: Orchestration — adopt the gated delegate-don't-inline pipeline; own the composition, never the dispatch runtime; scoped roster

## Context
Phase 5 (Orchestrate) of the harness-review build method. This is where the operating model
fixed in [ADR-017](ADR-017-agent-design-contract.md) — a lean orchestrator delegating to
specialists — lands fully, against the hard constraint in
[ADR-003](ADR-003-compose-not-reconstruct.md): compose on native dispatch, never reconstruct
orchestration.

ECC offers four surfaces. `orch-pipeline`: a gated Research -> Plan -> Implement(TDD) -> Review
-> Commit pipeline with a size classifier, a security-review trigger, and two human gates, whose
cardinal rule is that the wrappers delegate every phase and never re-implement work inline.
`plan-orchestrate`: reads a plan, tags each step, looks up an agent chain from a tag->chain
table, and emits paste-able `/orchestrate custom "a,b,c" "task"` commands. `team-agent-
orchestration`: a multi-agent team runtime — work-item cards, agent Kanban, a control pane, an
integrator, cross-session board state. `team-builder`: an interactive picker that fans out up to
five agents in parallel through the native Agent tool and synthesizes the results.

Each surface splits into composition (which specialists, when, in what gated order, how briefed)
and dispatch runtime (the chain-runner, the router table, the control pane). ADR-017 makes the
composition ours; ADR-003 keeps the runtime native.

## Decision
1. **Adopt the gated, size-classified, delegate-don't-inline pipeline as nxtlvl's orchestration
   shape.** Ceremony scales to blast radius (trivial -> large selects which phases run); phases
   are Intake -> Research/Reuse -> Plan -> Implement -> Review -> Commit; each phase **delegates
   to a specialist and is never executed inline by the orchestrator**; a security-review trigger
   pulls in the security specialist whenever the diff touches a sensitive surface. Two human
   gates stand: after Plan and before Commit — the orchestrator's stop-and-ask points
   ([ADR-018](ADR-018-agent-authoring-method.md)).
2. **Own the composition; never build the dispatch runtime
   ([ADR-003](ADR-003-compose-not-reconstruct.md)).** Routing is native description-triggered
   dispatch (the `Task`/`Workflow` tools) plus the orchestrator's judgment over a small scoped
   roster ([ADR-017](ADR-017-agent-design-contract.md)) — not a tag->chain lookup table, a
   `/orchestrate` chain-runner, or a Kanban control pane. The agent/command map starts from the
   build-now confident-core ([ADR-016](ADR-016-confident-core-capability-domains.md): Python,
   TS/JS, Rust, Frontend, Backend) plus cross-cutting generals, and grows reactively beyond it
   through the intake gate ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).
3. **Adapt the composition-side patterns.** Self-contained delegation briefs — acceptance
   criteria and an inherited scope-guard, no "open the plan doc" dependency (plan-orchestrate
   Phase 3), which is the skill-load dependency ([ADR-018](ADR-018-agent-authoring-method.md))
   plus a clear task. Parallel fan-out with result synthesis (agreements / conflicts / next steps) for
   genuinely independent work, on the native Agent tool. Dynamic discovery of the roster over
   hardcoded lists. Per-phase quality and recovery come from
   [ADR-019](ADR-019-agent-evaluation-model.md) self-evaluation and
   [ADR-020](ADR-020-agent-debugging-model.md) self-debug. Delegation also isolates context
   ([ADR-007](ADR-007-context-budgeted-injection.md)).
4. **Keep the team failure-mode guardrails, drop the team runtime.** Watch for agent soup (many
   agents, no owner or merge gate), invisible work (output only in a transcript), and overlapping
   writes (parallel agents on the same files) — the last handled by worktree isolation, the same
   isolation test that justifies a custom agent in
   [ADR-017](ADR-017-agent-design-contract.md).

## Alternatives Considered

### Adopt plan-orchestrate's chain emitter + the /orchestrate chain-runner
- Pros: precomputed, paste-able multi-agent chains; deterministic mapping.
- Cons: a tag->chain lookup table and a sequential chain-runner are a reconstructed router —
  exactly what [ADR-003](ADR-003-compose-not-reconstruct.md) forbids; routing belongs to native
  dispatch plus orchestrator judgment.
- Rejected: keep the delegation-brief hygiene; drop the code-gen, the catalogue table, and the
  `/orchestrate` dependency.

### Adopt team-agent-orchestration's Kanban control pane and card runtime
- Pros: visible cross-session state for many agents and people.
- Cons: a persistent multi-agent team runtime — reconstructed orchestration, and aimed at a squad
  of human+agent teammates, not a single operator
  ([ADR-017](ADR-017-agent-design-contract.md) scope).
- Rejected: keep the failure-mode guardrails and worktree isolation; drop the board, cards,
  control pane, and integrator role.

### Adopt team-builder's interactive picker as the routing surface
- Pros: a friendly menu for browsing an unknown roster.
- Cons: ceremony for a small, owned, scoped roster; the orchestrator already picks by task.
- Rejected: keep parallel fan-out + synthesis + dynamic discovery; drop the interactive menu.

### Pre-build the full orch-* family (five operations) up front
- Pros: complete coverage on day one.
- Cons: against reactive growth ([ADR-008](ADR-008-reactive-growth-intake-gate.md)); most
  operations are unused until a real task needs them.
- Rejected: the pipeline is one composition the orchestrator runs; operations and specialists
  grow reactively.

## Consequences
- nxtlvl has one operating shape: a gated, size-classified pipeline whose every phase is a
  delegation to a scoped specialist, with human gates after Plan and before Commit — the ADR-017
  operating model made concrete on native dispatch.
- The composition/runtime boundary is explicit: we author *which specialists and when*; Claude
  Code provides *how dispatch happens*. No router, chain-runner, or control pane is built
  ([ADR-003](ADR-003-compose-not-reconstruct.md)).
- Delegation briefs, parallel-fan-out synthesis, and dynamic discovery become standing
  composition patterns; per-phase quality/recovery reuse
  [ADR-019](ADR-019-agent-evaluation-model.md) / [ADR-020](ADR-020-agent-debugging-model.md).
- Team-runtime machinery stays rejected, but its failure modes become orchestrator guardrails,
  with worktree isolation as the answer to overlapping parallel writes.
- The pipeline, its operations, and the agent map grow reactively through the intake gate
  ([ADR-008](ADR-008-reactive-growth-intake-gate.md)) beyond the build-now confident-core
  ([ADR-016](ADR-016-confident-core-capability-domains.md)), not pre-built to ECC's scale.
