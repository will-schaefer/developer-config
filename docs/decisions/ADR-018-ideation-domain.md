---
id: ADR-018
title: "Ideation domain — a main-thread orchestrator skill with isolated read-only support agents"
status: Draft
date: 2026-06-28
---

# Ideation domain — a main-thread orchestrator skill with isolated read-only support agents

## Context

The ideation phase — turning a raw idea into confirmed intent and an approved direction before any
spec or code — is currently **all upstream and unowned**: the router points at `interview-me`,
`idea-refine`, and `spec-driven-development` (all `agent-skills:*`), and there is **no direction
front door** at all. The work that vanilla `superpowers:brainstorming` does (explore → 2–3
approaches → direction → gate) lives nowhere in nxtlvl, and `interview-me`'s sharp intent engine
isn't composed with it.

The user directed a **whole-domain** build of this phase — refined nxtlvl versions of the ideation
skills plus a front-door orchestrator, support agents, and commands. That makes this a
user-directed, proactive domain build (a confident-core capability domain like the C&M subsystem),
not a reactive un-deferral under the extension gate
([ADR-015](ADR-015-scope-determination-and-extension-gate.md)).

Two precedents frame the shape. The git-workflows domain
([ADR-017](ADR-017-git-workflows-domain.md)) established that an nxtlvl domain ships as a
three-layer `command → agent → skill` set ([scoping doctrine](../reference/ecc-agent-vs-skill-scoping.md)
§3) with an **isolated agent executor**. And
[ADR-012](ADR-012-agent-design-contract.md) fixed the knowledge/execution split. The open
question this ADR settles: *what shape does the ideation domain take* — given that its core work
is fundamentally different from git-workflows'.

## Decision

Ship the ideation phase as a three-layer **ideation domain**, but place the executor on the
**main thread** (the deliberate counterpart to the git-workflows domain's isolated agent executor)
and resolve the synthesis question by **ownership**:

- **Skills (◆, the knowledge layer)** — four refined, caller-agnostic skills:
  `interview-me` (intent engine), `grill-me` (deep interrogation tier), `idea-refine` (variant
  generation), and `brainstorming` (the front-door **orchestrator**). The orchestrator depends
  on the other three one-way; they name no caller (ADR-012, scoping §3).
- **Agents (isolated, read-only support)** — `context-scout`, `idea-critic`, and
  `approach-explorer`. All scoped to `Read, Grep, Glob` — **no `Write`/`Edit`**. They are
  spawned by the skill at specific seams and return a brief/verdict; the noisy work stays off
  the main thread.
- **Commands (thin entries)** — `/brainstorm` (front door) plus `/interview-me`, `/grill-me`,
  `/idea-refine` aliases.

**Why the executor is a main-thread skill, not an agent.** The git-workflows domain's executor
is an isolated agent because committing/reviewing is non-interactive work whose noise should
leave the thread. The ideation domain's core work is the **opposite kind**: a live,
one-question-at-a-time **interview** with the user. Agents run in their own context and cannot
converse with the user — an interview run as an agent would be deaf. So the executor *must* run
where the conversation is: a **main-thread skill**. The agent layer doesn't disappear; it is
**repurposed** to the isolatable sub-tasks that *are* non-interactive and read-only —
repo-context scouting, adversarial idea critique, parallel approach-exploration. Same
three-layer domain, opposite executor placement, forced by the interactivity of the work.

**Why composition, not a fork (synthesis resolved by ownership).** The earlier open question was
whether `brainstorming` should *inline a fork* of `interview-me`'s engine (coherent, but a copy
that drifts from upstream) or *delegate* to it (no copy, but a relay seam). Owning a refined
`nxtlvl:interview-me` dissolves the dilemma: `brainstorming` **composes** it as factored
knowledge — one copy, consulted one-way. The drift risk existed only while `interview-me` was
upstream; refining it in-domain removes it (ADR-012, [ADR-003](ADR-003-compose-not-reconstruct.md)).

## Alternatives Considered

### Front-door orchestrator that delegates to *upstream* ideation skills
- Pros: zero duplication; smallest surface; composes existing `agent-skills:*`.
- Cons: leaves the ideation phase unowned and upstream-shaped; no refined nxtlvl conventions in
  the intent/variant skills; a permanent relay seam to skills we don't control.
- Rejected: the user directed ownership of the whole phase; a relay doesn't deliver refined
  skills or a coherent domain.

### Full-inline fork of `interview-me` into `brainstorming`
- Pros: one self-contained skill; maximal coherence to run.
- Cons: duplicates ~200 lines of a sibling skill's protocol; the copy drifts as upstream
  evolves; violates the factored-knowledge rule (scoping §3).
- Rejected: owning `interview-me` as its own refined skill gives the coherence without the copy.

### Run the interview as an isolated agent (the git-workflows domain's literal shape)
- Pros: structurally uniform with git-workflows; noisy exploration leaves the thread.
- Cons: **impossible** — agents can't hold a one-question-at-a-time dialogue with the user; the
  defining work of the domain is interactive.
- Rejected: the interactivity of the interview forbids it. This is the forcing constraint.

### Single in-context skill, no agents (a pure anti-agent stance)
- Pros: simplest; one file; everything visible on the thread.
- Cons: forfeits isolation for the genuinely isolatable sub-tasks — repo sweeps, adversarial
  critique, and parallel approach-exploration would all pollute the main context.
- Rejected: those three sub-tasks are read-only and noisy — exactly the agent sweet spot
  (scoping §5); demoting them to inline work wastes the isolation win.

## Consequences

- The ideation domain is nxtlvl's **first domain whose executor is a main-thread skill** — the
  deliberate counterpart to the git-workflows domain's isolated-agent executor
  ([ADR-017](ADR-017-git-workflows-domain.md)). The scoping doctrine's `command → agent → skill`
  shape holds; only the executor's *placement* flips, so the two domains now document both
  polarities.
- The support agents **cannot mutate the tree by design** (read-only sandbox) — they inform the
  dialogue and hand briefs back; `idea-critic` is the pre-decision sibling of the existing
  post-decision `doubt-reviewer`.
- `brainstorming` **depends on** `interview-me`/`grill-me`/`idea-refine`, so the build order is
  knowledge-skills-first, orchestrator-last (spec §11).
- **Skill internals stay user-owned** — this ADR pins the domain *shape*; each skill's body is
  authored and iterated via `/skill-creator`. The architecture is stable while content evolves.
- The domain **composes** the native `spec-driven-development → planning-and-task-breakdown`
  pipeline and the decision rule rather than reconstructing them
  ([ADR-003](ADR-003-compose-not-reconstruct.md)); `spec-driven-development` stays native as the
  ideation→contract boundary.
- Recorded per the global decision rule (`~/.claude/rules/decisions.md`); full architecture in
  [`../spec/nxtlvl-ideation-domain.md`](../spec/nxtlvl-ideation-domain.md).
