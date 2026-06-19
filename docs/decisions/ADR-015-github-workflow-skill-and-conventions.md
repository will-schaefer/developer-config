---
id: ADR-015
title: "Standardize the GitHub workflow as a vendored skill that composes the review agent — Conventional Commits, no attribution"
status: Superseded
date: 2026-06-18
superseded-by: ADR-016
---

> **Superseded by [ADR-016](ADR-016-git-workflows-domain-command-agent-skill.md).** The *conventions*
> below (Conventional Commits, no attribution, full-loop scope, compose `nxtlvl:review`) carry forward
> unchanged; what ADR-016 revisits is the *shape* — from a single in-context skill to a three-layer
> `command → agent → skill` domain with an isolated executor. (Renumbered from ADR-012 when this branch
> landed behind `main`'s ADR-012–014; the decision content is unchanged.)

# ADR-015: Standardize the GitHub workflow as a vendored skill that composes the review agent — Conventional Commits, no attribution

## Context

Agents working in `nxtlvl` improvise the path from working tree to merged PR — branch naming,
commit style, PR shape, when to review, when to merge — differently each session. That drift is
exactly the kind of task-independent machinery the harness is meant to standardize: *would I want
this no matter what I'm working on this week?* → yes ([ADR-008](ADR-008-reactive-growth-intake-gate.md)
membership test). agent-skills/ECC ship two bases — `git-workflow` (local git → PR) and
`github-ops` (issues/CI/releases) — but neither matches nxtlvl as-is, and three choices are
genuinely contested:

1. **Commit convention.** The ECC base mandates Conventional Commits; this repo's *actual* history
   is imperative sentence-case ("Add dangerous-bash gate", "Vendor ECC-main reference"). A standard
   must pick one, and the two sources disagree.
2. **Shape — skill or agent.** The ECC shape is an *agent that executes skills*. But the operative
   axis for that choice ([`../reference/ecc-agent-vs-skill-scoping.md`](../reference/ecc-agent-vs-skill-scoping.md)
   §5) is **isolation / a restricted tool sandbox / autonomy / a model tier** — and an agent is
   *required* only when a capability must be tool-restricted (the read-only reviewer is the type
   case). The GitHub loop is the opposite: it **writes, commits, and pushes** (no read-only sandbox
   to express), it operates on the **main thread's working tree** where the work should be visible,
   and its one genuinely noisy, isolatable step — review — is **already an agent** (`nxtlvl:review`).
   The axis points to a **skill**, not a new agent.
3. **Attribution.** ECC disables commit attribution globally; this repo's history carries
   `Co-Authored-By` trailers. The standard has to say which is canonical.

## Decision

Ship the GitHub workflow as a **skill**, refined for fit — matching the existing `review` and
`documentation-and-adrs` skills and the agent-skills foundation ([ADR-003](ADR-003-compose-not-reconstruct.md)):

- **Skill `nxtlvl:github-workflow`** — vendored from `git-workflow` + `github-ops`, self-contained
  for the everyday loop (`branch → commit → PR → review → CI → merge`), with the long tail left as a
  pointer into `reference/ECC-main`. Scope is the **full loop**; issue triage / releases / stale /
  security stay out until a logged repeat-need pulls them in.
- **Composition, not a new agent.** The skill runs **in the current context** and, at the review
  stage, **spawns the existing `nxtlvl:review` agent** — isolation lives exactly where it's needed
  (the read-only reviewer), and the workflow knowledge stays a caller-agnostic skill. No standalone
  `github-workflow` agent: it would need broad write tools (the *inverse* of the sandbox rationale),
  and the intent doc parks agent-building as **reactive, not pre-built**.
- **Conventional Commits** is the nxtlvl standard (`<type>(<scope>): <subject>`), refining *toward*
  the ECC base and *away* from this repo's sentence-case history — machine-parseable, enables
  changelog tooling, and aligns branch names with commit types.
- **No attribution** — commits are clean, no `Co-Authored-By` / agent signature, matching the ECC
  global default. (An execution environment that *forces* a trailer, e.g. a remote CI harness, is
  that environment's policy, not the nxtlvl standard.)

## Alternatives Considered

### Standalone `github-workflow` agent (the ECC shape)
- Pros: runs the whole loop in an isolated context and could hand back only a status line — fitting
  a fire-and-forget `/ship` that keeps diff/CI/review noise off the main thread.
- Cons: fails the §5 checklist — the loop mutates the tree (no read-only sandbox to express, the
  decisive tell), git work is something you want *visible* on the main thread, and the genuinely
  isolatable step (review) is already its own agent. It also introduces nxtlvl's first agent
  pre-emptively, against the intent doc's "agent-building stays reactive."
- Rejected for now: if a fire-and-forget off-thread ship loop is ever actually wanted, that is the
  reactive trigger to add a thin agent wrapper — admitted via the intake gate, not pre-built here.

### Keep imperative sentence-case (match existing history)
- Pros: zero churn; consistent with the commits already in the repo.
- Cons: not machine-parseable; no type vocabulary to share with branch names; diverges from the base
  every agent-skills/ECC artifact assumes.
- Rejected: the standard is forward-looking; Conventional Commits buys tooling and a shared
  vocabulary one-off sentence-case can't.

### Reconstruct review inside the workflow skill
- Pros: a single self-contained skill.
- Cons: duplicates `nxtlvl:review`, re-deriving SDLC substance the harness already owns — the exact
  anti-goal of [ADR-003](ADR-003-compose-not-reconstruct.md).
- Rejected: the skill composes `nxtlvl:review`; it does not re-implement it.

### Full github-ops scope (issues, releases, stale, security)
- Pros: one skill covers everything GitHub.
- Cons: most of it is task-dependent and unproven for this workload; violates the intake gate's
  "build the task-independent core, grow the rest reactively."
- Rejected: ship the full *loop*; admit ops only on a logged repeat-need ([ADR-008](ADR-008-reactive-growth-intake-gate.md)).

## Consequences

- `nxtlvl`'s GitHub loop is a **third vendored skill**, consistent with `review` +
  `documentation-and-adrs` and the agent-skills foundation; `nxtlvl` still ships **no agents of its
  own**, and ECC stays the dormant backstop ([ADR-002](ADR-002-ecc-dormant-reference-backstop.md)).
- The skill depends **one-way** on `nxtlvl:review` (knowledge consults the reviewer agent); no caller
  coupling leaks back into the review agent.
- Commit history going forward is Conventional-Commit form; the earlier sentence-case commits are
  left as-is (not rewritten — public history).
- The workflow leans on the `dangerous-bash` gate ([ADR-006](ADR-006-hook-fail-open-gated-blocking.md))
  for force-push protection rather than re-implementing guards.
- Logged as an intake event in `docs/plan/nxtlvl-skill-intake-backlog.md` per
  [ADR-008](ADR-008-reactive-growth-intake-gate.md); recorded here per the global decision rule
  ([ADR-010](ADR-010-global-decision-rule.md)).
