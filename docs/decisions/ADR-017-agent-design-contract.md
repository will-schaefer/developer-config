---
id: ADR-017
title: "Main session orchestrates; agents are scoped specialists on a lean ECC-style contract"
status: Accepted
date: 2026-06-18
---

# ADR-017: Main session orchestrates; agents are scoped specialists on a lean ECC-style contract

## Context
Phase 1 (Design) of a gated, phase-by-phase review of ecc's agent-development lifecycle. `nxtlvl`
has zero agents today (only hooks + two skills) and is deliberately small. The operating model is
now recorded in intent ([`../intent/personal-harness.md`](../intent/personal-harness.md)): the
main session is a **lean orchestrator that delegates to specialist subagents** chosen by the
present task. This decision answers: *when nxtlvl creates an agent, what is its design contract —
and how do the orchestrator model and scope shape the roster?*

ecc's design doctrine (sources read):
- **The agent contract** — frontmatter `name` / `description` / `tools` / `model` (+ optional
  `color`); body = prompt-defense baseline → role / "when invoked" loop → rubric / output format →
  a `see skill:` **pointer, not embedded knowledge**. The `tools:` allowlist *is* the design —
  read-only reviewer vs. write-capable resolver is the sandbox.
- **`agent-harness-construction`** (`skills/agent-harness-construction/SKILL.md:12-74`) — narrow
  schema-first tool inputs; deterministic observation shape (`status` / `summary` /
  `next_actions` / `artifacts`); an error-recovery contract (root-cause hint + safe retry + stop
  condition); context budgeting = move guidance into on-demand skills, compact at phase boundaries.
- **`agent-sort`** (`skills/agent-sort/SKILL.md:22-49`) — evidence-based DAILY/LIBRARY
  classification; "LIBRARY does not mean delete — it means keep accessible without loading by
  default."

ecc itself is **agent-heavy**: 67 agents, of which ~35-40 are per-language or per-domain
specialists (go, rust, swift, django, react, healthcare, seo, network, …). `nxtlvl` serves one
operator working across a *limited* set of stacks, so most of that matrix is out of scope by
relevance.

**Relation to the build ADRs.** This is a *review-phase* design decision; the parallel
*build-phase* ADRs since fixed the concrete agent↔skill mechanism and the starting roster —
[ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md) (agents execute, skills hold
knowledge; point to a skill, don't restate it),
[ADR-015](ADR-015-agent-skill-load-rule-methodology-vs-spawn-target.md) (runner agents load the
skill, spawn-target agents do not), and
[ADR-016](ADR-016-confident-core-capability-domains.md) (a build-now confident-core of domains).
Where they decide the same point, they are authoritative; this ADR composes with them, noted
inline below.

## Decision

1. **Operating model: orchestrator + specialists (first-class).** The main session is a lean
   orchestrator that delegates to specialist subagents by present task. Specialists are a
   **primary** surface, not a last resort. The dispatch primitive stays native; the composition
   (which specialists exist, when to delegate) is ours
   ([ADR-003](ADR-003-compose-not-reconstruct.md)).
   - **1a. Scope.** The roster is bounded to the operator's actual stacks (Next.js/TS, Python,
     Rust) + cross-cutting general agents + agent-building. A bounded confident-core is
     **build-now** ([ADR-016](ADR-016-confident-core-capability-domains.md): Python, TS/JS, Rust,
     Frontend & UI, Backend/Architecture); everything beyond it grows **reactively** through the
     intake gate ([ADR-008](ADR-008-reactive-growth-intake-gate.md)); dormant ecc is the
     on-demand fallback library ([ADR-002](ADR-002-ecc-dormant-reference-backstop.md)). This is
     ecc's own `agent-sort` evidence logic applied at the *operator* level.
   - **1b. Realization test.** Realize a specialist as a **native agent that loads its knowledge
     skill** by default — the runner case of
     [ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md) (a spawn-target agent instead
     takes a schema pointer and does not load,
     [ADR-015](ADR-015-agent-skill-load-rule-methodology-vs-spawn-target.md)); build a **custom
     agent** only when an agent-only property forces it — isolated context, a restricted tool
     allowlist, or a distinct model tier
     (per [`../reference/ecc-agent-vs-skill-scoping.md`](../reference/ecc-agent-vs-skill-scoping.md)).
     The test decides *how* to realize a specialist, not *whether* to have one.

2. **Adopt ecc's lean agent contract** for any agent we author:
   - Frontmatter: `name` (kebab, matches filename), `description` (activation trigger), `tools`
     (minimal allowlist), `model` (tier name, not a pinned ID).
   - Body: prompt-defense baseline → role / when-invoked loop → rubric / output format → a
     pointer to the knowledge skill, **not** the knowledge itself — the
     point-to-a-skill-don't-restate-it convention later fixed by
     [ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md) (pointers over content,
     [ADR-007](ADR-007-context-budgeted-injection.md); knowledge stays caller-agnostic).
   - The tool allowlist is the load-bearing choice: read-only vs. write-capable is the sandbox.

3. **Adopt `agent-harness-construction`'s discipline** as the authoring checklist: narrow tool
   inputs, deterministic output shape, an explicit error-recovery contract (root-cause + safe
   retry + stop condition), and context budgeting via skill-loading + compact-at-phase-boundaries.

## Alternatives Considered

### Recreate ecc's per-language / per-domain agent matrix
- Pros: instant breadth.
- Cons: ~35-40 of the 67 are specialists for stacks the operator doesn't use — **out of scope**,
  not useful-but-declined; bloats namespace and context.
- Rejected on scope: dormant ecc already provides them as a fallback library
  ([ADR-002](ADR-002-ecc-dormant-reference-backstop.md)); applying ecc's own `agent-sort`
  evidence logic at the operator level demotes them to library, not daily.

### Agents as a last resort (skills + native agents only; custom agents rare)
- Pros: smallest possible surface.
- Cons: contradicts the recorded operating model — if the main session orchestrates by
  delegation, specialists are the *normal* mode, not an exception.
- Rejected: superseded by the orchestrator intent. The roster is bounded instead by scope (1a)
  and the intake gate, not by treating agents as exceptional.

### Pin per-agent model IDs now
- Pros: explicit routing.
- Cons: premature with zero agents; tier names (haiku/sonnet/opus) are the portable convention.
- Rejected.

## Consequences
- The main session is designed as an orchestrator; agent specialists are first-class, but the
  roster stays bounded by scope + the intake gate rather than pre-populated to ecc breadth.
- A written contract + realization test exists to author against — no ad-hoc agent design.
- `agent-sort`'s install machinery is **not** adopted; its evidence principle is already covered
  by [ADR-002](ADR-002-ecc-dormant-reference-backstop.md) +
  [ADR-008](ADR-008-reactive-growth-intake-gate.md), now applied at the operator level.
- Consistent with [ADR-003](ADR-003-compose-not-reconstruct.md): the orchestrator posture *is*
  designing the composition layer; the dispatch primitive underneath stays native.
- Open: the first specialists graduate reactively from real tasks. The likeliest first custom
  agent is a read-only review specialist (sandbox over a diff) — to be weighed in Phase 3
  (Evaluate) against the existing `review` skill. *(Resolved by the build: the first agents are
  `doc-keeper`, a methodology/runner agent that loads its skill
  ([ADR-012](ADR-012-agents-execute-skills-hold-knowledge.md)), and `doubt-reviewer`, a read-only
  spawn-target reviewer that does not
  ([ADR-015](ADR-015-agent-skill-load-rule-methodology-vs-spawn-target.md)).)*
